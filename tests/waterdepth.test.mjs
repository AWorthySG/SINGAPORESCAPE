import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TERRAIN } from '../src/data/world.js';
import { shoreReflections, shallowFraction, waterCorners, WaterDepth } from '../src/render/waterdepth.js';

test('the water tint fades out from the bank and meets exactly across tile edges', () => {
  const world = { terrainAt: (x, y) => x === 0 && y === 0 ? TERRAIN.GRASS : TERRAIN.WATER };
  const a = waterCorners(world, 0, 1), b = waterCorners(world, 1, 1);
  for (const v of [0, 0.25, 0.5, 0.75, 1]) assert.equal(shallowFraction(a, 1, v), shallowFraction(b, 0, v));
  assert.equal(shallowFraction(a, 0, 0), 1);
  assert.equal(shallowFraction(a, 0.5, 1), 0);
  assert.equal(waterCorners(world, 5, 5), 0);
});

test('the water reaches the feathered shore in its base colour with a pale band below it', () => {
  let pixels;
  const water = new WaterDepth((width, height) => ({ c: {}, g: {
    createImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (img) => { pixels = img.data; },
  } }));
  const w = { terrainAt: (_x, y) => y < 0 ? TERRAIN.SAND : TERRAIN.WATER };
  water.drawBed({ drawImage() {} }, w, 0, 0, 0, 0);
  assert.ok(pixels.slice(0, 128).every((c, i) => i % 4 !== 3 || c === 0), 'shore-facing edge is unpainted');
  assert.equal(pixels[(32 * 8 + 16) * 4], 168, 'a pale band just below the bank');
  assert.equal(pixels[(32 * 31 + 16) * 4], 26, 'deeper water takes the cool tone');
});

test('a landmark’s reflection spans its full frontage and belongs to the chunks receiving it', () => {
  const bridge = { objId: 'punggol_footbridge', x: 30, y: 31, def: { type: 'scenery', footprint: [4, 2] } };
  const tree = { objId: 'oak', x: 30, y: 31, def: { type: 'tree' }, depleted: true };
  const world = {
    objectsIn: (x0, y0, x1, y1) => [bridge, tree].filter((o) => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1),
    terrainAt: (x, y) => x >= 29 && x <= 34 && y === 32 ? TERRAIN.WATER : TERRAIN.GRASS,
  };
  const left = shoreReflections(world, 0, 32, 32, 64);
  const right = shoreReflections(world, 32, 32, 64, 64);
  assert.deepEqual(left, [
    { o: bridge, width: 4, tiles: [[29, 32], [30, 32], [31, 32]] },
    { o: tree, width: 1, tiles: [[29, 32], [30, 32], [31, 32]] },
  ], 'a tree can grow back after the chunk is baked');
  assert.deepEqual(right, [{ o: bridge, width: 4, tiles: [[32, 32], [33, 32], [34, 32]] }]);
});

test('a cached reflection is flipped, fades out and draws as one still or three rippling bands', () => {
  const stops = [], transforms = [], draws = [];
  let baked = 0;
  const water = new WaterDepth((width, height) => {
    baked++;
    return { c: { width, height }, g: {
      setTransform(...args) { transforms.push(args); },
      drawImage() {}, fillRect() {},
      createLinearGradient() { return { addColorStop: (...args) => stops.push(args) }; },
    } };
  });
  const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage: (...args) => draws.push(args) };
  const art = { img: { naturalWidth: 100, naturalHeight: 120 }, w: 45, h: 64 };
  water.drawMirror(ctx, art, 50, 90, 0, 1);
  assert.deepEqual(transforms[0], [1, 0, 0, -1, 0, 120]);
  assert.equal(stops[0][1], '#fff');
  assert.equal(stops.at(-1)[1], 'rgba(255,255,255,0)');
  assert.equal(draws.length, 1);
  water.drawMirror(ctx, art, 50, 90, 1000, 1);
  assert.equal(baked, 1);
  assert.equal(draws.length, 4);
  assert.equal(draws.slice(1).reduce((rows, d) => rows + d[4], 0), 120);
});
