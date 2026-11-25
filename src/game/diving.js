// Diving's rules (the tables are in src/data/diving.js): the breath meter, the
// dive gear you carry, a dive's catch, pearls, the sunken chest and the whole
// reef at once. Kept out of game.js: the game's tick runs resolveDive through
// _tickContinuous, as it does resolveFish, so auto gather, the skill unlocks,
// streaks, lucky finds and the level haul all work a reef as they do a spot.
//
// The breath meter: a dive lasts your breath in ticks, one taken each tick you
// spend under (extra rolls in the same tick share it); when it runs out you
// come up for SURFACE_TICKS, then dive again with full breath. The action holds
// { breath, maxBreath, surface } for the hero's breath bar (render/diveart.js).
import { getItem, ITEMS } from '../data/items.js';
import { TILE } from '../config.js';
import { aOrAn, weightedPick, randInt } from '../core/utils.js';
import { DIVE_TAG, PEARL_GRADES, CHEST_RATE, CHEST_GEMS, SURFACE_TICKS, maxBreath, chestClue } from '../data/diving.js';
import { NODE_JACKPOT, SEAM_MULT, HUNT_STOCK, jackpotBase, tallyWhole, many } from './jackpot.js';
import { NIGHT_TREE_BONUS } from './skilling.js';
import { bestTool, toolBonus } from './tools.js';
import { mulberry32 } from './pets.js';

// ---------------- Gear ----------------
/** The best dive gear you carry or wield that your level lets you use: its id, or null (tools.js). */
export const bestDiveGear = (game) => bestTool(game, DIVE_TAG);
/** The tier of that gear (-1 with none). */
export const diveGearTier = (game) => { const id = bestDiveGear(game); return id ? ITEMS[id].diveTier : -1; };
/** What the gear adds, as a tool tier does: { speed, yield, find } (tooltiers.js). */
export const diveBonus = (game) => toolBonus(game, DIVE_TAG);
/** Your breath in ticks: your Diving level and your gear. */
export const diveBreath = (game) => maxBreath(game?.skills?.level?.('diving') || 1, diveGearTier(game));

// Rolls of its own (pearl grades aside), so the extras never shift Math.random,
// which the seeded tests replay.
let roll = mulberry32((Date.now() ^ 0x1b873593) >>> 0);
/** Swap the generator (tests). */
export function setDiveRand(fn) { roll = fn; }

const objCenter = (obj) => ({ x: obj.x * TILE + TILE / 2, y: obj.y * TILE + TILE / 2 - 6 });

// ---------------- A dive ----------------
/** One dive at a reef (action.obj). Returns true to keep diving, false to stop. */
export function resolveDive(game, action) {
  const { obj } = action, def = obj.def, c = def.catches?.[0];
  if (!c) return false;
  const lvl = game.skills.level('diving');
  if (lvl < c.level) { game.msg(`You need a Diving level of ${c.level} to dive here.`); return false; }
  if (game.inventory.canAdd(c.id, 1) <= 0) { game.msg('Your inventory is too full to hold any more.'); return false; }
  const t = game.tickCount || 0;
  // Up for air: the pause between dives (one tick of it at a time, however many rolls the tick holds).
  if (action.surface > 0) {
    if (action._bt !== t) {
      action._bt = t;
      action.surface--;
      if (!action.surface) action.breath = action.maxBreath = diveBreath(game);
    }
    return true;
  }
  if (action.breath == null) action.breath = action.maxBreath = diveBreath(game);
  if (action._bt !== t) { action._bt = t; action.breath--; }

  const tb = diveBonus(game);
  // Moon shells glow by moonlight: more XP at night (a bonus, never a lock).
  const xpEach = def.night && game.isNight?.() ? c.xp * NIGHT_TREE_BONUS : c.xp;
  game.inventory.add(c.id, 1);
  game.skills.addXp('diving', xpEach);
  // Better gear: now and then a second one (no XP for it, as a Hunter's second catch).
  let n = 1;
  if (tb.yield > 0 && roll() < tb.yield && game.inventory.canAdd(c.id, 1) > 0) { game.inventory.add(c.id, 1); n++; }
  const name = getItem(c.id).name.toLowerCase();
  const fc = objCenter(obj);
  game.spawnPoof?.(fc.x, fc.y, '#bfe9ff');
  game.bus.emit('sfx', 'gather');
  game.msg(n > 1 ? `You dive and bring up two ${many(name)}.` : `You dive and bring up ${aOrAn(name)}.`);
  if (def.pearl && roll() < def.pearl.chance * (1 + tb.find)) findPearl(game, def.pearl);
  if (roll() < (def.chest || 1) * (1 + tb.find) / CHEST_RATE) sunkenChest(game, obj, c.level);
  diveJackpot(game, obj, { xpEach });   // now and then the whole reef bed at once
  if (action.breath <= 0) {
    action.breath = 0;
    action.surface = SURFACE_TICKS;
    game.addHitsplat?.(game.player, 0, { text: 'Up for air' });
  }
  return true;   // reefs never run dry
}

/** A pearl from an oyster bed, its grade by the bed's weights. */
export function findPearl(game, pearl) {
  const table = PEARL_GRADES.map((id, i) => ({ id, weight: pearl.w[i] || 0 })).filter((e) => e.weight > 0);
  const id = weightedPick(table).id;
  if (game.inventory.canAdd(id, 1) <= 0) return null;
  game.inventory.add(id, 1);
  const grade = PEARL_GRADES.indexOf(id);
  game.spawnSparkle?.(game.player, grade >= 3 ? '#ffd24a' : '#ffffff', 8 + grade * 3);
  game.msg(`You prise open an oyster and find ${aOrAn(getItem(id).name.toLowerCase())}!`, grade >= 2 ? 'level' : 'game');
  if (grade >= 3) game.banner?.(`<span class="big">${getItem(id).name}!</span>From the oyster beds`);
  return id;
}

/** A sunken chest: coins by the reef's level, a gem, and a clue scroll if you
 *  aren't on a trail already (else more coins). */
export function sunkenChest(game, obj, level) {
  const coins = randInt(40, 120) + level * 12;
  const gem = weightedPick(CHEST_GEMS).id;
  game.inventory.add('coins', coins);
  if (game.inventory.canAdd(gem, 1) > 0) game.inventory.add(gem, 1);
  let clue = null;
  if (!game.clue && !game._holdsClue?.()) {
    clue = chestClue(level);
    game.world.addGroundItem?.(clue, 1, game.player.x, game.player.y);
  }
  const what = `${coins.toLocaleString('en-GB')} coins, ${aOrAn(getItem(gem).name.toLowerCase())}${clue ? ' and a clue scroll (it floats up beside you)' : ''}`;
  game.msg(`A sunken chest! Inside: ${what}.`, 'level');
  game.banner?.(`<span class="big">Sunken chest!</span>${what}`);
  game.spawnSparkle?.(game.player, '#ffd24a', 16);
  game.bus.emit('sfx', 'dropepic');
  return { coins, gem, clue };
}

// Diving's whole reef bed (as Hunter's whole flock, jackpot.js): about one dive
// in 20, ten times a stock of 1-14 catches (10-140) at once, with XP for each.
// A reef never runs dry, so it carries on as before after it.
export function diveJackpot(game, obj, { xpEach }) {
  if (!NODE_JACKPOT.on || roll() >= jackpotBase(game.skills?.level?.('diving'))) return 0;
  const c = obj.def.catches[0];
  const n = SEAM_MULT * (HUNT_STOCK[0] + Math.floor(roll() * (HUNT_STOCK[1] - HUNT_STOCK[0] + 1)));
  game.inventory.add(c.id, n);   // (stackable: the bag always has room)
  tallyWhole(c.id, n);
  game.skills.addXp('diving', xpEach * n);
  const name = getItem(c.id).name;
  game.msg(`A whole reef bed! You bring up ${n.toLocaleString('en-GB')} ${many(name.toLowerCase())} at once!`, 'level');
  game.banner?.(`<span class="big">Whole reef!</span>+${n.toLocaleString('en-GB')} ${name}`);
  game.addHitsplat?.(game.player, 0, { text: `Whole reef! +${n}` });
  const fc = objCenter(obj);
  game.spawnPoof?.(fc.x, fc.y, obj.def.color || '#bfe9ff'); game.spawnPoof?.(fc.x - 8, fc.y + 4, '#ffffff');
  game.spawnSparkle?.(game.player, '#9adcff', 14);
  game.bus.emit('sfx', 'dropepic');
  return n;
}
