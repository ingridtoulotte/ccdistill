'use strict';

const { scanAll, projectLabel } = require('../lib/transcript');
const { costOf } = require('../lib/tokens');
const { parseFlags, parseSince } = require('../lib/args');
const { c, table, fmtDate, fmtTime, fmtDuration, fmtUSD, fmtInt, truncate } = require('../lib/format');

const SPEC = {
  project: { flag: '--project', alias: '-p', type: 'string' },
  since: { flag: '--since', alias: '-s', type: 'string' },
  limit: { flag: '--limit', alias: '-n', type: 'number', default: 20 },
};

module.exports = async function sessionsCmd(ctx) {
  const flags = parseFlags(ctx.args, SPEC);
  const sessions = await scanAll(ctx.claudeDir, {
    project: flags.project,
    since: parseSince(flags.since),
  });

  sessions.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  const shown = sessions.slice(0, flags.limit);

  if (ctx.json) {
    process.stdout.write(
      JSON.stringify(
        shown.map((s) => ({
          sessionId: s.sessionId,
          project: projectLabel(s),
          cwd: s.cwd,
          firstTs: s.firstTs,
          lastTs: s.lastTs,
          userMessages: s.userMessages,
          assistantMessages: s.assistantMessages,
          toolCalls: Object.values(s.toolCalls).reduce((a, b) => a + b, 0),
          costUSD: sessionCost(s),
          summary: s.summaries[s.summaries.length - 1] || null,
        })),
        null,
        2
      ) + '\n'
    );
    return;
  }

  if (shown.length === 0) {
    process.stdout.write(`No sessions found under ${ctx.claudeDir}.\n`);
    return;
  }

  const rows = [
    [c.dim('WHEN'), c.dim('PROJECT'), c.dim('DUR'), c.dim('MSGS'), c.dim('TOOLS'), c.dim('COST'), c.dim('ID'), c.dim('SUMMARY')],
  ];
  for (const s of shown) {
    const cost = sessionCost(s);
    rows.push([
      `${fmtDate(s.lastTs)} ${fmtTime(s.lastTs)}`,
      c.cyan(truncate(projectLabel(s), 20)),
      fmtDuration(s.lastTs - s.firstTs),
      fmtInt(s.userMessages + s.assistantMessages),
      fmtInt(Object.values(s.toolCalls).reduce((a, b) => a + b, 0)),
      cost == null ? c.dim('n/a') : fmtUSD(cost),
      c.dim(s.sessionId.slice(0, 8)),
      c.dim(truncate(s.summaries[s.summaries.length - 1] || '', 40)),
    ]);
  }
  process.stdout.write(table(rows, { align: ['left', 'left', 'right', 'right', 'right', 'right'] }) + '\n');
  process.stdout.write(c.dim(`\n${shown.length} of ${sessions.length} session(s). Inspect one: ccdistill show <id>\n`));
};

function sessionCost(s) {
  let total = 0;
  let any = false;
  for (const [model, u] of Object.entries(s.models)) {
    const cost = costOf(model, u);
    if (cost != null) {
      total += cost;
      any = true;
    }
  }
  return any ? total : null;
}
