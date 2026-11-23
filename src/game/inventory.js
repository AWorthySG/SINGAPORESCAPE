import { getItem } from '../data/items.js';
import { validQuality, qualityRank } from './loot.js';

export const INV_SIZE = 28;
// No limit to a stack (the owner's ask): every kind of item sits in one slot
// however many you hold. It used to be 999 a slot, so a late game's hauls
// (whole seams, whole schools) filled thousands of slots that every pickup,
// gather and redraw of the bag had to walk through. An item's own `maxStack`
// still caps it.
export const STACK_LIMIT = Infinity;

// An unlimited inventory: it starts with 28 slots and grows as it fills,
// always keeping a row of empty slots open.
// A slot is { id, qty } plus `q` for gear copies of a quality ('fine' ..
// 'mythic', see loot.js). Copies only stack with copies of the same quality,
// and when no quality is asked for, the plainest copies go first.
const SPARE = 4;

export const CATEGORY_ORDER = ['coins', 'gear', 'food', 'materials', 'other'];
const MATERIAL_TAGS = ['ore', 'bar', 'log', 'raw', 'herb', 'rune', 'ammo', 'gem', 'bait', 'seed', 'crop', 'hide'];
/** Which inventory tab an item belongs to. */
export function itemCategory(id) {
  if (id === 'coins') return 'coins';
  const it = getItem(id);
  if (it.equip) return 'gear';
  if (it.heal || it.potion) return 'food';
  if ((it.tags || []).some((t) => MATERIAL_TAGS.includes(t)) || /_(ore|bar|logs)$|^raw_/.test(id)) return 'materials';
  return 'other';
}   // empty slots kept open at the end (one grid row)
export class Inventory {
  constructor(bus, size = INV_SIZE) {
    this.bus = bus;
    this.minSize = size;
    this.slots = new Array(size).fill(null);
  }

  get size() { return this.slots.length; }

  _changed() {
    this._pad();
    if (this._held) this._held.dirty = true;   // a batch tells the bag once, at the end (hold/release)
    else this.bus?.emit('inventory');
  }

  /** An instant batch (thousands of makes in one tick) holds the 'inventory'
   *  event: every listener (the bag grid, the quick-use slot, discovery) would
   *  otherwise rescan the whole pack once per item. release() tells it once.
   *  Returns whether this call took the hold (nested holds leave it to the outer). */
  hold() { if (this._held) return false; this._held = { dirty: false }; return true; }
  release() {
    const h = this._held;
    this._held = null;
    if (h?.dirty) this.bus?.emit('inventory');
  }

  /** Watch what changes (skillunlocks.js, around each make in a batch): a map of
   *  id -> { n: net change, at: the item's first slot before it was taken }.
   *  The same answer as counting the bag before and after, without the scans. */
  journal() { return (this._log = new Map()); }
  endJournal() { const j = this._log; this._log = null; return j; }
  _note(id, n, at) {
    const e = this._log.get(id);
    if (e) { e.n += n; if (at < e.at) e.at = at; } else this._log.set(id, { n, at });
  }

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
    // A plain loop: a big batch asks this several times per item made.
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.qty;
    return n;
  }

  has(id, qty = 1) { return this.count(id) >= qty; }

  /** How many of `id` could be added right now: always all of it. */
  canAdd(id, qty) { return qty; }

  /** Add up to `qty` (copies of quality `q`, null for plain); tops up partial
   *  stacks first, then fills empty slots. Returns amount added. */
  add(id, qty = 1, q = null) {
    const max = this.maxStackOf(id);
    q = validQuality(q);
    const mk = (n) => (q ? { id, qty: n, q } : { id, qty: n });
    let remaining = qty;
    for (let i = 0; i < this.size && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && (s.q || null) === q && s.qty < max) {
        const put = Math.min(max - s.qty, remaining);
        s.qty += put; remaining -= put;
      }
    }
    for (let i = 0; i < this.size && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const put = Math.min(max, remaining);
        this.slots[i] = mk(put); remaining -= put;
      }
    }
    while (remaining > 0) {           // out of empty slots: grow
      const put = Math.min(max, remaining);
      this.slots.push(mk(put)); remaining -= put;
    }
    const added = qty - remaining;
    if (this._log && added > 0) this._note(id, added, Infinity);
    if (added > 0) this._changed();
    return added;
  }

  /** Remove up to `qty` of `id` across slots; returns amount removed. With
   *  `q` (null for plain) only copies of that quality go; without it the
   *  plainest go first. */
  remove(id, qty = 1, q) {
    return this.take(id, qty, q).reduce((n, p) => n + p.n, 0);
  }

  /** Remove like remove(), saying which copies went: [{ q, n }], plainest first. */
  take(id, qty = 1, q) {
    const order = [];
    let first = Infinity;   // the item's first slot, whatever its quality (the journal orders what was spent by it)
    this.slots.forEach((s, i) => {
      if (!s || s.id !== id) return;
      if (i < first) first = i;
      if (q === undefined || (s.q || null) === validQuality(q)) order.push(i);
    });
    order.sort((a, b) => qualityRank(this.slots[a].q) - qualityRank(this.slots[b].q) || a - b);
    const out = [];
    let toRemove = qty;
    for (const i of order) {
      if (toRemove <= 0) break;
      const s = this.slots[i];
      const take = Math.min(s.qty, toRemove);
      s.qty -= take;
      toRemove -= take;
      const last = out[out.length - 1], sq = s.q || null;
      if (last && last.q === sq) last.n += take; else out.push({ q: sq, n: take });
      if (s.qty <= 0) this.slots[i] = null;
    }
    if (this._log && toRemove < qty) this._note(id, toRemove - qty, first);
    if (toRemove < qty) this._changed();
    return out;
  }

  /** The quality of every copy of `id` in the pack, plainest first: [null, null, 'fine', 'epic']. */
  qualities(id) {
    const out = [];
    for (const s of this.slots) if (s && s.id === id) for (let k = 0; k < s.qty; k++) out.push(s.q || null);
    return out.sort((a, b) => qualityRank(a) - qualityRank(b));
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

  /** Tidy up: merge split stacks and order by category (coins, gear, food,
   *  materials, other), then by name. */
  sort() {
    // (Copies of each quality stay apart, the best first.)
    const totals = new Map();
    for (const s of this.slots) if (s) { const k = `${s.id}|${s.q || ''}`; totals.set(k, (totals.get(k) || 0) + s.qty); }
    const keys = [...totals.keys()].map((k) => { const [id, q] = k.split('|'); return { k, id, q: q || null }; }).sort((a, b) => {
      const ca = CATEGORY_ORDER.indexOf(itemCategory(a.id)), cb = CATEGORY_ORDER.indexOf(itemCategory(b.id));
      return ca - cb || getItem(a.id).name.localeCompare(getItem(b.id).name) || qualityRank(b.q) - qualityRank(a.q);
    });
    const out = [];
    for (const { k, id, q } of keys) {
      let left = totals.get(k);
      const max = this.maxStackOf(id);
      while (left > 0) { const put = Math.min(max, left); out.push(q ? { id, qty: put, q } : { id, qty: put }); left -= put; }
    }
    this.slots = out;
    this._changed();
  }

  swap(i, j) {
    [this.slots[i], this.slots[j]] = [this.slots[j], this.slots[i]];
    this._changed();
  }

  clear() {
    this.slots = new Array(this.minSize).fill(null);
    this._changed();
  }

  serialize() {
    return this.slots.map((s) => (s ? (s.q ? { id: s.id, qty: s.qty, q: s.q } : { id: s.id, qty: s.qty }) : null));
  }

  load(data) {
    if (!Array.isArray(data)) return;
    this.slots = new Array(Math.max(this.minSize, data.length)).fill(null);
    // A save from the days of 999 a slot has an item split over several slots:
    // they join its first one (the others empty), copies of each quality apart.
    const first = new Map();
    for (let i = 0; i < data.length; i++) {
      const s = data[i];
      if (!s || !s.id || !getItemSafe(s.id)) continue;
      const q = validQuality(s.q);   // a copy's quality came later: optional
      const k = `${s.id}|${q || ''}`, at = first.get(k);
      if (at !== undefined && this.slots[at].qty + s.qty <= this.maxStackOf(s.id)) { this.slots[at].qty += s.qty; continue; }
      first.set(k, i);
      this.slots[i] = q ? { id: s.id, qty: s.qty, q } : { id: s.id, qty: s.qty };
    }
    this._changed();
  }
}

function getItemSafe(id) {
  try { return getItem(id); } catch { return null; }
}
