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
export const QUALITY = {
  fine: { level: 1, label: 'Fine', rarity: 'rare' },
  superior: { level: 2, label: 'Superior', rarity: 'epic' },
  epic: { level: 3, label: 'Epic', rarity: 'epic' },
  legendary: { level: 5, label: 'Legendary', rarity: 'legendary' },
  // The rarest of all: the piece drops already fully upgraded to +15.
  mythic: { level: 15, label: 'Mythic', rarity: 'legendary' },
};

/** Roll a quality for a gear drop. `source`: 'normal' | 'champion' | 'boss'.
 *  Bosses always give at least Superior. Returns a QUALITY key or null. */
export function rollQuality(source = 'normal', rand = Math.random) {
  const r = rand();
  // Mythic (+15): 2% of boss gear, 0.25% of champion gear, 0.1% of other gear.
  if (source === 'boss') return r < 0.02 ? 'mythic' : r < 0.12 ? 'legendary' : r < 0.42 ? 'epic' : 'superior';
  const m = source === 'champion' ? 2.5 : 1;
  if (r < 0.001 * m) return 'mythic';
  if (r < 0.004 * m) return 'legendary';
  if (r < 0.018 * m) return 'epic';
  if (r < 0.078 * m) return 'superior';
  if (r < 0.278 * m) return 'fine';
  return null;
}

// Normal monsters drop gear much less often than before (bosses and champions
// are the place to farm it): this share of their gear rolls become something else.
export const NORMAL_GEAR_SKIP = 0.6;
