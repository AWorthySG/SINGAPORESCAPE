// The Priest's and the Zealot's own elements. The Priest casts only the Light
// path (Radiance, Grace, Judgement, Sanctuary), the Zealot only the Flame path
// (Holy Fire, Wrath, Ash, Blood); the Wizard and the Sorcerer keep the seven
// elements. Each element's effect (game/classelements.js) is checked here, and a
// save from before the classes had their own elements loads onto them.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave, saveGame, loadGame } from '../src/game/save.js';
import { SPELLS, ELEMENTS, WIZARD_ELEMENTS, AOE_RADIUS, spellsFor, classSpell, getSpell, elementMult } from '../src/data/magic.js';
import { RACES } from '../src/data/races.js';
import { LIFE_COST_FLOOR } from '../src/data/abilities.js';
import * as ClassEl from '../src/game/classelements.js';
import { combatExtras } from '../src/game/skillguide.js';
import { codexEntry } from '../src/game/codex.js';
import { elementFx, ELEMENT_FX } from '../src/render/elementfx.js';
import { elementForTint } from '../src/render/combatfx.js';
import { drawClassShot, drawClassEffect, drawClassAuras } from '../src/render/classfx.js';
import { SPELL_SVG } from '../src/render/icons.js';
import { fakeStorage } from '../tools/balance/common.mjs';

const LIGHT = ['radiance', 'grace', 'judgement', 'sanctuary'];
const FLAME = ['holyfire', 'wrath', 'ash', 'bloodprice'];
const SEVEN = ['wind', 'water', 'earth', 'fire', 'chaos', 'dark', 'blood'];

const foe = (g, id, x, y, hp = 1e9) => {
  const t = new NPC(id, x, y, 0, {});
  t.hp = t.maxHp = hp; t.def = { ...t.def, aggressive: false, maxHit: 0 };
  return t;
};
/** A character of `cls` at Magic 99 with plenty of runes and life, and a huge-life goblin beside it. */
function mk(cls, magicXp = 13e6) {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.skills.xp.magic = magicXp; g.skills.xp.hitpoints = 5e6;
  g.player.hp = g.maxHp();
  for (const r of new Set(SPELLS.flatMap((s) => Object.keys(s.runes)))) g.inventory.add(r, 5000);
  const t = foe(g, 'goblin', g.player.x + 1, g.player.y);
  g.npcs = [t];
  return { g, t };
}
/** Cast `spell` at `t` once: the damage of the blow that landed on it. */
function cast(g, t, spell) {
  g.player.spell = spell; g.player.spellAuto = false;
  let landed = 0;
  const apply = g._applyPlayerHit;
  g._applyPlayerHit = function (n, dmg, opts) { if (n === t) landed = dmg; return apply.call(this, n, dmg, opts); };
  try { g.player.attackCooldown = 0; g._magicAttack(t); } finally { delete g._applyPlayerHit; }
  return landed;
}
/** Run `fn` with Math.random fixed at `v`. */
function withRandom(v, fn) {
  const r = Math.random; Math.random = () => v;
  try { return fn(); } finally { Math.random = r; }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('each class casts only its own elements: the Priest the Light path, the Zealot the Flame path, the rest the seven', () => {
  assert.deepEqual(spellsFor('priest').map((s) => s.element), LIGHT);
  assert.deepEqual(spellsFor('zealot').map((s) => s.element), FLAME);
  for (const cls of ['wizard', 'sorcerer', 'swordsman', null]) assert.deepEqual(spellsFor(cls).map((s) => s.element), SEVEN, String(cls));
  assert.deepEqual(WIZARD_ELEMENTS, SEVEN);
  for (const [cls, own] of [['priest', LIGHT], ['zealot', FLAME], ['wizard', SEVEN]]) {
    const { g, t } = mk(cls);
    assert.ok(own.includes(g.bestSpell().element), `${cls}: best spell ${g.bestSpell().id}`);
    assert.ok(own.includes(g._autoSpellFor(t).element), `${cls}: auto element ${g._autoSpellFor(t).id}`);
    assert.ok(own.includes(classSpell(cls, g.player.spell).element), `${cls}: chosen spell`);
    // A spell of another class is cast as the class's own first spell.
    g.player.spell = cls === 'wizard' ? 'radiance_strike' : 'fire_strike';
    cast(g, t, g.player.spell);
    assert.ok(g.effects.some((e) => e.type === 'projectile' && e.el === own[0]), `${cls} cast ${own[0]}`);
    // The skill guide and the codex list only the class's own elements.
    // (By name among the class's own: the Zealot's Blood and the Wizard's share one.)
    assert.deepEqual(combatExtras('magic', cls).rows.map((r) => spellsFor(cls).find((s) => s.name === r.name).element), own);
    g.kills = { skeleton: 1 };
    const e = codexEntry(g, 'skeleton');
    assert.ok(e.elements?.length, 'the codex lists elements');
    for (const m of e.elements) for (const item of m.list) assert.ok(own.some((el) => item.endsWith(ELEMENTS[el].name)), `${cls} codex: ${item}`);
  }
});

test('the eight new elements: matchups with real races, an effect, hit numbers, bolts, hit effects and icons of their own', () => {
  for (const el of [...LIGHT, ...FLAME]) {
    const e = ELEMENTS[el];
    assert.ok(e.strong.length >= 2 && e.strong.length <= 4 && e.weak.length >= 1 && e.weak.length <= 3, el);
    for (const r of [...e.strong, ...e.weak]) assert.ok(RACES[r], `${el}: ${r}`);
    assert.ok(!e.strong.some((r) => e.weak.includes(r)), `${el}: no race both`);
    assert.ok(e.effect && e.splat && e.icon, el);
    const sp = getSpell(`${el}_strike`);
    assert.equal(sp.element, el);
    assert.equal(elementForTint(sp.tint), el, `${el}: its tint gives its hit effect`);
    assert.ok(ELEMENT_FX[el] && elementFx(el) !== ELEMENT_FX.arcane, `${el} has its own hit effect`);
    assert.ok(SPELL_SVG[sp.id], `${el} has a vector icon until its art arrives`);
    // Only existing runes.
    for (const r of Object.keys(sp.runes)) assert.ok(SPELLS.some((s) => !s.cls && s.runes[r]) || r === 'nature_rune', `${el}: ${r}`);
  }
  // Every tint is its own, so the hit hook can tell the elements apart.
  assert.equal(new Set(SPELLS.map((s) => s.tint)).size, SPELLS.length);
  // The level-1 spells take only the starter kit's runes.
  for (const cls of ['priest', 'zealot']) assert.deepEqual(spellsFor(cls)[0].runes, { air_rune: 1, mind_rune: 1 });
});

test('Radiance (Dazzle): foes it hits miss an extra 25% of the time for 3s', () => {
  const { g, t } = mk('priest');
  const other = foe(g, 'goblin', t.x + 1, t.y); other.target = g.player; g.npcs.push(other);
  assert.ok(cast(g, t, 'radiance_strike') > 0);
  assert.equal(t.dazzleUntil, g.tickCount + ELEMENTS.radiance.dazzle.ticks);
  assert.ok(other.dazzleUntil > g.tickCount, 'the splash dazzles too');
  assert.ok(g.effects.some((e) => e.type === 'projectile' && e.el === 'radiance'), 'a beam');
  assert.equal(withRandom(0.24, () => ClassEl.dazzleMiss(g, t)), true);
  assert.equal(withRandom(0.26, () => ClassEl.dazzleMiss(g, t)), false);
  assert.equal(withRandom(0.2, () => ClassEl.dazzleMiss(g, t, true)), false, 'a heavy blow: half the chance');
  // A dazzled foe's blow that misses deals nothing.
  t.def = { ...t.def, maxHit: 50 };
  const hp = g.player.hp;
  withRandom(0.1, () => g.resolveNpcAttack(t));
  assert.equal(g.player.hp, hp);
  assert.ok(g.effects.some((e) => e.type === 'hitsplat' && e.entity === g.player && e.text === 'Dazzled!'));
  // Three seconds on, it wears off.
  g.tickCount += 5;
  assert.equal(withRandom(0, () => ClassEl.dazzleMiss(g, t)), false);
});

test('Grace (Ward): 20% of the damage dealt wards you, capped at 20% of your life, fading 8s after the last top-up', () => {
  const { g, t } = mk('priest');
  const p = g.player, max = g.maxHp();
  const dmg = cast(g, t, 'grace_strike');
  assert.ok(dmg > 0);
  assert.equal(p.ward, Math.min(Math.round(max * 0.2), Math.round(dmg * (t.def.hpScale || 1) * 0.2)));
  // It soaks the blows you take before your life does.
  p.ward = 30; p.hp = max;
  p.takeDamage(20);
  assert.equal(p.hp, max); assert.equal(p.ward, 10);
  p.takeDamage(25);
  assert.equal(p.hp, max - 15); assert.equal(p.ward, 0);
  // Capped at a fifth of your life.
  ClassEl.addWard(g, max * 5);
  assert.equal(p.ward, Math.round(max * 0.2));
  // Fades unless topped up within 8s (13 ticks).
  const until = p.wardUntil;
  assert.equal(until, g.tickCount + 13);
  g.tickCount = until - 1; ClassEl.tick(g);
  assert.ok(p.ward > 0, 'still there');
  ClassEl.addWard(g, 1);
  g.tickCount = until; ClassEl.tick(g);
  assert.ok(p.ward > 0, 'a top-up keeps it');
  g.tickCount = p.wardUntil; ClassEl.tick(g);
  assert.equal(p.ward, 0, 'faded');
  // A foe's blow shows only what got through.
  p.ward = 1e6; t.def = { ...t.def, maxHit: 50 };
  const hp = p.hp;
  for (let i = 0; i < 5; i++) g.resolveNpcAttack(t);
  assert.equal(p.hp, hp);
  // Nobody but a Grace caster gets one.
  const w = mk('wizard');
  cast(w.g, w.t, 'water_strike');
  assert.equal(w.g.player.ward, 0);
});

test('Judgement (Verdict): x(1 + 0.6 x the foe\'s missing life)', () => {
  const { g, t } = mk('priest');
  const P = ELEMENTS.judgement.power;
  assert.ok(near(ClassEl.castMult(g, t, 'judgement'), P));
  t.hp = t.maxHp / 2;
  assert.ok(near(ClassEl.castMult(g, t, 'judgement'), P * 1.3));
  t.hp = 0;
  assert.ok(near(ClassEl.castMult(g, t, 'judgement'), P * 1.6));
  // In a real cast: the same foe half dead, then unhurt.
  const mod = () => { g._castElement = 'judgement'; const m = g._offensiveMods(t, 'magic').dmgM; g._castElement = null; return m; };
  t.hp = t.maxHp / 2; const half = mod();
  t.hp = t.maxHp; const full = mod();
  assert.ok(near(half / full, 1.3, 1e-9), `x${half / full}`);
});

test('Sanctuary (Consecrate): a radius-4 blast that heals 2% of your life a foe hit, at most 10% a cast', () => {
  const { g, t } = mk('priest');
  const p = g.player, max = g.maxHp();
  assert.equal(ELEMENTS.sanctuary.aoeRadius, 4);
  // One more foe, four tiles off (and one five off): two foes hit.
  const far = foe(g, 'goblin', t.x + 4, t.y); far.target = p; g.npcs.push(far);
  const out = foe(g, 'goblin', t.x + 5, t.y); out.target = p; g.npcs.push(out);
  cast(g, t, 'sanctuary_strike');
  assert.ok(far.hp < far.maxHp, 'four tiles away is hit');
  assert.equal(out.hp, out.maxHp, 'five is not');
  assert.equal(g._consecrated, 2);
  // The heal (apart from the Priest's own 8% of each hit): 2% a foe, at most 10%.
  const sp = getSpell('sanctuary_strike');
  for (const [n, share] of [[1, 0.02], [2, 0.04], [5, 0.1], [8, 0.1]]) {
    p.hp = 1; g._consecrated = n;
    ClassEl.afterCast(g, t, sp, { dmg: 0, raw: 0, dealt: 0 });
    assert.equal(p.hp, 1 + Math.round(max * share), `${n} foes`);
  }
});

test('Holy Fire (Brand): every hit brands the foe; the fifth bursts for the hit again on it and round it, then clears', () => {
  const { g, t } = mk('zealot');
  const other = foe(g, 'goblin', t.x + 1, t.y); other.target = g.player; g.npcs.push(other);
  for (let i = 1; i <= 4; i++) {
    cast(g, t, 'holyfire_strike');
    assert.equal(ClassEl.brands(g, t), i);
  }
  const hp = t.hp, ohp = other.hp, splashes = [];
  const sp = g._spellSplash;
  g._spellSplash = function (n, d, s) { splashes.push(d); return sp.call(this, n, d, s); };
  const dmg = cast(g, t, 'holyfire_strike');
  delete g._spellSplash;
  assert.equal(hp - t.hp, 2 * dmg, 'the hit, and the burst for as much again');
  assert.equal(splashes.length, 2, 'the cast\'s splash and the burst\'s');
  assert.equal(splashes[0], splashes[1]);
  assert.ok(other.hp < ohp);
  assert.equal(ClassEl.brands(g, t), 0, 'cleared');
  assert.ok(g.effects.some((e) => e.type === 'classfx' && e.kind === 'flare'));
  assert.ok(g.effects.some((e) => e.type === 'hitsplat' && e.text === 'Brands burst!'));
  // Brands fade after 6s without another hit.
  cast(g, t, 'holyfire_strike');
  g.tickCount += ELEMENTS.holyfire.brand.ticks;
  assert.equal(ClassEl.brands(g, t), 0);
  // The censer's holy fire burns on top.
  assert.ok(t.wounds?.holyfire?.length > 0);
});

test('Wrath (Retribution): the damage you take is stored, up to +50% on the next Wrath, then it resets', () => {
  const { g, t } = mk('zealot');
  const p = g.player, max = g.maxHp(), P = ELEMENTS.wrath.power;
  assert.equal(ClassEl.wrathBonus(g), 0);
  p.takeDamage(Math.round(max * 0.1));
  assert.ok(near(ClassEl.wrathBonus(g), 2 * Math.round(max * 0.1) / max));
  assert.ok(near(ClassEl.castMult(g, t, 'wrath'), P * (1 + ClassEl.wrathBonus(g))));
  assert.equal(ClassEl.castMult(g, t, 'holyfire'), ELEMENTS.holyfire.power, 'only Wrath spends it');
  p.takeDamage(Math.round(max * 0.3));
  assert.equal(ClassEl.wrathBonus(g), 0.5, 'capped');
  // What a ward soaks is not taken; life spent on a skill is not taken either.
  const w0 = p.wrath; p.ward = 100; p.takeDamage(50);
  assert.equal(p.wrath, w0);
  // A Wrath cast spends it, and its bolt shows how much it carried.
  p.hp = max;
  cast(g, t, 'wrath_strike');
  assert.equal(p.wrath, 0);
  assert.equal(g.effects.filter((e) => e.type === 'projectile' && e.el === 'wrath').at(-1).power, 0.5);
  // A death empties it too.
  p.ward = 0; p.takeDamage(Math.round(max * 0.2)); assert.ok(p.wrath > 0);
  ClassEl.reset(g); assert.equal(p.wrath, 0);
});

test('Ash (Cinders): a foe struck by Ash that dies branded or burning bursts for 30% of the killing blow within 2 tiles', () => {
  // A real killing blow.
  const { g, t } = mk('zealot');
  const other = foe(g, 'goblin', t.x + 2, t.y); other.target = g.player; g.npcs.push(other);
  const far = foe(g, 'goblin', t.x + 3, t.y); far.target = g.player; g.npcs.push(far);
  cast(g, t, 'holyfire_strike');   // a brand on it
  cast(g, t, 'ash_strike');
  t.hp = 1000; const ohp = other.hp;
  t.takeDamage(1000);
  g.killNpc(t);
  assert.equal(ohp - other.hp >= 300, true, `cinders hit the foe 2 tiles off (${ohp - other.hp})`);
  assert.equal(far.hp, far.maxHp, 'three tiles off is out of reach');
  assert.ok(g.effects.some((e) => e.type === 'classfx' && e.kind === 'ash'));
  // Not branded or burning: no cinders.
  const cold = mk('zealot');
  const o2 = foe(cold.g, 'goblin', cold.t.x + 1, cold.t.y); o2.target = cold.g.player; cold.g.npcs.push(o2);
  cold.g.player.spell = 'ash_strike';
  cast(cold.g, cold.t, 'ash_strike');
  cold.t.wounds = null; cold.t.ignite = null; cold.t.brand = null;
  const before = o2.hp;
  cold.t.hp = 1000; cold.t.takeDamage(1000); cold.g.killNpc(cold.t);
  assert.equal(o2.hp, before, 'nothing burst');
  // Not struck by Ash: no cinders either, burning or not.
  const plain = mk('zealot');
  const o3 = foe(plain.g, 'goblin', plain.t.x + 1, plain.t.y); o3.target = plain.g.player; plain.g.npcs.push(o3);
  plain.t.wounds = { holyfire: [{ perSec: 1, left: 5 }] };
  plain.t.hp = 1000; plain.t.takeDamage(1000); plain.g.killNpc(plain.t);
  assert.equal(o3.hp, o3.maxHp);
  assert.equal(AOE_RADIUS, 2, 'the cinders reach 2 tiles (the spell splash)');
});

test('Blood (Blood Price): pays 5% of your life a cast for a hit 120% harder; at the life-cost floor it costs nothing and hits as usual', () => {
  const { g, t } = mk('zealot');
  g.skills.xp.hitpoints = 1e9;   // enough life for 5% of it to be a fair few points
  const p = g.player, max = g.maxHp(), B = ELEMENTS.bloodprice;
  assert.equal(B.name, 'Blood');
  assert.deepEqual(B.sacrifice, { life: 0.05, dmg: 1.2 });
  assert.ok(B.effect.startsWith('Blood Price'));
  p.hp = max;
  assert.ok(near(ClassEl.castMult(g, t, 'bloodprice'), B.power * 2.2));
  assert.equal(ClassEl.lifeCost(g, 0.05), Math.floor(max * 0.05));
  cast(g, t, 'bloodprice_strike');
  assert.equal(p.hp, max - Math.floor(max * 0.05));
  assert.ok(g.effects.some((e) => e.type === 'classfx' && e.kind === 'bloodprice'), 'the price paid shows over you');
  assert.ok(g.effects.some((e) => e.type === 'hitsplat' && e.entity === p), 'and the life it cost');
  // Just over the floor: only down to it, and that cast still pays, so still hits harder.
  const floor = Math.ceil(max * LIFE_COST_FLOOR);
  p.hp = floor + 1;
  assert.ok(near(ClassEl.castMult(g, t, 'bloodprice'), B.power * 2.2));
  cast(g, t, 'bloodprice_strike');
  assert.equal(p.hp, floor);
  // At the floor: no price, so no bonus (and no droplets over you).
  assert.equal(ClassEl.lifeCost(g, 0.05), 0);
  assert.ok(near(ClassEl.castMult(g, t, 'bloodprice'), B.power));
  g.effects = [];
  cast(g, t, 'bloodprice_strike');
  assert.equal(p.hp, floor, 'at the floor it costs nothing');
  assert.ok(!g.effects.some((e) => e.type === 'classfx' && e.kind === 'bloodprice'));
  assert.ok(g.effects.some((e) => e.type === 'projectile' && e.el === 'bloodprice'), 'it still casts');
  // Its hit next to Holy Fire's: x2.2 when paid, its own power alone when not.
  // (Each race matchup divided out: a goblin is a humanoid, which resists Blood.)
  const mod = (el) => { g._castElement = el; const m = g._offensiveMods(t, 'magic').dmgM / elementMult(g.raceMatchup(t)); g._castElement = null; return m; };
  assert.ok(near(mod('bloodprice') / mod('holyfire'), B.power / ELEMENTS.holyfire.power, 1e-9));
  p.hp = max;
  assert.ok(near(mod('bloodprice') / mod('holyfire'), 2.2 * B.power / ELEMENTS.holyfire.power, 1e-9));
  // The landed hit itself, with the dice fixed: paid vs unpaid (the goblin's
  // armour and the level's flat damage keep it a little short of x2.2).
  const hitAt = (hp) => { p.hp = hp; return withRandom(0.5, () => cast(g, t, 'bloodprice_strike')); };
  const paid = hitAt(max), free = hitAt(floor);
  assert.ok(paid > free * 1.6, `paid ${paid} vs free ${free}`);
  // Auto battle weighs it less the more hurt you are, and as a plain cast at the
  // floor: against a spirit (which Blood bites into) it is the pick unhurt, but
  // not once the price can't be paid (Holy Fire's brands do more then).
  const sp = foe(g, 'hantu_laut', t.x, t.y + 1, 1e6);
  g.npcs = [sp];
  const val = (hp) => { p.hp = hp; return g._autoSpellFor(sp).id; };
  assert.equal(val(max), 'bloodprice_strike', 'unhurt, Blood is worth its price');
  assert.notEqual(val(floor), 'bloodprice_strike', 'at the floor, without its bonus, another element does more');
});

test('the Wizard\'s Blood (Siphon) is unchanged and stays the Wizard\'s', () => {
  const b = getSpell('blood_strike');
  assert.equal(b.element, 'blood'); assert.equal(b.cls, undefined); assert.equal(b.level, 40);
  assert.equal(ELEMENTS.blood.siphon, 0.12);
  assert.ok(!ELEMENTS.blood.sacrifice && !ELEMENTS.blood.power);
  assert.ok(spellsFor('wizard').includes(b) && !spellsFor('zealot').includes(b));
  assert.ok(!spellsFor('wizard').some((s) => s.element === 'bloodprice'));
  const { g, t } = mk('wizard');
  g.skills.xp.hitpoints = 1e9; g.player.hp = g.maxHp();
  assert.equal(ClassEl.castMult(g, t, 'blood'), 1);
  cast(g, t, 'blood_strike');
  assert.equal(g.player.hp, g.maxHp(), 'no life paid');
});

test('an old Priest or Zealot save with a Wizard element loads onto the class\'s own; a Wizard\'s is kept', () => {
  for (const [cls, saved, want] of [['priest', 'fire_strike', 'radiance_strike'], ['zealot', 'blood_wave', 'holyfire_strike'],
    ['zealot', 'martyrdom_strike', 'bloodprice_strike'], ['wizard', 'martyrdom_strike', 'wind_strike'], ['wizard', 'blood_strike', 'blood_strike'],
    ['priest', 'judgement_strike', 'judgement_strike'], ['wizard', 'fire_strike', 'fire_strike'], ['sorcerer', 'radiance_strike', 'wind_strike']]) {
    const { g } = mk(cls);
    g.player.spell = saved; g.player.spellAuto = true;
    assert.ok(saveGame(g));
    const g2 = new Game(); g2.start();
    assert.ok(loadGame(g2));
    assert.equal(g2.jobClass, cls);
    assert.equal(g2.player.spell, want, `${cls} saved with ${saved}`);
    assert.equal(g2.player.spellAuto, true);
    assert.equal(g2.player.ward, 0); assert.equal(g2.player.wrath, 0);
  }
  // Choosing a class re-maps the spell held from before it.
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  g.player.spell = 'water_strike';
  g.chooseClass('zealot');
  assert.equal(g.player.spell, 'holyfire_strike');
});

test('the Wizard is unchanged: the seven elements, no extra power, no new effects', () => {
  const { g, t } = mk('wizard');
  for (const el of SEVEN) assert.equal(ClassEl.castMult(g, t, el), 1, el);
  cast(g, t, 'fire_strike');
  assert.ok(t.ignite?.burns?.length, 'Fire still ignites');
  assert.ok(!t.dazzleUntil && !t.brand && !t.ashUntil);
  g.player.takeDamage(10);
  assert.equal(ClassEl.castMult(g, t, 'fire'), 1, 'damage taken lifts no Wizard spell');
});

test('the bolts and effects draw on a canvas without throwing, low graphics and Reduce motion too', () => {
  const calls = { n: 0 };
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => { calls.n++; }), set: (o, k, v) => { o[k] = v; return true; } });
  for (const lowFx of [false, true]) for (const reduceMotion of [false, true]) {
    const { g, t } = mk('zealot');
    g.lowFx = lowFx; g.reduceMotion = reduceMotion;
    for (const el of [...LIGHT, ...FLAME]) for (const tt of [0, 0.3, 0.7, 1]) {
      assert.equal(drawClassShot(ctx, { el, x: 0, y: 0, ex: 100, ey: 40, color: '#fff', crit: tt > 0.5, power: 0.3 }, tt, 0, 0, g), true, el);
    }
    assert.equal(drawClassShot(ctx, { el: 'fire', x: 0, y: 0, ex: 1, ey: 1 }, 0.5, 0, 0, g), false, 'the seven draw as before');
    for (const kind of ['flare', 'ash', 'ward', 'bloodprice']) drawClassEffect(ctx, { kind, x: 5, y: 5, life: 100, maxLife: 200, low: lowFx, calm: reduceMotion }, 0, 0);
    g.player.ward = 10; g.player.wrath = 1e3; t.brand = { n: 3, until: g.tickCount + 5 };
    g.camera = { viewW: 800, viewH: 600 };
    drawClassAuras(ctx, g, 0, 0, 1000);
  }
  assert.ok(calls.n > 100);
});

test('the life-cost floor is 1%, and Blood pays at least 1 life all the way down to it', () => {
  assert.equal(LIFE_COST_FLOOR, 0.01);
  const { g } = mk('zealot');
  g.skills.xp.hitpoints = 1e9;
  const p = g.player, floor = Math.ceil(g.maxHp() * LIFE_COST_FLOOR);
  p.hp = floor + 5;   // 5% of so little rounds to nothing, but the price is still 1
  assert.equal(ClassEl.lifeCost(g, 0.05), 1);
  p.hp = floor;
  assert.equal(ClassEl.lifeCost(g, 0.05), 0, 'at the floor it is free');
  // The life-paid skills wait at or under 1% of your life too.
  p.hp = Math.floor(g.maxHp() * LIFE_COST_FLOOR);
  assert.equal(g.lifeCostBlocked({ lifeCost: 0.15 }), true);
  p.hp = floor + 1;
  assert.equal(g.lifeCostBlocked({ lifeCost: 0.15 }), false);
});
