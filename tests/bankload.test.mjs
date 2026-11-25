// A save's bank loads in one go (Bank.load): the same entries in the same
// order as depositing them one at a time did, but with one change at the end
// instead of one per item (each change re-read the whole bank for the
// encyclopedia, so a full bank took a phone a good fraction of a second).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bank } from '../src/game/bank.js';
import { EventBus } from '../src/core/events.js';
import { ITEMS, getItem } from '../src/data/items.js';

/** How the bank loaded before: deposit() an entry at a time. */
function loadOneByOne(bank, data) {
  bank.items = [];
  const safe = (id) => { try { getItem(id); return true; } catch { return false; } };
  for (const e of data) if (e && e.id && e.qty > 0 && safe(e.id)) bank.deposit(e.id, e.qty, e.q);
}

test('a bank loads all at once exactly as deposited one by one, and says so once', () => {
  const ids = Object.keys(ITEMS);
  const gear = ids.filter((id) => ITEMS[id].equip).slice(0, 80);
  // A big, untidy save: every item, repeats to merge, quality copies (some
  // plain, some unknown), junk entries, an item that no longer exists.
  const data = ids.map((id, i) => ({ id, qty: 1 + (i * 37) % 900 }));
  for (const [i, id] of gear.entries()) data.push({ id, qty: 2, q: ['fine', 'superior', 'epic', 'nonsense', null][i % 5] });
  data.push({ id: ids[3], qty: 7 }, { id: gear[0], qty: 1, q: 'fine' }, { id: 'no_such_item', qty: 5 }, { id: ids[9], qty: 0 }, null, { qty: 3 }, { id: ids[11], qty: -2 });
  const bus = new EventBus();
  let changes = 0;
  bus.on('bank', () => changes++);
  const bank = new Bank(bus);
  bank.load(data);
  assert.equal(changes, 1, 'one change for the whole load');
  const ref = new Bank(null);
  loadOneByOne(ref, data);
  assert.deepEqual(bank.items, ref.items, 'same entries, same order, same quantities and qualities');
  assert.deepEqual(bank.serialize(), ref.serialize());
  assert.ok(bank.items.length > ids.length, 'quality copies kept apart');
  // Loading again replaces, as before.
  bank.load([{ id: ids[0], qty: 1 }]);
  assert.deepEqual(bank.serialize(), [{ id: ids[0], qty: 1 }]);
  bank.load('not a list');
  assert.deepEqual(bank.serialize(), [{ id: ids[0], qty: 1 }], 'a bad save leaves the bank alone');
});
