'use strict';

const fs = require('node:fs');
const readline = require('node:readline');

const { listProjects } = require('./paths');
const { parseLine, extractText } = require('./transcript');

/**
 * Full-text search across every transcript under a Claude data dir.
 *
 * Fast path: the raw JSONL line is checked (lowercased substring or regex)
 * BEFORE JSON.parse, so non-matching lines — the overwhelming majority —
 * cost one string scan and zero allocations.
 *
 * opts: { regex, role ('user'|'assistant'), project, since (epoch ms), limit }
 * Returns matches sorted newest first: { project, cwd, sessionId, ts, role, text, snippet }
 */
async function searchTranscripts(dir, query, opts = {}) {
  if (!query) return [];
  const limit = opts.limit || 25;
  let test;
  let re = null;
  if (opts.regex) {
    re = new RegExp(query, 'i');
    test = (line) => re.test(line);
  } else {
    const q = query.toLowerCase();
    test = (line) => line.toLowerCase().includes(q);
  }

  const matches = [];
  for (const project of listProjects(dir)) {
    if (opts.project && !project.name.toLowerCase().includes(opts.project.toLowerCase())) {
      continue;
    }
    for (const file of project.transcripts) {
      if (opts.since) {
        try {
          if (fs.statSync(file).mtimeMs < opts.since) continue;
        } catch {
          continue;
        }
      }
      await searchFile(file, project.name, test, re, query, opts, matches);
    }
  }

  matches.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return matches.slice(0, limit);
}

async function searchFile(file, projectName, test, re, query, opts, matches) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let sessionId = null;
  let cwd = null;
  const seen = new Set(); // dedupe streamed rewrites of the same message

  for await (const line of rl) {
    if (!test(line)) continue;
    const entry = parseLine(line);
    if (!entry) continue;
    if (!sessionId && entry.sessionId) sessionId = entry.sessionId;
    if (!cwd && entry.cwd) cwd = entry.cwd;
    if (entry.type !== 'user' && entry.type !== 'assistant') continue;
    if (opts.role && entry.type !== opts.role) continue;

    const text = extractText(entry.message && entry.message.content);
    const idx = re ? regexIndex(text, re) : text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) continue;

    const msgId = (entry.message && entry.message.id) || entry.uuid;
    const key = `${msgId}:${idx}`;
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({
      project: projectName,
      cwd,
      sessionId: sessionId || entry.sessionId || null,
      ts: entry.timestamp ? Date.parse(entry.timestamp) : null,
      role: entry.type,
      text,
      snippet: makeSnippet(text, idx, query.length),
    });
  }
}

function regexIndex(text, re) {
  const m = re.exec(text);
  return m ? m.index : -1;
}

function makeSnippet(text, idx, qlen, span = 70) {
  const start = Math.max(0, idx - span);
  const end = Math.min(text.length, idx + qlen + span);
  let snip = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = '…' + snip;
  if (end < text.length) snip = snip + '…';
  return snip;
}

module.exports = { searchTranscripts, makeSnippet };
