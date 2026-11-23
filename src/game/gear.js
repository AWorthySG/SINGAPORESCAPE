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
  ['Prayer', 'Faith fills faster as you fight: +30 doubles it (prayer accessories)'],
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
export function effectiveRating(id, equipment, mode = 'melee', q = null) {
  const { offence, support } = effectiveParts(id, equipment, mode, 'main', q);
  return offence + support;
}

/** The two halves of effectiveRating: what a piece adds to your damage (for
 *  your style: its attack stat, crit, pierce, speed, lifesteal and damage
 *  bonuses; weapons per swing beat) and what it adds to staying alive
 *  (Defence, bonus HP). Equip best ranks by offence first (see offenceFirstScore). */
// (`copy`: which record's upgrades to count, 'off' for a twin pair's off-hand
// copy; see Equipment.copyIn. `q`: the copy's quality, null for plain.)
export function effectiveParts(id, equipment, mode = 'melee', copy = 'main', q = null) {
  const eq = getItem(id).equip;
  if (!eq) return { offence: 0, support: 0 };
  const b = equipment.itemBonuses ? equipment.itemBonuses(id, copy, q) : (eq.bonuses || {});
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
export function offenceFirstScore(id, equipment, mode = 'melee', copy = 'main', q = null) {
  const { offence, support } = effectiveParts(id, equipment, mode, copy, q);
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

/** Rating including the item's mastery, the copy's quality and its enchant
 *  lines, so a fine copy can beat a better base item. */
function masteredRating(id, equipment, copy = 'main', q = null) {
  return gearRating(id, equipment.itemBonuses ? equipment.itemBonuses(id, copy, q) : undefined);
}

/** The level a piece's `skill` requirement is checked against. The Dancer's
 *  gear (whips, fans and dancewear: anything with a Dance bonus) asks for
 *  Agility, but the Dancer's combat XP is split between Agility and Ranged, so
 *  its pooled dance level counts (it is never below Agility). */
export function reqLevel(id, skill, skills) {
  if (skill === 'agility' && getItem(id).equip?.bonuses?.dance && skills.danceLevel) return Math.max(skills.level(skill), skills.danceLevel());
  return skills.level(skill);
}

/** Can the player wear it yet? Lists any skill levels still missing. */
export function meetsReq(id, skills) {
  const missing = [];
  for (const [skill, lvl] of Object.entries(getItem(id).equip?.req || {})) {
    if (reqLevel(id, skill, skills) < lvl) missing.push({ skill, lvl });
  }
  return { ok: missing.length === 0, missing };
}

/** The stat changes from the worn piece's bonuses (`theirs`, worn id `worn`)
 *  to a new piece's (`mine`, id `id`): [{ key, label, delta }], each rounded
 *  to one decimal and only the ones that change. Refine and quality shares
 *  leave float dust behind, which the chat and tooltips showed as
 *  "−2.4000000000000004 Attack speed %". Weapons add their swing time. */
export function statDeltas(mine, theirs, id, worn) {
  const deltas = [];
  for (const k of STAT_KEYS) {
    const d = Math.round(((mine?.[k] || 0) - (theirs?.[k] || 0)) * 10) / 10;
    if (d) deltas.push({ key: k, label: STAT_LABELS[k], delta: d });
  }
  if (getItem(id).equip?.slot === 'weapon') {
    const d = swingBeats(id) - (worn ? swingBeats(worn) : 2);
    if (d) deltas.push({ key: 'speed', label: 'Speed', delta: +(d * 0.3).toFixed(1), lowerIsBetter: true });
  }
  return deltas;
}

/** Compare a piece (a copy of quality `q`, null for plain) against whatever
 *  is worn in its slot (or in `slot`: a dual wielder's off-hand weapon is
 *  weighed against the off-hand, 'shield'). The worn piece counts its own quality.
 *  verdict: 'empty' (slot is bare) | 'style' (a weapon of another style) |
 *           'upgrade' | 'downgrade' | 'same' | 'worn' (it IS the worn piece). */
// `mode` (your fighting style, Game.combatMode): when given, the verdict follows
// Equip best's rule (offenceFirstScore: only your style's attack stats count,
// and damage decides before Defence and HP). A weapon of another type than the
// one in hand is still weighed (the tooltip shows how it compares) but marked
// `otherType`: Equip best won't swap types, so isUpgrade doesn't call it one. Without it
// (no player to ask) every stat counts, as before. The owner found the green
// arrow calling things upgrades that Wear it then refused.
export function compareGear(id, equipment, slot = null, q = null, mode = null) {
  const eq = getItem(id).equip;
  if (!eq) return null;
  const worn = equipment.get(slot || eq.slot);
  const wornQ = equipment.qualityIn?.(slot || eq.slot) || null;
  if (worn === id && wornQ === (q || null)) return { worn, verdict: 'worn', deltas: [], ratingDelta: 0 };
  // Each side as it is (or would be) worn: a twin pair's off-hand copy has its own upgrades.
  const myCopy = equipment.copyFor?.(id, slot || eq.slot) || 'main', theirCopy = equipment.copyIn?.(slot || eq.slot) || 'main';
  const mine = equipment.itemBonuses ? equipment.itemBonuses(id, myCopy, q) : (eq.bonuses || {});
  const theirs = worn ? (equipment.itemBonuses ? equipment.itemBonuses(worn, theirCopy, wornQ) : getItem(worn).equip?.bonuses || {}) : {};
  const deltas = statDeltas(mine, theirs, id, worn);
  if (!worn) return { worn, verdict: 'empty', deltas, ratingDelta: gearRating(id) };
  if (eq.slot === 'weapon' && weaponStyle(id) !== weaponStyle(worn)) {
    return { worn, verdict: 'style', deltas, ratingDelta: gearRating(id) - gearRating(worn) };
  }
  const ratingDelta = masteredRating(id, equipment, myCopy, q) - masteredRating(worn, equipment, theirCopy, wornQ);
  if (mode) {
    const wt = getItem(worn).equip?.weaponType;
    const otherType = eq.slot === 'weapon' && !!wt && eq.weaponType !== wt;
    const d = offenceFirstScore(id, equipment, mode, myCopy, q) - offenceFirstScore(worn, equipment, mode, theirCopy, wornQ);
    return { worn, verdict: d > 0 ? 'upgrade' : d < 0 ? 'downgrade' : 'same', deltas, ratingDelta, otherType };
  }
  return { worn, verdict: ratingDelta > 0 ? 'upgrade' : ratingDelta < 0 ? 'downgrade' : 'same', deltas, ratingDelta };
}

/** Should the game call this an upgrade (the green arrow, the "Wear it" note)?
 *  Only what Equip best would put on: better for your style, and the weapon type in hand. */
export const isUpgrade = (cmp) => !!cmp && (cmp.verdict === 'empty' || (cmp.verdict === 'upgrade' && !cmp.otherType));

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
