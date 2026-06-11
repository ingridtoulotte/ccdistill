'use strict';

const { auditContext } = require('../lib/audit');
const { c, table, bar, fmtInt } = require('../lib/format');

module.exports = async function contextCmd(ctx) {
  const audit = auditContext({ claudeDir: ctx.claudeDir, cwd: ctx.cwd });

  if (ctx.json) {
    process.stdout.write(JSON.stringify(audit, null, 2) + '\n');
    return;
  }

  const out = [];
  out.push(c.bold('CONTEXT STARTUP AUDIT') + c.dim(`  ${audit.cwd}`));
  out.push('');

  const max = audit.items[0] ? audit.items[0].tokens : 1;
  const rows = audit.items.map((i) => [
    i.kind === 'baseline' ? c.dim(i.source) : i.source,
    c.cyan(fmtInt(i.tokens)),
    bar(i.tokens, max),
    c.dim(`${((i.tokens / audit.window) * 100).toFixed(1)}%`),
  ]);
  out.push(table([['SOURCE', c.dim('TOKENS (est)'), '', c.dim('of 200k')], ...rows], {
    align: ['left', 'right', 'left', 'right'],
  }));

  out.push('');
  const pct = Math.round(audit.pct * 100);
  const headline = `TOTAL ~${fmtInt(audit.total)} tokens — ${pct}% of the 200k window gone before your first message`;
  out.push(pct >= 20 ? c.red(c.bold(headline)) : pct >= 10 ? c.yellow(c.bold(headline)) : c.green(c.bold(headline)));

  if (audit.recommendations.length > 0) {
    out.push('');
    out.push(c.bold('RECOMMENDATIONS'));
    for (const r of audit.recommendations) out.push('  • ' + r);
  }

  out.push('');
  out.push(c.dim('Estimates use ~4 chars/token (±20%). For live in-session numbers, run /context inside Claude Code.'));
  process.stdout.write(out.join('\n') + '\n');
};
