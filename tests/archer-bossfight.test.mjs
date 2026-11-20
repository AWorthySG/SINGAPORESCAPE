// Archers in real boss fights (the owner: "Look at Archers"). Measured with
// tools/balance/bossfight.mjs, Archers took about twice as long as a Swordsman
// to kill the same boss at level 300 and up, though the dummy lab had them
// level. The cause was armour: bosses wear 30-60%, plate's armour pierce
// cancelled it (and grew with gear upgrades), while hide armour gave a little
// Attack bonus % that enchant lines drowned out. Hide pierces armour now, as
// plate does (items.js FAMILY_STAT).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bossFight, kitOut } from '../tools/balance/bossfight.mjs';
import { ITEMS } from '../src/data/items.js';
import { armourMult } from '../src/game/combat.js';

test('hide armour pierces boss armour as plate does', () => {
  // The same step as plate's: 1% plus 1% every 25 levels of the piece.
  const step = (it) => 1 + Math.floor(Math.max(1, ...Object.values(it.equip.req || {})) / 25);
  const fam = (f) => Object.entries(ITEMS).filter(([, it]) => it.equip?.family === f);
  assert.ok(fam('hide').length >= 40);
  for (const f of ['hide', 'plate']) for (const [id, it] of fam(f)) assert.ok(it.equip.bonuses.pierce >= step(it), `${id} pierces at least ${step(it)}%`);   // (a few pieces carry extra)
  for (const [id, it] of fam('hide')) assert.ok(!it.equip.bonuses.atkPct, `${id}: no Attack bonus % any more`);
  // A level-300 Archer with a typical build gets through a 40%-armoured boss.
  const g = kitOut('archer', 300);
  const p = g.equipment.bonuses('main').pierce;
  assert.ok(p >= 60, `typical level-300 Archer: ${p}% armour pierce`);
  assert.ok(armourMult(0.4, p) >= 1, 'a 40%-armoured boss no longer shrugs off part of every arrow');
});

test('an Archer kills a level-300 boss within about 1.4 times a Swordsman\'s time (it took 2.2 times)', () => {
  // Same bosses for both: a melee-weak beast (the Swordsman's best case) and a
  // bug the shortbow bites into. Before: 337 s and 260 s against 154 s and 152 s.
  const ratios = [];
  for (const boss of ['kranji_buffalo_king', 'spider_queen']) {
    const a = bossFight('archer', 300, boss, { maxTicks: 1500 });
    const s = bossFight('swordsman', 300, boss, { maxTicks: 1500 });
    assert.ok(a.killed && !a.died && s.killed && !s.died, `both beat ${boss}`);
    ratios.push(a.secs / s.secs);
  }
  const mean = ratios.reduce((x, y) => x + y) / ratios.length;
  assert.ok(mean >= 0.6 && mean <= 1.4, `the Archer takes ${mean.toFixed(2)} times as long (${ratios.map((r) => r.toFixed(2)).join(', ')})`);
});
