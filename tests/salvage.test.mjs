// Sacrifice and dismantle (src/game/salvage.js): spare gear, of any class and
// slot, fed to another piece's mastery or broken down into upgrade stones,
// refine scrolls and wards.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, snapshot } from '../src/game/save.js';
import { NPC } from '../src/game/npc.js';
import { ALL_BOSS_IDS } from '../src/data/npcs.js';
import { FEED_CAP } from '../src/game/materials.js';
import { xpForLevel } from '../src/data/xp.js';
import {
  gearWorth, sacrificePoints, dismantleYield, sacrificeGear, dismantleGear, packQualities, recordQuality,
  bulkPicks, dismantleAll, sacrificeAll, previewSacrifice, sacrificeOptions, salvageWarning, QUALITY_MULT, UNIQUE_MULT,
} from '../src/game/salvage.js';
import { salvageHour } from '../tools/balance/salvage.mjs';

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

test('worth grows with level (with diminishing returns), tier, quality and boss uniques', () => {
  assert.ok(gearWorth('rune_sword') > gearWorth('bronze_sword'), 'a higher level piece is worth more');
  // Level has diminishing returns: a level-250 staff is worth far less than 6x a level-40 sword.
  const hi = gearWorth('eternal_staff'), lo = gearWorth('rune_sword');
  assert.ok(hi > lo * 2 && hi < lo * 4, `eternal staff ${hi.toFixed(2)} vs rune sword ${lo.toFixed(2)}`);
  // Quality multiplies it.
  assert.equal(gearWorth('rune_sword', 'epic').toFixed(6), (gearWorth('rune_sword') * QUALITY_MULT.epic).toFixed(6));
  assert.ok(gearWorth('rune_sword', 'mythic') > gearWorth('rune_sword', 'legendary'));
  // Boss uniques and signature weapons are worth a lot.
  assert.ok(gearWorth('merlion_blade') > gearWorth('rune_sword') * UNIQUE_MULT * 0.9);
  assert.ok(sacrificePoints('rune_sword', 'merlion_blade') >= 60, 'a boss unique gives a lot of mastery');
  // Tools and things with no stats are worth nothing.
  assert.equal(gearWorth('bronze_axe'), 0);
  assert.equal(gearWorth('coins'), 0);
});

test('sacrifice points: worth, a bonus for the same kind of gear, at least 1', () => {
  // A plate body into a sword vs into another plate body.
  const other = sacrificePoints('rune_sword', 'rune_platebody'), same = sacrificePoints('adamant_platebody', 'rune_platebody');
  assert.ok(same > other, `same kind ${same} > other kind ${other}`);
  assert.equal(sacrificePoints('rune_sword', 'mithril_sword'), Math.round(gearWorth('mithril_sword') * 1.5));
  assert.equal(sacrificePoints('rune_platebody', 'bronze_dagger'), 1, 'the humblest piece still gives 1');
});

test('sacrificing gear adds mastery to the target, even gear of another class', () => {
  const g = newGame('swordsman');
  const target = g.equipment.get('weapon');
  assert.ok(target, 'the swordsman holds a sword');
  g.inventory.add('fire_staff', 3);   // a wizard's staff: a swordsman can't wield it
  const each = sacrificePoints(target, 'fire_staff');
  const before = g.equipment.masteryPoints(target);
  const pv = previewSacrifice(g, target, 'fire_staff', 2);
  assert.deepEqual([pv.n, pv.points], [2, each * 2], 'the preview matches');
  assert.equal(sacrificeGear(g, target, 'fire_staff', 2), each * 2);
  assert.equal(g.equipment.masteryPoints(target), before + each * 2);
  assert.equal(g.inventory.count('fire_staff'), 1, 'two used up, one left');
  assert.ok(sacrificeOptions(g, target).some((o) => o.id === 'fire_staff' && o.count === 1));
});

test('worn gear can\'t be sacrificed or dismantled; spare copies in the pack can', () => {
  const g = newGame('swordsman');
  const out = chat(g);
  const worn = g.equipment.get('weapon'), body = 'rune_platebody';
  g.skills.xp.defence = xpForLevel(40);
  g.inventory.add(body, 1);
  g.equipItem(g.inventory.slots.findIndex((s) => s?.id === body));
  assert.equal(g.equipment.get('body'), body);
  assert.equal(g.inventory.count(body), 0);
  assert.equal(sacrificeGear(g, worn, body, 1), 0, 'refused: it is being worn');
  assert.ok(out.some((t) => /wearing/.test(t)));
  assert.equal(dismantleGear(g, body, 1).n, 0);
  assert.equal(g.equipment.get('body'), body, 'still worn');
  // A spare copy in the pack is fair game, even fed to the worn one.
  g.inventory.add(body, 1);
  assert.ok(sacrificeGear(g, body, body, 1) > 0);
  assert.equal(g.equipment.get('body'), body);
  // An unworn piece can't be fed its own last copy.
  g.inventory.add('mithril_sword', 1);
  assert.equal(sacrificeGear(g, 'mithril_sword', 'mithril_sword', 1), 0);
  assert.equal(g.inventory.count('mithril_sword'), 1);
});

test('sacrifice stops at Master, like feeding materials', () => {
  const g = newGame('swordsman');
  const target = g.equipment.get('weapon');
  g.equipment.mastery[target] = FEED_CAP - 2;
  g.inventory.add('rune_platebody', 10);
  const pts = sacrificeGear(g, target, 'rune_platebody', 10);
  assert.ok(pts > 0);
  assert.equal(g.inventory.count('rune_platebody'), 9, 'only one piece was needed to reach Master');
  assert.equal(sacrificeGear(g, target, 'rune_platebody', 1), 0, 'and no more');
});

test('quality copies are remembered, saved, and the plainest copy goes first', () => {
  const g = newGame('swordsman');
  g.inventory.add('rune_platebody', 3);
  recordQuality(g.equipment, 'rune_platebody', 'epic');
  assert.deepEqual(packQualities(g, 'rune_platebody'), ['plain', 'plain', 'epic']);
  assert.ok(/Epic/.test(salvageWarning(g, 'rune_platebody', 'epic')), 'an Epic copy gets a warning');
  // Saved and loaded.
  const data = snapshot(g);
  const g2 = newGame('swordsman');
  g2.equipment.load(data.equipment);
  assert.deepEqual(g2.equipment.quality.rune_platebody, [0, 0, 1, 0, 0]);
  // An old save without the tally loads fine.
  const old = { ...data.equipment }; delete old._quality;
  g2.equipment.load(old);
  assert.deepEqual(g2.equipment.quality, {});
  // Sacrificing two uses the plain ones and keeps the Epic.
  const target = g.equipment.get('weapon');
  const plain = sacrificePoints(target, 'rune_platebody', 'plain');
  assert.equal(sacrificeGear(g, target, 'rune_platebody', 2), plain * 2);
  assert.deepEqual(packQualities(g, 'rune_platebody'), ['epic']);
  assert.equal(sacrificeGear(g, target, 'rune_platebody', 1), sacrificePoints(target, 'rune_platebody', 'epic'));
  assert.equal(g.equipment.quality.rune_platebody, undefined, 'the tally is used up');
});

test('quality drops are tallied by rollDrops (a boss always drops Superior gear or better)', () => {
  const g = newGame('swordsman');
  g._autoLoot = () => {};
  const boss = new NPC(ALL_BOSS_IDS[0], 10, 10, 0);
  g.rollDrops(boss);
  const total = Object.values(g.equipment.quality).flat().reduce((a, b) => a + b, 0);
  assert.ok(total >= 3, `three quality pieces tallied (${total})`);
  assert.ok(Object.values(g.equipment.quality).every((r) => r[0] === 0), 'none of them merely Fine');
});

test('dismantling gives stones, sometimes scrolls, within the expected ranges', () => {
  const g = newGame('swordsman');
  g.inventory.add('rune_platebody', 300);
  const y = dismantleYield('rune_platebody');
  const before = { s: g.inventory.count('upgrade_stone'), r: g.inventory.count('refine_scroll') };
  const got = dismantleGear(g, 'rune_platebody', 300);
  assert.equal(got.n, 300);
  assert.equal(g.inventory.count('rune_platebody'), 0);
  assert.equal(g.inventory.count('upgrade_stone') - before.s, got.stones);
  assert.equal(g.inventory.count('refine_scroll') - before.r, got.scrolls);
  const es = y.stones * 300, er = y.scrolls * 300;
  assert.ok(got.stones >= es * 0.6 && got.stones <= es * 1.4, `stones ${got.stones}, expected about ${es.toFixed(0)}`);
  assert.ok(got.scrolls >= 0 && got.scrolls <= er * 3 + 3, `scrolls ${got.scrolls}, expected about ${er.toFixed(1)}`);
  assert.equal(got.wards, 0, 'plain pieces never give wards');
  // A boss unique: plenty of stones and at least one scroll.
  g.inventory.add('merlion_blade', 1);
  const u = dismantleGear(g, 'merlion_blade', 1);
  assert.ok(u.stones >= 4 && u.scrolls >= 1, JSON.stringify(u));
  // A better quality gives more on average.
  assert.ok(dismantleYield('rune_platebody', 'legendary').stones > y.stones * 3);
  assert.ok(dismantleYield('rune_platebody', 'mythic').ward > 0);
});

test('bulk picks: not my class, below my worn tier, below a quality; never upgrades or boss uniques', () => {
  const g = newGame('swordsman');
  for (const s of ['weapon', 'body']) g.equipment.slots[s] = null;
  g.equipment.slots.weapon = 'rune_sword';
  g.equipment.slots.body = 'rune_platebody';
  g.skills.xp.attack = g.skills.xp.defence = xpForLevel(300);   // can wear anything
  g.inventory.slots = g.inventory.slots.map(() => null);
  g.inventory.add('eternal_staff', 2);     // not my class (and not below my tier)
  g.inventory.add('bronze_sword', 2);      // my class, below my worn tier
  g.inventory.add('bronze_platebody', 1);  // below my worn tier
  g.inventory.add('merlion_blade', 1);     // a boss unique: never in bulk
  g.inventory.add('eternal_platebody', 1); // better than what I wear: never in bulk
  recordQuality(g.equipment, 'bronze_sword', 'epic');
  const ids = (f) => bulkPicks(g, f).map((p) => p.id).sort();
  assert.deepEqual(ids({ offClass: true }), ['eternal_staff']);
  assert.deepEqual(ids({ belowTier: true }), ['bronze_platebody', 'bronze_sword']);
  assert.deepEqual(ids({}), ['bronze_platebody', 'bronze_sword', 'eternal_staff']);
  // Below Epic: the Epic bronze sword is kept, its plain twin goes.
  assert.deepEqual(bulkPicks(g, { belowTier: true, below: 'epic' }).find((p) => p.id === 'bronze_sword').qualities, ['plain']);
  const sum = dismantleAll(g, { belowTier: true, below: 'epic' });
  assert.equal(sum.pieces, 2);
  assert.equal(g.inventory.count('bronze_sword'), 1, 'the Epic copy is kept');
  assert.equal(g.inventory.count('eternal_staff'), 2, 'the staff did not match');
  assert.equal(g.inventory.count('merlion_blade'), 1);
  assert.equal(g.inventory.count('eternal_platebody'), 1);
  // Sacrifice all the rest into the worn sword.
  const pts = g.equipment.masteryPoints('rune_sword');
  const res = sacrificeAll(g, 'rune_sword', {});
  assert.equal(res.pieces, 3, 'the staves and the Epic sword');
  assert.equal(g.equipment.masteryPoints('rune_sword'), pts + res.points);
  assert.equal(g.inventory.count('merlion_blade'), 1);
});

test('balance: an hour of drops, dismantled, adds 30-60% to stone and scroll income; sacrificed, about an hour of kills', () => {
  const rows = [50, 150, 250].map((L) => salvageHour(L, { kills: 2400 }));
  for (const r of rows) {
    const sac = r.sacPoints / r.killMastery;
    assert.ok(sac > 0.55 && sac < 1.6, `level ${r.level}: sacrifice gives ${Math.round(sac * 100)}% of the kills' mastery`);
  }
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
  const stones = sum('disStones') / sum('dropStones'), scrolls = sum('disScrolls') / sum('dropScrolls');
  assert.ok(stones >= 0.3 && stones <= 0.6, `stones +${Math.round(stones * 100)}%`);
  assert.ok(scrolls >= 0.3 && scrolls <= 0.6, `scrolls +${Math.round(scrolls * 100)}%`);
  assert.ok(sum('disWards') < sum('dropWards'), 'wards stay mostly a boss and champion drop');
});
