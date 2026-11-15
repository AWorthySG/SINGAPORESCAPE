// Refinement (★1 to ★15): a third layer on top of mastery and enchanting. Like
// those, a refine level belongs to the item type, so every copy shares it.
// Each level adds a share of the item's BASE combat stats, on top of whatever
// its mastery rank gives: 6% a level up to ★9, 10% from ★10 to ★12 and 15%
// from ★13 to ★15. Every attempt costs refine scrolls (nothing else), and has
// one of four outcomes, riskier the higher you go:
//   success    the item gains a level
//   failure    the scrolls are used up, nothing else happens  (from ★6)
//   downgrade  the item loses a level                         (from ★10)
//   broken     the item is destroyed and the type's refine resets (from ★13)
// An upgrade ward in your pack takes the blow of a downgrade or a break instead
// (it is used up and the attempt counts as a plain failure).

export const MAX_REFINE = 15;
export const SCROLL = 'refine_scroll';
const STATS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'magicStr', 'dance', 'crit', 'hp'];

/** Total stat gain at a refine level, as a fraction of the base stat. */
export function refineGain(level) {
  let g = 0;
  for (let l = 1; l <= level; l++) g += l <= 9 ? 0.06 : l <= 12 ? 0.1 : 0.15;
  return g;
}

/** Add a refine level's gains (worked out from the item's base stats) to
 *  bonuses that may already include its mastery rank. */
export function refinedBonuses(base = {}, current = base, level = 0) {
  if (!level) return current;
  const out = { ...current };
  const g = refineGain(level);
  for (const k of STATS) if (base[k]) out[k] = (out[k] || 0) + Math.max(level, Math.round(base[k] * g));
  return out;
}

// The odds of each outcome when trying for level `next`. Each row sums to 1.
const ODDS = {
  1: [1, 0, 0, 0], 2: [1, 0, 0, 0], 3: [1, 0, 0, 0], 4: [1, 0, 0, 0], 5: [1, 0, 0, 0],
  6: [0.8, 0.2, 0, 0], 7: [0.7, 0.3, 0, 0], 8: [0.6, 0.4, 0, 0], 9: [0.5, 0.5, 0, 0],
  10: [0.45, 0.35, 0.2, 0], 11: [0.4, 0.35, 0.25, 0], 12: [0.35, 0.35, 0.3, 0],
  13: [0.3, 0.3, 0.3, 0.1], 14: [0.25, 0.3, 0.3, 0.15], 15: [0.2, 0.3, 0.3, 0.2],
};
/** { success, fail, downgrade, broken } chances for an attempt at `next`. */
export function refineOdds(next) {
  const [success, fail, downgrade, broken] = ODDS[next] || [0, 1, 0, 0];
  return { success, fail, downgrade, broken };
}

/** Roll an attempt at `next`: 'success' | 'fail' | 'downgrade' | 'broken'. */
export function rollRefine(next, r = Math.random()) {
  const o = refineOdds(next);
  if (r < o.success) return 'success';
  if (r < o.success + o.fail) return 'fail';
  if (r < o.success + o.fail + o.downgrade) return 'downgrade';
  return 'broken';
}

/** What an attempt at `next` costs: refine scrolls only, more for the riskier
 *  levels: 1 scroll for ★1-★5, 2 for ★6-★9, 3 for ★10-★12 and 4 for ★13-★15.
 *  (Every item pays the same, so a scroll is worth as much on any piece.) */
export function refineCost(id, next) {
  return { scrolls: next <= 5 ? 1 : next <= 9 ? 2 : next <= 12 ? 3 : 4 };
}

// Refine scroll drops, by who dropped them (`level` is the monster's level).
// (Raised about fourfold at the owner's request: refining should feel reachable.)
//   normal monster  0.6% at level 1, rising to 1.5% by level 450
//   champion        one scroll 25% of the time at level 1, up to 60%
//   boss            always 6-10, plus one more per 75 levels
// At a steady 30 kills a minute that is roughly 15 scrolls every 15 minutes
// around level 100, so ★9-★10 on a piece (about 18-25 scrolls) takes under half
// an hour, while ★15 (about 90 scrolls and plenty of wards) stays a longer goal.
export const SCROLL_DROP = {
  normal: (lvl) => Math.min(0.015, 0.006 + lvl / 50000),
  champion: (lvl) => Math.min(0.6, 0.25 + lvl / 1000),
};
/** How many refine scrolls a kill drops (0 most of the time).
 *  `source`: 'normal' | 'champion' | 'boss'. */
export function refineScrollDrop(level = 1, source = 'normal', rand = Math.random) {
  if (source === 'boss') return 6 + Math.floor(rand() * 5) + Math.floor(level / 75);
  const chance = (SCROLL_DROP[source] || SCROLL_DROP.normal)(level);
  return rand() < chance ? 1 : 0;
}

/** "★3" (empty at ★0). */
export const refineTag = (level) => (level ? `★${level}` : '');
