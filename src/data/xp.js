// Experience curve. Levels 1-99 follow Old School RuneScape's formula exactly:
//   points accumulates floor(l + 300 * 2^(l/7)) for l = 1..L-1, then xp = floor(points/4).
// Past 99 the cap rises to 999: each further level costs what 98->99 did,
// growing gently (+1/150 per level), instead of RS's runaway doubling.
export const MAX_LEVEL = 999;
const RS_MAX = 99;

export const XP_TABLE = (() => {
  const table = [0, 0]; // index by level; level 1 = 0 xp.
  let points = 0;
  for (let lvl = 1; lvl < RS_MAX; lvl++) {
    points += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    table[lvl + 1] = Math.floor(points / 4);
  }
  const step = table[RS_MAX] - table[RS_MAX - 1];
  for (let lvl = RS_MAX + 1; lvl <= MAX_LEVEL; lvl++) {
    table[lvl] = table[lvl - 1] + Math.floor(step * (1 + (lvl - RS_MAX) / 150));
  }
  return table;
})();

export const MAX_XP = XP_TABLE[MAX_LEVEL];

/** Level (1..999) for a given total xp (binary search: skills ask this a lot). */
export function levelForXp(xp) {
  let lo = 1, hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (XP_TABLE[mid] <= xp) lo = mid; else hi = mid - 1;
  }
  return lo;
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
