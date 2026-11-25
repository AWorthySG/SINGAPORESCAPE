// Full-screen soft pictures (the edge vignette, the hit pulse, the hurt flash,
// the depth view's haze) are drawn from copies made once at the screen's own
// pixels (ambience.js drawScreenPic, depthview.js haze): made once, used again
// while the screen keeps its size (a fight's zoom included), made afresh when
// it changes, and the old way when there is nothing to make them with.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drawScreenPic, vignetteKey, buildVignette } from '../src/render/ambience.js';
import { DepthView } from '../src/render/depthview.js';
import { makeProjection, DEPTH_TILT } from '../src/render/projection.js';

// A context that records its calls and keeps a transform (a, d: scale; b, c: turn; e, f: shift).
function fakeCtx(m = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }) {
  const calls = [];
  const grad = { stops: [], addColorStop(o, c) { this.stops.push([o, c]); } };
  const ctx = {
    calls, m: { ...m }, globalAlpha: 1,
    getTransform() { return { ...this.m }; },
    setTransform(a, b, c, d, e, f) { this.m = { a, b, c, d, e, f }; calls.push(['setTransform', a, b, c, d, e, f]); },
    createLinearGradient: (...a) => { calls.push(['grad', ...a]); return grad; },
    createRadialGradient: (...a) => { calls.push(['radial', ...a]); return grad; },
  };
  for (const k of ['drawImage', 'fillRect', 'clearRect']) ctx[k] = (...a) => calls.push([k, ...a]);
  return ctx;
}
function factory() {
  const made = [];
  const make = () => { const g = fakeCtx({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }); const cv = { width: 0, height: 0, g, getContext: () => g }; made.push(cv); return cv; };
  return { made, make };
}

test('a full-screen picture is made once at the screen\'s pixels and copied pixel for pixel after', () => {
  const { made, make } = factory();
  const slot = {}, ctx = fakeCtx();
  let paints = 0;
  const paint = (g, W, H) => { paints++; g.drawImage('small', 0, 0, W, H); };
  assert.equal(drawScreenPic(ctx, slot, 'v', 390, 844, paint, make), true);
  assert.equal(paints, 1);
  assert.equal(made.length, 1);
  assert.deepEqual([made[0].width, made[0].height], [780, 1688], 'the copy is the screen\'s own size');
  assert.deepEqual(made[0].g.calls.find((c) => c[0] === 'drawImage'), ['drawImage', 'small', 0, 0, 780, 1688], 'painted over the same pixels it covered before');
  // The copy goes on at 1:1, and the caller's transform is put back.
  const di = ctx.calls.find((c) => c[0] === 'drawImage');
  assert.deepEqual(di, ['drawImage', made[0], 0, 0]);
  assert.deepEqual(ctx.m, { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });
  // Again: no new painting. A fight's push-in (a smaller view at a bigger scale) is the same screen.
  for (let i = 0; i < 5; i++) drawScreenPic(ctx, slot, 'v', 390, 844, paint, make);
  const zoomed = fakeCtx({ a: 2 * 1.06, b: 0, c: 0, d: 2 * 1.06, e: 0, f: 0 });
  drawScreenPic(zoomed, slot, 'v', 390 / 1.06, 844 / 1.06, paint, make);
  assert.equal(paints, 1, 'made once, zoom and all');
  // A new screen size, or a new picture, makes it again (in the same canvas).
  drawScreenPic(ctx, slot, 'v', 400, 844, paint, make);
  assert.equal(paints, 2);
  assert.equal(made[0].width, 800);
  drawScreenPic(ctx, slot, 'w', 400, 844, paint, make);
  assert.equal(paints, 3);
  assert.equal(made.length, 1, 'one canvas per picture, reused');
});

test('a turned or shifted screen, no canvas, or headless: the caller draws it the old way', () => {
  const paint = () => assert.fail('nothing to paint');
  assert.equal(drawScreenPic(fakeCtx({ a: 2, b: 0.1, c: 0, d: 2, e: 0, f: 0 }), {}, 'v', 100, 100, paint, factory().make), false);
  assert.equal(drawScreenPic(fakeCtx({ a: 2, b: 0, c: 0, d: 2, e: 5, f: 0 }), {}, 'v', 100, 100, paint, factory().make), false);
  assert.equal(drawScreenPic(fakeCtx(), {}, 'v', 100, 100, paint, () => null), false);
  const noTransform = fakeCtx(); delete noTransform.getTransform;
  assert.equal(drawScreenPic(noTransform, {}, 'v', 100, 100, paint, factory().make), false);
  assert.equal(drawScreenPic(fakeCtx(), {}, 'v', 100, 100, paint), false, 'headless: no document, no copy');
  assert.equal(buildVignette(100, 100), null);
});

test('the vignette\'s small picture depends on the view\'s shape only, so a fight\'s zoom keeps it', () => {
  assert.equal(vignetteKey(390 / 1.1, 844 / 1.1), vignetteKey(390 / 1.166, 844 / 1.166));
  assert.notEqual(vignetteKey(390, 844), vignetteKey(1440, 900));
  assert.equal(vignetteKey(1000, 100), 40, 'never thinner than 40px');
});

test('the depth view\'s haze: one column a pixel wide, painted once, drawn across the screen', () => {
  const made = [];
  globalThis.document = { createElement: () => { const g = fakeCtx({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }); const cv = { width: 0, height: 0, g, getContext: () => g }; made.push(cv); return cv; } };
  try {
    const dv = new DepthView();
    const pj = makeProjection(DEPTH_TILT, 390 / 1.1, 844 / 1.1);
    pj.D = 2.2;
    const ctx = fakeCtx({ a: 2.2, b: 0, c: 0, d: 2.2, e: 0, f: 0 });
    for (let i = 0; i < 4; i++) dv.haze(ctx, pj, 0.5, null, 0, 1000 + i * 16, true, true);
    const cols = made.filter((c) => c.width === 1);
    assert.equal(cols.length, 1, 'one column');
    const bandPx = pj.vh * 0.34 * 2.2;
    assert.equal(cols[0].height, Math.ceil(bandPx), 'as tall as the band in device pixels');
    assert.equal(cols[0].g.calls.filter((c) => c[0] === 'grad').length, 1, 'its gradient worked out once');
    assert.deepEqual(cols[0].g.calls.find((c) => c[0] === 'grad'), ['grad', 0, 0, 0, bandPx], 'over the band\'s own pixels');
    const draws = ctx.calls.filter((c) => c[0] === 'drawImage');
    assert.equal(draws.length, 4, 'one copy a frame');
    assert.deepEqual(draws[0], ['drawImage', cols[0], 0, 0, 1, cols[0].height, 0, 0, pj.vw * 2.2, cols[0].height], 'stretched across only, row for row');
    assert.deepEqual(ctx.m, { a: 2.2, b: 0, c: 0, d: 2.2, e: 0, f: 0 }, 'the screen transform is put back for the wisps');
    assert.equal(ctx.calls.filter((c) => c[0] === 'fillRect').length, 0, 'no full gradient fill a frame');
    // Dusk brings a new colour: painted again, in the same column.
    dv.haze(ctx, pj, 0.72, null, 0, 2000, true, true);
    assert.equal(made.filter((c) => c.width === 1).length, 1);
    assert.equal(cols[0].g.calls.filter((c) => c[0] === 'grad').length, 2);
  } finally { delete globalThis.document; }
});
