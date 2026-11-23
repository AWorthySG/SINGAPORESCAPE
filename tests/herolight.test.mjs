// The hero's rim light (herolight.js): baked once into each hero picture, it
// lifts dark colours just inside the ink (most on the moonlit upper left),
// leaves the ink and the light colours alone, and does nothing headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rimLight, heroLit } from '../src/render/herolight.js';

// A 60x60 sticker: clear background, a white border, a navy ink ring and a
// dark teal (Rogue-hood) fill, with a white "eye" and a light gold patch inside.
const W = 60, CLEAR = [0, 0, 0, 0], WHITE = [255, 255, 255, 255], INK = [8, 10, 30, 255], HOOD = [24, 60, 72, 255], GOLD = [250, 214, 120, 255];
function sticker() {
  const px = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const r = Math.max(Math.abs(x - 29.5), Math.abs(y - 29.5));
    let c = r > 27 ? CLEAR : r > 25 ? WHITE : r > 22 ? INK : HOOD;
    if (x >= 28 && x < 31 && y >= 28 && y < 31) c = WHITE;            // an eye
    if (x >= 34 && x < 40 && y >= 34 && y < 40) c = GOLD;             // gold trim
    px.set(c, (y * W + x) * 4);
  }
  return px;
}
const at = (px, x, y) => [...px.slice((y * W + x) * 4, (y * W + x) * 4 + 4)];
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

test('the rim lifts the dark fill inside the ink, brightest up and to the left', () => {
  const before = sticker(), px = rimLight(sticker(), W, W);
  assert.deepEqual(at(px, 1, 30), at(before, 1, 30), 'the clear background is untouched');
  assert.deepEqual(at(px, 3, 30), WHITE, 'the white sticker border stays white');
  assert.deepEqual(at(px, 6, 30), at(before, 6, 30), 'the ink outline stays ink');
  const top = at(px, 30, 9), bottom = at(px, 30, 50), left = at(px, 9, 30), right = at(px, 50, 30), middle = at(px, 20, 30);
  assert.ok(lum(top) > lum(HOOD) + 40, 'a clear rim on the lit side');
  assert.ok(lum(top) > lum(bottom) + 20 && lum(left) > lum(right) + 10, '...brighter than on the far side');
  assert.ok(lum(bottom) > lum(middle), 'but some all the way round');
  const topLeft = top;
  assert.ok(lum(middle) > lum(HOOD) && lum(middle) < lum(HOOD) + 20, 'a faint fill across the dark colour');
  assert.ok(topLeft[2] >= topLeft[0], 'a cool, moonlit light');
  const gold = at(px, 36, 36);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(gold[i] - GOLD[i]) <= 2, 'light colours keep their own colour');
  assert.deepEqual(at(px, 29, 29), WHITE, 'a white eye inside is not taken for the outside');
  assert.ok(Math.abs(lum(at(px, 26, 29)) - lum(at(px, 33, 29))) < 6, '...so it gets no rim of its own');
  for (let i = 3; i < px.length; i += 4) assert.equal(px[i], before[i], 'the outline of the figure (its alpha) never changes');
});

test('headless, or before a picture has loaded, the hero is drawn from its own picture', () => {
  const img = { complete: true, naturalWidth: 10, naturalHeight: 10 };
  assert.equal(heroLit(img), img, 'no DOM: the picture itself');
  assert.equal(heroLit(null), null);
});
