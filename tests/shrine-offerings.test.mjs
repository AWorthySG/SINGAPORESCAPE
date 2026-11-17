// Offering things at the Offering Shrine besides materials: spare gear
// (src/game/salvage.js, "Offering at the shrine"), any class, any slot, for
// shrine points scaled by the piece's worth and your combat level; and any other
// item (src/game/offerings.js) at a 25th of a material's worth.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { materialPoints } from '../src/game/materials.js';
import {
  gearWorth, recordQuality, packQualities, bulkPicks, shrineGearPoints, shrineLevelFactor, shrineGearOptions,
  previewOffer, offerGear, previewOfferAll, offerAll, nearOfferingShrine,
} from '../src/game/salvage.js';
import { gearHour } from '../tools/balance/shrine.mjs';
import { snapshot } from '../src/game/save.js';
import { goodsKind, goodsPoints, goodsRefusal, shrineGoods, offerGoods, bulkGoods, offerAllGoods, questNeeds, GOODS_RATE } from '../src/game/offerings.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(cls = 'swordsman') {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
const chat = (g) => { const out = []; g.bus.on('chat', (m) => out.push(m.text)); return out; };

test('shrine points for gear: worth times a combat-level factor, at least 1', () => {
  for (const id of ['bronze_sword', 'rune_sword', 'rune_platebody', 'eternal_staff', 'merlion_blade']) {
    for (const L of [3, 60, 200]) {
      assert.equal(shrineGearPoints(id, 'plain', L), Math.max(1, Math.round(gearWorth(id) * shrineLevelFactor(L))), `${id} at ${L}`);
    }
  }
  assert.ok(shrineGearPoints('rune_sword', 'plain', 100) > shrineGearPoints('bronze_sword', 'plain', 100), 'more worth, more points');
  assert.ok(shrineGearPoints('rune_sword', 'epic', 100) > shrineGearPoints('rune_sword', 'plain', 100), 'quality counts');
  assert.ok(shrineGearPoints('merlion_blade', 'plain', 100) > shrineGearPoints('rune_sword', 'plain', 100) * 20, 'boss uniques a great deal');
  assert.ok(shrineGearPoints('rune_sword', 'plain', 250) > shrineGearPoints('rune_sword', 'plain', 50) * 10, 'grows with combat level');
  assert.equal(shrineGearPoints('bronze_dagger', 'plain', 3), 1);
  assert.equal(shrineGearPoints('bronze_axe', 'plain', 100), 0, 'tools are not offerings');
  assert.equal(shrineGearPoints('rune_bar', 'plain', 100), 0, 'materials go the material way');
});

test('offering gear adds shrine points; worn gear is refused', () => {
  const g = newGame('swordsman');
  const out = chat(g);
  const worn = g.equipment.get('weapon');
  assert.equal(g.inventory.count(worn), 0);
  assert.equal(offerGear(g, worn, 1), 0, 'refused: it is being worn');
  assert.ok(out.some((t) => /wearing/.test(t)));
  assert.equal(g.equipment.get('weapon'), worn, 'still worn');
  // Gear of another class, any slot.
  g.inventory.add('eternal_staff', 1);
  g.inventory.add('rune_platebody', 2);
  const lvl = g.skills.combatLevel();
  const p0 = g.shrine.points;
  assert.equal(previewOffer(g, 'eternal_staff', 1).points, shrineGearPoints('eternal_staff', 'plain', lvl));
  assert.equal(offerGear(g, 'eternal_staff', 1), shrineGearPoints('eternal_staff', 'plain', lvl));
  assert.equal(offerGear(g, 'rune_platebody', 5), 2 * shrineGearPoints('rune_platebody', 'plain', lvl), 'only what you carry');
  assert.equal(g.inventory.count('eternal_staff') + g.inventory.count('rune_platebody'), 0);
  assert.equal(g.shrine.points, p0 + shrineGearPoints('eternal_staff', 'plain', lvl) + 2 * shrineGearPoints('rune_platebody', 'plain', lvl));
  assert.equal(offerGear(g, 'rune_bar', 1), 0, 'not gear');
});

test('offering uses the plain copies first and keeps the quality tally right', () => {
  const g = newGame('swordsman');
  const lvl = g.skills.combatLevel();
  g.inventory.add('rune_platebody', 3);
  recordQuality(g.equipment, 'rune_platebody', 'epic');
  const opt = shrineGearOptions(g).find((o) => o.id === 'rune_platebody');
  assert.equal(opt.points, shrineGearPoints('rune_platebody', 'plain', lvl), 'the next copy is a plain one');
  assert.equal(opt.total, 2 * shrineGearPoints('rune_platebody', 'plain', lvl) + shrineGearPoints('rune_platebody', 'epic', lvl));
  assert.ok(opt.warn, 'an Epic copy among them is flagged');
  assert.equal(offerGear(g, 'rune_platebody', 2), 2 * shrineGearPoints('rune_platebody', 'plain', lvl));
  assert.deepEqual(packQualities(g, 'rune_platebody'), ['epic']);
  assert.deepEqual(g.equipment.quality.rune_platebody, [0, 0, 1, 0, 0]);
  assert.equal(offerGear(g, 'rune_platebody', 1), shrineGearPoints('rune_platebody', 'epic', lvl));
  assert.equal(g.equipment.quality.rune_platebody, undefined, 'the tally is used up');
});

test('"Offer all spare gear" takes the same picks as Dismantle all: filters, never upgrades or boss uniques', () => {
  const g = newGame('swordsman');
  g.equipment.slots.weapon = 'rune_sword';
  g.equipment.slots.body = 'rune_platebody';
  g.skills.xp.attack = g.skills.xp.defence = xpForLevel(300);
  g.inventory.slots = g.inventory.slots.map(() => null);
  g.inventory.add('eternal_staff', 2);     // not my class
  g.inventory.add('bronze_sword', 2);      // below my worn tier
  g.inventory.add('bronze_platebody', 1);  // below my worn tier
  g.inventory.add('merlion_blade', 1);     // a boss unique: never in bulk
  g.inventory.add('eternal_platebody', 1); // an upgrade: never in bulk
  recordQuality(g.equipment, 'bronze_sword', 'epic');
  const lvl = g.skills.combatLevel();
  const f = { belowTier: true, below: 'epic' };
  const want = bulkPicks(g, f).reduce((t, p) => t + p.qualities.reduce((s, q) => s + shrineGearPoints(p.id, q, lvl), 0), 0);
  assert.deepEqual(previewOfferAll(g, f), { pieces: 2, points: want });
  const p0 = g.shrine.points;
  assert.deepEqual(offerAll(g, f), { pieces: 2, points: want });
  assert.equal(g.shrine.points, p0 + want);
  assert.equal(g.inventory.count('bronze_sword'), 1, 'the Epic copy is kept');
  assert.equal(g.inventory.count('bronze_platebody'), 0);
  assert.equal(g.inventory.count('eternal_staff'), 2, 'the staff did not match');
  // Not my class: the staves go; with no filters, still never the unique or the upgrade.
  assert.equal(offerAll(g, { offClass: true }).pieces, 2);
  assert.equal(g.inventory.count('eternal_staff'), 0);
  offerAll(g, { below: 'any' });
  assert.equal(g.inventory.count('merlion_blade'), 1);
  assert.equal(g.inventory.count('eternal_platebody'), 1);
  assert.equal(offerAll(g, {}).pieces, 0, 'nothing left to match');
});

test('material offerings are unchanged, and gear never shows among them', () => {
  const g = newGame('swordsman');
  g.inventory.slots = g.inventory.slots.map(() => null);
  g.inventory.add('rune_bar', 5);
  g.inventory.add('rune_platebody', 1);
  assert.deepEqual(g.shrineDonatables().map((d) => d.id), ['rune_bar']);
  assert.equal(g.donateToShrine('rune_platebody', 1), 0, 'gear goes through Offer gear');
  assert.equal(g.donateToShrine('rune_bar', Infinity), 5 * materialPoints('rune_bar'));
  assert.equal(g.inventory.count('rune_platebody'), 1);
});

test('the pack offers "Offer at shrine" only beside the Offering Shrine', () => {
  const g = newGame('swordsman');
  const o = g.world.objects.find((x) => x.objId === 'offering_shrine');
  g.player.x = o.x + 40; g.player.y = o.y;
  assert.equal(nearOfferingShrine(g), false);
  g.player.x = o.x + 1; g.player.y = o.y + 1;
  assert.equal(nearOfferingShrine(g), true);
});

test('balance: an hour of drops: gear is worth thousands of points early and grows with level; other loot stays small', () => {
  // tools/balance/shrine.mjs compares these with an hour of gathering: gear
  // about half to all of a woodcutting hour, other loot a small top-up.
  const rows = [50, 150, 250].map((L) => gearHour(L, { kills: 1800 }));
  assert.ok(rows[0].points > 3000 && rows[0].points < 10000, `level 50: ${rows[0].points}`);
  assert.ok(rows[1].points > 30000 && rows[1].points < 90000, `level 150: ${rows[1].points}`);
  assert.ok(rows[2].points > 100000 && rows[2].points < 300000, `level 250: ${rows[2].points}`);
  for (const r of rows) assert.ok(r.goods > 500 && r.goods < 20000, `loot at combat ${r.combat}: ${r.goods}`);
  assert.ok(rows[2].goods < rows[2].points / 5, 'late on, loot is small change next to gear');
});

// ---------------- Everything else ----------------

test('goods: every other item has a kind and is worth its value / 250; coins, tokens and openables are refused', () => {
  const g = newGame('swordsman');
  assert.equal(goodsKind('shark'), 'food');
  assert.equal(goodsKind('super_strength'), 'potion');
  assert.equal(goodsKind('death_rune'), 'ammo');
  assert.equal(goodsKind('rune_arrow'), 'ammo');
  assert.equal(goodsKind('dragon_bones'), 'bone');
  assert.equal(goodsKind('durian_seed'), 'seed');
  assert.equal(goodsKind('glass_orb'), 'misc');
  assert.equal(goodsKind('hammer'), 'tool');
  assert.equal(goodsKind('upgrade_stone'), 'enchant');
  assert.equal(goodsPoints('shark'), 360 / GOODS_RATE);
  // Gear and materials have their own rules.
  assert.equal(goodsKind('rune_sword'), null);
  assert.equal(goodsKind('rune_bar'), null);
  for (const id of ['coins', 'mark_of_grace', 'casino_chip', 'clue_scroll_easy', 'reward_casket_hard', 'birds_nest']) {
    assert.equal(goodsKind(id), null, id);
    assert.ok(goodsRefusal(g, id), id);
    g.inventory.add(id, 1);
    assert.equal(offerGoods(g, id, 1), 0, id);
    assert.equal(g.inventory.count(id) > 0, true, `${id} is kept`);
  }
  assert.ok(!shrineGoods(g).some((o) => o.id === 'coins'));
  // A good is always worth less than a material of the same value.
  assert.ok(goodsPoints('shark') < 360 / 10);
});

test('offering goods: whole points now, the part point kept (and saved) for next time', () => {
  const g = newGame('swordsman');
  g.inventory.add('bronze_arrow', 300);   // 1 coin each: 300 / 250 = 1.2 points
  g.inventory.add('shark', 5);            // 360 each: 7.2 points
  const p0 = g.shrine.points;
  assert.equal(offerGoods(g, 'bronze_arrow', 300), 1);
  assert.ok(Math.abs(g.shrine.frac - 0.2) < 1e-9);
  assert.equal(offerGoods(g, 'shark', 5), 7, '7.2 + 0.2 = 7.4');
  assert.equal(g.shrine.points, p0 + 8);
  assert.ok(Math.abs(g.shrine.frac - 0.4) < 1e-9);
  assert.equal(g.inventory.count('shark') + g.inventory.count('bronze_arrow'), 0);
  const g2 = newGame('swordsman');
  g2.shrine.load(snapshot(g).shrine);
  assert.ok(Math.abs(g2.shrine.frac - 0.4) < 1e-9, 'the part point is saved');
  g2.shrine.load({ points: 5, ranks: {} });
  assert.equal(g2.shrine.frac, 0, 'older saves start with none');
});

test('quest items are refused while the quest needs them, and never offered in bulk', () => {
  const g = newGame('swordsman');
  g.inventory.add('death_rune', 30);
  g.inventory.add('steel_bar', 8);
  g.quests.mystic_trial.state = 'active';
  g.quests.smith_apprentice.state = 'active';
  assert.ok(questNeeds(g).has('death_rune') && questNeeds(g).has('steel_bar'));
  assert.equal(offerGoods(g, 'death_rune', 1), 0);
  assert.equal(g.inventory.count('death_rune'), 30);
  assert.ok(!shrineGoods(g).some((o) => o.id === 'death_rune'));
  assert.ok(!bulkGoods(g, 'ammo').some((p) => p.id === 'death_rune'));
  assert.ok(!bulkGoods(g, 'material').some((p) => p.id === 'steel_bar'), 'nor quest materials');
  g.quests.mystic_trial.state = 'done';
  assert.ok(offerGoods(g, 'death_rune', 1) >= 0);
  assert.equal(g.inventory.count('death_rune'), 29, 'once the quest is done it can go');
});

test('"Offer all" by kind: keeps back what you ask, never gear, tools or enchanting supplies; materials at their usual worth', () => {
  const g = newGame('swordsman');
  g.inventory.slots = g.inventory.slots.map(() => null);
  g.inventory.add('shark', 10);
  g.inventory.add('lobster', 3);
  g.inventory.add('hammer', 1);
  g.inventory.add('upgrade_stone', 50);
  g.inventory.add('rune_platebody', 1);
  g.inventory.add('yew_logs', 20);
  assert.deepEqual(bulkGoods(g, 'food', { keep: 5 }).map((p) => [p.id, p.n]), [['shark', 5]]);
  assert.deepEqual(bulkGoods(g, 'tool'), []);
  assert.deepEqual(bulkGoods(g, 'enchant'), []);
  const p0 = g.shrine.points;
  const r = offerAllGoods(g, 'food', { keep: 5 });
  assert.equal(r.items, 5);
  assert.equal(g.inventory.count('shark'), 5);
  assert.equal(g.inventory.count('lobster'), 3);
  const m = offerAllGoods(g, 'material');
  assert.equal(m.items, 20);
  assert.equal(g.shrine.points, p0 + r.points + 20 * materialPoints('yew_logs'));
  for (const id of ['hammer', 'upgrade_stone', 'rune_platebody']) assert.ok(g.inventory.count(id) > 0, `${id} untouched`);
});
