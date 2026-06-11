'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { estimateTokens, costOf, priceFor } = require('../src/lib/tokens');

test('estimateTokens heuristic', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('a'.repeat(400)), 100);
});

test('priceFor matches model families by substring', () => {
  assert.equal(priceFor('claude-opus-4-8').label, 'Opus');
  assert.equal(priceFor('claude-sonnet-4-6').label, 'Sonnet');
  assert.equal(priceFor('claude-haiku-4-5-20251001').label, 'Haiku');
  assert.equal(priceFor('totally-unknown-model'), null);
  assert.equal(priceFor(null), null);
});

test('costOf computes USD per MTok and returns null for unknown models', () => {
  assert.equal(costOf('claude-opus-4-8', { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 }), 15);
  assert.equal(costOf('claude-opus-4-8', { input: 0, output: 1e6, cacheRead: 0, cacheWrite: 0 }), 75);
  assert.equal(costOf('claude-sonnet-4-6', { input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite: 1e6 }), 3 + 15 + 0.3 + 3.75);
  assert.equal(costOf('mystery-model', { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 }), null);
});
