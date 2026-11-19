// Brawler's Open Wounds: +5% damage taken per stack, up to 30 stacks, fading when left alone.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, OPEN_WOUNDS, openWoundStacks } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function setup(cls) {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  const n = g.npcs.find((x) => x.alive && x.attackable && !x.def.boss && !x.ally);
  n.hp = n.maxHp = 1e9;
  return { g, n };
}

test('Brawler blows add a stack at most once a second, up to 30', () => {
  const { g, n } = setup('brawler');
  for (let i = 0; i < 5; i++) g._applyPlayerHit(n, 5);
  assert.equal(n.openWounds, 1, 'a flurry within one second adds one stack');
  for (let i = 0; i < 40; i++) { g.playMs += 1000; g._applyPlayerHit(n, 5); }
  assert.equal(n.openWounds, OPEN_WOUNDS.max);
  assert.equal(OPEN_WOUNDS.max, 30); assert.equal(OPEN_WOUNDS.per, 0.05);
});

test('each stack makes the foe take 5% more damage, and stacks fade when left alone', () => {
  const { g, n } = setup('brawler');
  const mode = g.combatMode();
  const base = g._offensiveMods(n, mode).dmgM;
  for (let i = 0; i < 10; i++) { g.playMs += 1000; g._applyPlayerHit(n, 5); }
  const ten = g._offensiveMods(n, mode).dmgM;
  assert.ok(Math.abs(ten / base - 1.5) < 1e-9, `10 stacks: x${(ten / base).toFixed(3)}`);
  g.tickCount += OPEN_WOUNDS.fadeTicks + 1;
  assert.equal(openWoundStacks(n, g.tickCount), 0, 'faded');
});

test('other classes open no wounds', () => {
  const { g, n } = setup('swordsman');
  for (let i = 0; i < 5; i++) g._applyPlayerHit(n, 5);
  assert.ok(!n.openWounds);
});
