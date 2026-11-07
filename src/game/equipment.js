import { getItem } from '../data/items.js';
import { ARMOUR_SETS } from '../data/sets.js';
import { upgradedBonuses, MAX_UPGRADE } from './upgrade.js';

export const EQUIP_SLOTS = ['head', 'cape', 'amulet', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
export const DEFAULT_WEAPON_SPEED = 5; // ticks (unarmed)

/** Daggers (and the kris) and scimitars can be dual wielded: a second one of
 *  the same kind goes in the off-hand. */
export const dualType = (id) => {
  if (!id) return null;
  if (/_dagger$/.test(id) || id === 'tiger_kris') return 'dagger';
  const t = getItem(id)?.equip?.weaponType;
  return t === 'scimitar' || t === 'pistol' ? t : null;
};
export const canDualWield = (id) => !!dualType(id);
/** Can these two be held together (main hand and off-hand)? */
export const canDualPair = (a, b) => !!dualType(a) && dualType(a) === dualType(b);
// Quick weapons swing faster than one combat beat: scimitars and claws swing
// about 1.4 times a beat (a fractional cooldown carries over between beats).
export const QUICK_WEAPON_SPEED = 0.7;
// Extra offensive stats, all in percent, with caps so stacking stays sane:
// pierce ignores that much of a foe's defence, critDmg adds to critical hits,
// haste shortens the time between attacks, lifesteal heals you by a share of
// the damage you deal, and bossDmg adds damage against bosses and champions.
// atkPct / magPct: 'Attack bonus %' (melee and ranged physical damage) and 'Magic bonus %' (spell damage).
export const OFFENCE_KEYS = ['pierce', 'critDmg', 'haste', 'lifesteal', 'bossDmg', 'atkPct', 'magPct'];
// Attack speed (haste) has no cap: see hasteMult().
export const OFFENCE_CAPS = { pierce: 40, critDmg: 150, lifesteal: 15, bossDmg: 60 };
// Melee swing intervals are halved: every melee class attacks twice as fast.
export const MELEE_SPEED_MULT = 0.5;
const QUICK_TYPES = new Set(['scimitar', 'claws']);
// Ranged weapons quicker than any bow: pistols fire about 4 shots a beat (each
// hand), shurikens 2 throws a beat.
// Shortbows loose twice as fast as longbows; longbows hit harder instead (LONGBOW_DMG in game.js).
export const FAST_RANGED = { pistol: 0.25, shuriken: 0.5, shortbow: 0.5 };

// Worn-equipment state + bonus aggregation.
export class Equipment {
  constructor(bus) {
    this.bus = bus;
    this.slots = {};
    for (const s of EQUIP_SLOTS) this.slots[s] = null;
    this.upgrades = {};           // itemId -> upgrade level (+1..+15), shared by every copy
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

  /** Does this accessory's style (melee / ranged / magic) match the weapon in
   *  hand? Accessories without a style always count. The Dancer's whip counts as melee. */
  styleFits(id) {
    const st = getItem(id).equip?.style;
    if (!st) return true;
    const mode = this.combatType();
    return st === (mode === 'dance' ? 'melee' : mode);
  }

  bonuses() {
    const total = { attack: 0, strength: 0, defence: 0, ranged: 0, magic: 0, magicStr: 0, dance: 0, crit: 0, hp: 0,
      pierce: 0, critDmg: 0, haste: 0, lifesteal: 0, bossDmg: 0, atkPct: 0, magPct: 0 };
    for (const slot of EQUIP_SLOTS) {
      const id = this.slots[slot];
      if (!id) continue;
      if (!getItem(id).equip?.bonuses) continue;
      let b = this.itemBonuses(id);
      // A melee, ranged or magic accessory only lends its crit and offensive
      // stats (pierce, crit damage, haste, lifesteal, boss damage) when you fight
      // in that style; its Defence and HP help whatever you fight with.
      if (!this.styleFits(id)) { b = { ...b, crit: 0 }; for (const k of OFFENCE_KEYS) b[k] = 0; }
      total.attack += b.attack || 0;
      total.strength += b.strength || 0;
      total.defence += b.defence || 0;
      total.ranged += b.ranged || 0;
      total.magic += b.magic || 0;
      total.magicStr += b.magicStr || 0;
      total.dance += b.dance || 0;   // Dancer accuracy and damage
      total.crit += b.crit || 0;   // bonus critical-hit chance (%)
      total.hp += b.hp || 0;       // bonus max hitpoints
      for (const k of OFFENCE_KEYS) total[k] += b[k] || 0;   // armour piercing, crit damage, haste, lifesteal, boss damage (%)
    }
    for (const k of OFFENCE_KEYS) if (OFFENCE_CAPS[k] != null) total[k] = Math.min(total[k], OFFENCE_CAPS[k]);
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
  isDualWielding() { return canDualPair(this.slots.weapon, this.slots.shield); }

  /** Combat style implied by the wielded weapon: 'melee' | 'ranged' | 'magic' | 'dance'. */
  combatType() {
    const id = this.slots.weapon;
    return (id && getItem(id).equip?.combatType) || 'melee';
  }

  weaponSpeed() {
    const id = this.slots.weapon;
    // Melee swings twice as fast as everything else (it has to close the distance).
    // Attack speed from gear shortens every kind of attack, with no cap.
    const melee = (this.combatType() === 'melee' ? MELEE_SPEED_MULT : 1) * this.hasteMult();
    if (id && QUICK_TYPES.has(getItem(id).equip?.weaponType)) return QUICK_WEAPON_SPEED * melee;
    if (id && FAST_RANGED[getItem(id).equip?.weaponType]) return FAST_RANGED[getItem(id).equip.weaponType] * melee;
    const base = (id && getItem(id).equip?.bonuses?.speed) || DEFAULT_WEAPON_SPEED;
    // Fast-paced combat: intervals are in 300ms combat beats (see
    // COMBAT_BEAT_MS), shortened by 3, down to a floor of 1 beat, so quick
    // weapons swing every 0.3s.
    return Math.max(1, base - 3) * melee;
  }

  /** Attack-time multiplier from attack speed %: +100% attacks twice as often,
   *  +300% four times. Uncapped, and it never reaches zero. */
  hasteMult() { return 100 / (100 + this._haste()); }

  _haste() {
    let h = 0;
    for (const slot of EQUIP_SLOTS) { const id = this.slots[slot]; if (id && this.styleFits(id)) h += getItem(id).equip?.bonuses?.haste || 0; }
    return h;
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
      if (itemExists(id) && lv > 0) this.upgrades[id] = Math.min(MAX_UPGRADE, Math.floor(lv));
    }
    this._changed();
  }
}

function itemExists(id) {
  try { getItem(id); return true; } catch { return false; }
}
