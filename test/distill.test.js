'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { distill, scoreText, isNoise, refinementPrompt } = require('../src/lib/distill');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'home', '.claude');

test('scoreText flags English and French corrections, ignores neutral text', () => {
  assert.ok(scoreText("no, don't use var, use const instead").weight >= 3);
  assert.ok(scoreText('non, utilise toujours pnpm pas npm').weight >= 3);
  assert.ok(scoreText('always run the tests before committing').weight >= 3);
  assert.ok(scoreText('refactor the auth module').weight < 3);
  assert.ok(scoreText('add a button to the page').weight < 3);
});

test('isNoise filters wrapper and meta texts', () => {
  assert.equal(isNoise('<command-name>/foo</command-name>'), true);
  assert.equal(isNoise('<local-command-stdout>x</local-command-stdout>'), true);
  assert.equal(isNoise('Caveat: the messages below...'), true);
  assert.equal(isNoise('[Request interrupted by user]'), true);
  assert.equal(isNoise('use pnpm not npm'), false);
});

test('distill surfaces both fixture corrections, not the neutral requests', async () => {
  const candidates = await distill(FIXTURE_DIR);
  const texts = candidates.map((c) => c.text);
  assert.ok(texts.some((t) => t.includes("don't use var")));
  assert.ok(texts.some((t) => t.includes('toujours pnpm')));
  assert.ok(!texts.some((t) => t.includes('refactor the auth module')));
  assert.ok(!texts.some((t) => t.includes('ajoute le zebra_function')));
  for (const c of candidates) {
    assert.ok(c.count >= 1);
    assert.ok(c.sessions.length >= 1);
  }
});

test('refinementPrompt embeds counts and texts', async () => {
  const candidates = await distill(FIXTURE_DIR);
  const prompt = refinementPrompt(candidates);
  assert.match(prompt, /CLAUDE\.md/);
  assert.match(prompt, /1x\s+non, utilise toujours pnpm/);
});
