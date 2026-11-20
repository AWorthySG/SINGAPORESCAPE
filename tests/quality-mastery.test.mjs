// Gear quality and gear mastery as two separate systems:
//   mastery  belongs to a gear type (every sword shares Sword mastery, every
//            plate body Plate body mastery, every ring Ring mastery), rises
//            from kills while worn and from sacrificing gear of that type;
//   quality  belongs to one copy (Fine .. Mythic), multiplies that copy's
//            stats, and goes wherever the copy goes (pack, bank, worn, ground).
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { xpForLevel } from '../src/data/xp.js';
import { Equipment } from '../src/game/equipment.js';
import { masteryType, masteryTypeName, MASTERY_RANKS, qualityBonuses } from '../src/game/mastery.js';
import { QUALITY, qualityName } from '../src/game/loot.js';
import { sacrificeXp, sacrificeGear } from '../src/game/salvage.js';
import { offenceFirstScore } from '../src/game/gear.js';
import { saveGame, loadGame } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { Game } from '../src/game/game.js';

/** A level-300 swordsman (can wear anything of his class) with an empty pack. */
function hero(cls = 'swordsman') {
  const g = freshGame(cls);
  for (const k of ['attack', 'strength', 'defence', 'ranged', 'magic', 'hitpoints']) g.skills.xp[k] = xpForLevel(300);
  g.inventory.slots = g.inventory.slots.map(() => null);
  g.said = [];
  g.msg = (m) => g.said.push(m);
  return g;
}
const slotOf = (g, id, q = null) => g.inventory.slots.findIndex((s) => s?.id === id && (s.q || null) === q);
const reload = (g) => { saveGame(g); const g2 = new Game(); g2.start(); loadGame(g2); g2.ui = new Proxy({}, { get: () => () => {} }); return g2; };

test('mastery belongs to the gear type: weapon type, slot and armour family, or the slot alone', () => {
  assert.equal(masteryType('iron_sword'), masteryType('rune_sword'));
  assert.equal(masteryType('iron_sword'), 'weapon:sword');
  assert.notEqual(masteryType('iron_sword'), masteryType('iron_scimitar'));
  assert.equal(masteryType('bronze_platebody'), masteryType('rune_platebody'));
  assert.notEqual(masteryType('rune_platebody'), masteryType('rune_platelegs'), 'another slot');
  assert.notEqual(masteryType('rune_platebody'), masteryType('leather_body'), 'another family');
  assert.equal(masteryType('gold_ring'), masteryType('emerald_ring'));
  assert.deepEqual(['iron_sword', 'rune_platebody', 'gold_ring', 'staff', 'bronze_axe'].map(masteryTypeName),
    ['Sword', 'Plate body', 'Ring', 'Staff', 'Tool']);
  // Read and written through any item of the type.
  const e = new Equipment();
  e.setMastery('iron_sword', MASTERY_RANKS[3].xp);
  assert.equal(e.masteryRank('rune_sword'), 3, 'a higher tier keeps the mastery earned');
  assert.equal(e.masteryRank('rune_scimitar'), 0);
  // Ranks and gains are unchanged: Legendary is +140%.
  assert.equal(MASTERY_RANKS[6].gain, 1.4);
});

test('kills train each worn gear type once, and only worn types; quality drops never touch mastery', () => {
  const g = hero('corsair');
  g.equipment.set('weapon', 'rune_scimitar'); g.equipment.set('shield', 'iron_scimitar');
  // Mastery XP (mastery.js killMastery): 10 a level 1 monster, x250 a world boss, x5 a champion.
  g._gainMastery({ def: { boss: true, level: 1 } });
  assert.equal(g.equipment.masteryXp('mithril_scimitar'), 2506, 'a world boss: 2,506 to Scimitar mastery, once for the pair');
  g._gainMastery({ champion: true, def: { level: 1 } });
  assert.equal(g.equipment.masteryXp('rune_scimitar'), 2506 + 50, 'a champion: 50');
  assert.equal(g.equipment.masteryPoints('gold_ring'), 0, 'no ring worn');
  // A boss's drops arrive with quality, but mastery stays where it was.
  let loot = [];
  g._autoLoot = (l) => { loot = l; };
  const before = { ...g.equipment.mastery };
  g.rollDrops(g.npcs.find((n) => n.def.boss && !n.def.fixed));
  assert.ok(loot.some((l) => QUALITY[l[3]]), 'quality copies dropped');
  assert.deepEqual(g.equipment.mastery, before);
  assert.ok(g.said.some((m) => /^(Superior|Epic|Legendary|Mythic) .*! A \w+ copy: \+\d+% to its stats\./.test(m)), g.said.join('\n'));
});

test('sacrifice feeds the same gear type only', () => {
  const g = hero();
  const w = g.equipment.get('weapon');
  g.inventory.add('rune_platebody', 1); g.inventory.add('mithril_sword', 1, 'epic');
  assert.equal(sacrificeXp(w, 'rune_platebody'), 0);
  assert.equal(sacrificeGear(g, w, 'rune_platebody', 1), 0, 'a plate body is not a sword');
  const pts = sacrificeGear(g, w, 'mithril_sword', 1);
  assert.equal(pts, sacrificeXp(w, 'mithril_sword', 'epic'), 'the Epic copy is worth its quality');
  assert.ok(pts > sacrificeXp(w, 'mithril_sword', 'plain'));
  assert.equal(g.equipment.masteryPoints('rune_sword'), pts);
});

test('quality multiplies the copy\'s stats: +8% to +60%, on top of mastery', () => {
  const gains = Object.fromEntries(Object.entries(QUALITY).map(([k, v]) => [k, v.gain]));
  assert.deepEqual(gains, { fine: 0.08, superior: 0.16, epic: 0.25, legendary: 0.4, mythic: 0.6 });
  const e = new Equipment();
  const base = e.itemBonuses('rune_sword');
  const leg = e.itemBonuses('rune_sword', 'main', 'legendary');
  for (const k of ['attack', 'strength']) assert.equal(leg[k], Math.round(base[k] * 1.4), k);
  assert.equal(leg.speed, base.speed, 'speed never changes');
  assert.ok(e.itemBonuses('rune_sword', 'main', 'fine').attack > base.attack);
  // Multiplied with mastery: Grandmaster (+100%) and Mythic (+60%).
  e.setMastery('rune_sword', MASTERY_RANKS[5].xp);
  const gm = e.itemBonuses('rune_sword'), both = e.itemBonuses('rune_sword', 'main', 'mythic');
  assert.equal(both.attack, Math.round(gm.attack * 1.6));
  assert.deepEqual(qualityBonuses({ attack: 2 }, { attack: 2 }, 'fine'), { attack: 3 }, 'at least +1');
  // A worn copy's quality counts in your bonuses.
  e.set('weapon', 'rune_sword');
  const plainAtk = e.bonuses().attack;
  e.set('weapon', 'rune_sword', 'mythic');
  assert.equal(e.qualityIn('weapon'), 'mythic');
  assert.equal(e.bonuses().attack - plainAtk, both.attack - gm.attack);
  assert.equal(qualityName('rune_sword', 'legendary'), 'Legendary Rune sword');
  assert.equal(qualityName('rune_sword', null), 'Rune sword');
});

test('a copy keeps its quality through the pack, bank, equip and unequip, the ground, and save/load', () => {
  const g = hero();
  g.inventory.add('rune_sword', 1);
  g.inventory.add('rune_sword', 1, 'legendary');
  assert.equal(g.inventory.slots.filter((s) => s?.id === 'rune_sword').length, 2, 'qualities never stack together');
  // Bank and back.
  g.deposit('rune_sword', 1, 'legendary');
  assert.deepEqual(g.inventory.qualities('rune_sword'), [null]);
  assert.deepEqual(g.bank.items.find((e) => e.id === 'rune_sword'), { id: 'rune_sword', qty: 1, q: 'legendary' });
  g.depositAll();
  assert.equal(g.bank.count('rune_sword'), 2);
  g.withdraw('rune_sword', 1, 'legendary');
  assert.deepEqual(g.inventory.qualities('rune_sword'), ['legendary']);
  // Equip and unequip.
  g.equipItem(slotOf(g, 'rune_sword', 'legendary'));
  assert.equal(g.equipment.get('weapon'), 'rune_sword');
  assert.equal(g.equipment.qualityIn('weapon'), 'legendary');
  assert.equal(g.inventory.count('rune_sword'), 0);
  // Save and load: the worn copy, the bank's plain copy.
  const g2 = reload(g);
  assert.equal(g2.equipment.qualityIn('weapon'), 'legendary');
  assert.deepEqual(g2.bank.items.filter((e) => e.id === 'rune_sword'), [{ id: 'rune_sword', qty: 1 }]);
  g2.unequip('weapon');
  assert.deepEqual(g2.inventory.qualities('rune_sword'), ['legendary']);
  assert.equal(g2.equipment.qualityIn('weapon'), null);
  // Dropped on the ground and picked up again.
  g2.dropItem(slotOf(g2, 'rune_sword', 'legendary'));
  const gi = g2.world.groundItems.find((x) => x.id === 'rune_sword');
  assert.equal(gi.q, 'legendary');
  g2.doPickup(gi);
  assert.deepEqual(g2.inventory.qualities('rune_sword'), ['legendary']);
  // Sorting keeps the copies apart.
  g2.inventory.add('rune_sword', 2);
  g2.inventory.sort();
  assert.deepEqual(g2.inventory.qualities('rune_sword'), [null, null, 'legendary']);
  // Selling (or any plain removal) takes the plainest copy first.
  g2.inventory.remove('rune_sword', 1);
  assert.deepEqual(g2.inventory.qualities('rune_sword'), [null, 'legendary']);
});

test('a kill drop flies into the pack with its quality, named in the loot message', () => {
  const g = hero();
  g._autoLoot([['iron_sword', 1, 'legendary', 'mythic']], g.player.x, g.player.y);
  g.tickCount += 10;
  g._autoPickup();
  assert.deepEqual(g.inventory.qualities('iron_sword'), ['mythic']);
  assert.ok(g.said.some((m) => /You loot: Mythic Iron sword/.test(m)), g.said.join('\n'));
});

test('Equip best weighs each copy as it would be worn: quality, type mastery and the carry', () => {
  const g = hero();
  const mode = g.combatMode();
  // Two copies of the same sword: the Legendary one goes on, the plain one comes off.
  g.equipment.set('weapon', 'rune_sword');
  g.inventory.add('rune_sword', 1, 'legendary');
  g.equipBest();
  assert.equal(g.equipment.qualityIn('weapon'), 'legendary');
  assert.deepEqual(g.inventory.qualities('rune_sword'), [null], 'the plain copy went back to the pack');
  assert.equal(g.equipBest(), 0, 'and nothing swaps back');
  // A higher tier of the same line goes on only if it is at least as strong
  // as the worn copy: find a lower tier whose Mythic copy beats the next tier up.
  const h = hero();
  const pairs = [['steel_sword', 'mithril_sword'], ['mithril_sword', 'adamant_sword'], ['adamant_sword', 'rune_sword'], ['iron_sword', 'steel_sword']];
  const pick = pairs.find(([lo, hi]) => offenceFirstScore(lo, h.equipment, mode, 'main', 'mythic') > offenceFirstScore(hi, h.equipment, mode));
  assert.ok(pick, 'some Mythic lower tier beats the plain next tier');
  const [lo, hi] = pick;
  h.equipment.set('weapon', lo, 'mythic');
  h.inventory.add(hi, 1);
  h.equipBest();
  assert.equal(h.equipment.get('weapon'), lo, `the Mythic ${lo} stays on over a plain ${hi}`);
  assert.equal(h.equipment.qualityIn('weapon'), 'mythic');
  // A Mythic copy of the higher tier does go on.
  h.inventory.add(hi, 1, 'mythic');
  h.equipBest();
  assert.equal(h.equipment.get('weapon'), hi);
  assert.equal(h.equipment.qualityIn('weapon'), 'mythic');
  assert.deepEqual(h.inventory.qualities(lo), ['mythic'], 'the old Mythic copy is back in the pack, still Mythic');
});

test('old saves: per-item mastery becomes per-type (the most any item had); quality tallies go onto owned copies, best first', () => {
  const g = hero();
  g.equipment.set('weapon', 'rune_sword');
  g.equipment.set('body', 'rune_platebody');
  g.inventory.add('rune_sword', 2);
  g.bank.deposit('rune_sword', 1);
  g.inventory.add('rune_platebody', 1);
  saveGame(g);
  // Rewrite the save as one from before: mastery per item id, a tally of quality copies.
  const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete raw.equipment._slotQuality;
  delete raw.equipment._masteryXp;   // and from before mastery XP: points
  raw.equipment._mastery = { iron_sword: 3000, rune_sword: 9000, bronze_platebody: 300, rune_platebody: 1200, no_such_item: 5 };
  raw.equipment._quality = { rune_sword: [1, 0, 1, 0, 1], rune_platebody: [0, 0, 0, 2, 0], gold_ring: [1, 0, 0, 0, 0] };
  localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  const g2 = new Game(); g2.start();
  assert.equal(loadGame(g2), true, 'the old save loads (no version change)');
  // ...and, as a save from before mastery XP, points become XP: 9,000 points
  // (an eighth of the way from Master to Grandmaster) is 90,000 XP, 1,200
  // (a tenth of the way from Skilled to Expert) 12,000.
  assert.equal(g2.equipment.masteryXp('adamant_sword'), 90000, 'Sword mastery: the most any sword had');
  assert.equal(g2.equipment.masteryXp('iron_platebody'), 12000, 'Plate body mastery');
  assert.equal(g2.equipment.masteryRank('rune_sword'), 4, 'Master, as the rune sword was');
  // Four rune swords (worn, two in the pack, one banked) and three quality copies: Mythic worn, then Epic and Fine in the pack.
  assert.equal(g2.equipment.qualityIn('weapon'), 'mythic');
  assert.deepEqual(g2.inventory.qualities('rune_sword'), ['fine', 'epic']);
  assert.deepEqual(g2.bank.items.filter((e) => e.id === 'rune_sword'), [{ id: 'rune_sword', qty: 1 }]);
  // Two Legendary plate bodies: the worn one and the one in the pack.
  assert.equal(g2.equipment.qualityIn('body'), 'legendary');
  assert.deepEqual(g2.inventory.qualities('rune_platebody'), ['legendary']);
  assert.equal(g2.inventory.count('gold_ring'), 0, 'a tally for copies no longer owned is dropped');
  // Saved again in the new shape, it loads the same, and the old fields are gone.
  saveGame(g2);
  const after = JSON.parse(localStorage.getItem(SAVE_KEY)).equipment;
  assert.equal(after._quality, undefined);
  assert.equal(after._mastery['weapon:sword'], 90000);
  assert.equal(after._masteryXp, 1, 'marked as XP, so it is never converted again');
  assert.ok(Object.keys(after._mastery).every((k) => k.includes(':')), JSON.stringify(after._mastery));
  const g3 = new Game(); g3.start(); loadGame(g3);
  assert.equal(g3.equipment.qualityIn('weapon'), 'mythic');
  assert.deepEqual(g3.inventory.qualities('rune_sword'), ['fine', 'epic']);
  assert.equal(g3.equipment.masteryXp('rune_sword'), 90000);
});
