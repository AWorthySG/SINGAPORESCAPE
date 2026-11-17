// Offering spare gear at the Offering Shrine (src/game/salvage.js, "Offering at
// the shrine"): any class, any slot, from the pack, for shrine points scaled by
// the piece's worth and your combat level.
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

test('balance: an hour of spare gear drops is worth thousands of shrine points early and grows with level', () => {
  // tools/balance/shrine.mjs compares these with an hour of gathering: about
  // half to all of a woodcutting hour, a tenth or so of a mining hour.
  const rows = [50, 150, 250].map((L) => gearHour(L, { kills: 1800 }));
  assert.ok(rows[0].points > 3000 && rows[0].points < 10000, `level 50: ${rows[0].points}`);
  assert.ok(rows[1].points > 30000 && rows[1].points < 90000, `level 150: ${rows[1].points}`);
  assert.ok(rows[2].points > 100000 && rows[2].points < 300000, `level 250: ${rows[2].points}`);
});
