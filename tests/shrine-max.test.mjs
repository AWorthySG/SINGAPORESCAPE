// The Offering Shrine's "Max" button: spend every shrine point one blessing
// can take in a single press (maxAffordable in shrine.js, Game.shrineRankUpMax,
// and shrineMaxButton in shrineui.js).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { Shrine, shrineCost, maxAffordable, SHRINE_MAX_BULK } from '../src/game/shrine.js';
import { shrineMaxButton } from '../src/ui/shrineui.js';
import { formatNumber } from '../src/core/utils.js';

const sum = (from, to) => { let s = 0; for (let r = from; r <= to; r++) s += shrineCost(r); return s; };

test('maxAffordable buys exactly the ranks the points cover, leaving less than the next rank', () => {
  const sh = new Shrine();
  assert.deepEqual(maxAffordable(sh, 'might', 99), { ranks: 0, cost: 0 });
  assert.deepEqual(maxAffordable(sh, 'might', 100), { ranks: 1, cost: 100 });
  // Ranks 1-3 cost 100 + 283 + 520 = 903; one point short of rank 4 still stops at 3.
  assert.deepEqual(maxAffordable(sh, 'might', sum(1, 4) - 1), { ranks: 3, cost: sum(1, 3) });
  sh.ranks.might = 12;
  for (const pts of [0, 5000, 12345, 250000, 3e6]) {
    const { ranks, cost } = maxAffordable(sh, 'might', pts);
    assert.equal(cost, sum(13, 12 + ranks), 'the cost is the sum of the ranks bought');
    assert.ok(cost <= pts && pts - cost < shrineCost(13 + ranks), `${pts}: what is left is under the next rank`);
  }
  sh.points = 5000;
  assert.deepEqual(maxAffordable(sh, 'might'), maxAffordable(sh, 'might', 5000), 'defaults to the shrine\'s own points');
  assert.deepEqual(maxAffordable(sh, 'nonsense', 1e9), { ranks: 0, cost: 0 });
});

test('huge point totals finish quickly, capped per press', () => {
  const sh = new Shrine();
  const t0 = Date.now();
  const big = maxAffordable(sh, 'might', 1e20);
  assert.equal(big.ranks, SHRINE_MAX_BULK);
  assert.ok(Date.now() - t0 < 1000, 'well under a second');
  assert.deepEqual(maxAffordable(sh, 'might', Infinity), { ranks: 0, cost: 0 }, 'nonsense totals buy nothing');
  const g = freshGame('swordsman');
  g.shrine.points = 1e20;
  assert.equal(g.shrineRankUpMax('swiftness'), SHRINE_MAX_BULK);
  assert.equal(g.shrine.rank('swiftness'), SHRINE_MAX_BULK);
});

test('shrineRankUpMax spends the points on one blessing with one message', () => {
  const g = freshGame('swordsman');
  const msgs = [], banners = [], events = [];
  const msg = g.msg.bind(g), banner = g.banner.bind(g);
  g.msg = (t, k) => { msgs.push(t); return msg(t, k); };
  g.banner = (h) => { banners.push(h); return banner?.(h); };
  g.bus.on('shrine', () => events.push('shrine'));
  g.bus.on('sfx', (s) => events.push(s));
  const pts = sum(1, 11) + 50;   // ranks 1-11, with 50 left over
  g.shrine.points = pts;
  const atk0 = g.equipment.bonuses().atkPct;
  assert.equal(g.shrineRankUpMax('might'), 11);
  assert.equal(g.shrine.rank('might'), 11);
  assert.equal(g.shrine.points, 50);
  assert.equal(g.equipment.bonuses().atkPct - atk0, 11, 'the bonus reaches the gear totals');
  assert.equal(msgs.length, 1);
  assert.match(msgs[0], /Might \+11 ranks \(0 → 11\): \+11% Physical damage bonus/);
  assert.equal(banners.length, 1, 'rank 10 was passed');
  assert.deepEqual(events, ['level', 'shrine'], 'one sound, one update');
  // Too few points: nothing bought, nothing spent, other blessings untouched.
  msgs.length = 0; banners.length = 0;
  assert.equal(g.shrineRankUpMax('might'), 0);
  assert.equal(g.shrine.points, 50); assert.equal(g.shrine.rank('might'), 11);
  assert.equal(g.shrine.rank('precision'), 0);
  assert.equal(msgs.length, 1); assert.match(msgs[0], /needs/);
  assert.equal(banners.length, 0);
  // A few ranks that pass no tenth rank: no banner, singular wording for one.
  g.shrine.points = shrineCost(1);
  assert.equal(g.shrineRankUpMax('precision'), 1);
  assert.match(msgs.at(-1), /Precision \+1 rank \(0 → 1\)/);
  assert.equal(banners.length, 0);
});

test('the Max button shows what it buys and is disabled when no rank is affordable', () => {
  const el = (tag = 'div') => ({
    tag, className: '', disabled: false, title: '', innerHTML: '', _click: null,
    addEventListener(type, f) { if (type === 'click') this._click = f; },
  });
  const had = globalThis.document;
  globalThis.document = { createElement: el };
  try {
    const g = freshGame('swordsman');
    g.shrine.ranks.might = 12;
    g.shrine.points = 50;
    const off = shrineMaxButton(g, 'might', () => {});
    assert.equal(off.disabled, true);
    assert.match(off.innerHTML, /\+0 ranks/);
    assert.ok(!off.className.includes('active'));
    const { ranks, cost } = maxAffordable(g.shrine, 'might', 30000);
    assert.ok(ranks > 1);
    g.shrine.points = 30000;
    let redrawn = 0;
    const on = shrineMaxButton(g, 'might', () => redrawn++);
    assert.equal(on.disabled, false);
    assert.ok(on.className.includes('active') && on.className.includes('shrine-max'));
    assert.ok(on.innerHTML.includes(`Max +${ranks} ranks`), on.innerHTML);
    assert.ok(on.innerHTML.includes(`${formatNumber(cost)} pts`), on.innerHTML);
    on._click();
    assert.equal(g.shrine.rank('might'), 12 + ranks, 'the press buys what the button promised');
    assert.equal(g.shrine.points, 30000 - cost);
    assert.equal(redrawn, 1);
  } finally { globalThis.document = had; }
});
