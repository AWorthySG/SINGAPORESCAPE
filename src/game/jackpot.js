// The whole tree, the whole rock: now and then a swing brings down every log
// left in a tree, or breaks a rock's whole seam free, at once, with XP for each
// (the owner's ask, after the fish schools' "whole school" catch). It uses the
// tree or rock up, as if you had chopped or mined it to the end. Every fishing
// spot has the same chance of a whole school (schoolJackpot, fishschool.js).
//
// Kept out of skilling.js: resolveWoodcut and resolveMine call `nodeJackpot`
// once per swing, after that swing's own log or ore. Rolls use their own
// generator, so they never shift Math.random (the seeded tests depend on its
// sequence), and a switch lets the test suite turn it off (tests/seed.mjs).

import { getItem } from '../data/items.js';
import { weightedPick } from '../core/utils.js';
import { TILE } from '../config.js';
import { mulberry32 } from './pets.js';

export const NODE_JACKPOT = { on: true };
export const JACKPOT_CHANCE = 0.025;       // a swing's chance (about 1 in 40) to take everything left
export const JACKPOT_TOOL_BONUS = 0.5;     // ...up to half as likely again with the best tools (their `find` share)
export const SEAM_MULT = 10;               // the whole seam or tree gives ten times what was left in it (the owner's ask)

const rand = mulberry32((Date.now() ^ 0x5bd1e995) >>> 0);
/** Swap the generator (tests). */
export function setJackpotRand(fn) { roll = fn; }
let roll = rand;

/**
 * After a swing at `obj` that left `left` more logs or ores in it, maybe take
 * them all. `kind` is 'woodcutting' or 'mining'; `xpEach` the XP per piece;
 * `pick()` the id of each piece (a gem rock rolls a gem for each); `find` the
 * tool's find bonus; `mult` how many times over it pays out (SEAM_MULT for a
 * rock or tree). Returns how many it added (0 if none); the caller then treats the
 * node as emptied.
 */
export function nodeJackpot(game, obj, { kind, left, xpEach, pick, find = 0, mult = 1 }) {
  if (!NODE_JACKPOT.on || !(left > 0)) return 0;
  if (roll() >= JACKPOT_CHANCE * (1 + Math.min(1, find) * JACKPOT_TOOL_BONUS)) return 0;
  // Tally the haul, then add it a kind at a time while the bag holds its
  // 'inventory' event: one at a time, a whole seam told every listener (the bag
  // grid, the quick-use slot, discovery) up to 200 times in one swing.
  const want = new Map();
  for (let i = 0; i < left * mult; i++) { const id = pick(); want.set(id, (want.get(id) || 0) + 1); }
  const got = new Map();
  let n = 0;
  const held = game.inventory.hold?.();
  try {
    for (const [id, k] of want) {
      const room = Math.min(k, game.inventory.canAdd(id, k));
      const added = room > 0 ? (game.inventory.add(id, room) ?? room) : 0;
      if (added > 0) { got.set(id, added); n += added; }
    }
  } finally { if (held) game.inventory.release(); }
  if (!n) return 0;
  game.skills.addXp(kind, xpEach * n);
  const what = [...got].map(([id, k]) => `${k} ${getItem(id).name.toLowerCase()}`).join(', ');
  const tree = kind === 'woodcutting';
  game.msg(tree ? `The whole tree comes down at once: ${what}!` : `The whole seam breaks free: ${what}!`, 'level');
  game.banner?.(`<span class="big">${tree ? 'Whole tree!' : 'Whole seam!'}</span>+${n} ${getItem([...got.keys()][0]).name}${got.size > 1 ? ' and more' : ''}`);
  game.addHitsplat?.(game.player, 0, { text: `${tree ? 'Whole tree!' : 'Whole seam!'} +${n}` });
  const cx = (obj.x + 0.5) * TILE, cy = (obj.y + 0.5) * TILE;
  const col = tree ? '#caa15a' : (obj.def.ore || '#cfcfcf');
  game.spawnPoof?.(cx, cy, col); game.spawnPoof?.(cx - 8, cy + 4, col); game.spawnPoof?.(cx + 8, cy - 3, '#ffffff');
  game.spawnSparkle?.(game.player, tree ? '#e8c46a' : '#9adcff', 14);
  game.bus.emit('sfx', 'dropepic');
  return n;
}

/** Fishing's whole school, at any spot (the owner's ask: a whole school for every
 *  fishing spot, as rocks have their whole seam and trees their whole tree): does
 *  this catch net one? As likely as a whole seam, more so with better tools.
 *  The school itself (its size, the fish, the XP) is fishschool.js's. */
export function schoolJackpot(find = 0) {
  return NODE_JACKPOT.on && roll() < JACKPOT_CHANCE * (1 + Math.min(1, find) * JACKPOT_TOOL_BONUS);
}

/** The pick for a rock: its ore, or a fresh gem each time for a gem rock. */
export const rockPick = (def, table) => (def.gemRock ? () => weightedPick(table).id : () => def.gives);
