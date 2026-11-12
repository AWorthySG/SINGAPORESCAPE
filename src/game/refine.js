import { getItem } from '../data/items.js';

// Refinement (★1 to ★15): a second layer on top of gear upgrades. Like
// upgrades, a refine level belongs to the item type, so every copy shares it.
// Each level adds a share of the item's base combat stats, on top of whatever
// its upgrade level gives: 6% a level up to ★9, 10% from ★10 to ★12 and 15%
// from ★13 to ★15. Every attempt costs coins and upgrade stones, and has one of
// four outcomes, riskier the higher you go:
//   success    the item gains a level
//   failure    the materials are used up, nothing else happens  (from ★6)
//   downgrade  the item loses a level                            (from ★10)
//   broken     the item is destroyed and the type's refine resets (from ★13)
// An upgrade ward in your pack takes the blow of a downgrade or a break instead
// (it is used up and the attempt counts as a plain failure).

export const MAX_REFINE = 15;
const STATS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'magicStr', 'dance', 'crit', 'hp'];

/** Total stat gain at a refine level, as a fraction of the base stat. */
export function refineGain(level) {
  let g = 0;
  for (let l = 1; l <= level; l++) g += l <= 9 ? 0.06 : l <= 12 ? 0.1 : 0.15;
  return g;
}

/** Add a refine level's gains (worked out from the item's base stats) to
 *  bonuses that may already include its upgrade level. */
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

/** What an attempt at `next` costs: coins and upgrade stones (one per level). */
export function refineCost(id, next) {
  const it = getItem(id);
  return { coins: Math.round(50 * next + (it.value || 20) * 0.06 * next * next), stones: next };
}

/** "★3" (empty at ★0). */
export const refineTag = (level) => (level ? `★${level}` : '');
