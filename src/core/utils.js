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
