import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorld } from '../src/data/world.js';
import { World } from '../src/game/world.js';
import { findPath } from '../src/engine/pathfinding.js';
import { drawHeritageBank, drawMarketValance, heritageService, heritageTiles, landmarkPhotoTiles, paintHeritageTiles } from '../src/render/heritagewalk.js';

const map = buildWorld();
const world = new World();
world.build(map);

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

test('the Lion of Light guards the hall off the main road on walkable ground', () => {
  const lion = map.npcSpawns.filter((spawn) => spawn.npcId === 'lion_of_light');
  assert.equal(lion.length, 1);
  const [{ x, y, wander, opts }] = lion;
  assert.deepEqual([x, y, wander, opts.aggressive], [64, 82, 0, false]);
  assert.equal(world.objectAt(x - 1, y - 1).objId, 'golden_dome_hall');
  assert.equal(world.isBlocked(x, y), false);
  const grid = { width: world.width, height: world.height, isBlocked: (px, py) => world.isBlocked(px, py) };
  const path = findPath(grid, map.spawnPoint, { x, y }, { reachAdjacent: true });
  assert.ok(path?.length, 'the hall grounds are reachable from town');
});

test('nearby services use the actual working counter, independently of a mouse hover', () => {
  assert.equal(heritageService(world, { x: 52, y: 49 }), world.objectAt(52, 48));
  assert.equal(heritageService(world, { x: 64, y: 63 }), world.objectAt(64, 62));
  assert.equal(heritageService(world, { x: 61, y: 63 }), null);
});

test('camera tiles mark real photo subjects and decorative buildings stay in the streetscape', () => {
  const photos = landmarkPhotoTiles(world, 0, 0, world.width, world.height);
  assert.deepEqual(photos.map((p) => p.id), ['dome', 'playground', 'temple', 'wheel', 'gardens']);
  for (const { subject, x, y } of photos) {
    const building = world.objectAt(x, y - 1);
    assert.equal(building.objId, subject);
    assert.equal(building.def.backdrop, false);
  }
  assert.equal(world.landmarks.find((o) => o.objId === 'hawker_centre').def.backdrop, false);
  for (const id of ['shophouse_row_mint', 'hdb_block', 'hawker_stall_drinks', 'wet_market']) {
    const obj = world.objects.find((o) => o.objId === id);
    assert.equal(obj.def.backdrop, true);
    assert.equal(obj.def.verb, undefined);
  }
  assert.deepEqual(landmarkPhotoTiles(world, 48, 74, 50, 75).map((p) => p.id), ['playground']);
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
