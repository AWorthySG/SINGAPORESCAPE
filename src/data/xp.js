// Experience curve. Levels 1-99 follow Old School RuneScape's formula exactly:
//   points accumulates floor(l + 300 * 2^(l/7)) for l = 1..L-1, then xp = floor(points/4).
// Past 99 the cap rises to 9999 (99999 for the fighting skills, Melee, Ranged
// and Magic): each further level costs what 98->99 did, growing gently
// (+1/150 per level), instead of RS's runaway doubling.
export const MAX_LEVEL = 9999;
export const COMBAT_MAX_LEVEL = 99999;
// The skills that go all the way to COMBAT_MAX_LEVEL (Strength mirrors Melee).
export const COMBAT_SKILLS = new Set(['attack', 'strength', 'ranged', 'magic']);
/** The level cap for a skill. */
export const maxLevelFor = (id) => (COMBAT_SKILLS.has(id) ? COMBAT_MAX_LEVEL : MAX_LEVEL);
const RS_MAX = 99;

export const XP_TABLE = (() => {
  const table = [0, 0]; // index by level; level 1 = 0 xp.
  let points = 0;
  for (let lvl = 1; lvl < RS_MAX; lvl++) {
    points += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    table[lvl + 1] = Math.floor(points / 4);
  }
  const step = table[RS_MAX] - table[RS_MAX - 1];
  for (let lvl = RS_MAX + 1; lvl <= COMBAT_MAX_LEVEL; lvl++) {
    table[lvl] = table[lvl - 1] + Math.floor(step * (1 + (lvl - RS_MAX) / 150));
  }
  return table;
})();

export const MAX_XP = XP_TABLE[MAX_LEVEL];
/** The most xp a skill can hold (its cap's xp). */
export const maxXpFor = (id) => XP_TABLE[maxLevelFor(id)];

/** Level (1..cap) for a given total xp (binary search: skills ask this a lot). */
export function levelForXp(xp, cap = MAX_LEVEL) {
  let lo = 1, hi = cap;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (XP_TABLE[mid] <= xp) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Total xp required to be exactly at the start of `level`. */
export function xpForLevel(level) {
  return XP_TABLE[Math.min(COMBAT_MAX_LEVEL, Math.max(1, level))];
}

/** Progress (0..1) of `xp` between its current level and the next. */
export function levelProgress(xp, cap = MAX_LEVEL) {
  const lvl = levelForXp(xp, cap);
  if (lvl >= cap) return 1;
  const cur = XP_TABLE[lvl];
  const next = XP_TABLE[lvl + 1];
  return (xp - cur) / (next - cur);
}

/** XP remaining to next level (0 if maxed). */
export function xpToNext(xp, cap = MAX_LEVEL) {
  const lvl = levelForXp(xp, cap);
  if (lvl >= cap) return 0;
  return XP_TABLE[lvl + 1] - xp;
}
