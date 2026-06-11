'use strict';

const { listProjects } = require('../lib/paths');
const { iterEntries, extractText, isHumanMessage, humanText } = require('../lib/transcript');
const { c, fmtTime, truncate } = require('../lib/format');
const path = require('node:path');

module.exports = async function showCmd(ctx) {
  const prefix = (ctx.args[0] || '').trim();
  if (!prefix) throw new Error('usage: ccrecall show <session-id-prefix>');

  const file = findTranscript(ctx.claudeDir, prefix);
  if (!file) throw new Error(`no session matching "${prefix}" under ${ctx.claudeDir}`);

  // Buffer the transcript so streamed rewrites of an assistant message can
  // be collapsed last-wins while keeping the position of the first write.
  const entries = [];
  const slotById = new Map();
  for await (const entry of iterEntries(file)) {
    if (entry.type === 'assistant' && entry.message) {
      const id = entry.message.id || entry.uuid;
      if (id && slotById.has(id)) {
        entries[slotById.get(id)] = entry;
        continue;
      }
      if (id) slotById.set(id, entries.length);
    }
    entries.push(entry);
  }

  const out = [];
  for (const entry of entries) {
    if (entry.type === 'summary') {
      out.push(c.bold(c.blue(`■ summary: ${entry.summary}`)));
      continue;
    }
    if (entry.type === 'user' && isHumanMessage(entry)) {
      out.push('');
      out.push(c.green(c.bold('● user')) + c.dim('  ' + fmtTime(Date.parse(entry.timestamp || ''))));
      out.push(indent(truncate(humanText(entry), 800)));
      continue;
    }
    if (entry.type === 'assistant' && entry.message) {
      const model = entry.message.model ? c.dim(` [${entry.message.model}]`) : '';
      const blocks = Array.isArray(entry.message.content) ? entry.message.content : [];
      const text = extractTextOnly(blocks, entry.message.content);
      out.push('');
      out.push(c.magenta(c.bold('● claude')) + model + c.dim('  ' + fmtTime(Date.parse(entry.timestamp || ''))));
      if (text) out.push(indent(truncate(text, 800)));
      for (const b of blocks) {
        if (b && b.type === 'tool_use') {
          out.push(indent(c.cyan(`→ ${b.name}`) + c.dim(' ' + truncate(JSON.stringify(b.input ?? {}), 120))));
        }
      }
      continue;
    }
    if (entry.type === 'user' && entry.message && Array.isArray(entry.message.content)) {
      for (const b of entry.message.content) {
        if (b && b.type === 'tool_result') {
          const text = extractText(b.content);
          if (text) out.push(indent(c.dim('↳ ' + truncate(text, 200))));
        }
      }
    }
  }

  out.push('');
  out.push(c.dim(`transcript: ${path.basename(file)}`));
  process.stdout.write(out.join('\n') + '\n');
};

function extractTextOnly(blocks, content) {
  if (typeof content === 'string') return content;
  return blocks
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

function indent(s) {
  return s
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n');
}

function findTranscript(dir, prefix) {
  for (const project of listProjects(dir)) {
    for (const file of project.transcripts) {
      if (path.basename(file, '.jsonl').startsWith(prefix)) return file;
    }
  }
  return null;
}
