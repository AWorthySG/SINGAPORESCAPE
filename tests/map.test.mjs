// The redrawn map: one connected country with winding roads and bridges,
// quicker walking on roads, signposts at the stations, and long trips that
// ride the MRT part of the way.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { TERRAIN, buildWorld, zoneLevel, MRT_CLEAR } from '../src/data/world.js';
import { NPCS, stretchLevel } from '../src/data/npcs.js';
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

test('monsters keep clear of the MRT stations, so a new rider arrives safely anywhere', () => {
  const w = buildWorld();
  const outer = (s) => s.x >= 150 || s.y >= 104;
  assert.ok(MRT_CLEAR >= 7);
  for (const st of STATIONS) {
    // Beyond the starting island nothing that fights; on it nothing that attacks on sight.
    const near = w.npcSpawns.filter((s) => NPCS[s.npcId]?.attackable && (outer(st) || NPCS[s.npcId].aggressive)
      && Math.max(Math.abs(s.x - st.x), Math.abs(s.y - st.y)) < 7);
    assert.deepEqual(near.map((s) => s.npcId), [], `nothing that fights spawns within 7 tiles of ${st.name}`);
  }
  // Moved, not removed: every far region is still well stocked.
  for (const z of w.zones.filter((zz) => zz.far)) {
    const n = w.npcSpawns.filter((s) => s.x >= z.x0 && s.x <= z.x1 && s.y >= z.y0 && s.y <= z.y1 && NPCS[s.npcId]?.attackable).length;
    assert.ok(n > 300, `${z.name} still has ${n} monsters`);
  }
  // A level-3 rider idling at each station for a minute and a half (long
  // enough for the monsters nearby to wander every way they can, round water
  // and walls included) is never set upon. Twice over, on different rolls.
  const game = newGame();
  const p = game.player;
  for (let round = 0; round < 2; round++) {
    for (const st of STATIONS) {
      game.inventory.add('coins', 100);
      assert.equal(game.travelTo(st.id), true, `rode to ${st.name}`);
      for (let i = 0; i < 150; i++) {
        game.update(600);
        const foe = game.npcs.find((n) => n.alive && n.target === p);
        assert.ok(!foe, `${foe?.name} attacks a rider idling at ${st.name}`);
      }
      assert.ok(p.alive);
    }
  }
});

test('you can ride out from a station while something attacks you, but not from the world map', () => {
  const game = newGame();
  game.inventory.add('coins', 100);
  let opened = null;
  game.ui = new Proxy({ openTransport: (obj) => { opened = obj; } }, { get: (t, k) => t[k] || (() => {}) });
  const st = STATION_BY_ID.temasek;
  game.travelTo('temasek');
  const p = game.player;
  game.maxHp = () => 100000; p.hp = 100000;   // survive the beating
  // A real fight: a sturdy monster beside you hits you and you hit back.
  const id = Object.keys(NPCS).find((k) => NPCS[k].attackable && NPCS[k].aggressive && !NPCS[k].boss && NPCS[k].level > 20);
  const foe = game.spawnNpc(id, p.x + 1, p.y, { temporary: true, wander: 0 });
  foe.hp = foe.maxHp = 1e9;
  foe.target = p;
  for (let i = 0; i < 6; i++) game.update(600);
  assert.ok(foe.alive && foe.target === p && foe.hp < 1e9, 'the monster is attacking and you hit back');
  assert.equal(game.mrtFromMap('kampong_glam'), false, 'the map refuses mid-fight');
  const gates = game.world.objects.find((o) => o.objId === 'mrt_station' && o.x === st.x && o.y === st.y);
  game.defaultObjectAction(gates);
  for (let i = 0; i < 5 && !opened; i++) game.update(600);
  assert.equal(opened, gates, 'the station gates open');
  assert.equal(game.travelTo('kampong_glam'), true, 'and ride you home');
  assert.ok(Math.abs(game.player.x - 68) <= 2 && Math.abs(game.player.y - 52) <= 2);
});

test('danger signs and region levels use the scale monsters display', () => {
  const w = buildWorld();
  const signs = w.objects.filter((o) => o.objId === 'sign' && /lvl \d+\+/.test(o.sign || ''));
  assert.ok(signs.length >= 6);
  for (const sign of signs) {
    const z = w.zones.find((zz) => sign.sign.includes(zz.name + ':'));
    assert.ok(z, `${sign.sign} names a region`);
    const L = zoneLevel(z);
    assert.equal(L, stretchLevel(z.lo));
    assert.ok(sign.sign.endsWith(`lvl ${L}+`), `${sign.sign} quotes ${L}`);
  }
  // The level quoted is what you meet: nearly all of the region's monsters are at
  // or above it, and the weaker ones aren't far above it either.
  for (const z of w.zones.filter((zz) => zz.lo)) {
    const L = zoneLevel(z);
    const lv = w.npcSpawns.filter((s) => s.x >= z.x0 && s.x <= z.x1 && s.y >= z.y0 && s.y <= z.y1 && NPCS[s.npcId]?.attackable && !NPCS[s.npcId].boss)
      .map((s) => NPCS[s.npcId].level).sort((a, b) => a - b);
    const low = lv[Math.floor(lv.length * 0.05)];
    assert.ok(low >= L && low <= L * 1.5, `${z.name}: quoted ${L}+, weakest monsters ${low}`);
  }
  // Walking in says so too.
  const game = newGame();
  const msgs = [];
  const orig = game.msg.bind(game);
  game.msg = (t, k) => { msgs.push(t); return orig(t, k); };
  game.inventory.add('coins', 100);
  game.travelTo('temasek');
  const L = zoneLevel(game.world.zones.find((z) => z.name === 'Temasek Ruins'));
  assert.ok(msgs.some((m) => m.includes(`monsters level ${L}+`)), msgs.join(' / '));
});
