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

// Gear quality: a dropped piece of gear can come out Fine, Superior, Epic or
// Legendary. Quality is a head start on upgrades: the item type jumps straight
// to that many upgrade levels (never lowering a level you already have).
// Gear quality: a dropped piece can arrive already upgraded, anywhere from +1
// to +15. Each level higher is much less likely than the one before, and the
// odds depend on who dropped it:
//   normal monster  28% get +1 or better, then each next level 1 in 2
//                   (+5 ~1 in 60, +10 ~1 in 2,000, +15 ~1 in 60,000)
//   champion        60% get +1 or better, then each next level 3 in 5
//                   (+5 ~1 in 13, +10 ~1 in 170, +15 ~1 in 2,100)
//   boss            always +2 or better, then each next level 7 in 10
//                   (+5 ~1 in 3, +10 ~1 in 17, +15 ~1 in 100)
export const QUALITY_RULES = {
  normal: { start: 0.278, from: 1, step: 0.5 },
  champion: { start: 0.6, from: 1, step: 0.6 },
  boss: { start: 1, from: 2, step: 0.7 },
};
/** The named tier for an upgrade level (+1 Fine ... +10 and up Mythic). */
export function qualityFor(level) {
  if (level >= 10) return { key: 'mythic', label: 'Mythic', rarity: 'legendary' };
  if (level >= 5) return { key: 'legendary', label: 'Legendary', rarity: 'legendary' };
  if (level >= 3) return { key: 'epic', label: 'Epic', rarity: 'epic' };
  if (level >= 2) return { key: 'superior', label: 'Superior', rarity: 'epic' };
  return { key: 'fine', label: 'Fine', rarity: 'rare' };
}
// Kept for older callers: the lowest level of each named tier.
export const QUALITY = { fine: { level: 1, label: 'Fine', rarity: 'rare' }, superior: { level: 2, label: 'Superior', rarity: 'epic' },
  epic: { level: 3, label: 'Epic', rarity: 'epic' }, legendary: { level: 5, label: 'Legendary', rarity: 'legendary' }, mythic: { level: 10, label: 'Mythic', rarity: 'legendary' } };

/** Roll the upgrade level (0 = plain, up to 15) a gear drop arrives with.
 *  `source`: 'normal' | 'champion' | 'boss'. */
export function rollUpgrade(source = 'normal', rand = Math.random) {
  const r = QUALITY_RULES[source] || QUALITY_RULES.normal;
  if (rand() >= r.start) return 0;
  let lvl = r.from;
  while (lvl < 15 && rand() < r.step) lvl++;
  return lvl;
}
/** Older name: the quality key for a roll, or null. */
export function rollQuality(source = 'normal', rand = Math.random) {
  const lvl = rollUpgrade(source, rand);
  return lvl ? qualityFor(lvl).key : null;
}

// Normal monsters drop gear much less often than before (bosses and champions
// are the place to farm it): this share of their gear rolls become something else.
export const NORMAL_GEAR_SKIP = 0.6;
