'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const { listProjects } = require('./paths');

/**
 * Stream a transcript file line by line, yielding parsed JSON entries.
 * Malformed or non-JSON lines are skipped silently — transcripts in the
 * wild contain partial writes and schema drift across Claude Code versions.
 */
async function* iterEntries(file) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const entry = parseLine(line);
    if (entry) yield entry;
  }
}

function parseLine(line) {
  if (typeof line !== 'string') return null;
  const t = line.trimStart();
  if (!t || t[0] !== '{') return null;
  try {
    const obj = JSON.parse(t);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

/**
 * Flatten message content (string | block array) into searchable text.
 * tool_use blocks contribute their name and a slice of their input so that
 * commands and file paths remain findable. thinking blocks are excluded.
 */
function extractText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'text' && typeof block.text === 'string') {
      parts.push(block.text);
    } else if (block.type === 'tool_use') {
      let input = '';
      try {
        input = JSON.stringify(block.input ?? {}).slice(0, 400);
      } catch {
        /* circular or exotic input — name alone is enough */
      }
      parts.push(`[${block.name || 'tool'}] ${input}`);
    } else if (block.type === 'tool_result') {
      parts.push(extractText(block.content));
    }
  }
  return parts.join(' ');
}

/**
 * True when a user entry contains text typed by a human (not a tool_result
 * carrier line, not a meta line).
 */
function isHumanMessage(entry) {
  if (!entry || entry.type !== 'user' || entry.isMeta) return false;
  const content = entry.message && entry.message.content;
  if (typeof content === 'string') return content.trim().length > 0;
  if (Array.isArray(content)) {
    return content.some(
      (b) => b && b.type === 'text' && typeof b.text === 'string' && b.text.trim().length > 0
    );
  }
  return false;
}

function humanText(entry) {
  const content = entry.message && entry.message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');
  }
  return '';
}

const EMPTY_USAGE = Object.freeze({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

function normalizeUsage(u) {
  if (!u || typeof u !== 'object') return { ...EMPTY_USAGE };
  return {
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  };
}

/**
 * Scan one transcript file into a session summary.
 *
 * Streaming writes the same assistant message several times with cumulative
 * usage, so assistant lines are deduplicated by message.id keeping the LAST
 * occurrence (final usage and final block list win).
 */
async function scanSession(file) {
  const session = {
    file,
    sessionId: path.basename(file, '.jsonl'),
    cwd: null,
    firstTs: null,
    lastTs: null,
    userMessages: 0,
    assistantMessages: 0,
    toolCalls: {}, // name -> count
    models: {}, // model -> { input, output, cacheRead, cacheWrite, messages }
    summaries: [],
  };

  const byId = new Map(); // message.id -> { model, usage, tools }

  for await (const entry of iterEntries(file)) {
    if (entry.sessionId && session.sessionId.length < 8) session.sessionId = entry.sessionId;
    if (!session.cwd && typeof entry.cwd === 'string') session.cwd = entry.cwd;

    if (entry.timestamp) {
      const ts = Date.parse(entry.timestamp);
      if (!Number.isNaN(ts)) {
        if (session.firstTs === null || ts < session.firstTs) session.firstTs = ts;
        if (session.lastTs === null || ts > session.lastTs) session.lastTs = ts;
      }
    }

    if (entry.type === 'summary' && typeof entry.summary === 'string') {
      session.summaries.push(entry.summary);
      continue;
    }

    if (entry.type === 'user') {
      if (isHumanMessage(entry)) session.userMessages += 1;
      continue;
    }

    if (entry.type === 'assistant' && entry.message) {
      const msg = entry.message;
      const tools = [];
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block && block.type === 'tool_use' && block.name) tools.push(block.name);
        }
      }
      const record = { model: msg.model || 'unknown', usage: normalizeUsage(msg.usage), tools };
      const id = msg.id || entry.uuid;
      if (id) {
        byId.set(id, record); // last occurrence wins
      } else {
        foldRecord(session, record);
        session.assistantMessages += 1;
      }
    }
  }

  for (const record of byId.values()) {
    foldRecord(session, record);
    session.assistantMessages += 1;
  }

  return session;
}

function foldRecord(session, record) {
  for (const name of record.tools) {
    session.toolCalls[name] = (session.toolCalls[name] || 0) + 1;
  }
  const m = (session.models[record.model] ||= {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    messages: 0,
  });
  m.input += record.usage.input;
  m.output += record.usage.output;
  m.cacheRead += record.usage.cacheRead;
  m.cacheWrite += record.usage.cacheWrite;
  m.messages += 1;
}

/**
 * Scan every transcript under a Claude data dir.
 * opts.project — substring filter on project folder name or cwd
 * opts.since   — epoch ms; files whose mtime predates it are skipped
 */
async function scanAll(dir, opts = {}) {
  const sessions = [];
  for (const project of listProjects(dir)) {
    for (const file of project.transcripts) {
      if (opts.since) {
        try {
          if (fs.statSync(file).mtimeMs < opts.since) continue;
        } catch {
          continue;
        }
      }
      const session = await scanSession(file);
      session.project = project.name;
      if (opts.project) {
        const needle = opts.project.toLowerCase();
        const hay = `${project.name} ${session.cwd || ''}`.toLowerCase();
        if (!hay.includes(needle)) continue;
      }
      if (opts.since && session.lastTs && session.lastTs < opts.since) continue;
      sessions.push(session);
    }
  }
  return sessions;
}

/**
 * Human-friendly project label: prefer the real cwd recorded inside the
 * transcript over the encoded folder name.
 */
function projectLabel(session) {
  if (session.cwd) {
    const base = path.basename(session.cwd);
    return base || session.cwd;
  }
  return session.project || '?';
}

module.exports = {
  iterEntries,
  parseLine,
  extractText,
  isHumanMessage,
  humanText,
  normalizeUsage,
  scanSession,
  scanAll,
  projectLabel,
};
