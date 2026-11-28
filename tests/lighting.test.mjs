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
import { DAY_CYCLE_MS, TILE } from '../src/config.js';
import { LIGHTS, lightFor, nightDarkness, skyWashes, LightPass, nightMode, nightMultiply } from '../src/render/lighting.js';
import { moonDark } from '../src/render/atmosphere.js';
import {
  weatherAt, slotWeather, mistAt, regionWeather, Weather, WEATHER_SLOT_MS, RAIN_CHANCE, STORM_CHANCE, MIST_REGIONS, REGION_SKY,
} from '../src/render/weather.js';
import { ZONE_MOOD, composeWashes } from '../src/render/ambience.js';

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

test('a multi-tile facade lights the street from the centre of its frontage', () => {
  const objId = 'shophouse_row_mint', x = 3, y = 4;
  const def = OBJECTS[objId];
  const game = { world: { objects: [{ objId, x, y, def }] } };
  const [light] = new LightPass().gather(game, TILE, TILE, 240, 240, 0);
  assert.equal(light.x, (x - 1 + def.footprint[0] / 2) * TILE);
  assert.equal(light.y, (y - 0.5) * TILE + LIGHTS[objId].y);
  assert.equal(light.rgb, LIGHTS[objId].rgb);
});

test('the world has lights where you would expect them, and a felled magic tree goes dark', () => {
  const g = freshGame();
  const lamps = g.world.objects.filter((o) => o.objId === 'lamp');
  assert.ok(lamps.length > 10, 'street lamps stand in the towns');
  for (const id of ['heritage_lamp', 'lantern_post', 'lantern_tree', 'five_foot_lantern', 'bollard_light']) {
    const prop = g.world.objects.find((o) => o.objId === id);
    assert.ok(prop, `there is a ${id} in the world`);
    assert.ok(lightFor(prop), `${id} gives off light`);
  }
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

test('Marina Bay has a stronger gold sunset and a clear blue night', () => {
  const draw = (zone, phase, night) => {
    const lp = new LightPass();
    lp.ok = true; lp.layer = { width: 0, height: 0 }; lp.g = recordingCtx();
    const game = { currentZoneName: zone, dayPhase: () => phase, world: { objects: [] } };
    lp.draw(recordingCtx(), game, ZONE_MOOD[zone], night, null, 0, 0, 320, 240, 0);
    return lp;
  };
  const marina = draw('Marina Bay', 0.745, 0);
  const reservoir = draw('MacRitchie Reservoir', 0.745, 0);
  assert.ok(marina._sky[1][3] > reservoir._sky[1][3] + 0.1);
  assert.ok(marina._sky[1][1] > 160 && marina._sky[1][2] < 85);
  const moonlight = draw('Marina Bay', 0, 1)._dark;
  assert.ok(moonlight[2] > 180 && moonlight[2] > moonlight[1] + 95);
});

test('Transit Road lamps and its hawker stall carry amber light with steady reduced motion', () => {
  const transit = 'Transit Road, Nee Soon Camp';
  const objects = [
    { objId: 'lamp', x: 1, y: 2 }, { objId: 'lamp', x: 4, y: 2 },
    { objId: 'hawker_stall_noodle', x: 4, y: 3 }, { objId: 'hawker_stall_noodle', x: 1, y: 3 },
  ];
  const game = { world: { objects, zoneAt: (x) => ({ name: x > 2 ? transit : 'Kampong Glam' }) }, reduceMotion: true };
  const lp = new LightPass();
  const light = lp.gather(game, 0, 0, 300, 250, 10).map((entry) => ({ ...entry }));
  assert.equal(light.length, 3);
  assert.equal(light[0].rgb, LIGHTS.lamp.rgb);
  assert.ok(light[1].r > light[0].r && light[1].rgb[1] < light[0].rgb[1]);
  assert.equal(light[2].y, 3.5 * TILE - 18);
  assert.deepEqual(lp.gather(game, 0, 0, 300, 250, 520), light);
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

// What the light pass does to one pixel `dst` with no lamp near (the model of
// draw(): a wash by day, then the wash fading into the multiply as the lamps come on).
function gradedPixel(dst, night, mood, moon) {
  const nd = nightDarkness(night), dark = moonDark(moon, [0, 0, 0, nd]);
  const sky = skyWashes(0.745);
  const washes = [mood, ...sky];
  if (nd < 0.03) {
    const gr = composeWashes([...washes, dark]);
    return dst.map((c, i) => c * (1 - gr[3]) + gr[i] * gr[3]);
  }
  const u = nightMode(nd), gr = composeWashes(washes), m = nightMultiply(gr, u, dark);
  const a = gr[3] * (1 - u);
  return dst.map((c, i) => (c * (1 - a) + gr[i] * a) * m[i] / 255);
}

test('night is a deep moonlit blue that keeps white rims and navy ink apart, and comes on without a jump', () => {
  const mood = [255, 206, 130, 0.07], white = [255, 255, 255], ink = [34, 48, 74], paving = [196, 190, 178];
  const mid = (c) => gradedPixel(c, 1, mood, 1);
  const w = mid(white), k = mid(ink), p = mid(paving);
  assert.ok(w[2] > w[0] + 40, 'white comes out a pale moonlit blue');
  assert.ok(p[2] > p[0] * 1.3, 'the ground goes a cool blue, not grey');
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  assert.ok(lum(p) < 0.6 * lum(paving), 'properly dark');
  // The old wash pulled white and ink toward each other; the multiply keeps them apart.
  const nd = nightDarkness(1), oldGr = composeWashes([mood, [10, 28, 86, nd]]);
  const old = (c) => c.map((v, i) => v * (1 - oldGr[3]) + oldGr[i] * oldGr[3]);
  assert.ok(lum(w) / lum(k) > 1.5 * (lum(old(white)) / lum(old(ink))), 'rims stand out from the ink far more than before');
  assert.ok(lum(w) - lum(p) > lum(old(white)) - lum(old(paving)), 'and from the ground');
  // From noon to midnight and back, no visible step between neighbouring moments.
  for (const c of [white, ink, paving]) {
    let prev = gradedPixel(c, 0, mood, 0);
    for (let n = 0.002; n <= 1; n += 0.002) {
      const cur = gradedPixel(c, n, mood, Math.max(0, (n - 0.6) / 0.4));
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(cur[i] - prev[i]) < 3, `smooth at night ${n.toFixed(3)} (${c})`);
      prev = cur;
    }
  }
  assert.equal(nightMode(0.02), 0); assert.equal(nightMode(0.5), 1);
  assert.deepEqual(nightMultiply([0, 0, 0, 0], 1, [0, 0, 0, 0]), [255, 255, 255], 'no night, no grade: the map is white (changes nothing)');
});

test('after dark the light pass is one multiply layer with the lamps painted in, and it carries the vignette', () => {
  const g = freshGame();
  const lamp = g.world.objects.find((o) => o.objId === 'lamp');
  g._movePlayerNear(lamp.x, lamp.y + 2, 3);
  g.playMs = 0;   // midnight
  // A context that notes the blend mode each drawing call was made with.
  const logCtx = () => {
    const calls = [];
    return new Proxy({ calls, globalCompositeOperation: 'source-over', globalAlpha: 1 }, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
        return () => { calls.push(`${String(k)}:${t.globalCompositeOperation}`); };
      },
      set(t, k, v) { t[k] = v; return true; },
    });
  };
  const made = [];
  globalThis.document = { createElement: () => { const c = { width: 0, height: 0, ctx: logCtx() }; c.getContext = () => c.ctx; made.push(c); return c; } };
  try {
    const lp = new LightPass();
    const c = g.player.renderCenter();
    const screen = logCtx();
    assert.equal(lp.draw(screen, g, [255, 206, 130, 0.07], 1, null, c.x - 400, c.y - 300, 800, 600, 0), true);
    assert.deepEqual(screen.calls, ['drawImage:multiply'], 'one full-screen draw, multiplied');
    assert.equal(screen.globalCompositeOperation, 'source-over', 'left as it was found');
    assert.ok(lp.count >= 2, 'the lamp and the hero light the map');
    assert.equal(lp.vignetted, true, 'the vignette went into the map, so the renderer skips its own');
    const layer = made.find((m) => m === lp.layer);
    const pools = layer.ctx.calls.filter((k) => k === 'drawImage:source-over');
    assert.ok(pools.length >= lp.count, 'each light is one stamp into the map (plus the vignette)');
    // Early dusk: the last of the day's wash is still laid on under the multiply.
    const dusk = logCtx();
    lp.draw(dusk, g, [255, 206, 130, 0.07], 0.5, null, c.x - 400, c.y - 300, 800, 600, 0);
    assert.deepEqual(dusk.calls, ['fillRect:source-over', 'drawImage:multiply']);
    // By day nothing changes: one plain fill, no vignette taken.
    const day = logCtx();
    lp.draw(day, g, [255, 206, 130, 0.07], 0, null, 0, 0, 800, 600, 0);
    assert.deepEqual(day.calls, ['fillRect:source-over']);
    assert.equal(lp.vignetted, false);
  } finally { delete globalThis.document; }
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
    assert.equal(strokes, 2, 'all the streaks in two strokes: the far layer and the near one');
    return moves;
  };
  assert.ok(Math.abs(streaks(true) - streaks(false) / 2) <= 1, 'half the streaks on a small screen');
});

test('cloud shadows ride the light pass: painted into its small layer, with no full-screen layer of their own', () => {
  const g = freshGame();
  const lp = new LightPass();
  // A stand-in layer (headless has no canvas): record what is drawn where.
  const layerCtx = recordingCtx();
  lp.ok = true; lp.layer = { width: 0, height: 0 }; lp.g = layerCtx;
  const seen = [];
  const wx = { gloom: 0, flash: 0, washes: [], flashWash: [0, 0, 0, 0], clouds: 1, cloudsInto: (gg, ...a) => seen.push([gg, ...a]) };
  const day = recordingCtx();
  assert.equal(lp.draw(day, g, [0, 0, 0, 0], 0, wx, 10, 20, 800, 600, 1000), true);
  assert.equal(seen.length, 1, 'the clouds are painted once');
  assert.equal(seen[0][0], layerCtx, '...into the light layer');
  const onScreen = day.calls.filter((c) => c === 'drawImage' || c === 'fillRect');
  assert.equal(onScreen.length, 1, 'one full-screen draw, as without clouds');
  // No clouds (night, rain, trimmed): the plain daylight fill.
  wx.clouds = 0; seen.length = 0;
  const plain = recordingCtx();
  lp.draw(plain, g, [10, 10, 10, 0.1], 0, wx, 0, 0, 800, 600, 1000);
  assert.equal(seen.length, 0);
  assert.deepEqual(plain.calls, ['fillRect']);
});
