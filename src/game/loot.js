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
