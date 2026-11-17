import { getItem } from '../data/items.js';

// Drop rarity, MapleStory style: rarer drops glow in their colour, shoot a
// light beam, linger a moment before flying to the pack, and get their own sound.
export const RARITY = {
  common:    { rank: 0, color: '#FFE79A', label: 'Common' },
  rare:      { rank: 1, color: '#5FAEE3', label: 'Rare' },
  epic:      { rank: 2, color: '#A66CFF', label: 'Epic' },
  legendary: { rank: 3, color: '#F5B82E', label: 'Legendary' },
};

/** Rarity of a drop. `source`: 'always' | 'table' | 'rare' (rare drop table) | 'clue'. */
export function dropRarity(id, source = 'table', { boss = false } = {}) {
  const it = getItem(id);
  const value = it.value || 0;
  if (source === 'rare') return value >= 5000 ? 'legendary' : 'epic';
  if (source === 'clue') return 'epic';
  if (source === 'always') return 'common';
  if (value >= 20000) return 'legendary';
  if (value >= 5000 || (boss && it.equip)) return 'epic';
  if (it.equip || value >= 1000) return 'rare';
  return 'common';
}

/** Ticks a drop sits on the ground before flying into the pack: rarer = longer, so you see it. */
export function lootDelay(rarity) { return [1, 2, 3, 4][RARITY[rarity]?.rank ?? 0]; }

// Gear quality: a dropped piece of gear can come out Fine, Superior, Epic,
// Legendary or Mythic. Quality is a head start on mastery: the item type jumps
// straight to the matching mastery rank (never lowering the rank you have).
// Each tier is much less likely than the one before, and the odds depend on
// who dropped it. The roll climbs a ladder of 15 steps, each next step less
// likely; the step reached picks the tier:
//   normal monster  28% climb at all, then each next step 1 in 2
//   champion        60% climb at all, then each next step 13 in 20
//   boss            always 2 steps or more, then each next step 7 in 10
// (The champion step was 3 in 5: 13 in 20 about doubles its Mythic odds, to
// roughly 1 in 80 a piece, while Fine..Epic barely move. Bosses are unchanged:
// with a dozen gear pieces a kill, half of all boss kills already bring a Mythic.)
export const QUALITY_RULES = {
  normal: { start: 0.278, from: 1, step: 0.5 },
  champion: { start: 0.6, from: 1, step: 0.65 },
  boss: { start: 1, from: 2, step: 0.7 },
};
// Each tier: its label, drop rarity, the ladder step it starts at, and the
// mastery rank it gives (1 Adept .. 5 Grandmaster, see mastery.js).
export const QUALITY = {
  fine: { label: 'Fine', rarity: 'rare', step: 1, rank: 1 },
  superior: { label: 'Superior', rarity: 'epic', step: 2, rank: 2 },
  epic: { label: 'Epic', rarity: 'epic', step: 3, rank: 3 },
  legendary: { label: 'Legendary', rarity: 'legendary', step: 5, rank: 4 },
  mythic: { label: 'Mythic', rarity: 'legendary', step: 10, rank: 5 },
};

/** How far up the quality ladder a drop climbs (0 = plain, up to 15). */
export function rollQualityStep(source = 'normal', rand = Math.random) {
  const r = QUALITY_RULES[source] || QUALITY_RULES.normal;
  if (rand() >= r.start) return 0;
  let lvl = r.from;
  while (lvl < 15 && rand() < r.step) lvl++;
  return lvl;
}
/** The quality tier key for a ladder step ('fine' .. 'mythic'), or null. */
export function qualityKey(step) {
  if (!step) return null;
  return step >= 10 ? 'mythic' : step >= 5 ? 'legendary' : step >= 3 ? 'epic' : step >= 2 ? 'superior' : 'fine';
}
/** Roll the quality a gear drop arrives with: a QUALITY key, or null for a plain drop.
 *  `source`: 'normal' | 'champion' | 'boss'. */
export function rollQuality(source = 'normal', rand = Math.random) {
  return qualityKey(rollQualityStep(source, rand));
}

// Normal monsters drop gear much less often than before (bosses and champions
// are the place to farm it): this share of their gear rolls become something else.
export const NORMAL_GEAR_SKIP = 0.6;
