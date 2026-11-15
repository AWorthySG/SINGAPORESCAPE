import { ITEMS, getItem } from '../data/items.js';
import { EQUIP_SLOTS, QUICK_TYPES } from './equipment.js';

// Gear guide: one comparable "rating" per piece of equipment, plus helpers to
// compare a piece against what's worn and to rank everything in a slot.

export const STAT_LABELS = {
  attack: 'Attack', strength: 'Melee power', defence: 'Defence', ranged: 'Ranged',
  magic: 'Magic', magicStr: 'Magic dmg', dance: 'Dance', crit: 'Crit %', hp: 'Bonus HP',
  pierce: 'Armour pierce %', critDmg: 'Crit damage %', haste: 'Attack speed %', lifesteal: 'Lifesteal %', bossDmg: 'Boss damage %',
  atkPct: 'Physical damage bonus %', magPct: 'Magic bonus %', prayer: 'Prayer',
};
const STAT_KEYS = Object.keys(STAT_LABELS);

export const STAT_HELP = [
  ['Attack', 'melee attack: a quarter of it adds to Melee power'],
  ['Melee power', 'how hard your melee hits are (the old Strength bonus)'],
  ['Ranged / Magic', 'damage for bows and staves'],
  ['Dance', 'the Dancer\'s damage with whips'],
  ['Defence', 'how often enemies miss you'],
  ['Speed', 'time between swings — lower is faster'],
  ['Armour pierce', 'extra damage on every hit, as a % (plate armour)'],
  ['Crit damage', 'makes critical hits (x2, or x4 on a mega crit) bigger still (scout leather)'],
  ['Attack speed', 'more attacks: +100% attacks twice as often, with no cap (every weapon, hide)'],
  ['Physical damage bonus', 'more damage from melee and ranged hits (bows, pistols, shurikens, swords, hide)'],
  ['Magic bonus', 'more damage from spells (staves, wands, robes)'],
  ['Lifesteal', 'heals you by a share of the damage you deal (dancewear)'],
  ['Boss damage', 'extra damage against bosses and champions'],
  ['Prayer', 'prayers drain more slowly: +30 halves the drain (prayer accessories)'],
];

/** Weapon style: 'melee' | 'ranged' | 'magic' | 'dance'. */
export function weaponStyle(id) { return getItem(id).equip?.combatType || 'melee'; }

/** Combat beats between swings (matches Equipment.weaponSpeed()). */
export function swingBeats(id) {
  const eq = getItem(id).equip;
  const melee = (eq?.combatType || 'melee') === 'melee' ? 0.5 : 1;   // melee swings twice as fast
  if (QUICK_TYPES.has(eq?.weaponType)) return 0.7 * melee;   // quick weapons
  if (eq?.weaponType === 'pistol') return 0.25;
  if (eq?.weaponType === 'shuriken' || eq?.weaponType === 'shortbow') return 0.5;
  return Math.max(1, (eq?.bonuses?.speed || 5) - 3) * melee;
}

/** How good a piece is for YOU right now: its stats with its mastery and enchantments,
 *  counting only the attack stats your fighting style uses (a melee amulet is
 *  worth nothing to an archer but its Defence). Weapons count damage per beat. */
export function effectiveRating(id, equipment, mode = 'melee') {
  const { offence, support } = effectiveParts(id, equipment, mode);
  return offence + support;
}

/** The two halves of effectiveRating: what a piece adds to your damage (for
 *  your style: its attack stat, crit, pierce, speed, lifesteal and damage
 *  bonuses; weapons per swing beat) and what it adds to staying alive
 *  (Defence, bonus HP). Equip best ranks by offence first (see offenceFirstScore). */
export function effectiveParts(id, equipment, mode = 'melee') {
  const eq = getItem(id).equip;
  if (!eq) return { offence: 0, support: 0 };
  const b = equipment.itemBonuses ? equipment.itemBonuses(id) : (eq.bonuses || {});
  const offence = mode === 'ranged' ? (b.ranged || 0) : mode === 'magic' ? (b.magic || 0) + (b.magicStr || 0) * 8
    : mode === 'dance' ? (b.dance || 0) * 2 : (b.attack || 0) + (b.strength || 0);
  const styleOk = !eq.style || eq.style === (mode === 'dance' ? 'melee' : mode);
  const extras = styleOk ? (b.crit || 0) * 2 + (b.pierce || 0) * 2 + (b.critDmg || 0) * 0.5 + (b.haste || 0) * 3 + (b.lifesteal || 0) * 3 + (b.bossDmg || 0) + (b.atkPct || 0) * 2 + (b.magPct || 0) * 2 : 0;
  const support = (b.defence || 0) + (b.hp || 0);
  if (eq.slot === 'weapon') return { offence: Math.round((offence * 2) / swingBeats(id)) + extras, support };
  return { offence: offence + extras, support };
}

/** Equip best's score: offence decides, and Defence and HP only break a tie,
 *  so a piece that hits harder always wins over a sturdier one. */
export function offenceFirstScore(id, equipment, mode = 'melee') {
  const { offence, support } = effectiveParts(id, equipment, mode);
  return offence * 1e6 + support;
}

/** A single "how good is this" number. Weapons count damage per swing beat, so
 *  a fast sword can outrank a slow axe with bigger numbers. */
export function gearRating(id, b = getItem(id).equip?.bonuses || {}) {
  const eq = getItem(id).equip;
  if (!eq) return 0;
  const offence = (b.attack || 0) + (b.strength || 0) + (b.ranged || 0) + (b.magic || 0) + (b.magicStr || 0) * 8 + (b.dance || 0) * 2;
  const support = (b.defence || 0) + (b.crit || 0) * 2 + (b.hp || 0)
    + (b.pierce || 0) * 2 + (b.critDmg || 0) * 0.5 + (b.haste || 0) * 3 + (b.lifesteal || 0) * 3 + (b.bossDmg || 0) + (b.atkPct || 0) * 2 + (b.magPct || 0) * 2;
  if (eq.slot === 'weapon') return Math.round((offence * 2) / swingBeats(id)) + support;
  return offence + support;
}

/** Rating including the item's mastery and enchant lines, so a well-mastered
 *  piece can beat a better base item. */
function masteredRating(id, equipment) {
  return gearRating(id, equipment.itemBonuses ? equipment.itemBonuses(id) : undefined);
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
  const ratingDelta = masteredRating(id, equipment) - masteredRating(worn, equipment);
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
