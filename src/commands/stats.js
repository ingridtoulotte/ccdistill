'use strict';

const { scanAll, projectLabel } = require('../lib/transcript');
const { costOf, priceFor } = require('../lib/tokens');
const { parseFlags, parseSince } = require('../lib/args');
const { c, table, bar, sparkline, fmtNum, fmtInt, fmtUSD, fmtDate } = require('../lib/format');

const SPEC = {
  project: { flag: '--project', alias: '-p', type: 'string' },
  since: { flag: '--since', alias: '-s', type: 'string' },
};

module.exports = async function statsCmd(ctx) {
  const flags = parseFlags(ctx.args, SPEC);
  const since = parseSince(flags.since);
  const sessions = await scanAll(ctx.claudeDir, { project: flags.project, since });

  if (sessions.length === 0) {
    process.stdout.write(`No transcripts found under ${ctx.claudeDir}.\n`);
    return;
  }

  // Aggregate
  const agg = {
    sessions: sessions.length,
    projects: new Set(),
    userMessages: 0,
    assistantMessages: 0,
    tools: {},
    models: {},
    firstTs: null,
    lastTs: null,
    perDay: {},
  };

  for (const s of sessions) {
    agg.projects.add(projectLabel(s));
    agg.userMessages += s.userMessages;
    agg.assistantMessages += s.assistantMessages;
    if (s.firstTs && (!agg.firstTs || s.firstTs < agg.firstTs)) agg.firstTs = s.firstTs;
    if (s.lastTs && (!agg.lastTs || s.lastTs > agg.lastTs)) agg.lastTs = s.lastTs;
    for (const [name, n] of Object.entries(s.toolCalls)) {
      agg.tools[name] = (agg.tools[name] || 0) + n;
    }
    for (const [model, u] of Object.entries(s.models)) {
      const m = (agg.models[model] ||= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0 });
      m.input += u.input;
      m.output += u.output;
      m.cacheRead += u.cacheRead;
      m.cacheWrite += u.cacheWrite;
      m.messages += u.messages;
    }
    if (s.lastTs) {
      const day = fmtDate(s.lastTs);
      agg.perDay[day] = (agg.perDay[day] || 0) + s.assistantMessages;
    }
  }

  let totalCost = 0;
  let unpriced = [];
  const modelRows = Object.entries(agg.models)
    .sort((a, b) => b[1].output - a[1].output)
    .map(([model, u]) => {
      const cost = costOf(model, u);
      if (cost == null) unpriced.push(model);
      else totalCost += cost;
      return { model, ...u, costUSD: cost };
    });

  if (ctx.json) {
    process.stdout.write(
      JSON.stringify(
        {
          claudeDir: ctx.claudeDir,
          sessions: agg.sessions,
          projects: [...agg.projects],
          firstTs: agg.firstTs,
          lastTs: agg.lastTs,
          totals: {
            userMessages: agg.userMessages,
            assistantMessages: agg.assistantMessages,
            toolCalls: Object.values(agg.tools).reduce((a, b) => a + b, 0),
          },
          tools: agg.tools,
          models: Object.fromEntries(modelRows.map((r) => [r.model, r])),
          totalCostUSD: totalCost,
          unpricedModels: unpriced,
        },
        null,
        2
      ) + '\n'
    );
    return;
  }

  const out = [];
  out.push(
    c.bold(`${fmtInt(agg.sessions)} sessions`) +
      c.dim(` · ${agg.projects.size} projects · ${fmtDate(agg.firstTs)} → ${fmtDate(agg.lastTs)}`)
  );
  const totalTools = Object.values(agg.tools).reduce((a, b) => a + b, 0);
  out.push(
    `${fmtInt(agg.userMessages)} user msgs · ${fmtInt(agg.assistantMessages)} assistant msgs · ${fmtInt(totalTools)} tool calls`
  );
  out.push('');

  // Top tools
  const topTools = Object.entries(agg.tools).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (topTools.length > 0) {
    out.push(c.bold('TOP TOOLS'));
    const max = topTools[0][1];
    out.push(
      table(topTools.map(([name, n]) => [name, c.cyan(fmtInt(n)), bar(n, max, 14)]), {
        align: ['left', 'right', 'left'],
      })
    );
    out.push('');
  }

  // Models + cost
  out.push(c.bold('MODELS') + c.dim('  (tokens; cost estimated from public per-MTok pricing)'));
  const rows = [
    [c.dim('model'), c.dim('in'), c.dim('out'), c.dim('cache r'), c.dim('cache w'), c.dim('est cost')],
  ];
  for (const r of modelRows) {
    rows.push([
      shortModel(r.model),
      fmtNum(r.input),
      fmtNum(r.output),
      fmtNum(r.cacheRead),
      fmtNum(r.cacheWrite),
      r.costUSD == null ? c.dim('n/a') : c.green(fmtUSD(r.costUSD)),
    ]);
  }
  out.push(table(rows, { align: ['left', 'right', 'right', 'right', 'right', 'right'] }));
  out.push(c.bold(`Estimated total: ${fmtUSD(totalCost)}`) + (unpriced.length ? c.dim(`  (${unpriced.length} unpriced model(s) excluded)`) : ''));
  out.push('');

  // 14-day activity
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = fmtDate(Date.now() - i * 86400000);
    days.push(agg.perDay[d] || 0);
  }
  out.push(c.bold('ACTIVITY (14d)') + '  ' + c.cyan(sparkline(days)) + c.dim(`  ${fmtInt(days.reduce((a, b) => a + b, 0))} assistant msgs`));
  process.stdout.write(out.join('\n') + '\n');
};

function shortModel(model) {
  const p = priceFor(model);
  return p ? `${model}` : model;
}
