import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AmbientLife } from '../src/render/ambient.js';
import { drawObjectSprite } from '../src/render/sprites.js';
import { OBJECTS } from '../src/data/objects.js';
import { hasWhiteMatte, removeWhiteMatte, worldCutout } from '../src/render/worldcutout.js';

const CLEAR = [0, 0, 0, 0];
const INK = [34, 48, 74, 255];
const WHITE = [255, 252, 247, 255];
const GOLD = [238, 184, 87, 255];
const FADE = [164, 170, 183, 255];
const palette = { '.': CLEAR, i: INK, w: WHITE, g: GOLD, f: FADE };
function sample(rows) {
  const w = rows[0].length, h = rows.length;
  const p = Uint8ClampedArray.from(rows.join('').split('').flatMap((symbol) => palette[symbol]));
  return { p, w, h, pixel: (x, y) => [...p.slice((y * w + x) * 4, (y * w + x) * 4 + 4)] };
}

test('peeling a white matte preserves the ink and pale paint inside it', () => {
  const { p, w, h, pixel } = sample([
    '.........',
    '.wwwwwww.',
    '.wiiiifw.',
    '.wiwwgiw.',
    '.wiiiiiw.',
    '.wwwwwww.',
    '.........',
  ]);
  assert.equal(removeWhiteMatte(p, w, h), true);
  assert.equal(pixel(1, 1)[3], 0, 'opaque white backing is transparent');
  assert.deepEqual(pixel(3, 3), WHITE, 'white wing paint');
  assert.deepEqual(pixel(5, 3), GOLD);
  assert.deepEqual(pixel(3, 2), INK);
  assert.deepEqual(pixel(6, 2).slice(0, 3), INK.slice(0, 3), 'ink colour recovered at a partially covered pixel');
  assert.ok(pixel(6, 2)[3] > 0 && pixel(6, 2)[3] < INK[3]);
});

test('the outer ink around a double rim can be discarded along with the matte', () => {
  const { p, w, h, pixel } = sample([
    '...........',
    '.iiiiiiiii.',
    '.iwwwwwwwi.',
    '.iwiiiiiwi.',
    '.iwiwwwiwi.',
    '.iwiiiiiwi.',
    '.iwwwwwwwi.',
    '.iiiiiiiii.',
    '...........',
  ]);
  assert.equal(removeWhiteMatte(p, w, h, { gaps: [[5, 2]], trim: true }), true);
  assert.equal(pixel(5, 1)[3], 0, 'separate navy rim on the outside of the white');
  assert.equal(pixel(5, 2)[3], 0, 'white rim');
  assert.deepEqual(pixel(5, 3), INK);
  assert.deepEqual(pixel(5, 4), WHITE);
});

test('a trapped gap can be opened without touching paint elsewhere on a tree', () => {
  const { p, w, h, pixel } = sample([
    '.........',
    '.iiiwiii.',
    '.iwiwiwi.',
    '.iwiwiwi.',
    '.iiiiiii.',
    '.........',
  ]);
  assert.equal(removeWhiteMatte(p, w, h, { gaps: [[2, 2]], exterior: false }), true);
  assert.equal(pixel(2, 3)[3], 0);
  assert.deepEqual(pixel(4, 1), WHITE);
  assert.deepEqual(pixel(6, 2), WHITE);
});

test('cutouts target remaining backings and leave newly prepared wildlife and rigs alone', () => {
  for (const file of ['species/house_crow', 'bosses/drowned_admiral']) {
    assert.ok(hasWhiteMatte(`https://example.com/SINGAPORESCAPE/assets/creatures/${file}.webp?v=3`));
  }
  assert.ok(hasWhiteMatte('assets/icons/item-raw_giant_snakehead.webp'));
  assert.ok(hasWhiteMatte('assets/world/tree-mangrove.webp'));
  assert.equal(hasWhiteMatte('assets/icons/item-raw_trout.webp'), false);
  assert.equal(hasWhiteMatte('assets/fx/critter-egret_fly-1.webp'), false);
  assert.equal(hasWhiteMatte('assets/creatures/bosses/rig/lion_of_light_head_roar.webp?v=3'), false);
  const img = { src: 'assets/creatures/species/house_crow.webp', complete: true, naturalWidth: 64, naturalHeight: 64 };
  assert.equal(worldCutout(img), img, 'no canvas required in a headless render');
});

test('sitting and sleeping cats use navy strokes while their art loads', () => {
  const strokes = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === 'stroke') return () => strokes.push(target.strokeStyle);
      return target[key] || (() => {});
    },
  });
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  try {
    const a = new AmbientLife();
    assert.ok(a._sprite('cat-calico-s'));
    assert.ok(a._sprite('cat-ginger-z'));
    assert.ok(strokes.length > 0);
    assert.deepEqual([...new Set(strokes)], ['#22304A']);
  } finally { delete globalThis.document; }
});

test('shoreline trees and stumps paint their submerged roots through the water', () => {
  globalThis.Image = class { complete = true; naturalWidth = 100; naturalHeight = 100; };
  const draws = [], savedAlphas = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key === 'drawImage') return (img, ...args) => draws.push({ src: img.src, alpha: target.globalAlpha, height: args[3] });
      if (key === 'save') return () => savedAlphas.push(target.globalAlpha);
      if (key === 'restore') return () => { target.globalAlpha = savedAlphas.pop(); };
      return target[key] ?? (() => {});
    },
  });
  const o = { objId: 'mangrove', def: OBJECTS.mangrove, x: 1, y: 1, waterRoots: true };
  try {
    drawObjectSprite(ctx, o, 50, 50, 100, false, false, 0.4);
    assert.deepEqual(draws.map(({ alpha, height }) => [alpha, height]), [[0.4, 77], [1, 10], [0.48, 13]]);
    draws.length = 0;
    drawObjectSprite(ctx, { ...o, depleted: true }, 50, 50, 100);
    assert.ok(draws.every(({ src }) => src.endsWith('stump-mangrove.webp')));
    assert.deepEqual(draws.map(({ alpha, height }) => [alpha, height]), [[1, 78], [0.48, 22]]);
    assert.equal(ctx.globalAlpha, 1);
  } finally { delete globalThis.Image; }
});
