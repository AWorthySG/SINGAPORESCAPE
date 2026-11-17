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

// The class rebalance brought every class's single-target damage to 85-115% of
// the median at levels 50-300 (tools/balance/classes.mjs, 180 s fights on three
// targets); these 60 s fights are noisier, hence the wider band.
test('every class hits one target at 70-140% of the median class', () => {
  for (const r of rows) {
    assert.ok(rel(r, 'single') >= 0.7 && rel(r, 'single') <= 1.4, `${r.cls}: ${Math.round(rel(r, 'single') * 100)}% of the median single-target damage`);
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
