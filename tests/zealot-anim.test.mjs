// The Zealot's censer swing (render/censerSwing.js): the censer swings on its
// chain along a smooth arc, the spell leaves the censer at the release and
// still lands when the game says, and low graphics and Reduce motion draw
// headlessly.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { censerPose, censerPoints, censerBackTurn, drawCenserSwing, censerBolt, CENSER_RELEASE } from '../src/render/censerSwing.js';
import { HERO_CLIPS, WEAPON_CLIP, sampleHeroClip } from '../src/render/heroanim.js';
import { drawRangedHeroRig } from '../src/render/rangedHeroRig.js';

// The Zealot's resting weapon picture, where the rig places it (rangedHeroRig.js PLACED).
const SX = 14.7, SY = -7.1, W = 20.8;
const IMG = { complete: true, naturalWidth: 125, naturalHeight: 143 };

/** A canvas stand-in that counts what is drawn and keeps the transform as a
 *  plain offset (enough for the bolt's hand-off). */
function stubCtx() {
  const stack = [];
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over', lineCap: '',
    arcs: 0, images: 0, fills: [], tx: 0, ty: 0,
    save() { stack.push([ctx.globalAlpha, ctx.tx, ctx.ty, ctx.globalCompositeOperation]); },
    restore() { [ctx.globalAlpha, ctx.tx, ctx.ty, ctx.globalCompositeOperation] = stack.pop(); },
    translate(x, y) { ctx.tx += x; ctx.ty += y; }, rotate() {}, scale() {},
    beginPath() {}, moveTo() {}, lineTo() {}, rect() {}, clip() {}, ellipse() {}, stroke() {},
    arc() { ctx.arcs++; }, fill() { ctx.fills.push(ctx.globalAlpha); },
    drawImage(img) { if (!img) throw new Error('drawImage without an image'); ctx.images++; },
    getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: ctx.tx, f: ctx.ty }; },
    get depth() { return stack.length; },
  };
  return ctx;
}
const frame = (u, more = {}) => ({ ...sampleHeroClip('censer', u, { kind: 'combat', jobClass: 'zealot', weapon: 'censer', ...more }) });

test('a censer is swung on its own clip: a shot, flung at the release', () => {
  assert.equal(WEAPON_CLIP.censer, 'censer');
  const clip = HERO_CLIPS.censer;
  assert.ok(clip.shot, 'a spell keeps the game\'s swing time');
  assert.equal(CENSER_RELEASE, clip.hits[0]);
  assert.ok(CENSER_RELEASE > 0.35 && CENSER_RELEASE < 0.6, 'a wind-up before it, a follow-through after');
});

test('the censer travels one smooth arc: no jumps between frames, at rest at both ends', () => {
  for (const calm of [false, true]) {
    const rest = censerPose(0, calm, {});
    assert.deepEqual([rest.arm, rest.chain, rest.reach], [0, 0, 1], 'starts on the resting picture');
    const end = censerPose(1, calm, {});
    assert.ok(Math.abs(end.arm) < 1e-6 && Math.abs(end.chain) < 1e-6 && Math.abs(end.reach - 1) < 1e-6, 'hands back to the resting picture');
    // 400 steps through the clip (a frame at 60fps is about 25 of them). The
    // throw is fast, so a jump is told from motion by the speed changing
    // suddenly: each step must be close to the one before it.
    let prev = censerPoints(0, SX, SY, W, calm, {}), prevPose = censerPose(0, calm, {});
    let lastMove = 0, lastTurn = 0, lastArm = 0, prevArm = 0;
    for (let i = 1; i <= 400; i++) {
      const u = i / 400, p = censerPoints(u, SX, SY, W, calm, {}), q = censerPose(u, calm, {});
      const move = Math.hypot(p.cx - prev.cx, p.cy - prev.cy), turn = q.chain - prevPose.chain;
      assert.ok(move < 2.5, `censer jumps at u=${u} (${move})`);
      assert.ok(Math.abs(move - lastMove) < 0.25, `censer lurches at u=${u}`);
      assert.ok(Math.abs(turn - lastTurn) < 0.02, `chain angle lurches at u=${u}`);
      assert.ok(Math.abs(q.arm - prevPose.arm - lastArm) < 0.012, `arm lurches at u=${u}`);
      prev = p; prevPose = q; lastMove = move; lastTurn = turn; lastArm = q.arm - prevArm; prevArm = q.arm;
    }
  }
});

test('the swing has a wind-up, a throw that overshoots, and a settle (gentler with Reduce motion)', () => {
  const at = (u, calm) => censerPose(u, calm, {}).chain;
  assert.ok(at(0.34, false) < -0.6, 'swung back behind the fist for the wind-up');
  assert.ok(at(CENSER_RELEASE, false) > 0.6, 'out in front as the spell is flung');
  let peak = 0, calmPeak = 0;
  for (let i = 0; i <= 100; i++) { peak = Math.max(peak, at(i / 100, false)); calmPeak = Math.max(calmPeak, at(i / 100, true)); }
  assert.ok(peak > 1.8, 'overshoots up past level');
  assert.ok(calmPeak < peak - 0.3, 'Reduce motion swings less far');
  // It rocks back past rest on the way down (the pendulum), but not with Reduce motion.
  let back = 0, calmBack = 0;
  for (let i = 60; i <= 100; i++) { back = Math.min(back, at(i / 100, false)); calmBack = Math.min(calmBack, at(i / 100, true)); }
  assert.ok(back < -0.1 && calmBack > -0.05);
  // The back arm pulls back as the censer arm comes forward.
  assert.ok(censerBackTurn(0.5) > 0 && censerBackTurn(0.3) < 0);
});

test('the bolt waits in the censer, leaves from it at the release and lands on time', () => {
  const ctx = stubCtx();
  ctx.translate(100, 200);   // the hero somewhere on the canvas
  const game = { jobClass: 'zealot', camera: { dpr: 1, zoom: 1 } };
  const bolt = { type: 'projectile', kind: 'bolt', el: 'holyfire', x: 5, y: 6, ex: 300, ey: 6, life: 240, maxLife: 240 };
  let now = 1000;
  // The swing starts as the game throws the bolt: it isn't shown yet.
  assert.ok(drawCenserSwing(ctx, IMG, frame(0.02), SX, SY, W, { time: now, jobClass: 'zealot' }));
  assert.equal(censerBolt(bolt, 0.02, game, now, 0, 0).t, -1, 'still in the censer');
  now += 50;
  drawCenserSwing(ctx, IMG, frame(CENSER_RELEASE - 0.05), SX, SY, W, { time: now, jobClass: 'zealot' });
  assert.equal(censerBolt(bolt, 0.4, game, now, 0, 0).t, -1, 'held through the wind-up');
  // The first frame past the release: it starts from the censer, as it was at the release.
  now += 20;
  drawCenserSwing(ctx, IMG, frame(CENSER_RELEASE + 0.03), SX, SY, W, { time: now, jobClass: 'zealot' });
  const c = censerPoints(CENSER_RELEASE, SX, SY, W, false, {});
  const out = censerBolt(bolt, 0.5, game, now, 0, 0);
  assert.equal(out.t, 0);
  assert.ok(Math.abs(out.e.x - (100 + c.cx)) < 1e-6 && Math.abs(out.e.y - (200 + c.cy)) < 1e-6, 'from the censer\'s fire');
  assert.equal(out.e.ex, 300, 'still flying at its target');
  assert.equal(bolt.x, 5, 'the game\'s own bolt is left as it is');
  // Its flight is squeezed into the time left: it arrives just as before.
  assert.equal(censerBolt(bolt, 1, game, now + 100, 0, 0).t, 1);
  assert.ok(Math.abs(censerBolt(bolt, 0.75, game, now + 60, 0, 0).t - 0.5) < 1e-9);
  // Anyone else's bolts, and the Zealot's arrows, fly as they always have.
  assert.equal(censerBolt({ ...bolt, _cz: undefined }, 0.1, { ...game, jobClass: 'priest' }, now, 0, 0), null);
  assert.equal(censerBolt({ kind: 'arrow' }, 0.1, game, now, 0, 0), null);
  // A bolt with no censer swing drawn (facing away, an orb) is not held back.
  const late = { ...bolt, _cz: undefined };
  assert.equal(censerBolt(late, 0.1, game, now + 1000, 0, 0), null);
  assert.equal(ctx.depth, 0);
});

test('low graphics, Reduce motion and the full look all draw headlessly, with no flicker under Reduce motion', () => {
  const draw = (more, time) => {
    const ctx = stubCtx();
    assert.ok(drawCenserSwing(ctx, IMG, frame(0.52, more), SX, SY, W, { time, jobClass: 'zealot', entity: { spell: 'wrath_strike' } }));
    assert.equal(ctx.depth, 0, 'save/restore balanced');
    assert.equal(ctx.globalAlpha, 1, 'opacity restored');
    assert.equal(ctx.globalCompositeOperation, 'source-over', 'blending restored');
    assert.equal(ctx.images, 2, 'the censer and the arm');
    return ctx;
  };
  const full = draw({}, 1000), low = draw({ low: true }, 1000);
  assert.ok(low.arcs < full.arcs - 4, `low graphics drops the smoke and embers (${low.arcs} vs ${full.arcs})`);
  assert.notDeepEqual(draw({}, 1000).fills, draw({}, 1137).fills, 'the flame flickers');
  assert.deepEqual(draw({ calm: true }, 1000).fills, draw({ calm: true }, 1137).fills, 'no flicker with Reduce motion');
  // Not loaded yet: nothing drawn, so the rig falls back to its painted arm.
  assert.equal(drawCenserSwing(stubCtx(), { complete: false, naturalWidth: 0 }, frame(0.5), SX, SY, W, {}), false);
});

test('the Zealot rig swings the censer through the whole clip, every mode', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 125; this.naturalHeight = 143; } };
  try {
    for (const more of [{}, { low: true }, { calm: true }]) {
      for (let i = 0; i <= 20; i++) {
        const ctx = stubCtx();
        const anim = frame(i / 20, more);
        assert.equal(drawRangedHeroRig(ctx, { jobClass: 'zealot', anim, time: 1000 + i * 16, entity: {}, gait: { phase: 0, move: 0 }, hasWeapon: true }), true);
        assert.equal(ctx.depth, 0); assert.equal(ctx.globalAlpha, 1);
      }
    }
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
