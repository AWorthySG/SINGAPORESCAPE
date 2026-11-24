// Three looks put right: rigged monsters step in time with the ground they
// cover (no pacing on the spot, no sliding) and bring their legs down gently
// when they stop; your target's tag sits above its health bar, clear of the
// monster; and the Celestial Peaks' stone is cool grey-blue rock rather than
// the town's warm paving, baked once into the terrain chunks. All headless.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave } from '../src/game/save.js';
import { NPCS } from '../src/data/npcs.js';
import { TERRAIN } from '../src/data/world.js';
import { CREATURE_RIGS, stride, gaitPhase } from '../src/render/creatureRigs.js';
import { Renderer, REGION_GROUND, groundTextures } from '../src/render/renderer.js';
import { targetTag, targetTagY, spriteReach, TAG_H } from '../src/render/worldlabels.js';
import { recolourGround } from '../src/render/terrainfx.js';
import { TICK_MS } from '../src/config.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}

// ---------------- Strides ----------------
// The parts that walk: legs of four-legged walkers, crawlers and bipeds, the
// arms that swing against them, and a flier's dangling feet.
const LEGS = new Set(['back_far', 'front_far', 'back_near', 'front_near', 'legs_far', 'legs_near', 'leg_far', 'leg_near', 'arm_far', 'feet']);
const walkers = () => Object.entries(CREATURE_RIGS).filter(([, r]) => r.kind === 'species')
  .flatMap(([id, r]) => r.order.filter((n) => LEGS.has(n) && r.parts[n]?.swing).map((n) => [id, n, r.parts[n].swing]))
  // A biped's far arm also swings with a spell cast, and crawlers' claws strike: only the stride parts.
  .filter(([id, n]) => n !== 'arm_far' || ['imp', 'chicken', 'goblin', 'bandit', 'skeleton'].includes(id));
const BODY_PLANS = ['quad', 'crawl', 'biped', 'flier'];

test('rigged legs follow the ground walked, not the clock', () => {
  const parts = walkers();
  assert.ok(parts.length >= 40, `plenty of walking parts: ${parts.length}`);
  // Every body plan with legs is covered: four-legged, crawling, upright and flying.
  for (const id of ['wild_boar', 'jungle_spider', 'goblin', 'forest_drake']) assert.ok(parts.some(([r]) => r === id), id);
  assert.equal(BODY_PLANS.length, 4);
  for (const [id, n, swing] of parts) {
    for (const walk of [0.3, 1.7, 4.25]) {
      // Mid-walk, the same spot on the ground is the same pose whatever the time.
      const a = swing(1000, { walk, move: 1, moving: true }), b = swing(98765, { walk, move: 1, moving: true });
      assert.ok(Math.abs(a - b) < 1e-9, `${id} ${n} at ${walk} tiles: ${a} vs ${b}`);
    }
    // Standing still the legs only breathe, however long it stands.
    for (const t of [0, 777, 5000, 123456]) {
      const a = swing(t, { walk: 2.6, move: 0, moving: false });
      assert.ok(Math.abs(a) <= 0.085, `${id} ${n} at rest, t=${t}: ${a}`);
    }
  }
});

test('the stride keeps its old cadence at a walk, now counted per tile', () => {
  const o = { walk: 1, move: 1, moving: true };
  assert.ok(Math.abs(gaitPhase(0, o, 0.022) - 0.022 * TICK_MS) < 1e-9, 'a tile walked is a tick of the old clock');
  assert.ok(Math.abs(gaitPhase(500, {}, 0.022) - 11) < 1e-9, 'no walk phase (a preview): the clock stands in');
  const leg = stride(0, 0.4);
  assert.ok(Math.abs(leg(0, { walk: 0, move: 1, moving: true })) < 1e-9, 'a fresh walker starts with its feet together');
});

// A real monster walks three tiles and stops: trace its near front leg each frame.
function traceLeg(stepMul) {
  const id = Object.keys(NPCS).find((k) => NPCS[k].family === 'wild_boar' && !NPCS[k].boss);
  const n = new NPC(id, 10, 10, 0, {});
  n.stepMul = stepMul;
  n.setPath([{ x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }]);
  const leg = CREATURE_RIGS.wild_boar.parts.front_near.swing;
  const out = [];
  let t = 1000;
  for (let f = 0; f < 600; f++) {
    n.update(16); t += 16;
    out.push({ a: leg(t, { walk: n.walkPhase, move: n.animMove, moving: n.isMoving }), moving: n.isMoving, t });
  }
  return out;
}
const swingsWhileWalking = (tr) => {
  let k = 0;
  for (let i = 1; i < tr.length; i++) if (tr[i].moving && Math.sign(tr[i].a) !== Math.sign(tr[i - 1].a)) k++;
  return k;
};

test('a slow walker and a quick one take the same steps over the same ground', () => {
  const slow = traceLeg(1.8), quick = traceLeg(1);
  const a = swingsWhileWalking(slow), b = swingsWhileWalking(quick);
  assert.ok(a >= 8, `the legs swing as it walks: ${a}`);
  assert.ok(Math.abs(a - b) <= 1, `steps follow distance, not time: ${a} vs ${b}`);
});

test('when it stops, the legs come down to rest smoothly, with no snap', () => {
  for (const mul of [1.8, 1]) {
    const tr = traceLeg(mul);
    const stop = tr.findIndex((f) => !f.moving);
    assert.ok(stop > 0, 'it arrives');
    // No frame jumps the leg further than a walking frame turns it.
    for (let i = stop; i < tr.length; i++) assert.ok(Math.abs(tr[i].a - tr[i - 1].a) < 0.08, `frame ${i - stop} after stopping: ${tr[i - 1].a} -> ${tr[i].a}`);
    // Not frozen mid-stride either: well within a second it is back to its idle breath.
    const later = tr.filter((f) => f.t - tr[stop].t >= 700);
    for (const f of later) assert.ok(Math.abs(f.a) <= 0.031, `at rest ${f.t - tr[stop].t}ms on: ${f.a}`);
  }
});

// ---------------- The target's tag ----------------
function textCtx() {
  const noop = () => {}, grad = { addColorStop: noop };
  const texts = [];
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '',
    measureText: (s) => ({ width: String(s).length * 6 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
    fillText: (s, x, y) => texts.push({ s: String(s), x, y }), texts,
  };
  for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'setLineDash', 'transform', 'beginPath', 'closePath', 'drawImage',
    'strokeText', 'clearRect', 'setTransform', 'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo',
    'fill', 'stroke', 'fillRect', 'strokeRect']) ctx[k] = noop;
  return ctx;
}
function fightScene(id, dy = 0) {
  const g = newGame();
  const p = g.player;
  const foe = new NPC(id, p.x + 1, p.y + dy, 0, {});
  foe.hp = foe.maxHp = 1e6;
  foe.wounds = { bleed: [{ perSec: 1, left: 9 }, { perSec: 1, left: 9 }], poison: [{ perSec: 1, left: 9 }] };
  g.npcs.push(foe);
  g._near = null; g._around = null;
  p.target = foe;
  foe.combatLatch = 5;
  g.camera.resize(390, 664);   // an iPhone 13's view
  g.camera.follow(p.x * 32 + 16, p.y * 32 + 16);
  const ctx = textCtx();
  const r = new Renderer(g, {}, ctx);
  return { g, foe, r, ctx, ox: g.camera.originX, oy: g.camera.originY };
}
// The tag's centre: the headless pill writes its words 0.5px below it.
const tagY = (ctx, text) => { const t = ctx.texts.find((e) => e.s === text); return t ? t.y - 0.5 : null; };

test("the target's tag sits above its health bar, clear of the monster", () => {
  const boar = Object.keys(NPCS).find((k) => NPCS[k].family === 'wild_boar' && !NPCS[k].boss);
  const { g, foe, r, ctx, ox, oy } = fightScene(boar);
  r._drawOverheads(ox, oy, []);
  const tag = targetTag(g, foe);
  assert.match(tag, /🩸2/, 'the wounds still show');
  const y = tagY(ctx, tag);
  assert.ok(y !== null, 'the tag is drawn');
  const c = foe.renderCenter(), cy = c.y - oy, sc = foe.def.scale || 1;
  const barTop = cy - 20 * sc - 6;
  assert.ok(y + TAG_H / 2 <= barTop, `above the bar: ${y + TAG_H / 2} vs ${barTop}`);
  assert.ok(y + TAG_H / 2 <= cy - spriteReach(sc, foe.def.sprite), 'clear of the tallest the picture stands, mid-lunge');
  assert.ok(y - TAG_H / 2 >= 0, 'still on screen');
});

test("an ordinary foe's charging blow keeps its \"!\" clear of the tag", () => {
  const boar = Object.keys(NPCS).find((k) => NPCS[k].family === 'wild_boar' && !NPCS[k].boss);
  const { g, foe, r, ctx, ox, oy } = fightScene(boar);
  foe.telegraph = 2;
  r._drawOverheads(ox, oy, []);
  const y = tagY(ctx, targetTag(g, foe));
  const bang = ctx.texts.find((e) => e.s === '!');
  assert.ok(y !== null && bang, 'both drawn');
  assert.ok(y + TAG_H / 2 <= bang.y - 13, `the tag over the 18px "!": ${y} vs ${bang.y}`);
});

test('the reach covers a strike and a hover, at every size', () => {
  for (const sc of [0.8, 1, 1.4, 2.5]) {
    // The art is 34 units tall from feet 11.5 px below the centre, stretched 14% as it strikes.
    const top = -2 + 13.5 * sc - 34 * 1.14 * sc;
    assert.ok(spriteReach(sc) >= -top + 5, `scale ${sc}: plus its 5px lunge`);
    assert.ok(spriteReach(sc, 'bat') >= spriteReach(sc) + 4 * sc, 'fliers hover higher');
    assert.ok(targetTagY(sc, -20 * sc - 6) + TAG_H / 2 <= -spriteReach(sc), 'the tag clears it');
  }
});

test("a boss's tag goes over its name, and a charging blow's \"!\" stays in view", () => {
  const boss = Object.keys(NPCS).find((k) => NPCS[k].boss && NPCS[k].attackable !== false);
  const { g, foe, r, ctx, ox, oy } = fightScene(boss, 2);
  foe.telegraph = 2;
  r._drawOverheads(ox, oy, []);
  const y = tagY(ctx, targetTag(g, foe));
  const name = ctx.texts.find((e) => e.s === foe.name);
  assert.ok(y !== null && name, 'both drawn');
  assert.ok(y <= name.y - 0.5 - 13, `the tag above the boss's name: ${y} vs ${name.y}`);
  const bang = ctx.texts.find((e) => e.s === '!');
  assert.ok(bang, 'the warning is drawn');
  // The "!" glyph (18px) stands on its baseline: the tag stays off it.
  assert.ok(y + TAG_H / 2 <= bang.y - 16 || y - TAG_H / 2 >= bang.y, `tag ${y} vs "!" ${bang.y}`);
});

test('near the top of the view the tag goes under the feet, still clear of the monster', () => {
  const boar = Object.keys(NPCS).find((k) => NPCS[k].family === 'wild_boar' && !NPCS[k].boss);
  const { g, foe, r, ctx, ox } = fightScene(boar);
  const c = foe.renderCenter();
  const oy = c.y - 24;   // the monster right at the top edge
  r._drawOverheads(ox, oy, []);
  const y = tagY(ctx, targetTag(g, foe));
  const sc = foe.def.scale || 1;
  assert.ok(y - TAG_H / 2 >= 0, `on screen: ${y}`);
  assert.ok(y - TAG_H / 2 >= c.y - oy + 11.5 * sc + 5, 'below its feet, even as it lunges');
  const name = ctx.texts.find((e) => e.s === foe.name);
  if (name) assert.ok(Math.abs(name.y - 0.5 - y) >= 13, 'and not over its name');
});

// ---------------- The Peaks' rock ----------------
test('only the Celestial Peaks have ground of their own: their stone', () => {
  assert.deepEqual(Object.keys(REGION_GROUND), ['The Celestial Peaks']);
  assert.deepEqual(Object.keys(REGION_GROUND['The Celestial Peaks']).map(Number), [TERRAIN.STONE]);
  // Recoloured until painted rock arrives (then a `tex`, which groundTextures lists for the art lock-step).
  assert.ok(REGION_GROUND['The Celestial Peaks'][TERRAIN.STONE].tint);
  assert.ok(!groundTextures().has('stone-peaks'));
});

test('the recolour turns warm paving into cool grey-blue rock and keeps its pattern', () => {
  // Three beige pixels of the paving: a crack, the slab, a highlight.
  const px = [[196, 168, 140], [226, 200, 172], [240, 220, 196]];
  const data = new Uint8ClampedArray(px.flatMap((p) => [...p, 255]));
  recolourGround(data, REGION_GROUND['The Celestial Peaks'][TERRAIN.STONE].tint);
  const out = [0, 1, 2].map((i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  for (const [r, g, b] of out) {
    assert.ok(b > r && b >= g, `cool: ${r},${g},${b}`);
    assert.ok(b - r < 50, `grey rather than blue: ${r},${g},${b}`);
  }
  const lum = ([r, g, b]) => r * 0.3 + g * 0.59 + b * 0.11;
  assert.ok(lum(out[0]) < lum(out[1]) && lum(out[1]) < lum(out[2]), 'cracks stay darker than slabs');
  assert.ok(lum(out[2]) - lum(out[0]) > lum(px[2]) - lum(px[0]), 'and read more clearly');
  assert.equal(data[3], 255, 'opacity untouched');
});

// A stand-in canvas: any drawing call is a no-op, image data is real bytes.
function fakeCanvas(made) {
  const cv = { width: 0, height: 0 };
  const g = new Proxy({ canvas: cv }, {
    get: (o, k) => (k in o ? o[k] : k === 'getImageData' ? (x, y, w, h) => { made.reads++; return { data: new Uint8ClampedArray(w * h * 4).fill(200) }; }
      : k === 'createPattern' ? () => null : () => {}),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  cv.getContext = () => g;
  return cv;
}
function withDocument(fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const made = { canvases: 0, reads: 0 };
  globalThis.document = { createElement: () => { made.canvases++; return fakeCanvas(made); } };
  try { return fn(made); } finally { if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document; }
}
// A stone tile in the Peaks, and one in town.
function stoneTiles(w) {
  let peaks = null, town = null;
  for (let y = 0; y < w.height && !(peaks && town); y++) for (let x = 0; x < w.width; x++) {
    if (w.terrainAt(x, y) !== TERRAIN.STONE) continue;
    const z = w.zoneAt(x, y)?.name;
    if (z === 'The Celestial Peaks') peaks ||= { x, y };
    else if (z) town ||= { x, y };
  }
  return { peaks, town };
}

test("the Peaks' stone is drawn from the recoloured texture, made once; elsewhere the paving is untouched", () => {
  withDocument((made) => {
    const g = newGame();
    const r = new Renderer(g, {}, fakeCanvas(made).getContext('2d'));
    const plain = { naturalWidth: 128, naturalHeight: 128, id: 'plain' };
    r.groundTex = { ready: true, variants: {}, region: {}, [TERRAIN.STONE]: plain, [TERRAIN.GRASS]: { naturalWidth: 128, id: 'grass' } };
    const { peaks, town } = stoneTiles(g.world);
    assert.ok(peaks && town, 'stone in both places');
    const drawn = [];
    const dst = { drawImage: (img) => drawn.push(img) };
    const reads = made.reads;
    for (let i = 0; i < 50; i++) r._groundTile(dst, TERRAIN.STONE, peaks.x, peaks.y, 0, 0);
    assert.equal(made.reads - reads, 1, 'recoloured once, not per tile');
    assert.ok(drawn.every((img) => img !== plain && img === drawn[0]), 'the rock texture');
    drawn.length = 0;
    r._groundTile(dst, TERRAIN.STONE, town.x, town.y, 0, 0);
    assert.equal(drawn[0], plain, 'town paving as before');
    r._groundTile(dst, TERRAIN.GRASS, peaks.x, peaks.y, 0, 0);
    assert.equal(drawn[1].id, 'grass', "the Peaks' grass as before");
  });
});

test('terrain chunks still bake once and come from the cache after', () => {
  withDocument(() => {
    const g = newGame();
    const r = new Renderer(g, {}, fakeCanvas({ reads: 0 }).getContext('2d'));
    r.groundTex = { ready: true, variants: {}, region: {}, [TERRAIN.STONE]: { naturalWidth: 128, naturalHeight: 128 } };
    const { peaks } = stoneTiles(g.world);
    const cx = Math.floor(peaks.x / 32), cy = Math.floor(peaks.y / 32);
    r._chunk(cx, cy);   // (the first bake also sets up the polish, whose signature then keys the cache)
    const a = r._chunk(cx, cy);
    assert.ok(a, 'baked');
    assert.equal(r._chunk(cx, cy), a, 'the same canvas from the cache');
    assert.equal(r.terrainCanvas.chunks.size, 1);
    assert.equal(Object.keys(r.groundTex.region).length, 1, "one rock texture for the Peaks' chunks");
  });
});
