// Boss armour types: every boss wears one of four kinds of armour, so each
// class has bosses it is good against and bosses it finds hard. The type comes
// from the boss's race and kind of creature (races.js, the sprite), with a small
// override table for the bosses that don't fit their race. npcs.js stamps it on
// every boss definition as `armourType`; combat.js applies it (armourOf,
// bossTypeDmgMult, bossGrazeChance). Bosses only: ordinary monsters and
// champions keep their plain armour.
//
// "Slow" below is how slow your attacks are: 0 for the quickest (pistols, claws,
// daggers, shurikens, spells), 1 for a swing every 1.25 beats or slower (great
// swords, halberds, rifles); see attackSlowness in combat.js.
import { raceOf } from './races.js';

export const BOSS_TYPES = {
  // Stone, metal and shell: the most armour of any boss, so armour pierce counts
  // most, and blunt weapons crack it open.
  plated: { name: 'Plated', icon: '🛡️', armour: 0.15, cap: 0.75, blunt: 1.2,
    hint: 'Plated: bring armour pierce or a blunt weapon (mace, warhammer, toya).' },
  // Spirits, demons and the restless dead: little armour, but wards that soak spells.
  warded: { name: 'Warded', icon: '🔮', armour: -0.1, magic: 0.7,
    hint: 'Warded: spells fizzle on its wards; weapons cut through.' },
  // Birds, cats, snakes and other quick things: little armour, but they twist away
  // from slow swings, which only graze them (a "Grazed" blow does `grazeDmg` of its
  // damage, never under 1: every blow still lands a number, as the owner wants).
  evasive: { name: 'Evasive', icon: '💨', armour: -0.15, graze: [0.15, 0.45], grazeDmg: 0.35,
    hint: 'Evasive: slow swings only graze it; quick attacks land clean.' },
  // Beasts, great fish, crocodiles and trees: light blows glance off a thick hide,
  // heavy ones land, and armour breaks (skills' sunder, Earth's cracks) bite deeper.
  thick: { name: 'Thick-hided', icon: '🦏', glance: [0.85, 1.15], breaks: 1.5,
    hint: 'Thick-hided: light blows glance off; hit hard and break its armour.' },
};
export const BLUNT_TYPES = new Set(['mace', 'warhammer', 'toya']);

// By race first, then by kind of creature where a race mixes several.
const TYPE_BY_RACE = { construct: 'plated', dragon: 'plated', spirit: 'warded', demon: 'warded', undead: 'warded',
  avian: 'evasive', beast: 'thick', flora: 'thick', aquatic: 'thick', reptile: 'thick', humanoid: 'plated' };
const TYPE_BY_SPRITE = { crab: 'plated', turtle: 'plated', scorpion: 'plated', serpent: 'evasive', spider: 'evasive',
  insect: 'evasive', primate: 'evasive', rodent: 'evasive', fowl: 'evasive' };
// The bosses that don't fit their race or kind.
export const BOSS_TYPE_OVERRIDE = {
  bone_colossus: 'plated',          // a towering frame of bone: armour, not wards
  night_safari_tiger: 'evasive', shadow_panther: 'evasive', harimau_jadian: 'evasive',   // the great cats
  bandit_kingpin: 'evasive', bedok_bandit_lord: 'evasive',   // light on their feet, no plate
  toyol_kingpin: 'warded',          // a spirit-child's master
  orang_minyak: 'evasive',          // the oily man slips out of every grip
  duyung_queen: 'warded',           // a sea witch
  kopitiam_roach_queen: 'plated',   // a shell like a lacquered table
};

/** The armour type id ('plated' | 'warded' | 'evasive' | 'thick') of a boss. */
export function bossTypeFor(def, id) {
  return BOSS_TYPE_OVERRIDE[id] || TYPE_BY_SPRITE[def?.sprite] || TYPE_BY_RACE[raceOf(def, id)] || 'thick';
}
