'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { searchTranscripts, makeSnippet } = require('../src/lib/search');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'home', '.claude');

test('search finds matches in user text and tool inputs, across projects', async () => {
  const matches = await searchTranscripts(FIXTURE_DIR, 'zebra_function');
  assert.equal(matches.length, 2);
  const roles = matches.map((m) => m.role).sort();
  assert.deepEqual(roles, ['assistant', 'user']);
  const projects = new Set(matches.map((m) => m.project));
  assert.equal(projects.size, 2);
  for (const m of matches) {
    assert.match(m.snippet, /zebra_function/);
    assert.ok(m.sessionId);
    assert.ok(m.ts > 0);
  }
});

test('search respects role and project filters', async () => {
  const userOnly = await searchTranscripts(FIXTURE_DIR, 'zebra_function', { role: 'user' });
  assert.equal(userOnly.length, 1);
  assert.equal(userOnly[0].role, 'user');

  const alphaOnly = await searchTranscripts(FIXTURE_DIR, 'zebra_function', { project: 'alpha' });
  assert.equal(alphaOnly.length, 1);
  assert.equal(alphaOnly[0].project, 'D--proj-alpha');
});

test('search dedupes streamed rewrites of the same message', async () => {
  // "auth" appears in both copies of msg_01; only one match per message+offset
  const matches = await searchTranscripts(FIXTURE_DIR, 'Looking at auth');
  assert.equal(matches.length, 1);
});

test('regex search works', async () => {
  const matches = await searchTranscripts(FIXTURE_DIR, 'zebra_\\w+', { regex: true });
  assert.equal(matches.length, 2);
});

test('results sorted newest first and limited', async () => {
  const matches = await searchTranscripts(FIXTURE_DIR, 'pipeline OR auth'.split(' ')[2] || 'auth');
  for (let i = 1; i < matches.length; i++) {
    assert.ok((matches[i - 1].ts || 0) >= (matches[i].ts || 0));
  }
  const limited = await searchTranscripts(FIXTURE_DIR, 'a', { limit: 1 });
  assert.equal(limited.length, 1);
});

test('makeSnippet windows around the hit', () => {
  const text = 'x'.repeat(200) + 'NEEDLE' + 'y'.repeat(200);
  const snip = makeSnippet(text, 200, 6);
  assert.match(snip, /NEEDLE/);
  assert.ok(snip.startsWith('…'));
  assert.ok(snip.endsWith('…'));
  assert.ok(snip.length < 160);
});
