import { getItem } from '../data/items.js';
import { ARMOUR_SETS } from '../data/sets.js';
import { upgradedBonuses } from './upgrade.js';

export const EQUIP_SLOTS = ['head', 'cape', 'amulet', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
export const DEFAULT_WEAPON_SPEED = 5; // ticks (unarmed)

/** Daggers (and the kris) can be dual wielded: a second one goes in the off-hand. */
export const canDualWield = (id) => !!id && (/_dagger$/.test(id) || id === 'tiger_kris');

// Worn-equipment state + bonus aggregation.
export class Equipment {
  constructor(bus) {
    this.bus = bus;
    this.slots = {};
    for (const s of EQUIP_SLOTS) this.slots[s] = null;
    this.upgrades = {};           // itemId -> upgrade level (+1..+10), shared by every copy
  }

  upgradeLevel(id) { return this.upgrades[id] || 0; }

  /** An item's bonuses including its upgrade level. */
  itemBonuses(id) { return upgradedBonuses(getItem(id).equip?.bonuses || {}, this.upgradeLevel(id)); }

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
    const total = { attack: 0, strength: 0, defence: 0, ranged: 0, magic: 0, magicStr: 0, dance: 0, crit: 0, hp: 0 };
    for (const slot of EQUIP_SLOTS) {
      const id = this.slots[slot];
      if (!id) continue;
      if (!getItem(id).equip?.bonuses) continue;
      const b = this.itemBonuses(id);
      total.attack += b.attack || 0;
      total.strength += b.strength || 0;
      total.defence += b.defence || 0;
      total.ranged += b.ranged || 0;
      total.magic += b.magic || 0;
      total.magicStr += b.magicStr || 0;
      total.dance += b.dance || 0;   // Dancer accuracy and damage
      total.crit += b.crit || 0;   // bonus critical-hit chance (%)
      total.hp += b.hp || 0;       // bonus max hitpoints
    }
    // Full-set bonuses on top of individual pieces.
    const sb = this.setBonus();
    for (const k of Object.keys(total)) total[k] += sb[k] || 0;
    return total;
  }

  /** Aggregated bonus from every fully-worn armour set. */
  setBonus() {
    const b = { attack: 0, strength: 0, defence: 0, ranged: 0, magic: 0, magicStr: 0, dance: 0 };
    for (const set of ARMOUR_SETS) {
      if (set.pieces.every((id) => this._wearing(id))) {
        for (const k of Object.keys(set.bonus)) b[k] += set.bonus[k];
      }
    }
    return b;
  }

  /** Names of the armour sets currently fully worn (for UI display). */
  activeSets() {
    return ARMOUR_SETS.filter((set) => set.pieces.every((id) => this._wearing(id))).map((s) => s.name);
  }

  _wearing(id) {
    for (const slot of EQUIP_SLOTS) if (this.slots[slot] === id) return true;
    return false;
  }

  /** A dagger held in the off-hand (shield slot) alongside a main-hand dagger. */
  isDualWielding() { return canDualWield(this.slots.weapon) && canDualWield(this.slots.shield); }

  /** Combat style implied by the wielded weapon: 'melee' | 'ranged' | 'magic' | 'dance'. */
  combatType() {
    const id = this.slots.weapon;
    return (id && getItem(id).equip?.combatType) || 'melee';
  }

  weaponSpeed() {
    const id = this.slots.weapon;
    const base = (id && getItem(id).equip?.bonuses?.speed) || DEFAULT_WEAPON_SPEED;
    // Fast-paced combat: intervals are in 300ms combat beats (see
    // COMBAT_BEAT_MS), shortened by 3, down to a floor of 1 beat, so quick
    // weapons swing every 0.3s.
    return Math.max(1, base - 3);
  }

  /** Is a tool of `tag` currently wielded (e.g. an axe in the weapon slot)? */
  hasTool(tag) {
    const id = this.slots.weapon;
    return !!id && getItem(id).tool === tag;
  }

  serialize() { return { ...this.slots, _upgrades: { ...this.upgrades } }; }

  load(data) {
    if (!data) return;
    for (const s of EQUIP_SLOTS) {
      this.slots[s] = data[s] && itemExists(data[s]) ? data[s] : null;
    }
    this.upgrades = {};
    for (const [id, lv] of Object.entries(data._upgrades || {})) {
      if (itemExists(id) && lv > 0) this.upgrades[id] = Math.min(10, Math.floor(lv));
    }
    this._changed();
  }
}

function itemExists(id) {
  try { getItem(id); return true; } catch { return false; }
}
