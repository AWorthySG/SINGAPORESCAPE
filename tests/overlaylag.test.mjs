// Frame-cost guards for the playfield's overlays: the animated water layer is
// not remade every frame of a fight's zoom. All headless: a stand-in canvas
// counts what is made and drawn.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { Renderer } from '../src/render/renderer.js';
import { TERRAIN } from '../src/data/world.js';
import { TILE } from '../src/config.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function freshGame() {
  globalThis.localStorage = fakeStorage();
  const g = new Game();
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
// A 2D context that does nothing but note what is drawn and cleared.
function countingCtx() {
  const noop = () => {}, grad = { addColorStop: noop };
  const calls = { drawImage: [], fillText: [], strokeText: [], clearRect: [], setTransform: [] };
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '',
    measureText: (s) => ({ width: String(s).length * 6 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
    drawImage: (...a) => calls.drawImage.push(a), fillText: (...a) => calls.fillText.push(a), strokeText: (...a) => calls.strokeText.push(a),
    clearRect: (...a) => calls.clearRect.push(a), setTransform: (...a) => calls.setTransform.push(a), calls,
  };
  for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'setLineDash', 'transform', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'fillRect', 'strokeRect']) ctx[k] = noop;
  return ctx;
}
// document.createElement('canvas') for the test: each canvas counts how often
// it is sized (setting width or height remakes its pixels).
function withCanvases(fn) {
  const made = [];
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = { createElement: () => {
    const g = countingCtx();
    const cv = { w: 0, h: 0, sized: 0, g, getContext: () => g };
    Object.defineProperty(cv, 'width', { get() { return this.w; }, set(v) { this.w = v; this.sized++; } });
    Object.defineProperty(cv, 'height', { get() { return this.h; }, set(v) { this.h = v; this.sized++; } });
    made.push(cv);
    return cv;
  } };
  try { return fn(made); } finally { if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document; }
}

/** A spot on the shore with water just below it (the view around it holds water). */
function shoreSpot(g) {
  const w = g.world;
  for (let y = 85; y < 103; y++) for (let x = 5; x < 90; x++) {
    if (!w.isBlocked(x, y) && w.terrainAt(x, y + 1) === TERRAIN.WATER) return [x, y];
  }
  return null;
}

test('the water layer is not remade every frame of a fight zoom, and repaints on its own clock', () => withCanvases((made) => {
  const g = freshGame();
  const spot = shoreSpot(g);
  assert.ok(spot, 'a shore tile');
  let scale = 1.4;   // the screen's pixels per world pixel (device pixels x zoom)
  const main = countingCtx();
  main.getTransform = () => ({ a: scale });
  const r = new Renderer(g, {}, main);
  const x0 = spot[0] - 8, x1 = spot[0] + 7, y0 = spot[1] - 12, y1 = spot[1] + 12;   // 16 x 25 tiles
  const ox = x0 * TILE + 40, oy = y0 * TILE + 40;
  const layerOf = () => made.find((c) => c === r._waterCache?.cv);

  r._drawWaterOverlay(x0, y0, x1, y1, ox, oy, 1000);
  const cv = layerOf();
  assert.ok(cv && r._waterCache.any, 'water was painted into the layer');
  assert.equal(cv.sized, 2, 'made once (width and height)');
  const W = Math.ceil(16 * TILE * scale), H = Math.ceil(25 * TILE * scale);
  assert.ok(cv.width >= W && cv.height >= H, 'room for the whole view');
  // The copy maps the painted W x H corner onto the view, exactly as copying a W x H layer did.
  const b = r._waterCache.box, blit = main.calls.drawImage.at(-1);
  assert.equal(blit[0], cv);
  const kx = W / (16 * TILE), ky = H / (25 * TILE);
  assert.deepEqual(blit.slice(1), [b.x0 * kx, b.y0 * ky, (b.x1 - b.x0) * kx, (b.y1 - b.y0) * ky,
    x0 * TILE - ox + b.x0, y0 * TILE - oy + b.y0, b.x1 - b.x0, b.y1 - b.y0]);

  // The camera scrolls (the view gains and loses a column) while the zoom eases
  // in a little every frame: the same canvas throughout, never resized.
  for (let i = 1; i <= 40; i++) {
    scale = 1.4 * (1 + 0.0008 * i);
    r._drawWaterOverlay(x0, y0, x1 + (i % 2), y1, ox, oy, 1000 + i * 16);
  }
  assert.equal(layerOf(), cv, 'the same layer');
  assert.equal(cv.sized, 2, 'never resized');

  // A small change of scale waits for the next timed repaint...
  scale = 1.4;
  r._drawWaterOverlay(x0, y0, x1, y1, ox, oy, 5000);
  assert.equal(r._waterCache.t, 5000, 'repainted (time was up)');
  scale = 1.41;
  r._drawWaterOverlay(x0, y0, x1, y1, ox, oy, 5016);
  assert.equal(r._waterCache.t, 5000, 'a 0.7% zoom step: not repainted yet');
  assert.equal(r._waterCache.dpr, 1.4);
  const stretched = main.calls.drawImage.at(-1);
  assert.equal(stretched[3], (r._waterCache.box.x1 - r._waterCache.box.x0) * Math.ceil(16 * TILE * 1.4) / (16 * TILE), 'copied at the scale it was painted at');
  r._drawWaterOverlay(x0, y0, x1, y1, ox, oy, 5100);
  assert.equal(r._waterCache.t, 5100, '...and repainted at the new scale once its time is up');
  assert.equal(r._waterCache.dpr, 1.41);
  // ...a bigger one repaints straight away, wiping the whole layer first.
  cv.g.calls.clearRect.length = 0;
  scale = 1.5;
  r._drawWaterOverlay(x0, y0, x1, y1, ox, oy, 5110);
  assert.equal(r._waterCache.t, 5110);
  assert.deepEqual(cv.g.calls.clearRect[0], [0, 0, cv.width, cv.height], 'the whole layer is wiped');
  // The same view a moment later only clears the box that was painted.
  cv.g.calls.clearRect.length = 0;
  r._drawWaterOverlay(x0, y0, x1, y1, ox, oy, 5210);
  const ob = cv.g.calls.clearRect[0];
  assert.ok(ob && ob[2] <= 16 * TILE && ob[3] <= 25 * TILE, 'just the old box');

  // Far too big for the view (the resolution dropped a lot): made smaller again.
  scale = 0.7;
  r._drawWaterOverlay(x0, y0, x1, y1, ox, oy, 5300);
  assert.equal(cv.sized, 4, 'resized once');
  assert.ok(cv.width < Math.ceil(16 * TILE * 1.4), 'smaller');
}));

test('names and bars skip the off-screen crowd before working anything out, and still catch a walker stepping into view', () => {
  const g = freshGame();
  g.camera.resize(400, 300);
  g.camera.follow(g.player.x * TILE + TILE / 2, g.player.y * TILE + TILE / 2);
  const p = g.player;
  const r = new Renderer(g, {}, countingCtx());
  // Who the overheads look at: reading a monster's kind (def) is the first
  // thing done for one that is on screen.
  const looked = new Set();
  const watch = (n) => {
    const def = n.def;
    Object.defineProperty(n, 'def', { configurable: true, get() { looked.add(n); return def; }, set(v) { Object.defineProperty(n, 'def', { value: v, writable: true, configurable: true }); } });
    return n;
  };
  const near = watch(new NPC('goblin', p.x + 2, p.y, 0, {}));
  const far = watch(new NPC('goblin', p.x + 40, p.y, 0, {}));      // well off screen, still "nearby"
  const below = watch(new NPC('goblin', p.x, p.y + 30, 0, {}));
  // A walker on its last off-screen tile, stepping onto the screen's edge.
  const edgeX = Math.floor((g.camera.originX + g.camera.viewW + 90) / TILE) + 1;
  const walker = watch(new NPC('goblin', edgeX, p.y, 0, {}));
  walker.moving = true; walker.tx = edgeX - 3; walker.ty = p.y; walker.progress = 0.9;
  g.npcs.push(near, far, below, walker);
  g._near = null; g._around = null;
  assert.ok(g.nearbyNpcs().includes(far) && g.nearbyNpcs().includes(below), 'all four count as nearby');
  // In a fight all four would wear a health bar, if on screen.
  const bars = [];
  r._healthBar = (x, y) => bars.push(x);
  for (const n of [near, far, below, walker]) n.combatLatch = 5;
  const ox = g.camera.originX, oy = g.camera.originY;
  const wx = walker.renderCenter().x - ox;
  assert.ok(wx <= g.camera.viewW + 90 && (walker.x * TILE + TILE / 2 - ox) > g.camera.viewW + 90, 'the walker is drawn in view, its tile is not');
  looked.clear();
  r._drawOverheads(ox, oy, []);
  assert.ok(looked.has(near), 'the goblin beside you is looked at');
  assert.ok(!looked.has(far) && !looked.has(below), 'the off-screen ones are not');
  assert.ok(looked.has(walker), 'a walker whose next tile is on screen is looked at');
  const barAt = (n) => bars.some((x) => Math.abs(x - (n.renderCenter().x - ox)) < 1e-9);
  assert.ok(barAt(near) && barAt(walker), 'both fighters in view wear their bars');
  assert.ok(!barAt(far) && !barAt(below), 'the off-screen ones wear none');
});
