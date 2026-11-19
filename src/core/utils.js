// Generic helpers used across the game. Pure — no DOM access.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Euclidean distance between two {x,y} points. */
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Chebyshev distance (chessboard) — useful for "is adjacent" checks. */
export const chebyshev = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Manhattan distance. */
export const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

/** Inclusive random integer in [min, max]. */
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const chance = (p) => Math.random() < p;

export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

let _id = 0;
export const uid = () => `e${++_id}`;

/** RuneScape-style number formatting: 1234 -> "1,234", 12000 -> "12K", 3_500_000 -> "3.5M". */
export function formatNumber(n) {
  if (n < 100000) return n.toLocaleString('en-US');
  if (n < 10000000) return Math.floor(n / 1000) + 'K';
  return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

/** Short numbers for crowded labels: under 10,000 the full digits with commas
 *  ("9,999"); above that one decimal and K, M or B ("12.3K", "3.4M", "1.0B"),
 *  and no decimal from 100 of a unit up ("456K"). Rounds down, so a coin
 *  count never looks bigger than it is. */
export function shortNumber(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return '0';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a < 10000) return sign + Math.floor(a).toLocaleString('en-US');
  for (const [u, s] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (a < u) continue;
    const tenths = Math.floor((a * 10) / u);   // (whole-number maths: no 14.599999)
    return sign + (tenths >= 1000 ? String(Math.floor(tenths / 10)) : (tenths / 10).toFixed(1)) + s;
  }
  return sign + String(a);
}

/** Damage numbers on hitsplats: the full number under 1,000, then three
 *  significant figures and K, M, B or T with trailing zeros dropped
 *  (1,234 -> "1.23K", 54,000 -> "54K", 1,500,000 -> "1.5M"), so big hits
 *  stay short and readable over a monster's head. */
export function damageNumber(n) {
  n = Math.round(Number(n) || 0);
  const a = Math.abs(n);
  if (a < 1000) return String(n);
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (let i = 0; i < units.length; i++) {
    const [u, s] = units[i];
    if (a < u) continue;
    const v = +(n / u).toPrecision(3);
    // 999,999 rounds to "1000K": show it as the next unit up instead.
    if (Math.abs(v) >= 1000 && i > 0) return `${+(n / units[i - 1][0]).toPrecision(3)}${units[i - 1][1]}`;
    return `${v}${s}`;
  }
  return String(n);
}

/** Compact quantity label for item stacks (matches RS colours via class in UI). */
export function stackLabel(n) {
  if (n < 100000) return { text: String(n), cls: '' };
  if (n < 10000000) return { text: Math.floor(n / 1000) + 'K', cls: 'k' };
  return { text: Math.floor(n / 1000000) + 'M', cls: 'm' };
}

export const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Weighted random pick. table = [{ weight, ...payload }]. Returns the chosen entry. */
export function weightedPick(table) {
  const total = table.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return table[table.length - 1];
}

export function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Short HUD number: 999 -> "999", 1234 -> "1.2K", 3_400_000 -> "3.4M",
 *  1e9 -> "1.0B" (always one decimal once shortened, so a bar's read-out
 *  doesn't jump about in width). Shared by the boss bar and XP display.
 *  (shortNumber above is for coins and stats: full digits under 10,000.) */
export function hudNumber(n) {
  n = Number(n) || 0;
  const sign = n < 0 ? '-' : '';
  let v = Math.abs(n);
  if (v < 1000) return sign + String(Math.floor(v));
  const units = ['K', 'M', 'B', 'T'];
  let i = -1;
  while (i < units.length - 1 && v >= 1000) { v /= 1000; i++; }
  // Rounding can tip 999.96K over to "1000.0K": roll it up to the next unit.
  if (Number(v.toFixed(1)) >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return `${sign}${v.toFixed(1)}${units[i]}`;
}
