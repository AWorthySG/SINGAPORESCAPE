// The Ranger's skills are damage buffs, not strikes (the owner: "Change all the
// longbow archer skills to buffs instead of active damage skills"). Focused
// Draw (Z), Steady Aim (X), Camouflage (C) and Deadeye (B) each raise the
// Ranger's damage for a while and run alongside each other (stacking buffs);
// none of them hits anything. A change of feel, not of power: the Ranger's
// damage over a fight stays within a band of what the old strikes gave.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave } from '../src/game/save.js';
import { ABILITY_BY_ID, abilitiesFor, ULTIMATE_COST } from '../src/data/abilities.js';
import { setupClass, dummyDps, pickTargets } from '../tools/balance/classlab.mjs';
import { fakeStorage } from '../tools/balance/common.mjs';
import { activeEffects } from '../src/game/statsheet.js';

const IDS = ['aimed_shot', 'steady_aim', 'camouflage', 'deadeye'];

test('all four Ranger skills are timed buffs with no direct damage, ids kept', () => {
  const set = abilitiesFor('ranged', 'ranger').filter((a) => a.key !== 'V');
  assert.deepEqual(set.map((a) => a.id), IDS, 'same ids (saves and the ability-<id> icons still work)');
  for (const a of set) {
    assert.equal(a.kind, 'buff', `${a.id} is a buff`);
    assert.ok(a.stack, `${a.id} stacks with the others`);
    assert.ok(!a.strike && !a.dmgMul && !a.hits && !a.instant, `${a.id} deals no damage of its own`);
    assert.ok(a.buff.dmg > 0 || a.buff.pierce > 0, `${a.id} raises damage`);
    assert.ok(a.ticks > 0 && a.desc, `${a.id} has a duration and a description`);
  }
  assert.equal(ABILITY_BY_ID.deadeye.buff.crit, 1, 'Deadeye: every shot a critical');
  assert.equal(ABILITY_BY_ID.deadeye.cost, ULTIMATE_COST, 'still spends the whole bar');
  assert.ok(ABILITY_BY_ID.aimed_shot.build > 0 && ABILITY_BY_ID.aimed_shot.cost === 0, 'Focused Draw is free and builds adrenaline');
});

function ranger() {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('ranger');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.msg = () => {};
  g.abilityUnlocked = () => true;
  const t = new NPC('goblin', g.player.x + 2, g.player.y, 0, {});
  t.hp = t.maxHp = 999999; t.def = { ...t.def, aggressive: false, maxHit: 0, boss: true };
  g.npcs = [t];
  return { g, t };
}

test('using them: no hit lands, the buffs stack, and Focused Draw builds adrenaline', () => {
  const { g, t } = ranger();
  g.attackNpc(t); g.player.attackCooldown = 99;
  const hp0 = t.hp;   // (the first shot may already have flown)
  const base = g._offensiveMods(t, 'ranged').dmgM;
  g.adrenaline = 0;
  g.activateAbility('aimed_shot');
  assert.equal(t.hp, hp0, 'Focused Draw hits nothing');
  assert.equal(g.adrenaline, ABILITY_BY_ID.aimed_shot.build, 'and builds adrenaline');
  g.adrenaline = 100;
  g.activateAbility('steady_aim');
  g.activateAbility('camouflage');
  assert.equal(t.hp, hp0, 'no strike from Steady Aim or Camouflage');
  for (const id of ['aimed_shot', 'steady_aim', 'camouflage']) assert.ok(g.stackBuffUp(id), `${id} is up`);
  const draw = ABILITY_BY_ID.aimed_shot.buff.dmg, aim = ABILITY_BY_ID.steady_aim.buff.dmg;
  assert.ok(Math.abs(g.buffMod('dmg') - (draw + aim)) < 1e-9, 'their damage adds up');
  assert.equal(g.buffMod('pierce'), ABILITY_BY_ID.camouflage.buff.pierce);
  const shown = activeEffects(g).map((e) => e.name);
  for (const n of ['Focused Draw', 'Steady Aim', 'Camouflage']) assert.ok(shown.includes(n), `the Stats tab lists ${n}`);
  assert.ok(g._offensiveMods(t, 'ranged').dmgM > base * (1 + draw + aim) * 0.999, 'and every shot hits harder');
  g.abilityCd = {}; g.adrenaline = 100;
  g.activateAbility('deadeye');
  assert.equal(t.hp, hp0, 'Deadeye is a buff too');
  assert.equal(g._offensiveMods(t, 'ranged').critCh >= 1, true, 'sure crits while it runs');
  g.tickCount += 30;
  assert.equal(g.buffMod('dmg'), 0, 'and they all wear off');
});

test('auto battle keeps the buffs up against a boss, and keeps Deadeye off trash', () => {
  const { g, t } = ranger();
  g.autoBattle = true; g.autoCfg.abilities = true;
  g.attackNpc(t);
  const used = new Set();
  const act = g.activateAbility.bind(g);
  g.activateAbility = (id) => { used.add(id); return act(id); };
  let upTicks = 0;
  for (let i = 0; i < 60; i++) { g._autoSkills(t); g.update(600); if (g.stackBuffUp('steady_aim')) upTicks++; }
  for (const id of IDS) assert.ok(used.has(id), `auto battle used ${id}`);
  assert.ok(upTicks >= 30, `Steady Aim was up most of the fight (${upTicks}/60 ticks)`);
  // A weak monster that dies in a couple of shots: no ultimate.
  const r = ranger();
  r.g.autoBattle = true; r.g.autoCfg.abilities = true;
  const mob = new NPC('goblin', r.g.player.x + 2, r.g.player.y, 0, {});
  mob.def = { ...mob.def, aggressive: false, maxHit: 0 }; mob.hp = mob.maxHp = 30;
  r.g.npcs = [mob]; r.g.attackNpc(mob); r.g.adrenaline = 100; r.g._autoHitAvg = 20;
  r.g._autoSkills(mob);
  assert.ok(!r.g.stackBuffUp('deadeye') && !r.g.abilityCd.deadeye, 'no ultimate on a monster that drops in a couple of shots');
});

// The old skills, put back on the shared ability objects to measure the change.
const OLD = {
  aimed_shot: { name: 'Aimed Shot', kind: 'attack', dmgMul: 1.4, guaranteed: true },
  steady_aim: { buff: { dmg: 0.4 }, strike: { dmgMul: 1.7, guaranteed: true, sunder: 0.1 } },
  camouflage: { ticks: 6, buff: { dodge: 0.5 }, strike: { dmgMul: 0.8, crit: true } },
  deadeye: { kind: 'attack', dmgMul: 4.2, guaranteed: true, instant: true },
};
function withOldSkills(f) {
  const saved = IDS.map((id) => [id, { ...ABILITY_BY_ID[id] }]);
  for (const id of IDS) {
    const a = ABILITY_BY_ID[id];
    for (const k of ['stack', 'buff', 'ticks']) if (id !== 'steady_aim' || k !== 'ticks') delete a[k];
    Object.assign(a, OLD[id]);
  }
  try { return f(); } finally {
    for (const [id, s] of saved) { const a = ABILITY_BY_ID[id]; for (const k of Object.keys(a)) delete a[k]; Object.assign(a, s); }
  }
}

test('a change of feel, not of power: the Ranger deals about what it did with the old strikes', () => {
  for (const L of [100, 300]) {
    const tg = pickTargets(L);
    const dps = (boss) => { const game = setupClass('ranger', L); return tg.reduce((s, id) => s + dummyDps('ranger', L, [id], [[1, 0]], 150, { game, boss }), 0) / tg.length; };
    for (const boss of [false, true]) {
      const before = withOldSkills(() => dps(boss)), after = dps(boss);
      const r = after / before;
      assert.ok(r >= 0.88 && r <= 1.15, `level ${L}${boss ? ' (boss)' : ''}: ${Math.round(r * 100)}% of the old damage`);
    }
  }
});
