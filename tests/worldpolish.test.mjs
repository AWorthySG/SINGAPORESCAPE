// World polish: rigged monsters drawn with the stickers' ink line and size
// (rigink.js), the touches baked into the terrain where surfaces meet and per
// region (groundtouch.js, terrainfx.js seams), and the loot glow (juice.js,
// combatfx.js). Everything here runs headless: plans are plain data, and
// drawing goes to stand-in canvases that record what they were asked to do.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildWorld, TERRAIN } from '../src/data/world.js';
import { World } from '../src/game/world.js';
import { TILE } from '../src/config.js';
import { RIG_INK, RIG_SIZE, rigSize, inkRect, inkPart } from '../src/render/rigink.js';
import { rigIds, rigInfo } from '../src/render/sprites.js';
import { touchPlan, TOUCH_DETAILS, GroundTouch } from '../src/render/groundtouch.js';
import { seamAlpha, SEAM_K, TerrainFx, FOREST, BEACH } from '../src/render/terrainfx.js';
import { lootLook, lootGlow, drawLootGlow } from '../src/render/juice.js';
import { pickupFx } from '../src/render/combatfx.js';
import { RARITY } from '../src/game/loot.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let _world;
const world = () => _world || (_world = (() => { const w = new World(); w.build(buildWorld()); return w; })());
const fresh = () => { const w = new World(); w.build(buildWorld()); return w; };

// A stand-in canvas: records each call; getImageData answers with paint in a
// fixed box (`paint` [x0, y0, x1, y1] of the canvas, by fraction) so crops can be checked.
function stubCanvas(log, paint = [0.25, 0.3, 0.75, 0.9]) {
  return (w, h) => {
    const c = { width: w, height: h, tag: `cv${w}x${h}` };
    const ctx = new Proxy({}, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'canvas') return c;
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (k === 'createImageData') return (W, H) => ({ data: new Uint8ClampedArray(W * H * 4) });
        if (k === 'getImageData') return (x, y, W, H) => {
          const d = new Uint8ClampedArray(W * H * 4);
          for (let yy = Math.floor(paint[1] * H); yy < Math.ceil(paint[3] * H); yy++) for (let xx = Math.floor(paint[0] * W); xx < Math.ceil(paint[2] * W); xx++) d[(yy * W + xx) * 4 + 3] = 255;
          return { data: d };
        };
        return (...a) => log.push([k, ...a.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v && v.tag ? v.tag : typeof v))]);
      },
      set(t, k, v) { t[k] = v; return true; },
    });
    c.getContext = () => ctx;
    return c;
  };
}

// ---------------- Rigged monsters ----------------

test('rigs draw the same ink line as the monster stickers, and every size fix names a real rig', () => {
  assert.match(read('src/render/sprites.js'), /const MONSTER_BOX = \{[^}]*ink: RIG_INK/, 'the stickers and the rigs share one ink width');
  assert.ok(RIG_INK > 1 && RIG_INK < 2);
  const ids = new Set(rigIds());
  for (const [id, k] of Object.entries(RIG_SIZE)) {
    assert.ok(ids.has(id), `${id} is a rig`);
    assert.ok(k >= 0.7 && k <= 1.2 && Math.abs(k - 1) > 0.03, `${id}: ${k} is a real correction, not a wild one`);
  }
  assert.equal(rigSize('wild_boar'), 1, 'rigs that already match are left alone');
  for (const id of ids) assert.ok(rigInfo(id).fit > 0 && rigInfo(id).order.length > 0, id);
  // The navy copy reaches the ring's width (and its soft edge) past the part on every side.
  const r = inkRect(-10, -20, 40, 30);
  assert.equal(r.pad, RIG_INK + 0.5);
  assert.deepEqual([r.x, r.y, r.w, r.h], [-10 - r.pad, -20 - r.pad, 40 + 2 * r.pad, 30 + 2 * r.pad]);
});

test('a part\'s navy copy is baked once, cut to its paint, and the part is drawn from just its painted box', () => {
  const log = [];
  const img = { naturalWidth: 300, naturalHeight: 300 };
  const part = inkPart(img, 34, 34, 3, RIG_INK, stubCanvas(log));
  assert.ok(part && part.cv, 'a navy copy');
  assert.ok(part.w < 34 + 2 * (RIG_INK + 0.5) && part.h < 34 + 2 * (RIG_INK + 0.5), 'cut down to the paint');
  // The painted box of the picture sits inside the copy, the ring's width in.
  assert.ok(part.sw > 0 && part.sw < 300 && part.sh < 300);
  assert.ok(part.ax >= part.x && part.ax + part.aw <= part.x + part.w + 1e-9 && part.ay >= part.y);
  assert.ok(part.ax >= 0 && part.ay >= 0 && part.ax + part.aw <= 34 + 1e-9 && part.ay + part.ah <= 34 + 1e-9);
  const n = log.length;
  assert.equal(inkPart(img, 34, 34, 3, RIG_INK, stubCanvas(log)), part, 'kept: asked again, nothing is redrawn');
  assert.equal(log.length, n);
  // Headless (no canvas) or a picture still loading: nothing to draw, nothing breaks.
  assert.equal(inkPart({ naturalWidth: 300, naturalHeight: 300 }, 34, 34, 3), null);
  assert.equal(inkPart({ naturalWidth: 0 }, 34, 34, 3, RIG_INK, stubCanvas([])), null);
});

test('a rigged monster lays its navy copies down first, in the same pose, then its parts', async () => {
  const log = [];
  const make = stubCanvas(log);
  globalThis.document = { createElement: () => make(0, 0) };
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 300; this.naturalHeight = 300; } };
  try {
    const S = await import('../src/render/sprites.js?rig-ink');
    const order = S.rigInfo('wild_boar').order;
    const screen = make(800, 600).getContext('2d');
    const opts = { time: 1000, sprite: 'beast', color: '#7a5a3a', family: 'wild_boar', scale: 1, still: true };
    S.drawCreature(screen, 'wild_boar', 100, 100, opts);   // loads the layers
    log.length = 0;
    S.drawCreature(screen, 'wild_boar', 100, 100, opts);
    const draws = log.filter((c) => c[0] === 'drawImage');
    const art = draws.filter((c) => c[1] === 'object'), first = draws.indexOf(art[0]);
    assert.equal(art.length, order.length, 'one draw per part');
    const ink = draws.slice(first - order.length, first);
    assert.ok(first >= order.length && ink.every((c) => typeof c[1] === 'string' && c[1].startsWith('cv')), 'a navy copy per part, all under the parts');
    assert.ok(art.every((c) => c.length === 10), 'each part is drawn from its painted box (a source rectangle)');
  } finally { delete globalThis.document; delete globalThis.Image; }
});

// ---------------- Baked ground touches ----------------

// Kampong Glam, a stretch of Jurong Forest, the Sentosa shore, Sungei Buloh.
const CHUNKS = [[32, 32, 64, 64], [96, 128, 128, 160], [32, 64, 64, 96], [0, 128, 32, 160], [64, 32, 96, 64]];

test('the touches are the same on every build of the world, from the tile hash alone', () => {
  const a = world(), b = fresh();
  const rnd = Math.random;
  Math.random = () => { throw new Error('the bake must not roll dice'); };
  try {
    for (const [x0, y0, x1, y1] of CHUNKS) {
      assert.deepEqual(touchPlan(a, x0, y0, x1, y1), touchPlan(b, x0, y0, x1, y1), `${x0},${y0}`);
      assert.deepEqual(touchPlan(a, x0, y0, x1, y1, { low: true }), touchPlan(b, x0, y0, x1, y1, { low: true }));
    }
  } finally { Math.random = rnd; }
});

test('touches keep off water, bridges and objects, and each region gets its own', () => {
  const w = world();
  const all = { bits: [], worn: [], bases: [] };
  let lowBits = 0;
  for (let cy = 0; cy * 32 < w.height; cy++) for (let cx = 0; cx * 32 < w.width; cx++) {
    const box = [cx * 32, cy * 32, Math.min(w.width, cx * 32 + 32), Math.min(w.height, cy * 32 + 32)];
    const p = touchPlan(w, ...box);
    for (const k of Object.keys(all)) all[k].push(...p[k]);
    lowBits += touchPlan(w, ...box, { low: true }).bits.length;
  }
  for (const d of all.bits) {
    assert.ok(TOUCH_DETAILS[d.id], d.id);
    const x = Math.floor(d.px / TILE), y = Math.floor((d.py - 0.01) / TILE);
    const t = w.terrainAt(x, y);
    if (d.id === 'moss' && w.objectAt(x, y - 1)) continue;   // moss at the foot of a wall, on the tile in front
    assert.ok(t !== TERRAIN.WATER && t !== TERRAIN.WOOD, `${d.id} at ${x},${y} is on dry ground`);
    assert.equal(w.objectAt(x, y), null, `${d.id} at ${x},${y} keeps off objects`);
  }
  const zoneOf = (d) => w.zoneAt(Math.floor(d.px / TILE), Math.floor((d.py - 0.01) / TILE))?.name || '';
  const of = (id) => all.bits.filter((d) => d.id === id);
  assert.ok(of('leaves').length > 500 && of('leaves').every((d) => FOREST.has(zoneOf(d))), 'fallen leaves, in the forests only');
  assert.ok(of('ripple').length > 50 && of('pebbles').length > 50 && [...of('ripple'), ...of('pebbles')].every((d) => BEACH.has(zoneOf(d))), 'ripples and pebbles on the beaches');
  assert.ok(of('crack').length > 100 && of('crack').every((d) => w.terrainAt(Math.floor(d.px / TILE), Math.floor(d.py / TILE)) === TERRAIN.STONE), 'cracks in the paving');
  assert.ok(of('moss').length > 50, 'moss where it is wet');
  // Verge clumps sit on grass right beside a road.
  for (const d of [...of('clump'), ...of('clump_bloom')]) {
    const x = Math.floor(d.px / TILE), y = Math.floor((d.py - 0.01) / TILE);
    assert.ok([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => w.terrainAt(x + dx, y + dy) === TERRAIN.PATH), `clump at ${x},${y} is on a verge`);
  }
  assert.ok(all.worn.length > 50, 'worn earth in front of doors and stalls');
  assert.ok(all.bases.length > 100, 'the foot of buildings and walls');
  assert.ok(lowBits < all.bits.length * 0.65, 'low graphics plants about half as many');
  // Kept sparse: a few touches a tile at most, on average well under one.
  assert.ok(all.bits.length / (w.width * w.height) < 0.1);
});

test('worn earth lies in front of a landmark\'s door, on open ground', () => {
  const w = world();
  const shop = w.landmarks.find((o) => o.objId.startsWith('shophouse_row'));
  assert.ok(shop, 'a shophouse row to check');
  const p = touchPlan(w, Math.floor(shop.x / 32) * 32, Math.floor((shop.y + 1) / 32) * 32, Math.floor(shop.x / 32) * 32 + 32, Math.floor((shop.y + 1) / 32) * 32 + 32);
  const cx = shop.x * TILE + shop.def.footprint[0] * TILE / 2;
  const base = p.bases.find((b) => Math.abs((b.x0 + b.x1) / 2 - cx) < 1 && b.y === (shop.y + 1) * TILE);
  assert.ok(base, 'its foot is darkened');
  const worn = p.worn.find((d) => Math.abs(d.px - cx) < 1);
  if (worn) assert.ok(worn.py > (shop.y + 1) * TILE && worn.py < (shop.y + 2) * TILE, 'just in front of it');
});

test('the seam follows the soft edge: dark on the line, nothing far from it', () => {
  assert.equal(seamAlpha(0), 0);
  assert.equal(seamAlpha(1), 0);
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => seamAlpha(i / 100)));
  assert.ok(peak > 0.1 && peak <= 0.17, 'faint');
  assert.ok(seamAlpha(0.42) === peak || seamAlpha(0.42) > peak * 0.98);
  assert.ok(seamAlpha(0.9) < peak * 0.1 && seamAlpha(0.05) < peak * 0.25);
  assert.ok(SEAM_K[TERRAIN.PATH] && SEAM_K[TERRAIN.SAND] && SEAM_K[TERRAIN.WATER]);
  assert.equal(SEAM_K[TERRAIN.STONE], undefined, 'paving keeps its kerb instead');
});

test('the touches bake headless against a stand-in canvas, the same picture every time', () => {
  const w = world();
  const once = () => {
    const log = [];
    const g = stubCanvas(log)(1024, 1024).getContext('2d');
    new GroundTouch(stubCanvas(log)).bake(g, w, 32, 32, 64, 64, {});
    return log;
  };
  const a = once();
  assert.ok(a.filter((c) => c[0] === 'drawImage').length > 20, 'Kampong Glam gets its touches');
  assert.deepEqual(a, once());
  // No canvas to hand: nothing drawn, nothing thrown.
  const calls = [];
  assert.ok(new GroundTouch(() => null).bake(stubCanvas(calls)(32, 32).getContext('2d'), w, 32, 32, 64, 64, {}));
  // The whole polish bake (soft edges with their seams, kerbs, touches, details...) still runs headless.
  const log = [];
  new TerrainFx(stubCanvas(log)).bake(stubCanvas(log)(1024, 1024).getContext('2d'), w, 32, 32, 64, 64, () => '#fff', {});
  assert.ok(log.length > 100);
});

// ---------------- Loot glow ----------------

test('rare and better drops glow; commons do not', () => {
  for (const r of ['common', undefined, 'banana']) assert.equal(lootLook(r), null, String(r));
  for (const r of ['rare', 'epic', 'legendary']) {
    const L = lootLook(r);
    assert.ok(L && L.glow && L.beam && L.ring && L.pulse, `${r} glows and stands in a beam`);
    assert.equal(lootGlow(r).col, RARITY[r].color);
  }
  assert.ok(lootLook('legendary').sparkle && !lootLook('epic').sparkle);
});

test('low graphics and slow frames skip the beam; Reduce motion keeps the glow still', () => {
  for (const r of ['rare', 'epic', 'legendary']) {
    const low = lootLook(r, true);
    assert.ok(low.glow && low.ring && !low.beam && !low.sparkle, `${r}: glow and ring, no beam, in low graphics`);
    assert.equal(lootLook(r, false, true).pulse, false, `${r}: no pulsing under Reduce motion`);
  }
  // Drawn under Reduce motion, the glow is the same picture whatever the time.
  const rec = () => {
    const ops = [];
    const ctx = new Proxy({}, {
      get: (o, k) => (k in o ? o[k] : (...a) => ops.push([k, ...a.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : typeof v))])),
      set: (o, k, v) => { ops.push(['set', k, typeof v === 'number' ? Math.round(v * 1000) / 1000 : v]); o[k] = v; return true; },
    });
    return { ctx, ops };
  };
  for (const r of ['rare', 'legendary']) {
    const a = rec(), b = rec();
    drawLootGlow(a.ctx, r, 50, 50, 5000, 1000, false, true);
    drawLootGlow(b.ctx, r, 50, 50, 5000, 1777, false, true);
    assert.deepEqual(a.ops, b.ops, `${r}: still under Reduce motion`);
    const c = rec(), d = rec();
    drawLootGlow(c.ctx, r, 50, 50, 5000, 1000, false, false);
    drawLootGlow(d.ctx, r, 50, 50, 5000, 1777, false, false);
    assert.notDeepEqual(c.ops, d.ops, `${r}: gently pulsing otherwise`);
  }
});

test('picking up a rare or better drop sparkles where it lay; commons stay quiet', () => {
  const calls = [];
  const game = { cfx: { lootSparkle: (...a) => calls.push(a) }, reduceMotion: false };
  assert.equal(pickupFx(game, { rarity: 'common', x: 10, y: 20 }), false);
  assert.equal(pickupFx(game, { x: 10, y: 20 }), false);
  for (const r of ['rare', 'epic', 'legendary']) assert.equal(pickupFx(game, { rarity: r, x: 10, y: 20 }), true, r);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].slice(0, 3), [10, 20, RARITY.rare.color]);
  assert.ok(calls[2][3] > calls[0][3], 'rarer, more sparkle');
  game.reduceMotion = true;
  pickupFx(game, { rarity: 'epic', x: 0, y: 0 });
  assert.equal(calls[3][4], true, 'Reduce motion: the burst stays put');
  assert.equal(pickupFx({ reduceMotion: false }, { rarity: 'epic', x: 0, y: 0 }), false, 'no effect pool, no harm');
});
