// A living world: the wind field (wind.js) that moves the plants, leaves and
// air together, the motes, glow-flies, spray and sand in the air
// (airmotes.js), and the camera's follow spring (camera.js). Pure helpers
// checked headless, then their hooks in the renderer and the camera.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { Renderer } from '../src/render/renderer.js';
import { TILE } from '../src/config.js';
import { gustAt, localWind, plantLean, GUST_SPEED, WIND_DX } from '../src/render/wind.js';
import { AmbientLife, swayLean, SWAY_NEAR } from '../src/render/ambient.js';
import { AirMotes, moteRates, MOTE_CAP, MOTE_CAP_TRIM, MOTE_CAP_CALM, MOTE, GLOW, SPRAY, SAND } from '../src/render/airmotes.js';
import { Camera } from '../src/engine/camera.js';
import { Cinematics } from '../src/game/cinematics.js';

const freshGame = () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.camera.resize(800, 600);
  return g;
};

// ---------------- The wind field ----------------
test('gusts: the same at the same place and moment, between a lull and a full gust', () => {
  let lo = 1, hi = 0;
  for (let i = 0; i < 4000; i++) {
    const x = (i * 97) % 9000, y = (i * 53) % 7000, t = i * 311;
    const g = gustAt(x, y, t);
    assert.equal(g, gustAt(x, y, t), 'deterministic');
    assert.ok(g >= 0 && g <= 1);
    lo = Math.min(lo, g); hi = Math.max(hi, g);
    const w = localWind(x, y, t, 0.8);
    assert.ok(w >= 0 && w <= 1.25 * 0.8 + 1e-9);
  }
  assert.ok(lo < 0.05 && hi > 0.95, `there are lulls and full gusts (${lo.toFixed(2)}..${hi.toFixed(2)})`);
});

test('a gust front rolls downwind: a spot further east feels it later', () => {
  // Cross-correlate the gusts at two points 320px apart along the wind.
  const D = 320, step = 40, n = 2000;
  const a = [], b = [];
  for (let i = 0; i < n; i++) { a.push(gustAt(1000, 500, i * step)); b.push(gustAt(1000 + D, 500, i * step)); }
  let best = 0, bestLag = 0;
  for (let lag = 0; lag < 150; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += (a[i] - 0.5) * (b[i + lag] - 0.5);
    if (s > best) { best = s; bestLag = lag; }
  }
  const want = D * WIND_DX / GUST_SPEED;
  assert.ok(Math.abs(bestLag * step - want) < want * 0.35, `arrives ~${Math.round(want)}ms later (${bestLag * step}ms)`);
});

test('plants lean downwind in a gust, flutter out of step, and never far', () => {
  let sum = 0, max = 0, same = 0;
  for (let t = 0; t < 60000; t += 50) {
    const a = plantLean(0.08, 100, 100, t, 0.8, 0.004, 0.3), b = plantLean(0.08, 196, 100, t, 0.8, 0.004, 2.9);
    sum += a; max = Math.max(max, Math.abs(a));
    if (Math.abs(a - b) < 0.002) same++;
  }
  assert.ok(sum < 0, 'on average the tops lean east, the way the wind blows');
  assert.ok(max < 0.08 * 1.2, `bounded (${max.toFixed(3)})`);
  assert.ok(same < 1200 * 0.2, 'neighbours do not rock in lock-step');
  // A still day: only a faint idle flutter.
  let still = 0;
  for (let t = 0; t < 10000; t += 50) still = Math.max(still, Math.abs(plantLean(0.08, 100, 100, t, 0, 0.004, 0.3)));
  assert.ok(still < 0.01, 'barely moves with no wind');
});

test('bushes and flowers sway in the breeze near you only; lamps never', () => {
  const amb = new AmbientLife();
  amb.on = true; amb.wind = 0.8; amb._px = 50; amb._py = 50;
  const plant = (objId, x, y) => ({ objId, x, y, def: { type: 'scenery' } });
  let near = 0, far = 0, lamp = 0;
  for (let t = 0; t < 8000; t += 40) {
    near = Math.max(near, Math.abs(amb.lean(plant('bush', 52, 49), t)));
    far = Math.max(far, Math.abs(amb.lean(plant('flower', 50 + SWAY_NEAR + 2, 50), t)));
    lamp = Math.max(lamp, Math.abs(amb.lean(plant('lamp', 51, 50), t)));
  }
  assert.ok(near > 0.005, 'a bush beside you sways');
  assert.equal(far, 0, 'one far across the screen stands still (a sheared picture costs a little more)');
  assert.equal(lamp, 0);
  // The tall plants sway wherever they are.
  assert.ok(Math.abs(swayLean({ objId: 'palm', x: 400, y: 9, def: { type: 'scenery' } }, 1234, 0.8)) > 0 || Math.abs(swayLean({ objId: 'palm', x: 400, y: 9, def: { type: 'scenery' } }, 2345, 0.8)) > 0);
});

// ---------------- Things in the air ----------------
test('what is in the air depends on the region and the hour', () => {
  const dry = { rain: 0 }, wet = { rain: 1 };
  const r = (zone, night, wx = dry, wind = 0.5) => moteRates(zone, night, wx, wind).slice();
  assert.ok(r('Bukit Timah', 0)[MOTE] > 0 && r('Bukit Timah', 0)[GLOW] === 0, 'sunlit motes in the forest by day');
  assert.ok(r('Bukit Timah', 1)[GLOW] > 0 && r('Bukit Timah', 1)[MOTE] === 0, 'glow-flies there at night');
  assert.equal(r('Kampong Glam', 1)[GLOW], 0, 'no glow-flies in the town (its lamps are lit)');
  assert.ok(r('Changi Coast', 0)[SPRAY] > 0 && r('Bukit Timah', 0)[SPRAY] === 0, 'spray on the coasts only');
  assert.ok(r('Tekong Badlands', 0)[SAND] > 0 && r('Kampong Glam', 0)[SAND] === 0, 'sand in the badlands only');
  assert.ok(r('Tekong Badlands', 0, dry, 1)[SAND] > r('Tekong Badlands', 0, dry, 0)[SAND], 'more sand in a stronger wind');
  assert.equal(r('Bukit Timah', 0, wet)[MOTE], 0, 'rain clears the air');
  assert.equal(r('Tekong Badlands', 0, wet)[SAND], 0, 'and lays the dust');
});

function runMotes(g, frames, opts = {}, m = new AirMotes(), dt = 16) {
  const ox = g.player.x * TILE - 400, oy = g.player.y * TILE - 300;
  for (let i = 0; i < frames; i++) m.update(g, dt, 1000 + i * dt, ox, oy, 800, 600, opts.night ?? 0.1, { rain: 0 }, opts.wind ?? 0.9, opts);
  return m;
}

test('the air holds a hard cap, fewer while frames run slow or with Reduce motion, none in low graphics', () => {
  const g = freshGame();
  for (const zone of ['Bukit Timah', 'Tekong Badlands', 'Changi Coast', 'Gardens by the Bay']) {
    const z = g.world.zones.find((q) => q.name === zone);
    g._movePlayerNear((z.x0 + z.x1) >> 1, (z.y0 + z.y1) >> 1, 3);
    g.currentZoneName = zone;
    for (const [opts, cap] of [[{}, MOTE_CAP], [{ trim: true }, MOTE_CAP_TRIM], [{ calm: true }, MOTE_CAP_CALM]]) {
      const m = new AirMotes();
      let peak = 0;
      for (let i = 0; i < 400; i++) { runMotes(g, 1, { ...opts, night: zone === 'Bukit Timah' ? 0.9 : 0.1 }, m, 100); peak = Math.max(peak, m.live); }
      assert.ok(peak <= cap, `${zone}: at most ${cap} (${peak})`);
    }
  }
  const z = g.world.zones.find((q) => q.name === 'Bukit Timah');
  g._movePlayerNear((z.x0 + z.x1) >> 1, (z.y0 + z.y1) >> 1, 3);
  g.currentZoneName = 'Bukit Timah';
  assert.ok(runMotes(g, 300).live > 0, 'the forest air is alive at full graphics');
  const low = runMotes(g, 300, { low: true });
  assert.equal(low.on, false); assert.equal(low.live, 0, 'low graphics: nothing in the air');
});

test('the air is the same every run (its own random source, never Math.random)', () => {
  const g = freshGame();
  const z = g.world.zones.find((q) => q.name === 'Bukit Timah');
  g._movePlayerNear((z.x0 + z.x1) >> 1, (z.y0 + z.y1) >> 1, 3);
  g.currentZoneName = 'Bukit Timah';
  const r0 = Math.random;
  Math.random = () => { throw new Error('Math.random was rolled'); };
  try {
    const a = runMotes(g, 500), b = runMotes(g, 500);
    assert.deepEqual(a.pool.map((p) => [p.on, p.k, p.x, p.y]), b.pool.map((p) => [p.on, p.k, p.x, p.y]));
  } finally { Math.random = r0; }
});

test('the air draws nothing headless, and the renderer switches it off in low graphics', () => {
  const g = freshGame();
  const r = new Renderer(g, { width: 800, height: 600 }, new Proxy({}, { get: (t, k) => (k === 'getTransform' ? undefined : k in t ? t[k] : () => ({ addColorStop() {}, width: 10 })), set: (t, k, v) => { t[k] = v; return true; } }));
  for (let i = 0; i < 30; i++) r.render(1000 + i * 16);
  assert.equal(r.motes.on, true);
  g.lowFx = true; r.render(2000);
  assert.equal(r.motes.on, false); assert.equal(r.motes.live, 0);
});

// ---------------- The camera ----------------
// Walk a camera after a target moving right at `speed` px/ms with the given
// frame times, returning the target's offset from the camera centre each frame.
function walk(frames, speed = 0.1) {
  const cam = new Camera(); cam.resize(800, 600);
  let x = 0, t = 0;
  cam.follow(0, 0);
  const lag = [];
  for (const dt of frames) { t += dt; x = speed * t; cam.follow(x, 0, 0.22, null, dt); lag.push(x - cam.cx); }
  return lag;
}

test('the camera keeps the same lag behind a walk at 30, 60 or 144fps, and a hitch does not jolt it', () => {
  const settle = (fps) => walk(Array(Math.ceil(3000 * fps / 1000)).fill(1000 / fps)).at(-1);
  const l60 = settle(60);
  assert.ok(l60 > 3 && l60 < 12, `a little lag behind you (${l60.toFixed(2)}px)`);
  for (const fps of [30, 144]) assert.ok(Math.abs(settle(fps) - l60) < 0.15, `${fps}fps: ${settle(fps).toFixed(2)}px`);
  // A 120ms hitch in a steady 60fps walk: you stay put on screen.
  const frames = Array(180).fill(1000 / 60); frames[120] = 120;
  const lag = walk(frames);
  const worst = Math.max(...lag.slice(115).map((v) => Math.abs(v - lag[114])));
  assert.ok(worst < 0.5, `no jolt from a long frame (${worst.toFixed(2)}px)`);
});

test('the camera eases to a stop without overshooting, and snaps when told to', () => {
  const cam = new Camera(); cam.resize(800, 600);
  cam.follow(0, 0);
  let x = 0;
  for (let i = 0; i < 90; i++) { x += 1.6; cam.follow(x, 0, 0.22, null, 16); }   // walking right
  let over = 0;
  for (let i = 0; i < 120; i++) { cam.follow(x, 0, 0.22, null, 16); over = Math.max(over, cam.cx - x); }   // stopped
  assert.ok(over < 0.01, `no overshoot (${over})`);
  assert.ok(Math.abs(cam.cx - x) < 0.05, 'and settles on you');
  cam.follow(5000, 300, 1);
  assert.equal(cam.cx, 5000); assert.equal(cam.cy, 300); assert.equal(cam.vx, 0);
  // Held against the edge of the world, the spring stops instead of winding up.
  const c2 = new Camera(); c2.resize(800, 600); c2.follow(400, 300);
  for (let i = 0; i < 60; i++) c2.follow(0, 300, 0.22, { width: 100, height: 100 }, 16);
  assert.equal(c2.cx, 400); assert.equal(c2.vx, 0);
});

test('Reduce motion: the camera stays on you (no lead ahead, no push-in)', () => {
  const pos = { x: 1000, y: 1000 };
  const g = { player: { alive: true, renderCenter: () => ({ x: pos.x, y: pos.y }) }, camera: new Camera(), reduceMotion: true,
    addShake() {}, bus: { emit() {} }, hitStop: 0 };
  g.camera.resize(800, 600, 1.5, 1);
  const cine = new Cinematics();
  cine.inFight = true;
  for (let i = 0; i < 60; i++) { pos.x += 32 / 300 * 16; cine.update(g, 16); }
  assert.ok(Math.abs(cine.lead.x) < 1e-6, 'no lead');
  assert.equal(cine.zoomK, 1, 'no push-in');
});
