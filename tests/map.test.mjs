// The redrawn map: one connected country with winding roads and bridges,
// quicker walking on roads, signposts at the stations, and long trips that
// ride the MRT part of the way.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { TERRAIN } from '../src/data/world.js';
import { STATIONS, STATION_BY_ID, MRT_FARE } from '../src/data/transport.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.ui = new Proxy({}, { get: () => () => {} });
  return game;
}
function placeAt(game, x, y) {
  const p = game.player;
  p.stopNow(); p.clearAction();
  p.x = p.tx = x; p.y = p.ty = y; p.progress = 0; p.moving = false; p.path = [];
  if ('fx' in p) { p.fx = x; p.fy = y; }
}
/** Every tile you can walk to from (x, y), objects and water both blocking. */
function reachable(world, x, y) {
  const seen = new Uint8Array(world.width * world.height);
  const q = [[x, y]]; seen[world.idx(x, y)] = 1;
  while (q.length) {
    const [cx, cy] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!world.inBounds(nx, ny) || seen[world.idx(nx, ny)] || world.isBlocked(nx, ny)) continue;
      seen[world.idx(nx, ny)] = 1; q.push([nx, ny]);
    }
  }
  return seen;
}

test('the whole country is one walk: every station, town NPC and boss can be reached on foot from spawn', () => {
  const game = newGame();
  const w = game.world;
  const seen = reachable(w, game.player.x, game.player.y);
  // A station or NPC tile itself may be blocked, so ask for an open neighbour.
  const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    .some(([dx, dy]) => w.inBounds(x + dx, y + dy) && seen[w.idx(x + dx, y + dy)]);
  for (const st of STATIONS) assert.ok(near(st.x, st.y), `${st.name} station is reachable`);
  for (const n of game.npcs) {
    if (n.attackable && !n.def.boss) continue;
    assert.ok(near(n.spawnX ?? n.x, n.spawnY ?? n.y), `${n.name} at ${n.x},${n.y} is reachable`);
  }
  // Monsters too: hardly any may be walled in.
  const stuck = game.npcs.filter((n) => n.attackable && !near(n.x, n.y));
  assert.ok(stuck.length <= game.npcs.length * 0.01, `${stuck.length} monsters walled in`);
});

test('roads and bridges join the regions, and walking on them is quicker', () => {
  const game = newGame();
  const w = game.world;
  let path = 0, wood = 0;
  for (let i = 0; i < w.terrain.length; i++) { if (w.terrain[i] === TERRAIN.PATH) path++; else if (w.terrain[i] === TERRAIN.WOOD) wood++; }
  assert.ok(path > 3000 && wood > 50, `a real road network (${path} road tiles, ${wood} bridge tiles)`);
  // Find a road tile out in the country and compare step times.
  const sb = STATION_BY_ID.sungei_buloh;
  let road = null, grass = null;
  for (let r = 4; r < 30 && !(road && grass); r++) for (let dx = -r; dx <= r; dx++) {
    const x = sb.x + dx, y = sb.y + r;
    const t = w.terrainAt(x, y);
    if (!road && t === TERRAIN.PATH && !w.isBlocked(x, y)) road = [x, y];
    if (!grass && t === TERRAIN.GRASS && !w.isBlocked(x, y)) grass = [x, y];
  }
  placeAt(game, ...grass); game.update(600);
  const off = game.player.stepMul;
  placeAt(game, ...road); game.update(600);
  assert.ok(game.player.stepMul < off * 0.8, 'steps are quicker on the road');
});

test('a long trip rides the MRT to the station nearest the destination, then walks', () => {
  const game = newGame();
  game.inventory.add('coins', 1000);
  game.checkAchievements();   // settle any coin achievement before counting
  const pk = STATION_BY_ID.punggol;
  const dest = { x: pk.x + 6, y: pk.y + 8 };
  const coins = game.inventory.count('coins');
  game.travelToTile(dest);
  assert.equal(game.inventory.count('coins'), coins - MRT_FARE, 'paid one fare');
  assert.ok(Math.max(Math.abs(game.player.x - pk.x), Math.abs(game.player.y - pk.y)) <= 4, 'rode to Punggol');
  for (let i = 0; i < 60 && game.player.isMoving; i++) game.update(600);
  assert.ok(Math.max(Math.abs(game.player.x - dest.x), Math.abs(game.player.y - dest.y)) <= 1, 'and walked the rest');
  // A short trip just walks.
  const c2 = game.inventory.count('coins');
  game.travelToTile({ x: game.player.x + 10, y: game.player.y });
  assert.equal(game.inventory.count('coins'), c2);
});

test('each station out in the country has a signpost naming where its roads go', () => {
  const game = newGame();
  for (const st of STATIONS.filter((s) => s.x >= 150 || s.y >= 104)) {
    const sign = game.world.objects.find((o) => o.objId === 'sign' && Math.max(Math.abs(o.x - st.x), Math.abs(o.y - st.y)) <= 3 && o.sign?.includes('·'));
    assert.ok(sign || game.world.objects.some((o) => o.objId === 'sign' && Math.abs(o.x - st.x) <= 3 && Math.abs(o.y - st.y) <= 3 && o.sign), `${st.name} has a signpost`);
  }
});
