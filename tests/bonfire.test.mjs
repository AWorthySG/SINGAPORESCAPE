// Bonfires (bonfire.js): one go burns every log of a kind onto one fire, more
// logs make a bigger fire, and its warmth (more and further the bigger it is)
// adds damage while you stand near it.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { fireLogs, warmthPct, warmthRadius, fireScale } from '../src/game/bonfire.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman'); g.ui = new Proxy({}, { get: () => () => {} });
  g.skills.xp.firemaking = xpForLevel(50);
  if (!g.inventory.has('tinderbox')) g.inventory.add('tinderbox', 1);
  return g;
}
const run = (g, n = 10) => { for (let i = 0; i < n; i++) g.update(600); };
const fireAt = (g, x, y) => { const o = g.world.objectAt(x, y); return o?.def.type === 'fire' ? o : null; };

test('one go burns every log of the kind onto one fire, with XP for each', () => {
  const g = newGame();
  g.inventory.add('logs', 12);
  const xp0 = g.skills.xp.firemaking;
  g.startFiremaking('logs'); run(g);
  assert.equal(g.inventory.count('logs'), 0, 'all twelve burned');
  const fires = g.world.objects.filter((o) => o.def.type === 'fire');
  assert.equal(fires.length, 1, 'on one fire');
  assert.equal(fireLogs(fires[0]), 12);
  assert.ok(g.skills.xp.firemaking - xp0 >= 12 * 40, 'XP for every log');
});

test('more logs on the same fire make it bigger, and warmer from further away', () => {
  const g = newGame();
  g.inventory.add('logs', 3);
  g.startFiremaking('logs'); run(g);
  const f = g.world.objects.find((o) => o.def.type === 'fire');
  const small = { pct: warmthPct(f), r: warmthRadius(f), s: fireScale(f), life: f.lifetime };
  g.inventory.add('logs', 30);
  g.startFiremaking('logs'); run(g);
  assert.equal(fireAt(g, f.x, f.y), f, 'piled onto the same fire');
  assert.equal(fireLogs(f), 33);
  assert.ok(warmthPct(f) > small.pct && warmthRadius(f) > small.r && fireScale(f) > small.s && f.lifetime > small.life);
});

test('standing near a fire warms you: extra damage, gone when you leave', () => {
  const g = newGame();
  const dmg0 = g.equipment.bonuses().atkPct || 0;
  g.inventory.add('logs', 16);
  g.startFiremaking('logs'); run(g);
  g.update(600);
  assert.equal(g.warmth, warmthPct({ logs: 16 }));
  assert.equal((g.equipment.bonuses().atkPct || 0) - dmg0, g.warmth, 'the warmth counts with your gear');
  g.player.x += 20; g.update(600);
  assert.equal(g.warmth, 0);
  assert.equal(g.equipment.bonuses().atkPct || 0, dmg0);
});

test('warmth grows by doubling and stops at its cap', () => {
  assert.equal(warmthPct({ logs: 1 }), 3);
  assert.equal(warmthPct({ logs: 8 }), 12);
  assert.equal(warmthPct({ logs: 100000 }), 30);
  assert.equal(warmthRadius({ logs: 100000 }), 10);
});

test('you choose how many logs go on a fire; the rest stay in the bag', () => {
  const g = newGame();
  g.inventory.add('logs', 20);
  g.startFiremaking('logs', 5); run(g);
  assert.equal(g.inventory.count('logs'), 15);
  assert.equal(fireLogs(g.world.objects.find((o) => o.def.type === 'fire')), 5);
});
