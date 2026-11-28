// Endgame Woodcutting, Firemaking and Fletching (levels 100-300): the six new
// tree groves and their logs, the ashes those logs leave when burnt, and the
// fletching recipes for the obsidian to eternal bows, staves, wands, rifles,
// crossbows and arrows that used to come only from monster drops.
import { seedRandom } from './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { FLETCH } from '../src/data/trades.js';
import { xpForLevel } from '../src/data/xp.js';
import { chebyshev } from '../src/core/utils.js';
import { findPath } from '../src/engine/pathfinding.js';
import { guideEntries } from '../src/game/skillguide.js';
import { materialKind } from '../src/game/materials.js';
import { itemIconSVG } from '../src/render/icons.js';
import { actionClipId, actionPropId } from '../src/render/heroanim.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];   // nothing to interrupt the work
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
const step = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };
const night = (g) => { g.playMs = 0; };   // midnight
const noon = (g) => { g.playMs = 0.5 * 10 * 60 * 1000; };   // high noon
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
// Stand the player on a free tile next to an object.
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
function listen(g) {
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (m, c) => { said.push(m); return msg(m, c); };
  return said;
}

// Tier, tree, its logs, the ash they leave, the metal of the gear they make, and the region.
const TIERS = [
  { lvl: 100, tree: 'seraya_tree', log: 'seraya_logs', ash: 'fine_ash', metal: 'obsidian', zone: 'Bukit Timah' },
  { lvl: 130, tree: 'meranti_tree', log: 'meranti_logs', ash: 'fine_ash', metal: 'orichalcum', zone: 'Mandai Rainforest' },
  { lvl: 160, tree: 'chengal_tree', log: 'chengal_logs', ash: 'ember_ash', metal: 'jade', zone: 'MacRitchie Reservoir' },
  { lvl: 200, tree: 'starfall_banyan', log: 'starwood_logs', ash: 'star_ash', metal: 'starmetal', zone: 'The Celestial Peaks' },
  { lvl: 250, tree: 'moonlit_kapok', log: 'moonwood_logs', ash: 'ghost_ash', metal: 'celestial', zone: 'Pulau Hantu' },
  { lvl: 300, tree: 'keramat_tree', log: 'eternal_heartwood', ash: 'eternal_ash', metal: 'eternal', zone: 'The Shadow Rift' },
];
// The existing gear each tier's logs fletch (the older tiers lack some kinds).
const PIECES = {
  obsidian: ['wand', 'staff', 'crossbow', 'longbow', 'rifle'],
  orichalcum: ['wand', 'crossbow', 'longbow', 'rifle'],
  jade: ['wand', 'staff', 'bow', 'crossbow', 'longbow', 'rifle', 'arrow'],
  starmetal: ['wand', 'staff', 'bow', 'crossbow', 'longbow', 'rifle', 'arrow'],
  celestial: ['wand', 'staff', 'bow', 'crossbow', 'longbow', 'rifle'],
  eternal: ['wand', 'staff', 'bow', 'crossbow', 'longbow', 'rifle', 'arrow'],
};

test('endgame trees: a grove of each in its region, every tree reachable', () => {
  const g = newGame();
  const cfg = g.pathCfg();
  for (const t of TIERS) {
    const def = OBJECTS[t.tree];
    assert.equal(def.type, 'tree'); assert.equal(def.level, t.lvl); assert.equal(def.gives, t.log);
    assert.ok(ITEMS[t.log]?.tags.includes('log') && ITEMS[t.ash], `${t.log} and ${t.ash} exist`);
    // (Its vein: the groves of groves.js, placed after, are tests/groves.test.mjs's.)
    const inGrove = (o) => g.world.groves.some((gr) => o.x >= gr.x0 && o.x <= gr.x1 && o.y >= gr.y0 && o.y <= gr.y1);
    const trees = g.world.objects.filter((o) => o.objId === t.tree && !inGrove(o));
    assert.ok(trees.length >= 6, `${t.tree}: ${trees.length} placed`);
    const zone = g.world.zones.find((z) => z.name === t.zone);
    for (const r of trees) assert.ok(r.x >= zone.x0 && r.x <= zone.x1 && r.y >= zone.y0 && r.y <= zone.y1, `${t.tree} at ${r.x},${r.y} is in ${t.zone}`);
    assert.ok(trees.every((r) => chebyshev(r.x, r.y, trees[0].x, trees[0].y) <= 8), `${t.tree} trees are in one grove`);
    // Every tree can be walked up to from the region's nearest MRT station.
    const mrt = g.world.objects.filter((o) => o.objId === 'mrt_station')
      .reduce((a, b) => (chebyshev(b.x, b.y, trees[0].x, trees[0].y) < chebyshev(a.x, a.y, trees[0].x, trees[0].y) ? b : a));
    const from = [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 2]].map(([dx, dy]) => ({ x: mrt.x + dx, y: mrt.y + dy })).find((p) => !g.world.isBlocked(p.x, p.y));
    for (const r of trees) {
      assert.ok(chebyshev(r.x, r.y, mrt.x, mrt.y) >= 8, `${t.tree} at ${r.x},${r.y} leaves the station clear`);
      assert.ok(findPath(cfg, from, { x: r.x, y: r.y }, { reachAdjacent: true }).length > 0, `${t.tree} at ${r.x},${r.y} is reachable`);
    }
  }
});

test('endgame trees: chopped at their level for their logs (with the axe clip), refused below it', () => {
  const g = newGame();
  if (!g.inventory.has('bronze_axe')) g.inventory.add('bronze_axe', 1);
  const said = listen(g);
  for (const t of TIERS) {
    const tree = g.world.objects.find((o) => o.objId === t.tree);
    standBy(g, tree); night(g);
    setLevel(g, 'woodcutting', t.lvl - 1);
    g.defaultObjectAction(tree);
    step(g, 6);
    assert.equal(g.inventory.count(t.log), 0, `no ${t.log} below Woodcutting ${t.lvl}`);
    assert.ok(said.some((m) => m.includes(`Woodcutting level of ${t.lvl}`)), 'told the level it needs');
    setLevel(g, 'woodcutting', t.lvl);
    const xp0 = g.skills.xp.woodcutting;
    night(g);
    g.defaultObjectAction(tree);
    // The hero swings the usual chopping clip with an axe in hand.
    assert.equal(actionClipId(g.player.action), 'woodcut');
    assert.equal(ITEMS[actionPropId(g, g.player.action)]?.tool, 'axe');
    step(g, 8);
    assert.ok(g.inventory.count(t.log) >= 1, `chopped ${t.log}`);
    assert.ok(g.skills.xp.woodcutting > xp0, 'and earned Woodcutting XP');
    g.player.clearAction();
    g.inventory.remove(t.log, g.inventory.count(t.log));
  }
});

test('the moonlit kapok chops any time, with bonus XP at night', () => {
  const g = newGame();
  if (!g.inventory.has('bronze_axe')) g.inventory.add('bronze_axe', 1);
  setLevel(g, 'woodcutting', 250);
  const tree = g.world.objects.find((o) => o.objId === 'moonlit_kapok');
  standBy(g, tree);
  g.playMs = 0.5 * 10 * 60 * 1000;   // high noon
  assert.ok(!g.isNight());
  assert.equal(g._nextGatherNode('moonlit_kapok')?.objId, 'moonlit_kapok', 'auto gather counts it by day too');
  const xp0 = g.skills.xp.woodcutting;
  g.defaultObjectAction(tree);
  for (let i = 0; i < 40 && g.inventory.count('moonwood_logs') < 1; i++) step(g, 1);
  assert.ok(g.inventory.count('moonwood_logs') >= 1, 'chops fine by day');
  const day = g.skills.xp.woodcutting - xp0;
  tree.depleted = false; g.player.clearAction();
  night(g);
  const xp1 = g.skills.xp.woodcutting, logs = g.inventory.count('moonwood_logs');
  g.defaultObjectAction(tree);
  for (let i = 0; i < 40 && g.inventory.count('moonwood_logs') <= logs; i++) step(g, 1);
  const nightXp = g.skills.xp.woodcutting - xp1;
  assert.ok(nightXp > day * 1.2, `more XP at night (${nightXp} vs ${day})`);
});

test('burning endgame logs: the Firemaking level, XP, and the right ash, which the shrine takes', () => {
  const g = newGame();
  if (!g.inventory.has('tinderbox')) g.inventory.add('tinderbox', 1);
  const said = listen(g);
  let prevXp = ITEMS.magic_logs.fmXp;
  const start = { x: g.player.x, y: g.player.y };
  let i = 0;
  // A fresh free tile for each fire, in a row away from the start.
  const freeTile = () => {
    for (; i < 200; i++) {
      const x = start.x + (i % 10) - 5, y = start.y + Math.floor(i / 10) - 2;
      if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { i++; return { x, y }; }
    }
    throw new Error('no free tile');
  };
  for (const t of TIERS) {
    const log = ITEMS[t.log];
    assert.equal(log.firemaking, t.lvl); assert.equal(log.ash, t.ash);
    assert.ok(log.fmXp >= prevXp * 1.35, `${t.log} burns for ${log.fmXp} xp vs ${prevXp} before`);
    prevXp = log.fmXp;
    g.inventory.add(t.log, 1);
    let p = freeTile(); g.player.x = g.player.tx = p.x; g.player.y = g.player.ty = p.y;
    setLevel(g, 'firemaking', t.lvl - 1);
    g.lightLogs(g.inventory.slots.findIndex((s) => s?.id === t.log)); step(g, 3);
    assert.equal(g.inventory.count(t.log), 1, `can't burn ${t.log} below Firemaking ${t.lvl}`);
    assert.ok(said.some((m) => m.includes(`Firemaking level of ${t.lvl}`)));
    p = freeTile(); g.player.x = g.player.tx = p.x; g.player.y = g.player.ty = p.y;
    setLevel(g, 'firemaking', t.lvl);
    const xp0 = g.skills.xp.firemaking, ash0 = g.inventory.count(t.ash);
    g.lightLogs(g.inventory.slots.findIndex((s) => s?.id === t.log)); step(g, 3);
    assert.equal(g.inventory.count(t.log), 0, `burnt ${t.log}`);
    assert.ok(g.skills.xp.firemaking > xp0, 'for Firemaking XP');
    assert.equal(g.inventory.count(t.ash), ash0 + 1, `leaving ${t.ash}`);
    assert.equal(materialKind(t.ash), 'ash');
  }
  // Ashes are shrine materials.
  const don = g.shrineDonatables().map((d) => d.id);
  for (const a of ['fine_ash', 'ember_ash', 'star_ash', 'ghost_ash', 'eternal_ash']) assert.ok(don.includes(a), `${a} can go to the shrine`);
  // Old logs leave no ash.
  assert.equal(ITEMS.magic_logs.ash, undefined);
});

test('endgame fletching: every bow, staff, wand, rifle, crossbow and arrow of each tier, at its level', () => {
  let prevBest = FLETCH.find((r) => r.result === 'magic_longbow').xp;
  const g = newGame();
  if (!g.inventory.has('knife')) g.inventory.add('knife', 1);
  const bench = g.world.objects.find((o) => o.def.type === 'fletch');
  standBy(g, bench);
  const said = listen(g);
  for (const t of TIERS) {
    const recs = FLETCH.filter((r) => r.inputs.some(([id]) => id === t.log) || r.result === `${t.metal}_arrow`);
    for (const p of PIECES[t.metal]) {
      const r = recs.find((x) => x.result === `${t.metal}_${p}`);
      assert.ok(r, `${t.metal}_${p} can be fletched`);
      assert.equal(FLETCH.filter((x) => x.result === r.result).length, 1, `${r.result} has one recipe`);
      assert.ok(r.level >= t.lvl && r.level < t.lvl + 20, `${r.result} at Fletching ${r.level}`);
      if (p === 'arrow') assert.deepEqual(r.inputs.map(([id]) => id), ['arrow_shaft', 'feather', `${t.metal}_bar`]);
      else assert.equal(r.inputs[0][0], t.log);
      if (['rifle', 'crossbow'].includes(p)) assert.ok(r.inputs.some(([id]) => id === `${t.metal}_bar`), `${r.result} takes a ${t.metal} bar`);
    }
    const shafts = recs.find((r) => r.result === 'arrow_shaft');
    assert.ok(shafts && shafts.level === t.lvl && shafts.qty > 30, `${t.log} cuts into arrow shafts`);
    for (const r of recs) {
      assert.ok(ITEMS[r.result], `${r.result} is a real item`);
      // Rods and snares (tooltiers.js) are gathering tools, not gear.
      if (r.result !== 'arrow_shaft' && !ITEMS[r.result].tool) assert.ok(ITEMS[r.result].equip || ITEMS[r.result].tags?.includes('ammo'), `${r.result} is real gear or ammo`);
      assert.ok(!r.result.startsWith('sig_'), 'signature weapons stay drop-only');
      // Below the level: refused. At it: made, inputs used up.
      for (const [id, n] of r.inputs) g.inventory.add(id, n);
      setLevel(g, 'fletching', r.level - 1);
      g.startRecipe('fletching', r, bench); step(g, 2);
      assert.equal(g.inventory.count(r.result), 0, `no ${r.result} below Fletching ${r.level}`);
      assert.ok(said.some((m) => m.includes(`Fletching level of ${r.level}`)));
      setLevel(g, 'fletching', r.level);
      g.startRecipe('fletching', r, bench); step(g, 1);
      assert.equal(actionClipId({ type: 'recipe', skill: 'fletching', recipe: r }), r.tool === 'knife' ? 'fletch' : 'craft');
      step(g, 2);
      assert.equal(g.inventory.count(r.result), r.qty, `fletched ${r.result}`);
      for (const [id] of r.inputs) assert.equal(g.inventory.count(id), 0, `using up the ${id}`);
      g.inventory.remove(r.result, r.qty);
    }
    // A batch is instant now (makeBatch), so XP an hour is set by how fast you
    // gather the inputs; per make, each tier's best still pays ~35% more.
    const best = Math.max(...recs.map((r) => r.xp));
    assert.ok(best >= prevBest * 1.35, `${t.metal}: best make ${best} xp vs ${prevBest} before`);
    prevBest = best;
  }
  // The guides list the new trees, logs and recipes.
  for (const t of TIERS) {
    assert.ok(guideEntries('woodcutting').some((e) => e.objIds?.includes(t.tree) && e.level === t.lvl), `${t.tree} in the Woodcutting guide`);
    assert.ok(guideEntries('firemaking').some((e) => e.label === ITEMS[t.log].name && e.detail.includes(ITEMS[t.ash].name)), `${t.log} in the Firemaking guide`);
  }
  assert.ok(guideEntries('fletching').some((e) => e.label === ITEMS.eternal_rifle.name && e.level === 312));
});

test('fletched endgame gear comes out plain (no quality roll, no mastery head start)', () => {
  const g = newGame();
  if (!g.inventory.has('knife')) g.inventory.add('knife', 1);
  const bench = g.world.objects.find((o) => o.def.type === 'fletch');
  standBy(g, bench);
  const said = listen(g);
  const r = FLETCH.find((x) => x.result === 'eternal_longbow');
  for (const [id, n] of r.inputs) g.inventory.add(id, n * 3);
  setLevel(g, 'fletching', r.level);
  g.startRecipe('fletching', r, bench); step(g, 5);
  assert.equal(g.inventory.count('eternal_longbow'), 3, 'three longbows from nine heartwood');
  assert.equal(g.equipment.masteryRank('eternal_longbow'), 0, 'mastery stays where it was');
  assert.ok(!said.some((m) => /^(Fine|Superior|Epic|Legendary|Mythic) /.test(m)), 'no quality message');
});

test('endgame logs, ashes and trees have their own art', async () => {
  const { worldArt } = await import('../src/render/sprites.js');
  for (const t of TIERS) {
    for (const id of [t.log, t.ash]) assert.ok(itemIconSVG(id, 24).includes(`assets/icons/item-${id}.webp`), `${id} has its own art`);
    assert.ok(worldArt().has(`tree-${t.tree}`) && worldArt().has(`stump-${t.tree}`) && !OBJECTS[t.tree].borrow, `${t.tree} has its own tree and stump`);
  }
});

test('endgame Woodcutting XP an hour: each tier well ahead of the best before it, at the same level', () => {
  // A short auto-gather run at each grove with XP pinned, against the tier
  // before at the same level, so the past-99 XP bonus counts the same for both.
  // (Measured over longer runs each step is ~1.35x; the bar leaves room for the dice.)
  const TICKS = 500;
  const rate = (treeId, lvl) => {
    const g = newGame();
    if (!g.inventory.has('bronze_axe')) g.inventory.add('bronze_axe', 1);
    setLevel(g, 'woodcutting', lvl);
    noon(g);   // base rates: the moonlit kapok's night bonus is on top of these
    // At each tier's vein, as the xp was set there: the groves (groves.js) hold
    // twice the trees, which nudges some tiers more than others by a few percent.
    const inGrove = (o) => g.world.groves.some((gr) => o.x >= gr.x0 && o.x <= gr.x1 && o.y >= gr.y0 && o.y <= gr.y1);
    const all = g.world.objects.filter((o) => o.objId === treeId && !inGrove(o));
    const near = (o) => all.filter((p) => chebyshev(p.x, p.y, o.x, o.y) <= 15).length;
    const start = all.reduce((a, b) => (near(b) > near(a) ? b : a));
    standBy(g, start);
    // Each run starts from the same rolls, however many spawns the world took
    // making (more monsters in the world must not tip a close comparison).
    seedRandom();
    g.toggleAutoGather(true);
    g.defaultObjectAction(start);
    const base = g.skills.xp.woodcutting;
    let gain = 0;
    for (let i = 0; i < TICKS; i++) {
      g.update(600);
      noon(g);
      gain += g.skills.xp.woodcutting - base; g.skills.xp.woodcutting = base;
      // An endless bag: drop what was chopped so the run never stops for space.
      for (const id of ['magic_logs', ...TIERS.map((t) => t.log), 'birds_nest']) g.inventory.remove(id, g.inventory.count(id));
    }
    return gain * 6000 / TICKS;
  };
  let prevTree = 'magic_tree';
  for (const t of TIERS) {
    const before = rate(prevTree, t.lvl), now = rate(t.tree, t.lvl);
    assert.ok(now >= before * 1.28, `${t.tree}: ${Math.round(now)} xp/h vs ${prevTree} ${Math.round(before)} at level ${t.lvl}`);
    prevTree = t.tree;
  }
});
