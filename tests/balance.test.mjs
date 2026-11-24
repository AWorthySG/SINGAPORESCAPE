// Balance guards: quick, loose checks that no class runs away with the damage
// table and combat levelling stays at a gentle pace. The full measurements live
// in tools/balance (classes.mjs, xp.mjs); these use the same set-up, but short
// fights and one character per class, so the file runs in seconds.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass, killDps, dummyDps, pickTargets, CLASS_IDS, CROWD } from '../tools/balance/classlab.mjs';
import { freshGame } from '../tools/balance/common.mjs';
import { equivalentWeapon } from '../src/data/classes.js';

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
      // Bosses too, one weak to each style: with a target weak to melee alone, the
      // +25% weakness bonus (combat.js) lifted the melee classes past the rest.
      boss: all.reduce((s, id) => s + dummyDps(cls, LEVEL, [id], [[1, 0]], TICKS, { game, boss: true }), 0) / all.length,
      crowd: dummyDps(cls, LEVEL, all, CROWD, TICKS, { game }),
    };
  });
})();
const med = Object.fromEntries(['kill', 'single', 'boss', 'crowd'].map((m) => [m, median(rows.map((r) => r[m]))]));
const rel = (r, m) => r[m] / med[m];
// Since the owner made Fire's Ignite much stronger, Wizards and Sorcerers hit one
// target at 2-4 times the median class: they are held to a band of their own. So
// are the Priest and the Zealot, who cast Fire as well (the owner chose a strong
// Fire for every caster): the Priest at 85-100% of the Wizard, the Zealot 95-115%.
// (They now cast their own elements instead, which burn as Fire's Ignite does:
// magic.js LIGHT_POWER and FLAME_POWER.)
const FIRE_CASTERS = ['wizard', 'sorcerer', 'priest', 'zealot'];
// The Merchant is the strongest class by design (MERCHANT_POWER, mercenary.js), so
// the other classes are also held against the median of the rest, which neither
// the Merchant nor the Fire casters can pull about. (With the casters in it, the
// median rose just enough to put the Merchant at 199% of it on bosses once
// Agility's attack speed went up to +75%.)
const others = rows.filter((r) => r.cls !== 'merchant');
const medOthers = Object.fromEntries(['kill', 'single', 'boss', 'crowd'].map((m) => [m, median(others.filter((r) => !FIRE_CASTERS.includes(r.cls)).map((r) => r[m]))]));
const relOthers = (r, m) => r[m] / medOthers[m];
const merchant = rows.find((r) => r.cls === 'merchant');

// The class rebalance brought every class's single-target damage to 85-115% of
// the median at levels 50-300 (tools/balance/classes.mjs, 180 s fights on three
// targets); these 60 s fights are noisier, hence the wider band. The Merchant is
// left out: it is meant to stand well above the rest (see the next test).
// The Brawler is left out too: its Open Wounds (+5% damage taken a stack, one a
// second, up to 30) lift it above the other classes on one target and bosses in a long
// fight, which the owner chose to keep (see the Brawler test below).
// The casters are left out as well since the owner made Fire's Ignite much
// stronger (burns go off every half second and with every hit): Wizards and
// Sorcerers now hit one target at 2-4 times the median class.
test('every class but the Merchant, Brawler and Fire casters hits one target at 70-140% of the median class', () => {
  for (const r of others.filter((r) => r.cls !== 'brawler' && !FIRE_CASTERS.includes(r.cls))) {
    for (const [name, x] of [['all classes', rel(r, 'single')], ['the other classes', relOthers(r, 'single')]]) {
      assert.ok(x >= 0.7 && x <= 1.4, `${r.cls}: ${Math.round(x * 100)}% of the median single-target damage of ${name}`);
    }
  }
  for (const r of rows.filter((r) => FIRE_CASTERS.includes(r.cls))) {
    assert.ok(rel(r, 'single') >= 2 && rel(r, 'single') <= 4, `${r.cls}: ${Math.round(rel(r, 'single') * 100)}% of the median single-target damage`);
  }
});

// The owner asked for the Merchant to be much stronger than every other class:
// about twice the median (tools/balance/classes.mjs puts it at ~190-210% single
// and ~185-230% boss at levels 50-300), top of the table, crowds included.
// (Raised to about 250% when the Brawler's Open Wounds made it a stronger boss
// killer: the owner wants the Merchant on top of every class, the Brawler included.)
// Since the owner made Fire's Ignite much stronger, the Fire casters out-damage it
// too; it stays on top of every other class.
test('the Merchant is the strongest class but the Fire casters: 200-330% of the median of the other classes, and top', () => {
  for (const m of ['single', 'boss']) {
    const x = relOthers(merchant, m);
    assert.ok(x >= 2 && x <= 3.3, `merchant: ${Math.round(x * 100)}% of the other classes' median ${m} damage`);
  }
  for (const m of ['single', 'boss', 'crowd']) {
    const best = others.filter((r) => !FIRE_CASTERS.includes(r.cls)).reduce((a, b) => (b[m] > a[m] ? b : a));
    assert.ok(merchant[m] > best[m], `merchant ${m} ${merchant[m].toFixed(0)} beats the best other class (${best.cls}, ${best[m].toFixed(0)})`);
  }
});

// The Priest and the Zealot cast Fire like the Wizard, so they are held beside it:
// the Priest a little under it, the Zealot level with it or a little over
// (tools/balance/classes.mjs: the Priest at 93% of the Wizard's single-target
// damage at level 100, 88% at 200 and 85% at 300, where its Uplift has no
// blessings to lift here; the Zealot at 112%, 102% and 99%). Level 50 is the
// exception the owner should know of: from Magic 50 to 59 the Wizard holds the
// speed-4 ancient staff and the Priest's orbs still cast at speed 5, so the Priest
// deals only 71-74% of the Wizard there (accepted: no speed-4 orb before the
// dragon tier). These 60 s fights on one character are noisier, hence wider bands.
test('the Priest and the Zealot hit about as hard as the Wizard: the Priest a little less', () => {
  const at = (cls, L) => {
    if (L === LEVEL) return rows.find((x) => x.cls === cls);
    const game = setupClass(cls, L), ts = pickTargets(L);
    const avg = (boss) => ts.reduce((s, id) => s + dummyDps(cls, L, [id], [[1, 0]], TICKS, { game, boss }), 0) / ts.length;
    return { single: avg(false), boss: avg(true) };
  };
  // (Since the Priest and the Zealot cast their own elements, the level 50 window
  // is gone: the Light path's four elements cover the races there better than
  // Fire alone, and the Priest deals 98-106% of the Wizard at level 50.)
  for (const [L, bands] of [[50, [['priest', 0.75, 1.15], ['zealot', 0.85, 1.3]]], [LEVEL, [['priest', 0.75, 1.1], ['zealot', 0.85, 1.25]]], [200, [['priest', 0.75, 1.1], ['zealot', 0.85, 1.25]]]]) {
    const wiz = at('wizard', L);
    for (const [cls, lo, hi] of bands) {
      const r = at(cls, L);
      for (const m of ['single', 'boss']) {
        const x = r[m] / wiz[m];
        assert.ok(x >= lo && x <= hi, `${cls} at level ${L}: ${Math.round(x * 100)}% of the Wizard's ${m} damage`);
      }
    }
  }
});

// A class's own weapon type is its best weapon (combat.js WEAPON_DMG_MULT): the
// Priest's orb beats its censer and the Zealot's censer its orb, tier for tier.
// (The Zealot's orb hit 5-17% harder than its censer until zealot.js gave the orb
// a lesser share and kept Fervour to the censer.)
test('the Priest and the Zealot hit harder with their own type than with the other\'s', () => {
  const all = pickTargets(LEVEL);
  for (const [cls, other] of [['priest', 'censer'], ['zealot', 'orb']]) {
    const dmg = (game) => all.reduce((s, id) => s + dummyDps(cls, LEVEL, [id], [[1, 0]], TICKS, { game })
      + dummyDps(cls, LEVEL, [id], [[1, 0]], TICKS, { game, boss: true }), 0);
    const own = setupClass(cls, LEVEL), swap = setupClass(cls, LEVEL);
    swap.equipment.set('weapon', equivalentWeapon(own.equipment.get('weapon'), other));
    const x = dmg(swap) / dmg(own);
    assert.ok(x < 1, `${cls}: ${swap.equipment.get('weapon')} deals ${Math.round(x * 100)}% of ${own.equipment.get('weapon')}`);
  }
});

// The Brawler's Open Wounds stack up in a long fight: it ends up above the median
// single-target class (the owner chose this over trimming Open Wounds), but stays sane.
// (It was held at 140-320%; when scout leather took up armour pierce, Brawlers ran at
// 1.7-1.8 times the median class in real boss fights, above the Merchant, so the
// claws came down (combat.js WEAPON_DMG_MULT) and it now sits a little above the rest.)
test('the Brawler: above the median on one target thanks to Open Wounds, within reason', () => {
  const br = rows.find((r) => r.cls === 'brawler');
  const x = relOthers(br, 'single');
  assert.ok(x >= 1.05 && x <= 2, `brawler: ${Math.round(x * 100)}% of the other classes' median single-target damage`);
});

// Kill speed stays looser: a Sniper's huge shots waste the overkill on a monster
// with a level-matched life (fine on bosses and crowds, its strengths).
test('every class kills a level-matched monster at 25-400% of the median class', () => {
  for (const r of rows) {
    assert.ok(rel(r, 'kill') >= 0.25 && rel(r, 'kill') <= 4, `${r.cls}: ${Math.round(rel(r, 'kill') * 100)}% of the median kill speed`);
  }
});

test('Merchants (A-Worthlings, mercenaries) and casters (Fire burns, splash) do not explode in a 60 s fight', () => {
  for (const cls of ['merchant', ...FIRE_CASTERS]) {
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
