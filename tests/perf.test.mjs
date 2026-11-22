// Frame-cost guards (the crowded Sentosa beach in auto battle): the water's
// swell colours are made once, the shoreline foam can be painted into the
// animated water layer, tinted world pictures are baked once instead of
// filtered every frame, and the per-frame hover pick and node labels only
// look at what is near or on screen. All headless: no DOM, no Image.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { Renderer, swellFill } from '../src/render/renderer.js';
import { TerrainFx } from '../src/render/terrainfx.js';
import { tintedArt } from '../src/render/sprites.js';
import { TERRAIN } from '../src/data/world.js';
import { FxGovernor, TRIM_ON_HOLD, TRIM_OFF_HOLD, slowFrames, shouldScaleDown, SLOW_FRAME_MS } from '../src/render/governor.js';

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
// A 2D context that does nothing but count what is drawn.
function countingCtx() {
  const noop = () => {}, grad = { addColorStop: noop };
  const calls = { drawImage: [], fillText: [] };
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '',
    measureText: () => ({ width: 10 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
    drawImage: (...a) => calls.drawImage.push(a), fillText: (...a) => calls.fillText.push(a), calls,
  };
  for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'setTransform', 'setLineDash', 'transform', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'fillRect', 'strokeRect',
    'clearRect', 'strokeText']) ctx[k] = noop;
  return ctx;
}

test('the water swell colours are the same strings as before, made once each', () => {
  assert.equal(swellFill(0, 0.1234), 'rgba(255,255,255,0.123)');
  assert.equal(swellFill(1, 0.05), 'rgba(30,90,140,0.050)');
  assert.equal(swellFill(1, 0), 'rgba(30,90,140,0.000)');
  assert.equal(swellFill(0, 0.22), `rgba(255,255,255,${(0.22).toFixed(3)})`);
  // Built once: the cache hands back the very same string.
  const a = swellFill(0, 0.0871), b = swellFill(0, 0.0869);
  assert.equal(a, b);
  assert.equal(a, 'rgba(255,255,255,0.087)');
});

test('the shoreline foam can be drawn on its own (into the water layer), and left out of drawWater', () => {
  const fx = new TerrainFx();
  const A = { id: 'foamA' }, B = { id: 'foamB' };
  const chunk = { fx: { foam: { a: A, b: B }, water: [], refl: [], x: 0, y: 0, w: 1024, h: 1024 } };
  const foamDraws = (ctx) => ctx.calls.drawImage.filter((c) => c[0] === A || c[0] === B).length;
  // On screen: both layers, cross-fading.
  let ctx = countingCtx();
  assert.equal(fx.drawFoam(ctx, [chunk], 100, 100, 400, 300, 1000, false), true);
  assert.equal(foamDraws(ctx), 2);
  // Low graphics: one layer.
  ctx = countingCtx();
  fx.drawFoam(ctx, [chunk], 100, 100, 400, 300, 1000, true);
  assert.equal(foamDraws(ctx), 1);
  // Off screen: nothing, and it says so.
  ctx = countingCtx();
  assert.equal(fx.drawFoam(ctx, [chunk], 5000, 5000, 400, 300, 1000, false), false);
  assert.equal(foamDraws(ctx), 0);
  // drawWater draws the foam by default (as before), and not when told the water layer has it.
  ctx = countingCtx();
  fx.drawWater(ctx, [chunk], 100, 100, 400, 300, 1000, false);
  assert.equal(foamDraws(ctx), 2);
  ctx = countingCtx();
  fx.drawWater(ctx, [chunk], 100, 100, 400, 300, 1000, false, false);
  assert.equal(foamDraws(ctx), 0);
});

test('a tinted world picture is baked once, never filtered at draw time', () => {
  const img = { src: 'assets/world/obj-sea_rod_spot.webp', naturalWidth: 40, naturalHeight: 30 };
  // Headless (no document): nothing to bake, so the caller draws the plain picture.
  assert.equal(tintedArt(img, 'hue-rotate(60deg)'), null);
  assert.equal(tintedArt({ src: 'x', naturalWidth: 0 }, 'hue-rotate(60deg)'), null, 'not loaded yet');
  // With a canvas to bake into: the filter is applied once, to the copy.
  const made = [];
  globalThis.document = { createElement: () => {
    const g = { filter: 'none', draws: 0, drawImage() { this.draws++; } };
    const cv = { width: 0, height: 0, getContext: () => g, g };
    made.push(cv);
    return cv;
  } };
  try {
    const pic = { src: 'assets/world/obj-harpoon_spot.webp', naturalWidth: 50, naturalHeight: 60 };
    const a = tintedArt(pic, 'hue-rotate(20deg)');
    assert.ok(a, 'baked');
    assert.equal(a.width, 50); assert.equal(a.height, 60);
    assert.equal(a.g.filter, 'hue-rotate(20deg)');
    assert.equal(a.g.draws, 1);
    assert.equal(tintedArt(pic, 'hue-rotate(20deg)'), a, 'the same copy every frame');
    assert.notEqual(tintedArt(pic, 'saturate(2)'), a, 'another tint is another copy');
    assert.equal(made.length, 2);
  } finally { delete globalThis.document; }
});

test('the per-frame hover pick only looks at NPCs near you, and still finds the one beside you', () => {
  const g = freshGame();
  const p = g.player;
  const foe = new NPC('goblin', p.x + 1, p.y, 0, {});
  g.npcs.push(foe);
  const far = new NPC('goblin', p.x + 100, p.y, 0, {});
  g.npcs.push(far);
  let walks = 0;
  const list = g.npcs;
  g.npcs = new Proxy(list, { get(t, k) { if (k === Symbol.iterator) walks++; return Reflect.get(t, k); } });
  for (let i = 0; i < 20; i++) {
    const t = g._findInteract();
    assert.ok(t && t.kind === 'npc', 'something to interact with');
    assert.notEqual(t.ref, far);
  }
  assert.equal(g._findInteract().ref.alive, true);
  // Twenty frames walked the world's NPC list at most once (to work out who is near).
  assert.ok(walks <= 1, `walked the whole NPC list ${walks} times`);
});

test('node labels and signposts are drawn from the objects in view only', () => {
  const g = freshGame();
  g.camera.resize(800, 600);
  g.camera.follow(g.player.x * 32, g.player.y * 32);
  g.worldLabels = 'all';
  const ctx = countingCtx();
  const r = new Renderer(g, {}, ctx);
  r.render(1000);
  const vis = r._visObjs;
  assert.ok(Array.isArray(vis) && vis.length > 0, 'objects in view were noted');
  assert.ok(vis.length < g.world.objects.length / 4, 'only a slice of the world');
  // A sign far off screen is never looked at: passing an empty list draws no labels at all.
  ctx.calls.fillText.length = 0;
  r._drawNodeLabels(g.camera.originX, g.camera.originY, []);
  assert.equal(ctx.calls.fillText.length, 0);
});

test('the skills list waits while its view is hidden, and catches up on opening', async () => {
  const { UI } = await import('../src/ui/ui.js');
  let hidden = true, built = 0;
  const grid = {
    closest: () => ({ classList: { contains: (c) => c === 'hidden' && hidden } }),
    set innerHTML(v) { built++; }, get innerHTML() { return ''; },
  };
  const fake = { el: { skillsGrid: grid } };
  UI.prototype.renderSkills.call(fake);
  assert.equal(built, 0, 'no rebuild while hidden');
  assert.equal(fake._skillsStale, true, 'marked out of date');
  hidden = false;
  // Shown: it rebuilds (the rest of the build needs a real page; the clear comes first).
  try { UI.prototype.renderSkills.call(fake); } catch { /* no DOM to build into */ }
  assert.equal(built, 1);
  assert.equal(fake._skillsStale, false);
});

test('the governor trims the extras only after frames stay slow, and brings them back slowly', () => {
  const gov = new FxGovernor();
  let t = 0;
  const run = (ms, forMs) => { for (const end = t + forMs; t < end; t += 16) gov.frame(ms, t); return gov.trim; };
  assert.equal(run(6, 3000), false, 'quick frames: full look');
  assert.equal(run(30, 500), false, 'a short burst of slow frames is ridden out');
  run(6, 3000);
  assert.equal(run(30, TRIM_ON_HOLD + 1500), true, 'slow for a while: trimmed');
  assert.equal(run(6, 1000), true, 'not straight back on');
  assert.equal(run(6, TRIM_OFF_HOLD + 2000), false, 'quick for long enough: full look again');
  // A stall (a tab switch) is not counted.
  const g2 = new FxGovernor();
  for (let i = 0; i < 10; i++) g2.frame(5000, i * 16);
  assert.equal(g2.trim, false);
  assert.equal(g2.avg, 0);
});

test('while trimmed, reflections are left out (and the renderer still draws)', () => {
  const g = freshGame();
  // Stand the hero on the shore, with water just below.
  const w = g.world;
  let spot = null;
  for (let y = 85; y < 103 && !spot; y++) for (let x = 5; x < 90 && !spot; x++) {
    if (!w.isBlocked(x, y) && w.terrainAt(x, y + 1) === TERRAIN.WATER) spot = [x, y];
  }
  assert.ok(spot, 'a shore tile');
  g._placePlayer(spot[0], spot[1]);
  g.player.fx = spot[0]; g.player.fy = spot[1];   // the drawn position, too
  g.camera.resize(800, 600);
  const c = g.player.renderCenter();
  const fx = new TerrainFx();
  let clips = 0;
  const ctx = countingCtx();
  ctx.clip = () => { clips++; };
  fx.drawReflections(ctx, g, [], c.x - 400, c.y - 300, 800, 600, 1000);
  assert.ok(clips > 0, 'the hero is reflected at full graphics');
  clips = 0;
  g.fxTrim = true;
  fx.drawReflections(ctx, g, [], c.x - 400, c.y - 300, 800, 600, 1000);
  assert.equal(clips, 0, 'trimmed: no reflections');
  const r = new Renderer(g, {}, countingCtx());
  assert.doesNotThrow(() => { r.render(1000); r.render(1016); });
});

// Slow painting (governor.js, main.js): frames that keep arriving slowly trim
// the extras even when the game's own work looks quick, before the resolution
// is lowered; trimmed frames also skip the full-screen golden-hour grade and vignette.
test('slow frames trim the extras first; the resolution only drops once they are off', () => {
  assert.equal(slowFrames(16.7), false, '60fps');
  assert.equal(slowFrames(33.4), false, 'a 30fps cap (Low Power Mode) is not slow');
  assert.equal(slowFrames(SLOW_FRAME_MS + 4), true, 'below ~28fps');
  assert.equal(shouldScaleDown(45, false), false, 'extras still on: trim them first');
  assert.equal(shouldScaleDown(45, true), true, 'trimmed and still slow: lower the resolution');
  assert.equal(shouldScaleDown(20, true), false);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /game\.fxTrim = governor\.frame\(now\(\) - t, t\) \|\| t < slowTrimUntil/);
  assert.match(main, /shouldScaleDown\(slowAvg, game\.fxTrim\)/);
  const r = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  assert.match(r, /else if \(!game\.fxTrim\) this\.cosy\.draw\(/);
  assert.match(r, /if \(!game\.fxTrim\) this\._drawVignette\(/);
});

test('a rigged monster draws its parts straight to the screen unless it flashes or is see-through', () => {
  const src = readFileSync(new URL('../src/render/sprites.js', import.meta.url), 'utf8');
  assert.match(src, /if \(!\(flash > 0\.01\) && c\.globalAlpha >= 0\.999\) \{[\s\S]{0,400}drawRigParts\(c, rig, imgs, opts, t, x0, y0, w, h\);[\s\S]{0,60}return;/,
    'the common frame skips the scratch canvas');
  assert.match(src, /drawRigParts\(g, rig, imgs, opts, t, x0, y0, w, h(, box)?\);/, 'the flash and see-through path still composes first');
});
