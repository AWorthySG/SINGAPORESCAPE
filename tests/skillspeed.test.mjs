// Life skills go faster: gathering and making both get an extra roll every few
// ticks (GATHER_SPEED), and Firemaking, which walks a tile per fire, gets the
// same share as XP per log (FIRE_XP).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game, GATHER_SPEED } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { FIRE_XP } from '../src/game/skilling.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle?.('melee');
  return g;
}

// How many times a skill's resolver runs over `ticks` ticks, standing beside its station.
function callsOver(type, ticks) {
  const g = newGame();
  const p = g.player;
  const obj = { x: p.x + 1, y: p.y, depleted: false, def: {} };
  let calls = 0;
  const a = { type, obj };
  for (let t = 0; t < ticks; t++) g._tickContinuous(a, obj, () => { calls++; return true; });
  return calls;
}

test('making skills (cooking, smithing, crafting, fletching, Herblore) get the gathering speed-up', () => {
  assert.equal(GATHER_SPEED, 1.25);
  for (const type of ['cook', 'cookdish', 'smith', 'craft', 'recipe', 'woodcut', 'mine', 'fish']) {
    const n = callsOver(type, 400);
    // 400 ticks at 1.25 is about 500 rolls (skill unlocks can add a few more).
    assert.ok(n >= 495, `${type}: ${n} rolls in 400 ticks`);
  }
  // Something that isn't a skill action stays at one a tick.
  assert.equal(callsOver('agility', 400), 400);
});

test('Firemaking gives 25% more XP a log instead', () => {
  assert.equal(FIRE_XP, GATHER_SPEED);
});
