import { getItem } from '../data/items.js';
import { validQuality, qualityRank } from './loot.js';

// The bank: an unordered collection where every item stacks. Effectively unlimited.
// Gear copies of a quality (loot.js) keep it: an entry is { id, qty } plus `q`,
// and each quality of an item has its own entry.
export class Bank {
  constructor(bus) {
    this.bus = bus;
    this.items = []; // [{ id, qty, q? }]
  }

  _changed() { this.bus?.emit('bank'); }

  /** How many of `id` are banked, every quality together. */
  count(id) { return this.items.reduce((n, e) => (e.id === id ? n + e.qty : n), 0); }

  deposit(id, qty, q = null) {
    if (qty <= 0) return;
    q = validQuality(q);
    const e = this.items.find((x) => x.id === id && (x.q || null) === q);
    if (e) e.qty += qty;
    else this.items.push(q ? { id, qty, q } : { id, qty });
    this._changed();
  }

  /** Take up to `qty` of `id` out: with `q` (null for plain) only that
   *  quality, else the plainest first. Returns [{ q, n }]. */
  take(id, qty, q) {
    const want = q === undefined ? null : validQuality(q);
    const list = this.items.filter((x) => x.id === id && (q === undefined || (x.q || null) === want))
      .sort((a, b) => qualityRank(a.q) - qualityRank(b.q));
    const out = [];
    let left = qty;
    for (const e of list) {
      if (left <= 0) break;
      const n = Math.min(e.qty, left);
      e.qty -= n; left -= n;
      out.push({ q: e.q || null, n });
    }
    this.items = this.items.filter((x) => x.qty > 0);
    if (out.length) this._changed();
    return out;
  }

  withdraw(id, qty, q) { return this.take(id, qty, q).reduce((n, p) => n + p.n, 0); }

  serialize() { return this.items.map((e) => (e.q ? { id: e.id, qty: e.qty, q: e.q } : { id: e.id, qty: e.qty })); }

  load(data) {
    if (!Array.isArray(data)) return;
    this.items = [];
    // (Quality came later: optional. Entries are merged so each quality has one.)
    for (const e of data) if (e && e.id && e.qty > 0 && safe(e.id)) this.deposit(e.id, e.qty, e.q);
    this._changed();
  }
}

function safe(id) { try { getItem(id); return true; } catch { return false; } }
