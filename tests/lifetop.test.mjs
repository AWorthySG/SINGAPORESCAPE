// Life-skill bonuses keep growing all the way to level 9999 (the owner's ask).
// Each is as it was up to the level where it used to stop, then grows in a
// straight line to its top at 9999 (towardTop, src/data/xp.js); a chance that
// is already certain grows sideways into a chance of one more on top (pastSure,
// and EXTRA_AT_TOP in src/game/skilling.js). The level haul, the school haul,
// the unlocks and the life perks are checked in their own suites; this one has
// the shared helpers, green fingers, and the extras a gather or a make gives.
import './seed.mjs';   // seeded Math.random, and the level haul, unlocks and jackpots off
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel, MAX_LEVEL, towardTop, pastSure } from '../src/data/xp.js';
import { CROPS, greenFingersChance, GREEN_FINGERS_CAP, GREEN_FINGERS_TOP } from '../src/data/trades.js';
import { SMELT, SMITH } from '../src/data/smithing.js';
import { resolveWoodcut, resolveMine, resolveFish, resolveSmelt, resolveSmith, smeltBatch, GEM_TABLE, EXTRA_AT_TOP } from '../src/game/skilling.js';
import { runSkillAction } from '../src/game/skillunlocks.js';
import { makeBatch } from '../src/game/autoprocess.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} }); g.npcs = [];
  for (const t of ['bronze_axe', 'bronze_pickaxe', 'small_net', 'hammer']) if (!g.inventory.has(t)) g.inventory.add(t, 1);
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
/** What the game says from now on, and every XP gain it gives. */
function watch(g) {
  const said = [], xp = [];
  const msg = g.msg.bind(g);
  g.msg = (t, c) => { said.push(t); return msg(t, c); };
  const addXp = g.skills.addXp.bind(g.skills);
  g.skills.addXp = (id, amt) => { xp.push([id, amt]); return addXp(id, amt); };
  return { said, xp };
}
/** Run `fn` with Math.random giving `r` every time; returns how many rolls it made. */
function withRandom(r, fn) {
  const seeded = Math.random;
  let calls = 0;
  Math.random = () => { calls++; return r; };
  try { fn(); } finally { Math.random = seeded; }
  return calls;
}
const gemCount = (g) => GEM_TABLE.reduce((t, x) => t + g.inventory.count(x.id), 0);

test('towardTop and pastSure: nothing up to the old stopping level, then a straight line to 1 at 9999', () => {
  assert.equal(towardTop(50, 99), 0);
  assert.equal(towardTop(99, 99), 0);
  assert.equal(towardTop(5049, 99), 0.5);
  assert.equal(towardTop(MAX_LEVEL, 99), 1);
  const double = (l) => 0.04 + l * 0.001;   // double logs and ore: certain from level 960
  assert.equal(pastSure(double, 500), 0);
  assert.equal(pastSure(double, 960), 0);
  assert.ok(pastSure(double, 961) > 0);
  assert.equal(pastSure(double, MAX_LEVEL), 1);
  for (const l of [1, 99, 5000, MAX_LEVEL]) assert.equal(pastSure((x) => 0.0001 * x, l), 0, 'a chance that never gets to 100% has nothing past it');
  // A sum that is exactly 1 can come out a hair over it in floating point (rank 2
  // Stewardship and an eternal axe at level 820): that is certain, not past it.
  const hair = (l) => 0.04 + l * 0.001 + 0.04 + 0.1;
  assert.ok(hair(820) > 1, `the sum is a hair over 1 (${hair(820)})`);
  assert.equal(pastSure(hair, 820), 0);
  assert.ok(pastSure(hair, 821) > 0);
  assert.equal(EXTRA_AT_TOP, 0.5, 'the chance of one more is at most a half');
});

test("green fingers: as it was up to the crop's level + 50, then on to 75% at 9999", () => {
  assert.equal(greenFingersChance(99, 95), 0.04, 'durian at 99');
  assert.equal(greenFingersChance(350, 300), GREEN_FINGERS_CAP, 'eternal lotus: 50% at its level + 50');
  assert.equal(greenFingersChance(MAX_LEVEL, 300), GREEN_FINGERS_TOP);
  const chilli = greenFingersChance(200, 1);
  assert.ok(chilli > 0.5 && chilli < 0.51, `chilli at 200 (${chilli})`);
  for (const [id, , level] of CROPS) {
    let prev = -1;
    for (let l = level; l <= MAX_LEVEL; l++) {
      const p = greenFingersChance(l, level);
      if (l <= level + 50) assert.equal(p, Math.min(0.5, (l - level) / 100), `${id} at ${l}, as before`);
      assert.ok(p >= prev && p <= GREEN_FINGERS_TOP, `${id} at ${l}`);
      prev = p;
    }
  }
});

test('woodcutting and mining: once a double is certain, a third can come, on top of the node and with no XP', () => {
  const g = newGame();
  const { said, xp } = watch(g);
  const tree = g.world.objects.find((o) => o.objId === 'tree' && !o.depleted);
  setLevel(g, 'woodcutting', MAX_LEVEL);
  tree.logsLeft = 15;
  const logs0 = g.inventory.count('logs');
  withRandom(0, () => resolveWoodcut(g, { obj: tree }));
  assert.equal(g.inventory.count('logs') - logs0, 3, 'three logs from one swing');
  assert.equal(tree.logsLeft, 13, "the swing's own log and the double come out of the tree's 10-20, the third does not");
  assert.deepEqual(xp, [['woodcutting', tree.def.xp]], 'XP for one log');
  assert.ok(said.some((t) => /triple logs/.test(t)), said.join(' | '));
  // No new roll until the double is certain (level 960), so seeded runs below it are unchanged.
  const chops = (lvl) => { setLevel(g, 'woodcutting', lvl); tree.logsLeft = 15; return withRandom(0.5, () => resolveWoodcut(g, { obj: tree })); };
  assert.equal(chops(960), chops(959));
  assert.equal(chops(961), chops(960) + 1, 'the roll for a third starts just past it');

  const rock = g.world.objects.find((o) => o.objId === 'copper_rock' && !o.depleted);
  setLevel(g, 'mining', MAX_LEVEL);
  rock.oresLeft = 15;
  xp.length = 0;
  const ore0 = g.inventory.count('copper_ore'), gems0 = gemCount(g);
  withRandom(0, () => resolveMine(g, { obj: rock }));
  assert.equal(g.inventory.count('copper_ore') - ore0, 3, 'three ores from one swing');
  assert.equal(rock.oresLeft, 13, 'the third ore does not come out of the rock');
  // A gem is certain too at 9999, so a second one comes with it: XP for the first only.
  assert.equal(gemCount(g) - gems0, 2, 'two gems');
  assert.deepEqual(xp, [['mining', rock.def.xp], ['mining', 40]], 'XP for one ore and one gem');
  assert.ok(said.some((t) => /A rich seam — triple copper ore!/.test(t)), said.join(' | '));
  assert.ok(said.some((t) => /^You unearth a sapphire, and another!$/.test(t)), said.join(' | '));
  const swings = (lvl) => { setLevel(g, 'mining', lvl); rock.oresLeft = 15; return withRandom(0.5, () => resolveMine(g, { obj: rock })); };
  assert.equal(swings(960), swings(959));
  assert.equal(swings(961), swings(960) + 1);
  // A gem is certain from level 1647 with a plain pickaxe: the roll for a second starts there.
  assert.equal(swings(1646), swings(1645));
  assert.equal(swings(1647), swings(1646) + 1);

  // With rank 2 Stewardship (+4%) and an eternal axe (+10%) the double is certain
  // from level 820, where the sum comes out a hair over 1 in floating point:
  // still no roll for a third there, only from 821.
  g.culling.steward = 400;
  g.inventory.add('eternal_axe', 1);
  assert.equal(chops(820), chops(819));
  assert.equal(chops(821), chops(820) + 1);
});

test('fishing: once a big catch is certain, a third fish can come, with no XP of its own', () => {
  const g = newGame();
  const { said, xp } = watch(g);
  const spot = g.world.objects.find((o) => o.objId === 'fishing_spot');
  const fish = spot.def.catches[0];
  // One cast with Math.random at 0.3 (past the trophy and oddity rolls, under
  // the third's 50%): the fish it lands, and how many rolls it made.
  const cast = (lvl) => {
    setLevel(g, 'fishing', lvl); xp.length = 0;
    const n0 = g.inventory.count(fish.id);
    const rolls = withRandom(0.3, () => resolveFish(g, { obj: spot }));
    return { fish: g.inventory.count(fish.id) - n0, rolls };
  };
  // No new roll until a big catch is certain (level 634), so seeded runs below it are unchanged.
  assert.equal(cast(633).rolls, cast(632).rolls);
  assert.equal(cast(634).rolls, cast(633).rolls + 1, 'the roll for a third starts there');
  assert.equal(cast(633).fish, 2, 'a big catch, and no third below it');
  assert.equal(cast(MAX_LEVEL).fish, 3, 'three fish from one cast at 9999');
  assert.deepEqual(xp, [['fishing', fish.xp * 2]], 'XP for two');
  assert.ok(said.some((t) => /^A huge catch! You haul in three /.test(t)), said.join(' | '));
});

test('smithing: once a hot crucible and flawless work are certain, a second extra can come', () => {
  const g = newGame();
  const { said } = watch(g);
  setLevel(g, 'smithing', MAX_LEVEL);
  g.inventory.clear();
  g.inventory.add('hammer', 1);
  const smelt = SMELT.find((r) => r.result === 'bronze_bar');
  for (const i of smelt.inputs) g.inventory.add(i.id, i.qty);
  withRandom(0, () => smeltBatch(g, { recipe: smelt }));
  assert.equal(g.inventory.count('bronze_bar'), 3, 'three bars from one lot of ore');
  assert.ok(said.some((t) => t.startsWith('You smelt 3 bronze bars (2 extra from a hot crucible)')), said.join(' | '));

  // "Smith all" with the bars for one dagger, as the anvil runs it (game.js).
  const r = SMITH.find((x) => x.result === 'bronze_dagger');
  g.inventory.remove('bronze_bar', 3);
  g.inventory.add(r.bar, r.barCount);
  const a = { type: 'smith', recipe: r };
  withRandom(0, () => makeBatch(g, a, (x) => runSkillAction(g, x, () => resolveSmith(g, x))));
  assert.equal(g.inventory.count('bronze_dagger'), 3, 'three daggers from one smith');
  assert.ok(said.some((t) => t.startsWith('You smith 3 bronze daggers (2 extra from flawless work)')), said.join(' | '));
  // One piece made on its own says so too.
  g.inventory.add(r.bar, r.barCount);
  withRandom(0, () => resolveSmith(g, { recipe: r }));
  assert.equal(g.inventory.count('bronze_dagger'), 6);
  assert.ok(said.includes('Flawless work — you forge two extra bronze daggers!'), said.join(' | '));

  // No new roll until the first extra is certain (level 970), so seeded runs below it are unchanged.
  const smelts = (lvl) => { setLevel(g, 'smithing', lvl); for (const i of smelt.inputs) g.inventory.add(i.id, i.qty); return withRandom(0.5, () => resolveSmelt(g, { recipe: smelt })); };
  const smiths = (lvl) => { setLevel(g, 'smithing', lvl); g.inventory.add(r.bar, r.barCount); return withRandom(0.5, () => resolveSmith(g, { recipe: r, tally: { bonus: 0 } })); };
  assert.equal(smelts(970), smelts(969));
  assert.equal(smelts(971), smelts(970) + 1, 'a hot crucible: the roll for a second extra starts just past it');
  assert.equal(smiths(970), smiths(969));
  assert.equal(smiths(971), smiths(970) + 1, 'flawless work: the same');
});
