import { getItem } from '../data/items.js';

export const EQUIP_SLOTS = ['head', 'cape', 'amulet', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
export const DEFAULT_WEAPON_SPEED = 5; // ticks (unarmed)

// Worn-equipment state + bonus aggregation.
export class Equipment {
  constructor(bus) {
    this.bus = bus;
    this.slots = {};
    for (const s of EQUIP_SLOTS) this.slots[s] = null;
  }

  _changed() { this.bus?.emit('equipment'); }

  get(slot) { return this.slots[slot]; }

  set(slot, itemId) {
    this.slots[slot] = itemId;
    this._changed();
  }

  clearSlot(slot) {
    const prev = this.slots[slot];
    this.slots[slot] = null;
    this._changed();
    return prev;
  }

  bonuses() {
    const total = { attack: 0, strength: 0, defence: 0 };
    for (const slot of EQUIP_SLOTS) {
      const id = this.slots[slot];
      if (!id) continue;
      const b = getItem(id).equip?.bonuses;
      if (!b) continue;
      total.attack += b.attack || 0;
      total.strength += b.strength || 0;
      total.defence += b.defence || 0;
    }
    return total;
  }

  weaponSpeed() {
    const id = this.slots.weapon;
    if (!id) return DEFAULT_WEAPON_SPEED;
    return getItem(id).equip?.bonuses?.speed || DEFAULT_WEAPON_SPEED;
  }

  /** Is a tool of `tag` currently wielded (e.g. an axe in the weapon slot)? */
  hasTool(tag) {
    const id = this.slots.weapon;
    return !!id && getItem(id).tool === tag;
  }

  serialize() { return { ...this.slots }; }

  load(data) {
    if (!data) return;
    for (const s of EQUIP_SLOTS) {
      this.slots[s] = data[s] && itemExists(data[s]) ? data[s] : null;
    }
    this._changed();
  }
}

function itemExists(id) {
  try { getItem(id); return true; } catch { return false; }
}
