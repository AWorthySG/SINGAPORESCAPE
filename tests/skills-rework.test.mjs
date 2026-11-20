// The skills rework: every class skill got an offensive edge (an immediate
// strike on the threshold buffs, strike-back on guards, bleeds and armour
// breaks on attacks) and shorter cooldowns, for roughly +10-20% damage from
// skills. These pin the shape of it: cooldowns, an offensive part in every
// slot, the new riders working, the uplift staying in its band, and auto
// battle still guarding against telegraphed blows.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave } from '../src/game/save.js';
import { ABILITIES, ABILITY_BY_ID, abilitiesFor, SUNDER_TICKS } from '../src/data/abilities.js';
import { CLASSES } from '../src/data/classes.js';
import { setupClass, dummyDps, pickTargets } from '../tools/balance/classlab.mjs';
import { fakeStorage } from '../tools/balance/common.mjs';

// Cooldowns (ticks) before the rework, by ability id.
const OLD_CD = {
  power_strike: 3, battle_cry: 20, snapshot: 3, focus: 20, arcane_surge: 3, mana_flow: 20, crack: 4, tempo: 20, brace: 8,
  onslaught: 30, arrow_storm: 30, meteor: 30, grand_finale: 30,
  backstab: 3, shadow_step: 20, vanish: 25, assassinate: 30, riposte: 3, battle_focus: 20, parry: 12, heroic_strike: 30,
  cutlass_flurry: 3, sea_legs: 20, grog: 30, broadside: 30, smite: 3, holy_aura: 20, lay_on_hands: 40, divine_hammer: 30,
  lance_thrust: 3, shield_wall: 20, hold_fast: 15, dragonbane: 30, axe_cleave: 3, berserk_rage: 20, blood_frenzy: 25, rampage: 30,
  earthshaker: 4, iron_skin: 20, unbreakable: 15, cataclysm: 30, arena_sweep: 3, crowd_roar: 20, victory_rush: 30, champions_wrath: 30,
  impale: 3, phalanx_stance: 20, set_spear: 10, phalanx: 30, rend: 3, adrenaline_rush: 20, feral_instinct: 25, feral_frenzy: 30,
  iaijutsu: 3, bushido: 20, meditate: 30, thousand_cuts: 30, reaping_arc: 3, hold_the_line: 20, stand_firm: 15, iron_tempest: 30,
  golden_cane: 3, hire_bodyguards: 20, pay_off: 25, hostile_takeover: 30, quick_volley: 3, eagle_eye: 20, disengage: 25, arrow_rain: 30,
  aimed_shot: 3, steady_aim: 20, camouflage: 25, deadeye: 30, quickdraw: 3, fan_the_hammer: 20, dive_roll: 20, bullet_hell: 30,
  deadshot: 3, hold_breath: 20, ghillie: 25, collateral: 30, shadow_stars: 3, shadow_clone: 20, smoke_bomb: 25, thousand_blades: 30,
  elemental_bolt: 3, arcane_power: 20, mana_shield: 25, wizard_meteor: 30, hex: 4, dark_pact: 20, soul_siphon: 15, chaos_storm: 30,
};

test('every class skill (Z, X, C, B) is 20-35% quicker to come back; ultimates still need a full bar', () => {
  for (const a of ABILITIES) {
    if (a.key === 'V') continue;   // Second Wind, the shared heal, is unchanged
    assert.ok(OLD_CD[a.id], `${a.id} has an old cooldown on record`);
    const r = a.cd / OLD_CD[a.id];
    assert.ok(r >= 0.65 && r <= 0.8, `${a.id}: cooldown ${OLD_CD[a.id]} -> ${a.cd} (${Math.round((1 - r) * 100)}% shorter)`);
    if (a.key === 'B') assert.equal(a.cost, 100, `${a.id} still spends the whole bar`);
  }
});

/** Does this skill deal or add damage? */
const offensive = (a) => (a.kind === 'attack' && (a.dmgMul || a.hits)) || !!a.strike || !!a.counter
  || !!(a.buff && (a.buff.dmg || a.buff.thorns || a.buff.pierce));

test('every class has an offensive part in every slot: strikes on buffs, strike-back on guards', () => {
  for (const c of CLASSES) {
    const set = abilitiesFor(c.style, c.id).filter((a) => a.key !== 'V');
    assert.deepEqual(set.map((a) => a.key), ['Z', 'X', 'C', 'B'], `${c.name}: four skills`);
    for (const a of set) assert.ok(offensive(a), `${c.name}: ${a.name} (${a.key}) has an offensive edge`);
    // Every threshold buff lands a blow the moment it goes up, but the Ranger's:
    // its skills became pure damage buffs at the owner's request (ranger-buffs.test.mjs).
    const x = set.find((a) => a.key === 'X');
    if (c.id === 'ranger') { assert.ok(!x.strike, 'the Ranger\'s Steady Aim is a buff, no strike'); continue; }
    assert.ok(x.strike && (x.strike.dmgMul || x.strike.hits), `${c.name}: ${x.name} strikes`);
  }
  // Guards strike back, and every description mentions its numbers.
  for (const a of ABILITIES.filter((x) => x.kind === 'guard')) assert.ok(a.counter > 0, `${a.id} strikes back`);
  for (const a of ABILITIES.filter((x) => x.strike?.dmgMul && x.key === 'X')) assert.ok(a.desc.includes(`${a.strike.dmgMul}x`), `${a.id} desc shows its strike`);
});

function mk(cls) {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.msg = () => {};
  const t = new NPC('goblin', g.player.x + 1, g.player.y, 0, {});
  t.hp = t.maxHp = 999999; t.def = { ...t.def, aggressive: false, maxHit: 0 };
  g.npcs = [t]; g.adrenaline = 100;
  return { g, t };
}

test('a threshold skill strikes at once; a free one rides on the next hit', () => {
  // Knight: Shield Wall bashes the foe straight away (and stuns it), then the buff runs.
  const k = mk('knight');
  k.g.attackNpc(k.t); k.g.player.attackCooldown = 99;
  const hp0k = k.t.hp;
  k.g.activateAbility('shield_wall');
  assert.ok(k.t.hp < hp0k, 'Shield Wall hit the foe at once');
  assert.equal(k.g.buffMod('thorns'), 0.4, 'and its thorns are up');
  assert.ok(k.g.abilityCd.shield_wall > 0 && k.g.adrenaline >= 50 && k.g.adrenaline < 70, 'paid 50 (the bash builds a little back) and on cooldown');
  // Rogue: Vanish deals nothing now, but the next stab is a critical.
  const r = mk('rogue');
  r.g.attackNpc(r.t); r.g.player.attackCooldown = 99;
  const hp0 = r.t.hp;
  r.g.activateAbility('vanish');
  assert.equal(r.t.hp, hp0, 'a free skill is never an extra attack');
  const mods = r.g._offensiveMods(r.t, 'melee');
  assert.equal(mods.ability?.id, 'vanish', 'the next hit carries Vanish\'s strike');
  assert.equal(mods.critCh, 1, 'and it is a sure critical');
  assert.equal(r.g._offensiveMods(r.t, 'melee').ability, null, 'only once');
});

test('riders: a bleed, an armour break, and guards and thorny buffs strike back', () => {
  // Berserker's Great Cleave leaves a sure bleed.
  const b = mk('berserker');
  b.g.activateAbility('axe_cleave');
  b.g.player.attackCooldown = 0; b.g.doPlayerAttack(b.t);
  assert.ok(b.t.wounds?.bleed?.length >= 1, 'the foe is bleeding');
  // Dragonbane cracks armour: more damage from you for SUNDER_TICKS ticks.
  const k = mk('knight');
  k.g.abilityUnlocked = () => true;
  const base = k.g._offensiveMods(k.t, 'melee').dmgM;
  k.g.activateAbility('dragonbane');
  k.g.player.attackCooldown = 0; k.g.doPlayerAttack(k.t);
  assert.ok(k.t.sunderUntil === k.g.tickCount + SUNDER_TICKS && k.t.sunder === 0.15, 'armour broken');
  assert.ok(Math.abs(k.g._offensiveMods(k.t, 'melee').dmgM / base - 1.15) < 1e-9, '+15% damage while it lasts');
  k.g.tickCount += SUNDER_TICKS + 1;
  assert.ok(Math.abs(k.g._offensiveMods(k.t, 'melee').dmgM / base - 1) < 1e-9, 'and it wears off');
  // Parry halves the blow and cuts back 40% of it as it came.
  const s = mk('swordsman');
  const foe = s.t; foe.def = { ...foe.def, maxHit: 200 }; foe.maxHp = foe.hp = 999999;
  s.g.player.hp = s.g.maxHp(); s.g.skills.xp.defence = 0;
  s.g.activateAbility('parry');
  let back = 0;
  for (let i = 0; i < 30 && back === 0; i++) { s.g.player.hp = s.g.maxHp(); s.g.resolveNpcAttack(foe, { heavy: true }); back = 999999 - foe.hp; }
  assert.ok(back > 0, `Parry struck back (${back})`);
  // Mana Shield shocks attackers too.
  const w = mk('wizard');
  w.t.def = { ...w.t.def, maxHit: 200 };
  w.g.activateAbility('mana_shield');
  assert.equal(w.g.buffMod('thorns'), 0.3);
  for (let i = 0; i < 30 && w.t.hp === 999999; i++) { w.g.player.hp = w.g.maxHp(); w.g.resolveNpcAttack(w.t, { heavy: true }); }
  assert.ok(w.t.hp < 999999, 'Mana Shield shocked the attacker');
});

test('auto battle: guards still answer a telegraphed blow; a short defensive buff never replaces the threshold buff while healthy', () => {
  const k = mk('knight');
  k.g.autoBattle = true; k.g.autoCfg.abilities = true; k.g.abilityUnlocked = () => true;
  k.g.attackNpc(k.t);
  k.g.activateAbility('shield_wall');
  k.t.target = k.g.player; k.t.windup = 2;
  k.g._autoSkills(k.t);
  assert.ok(k.g.braceTicks > 0 && k.g.abilityCd.hold_fast > 0, 'Hold Fast against the wind-up, Shield Wall or not');
  assert.equal(k.g.buff.id, 'shield_wall', 'the guard leaves the buff alone');
  // Berserker: Blood Frenzy (a defensive buff) waits while Berserk Rage runs...
  const b = mk('berserker');
  b.g.autoBattle = true; b.g.autoCfg.abilities = true; b.g.abilityUnlocked = () => true;
  b.g.attackNpc(b.t);
  b.g.activateAbility('berserk_rage');
  b.t.target = b.g.player; b.t.windup = 2;
  b.g._autoSkills(b.t);
  assert.equal(b.g.buff.id, 'berserk_rage', 'the rage keeps running');
  // ...unless you're hurting.
  b.g.player.hp = Math.floor(b.g.maxHp() * 0.3);
  b.g._autoSkills(b.t);
  assert.equal(b.g.buff.id, 'blood_frenzy', 'low on life, the lifesteal buff goes up');
});

// The old numbers for a spread of classes (every style, generic whip set
// included): put back on the shared ability objects to measure the uplift.
const OLD = {
  riposte: { dmgMul: 1.3 }, battle_focus: {}, parry: {}, heroic_strike: { dmgMul: 3 },
  lance_thrust: {}, shield_wall: { buff: { reduce: 0.5, dmg: 0.15 } }, hold_fast: {}, dragonbane: { dmgMul: 3.4 },
  quick_volley: { dmgMul: 0.7 }, eagle_eye: {}, disengage: {}, arrow_rain: { dmgMul: 0.75 },
  shadow_stars: { dmgMul: 0.6 }, shadow_clone: {}, smoke_bomb: {}, thousand_blades: { dmgMul: 0.55 },
  elemental_bolt: { dmgMul: 1.4 }, arcane_power: {}, mana_shield: { buff: { reduce: 0.4 } }, wizard_meteor: { dmgMul: 3.2 },
  crack: { dmgMul: 1.2 }, tempo: {}, brace: {}, grand_finale: { dmgMul: 0.9 },
  axe_cleave: { dmgMul: 1.2 }, berserk_rage: { buff: { dmg: 0.5, haste: 40 } }, blood_frenzy: { buff: { lifesteal: 0.25, dmg: 0.15 } }, rampage: { dmgMul: 0.9 },
};
const NEW_KEYS = ['strike', 'bleed', 'sunder', 'counter'];
function withOldSkills(f) {
  const saved = Object.keys(OLD).map((id) => [id, { ...ABILITY_BY_ID[id] }]);
  for (const [id, o] of Object.entries(OLD)) {
    const a = ABILITY_BY_ID[id];
    for (const k of NEW_KEYS) delete a[k];
    if (id === 'wizard_meteor') delete a.stun;
    Object.assign(a, { cd: OLD_CD[id] }, o);
  }
  try { return f(); } finally {
    for (const [id, s] of saved) { const a = ABILITY_BY_ID[id]; for (const k of Object.keys(a)) delete a[k]; Object.assign(a, s); }
  }
}

test('the rework adds about 10-20% single-target and boss damage from skills, no class running away', () => {
  const L = 100, ticks = 150, tg = pickTargets(L);
  const dps = (cls, boss) => { const game = setupClass(cls, L); return tg.reduce((s, id) => s + dummyDps(cls, L, [id], [[1, 0]], ticks, { game, boss }), 0) / tg.length; };
  const ups = [];
  for (const cls of ['swordsman', 'knight', 'berserker', 'archer', 'ninja', 'wizard', 'dancer']) {
    for (const boss of [false, true]) {
      const before = withOldSkills(() => dps(cls, boss)), after = dps(cls, boss);
      const up = after / before;
      assert.ok(up >= 0.97 && up <= 1.35, `${cls}${boss ? ' (boss)' : ''}: ${Math.round((up - 1) * 100)}% from the rework`);
      ups.push(up);
      if (process.env.SHOW_UPLIFT) console.log(cls, boss, up.toFixed(3));
    }
  }
  const mean = ups.reduce((s, x) => s + x, 0) / ups.length;
  assert.ok(mean >= 1.07 && mean <= 1.25, `average uplift ${Math.round((mean - 1) * 100)}%`);
});
