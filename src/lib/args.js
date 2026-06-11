'use strict';

/**
 * Minimal flag parser.
 * spec: { key: { flag: '--name', alias: '-n', type: 'boolean'|'number'|'string', default } }
 * Unrecognized tokens land in out._ (positionals).
 */
function parseFlags(tokens, spec) {
  const out = { _: [] };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const found = Object.entries(spec).find(([, d]) => d.flag === t || d.alias === t);
    if (!found) {
      out._.push(t);
      continue;
    }
    const [key, def] = found;
    if (def.type === 'boolean') {
      out[key] = true;
    } else {
      const raw = tokens[++i];
      if (raw === undefined) throw new Error(`missing value for ${t}`);
      out[key] = def.type === 'number' ? Number(raw) : raw;
      if (def.type === 'number' && Number.isNaN(out[key])) {
        throw new Error(`invalid number for ${t}: ${raw}`);
      }
    }
  }
  for (const [key, def] of Object.entries(spec)) {
    if (!(key in out) && 'default' in def) out[key] = def.default;
  }
  return out;
}

/**
 * Parse --since values: "30d", "12h", or any Date.parse-able string.
 * Returns epoch ms or null.
 */
function parseSince(value) {
  if (!value) return null;
  const rel = /^(\d+)([dh])$/.exec(value);
  if (rel) {
    const n = Number(rel[1]);
    const unitMs = rel[2] === 'd' ? 86400000 : 3600000;
    return Date.now() - n * unitMs;
  }
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) throw new Error(`invalid --since value: ${value} (use 30d, 12h, or a date)`);
  return ts;
}

module.exports = { parseFlags, parseSince };
