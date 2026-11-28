// Animation smoothness: poses must never jump between consecutive frames when
// an attack restarts, a walk starts or stops, or a character turns; and the
// two drawings of a rigged weapon arm must never both show for long.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Character } from '../src/game/character.js';
import { NPC } from '../src/game/npc.js';
import { poseBlender, swapOpacity, BLEND_MS } from '../src/render/poseBlend.js';
import { HERO_RIG_CLASSES, heroRigPose, drawHeroRig } from '../src/render/heroRig.js';
import { RANGED_HERO_CLASSES, rangedHeroPose } from '../src/render/rangedHeroRig.js';
import { drawCreature, heroFlinch } from '../src/render/sprites.js';

const FRAME = 16;

// A stub 2D context that tracks the current transform and records it at the
// first path drawn, so a test can see where (and how bent) the body was drawn.
function trackingCtx() {
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const noop = () => {};
  const grad = { addColorStop() {} };
  const ctx = {
    first: null,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over',
    save() { stack.push(m.slice()); }, restore() { m = stack.pop() || [1, 0, 0, 1, 0, 0]; },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    translate(x, y) { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
    scale(x, y) { m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; },
    rotate(r) {
      const cs = Math.cos(r), sn = Math.sin(r), [a, b, c, d] = m;
      m[0] = a * cs + c * sn; m[1] = b * cs + d * sn; m[2] = -a * sn + c * cs; m[3] = -b * sn + d * cs;
    },
    beginPath() { if (!ctx.first) ctx.first = m.slice(); },
    transform: noop, clip: noop, setLineDash: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    ellipse: noop, rect: noop, roundRect: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, strokeText: noop, drawImage: noop, measureText: () => ({ width: 10 }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
  };
  return ctx;
}

// Where the creature's body is drawn this frame, built the way the renderer does.
function creatureFrame(n, t) {
  const ctx = trackingCtx();
  drawCreature(ctx, 'wild_boar', 100, 100, {
    time: t, facing: n.facing, fx: n.faceX, turn: n.turnT / 150, entity: n,
    moving: n.isMoving, walk: n.walkPhase, move: n.animMove,
    sprite: 'beast', family: 'wild_boar', attackK: n.swingProgress(), hurt: n.hurt,
  });
  return ctx.first;
}
const jump = (a, b) => ({
  px: Math.max(Math.abs(a[4] - b[4]), Math.abs(a[5] - b[5])),
  lin: Math.max(...[0, 1, 2, 3].map((i) => Math.abs(a[i] - b[i]))),
});

test('a monster eases into and out of its walk: no jolt as it starts or stops', () => {
  // Several start times, so the stop lands at different points of the hop.
  for (const start of [0, 37, 81, 143, 222]) {
    const n = new Character(5, 5);
    let t = 1000 + start, prev = null, worst = { px: 0, lin: 0 };
    for (let el = 0; el < 1800; el += FRAME) {
      if (el === 96) n.setPath([{ x: 6, y: 5 }, { x: 7, y: 5 }]);
      n.update(FRAME); t += FRAME;
      const now = creatureFrame(n, t);
      // Drop the walk itself across the ground: only the animation counts.
      const c = n.renderCenter(); now[4] -= c.x - (5 * 32 + 16); now[5] -= c.y - (5 * 32 + 16);
      if (prev) { const j = jump(prev, now); worst = { px: Math.max(worst.px, j.px), lin: Math.max(worst.lin, j.lin) }; }
      prev = now;
    }
    assert.ok(worst.px < 1, `body moves ${worst.px.toFixed(2)}px in one frame (start ${start})`);
    assert.ok(worst.lin < 0.03, `body bends/squashes ${worst.lin.toFixed(3)} in one frame (start ${start})`);
  }
});

test('a monster turning round squashes through edge-on instead of flipping in one frame', () => {
  const n = new Character(5, 5);
  n.setPath([{ x: 6, y: 5 }]);
  let t = 1000, prev = null, worst = 0, sawThin = false;
  for (let el = 0; el < 900; el += FRAME) {
    if (el === 640) n.setPath([{ x: 5, y: 5 }]);   // walk back the way it came
    n.update(FRAME); t += FRAME;
    const now = creatureFrame(n, t);
    if (Math.abs(now[0]) < 0.3) sawThin = true;
    if (prev) worst = Math.max(worst, Math.abs(now[0] - prev[0]));
    prev = now;
  }
  assert.ok(sawThin, 'passes edge-on');
  assert.ok(worst < 0.5, `horizontal scale changes by ${worst.toFixed(2)} in one frame`);
});

test('reversing a turn keeps the pose both before and after passing edge-on', () => {
  for (const dt of [24, 104]) {
    const n = new Character(5, 5);
    n.facing = { dx: -1, dy: 0 };
    n.noteFacing();
    n.update(dt);
    const before = creatureFrame(n, 1000);
    n.facing = { dx: 1, dy: 0 };
    n.noteFacing();
    const reversed = creatureFrame(n, 1000);
    assert.ok(jump(before, reversed).lin < 1e-9, `the width stays put ${dt}ms into a turn`);
  }
});

test('moving straight up or down keeps the last left/right facing', () => {
  const n = new Character(5, 5);
  n.setPath([{ x: 4, y: 5 }]);
  for (let i = 0; i < 60; i++) n.update(FRAME);
  assert.equal(n.faceX, -1);
  n.setPath([{ x: 4, y: 4 }]);
  for (let i = 0; i < 20; i++) n.update(FRAME);
  assert.equal(n.facing.dx, 0);
  assert.equal(n.faceX, -1, 'still facing left while climbing');
  assert.ok(creatureFrame(n, 2000)[0] < 0, 'and drawn facing left');
});

test('a restarted swing blends from the pose on screen instead of snapping back', () => {
  for (const classId of ['swordsman', 'berserker', 'rogue', 'lancer']) {
    const blend = poseBlender();
    const who = {};
    const fields = ['sword', 'back', 'strike', 'reach'];
    const dur = 270;
    let swing = dur, t = 0, prev = null, worst = 0;
    for (let el = 0; el <= 500; el += FRAME) {
      if (el === 144) swing = dur;      // a second attack lands mid-swing
      const k = swing > 0 ? 1 - swing / dur : -1;
      const pose = blend(who, heroRigPose(classId, {}, t, k, true), t, k, fields);
      if (prev) for (const f of fields) worst = Math.max(worst, Math.abs((pose[f] || 0) - (prev[f] || 0)) / (f === 'reach' ? 10 : 1));
      prev = { ...pose };
      swing = Math.max(0, swing - FRAME); t += FRAME;
    }
    // The fastest legitimate swing moves about 0.65 rad a frame; the raw restart jumped ~1.25.
    assert.ok(worst < 0.8, `${classId} jumps ${worst.toFixed(2)} in one frame`);
    // And it ends exactly at rest: the offset has died away.
    const rest = heroRigPose(classId, {}, t, -1, true);
    for (const f of fields) assert.ok(Math.abs((prev[f] || 0) - (rest[f] || 0)) < (f === 'reach' ? 0.1 : 0.01), `${classId}/${f} settles`);
  }
});

test('pose blending leaves ordinary motion untouched and forgets characters off screen', () => {
  const blend = poseBlender();
  const who = {};
  for (let k = 0; k <= 1; k += 0.05) {
    const raw = heroRigPose('swordsman', {}, 0, k);
    const out = blend(who, { ...raw }, k * 270, k, ['sword', 'strike']);
    assert.equal(out.sword, raw.sword);
    assert.equal(out.strike, raw.strike);
  }
  // Seen again long after, mid-swing at an earlier point: no stale offset.
  const raw = heroRigPose('swordsman', {}, 0, 0.2);
  assert.equal(blend(who, { ...raw }, 270 + 10 * BLEND_MS, 0.2, ['sword']).sword, raw.sword);
  // No key (tests, previews): passes straight through.
  assert.equal(blend(null, raw, 0, 0.5, ['sword']), raw);
});

test('a rig never shows its raised weapon and its strike drawing at once for long', () => {
  const ghostShare = (values) => values.filter((x) => Math.min(swapOpacity(x), 1 - swapOpacity(x)) > 0.25).length / values.length;
  const ks = Array.from({ length: 201 }, (_, i) => i / 200);
  for (const classId of HERO_RIG_CLASSES) {
    for (const dual of [false, true]) {
      const share = ghostShare(ks.map((k) => heroRigPose(classId, {}, 0, k, dual).strike));
      assert.ok(share <= 0.06, `${classId}: both weapon drawings half-visible for ${(share * 100).toFixed(0)}% of the swing`);
    }
  }
  for (const classId of RANGED_HERO_CLASSES) {
    for (const key of ['draw', 'cast']) {
      const share = ghostShare(ks.map((k) => rangedHeroPose(classId, {}, 0, k)[key]));
      assert.ok(share <= 0.06, `${classId}/${key}: ${(share * 100).toFixed(0)}% ghosted`);
    }
  }
  assert.equal(swapOpacity(0), 0);
  assert.equal(swapOpacity(1), 1);
});

test('the drawn rig swaps weapon drawings rather than ghosting them', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; } };
  try {
    for (const classId of ['swordsman', 'berserker', 'rogue', 'samurai', 'brawler', 'halberdier']) {
      let ghosted = 0;
      for (let i = 0; i <= 100; i++) {
        const alpha = {};
        let a = 1;
        const ctx = { get globalAlpha() { return a; }, set globalAlpha(v) { a = v; }, save() {}, restore() { a = 1; }, translate() {}, rotate() {},
          drawImage(img) { const m = img.src.match(/-(\w+)\.webp$/); if (m) alpha[m[1]] = a; } };   // painted animation art (anim/) aside
        assert.equal(drawHeroRig(ctx, { jobClass: classId, swingK: i / 100 }), true);
        if (Math.min(alpha.sword, alpha.strike) > 0.25) ghosted++;
      }
      assert.ok(ghosted <= 6, `${classId}: weapon ghosted on ${ghosted}% of the swing`);
    }
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('feet settle under the body when walking stops, rather than freezing mid-step', () => {
  const ch = new Character(5, 5);
  ch.setPath([{ x: 6, y: 5 }, { x: 7, y: 5 }]);
  let el = 0;
  while (ch.isMoving && el < 3000) { ch.update(FRAME); el += FRAME; }
  for (let i = 0; i < 25; i++) ch.update(FRAME);   // 400ms after stopping
  const pose = heroRigPose('swordsman', { phase: ch.walkPhase, move: ch.animMove }, 0);
  assert.ok(Math.abs(pose.step) < 0.02, `feet still ${pose.step.toFixed(3)} apart`);
});

test('the hero recoils from a hit and eases back by the time the flash ends', () => {
  assert.equal(heroFlinch(0), 0);
  assert.equal(heroFlinch(200), 0, 'starts from rest the instant it is struck');
  const peak = Math.max(...Array.from({ length: 21 }, (_, i) => heroFlinch(200 - i * 10)));
  assert.ok(peak > 0.95, 'leans right back');
  assert.ok(heroFlinch(5) < 0.01, 'and is home as the hurt timer runs out');
  // The recoil itself is meant to be sharp; the way back eases, a little each frame.
  let prev = 1;
  for (let h = 170; h >= 0; h -= FRAME) { const f = heroFlinch(h); assert.ok(f <= prev && prev - f < 0.2, `${h}: ${f}`); prev = f; }
});

test('a respawning monster fades in instead of popping into view', () => {
  const n = new NPC('wild_boar', 5, 5);
  n.die();
  n.respawn();
  assert.ok(n.spawnT > 0);
  for (let i = 0; i < 30; i++) n.update(FRAME);
  assert.equal(n.spawnT, 0);
});
