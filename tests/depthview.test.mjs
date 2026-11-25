// The depth view (Settings > Depth view): the tilted camera's projection
// (projection.js), its use by the camera for taps and the hover tile, the sun's
// cast shadows and the tilt's own rules (depthview.js), and that low graphics,
// Reduce motion and headless runs keep it safe.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { Camera } from '../src/engine/camera.js';
import { Renderer } from '../src/render/renderer.js';
import { clearSave, saveGame } from '../src/game/save.js';
import { TILE, SAVE_KEY } from '../src/config.js';
import {
  DEPTH_TILT, makeProjection, projectRel, unprojectRel, worldToScreen, screenToWorld, rowTransform, projectFlat,
} from '../src/render/projection.js';
import { depthTarget, easeTilt, shadowVec, hazeColour, DepthView } from '../src/render/depthview.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
// Phone (iPhone 13 at the game's zoom) and desktop views, in world px.
const VIEWS = [[390 / 1.76, 844 / 1.76], [1440 / 1.875, 900 / 1.875], [800, 600]];

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(fresh = true) {
  if (fresh) { globalThis.localStorage = fakeStorage(); clearSave(); }
  const g = new Game();
  g.start();
  if (fresh) g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
function recordingCtx() {
  const calls = [];
  const grad = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'getTransform') return undefined;
      return (...a) => { calls.push([k, a]); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

test('projection: screenToWorld undoes worldToScreen, all over the screen and past it', () => {
  for (const [vw, vh] of VIEWS) {
    const pj = makeProjection(DEPTH_TILT, vw, vh);
    for (let u = -vw; u <= vw; u += vw / 7) {
      for (let v = -vh * 0.8; v <= vh * 0.45; v += vh / 9) {
        const s = projectRel(pj, u, v), r = unprojectRel(pj, s.x, s.y);
        near(r.u, u, 1e-9, 'u'); near(r.v, v, 1e-9, 'v');
        const w = screenToWorld(pj, s.x, s.y, 1000, 2000);
        near(w.x, 1000 + u, 1e-9, 'world x'); near(w.y, 2000 + v, 1e-9, 'world y');
        const back = worldToScreen(pj, w.x, w.y, 1000, 2000);
        near(back.x, s.x, 1e-9, 'screen x'); near(back.y, s.y, 1e-9, 'screen y');
      }
    }
  }
});

test('projection: a modest tilt; far rows smaller, near rows bigger, the camera centre a little low', () => {
  for (const [vw, vh] of VIEWS) {
    const pj = makeProjection(DEPTH_TILT, vw, vh);
    assert.ok(pj.sTop > 0.72 && pj.sTop < 0.9, `the top row shrinks a little (${pj.sTop})`);
    assert.ok(pj.sBot > 1.05 && pj.sBot < 1.25, `the bottom row grows a little (${pj.sBot})`);
    assert.ok(pj.scy > vh / 2 && pj.scy < vh * 0.6, 'you stand a little below the middle');
    // More of the world above you than flat, and the rectangle drawn covers the whole screen.
    assert.ok(-unprojectRel(pj, vw / 2, 0).v > vh / 2, 'the top of the screen shows further away');
    for (const [X, Y] of [[0, 0], [vw, 0], [0, vh], [vw, vh], [vw / 2, vh / 2]]) {
      const r = unprojectRel(pj, X, Y), fx = r.u + vw / 2 - pj.fx0, fy = r.v + vh / 2 - pj.fy0;
      assert.ok(fx >= 0 && fx <= pj.fw && fy >= 0 && fy <= pj.fh, `screen corner (${X}, ${Y}) is inside the ground drawn`);
    }
    // Every row stays level, and straight lines stay straight (a true perspective).
    const a = projectRel(pj, -50, -80), b = projectRel(pj, 50, -80);
    near(a.y, b.y, 1e-9, 'rows stay level');
    const p = projectRel(pj, 0, -100), q = projectRel(pj, 40, 0), m = projectRel(pj, 20, -50);
    near((m.x - p.x) * (q.y - p.y), (m.y - p.y) * (q.x - p.x), 1e-6, 'collinear');
  }
});

test('tilt 0 is exactly the flat view, in the projection and in the camera', () => {
  const pj = makeProjection(0, 390, 844);
  assert.equal(pj.k, 0); assert.equal(pj.c, 1);
  for (const [u, v] of [[0, 0], [-123.5, 77.25], [400, -900]]) {
    const s = projectRel(pj, u, v);
    assert.equal(s.x, 195 + u); assert.equal(s.y, 422 + v); assert.equal(s.s, 1);
  }
  assert.equal(pj.fx0, 0); assert.equal(pj.fy0, 0); assert.equal(pj.fw, 390); assert.equal(pj.fh, 844);
  const cam = new Camera(), flat = new Camera();
  for (const c of [cam, flat]) { c.resize(390, 844, 1.76, 2); c.follow(1234.5, 987.25, 1); }
  cam.tilt = 0;
  assert.equal(cam.proj(), null, 'no projection while flat');
  for (const [x, y] of [[0, 0], [195, 422], [390, 844], [17.3, 801.9]]) {
    assert.deepEqual(cam.screenToWorld(x, y), { x: x / flat.zoom + flat.originX, y: y / flat.zoom + flat.originY });
    assert.deepEqual(cam.screenToTile(x, y), flat.screenToTile(x, y));
  }
  assert.deepEqual(cam.worldToScreen(1300, 900), { x: (1300 - flat.originX) * flat.zoom, y: (900 - flat.originY) * flat.zoom });
});

test('tilted picking: the tile you tap is the tile drawn there, right to the screen edges', () => {
  const cam = new Camera();
  cam.resize(390, 844, 1.76, 2);
  cam.follow(60 * TILE + 16, 56 * TILE + 16, 1);
  cam.tilt = DEPTH_TILT;
  // Points along every edge and corner of an iPhone screen (CSS px).
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push([390 * i / 10, 1], [390 * i / 10, 843], [1, 844 * i / 10], [389, 844 * i / 10]);
  for (const [x, y] of pts) {
    const t = cam.screenToTile(x, y);
    // The middle of that tile lands within the tile's drawn footprint around the tap.
    const c = cam.worldToScreen(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
    assert.ok(Math.abs(c.x - x) <= TILE * 1.76 * 0.65 && Math.abs(c.y - y) <= TILE * 1.76 * 0.65, `tap (${x}, ${y}) picks the tile under it`);
    // And the tile's own middle, tapped, picks that same tile.
    assert.deepEqual(cam.screenToTile(c.x, c.y), t);
  }
  // The renderer's sprite transform puts a foot exactly where the camera says it is.
  const pj = Object.assign({}, cam.proj());
  const ox = cam.originX + pj.fx0, oy = cam.originY + pj.fy0;
  for (const [wx, wy] of [[cam.cx - 90, cam.cy - 230], [cam.cx + 100, cam.cy + 120], [cam.cx, cam.cy]]) {
    const m = rowTransform(pj, wy - oy), sx = m.a * (wx - ox) + m.e, sy = m.d * (wy - oy) + m.f;
    const c = cam.worldToScreen(wx, wy);
    near(sx * cam.zoom, c.x, 1e-6, 'sprite x'); near(sy * cam.zoom, c.y, 1e-6, 'sprite y');
    const f = projectFlat(pj, wx - ox, wy - oy);
    near(f.x * cam.zoom, c.x, 1e-6, 'light x'); near(f.y * cam.zoom, c.y, 1e-6, 'light y');
  }
  // At the world's edge the tilted view (taller above you, wider at the top) stays inside the world.
  const edge = new Camera();
  edge.resize(390, 844, 1.76, 2);
  edge.tilt = DEPTH_TILT;
  edge.follow(5, 5, 1, { width: 400, height: 280 });
  for (const [x, y] of [[0, 0], [390, 0], [195, 844]]) {
    const w = edge.screenToWorld(x, y);
    assert.ok(w.x >= -2.5 && w.y >= -2.5, `screen (${x}, ${y}) shows the world, not past its edge`);
  }
  // Further up the screen a tile is drawn smaller.
  const top = cam.worldToScreen(cam.cx + TILE, cam.cy - 200), mid = cam.worldToScreen(cam.cx + TILE, cam.cy);
  assert.ok(top.x - 195 < mid.x - 195, 'far tiles are narrower');
});

test('cast shadows follow the clock: west in the morning, short at noon, east at dusk, none at night', () => {
  const morning = shadowVec(0.3), noon = shadowVec(0.5), evening = shadowVec(0.7), night = shadowVec(0.02);
  assert.ok(morning.on && noon.on && evening.on);
  assert.ok(morning.kx < -0.3, 'morning shadows fall west');
  assert.ok(evening.kx > 0.3, 'evening shadows fall east');
  near(noon.kx, 0, 1e-9, 'noon shadows lean neither way');
  assert.ok(noon.len < morning.len && noon.len < evening.len, 'short at noon, long when the sun is low');
  for (const s of [morning, noon, evening]) assert.ok(s.ky < 0, 'away from the southern sun, up the screen');
  assert.equal(night.on, false, 'the moon leaves only the contact shadows');
  assert.equal(night.alpha, 0);
  assert.ok(shadowVec(0.27).alpha < noon.alpha, 'faint as the sun comes up');
  // The haze takes the sky's colour: warm at dusk, deep blue at night.
  const d = hazeColour(0.72), n = hazeColour(0.95), m = hazeColour(0.5);
  assert.ok(d[0] > d[2], 'dusk haze is warm');
  assert.ok(n[2] > n[0] && n[0] < 120, 'night haze is a deep blue');
  assert.ok(m[2] > 230, 'noon haze is pale sky');
});

test('the tilt: on by default, flat in low graphics, headless or switched off, still with Reduce motion', () => {
  const g = { depthView: true, lowFx: false, reduceMotion: false, camera: { zoomMul: 1 } };
  assert.equal(depthTarget(g, g.camera, true), DEPTH_TILT);
  assert.equal(depthTarget({ ...g, lowFx: true }, g.camera, true), 0, 'low graphics forces flat');
  assert.equal(depthTarget({ ...g, depthView: false }, g.camera, true), 0, 'the setting off is flat');
  assert.equal(depthTarget(g, g.camera, false), 0, 'nothing to draw on (headless): flat');
  const fight = { zoomMul: 1.06 };
  assert.ok(depthTarget(g, fight, true) > DEPTH_TILT, 'a fight leans the tilt in a touch');
  assert.ok(depthTarget(g, { zoomMul: 3 }, true) <= DEPTH_TILT * 1.2, '...never far');
  assert.equal(depthTarget({ ...g, reduceMotion: true }, fight, true), DEPTH_TILT, 'Reduce motion keeps it still');
  // Easing: gradual normally, a snap with Reduce motion, and it settles exactly.
  const half = easeTilt(0, 1, 100);
  assert.ok(half > 0.2 && half < 0.6);
  assert.equal(easeTilt(0, 1, 100, true), 1);
  let t = 0;
  for (let i = 0; i < 200; i++) t = easeTilt(t, 1, 16);
  assert.equal(t, 1);
  for (let i = 0; i < 200; i++) t = easeTilt(t, 0, 16);
  assert.equal(t, 0);
});

test('a headless game stays flat, and the setting is saved (older saves: on)', () => {
  const g = newGame();
  assert.equal(g.depthView, true, 'on by default');
  for (let i = 0; i < 30; i++) g.update(16);
  assert.equal(g.camera.tilt, 0, 'no renderer, no tilt');
  assert.equal(g.camera.proj(), null);
  g.depthView = false;
  saveGame(g);
  assert.equal(newGame(false).depthView, false, 'kept across a reload');
  // An older save with no such setting loads with it on.
  const raw = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY));
  assert.equal(raw.settings.depthView, false);
  delete raw.settings.depthView;
  globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  assert.equal(newGame(false).depthView, true, 'older saves: on');
});

test('the renderer: tilted, the ground goes through the warp; low graphics and headless stay flat', () => {
  const made = { canvases: 0 };
  globalThis.document = { createElement: () => { made.canvases++; return { width: 0, height: 0, getContext: () => recordingCtx() }; } };
  try {
    const g = newGame();
    g.camera.resize(390, 844, 1.76, 2);
    const main = recordingCtx();
    // (The recording context has no getTransform, so the renderer draws at 1 canvas px per world px.)
    const r = new Renderer(g, { width: Math.ceil(g.camera.viewW), height: Math.ceil(g.camera.viewH) }, main);
    g.reduceMotion = true;   // snap the tilt on at once
    r.render(1000);
    assert.equal(g.camera.tilt, DEPTH_TILT, 'tilted at once with Reduce motion');
    assert.ok(r._pj, 'this frame drew through the projection');
    assert.ok(r.depth.strips > 20, `the ground went on in rows (${r.depth.strips})`);
    const draws = main.calls.filter(([k, a]) => k === 'drawImage' && a[0] === r.depth.buf).length;
    assert.equal(draws, r.depth.strips, 'each row is one copy of the ground canvas');
    // Easing back out when switched off, then flat: the old path, no ground canvas used.
    g.depthView = false; g.reduceMotion = false;
    for (let i = 0; i < 120; i++) r.render(1016 + i * 16);
    assert.equal(g.camera.tilt, 0);
    main.calls.length = 0;
    r.render(4000);
    assert.equal(r._pj, null);
    assert.equal(main.calls.filter(([k, a]) => k === 'drawImage' && a[0] === r.depth.buf).length, 0, 'flat: no warp');
    // Low graphics forces flat even with the setting on.
    g.depthView = true; g.lowFx = true;
    for (let i = 0; i < 60; i++) r.render(5000 + i * 16);
    assert.equal(g.camera.tilt, 0, 'low graphics is flat');
  } finally { delete globalThis.document; }
  // No DOM at all: the renderer never tilts.
  const g = newGame();
  g.camera.resize(390, 844, 1.76, 2);
  const r = new Renderer(g, { width: 780, height: 1688 }, recordingCtx());
  for (let i = 0; i < 10; i++) r.render(1000 + i * 16);
  assert.equal(g.camera.tilt, 0);
  assert.equal(new DepthView().ok, false);
});
