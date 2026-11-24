// Offering Shrine hotkeys for single items (src/ui/shrinehot.js): pointing at
// a row, or at an item in the bag, and pressing 1 / 5 / X / A offers it.
// Materials, plain goods and plain spare gear go at once; boss uniques,
// signature weapons, Epic-or-better copies, upgrades, tools and enchanting
// supplies ask first and go on a second press of the same key.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { hotOffer, HOT_HINT } from '../src/ui/shrinehot.js';
import { salvageWarning, isUniqueGear } from '../src/game/salvage.js';
import { materialPoints } from '../src/game/materials.js';
import { goodsKind } from '../src/game/offerings.js';
import { shrineGearSection } from '../src/ui/salvageui.js';
import { shrineGoodsSection } from '../src/ui/shrineui.js';
import { ITEMS } from '../src/data/items.js';

const setup = () => {
  const g = freshGame('swordsman');
  return { g, ui: { game: g }, st: { pending: null, result: null }, sg: { pending: null, result: null } };
};
const itemIds = () => (Array.isArray(ITEMS) ? ITEMS.map((i) => i.id) : Object.keys(ITEMS));

test('a boss unique asks on the first press and is offered on the second press of the same key', () => {
  const { g, ui, st, sg } = setup();
  const id = 'tiger_kris';
  assert.ok(isUniqueGear(id));
  g.inventory.add(id, 1);
  const before = g.shrine.points;
  assert.equal(hotOffer(ui, st, sg, id, 1), 'asked');
  assert.equal(g.inventory.count(id), 1, 'nothing offered on the first press');
  assert.ok(st.pending && /boss unique/.test(st.pending.warn), 'the confirmation says why');
  assert.equal(hotOffer(ui, st, sg, id, 1), 'offered');
  assert.equal(g.inventory.count(id), 0);
  assert.ok(g.shrine.points > before, 'points were added');
  assert.equal(st.pending, null);
  assert.match(st.result, /Offered 1 x/);
});

test('a different key or item on the second press asks afresh instead of offering', () => {
  const { g, ui, st, sg } = setup();
  g.inventory.add('tiger_kris', 1);
  g.inventory.add('merlion_blade', 1);
  assert.equal(hotOffer(ui, st, sg, 'tiger_kris', 1), 'asked');
  assert.equal(hotOffer(ui, st, sg, 'merlion_blade', 1), 'asked', 'another item: a new question');
  assert.equal(g.inventory.count('tiger_kris'), 1);
  assert.equal(g.inventory.count('merlion_blade'), 1);
  assert.equal(hotOffer(ui, st, sg, 'merlion_blade', 1), 'offered');
  assert.equal(g.inventory.count('merlion_blade'), 0);
  assert.equal(g.inventory.count('tiger_kris'), 1, 'the first one is still there');
});

test('plain spare gear goes on one press; A offers every copy', () => {
  const { g, ui, st, sg } = setup();
  // A piece the warning rules let through (not better than what is worn, not unique, plain).
  const id = ['bronze_dagger', 'bronze_sword', 'iron_dagger', 'leather_gloves', 'leather_boots', 'bronze_med_helm', 'wooden_shield']
    .find((x) => itemIds().includes(x) && !isUniqueGear(x) && (g.inventory.add(x, 1), !salvageWarning(g, x)) );
  assert.ok(id, 'found a plain spare piece');
  g.inventory.add(id, 2);
  const n = g.inventory.count(id);
  assert.ok(n >= 3);
  assert.equal(hotOffer(ui, st, sg, id, 1), 'offered');
  assert.equal(g.inventory.count(id), n - 1);
  assert.equal(hotOffer(ui, st, sg, id, Infinity), 'offered');
  assert.equal(g.inventory.count(id), 0);
});

test('materials and plain goods go on one press; tools ask first', () => {
  const { g, ui, st, sg } = setup();
  const mat = itemIds().find((x) => materialPoints(x) > 0);
  const food = itemIds().find((x) => goodsKind(x) === 'food');
  const tool = itemIds().find((x) => goodsKind(x) === 'tool');
  g.inventory.add(mat, 10); g.inventory.add(food, 10); g.inventory.add(tool, 1);
  assert.equal(hotOffer(ui, st, sg, mat, 5), 'offered');
  assert.equal(g.inventory.count(mat), 5);
  assert.equal(hotOffer(ui, st, sg, food, 10), 'offered');
  assert.equal(g.inventory.count(food), 0);
  assert.match(sg.result, /Offered 10 x/);
  const had = g.inventory.count(tool);
  assert.equal(hotOffer(ui, st, sg, tool, 1), 'asked');
  assert.equal(g.inventory.count(tool), had);
  assert.equal(hotOffer(ui, st, sg, tool, 1), 'offered');
  assert.equal(g.inventory.count(tool), had - 1);
});

test('coins are refused with a reason, and nothing in the pack does nothing', () => {
  const { g, ui, st, sg } = setup();
  g.inventory.add('coins', 100);
  assert.equal(hotOffer(ui, st, sg, 'coins', 1), '');
  assert.match(sg.result, /coins/);
  assert.equal(hotOffer(ui, st, sg, 'tiger_kris', 1), '', 'not carried');
  assert.match(HOT_HINT, /press the key again/);
});

test('the gear and goods rows are hot and pass their item to the hotkey', () => {
  const { g, ui, st, sg } = setup();
  g.inventory.add('tiger_kris', 1);
  const food = itemIds().find((x) => goodsKind(x) === 'food');
  g.inventory.add(food, 3);
  const rows = [];
  const el = (tag = 'div') => {
    const e = { tag, className: '', textContent: '', disabled: false, children: [], dataset: {}, _html: '',
      get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
      appendChild(c) { this.children.push(c); if (/gear-row/.test(c.className || '')) rows.push(c); return c; },
      insertAdjacentHTML() {}, addEventListener() {}, querySelector: () => el(), querySelectorAll: () => [] };
    return e;
  };
  const had = globalThis.document;
  globalThis.document = { createElement: el };
  const got = [];
  try {
    shrineGearSection(ui, el(), st, () => {}, (id, n) => got.push([id, n]));
    shrineGoodsSection(ui, el(), sg, () => {}, (id, n) => got.push([id, n]));
  } finally { globalThis.document = had; }
  const hot = rows.filter((r) => /\bhot\b/.test(r.className));
  assert.ok(hot.length >= 2, 'both lists have hot rows');
  for (const r of hot) r._hot(5);
  assert.ok(got.some(([id, n]) => id === 'tiger_kris' && n === 5));
  assert.ok(got.some(([id, n]) => id === food && n === 5));
});
