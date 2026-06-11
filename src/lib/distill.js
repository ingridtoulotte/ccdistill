'use strict';

const { listProjects } = require('./paths');
const { iterEntries, isHumanMessage, humanText } = require('./transcript');

/**
 * Signal patterns marking a user message as a correction or durable rule.
 * English and French; weights sum per message, threshold gates candidacy.
 */
const SIGNALS = [
  { re: /\b(?:don'?t|do not|never|stop doing|stop using)\b/i, w: 3, tag: 'prohibition' },
  { re: /\b(?:always|make sure|remember to|from now on|every time)\b/i, w: 3, tag: 'rule' },
  { re: /(?:^|\s)(?:no[,.!]|nope[,.!]?)\s/i, w: 2, tag: 'correction' },
  { re: /\b(?:not what i|that'?s (?:not|wrong)|wrong|incorrect|you forgot)\b/i, w: 2, tag: 'correction' },
  { re: /\b(?:instead of|rather than|instead)\b/i, w: 2, tag: 'preference' },
  { re: /\buse\b.{1,60}\b(?:not|instead of)\b/i, w: 2, tag: 'preference' },
  // French
  { re: /\b(?:jamais|toujours|arr[êe]te|ne\s+\w+\s+pas|n'utilise pas|il faut)\b/i, w: 3, tag: 'rule-fr' },
  { re: /\b(?:plut[ôo]t que|au lieu de|pas comme ça|c'est pas ça|faux)\b/i, w: 2, tag: 'correction-fr' },
  { re: /^non[ ,.!]/i, w: 2, tag: 'correction-fr' },
];

const THRESHOLD = 3;
const MIN_LEN = 8;
const MAX_LEN = 300;
// Long messages are usually task specs, not durable rules — demand a
// stronger signal before treating them as corrections.
const LONG_TEXT = 150;
const LONG_THRESHOLD = 5;

/** Wrapper/meta texts that are not human guidance. */
function isNoise(text) {
  const t = text.trimStart();
  return (
    t.startsWith('<') || // <command-name>, <local-command-stdout>, <system-reminder>…
    t.startsWith('Caveat:') ||
    t.startsWith('[Request interrupted')
  );
}

function scoreText(text) {
  let weight = 0;
  const tags = [];
  for (const s of SIGNALS) {
    if (s.re.test(text)) {
      weight += s.w;
      tags.push(s.tag);
    }
  }
  return { weight, tags };
}

function normalizeKey(text) {
  return text
    .toLowerCase()
    .replace(/[`"'.,;:!?()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/**
 * Mine all transcripts for correction/rule candidates.
 * Returns groups sorted by (occurrences, weight) desc:
 * { text, count, weight, tags, projects: [..], sessions: [..], lastTs }
 */
async function distill(dir, opts = {}) {
  const groups = new Map();

  for (const project of listProjects(dir)) {
    if (opts.project && !project.name.toLowerCase().includes(opts.project.toLowerCase())) {
      continue;
    }
    for (const file of project.transcripts) {
      let sessionId = null;
      for await (const entry of iterEntries(file)) {
        if (!sessionId && entry.sessionId) sessionId = entry.sessionId;
        if (!isHumanMessage(entry)) continue;
        const text = humanText(entry).trim();
        if (text.length < MIN_LEN || text.length > MAX_LEN || isNoise(text)) continue;
        const { weight, tags } = scoreText(text);
        if (weight < (text.length > LONG_TEXT ? LONG_THRESHOLD : THRESHOLD)) continue;

        const key = normalizeKey(text);
        const ts = entry.timestamp ? Date.parse(entry.timestamp) : null;
        const g = groups.get(key);
        if (g) {
          g.count += 1;
          g.weight = Math.max(g.weight, weight);
          if (!g.projects.includes(project.name)) g.projects.push(project.name);
          if (sessionId && !g.sessions.includes(sessionId)) g.sessions.push(sessionId);
          if (ts && (!g.lastTs || ts > g.lastTs)) {
            g.lastTs = ts;
            g.text = text; // surface the most recent phrasing
          }
        } else {
          groups.set(key, {
            text,
            count: 1,
            weight,
            tags: [...new Set(tags)],
            projects: [project.name],
            sessions: sessionId ? [sessionId] : [],
            lastTs: ts,
          });
        }
      }
    }
  }

  const out = [...groups.values()];
  out.sort((a, b) => b.count - a.count || b.weight - a.weight || (b.lastTs || 0) - (a.lastTs || 0));
  return out.slice(0, opts.limit || 15);
}

/**
 * Build a refinement prompt for `ccrecall distill --prompt | claude -p`.
 */
function refinementPrompt(candidates) {
  const lines = candidates.map((g) => `${g.count}x  ${g.text.replace(/\s+/g, ' ')}`);
  return [
    'Below are recurring corrections and instructions a user gave to Claude Code',
    'across past sessions, with occurrence counts. Distill them into a minimal',
    'set of durable CLAUDE.md rules:',
    '- merge duplicates and near-duplicates',
    '- one line per rule, imperative voice',
    '- drop one-off or context-specific items',
    '- keep the original language of each rule',
    '',
    'Corrections:',
    ...lines,
    '',
    'Output ONLY a fenced markdown block of bullet rules, ready to paste into CLAUDE.md.',
  ].join('\n');
}

module.exports = { distill, refinementPrompt, scoreText, SIGNALS, isNoise };
