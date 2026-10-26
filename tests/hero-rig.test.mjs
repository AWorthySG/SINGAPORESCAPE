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
    assert.equal(loaded.length, 6, 'images are reused across frames');
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
    assert.equal(loaded.length, 12, 'each class loads six distinct parts');
    const samurai = loaded.slice(6);
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
    assert.equal(loaded.length, 12, 'returning to an already loaded class reuses images');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
