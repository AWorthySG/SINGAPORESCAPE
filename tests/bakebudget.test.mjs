// One-off bakes spread over frames (governor.js BakeBudget): a rig's ink
// outlines (rigink.js inkRig) and the depth view's shadow outlines no longer
// all land in the frame their pictures arrive; and the frame governor judges
// the device by frames of play only (judgeFrames).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BakeBudget, bakeBudget, judgeFrames, SETTLE_MS } from '../src/render/governor.js';
import { inkRig, inkPart, RIG_INK } from '../src/render/rigink.js';
import { DepthView } from '../src/render/depthview.js';

// A pretend clock that each bake moves on by `cost` ms.
function clock() { const c = { t: 0 }; c.now = () => c.t; return c; }
// Canvases that count their copies; getImageData says every pixel holds paint.
function canvases(log, c, cost) {
  return (W, H) => {
    const g = {
      drawImage: () => { log.n++; c.t += cost / 18; },
      fillRect() {}, clearRect() {}, setTransform() {},
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }),
    };
    return { width: W, height: H, getContext: () => g };
  };
}

test('a bake allowance: spent within a frame, given back by the next (or after a long idle)', () => {
  const c = clock(), b = new BakeBudget(6, 250, c.now);
  b.frame();
  assert.equal(b.ok(), true);
  b.run(() => { c.t += 4; });
  assert.equal(b.ok(), true, '4 of 6 ms used');
  b.run(() => { c.t += 30; });
  assert.equal(b.ok(), false, 'a long bake ends the frame\'s baking');
  c.t += 100;
  assert.equal(b.ok(), false, 'still the same frame');
  b.frame();
  assert.equal(b.ok(), true, 'the next frame may bake again');
  b.run(() => { c.t += 10; });
  c.t += 300;
  assert.equal(b.ok(), true, 'nothing drawing frames: it comes back after a while');
  assert.ok(bakeBudget instanceof BakeBudget);
});

test('a rig\'s ink outlines are baked a few a frame; once all are in it is ready, and stays so for free', () => {
  const c = clock(), b = new BakeBudget(6, 250, c.now), log = { n: 0 }, make = canvases(log, c, 8);
  const files = ['body', 'head', 'arm', 'leg', 'tail', 'mouth_open'];
  const imgs = Object.fromEntries(files.map((n) => [n, { naturalWidth: 300, naturalHeight: 300, n }]));
  let frames = 0;
  b.frame();
  while (!inkRig(imgs, files, 34, 34, 3, b, RIG_INK, make)) { frames++; b.frame(); assert.ok(frames < 20); }
  assert.ok(frames >= 3, `spread over frames (${frames}), not all in one`);
  // Every part's copy is kept: inkPart hands back the same one without baking.
  const n = log.n;
  for (const f of files) assert.ok(inkPart(imgs[f], 34, 34, 3, RIG_INK, make));
  assert.equal(log.n, n, 'all baked already');
  // Ready from then on: no budget asked, nothing baked.
  const spent = { ok: () => assert.fail('no budget needed once ready'), run: () => assert.fail('no bake') };
  for (let i = 0; i < 5; i++) assert.equal(inkRig(imgs, files, 34, 34, 3, spent, RIG_INK, make), true);
  // Without an allowance (tools, tests) a rig is inked all at once, as before.
  const other = Object.fromEntries(files.map((x) => [x, { naturalWidth: 200, naturalHeight: 200 }]));
  assert.equal(inkRig(other, files, 30, 30, 3, null, RIG_INK, make), true);
});

test('the depth view\'s shadow outlines wait for the frame\'s allowance (headless: none made at all)', () => {
  const dv = new DepthView();
  const c = clock();
  dv.budget = new BakeBudget(6, 250, c.now);
  dv.budget.frame(); dv.budget.spend(10);
  const img = { naturalWidth: 100, naturalHeight: 100 };
  assert.equal(dv._silhouette(img), null, 'over the allowance: not this frame');
  dv.budget.frame();
  assert.equal(dv._silhouette(img), null, 'headless: no canvas, so none');
  assert.equal(dv._sil.get(img), null, '...and that answer is kept');
});

test('the frame governor judges the device by frames of play only, after it has settled', () => {
  assert.equal(judgeFrames(false, 60000), false, 'the title\'s loading runs slow on any phone');
  assert.equal(judgeFrames(true, 0), false, 'the first area is still being made ready');
  assert.equal(judgeFrames(true, SETTLE_MS - 1), false);
  assert.equal(judgeFrames(true, SETTLE_MS), true);
  assert.ok(SETTLE_MS >= 2000 && SETTLE_MS <= 5000);
});
