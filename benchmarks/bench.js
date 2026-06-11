'use strict';

/**
 * Generates a synthetic transcript and measures scan + search throughput.
 * Run: npm run bench [-- lines]
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scanAll } = require('../src/lib/transcript');
const { searchTranscripts } = require('../src/lib/search');

const LINES = Number(process.argv[2]) || 200000;

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teach2claude-bench-'));
  const projDir = path.join(root, 'projects', 'D--bench-proj');
  fs.mkdirSync(projDir, { recursive: true });
  const file = path.join(projDir, 'bench-session.jsonl');

  console.log(`generating ${LINES.toLocaleString()} lines…`);
  const out = fs.createWriteStream(file);
  for (let i = 0; i < LINES; i++) {
    const ts = new Date(Date.now() - (LINES - i) * 1000).toISOString();
    if (i % 2 === 0) {
      out.write(
        JSON.stringify({
          type: 'user',
          sessionId: 'bench',
          cwd: 'D:\\bench\\proj',
          timestamp: ts,
          uuid: 'u' + i,
          message: { role: 'user', content: `user message ${i} about module_${i % 977}` },
        }) + '\n'
      );
    } else {
      out.write(
        JSON.stringify({
          type: 'assistant',
          sessionId: 'bench',
          timestamp: ts,
          uuid: 'a' + i,
          message: {
            id: 'msg_' + i,
            model: 'claude-sonnet-4-6',
            role: 'assistant',
            content: [
              { type: 'text', text: `assistant reply ${i}` },
              { type: 'tool_use', id: 't' + i, name: 'Bash', input: { command: `run task_${i % 977}` } },
            ],
            usage: { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 },
          },
        }) + '\n'
      );
    }
  }
  await new Promise((resolve) => out.end(resolve));
  const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(1);

  let t = process.hrtime.bigint();
  const sessions = await scanAll(root);
  const scanMs = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(
    `scan:   ${mb} MB, ${LINES.toLocaleString()} lines in ${scanMs.toFixed(0)} ms  (${Math.round(
      LINES / (scanMs / 1000)
    ).toLocaleString()} lines/s) — ${sessions[0].assistantMessages.toLocaleString()} assistant msgs`
  );

  t = process.hrtime.bigint();
  const matches = await searchTranscripts(root, 'module_42', { limit: 1000 });
  const searchMs = Number(process.hrtime.bigint() - t) / 1e6;
  console.log(
    `search: "${'module_42'}" → ${matches.length} matches in ${searchMs.toFixed(0)} ms  (${Math.round(
      LINES / (searchMs / 1000)
    ).toLocaleString()} lines/s)`
  );

  fs.rmSync(root, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
