import { getItem } from '../data/items.js';

// The bank: an unordered collection where every item stacks. Effectively unlimited.
export class Bank {
  constructor(bus) {
    this.bus = bus;
    this.items = []; // [{ id, qty }]
  }

  _changed() { this.bus?.emit('bank'); }

  count(id) { return this.items.find((e) => e.id === id)?.qty ?? 0; }

  deposit(id, qty) {
    if (qty <= 0) return;
    const e = this.items.find((x) => x.id === id);
    if (e) e.qty += qty;
    else this.items.push({ id, qty });
    this._changed();
  }

  withdraw(id, qty) {
    const e = this.items.find((x) => x.id === id);
    if (!e) return 0;
    const take = Math.min(e.qty, qty);
    e.qty -= take;
    if (e.qty <= 0) this.items = this.items.filter((x) => x !== e);
    this._changed();
    return take;
  }

  serialize() { return this.items.map((e) => ({ id: e.id, qty: e.qty })); }

  load(data) {
    if (!Array.isArray(data)) return;
    this.items = data.filter((e) => e && e.id && e.qty > 0 && safe(e.id)).map((e) => ({ id: e.id, qty: e.qty }));
    this._changed();
  }
}

function safe(id) { try { getItem(id); return true; } catch { return false; } }
