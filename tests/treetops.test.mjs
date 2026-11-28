// Tree canopies show whole. Four tree pictures (bamboo, magic, mahogany, yew)
// came in with the top of the canopy sliced off flat, so every one of those
// trees stood in the world with a straight edge across its crown. Their tops
// were closed off with an ink-lined cap of their own foliage. These tests keep
// it that way: each tree picture leaves clear rows above its canopy, and the
// renderer draws every row of the picture, swaying or not.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Every picture "loads" at once, 200 px tall (the tree pictures' size).
globalThis.Image = class { constructor() { this.naturalWidth = 170; this.naturalHeight = 200; this.complete = true; } };
const { worldArt, drawObjectSprite } = await import('../src/render/sprites.js');
const { OBJECTS } = await import('../src/data/objects.js');

const dir = fileURLToPath(new URL('../assets/world/', import.meta.url));
// Measured from each file's alpha (Node cannot decode .webp): the rows of clear
// pixels above the canopy, with the file's size so a changed picture must be
// measured again. To re-measure one with ImageMagick:
//   convert assets/world/tree-<id>.webp -alpha extract -threshold 50% -trim -format '%Y' info:
const TOPS = JSON.parse(readFileSync(new URL('./fixtures/tree-tops.json', import.meta.url), 'utf8'));

test('every tree picture leaves clear rows above its canopy (none is cut off flat)', () => {
  const trees = readdirSync(dir).filter((f) => /^tree-.*\.webp$/.test(f)).map((f) => f.slice(0, -5));
  assert.ok(trees.length >= 19, `${trees.length} tree pictures`);
  for (const key of trees) {
    const m = TOPS[key];
    assert.ok(m, `${key}: measured in tests/fixtures/tree-tops.json`);
    assert.equal(statSync(`${dir}${key}.webp`).size, m.bytes, `${key}: the picture changed since it was measured; measure it again`);
    assert.ok(m.clearRows >= 1, `${key}: its canopy touches the top edge of the picture (cut off?)`);
  }
});

// A context that notes each picture drawn (with its screen box) and any clip.
function recordingCtx() {
  const c = { m: [1, 0, 0, 1, 0, 0], stack: [], draws: [], clips: 0, globalAlpha: 1, filter: 'none' };
  const mul = (a, b, cc, d, e, f) => { const [A, B, C, D, E, F] = c.m; c.m = [A * a + C * b, B * a + D * b, A * cc + C * d, B * cc + D * d, A * e + C * f + E, B * e + D * f + F]; };
  Object.assign(c, {
    save() { c.stack.push({ m: [...c.m], a: c.globalAlpha }); },
    restore() { const s = c.stack.pop(); if (s) { c.m = s.m; c.globalAlpha = s.a; } },
    transform: mul, translate(x, y) { mul(1, 0, 0, 1, x, y); }, scale(x, y) { mul(x, 0, 0, y, 0, 0); },
    clip() { c.clips++; },
    drawImage(img, ...a) {
      const [x, y, w, h] = a.length === 4 ? a : a.slice(-4);
      const ys = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => c.m[1] * px + c.m[3] * py + c.m[5]);
      const left = (py) => c.m[0] * x + c.m[2] * py + c.m[4];
      c.draws.push({ args: a.length, top: Math.min(...ys), bottom: Math.max(...ys), h,
        startX: left(y), endX: left(y + h), alpha: c.globalAlpha,
        sourceY: a.length === 8 ? a[1] : 0, sourceH: a.length === 8 ? a[3] : img.naturalHeight });
    },
  });
  for (const k of ['beginPath', 'closePath', 'moveTo', 'lineTo', 'ellipse', 'arc', 'fill', 'stroke', 'fillRect', 'rect']) c[k] = () => {};
  return c;
}

test('a tree is drawn whole, its full height above its feet, at any moment of its sway', () => {
  const trees = Object.entries(OBJECTS).filter(([id, d]) => d.type === 'tree' && worldArt().has(`tree-${d.borrow || id}`));
  assert.ok(trees.length >= 18, `${trees.length} trees`);
  for (const [id, def] of trees) {
    for (const bend of [0, -0.038, 0.024]) {
      const ctx = recordingCtx();
      drawObjectSprite(ctx, { objId: id, def, x: 7, y: 9, depleted: false }, 100, 100, 700, false, false, 1, null, bend);
      assert.equal(ctx.clips, 0, `${id}: nothing clips the canopy`);
      assert.equal(ctx.draws.length, bend ? 3 : 1);
      let last = null, rows = 0;
      for (const pic of ctx.draws) {
        assert.equal(pic.sourceY, rows, `${id}: no source rows are lost`);
        rows += pic.sourceH;
        if (last) {
          assert.ok(Math.abs(last.bottom - pic.top) < 1e-6);
          assert.ok(Math.abs(last.endX - pic.startX) < 1e-6, `${id}: the bent bands join`);
        }
        last = pic;
      }
      assert.equal(rows, 200);
      assert.ok(Math.abs(last.endX - (100 - Math.min(66, 74 * 170 / 200) / 2)) < 1e-6, `${id}: the root stays put`);
    }
  }
});

test('a bent canopy can fade while the root stays opaque', () => {
  const ctx = recordingCtx();
  drawObjectSprite(ctx, { objId: 'oak', def: OBJECTS.oak, x: 1, y: 1 }, 100, 100, 500, false, false, 0.4, null, -0.025);
  assert.deepEqual(ctx.draws.map((d) => d.alpha), [0.4, 0.4, 1]);
  assert.equal(ctx.globalAlpha, 1);
});
