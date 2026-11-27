import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorld } from '../src/data/world.js';
import { World } from '../src/game/world.js';
import { drawHeritageBank, drawMarketValance, heritageService, heritageTiles, paintHeritageTiles } from '../src/render/heritagewalk.js';

const world = new World();
world.build(buildWorld());

test('the heritage inlay connects the real hall, stall and bank without covering blocked tiles', () => {
  const tiles = heritageTiles(world, 45, 46, 68, 84);
  const stops = tiles.filter((t) => t.kind).map((t) => [t.kind, t.x, t.y]);
  assert.deepEqual(stops, [['bank', 51, 49], ['market', 64, 63], ['dome', 62, 82]]);
  assert.equal(world.objectAt(51, 48).objId, 'bank_booth');
  assert.equal(world.objectAt(64, 62).objId, 'stall_food');
  assert.equal(world.objectAt(62, 81).objId, 'golden_dome_hall');

  const remaining = new Set(tiles.map(({ x, y }) => `${x},${y}`));
  const pending = [[51, 49]];
  while (pending.length) {
    const [x, y] = pending.pop();
    if (!remaining.delete(`${x},${y}`)) continue;
    assert.equal(world.isBlocked(x, y), false);
    pending.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  assert.equal(remaining.size, 0, 'the inlaid route links all three stops');
  assert.deepEqual(heritageTiles(world, 0, 0, 32, 32), []);
  const chunks = [...heritageTiles(world, 32, 32, 64, 64), ...heritageTiles(world, 64, 32, 96, 64), ...heritageTiles(world, 32, 64, 64, 96)];
  const keys = (list) => list.map(({ x, y }) => `${x},${y}`).sort();
  assert.deepEqual(keys(chunks), keys(tiles), 'the terrain baker clips each tile to its own chunk');
});

test('nearby services use the actual working counter, independently of a mouse hover', () => {
  assert.equal(heritageService(world, { x: 52, y: 49 }), world.objectAt(52, 48));
  assert.equal(heritageService(world, { x: 64, y: 63 }), world.objectAt(64, 62));
  assert.equal(heritageService(world, { x: 61, y: 63 }), null);
});

const callsFrom = (draw) => {
  const calls = [];
  draw(new Proxy({}, { get: (_, method) => (...args) => calls.push([method, ...args]) }));
  return calls;
};

test('the street decorations draw and the cloth holds still with motion disabled', () => {
  const bank = callsFrom((g) => drawHeritageBank(g, 0, 0));
  assert.ok(bank.some(([method, text]) => method === 'fillText' && text === 'BANK'));
  const paving = callsFrom((g) => paintHeritageTiles(g, world, 48, 48, 54, 52));
  assert.ok(paving.some(([method]) => method === 'fillRect'));
  const cloth = (t, still) => callsFrom((g) => drawMarketValance(g, 0, 0, t, still));
  assert.deepEqual(cloth(0, true), cloth(850, true));
  assert.notDeepEqual(cloth(0, false), cloth(850, false));
});
