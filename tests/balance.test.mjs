// Balance guards: quick, loose checks that no class runs away with the damage
// table and combat levelling stays at a gentle pace. The full measurements live
// in tools/balance (classes.mjs, xp.mjs); these use the same set-up, but short
// fights and one character per class, so the file runs in seconds.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass, killDps, dummyDps, pickTargets, CLASS_IDS, CROWD } from '../tools/balance/classlab.mjs';
import { freshGame } from '../tools/balance/common.mjs';

const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// Every class at level 100, each scenario 60 s (100 ticks) on the same character.
const LEVEL = 100, TICKS = 100;
const rows = (() => {
  const [weakToMelee] = pickTargets(LEVEL), all = pickTargets(LEVEL);
  return CLASS_IDS.map((cls) => {
    const game = setupClass(cls, LEVEL);
    return {
      cls,
      kill: killDps(cls, LEVEL, weakToMelee, TICKS, { game }).dps,
      // One target weak to each style in turn, so no style is favoured.
      single: all.reduce((s, id) => s + dummyDps(cls, LEVEL, [id], [[1, 0]], TICKS, { game }), 0) / all.length,
      boss: dummyDps(cls, LEVEL, [weakToMelee], [[1, 0]], TICKS, { game, boss: true }),
      crowd: dummyDps(cls, LEVEL, all, CROWD, TICKS, { game }),
    };
  });
})();
const med = Object.fromEntries(['kill', 'single', 'boss', 'crowd'].map((m) => [m, median(rows.map((r) => r[m]))]));
const rel = (r, m) => r[m] / med[m];
// The Merchant is the strongest class by design (MERCHANT_POWER, mercenary.js), so
// the other classes are also held against the median of the rest, which the
// Merchant can't pull about.
const others = rows.filter((r) => r.cls !== 'merchant');
const medOthers = Object.fromEntries(['kill', 'single', 'boss', 'crowd'].map((m) => [m, median(others.map((r) => r[m]))]));
const relOthers = (r, m) => r[m] / medOthers[m];
const merchant = rows.find((r) => r.cls === 'merchant');

// The class rebalance brought every class's single-target damage to 85-115% of
// the median at levels 50-300 (tools/balance/classes.mjs, 180 s fights on three
// targets); these 60 s fights are noisier, hence the wider band. The Merchant is
// left out: it is meant to stand well above the rest (see the next test).
test('every class but the Merchant hits one target at 70-140% of the median class', () => {
  for (const r of others) {
    for (const [name, x] of [['all classes', rel(r, 'single')], ['the other classes', relOthers(r, 'single')]]) {
      assert.ok(x >= 0.7 && x <= 1.4, `${r.cls}: ${Math.round(x * 100)}% of the median single-target damage of ${name}`);
    }
  }
});

// The owner asked for the Merchant to be much stronger than every other class:
// about twice the median (tools/balance/classes.mjs puts it at ~190-210% single
// and ~185-230% boss at levels 50-300), top of the table, crowds included.
test('the Merchant is the strongest class: 170-250% of the median of the other classes, and top', () => {
  for (const m of ['single', 'boss']) {
    const x = relOthers(merchant, m);
    assert.ok(x >= 1.7 && x <= 2.5, `merchant: ${Math.round(x * 100)}% of the other classes' median ${m} damage`);
  }
  for (const m of ['single', 'boss', 'crowd']) {
    const best = others.reduce((a, b) => (b[m] > a[m] ? b : a));
    assert.ok(merchant[m] > best[m], `merchant ${m} ${merchant[m].toFixed(0)} beats the best other class (${best.cls}, ${best[m].toFixed(0)})`);
  }
});

// Kill speed stays looser: a Sniper's huge shots waste the overkill on a monster
// with a level-matched life (fine on bosses and crowds, its strengths).
test('every class kills a level-matched monster at 25-400% of the median class', () => {
  for (const r of rows) {
    assert.ok(rel(r, 'kill') >= 0.25 && rel(r, 'kill') <= 4, `${r.cls}: ${Math.round(rel(r, 'kill') * 100)}% of the median kill speed`);
  }
});

test('Merchants (A-Worthlings, mercenaries) and casters (Fire burns, splash) do not explode in a 60 s fight', () => {
  for (const cls of ['merchant', 'wizard', 'sorcerer']) {
    const r = rows.find((x) => x.cls === cls);
    assert.ok(rel(r, 'boss') <= 5, `${cls}: ${Math.round(rel(r, 'boss') * 100)}% of the median boss damage`);
    assert.ok(rel(r, 'crowd') <= 5, `${cls}: ${Math.round(rel(r, 'crowd') * 100)}% of the median crowd damage`);
  }
});

test('a fresh melee character on auto battle is nowhere near Melee 99 after ten minutes', () => {
  // At the old pace (full XP_RATE for combat, a x3 kill streak) a new Corsair
  // reached 99 in about 72 seconds; now it takes about an hour (see
  // tools/balance/xp.mjs), and is at about Melee 75 after ten minutes. A pace
  // that reached 99 in ~20 minutes was at Melee 91 after ten.
  const g = freshGame('corsair');
  g.toggleAutoBattle(true);
  for (let i = 0; i < 1000; i++) { if (!g.autoBattle && g.player.alive) g.toggleAutoBattle(true); g.update(600); }
  assert.ok(g.totalKills >= 20, `it was fighting (${g.totalKills} kills)`);
  assert.ok(g.skills.attack < 85, `Melee ${g.skills.attack} after ten minutes`);
  assert.ok(g.skills.attack >= 50, `but it still levels up at a fair pace (Melee ${g.skills.attack})`);
});

test('the Merchant\'s power: only Merchants get it, it grows a little with Ranged, and it is capped', async () => {
  const { merchantPower, MERCHANT_POWER, MERCHANT_POWER_MAX } = await import('../src/game/mercenary.js');
  assert.equal(merchantPower({ jobClass: 'pistoler', skills: { ranged: 300 } }), 1, 'no other class gets it (the chakram is shared)');
  assert.equal(merchantPower({ jobClass: 'merchant', skills: { ranged: 1 } }), MERCHANT_POWER);
  const at = (lv) => merchantPower({ jobClass: 'merchant', skills: { ranged: lv } });
  assert.ok(at(300) > at(100) && at(100) > at(50), 'a gentle rise with Ranged');
  assert.equal(at(99999), MERCHANT_POWER_MAX, 'capped: no runaway at very high levels');
});
