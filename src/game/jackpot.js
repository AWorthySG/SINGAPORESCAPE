// The whole tree, the whole rock: now and then a swing brings down every log
// left in a tree, or breaks a rock's whole seam free, at once, with XP for each
// (the owner's ask, after the fish schools' "whole school" catch). It uses the
// tree or rock up, as if you had chopped or mined it to the end. Every fishing
// spot has the same chance of a whole school (schoolJackpot, fishschool.js),
// every trap of a whole flock (huntJackpot) and every harvest of a record one
// (recordHarvest).
//
// Kept out of skilling.js: resolveWoodcut and resolveMine call `nodeJackpot`
// once per swing, after that swing's own log or ore, resolveHunt calls
// `huntJackpot` after each catch and Game.harvestPatch `recordHarvest` after
// each harvest. Rolls use their own generator, so they never shift Math.random
// (the seeded tests depend on its sequence), and a switch lets the test suite
// turn it off (tests/seed.mjs).

import { getItem } from '../data/items.js';
import { weightedPick } from '../core/utils.js';
import { TILE } from '../config.js';
import { mulberry32 } from './pets.js';

export const NODE_JACKPOT = { on: true };
export const JACKPOT_CHANCE = 0.05;        // a swing's chance (about 1 in 20, the owner doubled it from 1 in 40) to take everything left
export const JACKPOT_TOOL_BONUS = 0.5;     // ...up to half as likely again with the best tools (their `find` share)
export const SEAM_MULT = 10;               // the whole seam or tree gives ten times what was left in it (the owner's ask)
// Each 100 levels of the skill add a quarter of a percentage point to the base
// chance (the owner's ask: higher Mining, Fishing, Hunter and Woodcutting levels
// trigger the whole seam, school, flock and tree more often). 5% at level 1-99,
// 7.5% at 1,000, about 30% at 9,999, and the best tools' bonus on top of that.
export const JACKPOT_PER_100 = 0.0025;
/** The base chance at skill level `lvl`, before the tool's bonus. */
export const jackpotBase = (lvl = 1) => JACKPOT_CHANCE + JACKPOT_PER_100 * Math.floor(Math.max(0, lvl || 0) / 100);
/** A swing's or catch's chance of the whole tree, seam or school with a tool of
 *  find share `find`, at skill level `lvl` (also the skill guide's XP an hour, xprate.js). */
export const jackpotChance = (find = 0, lvl = 1) => jackpotBase(lvl) * (1 + Math.min(1, find) * JACKPOT_TOOL_BONUS);

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
  if (roll() >= jackpotChance(find, game.skills?.level?.(kind))) return 0;
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
      if (added > 0) { got.set(id, added); n += added; tallyWhole(id, added); }
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
export function schoolJackpot(find = 0, lvl = 1) {
  return NODE_JACKPOT.on && roll() < jackpotChance(find, lvl);
}

/** The pick for a rock: its ore, or a fresh gem each time for a gem rock. */
export const rockPick = (def, table) => (def.gemRock ? () => weightedPick(table).id : () => def.gives);

// What the whole trees, seams, schools and flocks add during the gather that
// runSkillAction (skillunlocks.js) is running, by item, so the unlocks' double
// copies that gather's own yield and never the haul that came with it; null
// outside one.
export const WHOLE_HAUL = { got: null };
export function tallyWhole(id, n) { const m = WHOLE_HAUL.got; if (m && n > 0) m.set(id, (m.get(id) || 0) + n); }

// Hunter's whole flock (the owner's ask: in play Hunter earned about a fifth of
// what Mining, Woodcutting and Fishing did an hour, having no burst of its own,
// and about four fifths of theirs comes from their whole seams, trees and
// schools). Now and then a trap springs on a whole flock, nest or herd at once:
// about one catch in 20, and sized like a whole school at any spot, ten times a
// stock of 1-14 catches (10-140), with XP for each. A trap holds no count to use
// up, so it stays set, as a fishing spot does after its whole school (using the
// trap up was tried, but the walk between the far-apart crocodile traps then
// cost a third of Hunter's XP an hour at level 99). A better snare doesn't make
// it likelier, as a better pickaxe does a whole seam: with nothing used up, the
// endgame snares' find share lifted Hunter about a quarter past the others at
// level 500.
export const HUNT_STOCK = [1, 14];   // as fishschool.js WILD_STOCK
// What each trap springs on all at once ("Whole nest!"); a trap not listed: a flock.
export const HUNT_CROWD = {
  bird_snare: 'flock', squirrel_trap: 'nest', lizard_snare: 'nest', mousedeer_trail: 'herd', boar_pit: 'herd',
  python_trap: 'nest', crocodile_trap: 'nest', hornbill_nest: 'flock', qilin_trail: 'herd', pangolin_burrow: 'warren',
  colugo_trap: 'family', tiger_trail: 'family', garuda_nest: 'flock', naga_track: 'nest', phoenix_roost: 'flock',
};
const between = ([a, b]) => a + Math.floor(roll() * (b - a + 1));
const count = (n) => n.toLocaleString('en-GB');   // "1,120 feathers", as the XP lines write it
// Many of a catch or crop: "75 lizard skins", "840 sweet potatoes", "140 sireh
// leaves", "70 peaches of immortality" and "140 eternal lotuses", but "75 raw
// venison", "140 pangolin scales" and "840 kangkong" (meat, fur and the herbs
// are counted as they are).
const AS_IS = /(s|meat|venison|fur|kangkong|ali|kucing|bumi|ginseng|lingzhi)$/;
export function many(name) {
  const of = name.indexOf(' of ');
  if (of > 0) return many(name.slice(0, of)) + name.slice(of);
  if (/lotus$/.test(name)) return `${name}es`;
  if (AS_IS.test(name)) return name;
  if (/leaf$/.test(name)) return `${name.slice(0, -1)}ves`;
  return /(i|o|ch)$/.test(name) ? `${name}es` : `${name}s`;
}

/** After a catch at trap `obj` worth `xpEach` XP: maybe the whole flock comes
 *  with it. Each catch is the trap's main catch (a bird snare's is a handful of
 *  feathers). Returns how many catches it added (0 if none). */
export function huntJackpot(game, obj, { xpEach }) {
  if (!NODE_JACKPOT.on || roll() >= jackpotBase(game.skills?.level?.('hunter'))) return 0;
  const main = obj.def.gives[0];
  const n = SEAM_MULT * between(HUNT_STOCK);
  let got = 0;
  for (let i = 0; i < n; i++) got += main.max ? between([main.min, main.max]) : 1;
  game.inventory.add(main.id, got);   // (the bag always has room)
  tallyWhole(main.id, got);
  game.skills.addXp('hunter', xpEach * n);
  const crowd = HUNT_CROWD[obj.objId] || 'flock', name = getItem(main.id).name;
  game.msg(`It was a whole ${crowd}: you catch ${count(got)} ${many(name.toLowerCase())} at once!`, 'level');
  game.banner?.(`<span class="big">Whole ${crowd}!</span>+${count(got)} ${name}`);
  game.addHitsplat?.(game.player, 0, { text: `Whole ${crowd}! +${count(got)}` });
  const cx = (obj.x + 0.5) * TILE, cy = (obj.y + 0.5) * TILE, col = obj.def.color || '#caa15a';
  game.spawnPoof?.(cx, cy, col); game.spawnPoof?.(cx - 8, cy + 4, col); game.spawnPoof?.(cx + 8, cy - 3, '#ffffff');
  game.spawnSparkle?.(game.player, '#e8c46a', 14);
  game.bus.emit('sfx', 'dropepic');
  return n;
}

// Farming's record harvest (the same ask: a farm had no burst either; not
// "bumper", which is Farming's level-75 unlock). About one harvest in 20 is a
// record one (there is no tool, so no find bonus), as big for the work as a
// whole seam: the patch gives the crop's own yield ten times a stock of 1-14
// over again (10-140 harvests' worth at once), with XP for every crop. Sized on
// the yield the crop rolled, not on green fingers or the unlocks' extra crops:
// those grow as you out-level a crop, and a record harvest grown with them left
// the last crop paying far more than the other skills at level 500. The patch
// is empty after it, as after any harvest.
export const RECORD_STOCK = [1, 14];

/** After a harvest of `crop` (cropFor) at patch `obj` whose own yield roll was
 *  `rolled` crops: maybe a record harvest. Returns how many more crops it added
 *  (0 if none). */
export function recordHarvest(game, obj, crop, rolled) {
  if (!NODE_JACKPOT.on || !(rolled > 0) || roll() >= JACKPOT_CHANCE) return 0;
  const n = rolled * SEAM_MULT * between(RECORD_STOCK);
  game.inventory.add(crop.id, n);   // (the bag always has room)
  game.skills.addXp('farming', crop.harvestXp * n);
  game.msg(`A record harvest! The patch gives ${count(n)} more ${many(crop.name.toLowerCase())}.`, 'level');
  game.banner?.(`<span class="big">Record harvest!</span>+${count(n)} ${crop.name}`);
  game.addHitsplat?.(game.player, 0, { text: `Record harvest! +${count(n)}` });
  game.spawnSparkle?.({ x: obj.x, y: obj.y }, crop.color, 18);
  game.spawnSparkle?.(game.player, '#9be37a', 14);
  game.bus.emit('sfx', 'dropepic');
  return n;
}
