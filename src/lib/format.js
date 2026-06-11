'use strict';

let colorEnabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

function setColor(enabled) {
  colorEnabled = enabled;
}

function wrap(code) {
  return (s) => (colorEnabled ? `\x1b[${code}m${s}\x1b[0m` : String(s));
}

const c = {
  bold: wrap('1'),
  dim: wrap('2'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  blue: wrap('34'),
  magenta: wrap('35'),
  cyan: wrap('36'),
  gray: wrap('90'),
};

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visibleLength(s) {
  return String(s).replace(ANSI_RE, '').length;
}

function pad(s, width, right) {
  const gap = ' '.repeat(Math.max(0, width - visibleLength(s)));
  return right ? gap + s : s + gap;
}

/**
 * Render rows (array of arrays) into aligned columns.
 * opts.align: per-column 'left' (default) or 'right'.
 */
function table(rows, opts = {}) {
  const align = opts.align || [];
  const widths = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] || 0, visibleLength(String(cell)));
    });
  }
  return rows
    .map((row) =>
      row
        .map((cell, i) => pad(String(cell), widths[i], align[i] === 'right'))
        .join('  ')
        .replace(/\s+$/, '')
    )
    .join('\n');
}

function bar(value, max, width = 18) {
  if (!max || max <= 0) return '░'.repeat(width);
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

const SPARK = '▁▂▃▄▅▆▇█';

function sparkline(values) {
  const max = Math.max(...values, 1);
  return values
    .map((v) => SPARK[Math.min(SPARK.length - 1, Math.floor((v / max) * (SPARK.length - 1)))])
    .join('');
}

function fmtNum(n) {
  if (n == null) return '-';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}

function fmtInt(n) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtUSD(n) {
  if (n == null) return 'n/a';
  return '$' + n.toFixed(2);
}

function fmtDate(ts) {
  if (!ts) return '?';
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtTime(ts) {
  if (!ts) return '?';
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtDuration(ms) {
  if (ms == null || ms < 0) return '?';
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

function truncate(s, n) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

module.exports = {
  c,
  setColor,
  table,
  bar,
  sparkline,
  fmtNum,
  fmtInt,
  fmtUSD,
  fmtDate,
  fmtTime,
  fmtDuration,
  truncate,
  visibleLength,
};
