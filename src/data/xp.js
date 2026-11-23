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

/** Life-skill XP multiplier at a level: 1 up to 99, then 1 + (L-99)/150, the
 *  same slope as the cost of a level past 99 (XP_TABLE above), so every level
 *  past 99 takes about as long at the same activity as 98->99 did. */
export const pastCapXpMult = (level) => 1 + Math.max(0, level - RS_MAX) / 150;

/** How far `level` has come from `from` (where a life-skill bonus used to stop)
 *  to MAX_LEVEL: 0 at or below `from`, 1 at MAX_LEVEL, a straight line between.
 *  A bonus adds its further growth times this, so it keeps growing a little
 *  with every level to its top at 9999 (the owner's ask) and nothing changes up
 *  to its old stopping level. */
export const towardTop = (level, from) => Math.max(0, Math.min(1, ((level || 1) - from) / (MAX_LEVEL - from)));

/** For a chance `p(level)` that reaches 100% before MAX_LEVEL (double logs at
 *  level 960, say): 0 until it is certain, then a straight line to 1 at
 *  MAX_LEVEL. A certain chance can't grow, so it grows sideways into a chance
 *  of one more (skilling.js). This is towardTop from the level where p became
 *  certain, so it follows the player's tool, bait and Stewardship as p does.
 *  0 for a chance that never reaches 100%. */
export const pastSure = (p, level) => {
  const span = p(MAX_LEVEL) - 1, over = p(level) - 1;
  // A sum that is exactly 1 can come out a hair over it in floating point
  // (0.04 + 0.82 + 0.04 + 0.1 is 1.0000000000000002): that is only certain,
  // not past it, so it gives nothing (and rolls nothing). A real step past 1
  // at a whole level is at least 0.00008.
  return span > 0 && over > 1e-9 ? Math.min(1, over / span) : 0;
};

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
