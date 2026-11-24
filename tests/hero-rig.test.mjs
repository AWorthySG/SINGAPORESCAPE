import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HERO_RIG_PARTS, HERO_RIG_CLASSES, heroRigSrc, swordsmanPose, heroRigPose, drawHeroRig } from '../src/render/heroRig.js';

test('Swordsman rig artwork is complete', () => {
  for (const part of HERO_RIG_PARTS) assert.ok(existsSync(new URL('../' + heroRigSrc(part), import.meta.url)), part);
});

test('Swordsman feet alternate, settle at rest and share the running gait', () => {
  assert.equal(swordsmanPose({ move: 0, phase: 0.5 }).step, 0);
  assert.equal(swordsmanPose({ move: 1, phase: 0.5 }).step, 1);
  assert.equal(swordsmanPose({ move: 1, phase: 1.5, run: true }).step, -1);
  assert.notEqual(swordsmanPose({}, 300).breathe, swordsmanPose({}, 900).breathe);
});

test('Swordsman strike winds up, reaches forward and recovers to idle', () => {
  const idle = swordsmanPose({}, 0);
  assert.ok(swordsmanPose({}, 0, 0.3).sword < idle.sword);
  assert.ok(swordsmanPose({}, 0, 0.55).sword > idle.sword);
  assert.equal(swordsmanPose({}, 0, 0.55).strike, 1);
  assert.deepEqual(swordsmanPose({}, 0, 0), idle);
  assert.deepEqual(swordsmanPose({}, 0, 1), idle);
});

test('rig falls back headlessly and waits for every part before drawing', () => {
  assert.equal(drawHeroRig({}, { jobClass: 'swordsman' }), false);
  const previous = globalThis.Image;
  const loaded = [];
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; loaded.push(this); } };
  // The painted animation art (heroAnimArt.js) loads alongside; count only the rig's parts.
  const rigParts = () => loaded.filter((img) => !String(img.src).includes('/anim/'));
  try {
    const drawn = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, drawImage(img) { drawn.push(img); } };
    assert.equal(drawHeroRig(ctx, { jobClass: 'ranger' }), false);
    assert.equal(drawHeroRig(ctx, { jobClass: 'swordsman' }), false);
    assert.equal(loaded.length, 6);
    for (const img of loaded.slice(1)) { img.complete = true; img.naturalWidth = 100; }
    assert.equal(drawHeroRig(ctx, { jobClass: 'swordsman' }), false);
    loaded[0].complete = true; loaded[0].naturalWidth = 100;
    for (const swingK of [-1, 0, 0.3, 0.55, 1]) {
      assert.equal(drawHeroRig(ctx, { jobClass: 'swordsman', swingK }), true);
    }
    assert.equal(drawn.length, 30);
    assert.equal(rigParts().length, 6, 'images are reused across frames');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('all registered hero rigs have complete, separate component sets', () => {
  for (const classId of HERO_RIG_CLASSES) {
    for (const part of HERO_RIG_PARTS) {
      assert.ok(existsSync(new URL('../' + heroRigSrc(part, classId), import.meta.url)), `${classId}/${part}`);
    }
  }
});

test('Rogue off-hand attack follows the main hand only when dual wielding', () => {
  const early = heroRigPose('rogue', {}, 0, 0.28, true);
  const late = heroRigPose('rogue', {}, 0, 0.65, true);
  assert.ok(early.sword > late.sword, 'main hand attacks first');
  assert.ok(late.back < early.back, 'off hand follows');
  assert.equal(Math.abs(heroRigPose('rogue', {}, 0, 0.65, false).back), 0, 'single dagger has no second strike');
});

test('Samurai has a deeper katana wind-up and settles without a pose jump', () => {
  assert.ok(heroRigPose('samurai', {}, 0, 0.3).sword < swordsmanPose({}, 0, 0.3).sword);
  for (const classId of HERO_RIG_CLASSES) {
    const idle = heroRigPose(classId, { move: 0.5, phase: 0.5 }, 800);
    for (const swing of [0, 1]) {
      const pose = heroRigPose(classId, { move: 0.5, phase: 0.5 }, 800, swing, true);
      for (const key of Object.keys(idle)) assert.ok(Math.abs(pose[key] - idle[key]) < 1e-12, `${classId}/${key} at ${swing}`);
    }
  }
});

test('Rogue and Samurai caches are isolated and preserve canvas opacity', () => {
  const previous = globalThis.Image;
  const loaded = [];
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; loaded.push(this); } };
  // The painted animation art (heroAnimArt.js) loads alongside; count only the rig's parts.
  const rigParts = () => loaded.filter((img) => !String(img.src).includes('/anim/'));
  try {
    const drawn = [], stack = [];
    const ctx = {
      globalAlpha: 0.65,
      save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
      translate() {}, rotate() {}, drawImage(img) { drawn.push(img.src); },
    };
    assert.equal(drawHeroRig(ctx, { jobClass: 'rogue' }), false);
    for (const img of loaded) { img.complete = true; img.naturalWidth = 100; }
    assert.equal(drawHeroRig(ctx, { jobClass: 'rogue', swingK: 0.28, dualWield: true }), true);
    assert.equal(ctx.globalAlpha, 0.65);
    assert.ok(drawn.every((src) => src.includes('/rogue-')));
    assert.equal(drawHeroRig(ctx, { jobClass: 'samurai' }), false);
    assert.equal(rigParts().length, 12, 'each class loads six distinct parts');
    const samurai = rigParts().slice(6);
    for (const img of samurai) { img.complete = true; img.naturalWidth = 100; }
    samurai[2].naturalWidth = 0; // A completed request can still be a broken image.
    assert.equal(drawHeroRig(ctx, { jobClass: 'samurai' }), false);
    samurai[2].naturalWidth = 100;
    drawn.length = 0;
    assert.equal(drawHeroRig(ctx, { jobClass: 'samurai', swingK: 0.58 }), true);
    assert.ok(drawn.every((src) => src.includes('/samurai-')));
    assert.equal(ctx.globalAlpha, 0.65);
    assert.equal(stack.length, 0, 'transforms and opacity are balanced');
    assert.equal(drawHeroRig(ctx, { jobClass: 'rogue' }), true);
    assert.equal(rigParts().length, 12, 'returning to an already loaded class reuses images');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

// The redrawn Monk (sheets MK-a/b/c): its glove only when monk gloves are
// worn, its palm strike over the knuckled arm (pulled down to the hip so the
// glove never lands on the knuckles), and a back view on its wide stance.
test('the Monk: bare hands without gloves, the palm over a chambered fist, feet apart from behind', async () => {
  const { sampleHeroClip } = await import('../src/render/heroanim.js');
  const { drawHeroBack } = await import('../src/render/heroAnimArt.js');
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    let drawn = [], turn = 0;
    const stack = [];
    const ctx = {
      globalAlpha: 1, lineCap: '', strokeStyle: '', fillStyle: '', lineWidth: 1,
      save() { stack.push([this.globalAlpha, turn]); }, restore() { [this.globalAlpha, turn] = stack.pop(); },
      translate() {}, rotate(a) { turn += a; }, scale() {}, beginPath() {}, arc() {}, stroke() {}, fill() {}, lineTo() {}, closePath() {},
      drawImage(img, x) { drawn.push({ name: String(img.src).split('/').pop().replace('.webp', ''), turn, x }); },
    };
    const held = { kind: 'combat', jobClass: 'monk', weapon: 'knuckles', offhand: 'bronze_monk_gloves' };
    const draw = (opts) => { drawn = []; assert.equal(drawHeroRig(ctx, { jobClass: 'monk', hasWeapon: true, ...opts }), true); return drawn.map((d) => d.name); };
    // Gloves on (and the title's heroes, which say nothing of a shield): the glove arm.
    assert.ok(draw({ dualWield: true }).includes('monk-back'));
    assert.ok(draw({}).includes('monk-back'));
    // Neither weapon nor gloves: two empty hands, no glove.
    const bare = draw({ hasWeapon: false, dualWield: false, hasShield: false });
    assert.ok(!bare.includes('monk-back') && !bare.includes('monk-sword'), bare.join());
    assert.equal(bare.filter((n) => n === 'monk_hand').length, 2);
    // Through the coil the rig's own glove arm draws back to the hip (the painted
    // wind-up would hide behind the body).
    const coil = draw({ dualWield: true, anim: sampleHeroClip('fist_dual', 0.3, held) });
    assert.ok(coil.includes('monk-back') && !coil.includes('monk_offwind'), coil.join());
    // The palm strike: drawn after the knuckled arm, whose fist has turned down to the hip.
    const rest = draw({ dualWield: true, anim: sampleHeroClip('fist_dual', 0.02, held) });
    const restTurn = drawn.find((d) => d.name === 'monk-sword').turn;
    const palm = draw({ dualWield: true, anim: sampleHeroClip('fist_dual', 0.72, held) });
    assert.ok(rest.includes('monk-sword'));
    assert.ok(palm.indexOf('monk_offfollow') > palm.indexOf('monk-sword'), palm.join());
    assert.ok(drawn.find((d) => d.name === 'monk-sword').turn - restTurn > 0.8, 'the fist is chambered');
    assert.equal(stack.length, 0, 'transforms and opacity are balanced');
    // From behind, the feet stand as wide apart as the front view's.
    drawn = [];
    assert.equal(drawHeroBack(ctx, { jobClass: 'monk', facing: { dx: 0, dy: -1 } }), true);
    const feet = drawn.filter((d) => /backfoot/.test(d.name)).map((d) => d.x);
    assert.deepEqual(feet, [-16.8, 4.3]);
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
