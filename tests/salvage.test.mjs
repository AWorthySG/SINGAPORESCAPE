// Sacrifice and dismantle (src/game/salvage.js): spare gear, of any class and
// slot, fed to the mastery of its own gear type or broken down into upgrade
// stones, refine scrolls and wards. Each copy keeps its own quality.
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
  gearWorth, sacrificeXp, sacrificeXpIn, dismantleYield, sacrificeGear, dismantleGear, packQualities,
  bulkPicks, dismantleAll, sacrificeAll, previewSacrifice, sacrificeOptions, salvageWarning, QUALITY_MULT, UNIQUE_MULT,
  SACRIFICE_XP, OLD_SACRIFICE_XP, SACRIFICE_RANK_BONUS, SACRIFICE_REFINE_BONUS,
} from '../src/game/salvage.js';
import { MASTERY_RANKS, rankFor } from '../src/game/mastery.js';
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
  assert.ok(sacrificeXp('rune_sword', 'merlion_blade') >= 6000, 'a boss unique gives a lot of mastery');
  // Tools and things with no stats are worth nothing.
  assert.equal(gearWorth('bronze_axe'), 0);
  assert.equal(gearWorth('coins'), 0);
});

// The owner asked for sacrifice to pay far more. It was worth x3 mastery
// points (x1.5, doubled), and a point is 10 XP now (the ranks' XP is ten times
// their old points), so the old value is 30 XP a point of worth: it is four
// times that at Novice, and more as the type's rank climbs and for refined pieces.
test('sacrifice XP: four times the old value, more with rank and refine, and only into the same gear type', () => {
  // A plate body into a sword gives nothing; into another plate body, its worth.
  assert.equal(sacrificeXp('rune_sword', 'rune_platebody'), 0, 'another type: refused');
  assert.equal(sacrificeXp('rune_sword', 'iron_scimitar'), 0, 'a scimitar is not a sword');
  assert.equal(sacrificeXp('rune_platebody', 'leather_body'), 0, 'scout leather is not plate');
  assert.equal(SACRIFICE_XP, 4 * OLD_SACRIFICE_XP);
  assert.equal(OLD_SACRIFICE_XP, 2 * 1.5 * 10, 'the old SACRIFICE_RATE x SAME_KIND_MULT, at 10 XP a point');
  for (const [t, src] of [['adamant_platebody', 'rune_platebody'], ['rune_sword', 'mithril_sword'], ['eternal_sword', 'rune_sword'], ['rune_sword', 'merlion_blade']]) {
    const old = Math.max(1, Math.round(gearWorth(src) * 3)) * 10;
    assert.equal(sacrificeXp(t, src), Math.round(gearWorth(src) * SACRIFICE_XP), src);
    const x = sacrificeXp(t, src) / old;
    assert.ok(x > 3.5 && x < 4.5, `${src}: ${x.toFixed(2)}x the old value at Novice`);
    // At Expert (rank 3) +30%, so about five times; a ★10 piece +40% on top.
    assert.equal(sacrificeXp(t, src, 'plain', 3), Math.round(gearWorth(src) * SACRIFICE_XP * (1 + 3 * SACRIFICE_RANK_BONUS)));
    assert.equal(sacrificeXp(t, src, 'plain', 3, 10), Math.round(gearWorth(src) * SACRIFICE_XP * (1 + 3 * SACRIFICE_RANK_BONUS) * (1 + 10 * SACRIFICE_REFINE_BONUS)));
  }
  // Quality is in the worth: an Epic copy is worth 2.2 plain ones.
  assert.equal(sacrificeXp('rune_sword', 'mithril_sword', 'epic'), Math.round(gearWorth('mithril_sword') * QUALITY_MULT.epic * SACRIFICE_XP));
  assert.ok(sacrificeXp('rune_dagger', 'bronze_dagger') >= 1, 'the humblest piece still gives some');
});

test('sacrifice: same-tier copies per rank, and in a game the piece\'s refine and the target\'s rank count', () => {
  // Plain rune swords (level 40) into Sword mastery from Novice: about 11 to
  // Adept, 27 more to Skilled, 67 to Expert and 156 to Master (salvage.js);
  // 1,334 took it to Master before. Eternal swords (level 300): 87 in all.
  const perRank = (id) => {
    let xp = 0; const out = [];
    for (let r = 1; r <= 4; r++) { let n = 0; while (xp < MASTERY_RANKS[r].xp) { xp += sacrificeXp(id, id, 'plain', rankFor(xp)); n++; } out.push(n); }
    return out;
  };
  const rune = perRank('rune_sword'), eternal = perRank('eternal_sword');
  const total = (a) => a.reduce((t, n) => t + n, 0);
  assert.ok(total(rune) >= 200 && total(rune) <= 320, `rune swords to Master: ${rune.join('/')}`);
  assert.ok(total(eternal) >= 60 && total(eternal) <= 120, `eternal swords to Master: ${eternal.join('/')}`);
  const oldRune = Math.ceil(MASTERY_RANKS[4].xp / (Math.round(gearWorth('rune_sword') * 3) * 10));
  assert.ok(oldRune / total(rune) >= 4 && oldRune / total(rune) <= 6, `${oldRune} before, ${total(rune)} now`);
  // In a game: the target's mastery and the piece's refine stars.
  const g = newGame('swordsman');
  const target = g.equipment.get('weapon');
  assert.equal(sacrificeXpIn(g, target, 'mithril_sword'), sacrificeXp(target, 'mithril_sword'));
  g.equipment.refines.mithril_sword = 5;
  g.equipment.setMastery(target, MASTERY_RANKS[2].xp);
  assert.equal(sacrificeXpIn(g, target, 'mithril_sword'), sacrificeXp(target, 'mithril_sword', 'plain', 2, 5));
  assert.ok(sacrificeXpIn(g, target, 'mithril_sword') > sacrificeXp(target, 'mithril_sword') * 1.4);
});

test('sacrificing gear adds mastery to its gear type, and only gear of that type can go', () => {
  const g = newGame('swordsman');
  const out = chat(g);
  const target = g.equipment.get('weapon');
  assert.ok(target, 'the swordsman holds a sword');
  g.inventory.add('fire_staff', 3);   // a wizard's staff: not a sword
  assert.equal(sacrificeGear(g, target, 'fire_staff', 2), 0, 'refused: another gear type');
  assert.ok(out.some((t) => /Only sword gear/.test(t)), out.join('\n'));
  assert.equal(g.inventory.count('fire_staff'), 3, 'nothing used up');
  assert.ok(!sacrificeOptions(g, target).some((o) => o.id === 'fire_staff'), 'not offered either');
  g.inventory.add('mithril_sword', 3);
  const each = sacrificeXp(target, 'mithril_sword');
  const before = g.equipment.masteryXp(target);
  const pv = previewSacrifice(g, target, 'mithril_sword', 2);
  assert.deepEqual([pv.n, pv.points], [2, each * 2], 'the preview matches');
  assert.equal(sacrificeGear(g, target, 'mithril_sword', 2), each * 2);
  assert.equal(g.equipment.masteryXp(target), before + each * 2);
  assert.equal(g.equipment.masteryXp('rune_sword'), before + each * 2, 'every sword shares Sword mastery');
  assert.equal(g.inventory.count('mithril_sword'), 1, 'two used up, one left');
  assert.ok(sacrificeOptions(g, target).some((o) => o.id === 'mithril_sword' && o.count === 1));
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
  assert.ok(worn);
  assert.equal(sacrificeGear(g, body, body, 1), 0, 'refused: it is being worn');
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
  g.equipment.setMastery(target, FEED_CAP - 2);
  g.inventory.add('rune_sword', 10);
  const pts = sacrificeGear(g, target, 'rune_sword', 10);
  assert.ok(pts > 0);
  assert.equal(g.inventory.count('rune_sword'), 9, 'only one piece was needed to reach Master');
  assert.equal(sacrificeGear(g, target, 'rune_sword', 1), 0, 'and no more');
});

test('each copy keeps its quality, saved, and the plainest copy goes first', () => {
  const g = newGame('swordsman');
  g.inventory.add('rune_platebody', 2);
  g.inventory.add('rune_platebody', 1, 'epic');
  assert.deepEqual(packQualities(g, 'rune_platebody'), ['plain', 'plain', 'epic']);
  assert.ok(/Epic/.test(salvageWarning(g, 'rune_platebody', 'epic')), 'an Epic copy gets a warning');
  // Saved and loaded with the pack.
  const data = snapshot(g);
  const g2 = newGame('swordsman');
  g2.inventory.load(data.inventory);
  assert.deepEqual(packQualities(g2, 'rune_platebody'), ['plain', 'plain', 'epic']);
  // Sacrificing two (to plate body mastery) uses the plain ones and keeps the Epic.
  g.inventory.add('adamant_platebody', 1);
  const target = 'adamant_platebody';
  const plain = sacrificeXp(target, 'rune_platebody', 'plain');
  assert.equal(sacrificeGear(g, target, 'rune_platebody', 2), plain * 2);
  assert.deepEqual(packQualities(g, 'rune_platebody'), ['epic']);
  assert.equal(sacrificeGear(g, target, 'rune_platebody', 1), sacrificeXpIn(g, target, 'rune_platebody', 'epic'));
  assert.equal(g.inventory.count('rune_platebody'), 0);
});

test('quality drops keep their quality on the drop (a boss always drops Superior gear or better)', () => {
  const g = newGame('swordsman');
  let loot = [];
  g._autoLoot = (l) => { loot = l; };
  const boss = new NPC(ALL_BOSS_IDS[0], 10, 10, 0);
  const before = g.equipment.masteryPoints(g.equipment.get('weapon'));
  g.rollDrops(boss);
  const q = loot.filter((l) => l[3]).map((l) => l[3]);
  assert.ok(q.length >= 3, `three quality pieces (${q.length})`);
  assert.ok(q.every((k) => k !== 'fine'), 'none of them merely Fine');
  assert.equal(g.equipment.masteryPoints(g.equipment.get('weapon')), before, 'quality no longer touches mastery');
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
  g.inventory.add('bronze_sword', 1);      // my class, below my worn tier
  g.inventory.add('bronze_sword', 1, 'epic');   // ...and an Epic copy of it
  g.inventory.add('bronze_platebody', 1);  // below my worn tier
  g.inventory.add('merlion_blade', 1);     // a boss unique: never in bulk
  g.inventory.add('eternal_platebody', 1); // better than what I wear: never in bulk
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
  // Sacrifice all the rest into the worn sword: only swords go (not the staves).
  const pts = g.equipment.masteryXp('rune_sword');
  const res = sacrificeAll(g, 'rune_sword', {});
  assert.equal(res.pieces, 1, 'the Epic sword');
  assert.equal(g.inventory.count('eternal_staff'), 2, 'the staves are another type');
  assert.equal(g.equipment.masteryXp('rune_sword'), pts + res.points);
  assert.equal(g.inventory.count('merlion_blade'), 1);
});

test('balance: an hour of drops, dismantled, adds 45-90% to stone and scroll income; the same type sacrificed reaches Master quickly', () => {
  const rows = [50, 150, 250].map((L) => salvageHour(L, { kills: 2400 }));
  for (const r of rows) {
    // Sacrifice used to give 1.6-2.4x the kills' mastery in an hour, so a
    // fresh type took ~2 hours of spare drops to reach Master. At four times
    // the old rate (and more as ranks climb) it reaches Master, where
    // sacrifice stops, in well under an hour of drops.
    assert.ok(r.sacPoints >= FEED_CAP, `level ${r.level}: sacrifice gave ${r.sacPoints} XP`);
    assert.ok(r.toMaster >= 5 && r.toMaster <= 45, `level ${r.level}: Master in ${r.toMaster} minutes of spare drops`);
  }
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
  const stones = sum('disStones') / sum('dropStones'), scrolls = sum('disScrolls') / sum('dropScrolls');
  // (Raised by half when the owner asked for dismantling to pay more: STONE_RATE 0.09, SCROLL_RATE 0.012.)
  assert.ok(stones >= 0.45 && stones <= 0.9, `stones +${Math.round(stones * 100)}%`);
  assert.ok(scrolls >= 0.45 && scrolls <= 0.9, `scrolls +${Math.round(scrolls * 100)}%`);
  assert.ok(sum('disWards') < sum('dropWards'), 'wards stay mostly a boss and champion drop');
});
