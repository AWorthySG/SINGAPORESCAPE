// Your own life at a glance: the overhead bar shows in a fight or while hurt
// (not only with a target), with colour bands and a drain trail; the HUD bar
// reads "1,234 / 2,000"; the notice lane steers round it. Headless.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { playerBarVisible, hpBand, drainTrail, DRAIN_MS } from '../src/render/playerhp.js';
import { hpText } from '../src/ui/hpbar.js';
import { placeLane } from '../src/ui/noticelane.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}

test('your bar shows in a fight or while hurt, not only with a target', () => {
  const g = newGame();
  const p = g.player;
  p.hp = g.maxHp(); p.target = null; p.action = null;
  g.cine.inFight = false;
  assert.equal(playerBarVisible(g), false, 'full life, no fight: no bar');
  p.hp = g.maxHp() - 1;
  assert.equal(playerBarVisible(g), true, 'hurt at all: the bar shows');
  p.hp = g.maxHp();
  g.cine.inFight = true;   // a monster on you (the fight camera's test)
  assert.equal(playerBarVisible(g), true, 'in a fight with full life');
  g.cine.inFight = false;
  const foe = g.npcs.find((n) => n.alive && n.attackable);
  p.target = foe;
  assert.equal(playerBarVisible(g), true, 'with a target');
  p.target = null;
  p.alive = false;
  assert.equal(playerBarVisible(g), false, 'never while dead');
});

test('the bar goes green, amber, red; the lost chunk drains away in about 0.4s', () => {
  assert.deepEqual([1, 0.6, 0.5, 0.3, 0.25, 0.1].map(hpBand), [0, 0, 1, 1, 2, 2]);
  const st = {};
  assert.equal(drainTrail(st, 1, 0), 1);
  assert.equal(drainTrail(st, 0.6, 100), 1, 'just hit: the trail still stands where you were');
  const mid = drainTrail(st, 0.6, 100 + DRAIN_MS / 2);
  assert.ok(mid < 1 && mid > 0.6, `halfway: ${mid}`);
  assert.equal(drainTrail(st, 0.6, 100 + DRAIN_MS), 0.6, 'gone by DRAIN_MS');
  // A second hit mid-drain starts from where the trail had got to.
  drainTrail(st, 0.5, 1000); const before = drainTrail(st, 0.5, 1000 + DRAIN_MS / 2);
  assert.ok(drainTrail(st, 0.4, 1000 + DRAIN_MS / 2) === before, 'no jump on the next hit');
  assert.equal(drainTrail(st, 0.9, 2000), 0.9, 'a heal drops the trail at once');
});

test('the HUD bar reads "hp / max" and the notice lane goes under it on a phone', () => {
  assert.equal(hpText(1234, 2000), '1,234 / 2,000');
  assert.equal(hpText(-3, 99), '0 / 99');
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const lane = placeLane({ 'hp-bar': rect(6, 6, 240, 26), 'minimap-panel': rect(256, 6, 128, 128) }, 390, 'phone');
  assert.ok(lane.top >= 32, `the lane sits under the life bar (top ${lane.top})`);
  const css = readFileSync(new URL('../styles/compact.css', import.meta.url), 'utf8');
  assert.match(css, /body\.cb-safe #hp-bar\.low::after/, 'colour-blind colours add a "!" when low');
  assert.match(css, /#hp-bar\.low \{ animation: hpBarLow/, 'low life pulses');
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /renderHpBar\(this, hp, max/, 'renderHp draws it');
});
