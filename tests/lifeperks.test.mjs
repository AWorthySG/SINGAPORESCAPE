// Life skill perks: every life skill level adds an offensive combat stat
// (see src/game/lifeperks.js). Each check compares the real combat numbers
// with and without the perk, so no test depends on a lucky roll.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel, MAX_LEVEL, LIFE_MAX_LEVEL } from '../src/data/xp.js';
import { armourMult, armourOf, weaknessOf } from '../src/game/combat.js';
import { LIFE_PERKS, LIFE_PERK_SKILLS, LIFE_PERK_FULL_LEVEL, LIFE_PERK_MAX_LEVEL, LIFE_PERK_OVER, LIFE_PERK_TOP_OVER, lifePerkValue, lifePerkTotals,
  lifePerkNext, lifePerkNoteAt, lifePerkText } from '../src/game/lifeperks.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  return game;
}
const setLevel = (game, skill, level) => { game.skills.xp[skill] = xpForLevel(level); };
// A plain (non-boss, non-champion) monster, and the same monster dressed as a boss.
const mob = (game) => game.npcs.find((n) => n.attackable && !n.def.boss && !n.champion);
const bossOf = (n) => ({ ...n, def: { ...n.def, boss: true }, npcId: n.npcId, champion: false });
const dmgM = (game, npc, mode = 'melee') => game._offensiveMods(npc, mode).dmgM;

test('life perks: nothing at level 1, the table value at level 200, rising in between and on to 30,000', () => {
  for (const s of LIFE_PERK_SKILLS) {
    assert.equal(lifePerkValue(s, 1), 0, `${s} gives nothing at level 1`);
    assert.equal(lifePerkValue(s, LIFE_PERK_FULL_LEVEL), LIFE_PERKS[s].max, `${s} is its table value at ${LIFE_PERK_FULL_LEVEL}`);
    // Past 200 it keeps growing, half as fast, to 1.5x at LIFE_PERK_MAX_LEVEL,
    // then slowly on to 2x at level 9999, and on at that pace to its full
    // strength, about 3.1x, at 30,000.
    const top = Math.round(LIFE_PERKS[s].max * (1 + LIFE_PERK_OVER) * 10) / 10;
    assert.equal(lifePerkValue(s, LIFE_PERK_MAX_LEVEL), top, `${s} is ${top} at ${LIFE_PERK_MAX_LEVEL}`);
    const v5000 = lifePerkValue(s, 5000);
    assert.ok(v5000 > top && v5000 < 2 * LIFE_PERKS[s].max, `${s} still grows past ${LIFE_PERK_MAX_LEVEL} (${v5000} at 5000)`);
    assert.equal(lifePerkValue(s, MAX_LEVEL), Math.round(LIFE_PERKS[s].max * (1 + LIFE_PERK_OVER + LIFE_PERK_TOP_OVER) * 10) / 10, `${s} at 9999`);
    const full = Math.round(LIFE_PERKS[s].max * (1 + LIFE_PERK_OVER + LIFE_PERK_TOP_OVER * (LIFE_MAX_LEVEL - LIFE_PERK_MAX_LEVEL) / (MAX_LEVEL - LIFE_PERK_MAX_LEVEL)) * 10) / 10;
    assert.equal(lifePerkValue(s, LIFE_MAX_LEVEL), full, `${s} at full strength`);
    assert.equal(lifePerkValue(s, LIFE_MAX_LEVEL + 5000), full, `${s} stops at 30,000`);
    const v600 = lifePerkValue(s, 600);
    assert.ok(v600 > LIFE_PERKS[s].max && v600 < top, `${s} grows past ${LIFE_PERK_FULL_LEVEL} (${v600})`);
    const v50 = lifePerkValue(s, 50), v99 = lifePerkValue(s, 99);
    assert.ok(v50 > 0 && v50 < v99 && v99 < LIFE_PERKS[s].max, `${s} scales with level (${v50} < ${v99})`);
  }
  // The whole table is offensive: no Defence, HP, food, regen or coin perks.
  for (const p of Object.values(LIFE_PERKS)) assert.ok(!['defence', 'hp', 'heal', 'regen', 'coins'].includes(p.stat));
  const t = lifePerkTotals(() => 1);
  for (const v of Object.values(t)) assert.equal(v, 0);
});

test('life perks: the next milestone and the chat notes go on past 1000, every 500 levels to 30,000', () => {
  assert.equal(lifePerkNext('mining', 999).level, LIFE_PERK_MAX_LEVEL);
  assert.equal(lifePerkNext('mining', LIFE_PERK_MAX_LEVEL).level, 1500);
  assert.equal(lifePerkNext('mining', 9500).level, 10000);
  assert.equal(lifePerkNext('mining', 29600).level, LIFE_MAX_LEVEL);
  for (const s of LIFE_PERK_SKILLS) assert.equal(lifePerkNext(s, LIFE_MAX_LEVEL), null, `${s}: nothing past full strength`);
  for (const l of [10, 200, 250, 1000, 1500, 9500, 10000, 20000, LIFE_MAX_LEVEL]) assert.ok(lifePerkNoteAt(l), `a note at ${l}`);
  for (const l of [15, 210, 1050, 1510, 9998, MAX_LEVEL, 20010]) assert.ok(!lifePerkNoteAt(l), `no note at ${l}`);
});

test('life perks: a fresh character gains nothing, and gear bonuses are unchanged', () => {
  const game = newGame();
  const withPerks = game.equipment.bonuses();
  game.equipment.extra = null;
  const gearOnly = game.equipment.bonuses();
  for (const k of Object.keys(withPerks)) assert.equal(withPerks[k], gearOnly[k] || 0, k);
});

test('life perks: gear-style stats (crit damage, pierce, crit, Attack/Magic %, lifesteal, boss damage) join the gear totals', () => {
  const game = newGame();
  const before = game.equipment.bonuses();
  for (const s of LIFE_PERK_SKILLS) setLevel(game, s, LIFE_PERK_FULL_LEVEL);
  const after = game.equipment.bonuses();
  assert.equal(after.critDmg - before.critDmg, 60, 'Mining: crit damage');
  assert.equal(after.pierce - before.pierce, 15, 'Smithing: armour pierce');
  assert.equal(after.crit - before.crit, 15, 'Crafting: crit chance');
  assert.equal(after.magPct - before.magPct, 15 + 10 + 10, 'Firemaking: Magic bonus, and Fishing and Diving: damage for every style');
  assert.equal(after.atkPct - before.atkPct, 15 + 10 + 10, 'Woodcutting: Physical bonus, and Fishing and Diving: damage for every style');
  assert.equal(after.lifesteal - before.lifesteal, 8, 'Herblore: lifesteal');
  assert.equal(after.bossDmg - before.bossDmg, 20, 'Hunter: boss damage');
  assert.equal(after.strength - before.strength, 0, 'no flat power any more (Fishing is a percentage)');
  // Halfway-ish levels give part of it.
  setLevel(game, 'mining', 99);
  assert.ok(game.equipment.bonuses().critDmg - before.critDmg > 25 && game.equipment.bonuses().critDmg - before.critDmg < 35);
});

test('life perks: Woodcutting, Smithing and Cooking raise damage against a normal monster; Hunter does not', () => {
  const game = newGame();
  const n = mob(game);
  const base = dmgM(game, n);
  setLevel(game, 'woodcutting', LIFE_PERK_FULL_LEVEL);
  assert.ok(Math.abs(dmgM(game, n) / base - 1.15) < 1e-9, 'Woodcutting: +15% physical damage');
  setLevel(game, 'woodcutting', 1);
  setLevel(game, 'cooking', LIFE_PERK_FULL_LEVEL);
  assert.ok(Math.abs(dmgM(game, n) / base - 1.20) < 1e-9, 'Cooking: +20% against normal monsters');
  setLevel(game, 'cooking', 1);
  setLevel(game, 'hunter', LIFE_PERK_FULL_LEVEL);
  assert.ok(Math.abs(dmgM(game, n) / base - 1) < 1e-9, 'Hunter does nothing against a normal monster');
  setLevel(game, 'hunter', 1);
  const pierce0 = game.equipment.bonuses().pierce;
  setLevel(game, 'smithing', LIFE_PERK_FULL_LEVEL);
  const a = armourOf(n.def, { champion: n.champion, fightLevel: game.fightLevel() });
  const weak = weaknessOf(n.def) === 'melee';   // a weakness gets past half the armour
  const want = armourMult(a, pierce0 + 15, weak) / armourMult(a, pierce0, weak);
  assert.ok(want > 1 && Math.abs(dmgM(game, n) / base - want) < 1e-9, 'Smithing: armour pierce adds damage');
});

test('life perks: Hunter raises damage against bosses and champions; Cooking does not', () => {
  const game = newGame();
  const b = bossOf(mob(game));
  const base = dmgM(game, b);
  setLevel(game, 'hunter', LIFE_PERK_FULL_LEVEL);
  const perk = game.perkMods('melee').boss || 0;
  assert.ok(Math.abs(dmgM(game, b) / base - (1 + perk + 0.20) / (1 + perk)) < 1e-9, 'Hunter: +20% boss damage');
  setLevel(game, 'hunter', 1);
  setLevel(game, 'cooking', LIFE_PERK_FULL_LEVEL);
  assert.ok(Math.abs(dmgM(game, b) / base - 1) < 1e-9, 'Cooking does nothing against a boss');
});

test('life perks: Firemaking boosts spells only', () => {
  const game = newGame();
  const n = mob(game);
  const magic0 = dmgM(game, n, 'magic'), melee0 = dmgM(game, n, 'melee');
  setLevel(game, 'firemaking', LIFE_PERK_FULL_LEVEL);
  assert.ok(Math.abs(dmgM(game, n, 'magic') / magic0 - 1.15) < 1e-9);
  assert.ok(Math.abs(dmgM(game, n, 'melee') / melee0 - 1) < 1e-9);
});

test('life perks: Crafting raises crit chance', () => {
  const game = newGame();
  const n = mob(game);
  const c0 = game._offensiveMods(n, 'melee').critCh;
  setLevel(game, 'crafting', 50);
  const c50 = game._offensiveMods(n, 'melee').critCh;
  setLevel(game, 'crafting', LIFE_PERK_FULL_LEVEL);
  const cMax = game._offensiveMods(n, 'melee').critCh;
  assert.ok(c0 < c50 && c50 < cMax);
  assert.ok(Math.abs(cMax - c0 - 0.15) < 1e-9, 'Crafting: +15% crit chance');
});

test('life perks: Fishing adds damage to every style', () => {
  const game = newGame();
  const n = mob(game);
  const m0 = dmgM(game, n, 'melee'), g0 = dmgM(game, n, 'magic');
  setLevel(game, 'fishing', LIFE_PERK_FULL_LEVEL);
  assert.ok(Math.abs(dmgM(game, n, 'melee') / m0 - 1.10) < 1e-9, 'melee (and ranged): +10%');
  assert.ok(Math.abs(dmgM(game, n, 'magic') / g0 - 1.10) < 1e-9, 'magic: +10%');
});

test('life perks: Fletching shortens the time between attacks', () => {
  const game = newGame();
  const t0 = game.attackInterval();
  setLevel(game, 'fletching', LIFE_PERK_FULL_LEVEL);
  const gear = game.equipment._haste() - 15;
  assert.ok(Math.abs(game.attackInterval() / t0 - (100 + gear) / (115 + gear)) < 1e-9, 'Fletching: +15% attack speed');
});

test('life perks: Herblore heals a share of the damage you deal', () => {
  const game = newGame();
  const n = mob(game);
  n.hp = n.maxHp = 1e6;
  game.player.hp = 1;
  game._perkCtx = null;
  game._applyPlayerHit(n, 100);
  const gearHeal = game.player.hp - 1;
  game.player.hp = 1;
  setLevel(game, 'herblore', LIFE_PERK_FULL_LEVEL);
  game._applyPlayerHit(n, 100);
  assert.equal(game.player.hp - 1 - gearHeal, Math.round(100 * (n.def?.hpScale || 1) * 8 / 100), 'Herblore: +8% lifesteal');
});

test('life perks: Farming makes area hits land harder, not damage over time', () => {
  const game = newGame();
  game._aoeCritCh = 0;   // no crits: compare plain damage
  assert.equal(game._aoeCrit(100).dmg, 100);
  setLevel(game, 'farming', LIFE_PERK_FULL_LEVEL);
  assert.equal(game._aoeCrit(100).dmg, 130, 'Farming: +30% area damage');
  assert.equal(game._aoeCrit(100, false).dmg, 100, 'an ignite tick is not an area hit');
});

test('life perks: Thieving adds a chance of an extra strike', () => {
  const game = newGame();
  const n = mob(game);
  const rand = Math.random;
  try {
    Math.random = () => 0.1;    // under Thieving's 12%, over any low-level perk chance
    const h0 = game._offensiveMods(n, 'melee').hits;
    setLevel(game, 'thieving', LIFE_PERK_FULL_LEVEL);
    const h1 = game._offensiveMods(n, 'melee').hits;
    assert.equal(h1, h0 + 1, 'Thieving: an extra strike');
    Math.random = () => 0.2;    // over it: no extra strike
    assert.equal(game._offensiveMods(n, 'melee').hits, h0);
  } finally { Math.random = rand; }
});

test('life perks: totals refresh when a life skill levels, and every 10 levels says so', () => {
  const game = newGame();
  const said = [];
  game.bus.on('chat', (p) => said.push(p.text));
  assert.equal(game.lifePerks().critDmg, 0);
  game.skills.addXp('mining', xpForLevel(10) / 20 + 1);   // addXp multiplies by XP_RATE (20)
  assert.ok(game.skills.level('mining') >= 10);
  assert.ok(game.lifePerks().critDmg > 0, 'the cached totals follow the new level');
  assert.ok(said.some((t) => /Life skill perk: your Mining now gives \+[\d.]+% crit damage/.test(t)), 'level 10 mentions the perk');
});

test('life perks: past level 1000 the chat note comes every 500 levels, and "its full strength" only at 30,000', () => {
  const game = newGame();
  const said = [];
  game.bus.on('chat', (p) => said.push(p.text));
  const note = (level) => { said.length = 0; game._lifePerkNote({ skill: 'mining', level }); return said.find((t) => t.startsWith('Life skill perk:')); };
  const at1000 = note(LIFE_PERK_MAX_LEVEL);
  assert.ok(at1000 && !at1000.includes('(its full strength)'), `1000 still grows: ${at1000}`);
  assert.match(note(1500) || '', /^Life skill perk: your Mining now gives \+[\d.]+% crit damage in combat\.$/);
  assert.equal(note(1510), undefined, 'no note between the 500s');
  assert.ok(!note(10000)?.includes('(its full strength)'), 'still growing past 9999');
  assert.ok(note(LIFE_MAX_LEVEL)?.endsWith(`gives ${lifePerkText('mining', LIFE_MAX_LEVEL)} in combat (its full strength).`), said.join(' | '));
});
