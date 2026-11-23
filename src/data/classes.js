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
  { id: 'lancer', name: 'Lancer', weapon: 'spear', style: 'melee', desc: 'Long spears that reach 4 tiles.' },
  { id: 'brawler', name: 'Brawler', weapon: 'claws', style: 'melee', desc: 'Lightning-fast claws: the quickest swings in the game, and they crit often.' },
  { id: 'samurai', name: 'Samurai', weapon: 'katana', style: 'melee', desc: 'Keen katanas: fast, balanced and deadly.' },
  { id: 'halberdier', name: 'Halberdier', weapon: 'halberd', style: 'melee', desc: 'Slow, devastating halberds with 3-tile reach.' },
  // Added after the boss signature weapons were dealt (see LATE_CLASSES in bossWeapons.js).
  { id: 'monk', name: 'Monk', weapon: 'knuckles', style: 'melee', desc: 'Monk knuckles and gloves: a punch and a palm strike every swing, building Chi that hits harder and heals.' },
  { id: 'merchant', name: 'Merchant', weapon: 'cane', style: 'ranged', desc: 'The strongest class, if you can pay for it: throws money, and every attack and skill costs coins. Its coin throws and allies hit about twice as hard as other classes, its coins scatter through crowds, and it hires mercenaries and calls up A-Worthling mirror images.' },
  // Ranged
  { id: 'archer', name: 'Archer', weapon: 'shortbow', style: 'ranged', desc: 'Rapid shortbows: arrow after arrow from afar, each spread also flinging an extra arrow into up to two foes around your target.' },
  { id: 'ranger', name: 'Ranger', weapon: 'longbow', style: 'ranged', desc: 'Longbows: slower, harder-hitting shots from a little further off that pierce into the foes behind.' },
  { id: 'pistoler', name: 'Pistoler', weapon: 'pistol', style: 'ranged', desc: 'A pistol in each hand: the fastest attacks in the game. Load rounds in the ammo slot to hit harder.' },
  { id: 'sniper', name: 'Sniper', weapon: 'rifle', style: 'ranged', desc: 'A sniper rifle: the furthest reach in the game and massive shots, but slow to fire. Load rounds in the ammo slot to hit harder.' },
  { id: 'ninja', name: 'Ninja', weapon: 'shuriken', style: 'ranged', desc: 'A shuriken in each hand: both throw every attack and ricochet into a second foe. No ammo, and no shields.' },
  // Magic
  { id: 'wizard', name: 'Wizard', weapon: 'staff', style: 'magic', desc: 'Powerful staves; elemental staves give free runes.' },
  { id: 'sorcerer', name: 'Sorcerer', weapon: 'wand', style: 'magic', desc: 'Quick-casting wands, lighter but faster than staves.' },
  // Added after the boss signature weapons were dealt (see LATE_CLASSES in bossWeapons.js).
  { id: 'priest', name: 'Priest', weapon: 'orb', style: 'magic', desc: 'Holy orbs: every spell heals you a little and smites undead, spirits and demons, and your skills lift your blessings.' },
  { id: 'zealot', name: 'Zealot', weapon: 'censer', style: 'magic', desc: 'A burning censer on a chain: holy fire that stacks on foes, more damage the more hurt you are, and skills paid for in life.' },
  // Dance
  { id: 'dancer', name: 'Dancer', weapon: 'whip', style: 'dance', desc: 'Whips that lash from 3 tiles, building Rhythm and dodging blows.' },
];

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

// Armour families: each class wears one kind of helm, body and legs armour.
export const ARMOUR_FAMILIES = {
  plate: { name: 'Plate', desc: 'Heavy metal armour: the most Defence, and it pierces armour.', stat: 'armour piercing' },
  leather: { name: 'Scout leather', desc: 'Light studded leather: less Defence, but extra Attack, crit chance, crit damage and armour piercing.', stat: 'armour piercing and crit damage' },
  hide: { name: 'Hide', desc: 'Archers\u2019 hide: Ranged bonus, armour piercing and quicker shots.', stat: 'armour piercing' },
  robes: { name: 'Robes', desc: 'Casters\u2019 robes: Magic bonus, Magic bonus % and armour piercing for spells.', stat: 'armour piercing and magic bonus' },
  dancewear: { name: 'Dancewear', desc: 'Silk and gold outfits: Dance bonus, armour piercing and lifesteal.', stat: 'armour piercing and lifesteal' },
};
export const ARMOUR_FAMILY = {
  swordsman: 'plate', paladin: 'plate', knight: 'plate', berserker: 'plate', juggernaut: 'plate', gladiator: 'plate', lancer: 'plate', halberdier: 'plate',
  rogue: 'leather', corsair: 'leather', brawler: 'leather', samurai: 'leather',
  archer: 'hide', ranger: 'hide', wizard: 'robes', sorcerer: 'robes', dancer: 'dancewear',
  pistoler: 'hide', ninja: 'leather', merchant: 'hide', sniper: 'hide',
  monk: 'leather', priest: 'robes', zealot: 'robes',
};
// Ninjas throw a shuriken from each hand (the off-hand one goes where a shield
// would), so no shield-slot piece (shield, buckler, quiver or tome) is for them.
// Nor for Monks: monk knuckles on one hand and monk gloves on the other.
export const NO_SHIELD_CLASSES = new Set(['ninja', 'monk']);
export const NO_SHIELD_MSG = 'Ninjas fight with a shuriken in each hand: no shields.';
const NO_SHIELD_MSGS = { monk: 'Monks fight with knuckles and gloves, one on each hand: no shields.' };   // other shieldless classes' own reasons
/** Why this class holds no shield (NO_SHIELD_MSG is the Ninja's). */
export const noShieldMsg = (classId) => NO_SHIELD_MSGS[classId] || NO_SHIELD_MSG;
/** Is this a shield-slot piece (not an off-hand weapon) this class can't hold? */
export function shieldBarred(classId, id) {
  const eq = ITEMS[id]?.equip;
  return NO_SHIELD_CLASSES.has(classId) && eq?.slot === 'shield' && !eq.weaponType;
}
/** Can this class wear this item? (Only helm, body and legs armour is restricted, and a Ninja's shields.) */
export function canWear(classId, id) {
  if (shieldBarred(classId, id)) return false;
  const fam = ITEMS[id]?.equip?.family;
  return !fam || !classId || ARMOUR_FAMILY[classId] === fam;
}
// Each class also wields one secondary weapon type of its own fighting style
// (its main type stays its identity: starter weapon, perks, abilities).
export const SECONDARY_WEAPON = {
  // The Samurai takes the parang, a short chopping blade like a wakizashi: two dual-wielded
  // kerambits out-damaged a lone katana by half again.
  swordsman: 'parang', corsair: 'parang', berserker: 'parang', gladiator: 'parang', samurai: 'parang',
  rogue: 'kerambit', brawler: 'kerambit',
  paladin: 'toya', knight: 'toya', juggernaut: 'toya', lancer: 'toya', halberdier: 'toya',
  archer: 'crossbow', ranger: 'crossbow', sniper: 'crossbow',
  pistoler: 'chakram', ninja: 'chakram', merchant: 'chakram',
  wizard: 'orb', sorcerer: 'orb', dancer: 'fan',
  // The Monk's monk gloves are worn on the other hand from its knuckles (one dual-wield
  // kind, see dualType in equipment.js): a palm strike after every punch.
  monk: 'monk_gloves',
  // The Priest's orbs and the Zealot's censers: each is the other's second weapon
  // (the orb stays the Wizard's and Sorcerer's second too).
  priest: 'censer', zealot: 'orb',
};
/** Can this class wield this weapon type? (Its own type or its secondary; no class = anything.) */
export function canWield(classId, type) { const c = CLASS_BY_ID[classId]; return !c || !type || c.weapon === type || SECONDARY_WEAPON[classId] === type; }
export const classesForType = (t) => CLASSES.filter((c) => canWield(c.id, t));
// The share of a class's weapon drops that are its second type: a quarter, but half
// for a Monk, which always wears both (its gloves on the other hand).
const SECOND_SHARE = { monk: 0.5 };
/** A piece of gear for a class at about a monster's level: its weapon type or
 *  its armour family, the best one that level allows (for boss drops). */
export function classGearFor(classId, level, rand = Math.random) {
  const cls = CLASS_BY_ID[classId];
  if (!cls) return null;
  const req = (x) => Math.max(0, ...Object.values(ITEMS[x].equip.req || {}));
  const pickBest = (ids) => ids.filter((x) => req(x) <= level).sort((a, b) => req(b) - req(a))[0] || ids[0];
  if (rand() < 0.5) { const t = SECONDARY_WEAPON[classId] && rand() < (SECOND_SHARE[classId] || 0.25) ? SECONDARY_WEAPON[classId] : cls.weapon; return pickBest(weaponsOfType(t).filter((w) => !UNIQUES.has(w))); }
  const slot = ['head', 'body', 'legs', 'hands', 'feet'][Math.floor(rand() * 5)];
  const fam = ARMOUR_FAMILY[classId];
  return pickBest(Object.keys(ITEMS).filter((x) => ITEMS[x].equip?.family === fam && ITEMS[x].equip.slot === slot));
}

/** The piece of a family that best matches another piece's slot and level (for loot).
 *  Each answer is kept (like weaponsOfType): it is a pass over every item, and a
 *  late-game fight asks it for drop after drop. */
const _equivArmour = new Map();
export function equivalentArmour(id, family) {
  const key = `${id}|${family}`;
  let v = _equivArmour.get(key);
  if (v === undefined) _equivArmour.set(key, (v = findEquivalentArmour(id, family)));
  return v;
}
// Each family's pieces, in item order, gathered in one pass over every item the
// first time the family is asked about (each new drop used to make that pass).
const _familyPieces = new Map();
const familyPieces = (family) => {
  let list = _familyPieces.get(family);
  if (!list) _familyPieces.set(family, (list = Object.keys(ITEMS).filter((x) => ITEMS[x].equip?.family === family)));
  return list;
};
function findEquivalentArmour(id, family) {
  const eq = ITEMS[id]?.equip;
  if (!eq) return id;
  const req = (x) => Math.max(0, ...Object.values(ITEMS[x].equip.req || {}));
  const lvl = req(id);
  const metal = id.split('_')[0];
  let best = null;
  for (const x of familyPieces(family)) {
    if (ITEMS[x].equip.slot !== eq.slot || req(x) > lvl) continue;
    // Highest level that fits; on a tie, the same metal tier (rune plate -> rune scout).
    if (!best || req(x) > req(best) || (req(x) === req(best) && x.startsWith(metal + '_'))) best = x;
  }
  return best || id;
}
// Melee cleave: the share of a hit that sweeps into foes next to the target.
// Every melee weapon cleaves; the quick ones (scimitars, claws) sweep a smaller
// share, since they swing so much more often.
export const CLEAVE_SHARE = {
  scimitar: 0.25, claws: 0.25, dagger: 0.35, sword: 0.45, mace: 0.45, katana: 0.45, longsword: 0.5, spear: 0.4,
  battleaxe: 0.65, warhammer: 0.6, '2h_sword': 0.7, halberd: 0.65, cane: 0.4, parang: 0.55, kerambit: 0.25, toya: 0.5,
  knuckles: 0.25, monk_gloves: 0.35,   // the Monk's: quick knuckle jabs sweep little, heavier palm strikes a bit more
};
export const CLASS_FOR_WEAPON = Object.fromEntries(CLASSES.map((c) => [c.weapon, c]));
export const WEAPON_TYPE_NAMES = {
  dagger: 'daggers', sword: 'swords', scimitar: 'scimitars', mace: 'maces', longsword: 'longswords', battleaxe: 'battleaxes',
  warhammer: 'warhammers', '2h_sword': '2h swords', spear: 'spears', claws: 'claws', katana: 'katanas', halberd: 'halberds',
  shortbow: 'shortbows', longbow: 'longbows', staff: 'staves', wand: 'wands', whip: 'whips',
  pistol: 'pistols', shuriken: 'shurikens', cane: 'canes', rifle: 'sniper rifles',
  parang: 'parangs', kerambit: 'kerambits', toya: 'toya staves', crossbow: 'crossbows', chakram: 'chakrams', orb: 'orbs', fan: 'war fans',
  knuckles: 'monk knuckles', monk_gloves: 'monk gloves', censer: 'censers',
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
// Boss uniques and boss signature weapons (bossWeapons.js) only come from their own boss, never as stand-in loot.
const UNIQUES = new Set(['tiger_kris', 'merlion_blade', 'cursed_cutlass', 'seraph_blade', 'megalodon_jaw', 'granite_maul', 'void_blade', 'leviathan_trident', 'tiger_fang',
  ...Object.keys(ITEMS).filter((id) => ITEMS[id].signature)]);
