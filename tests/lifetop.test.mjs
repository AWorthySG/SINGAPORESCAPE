// Life-skill bonuses keep growing all the way to level 9999 (the owner's ask).
// Each is as it was up to the level where it used to stop, then grows in a
// straight line to its top at 9999 (towardTop, src/data/xp.js). The level haul
// and the school haul are checked in their own suites; this one has the shared
// helpers and green fingers.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_LEVEL, towardTop, pastSure } from '../src/data/xp.js';
import { CROPS, greenFingersChance, GREEN_FINGERS_CAP, GREEN_FINGERS_TOP } from '../src/data/trades.js';

test('towardTop and pastSure: nothing up to the old stopping level, then a straight line to 1 at 9999', () => {
  assert.equal(towardTop(50, 99), 0);
  assert.equal(towardTop(99, 99), 0);
  assert.equal(towardTop(5049, 99), 0.5);
  assert.equal(towardTop(MAX_LEVEL, 99), 1);
  const double = (l) => 0.04 + l * 0.001;   // double logs and ore: certain from level 960
  assert.equal(pastSure(double, 500), 0);
  assert.equal(pastSure(double, 960), 0);
  assert.ok(pastSure(double, 961) > 0);
  assert.equal(pastSure(double, MAX_LEVEL), 1);
  for (const l of [1, 99, 5000, MAX_LEVEL]) assert.equal(pastSure((x) => 0.0001 * x, l), 0, 'a chance that never gets to 100% has nothing past it');
});

test("green fingers: as it was up to the crop's level + 50, then on to 75% at 9999", () => {
  assert.equal(greenFingersChance(99, 95), 0.04, 'durian at 99');
  assert.equal(greenFingersChance(350, 300), GREEN_FINGERS_CAP, 'eternal lotus: 50% at its level + 50');
  assert.equal(greenFingersChance(MAX_LEVEL, 300), GREEN_FINGERS_TOP);
  const chilli = greenFingersChance(200, 1);
  assert.ok(chilli > 0.5 && chilli < 0.51, `chilli at 200 (${chilli})`);
  for (const [id, , level] of CROPS) {
    let prev = -1;
    for (let l = level; l <= MAX_LEVEL; l++) {
      const p = greenFingersChance(l, level);
      if (l <= level + 50) assert.equal(p, Math.min(0.5, (l - level) / 100), `${id} at ${l}, as before`);
      assert.ok(p >= prev && p <= GREEN_FINGERS_TOP, `${id} at ${l}`);
      prev = p;
    }
  }
});
