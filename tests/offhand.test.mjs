// A twin pair (the same dual-wield weapon in both hands) has a second copy with
// its own refine and enchant lines (Equipment.offRefines / offEnchants): the
// off-hand copy no longer follows the main hand. Mastery stays shared.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { xpForLevel } from '../src/data/xp.js';
import { Equipment } from '../src/game/equipment.js';
import { planCarry } from '../src/game/carry.js';
import { compareGear } from '../src/game/gear.js';
import { maxHitNow } from '../src/game/statsheet.js';
import { saveGame, loadGame } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { Game } from '../src/game/game.js';
import { SCROLL } from '../src/game/refine.js';
import { STONE } from '../src/game/mastery.js';

const SCIM = 'rune_scimitar';
const CRIT = { stat: 'crit', value: 6 };

/** A level-80 Corsair holding `main` and `off`, with an empty pack, saying things into `said`. */
function corsair(main = SCIM, off = SCIM) {
  const g = freshGame('corsair');
  for (const k of ['attack', 'strength', 'defence', 'ranged', 'hitpoints']) g.skills.xp[k] = xpForLevel(80);
  g.equipment.slots.weapon = main; g.equipment.slots.shield = off;
  g.inventory.slots = g.inventory.slots.map(() => null);
  g.said = [];
  g.msg = (m) => g.said.push(m);
  return g;
}
const slotOf = (g, id) => g.inventory.slots.findIndex((s) => s?.id === id);
function equip(g, id, opts) {
  if (slotOf(g, id) < 0) g.inventory.add(id, 1);
  g.equipItem(slotOf(g, id), opts);
}

/** One real attack with every roll at its top, catching each blow that lands. */
function attackOnce(g, npc) {
  const landed = [];
  const apply = g._applyPlayerHit;
  g._applyPlayerHit = function (n, dmg, opts) { if (n === npc) landed.push(dmg); return apply.call(this, n, dmg, opts); };
  const rnd = Math.random;
  Math.random = () => 0.9999999;
  try { g.doPlayerAttack(npc); } finally { Math.random = rnd; delete g._applyPlayerHit; }
  return landed;
}
function dummy(g) {
  const npc = g.npcs.find((n) => n.alive && n.attackable && !n.ally && !n.def.boss && !n.champion);
  npc.hp = npc.maxHp = 1e9;
  return npc;
}

test('twin scimitars refined differently hit differently, and the Stats tab agrees with real blows', () => {
  const g = corsair();
  const e = g.equipment;
  assert.ok(e.twinWorn(SCIM));
  const npc = dummy(g);
  const even = maxHitNow(g, { npc });
  // Main hand ★12, off-hand plain: only the main hand's blow grows.
  e.refines[SCIM] = 12;
  const mainUp = maxHitNow(g, { npc });
  assert.ok(mainUp.max > even.max, 'the main hand hits harder');
  assert.equal(mainUp.off, even.off, 'the off-hand copy does not follow the main hand');
  assert.ok(e.bonuses('main').strength > e.bonuses('off').strength);
  assert.deepEqual(attackOnce(g, npc), [mainUp.max, mainUp.off], 'the Stats tab matches the real blows');
  // Now the off-hand copy at ★12 and the main hand plain: the other way round.
  e.refines = {}; e.offRefines[SCIM] = 12;
  const offUp = maxHitNow(g, { npc });
  assert.equal(offUp.max, even.max);
  assert.ok(offUp.off > even.off, 'the off-hand copy\'s own refine counts for its blow');
  assert.deepEqual(attackOnce(g, npc), [offUp.max, offUp.off]);
  // The Equipment panel's per-hand max hits say the same.
  const dm = g.dualMaxHits();
  assert.ok(dm.off > 0);
  assert.equal(dm.main, offUp.base, 'the Equipment panel\'s main-hand max hit');
  // Mastery stays shared by both copies (it is earned per item type).
  e.offRefines = {};
  e.setMastery(SCIM, 5000);
  assert.ok(e.masteryRank(SCIM) > 0);
  assert.deepEqual(e.itemBonuses(SCIM, 'off'), e.itemBonuses(SCIM, 'main'));
});

test('refining or enchanting the off-hand copy leaves the main copy untouched', () => {
  const g = corsair();
  const e = g.equipment;
  e.refines[SCIM] = 7; e.enchants[SCIM] = [{ ...CRIT }];
  g.inventory.add(SCROLL, 20); g.inventory.add(STONE, 100); g.inventory.add('coins', 1e6);
  for (let i = 0; i < 3; i++) assert.equal(g.refineItem(SCIM, 0, 'off'), 'success');
  assert.equal(e.refineLevel(SCIM, 'off'), 3);
  assert.equal(e.refineLevel(SCIM), 7, 'the main copy keeps its ★7');
  assert.equal(g.inventory.count(SCROLL), 17, 'the off-hand copy pays its own scrolls (one a level to ★5)');
  // Enchanting: its own offer, its own lines, its own (first-line) price.
  const c = g.enchantCostFor(SCIM, 'off');
  assert.ok(c.stones < g.enchantCostFor(SCIM).stones || c.coins < g.enchantCostFor(SCIM).coins, 'priced on the off-hand copy\'s own lines');
  const offer = { ...g.enchantOffers(SCIM, 'off')[0] };
  assert.deepEqual(g.pickEnchant(SCIM, 0, null, 'off'), offer);
  assert.deepEqual(e.enchantLines(SCIM, 'off'), [offer]);
  assert.deepEqual(e.enchantLines(SCIM), [CRIT], 'the main copy keeps its lines');
  // And the other way: refining the main copy leaves the off-hand copy alone.
  g.refineItem(SCIM, 0);
  assert.equal(e.refineLevel(SCIM), 8);
  assert.equal(e.refineLevel(SCIM, 'off'), 3);
  // The off-hand copy can only be worked on while the pair is worn.
  g.unequip('shield');
  assert.equal(g.refineItem(SCIM, 0, 'off'), null);
  assert.equal(g.pickEnchant(SCIM, 0, null, 'off'), null);
  assert.equal(e.refineLevel(SCIM, 'off'), 3, 'and its record waits for the pair to come back');
});

test('a broken copy of a twin pair: the survivor keeps its own upgrades', () => {
  // The off-hand copy breaks: it goes, and only its refine resets.
  const g = corsair();
  const e = g.equipment;
  g.inventory.add(SCROLL, 20);
  e.refines[SCIM] = 9; e.offRefines[SCIM] = 14; e.offEnchants[SCIM] = [{ ...CRIT }];
  assert.equal(g.refineItem(SCIM, 0.995, 'off'), 'broken');
  assert.equal(e.get('shield'), null);
  assert.equal(e.get('weapon'), SCIM);
  assert.equal(e.refineLevel(SCIM), 9, 'the main copy is untouched');
  assert.equal(e.refineLevel(SCIM, 'off'), 0);
  // The main copy breaks: the off-hand copy survives, moves to the main hand
  // with its own ★ and lines, and the broken copy's lines wait in the second record.
  const h = corsair();
  const f = h.equipment;
  h.inventory.add(SCROLL, 20);
  f.refines[SCIM] = 14; f.enchants[SCIM] = [{ stat: 'haste', value: 2 }];
  f.offRefines[SCIM] = 5; f.offEnchants[SCIM] = [{ ...CRIT }];
  assert.equal(h.refineItem(SCIM, 0.995), 'broken');
  assert.equal(f.get('weapon'), SCIM); assert.equal(f.get('shield'), null);
  assert.equal(f.refineLevel(SCIM), 5);
  assert.deepEqual(f.enchantLines(SCIM), [CRIT]);
  assert.equal(f.refineLevel(SCIM, 'off'), 0);
  assert.deepEqual(f.enchantLines(SCIM, 'off'), [{ stat: 'haste', value: 2 }]);
});

test('save round-trip keeps each copy\'s upgrades, and an older save loads as before', () => {
  const g = corsair();
  const e = g.equipment;
  e.refines[SCIM] = 8; e.enchants[SCIM] = [{ ...CRIT }];
  e.offRefines[SCIM] = 3; e.offEnchants[SCIM] = [{ stat: 'bossDmg', value: 4 }];
  assert.ok(saveGame(g));
  const g2 = new Game(); g2.start();
  assert.ok(loadGame(g2));
  assert.equal(g2.equipment.refineLevel(SCIM), 8);
  assert.equal(g2.equipment.refineLevel(SCIM, 'off'), 3);
  assert.deepEqual(g2.equipment.enchantLines(SCIM), [CRIT]);
  assert.deepEqual(g2.equipment.enchantLines(SCIM, 'off'), [{ stat: 'bossDmg', value: 4 }]);
  assert.ok(g2.equipment.bonuses('main').strength > g2.equipment.bonuses('off').strength);
  // A save from before the off-hand records: the pair shares the main record as
  // it used to show, and the off-hand copy simply starts plain.
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete raw.equipment._offRefines; delete raw.equipment._offEnchants;
  localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  const g3 = new Game(); g3.start();
  assert.ok(loadGame(g3), 'an older save still loads');
  assert.equal(g3.equipment.refineLevel(SCIM), 8);
  assert.deepEqual(g3.equipment.offRefines, {});
  assert.deepEqual(g3.equipment.offEnchants, {});
  // Bad rows are dropped like any other record's.
  const x = new Equipment();
  x.load({ _mastery: {}, _offRefines: { [SCIM]: 99, nope: 3, iron_scimitar: -1 }, _offEnchants: { [SCIM]: [{ stat: 'nope', value: 3 }, CRIT] } });
  assert.deepEqual(x.offRefines, { [SCIM]: 15 });
  assert.deepEqual(x.offEnchants, { [SCIM]: [CRIT] });
});

test('swapping hands, unequipping and re-equipping never copy upgrades between the copies', () => {
  const g = corsair();
  const e = g.equipment;
  e.refines[SCIM] = 8; e.enchants[SCIM] = [{ ...CRIT }];
  e.offRefines[SCIM] = 3; e.offEnchants[SCIM] = [{ stat: 'bossDmg', value: 4 }];
  const snap = () => JSON.stringify([e.refines, e.enchants, e.offRefines, e.offEnchants]);
  const start = snap();
  g.inventory.add('mithril_scimitar', 1);
  // Off-hand off and on again; main hand off and on again; another scimitar in
  // each hand and back. Every record is where it started each time.
  g.unequip('shield'); equip(g, SCIM, { offhand: true });
  assert.ok(e.twinWorn(SCIM)); assert.equal(snap(), start);
  g.unequip('weapon'); assert.equal(e.copyIn('shield'), 'main', 'a lone copy reads the main record');
  equip(g, SCIM); assert.ok(e.twinWorn(SCIM)); assert.equal(snap(), start);
  equip(g, 'mithril_scimitar');   // a worse main hand: nothing moves
  assert.equal(e.get('shield'), SCIM); assert.equal(snap(), start);
  assert.equal(e.itemBonuses(SCIM, e.copyIn('shield')).strength, e.itemBonuses(SCIM).strength, 'the lone off-hand copy reads the main record');
  equip(g, SCIM); assert.ok(e.twinWorn(SCIM)); assert.equal(snap(), start);
  equip(g, 'mithril_scimitar', { offhand: true }); assert.equal(snap(), start);
  equip(g, SCIM, { offhand: true }); assert.ok(e.twinWorn(SCIM)); assert.equal(snap(), start);
  assert.equal(e.refineLevel(SCIM, e.copyIn('shield')), 3, 'the off-hand copy\'s ★3 is back with the pair');
});

test('carrying over works per hand', () => {
  // A twin of the main weapon going into the off-hand takes the carry into the
  // off-hand record; the main copy's record is untouched.
  const g = corsair(SCIM, 'adamant_scimitar');
  const e = g.equipment;
  e.refines[SCIM] = 9; e.refines.adamant_scimitar = 6; e.enchants.adamant_scimitar = [{ ...CRIT }];
  equip(g, SCIM, { offhand: true });
  assert.ok(e.twinWorn(SCIM));
  assert.equal(e.refineLevel(SCIM), 9, 'the main copy keeps its own');
  assert.equal(e.refineLevel(SCIM, 'off'), 6);
  assert.deepEqual(e.enchantLines(SCIM, 'off'), [CRIT]);
  assert.equal(e.refineLevel('adamant_scimitar'), 0);
  // Replacing the off-hand copy of a twin carries from the off-hand record...
  equip(g, 'dragon_scimitar', { offhand: true });
  assert.equal(e.get('shield'), 'dragon_scimitar');
  assert.equal(e.refineLevel('dragon_scimitar'), 6);
  assert.deepEqual(e.enchantLines('dragon_scimitar'), [CRIT]);
  assert.equal(e.refineLevel(SCIM, 'off'), 0, 'moved, not copied');
  assert.equal(e.refineLevel(SCIM), 9, 'the main hand\'s record stays');
  // ...while replacing the main copy carries nothing: the copy left in the
  // off-hand goes on reading the main record.
  const h = corsair();
  h.equipment.refines[SCIM] = 7; h.equipment.offRefines[SCIM] = 2;
  assert.equal(planCarry(h.equipment, 'dragon_scimitar', 'weapon'), null);
  // An off-hand candidate is weighed against the worn off-hand copy's own record.
  const k = corsair();
  k.equipment.refines[SCIM] = 15;
  assert.equal(compareGear('dragon_scimitar', k.equipment, 'shield').verdict, 'upgrade', 'the plain off-hand copy is the one compared');
});

test('Equip best weighs a twin off-hand by its own record', () => {
  const g = corsair(SCIM, 'adamant_scimitar');
  const e = g.equipment;
  e.offRefines[SCIM] = 15;     // the second rune copy is heavily refined
  e.refines.adamant_scimitar = 0;
  g.inventory.add(SCIM, 1);
  g.equipBest();
  assert.equal(e.get('shield'), SCIM, 'the refined second copy goes in the off-hand');
  assert.equal(e.refineLevel(SCIM, e.copyIn('shield')), 15);
});
