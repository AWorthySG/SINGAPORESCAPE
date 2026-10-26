import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { RANGED_HERO_CLASSES, RANGED_HERO_PARTS, rangedHeroSrc, rangedHeroPose, drawRangedHeroRig } from '../src/render/rangedHeroRig.js';

test('every ranged and magic rig has its complete set of artwork', () => {
  for (const classId of RANGED_HERO_CLASSES) {
    for (const part of RANGED_HERO_PARTS) assert.ok(existsSync(new URL('../' + rangedHeroSrc(classId, part), import.meta.url)), `${classId}/${part}`);
  }
});

test('Ranger draws the string before releasing and settling', () => {
  const wind = rangedHeroPose('ranger', {}, 0, 0.25);
  const held = rangedHeroPose('ranger', {}, 0, 0.5);
  const shot = rangedHeroPose('ranger', {}, 0, 0.64);
  assert.ok(wind.draw > 0 && wind.draw < held.draw);
  assert.equal(held.draw, 1);
  assert.equal(held.release, 0);
  assert.equal(shot.draw, 0, 'string snaps back on release');
  assert.ok(shot.release > 0);
});

test('Sorcerer charges before extending the wand and recovers continuously', () => {
  const charging = rangedHeroPose('sorcerer', {}, 0, 0.5);
  const casting = rangedHeroPose('sorcerer', {}, 0, 0.74);
  assert.ok(charging.charge > 0);
  assert.equal(charging.cast, 0);
  assert.equal(casting.cast, 1);
  for (const classId of RANGED_HERO_CLASSES) {
    const idle = rangedHeroPose(classId, { move: 0.5, phase: 0.5 }, 500);
    for (const swing of [0, 1, -1, 2]) {
      const pose = rangedHeroPose(classId, { move: 0.5, phase: 0.5 }, 500, swing);
      for (const key of Object.keys(idle)) assert.ok(Math.abs(pose[key] - idle[key]) < 1e-12, `${classId}/${key} at ${swing}`);
    }
  }
});

test('ranged and magic boots alternate with the game gait and breathe at rest', () => {
  for (const classId of RANGED_HERO_CLASSES) {
    assert.equal(rangedHeroPose(classId, { move: 0, phase: 0.5 }).step, 0);
    assert.equal(rangedHeroPose(classId, { move: 1, phase: 0.5 }).step, 1);
    assert.equal(rangedHeroPose(classId, { move: 1, phase: 1.5, run: true }).step, -1);
    assert.notEqual(rangedHeroPose(classId, {}, 300).breathe, rangedHeroPose(classId, {}, 900).breathe);
  }
});

function context() {
  const stack = [], draws = [], lines = [];
  return {
    draws, lines, globalAlpha: 0.7,
    save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
    translate() {}, rotate() {}, drawImage(img) { draws.push(img.src); },
    beginPath() {}, moveTo(x, y) { lines.push([x, y]); }, lineTo(x, y) { lines.push([x, y]); },
    stroke() {}, closePath() {}, fill() {},
  };
}

test('rig loading stays per class and never draws incomplete or broken parts', () => {
  assert.equal(drawRangedHeroRig({}, { jobClass: 'ranger' }), false, 'headless fallback');
  const previous = globalThis.Image;
  const loaded = [];
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; loaded.push(this); } };
  try {
    const c = context();
    assert.equal(drawRangedHeroRig(c, { jobClass: 'swordsman' }), false);
    for (const classId of RANGED_HERO_CLASSES) {
      const before = loaded.length, drawsBefore = c.draws.length;
      assert.equal(drawRangedHeroRig(c, { jobClass: classId }), false);
      assert.equal(c.draws.length, drawsBefore);
      const parts = loaded.slice(before);
      assert.equal(parts.length, 6);
      for (const img of parts) { img.complete = true; img.naturalWidth = 100; }
      parts[0].naturalWidth = 0;
      assert.equal(drawRangedHeroRig(c, { jobClass: classId }), false, 'broken image');
      parts[0].naturalWidth = 100;
      for (const swingK of [-1, 0.25, 0.5, 0.64, 0.74, 1]) {
        assert.equal(drawRangedHeroRig(c, { jobClass: classId, swingK }), true);
        assert.equal(c.globalAlpha, 0.7, 'caller opacity preserved');
      }
      assert.ok(c.draws.slice(drawsBefore).every((src) => src.includes(`/${classId}-`)));
    }
    assert.equal(loaded.length, 12);
    assert.equal(drawRangedHeroRig(c, { jobClass: 'ranger' }), true);
    assert.equal(loaded.length, 12, 'already loaded parts are reused');
    const rest = context(), drawn = context(), shot = context();
    drawRangedHeroRig(rest, { jobClass: 'ranger' });
    drawRangedHeroRig(drawn, { jobClass: 'ranger', swingK: 0.5 });
    drawRangedHeroRig(shot, { jobClass: 'ranger', swingK: 0.64 });
    assert.ok(drawn.lines[1][0] < rest.lines[1][0], 'string nock follows the pulling hand');
    assert.ok(shot.lines.length < drawn.lines.length, 'nocked arrow is hidden during release');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
