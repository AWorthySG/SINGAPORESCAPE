// Landmarks, set dressing and the ambient life loops (Part A and B art):
// where the set pieces stand, that they never cut the map apart, that their
// pictures are registered and drawn, and that the ambient system uses the
// painted loops.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Pictures "load" only when a test says so (the art modules cache each Image).
globalThis.__artLoaded = false;
globalThis.Image = class { get complete() { return globalThis.__artLoaded; } get naturalWidth() { return globalThis.__artLoaded ? 100 : 0; } get naturalHeight() { return 80; } };

const { buildWorld, TERRAIN } = await import('../src/data/world.js');
const { LANDMARK_PLAN, STATION_GAP, footprintTiles } = await import('../src/data/landmarks.js');
const { OBJECTS } = await import('../src/data/objects.js');
const { STATIONS } = await import('../src/data/transport.js');
const { World } = await import('../src/game/world.js');
const { worldArt, drawObjectSprite, bedLook } = await import('../src/render/sprites.js');
const { hidesPoint } = await import('../src/render/ambience.js');
const { fxArt, fxLoop, CRITTER_LOOPS, PARTICLE_LOOPS } = await import('../src/render/fxart.js');
const { AmbientLife, RIPPLE_CAP } = await import('../src/render/ambient.js');
const { TILE } = await import('../src/config.js');

const data = buildWorld();
const lmIds = (p) => (p.lm || []).map((e) => (Array.isArray(e) ? e[0] : e));
const PIECES = new Set(LANDMARK_PLAN.flatMap((p) => [...lmIds(p), ...(p.props || []).map((e) => e[0])]));
const zoneAt = (x, y) => data.zones.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)?.name;
const ter = (x, y) => data.terrain[y * data.width + x];

test('every planned landmark is placed, in its own region, on open ground off the roads', () => {
  const want = LANDMARK_PLAN.flatMap((p) => lmIds(p).map((id) => [p.region, id]));
  assert.equal(data.landmarks.length, want.length, 'all of them');
  assert.ok(want.length >= 28, 'one or more of each of the 28 pictures');
  for (const id of new Set(want.map((w) => w[1]))) assert.ok(data.landmarks.some((l) => l.objId === id), `${id} placed`);
  // A count per region, as planned.
  const per = (list) => list.reduce((m, r) => ((m[r] = (m[r] || 0) + 1), m), {});
  assert.deepEqual(per(data.landmarks.map((l) => l.region)), per(want.map((w) => w[0])));
  const anchors = new Map(data.objects.map((o) => [`${o.x},${o.y}`, o]));
  const spawns = new Set(data.npcSpawns.map((s) => `${s.x},${s.y}`));
  for (const l of data.landmarks) {
    const plan = LANDMARK_PLAN.find((p) => p.region === l.region && lmIds(p).includes(l.objId));
    const wet = (plan.lm.find((e) => Array.isArray(e) && e[0] === l.objId) || [])[1] === 'water';
    if (plan.outskirts) assert.ok(Math.hypot(l.x - plan.at[0], l.y - plan.at[1]) <= plan.reach * 1.5, `${l.objId} on ${l.region}'s outskirts`);
    else assert.equal(zoneAt(l.x, l.y), l.region, `${l.objId} stands in ${l.region}`);
    for (const [x, y] of footprintTiles(l.objId, l.x, l.y)) {
      const t = ter(x, y);
      assert.ok(x > 0 && y > 0 && x < data.width - 1 && y < data.height - 1, `${l.objId} inside the border`);
      if (wet) assert.equal(t, TERRAIN.WATER, `${l.objId} stands in the water`);
      else assert.ok([TERRAIN.GRASS, TERRAIN.DARKGRASS, TERRAIN.SAND, TERRAIN.STONE].includes(t), `${l.objId} at ${x},${y} on open ground, not a road`);
      const o = anchors.get(`${x},${y}`);
      assert.ok(!o || (o.objId === l.objId && o.x === l.x && o.y === l.y), `nothing else stands under ${l.objId} (${o && o.objId})`);
      assert.ok(!spawns.has(`${x},${y}`), `no monster or townsperson spawns inside ${l.objId}`);
      for (const s of STATIONS) assert.ok(Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) >= STATION_GAP, `${l.objId} clear of the ${s.name} MRT`);
    }
  }
});

test('set dressing: each region gets a few props, at a sensible density, each on its own tile', () => {
  const props = data.objects.filter((o) => OBJECTS[o.objId].prop || OBJECTS[o.objId].frames);
  for (const p of LANDMARK_PLAN.filter((q) => q.props)) {
    const want = p.props.reduce((s, e) => s + e[1], 0);
    const near = props.filter((o) => p.props.some((e) => e[0] === o.objId) && Math.hypot(o.x - p.at[0], o.y - p.at[1]) <= p.reach * 1.5);
    assert.ok(near.length >= Math.ceil(want * 0.6), `${p.region}: ${near.length} of ${want} props`);
  }
  // Not spam: about a hundred and fifty across the whole map, never two on a tile, none on a road.
  assert.ok(props.length >= 100 && props.length <= 200, `${props.length} props`);
  const seen = new Set();
  for (const o of props) {
    assert.ok(!seen.has(`${o.x},${o.y}`)); seen.add(`${o.x},${o.y}`);
    assert.ok(ter(o.x, o.y) !== TERRAIN.PATH && ter(o.x, o.y) !== TERRAIN.WOOD, `${o.objId} off the road`);
  }
  // Only the set pieces are new: the rest of the world is laid out as before.
  assert.ok([...PIECES].every((id) => OBJECTS[id]), 'every planned piece is a real object');
});

// Tiles you can reach on foot from the spawn point (4-way), in a built World.
function reachable(world) {
  const seen = new Uint8Array(world.width * world.height), q = [world.spawnPoint.x, world.spawnPoint.y];
  seen[world.idx(world.spawnPoint.x, world.spawnPoint.y)] = 1;
  while (q.length) {
    const y = q.pop(), x = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!world.inBounds(nx, ny) || world.isBlocked(nx, ny) || seen[world.idx(nx, ny)]) continue;
      seen[world.idx(nx, ny)] = 1; q.push(nx, ny);
    }
  }
  return seen;
}

test('the set pieces never cut one place off from another, nor wall in anything you use', () => {
  const after = new World(); after.build(data);
  const before = new World(); before.build({ ...data, objects: data.objects.filter((o) => !PIECES.has(o.objId)) });
  const a = reachable(after), b = reachable(before);
  let lost = 0;
  for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
    if (b[after.idx(x, y)] && !a[after.idx(x, y)] && !after.isBlocked(x, y)) lost++;
  }
  assert.equal(lost, 0, 'every tile you could walk to before, you still can');
  // Everything you use (stations, nodes, banks, quest givers) can still be walked up to.
  const side = (seen, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].some(([dx, dy]) => after.inBounds(x + dx, y + dy) && seen[after.idx(x + dx, y + dy)]);
  for (const o of before.objects) if (o.def.verb && side(b, o.x, o.y)) assert.ok(side(a, o.x, o.y), `${o.objId} at ${o.x},${o.y} still reachable`);
  for (const s of data.npcSpawns) if (b[after.idx(s.x, s.y)]) assert.ok(a[after.idx(s.x, s.y)], `${s.npcId} at ${s.x},${s.y} still reachable`);
});

test('a landmark blocks and answers for its whole footprint, and lets it go when removed', () => {
  const w = new World(); w.build(data);
  const hdb = w.landmarks.find((o) => o.objId === 'hdb_block');
  assert.ok(hdb && w.landmarks.length === data.landmarks.length);
  const tiles = w.footprint(hdb);
  assert.equal(tiles.length, 8, 'four wide, two deep');
  for (const [x, y] of tiles) { assert.equal(w.objectAt(x, y), hdb); assert.ok(w.isBlocked(x, y)); }
  assert.ok(!w.isBlocked(hdb.x, hdb.y + 1), 'the walkway in front is open');
  w.removeObject(hdb);
  for (const [x, y] of tiles) { assert.equal(w.objectAt(x, y), null); assert.ok(!w.isBlocked(x, y)); }
  assert.ok(!w.landmarks.includes(hdb));
  // The lantern hangs overhead: it neither blocks nor needs a free tile.
  const lantern = w.objects.find((o) => o.objId === 'five_foot_lantern');
  assert.ok(lantern && !w.isBlocked(lantern.x, lantern.y) && OBJECTS.five_foot_lantern.overhead);
});

test('walking behind a landmark fades it, walking in front does not', () => {
  const o = { objId: 'golden_dome_hall', def: OBJECTS.golden_dome_hall, x: 10, y: 20 };
  const cx = (10 + 2) * TILE;
  assert.ok(hidesPoint(o, cx, (20 - 3.5) * TILE), 'just behind its back wall');
  assert.ok(!hidesPoint(o, cx, (20 + 1.5) * TILE), 'not in front of it');
  assert.ok(!hidesPoint(o, cx + 3 * TILE, (20 - 3.5) * TILE), 'nor off to the side');
  assert.ok(!hidesPoint(o, cx, (20 - 6.5) * TILE), 'nor well past its top');
});

// A context that records which pictures were drawn, and how wide.
function drawingCtx() {
  const drawn = [];
  return { drawn, ctx: new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'drawImage' ? (img, ...a) => drawn.push({ src: img.src, w: a[2] }) : () => {}), set: (t, k, v) => ((t[k] = v), true) }) };
}

test('every set piece has its picture; landmarks span their footprint and loops step through their frames', () => {
  const art = worldArt();
  for (const [id, d] of Object.entries(OBJECTS)) {
    if (d.footprint || d.prop) assert.ok(art.has(`obj-${id}`), `${id} has a picture`);
    if (d.frames) for (let i = 0; i < d.frames; i++) assert.ok(art.has(`obj-${id}-${i}`), `${id} frame ${i}`);
  }
  for (const id of PIECES) assert.ok(OBJECTS[id].footprint || OBJECTS[id].prop || OBJECTS[id].frames, `${id} is a set piece`);
  const hall = { objId: 'golden_dome_hall', def: OBJECTS.golden_dome_hall, x: 5, y: 9 };
  const { ctx, drawn } = drawingCtx();
  globalThis.__artLoaded = false;
  drawObjectSprite(ctx, hall, 100, 100, 0);
  assert.equal(drawn.length, 0, 'a landmark shows nothing until its picture loads (no stand-in blob)');
  globalThis.__artLoaded = true;
  drawObjectSprite(ctx, hall, 100, 100, 0);
  assert.equal(drawn[0].src, 'assets/world/obj-golden_dome_hall.webp');
  assert.ok(Math.abs(drawn[0].w - 4 * TILE * 1.1) < 1, 'drawn a little wider than its four tiles');
  // The laundry flaps through its four frames, a frame every frameMs.
  const pole = { objId: 'laundry_pole', def: OBJECTS.laundry_pole, x: 0, y: 0 };
  const frames = new Set();
  for (let t = 0; t < 4 * OBJECTS.laundry_pole.frameMs; t += OBJECTS.laundry_pole.frameMs) {
    drawn.length = 0; drawObjectSprite(ctx, pole, 50, 50, t); frames.add(drawn[0].src);
  }
  assert.equal(frames.size, 4, [...frames].join(' '));
});

test("Kampong Glam's plaza props stand clear of its paths, townsfolk and dig spots, and every tile stays reachable", async () => {
  const { CLUE_SPOTS } = await import('../src/data/clues.js');
  const { REGION_GIVERS } = await import('../src/data/regionQuests.js');
  const { GATE } = await import('../src/game/waves.js');
  const { RESIDENTS } = await import('../src/data/consequences.js');
  const NEW = ['peranakan_fountain', 'kopitiam_parasol', 'lantern_tree', 'tiled_planter', 'mural_board', 'birdcage_pole'];
  const inPlaza = (o) => o.x > 46 && o.x < 70 && o.y > 46 && o.y < 64;
  const props = data.objects.filter((o) => inPlaza(o) && [...NEW, 'trishaw', 'lantern_post'].includes(o.objId));
  for (const id of NEW) assert.ok(props.some((o) => o.objId === id), `${id} on the plaza`);
  assert.equal(props.length, NEW.length + 3, 'with a trishaw and two lantern posts');
  for (const id of NEW) assert.ok(worldArt().has(`obj-${id}`), `${id} has its picture`);
  // Nothing on, or next to, a tile somebody needs.
  const keep = [...data.npcSpawns.map((n) => [n.x, n.y]), ...CLUE_SPOTS.map((c) => [c.x, c.y]), [GATE.x, GATE.y],
    ...Object.values(REGION_GIVERS).map((g) => g.at), ...Object.values(RESIDENTS).map((r) => r.at), [data.spawnPoint.x, data.spawnPoint.y]];
  for (const o of props) {
    for (const [x, y] of keep) assert.ok(Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) > 1, `${o.objId} at ${o.x},${o.y} crowds ${x},${y}`);
    assert.ok(o.x !== 57 && o.x !== 58 && o.y !== 54 && o.y !== 55, `${o.objId} at ${o.x},${o.y} stands on an entrance line`);
  }
  // Every open tile of the plaza can still be walked to from where you start.
  const world = new World();
  world.build(data);
  const seen = new Set([`${data.spawnPoint.x},${data.spawnPoint.y}`]), q = [[data.spawnPoint.x, data.spawnPoint.y]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 44 || nx > 72 || ny < 44 || ny > 66 || seen.has(k) || world.isBlocked(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  for (let y = 47; y <= 63; y++) for (let x = 47; x <= 69; x++) {
    if (!world.isBlocked(x, y)) assert.ok(seen.has(`${x},${y}`), `${x},${y} cut off`);
  }
});

test('flowerbeds round the plaza vary their look by tile, but stay the same objects', () => {
  const world = new World();
  world.build(data);
  const beds = world.objects.filter((o) => (o.objId === 'flower' || o.objId === 'bush') && o.x >= 46 && o.x <= 70 && o.y >= 46 && o.y <= 64);
  assert.ok(beds.length > 60, `the plaza border (${beds.length})`);
  const looks = beds.map(bedLook);
  assert.deepEqual(beds.map(bedLook), looks, 'the same look every time');
  for (const l of looks) {
    assert.ok(l.s >= 0.92 && l.s <= 1.08, `scale within 8% (${l.s})`);
    assert.ok(worldArt().has(l.key), l.key);
  }
  const kinds = new Set(looks.map((l) => `${l.key}|${l.tint}`));
  assert.ok(kinds.size >= 5, `a mix of plants and colours (${kinds.size})`);
  assert.ok(looks.some((l) => l.flip) && looks.some((l) => !l.flip), 'some mirrored');
  assert.ok(beds.some((o, i) => looks[i].key !== `obj-${o.objId}`), 'now and then the other plant');
  // Two neighbours in a row rarely match exactly.
  let same = 0;
  for (let i = 1; i < looks.length; i++) if (JSON.stringify(looks[i]) === JSON.stringify(looks[i - 1])) same++;
  assert.ok(same < looks.length / 10);
  // Drawn at its look (no filter on this stand-in context, so no tint), and only the drawing changes.
  globalThis.__artLoaded = true;
  const { ctx, drawn } = drawingCtx();
  const o = beds[0];
  drawObjectSprite(ctx, o, 100, 100, 0);
  assert.equal(drawn[0].src, `assets/world/${looks[0].key}.webp`);
  assert.equal(o.objId === 'flower' || o.objId === 'bush', true);
});

test('the ambient loops are registered and step at a gentle pace, or follow a puff from start to end', () => {
  const fx = fxArt();
  for (const k of CRITTER_LOOPS) for (let i = 0; i < 4; i++) assert.ok(fx.has(`critter-${k}-${i}`), k);
  for (const k of PARTICLE_LOOPS) for (let i = 0; i < 4; i++) assert.ok(fx.has(`particle-${k}-${i}`), k);
  globalThis.__artLoaded = true;
  const at = (t, ms, ph, f) => fxLoop('particle', 'steam', t, ms, ph, f).src.match(/-(\d)\.webp$/)[1];
  assert.deepEqual([0, 300, 600, 900, 1200].map((t) => at(t, 300)), ['0', '1', '2', '3', '0'], 'one frame every 300 ms, round and round');
  assert.deepEqual([0, 0.3, 0.6, 0.99].map((f) => at(0, 0, 0, f)), ['0', '1', '2', '3'], 'or by how far through its life a puff is');
});

test('ambient life draws the painted cats, steam, sparkles, ripples and tumbling leaves', () => {
  globalThis.__artLoaded = true;
  const amb = new AmbientLife();
  const water = { inBounds: () => true, objectAt: () => null, terrainAt: (x) => (x >= 10 ? TERRAIN.WATER : TERRAIN.STONE), width: 100, height: 100, isBlocked: () => false };
  const game = { world: water, currentZoneName: 'Chinatown', player: { renderCenter: () => ({ x: 0, y: 0 }) } };
  const { ctx, drawn } = drawingCtx();
  const stall = { objId: 'stall_food', def: OBJECTS.stall_food, x: 4, y: 4, depleted: false };
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const t = i * 40;
    amb.update(game, 40, t, 0, 0, 640, 400, 0.1, { rain: 0, storm: 0, gloom: 0 }, false);
    amb.drawGround(ctx, [stall], 0, 0, t);
    amb.drawOver(ctx, [stall], 0, 0, t);
    amb.drawAir(ctx, 0, 0, t);
  }
  for (const d of drawn) if (d.src) seen.add(d.src.replace(/^assets\/fx\//, '').replace(/\.webp$/, ''));
  for (const k of ['critter-cat_tail', 'particle-steam', 'particle-sparkle', 'particle-ripple']) assert.ok([...seen].some((s) => s.startsWith(k)), `${k} drawn (${[...seen].join(' ')})`);
  assert.ok(RIPPLE_CAP <= 4, 'only a few ripples at once');
  // Asleep at night: the curled-up cat; and a low-graphics frame draws nothing at all.
  drawn.length = 0;
  amb.update(game, 40, 0, 0, 0, 640, 400, 0.9, { rain: 0, storm: 0, gloom: 0 }, false);
  amb.drawGround(ctx, [stall], 0, 0, 0);
  assert.ok(drawn.some((d) => /critter-cat_curl-[23]/.test(d.src)), 'curled up, breathing');
  drawn.length = 0;
  amb.update(game, 40, 0, 0, 0, 640, 400, 0.1, null, true);
  amb.drawGround(ctx, [stall], 0, 0, 0); amb.drawOver(ctx, [stall], 0, 0, 0); amb.drawAir(ctx, 0, 0, 0);
  assert.equal(drawn.length, 0, 'low graphics: off');
});
