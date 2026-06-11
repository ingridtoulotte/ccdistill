'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { claudeDir, encodeProjectPath } = require('./paths');
const { estimateTokens } = require('./tokens');

const CONTEXT_WINDOW = 200000;

// Typical fixed overhead of a Claude Code session (system prompt + built-in
// tool schemas), measured against /context on recent releases. Estimates —
// they drift with Claude Code versions, which is why they are labeled so.
const BASELINE = [
  { source: 'Built-in tools (baseline)', tokens: 14000, kind: 'baseline', detail: 'fixed by Claude Code' },
  { source: 'System prompt (baseline)', tokens: 3000, kind: 'baseline', detail: 'fixed by Claude Code' },
];

// Rough per-server cost when the real tool list is unknown: each MCP tool
// schema injects ~500-1500 tokens; servers average 5-10 tools.
const MCP_SERVER_ESTIMATE = 4500;

function readIfFile(p) {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return null;
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function readJson(p) {
  const raw = readIfFile(p);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** CLAUDE.md and CLAUDE.local.md from cwd up to the filesystem root. */
function memoryFiles(cwd) {
  const found = [];
  let dir = cwd;
  for (;;) {
    for (const name of ['CLAUDE.md', 'CLAUDE.local.md']) {
      const p = path.join(dir, name);
      const content = readIfFile(p);
      if (content != null) found.push({ path: p, content });
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

function skillsIndex(rootDirs) {
  const skills = [];
  for (const root of rootDirs) {
    let entries;
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillFile = path.join(root, e.name, 'SKILL.md');
      const content = readIfFile(skillFile);
      if (content == null) continue;
      const desc = frontmatterField(content, 'description') || '';
      skills.push({ name: e.name, description: desc });
    }
  }
  return skills;
}

function frontmatterField(content, field) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const line = m[1].split(/\r?\n/).find((l) => l.startsWith(field + ':'));
  return line ? line.slice(field.length + 1).trim() : null;
}

function mcpServers(cwd, home) {
  const servers = new Map(); // name -> { scope, transport }
  const add = (obj, scope) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [name, def] of Object.entries(obj)) {
      if (servers.has(name)) continue;
      const transport = def && def.url ? 'http' : def && def.command ? 'stdio' : '?';
      servers.set(name, { name, scope, transport });
    }
  };

  const projectCfg = readJson(path.join(cwd, '.mcp.json'));
  add(projectCfg && projectCfg.mcpServers, 'project (.mcp.json)');

  const globalCfg = readJson(path.join(home, '.claude.json'));
  if (globalCfg) {
    add(globalCfg.mcpServers, 'user (~/.claude.json)');
    const proj = globalCfg.projects && globalCfg.projects[cwd];
    add(proj && proj.mcpServers, 'local (~/.claude.json)');
  }

  return [...servers.values()];
}

/**
 * Static audit of everything injected into context at session start.
 * Pure filesystem reads — no session needed, no API calls, works in CI.
 */
function auditContext(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const home = opts.home || os.homedir();
  const dir = claudeDir(opts.claudeDir);

  const items = BASELINE.map((b) => ({ ...b }));

  const userMd = readIfFile(path.join(dir, 'CLAUDE.md'));
  if (userMd != null) {
    items.push({
      source: 'User CLAUDE.md',
      tokens: estimateTokens(userMd),
      kind: 'memory',
      detail: path.join(dir, 'CLAUDE.md'),
    });
  }

  for (const f of memoryFiles(cwd)) {
    items.push({
      source: `Project ${path.basename(f.path)}`,
      tokens: estimateTokens(f.content),
      kind: 'memory',
      detail: f.path,
    });
  }

  const memoryIndex = readIfFile(
    path.join(dir, 'projects', encodeProjectPath(cwd), 'memory', 'MEMORY.md')
  );
  if (memoryIndex != null) {
    items.push({
      source: 'Auto-memory MEMORY.md',
      tokens: estimateTokens(memoryIndex),
      kind: 'memory',
      detail: `${memoryIndex.split(/\r?\n/).filter((l) => l.trim()).length} lines`,
    });
  }

  const skills = skillsIndex([path.join(dir, 'skills'), path.join(cwd, '.claude', 'skills')]);
  if (skills.length > 0) {
    const tokens = skills.reduce(
      (sum, s) => sum + estimateTokens(s.name + ' ' + s.description) + 15,
      0
    );
    items.push({
      source: `Skills index (${skills.length} skills)`,
      tokens,
      kind: 'skills',
      detail: 'name + description loaded per skill',
      skills,
    });
  }

  const servers = mcpServers(cwd, home);
  for (const s of servers) {
    items.push({
      source: `MCP: ${s.name}`,
      tokens: MCP_SERVER_ESTIMATE,
      kind: 'mcp',
      detail: `${s.transport}, ${s.scope} — estimate; actual cost = tool schemas`,
    });
  }

  items.sort((a, b) => b.tokens - a.tokens);
  const total = items.reduce((sum, i) => sum + i.tokens, 0);

  return {
    cwd,
    claudeDir: dir,
    items,
    total,
    window: CONTEXT_WINDOW,
    pct: total / CONTEXT_WINDOW,
    recommendations: recommend(items, total),
  };
}

function recommend(items, total) {
  const recs = [];
  const by = (kind) => items.filter((i) => i.kind === kind);

  for (const i of by('memory')) {
    if (i.tokens > 2000) {
      recs.push(
        `${i.source} is ~${i.tokens} tokens and loads every session — move rarely-needed sections into skills or docs Claude reads on demand.`
      );
    }
  }

  const mem = items.find((i) => i.source === 'Auto-memory MEMORY.md');
  if (mem && mem.tokens > 1200) {
    recs.push('Auto-memory index is large — prune stale entries; every line is paid on every session start.');
  }

  const mcp = by('mcp');
  if (mcp.length >= 4) {
    recs.push(
      `${mcp.length} MCP servers configured — each injects its full tool schemas. Remove unused ones: \`claude mcp remove <name>\` (check usage with \`/mcp\`).`
    );
  }

  const skillsItem = items.find((i) => i.kind === 'skills');
  if (skillsItem && skillsItem.skills && skillsItem.skills.length > 25) {
    recs.push(`${skillsItem.skills.length} skills installed — consolidate overlapping ones; the index is loaded every session.`);
  }

  if (total > 30000) {
    recs.push(
      `~${Math.round((total / CONTEXT_WINDOW) * 100)}% of the 200k window is consumed before your first message — aim for under 15%.`
    );
  }

  return recs;
}

module.exports = { auditContext, memoryFiles, mcpServers, skillsIndex, CONTEXT_WINDOW };
