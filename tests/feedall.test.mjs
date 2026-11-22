// "Feed materials to worn gear" in one go (feedall.js): the plan shares the
// pack's materials out between worn pieces, best first, never past Master, and
// feeding it does the same as feeding each by hand.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { FEED_CAP, feedXp } from '../src/game/materials.js';
import { feedAllPlan, feedAll } from '../src/game/feedall.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}

test('feed all: the plan uses the best bars first, stops at the cap and leaves the rest', () => {
  const g = newGame();
  const w = g.equipment.get('weapon');
  g.inventory.add('mithril_bar', 3); g.inventory.add('rune_bar', 2); g.inventory.add('yew_logs', 5);
  g.equipment.setMastery(w, FEED_CAP - 2 * feedXp(w, 'rune_bar') - 10);
  const plan = feedAllPlan(g).filter((p) => p.gearId === w);
  assert.equal(plan[0].matId, 'rune_bar', 'the best bar first');
  assert.equal(plan[0].n, 2);
  assert.equal(plan[1].matId, 'mithril_bar');
  assert.equal(plan[1].n, 1, 'only what reaches the cap');
  assert.ok(!plan.some((p) => p.matId === 'yew_logs'), 'logs do not feed a sword');
  const total = feedAll(g, plan);
  assert.ok(total > 0);
  assert.ok(g.equipment.masteryXp(w) >= FEED_CAP, 'Master reached (the last bar may go a little past, as by hand)');
  assert.equal(g.inventory.count('mithril_bar'), 2, 'the spare bars stay in the pack');
  assert.equal(g.inventory.count('yew_logs'), 5);
  assert.deepEqual(feedAllPlan(g).filter((p) => p.gearId === w), [], 'nothing more to feed at the cap');
});

test('feed all: materials are never counted twice between pieces', () => {
  const g = newGame();
  g.inventory.add('mithril_bar', 4);
  const plan = feedAllPlan(g);
  const used = plan.filter((p) => p.matId === 'mithril_bar').reduce((s, p) => s + p.n, 0);
  assert.ok(used <= 4);
  feedAll(g, plan);
  assert.equal(g.inventory.count('mithril_bar'), 4 - used);
});

test('Gear Mastery window: Wearing / In your bag tabs and the feed-all button', () => {
  const src = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(src, /Wearing \(\$\{worn\.length\}\)/);
  assert.match(src, /In your bag \(\$\{bag\.length\}\)/);
  assert.match(src, /Feed materials to worn gear…/);
  assert.match(src, /_openFeedAll\(\)/);
});
