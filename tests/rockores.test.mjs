// Each mining rock holds a random 10-20 ores before it is mined out (the
// owner's call), rolled afresh each time it regrows.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { resolveMine, rollRockOres, ROCK_ORES_MIN, ROCK_ORES_MAX } from '../src/game/skilling.js';
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
