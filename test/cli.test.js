'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFile } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'src', 'cli.js');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'home', '.claude');

function run(args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { encoding: 'utf8' }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout, stderr });
    });
  });
}

test('--version prints semver', async () => {
  const r = await run(['--version']);
  assert.equal(r.code, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('--help lists all commands', async () => {
  const r = await run(['--help']);
  assert.equal(r.code, 0);
  for (const cmd of ['context', 'distill', 'search', 'stats', 'sessions', 'show']) {
    assert.match(r.stdout, new RegExp(cmd));
  }
});

test('unknown command exits 1 with message', async () => {
  const r = await run(['frobnicate']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /unknown command/);
});

test('stats --json over fixtures', async () => {
  const r = await run(['stats', '--json', '--claude-dir', FIXTURE_DIR]);
  assert.equal(r.code, 0);
  const data = JSON.parse(r.stdout);
  assert.equal(data.sessions, 2);
  assert.equal(data.totals.toolCalls, 3); // Read + Bash (alpha, last-wins) + Bash (beta)
  assert.ok(data.models['claude-sonnet-4-6']);
  assert.ok(data.models['claude-opus-4-8']);
  assert.equal(data.models['claude-sonnet-4-6'].input, 17);
  assert.ok(data.totalCostUSD > 0);
});

test('search --json over fixtures', async () => {
  const r = await run(['search', 'zebra_function', '--json', '--claude-dir', FIXTURE_DIR]);
  assert.equal(r.code, 0);
  const data = JSON.parse(r.stdout);
  assert.equal(data.count, 2);
});

test('sessions --json over fixtures', async () => {
  const r = await run(['sessions', '--json', '--claude-dir', FIXTURE_DIR]);
  assert.equal(r.code, 0);
  const data = JSON.parse(r.stdout);
  assert.equal(data.length, 2);
  // newest first
  assert.equal(data[0].sessionId, 'bbbb2222-3333-4444-5555-666677778888');
  assert.equal(data[0].summary, null);
  assert.equal(data[1].summary, 'Auth refactor');
});

test('distill --json over fixtures', async () => {
  const r = await run(['distill', '--json', '--claude-dir', FIXTURE_DIR]);
  assert.equal(r.code, 0);
  const data = JSON.parse(r.stdout);
  assert.ok(data.count >= 2);
});

test('show renders a transcript by id prefix', async () => {
  const r = await run(['show', 'aaaa1111', '--claude-dir', FIXTURE_DIR, '--no-color']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /refactor the auth module/);
  assert.match(r.stdout, /→ Bash/);
  assert.match(r.stdout, /summary: Auth refactor/);
  // streamed duplicate of msg_01 must render once
  const occurrences = r.stdout.split('Looking at auth.').length - 1;
  assert.equal(occurrences, 1);
});

test('context --json runs against fixtures dir', async () => {
  const r = await run(['context', '--json', '--claude-dir', FIXTURE_DIR]);
  assert.equal(r.code, 0);
  const data = JSON.parse(r.stdout);
  assert.ok(Array.isArray(data.items));
  assert.ok(data.total > 0);
  assert.ok(data.items.some((i) => i.kind === 'baseline'));
});
