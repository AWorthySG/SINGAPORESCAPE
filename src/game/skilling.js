import { getItem } from '../data/items.js';
import { clamp, weightedPick, randInt, aOrAn } from '../core/utils.js';
import { TILE } from '../config.js';
import { yieldBonus, huntExtras } from './culling.js';
import { toolBonus, toolTooHighMsg } from './tools.js';
import { batched } from './autoprocess.js';
import { nodeJackpot, rockPick, SEAM_MULT } from './jackpot.js';
import { burnAll } from './bonfire.js';   // every log at once, onto one bonfire   // now and then the whole tree or seam at once   // an instant batch's news told once (smeltBatch)

const objCenter = (obj) => ({ x: obj.x * TILE + TILE / 2, y: obj.y * TILE + TILE / 2 - 6 });

// Aromatic herbs foraged from the undergrowth while woodcutting — feed the
// local hawker-dish recipes (see DISHES) and are also sold at the Hawker Centre.
export const HERB_FORAGE = ['chilli', 'galangal', 'lemongrass', 'pandan_leaves', 'turmeric'];

// Cooking definitions: raw item -> result, level, xp, and the level at which it
// stops burning. Range cooking is more forgiving than a fire.
export const COOKING = {
  raw_anchovy: { result: 'anchovy', level: 1, xp: 30, burnStop: 34 },
  raw_sardine: { result: 'sardine', level: 1, xp: 40, burnStop: 38 },
  raw_trout: { result: 'trout', level: 15, xp: 70, burnStop: 50 },
  raw_chicken: { result: 'cooked_chicken', level: 1, xp: 30, burnStop: 33 },
  raw_salmon: { result: 'salmon', level: 25, xp: 90, burnStop: 58 },
  raw_tuna: { result: 'tuna', level: 30, xp: 100, burnStop: 63 },
  raw_lobster: { result: 'lobster', level: 40, xp: 120, burnStop: 74 },
  raw_swordfish: { result: 'swordfish', level: 45, xp: 140, burnStop: 86 },
  raw_shark: { result: 'shark', level: 80, xp: 210, burnStop: 94 },
  raw_mackerel: { result: 'mackerel', level: 10, xp: 60, burnStop: 45 },
  raw_pike: { result: 'pike', level: 20, xp: 80, burnStop: 53 },
  raw_eel: { result: 'eel', level: 38, xp: 95, burnStop: 62 },
  raw_grouper: { result: 'grouper', level: 50, xp: 130, burnStop: 80 },
  raw_stingray: { result: 'stingray', level: 60, xp: 160, burnStop: 88 },
  raw_manta_ray: { result: 'manta_ray', level: 80, xp: 224, burnStop: 95 },
  // Singapore freshwater
  raw_tilapia: { result: 'tilapia', level: 8, xp: 55, burnStop: 44 },
  raw_marble_goby: { result: 'marble_goby', level: 22, xp: 78, burnStop: 56 },
  raw_peacock_bass: { result: 'peacock_bass', level: 30, xp: 90, burnStop: 60 },
  raw_speckled_temensis: { result: 'speckled_temensis', level: 42, xp: 115, burnStop: 70 },
  raw_giant_snakehead: { result: 'giant_snakehead', level: 52, xp: 140, burnStop: 80 },
  // Singapore saltwater
  raw_red_snapper: { result: 'red_snapper', level: 25, xp: 82, burnStop: 56 },
  raw_golden_snapper: { result: 'golden_snapper', level: 38, xp: 108, burnStop: 66 },
  raw_mangrove_jack: { result: 'mangrove_jack', level: 32, xp: 94, burnStop: 60 },
  raw_barramundi: { result: 'barramundi', level: 28, xp: 88, burnStop: 58 },
  raw_red_drum: { result: 'red_drum', level: 36, xp: 100, burnStop: 64 },
  raw_tenggiri: { result: 'tenggiri', level: 46, xp: 122, burnStop: 72 },
  raw_longfin_trevally: { result: 'longfin_trevally', level: 48, xp: 126, burnStop: 74 },
  raw_giant_trevally: { result: 'giant_trevally', level: 64, xp: 168, burnStop: 86 },
  raw_diamond_trevally: { result: 'diamond_trevally', level: 56, xp: 150, burnStop: 80 },
  raw_hybrid_grouper: { result: 'hybrid_grouper', level: 60, xp: 160, burnStop: 84 },
  // More freshwater
  raw_climbing_perch: { result: 'climbing_perch', level: 12, xp: 50, burnStop: 46 },
  raw_ikan_keli: { result: 'ikan_keli', level: 16, xp: 56, burnStop: 50 },
  raw_belida: { result: 'belida', level: 30, xp: 92, burnStop: 60 },
  raw_arapaima: { result: 'arapaima', level: 62, xp: 178, burnStop: 88 },
  raw_arowana: { result: 'arowana', level: 70, xp: 230, burnStop: 92 },
  // More saltwater
  raw_milkfish: { result: 'milkfish', level: 26, xp: 86, burnStop: 58 },
  raw_queenfish: { result: 'queenfish', level: 32, xp: 96, burnStop: 62 },
  raw_threadfin: { result: 'threadfin', level: 38, xp: 112, burnStop: 68 },
  raw_white_pomfret: { result: 'white_pomfret', level: 42, xp: 120, burnStop: 72 },
  raw_coral_trout: { result: 'coral_trout', level: 46, xp: 135, burnStop: 76 },
  raw_cobia: { result: 'cobia', level: 54, xp: 155, burnStop: 82 },
  // Hunter game
  raw_venison: { result: 'venison', level: 35, xp: 105, burnStop: 66 },
  raw_boar_meat: { result: 'boar_steak', level: 50, xp: 145, burnStop: 78 },
  // Endgame fish (Cooking 100-300). An occasional perfect dish pays half again
  // (about 4% more on average), and each tier's xp is set for ~35% more a cook
  // than the tier before (set when it was one cook a tick), starting from the seafood
  // platter (270), the best below level 100 (tests/fish-cook.test.mjs).
  raw_dorado: { result: 'grilled_dorado', level: 100, xp: 352, burnStop: 100 },
  raw_bluefin_tuna: { result: 'tuna_sashimi', level: 130, xp: 476, burnStop: 130 },
  raw_sailfish: { result: 'sambal_sailfish', level: 160, xp: 643, burnStop: 160 },
  raw_moonfish: { result: 'moonfish_curry', level: 200, xp: 869, burnStop: 200 },
  raw_rift_eel: { result: 'rift_eel_claypot', level: 250, xp: 1174, burnStop: 250 },
  raw_dragon_arowana: { result: 'arowana_feast', level: 300, xp: 1585, burnStop: 300 },
};

// Display names for the fishing tool each spot requires.
export const FISH_TOOL_NAME = {
  net: 'small fishing net', rod: 'fishing rod', lobster_pot: 'lobster pot', harpoon: 'harpoon',
};

/** Interpolate gather success between level 1 (low) and level 99 (high). */
export function gatherChance(low, high, level) {
  const t = clamp((level - 1) / 98, 0, 1);
  return clamp(low + (high - low) * t, 0.05, 0.99);
}

// All resolvers return true to keep the action going next tick, false to stop.

// Weighted gems unearthed while mining (better gems are rarer).
export const GEM_TABLE = [
  { id: 'sapphire', weight: 50 }, { id: 'emerald', weight: 28 },
  { id: 'ruby', weight: 16 }, { id: 'diamond', weight: 6 },
];

// The moonlit kapok's Woodcutting XP at night (it can be chopped any time),
// the moonfish spot's Fishing XP, and the tiger trail's Hunter XP.
export const NIGHT_TREE_BONUS = 1.25;

// Each tree holds a random 10-20 logs, like a rock's ores (the owner's call:
// trees fell too fast), rolled when it is first chopped and again after it
// regrows; it falls to a stump when they run out. A tree with no depleteChance
// (the world events' ancient trees) never falls and keeps no count.
export const TREE_LOGS_MIN = 10, TREE_LOGS_MAX = 20;
export const rollTreeLogs = (rand = Math.random) => TREE_LOGS_MIN + Math.floor(rand() * (TREE_LOGS_MAX - TREE_LOGS_MIN + 1));

export function resolveWoodcut(game, action) {
  const { obj } = action;
  const def = obj.def;
  if (obj.depleted || game.world.objectAt(obj.x, obj.y) !== obj) return false;
  if (game.skills.level('woodcutting') < def.level) {
    game.msg(`You need a Woodcutting level of ${def.level} to chop this.`); return false;
  }
  if (!game.hasTool('axe')) { game.msg(toolTooHighMsg(game, 'axe') || 'You need an axe to chop this tree.'); return false; }
  // The moonlit kapok only gives its wood after dark.
  if (game.inventory.canAdd(def.gives, 1) <= 0) { game.msg('Your inventory is too full to hold any more logs.'); return false; }

  const lvl = game.skills.level('woodcutting');
  const tb = toolBonus(game, 'axe');   // a better axe: more double logs and nests (tooltiers.js)
  // Life skills never fail (the owner's call): every swing at a tree you can
  // chop gives logs. Level still decides which trees you can chop.
  {
    const falls = def.depleteChance > 0;
    if (falls && typeof obj.logsLeft !== 'number') obj.logsLeft = rollTreeLogs();
    game.inventory.add(def.gives, 1);
    // A moonlit tree gives more under the moon (a bonus for night chopping, never a lock).
    game.skills.addXp('woodcutting', def.night && game.isNight() ? def.xp * NIGHT_TREE_BONUS : def.xp);
    const wc = objCenter(obj); game.spawnPoof(wc.x, wc.y, '#caa15a');
    game.world.shake(obj, 280); game.bus.emit('sfx', 'gather'); // the tree judders as the log falls
    const logName = getItem(def.gives).name.toLowerCase();
    // Double logs: a sturdy bough sometimes drops an extra.
    // (Stewardship adds to the chance while you are Neutral, see culling.js.)
    if ((!falls || obj.logsLeft > 1) && Math.random() < 0.04 + lvl * 0.001 + yieldBonus(game) + tb.yield && game.inventory.canAdd(def.gives, 1) > 0) {
      game.inventory.add(def.gives, 1);
      if (falls) obj.logsLeft--;   // the extra log comes out of the tree's 10-20
      game.msg(`A second branch falls — double ${logName}!`);
    } else {
      game.msg(`You get some ${logName}.`);
    }
    // Rare bird's nest tumbles from the canopy.
    if (Math.random() < 0.008 * (1 + tb.find) && game.inventory.canAdd('birds_nest', 1) > 0) {
      game.inventory.add('birds_nest', 1);
      game.spawnSparkle(game.player, '#caa15a', 6);
      game.msg("A bird's nest tumbles down! Open it from your pack.", 'level');
    }
    // Foraging: a fragrant herb sometimes grows in the undergrowth nearby.
    else if (Math.random() < 0.03) {
      const herb = HERB_FORAGE[Math.floor(Math.random() * HERB_FORAGE.length)];
      if (game.inventory.canAdd(herb, 1) > 0) {
        game.inventory.add(herb, 1);
        game.msg(`You forage some ${getItem(herb).name.toLowerCase()} from the undergrowth.`);
      }
    }
    // Now and then the whole tree comes down at once, ten times over (jackpot.js).
    if (falls && obj.logsLeft > 1 && nodeJackpot(game, obj, { kind: 'woodcutting', left: obj.logsLeft - 1,
      xpEach: def.night && game.isNight() ? def.xp * NIGHT_TREE_BONUS : def.xp, pick: () => def.gives, find: tb.find, mult: SEAM_MULT })) obj.logsLeft = 1;
    if (!falls || --obj.logsLeft > 0) return true;   // logs left in the tree: keep chopping
    obj.logsLeft = undefined;              // a fresh amount is rolled once it regrows
    obj.depleted = true;
    obj.respawnTimer = def.respawn;
    return false; // tree felled
  }
}

// Each rock holds a random 10-20 ores (the owner's call), rolled when it is
// first struck and again after it regrows; it is mined out when they run dry.
export const ROCK_ORES_MIN = 10, ROCK_ORES_MAX = 20;
export const rollRockOres = (rand = Math.random) => ROCK_ORES_MIN + Math.floor(rand() * (ROCK_ORES_MAX - ROCK_ORES_MIN + 1));

export function resolveMine(game, action) {
  const { obj } = action;
  const def = obj.def;
  if (obj.depleted || game.world.objectAt(obj.x, obj.y) !== obj) return false;
  if (game.skills.level('mining') < def.level) {
    game.msg(`You need a Mining level of ${def.level} to mine this rock.`); return false;
  }
  if (!game.hasTool('pickaxe')) { game.msg(toolTooHighMsg(game, 'pickaxe') || 'You need a pickaxe to mine this rock.'); return false; }
  // Gem rocks yield a random gem; ordinary rocks yield their fixed ore.
  const yieldId = def.gemRock ? weightedPick(GEM_TABLE).id : def.gives;
  if (game.inventory.canAdd(yieldId, 1) <= 0) { game.msg('Your inventory is too full to hold any more.'); return false; }

  const lvl = game.skills.level('mining');
  const tb = toolBonus(game, 'pickaxe');   // a better pickaxe: more rich seams and gems (tooltiers.js)
  // Every swing at a rock you can mine now succeeds (the owner's call: no
  // more swinging at nothing); level still decides which rocks you can mine.
  {
    if (typeof obj.oresLeft !== 'number') obj.oresLeft = rollRockOres();
    game.inventory.add(yieldId, 1);
    game.skills.addXp('mining', def.xp);
    const mc = objCenter(obj); game.spawnPoof(mc.x, mc.y, def.ore || '#cfcfcf');
    game.world.shake(obj, 280); game.bus.emit('sfx', 'gather'); // the rock judders as ore breaks free
    const oreName = getItem(yieldId).name.toLowerCase();
    // Rich seam: a chance at a second yield.
    if (obj.oresLeft > 1 && Math.random() < 0.04 + lvl * 0.001 + yieldBonus(game) + tb.yield && game.inventory.canAdd(yieldId, 1) > 0) {
      game.inventory.add(yieldId, 1);
      obj.oresLeft--;   // the bonus ore comes out of the rock's 10-20
      game.msg(`A rich seam — double ${oreName}!`);
    } else {
      game.msg(def.gemRock ? `You chip out ${aOrAn(oreName)}!` : `You manage to mine some ${oreName}.`);
    }
    // Lucky gem: unearth a precious stone now and then (ordinary rocks only).
    if (!def.gemRock && Math.random() < (0.012 + lvl * 0.0006) * (1 + tb.find)) {
      const gem = weightedPick(GEM_TABLE);
      if (game.inventory.canAdd(gem.id, 1) > 0) {
        game.inventory.add(gem.id, 1);
        game.skills.addXp('mining', 40);
        game.spawnSparkle(game.player, '#9adcff', 8);
        game.msg(`You unearth ${aOrAn(getItem(gem.id).name.toLowerCase())}!`, 'level');
      }
    }
    // Now and then the whole seam breaks free at once, ten times over (jackpot.js).
    if (obj.oresLeft > 1 && nodeJackpot(game, obj, { kind: 'mining', left: obj.oresLeft - 1, xpEach: def.xp, pick: rockPick(def, GEM_TABLE), find: tb.find, mult: SEAM_MULT })) obj.oresLeft = 1;
    if (--obj.oresLeft > 0) return true;   // ore left in the seam: keep swinging
    obj.oresLeft = undefined;              // a fresh amount is rolled once it regrows
    obj.depleted = true;
    obj.respawnTimer = def.respawn;
    game.msg('The rock is mined out.');
    return false; // rock depletes; player must find another
  }
}

export function resolveFish(game, action) {
  const { obj } = action;
  const def = obj.def;
  const tool = def.tool || 'net';
  if (!game.hasTool(tool)) { game.msg(toolTooHighMsg(game, tool) || `You need ${aOrAn(FISH_TOOL_NAME[tool] || tool)} to fish here.`); return false; }
  const tb = toolBonus(game, tool);   // a better rod or harpoon: more big and trophy catches (tooltiers.js)

  const lvl = game.skills.level('fishing');
  const eligible = def.catches.filter((c) => lvl >= c.level);
  if (!eligible.length) { game.msg('You need a higher Fishing level to catch anything here.'); return false; }
  if (!eligible.some((c) => game.inventory.canAdd(c.id, 1) > 0)) {
    game.msg('Your inventory is too full to hold any more fish.'); return false;
  }
  // Now and then you snag something else as well (never instead of a fish).
  if (Math.random() < 0.03) fishOddity(game, obj);

  const baited = game.inventory.count('fishing_bait') > 0;
  const pick = weightedPick(eligible);
  // Moonfish rise by moonlight: more XP at night (a bonus, never a lock).
  const xpEach = def.night && game.isNight() ? pick.xp * NIGHT_TREE_BONUS : pick.xp;
  // Purely cosmetic: the hero's haul animation lands this very fish (heroanim.js).
  game.bus.emit('fishcatch', { id: pick.id, objId: obj.objId });
  // Every cast catches a fish (life skills never fail).
  {
    if (baited) game.inventory.remove('fishing_bait', 1);
    const fc = objCenter(obj);
    const nm = getItem(pick.id).name.replace(/^Raw /, '').toLowerCase();
    // Rare trophy catch: triple XP + a coin bonus.
    if (Math.random() < 0.02 * (1 + tb.find)) {
      game.inventory.add(pick.id, 1);
      game.skills.addXp('fishing', xpEach * 3);
      game.inventory.add('coins', 50 + Math.round(pick.xp));
      game.spawnSparkle(game.player, '#ffd24a', 14); game.spawnPoof(fc.x, fc.y, '#ffe79a');
      game.msg(`A TROPHY catch! A magnificent ${nm}!`, 'level');
      game.fishSchools?.onCatch(obj, pick.xp ? xpEach / pick.xp : 1, pick.id);   // maybe a whole school (fishschool.js)
      return true;
    }
    // A "big catch" reels in two at once — more likely at higher levels / with bait.
    const big = Math.random() < 0.05 + lvl * 0.0015 + (baited ? 0.05 : 0) + yieldBonus(game) + tb.yield && game.inventory.canAdd(pick.id, 2) >= 2;
    const n = big ? 2 : 1;
    game.inventory.add(pick.id, n);
    game.skills.addXp('fishing', xpEach * n);
    game.spawnPoof(fc.x, fc.y, '#bfe3ff');
    game.bus.emit('sfx', 'gather');
    game.msg(big ? `A big catch! You haul in two ${nm}.` : `You catch ${aOrAn(nm)}.`);
    game.fishSchools?.onCatch(obj, pick.xp ? xpEach / pick.xp : 1, pick.id);   // maybe a whole school (fishschool.js)
  }
  return true; // fishing spots never deplete
}

// A small chance while fishing to pull up junk or treasure (incl. a
// message-in-a-bottle clue scroll) — keeps fishing lively and rewarding.
function fishOddity(game, obj) {
  const fc = objCenter(obj);
  game.spawnPoof(fc.x, fc.y, '#bfe3ff');
  const r = Math.random();
  if (r < 0.4) {
    const junk = Math.random() < 0.5 ? 'old_boot' : 'seaweed';
    if (game.inventory.canAdd(junk, 1) > 0) { game.inventory.add(junk, 1); game.msg(`You fish up some ${getItem(junk).name.toLowerCase()}. Charming.`); }
  } else if (r < 0.85) {
    if (Math.random() < 0.35 && game.inventory.canAdd('pearl', 1) > 0) {
      game.inventory.add('pearl', 1); game.skills.addXp('fishing', 25);
      game.spawnSparkle(game.player, '#ffffff', 8); game.msg('You prise open an oyster and find a pearl!', 'level');
    } else {
      const c = randInt(20, 120); game.inventory.add('coins', c); game.skills.addXp('fishing', 12);
      game.msg(`You haul up a soggy purse of ${c} coins.`);
    }
  } else if (!game.clue && !game._holdsClue()) {
    // Message in a bottle -> a clue scroll, if you aren't already on a trail.
    game.world.addGroundItem('clue_scroll_easy', 1, obj.x, obj.y);
    game.msg('A message in a bottle! A clue scroll washes up beside you.', 'level');
  } else {
    const c = randInt(60, 200); game.inventory.add('coins', c);
    game.msg(`A message in a bottle — empty, but ${c} coins were tucked inside.`);
  }
  return true;
}

export function resolveCook(game, action) {
  const cook = COOKING[action.rawId];
  if (!cook) return false;
  if (!game.inventory.has(action.rawId)) return false; // ran out
  if (game.skills.level('cooking') < cook.level) {
    game.msg(`You need a Cooking level of ${cook.level} to cook that.`); return false;
  }
  game.inventory.remove(action.rawId, 1);
  const lvl = game.skills.level('cooking');
  const onRange = action.obj?.def.type === 'range';
  const effLevel = lvl + (onRange ? 5 : 0);
  // Food never burns any more (life skills never fail); the old burn levels in
  // COOKABLE (burnStop) are kept only as data.
  const burnChance = 0;
  // A batch (makeBatch, autoprocess.js) passes a tally: each roll is counted
  // there and told in one summary line, rather than a line and a sparkle each.
  const t = action.tally;
  if (burnChance > 0 && Math.random() < burnChance) {
    game.inventory.add('burnt_fish', 1);
    if (t) t.burnt++;
    else game.msg(`Oops! You accidentally burn the ${getItem(action.rawId).name.replace(/^Raw /, '').toLowerCase()}.`);
  } else {
    game.inventory.add(cook.result, 1);
    // Perfectly cooked: an occasional flawless dish grants bonus XP.
    if (Math.random() < 0.08) {
      game.skills.addXp('cooking', Math.round(cook.xp * 1.5));
      if (t) t.bonus++;
      else {
        game.spawnSparkle(game.player, '#ffd24a', 6);
        game.msg(`Perfectly cooked! A flawless ${getItem(cook.result).name.toLowerCase()}.`, 'level');
      }
    } else {
      game.skills.addXp('cooking', cook.xp);
      if (!t) game.msg(`You cook the ${getItem(cook.result).name.toLowerCase()}.`);
    }
  }
  return game.inventory.has(action.rawId);
}

export function resolveSmelt(game, action) {
  const r = action.recipe;
  for (const inp of r.inputs) {
    if (!game.inventory.has(inp.id, inp.qty)) { game.msg('You have run out of materials.'); return false; }
  }
  if (game.skills.level('smithing') < r.level) {
    game.msg(`You need a Smithing level of ${r.level} to smelt this.`); return false;
  }
  for (const inp of r.inputs) game.inventory.remove(inp.id, inp.qty);
  // Smelting is instant: the furnace runs the whole batch at once (see
  // smeltBatch), so each bar's outcome is tallied and told in one line.
  const tally = action.tally || (action.tally = { made: 0, extra: 0, failed: 0 });
  // Ore is never too impure any more (life skills never fail): recipes' old
  // successChance is ignored, so every lot of ore makes a bar.
  {
    game.inventory.add(r.result, 1);
    game.skills.addXp('smithing', r.xp);
    tally.made++;
    const lvl = game.skills.level('smithing');
    // A hot crucible occasionally yields an extra bar.
    if (Math.random() < 0.03 + lvl * 0.001 && game.inventory.canAdd(r.result, 1) > 0) {
      game.inventory.add(r.result, 1);
      tally.extra++;
    }
  }
  return r.inputs.every((inp) => game.inventory.has(inp.id, inp.qty));
}

/** Smelt every bar the materials in your pack allow, all at once, and say
 *  what came out. Returns false (the furnace is done). */
export function smeltBatch(game, action) {
  action.tally = null;
  let guard = 0;
  // A pet roll for every bar, and the bag and XP told once for the lot (autoprocess.js).
  batched(game, () => { while (resolveSmelt(game, action) && ++guard < 100000) { /* keep smelting */ } });
  const t = action.tally;
  if (!t || (!t.made && !t.failed)) return false;
  const name = getItem(action.recipe.result).name.toLowerCase();
  const bars = t.made + t.extra;
  game.bus.emit('sfx', 'clang');
  game.msg(`You smelt ${bars} ${name}${bars === 1 ? '' : 's'}`
    + (t.extra ? ` (${t.extra} extra from a hot crucible)` : '')
    + (t.failed ? `; ${t.failed} lot${t.failed === 1 ? '' : 's'} of ore ${t.failed === 1 ? 'was' : 'were'} too impure` : '') + '.');
  return false;
}

// Combination dishes (pies, stews) assembled at a fire/range. Never burn.
export function resolveDish(game, action) {
  const r = action.recipe;
  if (game.skills.level('cooking') < r.level) {
    game.msg(`You need a Cooking level of ${r.level} to make this.`); return false;
  }
  for (const inp of r.inputs) {
    if (!game.inventory.has(inp.id, inp.qty)) { game.msg('You have run out of ingredients.'); return false; }
  }
  if (game.inventory.canAdd(r.result, 1) <= 0) { game.msg('Your inventory is too full.'); return false; }
  for (const inp of r.inputs) game.inventory.remove(inp.id, inp.qty);
  game.inventory.add(r.result, 1);
  game.skills.addXp('cooking', r.xp);
  if (action.tally) return r.inputs.every((inp) => game.inventory.has(inp.id, inp.qty));   // a batch says it once (makeBatch)
  const fc = { x: action.obj.x * 32 + 16, y: action.obj.y * 32 + 10 };
  game.spawnPoof(fc.x, fc.y, '#ffd9a0');
  game.msg(`You prepare ${aOrAn(getItem(r.result).name.toLowerCase())}.`);
  return r.inputs.every((inp) => game.inventory.has(inp.id, inp.qty));
}

export function resolveCraft(game, action) {
  const r = action.recipe;
  if (r.tool && !game.hasTool(r.tool)) { game.msg(`You need ${aOrAn(getItem(r.tool).name.toLowerCase())} to craft this.`); return false; }
  if (game.skills.level('crafting') < r.level) {
    game.msg(`You need a Crafting level of ${r.level} to make this.`); return false;
  }
  for (const inp of r.inputs) {
    if (!game.inventory.has(inp.id, inp.qty)) { game.msg('You have run out of materials.'); return false; }
  }
  const n = r.qty || 1;   // refine scrolls and wards come several to a craft
  if (game.inventory.canAdd(r.result, n) <= 0) { game.msg('Your inventory is too full.'); return false; }
  for (const inp of r.inputs) game.inventory.remove(inp.id, inp.qty);
  game.inventory.add(r.result, n);
  game.skills.addXp('crafting', r.xp);
  if (action.tally) return r.inputs.every((inp) => game.inventory.has(inp.id, inp.qty));   // a batch says it once (makeBatch)
  game.spawnSparkle(game.player, '#caa15a', 6);
  game.msg(n > 1 ? `You craft ${n} ${getItem(r.result).name.toLowerCase()}s.` : `You craft ${aOrAn(getItem(r.result).name.toLowerCase())}.`);
  return r.inputs.every((inp) => game.inventory.has(inp.id, inp.qty));
}

export function resolveSmith(game, action) {
  const r = action.recipe;
  if (!game.hasTool('hammer')) { game.msg('You need a hammer to work the metal.'); return false; }
  if (!game.inventory.has(r.bar, r.barCount)) { game.msg(`You need ${r.barCount} ${getItem(r.bar).name.toLowerCase()}s.`); return false; }
  if (game.skills.level('smithing') < r.level) {
    game.msg(`You need a Smithing level of ${r.level} to make this.`); return false;
  }
  game.inventory.remove(r.bar, r.barCount);
  game.inventory.add(r.result, r.qty || 1);   // upgrade stones come several to a bar
  game.skills.addXp('smithing', r.xp);
  const t = action.tally;   // a batch (makeBatch) counts the extras and says it once
  if (!t) game.bus.emit('sfx', 'clang');
  const lvl = game.skills.level('smithing');
  const itemName = getItem(r.result).name.toLowerCase();
  // Flawless work: a chance to forge an extra piece for free.
  if (Math.random() < 0.03 + lvl * 0.001 && game.inventory.canAdd(r.result, 1) > 0) {
    game.inventory.add(r.result, 1);
    if (t) t.bonus++;
    else {
      game.spawnSparkle(game.player, '#ffd24a', 6);
      game.msg(`Flawless work — you forge an extra ${itemName}!`);
    }
  } else if (!t) {
    game.msg(r.qty > 1 ? `You hammer the metal into ${r.qty} ${itemName.endsWith('s') ? itemName : `${itemName}s`}.` : `You hammer the metal into ${aOrAn(itemName)}.`);   // "20 bronze rounds", not "roundss"
  }
  return game.inventory.has(r.bar, r.barCount);
}

// Firemaking can't simply go faster (each fire needs its own tile, and you step
// to the next one), so it gets the 25% the other life skills gained in speed
// (GATHER_SPEED in game.js) as XP per log instead.
export const FIRE_XP = 1.25;

export function resolveFiremake(game, action) {
  // Wait until the player is standing on the target tile. If the walk there was
  // cut short, light where they stopped instead of waiting for ever.
  const p = game.player;
  if (p.isMoving) return true;
  if (p.x !== action.tile.x || p.y !== action.tile.y) {
    const there = game.world.objectAt(p.x, p.y);
    if (game.world.isBlocked(p.x, p.y) || (there && there.def.type !== 'fire')) { game.msg("You can't light a fire here."); return false; }
    action.tile = { x: p.x, y: p.y };
  }

  if (!game.hasTool('tinderbox')) { game.msg('You need a tinderbox to light a fire.'); return false; }
  if (!game.inventory.has(action.logId)) return false;
  const logDef = getItem(action.logId);
  if (game.skills.level('firemaking') < (logDef.firemaking || 1)) {
    game.msg(`You need a Firemaking level of ${logDef.firemaking} to burn these logs.`); return false;
  }
  const here = game.world.objectAt(p.x, p.y);
  if (here && here.def.type !== 'fire') {
    game.msg('You can\'t light a fire here.'); return false;
  }
  // Every log of this kind (or every log you can burn, for "burn everything")
  // goes on one fire at once, or onto the fire already here: a bigger, longer
  // bonfire that warms whoever stands near it (bonfire.js).
  burnAll(game, action.all ? (game.burnableLogs?.() || [action.logId]) : [action.logId], action.count || Infinity);
  return false;
}

// ---------------- Hunter ----------------
export function resolveHunt(game, action) {
  const { obj } = action;
  const def = obj.def;
  if (obj.depleted || game.world.objectAt(obj.x, obj.y) !== obj) return false;
  if (game.skills.level('hunter') < def.level) { game.msg(`You need a Hunter level of ${def.level} to use this.`); return false; }
  if (!game.hasTool('snare') && toolTooHighMsg(game, 'snare')) { game.msg(toolTooHighMsg(game, 'snare')); return false; }
  if (!game.hasTool('snare')) {
    // Said over your head too: a chat line alone was easy to miss, so the trap looked broken.
    game.msg('You need a hunting snare to work traps: buy one at the Kampong General Store, or ask the Kampong Guide for starter tools.');
    game.addHitsplat?.(game.player, 0, { text: 'Need a hunting snare' });
    return false;
  }
  if (def.gives.some((g) => game.inventory.canAdd(g.id, g.max || 1) <= 0)) { game.msg('Your inventory is too full.'); return false; }
  const lvl = game.skills.level('hunter');
  // The trap always springs (life skills never fail), and its main catch is certain;
  // anything after the first is a bonus with its own chance.
  const got = [];
  const tb = toolBonus(game, 'snare');   // a better snare: more bonus catches (tooltiers.js)
  for (const [gi, g] of def.gives.entries()) {
    if (gi > 0 && Math.random() >= Math.min(1, (g.chance ?? 1) * (1 + tb.find))) continue;
    const n = g.max ? randInt(g.min, g.max) : 1;
    game.inventory.add(g.id, n);
    got.push(n > 1 ? `${n} ${getItem(g.id).name.toLowerCase()}s` : getItem(g.id).name.toLowerCase());
  }
  // Hunter bait, Stewardship and the mosquito-net cape (culling.js): more XP, and
  // bait now and then lands a second main catch.
  const hx = huntExtras(game), main = def.gives[0];
  if ((hx.double || (tb.yield > 0 && Math.random() < tb.yield)) && game.inventory.canAdd(main.id, 1) > 0) { game.inventory.add(main.id, 1); got.push(`a second ${getItem(main.id).name.toLowerCase()}`); }
  // The Night Safari's tiger trail pays more after dark (a bonus, never a lock), as the moonlit kapok does.
  game.skills.addXp('hunter', (def.night && game.isNight() ? def.xp * NIGHT_TREE_BONUS : def.xp) * hx.xpMult);
  const c = objCenter(obj); game.spawnPoof(c.x, c.y, def.color || '#caa15a');
  game.world.shake(obj, 280); game.bus.emit('sfx', 'gather');
  game.msg(`The trap springs! You catch ${got.join(' and ')}.`);
  if (Math.random() < def.depleteChance) {
    obj.depleted = true;
    obj.respawnTimer = def.respawn;
    game.msg('The trap needs resetting. Try another, or wait a moment.');
    return false;
  }
  return true;
}

// ---------------- Fletching and Herblore ----------------
// A recipe worked at a station: `action.recipe` is { result, qty, inputs: [[id, n]...], level, xp, tool? }.
export function resolveRecipe(game, action) {
  const { recipe: r, skill } = action;
  const sname = skill[0].toUpperCase() + skill.slice(1);
  if (r.tool && !game.hasTool(r.tool)) { game.msg(`You need ${aOrAn(getItem(r.tool === 'knife' ? 'knife' : r.tool).name.toLowerCase())} for this.`); return false; }
  if (game.skills.level(skill) < r.level) { game.msg(`You need ${aOrAn(sname)} level of ${r.level} to make this.`); return false; }
  if (!r.inputs.every(([id, n]) => game.inventory.has(id, n))) { game.msg('You have run out of materials.'); return false; }
  if (game.inventory.canAdd(r.result, r.qty || 1) <= 0) { game.msg('Your inventory is too full.'); return false; }
  for (const [id, n] of r.inputs) game.inventory.remove(id, n);
  game.inventory.add(r.result, r.qty || 1);
  game.skills.addXp(skill, r.xp);
  if (action.tally) return r.inputs.every(([id, n]) => game.inventory.has(id, n));   // a batch says it once (makeBatch)
  game.spawnSparkle(game.player, skill === 'herblore' ? '#7ad08a' : '#caa15a', 6);
  const name = getItem(r.result).name.toLowerCase();
  game.msg(skill === 'herblore' ? `You brew ${aOrAn(name)}.` : `You fletch ${(r.qty || 1) > 1 ? `${r.qty} ${name}s` : `${aOrAn(name)}`}.`);
  return r.inputs.every(([id, n]) => game.inventory.has(id, n));
}
