import { ITEMS, getItem } from '../data/items.js';
import { EQUIP_SLOTS } from './equipment.js';

// Gear guide: one comparable "rating" per piece of equipment, plus helpers to
// compare a piece against what's worn and to rank everything in a slot.

export const STAT_LABELS = {
  attack: 'Attack', strength: 'Strength', defence: 'Defence', ranged: 'Ranged',
  magic: 'Magic', magicStr: 'Magic dmg', dance: 'Dance', crit: 'Crit %', hp: 'Bonus HP',
};
const STAT_KEYS = Object.keys(STAT_LABELS);

export const STAT_HELP = [
  ['Attack', 'how often your melee hits land'],
  ['Strength', 'how hard your melee hits are'],
  ['Ranged / Magic', 'accuracy and damage for bows and staves'],
  ['Dance', 'the Dancer\'s accuracy and damage with whips'],
  ['Defence', 'how often enemies miss you'],
  ['Speed', 'time between swings — lower is faster'],
];

/** Weapon style: 'melee' | 'ranged' | 'magic' | 'dance'. */
export function weaponStyle(id) { return getItem(id).equip?.combatType || 'melee'; }

/** Combat beats between swings (matches Equipment.weaponSpeed()). */
export function swingBeats(id) { return Math.max(1, (getItem(id).equip?.bonuses?.speed || 5) - 3); }

/** A single "how good is this" number. Weapons count damage per swing beat, so
 *  a fast sword can outrank a slow axe with bigger numbers. */
export function gearRating(id) {
  const eq = getItem(id).equip;
  if (!eq) return 0;
  const b = eq.bonuses || {};
  const offence = (b.attack || 0) + (b.strength || 0) + (b.ranged || 0) + (b.magic || 0) + (b.magicStr || 0) * 8 + (b.dance || 0) * 2;
  const support = (b.defence || 0) + (b.crit || 0) * 2 + (b.hp || 0);
  if (eq.slot === 'weapon') return Math.round((offence * 2) / swingBeats(id)) + support;
  return offence + support;
}

/** Rating including the item's upgrade level, so a +5 piece can beat a better base item. */
function upgradedRating(id, equipment) {
  const lv = equipment.upgradeLevel ? equipment.upgradeLevel(id) : 0;
  if (!lv) return gearRating(id);
  const base = getItem(id).equip.bonuses || {};
  const up = equipment.itemBonuses(id);
  let extra = 0;
  for (const k of Object.keys(up)) if (k !== 'speed') extra += (up[k] || 0) - (base[k] || 0);
  return gearRating(id) + (getItem(id).equip.slot === 'weapon' ? Math.round((extra * 2) / swingBeats(id)) : extra);
}

/** Can the player wear it yet? Lists any skill levels still missing. */
export function meetsReq(id, skills) {
  const missing = [];
  for (const [skill, lvl] of Object.entries(getItem(id).equip?.req || {})) {
    if (skills.level(skill) < lvl) missing.push({ skill, lvl });
  }
  return { ok: missing.length === 0, missing };
}

/** Compare a piece against whatever is worn in its slot.
 *  verdict: 'empty' (slot is bare) | 'style' (a weapon of another style) |
 *           'upgrade' | 'downgrade' | 'same' | 'worn' (it IS the worn piece). */
export function compareGear(id, equipment) {
  const eq = getItem(id).equip;
  if (!eq) return null;
  const worn = equipment.get(eq.slot);
  if (worn === id) return { worn, verdict: 'worn', deltas: [], ratingDelta: 0 };
  const mine = equipment.itemBonuses ? equipment.itemBonuses(id) : (eq.bonuses || {});
  const theirs = worn ? (equipment.itemBonuses ? equipment.itemBonuses(worn) : getItem(worn).equip?.bonuses || {}) : {};
  const deltas = [];
  for (const k of STAT_KEYS) {
    const d = (mine[k] || 0) - (theirs[k] || 0);
    if (d) deltas.push({ key: k, label: STAT_LABELS[k], delta: d });
  }
  if (eq.slot === 'weapon') {
    const d = swingBeats(id) - (worn ? swingBeats(worn) : 2);
    if (d) deltas.push({ key: 'speed', label: 'Speed', delta: +(d * 0.3).toFixed(1), lowerIsBetter: true });
  }
  if (!worn) return { worn, verdict: 'empty', deltas, ratingDelta: gearRating(id) };
  if (eq.slot === 'weapon' && weaponStyle(id) !== weaponStyle(worn)) {
    return { worn, verdict: 'style', deltas, ratingDelta: gearRating(id) - gearRating(worn) };
  }
  const ratingDelta = upgradedRating(id, equipment) - upgradedRating(worn, equipment);
  return { worn, verdict: ratingDelta > 0 ? 'upgrade' : ratingDelta < 0 ? 'downgrade' : 'same', deltas, ratingDelta };
}

let _bySlot = null;
/** Every equippable item, grouped by slot and sorted best first. */
export function gearBySlot() {
  if (_bySlot) return _bySlot;
  _bySlot = {};
  for (const s of EQUIP_SLOTS) _bySlot[s] = [];
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.equip && _bySlot[it.equip.slot]) _bySlot[it.equip.slot].push(id);
  }
  for (const s of EQUIP_SLOTS) {
    _bySlot[s].sort((a, b) => gearRating(b) - gearRating(a) || getItem(a).name.localeCompare(getItem(b).name));
  }
  return _bySlot;
}

/** Rank within its slot (weapons: within their style): { rank: 1 = best, of: how many }. */
export function tierOf(id) {
  const slot = getItem(id).equip?.slot;
  let list = gearBySlot()[slot] || [];
  if (slot === 'weapon') list = list.filter((w) => weaponStyle(w) === weaponStyle(id));
  return { rank: list.indexOf(id) + 1, of: list.length };
}

/** "+12 Defence, −2 Attack" style summary. */
export function deltaText(deltas) {
  return deltas.map((d) => `${d.delta > 0 ? '+' : '−'}${Math.abs(d.delta)}${d.key === 'speed' ? 's' : ''} ${d.label}`).join(', ');
}
