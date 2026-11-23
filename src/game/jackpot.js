// The whole tree, the whole rock: now and then a swing brings down every log
// left in a tree, or breaks a rock's whole seam free, at once, with XP for each
// (the owner's ask, after the fish schools' "whole school" catch). It uses the
// tree or rock up, as if you had chopped or mined it to the end. Every fishing
// spot has the same chance of a whole school (schoolJackpot, fishschool.js),
// and every trap of a whole flock (huntJackpot).
//
// Kept out of skilling.js: resolveWoodcut and resolveMine call `nodeJackpot`
// once per swing, after that swing's own log or ore, and resolveHunt calls
// `huntJackpot` after each catch. Rolls use their own generator, so they never
// shift Math.random (the seeded tests depend on its sequence), and a switch
// lets the test suite turn it off (tests/seed.mjs).

import { getItem } from '../data/items.js';
import { weightedPick } from '../core/utils.js';
import { TILE } from '../config.js';
import { mulberry32 } from './pets.js';

export const NODE_JACKPOT = { on: true };
export const JACKPOT_CHANCE = 0.05;        // a swing's chance (about 1 in 20, the owner doubled it from 1 in 40) to take everything left
export const JACKPOT_TOOL_BONUS = 0.5;     // ...up to half as likely again with the best tools (their `find` share)
export const SEAM_MULT = 10;               // the whole seam or tree gives ten times what was left in it (the owner's ask)
/** A swing's or catch's chance of the whole tree, seam or school with a tool of
 *  find share `find` (also the skill guide's XP an hour, xprate.js). */
export const jackpotChance = (find = 0) => JACKPOT_CHANCE * (1 + Math.min(1, find) * JACKPOT_TOOL_BONUS);

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
  if (roll() >= jackpotChance(find)) return 0;
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
  return NODE_JACKPOT.on && roll() < jackpotChance(find);
}

/** The pick for a rock: its ore, or a fresh gem each time for a gem rock. */
export const rockPick = (def, table) => (def.gemRock ? () => weightedPick(table).id : () => def.gives);

// Hunter's whole flock (the owner's ask: in play Hunter earned about a fifth of
// what Mining, Woodcutting and Fishing did an hour, having no burst of its own,
// and about four fifths of theirs comes from their whole seams, trees and
// schools). Now and then a trap springs on a whole flock, nest or herd at once:
// as likely as a whole seam (more so with a better snare), and sized like a
// whole school at any spot, ten times a stock of 1-14 catches (10-140), with XP
// for each. A trap holds no count to use up, so it stays set, as a fishing spot
// does after its whole school (using the trap up was tried, but the walk
// between the far-apart crocodile traps then cost a third of Hunter's XP an
// hour at level 99).
export const HUNT_STOCK = [1, 14];   // as fishschool.js WILD_STOCK
// What each trap springs on all at once ("Whole nest!"); a trap not listed: a flock.
export const HUNT_CROWD = {
  bird_snare: 'flock', squirrel_trap: 'nest', lizard_snare: 'nest', mousedeer_trail: 'herd', boar_pit: 'herd',
  python_trap: 'nest', crocodile_trap: 'nest', hornbill_nest: 'flock', qilin_trail: 'herd', pangolin_burrow: 'warren',
  colugo_trap: 'family', tiger_trail: 'family', garuda_nest: 'flock', naga_track: 'nest', phoenix_roost: 'flock',
};
const between = ([a, b]) => a + Math.floor(roll() * (b - a + 1));
// "75 lizard skins", "300 feathers", but "75 raw venison" and "75 pangolin scales".
const many = (name) => (/(s|meat|venison|fur)$/.test(name) ? name : `${name}s`);

/** After a catch at trap `obj` worth `xpEach` XP: maybe the whole flock comes
 *  with it (`find` is the snare's find bonus). Each catch is the trap's main
 *  catch (a bird snare's is a handful of feathers). Returns how many catches it
 *  added (0 if none). */
export function huntJackpot(game, obj, { xpEach, find = 0 }) {
  if (!NODE_JACKPOT.on) return 0;
  if (roll() >= JACKPOT_CHANCE * (1 + Math.min(1, find) * JACKPOT_TOOL_BONUS)) return 0;
  const main = obj.def.gives[0];
  const n = SEAM_MULT * between(HUNT_STOCK);
  let want = 0;
  for (let i = 0; i < n; i++) want += main.max ? between([main.min, main.max]) : 1;
  const got = Math.min(want, game.inventory.canAdd(main.id, want));
  if (got <= 0) return 0;
  game.inventory.add(main.id, got);
  const caught = got < want ? Math.ceil(n * got / want) : n;   // a full bag: XP for what fitted
  game.skills.addXp('hunter', xpEach * caught);
  const crowd = HUNT_CROWD[obj.objId] || 'flock', name = getItem(main.id).name;
  game.msg(`It was a whole ${crowd}: you catch ${got} ${many(name.toLowerCase())} at once!`, 'level');
  game.banner?.(`<span class="big">Whole ${crowd}!</span>+${got} ${name}`);
  game.addHitsplat?.(game.player, 0, { text: `Whole ${crowd}! +${got}` });
  const cx = (obj.x + 0.5) * TILE, cy = (obj.y + 0.5) * TILE, col = obj.def.color || '#caa15a';
  game.spawnPoof?.(cx, cy, col); game.spawnPoof?.(cx - 8, cy + 4, col); game.spawnPoof?.(cx + 8, cy - 3, '#ffffff');
  game.spawnSparkle?.(game.player, '#e8c46a', 14);
  game.bus.emit('sfx', 'dropepic');
  return caught;
}
