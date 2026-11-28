// Terrain polish (src/render/terrainfx.js): soft edges between grounds, the
// ground detail scatter, contact shadows and the water's extras. The plans are
// plain data, so these run headless: they must be the same on every bake, keep
// off objects and roads, and the baker must not need a browser.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorld, TERRAIN } from '../src/data/world.js';
import { geographicTile, legacyTile, geographicWorld } from '../src/data/worldlayout.js';
import { World } from '../src/game/world.js';
import { TILE } from '../src/config.js';
import {
  BLEND_RANK, blendPlan, blendMask, scatterPlan, waterDetailPlan, shadowPlan, detailTable,
  GROUND_DETAILS, DETAIL_ART, TerrainFx, tileHash, kerbPlan, paintGroundWash, districtGroundPlan, marinaGlintPlan, marinaPromenadePlan,
} from '../src/render/terrainfx.js';

let _world;
function world() {
  if (_world) return _world;
  _world = new World();
  _world.build(buildWorld());
  return _world;
}
const fresh = () => { const w = new World(); w.build(buildWorld()); return w; };

// Kampong Glam and its edges, the Sentosa shore and MacRitchie's east bank.
const AREAS = [[40, 40, 80, 70], [30, 85, 80, 104], [20, 30, 50, 70], [40, 0, 80, 30]];

test('natural ground takes its regional palette and fades toward the border', () => {
  const casts = (name, t, x) => {
    const strokes = [];
    const g = { globalAlpha: 1, fillRect(...rect) { strokes.push([this.fillStyle, this.globalAlpha, ...rect]); } };
    const w = { zoneAt: () => ({ name, x0: 0, x1: 20, y0: 0, y1: 20 }) };
    paintGroundWash(g, w, t, x, 10, 0, TILE);
    assert.equal(g.globalAlpha, 1);
    return strokes;
  };
  const coast = casts('Sentosa Beach', TERRAIN.WATER, 10)[0];
  const marsh = casts('Sungei Buloh Wetlands', TERRAIN.WATER, 10)[0];
  const rift = casts('The Shadow Rift', TERRAIN.WATER, 10)[0];
  assert.equal(new Set([coast[0], marsh[0], rift[0]]).size, 3);
  assert.deepEqual(coast.slice(2), [0, TILE, TILE, TILE]);
  const edge = casts('Sentosa Beach', TERRAIN.WATER, 1)[0];
  assert.equal(edge[0], coast[0]);
  assert.ok(edge[1] > 0 && edge[1] < coast[1]);
  assert.deepEqual(casts('Sentosa Beach', TERRAIN.WATER, 0), []);
  assert.deepEqual(casts('Sentosa Beach', TERRAIN.STONE, 10), []);
});

test('district materials distinguish road, paving, forest, wetlands and beaches', () => {
  const plan = (name, t, y = 4) => {
    const zoneAt = () => ({ name, x0: 0, x1: 20, y0: 0, y1: 20 });
    return districtGroundPlan({ zoneAt }, t, 10, y);
  };
  const transit = 'Transit Road, Nee Soon Camp';
  assert.equal(plan(transit, TERRAIN.PATH).kind, 'asphalt');
  assert.equal(plan(transit, TERRAIN.PATH, 10), null, 'the park trail stays earth');
  assert.equal(plan(transit, TERRAIN.STONE).kind, 'slabs');
  assert.ok(plan(transit, TERRAIN.STONE, 1).strength < plan(transit, TERRAIN.STONE).strength);
  assert.equal(plan(transit, TERRAIN.STONE, 0), null, 'motifs fade out at the regional seam');
  assert.notEqual(plan('Kampong Glam', TERRAIN.STONE).down, plan('Marina Bay', TERRAIN.STONE).down);
  assert.equal(plan('Mandai Rainforest', TERRAIN.GRASS).kind, 'roots');
  assert.equal(plan('MacRitchie Reservoir', TERRAIN.SAND).kind, 'silt');
  assert.notEqual(plan('MacRitchie Reservoir', TERRAIN.SAND).ink, plan('Sungei Buloh Wetlands', TERRAIN.SAND).ink);
  assert.equal(plan('Sentosa Beach', TERRAIN.SAND).kind, 'ripple');
  assert.equal(plan('Changi Coast', TERRAIN.SAND).kind, 'shingle');
  assert.equal(plan('Sentosa Beach', TERRAIN.WATER), null);
});

test('Marina skyline glints stay on the bay and agree across chunk boundaries', () => {
  const w = world();
  const full = marinaGlintPlan(w, 185, 158, 210, 190);
  assert.ok(new Set(full.map((d) => d.colour)).size === 2, 'both waterfront landmarks cast a glimmer');
  for (const { x, y } of full) assert.equal(w.terrainAt(Math.floor(x / TILE), Math.floor(y / TILE)), TERRAIN.WATER);
  const strip = (x0, x1) => full.filter(({ x }) => Math.floor(x / TILE) >= x0 && Math.floor(x / TILE) < x1);
  assert.deepEqual(marinaGlintPlan(w, 185, 158, 192, 190), strip(185, 192));
  assert.deepEqual(marinaGlintPlan(w, 192, 158, 210, 190), strip(192, 210));
  assert.deepEqual(marinaGlintPlan(w, 50, 30, 100, 60), []);
});

test('Marina promenade reaches the theatre and rail on land in both layouts', () => {
  const legacy = world();
  const geo = new World();
  geo.build(geographicWorld(buildWorld()), { forward: geographicTile, reverse: legacyTile });
  const a = legacy.authoredTile({ x: 180, y: 165 });
  const b = geo.authoredTile(a);
  const old = marinaPromenadePlan(legacy, a.x, a.y, a.x + 35, a.y + 10);
  const current = marinaPromenadePlan(geo, b.x, b.y, b.x + 35, b.y + 10);
  assert.ok(old.paved.has(167 * legacy.width + 192), 'paving shows in front of the theatre');
  assert.ok(old.paved.has(169 * legacy.width + 201), 'paving reaches the rail');
  assert.deepEqual(current.tiles, old.tiles.map((t) => geo.authoredTile(t)));
  for (const { x, y } of current.tiles) assert.ok(![TERRAIN.WATER, TERRAIN.WOOD].includes(geo.terrainAt(x, y)));
  const cut = b.x + 16;
  const left = marinaPromenadePlan(geo, b.x, b.y, cut, b.y + 10);
  const right = marinaPromenadePlan(geo, cut, b.y, b.x + 35, b.y + 10);
  assert.deepEqual([...left.tiles, ...right.tiles], current.tiles);
  assert.deepEqual(left.points, right.points, 'the curve lines up across the chunk seam');
});

test('grass feathers into the Peaks’ rock, while the same edge in town has a kerb', () => {
  const w = {
    terrainAt: (x, y) => x === 10 && y === 10 ? TERRAIN.STONE : TERRAIN.GRASS,
    zoneAt: () => ({ name: 'The Celestial Peaks' }),
  };
  assert.deepEqual(blendPlan(w, 10, 10).map(({ t }) => t), [TERRAIN.GRASS]);
  assert.deepEqual(kerbPlan(w, 10, 10, 11, 11), []);
  w.zoneAt = () => ({ name: 'Kampong Glam' });
  assert.deepEqual(blendPlan(w, 10, 10), []);
  assert.equal(kerbPlan(w, 10, 10, 11, 11).length, 1);
});

test('blend plans are the same on every build of the world', () => {
  const a = world(), b = fresh();
  for (const [x0, y0, x1, y1] of AREAS) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) assert.deepEqual(blendPlan(a, x, y), blendPlan(b, x, y), `${x},${y}`);
  }
});

test('blending only lays a higher-ranked ground over a lower one, water on top', () => {
  const w = world();
  let shores = 0;
  for (const [x0, y0, x1, y1] of AREAS) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const t = w.terrainAt(x, y), plan = blendPlan(w, x, y);
      if (t === TERRAIN.STONE) {   // paving takes only a road's dust spilling in through a gate
        for (const p of plan) assert.equal(p.t, TERRAIN.PATH, `paving takes ${p.t} at ${x},${y}`);
        continue;
      }
      if (!BLEND_RANK[t]) { assert.deepEqual(plan, [], 'bridges keep crisp edges'); continue; }
      let last = 0;
      for (const p of plan) {
        assert.ok(BLEND_RANK[p.t] > BLEND_RANK[t], 'only higher ranks spill over');
        assert.ok(BLEND_RANK[p.t] > last, 'lowest rank first, so water lands on top');
        last = BLEND_RANK[p.t];
        assert.ok(p.bits > 0 && p.bits < 256 && p.v >= 0 && p.v < 4);
        // A corner never doubles up with a side next to it.
        if (p.bits & 16) assert.ok(!(p.bits & 3));
        if (p.bits & 128) assert.ok(!(p.bits & 9));
      }
      if (plan.some((p) => p.t === TERRAIN.WATER)) shores++;
    }
  }
  assert.ok(shores > 50, `shores blend (${shores})`);
});

test('blend masks feather from the touching side and meet their neighbours without a step', () => {
  const m = blendMask(1, 2);   // water (say) to the north
  assert.deepEqual(m, blendMask(1, 2), 'deterministic');
  assert.ok(m[0 * TILE + 16] > 0.9, 'full at the shared edge');
  assert.equal(m[(TILE - 1) * TILE + 16], 0, 'gone by the far side');
  // At the tile's left and right ends the wobble is zero, so every variant
  // agrees there (give or take the light dither) and side-by-side tiles join up.
  for (let v = 0; v < 4; v++) {
    const mv = blendMask(1, v);
    for (let py = 0; py < TILE; py += 3) assert.ok(Math.abs(mv[py * TILE] - m[py * TILE]) < 0.25, `variant ${v} row ${py}`);
  }
  // A lone corner pokes in only near that corner.
  const c = blendMask(16, 0);   // north-east
  assert.ok(c[0 * TILE + TILE - 1] > 0.8 && c[(TILE - 1) * TILE] === 0);
});

test('ground details are deterministic, and low graphics plants fewer', () => {
  const a = world(), b = fresh();
  for (const [x0, y0, x1, y1] of AREAS) assert.deepEqual(scatterPlan(a, x0, y0, x1, y1), scatterPlan(b, x0, y0, x1, y1));
  const full = scatterPlan(a, 0, 0, 96, 104), low = scatterPlan(a, 0, 0, 96, 104, { low: true });
  assert.ok(full.length > 1000, `plenty of details (${full.length})`);
  assert.ok(low.length < full.length * 0.7, 'low graphics halves the scatter');
  for (const d of full) assert.ok(GROUND_DETAILS[d.id], d.id);
});

// What may lie on town paving: flat things only, no tufts or flowers.
const PAVING = (id) => ['drain', 'petals', 'lamp_pool'].includes(id) || id.startsWith('rug_');

test('ground details keep off object tiles, water, bridges and the middle of roads; paving gets its own', () => {
  const w = world();
  const T = TERRAIN;
  const all = scatterPlan(w, 0, 0, w.width, w.height);
  assert.ok(all.length > 5000);
  let onPath = 0;
  for (const d of all) {
    const x = Math.floor(d.px / TILE), y = Math.floor(d.py / TILE), t = w.terrainAt(x, y);
    assert.equal(w.objectAt(x, y), null, `detail on an object at ${x},${y}`);
    assert.ok(t !== T.WATER && t !== T.WOOD, `detail on terrain ${t} at ${x},${y}`);
    const rock = t === T.STONE && w.zoneAt(x, y)?.name === 'The Celestial Peaks';
    assert.equal(t === T.STONE && !rock, PAVING(d.id), `${d.id} on terrain ${t} at ${x},${y}`);
    if (rock) assert.ok(['pebble', 'stone'].includes(d.id), 'only scree is scattered on the rock');
    if (t === T.PATH) {
      onPath++;
      const verge = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => w.terrainAt(x + dx, y + dy) !== T.PATH);
      assert.ok(verge, `stone in the middle of a road at ${x},${y}`);
    }
  }
  assert.ok(onPath > 0, 'roads still get stones along their verges');
});

test('kerbs run round the town paving where it meets grass or sand, rounded at the corners and gateposts', () => {
  const w = world();
  const T = TERRAIN;
  const plan = kerbPlan(w, 40, 40, 80, 70);   // Kampong Glam and the edge of Chinatown
  assert.deepEqual(plan, kerbPlan(fresh(), 40, 40, 80, 70), 'deterministic');
  assert.ok(plan.length > 60, `the plaza is kerbed (${plan.length})`);
  const SIDE = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (const k of plan) {
    assert.equal(w.terrainAt(k.x, k.y), T.STONE);
    for (let i = 0; i < 4; i++) {
      const nt = w.terrainAt(k.x + SIDE[i][0], k.y + SIDE[i][1]);
      assert.equal(!!(k.sides & (1 << i)), [T.GRASS, T.DARKGRASS, T.SAND].includes(nt), `side ${i} of ${k.x},${k.y}`);
    }
  }
  const at = (x, y) => plan.find((k) => k.x === x && k.y === y);
  // The plaza's corners are rounded off (north-west at 46,46).
  assert.ok(at(46, 46).round & 8, 'the north-west corner rounds');
  // The west gate (a road in at 46,54-55): the kerb either side curls in.
  assert.equal(w.terrainAt(46, 54), T.PATH);
  assert.ok(at(46, 53).sides & 8 && at(46, 53).round & 4, 'the gatepost above the west gate rounds off');
  assert.ok(!at(47, 54), 'no kerb across the gate itself');
  // Inner corners, where paving wraps round a corner of grass, close up.
  assert.ok(kerbPlan(w, 0, 0, w.width, w.height).some((k) => k.cave), 'inner corners are filled');
  // The road spills onto the paving instead.
  assert.ok(blendPlan(w, 47, 54).some((p) => p.t === T.PATH), 'the road dusts the paving at the gate');
});

test('town paving gets tile rugs, drains, petals by the flowerbeds and lamp pools, deterministically', () => {
  const w = world();
  const T = TERRAIN;
  const kg = scatterPlan(w, 44, 44, 72, 66).filter((d) => PAVING(d.id));
  assert.deepEqual(kg, scatterPlan(fresh(), 44, 44, 72, 66).filter((d) => PAVING(d.id)), 'deterministic');
  assert.ok(kg.some((d) => d.id === 'petals'), 'petals by the plaza flowerbeds');
  const all = scatterPlan(w, 0, 0, w.width, w.height).filter((d) => PAVING(d.id));
  for (const id of ['drain', 'lamp_pool']) assert.ok(all.some((d) => d.id === id), `${id} somewhere`);
  assert.ok(all.some((d) => d.id.startsWith('rug_')), 'rugs somewhere');
  for (const d of all.filter((e) => e.id === 'lamp_pool')) {
    const o = w.objectAt(Math.floor(d.px / TILE), Math.floor(d.py / TILE) - 1);
    assert.ok(o && ['lamp', 'heritage_lamp', 'lantern_post'].includes(o.objId), 'a lamp pool lies in front of a lamp');
  }
  for (const d of all) {
    assert.ok(GROUND_DETAILS[d.id], d.id);
    if (!d.id.startsWith('rug_')) continue;
    // A rug covers four tiles (its foot is the bottom of the middle): all clear paving.
    const x0 = Math.round(d.px / TILE) - 1, y0 = Math.floor(d.py / TILE) - 1;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      assert.equal(w.terrainAt(x0 + dx, y0 + dy), T.STONE, `rug off the paving at ${x0 + dx},${y0 + dy}`);
      assert.equal(w.objectAt(x0 + dx, y0 + dy), null, `rug under an object at ${x0 + dx},${y0 + dy}`);
    }
    // ...and stays inside one 32-tile chunk, so no chunk edge cuts it.
    assert.equal(Math.floor(x0 / 32), Math.floor((x0 + 1) / 32));
    assert.equal(Math.floor(y0 / 32), Math.floor((y0 + 1) / 32));
  }
  // Sparse: a detail on well under a fifth of the paving.
  let paving = 0;
  for (let y = 44; y < 66; y++) for (let x = 44; x < 72; x++) if (w.terrainAt(x, y) === T.STONE && !w.objectAt(x, y)) paving++;
  assert.ok(kg.length < paving / 5, `${kg.length} details on ${paving} tiles`);
  // Ruins keep their paving plain.
  assert.equal(detailTable(T.STONE, 'Temasek Ruins'), null);
});

test('details suit the ground and region: shells on beaches, no flowers in the Wilderness', () => {
  const ids = (t, z) => detailTable(t, z).w.map(([id]) => id);
  assert.ok(ids(TERRAIN.SAND, 'Sentosa Beach').includes('shell'));
  assert.ok(ids(TERRAIN.GRASS, 'Kampong Glam').some((id) => id.startsWith('flower')));
  assert.ok(!ids(TERRAIN.GRASS, 'The Wilderness').some((id) => id.startsWith('flower')));
  assert.ok(ids(TERRAIN.GRASS, 'Bukit Timah').includes('leaf_brown'));
  assert.ok(ids(TERRAIN.PATH, 'Kampong Glam').includes('stone'));
  assert.equal(detailTable(TERRAIN.WATER, 'Sentosa Beach'), null);
});

test('lily pads and reeds float in fresh water only, never on a fishing spot', () => {
  const w = world();
  const mac = waterDetailPlan(w, 0, 44, 44, 83);
  assert.ok(mac.some((d) => d.id === 'reed') && mac.some((d) => d.id.startsWith('lily')), 'the reservoir has both');
  for (const d of mac) {
    const x = Math.floor(d.px / TILE), y = Math.floor(d.py / TILE);
    assert.equal(w.terrainAt(x, y), TERRAIN.WATER, `${d.id} on water at ${x},${y}`);
  }
  const all = waterDetailPlan(w, 0, 0, w.width, w.height);
  for (const d of all) assert.ok(!w.objectAt(Math.floor((d.px - 0.01) / TILE), Math.floor(d.py / TILE)) || d.id === 'reed');
  // The Sentosa sea (open water) stays clear.
  assert.deepEqual(waterDetailPlan(w, 26, 98, 105, 104), []);
  assert.deepEqual(waterDetailPlan(w, 0, 44, 44, 83), mac, 'deterministic');
});

test('contact shadows go under static objects, not fires, crops or fishing spots', () => {
  const w = world();
  const sh = shadowPlan(w, 0, 0, w.width, w.height);
  assert.ok(sh.length > 3000);
  for (const s of sh) {
    const o = w.objectAt(s.x, s.y);
    assert.ok(o && !['fire', 'farm', 'fishing'].includes(o.def.type), o?.objId);
  }
  assert.ok(sh.some((s) => s.kind === 'tree') && sh.some((s) => s.ao), 'trees cast shadows; walls darken the ground');
  assert.ok(tileHash(3, 4) === tileHash(3, 4) && tileHash(3, 4) !== tileHash(4, 3));
});

// A canvas stand-in that records every call, so a bake can run (and be compared) without a browser.
function stubFactory(log) {
  return (w, h) => {
    const ctx = new Proxy({}, {
      get(target, k) {
        if (k in target) return target[k];
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'getTransform') return () => ({ a: 1 });
        if (k === 'createImageData') return (W, H) => ({ data: new Uint8ClampedArray(W * H * 4) });
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
        return (...args) => { log.push(k + ':' + args.map((a) => (typeof a === 'number' ? Math.round(a * 100) / 100 : typeof a)).join(',')); };
      },
      set(target, k, v) { target[k] = v; return true; },
    });
    return { width: w, height: h, getContext: () => ctx };
  };
}

test('terrain chunks meet on a device pixel at a fractional ground scale', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const scale = 1.53, span = TILE * 32;
  const drawn = [];
  Renderer.prototype._drawTerrainChunks.call({
    ctx: { getTransform: () => ({ a: scale }), drawImage: (...args) => drawn.push(args.slice(5)) },
    game: { world: { width: 64, height: 64 } },
    terrainCanvas: { chunks: new Map() },
    _chunk: () => ({}),
  }, span - 55.27, span - 51.11, 200, 200);
  assert.equal(drawn.length, 4);
  const [[x, y, width, height], [right], [, bottom]] = drawn;
  const pixel = (edge) => Math.abs(edge * scale - Math.round(edge * scale)) < 1e-9;
  assert.ok(pixel(right) && pixel(bottom));
  assert.ok(Math.abs(x + width - right) < 1e-9 && Math.abs(y + height - bottom) < 1e-9);
});

test('the animated water layer paints ripples in open water and a thin edge at a quay', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const calls = [], ctx = stubFactory(calls)(32, 32).getContext('2d');
  const open = { terrainAt: () => TERRAIN.WATER };
  const draw = (w, x, y) => Renderer.prototype._water.call({}, ctx, w, x, y, 0, 0, 800, true);
  for (let x = 0; x < 8; x++) draw(open, x, 1);
  assert.ok(calls.some((c) => c.startsWith('quadraticCurveTo:')));
  assert.ok(calls.every((c) => !c.startsWith('fillRect:')), 'whole tiles don’t change brightness');
  const pier = { terrainAt: (_x, y) => y === 0 ? TERRAIN.WOOD : TERRAIN.WATER };
  draw(pier, 1, 1);
  assert.ok(calls.includes(`fillRect:0,0,${TILE + 1},2`));
});

test('the bake runs headless against a stand-in canvas and is deterministic', () => {
  const w = world();
  const bakeOnce = (low) => {
    const log = [];
    const fx = new TerrainFx(stubFactory(log));
    const make = stubFactory(log);
    const g = make(1024, 1024).getContext('2d');
    const out = fx.bake(g, w, 0, 32, 32, 64, () => '#ffffff', { low });   // MacRitchie's chunk
    return { log, out };
  };
  const a = bakeOnce(false), b = bakeOnce(false);
  assert.ok(a.out && a.out.foam && a.out.water.length > 0, 'the reservoir chunk has foam and water details');
  assert.ok(a.log.filter((s) => s.startsWith('drawImage')).length > 200, 'blends, details and shadows were drawn');
  assert.deepEqual(a.log, b.log, 'same bake, same picture');
  const low = bakeOnce(true);
  assert.equal(low.out.foam.b, null, 'low graphics keeps one foam frame');
  // No canvas at all (plain node): the baker draws nothing but still plans the water.
  const none = new TerrainFx(() => null);
  const calls = [];
  const out = none.bake(stubFactory(calls)(32, 32).getContext('2d'), w, 0, 32, 32, 64, () => '#fff', {});
  assert.ok(out && out.water.length > 0);
});

test('the renderer bakes chunks with the polish and draws the water extras', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const log = [];
  const make = stubFactory(log);
  globalThis.document = { createElement: () => make(0, 0) };
  try {
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const { Game } = await import('../src/game/game.js');
    const game = new Game(); game.start();
    game.camera.resize(800, 600);
    game.player.x = 35; game.player.y = 50;   // MacRitchie's east bank
    game.camera.follow(game.player.x * 32, game.player.y * 32);
    const ctx = make(800, 600).getContext('2d');
    const r = new Renderer(game, {}, ctx);
    // The polish is spread over frames, a few ms at a time: keep drawing until it's in.
    let t = 1000;
    r.render(t);
    for (let i = 0; i < 400 && r._visChunks.some((c) => c.fxJob); i++) r.render(t += 16);
    assert.ok(r._visChunks.every((c) => !c.fxJob), 'every visible chunk finished its polish');
    assert.ok(r.tfx, 'the polish baker was made');
    assert.ok(r._visChunks.some((c) => c.fx && c.fx.foam), 'a visible chunk carries foam');
    // Switching to low graphics re-bakes.
    const before = r.terrainCanvas.chunks.size;
    assert.ok(before > 0);
    game.lowFx = true;
    r.render(1200);
    assert.equal(r.terrainCanvas.sig, r.tfx.signature(true));
  } finally { delete globalThis.document; }
});

test('ground detail art names real details', () => {
  for (const id of Object.keys(DETAIL_ART)) assert.ok(GROUND_DETAILS[id], id);
});
