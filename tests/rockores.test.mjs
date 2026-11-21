// Each mining rock holds a random 10-20 ores before it is mined out (the
// owner's call), rolled afresh each time it regrows; each tree, likewise,
// 10-20 logs before it falls.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { resolveMine, rollRockOres, ROCK_ORES_MIN, ROCK_ORES_MAX, resolveWoodcut, rollTreeLogs, TREE_LOGS_MIN, TREE_LOGS_MAX } from '../src/game/skilling.js';
import { getObject } from '../src/data/objects.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle?.('melee');
  return g;
}

test('rollRockOres stays within 10-20 and covers both ends', () => {
  assert.equal(ROCK_ORES_MIN, 10); assert.equal(ROCK_ORES_MAX, 20);
  assert.equal(rollRockOres(() => 0), 10);
  assert.equal(rollRockOres(() => 0.9999), 20);
  for (let i = 0; i < 500; i++) { const n = rollRockOres(); assert.ok(n >= 10 && n <= 20 && Number.isInteger(n)); }
});

test('a rock gives 10-20 ores, then is mined out and rolls afresh when it regrows', () => {
  const g = newGame();
  const p = g.player;
  g.hasTool = () => true;
  g.inventory.canAdd = () => 99;   // never run out of room mid-test
  const obj = g.world.objects.find((o) => o.def === getObject('copper_rock') || o.objId === 'copper_rock');
  assert.ok(obj, 'there is a copper rock');
  g.world.objectAt = (x, y) => (x === obj.x && y === obj.y ? obj : null);
  for (let round = 0; round < 3; round++) {
    obj.depleted = false; obj.oresLeft = undefined;
    const before = g.inventory.count('copper_ore');
    let swings = 0;
    while (resolveMine(g, { obj })) { swings++; assert.ok(swings < 30, 'rock never ran dry'); }
    const ores = g.inventory.count('copper_ore') - before;   // rich seams included
    assert.ok(ores >= 10 && ores <= 20, `the rock gave ${ores} ores`);
    assert.equal(obj.depleted, true);
    assert.equal(obj.oresLeft, undefined, 'a fresh amount is rolled next time');
    assert.equal(resolveMine(g, { obj }), false, 'a mined-out rock gives nothing');
  }
  void p;
});

test('rollTreeLogs stays within 10-20 and covers both ends', () => {
  assert.equal(TREE_LOGS_MIN, 10); assert.equal(TREE_LOGS_MAX, 20);
  assert.equal(rollTreeLogs(() => 0), 10);
  assert.equal(rollTreeLogs(() => 0.9999), 20);
  for (let i = 0; i < 500; i++) { const n = rollTreeLogs(); assert.ok(n >= 10 && n <= 20 && Number.isInteger(n)); }
});

test('a tree gives 10-20 logs, then falls, and rolls afresh when it regrows', () => {
  const g = newGame();
  g.hasTool = () => true;
  g.inventory.canAdd = () => 99;   // never run out of room mid-test
  g.skills.xp.woodcutting = 1e7;   // high level: double logs come often, and must still come out of the 10-20
  for (const id of ['tree', 'willow', 'magic_tree']) {
    const obj = g.world.objects.find((o) => o.objId === id);
    assert.ok(obj, `there is a ${id}`);
    g.world.objectAt = (x, y) => (x === obj.x && y === obj.y ? obj : null);
    const logId = getObject(id).gives;
    const counts = new Set();
    for (let round = 0; round < 6; round++) {
      // (Regrowth: the world's respawn timer clears depleted; logsLeft was already cleared at the fall.)
      obj.depleted = false;
      assert.equal(obj.logsLeft, undefined, 'no stock left over from the last tree');
      const before = g.inventory.count(logId);
      let chops = 0;
      while (resolveWoodcut(g, { obj })) { chops++; assert.ok(chops < 30, 'the tree never fell'); }
      const logs = g.inventory.count(logId) - before;   // double logs included
      assert.ok(logs >= 10 && logs <= 20, `${id} gave ${logs} logs`);
      counts.add(logs);
      assert.equal(obj.depleted, true, 'it fell');
      assert.equal(obj.logsLeft, undefined, 'a fresh amount is rolled next time');
      assert.equal(resolveWoodcut(g, { obj }), false, 'a stump gives nothing');
    }
    assert.ok(counts.size > 1, `${id}: the stock is rolled afresh, not fixed (${[...counts]})`);
  }
});

test('a tree regrows through the world respawn and starts a new stock', () => {
  const g = newGame();
  g.hasTool = () => true;
  g.inventory.canAdd = () => 99;
  const obj = g.world.objects.find((o) => o.objId === 'oak');
  g.skills.xp.woodcutting = 1e5;
  const objectAt = g.world.objectAt.bind(g.world);
  while (resolveWoodcut(g, { obj }));
  assert.equal(obj.depleted, true);
  g.player.x = g.player.tx = obj.x + 3; g.player.y = g.player.ty = obj.y;   // nearby, so the world ticks it
  for (let i = 0; i < getObject('oak').respawn + 3 && obj.depleted; i++) g.update(600);
  assert.equal(obj.depleted, false, 'the oak grew back');
  assert.equal(objectAt(obj.x, obj.y), obj);
  assert.ok(resolveWoodcut(g, { obj }), 'and can be chopped again');
  assert.ok(obj.logsLeft >= 9 && obj.logsLeft <= 19, `with a fresh stock (${obj.logsLeft} left after one chop)`);
});

test('a tree that never falls (an event\'s ancient tree) keeps no stock', () => {
  const g = newGame();
  g.hasTool = () => true;
  g.inventory.canAdd = () => 99;
  const base = g.world.objects.find((o) => o.objId === 'willow');
  const obj = { ...base, def: { ...base.def, depleteChance: 0 } };
  g.world.objectAt = () => obj;
  g.skills.xp.woodcutting = 1e5;
  for (let i = 0; i < 60; i++) assert.ok(resolveWoodcut(g, { obj }), 'keeps giving logs');
  assert.ok(!obj.depleted, 'never fell');
  assert.equal(obj.logsLeft, undefined);
});
