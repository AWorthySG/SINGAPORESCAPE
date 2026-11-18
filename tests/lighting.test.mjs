// Night lighting and weather (lighting.js, weather.js): the light table names
// real objects, the forecast depends on the game clock alone, the region skies
// do what they say, and the light pass does nothing (and so costs nothing)
// headless, where the renderer keeps its old flat grade.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { Renderer } from '../src/render/renderer.js';
import { OBJECTS } from '../src/data/objects.js';
import { DAY_CYCLE_MS } from '../src/config.js';
import { LIGHTS, lightFor, nightDarkness, skyWashes, LightPass } from '../src/render/lighting.js';
import {
  weatherAt, slotWeather, mistAt, regionWeather, Weather, WEATHER_SLOT_MS, RAIN_CHANCE, STORM_CHANCE, MIST_REGIONS, REGION_SKY,
} from '../src/render/weather.js';
import { ZONE_MOOD } from '../src/render/ambience.js';

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

const freshGame = () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.camera.resize(800, 600);
  return g;
};

// ---------------- Lights ----------------
test('every entry in the light table is a real object, with a sensible light', () => {
  for (const [id, L] of Object.entries(LIGHTS)) {
    assert.ok(OBJECTS[id], `${id} is a real object id`);
    assert.ok(L.r > 20 && L.r < 200, `${id} has a sensible radius`);
    assert.ok(Array.isArray(L.rgb) && L.rgb.length === 3 && L.rgb.every((c) => c >= 0 && c <= 255), `${id} has an RGB colour`);
  }
  // The night's main lights are all covered.
  for (const id of ['lamp', 'fire', 'furnace', 'range', 'magic_tree', 'skyglass_crystal', 'shrine', 'wave_gate', 'mrt_station']) {
    assert.ok(LIGHTS[id], `${id} gives off light`);
  }
});

test('the world has lights where you would expect them, and a felled magic tree goes dark', () => {
  const g = freshGame();
  const lamps = g.world.objects.filter((o) => o.objId === 'lamp');
  assert.ok(lamps.length > 10, 'street lamps stand in the towns');
  const tree = g.world.objects.find((o) => o.objId === 'magic_tree');
  assert.ok(lightFor(tree), 'a magic tree glows');
  tree.depleted = true;
  assert.equal(lightFor(tree), null, 'its stump does not');
  tree.depleted = false;
  assert.equal(lightFor(g.world.objects.find((o) => o.objId === 'oak')), null, 'an oak gives no light');
});

test('darkness and sky tints follow the clock: dark at midnight, amber at dusk, clear at noon', () => {
  assert.equal(nightDarkness(0), 0, 'no darkness at noon');
  assert.ok(nightDarkness(1) > 0.4 && nightDarkness(1) < 0.6, 'deep but readable at midnight');
  assert.ok(nightDarkness(0.5) < nightDarkness(0.8), 'darker as the night deepens');
  const noon = skyWashes(0.5), dusk = skyWashes(0.745), dawn = skyWashes(0.255);
  assert.ok(noon[0][3] < 0.01 && noon[1][3] < 0.01, 'no dawn or dusk tint at noon');
  assert.ok(dusk[1][3] > 0.12, 'an amber dusk');
  assert.ok(dawn[0][3] > 0.1, 'a rosy dawn');
  assert.ok(skyWashes(0.63)[2][3] > 0.08, 'a warm haze through the late afternoon');
});

test('gathering lights at night finds the lamps in view, the hero and a fire; capped', () => {
  const g = freshGame();
  const lamp = g.world.objects.find((o) => o.objId === 'lamp');
  g._movePlayerNear(lamp.x, lamp.y + 2, 3);
  g.world.lightFire(g.player.x + 2, g.player.y);
  const lp = new LightPass();
  const c = g.player.renderCenter();
  const ox = c.x - 400, oy = c.y - 300;
  const lights = lp.gather(g, ox, oy, 800, 600, 1000);
  assert.ok(lights.length >= 3, 'the lamp, the fire and the hero');
  assert.ok(lights.some((L) => L.rgb === LIGHTS.fire.rgb), 'the new fire lights up straight away');
  assert.ok(lights.some((L) => L.rgb === LIGHTS.lamp.rgb), 'the lamp');
  assert.ok(lights.every((L) => L.k > 0 && L.k <= 1.2), 'flicker stays in range');
});

test('the light pass is a no-op headless: no drawing at all, and the renderer keeps its flat grade', () => {
  const g = freshGame();
  const lp = new LightPass();
  assert.equal(lp.ok, false, 'no DOM, so no light layer');
  const ctx = recordingCtx();
  assert.equal(lp.draw(ctx, g, [0, 0, 0, 0], 1, null, 0, 0, 800, 600, 0), false);
  assert.equal(ctx.calls.length, 0, 'nothing was drawn');
  // Through the renderer at midnight it falls back to the single flat fill.
  g.playMs = 0;
  const rctx = recordingCtx();
  const r = new Renderer(g, {}, rctx);
  assert.doesNotThrow(() => { r.render(16); r.render(32); });
  assert.equal(r.lights.count, 0);
});

// ---------------- Weather ----------------
test('the weather is deterministic for a given game time', () => {
  for (let ms = 0; ms < 40 * WEATHER_SLOT_MS; ms += 7919) {
    const a = weatherAt(ms), b = weatherAt(ms);
    assert.deepEqual(a, b, `same sky at ${ms}`);
  }
  // A fresh Weather in another renderer agrees for the same clock.
  const g = freshGame();
  g.currentZoneName = 'Kampong Glam';
  const rainy = [...Array(200).keys()].find((s) => slotWeather(s) === 1 && slotWeather(s - 1) && slotWeather(s + 1)) ??
    [...Array(200).keys()].find((s) => slotWeather(s) === 1);
  g.playMs = (rainy + 0.5) * WEATHER_SLOT_MS;
  const w1 = new Weather().update(g, 16), w2 = new Weather().update(g, 16);
  assert.ok(w1.rain > 0.3, 'it rains mid-slot');
  assert.equal(w1.rain, w2.rain);
});

test('rain comes a few minutes at a time, storms are rarer, and it eases in and out', () => {
  const N = 5000, n = [0, 0, 0];
  for (let s = 0; s < N; s++) n[slotWeather(s)]++;
  assert.ok(Math.abs(n[1] + n[2] - N * RAIN_CHANCE) < N * 0.03, `about ${RAIN_CHANCE * 100}% of slots rain`);
  assert.ok(n[2] > 0 && n[2] < n[1] / 2, 'storms are the rarer kind');
  assert.ok(WEATHER_SLOT_MS >= 90000 && WEATHER_SLOT_MS <= 240000, 'a spell of weather lasts a few minutes');
  // At the first moment of a rain after a dry slot, the rain has barely begun.
  const s = [...Array(500).keys()].find((i) => slotWeather(i) === 1 && !slotWeather(i - 1));
  assert.ok(weatherAt(s * WEATHER_SLOT_MS + 10).rain < 0.01, 'eases in');
  assert.ok(weatherAt((s + 0.5) * WEATHER_SLOT_MS).rain > 0.5, 'full in the middle');
  // Storms flash now and then; plain rain never does.
  const st = [...Array(500).keys()].find((i) => slotWeather(i) === 2);
  let flashes = 0;
  for (let ms = (st + 0.3) * WEATHER_SLOT_MS; ms < (st + 0.7) * WEATHER_SLOT_MS; ms += 30) if (weatherAt(ms).flash > 0.5) flashes++;
  assert.ok(flashes > 0, 'lightning in a storm');
  for (let ms = (s + 0.3) * WEATHER_SLOT_MS; ms < (s + 0.7) * WEATHER_SLOT_MS; ms += 500) assert.equal(weatherAt(ms).flash, 0);
});

test('region weather: snow on the Peaks, embers and no rain in the Rift, nothing in the sealed arena', () => {
  const wet = { rain: 0.8, storm: 1, flash: 0.5 };
  assert.ok(regionWeather('The Celestial Peaks', wet).snow > 0.5 && regionWeather('The Celestial Peaks', wet).rain === 0);
  assert.ok(regionWeather('The Celestial Peaks', { rain: 0, storm: 0, flash: 0 }).snow > 0, 'a few flurries even on a dry day');
  const rift = regionWeather('The Shadow Rift', wet);
  assert.equal(rift.rain, 0); assert.ok(rift.embers > 0);
  assert.deepEqual(regionWeather('The Endless Gate', wet), { rain: 0, snow: 0, embers: 0, storm: 0, flash: 0 });
  assert.equal(regionWeather('Kampong Glam', wet).rain, 0.8);
  // The region skies and mist regions name real regions.
  for (const z of [...Object.keys(REGION_SKY), ...MIST_REGIONS]) assert.ok(ZONE_MOOD[z], `${z} is a real region`);
  const rs = REGION_SKY['The Shadow Rift'];
  assert.ok(rs[0] > rs[1] + 80 && rs[0] > rs[2], 'the Rift sky is red');
  const cp = REGION_SKY['The Celestial Peaks'];
  assert.ok(cp[2] > cp[0], 'the Peaks are cold');
});

test('dawn mist fills the forests only, and only around dawn', () => {
  assert.ok(mistAt(0.27) > 0.95 && mistAt(0.5) < 0.01 && mistAt(0) < 0.01);
  const g = freshGame();
  g.playMs = 0.27 * DAY_CYCLE_MS;
  const w = new Weather();
  // A dry slot, so rain doesn't add to the mist.
  while (slotWeather(Math.floor(g.playMs / WEATHER_SLOT_MS))) g.playMs += DAY_CYCLE_MS;
  g.currentZoneName = 'Bukit Timah'; w.update(g, 16);
  assert.ok(w.mist > 0.8, 'misty Bukit Timah at dawn');
  g.currentZoneName = 'Kampong Glam'; w.update(g, 16);
  assert.equal(w.mist, 0, 'no mist in town');
});

test('weather is looks only: rendering a storm changes nothing in the game', () => {
  const g = freshGame();
  const st = [...Array(500).keys()].find((i) => slotWeather(i) === 2);
  g.playMs = (st + 0.5) * WEATHER_SLOT_MS;
  const before = JSON.stringify({ hp: g.player.hp, x: g.player.x, y: g.player.y, inv: g.inventory.slots });
  const r = new Renderer(g, {}, recordingCtx());
  for (let i = 0; i < 30; i++) r.render(i * 16);
  assert.equal(JSON.stringify({ hp: g.player.hp, x: g.player.x, y: g.player.y, inv: g.inventory.slots }), before);
  assert.ok(r.weather.wet > 0, 'the ground is getting wet though');
});

test('small and touch screens get half the rain and no puddle sheen', () => {
  const w = new Weather();
  assert.equal(w.small(), false, 'headless counts as a big screen');
  globalThis.innerWidth = 600;
  try { assert.equal(w.small(), true, 'a narrow window is small'); } finally { delete globalThis.innerWidth; }
  w._coarse = { matches: true };
  assert.equal(w.small(), true, 'a touch screen is small');
  // Count the streaks drawn, and the strokes they take.
  const streaks = (small) => {
    const ww = new Weather(); ww._coarse = { matches: small }; ww.state.rain = 1;
    let moves = 0, strokes = 0;
    const ctx = new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : k === 'moveTo' ? () => { moves++; } : k === 'stroke' ? () => { strokes++; } : () => {}),
      set: (t, k, v) => { t[k] = v; return true; },
    });
    ww._rain(ctx, 1100, 620, 16, false);
    assert.equal(strokes, 1, 'all the streaks in a single stroke');
    return moves;
  };
  assert.ok(Math.abs(streaks(true) - streaks(false) / 2) <= 1, 'half the streaks on a small screen');
});
