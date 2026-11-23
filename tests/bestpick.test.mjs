// One upgrade rule (src/game/bestpick.js): Equip best's own test, moved out
// of game.js, and every signal that calls a piece an upgrade (the green arrow,
// the bar's count, the "Wear it" note, the hold card, the chat, bulk salvage)
// asking it. A plain Starmetal sword against a ★9 jade sword with three lines
// read "▼ Downgrade" though Equip best wears it (the ★ and lines carry over).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { EQUIP_SLOTS } from '../src/game/equipment.js';
import { compareGear, statDeltas } from '../src/game/gear.js';
import { packUpgrades } from '../src/game/whatnext.js';
import { pickGain, wouldWear, upgradeSlots, carryPreview, wornSnapshot, wornChanges } from '../src/game/bestpick.js';
import { bulkPicks, dismantleAll, salvageWarning } from '../src/game/salvage.js';

function newGame(cls) {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const s of Object.keys(g.skills.xp)) g.skills.xp[s] = xpForLevel(200);
  return g;
}

// The late-game Swordsman: jade gear, a ★9 jade sword with three lines, and a
// plain Starmetal sword in the pack with plenty of stones, wards, scrolls and coins.
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
const chatOf = (g) => { const out = []; g.bus.on('chat', (m) => out.push(m.text)); return out; };

test('Equip best puts on the same gear as before the move (recorded on main before the change)', () => {
  const g = lateGame();
  for (const [id, n, q] of [['rune_sword', 2], ['dragon_sword', 1], ['rune_platebody', 1], ['dragon_platebody', 1], ['rune_sq_shield', 2],
    ['dragon_sq_shield', 1, 'epic'], ['champions_helm', 1, 'legendary'], ['orichalcum_buckler', 1], ['occult_necklace', 1], ['eternal_staff', 1]]) g.inventory.add(id, n, q || null);
  // Every copy Equip best's test wants on, before the call: its slot must change.
  const wanted = new Set();
  for (const s of g.inventory.slots) { const p = pickGain(g, s); if (p && p.rank > 0) wanted.add(p.slot); }
  const before = wornSnapshot(g.equipment);
  const n = g.equipBest();
  const eq = g.equipment;
  assert.equal(n, 3);
  assert.deepEqual(eq.slots, { head: 'champions_helm', cape: null, amulet: null, weapon: 'starmetal_sword', body: 'jade_platebody', shield: 'orichalcum_buckler', legs: 'jade_platelegs', hands: null, feet: null, ring: 'jade_ring' });
  assert.deepEqual(Object.fromEntries(EQUIP_SLOTS.map((s) => [s, eq.qualityIn(s)])), { head: 'legendary', cape: null, amulet: null, weapon: null, body: null, shield: null, legs: null, hands: null, feet: null, ring: null });
  assert.deepEqual(eq.refines, { starmetal_sword: 9 });
  assert.deepEqual(eq.offRefines, {});
  assert.deepEqual(Object.fromEntries(Object.entries(eq.enchants).map(([k, v]) => [k, v.map((l) => `${l.stat}:${l.value}`)])), { starmetal_sword: ['crit:5', 'critDmg:15', 'atkPct:10'] });
  assert.deepEqual([...wanted].sort(), ['head', 'shield', 'weapon']);
  for (const slot of wanted) assert.notEqual(before.slots[slot], eq.get(slot), `${slot} changed`);
  assert.equal(g.equipBest(), 0, 'and a second press changes nothing');
});

test('Starmetal sword: a "downgrade" by its bare numbers, yet Equip best wears it, and every signal says so', () => {
  const g = lateGame();
  const mode = g.combatMode();
  assert.equal(compareGear('starmetal_sword', g.equipment, null, null, mode).verdict, 'downgrade', 'the bare piece is weaker');
  const s = g.inventory.slots.find((x) => x?.id === 'starmetal_sword');
  assert.ok(wouldWear(g, s), 'Equip best would put it on');
  assert.ok(packUpgrades(g).some((x) => x.id === 'starmetal_sword'), 'the "Wear it" note and the tracker count it');
  assert.ok(upgradeSlots(g).has('weapon'), 'the bar counts its slot');
  const pv = carryPreview(g, 'starmetal_sword');
  assert.equal(pv.verdict, 'upgrade');
  assert.ok(pv.worth > 0, `more damage once the carry is done (${pv.worth})`);
  assert.ok(pv.deltas.find((d) => d.key === 'attack').delta > 0, 'more Attack');
  for (const d of pv.deltas) assert.equal(Math.round(d.delta * 10) / 10, d.delta, `${d.label} ${d.delta} has at most one decimal`);
});

test('the bar counts slots, not pieces: three better square shields are one upgrade', () => {
  const g = lateGame();
  g.inventory.remove('starmetal_sword', 1);
  for (const id of ['rune_sq_shield', 'dragon_sq_shield', 'obsidian_sq_shield']) g.inventory.add(id, 1);
  const ups = g.inventory.slots.filter((s) => s && wouldWear(g, s)).map((s) => s.id);
  assert.deepEqual(ups.sort(), ['dragon_sq_shield', 'obsidian_sq_shield', 'rune_sq_shield'], 'each beats the kiteshield');
  assert.deepEqual([...upgradeSlots(g)], ['shield']);
  assert.equal(upgradeSlots(g).size, 1, 'the same answer again (from its memo)');
});

test('bulk salvage never takes a copy Equip best would wear, even with every filter off', () => {
  const g = lateGame();
  g.inventory.add('rune_sword', 3);
  const all = { offClass: false, belowTier: false, below: 'any' };
  assert.ok(!bulkPicks(g, all).some((p) => p.id === 'starmetal_sword'));
  assert.ok(bulkPicks(g, all).some((p) => p.id === 'rune_sword'), 'spare swords still go');
  assert.match(salvageWarning(g, 'starmetal_sword'), /better than what you wear/);
  assert.equal(salvageWarning(g, 'starmetal_sword').match(/better than what you wear/g).length, 1, 'said once');
  dismantleAll(g, all, { rand: () => 0.5 });
  assert.equal(g.inventory.count('starmetal_sword'), 1, 'still in the pack');
  assert.equal(g.inventory.count('rune_sword'), 0);
});

test('Equip best tells the UI what went on, and whether the ★ and lines came across', () => {
  const g = lateGame();
  const seen = [];
  g.bus.on('equipBest', (c) => seen.push(c));
  g.equipBest();
  assert.equal(seen.length, 1);
  const w = seen[0].find((c) => c.slot === 'weapon');
  assert.deepEqual({ slot: w.slot, to: w.to, carried: w.carried }, { slot: 'weapon', to: 'starmetal_sword', carried: true });
  assert.equal(w.from, 'jade_sword');
  g.equipBest();
  assert.deepEqual(seen[1], [], 'nothing changed the second time');
  // wornChanges on its own: a swap that carries nothing.
  const a = wornSnapshot(g.equipment);
  g.equipment.set('cape', 'batik_cape');
  assert.deepEqual(wornChanges(a, wornSnapshot(g.equipment)), [{ slot: 'cape', from: null, to: 'batik_cape', q: null, carried: false }]);
});

test('the chat: no "Downgrade:" for a swap the carry makes better, and the verdict follows your style otherwise', () => {
  const g = lateGame();
  const chat = chatOf(g);
  g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'starmetal_sword'));
  assert.equal(g.equipment.get('weapon'), 'starmetal_sword');
  assert.ok(!chat.some((t) => t.startsWith('Downgrade:')), chat.join(' | '));
  assert.ok(chat.some((t) => /carry over to your starmetal sword/.test(t)), 'the carry lines say what came across');
  // A swap that carries nothing: the head agrees with compareGear by Equip best's rule.
  g.inventory.add('orichalcum_buckler', 1);
  const cmp = compareGear('orichalcum_buckler', g.equipment, null, null, g.combatMode());
  chat.length = 0;
  g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'orichalcum_buckler'));
  const head = { upgrade: 'Upgrade!', downgrade: 'Downgrade:', style: 'New style:' }[cmp.verdict];
  assert.ok(chat.some((t) => t.startsWith(head)), `${head} in: ${chat.join(' | ')}`);
  assert.ok(!chat.some((t) => /\d\.\d{2,}/.test(t)), 'no float dust in the numbers');
});

test('stat changes are rounded to one decimal', () => {
  const d = statDeltas({ haste: 15.4 }, { haste: 17.8 }, 'jade_full_helm', 'jade_full_helm');
  assert.deepEqual(d, [{ key: 'haste', label: 'Attack speed %', delta: -2.4 }]);
  assert.deepEqual(statDeltas({ crit: 1.04 }, { crit: 1 }, 'jade_ring', 'jade_ring'), [], 'a change that rounds to nothing is left out');
});
