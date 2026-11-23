// The minimap as a sticker map (src/render/minimapart.js): the painted ground
// (rounded coasts with a navy ink line and a foam band, road hairlines), the
// landmark badges, the chunk cache that keeps the per-refresh work small, and
// the stylesheet that lets the canvas carry its own ring and compass.
// Headless: the painter is pure, and a stand-in canvas covers the cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TERRAIN as T } from '../src/data/world.js';
import {
  ART_RGB, ART_INK, paintMinimapArt, minimapObjectBadge, minimapNpcBadge, BADGE, BADGE_ESSENTIAL,
  rimPoint, MinimapChunks, MM_CHUNK_CAP, MM_BAKES_PER_DRAW, bakeMinimapPatch, badgeSprite, minimapRing,
} from '../src/render/minimapart.js';

/** A little world from rows of terrain codes (outside it is water). */
function gridWorld(rows) {
  return { width: rows[0].length, height: rows.length,
    terrainAt: (x, y) => (y >= 0 && y < rows.length && x >= 0 && x < rows[0].length ? rows[y][x] : T.WATER) };
}
const px = (d, w, x, y) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];
const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

test('the sticker map inks the coast on the land side and foams the water side', () => {
  const G = T.GRASS, Wt = T.WATER;
  const world = gridWorld([[G, G, Wt, Wt], [G, G, Wt, Wt], [G, G, Wt, Wt], [G, G, Wt, Wt]]);
  const R = 8, w = 4 * R, d = new Uint8ClampedArray(w * 4 * R * 4);
  paintMinimapArt(world, d, 0, 0, 4, 4, R);
  const y = 1 * R + 4;
  assert.deepEqual(px(d, w, 2 * R - 1, y), ART_INK, 'the last land pixel before the water is navy ink');
  const foam = px(d, w, 2 * R, y);
  assert.ok(foam[2] > 240 && foam[0] > 200, 'the first water pixel is pale foam');
  assert.ok(near(px(d, w, 4, y), ART_RGB[G], 12), 'a lawn away from the coast is grass (with a little grain)');
  assert.ok(px(d, w, 3 * R + 4, y)[2] > 200, 'open water stays blue');
  for (let i = 3; i < d.length; i += 4) assert.equal(d[i], 255, 'every pixel is opaque');
});

test('the sticker map rounds corners and edges roads with a hairline', () => {
  const G = T.GRASS, P = T.PATH;
  // A path square in a lawn: its outer corner pixel is rounded off to grass.
  const world = gridWorld([[G, G, G], [G, P, G], [G, G, G]]);
  const R = 8, w = 3 * R, d = new Uint8ClampedArray(w * 3 * R * 4);
  paintMinimapArt(world, d, 0, 0, 3, 3, R);
  const corner = px(d, w, R, R), mid = px(d, w, R + 4, R + 4);
  assert.ok(near(mid, ART_RGB[P], 14), 'the middle of the path is cream');
  assert.ok(corner[1] > corner[0], 'the outer corner of a lone path tile is rounded into the green');
  const edge = px(d, w, R + 4, R + 1);
  assert.ok(edge[0] < ART_RGB[P][0] - 20, 'the path is edged with a darker hairline');
});

test('painting is the same wherever a chunk boundary falls', () => {
  const G = T.GRASS, Wt = T.WATER, S = T.SAND;
  const rows = [];
  for (let y = 0; y < 8; y++) rows.push([...Array(8)].map((_, x) => ((x - 4) ** 2 + (y - 4) ** 2 < 6 ? Wt : (x + y) % 5 === 0 ? S : G)));
  const world = gridWorld(rows), R = 4;
  const whole = new Uint8ClampedArray(8 * R * 8 * R * 4);
  paintMinimapArt(world, whole, 0, 0, 8, 8, R);
  const part = new Uint8ClampedArray(4 * R * 4 * R * 4);
  paintMinimapArt(world, part, 4, 4, 4, 4, R);
  for (let y = 0; y < 4 * R; y++) for (let x = 0; x < 4 * R; x++) {
    assert.deepEqual(px(part, 4 * R, x, y), px(whole, 8 * R, x + 4 * R, y + 4 * R), `pixel ${x},${y}`);
  }
});

test('landmarks wear badges; bosses and shopkeepers swap their dot for one', () => {
  const o = (type) => ({ def: { type } });
  assert.equal(minimapObjectBadge(o('bank')), 'bank');
  assert.equal(minimapObjectBadge(o('transport')), 'mrt');
  for (const t of ['anvil', 'furnace', 'range', 'craft', 'fletch', 'herblore']) assert.equal(minimapObjectBadge(o(t)), 'smith', t);
  assert.equal(minimapObjectBadge(o('shrine')), 'shrine');
  assert.equal(minimapObjectBadge(o('stall')), 'shop');
  assert.equal(minimapObjectBadge(o('tree')), null, 'trees are in the painted ground, not badges');
  assert.equal(minimapNpcBadge({ def: { boss: true }, attackable: true }), 'boss');
  assert.equal(minimapNpcBadge({ def: { boss: true }, attackable: true, temporary: true }), null, 'summoned adds stay dots');
  assert.equal(minimapNpcBadge({ def: { role: 'shop', shop: 'general' }, attackable: false }), 'shop');
  assert.equal(minimapNpcBadge({ def: {}, attackable: true }), null);
  for (const k of BADGE_ESSENTIAL) assert.ok(BADGE[k], `${k} has a colour`);
});

test('a rim arrow sits on the ring, pointing the way', () => {
  const p = rimPoint(160, 160, 10, 0, 60);
  assert.deepEqual([Math.round(p.x), Math.round(p.y), p.a], [140, 80, 0]);
  const up = rimPoint(160, 160, 0, -3, 60);
  assert.equal(Math.round(up.y), 20);
});

test('headless, the sticker pictures are simply skipped', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(bakeMinimapPatch(gridWorld([[0]]), 0, 0, 1, 1, 8), null);
  assert.equal(badgeSprite('bank', 5, 1), null);
  assert.equal(minimapRing(160, 72, 1), null);
  const chunks = new MinimapChunks(gridWorld([[0]]));
  assert.equal(chunks.draw({ drawImage() { throw new Error('nothing to draw'); } }, 0, 0, 160, 160, 4), false);
});

test('the chunk cache bakes a few chunks a refresh and keeps a bounded number', () => {
  const ctx2d = () => new Proxy({}, { get: (t, k) => (k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  let baked = 0;
  globalThis.document = { createElement: () => { baked++; return { width: 0, height: 0, getContext: ctx2d }; } };
  try {
    const world = { width: 4000, height: 4000, terrainAt: () => T.GRASS };
    const chunks = new MinimapChunks(world);
    const drawn = [];
    const ctx = { drawImage: (...a) => drawn.push(a) };
    // The view (40 tiles across) needs up to 9 chunks; only a few bake per refresh.
    assert.equal(chunks.draw(ctx, 100, 100, 160, 160, 4), false);
    assert.equal(baked, MM_BAKES_PER_DRAW);
    let n = 0;
    while (!chunks.draw(ctx, 100, 100, 160, 160, 4) && n++ < 10);
    const settled = baked;
    drawn.length = 0;
    assert.equal(chunks.draw(ctx, 100, 100, 160, 160, 4), true);
    assert.equal(baked, settled, 'a settled view only copies chunks');
    assert.ok(drawn.length >= 4 && drawn.length <= 9);
    // Walking far keeps the cache bounded.
    for (let i = 0; i < 200; i++) for (let k = 0; k < 4; k++) chunks.draw(ctx, 100 + i * 16, 100, 160, 160, 4);
    assert.ok(chunks.map.size <= MM_CHUNK_CAP);
  } finally {
    delete globalThis.document;
  }
});

test('the minimap stylesheet: linked before compact.css, the canvas carries the ring', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mm = html.indexOf('styles/minimap.css'), compact = html.indexOf('styles/compact.css');
  assert.ok(mm > 0 && mm < compact, 'minimap.css comes before compact.css');
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(links[links.length - 1], 'styles/compact.css', 'compact.css stays last');
  const css = readFileSync(new URL('../styles/minimap.css', import.meta.url), 'utf8');
  assert.match(css, /#minimap-compass \{ display: none; \}/, 'the separate N badge gives way to the ring\'s own');
  assert.match(css, /#minimap-panel #minimap-region \{[^}]*margin-top: -14px/, 'the area name hangs off the ring');
});
