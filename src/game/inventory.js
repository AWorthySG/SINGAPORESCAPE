import { getItem } from '../data/items.js';

export const INV_SIZE = 28;

// A 28-slot inventory. Slots hold { id, qty } or null. Stackable items merge.
export class Inventory {
  constructor(bus, size = INV_SIZE) {
    this.bus = bus;
    this.size = size;
    this.slots = new Array(size).fill(null);
  }

  _changed() { this.bus?.emit('inventory'); }

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

  /** How many of `id` could be added right now. */
  canAdd(id, qty) {
    const stackable = !!getItem(id).stackable;
    if (stackable) {
      const existing = this.slots.some((s) => s && s.id === id);
      return existing || this.freeSlots() > 0 ? qty : 0;
    }
    return Math.min(qty, this.freeSlots());
  }

  /** Add up to `qty`; returns the amount actually added. */
  add(id, qty = 1) {
    const item = getItem(id);
    let added = 0;
    if (item.stackable) {
      let slot = this.slots.find((s) => s && s.id === id);
      if (!slot) {
        const i = this.firstEmpty();
        if (i === -1) return 0;
        slot = { id, qty: 0 };
        this.slots[i] = slot;
      }
      slot.qty += qty;
      added = qty;
    } else {
      for (let n = 0; n < qty; n++) {
        const i = this.firstEmpty();
        if (i === -1) break;
        this.slots[i] = { id, qty: 1 };
        added++;
      }
    }
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
