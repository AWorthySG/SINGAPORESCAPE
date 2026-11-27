import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEY } from '../src/config.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { buildWorld } from '../src/data/world.js';
import { Game } from '../src/game/game.js';
import { loadGame, snapshot } from '../src/game/save.js';
import { worldArt } from '../src/render/sprites.js';

test('decorative stone arches are gone and working gates and resource tiles stay', () => {
  const w = buildWorld();
  for (const id of ['ruin', 'temasek_gate', 'crab_trap', 'fish_rack']) {
    assert.ok(!w.objects.some((o) => o.objId === id));
    assert.ok(!w.landmarks.some((o) => o.objId === id));
    assert.ok(!worldArt().has('obj-' + id));
  }
  assert.equal(OBJECTS.wave_gate.type, 'gate');
  assert.ok(worldArt().has('obj-wave_gate'));
  assert.equal(OBJECTS.home_portal.room, 'portals');
  for (const [id, x, y] of [['copper_rock', 68, 12], ['tree', 76, 37], ['oak', 87, 29]]) {
    assert.ok(w.objects.some((o) => o.objId === id && o.x === x && o.y === y));
  }
});

test('retired loot in a saved pack, bank, chest or grave keeps its coin value', () => {
  const records = new Map();
  globalThis.localStorage = { getItem: (k) => records.get(k) ?? null, setItem: (k, v) => records.set(k, v) };
  const g = new Game(); g.start(); g.chooseClass('rogue');
  const data = snapshot(g);
  data.inventory = [{ id: 'old_boot', qty: 2 }, { id: 'logs', qty: 6 }];
  data.bank = [{ id: 'seaweed', qty: 4 }, { id: 'coins', qty: 10 }];
  data.home.chest = [{ id: 'old_boot', qty: 1 }, { id: 'plank', qty: 2 }];
  data.play.grave = { x: 15, y: 15, left: 40, coins: 2, items: [{ id: 'seaweed', qty: 3 }] };
  records.set(SAVE_KEY, JSON.stringify(data));
  const next = new Game(); next.start();
  assert.equal(next.bank.count('coins'), 21);
  assert.equal(next.inventory.count('logs'), 6);
  assert.deepEqual(next.home.chest, [{ id: 'plank', qty: 2 }]);
  assert.equal(next.play.grave.coins, 8);
  assert.deepEqual(next.play.grave.items, []);
  assert.equal(ITEMS.old_boot, undefined);
  assert.equal(ITEMS.seaweed, undefined);
  assert.ok(loadGame(next));
  assert.equal(next.bank.count('coins'), 21, 'loading again does not pay twice');
});
