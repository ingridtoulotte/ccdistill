'use strict';

const { distill, refinementPrompt } = require('../lib/distill');
const { parseFlags } = require('../lib/args');
const { c, table, fmtDate, truncate } = require('../lib/format');

const SPEC = {
  project: { flag: '--project', alias: '-p', type: 'string' },
  limit: { flag: '--limit', alias: '-n', type: 'number', default: 15 },
  prompt: { flag: '--prompt', type: 'boolean', default: false },
};

module.exports = async function distillCmd(ctx) {
  const flags = parseFlags(ctx.args, SPEC);
  const candidates = await distill(ctx.claudeDir, { project: flags.project, limit: flags.limit });

  if (flags.prompt) {
    // Plain text on stdout so it pipes cleanly: teach2claude distill --prompt | claude -p
    process.stdout.write(refinementPrompt(candidates) + '\n');
    return;
  }

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ count: candidates.length, candidates }, null, 2) + '\n');
    return;
  }

  if (candidates.length === 0) {
    process.stdout.write('No recurring corrections found. Either your CLAUDE.md is already doing its job, or there is not enough history yet.\n');
    return;
  }

  const out = [];
  out.push(c.bold('DISTILL') + c.dim(' — recurring corrections you keep giving Claude'));
  out.push('');
  const rows = candidates.map((g) => [
    c.yellow(`${g.count}×`),
    truncate(g.text, 80),
    c.dim(g.tags[0] || ''),
    c.dim(fmtDate(g.lastTs)),
  ]);
  out.push(table(rows, { align: ['right', 'left', 'left', 'left'] }));
  out.push('');
  out.push(c.bold('Suggested CLAUDE.md block') + c.dim(' (review before adopting — these are heuristic):'));
  out.push('');
  out.push('```markdown');
  for (const g of candidates.filter((g) => g.text.length <= 160).slice(0, 10)) {
    out.push(`- ${g.text.replace(/\s+/g, ' ').trim()}`);
  }
  out.push('```');
  out.push('');
  out.push(c.dim('Refine with Claude itself:  teach2claude distill --prompt | claude -p'));
  process.stdout.write(out.join('\n') + '\n');
};
