// Archers' and Rangers' bows take a quiver in the off-hand (but still no shield).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave, saveGame } from '../src/game/save.js';
import { getItem } from '../src/data/items.js';
import { offhandBlocked, takesQuiver } from '../src/game/equipment.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function game(cls) {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}

test('a shortbow or longbow takes a quiver, but not a shield; other two-handers take neither', () => {
  assert.ok(takesQuiver('shortbow') && takesQuiver('longbow'));
  assert.ok(!offhandBlocked('shortbow', 'iron_quiver'));
  assert.ok(offhandBlocked('shortbow', 'bronze_kiteshield'), 'still no shield');
  assert.ok(offhandBlocked('bronze_halberd', 'iron_quiver'), 'a halberd takes no quiver');
  // The bow's grip no longer counts a quiver's share (the quiver gives it now).
  const g = getItem('shortbow').equip.grip;
  assert.ok(g.defence > 0 && g.atkPct === undefined && g.haste === undefined);
});

for (const cls of ['archer', 'ranger']) {
  test(`${cls}: starts with a quiver, can swap quivers, and equip best fills the off-hand`, () => {
    const g = game(cls);
    assert.ok(/_quiver$/.test(g.equipment.get('shield') || ''), 'starts with a quiver in the off-hand');
    g.inventory.add('iron_quiver', 1);
    g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'iron_quiver'));
    assert.equal(g.equipment.get('shield'), 'iron_quiver', 'a quiver goes on with the bow');
    g.inventory.add('bronze_kiteshield', 1);
    g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'bronze_kiteshield'));
    assert.equal(g.equipment.get('shield'), 'iron_quiver', 'a shield does not');
    // Equip best: an empty off-hand gets the quiver from the pack.
    const off = g.equipment.clearSlot('shield'); g.inventory.add(off, 1);
    g.equipBest();
    assert.ok(/_quiver$/.test(g.equipment.get('shield') || ''), 'equip best puts a quiver on');
  });
}

test('an Archer from before quivers is handed one of the bow\'s tier, once', () => {
  const g = game('archer');
  g.equipment.clearSlot('shield');
  g.inventory.slots = g.inventory.slots.map((s) => (s && /_quiver$/.test(s.id) ? null : s));
  g.bowQuiverGiven = false;
  saveGame(g);
  const again = new Game(); again.start();
  assert.ok(/_quiver$/.test(again.equipment.get('shield') || ''), 'a quiver is slung on at load');
  assert.equal(again.bowQuiverGiven, true);
});
