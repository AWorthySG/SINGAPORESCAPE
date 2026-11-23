// Refine and enchant runs and "Improve worn gear" (src/game/smartgear.js):
// every attempt is the game's own refineItem / pickEnchant / rerollEnchant /
// feedMastery at the usual cost and odds, so balance is unchanged; the runs
// only decide when to stop. These check the stop rules, that the same rolls
// give the same result as tapping by hand, that no run passes its limits or
// risks a piece, and that Improve spends exactly what its plan says.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { EQUIP_SLOTS } from '../src/game/equipment.js';
import { enchantCost, enchantValue } from '../src/game/mastery.js';
import { mulberry32 } from '../src/game/pets.js';
import {
  SAFE_REFINE, quiet, refineStop, refineForecast, refineDefaults, runRefine, enchantStep, enchantMaxSpend, affordablePicks,
  enchantForecast, runEnchant, bestAim, lineWorth, wornPieces, improvePlan, runImprove, improveCount,
} from '../src/game/smartgear.js';

function newGame(cls) {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const s of Object.keys(g.skills.xp)) g.skills.xp[s] = xpForLevel(200);
  return g;
}
// The late-game Swordsman (as in bestpick.test.mjs).
function lateGame() {
  const g = newGame('swordsman');
  for (const s of EQUIP_SLOTS) g.equipment.clearSlot(s);
  g.inventory.clear();
  for (const [s, id] of [['weapon', 'jade_sword'], ['head', 'jade_full_helm'], ['body', 'jade_platebody'], ['legs', 'jade_platelegs'], ['shield', 'jade_kiteshield'], ['ring', 'jade_ring']]) g.equipment.set(s, id);
  g.equipment.refines.jade_sword = 9;
  g.equipment.enchants.jade_sword = [{ stat: 'crit', value: 5 }, { stat: 'critDmg', value: 15 }, { stat: 'atkPct', value: 10 }];
  g.inventory.add('starmetal_sword', 1);
  g.inventory.add('upgrade_stone', 600); g.inventory.add('upgrade_ward', 12); g.inventory.add('refine_scroll', 300); g.inventory.add('coins', 2e7);
  return g;
}
/** Set the pack to exactly `n` of `id`. */
const setCount = (g, id, n) => { g.inventory.remove(id, g.inventory.count(id)); if (n) g.inventory.add(id, n); };
/** A roll sequence that repeats `rolls` for ever. */
const scripted = (rolls) => { let i = 0; return () => rolls[i++ % rolls.length]; };

// ---------------- Refine ----------------

test('refineStop: every reason, and ★1–★9 never wait for a ward', () => {
  const o = { target: 12, maxScrolls: 40, maxWards: 2, allowDowngrade: false };
  const st = (x) => ({ level: 9, used: 0, wardsUsed: 0, packScrolls: 100, packWards: 5, ...x });
  assert.equal(refineStop(st({}), o), null, 'a try it may make');
  assert.equal(refineStop(st({ level: 12 }), o), 'target');
  assert.equal(refineStop(st({ level: 15 }), { ...o, target: 99 }), 'target', 'nothing past ★15');
  assert.equal(refineStop(st({ used: 38 }), o), 'scrollcap', '38 + 3 is over 40');
  assert.equal(refineStop(st({ packScrolls: 2 }), o), 'scrolls');
  assert.equal(refineStop(st({ wardsUsed: 2 }), o), 'wardcap', 'refineItem would spend a third pack ward on its own');
  assert.equal(refineStop(st({ packWards: 0 }), o), 'downgrade', 'from ★10 a bad roll costs a level');
  assert.equal(refineStop(st({ packWards: 0 }), { ...o, allowDowngrade: true }), null, '...unless you allow it');
  assert.equal(refineStop(st({ level: 12, packWards: 0 }), { ...o, target: 15, allowDowngrade: true }), 'break', 'never a try that could break it');
  for (let lv = 0; lv < SAFE_REFINE; lv++) {
    assert.equal(refineStop({ level: lv, used: 0, wardsUsed: 99, packScrolls: 100, packWards: 5 }, { target: 9, maxScrolls: 100, maxWards: 0, allowDowngrade: false }), null, `★${lv + 1} needs no ward`);
    assert.equal(refineStop({ level: lv, used: 0, wardsUsed: 0, packScrolls: 100, packWards: 0 }, { target: 9, maxScrolls: 100, maxWards: 0, allowDowngrade: false }), null);
  }
});

test('refineForecast: sure climbs, seeded answers, starts that can\'t, and limits it never passes', () => {
  const sure = refineForecast(0, { target: 5, maxScrolls: 5, maxWards: 0, allowDowngrade: false, packScrolls: 5, packWards: 0 });
  assert.equal(sure.reach, 1);
  assert.equal(sure.scrolls.avg, 5);
  assert.equal(sure.scrolls.max, 5);
  const o = { target: 12, maxScrolls: 40, maxWards: 4, allowDowngrade: false, packScrolls: 300, packWards: 12 };
  assert.deepEqual(refineForecast(9, o), refineForecast(9, o), 'the same settings, the same numbers');
  assert.equal(refineForecast(9, { ...o, packWards: 0 }).startStop, 'downgrade');
  for (const level of [0, 5, 9, 11, 12, 14]) for (const maxScrolls of [3, 10, 40]) for (const maxWards of [0, 1, 3]) {
    const f = refineForecast(level, { target: 15, maxScrolls, maxWards, allowDowngrade: level < 12, packScrolls: 200, packWards: 5 }, { runs: 200 });
    assert.ok(f.scrolls.max <= maxScrolls, `★${level}: ${f.scrolls.max} scrolls at most ${maxScrolls}`);
    assert.ok(f.wards.max <= maxWards, `★${level}: ${f.wards.max} wards at most ${maxWards}`);
  }
});

test('refineDefaults: the next stop, room for nine runs in ten, within what you carry', () => {
  const g = lateGame();
  const d = refineDefaults(g, 'jade_sword');
  assert.equal(d.target, 12);
  assert.ok(d.maxScrolls % 5 === 0 && d.maxScrolls <= 300 && d.maxScrolls >= 3, `${d.maxScrolls}`);
  assert.ok(d.maxWards >= 1 && d.maxWards <= 12);
  assert.equal(refineDefaults(g, 'jade_platebody').target, SAFE_REFINE);
  assert.equal(refineDefaults(g, 'jade_platebody').maxWards, 0, 'no wards below ★10');
  g.equipment.refines.jade_ring = 15;
  assert.equal(refineDefaults(g, 'jade_ring'), null, 'nothing to do at ★15');
});

test('a run makes the same tries as tapping by hand: the same rolls end at the same ★, scrolls and wards', () => {
  const rolls = [0.1, 0.9, 0.5, 0.7, 0.95, 0.2, 0.6, 0.3, 0.85, 0.05, 0.4, 0.99, 0.15];
  const o = { target: 13, maxScrolls: 40, maxWards: 3, allowDowngrade: false };
  const a = lateGame(), b = lateGame();
  const r = runRefine(a, 'jade_sword', o, { rand: scripted(rolls) });
  // By hand on the twin game: the same stop rule, refineItem with the same rolls.
  const next = scripted(rolls);
  let used = 0, wards = 0;
  for (;;) {
    const st = { level: b.equipment.refineLevel('jade_sword'), used, wardsUsed: wards, packScrolls: b.inventory.count('refine_scroll'), packWards: b.inventory.count('upgrade_ward') };
    if (refineStop(st, o)) break;
    b.refineItem('jade_sword', next());
    used += st.packScrolls - b.inventory.count('refine_scroll');
    wards += st.packWards - b.inventory.count('upgrade_ward');
  }
  assert.equal(r.to, b.equipment.refineLevel('jade_sword'));
  assert.equal(r.scrolls, used);
  assert.equal(r.wards, wards);
  assert.equal(a.inventory.count('refine_scroll'), b.inventory.count('refine_scroll'));
  assert.equal(a.inventory.count('upgrade_ward'), b.inventory.count('upgrade_ward'));
  assert.ok(r.tries >= 5, `${r.tries} tries`);
});

test('30 seeds: a run to ★15 keeps to its limits and never breaks the sword', () => {
  const g = lateGame();
  for (let seed = 1; seed <= 30; seed++) {
    g.equipment.refines.jade_sword = 9;
    setCount(g, 'refine_scroll', 60); setCount(g, 'upgrade_ward', 3);
    const r = runRefine(g, 'jade_sword', { target: 15, maxScrolls: 40, maxWards: 2, allowDowngrade: false }, { rand: mulberry32(seed) });
    assert.ok(r.scrolls <= 40, `seed ${seed}: ${r.scrolls} scrolls`);
    assert.ok(r.wards <= 2, `seed ${seed}: ${r.wards} wards`);
    assert.equal(60 - g.inventory.count('refine_scroll'), r.scrolls);
    assert.equal(r.outcomes.broken, 0);
    assert.notEqual(r.stop, 'broken');
    assert.equal(g.equipment.get('weapon'), 'jade_sword', 'still worn');
    assert.ok(r.to >= 9, `seed ${seed}: no level lost (★${r.to})`);
  }
});

test('quiet: a long run tells the chat, the sound and the bag once, and puts the bus back even after a throw', () => {
  const g = lateGame();
  g.equipment.refines.jade_platebody = 0;
  const seen = { chat: 0, sfx: 0, inventory: 0 };
  for (const ev of Object.keys(seen)) g.bus.on(ev, () => { seen[ev]++; });
  // ★1–★5 always work; from ★6 every other roll fails: 13 tries.
  const r = runRefine(g, 'jade_platebody', { target: 9, maxScrolls: 100, maxWards: 0, allowDowngrade: false }, { rand: scripted([0.1, 0.1, 0.1, 0.1, 0.1, 0.99, 0.1]) });
  assert.ok(r.tries >= 10, `${r.tries} tries`);
  assert.equal(r.to, 9);
  assert.ok(seen.chat <= 1 && seen.sfx <= 1 && seen.inventory <= 2, JSON.stringify(seen));
  assert.equal(seen.chat, 1, 'one summary line');
  const emit = g.bus.emit;
  assert.throws(() => quiet(g, () => { throw new Error('boom'); }), /boom/);
  assert.equal(g.bus.emit, emit, 'emit is back');
  assert.ok(!Object.prototype.hasOwnProperty.call(g.bus, 'emit'), 'no wrapper left on the bus');
  assert.ok(!g.inventory._held, 'the pack tells its listeners again');
});

// ---------------- Enchant ----------------

const W = { atkPct: 3, critDmg: 1.5, crit: 2.5, haste: 1, pierce: 2 };
const worth = (l) => (W[l.stat] || 0) * l.value / 4;
const L = (stat, value = 4) => ({ stat, value });

test('enchantStep: each rule', () => {
  const aim = ['atkPct', 'crit', null];
  assert.deepEqual(enchantStep([L('atkPct', 7), L('crit')], [L('pierce')], aim, worth, false), { done: true });
  // An aimed offer goes over the spare line worth least, never over the kept atkPct.
  const full = [L('atkPct', 7), L('haste'), L('lifesteal')];
  assert.deepEqual(enchantStep(full, [L('crit'), L('pierce'), L('bossDmg', 9)], aim, worth, false), { pick: 0, replace: 2 });
  // Not full, nothing aimed on offer: a ward rerolls when allowed, else a pick fills a slot.
  const two = [L('atkPct', 7)];
  assert.deepEqual(enchantStep(two, [L('pierce'), L('bossDmg', 9), L('lifesteal')], aim, worth, true), { reroll: true });
  assert.deepEqual(enchantStep(two, [L('pierce'), L('bossDmg', 9), L('lifesteal')], aim, worth, false), { pick: 0, replace: null, fill: true });
  // Full: the same line again, at least as big, a spare one first.
  assert.deepEqual(enchantStep(full, [L('atkPct', 7), L('haste'), L('bossDmg', 9)], aim, worth, false), { pick: 1, replace: 1, same: true });
  // Full: the line worth most (crit damage 11 here) over the spare one worth least, sideways.
  assert.deepEqual(enchantStep(full, [L('pierce'), L('bossDmg', 9), L('critDmg', 11)], aim, worth, false), { pick: 2, replace: 2, sideways: true });
  // Nothing that wouldn't weaken a line.
  assert.deepEqual(enchantStep([L('atkPct', 7), L('haste'), L('pierce')], [L('lifesteal'), L('bossDmg', 9)], aim, worth, false), { stop: 'no-safe-pick' });
});

test('enchantMaxSpend and affordablePicks', () => {
  assert.deepEqual(enchantMaxSpend('jade_sword', 1, 3), { stones: 25 + 50 + 50, coins: 3 * enchantCost('jade_sword', 0).coins });
  const g = lateGame();
  setCount(g, 'upgrade_stone', 125); setCount(g, 'coins', 1e9);
  assert.equal(affordablePicks(g, 'jade_platebody'), 3, '10 + 25 + 50 = 85 fits in 125 stones; a fourth (135) does not');
  setCount(g, 'coins', enchantCost('jade_platebody', 0).coins * 2);
  assert.equal(affordablePicks(g, 'jade_platebody'), 2, 'coins can be the limit too');
});

test('runEnchant: a full piece gets the aimed lines, paying exactly each pick\'s cost, never losing an aimed line', () => {
  const g = lateGame();
  const v = (s) => enchantValue('jade_sword', s);
  g.equipment.enchants.jade_sword = [L('lifesteal', v('lifesteal')), L('bossDmg', v('bossDmg')), L('haste', v('haste'))];
  const aim = ['atkPct', 'critDmg', 'crit'];
  const count = (st) => g.equipment.enchantLines('jade_sword').filter((l) => l.stat === st).length;
  const pick = g.pickEnchant.bind(g);
  let costs = 0, drops = 0;
  g.pickEnchant = (id, i, rep, copy) => {
    const before = aim.map(count), c = g.enchantCostFor(id, copy);
    const out = pick(id, i, rep, copy);
    if (out) costs += c.stones;
    aim.forEach((st, k) => { if (count(st) < before[k]) drops++; });
    return out;
  };
  const stones = g.inventory.count('upgrade_stone'), wards = g.inventory.count('upgrade_ward');
  const r = runEnchant(g, 'jade_sword', { aim, maxPicks: 20, maxWards: 0 });
  assert.ok(r.stop === 'done' || r.stop === 'budget', r.stop);
  assert.equal(stones - g.inventory.count('upgrade_stone'), costs, 'exactly what each pick cost');
  assert.equal(r.stones, costs);
  assert.equal(g.inventory.count('upgrade_ward'), wards, 'no ward used');
  assert.equal(drops, 0, 'no aimed line was ever lost');
  assert.ok(r.picks <= 20);
});

test('bestAim: three lines that add damage, never lifesteal or boss damage', () => {
  const g = lateGame();
  const aim = bestAim(g, 'jade_sword');
  assert.equal(aim.length, 3, aim.join());
  assert.ok(aim.every((s) => s !== 'lifesteal' && s !== 'bossDmg'), aim.join());
});

test('enchantForecast: seeded, and within its try limit', () => {
  const g = lateGame();
  const offers = g.enchantOffers('jade_platebody'), w = lineWorth(g, 'jade_platebody');
  const f = enchantForecast('jade_platebody', [], offers, ['atkPct', 'crit', null], w, { maxPicks: 8, runs: 300 });
  assert.deepEqual(f, enchantForecast('jade_platebody', [], offers, ['atkPct', 'crit', null], w, { maxPicks: 8, runs: 300 }));
  assert.ok(f.done > 0.5, `${f.done}`);
  assert.ok(f.picks.p90 <= 8);
});

// ---------------- Improve worn gear ----------------

test('Improve spends exactly what its plan says, never a ward, and keeps every piece within ★9', () => {
  const g = lateGame();
  Object.assign(g.equipment.refines, { jade_full_helm: 3, jade_platebody: 5, jade_kiteshield: 2, jade_ring: 4 });
  g.equipment.enchants.jade_full_helm = [L('crit', enchantValue('jade_full_helm', 'crit'))];
  g.equipment.enchants.jade_platebody = [L('crit', 4), L('pierce', 4)];
  g.inventory.add('mithril_bar', 300);
  const from = Object.fromEntries(wornPieces(g).map((p) => [p.id, g.equipment.refineLevel(p.id)]));
  const plan = improvePlan(g);
  assert.ok(plan.count >= 5, `${plan.count} pieces`);
  const stones = g.inventory.count('upgrade_stone'), coins = g.inventory.count('coins'), scrolls = g.inventory.count('refine_scroll'), wards = g.inventory.count('upgrade_ward');
  const mats = plan.materials.map(([id]) => [id, g.inventory.count(id)]);
  const r = runImprove(g, plan, { rand: mulberry32(7) });
  assert.equal(stones - g.inventory.count('upgrade_stone'), plan.fill.stones);
  assert.equal(coins - g.inventory.count('coins'), plan.fill.coins);
  for (const [id, n] of mats) assert.equal(n - g.inventory.count(id), plan.materials.find(([m]) => m === id)[1], `${id} as planned`);
  assert.ok(scrolls - g.inventory.count('refine_scroll') <= plan.refine.max, 'within the scroll cap');
  assert.equal(r.used.scrolls, scrolls - g.inventory.count('refine_scroll'));
  assert.equal(g.inventory.count('upgrade_ward'), wards, 'no ward touched');
  for (const p of wornPieces(g)) {
    const lv = g.equipment.refineLevel(p.id, p.copy);
    assert.ok(lv >= from[p.id], `${p.id} lost no level`);
    assert.ok(lv <= Math.max(SAFE_REFINE, from[p.id]), `${p.id} not past ★9`);
  }
  assert.equal(g.equipment.refineLevel('jade_sword'), 9, 'the ★9 sword is left alone');
  assert.equal(g.equipment.enchantLines('jade_platebody').length, 3, 'empty lines filled');
});

test('Improve works on a twin pair\'s off-hand copy too', () => {
  const g = newGame('rogue');
  for (const s of EQUIP_SLOTS) g.equipment.clearSlot(s);
  g.inventory.clear();
  g.equipment.set('weapon', 'rune_dagger'); g.equipment.set('shield', 'rune_dagger');
  g.inventory.add('refine_scroll', 100);
  const pieces = wornPieces(g);
  assert.deepEqual(pieces.map((p) => `${p.id}:${p.copy}`), ['rune_dagger:main', 'rune_dagger:off']);
  runImprove(g, improvePlan(g, { fill: false, feed: false }), { rand: mulberry32(3) });
  assert.ok(g.equipment.offRefines.rune_dagger > 0, `off-hand copy ★${g.equipment.offRefines.rune_dagger}`);
  assert.ok(g.equipment.refines.rune_dagger > 0);
});

test('improveCount: pieces with a safe step you can pay for now', () => {
  const g = lateGame();
  assert.ok(improveCount(g) > 0);
  setCount(g, 'refine_scroll', 0); setCount(g, 'upgrade_stone', 0);
  assert.equal(improveCount(g), 0, 'no scrolls, no stones, no materials: nothing');
  g.inventory.add('mithril_bar', 5);
  assert.ok(improveCount(g) > 0, 'a bar that feeds plate');
});
