// World bosses drop gathering tools: now and then a boss in the open world
// leaves an upgraded axe, pickaxe, fishing rod, harpoon or hunting snare, of
// the best metal its level reaches (a level-70 boss adamant, a level-130 one
// orichalcum, ... eternal from 300), never below iron (the owner's ask).
//
// Kept out of game.js: rollDrops calls bossToolDrop once per kill. Rolls use
// their own generator, so they never shift Math.random (the seeded tests
// depend on its sequence).

import { TOOL_TIERS, TOOL_KINDS, toolId } from '../data/tooltiers.js';
import { isWorldBoss } from './mastery.js';
import { mulberry32 } from './pets.js';

// A switch for the test suite (tests/seed.mjs turns it off, so tests that count
// a boss's loot aren't moved by a tool; bosstools.test.mjs turns it on).
export const BOSS_TOOLS = { on: true };
export const BOSS_TOOL_CHANCE = 0.35;   // about one world-boss kill in three
let roll = mulberry32((Date.now() ^ 0x1b873593) >>> 0);
/** Swap the generator (tests). */
export function setBossToolRand(fn) { roll = fn; }

/** The tool tier (index into TOOL_TIERS) a boss of `level` drops: the best it reaches, iron at least. */
export function bossToolTier(level) {
  let best = 1;
  TOOL_TIERS.forEach((t, i) => { if (i >= 1 && t.level <= level) best = i; });
  return best;
}

/** The boss's level for its drops: a boss grown to your level counts at that level. */
const bossLevel = (npc) => Math.max(1, npc?.def?.scaledTo || 0, npc?.def?.tierLevel || 0, npc?.def?.level || npc?.level || 1);

/** A loot entry [id, qty, rarity] for a world boss's tool drop, or null. */
export function bossToolDrop(npc) {
  if (!BOSS_TOOLS.on || !isWorldBoss(npc) || roll() >= BOSS_TOOL_CHANCE) return null;
  const kind = TOOL_KINDS[Math.floor(roll() * TOOL_KINDS.length)];
  return [toolId(kind.tag, bossToolTier(bossLevel(npc))), 1, 'epic'];
}
