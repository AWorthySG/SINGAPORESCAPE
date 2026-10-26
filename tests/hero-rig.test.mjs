import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HERO_RIG_PARTS, heroRigSrc, swordsmanPose, drawSwordsmanRig } from '../src/render/heroRig.js';

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
  assert.equal(drawSwordsmanRig({}, { jobClass: 'swordsman' }), false);
  const previous = globalThis.Image;
  const loaded = [];
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; loaded.push(this); } };
  try {
    const drawn = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, drawImage(img) { drawn.push(img); } };
    assert.equal(drawSwordsmanRig(ctx, { jobClass: 'rogue' }), false);
    assert.equal(drawSwordsmanRig(ctx, { jobClass: 'swordsman' }), false);
    assert.equal(loaded.length, 6);
    for (const img of loaded.slice(1)) { img.complete = true; img.naturalWidth = 100; }
    assert.equal(drawSwordsmanRig(ctx, { jobClass: 'swordsman' }), false);
    loaded[0].complete = true; loaded[0].naturalWidth = 100;
    for (const swingK of [-1, 0, 0.3, 0.55, 1]) {
      assert.equal(drawSwordsmanRig(ctx, { jobClass: 'swordsman', swingK }), true);
    }
    assert.equal(drawn.length, 30);
    assert.equal(loaded.length, 6, 'images are reused across frames');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
