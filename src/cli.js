#!/usr/bin/env node
'use strict';

const { version } = require('../package.json');
const { claudeDir } = require('./lib/paths');
const { setColor } = require('./lib/format');

const COMMANDS = {
  context: { run: require('./commands/context'), desc: 'Audit what eats your context window before you type a word' },
  distill: { run: require('./commands/distill'), desc: 'Mine past sessions for corrections → suggest CLAUDE.md rules' },
  search: { run: require('./commands/search'), desc: 'Full-text search across every session, every project' },
  stats: { run: require('./commands/stats'), desc: 'Usage, tools, models and cost across your whole history' },
  sessions: { run: require('./commands/sessions'), desc: 'List recent sessions' },
  show: { run: require('./commands/show'), desc: 'Pretty-print one session transcript' },
};

const USAGE = `ccrecall ${version} — total recall for Claude Code (local-only, zero deps)

Usage: ccrecall <command> [options]

Commands:
${Object.entries(COMMANDS)
  .map(([name, c]) => `  ${name.padEnd(10)} ${c.desc}`)
  .join('\n')}

Global options:
  --json             machine-readable output
  --claude-dir <p>   Claude data dir (default: ~/.claude or $CLAUDE_CONFIG_DIR)
  --no-color         disable colors (also honors NO_COLOR)
  -h, --help         show this help
  -v, --version      show version

Examples:
  ccrecall context                      # why does my session start 20% full?
  ccrecall distill --prompt | claude -p # turn past corrections into CLAUDE.md rules
  ccrecall search "race condition" --since 30d
  ccrecall stats --project myapp
`;

async function main() {
  const argv = process.argv.slice(2);
  const rest = [];
  let command = null;
  const ctx = { json: false, claudeDir: null, cwd: process.cwd(), args: rest };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') ctx.json = true;
    else if (a === '--no-color') setColor(false);
    else if (a === '--color') setColor(true);
    else if (a === '--claude-dir') {
      const v = argv[++i];
      if (!v) fail('missing value for --claude-dir');
      ctx.claudeDir = v;
    } else if (a === '-h' || a === '--help') {
      process.stdout.write(USAGE);
      return;
    } else if (a === '-v' || a === '--version') {
      process.stdout.write(version + '\n');
      return;
    } else if (!command && !a.startsWith('-')) {
      command = a;
    } else {
      rest.push(a);
    }
  }

  if (!command) {
    process.stdout.write(USAGE);
    return;
  }
  const cmd = COMMANDS[command];
  if (!cmd) fail(`unknown command "${command}" — run ccrecall --help`);

  if (ctx.json) setColor(false);
  ctx.claudeDir = claudeDir(ctx.claudeDir);
  await cmd.run(ctx);
}

function fail(msg) {
  process.stderr.write('ccrecall: ' + msg + '\n');
  process.exit(1);
}

main().catch((err) => {
  fail((err && err.message) || String(err));
});
