// World atmosphere and ambient life (atmosphere.js, ambient.js, and their hooks
// in lighting.js, weather.js and the renderer): the grade picked for the time
// of day and the region (blended across borders), the lights the night adds,
// that every new touch switches off in low graphics and while frames run slow,
// and that nothing they cache grows frame after frame.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { Renderer } from '../src/render/renderer.js';
import { OBJECTS } from '../src/data/objects.js';
import { TILE } from '../src/config.js';
import { timeGrade, blendedMood, Atmosphere, BLEND_TILES, moonDark, CRISP_CLEAR } from '../src/render/atmosphere.js';
import { AmbientLife, windAt, swayLean, swayKind, LEAF_CAP, GLINT_CAP, BIRD_CAP, FLOCK_CAP } from '../src/render/ambient.js';
import { LIGHTS, LightPass, NEON, NEON_ZONES } from '../src/render/lighting.js';
import { HAZY, Weather, MIST_REGIONS, cloudShadeAt, CLOUD_ALPHA, CLOUD_COUNT } from '../src/render/weather.js';
import { moodFor, ZONE_MOOD } from '../src/render/ambience.js';

// A 2D context that records every call made on it.
function recordingCtx() {
  const calls = [];
  const grad = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'getTransform') return undefined;
      return (...a) => { calls.push(k); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

// A stand-in DOM whose canvases record their drawing, counting the canvases made.
function withFakeDom(fn) {
  const made = { canvases: 0 };
  globalThis.document = { createElement: () => { made.canvases++; return { width: 0, height: 0, getContext: () => recordingCtx() }; } };
  try { return fn(made); } finally { delete globalThis.document; }
}

const freshGame = () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.camera.resize(800, 600);
  return g;
};

// ---------------- The time of day ----------------
test('the grade follows the day: crisp at noon, moonlit blue at night, neither at dawn and dusk', () => {
  const noon = timeGrade(0.5), mid = timeGrade(0), dusk = timeGrade(0.75), dawn = timeGrade(0.25);
  assert.ok(noon.crisp > 0.95 && noon.moon === 0, 'noon is crisp and bright');
  assert.ok(mid.moon > 0.95 && mid.crisp === 0, 'midnight is moonlit');
  for (const g of [dusk, dawn]) assert.ok(g.crisp < 0.05 && g.moon < 0.05, 'the golden hour (cosylight.js) has dawn and dusk to itself');
  assert.ok(timeGrade(0.5, 1).crisp < 0.05, 'an overcast storm takes the midday sparkle away');
  assert.ok(timeGrade(0.5, 0.3).crisp < noon.crisp, 'rain mutes it');
  // Folded into the one grade fill: noon burns off haze, the night turns moonlit blue.
  const a = new Atmosphere(), mood = [150, 214, 130, 0.08];
  assert.ok(Math.abs(a.crisp(mood, 0.5, 0)[3] - 0.08 * (1 - CRISP_CLEAR)) < 1e-6, 'a clear noon thins the haze');
  assert.equal(a.crisp(mood, 0.75, 0)[3], 0.08, 'dusk keeps it');
  assert.equal(a.crisp(mood, 0.5, 0), a.crisp(mood, 0.4, 0), 'one array, reused');
  const dusk0 = moonDark(0), moon = moonDark(1);
  assert.ok(moon[2] > dusk0[2] && moon[2] > moon[0] * 3, 'the small hours are a clear blue');
  const lp = new LightPass();
  lp.draw(recordingCtx(), { dayPhase: () => 0 }, [0, 0, 0, 0], 1, null, 0, 0, 800, 600, 0);
  // Headless the pass returns early, so check the colour it keeps is the moon's once drawn with a DOM.
  withFakeDom(() => {
    const lp2 = new LightPass();
    const g = freshGame(); g.playMs = 0;
    lp2.draw(recordingCtx(), g, [0, 0, 0, 0], 1, null, 0, 0, 800, 600, 0);
    assert.deepEqual(lp2._dark.slice(0, 3), moonDark(1).slice(0, 3), 'midnight darkness is the moonlit blue');
  });
  // Smooth through the day: no jumps between neighbouring moments.
  for (let p = 0; p < 1; p += 0.005) {
    const a = timeGrade(p), b = timeGrade(p + 0.005);
    assert.ok(Math.abs(a.crisp - b.crisp) < 0.08 && Math.abs(a.moon - b.moon) < 0.08, `smooth at ${p.toFixed(3)}`);
  }
});

// ---------------- Regions ----------------
test('each region keeps its character: green-hazed Bukit Timah, warm Sentosa, cool Marina Bay, misty Wilderness', () => {
  const bt = moodFor('Bukit Timah'), sen = moodFor('Sentosa Beach'), mb = moodFor('Marina Bay');
  assert.ok(bt[1] > bt[0] && bt[1] > bt[2], 'Bukit Timah is a green haze');
  assert.ok(sen[0] > sen[2] && sen[1] > sen[2], 'Sentosa is sunny and warm');
  assert.ok(mb[2] > mb[0], 'Marina Bay is cool');
  assert.ok(HAZY.get('The Wilderness') > 0.3, 'the Wilderness is always misty');
  for (const z of HAZY.keys()) assert.ok(ZONE_MOOD[z], `${z} is a real region`);
  for (const m of [bt, sen, mb]) assert.ok(m[3] > 0 && m[3] <= 0.2, 'kept subtle');
  // The haze shows in the weather's mist even at noon.
  const w = new Weather();
  w.update({ currentZoneName: 'The Wilderness', playMs: 0, dayPhase: () => 0.5 }, 16);
  assert.ok(w.mist >= HAZY.get('The Wilderness'), 'the Wilderness mist never lifts');
  w.update({ currentZoneName: 'Kampong Glam', playMs: 0, dayPhase: () => 0.5 }, 16);
  assert.equal(w.mist, 0, 'the town is clear at noon');
  assert.ok(!MIST_REGIONS.has('Kampong Glam'));
});

test('the region grade blends across borders instead of snapping', () => {
  // Two regions side by side, split at x = 100.
  const zone = (x) => (x < 100 ? 'Kampong Glam' : 'Bukit Timah');
  const deepTown = blendedMood(zone, moodFor, 50, 50), deepJungle = blendedMood(zone, moodFor, 150, 50);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(deepTown[i] - moodFor('Kampong Glam')[i]) < 1e-6, 'deep in the town it is the town');
    assert.ok(Math.abs(deepJungle[i] - moodFor('Bukit Timah')[i]) < 1e-6, 'deep in the jungle it is the jungle');
  }
  // Walking east over the border the green creeps in gradually.
  let prev = null;
  for (let x = 100 - BLEND_TILES - 1; x <= 100 + BLEND_TILES; x++) {
    const m = blendedMood(zone, moodFor, x, 50);
    if (prev) {
      assert.ok(m[1] - m[0] >= prev[1] - prev[0] - 1e-9, 'greener step by step');
      assert.ok(Math.abs(m[0] - prev[0]) < 60, 'no sudden jump');
    }
    prev = m;
  }
  const edge = blendedMood(zone, moodFor, 99, 50);
  assert.ok(edge[0] < moodFor('Kampong Glam')[0] && edge[0] > moodFor('Bukit Timah')[0], 'at the border it is a mix');
});

test('the renderer samples the region mood only when you move to a new tile', () => {
  const g = freshGame();
  const a = new Atmosphere();
  let looks = 0;
  const zoneAt = g.world.zoneAt.bind(g.world);
  g.world.zoneAt = (x, y) => { looks++; return zoneAt(x, y); };
  const m1 = a.regionMood(g, moodFor);
  const after1 = looks;
  assert.ok(after1 > 0 && after1 <= 9, 'one small ring of samples');
  for (let i = 0; i < 100; i++) assert.equal(a.regionMood(g, moodFor), m1, 'the same array, reused');
  assert.equal(looks, after1, 'no lookups while you stand still');
  g._movePlayerNear(g.player.x + 3, g.player.y, 1);
  a.regionMood(g, moodFor);
  assert.ok(looks > after1, 'a new tile samples again');
  g.world.zoneAt = zoneAt;
});

// ---------------- Lights ----------------
test('shop signs, homes and hideouts light up, and the neon districts tint their lamps', () => {
  for (const id of ['sign', 'home_plot', 'smugglers_hold', 'rift_treasury']) {
    assert.ok(OBJECTS[id], `${id} is a real object`);
    assert.ok(LIGHTS[id] && LIGHTS[id].r > 0, `${id} gives off light`);
  }
  for (const z of NEON_ZONES) assert.ok(ZONE_MOOD[z], `${z} is a real region`);
  const g = freshGame();
  const lp = new LightPass();
  lp._scan(g.world, 0);
  const lamps = lp._index.filter((o) => o.objId === 'lamp');
  const neon = lamps.filter((o) => NEON_ZONES.has(g.world.zoneAt(o.x, o.y)?.name));
  const plain = lamps.filter((o) => !NEON_ZONES.has(g.world.zoneAt(o.x, o.y)?.name));
  assert.ok(neon.length > 0 && plain.length > 0, 'lamps in and out of the neon districts');
  for (const o of neon) assert.ok(NEON.lamp.includes(lp._tint.get(o)), 'a neon lamp glows pink or cyan');
  for (const o of plain) assert.equal(lp._tint.get(o), undefined, 'other lamps keep their warm light');
  // Placed at a Marina Bay lamp at night, a neon colour is among the lights gathered.
  const o = neon[0];
  g._movePlayerNear(o.x, o.y + 1, 2);
  const lights = lp.gather(g, g.player.x * TILE - 400, g.player.y * TILE - 300, 800, 600, 0);
  assert.ok(lights.some((L) => NEON.lamp.includes(L.rgb)), 'the neon is lit');
});

test('the light pool round lamps and fires is one baked sprite per colour, not a gradient a frame', () => {
  withFakeDom((made) => {
    const a = new Atmosphere();
    const ctx = recordingCtx();
    for (let i = 0; i < 500; i++) a.pool(ctx, 10, 10, 20 + (i % 7), [255, 190, 110], 0.3);
    assert.equal(a._pools.size, 1, 'one sprite for the colour');
    assert.equal(made.canvases, 1, 'baked once');
    assert.equal(ctx.calls.filter((c) => c === 'drawImage').length, 500, 'each pool is one stamp');
    assert.ok(!ctx.calls.includes('createRadialGradient'));
  });
});

// ---------------- Ambient life ----------------
test('the breeze: gusting, stronger in storms, and only plants lean', () => {
  for (let t = 0; t < 600000; t += 997) {
    const w = windAt(t);
    assert.ok(w >= 0 && w <= 1);
    assert.ok(windAt(t, 1, 1) >= w, 'a storm blows harder');
  }
  const obj = (objId, type, depleted = false) => ({ objId, x: 3, y: 4, depleted, def: { type } });
  for (const [id, type] of [['palm', 'scenery'], ['bamboo', 'tree'], ['oak', 'tree']]) {
    assert.ok(swayKind(obj(id, type)), `${id} sways`);
    let moved = 0;
    for (let t = 0; t < 5000; t += 100) moved = Math.max(moved, Math.abs(swayLean(obj(id, type), t, 0.8)));
    assert.ok(moved > 0.005 && moved < 0.2, `${id} leans a little, never far`);
  }
  assert.equal(swayKind(obj('oak', 'tree', true)), null, 'a stump stays put');
  // Low plants only sway when brushed (ambience.js): a sheared picture costs more to draw.
  for (const [id, type] of [['flower', 'scenery'], ['bush', 'scenery'], ['lamp', 'scenery'], ['bank_booth', 'bank'], ['copper_rock', 'rock']]) assert.equal(swayLean(obj(id, type), 1234, 1), 0, `${id} doesn't sway`);
});

// Run a stretch of frames of ambient life in a place, returning it.
function runAmbient(game, frames, { low = false, ctx = recordingCtx(), night = 0.1 } = {}) {
  const amb = new AmbientLife();
  // (Around the player's tile: renderCenter lags a teleport until the next update.)
  const ox = game.player.x * TILE - 400, oy = game.player.y * TILE - 300;
  const wx = { rain: 0, storm: 0, gloom: 0 };
  const objs = [];
  game.world.objectsIn(Math.floor(ox / TILE), Math.floor(oy / TILE), Math.ceil((ox + 800) / TILE), Math.ceil((oy + 600) / TILE), objs);
  for (let i = 0; i < frames; i++) {
    const t = i * 16;
    amb.update(game, 16, t, ox, oy, 800, 600, night, wx, low);
    amb.drawGround(ctx, objs, ox, oy, t);
    amb.drawOver(ctx, objs, ox, oy, t);
    amb.drawAir(ctx, ox, oy, t);
  }
  return amb;
}

test('ambient life in town: birds, cats and steam come and go from fixed pools, within their caps', () => {
  const g = freshGame();
  // The Kampong Glam food stall: a cat, steam and town birds nearby.
  const stall = g.world.objects.find((o) => o.objId === 'stall_food' && g.world.zoneAt(o.x, o.y)?.name === 'Kampong Glam');
  g._movePlayerNear(stall.x - 6, stall.y - 4, 2);
  g.currentZoneName = 'Kampong Glam';
  const rnd = Math.random;
  let rolls = 0;
  Math.random = () => { rolls++; return rnd(); };
  let amb;
  try {
    withFakeDom((made) => {
      const ctx = recordingCtx();
      amb = runAmbient(g, 4000, { ctx });
      assert.ok(amb.on);
      assert.ok(Object.keys(amb._sprites).length <= 10, 'a handful of baked sprites');
      const before = made.canvases;
      runAmbient(g, 10, { ctx });   // (a new instance bakes its own)
      assert.ok(made.canvases - before <= 10);
      assert.ok(ctx.calls.filter((c) => c === 'drawImage').length > 0, 'it draws');
    });
  } finally { Math.random = rnd; }
  assert.equal(rolls, 0, 'never rolls the game\'s Math.random');
  assert.equal(amb.leaves.length, LEAF_CAP, 'the leaf pool never grows');
  assert.equal(amb.birds.m.length, BIRD_CAP, 'nor the birds\'');
  assert.ok(amb.live <= LEAF_CAP + FLOCK_CAP + BIRD_CAP);
  assert.ok(amb._water.length <= 2 * 30 * 25, 'the water list holds the view at most');
});

test('water glints wink on the sea in view, capped', () => {
  const g = freshGame();
  g._movePlayerNear(30, 96, 2);
  g.currentZoneName = 'Sentosa Beach';
  withFakeDom(() => {
    const amb = runAmbient(g, 60);
    assert.ok(amb._water.length > 0, 'the sea is in view');
    const ctx = recordingCtx();
    let most = 0;
    amb.drawn = 0;
    for (let t = 0; t < 4000; t += 50) { amb._glints(ctx, g.player.x * TILE - 400, g.player.y * TILE - 300, t); most = Math.max(most, amb.drawn); amb.drawn = 0; }
    assert.ok(most > 0 && most <= GLINT_CAP, `up to ${GLINT_CAP} glints at once (saw ${most})`);
  });
});

test('low graphics and slow frames switch every ambient touch off', () => {
  const g = freshGame();
  const stall = g.world.objects.find((o) => o.objId === 'stall_food');
  g._movePlayerNear(stall.x - 3, stall.y, 2);
  g.currentZoneName = g.world.zoneAt(g.player.x, g.player.y).name;
  withFakeDom(() => {
    const ctx = recordingCtx();
    const amb = runAmbient(g, 600, { low: true, ctx });
    assert.equal(amb.on, false);
    assert.equal(ctx.calls.length, 0, 'not one draw call');
    assert.equal(amb.live, 0, 'nothing alive');
    assert.equal(amb.lean({ objId: 'palm', x: 1, y: 1, def: { type: 'scenery' } }, 500), 0, 'plants stand still');
  });
  // Through the renderer: low graphics, or the governor's trim, turns it off.
  const r = new Renderer(g, { width: 800, height: 600 }, recordingCtx());
  r.render(1000); r.render(1016);
  assert.equal(r.amb.on, true, 'on at full graphics');
  g.fxTrim = true; r.render(1032);
  assert.equal(r.amb.on, false, 'off while frames run slow (governor.js)');
  g.fxTrim = false; g.lowFx = true; r.render(1048);
  assert.equal(r.amb.on, false, 'off in low graphics');
});

test('a headless renderer frame runs every new layer without a DOM, at noon, dusk, night and in rain', () => {
  const g = freshGame();
  const r = new Renderer(g, { width: 800, height: 600 }, recordingCtx());
  assert.ok(r.atmos && r.amb, 'the renderer carries the atmosphere and ambient life');
  const DAY = 600000;
  for (const phase of [0.5, 0.75, 0.02]) {
    g.playMs = DAY * 5 + DAY * phase;
    for (let i = 0; i < 5; i++) r.render(2000 + i * 16 + phase * 1000);
  }
  r.weather.wet = 1;
  for (let i = 0; i < 5; i++) r.render(9000 + i * 16);
  assert.equal(r.atmos.ok, false, 'no DOM: the baked pools stay off');
});

// Cloud shadows (weather.js): soft shadows of passing clouds on a clear day.
test('cloud shadows drift over clear days only: none at night, in rain or under a roof', () => {
  assert.equal(cloudShadeAt(1, 0, false), 1, 'full on a clear noon');
  assert.equal(cloudShadeAt(0.1, 0, false), 0, 'none at night');
  assert.equal(cloudShadeAt(1, 0.5, false), 0, 'none in steady rain: the sky is all cloud');
  assert.equal(cloudShadeAt(1, 0, true), 0, 'none under a roof');
  const dusk = cloudShadeAt(0.55, 0, false);
  assert.ok(dusk > 0 && dusk < 1, 'fading in and out around dawn and dusk');
  assert.ok(CLOUD_ALPHA > 0 && CLOUD_ALPHA <= 0.25 && CLOUD_COUNT >= 3, 'gentle, and a few at a time');
});

test('the weather keeps its cloud strength up to date, and drawing rain and clouds headless is safe', () => {
  const w = new Weather();
  w.update({ currentZoneName: 'Kampong Glam', playMs: 0, dayPhase: () => 0.5, daylightFactor: () => 1 }, 16);
  assert.ok(w.clouds > 0.9, 'a clear noon in town has cloud shadows');
  w.update({ currentZoneName: 'The Endless Gate', playMs: 0, dayPhase: () => 0.5, daylightFactor: () => 1 }, 16);
  assert.equal(w.clouds, 0, 'none in the sealed arena');
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  w.clouds = 1; w.state.rain = 1;
  for (let i = 0; i < 60; i++) w.drawAir(ctx, 0, 0, 800, 600, 1000 + i * 16, 16, false);   // no document: no cloud picture, no throw
  assert.ok(w._splashes.length <= 36, 'splashes stay capped');
});
