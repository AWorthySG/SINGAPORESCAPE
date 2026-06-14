import { test } from 'node:test';
import assert from 'node:assert/strict';

import { XP_TABLE, levelForXp, xpForLevel, levelProgress, xpToNext } from '../src/data/xp.js';
import { Inventory } from '../src/game/inventory.js';
import { Skills } from '../src/game/skillset.js';
import { Bank } from '../src/game/bank.js';
import { EventBus } from '../src/core/events.js';
import { findPath } from '../src/engine/pathfinding.js';
import { hitChance, maxHit, attackRoll, combatXp } from '../src/game/combat.js';
import { gatherChance } from '../src/game/skilling.js';
import { XP_RATE } from '../src/config.js';

test('OSRS xp table matches known values', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 83);
  assert.equal(xpForLevel(10), 1154);
  assert.equal(xpForLevel(99), 13034431);
  assert.equal(XP_TABLE.length, 100);
});

test('levelForXp inverts the table', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(82), 1);
  assert.equal(levelForXp(83), 2);
  assert.equal(levelForXp(13034431), 99);
  assert.equal(levelForXp(999_999_999), 99);
});

test('level progress and xp-to-next are sane', () => {
  assert.ok(levelProgress(0) === 0);
  assert.equal(xpToNext(0), 83);
  assert.equal(xpToNext(13034431), 0);
});

test('inventory stacks stackables and fills slots otherwise', () => {
  const inv = new Inventory(new EventBus());
  assert.equal(inv.add('coins', 100), 100);
  assert.equal(inv.add('coins', 50), 50);
  assert.equal(inv.count('coins'), 150);
  assert.equal(inv.freeSlots(), 27); // coins use one slot

  assert.equal(inv.add('logs', 5), 5);
  assert.equal(inv.freeSlots(), 22);
  assert.equal(inv.remove('logs', 3), 3);
  assert.equal(inv.count('logs'), 2);
});

test('inventory respects capacity for non-stackables', () => {
  const inv = new Inventory(new EventBus());
  assert.equal(inv.add('bones', 100), 28); // only 28 slots
  assert.ok(inv.isFull());
  assert.equal(inv.canAdd('bones', 5), 0);
  assert.equal(inv.canAdd('coins', 5), 0); // no slot for a new stack
});

test('skills start at the buffed baseline and level up via xp', () => {
  const skills = new Skills(new EventBus());
  assert.equal(skills.hitpoints, 15);
  assert.equal(skills.attack, 5);
  assert.equal(skills.strength, 5);
  assert.equal(skills.defence, 5);
  assert.equal(skills.combatLevel(), 8);

  const baseline = xpForLevel(5);
  skills.addXp('attack', 100);
  assert.equal(skills.xp.attack, baseline + 100 * XP_RATE); // XP rate is applied
  assert.ok(skills.attack > 5);
});

test('loading a weak save floors stats to the baseline', () => {
  const skills = new Skills(new EventBus());
  skills.load({ attack: 0, strength: 0, defence: 0, hitpoints: 0, woodcutting: 5000 });
  assert.equal(skills.attack, 5);
  assert.equal(skills.strength, 5);
  assert.equal(skills.hitpoints, 15);
  assert.ok(skills.level('woodcutting') > 1); // existing progress preserved
});

test('combat formulas produce valid ranges', () => {
  assert.ok(maxHit(1, 0, 0) >= 1);
  assert.ok(maxHit(99, 3, 14) > maxHit(1, 0, 0));
  const hc = hitChance(attackRoll(50, 3, 20), attackRoll(20, 0, 0));
  assert.ok(hc > 0 && hc <= 1);
  const xp = combatXp('aggressive', 10);
  assert.deepEqual(xp.find((x) => x.skill === 'strength').xp, 40);
});

test('gather chance stays within bounds and scales with level', () => {
  const lo = gatherChance(0.4, 0.95, 1);
  const hi = gatherChance(0.4, 0.95, 99);
  assert.ok(lo >= 0.05 && lo <= 0.99);
  assert.ok(hi > lo);
});

test('bank deposits and withdraws', () => {
  const bank = new Bank(new EventBus());
  bank.deposit('iron_ore', 10);
  bank.deposit('iron_ore', 5);
  assert.equal(bank.count('iron_ore'), 15);
  assert.equal(bank.withdraw('iron_ore', 20), 15);
  assert.equal(bank.count('iron_ore'), 0);
});

test('pathfinding finds a diagonal path on open ground', () => {
  const cfg = { width: 5, height: 5, isBlocked: () => false };
  const path = findPath(cfg, { x: 0, y: 0 }, { x: 4, y: 4 });
  assert.equal(path.length, 4);
  assert.deepEqual(path[path.length - 1], { x: 4, y: 4 });
});

test('pathfinding returns empty when unreachable', () => {
  const cfg = { width: 5, height: 5, isBlocked: (x) => x === 2 };
  const path = findPath(cfg, { x: 0, y: 0 }, { x: 4, y: 4 });
  assert.equal(path.length, 0);
});

test('pathfinding reachAdjacent stops next to a blocked target', () => {
  const cfg = { width: 5, height: 5, isBlocked: (x, y) => x === 2 && y === 2 };
  const path = findPath(cfg, { x: 0, y: 0 }, { x: 2, y: 2 }, { reachAdjacent: true });
  assert.ok(path.length > 0);
  const last = path[path.length - 1];
  assert.ok(Math.max(Math.abs(last.x - 2), Math.abs(last.y - 2)) <= 1);
  assert.ok(!(last.x === 2 && last.y === 2));
});

test('pathfinding does not cut blocked corners', () => {
  // From (0,0) to (1,1) with both orthogonal neighbours blocked => no path.
  const cfg = { width: 2, height: 2, isBlocked: (x, y) => (x === 1 && y === 0) || (x === 0 && y === 1) };
  const path = findPath(cfg, { x: 0, y: 0 }, { x: 1, y: 1 });
  assert.equal(path.length, 0);
});
