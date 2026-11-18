// Carrying upgrades over (src/game/carry.js): putting a better piece into a
// slot moves the old piece's refine (up to ★10) and enchantments onto it.
// Moved, not copied, so swapping back and forth never makes more of anything.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { xpForLevel } from '../src/data/xp.js';
import { Equipment } from '../src/game/equipment.js';
import { planCarry, applyCarry, carrySummary, CARRY_CAP } from '../src/game/carry.js';
import { saveGame, loadGame } from '../src/game/save.js';
import { Game } from '../src/game/game.js';

const CRIT = { stat: 'crit', value: 6 };

/** A level-80 hero of `cls` wearing `main` (and `off` in the off-hand), with an empty pack, saying things into `said`. */
function hero(cls, main, off = null) {
  const g = freshGame(cls);
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
const totalRefine = (e) => Object.values(e.refines).reduce((s, v) => s + v, 0);
const totalLines = (e) => Object.values(e.enchants).reduce((s, l) => s + l.length, 0);

test('a better weapon takes the old one\'s refine and enchant, and says so', () => {
  const g = hero('swordsman', 'iron_sword');
  g.equipment.refines.iron_sword = 8;
  g.equipment.enchants.iron_sword = [{ ...CRIT }];
  equip(g, 'rune_sword');
  const e = g.equipment;
  assert.equal(e.get('weapon'), 'rune_sword');
  assert.equal(e.refineLevel('rune_sword'), 8);
  assert.deepEqual(e.enchantLines('rune_sword'), [CRIT]);
  // Moved, not copied: the old sword is stripped of what went across.
  assert.equal(e.refineLevel('iron_sword'), 0);
  assert.deepEqual(e.enchantLines('iron_sword'), []);
  assert.ok(g.said.includes('Your ★8 refine and +6% crit chance enchant carry over to your rune sword.'), g.said.join(' | '));
  assert.equal(g.inventory.count('iron_sword'), 1, 'the old sword is back in the pack');
});

test('at most ★10 moves; the rest stays behind, and a refined new piece trades levels', () => {
  const g = hero('swordsman', 'iron_sword');
  g.equipment.refines.iron_sword = 12;
  equip(g, 'rune_sword');
  assert.equal(g.equipment.refineLevel('rune_sword'), CARRY_CAP);
  assert.equal(g.equipment.refineLevel('iron_sword'), 2, 'the two levels above ★10 stay on the old piece');
  assert.ok(g.said.includes('Your iron sword keeps ★2.'), g.said.join(' | '));

  const h = hero('swordsman', 'iron_sword');
  h.equipment.refines.iron_sword = 12;
  h.equipment.refines.rune_sword = 3;
  equip(h, 'rune_sword');
  assert.equal(h.equipment.refineLevel('rune_sword'), 10);
  assert.equal(h.equipment.refineLevel('iron_sword'), 5, 'its own ★3 plus the ★2 left over');

  // Nothing moves when the new piece is already refined as high.
  const k = hero('swordsman', 'iron_sword');
  k.equipment.refines.iron_sword = 6;
  k.equipment.refines.rune_sword = 7;
  equip(k, 'rune_sword');
  assert.equal(k.equipment.refineLevel('rune_sword'), 7);
  assert.equal(k.equipment.refineLevel('iron_sword'), 6);
});

test('a worse piece, an empty slot or another weapon style takes nothing', () => {
  const g = hero('swordsman', 'rune_sword');
  g.equipment.refines.rune_sword = 8;
  g.equipment.enchants.rune_sword = [{ ...CRIT }];
  equip(g, 'iron_sword');
  assert.equal(g.equipment.get('weapon'), 'iron_sword');
  assert.equal(g.equipment.refineLevel('rune_sword'), 8, 'a downgrade leaves the upgrades where they are');
  assert.equal(g.equipment.refineLevel('iron_sword'), 0);
  assert.equal(g.equipment.enchantLines('rune_sword').length, 1);
  assert.ok(!g.said.some((m) => /carr(y|ies) over/.test(m)));
  // An empty slot: nothing to carry from.
  g.unequip('weapon');
  equip(g, 'rune_sword');
  assert.equal(g.equipment.refineLevel('rune_sword'), 8);
  // A pistol over a scimitar is another style: no carry, even though it rates higher.
  const e = new Equipment();
  e.slots.weapon = 'iron_scimitar'; e.refines.iron_scimitar = 5;
  assert.equal(planCarry(e, 'rune_pistol', 'weapon'), null);
  // A shield is not a weapon: an off-hand weapon never takes a shield's upgrades.
  e.slots.shield = 'steel_kiteshield'; e.refines.steel_kiteshield = 5;
  assert.equal(planCarry(e, 'rune_scimitar', 'shield'), null);
});

test('swapping back and forth never multiplies refines or enchants', () => {
  const g = hero('swordsman', 'iron_sword');
  const e = g.equipment;
  e.refines.iron_sword = 12; e.refines.rune_sword = 4;
  e.enchants.iron_sword = [{ ...CRIT }, { stat: 'haste', value: 2 }];
  e.enchants.rune_sword = [{ stat: 'bossDmg', value: 4 }];
  const refs = totalRefine(e), lines = totalLines(e);
  for (let i = 0; i < 12; i++) {
    equip(g, i % 2 ? 'iron_sword' : 'rune_sword');
    assert.equal(totalRefine(e), refs, `refine levels after swap ${i + 1}`);
    assert.equal(totalLines(e), lines, `enchant lines after swap ${i + 1}`);
    assert.ok(e.refineLevel('rune_sword') <= 12 && e.refineLevel('iron_sword') <= 12);
  }
  assert.equal(e.refineLevel('rune_sword'), 10);
  assert.equal(e.refineLevel('iron_sword'), 6);
});

test('enchant lines the new piece can\'t roll stay behind, and the move is named in chat', () => {
  const e = new Equipment();
  e.slots.amulet = 'sapphire_amulet';   // a magic amulet: Magic bonus lines
  e.enchants.sapphire_amulet = [{ stat: 'magPct', value: 3 }, { ...CRIT }];
  const plan = planCarry(e, 'ruby_amulet', 'amulet');   // a melee amulet: Physical damage bonus lines
  assert.ok(plan);
  assert.deepEqual(plan.enchants.moved, [CRIT]);
  assert.deepEqual(plan.enchants.skipped, [{ stat: 'magPct', value: 3 }]);
  applyCarry(e, plan);
  assert.deepEqual(e.enchantLines('ruby_amulet'), [CRIT]);
  assert.deepEqual(e.enchantLines('sapphire_amulet'), [{ stat: 'magPct', value: 3 }]);
  // Better lines on the new piece are kept (nothing moves); weaker ones are traded.
  const f = new Equipment();
  f.slots.amulet = 'sapphire_amulet';
  f.enchants.sapphire_amulet = [{ stat: 'crit', value: 1 }];
  f.enchants.ruby_amulet = [{ stat: 'crit', value: 5 }];
  assert.equal(planCarry(f, 'ruby_amulet', 'amulet'), null);
  f.enchants.sapphire_amulet = [{ stat: 'crit', value: 9 }];
  applyCarry(f, planCarry(f, 'ruby_amulet', 'amulet'));
  assert.deepEqual(f.enchantLines('ruby_amulet'), [{ stat: 'crit', value: 9 }]);
  assert.deepEqual(f.enchantLines('sapphire_amulet'), [{ stat: 'crit', value: 5 }]);
  // Mastery belongs to the gear type (every amulet shares Amulet mastery), so
  // there is nothing to move; quality stays with its own copy.
  const m = new Equipment();
  m.set('amulet', 'sapphire_amulet', 'epic'); m.setMastery('sapphire_amulet', 9000); m.refines.sapphire_amulet = 3;
  const mp = planCarry(m, 'ruby_amulet', 'amulet');
  assert.ok(mp?.refine, 'the refine still carries');
  applyCarry(m, mp);
  assert.equal(m.masteryPoints('ruby_amulet'), 9000, 'one Amulet mastery for both');
  assert.equal(m.masteryPoints('sapphire_amulet'), 9000);
  assert.equal(m.qualityIn('amulet'), 'epic', 'the carry never moves quality');
});

test('the tooltip preview names what would carry over', () => {
  const e = new Equipment();
  e.slots.weapon = 'iron_scimitar'; e.refines.iron_scimitar = 8; e.enchants.iron_scimitar = [{ ...CRIT }];
  assert.equal(carrySummary(planCarry(e, 'rune_scimitar', 'weapon')), '★8 refine and +6% crit chance enchant');
});

test('dual wielding: each hand carries on its own, and not while the old type is in the other hand', () => {
  // The off-hand's scimitar passes its upgrades to a better off-hand scimitar; the main hand is untouched.
  const g = hero('corsair', 'rune_scimitar', 'iron_scimitar');
  g.equipment.refines.iron_scimitar = 6;
  g.equipment.enchants.iron_scimitar = [{ ...CRIT }];
  equip(g, 'adamant_scimitar', { offhand: true });
  assert.equal(g.equipment.get('shield'), 'adamant_scimitar');
  assert.equal(g.equipment.refineLevel('adamant_scimitar'), 6);
  assert.deepEqual(g.equipment.enchantLines('adamant_scimitar'), [CRIT]);
  assert.equal(g.equipment.refineLevel('rune_scimitar'), 0, 'the main hand gains nothing');

  // A pair of iron scimitars: replacing one leaves the upgrades with the other (they share them)...
  const h = hero('corsair', 'iron_scimitar', 'iron_scimitar');
  h.equipment.refines.iron_scimitar = 5;
  equip(h, 'rune_scimitar');
  assert.equal(h.equipment.get('weapon'), 'rune_scimitar');
  assert.equal(h.equipment.refineLevel('iron_scimitar'), 5, 'still in use in the off-hand');
  assert.equal(h.equipment.refineLevel('rune_scimitar'), 0);
  // ...and replacing the second one carries them over.
  equip(h, 'mithril_scimitar', { offhand: true });
  assert.equal(h.equipment.get('shield'), 'mithril_scimitar');
  assert.equal(h.equipment.refineLevel('mithril_scimitar'), 5);
  assert.equal(h.equipment.refineLevel('iron_scimitar'), 0);
});

test('Equip best carries upgrades over too', () => {
  const g = hero('swordsman', 'iron_sword');
  g.equipment.refines.iron_sword = 8;
  g.equipment.enchants.iron_sword = [{ ...CRIT }];
  g.inventory.add('rune_sword', 1);
  g.equipBest();
  assert.equal(g.equipment.get('weapon'), 'rune_sword');
  assert.equal(g.equipment.refineLevel('rune_sword'), 8);
  assert.deepEqual(g.equipment.enchantLines('rune_sword'), [CRIT]);
  assert.equal(g.equipment.refineLevel('iron_sword'), 0);
  assert.equal(g.equipBest(), 0, 'and it doesn\'t swap back');
});

test('a save from before carrying loads, and carrying works on it', () => {
  const g = hero('swordsman', 'iron_sword');
  g.equipment.refines.iron_sword = 9;
  g.equipment.enchants.iron_sword = [{ ...CRIT }];
  assert.ok(saveGame(g));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  g2.ui = new Proxy({}, { get: () => () => {} });
  g2.msg = () => {};
  assert.equal(g2.equipment.refineLevel('iron_sword'), 9);
  g2.inventory.slots = g2.inventory.slots.map(() => null);
  g2.inventory.add('rune_sword', 1);
  g2.equipItem(slotOf(g2, 'rune_sword'));
  assert.equal(g2.equipment.refineLevel('rune_sword'), 9);
  assert.deepEqual(g2.equipment.enchantLines('rune_sword'), [CRIT]);
  // An older equipment block (no quality tally, no refines) loads as before.
  const e = new Equipment();
  e.load({ weapon: 'iron_scimitar', _mastery: {}, _enchants: { iron_scimitar: [CRIT] } });
  assert.equal(e.get('weapon'), 'iron_scimitar');
  assert.deepEqual(e.enchantLines('iron_scimitar'), [CRIT]);
});
