// Life-skill materials feed combat progression: upgrade stones, refine scrolls
// and wards are crafted from them, gear mastery can be fed with them, and the
// Offering Shrine turns them into permanent offensive blessings.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave, snapshot } from '../src/game/save.js';
import { SAVE_KEY, XP_RATE } from '../src/config.js';
import { xpForLevel } from '../src/data/xp.js';
import { SMITH } from '../src/data/smithing.js';
import { CRAFT } from '../src/data/crafting.js';
import { resolveSmith, resolveCraft } from '../src/game/skilling.js';
import { nextJob } from '../src/game/autoprocess.js';
import { materialKind, materialPoints, feedKind, feedPoints, FEED_CAP } from '../src/game/materials.js';
import { shrineCost, SHRINE_TRACK_IDS } from '../src/game/shrine.js';
import { MASTERY_RANKS } from '../src/game/mastery.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(calls = []) {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass('swordsman');
  // A UI stub that remembers which windows the game asked for.
  g.ui = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, ...a]); } });
  return g;
}
const setLevel = (g, skill, level) => { g.skills.xp[skill] = xpForLevel(level); };
const chat = (g) => { const out = []; g.bus.on('chat', (m) => out.push(m.text)); return out; };
// Run fn with Math.random pinned (no lucky extra piece from "flawless work").
function pinned(v, fn) { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } }

// ---------------- 1. Crafting upgrade items ----------------

test('upgrade stones are smithed from bars at an anvil, more per bar for finer metal', () => {
  const stones = SMITH.filter((r) => r.result === 'upgrade_stone');
  assert.deepEqual(stones.map((r) => [r.bar, r.barCount, r.qty, r.level]), [
    ['bronze_bar', 2, 1, 5], ['iron_bar', 1, 1, 18], ['steel_bar', 1, 2, 33],
    ['mithril_bar', 1, 3, 52], ['adamant_bar', 1, 5, 72], ['rune_bar', 1, 9, 88]]);
  const g = newGame();
  const obj = { x: g.player.x, y: g.player.y, def: { type: 'anvil' } };
  const mith = stones.find((r) => r.bar === 'mithril_bar');
  g.inventory.add('hammer', 1); g.inventory.add('mithril_bar', 2);
  // Too low a level: nothing made, nothing used.
  setLevel(g, 'smithing', 51);
  assert.equal(pinned(0.99, () => resolveSmith(g, { recipe: mith, obj })), false);
  assert.equal(g.inventory.count('mithril_bar'), 2);
  assert.equal(g.inventory.count('upgrade_stone'), 0);
  setLevel(g, 'smithing', 52);
  const xp = g.skills.xp.smithing;
  pinned(0.99, () => resolveSmith(g, { recipe: mith, obj }));
  assert.equal(g.inventory.count('mithril_bar'), 1, 'one bar used');
  assert.equal(g.inventory.count('upgrade_stone'), 3, 'three stones made');
  assert.equal(g.skills.xp.smithing - xp, 50 * XP_RATE);
});

test('refine scrolls and upgrade wards are crafted from a gem, bars and feathers, with a chisel', () => {
  const scroll = CRAFT.filter((r) => r.result === 'refine_scroll');
  assert.deepEqual(scroll.map((r) => [r.inputs[0].id, r.qty, r.level]), [['sapphire', 1, 35], ['emerald', 2, 52], ['ruby', 4, 70], ['diamond', 7, 90]]);
  for (let i = 1; i < scroll.length; i++) assert.ok(scroll[i].qty > scroll[i - 1].qty && scroll[i].xp > scroll[i - 1].xp, 'higher tiers give more');
  const g = newGame();
  const obj = { x: g.player.x, y: g.player.y, def: { type: 'craft' } };
  const ruby = scroll.find((r) => r.inputs[0].id === 'ruby');
  g.inventory.add('ruby', 1); g.inventory.add('adamant_bar', 1); g.inventory.add('feather', 12);
  setLevel(g, 'crafting', 99);
  // No chisel: refused, nothing used.
  g.inventory.remove('chisel', g.inventory.count('chisel'));
  assert.equal(resolveCraft(g, { recipe: ruby, obj }), false);
  assert.equal(g.inventory.count('refine_scroll'), 0);
  g.inventory.add('chisel', 1);
  setLevel(g, 'crafting', 69);
  assert.equal(resolveCraft(g, { recipe: ruby, obj }), false, 'level 70 needed');
  assert.equal(g.inventory.count('ruby'), 1);
  setLevel(g, 'crafting', 70);
  const xp = g.skills.xp.crafting;
  resolveCraft(g, { recipe: ruby, obj });
  assert.equal(g.inventory.count('refine_scroll'), 4);
  assert.equal(g.inventory.count('ruby'), 0); assert.equal(g.inventory.count('adamant_bar'), 0);
  assert.equal(g.inventory.count('feather'), 2, 'ten feathers used');
  assert.equal(g.skills.xp.crafting - xp, 200 * XP_RATE);
  // A ward: diamond, ruby, pearl and two adamant bars at Crafting 80.
  const ward = CRAFT.find((r) => r.result === 'upgrade_ward' && r.level === 80);
  for (const i of ward.inputs) g.inventory.add(i.id, i.qty);
  assert.equal(resolveCraft(g, { recipe: ward, obj }), false, 'level 80 needed');
  setLevel(g, 'crafting', 80);
  resolveCraft(g, { recipe: ward, obj });
  assert.equal(g.inventory.count('upgrade_ward'), 1);
  for (const i of ward.inputs) assert.equal(g.inventory.count(i.id), 0, `${i.id} used`);
});

test('"Smith all" and "Craft all" never spend materials on stones, scrolls or wards', () => {
  const g = newGame();
  g.inventory.add('hammer', 1); g.inventory.add('chisel', 1);
  g.inventory.add('rune_bar', 3); g.inventory.add('diamond', 1); g.inventory.add('feather', 20);
  setLevel(g, 'smithing', 99); setLevel(g, 'crafting', 99);
  const smith = nextJob(g, 'smith');
  assert.ok(smith && smith.recipe.result !== 'upgrade_stone', 'smiths gear, not stones');
  const craft = nextJob(g, 'craft');
  assert.ok(!craft || !craft.recipe.upgrade, 'crafts no scrolls or wards');
});

// ---------------- 2. Feeding gear mastery ----------------

test('materials: kinds and worth (a tenth of their value)', () => {
  const kinds = { rune_bar: 'bar', diamond: 'gem', pearl: 'gem', magic_logs: 'log', croc_hide: 'hide', qilin_mane: 'hide', chilli: 'herb',
    snow_lotus: 'herb', kangkong: 'herb', coal: 'ore', granite: 'ore', raw_trout: 'raw', feather: 'feather' };
  for (const [id, k] of Object.entries(kinds)) assert.equal(materialKind(id), k, id);
  for (const id of ['bronze_sword', 'bones', 'attack_potion', 'chilli_seed', 'trout', 'hammer', 'coins', 'upgrade_stone', 'no_such_item']) assert.equal(materialKind(id), null, id);
  assert.equal(materialPoints('rune_bar'), 320);
  assert.equal(materialPoints('feather'), 1, 'at least 1');
  assert.equal(materialPoints('bronze_sword'), 0);
});

test('feeding: each kind of gear takes its own material', () => {
  assert.equal(feedKind('rune_scimitar'), 'bar');
  assert.equal(feedKind('rune_platebody'), 'bar');
  assert.equal(feedKind('magic_longbow'), 'log');
  assert.equal(feedKind('staff'), 'log');
  assert.equal(feedKind('leather_body'), 'hide');
  assert.equal(feedKind('dragonhide_body'), 'hide');
  assert.equal(feedKind('diamond_ring'), 'gem');
  assert.equal(feedKind('ruby_amulet'), 'gem');
  assert.equal(feedKind('wizard_robe_top'), 'herb');
  assert.equal(feedKind('batik_cape'), 'herb');
  assert.equal(feedKind('logs'), null, 'not gear');
  assert.equal(feedPoints('rune_scimitar', 'mithril_bar'), 32);
  assert.equal(feedPoints('rune_scimitar', 'yew_logs'), 0, 'logs do not feed a sword');
});

test('feeding: bars add mastery to a sword, wrong materials are refused, rank-ups are announced, Master is the cap', () => {
  const g = newGame();
  const said = chat(g);
  const w = g.equipment.get('weapon');
  assert.equal(feedKind(w), 'bar');
  g.inventory.add('mithril_bar', 10); g.inventory.add('yew_logs', 5);
  // The wrong material: nothing happens.
  assert.equal(g.feedMastery(w, 'yew_logs', 5), 0);
  assert.equal(g.inventory.count('yew_logs'), 5);
  assert.equal(g.equipment.masteryPoints(w), 0);
  // The pack's options list only bars, best first.
  assert.deepEqual(g.feedOptions(w).map((o) => o.id), ['mithril_bar']);
  // Ten mithril bars: 32 points each.
  g.equipment.mastery[w] = 0;
  assert.equal(g.feedMastery(w, 'mithril_bar', 10), 320);
  assert.equal(g.inventory.count('mithril_bar'), 0);
  assert.equal(g.equipment.masteryPoints(w), 320);
  assert.equal(g.equipment.masteryRank(w), 1, 'Adept');
  assert.ok(said.some((t) => /reached Adept mastery/.test(t)), 'the rank-up is announced as a kill would');
  // The cap: from 7,990 one rune bar is enough to reach Master; the rest stay in the pack.
  g.equipment.mastery[w] = FEED_CAP - 10;
  g.inventory.add('rune_bar', 5);
  assert.equal(g.feedMastery(w, 'rune_bar', Infinity), 320);
  assert.equal(g.inventory.count('rune_bar'), 4, 'only what it took');
  assert.equal(g.equipment.masteryRank(w), 4, 'Master');
  assert.ok(said.some((t) => /reached Master mastery/.test(t)));
  assert.equal(g.feedMastery(w, 'rune_bar', 1), 0, 'no further with materials');
  assert.equal(g.inventory.count('rune_bar'), 4);
  // Kills still carry it on past the cap.
  const before = g.equipment.masteryPoints(w);
  g._gainMastery({ def: { boss: true } });
  assert.equal(g.equipment.masteryPoints(w), before + 25);
  // Gear you neither wear nor carry can't be fed.
  g.inventory.add('mithril_bar', 1);
  assert.equal(g.feedMastery('rune_platebody', 'mithril_bar', 1), 0);
  // Gear in the pack can.
  g.inventory.add('rune_platebody', 1);
  assert.equal(g.feedMastery('rune_platebody', 'mithril_bar', 1), 32);
  assert.ok(MASTERY_RANKS[4].points === FEED_CAP);
});

// ---------------- 3. The Offering Shrine ----------------

test('the Offering Shrine stands in Kampong Glam and opens its window', () => {
  const calls = [];
  const g = newGame(calls);
  const o = g.world.objects.find((x) => x.objId === 'offering_shrine');
  assert.ok(o, 'placed');
  assert.ok(o.x >= 44 && o.x <= 72 && o.y >= 44 && o.y <= 66, 'in Kampong Glam');
  g.player.x = g.player.tx = o.x + 1; g.player.y = g.player.ty = o.y;
  g.defaultObjectAction(o);
  for (let i = 0; i < 5 && !calls.some((c) => c[0] === 'openOfferingShrine'); i++) g.update(600);
  assert.ok(calls.some((c) => c[0] === 'openOfferingShrine'));
});

test('shrine: donations become points, points buy ranks, and the blessings reach the real combat numbers', () => {
  const g = newGame();
  assert.equal(shrineCost(1), 100); assert.equal(shrineCost(4), 800); assert.equal(shrineCost(10), 3162);
  for (let r = 2; r < 60; r++) assert.ok(shrineCost(r) > shrineCost(r - 1), 'each rank costs more');
  g.inventory.add('rune_bar', 5); g.inventory.add('feather', 30); g.inventory.add('bronze_sword', 1);
  assert.deepEqual(g.shrineDonatables().map((d) => d.id), ['rune_bar', 'feather'], 'materials only, best first');
  assert.equal(g.donateToShrine('bronze_sword', 1), 0, 'gear is not a material');
  assert.equal(g.inventory.count('bronze_sword'), 1);
  assert.equal(g.donateToShrine('feather', 10), 10);
  assert.equal(g.donateToShrine('rune_bar', Infinity), 1600);
  assert.equal(g.inventory.count('rune_bar'), 0); assert.equal(g.inventory.count('feather'), 20);
  assert.equal(g.shrine.points, 1610);
  // Might, to rank 3 (100 + 283 + 520 points): +3% Attack and Magic bonus.
  const mob = g.npcs.find((n) => n.attackable && !n.def.boss && !n.champion);
  const b0 = g.equipment.bonuses(), d0 = g._offensiveMods(mob, 'melee').dmgM;
  for (let i = 0; i < 3; i++) assert.ok(g.shrineRankUp('might'));
  assert.equal(g.shrine.rank('might'), 3);
  assert.equal(g.shrine.points, 1610 - 100 - 283 - 520);
  const b1 = g.equipment.bonuses();
  assert.equal(b1.atkPct - b0.atkPct, 3); assert.equal(b1.magPct - b0.magPct, 3);
  const d1 = g._offensiveMods(mob, 'melee').dmgM;
  assert.ok(Math.abs(d1 / d0 - (100 + b1.atkPct) / (100 + b0.atkPct)) < 1e-9, 'melee damage rises by the bonus');
  // Swiftness: attacks come quicker. Precision, Ferocity, Giantslayer: their stats.
  const speed0 = g.equipment.weaponSpeed();
  assert.ok(g.shrineRankUp('swiftness') && g.shrineRankUp('swiftness'));
  assert.ok(g.equipment.weaponSpeed() < speed0, 'attack speed counts');
  assert.ok(g.shrineRankUp('precision')); assert.ok(g.shrineRankUp('ferocity')); assert.ok(g.shrineRankUp('giantslayer'));
  const b2 = g.equipment.bonuses();
  assert.equal(b2.haste - b1.haste, 2); assert.equal(b2.crit - b1.crit, 0.5);
  assert.equal(b2.critDmg - b1.critDmg, 2); assert.equal(b2.bossDmg - b1.bossDmg, 2);
  // Not enough points: refused, nothing spent.
  const left = g.shrine.points;
  assert.ok(left < shrineCost(4));
  assert.equal(g.shrineRankUp('might'), false);
  assert.equal(g.shrine.points, left); assert.equal(g.shrine.rank('might'), 3);
  // Saved and loaded with everything intact.
  saveGame(g);
  const g2 = new Game(); g2.start(); loadGame(g2);
  assert.equal(g2.shrine.points, left);
  for (const t of SHRINE_TRACK_IDS) assert.equal(g2.shrine.rank(t), g.shrine.rank(t), t);
  assert.equal(g2.equipment.bonuses().atkPct, g.equipment.bonuses().atkPct, 'the blessing still counts after loading');
});

test('saves from before the shrine load fine and start with no blessings', () => {
  const g = newGame();
  g.equipment.mastery[g.equipment.get('weapon')] = 500;
  const data = snapshot(g);
  delete data.shrine;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const g2 = new Game(); g2.start();
  assert.equal(loadGame(g2), true);
  assert.equal(g2.shrine.points, 0);
  assert.deepEqual(g2.shrine.ranks, {});
  assert.equal(g2.equipment.masteryPoints(g.equipment.get('weapon')), 500);
  // Junk in the field is ignored.
  data.shrine = { points: -5, ranks: { might: 2.7, nonsense: 9, ferocity: 'x' } };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const g3 = new Game(); g3.start(); loadGame(g3);
  assert.equal(g3.shrine.points, 0);
  assert.deepEqual(g3.shrine.ranks, { might: 2 });
});
