'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Heuristic token estimate: ~4 characters per token for mixed prose/code.
 * Real tokenizers vary ±20%; teach2claude labels every estimate as such.
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

/**
 * USD per million tokens. Substring-matched against the model id, first hit
 * wins. Overridable via ~/.teach2claude.json: { "pricing": [{ "match": "...",
 * "label": "...", "input": n, "output": n, "cacheRead": n, "cacheWrite": n }] }
 */
const DEFAULT_PRICING = [
  { match: 'opus', label: 'Opus', input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  { match: 'sonnet', label: 'Sonnet', input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  { match: 'haiku', label: 'Haiku', input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
];

let cachedConfig;

function loadConfig() {
  if (cachedConfig !== undefined) return cachedConfig;
  const file = process.env.CCRECALL_CONFIG || path.join(os.homedir(), '.teach2claude.json');
  try {
    cachedConfig = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    cachedConfig = null;
  }
  return cachedConfig;
}

function pricingTable() {
  const config = loadConfig();
  const custom = config && Array.isArray(config.pricing) ? config.pricing : [];
  return [...custom, ...DEFAULT_PRICING];
}

function priceFor(model) {
  if (!model) return null;
  const id = String(model).toLowerCase();
  for (const p of pricingTable()) {
    if (p.match && id.includes(String(p.match).toLowerCase())) return p;
  }
  return null;
}

/**
 * Cost in USD for a usage record { input, output, cacheRead, cacheWrite }.
 * Returns null when the model is unknown — callers must surface "n/a"
 * rather than silently report $0 for unpriced models.
 */
function costOf(model, usage) {
  const p = priceFor(model);
  if (!p) return null;
  const M = 1e6;
  return (
    ((usage.input || 0) * p.input +
      (usage.output || 0) * p.output +
      (usage.cacheRead || 0) * (p.cacheRead || 0) +
      (usage.cacheWrite || 0) * (p.cacheWrite || 0)) /
    M
  );
}

module.exports = { estimateTokens, priceFor, costOf, DEFAULT_PRICING };
