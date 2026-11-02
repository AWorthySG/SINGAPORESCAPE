// Job classes: one per weapon type. A character picks a class at the start (it
// is permanent) and can only wield weapons of that class's type. Armour,
// tools and everything else stay open to every class.
import { ITEMS } from './items.js';

export const CLASSES = [
  // Melee
  { id: 'rogue', name: 'Rogue', weapon: 'dagger', style: 'melee', desc: 'Quick daggers, and two at once: dual wield for a strike from each hand.' },
  { id: 'swordsman', name: 'Swordsman', weapon: 'sword', style: 'melee', desc: 'A steady, well-rounded blade fighter.' },
  { id: 'corsair', name: 'Corsair', weapon: 'scimitar', style: 'melee', desc: 'Two curved scimitars at once, swung faster than any other blade.' },
  { id: 'paladin', name: 'Paladin', weapon: 'mace', style: 'melee', desc: 'Holy maces that crush armour.' },
  { id: 'knight', name: 'Knight', weapon: 'longsword', style: 'melee', desc: 'Longswords that strike from 3 tiles away.' },
  { id: 'berserker', name: 'Berserker', weapon: 'battleaxe', style: 'melee', desc: 'Heavy battleaxes for huge, wild blows.' },
  { id: 'juggernaut', name: 'Juggernaut', weapon: 'warhammer', style: 'melee', desc: 'Warhammers that hit harder than anything.' },
  { id: 'gladiator', name: 'Gladiator', weapon: '2h_sword', style: 'melee', desc: 'Mighty two-handed swords with long reach.' },
  { id: 'lancer', name: 'Lancer', weapon: 'spear', style: 'melee', desc: 'Accurate spears that reach 3 tiles.' },
  { id: 'brawler', name: 'Brawler', weapon: 'claws', style: 'melee', desc: 'Lightning-fast claws: the quickest swings in the game, and they crit often.' },
  { id: 'samurai', name: 'Samurai', weapon: 'katana', style: 'melee', desc: 'Keen katanas: fast, balanced and deadly.' },
  { id: 'halberdier', name: 'Halberdier', weapon: 'halberd', style: 'melee', desc: 'Slow, devastating halberds with 3-tile reach.' },
  // Ranged
  { id: 'archer', name: 'Archer', weapon: 'shortbow', style: 'ranged', desc: 'Rapid shortbows: arrow after arrow from afar.' },
  { id: 'ranger', name: 'Ranger', weapon: 'longbow', style: 'ranged', desc: 'Longbows: slower, harder-hitting shots from very far.' },
  // Magic
  { id: 'wizard', name: 'Wizard', weapon: 'staff', style: 'magic', desc: 'Powerful staves; elemental staves give free runes.' },
  { id: 'sorcerer', name: 'Sorcerer', weapon: 'wand', style: 'magic', desc: 'Quick-casting wands, lighter but faster than staves.' },
  // Dance
  { id: 'dancer', name: 'Dancer', weapon: 'whip', style: 'dance', desc: 'Whips that lash from 3 tiles, building Rhythm and dodging blows.' },
];

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

// Armour families: each class wears one kind of helm, body and legs armour.
export const ARMOUR_FAMILIES = {
  plate: { name: 'Plate', desc: 'Heavy metal armour: the most Defence, and it pierces armour.', stat: 'armour piercing' },
  leather: { name: 'Scout leather', desc: 'Light studded leather: less Defence, but extra Attack, crit chance and crit damage.', stat: 'crit damage' },
  hide: { name: 'Hide', desc: 'Archers\u2019 hide: Ranged bonus and quicker shots.', stat: 'attack speed' },
  robes: { name: 'Robes', desc: 'Casters\u2019 robes: Magic bonus and extra damage to bosses.', stat: 'boss damage' },
  dancewear: { name: 'Dancewear', desc: 'Silk and gold outfits: Dance bonus and lifesteal.', stat: 'lifesteal' },
};
export const ARMOUR_FAMILY = {
  swordsman: 'plate', paladin: 'plate', knight: 'plate', berserker: 'plate', juggernaut: 'plate', gladiator: 'plate', lancer: 'plate', halberdier: 'plate',
  rogue: 'leather', corsair: 'leather', brawler: 'leather', samurai: 'leather',
  archer: 'hide', ranger: 'hide', wizard: 'robes', sorcerer: 'robes', dancer: 'dancewear',
};
/** Can this class wear this item? (Only helm, body and legs armour is restricted.) */
export function canWear(classId, id) {
  const fam = ITEMS[id]?.equip?.family;
  return !fam || !classId || ARMOUR_FAMILY[classId] === fam;
}
/** The piece of a family that best matches another piece's slot and level (for loot). */
export function equivalentArmour(id, family) {
  const eq = ITEMS[id]?.equip;
  if (!eq) return id;
  const req = (x) => Math.max(0, ...Object.values(ITEMS[x].equip.req || {}));
  const lvl = req(id);
  const metal = id.split('_')[0];
  let best = null;
  for (const [x, it] of Object.entries(ITEMS)) {
    if (it.equip?.family !== family || it.equip.slot !== eq.slot || req(x) > lvl) continue;
    // Highest level that fits; on a tie, the same metal tier (rune plate -> rune scout).
    if (!best || req(x) > req(best) || (req(x) === req(best) && x.startsWith(metal + '_'))) best = x;
  }
  return best || id;
}
// Melee cleave: the share of a hit that sweeps into foes next to the target.
// Quick weapons (scimitars, claws) don't cleave; they swing faster instead.
export const CLEAVE_SHARE = {
  dagger: 0.35, sword: 0.45, mace: 0.45, katana: 0.45, longsword: 0.5, spear: 0.4,
  battleaxe: 0.65, warhammer: 0.6, '2h_sword': 0.7, halberd: 0.65,
};
export const CLASS_FOR_WEAPON = Object.fromEntries(CLASSES.map((c) => [c.weapon, c]));
export const WEAPON_TYPE_NAMES = {
  dagger: 'daggers', sword: 'swords', scimitar: 'scimitars', mace: 'maces', longsword: 'longswords', battleaxe: 'battleaxes',
  warhammer: 'warhammers', '2h_sword': '2h swords', spear: 'spears', claws: 'claws', katana: 'katanas', halberd: 'halberds',
  shortbow: 'shortbows', longbow: 'longbows', staff: 'staves', wand: 'wands', whip: 'whips',
};

/** Weapon type of an item (null for non-weapons and tools). */
export const weaponTypeOf = (id) => ITEMS[id]?.equip?.weaponType || null;

/** The class's own first weapon (the lowest-level weapon of its type). */
export function starterWeapon(classId) {
  return weaponsOfType(CLASS_BY_ID[classId].weapon)[0];
}

const _byType = {};
/** Every weapon of a type, lowest level first (uniques included). */
export function weaponsOfType(type) {
  if (_byType[type]) return _byType[type];
  const req = (id) => Math.max(0, ...Object.values(ITEMS[id].equip.req || {}));
  _byType[type] = Object.keys(ITEMS).filter((id) => ITEMS[id].equip?.weaponType === type)
    .sort((a, b) => req(a) - req(b) || (ITEMS[a].value || 0) - (ITEMS[b].value || 0));
  return _byType[type];
}

/** The weapon of `type` that best matches another weapon's level (for loot). */
export function equivalentWeapon(id, type) {
  const lvl = Math.max(0, ...Object.values(ITEMS[id]?.equip?.req || {}));
  const list = weaponsOfType(type).filter((w) => !UNIQUES.has(w));
  let best = list[0];
  for (const w of list) if (Math.max(0, ...Object.values(ITEMS[w].equip.req || {})) <= lvl) best = w;
  return best;
}
const UNIQUES = new Set(['tiger_kris', 'merlion_blade', 'cursed_cutlass', 'seraph_blade', 'megalodon_jaw', 'granite_maul', 'void_blade', 'leviathan_trident', 'tiger_fang']);
