import { getItem } from '../data/items.js';

export const INV_SIZE = 28;
export const STACK_LIMIT = 100; // max quantity of one item per inventory slot

// A 28-slot inventory. Every item stacks up to STACK_LIMIT per slot; items with
// an explicit `maxStack` (e.g. coins = Infinity) override that limit.
export class Inventory {
  constructor(bus, size = INV_SIZE) {
    this.bus = bus;
    this.size = size;
    this.slots = new Array(size).fill(null);
  }

  _changed() { this.bus?.emit('inventory'); }

  /** Per-slot stack cap for an item. */
  maxStackOf(id) { return getItem(id).maxStack ?? STACK_LIMIT; }

  firstEmpty() {
    return this.slots.findIndex((s) => s === null);
  }

  freeSlots() {
    return this.slots.reduce((n, s) => (s === null ? n + 1 : n), 0);
  }

  isFull() { return this.freeSlots() === 0; }

  count(id) {
    return this.slots.reduce((n, s) => (s && s.id === id ? n + s.qty : n), 0);
  }

  has(id, qty = 1) { return this.count(id) >= qty; }

  /** How many of `id` could be added right now (top-up of partial stacks + empty slots). */
  canAdd(id, qty) {
    const max = this.maxStackOf(id);
    let space = 0;
    for (const s of this.slots) {
      if (s && s.id === id) space += Math.max(0, max - s.qty);
      else if (s === null) space += max;
      if (space >= qty) return qty;
    }
    return Math.min(qty, space);
  }

  /** Add up to `qty`; tops up partial stacks first, then fills empty slots. Returns amount added. */
  add(id, qty = 1) {
    const max = this.maxStackOf(id);
    let remaining = qty;
    for (let i = 0; i < this.size && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.qty < max) {
        const put = Math.min(max - s.qty, remaining);
        s.qty += put; remaining -= put;
      }
    }
    for (let i = 0; i < this.size && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const put = Math.min(max, remaining);
        this.slots[i] = { id, qty: put }; remaining -= put;
      }
    }
    const added = qty - remaining;
    if (added > 0) this._changed();
    return added;
  }

  /** Remove up to `qty` of `id` across slots; returns amount removed. */
  remove(id, qty = 1) {
    let toRemove = qty;
    for (let i = 0; i < this.size && toRemove > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.qty, toRemove);
      s.qty -= take;
      toRemove -= take;
      if (s.qty <= 0) this.slots[i] = null;
    }
    const removed = qty - toRemove;
    if (removed > 0) this._changed();
    return removed;
  }

  removeAt(index, qty = 1) {
    const s = this.slots[index];
    if (!s) return 0;
    const take = Math.min(s.qty, qty);
    s.qty -= take;
    if (s.qty <= 0) this.slots[index] = null;
    this._changed();
    return take;
  }

  slotAt(index) { return this.slots[index]; }

  swap(i, j) {
    [this.slots[i], this.slots[j]] = [this.slots[j], this.slots[i]];
    this._changed();
  }

  clear() {
    this.slots = new Array(this.size).fill(null);
    this._changed();
  }

  serialize() {
    return this.slots.map((s) => (s ? { id: s.id, qty: s.qty } : null));
  }

  load(data) {
    if (!Array.isArray(data)) return;
    this.slots = new Array(this.size).fill(null);
    for (let i = 0; i < Math.min(this.size, data.length); i++) {
      const s = data[i];
      if (s && s.id && getItemSafe(s.id)) this.slots[i] = { id: s.id, qty: s.qty };
    }
    this._changed();
  }
}

function getItemSafe(id) {
  try { return getItem(id); } catch { return null; }
}
