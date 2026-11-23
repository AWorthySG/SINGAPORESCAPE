// How many to make at a station (the owner's ask: a recipe always used every
// material in the pack). The station windows' "1 · 5 · 10 · X · All" sets
// game.makeQty for the session; a make stops after that many, "All" and
// "Do all" still make everything, and an amount past what the pack holds
// makes what it can.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { COOKING, makeXp } from '../src/game/skilling.js';
import { DISHES } from '../src/data/cooking.js';
import { SMELT, SMITH } from '../src/data/smithing.js';
import { CRAFT } from '../src/data/crafting.js';
import { tradeRecipes, makeCap } from '../src/game/autoprocess.js';
import { maxMakes, makeLabel, makeQtyOf } from '../src/ui/makeqty.js';

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
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
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
const station = (g, type) => g.world.objects.find((o) => o.def?.type === type);
function xpEach(g, skill, amount) {
  const xp0 = g.skills.xp[skill];
  g.skills.addXp(skill, makeXp(g, skill, amount));
  const got = g.skills.xp[skill] - xp0;
  g.skills.xp[skill] = xp0;
  return got;
}
const oneTick = (g) => g.update(600);

// One kind of station each: how to set it up with `lots` makes' worth of
// inputs, start it, and what one make uses, gives and pays. Level 99 so no
// level-up part-way changes the XP each (or the making multiple).
const KINDS = {
  cook: (g) => {
    const raw = 'raw_sardine', c = COOKING[raw];
    return { skill: 'cooking', type: 'range', result: c.result, ins: [[raw, 1]], out: 1, xp: c.xp, perfect: Math.round(c.xp * 1.5),
      start: (obj, n) => g.startCooking(obj, raw, n) };
  },
  dish: (g) => {
    const d = DISHES.find((x) => x.level <= 20) || DISHES[0];
    return { skill: 'cooking', type: 'range', result: d.result, ins: d.inputs.map((i) => [i.id, i.qty]), out: 1, xp: d.xp,
      start: (obj, n) => g.startDish(obj, d, n) };
  },
  smelt: (g) => {
    const r = SMELT.find((x) => x.result === 'bronze_bar');
    return { skill: 'smithing', type: 'furnace', result: r.result, ins: r.inputs.map((i) => [i.id, i.qty]), out: 1, xp: r.xp, extras: true,
      start: (obj, n) => g.startSmelt(r, obj, n) };
  },
  smith: (g) => {
    if (!g.hasTool('hammer')) g.inventory.add('hammer', 1);
    const r = SMITH.find((x) => x.result === 'bronze_dagger') || SMITH.find((x) => x.level === 1 && !x.upgrade);
    return { skill: 'smithing', type: 'anvil', result: r.result, ins: [[r.bar, r.barCount]], out: r.qty || 1, xp: r.xp, extras: true,
      start: (obj, n) => g.startSmith(r, obj, n) };
  },
  craft: (g) => {
    const r = CRAFT.find((x) => !x.upgrade && x.level <= 10 && (!x.tool || g.hasTool(x.tool)));
    return { skill: 'crafting', type: 'craft', result: r.result, ins: r.inputs.map((i) => [i.id, i.qty]), out: r.qty || 1, xp: r.xp,
      start: (obj, n) => g.startCraft(r, obj, n) };
  },
  fletching: (g) => {
    const r = tradeRecipes('fletching').find((x) => !x.upgrade && x.level <= 5);
    if (r.tool && !g.hasTool(r.tool)) g.inventory.add(r.tool, 1);
    return { skill: 'fletching', type: 'fletch', result: r.result, ins: r.inputs, out: r.qty || 1, xp: r.xp,
      start: (obj, n) => g.startRecipe('fletching', r, obj, n) };
  },
  herblore: (g) => {
    const r = tradeRecipes('herblore').find((x) => !x.upgrade && x.level <= 5);
    return { skill: 'herblore', type: 'herblore', result: r.result, ins: r.inputs, out: r.qty || 1, xp: r.xp,
      start: (obj, n) => g.startRecipe('herblore', r, obj, n) };
  },
};

/** Make `ask` (a number, or undefined to use game.makeQty) with `lots` makes'
 *  worth in the pack; returns what was used, made and paid. */
function run(kind, lots, ask, qty) {
  const g = newGame();
  const k = KINDS[kind](g);
  const obj = station(g, k.type);
  assert.ok(obj, `a ${k.type} in the world`);
  standBy(g, obj);
  setLevel(g, k.skill, 99);
  if (qty !== undefined) g.makeQty = qty;
  const said = listen(g);
  for (const [id, n] of k.ins) g.inventory.add(id, n * lots);
  const per = xpEach(g, k.skill, k.xp), perfect = k.perfect ? xpEach(g, k.skill, k.perfect) : per;
  const xp0 = g.skills.xp[k.skill], had = g.inventory.count(k.result);
  const before = Object.fromEntries(k.ins.map(([id]) => [id, g.inventory.count(id)]));
  k.start(obj, ask);
  oneTick(g);
  const used = Object.fromEntries(k.ins.map(([id]) => [id, before[id] - g.inventory.count(id)]));
  return { g, k, per, perfect, said, used, made: g.inventory.count(k.result) - had, xp: g.skills.xp[k.skill] - xp0 };
}

/** Exactly `n` makes: n lots of inputs gone, n outputs (plus any free extras
 *  a hot crucible or flawless work adds), n makes' XP, one chat line saying so. */
function assertMade(r, n, label) {
  const { k } = r;
  for (const [id, q] of k.ins) assert.equal(r.used[id], q * n, `${label}: ${q * n} ${id} used`);
  if (k.extras) assert.ok(r.made >= n * k.out && r.made <= n * k.out * 3, `${label}: ${r.made} made from ${n} (extras are free)`);
  else assert.equal(r.made, n * k.out, `${label}: ${n * k.out} made`);
  assert.ok(r.xp >= n * r.per - 1e-6 && r.xp <= n * r.perfect + 1e-6, `${label}: ${r.xp} XP for ${n} makes (${r.per} each)`);
  const line = r.said.find((m) => /^You \w+ \d+ /.test(m));
  assert.ok(line, `${label}: a summary line (${r.said.join(' | ')})`);
  assert.equal(Number(line.match(/^You \w+ (\d+) /)[1]), r.made, `${label}: the line counts what was made: ${line}`);
  assert.equal(r.g.player.action, null, `${label}: the station is done`);
}

for (const kind of Object.keys(KINDS)) {
  test(`${kind}: making 1, 5 and X (7) of a recipe uses exactly that many lots`, () => {
    for (const n of [1, 5, 7]) assertMade(run(kind, 20, n), n, `${kind} x${n}`);
  });
  test(`${kind}: the remembered amount (game.makeQty) is used when none is passed, and All is unchanged`, () => {
    assertMade(run(kind, 20, undefined, 5), 5, `${kind} remembered 5`);
    assertMade(run(kind, 12, undefined, Infinity), 12, `${kind} All`);
    assertMade(run(kind, 12, undefined, undefined), 12, `${kind} untouched (All)`);
  });
  test(`${kind}: an amount past what the pack holds makes what it can`, () => {
    assertMade(run(kind, 6, 50), 6, `${kind} 50 of 6`);
  });
}

test('smelting 1 bar uses one lot of ore and says so', () => {
  const r = run('smelt', 10, 1);
  assertMade(r, 1, 'smelt 1');
  assert.ok(r.said.some((m) => /^You smelt [12] bronze bars?/.test(m)), r.said.join(' | '));
});

test('"Do all" ignores the amount: it still makes everything at the station', () => {
  const g = newGame();
  const range = station(g, 'range');
  standBy(g, range);
  setLevel(g, 'cooking', 99);
  g.makeQty = 1;
  g.inventory.add('raw_anchovy', 30); g.inventory.add('raw_sardine', 8);
  assert.ok(g.startAll('cook', range));
  oneTick(g);
  assert.equal(g.inventory.count('raw_anchovy') + g.inventory.count('raw_sardine'), 0, 'every fish cooked');
  assert.equal(g.inventory.count('anchovy'), 30);

  const g2 = newGame();
  const furnace = station(g2, 'furnace');
  standBy(g2, furnace);
  setLevel(g2, 'smithing', 99);
  g2.makeQty = 1;
  const bronze = SMELT.find((x) => x.result === 'bronze_bar');
  for (const i of bronze.inputs) g2.inventory.add(i.id, i.qty * 9);
  assert.ok(g2.startAll('smelt', furnace));
  oneTick(g2);
  for (const i of bronze.inputs) assert.equal(g2.inventory.count(i.id), 0, `"Smelt all": all the ${i.id} smelted`);
});

test('the window helpers: how many you can make, and the button label', () => {
  const g = newGame();
  const smith = SMITH.find((x) => x.result === 'bronze_dagger');
  g.inventory.add(smith.bar, smith.barCount * 37);
  const max = maxMakes(g, 'smith', smith);
  assert.equal(max, 37);
  assert.equal(makeQtyOf(g), Infinity, 'All until you choose');
  assert.equal(makeLabel(g, max), 'Make all (37)');
  g.makeQty = 5;
  assert.equal(makeLabel(g, max), 'Make 5');
  assert.equal(makeLabel(g, 3), 'Make all (3)', 'fewer than the amount: all of them');
  assert.equal(makeLabel(g, 0), 'None');
  g.inventory.add('raw_sardine', 4);
  assert.equal(maxMakes(g, 'cook', 'raw_sardine'), 4);
  const fl = tradeRecipes('fletching').find((x) => !x.upgrade && x.level <= 5);
  for (const [id, n] of fl.inputs) g.inventory.add(id, n * 3);
  assert.equal(maxMakes(g, 'recipe', fl), 3);
  assert.equal(makeCap({}), 100000, 'no limit: all (with the runaway guard)');
  assert.equal(makeCap({ limit: 5 }), 5);
});
