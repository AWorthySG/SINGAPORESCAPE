// Job classes: one per weapon type. A character picks a class at the start (it
// is permanent) and can only wield weapons of that class's type. Armour,
// tools and everything else stay open to every class.
import { ITEMS } from './items.js';

export const CLASSES = [
  // Melee
  { id: 'rogue', name: 'Rogue', weapon: 'dagger', style: 'melee', desc: 'Quick daggers, and two at once: dual wield for a strike from each hand.' },
  { id: 'swordsman', name: 'Swordsman', weapon: 'sword', style: 'melee', desc: 'A steady, well-rounded blade fighter.' },
  { id: 'corsair', name: 'Corsair', weapon: 'scimitar', style: 'melee', desc: 'Fast curved scimitars, swung with a pirate swagger.' },
  { id: 'paladin', name: 'Paladin', weapon: 'mace', style: 'melee', desc: 'Holy maces that crush armour.' },
  { id: 'knight', name: 'Knight', weapon: 'longsword', style: 'melee', desc: 'Longswords that strike from 3 tiles away.' },
  { id: 'berserker', name: 'Berserker', weapon: 'battleaxe', style: 'melee', desc: 'Heavy battleaxes for huge, wild blows.' },
  { id: 'juggernaut', name: 'Juggernaut', weapon: 'warhammer', style: 'melee', desc: 'Warhammers that hit harder than anything.' },
  { id: 'gladiator', name: 'Gladiator', weapon: '2h_sword', style: 'melee', desc: 'Mighty two-handed swords with long reach.' },
  { id: 'lancer', name: 'Lancer', weapon: 'spear', style: 'melee', desc: 'Accurate spears that reach 3 tiles.' },
  { id: 'brawler', name: 'Brawler', weapon: 'claws', style: 'melee', desc: 'Lightning-fast claws that crit often.' },
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
