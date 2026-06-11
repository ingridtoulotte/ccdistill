'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { scanSession, scanAll, extractText, isHumanMessage, parseLine } = require('../src/lib/transcript');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'home', '.claude');
const ALPHA = path.join(
  FIXTURE_DIR,
  'projects',
  'D--proj-alpha',
  'aaaa1111-2222-3333-4444-555566667777.jsonl'
);

test('parseLine skips garbage and non-JSON', () => {
  assert.equal(parseLine('this is garbage'), null);
  assert.equal(parseLine(''), null);
  assert.equal(parseLine('{"broken": '), null);
  assert.deepEqual(parseLine('{"a":1}'), { a: 1 });
});

test('extractText handles strings, blocks, tool_use and tool_result', () => {
  assert.equal(extractText('hello'), 'hello');
  assert.equal(extractText(null), '');
  const text = extractText([
    { type: 'text', text: 'hi' },
    { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
    { type: 'tool_result', content: 'output here' },
    { type: 'thinking', thinking: 'secret' },
  ]);
  assert.match(text, /hi/);
  assert.match(text, /\[Bash\]/);
  assert.match(text, /"command":"ls"/);
  assert.match(text, /output here/);
  assert.doesNotMatch(text, /secret/);
});

test('isHumanMessage excludes tool_result carrier lines', () => {
  assert.equal(
    isHumanMessage({ type: 'user', message: { content: 'real text' } }),
    true
  );
  assert.equal(
    isHumanMessage({ type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } }),
    false
  );
  assert.equal(isHumanMessage({ type: 'user', isMeta: true, message: { content: 'meta' } }), false);
  assert.equal(isHumanMessage({ type: 'assistant', message: { content: 'x' } }), false);
});

test('scanSession dedupes streamed assistant lines by message.id, last wins', async () => {
  const s = await scanSession(ALPHA);

  assert.equal(s.sessionId, 'aaaa1111-2222-3333-4444-555566667777');
  assert.equal(s.cwd, 'D:\\proj\\alpha');
  // u1 + u3 (u2 is a tool_result carrier)
  assert.equal(s.userMessages, 2);
  // msg_01 + msg_02, the duplicate msg_01 line collapses
  assert.equal(s.assistantMessages, 2);
  // last occurrence of msg_01 has Read + Bash
  assert.deepEqual(s.toolCalls, { Read: 1, Bash: 1 });

  const sonnet = s.models['claude-sonnet-4-6'];
  assert.ok(sonnet);
  assert.equal(sonnet.input, 12 + 5); // last-wins usage for msg_01, plus msg_02
  assert.equal(sonnet.output, 80 + 20);
  assert.equal(sonnet.cacheRead, 1000);
  assert.equal(sonnet.cacheWrite, 200);
  assert.equal(sonnet.messages, 2);

  assert.deepEqual(s.summaries, ['Auth refactor']);
  assert.ok(s.firstTs < s.lastTs);
});

test('scanAll finds both fixture sessions and supports project filter', async () => {
  const all = await scanAll(FIXTURE_DIR);
  assert.equal(all.length, 2);

  const beta = await scanAll(FIXTURE_DIR, { project: 'beta' });
  assert.equal(beta.length, 1);
  assert.equal(beta[0].models['claude-opus-4-8'].input, 110);
  assert.equal(beta[0].models['claude-opus-4-8'].output, 210);
});
