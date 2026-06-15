import { getItem } from '../data/items.js';
import { clamp, weightedPick } from '../core/utils.js';
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

export function resolveWoodcut(game, action) {
  const { obj } = action;
  const def = obj.def;
  if (obj.depleted || game.world.objectAt(obj.x, obj.y) !== obj) return false;
  if (game.skills.level('woodcutting') < def.level) {
    game.msg(`You need a Woodcutting level of ${def.level} to chop this.`); return false;
  }
  if (!game.hasTool('axe')) { game.msg('You need an axe to chop this tree.'); return false; }
  if (game.inventory.canAdd(def.gives, 1) <= 0) { game.msg('Your inventory is too full to hold any more logs.'); return false; }

  if (Math.random() < gatherChance(def.lowChance, def.highChance, game.skills.level('woodcutting'))) {
    game.inventory.add(def.gives, 1);
    game.skills.addXp('woodcutting', def.xp);
    const wc = objCenter(obj); game.spawnPoof(wc.x, wc.y, '#caa15a');
    game.msg(`You get some ${getItem(def.gives).name.toLowerCase()}.`);
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
  if (game.inventory.canAdd(def.gives, 1) <= 0) { game.msg('Your inventory is too full to hold any more ore.'); return false; }

  if (Math.random() < gatherChance(def.lowChance, def.highChance, game.skills.level('mining'))) {
    game.inventory.add(def.gives, 1);
    game.skills.addXp('mining', def.xp);
    const mc = objCenter(obj); game.spawnPoof(mc.x, mc.y, def.ore || '#cfcfcf');
    game.msg(`You manage to mine some ${getItem(def.gives).name.toLowerCase()}.`);
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
  const pick = weightedPick(eligible);
  if (Math.random() < gatherChance(pick.lowChance, pick.highChance, lvl)) {
    // A "big catch" reels in two at once — more likely at higher levels.
    const big = Math.random() < 0.05 + lvl * 0.0015 && game.inventory.canAdd(pick.id, 2) >= 2;
    const n = big ? 2 : 1;
    game.inventory.add(pick.id, n);
    game.skills.addXp('fishing', pick.xp * n);
    const fc = objCenter(obj); game.spawnPoof(fc.x, fc.y, '#bfe3ff');
    const nm = getItem(pick.id).name.replace(/^Raw /, '').toLowerCase();
    game.msg(big ? `A big catch! You haul in two ${nm}.` : `You catch a ${nm}.`);
  }
  return true; // fishing spots never deplete
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
    game.skills.addXp('cooking', cook.xp);
    game.msg(`You cook the ${getItem(cook.result).name.toLowerCase()}.`);
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
    game.msg(`You smelt a ${getItem(r.result).name.toLowerCase()}.`);
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
  game.msg(`You hammer the metal into a ${getItem(r.result).name.toLowerCase()}.`);
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
  game.skills.addXp('firemaking', logDef.fmXp || 40);
  game.msg('The fire catches and the logs begin to burn.');

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
