// The skill fields added for the later classes (abilities.js): Faith at once,
// lifted blessings, a heal on a guard or buff, more damage to the unholy, a
// holy fire rider that pays Magic XP, and skills paid for in life. Each is
// tried here on a made-up skill, so the tests hold whichever class uses them.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game, WOUNDS } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave } from '../src/game/save.js';
import { ABILITY_BY_ID, LIFE_COST_FLOOR } from '../src/data/abilities.js';
import { fakeStorage } from '../tools/balance/common.mjs';

function mk(cls, foe = 'goblin') {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.said = []; g.msg = (m) => g.said.push(m);
  const t = new NPC(foe, g.player.x + 1, g.player.y, 0, {});
  t.hp = t.maxHp = 1e9; t.def = { ...t.def, aggressive: false, maxHit: 0 };
  g.npcs = [t];
  return { g, t };
}
/** Run `fn` with a made-up skill on the books. */
function withSkill(ab, fn) {
  const full = { key: 'C', cost: 0, cd: 5, unlock: 1, name: 'Test skill', desc: 'A test.', ...ab };
  ABILITY_BY_ID[full.id] = full;
  try { return fn(full); } finally { delete ABILITY_BY_ID[full.id]; }
}

test('faith: a share of the Faith bar at once', () => withSkill({ id: 'test_faith', kind: 'buff', buff: { dmg: 0.1 }, faith: 0.25 }, () => {
  const { g } = mk('swordsman');
  g.prayerPoints = 0;
  g.activateAbility('test_faith');
  assert.ok(Math.abs(g.prayerPoints - g.maxPrayer() * 0.25) < 1e-6, `Faith ${g.prayerPoints} of ${g.maxPrayer()}`);
}));

test('bless: a buff makes every blessing count more, crit and Protect too', () => {
  const { g } = mk('wizard');
  g.activePrayers = new Set(['mystic_lore', 'clarity', 'protect_melee']);
  const m0 = g.prayerMult().magic, c0 = g.prayerCrit(), p0 = g.protectFactor();
  assert.ok(Math.abs(m0 - 1.35) < 1e-9 && Math.abs(c0 - 0.05) < 1e-9 && Math.abs(p0 - 0.3) < 1e-9, `${m0} ${c0} ${p0}`);
  g.buff = { id: 'test', bless: 0.5, until: g.tickCount + 10 };
  assert.ok(Math.abs(g.prayerMult().magic - 1.525) < 1e-9, `Mystic Lore lifted: ${g.prayerMult().magic}`);
  assert.ok(Math.abs(g.prayerCrit() - 0.075) < 1e-9 && Math.abs(g.protectFactor() - 0.45) < 1e-9);
  g.tickCount += 11;
  assert.ok(Math.abs(g.prayerMult().magic - m0) < 1e-9, 'and it wears off');
});

test('healFrac: a guard or a buff can mend you too', () => {
  for (const kind of ['guard', 'buff']) {
    withSkill({ id: `test_mend_${kind}`, kind, guardTicks: 4, counter: 0.2, buff: { dmg: 0.1 }, healFrac: 0.12 }, (ab) => {
      const { g } = mk('wizard');
      g.player.hp = Math.round(g.maxHp() / 2);
      const hp0 = g.player.hp;
      g.activateAbility(ab.id);
      assert.equal(g.player.hp, Math.min(g.maxHp(), hp0 + Math.max(1, Math.round(g.maxHp() * 0.12))), `${kind} healed 12%`);
      if (kind === 'guard') assert.ok(g.braceTicks > 0, 'and still guards');
    });
  }
});

test('unholy: a skill hits undead, spirits and demons harder', () => {
  const ratio = (foe) => {
    const { g, t } = mk('paladin', foe);
    g._strikeAb = { id: 't', name: 'T', kind: 'attack', dmgMul: 1 };
    const plain = g._offensiveMods(t, 'melee').dmgM;
    g._strikeAb = { id: 't', name: 'T', kind: 'attack', dmgMul: 1, unholy: 0.5 };
    return g._offensiveMods(t, 'melee').dmgM / plain;
  };
  for (const foe of ['skeleton', 'wraith', 'imp']) assert.ok(Math.abs(ratio(foe) - 1.5) < 1e-9, `${foe}: x${ratio(foe)}`);
  assert.ok(Math.abs(ratio('goblin') - 1) < 1e-9, 'a goblin is not unholy');
});

test('holyfire: a rider sets a burn that ticks once a second and pays Magic XP, not Melee', () => {
  const { g, t } = mk('paladin');
  g._strikeAb = { id: 't', name: 'T', kind: 'attack', dmgMul: 1, guaranteed: true, holyfire: 1 };   // (a whole burn: a new hero's blow is weak)
  g.doPlayerAttack(t);
  const fire = t.wounds?.holyfire;
  assert.equal(fire?.length, 1, 'one holy fire burning');
  assert.equal(fire[0].left, WOUNDS.holyfire.secs);
  const melee0 = g.skills.xp.attack + g.skills.xp.strength, magic0 = g.skills.xp.magic, hp0 = t.hp;   // (Defence and Hitpoints share in both)
  g._tickWounds();   // 0.6s: not yet a second
  assert.equal(t.hp, hp0);
  g._tickWounds();   // 1.2s: one burn
  assert.equal(hp0 - t.hp, Math.floor(fire[0].perSec), 'burned once');
  assert.ok(g.skills.xp.magic > magic0, 'Magic XP');
  assert.equal(g.skills.xp.attack + g.skills.xp.strength, melee0, 'no Melee XP for holy fire');
});

test('lifeCost: paid in life on top of adrenaline, never at or under the floor (auto battle too)', () => withSkill({ id: 'test_oath', key: 'X', kind: 'buff', cost: 50, lifeCost: 0.15, buff: { dmg: 0.45 } }, (ab) => {
  const { g } = mk('wizard');
  g.adrenaline = 100;
  g.player.hp = g.maxHp();
  const hp0 = g.player.hp;
  assert.match(g.abilityCostText(ab), /50% adrenaline and 15% of your life/);
  g.activateAbility(ab.id);
  assert.equal(g.player.hp, hp0 - Math.floor(hp0 * 0.15), 'paid 15% of its life');
  assert.equal(g.adrenaline, 50, 'and the adrenaline');
  // At or under the floor it is refused, with a clear word why, and auto battle leaves it alone.
  g.abilityCd = {}; g.adrenaline = 100; g.buff = null;
  g.player.hp = Math.floor(g.maxHp() * LIFE_COST_FLOOR);
  assert.equal(g.canAffordAbility(ab), false);
  g.activateAbility(ab.id);
  assert.match(g.said.at(-1), /too hurt/);
  assert.equal(g.adrenaline, 100, 'nothing paid');
  g.currentAbilities = () => [ab];
  assert.equal(g._autoAbility(() => true), false, 'auto battle never pays life it can\'t spare');
  // A cost never kills: you keep 1 life.
  g.player.hp = 2; g._payLife(0.99);
  assert.equal(g.player.hp, 1);
}));
