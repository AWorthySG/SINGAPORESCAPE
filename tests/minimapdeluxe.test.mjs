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
  startMapBake, MAP_BAND_ROWS,
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

// The painter as it was first written (one terrainAt call and closure per
// pixel): the faster one in minimapart.js must paint exactly the same bytes.
function paintReference(world, d, x0, y0, tw, th, R) {
  const EDGE = { [T.PATH]: [205, 156, 100], [T.SAND]: [222, 186, 132], [T.STONE]: [196, 174, 146], [T.WOOD]: [150, 104, 64] };
  const FOAM = [222, 244, 252], SHALLOW = [150, 214, 242], RIPPLE = [186, 230, 248];
  const GREEN = (t) => t === T.GRASS || t === T.DARKGRASS;
  const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const artTerrainAt = (gx, gy) => {
    const tx = Math.floor(gx / R), ty = Math.floor(gy / R), t = world.terrainAt(tx, ty);
    const fx = (gx - tx * R + 0.5) / R, fy = (gy - ty * R + 0.5) / R;
    const a = world.terrainAt(tx + (fx < 0.5 ? -1 : 1), ty);
    if (a === t || a !== world.terrainAt(tx, ty + (fy < 0.5 ? -1 : 1))) return t;
    const cx = fx - 0.5, cy = fy - 0.5;
    return cx * cx + cy * cy > 0.25 ? a : t;
  };
  const ink = Math.max(1, Math.round(R / 5)), foam = Math.max(1, Math.round(R * 0.3)), S = foam * 2;
  const M = S, pw = tw * R, ph = th * R, ew = pw + 2 * M, eh = ph + 2 * M, gx0 = x0 * R - M, gy0 = y0 * R - M;
  const plain = new Uint8Array((tw + 2) * (th + 2));
  for (let ty = -1; ty <= th; ty++) for (let tx = -1; tx <= tw; tx++) {
    const X = x0 + tx, Y = y0 + ty, t = world.terrainAt(X, Y);
    let same = 1;
    for (let j = -1; j <= 1 && same; j++) for (let i = -1; i <= 1; i++) if (world.terrainAt(X + i, Y + j) !== t) { same = 0; break; }
    plain[(ty + 1) * (tw + 2) + tx + 1] = same;
  }
  const isPlain = (gx, gy) => { const tx = Math.floor(gx / R) - x0 + 1, ty = Math.floor(gy / R) - y0 + 1; return tx >= 0 && ty >= 0 && tx < tw + 2 && ty < th + 2 && plain[ty * (tw + 2) + tx] === 1; };
  const E = new Uint8Array(ew * eh);
  for (let j = 0; j < eh; j++) for (let i = 0; i < ew; i++) {
    const gx = gx0 + i, gy = gy0 + j;
    E[j * ew + i] = isPlain(gx, gy) ? world.terrainAt(Math.floor(gx / R), Math.floor(gy / R)) : artTerrainAt(gx, gy);
  }
  const ns = Math.max(1, R >> 2);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const ei = (y + M) * ew + x + M, t = E[ei], gx = gx0 + M + x, gy = gy0 + M + y;
    let dist = 0, n = t;
    if (!isPlain(gx, gy)) {
      for (let k = 1; k <= S && !dist; k++) {
        const l = E[ei - k], r = E[ei + k], u = E[ei - k * ew], b = E[ei + k * ew];
        if (l !== t) { dist = k; n = l; } else if (r !== t) { dist = k; n = r; } else if (u !== t) { dist = k; n = u; } else if (b !== t) { dist = k; n = b; }
      }
    }
    let c = ART_RGB[t] || ART_RGB[T.GRASS], k = 1;
    const h = hash2(Math.floor(gx / ns), Math.floor(gy / ns));
    if (t === T.WATER) {
      if (dist && n !== T.WATER && dist <= foam) c = FOAM;
      else if (dist && n !== T.WATER) c = SHALLOW;
      else {
        const cw = Math.max(3, Math.round(R * 1.5));
        if (R >= 4 && hash2(Math.floor(gx / cw), Math.floor(gy / R)) < 0.16 && gy % R === (R >> 1) && gx % cw < Math.max(1, Math.round(cw * 0.45))) c = RIPPLE;
      }
    } else if (dist && n === T.WATER && dist <= ink) c = ART_INK;
    else if (dist <= ink && dist && !GREEN(t) && GREEN(n) && EDGE[t]) c = EDGE[t];
    else {
      if (dist && dist <= ink && GREEN(t) && !GREEN(n) && n !== T.WATER) k = 0.9;
      k *= 1 + (h - 0.5) * (GREEN(t) ? 0.09 : 0.05) * (R >= 4 ? 1 : 0.4);
      if (GREEN(t) && R >= 4 && h > 0.965) c = t === T.GRASS ? [184, 222, 136] : [92, 150, 72];
      else if (t === T.WOOD && R >= 4 && gy % (R >> 1) === 0) k *= 0.86;
      else if (t === T.STONE && R >= 6 && (gx % R === 0 || gy % R === 0)) k *= 0.96;
    }
    const o = (y * pw + x) * 4;
    d[o] = c[0] * k; d[o + 1] = c[1] * k; d[o + 2] = c[2] * k; d[o + 3] = 255;
  }
}

test('the faster painter paints exactly what the first one did, at every size and offset', () => {
  // A seeded patchwork of every ground kind: lakes, roads, plazas, boardwalks.
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const kinds = [T.GRASS, T.DARKGRASS, T.PATH, T.SAND, T.STONE, T.WOOD, T.WATER];
  const rows = [];
  for (let y = 0; y < 34; y++) rows.push([...Array(46)].map((_, x) => ((x - 30) ** 2 + (y - 12) ** 2 < 40 ? T.WATER : rnd() < 0.55 ? (y % 9 === 0 ? T.PATH : T.GRASS) : kinds[Math.floor(rnd() * kinds.length)])));
  const world = gridWorld(rows);
  for (const [x0, y0, tw, th, R] of [[0, 0, 46, 34, 1], [0, 0, 46, 34, 2], [-4, -3, 12, 10, 8], [30, 20, 16, 14, 8], [5, 6, 20, 12, 3],
    [10, 2, 14, 9, 4], [21, 13, 9, 11, 5], [12, 8, 10, 10, 6], [-2, 25, 15, 12, 10], [40, -5, 10, 10, 7]]) {
    const a = new Uint8ClampedArray(tw * R * th * R * 4), b = new Uint8ClampedArray(a.length);
    paintReference(world, a, x0, y0, tw, th, R);
    paintMinimapArt(world, b, x0, y0, tw, th, R);
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    assert.equal(diff, 0, `tiles ${x0},${y0} ${tw}x${th} at ${R}px a tile`);
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

test('the world map baked a band of rows at a time is the same picture as baked whole', () => {
  const G = T.GRASS, Wt = T.WATER, P = T.PATH;
  const rows = [];
  for (let y = 0; y < 23; y++) rows.push([...Array(17)].map((_, x) => ((x - 8) ** 2 + (y - 11) ** 2 < 20 ? Wt : y % 6 === 0 ? P : G)));
  const world = gridWorld(rows), R = 2, W = 17, H = 23, row = W * R * 4;
  const whole = new Uint8ClampedArray(W * R * H * R * 4);
  paintMinimapArt(world, whole, 0, 0, W, H, R);
  for (const band of [1, 5, MAP_BAND_ROWS]) {
    const joined = new Uint8ClampedArray(whole.length);
    for (let y = 0; y < H; y += band) {
      const n = Math.min(band, H - y), part = new Uint8ClampedArray(W * R * n * R * 4);
      paintMinimapArt(world, part, 0, y, W, n, R);
      joined.set(part, y * R * row);
    }
    assert.deepEqual(joined, whole, `bands of ${band} rows`);
  }
  assert.equal(startMapBake(world, W, H, R), null, 'headless: nothing to bake into');
});
