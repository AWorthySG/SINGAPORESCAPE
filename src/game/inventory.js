import { getItem } from '../data/items.js';

export const INV_SIZE = 28;
export const STACK_LIMIT = 100; // max quantity of one item per inventory slot

// An unlimited inventory: it starts with 28 slots and grows as it fills,
// always keeping a row of empty slots open. Every item stacks up to
// STACK_LIMIT per slot; items with an explicit `maxStack` (e.g. coins =
// Infinity) override that limit.
const SPARE = 4;   // empty slots kept open at the end (one grid row)
export class Inventory {
  constructor(bus, size = INV_SIZE) {
    this.bus = bus;
    this.minSize = size;
    this.slots = new Array(size).fill(null);
  }

  get size() { return this.slots.length; }

  _changed() { this._pad(); this.bus?.emit('inventory'); }

  /** Keep at least `minSize` slots and a spare row of empty slots at the end. */
  _pad() {
    let free = 0;
    for (let i = this.slots.length - 1; i >= 0 && this.slots[i] === null; i--) free++;
    while (free < SPARE) { this.slots.push(null); free++; }
    while (this.slots.length < this.minSize) this.slots.push(null);
    // Trim surplus trailing empties (down to the spare row) after big removals.
    while (this.slots.length > this.minSize && free > SPARE && this.slots[this.slots.length - 1] === null) { this.slots.pop(); free--; }
  }

  /** Per-slot stack cap for an item. */
  maxStackOf(id) { return getItem(id).maxStack ?? STACK_LIMIT; }

  firstEmpty() {
    return this.slots.findIndex((s) => s === null);
  }

  freeSlots() { return Infinity; }   // it always has room

  isFull() { return false; }

  count(id) {
    return this.slots.reduce((n, s) => (s && s.id === id ? n + s.qty : n), 0);
  }

  has(id, qty = 1) { return this.count(id) >= qty; }

  /** How many of `id` could be added right now: always all of it. */
  canAdd(id, qty) { return qty; }

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
    while (remaining > 0) {           // out of empty slots: grow
      const put = Math.min(max, remaining);
      this.slots.push({ id, qty: put }); remaining -= put;
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
    this.slots = new Array(this.minSize).fill(null);
    this._changed();
  }

  serialize() {
    return this.slots.map((s) => (s ? { id: s.id, qty: s.qty } : null));
  }

  load(data) {
    if (!Array.isArray(data)) return;
    this.slots = new Array(Math.max(this.minSize, data.length)).fill(null);
    for (let i = 0; i < data.length; i++) {
      const s = data[i];
      if (s && s.id && getItemSafe(s.id)) this.slots[i] = { id: s.id, qty: s.qty };
    }
    this._changed();
  }
}

function getItemSafe(id) {
  try { return getItem(id); } catch { return null; }
}
