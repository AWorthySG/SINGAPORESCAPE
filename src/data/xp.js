// Authentic Old School RuneScape experience curve.
// XP required to reach level L (1..99) using Jagex's formula:
//   points accumulates floor(l + 300 * 2^(l/7)) for l = 1..L-1, then xp = floor(points/4).
export const MAX_LEVEL = 99;
export const MAX_XP = 200000000; // 200m cap, as in RS.

export const XP_TABLE = (() => {
  const table = [0, 0]; // index by level; level 1 = 0 xp.
  let points = 0;
  for (let lvl = 1; lvl < MAX_LEVEL; lvl++) {
    points += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    table[lvl + 1] = Math.floor(points / 4);
  }
  return table;
})();

/** Level (1..99) for a given total xp. */
export function levelForXp(xp) {
  let lvl = 1;
  while (lvl < MAX_LEVEL && XP_TABLE[lvl + 1] <= xp) lvl++;
  return lvl;
}

/** Total xp required to be exactly at the start of `level`. */
export function xpForLevel(level) {
  return XP_TABLE[clampLevel(level)];
}

function clampLevel(level) {
  if (level < 1) return 1;
  if (level > MAX_LEVEL) return MAX_LEVEL;
  return level;
}

/** Progress (0..1) of `xp` between its current level and the next. */
export function levelProgress(xp) {
  const lvl = levelForXp(xp);
  if (lvl >= MAX_LEVEL) return 1;
  const cur = XP_TABLE[lvl];
  const next = XP_TABLE[lvl + 1];
  return (xp - cur) / (next - cur);
}

/** XP remaining to next level (0 if maxed). */
export function xpToNext(xp) {
  const lvl = levelForXp(xp);
  if (lvl >= MAX_LEVEL) return 0;
  return XP_TABLE[lvl + 1] - xp;
}
