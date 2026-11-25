// Drawing a crowd of monsters more cheaply without changing the picture:
// rigged monsters' parts posed with one matrix each (sprites.js drawRigParts),
// monsters in the tilted view's flat corners left undrawn when they land off
// the screen (projection.js rowBoxOff), and crit stars stamped from pictures
// of themselves (combatfx.js starPic).
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { TILE } from '../src/config.js';
import { Renderer } from '../src/render/renderer.js';
import { drawRigParts } from '../src/render/sprites.js';
import { buildRig } from '../src/render/creatureRigs.js';
import { inkPart } from '../src/render/rigink.js';
import { DEPTH_TILT, makeProjection, rowBoxOff, rowTransform } from '../src/render/projection.js';
import { starPic } from '../src/render/combatfx.js';

// ---------------- Rig parts, one matrix each ----------------
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
/** A context that keeps its transform as a canvas does and notes each drawImage with the matrix it was drawn at. */
function matrixCtx(base) {
  let m = [...base];
  const stack = [], draws = [];
  return {
    draws, calls: 0,
    save() { this.calls++; stack.push(m); }, restore() { this.calls++; m = stack.pop(); },
    translate(x, y) { this.calls++; m = mul(m, [1, 0, 0, 1, x, y]); },
    rotate(a) { this.calls++; m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
    scale(x, y) { this.calls++; m = mul(m, [x, 0, 0, y, 0, 0]); },
    setTransform(a, b, c, d, e, f) { this.calls++; m = [a, b, c, d, e, f]; },
    getTransform() { const [a, b, c, d, e, f] = m; return { a, b, c, d, e, f }; },
    drawImage(img, ...args) { this.calls++; draws.push({ img, args, m: [...m] }); },
    get m() { return m; },
  };
}
// The parts as they were drawn before (a save, the steps round the joint and a restore round each).
function drawRigPartsBefore(g, rig, imgs, opts, t, x0, y0, w, h, res) {
  for (let pass = res > 0 ? 0 : 1; pass < 2; pass++) for (const n of rig.order) {
    const part = rig.parts[n];
    const img = part && part.alt && part.swap(opts) ? imgs[part.alt] : imgs[n];
    const k = res > 0 ? inkPart(img, w, h, res) : null;
    if (!pass && !k) continue;
    const dx = pass ? (k && k.sw > 0 ? x0 + k.ax : x0) : x0 + k.x, dy = pass ? (k && k.sw > 0 ? y0 + k.ay : y0) : y0 + k.y;
    const dw = pass ? (k && k.sw > 0 ? k.aw : w) : k.w, dh = pass ? (k && k.sw > 0 ? k.ah : h) : k.h;
    g.save();
    if (part) {
      const px = x0 + part.piv[0] * w, py = y0 + part.piv[1] * h;
      const gr = part.grow ? part.grow(t, opts) : 1;
      const a = part.swing ? part.swing(t, opts) : 0;
      g.translate(px, py);
      if (part.swing) g.rotate(a);
      if (gr !== 1) g.scale(gr, gr);
      g.translate(-px, -py);
    }
    if (!pass) g.drawImage(k.cv, dx, dy, dw, dh);
    else if (k && k.sw > 0) g.drawImage(img, k.sx, k.sy, k.sw, k.sh, dx, dy, dw, dh);
    else g.drawImage(img, dx, dy, dw, dh);
    g.restore();
  }
}
// A quadruped and a boss (a pulsing gem, a roaring head), on made-up layers.
const QUAD = buildRig('test_quad', { plan: 'quad', kind: 'species', fit: 0.8, order: ['tail', 'back_far', 'front_far', 'body', 'back_near', 'front_near', 'head'],
  piv: { tail: [0.2, 0.65], back_far: [0.33, 0.41], front_far: [0.61, 0.6], body: [0.45, 0.55], back_near: [0.36, 0.43], front_near: [0.64, 0.62], head: [0.64, 0.55], head_open: [0.64, 0.55] } });
const BOSS = buildRig('test_boss', { plan: 'boss', fit: 0.8, order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
  piv: { tail: [0.3, 0.7], limb2: [0.6, 0.8], base: [0.5, 0.7], limb: [0.45, 0.76], head: [0.52, 0.56], gem: [0.53, 0.19], head_roar: [0.52, 0.56], limb_strike: [0.45, 0.76] } });
const layers = (rig) => Object.fromEntries(rig.files.map((n) => [n, { naturalWidth: 300, naturalHeight: 300, n }]));
// Poses: standing, mid-stride, mid-blow (the alternate head and limb), a signature move (the gem flares).
const POSES = [{}, { moving: true, move: 1, walk: 1.3 }, { attackK: 0.5 }, { attackK: 0.8, castK: 0.4 }, { move: 0.4, walk: 0.2, attackK: 0.1 }];
const BASES = [[1, 0, 0, 1, 0, 0], [2.6, 0, 0, 2.6, 130.5, 412.25], [-1.9, 0.12, -0.05, 2.1, 300, 80]];
const close = (a, b, msg) => { for (let i = 0; i < 6; i++) assert.ok(Math.abs(a[i] - b[i]) <= 1e-9 * (1 + Math.abs(b[i])), `${msg}: ${a} vs ${b}`); };

function compareRigs(res) {
  for (const rig of [QUAD, BOSS]) {
    const imgs = layers(rig);
    for (const [pi, opts] of POSES.entries()) for (const [bi, base] of BASES.entries()) for (const t of [0, 1234.5, 98765]) {
      const before = matrixCtx(base), now = matrixCtx(base);
      drawRigPartsBefore(before, rig, imgs, opts, t, -20, -30, 40, 44, res);
      drawRigParts(now, rig, imgs, opts, t, -20, -30, 40, 44, null, res);
      const at = `pose ${pi}, base ${bi}, t ${t}`;
      assert.equal(now.draws.length, before.draws.length, `as many layers drawn (${at})`);
      now.draws.forEach((d, i) => {
        const b = before.draws[i];
        assert.equal(d.img, b.img, `the same picture, in the same order (${at}, draw ${i})`);
        assert.deepEqual(d.args, b.args, `to the same place (${at}, draw ${i})`);
        close(d.m, b.m, `at the same matrix (${at}, draw ${i})`);
      });
      close(now.m, base, `the monster's own matrix is put back (${at})`);
      assert.ok(now.calls < before.calls * 0.5, `far fewer calls on the canvas (${now.calls} vs ${before.calls})`);
    }
  }
}

test('rig parts: each layer drawn at the same matrix and place as the old save/turn/restore steps made', () => {
  compareRigs(0);
});

test('rig parts with their ink copies: navy copies first, then the parts, all at the same matrices as before', () => {
  // Canvases enough for the ink copies (rigink.js); every pixel reads back as paint.
  const canvas = () => {
    const g = { drawImage() {}, fillRect() {}, setTransform() {}, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) };
    return { width: 0, height: 0, getContext: () => g };
  };
  globalThis.document = { createElement: canvas };
  try {
    const rig = QUAD, imgs = layers(rig);
    const g = matrixCtx(BASES[1]);
    drawRigParts(g, rig, imgs, {}, 500, -20, -30, 40, 44, null, 3);
    const n = rig.order.length;
    assert.equal(g.draws.length, 2 * n, 'a navy copy and a part for each layer');
    assert.ok(g.draws.slice(0, n).every((d) => !imgs[d.img.n]), 'the navy copies go down first');
    assert.ok(g.draws.slice(n).every((d) => imgs[d.img.n] === d.img), 'then the parts');
    compareRigs(3);
  } finally { delete globalThis.document; }
});

test('rig parts on a context that cannot tell its transform: each part drawn over it at the same matrix', () => {
  for (const base of BASES) {
    const before = matrixCtx(base), now = matrixCtx(base);
    now.getTransform = undefined;
    now.transform = function (a, b, c, d, e, f) { this.calls++; this.setTransform(...mul(this.m, [a, b, c, d, e, f])); this.calls--; };
    drawRigPartsBefore(before, BOSS, layers(BOSS), { attackK: 0.6 }, 4321, -20, -30, 40, 44, 0);
    drawRigParts(now, BOSS, layers(BOSS), { attackK: 0.6 }, 4321, -20, -30, 40, 44, null, 0);
    assert.equal(now.draws.length, before.draws.length);
    now.draws.forEach((d, i) => close(d.m, before.draws[i].m, `draw ${i}`));
    close(now.m, base, 'put back');
  }
});

test('rig parts: the area noted for a hit flash covers every posed layer, and no more', () => {
  for (const rig of [QUAD, BOSS]) for (const opts of POSES) {
    const g = matrixCtx([1, 0, 0, 1, 0, 0]), box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    drawRigParts(g, rig, layers(rig), opts, 777, -20, -30, 40, 44, box, 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const { args, m } of g.draws) {
      const [dx, dy, dw, dh] = args;
      for (const [x, y] of [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]]) {
        const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
        x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
      }
    }
    for (const [k, v] of Object.entries({ x0, y0, x1, y1 })) assert.ok(Math.abs(box[k] - v) < 1e-9, `${k}: ${box[k]} vs ${v}`);
  }
});

// ---------------- Off the tilted screen ----------------
test('rowBoxOff: a box is off the screen exactly when no point of it lands on the screen at its row', () => {
  for (const [vw, vh] of [[390 / 1.76, 844 / 1.76], [1440 / 1.875, 900 / 1.875]]) {
    const pj = makeProjection(DEPTH_TILT, vw, vh);
    let off = 0, on = 0;
    for (let i = 0; i < 4000; i++) {
      const fy = Math.random() * pj.fh, x = Math.random() * (pj.fw + 200) - 100, y = fy - 12 + (Math.random() - 0.5) * 120;
      const w = 8 + Math.random() * 120, h = 8 + Math.random() * 120;
      const m = rowTransform(pj, fy, 0);
      // Brute force: sample the box's edges through the row's transform.
      let shows = false;
      for (let s = 0; s <= 40 && !shows; s++) {
        const u = s / 40;
        for (const [px, py] of [[x + u * w, y], [x + u * w, y + h], [x, y + u * h], [x + w, y + u * h]]) {
          const X = m.a * px + m.e, Y = m.d * py + m.f;
          if (X >= 0 && X <= vw && Y >= 0 && Y <= vh) shows = true;
        }
      }
      const said = rowBoxOff(pj, fy, x, y, x + w, y + h);
      if (said) { off++; assert.equal(shows, false, 'nothing of a box said to be off shows'); }
      else { on++; if (!shows) { // On no sampled edge: then the screen lies inside the box, or it only grazes a corner.
        const X0 = m.a * x + m.e, X1 = m.a * (x + w) + m.e, Y0 = m.d * y + m.f, Y1 = m.d * (y + h) + m.f;
        assert.ok(X1 >= 0 && X0 <= vw && Y1 >= 0 && Y0 <= vh, 'a box kept overlaps the screen'); } }
    }
    assert.ok(off > 300 && on > 300, `both cases met (${off} off, ${on} on)`);
  }
});

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function recordingCtx() {
  const calls = [], grad = { addColorStop() {} };
  return new Proxy({ calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'getTransform') return undefined;
      return (...a) => { calls.push([k, a]); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

test('tilted, a monster in the flat corners that lands off the screen is not drawn; one in view is', () => {
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recordingCtx() }) };
  try {
    globalThis.localStorage = fakeStorage(); clearSave();
    const g = new Game(); g.start(); g.chooseClass('swordsman');
    g.ui = new Proxy({}, { get: () => () => {} });
    g.camera.resize(390, 844, 1.76, 2);
    const r = new Renderer(g, { width: Math.ceil(g.camera.viewW), height: Math.ceil(g.camera.viewH) }, recordingCtx());
    g.reduceMotion = true;   // the tilt snaps on
    g.camera.snapped = false; g.update(16);   // the camera on the player
    r.render(1000);
    const pj = r._pj;
    assert.ok(pj, 'tilted');
    // Where the flat area drawn starts (the recording context draws at 1 px a world px).
    const ox = Math.round(g.camera.originX) + Math.floor(pj.fx0), oy = Math.round(g.camera.originY) + Math.floor(pj.fy0);
    // Clear the monsters about, then one by you and one just past the near left
    // corner of the flat area (near enough that the flat test alone draws it).
    const px = g.player.x, py = g.player.y;
    g.npcs = g.npcs.filter((n) => n.ally || Math.abs(n.x - px) > 70 || Math.abs(n.y - py) > 70);
    const here = g.spawnNpc('goblin', px + 1, py, { wander: 0 });
    const corner = g.spawnNpc('goblin', Math.ceil((ox - 63) / TILE), Math.round((oy + pj.fh - 40 - TILE / 2) / TILE), { wander: 0 });
    const fx = corner.x * TILE + TILE / 2 - ox, fy = corner.y * TILE + TILE / 2 - oy;
    assert.ok(fx > -48 && fx < 0 && fy > 0 && fy < pj.fh, `beside the flat area drawn (${fx}, ${fy})`);
    assert.ok(rowBoxOff(pj, fy + 12, fx - 56, fy - 64, fx + 56, fy + 48), 'but well off the screen at its row');
    const drawn = new Set();
    for (const n of [here, corner]) n.renderOffset = () => { drawn.add(n); return { x: 0, y: 0 }; };
    r.render(1016);
    assert.ok(r._npcsInView.includes(corner), 'the flat check alone keeps it');
    assert.ok(drawn.has(here), 'the monster by you is drawn');
    assert.ok(!drawn.has(corner), 'the one off the screen is not');
  } finally { delete globalThis.document; }
});

// ---------------- Crit stars from pictures ----------------
test('star pictures: one per colour, quarter-unit size and drawing scale, kept and reused; room for the ink line', () => {
  let made = 0;
  const make = () => { made++; return { width: 0, height: 0, getContext: () => recordingCtx() }; };
  const a = starPic(6.5, '#F5B82E', 3.3, make);
  assert.ok(a && a.cv, 'a picture');
  assert.equal(starPic(6.52, '#F5B82E', 3.6, make), a, 'the same size to a quarter unit and the same pixel scale: the same picture');
  assert.equal(made, 1);
  assert.notEqual(starPic(6.75, '#F5B82E', 3.3, make), a, 'a quarter unit bigger: its own');
  assert.notEqual(starPic(6.5, '#ffffff', 3.3, make), a, 'another colour: its own');
  assert.notEqual(starPic(6.5, '#F5B82E', 1.1, make), a, 'a coarser screen: its own');
  // Big enough for the star's points and its navy line (3.4 wide) all round, at whole pixels a unit.
  const res = Math.ceil(3.3);
  assert.ok(a.cv.width >= (6.5 + 1.7) * 2 * res && a.cv.width === a.cv.height, `room for the outline (${a.cv.width}px)`);
  assert.ok(Math.abs(a.half * 2 * res - a.cv.width) < 1e-9, 'drawn at the size it was painted');
  // Headless (no canvas): none, and the star is drawn as a path instead.
  assert.equal(starPic(4, '#123456', 2), null);
  // Kept to a few hundred pictures: the oldest go to make room.
  const first = starPic(1, '#abcdef', 2, make);
  for (let i = 1; i < 600; i++) starPic(1 + i / 4, '#abcdef', 2, make);
  const n = made;
  assert.notEqual(starPic(1, '#abcdef', 2, make), first, 'long since dropped: painted again');
  assert.equal(made, n + 1);
});
