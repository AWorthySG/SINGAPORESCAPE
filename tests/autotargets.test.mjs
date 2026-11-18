// Auto battle's "Targets" setting: Champions & bosses first, Champions & bosses only, or Nearest.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave, saveGame } from '../src/game/save.js';
import { chebyshev } from '../src/core/utils.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function setup() {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const k of ['attack', 'strength', 'defence', 'hitpoints']) g.skills.xp[k] = 2e6;   // strong enough for any champion near town
  // Two ordinary monsters near the player: one weak and close, one in range further off; and a champion further still.
  const p = g.player;
  const mobs = g.npcs.filter((n) => n.alive && n.attackable && !n.def.boss && !n.champion && !n.ally);
  const place = (n, dx) => { n.x = n.tx = n.homeX = p.x + dx; n.y = n.ty = n.homeY = p.y; n.target = null; return n; };
  const near = place(mobs[0], 2), mid = place(mobs[1], 5), champ = place(mobs[2], 8);
  champ.makeChampion(); champ.hp = champ.maxHp;
  for (const n of g.npcs) if (n !== near && n !== mid && n !== champ && chebyshev(n.x, n.y, p.x, p.y) < 30) n.alive = false;
  for (const n of [near, mid, champ]) n.target = null;
  g._autoChampionOk = () => true;
  return { g, near, mid, champ };
}

test('Nearest picks the closest monster, whatever its level', () => {
  const { g, near } = setup();
  g.autoCfg.priority = false;
  assert.equal(g._autoPickTarget(), near);
});

test('Champions & bosses first goes for the champion, then the rest', () => {
  const { g, near, champ } = setup();
  g.autoCfg.priority = true;
  assert.equal(g._autoPickTarget(), champ);
  champ.alive = false;
  assert.ok(g._autoPickTarget(), 'with no champion, ordinary monsters are fought');
});

test('Champions & bosses only fights nothing else unless attacked, and saves', () => {
  const { g, near, mid, champ } = setup();
  g.autoCfg.priority = 'only';
  g.autoCfg.champions = false;   // "only" overrides the Skip setting
  assert.equal(g._autoPickTarget(), champ);
  champ.alive = false;
  assert.equal(g._autoPickTarget(), null, 'ordinary monsters are left alone');
  mid.target = g.player;
  assert.equal(g._autoPickTarget(), mid, 'one attacking you is still answered');
  saveGame(g);
  const again = new Game(); again.start();
  assert.equal(again.autoCfg.priority, 'only');
});
