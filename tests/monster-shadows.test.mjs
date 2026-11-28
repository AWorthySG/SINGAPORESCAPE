import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DepthView, shadowVec } from '../src/render/depthview.js';
import { BakeBudget } from '../src/render/governor.js';
import { drawCreatureContact, sunShadow } from '../src/render/shadows.js';

test('a monster cast uses one reusable silhouette, follows facing and sun, and waits for the bake budget', () => {
  let canvases = 0;
  const doc = globalThis.document, prevImage = globalThis.Image;
  globalThis.document = {
    createElement() {
      canvases++;
      return { getContext: () => ({ drawImage() {}, fillRect() {} }) };
    },
  };
  globalThis.Image = class {
    complete = true;
    naturalWidth = 256;
    naturalHeight = 256;
  };
  try {
    const depth = new DepthView();
    depth.budget = new BakeBudget(1, 250, () => 0);
    const draws = [];
    let matrix, alpha;
    const ctx = {
      globalAlpha: 0.8,
      save() { alpha = this.globalAlpha; },
      restore() { this.globalAlpha = alpha; },
      transform(...args) { matrix = args; },
      drawImage(image) { draws.push({ image, matrix, alpha: this.globalAlpha }); },
    };
    const cast = (face, time) => depth.castCreatureShadow(ctx, 'shore_pit_viper', {
      family: 'shore_pit_viper', sprite: 'serpent',
    }, 120, 90, 1, face, shadowVec(time));
    depth.budget.frame();
    depth.budget.spend(1);
    assert.equal(cast(1, 0.3), false);
    assert.equal(canvases, 0);
    depth.budget.frame();
    assert.equal(cast(1, 0.3), true);
    assert.equal(canvases, 2);
    depth.budget.spend(1);
    assert.equal(cast(-1, 0.7), true, 'the cached outline needs no bake allowance');
    assert.equal(cast(1, 0), false, 'night only has the contact shadow');
    assert.equal(draws.length, 2, 'one blit per cast');
    assert.equal(draws[0].image, draws[1].image);
    assert.equal(draws[0].matrix[0], 1);
    assert.equal(draws[1].matrix[0], -1);
    assert.ok(draws[0].matrix[2] > 0 && draws[1].matrix[2] < 0, 'sun shear reverses between dawn and dusk');
    assert.deepEqual(draws[0].matrix.slice(4), [120, 90], 'the cast is rooted at the feet');
    assert.ok(draws[0].alpha > 0 && draws[0].alpha < 0.4);
    assert.equal(ctx.globalAlpha, 0.8);
    depth.budget.frame();
    assert.equal(depth.castCreatureShadow(ctx, 'banker', { attackable: false }, 80, 50, 1, -1, shadowVec(0.5)), true);
    const town = draws.at(-1);
    assert.deepEqual(town.matrix.slice(4), [80, 50]);
    assert.equal(depth.castHeroShadow(ctx, 'rogue', 'melee', 100, 60, 1, shadowVec(0.5)), true);
    const hero = draws.at(-1);
    assert.deepEqual(hero.matrix.slice(4), [100, 60]);
    assert.notEqual(hero.image, town.image, 'the hero and the townsperson each cast their own outline');
    assert.equal(depth.castHeroShadow(ctx, 'rogue', 'melee', 100, 60, 1, shadowVec(0.5), 0.4, 4), true);
    const lifted = draws.at(-1);
    assert.equal(lifted.image, hero.image);
    assert.ok(lifted.matrix[5] < hero.matrix[5] && lifted.alpha < hero.alpha, 'an airborne hero has a shifted, softer cast');
    assert.equal(canvases, 6);
  } finally {
    if (doc === undefined) delete globalThis.document; else globalThis.document = doc;
    if (prevImage === undefined) delete globalThis.Image; else globalThis.Image = prevImage;
  }
});

test('a single-blit contact shadow supports wide bodies, hover and heavy bosses', () => {
  const day = sunShadow(0.5);
  const shadow = (sprite, boss = false, single = true) => {
    const calls = [];
    const ctx = {
      globalAlpha: 1,
      createRadialGradient: () => ({ addColorStop() {} }),
      beginPath() {}, fill() {},
      ellipse(x, y, rx, ry) { calls.push({ x, y, rx, ry, alpha: this.globalAlpha }); },
    };
    drawCreatureContact(ctx, 70, 70, 1, { sprite, boss }, day, 0, null, single);
    assert.equal(ctx.globalAlpha, 1);
    return calls;
  };
  const [walker] = shadow('humanoid');
  const [crawler] = shadow('crab');
  const [hover] = shadow('bat');
  const [boss] = shadow('humanoid', true);
  assert.ok(crawler.rx > walker.rx && crawler.ry < walker.ry);
  assert.ok(hover.rx < walker.rx && hover.alpha < walker.alpha);
  assert.ok(boss.rx > walker.rx && boss.ry > walker.ry);
  assert.equal(shadow('crab').length, 1);
  assert.equal(shadow('crab', false, false).length, 2, 'a generic cast remains available while the silhouette is missing');
});
