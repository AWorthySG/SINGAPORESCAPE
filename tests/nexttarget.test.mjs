// Next target (the button by Attack, or Tab): steps through the enemies in reach.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { chebyshev } from '../src/core/utils.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function setup() {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  const p = g.player;
  const mobs = g.npcs.filter((n) => n.alive && n.attackable && !n.def.boss && !n.ally).slice(0, 3);
  mobs.forEach((n, i) => { n.x = n.tx = n.homeX = p.x + 2 + i * 2; n.y = n.ty = n.homeY = p.y; n.hp = n.maxHp = 1e6; n.target = null; });
  for (const n of g.npcs) if (!mobs.includes(n) && chebyshev(n.x, n.y, p.x, p.y) < 20) n.alive = false;
  return { g, mobs };
}
const cur = (g) => g.player.action?.type === 'attack' ? g.player.action.npc : null;

test('Next target steps through every foe in reach, nearest first, then round again', () => {
  const { g, mobs } = setup();
  const seen = [];
  for (let i = 0; i < 3; i++) seen.push(g.nextTarget());
  assert.deepEqual(seen, mobs, 'nearest, next, furthest');
  assert.equal(cur(g), mobs[2], 'the attack follows the switch');
  assert.equal(g.nextTarget(), mobs[0], 'back round to the nearest');
});

test('from a fight, Next target leaves the current foe for another; auto battle keeps the pick', () => {
  const { g, mobs } = setup();
  g.attackNpc(mobs[0]);
  g.toggleAutoBattle(true);
  assert.equal(g.nextTarget(), mobs[1]);
  for (let i = 0; i < 3; i++) g.update(600);
  assert.equal(cur(g), mobs[1], 'auto battle did not switch back');
});

test('no enemies: nothing happens', () => {
  const { g, mobs } = setup();
  for (const n of mobs) n.alive = false;
  assert.equal(g.nextTarget(), null);
});
