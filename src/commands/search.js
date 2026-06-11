'use strict';

const { searchTranscripts } = require('../lib/search');
const { parseFlags, parseSince } = require('../lib/args');
const { c, fmtDate, fmtTime, truncate } = require('../lib/format');

const SPEC = {
  regex: { flag: '--regex', alias: '-r', type: 'boolean', default: false },
  role: { flag: '--role', type: 'string' },
  project: { flag: '--project', alias: '-p', type: 'string' },
  since: { flag: '--since', alias: '-s', type: 'string' },
  limit: { flag: '--limit', alias: '-n', type: 'number', default: 25 },
};

module.exports = async function searchCmd(ctx) {
  const flags = parseFlags(ctx.args, SPEC);
  const query = flags._.join(' ').trim();
  if (!query) {
    throw new Error('usage: teach2claude search <query> [--regex] [--role user|assistant] [--project x] [--since 30d] [--limit n]');
  }
  if (flags.role && flags.role !== 'user' && flags.role !== 'assistant') {
    throw new Error('--role must be "user" or "assistant"');
  }

  const matches = await searchTranscripts(ctx.claudeDir, query, {
    regex: flags.regex,
    role: flags.role,
    project: flags.project,
    since: parseSince(flags.since),
    limit: flags.limit,
  });

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ query, count: matches.length, matches }, null, 2) + '\n');
    return;
  }

  if (matches.length === 0) {
    process.stdout.write(`No matches for "${query}".\n`);
    return;
  }

  const out = [];
  for (const m of matches) {
    const proj = m.cwd ? m.cwd.split(/[\\/]/).filter(Boolean).pop() : m.project;
    const id = m.sessionId ? m.sessionId.slice(0, 8) : '????????';
    out.push(
      `${c.dim(fmtDate(m.ts))} ${c.dim(fmtTime(m.ts))}  ${c.cyan(proj)}  ${c.dim(id)}  ${
        m.role === 'user' ? c.green(m.role) : c.magenta(m.role)
      }`
    );
    out.push('  ' + highlight(truncate(m.snippet, 160), query, flags.regex));
  }
  out.push('');
  out.push(c.dim(`${matches.length} match(es). Open a session with: teach2claude show <id>`));
  process.stdout.write(out.join('\n') + '\n');
};

function highlight(snippet, query, isRegex) {
  try {
    const re = isRegex ? new RegExp(`(${query})`, 'ig') : new RegExp(`(${escapeRe(query)})`, 'ig');
    return snippet.replace(re, (s) => c.yellow(s));
  } catch {
    return snippet;
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
