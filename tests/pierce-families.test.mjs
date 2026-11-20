// Leather, robes and dancewear pierce armour too (the owner: "give the leather,
// robe and dancewear armour classes armour pierce too, as #473 did for hide").
// Bosses wear 30-60% armour; plate's and hide's armour pierce cancels it (any left
// over adds damage), while scout leather (Rogue, Corsair, Brawler, Samurai,
// Ninja), robes (Wizard, Sorcerer) and dancewear (Dancer) had none, so every
// blow and spell lost a third to a half: Ninjas, Dancers, Samurai and Rogues did
// 0.52-0.62 of the median class's damage in real level-1000 boss fights, Wizards
// and Sorcerers 0.70-0.72 (tools/balance/bossfight.mjs). Spells meet armour just
// as blows and arrows do (Game._offensiveMods), so gear's pierce counts for them.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bossFight, kitOut } from '../tools/balance/bossfight.mjs';
import { ITEMS } from '../src/data/items.js';
import { armourMult } from '../src/game/combat.js';

const step = (it) => 1 + Math.floor(Math.max(1, ...Object.values(it.equip.req || {})) / 25);
const fam = (f) => Object.entries(ITEMS).filter(([, it]) => it.equip?.family === f);

test('scout leather, robes and dancewear pierce armour as plate and hide do, and keep their own perks', () => {
  for (const f of ['leather', 'robes', 'dancewear']) {
    assert.ok(fam(f).length >= 20, `${fam(f).length} ${f} pieces`);
    for (const [id, it] of fam(f)) assert.ok(it.equip.bonuses.pierce >= step(it), `${id} pierces at least ${step(it)}%`);
  }
  // Each family's own perk stays, at half strength for the two that now also pierce
  // (with both in full, Rogues and Corsairs ran at 1.3-2 times the median class).
  for (const [id, it] of fam('leather')) assert.ok(it.equip.bonuses.critDmg > 0, `${id}: still sharpens crits`);
  for (const [id, it] of fam('robes')) assert.ok(it.equip.bonuses.magPct > 0, `${id}: still a Magic bonus %`);
  for (const [id, it] of fam('dancewear')) assert.ok(it.equip.bonuses.lifesteal > 0, `${id}: still steals life`);
  // A level-300 caster with a typical build now gets through a 40%-armoured boss.
  for (const cls of ['wizard', 'ninja', 'dancer']) {
    const p = kitOut(cls, 300).equipment.bonuses('main').pierce;
    assert.ok(p >= 50, `typical level-300 ${cls}: ${p}% armour pierce`);
    assert.ok(armourMult(0.4, p) >= 1, `${cls}: a 40%-armoured boss no longer shrugs off part of every hit`);
  }
});

// Same bosses for all: a beast weak to melee (the Swordsman's best case) and a
// spider. Before: a Ninja took 1.5 and 1.4 times a Swordsman's time (236 s and
// 218 s against 154 s and 152 s), a Wizard 1.8 and 1.3 (275 s and 198 s).
for (const cls of ['ninja', 'wizard']) {
  test(`a ${cls[0].toUpperCase() + cls.slice(1)} kills a level-300 boss within about 1.4 times a Swordsman's time`, () => {
    const ratios = [];
    for (const boss of ['kranji_buffalo_king', 'spider_queen']) {
      const a = bossFight(cls, 300, boss, { maxTicks: 1500 });
      const s = bossFight('swordsman', 300, boss, { maxTicks: 1500 });
      assert.ok(a.killed && !a.died && s.killed && !s.died, `both beat ${boss}`);
      ratios.push(a.secs / s.secs);
    }
    const mean = ratios.reduce((x, y) => x + y) / ratios.length;
    assert.ok(mean >= 0.6 && mean <= 1.4, `the ${cls} takes ${mean.toFixed(2)} times as long (${ratios.map((r) => r.toFixed(2)).join(', ')})`);
  });
}
