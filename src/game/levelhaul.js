// A bigger haul as you level (the owner's ask: gathering should steadily give
// more per action as a life skill rises). Each log, ore, fish or catch has a
// chance of a bonus one, with its XP: +0.2% a level in the skill, so 10% at
// level 50, about 20% at 99 and 40% at 200, at most 50% (level 250).
//
// The bonus comes on top of the node: it never uses up a tree's logs or a
// rock's ore. (A speed-up was tried first, but trees and rocks run dry and
// fishing spots don't, so faster swings helped Fishing far more than the
// others; a bonus haul lifts every gathering skill by the same share.)
//
// Kept out of game.js: _tickContinuous calls levelHaul once per gather. Rolls
// use their own generator, so they never shift Math.random (the seeded tests
// depend on its sequence), and tests/seed.mjs switches it off for the balance
// tests (it scales every skill alike, so it doesn't change how they compare).

import { mulberry32 } from './pets.js';

export const LEVEL_HAUL = { on: true };
export const LEVEL_HAUL_PER = 0.2;   // % chance per level
export const LEVEL_HAUL_CAP = 50;    // % at most
export const HAUL_SKILL = { woodcut: 'woodcutting', mine: 'mining', fish: 'fishing', hunt: 'hunter' };
let roll = mulberry32((Date.now() ^ 0x27d4eb2f) >>> 0);
/** Swap the generator (tests). */
export function setHaulRand(fn) { roll = fn; }

/** The % chance of a bonus haul at `level`. */
export const levelHaulPct = (level) => Math.min(LEVEL_HAUL_CAP, Math.max(0, (level || 1) - 1) * LEVEL_HAUL_PER);

/**
 * After a gather (`a` the action, `obj` the node, `before` the bag's counts
 * before it): maybe add one more of what it gave, with its XP. Returns the
 * item id added, or null.
 */
export function levelHaul(game, a, obj, before) {
  const skill = HAUL_SKILL[a.type];
  if (!LEVEL_HAUL.on || !skill || !obj?.def) return null;
  if (roll() * 100 >= levelHaulPct(game.skills.level(skill))) return null;
  // What this action gave: the node's own product if it gave one (a log, not
  // the bird's nest that fell with it), else whatever it gave most of (never coins).
  const own = new Set([obj.def.gives, ...(obj.def.catches || []).map((c) => c.id)].filter(Boolean));
  // The bag counted once (counting each slot's item over the whole bag took the
  // square of its size, and a late game's bag holds hundreds of things).
  const now = new Map();
  for (const sl of game.inventory.slots) if (sl && sl.id !== 'coins') now.set(sl.id, (now.get(sl.id) || 0) + sl.qty);
  let id = null, most = 0, mine = false;
  for (const [sid, n] of now) {
    const got = n - (before.get(sid) || 0);
    if (got <= 0) continue;
    const isOwn = own.has(sid);
    if ((isOwn && !mine) || (isOwn === mine && got > most)) { most = got; id = sid; mine = isOwn; }
  }
  if (!id || game.inventory.canAdd(id, 1) <= 0) return null;
  // Its XP as the node lists it (a fish by its own catch); Skills.addXp adds the rates.
  const xp = obj.def.catches?.find((c) => c.id === id)?.xp ?? obj.def.xp ?? 0;
  game.inventory.add(id, 1);
  if (xp > 0) game.skills.addXp(skill, xp);
  return id;
}
