// Dual wielding: each hand strikes with its own weapon. The main hand's blow
// uses the main weapon's stats, the off-hand's the off-hand weapon's (at
// OFFHAND_SHARE), each with its own crit roll and on-hit effects; armour,
// accessories and perks count for both, and both weapons share their type's mastery.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { killMastery } from '../src/game/mastery.js';

import { freshGame } from '../tools/balance/common.mjs';
import { NPC } from '../src/game/npc.js';
import { xpForLevel } from '../src/data/xp.js';
import { getItem } from '../src/data/items.js';

/** A Corsair (or Pistoler) at level 80 holding `main` and `off`, next to a frozen huge-life dummy. */
function duel(cls, main, off) {
  const g = freshGame(cls);
  const x = xpForLevel(80);
  for (const k of ['attack', 'ranged', 'defence', 'hitpoints']) g.skills.xp[k] = x;
  g.equipment.slots.weapon = main; g.equipment.slots.shield = off;
  const p = g.player;
  const t = new NPC('goblin', p.x + 1, p.y, 0, { aggressive: false });
  t.maxHp = t.hp = 1e9; t.tick = () => {};
  g.npcs = [t];
  return { g, t };
}

/** Swing `n` times, recording each landed blow by the hand that struck it. */
function swings(g, t, n) {
  const out = { main: [], off: [], offCrits: 0 };
  const apply = g._applyPlayerHit.bind(g);
  g._applyPlayerHit = (npc, dmg, opts = {}) => {
    if (npc === t && g._hand) { out[g._hand].push(dmg); if (g._hand === 'off' && g._pendingCrit > 0 && dmg > 0) out.offCrits++; }
    return apply(npc, dmg, opts);
  };
  for (let i = 0; i < n; i++) { g.player.attackCooldown = 0; g.doPlayerAttack(t); }
  g._applyPlayerHit = apply;
  return out;
}
const sum = (xs) => xs.reduce((s, v) => s + v, 0);

test('each hand counts only its own weapon; both weapons count for Defence and the panel totals', () => {
  const { g } = duel('corsair', 'rune_scimitar', 'iron_scimitar');
  const eq = g.equipment, all = eq.bonuses(), main = eq.bonuses('main'), off = eq.bonuses('off');
  const rune = getItem('rune_scimitar').equip.bonuses, iron = getItem('iron_scimitar').equip.bonuses;
  assert.equal(all.strength - main.strength, iron.strength, 'the main hand leaves out the off-hand scimitar');
  assert.equal(all.strength - off.strength, rune.strength, 'the off-hand leaves out the main scimitar');
  assert.equal(all.lifesteal, main.lifesteal + iron.lifesteal);
  // Not dual wielding: a hand makes no difference.
  eq.slots.shield = null;
  assert.deepEqual(eq.bonuses('main'), eq.bonuses());
});

test('a better off-hand weapon hits harder, and the main hand is untouched by it', () => {
  const runs = {};
  for (const off of ['iron_scimitar', 'rune_scimitar']) {
    const { g, t } = duel('corsair', 'rune_scimitar', off);
    runs[off] = { ...swings(g, t, 200), max: g.dualMaxHits() };
  }
  const weak = runs.iron_scimitar, strong = runs.rune_scimitar;
  assert.equal(strong.off.length, 200, 'one off-hand blow a swing');
  assert.ok(sum(strong.off) > sum(weak.off) * 1.15, `rune off-hand ${sum(strong.off)} vs iron ${sum(weak.off)}`);
  assert.ok(strong.max.off > weak.max.off, 'the Equipment panel shows the off-hand max hit rise');
  assert.equal(strong.max.main, weak.max.main, 'the main hand max hit does not change with the off-hand');
  // A matched pair: the off-hand lands about OFFHAND_SHARE of the main hand.
  const ratio = sum(strong.off) / sum(strong.main);
  assert.ok(ratio > 0.45 && ratio < 0.75, `off-hand at ${ratio.toFixed(2)} of the main hand`);
});

test('the off-hand weapon\'s own refining raises its hit; Scimitar mastery raises both', () => {
  const { g } = duel('corsair', 'rune_scimitar', 'adamant_scimitar');
  const before = g.dualMaxHits();
  g.equipment.refines.adamant_scimitar = 10;
  const refined = g.dualMaxHits();
  assert.ok(refined.off > before.off, `refined off-hand ${refined.off} vs plain ${before.off}`);
  assert.equal(refined.main, before.main);
  // Mastery belongs to the gear type: both scimitars share it.
  g.equipment.setMastery('adamant_scimitar', 1e6);
  const after = g.dualMaxHits();
  assert.ok(after.off > refined.off && after.main > refined.main, JSON.stringify({ refined, after }));
});

test('the off-hand rolls its own crits', () => {
  const { g, t } = duel('corsair', 'rune_scimitar', 'rune_scimitar');
  g.equipment.extra = () => ({ crit: 50 });
  const r = swings(g, t, 100);
  assert.ok(r.offCrits >= 20, `${r.offCrits} off-hand crits in 100 swings at 50%+ crit chance`);
});

test('dual pistols: each gun fires its own shot with its own stats', () => {
  const runs = {};
  for (const off of ['iron_pistol', 'rune_pistol']) {
    const { g, t } = duel('pistoler', 'rune_pistol', off);
    g.equipment.setAmmo(null, 0);   // the guns alone: loaded rounds add the same to both hands (rounds.js)
    runs[off] = { ...swings(g, t, 200), max: g.dualMaxHits() };
  }
  assert.equal(runs.rune_pistol.off.length, 200, 'the off-hand gun fires every attack');
  assert.ok(sum(runs.rune_pistol.off) > sum(runs.iron_pistol.off) * 1.15, `rune ${sum(runs.rune_pistol.off)} vs iron ${sum(runs.iron_pistol.off)}`);
  assert.ok(runs.rune_pistol.max.off > runs.iron_pistol.max.off);
  assert.equal(runs.rune_pistol.max.main, runs.iron_pistol.max.main);
});

test('both weapons gain mastery from a kill', () => {
  const { g, t } = duel('corsair', 'rune_scimitar', 'iron_scimitar');
  g._gainMastery(t);
  assert.ok(g.equipment.masteryPoints('rune_scimitar') > 0, 'main hand');
  assert.ok(g.equipment.masteryPoints('iron_scimitar') > 0, 'off-hand');
  assert.equal(g.equipment.masteryPoints('rune_scimitar'), g.equipment.masteryPoints('iron_scimitar'), 'one Scimitar mastery');
  assert.equal(g.equipment.masteryXp('rune_scimitar'), killMastery(t), 'trained once for the pair, not twice (one kill\'s mastery XP)');
});

test('a better off-hand says Upgrade, and Equip best fills the off-hand by its own stats', () => {
  const { g } = duel('corsair', 'rune_scimitar', 'iron_scimitar');
  const said = [];
  g.msg = (m) => said.push(m);
  g.inventory.slots = g.inventory.slots.map(() => null);
  g.inventory.add('adamant_scimitar', 1);
  g.equipOffhand(g.inventory.slots.findIndex((s) => s?.id === 'adamant_scimitar'));
  assert.equal(g.equipment.get('shield'), 'adamant_scimitar');
  assert.ok(said.some((m) => /^Upgrade!.*off-hand iron scimitar/.test(m)), said.join(' | '));
  // Equip best: the strongest spare scimitar goes in the off-hand.
  g.inventory.add('mithril_scimitar', 1); g.inventory.add('rune_scimitar', 1);
  g.equipBest();
  assert.equal(g.equipment.get('weapon'), 'rune_scimitar');
  assert.equal(g.equipment.get('shield'), 'rune_scimitar');
});

test('Equip best weighs an off-hand weapon at the main hand\'s beat, the beat it strikes on', async () => {
  const { effectiveParts, swingBeats } = await import('../src/game/gear.js');
  const g = freshGame('corsair');
  const id = 'rune_scimitar', beats = swingBeats(id);
  const at = (b) => effectiveParts(id, g.equipment, 'melee', 'main', null, b).offence;
  assert.equal(at(beats), effectiveParts(id, g.equipment, 'melee').offence, 'at its own beat, as before');
  assert.ok(at(beats / 2) > at(beats) * 1.5, 'twice the swings, about twice the damage per beat');
});
