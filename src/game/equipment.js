import { getItem, TWO_HANDED_TYPES, QUIVER_BOW_TYPES } from '../data/items.js';
import { ARMOUR_SETS } from '../data/sets.js';
import { masteryBonuses, qualityBonuses, masteryType, enchantedBonuses, rankFor, migrateOld, pointsToXp, MAX_ENCHANTS, ENCHANT_STEP, taperedLine } from './mastery.js';
import { validQuality, QUALITY_ORDER } from './loot.js';
import { refinedBonuses, MAX_REFINE } from './refine.js';

export const EQUIP_SLOTS = ['head', 'cape', 'amulet', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'];
export const DEFAULT_WEAPON_SPEED = 5; // ticks (unarmed)

// An item's gear type (masteryType) never changes, so it is worked out once per item.
const _mtypes = new Map();
const mtypeOf = (id) => { let t = _mtypes.get(id); if (t === undefined) _mtypes.set(id, (t = masteryType(id))); return t; };
/** Are these the very same pieces' bonuses as before (see Equipment._wornParts)? */
function sameParts(was, now) {
  for (let i = 0; i < now.length; i++) if (was[i] !== now[i]) return false;
  return true;
}
/** Do enchant lines `now` say the same as the copy `was` kept of them? */
function sameLines(was, now) {
  if (!was || !now) return !was === !now;
  if (was.length !== now.length) return false;
  for (let i = 0; i < was.length; i++) if (was[i].stat !== now[i]?.stat || was[i].value !== now[i]?.value) return false;
  return true;
}

/** Daggers (and the kris), scimitars, pistols, kerambits and shurikens can be dual wielded: a
 *  second one of the same kind goes in the off-hand. */
export const dualType = (id) => {
  if (!id) return null;
  if (/_dagger$/.test(id) || id === 'tiger_kris') return 'dagger';
  const t = getItem(id)?.equip?.weaponType;
  if (t === 'dagger' && getItem(id).signature) return 'dagger';   // a boss's signature dagger pairs like any other
  return t === 'scimitar' || t === 'pistol' || t === 'kerambit' || t === 'shuriken' ? t : null;
};
export const canDualWield = (id) => !!dualType(id);
/** Can these two be held together (main hand and off-hand)? */
export const canDualPair = (a, b) => !!dualType(a) && dualType(a) === dualType(b);
// Two-handed weapons need both hands, so no shield-slot item (shield, buckler,
// quiver or tome) can be held with them: bows, crossbows, rifles, katanas,
// warhammers, two-handed swords, halberds and claws (a claw on each hand). A
// Knight's longsword and the toya are held in one hand, so they keep a shield.
// (The list lives in items.js, which gives each of these a "two-handed grip"
// bonus in place of the off-hand they can't hold.)
export const TWO_HANDED = TWO_HANDED_TYPES;
export const isTwoHanded = (id) => !!id && TWO_HANDED.has(getItem(id)?.equip?.weaponType);
/** A quiver (a shield-slot item for archers). */
export const isQuiver = (id) => !!id && /_quiver$/.test(id) && getItem(id)?.equip?.slot === 'shield';
/** Shortbows and longbows take a quiver in the off-hand (but still no shield). */
export const takesQuiver = (weaponId) => !!weaponId && QUIVER_BOW_TYPES.has(getItem(weaponId)?.equip?.weaponType);
/** Does the weapon in hand leave no room for this off-hand item? */
export const offhandBlocked = (weaponId, offId) => isTwoHanded(weaponId) && !(takesQuiver(weaponId) && isQuiver(offId));
// Quick weapons swing faster than one combat beat: scimitars, claws, kerambits and war fans swing
// about 1.4 times a beat (a fractional cooldown carries over between beats).
export const QUICK_WEAPON_SPEED = 0.7;
// Extra offensive stats, all in percent, with caps so stacking stays sane:
// pierce adds that much damage (player hits always land), critDmg adds to critical hits,
// haste shortens the time between attacks, lifesteal heals you by a share of
// the damage you deal, and bossDmg adds damage against bosses and champions.
// atkPct / magPct: 'Physical damage bonus %' (melee and ranged) and 'Magic bonus %' (spell damage).
export const OFFENCE_KEYS = ['pierce', 'critDmg', 'haste', 'lifesteal', 'bossDmg', 'atkPct', 'magPct'];
// Attack speed (haste) has no cap: see hasteMult().
// (No caps any more: the owner wants every offensive stat to keep paying off.
// Crit chance stops at 100%, since a hit can't crit more than every time.)
export const OFFENCE_CAPS = {};
// Melee swing intervals are halved: every melee class attacks twice as fast.
export const MELEE_SPEED_MULT = 0.5;
export const QUICK_TYPES = new Set(['scimitar', 'claws', 'kerambit', 'fan']);
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
    this.mastery = {};            // gear type (masteryType: 'weapon:sword', 'body:plate'...) -> mastery XP (see mastery.js)
    this.enchants = {};           // itemId -> [{ stat, value }] (up to 3), shared by every copy
    this.refines = {};            // itemId -> refine level (★1..★15), shared by every copy (see refine.js)
    // A twin pair (the same dual-wield weapon in both hands) has a second copy
    // with its own refine and enchant lines: these hold the off-hand copy's,
    // used only while that pair is worn (see copyIn). They stay when the pair
    // is split up, as "your second copy's upgrades", and come back with it.
    // Mastery stays shared: it is earned by fighting with the item type.
    this.offRefines = {};         // itemId -> the off-hand copy's refine level
    this.offEnchants = {};        // itemId -> the off-hand copy's enchant lines
    // The quality of the copy worn in each slot (loot.js): slot -> 'fine' .. 'mythic',
    // absent for a plain copy. It goes back to the pack with the copy.
    this.slotQuality = {};
    // Old saves kept quality as a tally per item id; save.js hands those
    // copies out to the copies you own once everything is loaded (then clears this).
    this.legacyQuality = null;
    this.extra = null;            // () => bonuses from outside your gear (life skill perks and shrine blessings, see Game.outsideBonuses)
    // The ammo slot: a stack of gun rounds ({ id, qty }), or null. It sits apart
    // from the gear slots above, so rounds never take mastery, enchants or quality (rounds.js).
    this.ammo = null;
  }

  /** Load `qty` of rounds `id` into the ammo slot (none, or no id, empties it). */
  setAmmo(id, qty) {
    this.ammo = id && qty > 0 ? { id, qty: Math.floor(qty) } : null;
    this._changed();
  }

  // Mastery is read and written through any item of the type.
  masteryXp(id) { return this.mastery[masteryType(id)] || 0; }
  masteryPoints(id) { return this.masteryXp(id); }   // (its name from before mastery XP; older tests and tools use it)
  masteryRank(id) { return rankFor(this.masteryXp(id)); }
  setMastery(id, xp) { this.mastery[masteryType(id)] = Math.max(0, Math.floor(xp)); }
  /** The quality of the copy worn in `slot` (null when plain or empty). */
  qualityIn(slot) { return this.slots[slot] ? this.slotQuality[slot] || null : null; }
  // `copy` is 'main' (every copy you own, the usual record) or 'off' (the
  // off-hand copy of a twin pair, see offRefines).
  enchantLines(id, copy = 'main') { return this.enchantMap(copy)[id] || []; }
  refineLevel(id, copy = 'main') { return this.refineMap(copy)[id] || 0; }
  refineMap(copy = 'main') { return copy === 'off' ? this.offRefines : this.refines; }
  enchantMap(copy = 'main') { return copy === 'off' ? this.offEnchants : this.enchants; }

  /** Are two copies of `id` worn, one in each hand? */
  twinWorn(id) { return !!id && this.slots.weapon === id && this.slots.shield === id && canDualWield(id); }

  /** Which record the piece worn in `slot` reads: 'off' for the off-hand copy
   *  of a twin pair, else 'main'. A lone copy always reads the main record, in
   *  either hand: the off-hand record is the SECOND copy's, so it only counts
   *  while two copies are worn. (So when a twin's main hand takes another
   *  weapon, the copy left in the off-hand reads the main record and the
   *  second copy's record waits for the pair to come back: nothing is copied
   *  or lost, whichever way the hands change.) */
  copyIn(slot) { return slot === 'shield' && this.twinWorn(this.slots.shield) ? 'off' : 'main'; }

  /** The record `id` would read once put into `slot` now: the off-hand copy's
   *  when it would make a twin pair with the main weapon. */
  copyFor(id, slot) { return slot === 'shield' && this.slots.weapon === id && canDualWield(id) ? 'off' : 'main'; }

  /** An item's bonuses: its base stats, plus its gear type's mastery gain,
   *  times the copy's quality (`q`, null for a plain copy), plus its refine
   *  level's share of the base stats, plus its enchant lines. */
  itemBonuses(id, copy = 'main', q = null) {
    const base = getItem(id).equip?.bonuses || {};
    const mastered = qualityBonuses(base, masteryBonuses(base, this.masteryRank(id)), q);
    return enchantedBonuses(refinedBonuses(base, mastered, this.refineLevel(id, copy)), this.enchantLines(id, copy));
  }

  /** itemBonuses for the piece worn in `slot` (id `id`), kept until anything it
   *  is made from changes: the piece, its copy and quality, its type's mastery
   *  rank, its refine level or its enchant lines (all read afresh each time, so a
   *  change made straight to the records is seen too). A fight asks for your
   *  gear's totals many times a blow, and each answer built four objects per
   *  piece worn. Read-only: callers copy before changing anything. */
  _wornBonuses(slot, id) {
    const copy = this.copyIn(slot), q = this.qualityIn(slot);
    const xp = this.mastery[mtypeOf(id)] || 0, ref = this.refineMap(copy)[id], lines = this.enchantMap(copy)[id];
    const c = (this._worn ||= {})[slot];
    if (c !== undefined && c.id === id && c.copy === copy && c.q === q && c.ref === ref && sameLines(c.lines, lines)) {
      if (c.xp === xp) return c.b;
      // Every kill adds mastery XP to what you wear, but only a new rank changes its bonuses.
      if (c.rank === rankFor(xp)) { c.xp = xp; return c.b; }
    }
    const b = this.itemBonuses(id, copy, q);
    this._worn[slot] = { id, copy, q, xp, rank: rankFor(xp), ref, lines: lines && lines.map((l) => ({ stat: l?.stat, value: l?.value })), b };
    return b;
  }

  _changed() { this.bus?.emit('equipment'); }

  get(slot) { return this.slots[slot]; }

  /** The weapon in hand's type ('sword', 'staff', 'whip'…), or null when unarmed. */
  weaponType() { const id = this.slots.weapon; return id ? getItem(id).equip?.weaponType || null : null; }

  /** Put a copy of `itemId` (of quality `q`, null for plain) into `slot`. */
  set(slot, itemId, q = null) {
    this.slots[slot] = itemId;
    if (itemId && validQuality(q)) this.slotQuality[slot] = q; else delete this.slotQuality[slot];
    this._changed();
  }

  /** Empty a slot; returns the item id that was there (read qualityIn(slot) first to keep its quality). */
  clearSlot(slot) {
    const prev = this.slots[slot];
    this.slots[slot] = null;
    delete this.slotQuality[slot];
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

  /** Every bonus your gear gives. With `hand` ('main' or 'off') while dual
   *  wielding, the bonuses behind one hand's blow: each hand hits with its own
   *  weapon, so the other hand's weapon is left out (the main hand's blow uses
   *  the main weapon and no off-hand, the off-hand's uses the off-hand weapon and
   *  no main weapon), while armour, accessories, set bonuses and life perks count
   *  for both. Without `hand` (or when not dual wielding) every slot counts, both
   *  weapons included: that is the whole character's Defence and HP, and the
   *  totals the Equipment panel shows. */
  bonuses(hand = null) {
    const skip = hand && this.isDualWielding() ? (hand === 'off' ? 'weapon' : 'shield') : null;
    // The very same pieces (see _wornBonuses) and the same bonuses from outside
    // your gear add up to the same totals: a copy of last time's is handed back.
    const parts = this._wornParts(), ex = this.extra?.(), memo = (this._bonusMemo ||= {});
    const m = memo[skip || ''];
    if (m && m.ex === ex && sameParts(m.parts, parts)) return { ...m.total };
    const total = { attack: 0, strength: 0, defence: 0, ranged: 0, magic: 0, magicStr: 0, dance: 0, crit: 0, hp: 0,
      pierce: 0, critDmg: 0, haste: 0, lifesteal: 0, bossDmg: 0, atkPct: 0, magPct: 0, prayer: 0 };
    for (let i = 0; i < EQUIP_SLOTS.length; i++) {
      const slot = EQUIP_SLOTS[i], id = this.slots[slot];
      if (!id || slot === skip) continue;
      if (!getItem(id).equip?.bonuses) continue;
      let b = parts[i];
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
      total.dance += b.dance || 0;   // Dancer damage
      total.crit += b.crit || 0;   // bonus critical-hit chance (%)
      total.hp += b.hp || 0;       // bonus max hitpoints
      total.prayer += b.prayer || 0;   // fills Faith faster (prayer accessories)
      for (const k of OFFENCE_KEYS) total[k] += b[k] || 0;   // armour piercing, crit damage, haste, lifesteal, boss damage (%)
    }
    for (const k of OFFENCE_KEYS) if (OFFENCE_CAPS[k] != null) total[k] = Math.min(total[k], OFFENCE_CAPS[k]);
    // Full-set bonuses on top of individual pieces.
    const sb = this.setBonus();
    for (const k of Object.keys(total)) total[k] += sb[k] || 0;
    // Life skill perks sit on top too (see lifeperks.js).
    if (ex) for (const k of Object.keys(ex)) total[k] = (total[k] || 0) + ex[k];
    memo[skip || ''] = { ex, parts, total: { ...total } };
    return total;
  }

  /** Each slot's piece's bonuses (see _wornBonuses), null where nothing is worn. */
  _wornParts() {
    const out = new Array(EQUIP_SLOTS.length);
    for (let i = 0; i < EQUIP_SLOTS.length; i++) { const id = this.slots[EQUIP_SLOTS[i]]; out[i] = id ? this._wornBonuses(EQUIP_SLOTS[i], id) : null; }
    return out;
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
    // Both hands swing on the same beat, so attack speed is the whole
    // character's: a dual wielder's two weapons both add theirs.
    // (Kept like bonuses(): the same pieces and outside bonuses, the same answer.)
    const parts = this._wornParts(), ex = this.extra?.(), m = this._hasteMemo;
    if (m && m.ex === ex && sameParts(m.parts, parts)) return m.h;
    let h = 0;
    for (let i = 0; i < EQUIP_SLOTS.length; i++) { const id = this.slots[EQUIP_SLOTS[i]]; if (id && this.styleFits(id)) h += parts[i].haste || 0; }
    h += ex?.haste || 0;   // plus Fletching's life perk
    this._hasteMemo = { ex, parts, h };
    return h;
  }

  /** Is a tool of `tag` currently wielded (e.g. an axe in the weapon slot)? */
  hasTool(tag) {
    const id = this.slots.weapon;
    return !!id && getItem(id).tool === tag;
  }

  serialize() {
    const lines = (m) => Object.fromEntries(Object.entries(m).map(([id, l]) => [id, l.map((x) => ({ ...x }))]));
    return { ...this.slots, _mastery: { ...this.mastery }, _masteryXp: 1, _enchants: lines(this.enchants), _refines: { ...this.refines },
      _offEnchants: lines(this.offEnchants), _offRefines: { ...this.offRefines },
      _slotQuality: { ...this.slotQuality }, _enchantTaper: 1, _ammo: this.ammo ? { ...this.ammo } : null };
  }

  load(data) {
    if (!data) return;
    for (const s of EQUIP_SLOTS) {
      this.slots[s] = data[s] && itemExists(data[s]) ? data[s] : null;
    }
    this.mastery = {};   // older saves have none
    // Mastery is kept per gear type (keys with a colon). Saves from before
    // that kept it per item id: each type takes the most points any of its
    // items had, so nobody loses a rank.
    // Saves from before mastery XP (no _masteryXp) kept points: each is turned
    // into XP once, keeping its rank and its share of the way to the next.
    const xpOf = data._masteryXp ? (v) => v : pointsToXp;
    for (const [key, pts] of Object.entries(data._mastery || {})) {
      if (typeof pts !== 'number' || !(pts > 0)) continue;
      const type = key.includes(':') ? key : itemExists(key) ? masteryType(key) : null;
      if (type) this.mastery[type] = Math.max(this.mastery[type] || 0, Math.floor(xpOf(pts)));
    }
    // The ammo slot came later: optional (rounds.js hands older gun users some rounds).
    const am = data._ammo;
    this.ammo = am && typeof am.id === 'string' && itemExists(am.id) && typeof getItem(am.id).roundStr === 'number'
      && typeof am.qty === 'number' && am.qty >= 1 ? { id: am.id, qty: Math.floor(am.qty) } : null;
    // Each worn copy's quality came later: optional.
    this.slotQuality = {};
    for (const s of EQUIP_SLOTS) { const q = validQuality(data._slotQuality?.[s]); if (q && this.slots[s]) this.slotQuality[s] = q; }
    const readLines = (src) => {
      const out = {};
      for (const [id, lines] of Object.entries(src || {})) {
        if (!itemExists(id) || !Array.isArray(lines)) continue;
        const ok = lines.filter((l) => l && ENCHANT_STEP[l.stat] && typeof l.value === 'number' && l.value > 0).slice(0, MAX_ENCHANTS);
        // Saves from before the late-game enchant taper (no _enchantTaper) bring
        // their lines on items above level 100 down in proportion, once.
        if (ok.length) out[id] = ok.map((l) => ({ stat: l.stat, value: Math.floor(l.value) })).map((l) => (data._enchantTaper ? l : taperedLine(id, l)));
      }
      return out;
    };
    this.enchants = readLines(data._enchants);
    // The off-hand copies' records came later: optional, empty in older saves.
    this.offEnchants = readLines(data._offEnchants);
    const readRefines = (src) => {
      const out = {};
      for (const [id, lv] of Object.entries(src || {})) {
        if (itemExists(id) && typeof lv === 'number' && lv >= 1) out[id] = Math.min(MAX_REFINE, Math.floor(lv));
      }
      return out;
    };
    // Refine stars are live again, saved as _refines. Every save written since
    // mastery came in has a _mastery map, so that is how to tell the two apart:
    // with _mastery, _refines are today's refine levels; without it, the save
    // is from before mastery and its _refines are converted below as before.
    const live = !!data._mastery && typeof data._mastery === 'object';
    this.refines = live ? readRefines(data._refines) : {};
    this.offRefines = readRefines(data._offRefines);
    // Saves from before quality lived on each copy kept a tally of quality
    // copies per item id ([fine, superior, epic, legendary, mythic]): kept
    // here until save.js hands them out to the copies you own (assignLegacyQuality).
    this.legacyQuality = null;
    for (const [id, row] of Object.entries(data._quality || {})) {
      if (!itemExists(id) || !Array.isArray(row)) continue;
      const r = QUALITY_ORDER.map((_, i) => (typeof row[i] === 'number' && row[i] > 0 ? Math.floor(row[i]) : 0));
      if (r.some((x) => x)) (this.legacyQuality || (this.legacyQuality = {}))[id] = r;
    }
    // Saves from before mastery had upgrade levels (+1..+15) and refine stars
    // (★1..★15): turn them into mastery XP and free enchant lines, once.
    const ups = data._upgrades || {}, refs = live ? {} : data._refines || {};
    for (const id of new Set([...Object.keys(ups), ...Object.keys(refs)])) {
      if (!itemExists(id) || (data._mastery && id in data._mastery) || this.enchants[id]) continue;   // never converted twice
      const up = Math.max(0, Math.min(15, Math.floor(ups[id]) || 0)), ref = Math.max(0, Math.min(15, Math.floor(refs[id]) || 0));
      if (!up && !ref) continue;
      const m = migrateOld(id, up, ref);
      if (m.xp) this.mastery[masteryType(id)] = Math.max(this.masteryXp(id), m.xp);
      if (m.lines.length) this.enchants[id] = m.lines;
    }
    this._changed();
  }
}

function itemExists(id) {
  try { getItem(id); return true; } catch { return false; }
}
