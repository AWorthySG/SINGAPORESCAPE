import { getItem } from '../data/items.js';
import { clamp, weightedPick, randInt } from '../core/utils.js';
import { TILE } from '../config.js';

const objCenter = (obj) => ({ x: obj.x * TILE + TILE / 2, y: obj.y * TILE + TILE / 2 - 6 });

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
const GEM_TABLE = [
  { id: 'sapphire', weight: 50 }, { id: 'emerald', weight: 28 },
  { id: 'ruby', weight: 16 }, { id: 'diamond', weight: 6 },
];

export function resolveWoodcut(game, action) {
  const { obj } = action;
  const def = obj.def;
  if (obj.depleted || game.world.objectAt(obj.x, obj.y) !== obj) return false;
  if (game.skills.level('woodcutting') < def.level) {
    game.msg(`You need a Woodcutting level of ${def.level} to chop this.`); return false;
  }
  if (!game.hasTool('axe')) { game.msg('You need an axe to chop this tree.'); return false; }
  if (game.inventory.canAdd(def.gives, 1) <= 0) { game.msg('Your inventory is too full to hold any more logs.'); return false; }

  const lvl = game.skills.level('woodcutting');
  if (Math.random() < gatherChance(def.lowChance, def.highChance, lvl)) {
    game.inventory.add(def.gives, 1);
    game.skills.addXp('woodcutting', def.xp);
    const wc = objCenter(obj); game.spawnPoof(wc.x, wc.y, '#caa15a');
    const logName = getItem(def.gives).name.toLowerCase();
    // Double logs: a sturdy bough sometimes drops an extra.
    if (Math.random() < 0.04 + lvl * 0.001 && game.inventory.canAdd(def.gives, 1) > 0) {
      game.inventory.add(def.gives, 1);
      game.msg(`A second branch falls — double ${logName}!`);
    } else {
      game.msg(`You get some ${logName}.`);
    }
    // Rare bird's nest tumbles from the canopy.
    if (Math.random() < 0.008 && game.inventory.canAdd('birds_nest', 1) > 0) {
      game.inventory.add('birds_nest', 1);
      game.spawnSparkle(game.player, '#caa15a', 6);
      game.msg("A bird's nest tumbles down! Open it from your pack.", 'level');
    }
    if (Math.random() < def.depleteChance) {
      obj.depleted = true;
      obj.respawnTimer = def.respawn;
      return false; // tree felled
    }
  }
  return true;
}

export function resolveMine(game, action) {
  const { obj } = action;
  const def = obj.def;
  if (obj.depleted || game.world.objectAt(obj.x, obj.y) !== obj) return false;
  if (game.skills.level('mining') < def.level) {
    game.msg(`You need a Mining level of ${def.level} to mine this rock.`); return false;
  }
  if (!game.hasTool('pickaxe')) { game.msg('You need a pickaxe to mine this rock.'); return false; }
  // Gem rocks yield a random gem; ordinary rocks yield their fixed ore.
  const yieldId = def.gemRock ? weightedPick(GEM_TABLE).id : def.gives;
  if (game.inventory.canAdd(yieldId, 1) <= 0) { game.msg('Your inventory is too full to hold any more.'); return false; }

  const lvl = game.skills.level('mining');
  if (Math.random() < gatherChance(def.lowChance, def.highChance, lvl)) {
    game.inventory.add(yieldId, 1);
    game.skills.addXp('mining', def.xp);
    const mc = objCenter(obj); game.spawnPoof(mc.x, mc.y, def.ore || '#cfcfcf');
    const oreName = getItem(yieldId).name.toLowerCase();
    // Rich seam: a chance at a second yield.
    if (Math.random() < 0.04 + lvl * 0.001 && game.inventory.canAdd(yieldId, 1) > 0) {
      game.inventory.add(yieldId, 1);
      game.msg(`A rich seam — double ${oreName}!`);
    } else {
      game.msg(def.gemRock ? `You chip out a ${oreName}!` : `You manage to mine some ${oreName}.`);
    }
    // Lucky gem: unearth a precious stone now and then (ordinary rocks only).
    if (!def.gemRock && Math.random() < 0.012 + lvl * 0.0006) {
      const gem = weightedPick(GEM_TABLE);
      if (game.inventory.canAdd(gem.id, 1) > 0) {
        game.inventory.add(gem.id, 1);
        game.skills.addXp('mining', 40);
        game.spawnSparkle(game.player, '#9adcff', 8);
        game.msg(`You unearth a ${getItem(gem.id).name.toLowerCase()}!`, 'level');
      }
    }
    obj.depleted = true;
    obj.respawnTimer = def.respawn;
    return false; // rock depletes; player must find another
  }
  return true;
}

export function resolveFish(game, action) {
  const { obj } = action;
  const def = obj.def;
  const tool = def.tool || 'net';
  if (!game.hasTool(tool)) { game.msg(`You need a ${FISH_TOOL_NAME[tool] || tool} to fish here.`); return false; }

  const lvl = game.skills.level('fishing');
  const eligible = def.catches.filter((c) => lvl >= c.level);
  if (!eligible.length) { game.msg('You need a higher Fishing level to catch anything here.'); return false; }
  if (!eligible.some((c) => game.inventory.canAdd(c.id, 1) > 0)) {
    game.msg('Your inventory is too full to hold any more fish.'); return false;
  }
  // Now and then you snag something other than a fish.
  if (Math.random() < 0.03) return fishOddity(game, obj);

  const baited = game.inventory.count('fishing_bait') > 0;
  const pick = weightedPick(eligible);
  const chance = gatherChance(pick.lowChance, pick.highChance, lvl) + (baited ? 0.12 : 0);
  if (Math.random() < chance) {
    if (baited) game.inventory.remove('fishing_bait', 1);
    const fc = objCenter(obj);
    const nm = getItem(pick.id).name.replace(/^Raw /, '').toLowerCase();
    // Rare trophy catch: triple XP + a coin bonus.
    if (Math.random() < 0.02) {
      game.inventory.add(pick.id, 1);
      game.skills.addXp('fishing', pick.xp * 3);
      game.inventory.add('coins', 50 + Math.round(pick.xp));
      game.spawnSparkle(game.player, '#ffd24a', 14); game.spawnPoof(fc.x, fc.y, '#ffe79a');
      game.msg(`A TROPHY catch! A magnificent ${nm}!`, 'level');
      return true;
    }
    // A "big catch" reels in two at once — more likely at higher levels / with bait.
    const big = Math.random() < 0.05 + lvl * 0.0015 + (baited ? 0.05 : 0) && game.inventory.canAdd(pick.id, 2) >= 2;
    const n = big ? 2 : 1;
    game.inventory.add(pick.id, n);
    game.skills.addXp('fishing', pick.xp * n);
    game.spawnPoof(fc.x, fc.y, '#bfe3ff');
    game.msg(big ? `A big catch! You haul in two ${nm}.` : `You catch a ${nm}.`);
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
  let burnChance = 0;
  if (effLevel < cook.burnStop) {
    burnChance = clamp(0.55 * (cook.burnStop - effLevel) / Math.max(1, cook.burnStop - cook.level), 0, 0.9);
  }
  if (Math.random() < burnChance) {
    game.inventory.add('burnt_fish', 1);
    game.msg(`Oops! You accidentally burn the ${getItem(action.rawId).name.replace(/^Raw /, '').toLowerCase()}.`);
  } else {
    game.inventory.add(cook.result, 1);
    // Perfectly cooked: an occasional flawless dish grants bonus XP.
    if (Math.random() < 0.08) {
      game.skills.addXp('cooking', Math.round(cook.xp * 1.5));
      game.spawnSparkle(game.player, '#ffd24a', 6);
      game.msg(`Perfectly cooked! A flawless ${getItem(cook.result).name.toLowerCase()}.`, 'level');
    } else {
      game.skills.addXp('cooking', cook.xp);
      game.msg(`You cook the ${getItem(cook.result).name.toLowerCase()}.`);
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
  if (r.successChance && Math.random() > r.successChance) {
    game.msg('The ore is too impure and you fail to refine it.');
  } else {
    game.inventory.add(r.result, 1);
    game.skills.addXp('smithing', r.xp);
    const lvl = game.skills.level('smithing');
    const barName = getItem(r.result).name.toLowerCase();
    // A hot crucible occasionally yields an extra bar.
    if (Math.random() < 0.03 + lvl * 0.001 && game.inventory.canAdd(r.result, 1) > 0) {
      game.inventory.add(r.result, 1);
      game.msg(`The crucible runs hot — an extra ${barName}!`);
    } else {
      game.msg(`You smelt a ${barName}.`);
    }
  }
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
  game.inventory.add(r.result, 1);
  game.skills.addXp('smithing', r.xp);
  const lvl = game.skills.level('smithing');
  const itemName = getItem(r.result).name.toLowerCase();
  // Flawless work: a chance to forge an extra piece for free.
  if (Math.random() < 0.03 + lvl * 0.001 && game.inventory.canAdd(r.result, 1) > 0) {
    game.inventory.add(r.result, 1);
    game.spawnSparkle(game.player, '#ffd24a', 6);
    game.msg(`Flawless work — you forge an extra ${itemName}!`);
  } else {
    game.msg(`You hammer the metal into a ${itemName}.`);
  }
  return game.inventory.has(r.bar, r.barCount);
}

export function resolveFiremake(game, action) {
  // Wait until the player is standing on the target tile.
  const p = game.player;
  if (p.isMoving || p.x !== action.tile.x || p.y !== action.tile.y) return true;

  if (!game.hasTool('tinderbox')) { game.msg('You need a tinderbox to light a fire.'); return false; }
  if (!game.inventory.has(action.logId)) return false;
  const logDef = getItem(action.logId);
  if (game.skills.level('firemaking') < (logDef.firemaking || 1)) {
    game.msg(`You need a Firemaking level of ${logDef.firemaking} to burn these logs.`); return false;
  }
  if (game.world.objectAt(p.x, p.y)) {
    game.msg('You can\'t light a fire here.'); return false;
  }

  game.inventory.remove(action.logId, 1);
  game.world.lightFire(p.x, p.y);
  // A fire occasionally roars up for bonus XP.
  const baseFm = logDef.fmXp || 40;
  if (Math.random() < 0.10) {
    game.skills.addXp('firemaking', Math.round(baseFm * 1.5));
    game.spawnSparkle(game.player, '#ffae3a', 8);
    game.msg('The fire roars to life — bonus Firemaking XP!', 'level');
  } else {
    game.skills.addXp('firemaking', baseFm);
    game.msg('The fire catches and the logs begin to burn.');
  }
  // Rarely, something glints in the embers.
  if (Math.random() < 0.012) {
    const c = randInt(15, 90);
    game.inventory.add('coins', c);
    game.msg(`You spot ${c} coins glinting in the ashes.`);
  }

  // Try to step to an adjacent free tile (west preferred) and keep going.
  if (game.inventory.has(action.logId)) {
    const candidates = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of candidates) {
      const nx = p.x + dx, ny = p.y + dy;
      if (!game.world.isBlocked(nx, ny) && !game.world.objectAt(nx, ny)) {
        p.setPath([{ x: nx, y: ny }], game.running);
        action.tile = { x: nx, y: ny };
        return true;
      }
    }
  }
  return false;
}
