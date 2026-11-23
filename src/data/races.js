// Races: every monster and boss belongs to one, and each weapon type bites
// harder into some races and is shrugged off by others. A dagger finds the gaps
// in a bandit's coat but skitters off a stone golem; a warhammer cracks golems
// and crab shells; arrows pass straight through spirits. This sits on top of the
// melee / ranged / magic weakness in combat.js, so both can stack.

export const RACES = {
  beast:     { name: 'Beast',        icon: '🐾', desc: 'Furred and hoofed animals: boars, dogs, monkeys, big cats.' },
  reptile:   { name: 'Reptile',      icon: '🦎', desc: 'Scaled and cold-blooded: lizards, crocodiles, snakes.' },
  dragon:    { name: 'Dragon',       icon: '🐉', desc: 'Drakes, wyrms and dragons. Thick scales, fiery breath.' },
  aquatic:   { name: 'Sea creature', icon: '🦀', desc: 'Shelled and finned: crabs, sharks, turtles, jellyfish.' },
  bug:       { name: 'Bug',          icon: '🕷️', desc: 'Insects and arachnids: spiders, scorpions, mantises.' },
  avian:     { name: 'Flyer',        icon: '🦅', desc: 'Birds and bats, quick on the wing.' },
  undead:    { name: 'Undead',       icon: '💀', desc: 'Skeletons, revenants and restless corpses.' },
  spirit:    { name: 'Spirit',       icon: '👻', desc: 'Ghosts, wisps and the hantu of island folklore.' },
  construct: { name: 'Construct',    icon: '🗿', desc: 'Golems of stone, rust and rune.' },
  humanoid:  { name: 'Humanoid',     icon: '🧑', desc: 'People and goblins: bandits, smugglers, warlords.' },
  demon:     { name: 'Demon',        icon: '😈', desc: 'Imps, jinn and lords of the rift.' },
  flora:     { name: 'Plant',        icon: '🌿', desc: 'Living plants, treants and oozes.' },
};

// Body type (the sprite archetype) decides the race, with a few exceptions below.
const RACE_BY_SPRITE = {
  beast: 'beast', hound: 'beast', primate: 'beast', rodent: 'beast',
  reptile: 'reptile', serpent: 'reptile',
  drake: 'dragon',
  crab: 'aquatic', seacreature: 'aquatic', jellyfish: 'aquatic', turtle: 'aquatic',
  insect: 'bug', spider: 'bug', scorpion: 'bug', mantis: 'bug',
  fowl: 'avian', bat: 'avian',
  undead: 'undead',
  ghost: 'spirit', wisp: 'spirit',
  golem: 'construct',
  humanoid: 'humanoid', greenman: 'humanoid',
  demon: 'demon',
  plant: 'flora', slime: 'flora',
};
// Creatures whose body type doesn't tell their story (by family or boss id).
const RACE_OVERRIDE = {
  toyol: 'spirit', orang_minyak: 'spirit', spirit_of_badang: 'spirit',   // folklore spirits
  the_garuda: 'avian', celestial_garuda: 'avian',                        // great birds, not dragons
  celestial_qilin: 'dragon',                                             // a dragon-kin of the heavens
  scarecrow: 'flora',                                                    // straw on a stick
  town_guard: 'humanoid',                                                // the town watch (game.js spawnTownGuards)
};

/** The race id of a monster or boss definition (pass its npc id for bosses). */
export function raceOf(def, id) {
  if (!def) return 'beast';
  return RACE_OVERRIDE[def.family] || RACE_OVERRIDE[id] || RACE_BY_SPRITE[def.sprite] || 'beast';
}

// Which races each weapon type is strong against, and which shrug it off.
// Every weapon type has at least two good matchups, so every class has prey.
export const WEAPON_VS_RACE = {
  dagger:    { strong: ['humanoid', 'beast'],            weak: ['construct', 'dragon', 'undead', 'spirit'] },
  sword:     { strong: ['humanoid', 'flora'],            weak: ['construct'] },
  scimitar:  { strong: ['beast', 'flora'],               weak: ['construct', 'aquatic'] },
  mace:      { strong: ['undead', 'demon', 'aquatic'],   weak: ['flora'] },
  longsword: { strong: ['dragon', 'reptile'],            weak: ['construct'] },
  battleaxe: { strong: ['flora', 'beast'],               weak: ['spirit'] },
  warhammer: { strong: ['construct', 'undead', 'aquatic'], weak: ['flora', 'spirit', 'avian'] },
  '2h_sword': { strong: ['dragon', 'demon'],             weak: ['avian'] },
  spear:     { strong: ['beast', 'reptile'],             weak: ['spirit'] },
  claws:     { strong: ['bug', 'humanoid'],              weak: ['construct', 'aquatic', 'dragon', 'reptile'] },
  katana:    { strong: ['reptile', 'humanoid'],          weak: ['construct'] },
  halberd:   { strong: ['dragon', 'construct'],          weak: [] },
  shortbow:  { strong: ['bug', 'avian'],                 weak: ['construct', 'spirit', 'dragon', 'undead'] },
  longbow:   { strong: ['avian', 'dragon'],              weak: ['spirit'] },
  staff:     { strong: ['spirit', 'undead', 'flora', 'aquatic'], weak: [] },
  wand:      { strong: ['spirit', 'demon'],              weak: [] },
  whip:      { strong: ['bug', 'avian'],                 weak: [] },
  pistol:    { strong: ['humanoid', 'construct'],        weak: ['spirit', 'dragon'] },
  rifle:     { strong: ['dragon', 'beast', 'reptile'],    weak: ['spirit'] },
  shuriken:  { strong: ['bug', 'beast', 'avian'],        weak: ['construct'] },
  cane:      { strong: ['humanoid', 'beast'],            weak: ['dragon', 'construct'] },
  // Secondary weapon types (see SECONDARY_WEAPON in classes.js)
  parang:    { strong: ['flora', 'beast'],               weak: ['construct'] },
  kerambit:  { strong: ['humanoid', 'reptile'],          weak: ['construct', 'dragon'] },
  toya:      { strong: ['humanoid', 'undead'],           weak: ['dragon'] },
  crossbow:  { strong: ['construct', 'reptile'],         weak: ['spirit'] },
  chakram:   { strong: ['bug', 'flora', 'avian'],        weak: ['construct'] },
  orb:       { strong: ['demon', 'undead'],              weak: [] },
  fan:       { strong: ['spirit', 'avian'],              weak: [] },
  // The Monk's: iron fists crack stone and quick jabs swat flyers; open palms drive out spirits and demons.
  knuckles:  { strong: ['construct', 'avian'],           weak: [] },
  monk_gloves: { strong: ['spirit', 'demon'],            weak: [] },
};

// Effective: harder hitting. A weapon is never WEAKER against a race (the
// owner's rule: matchups only ever help), so the old 'resisted' penalty is
// gone; the `weak` lists above are kept only as data and no longer apply.
export const RACE_BONUS = { dmg: 1.3 };
export const RACE_PENALTY = { dmg: 1 };   // kept for old imports: no penalty any more

/** 'strong' | null: how a weapon type fares against a race (never 'weak'). */
export function matchup(weaponType, race) {
  const m = WEAPON_VS_RACE[weaponType];
  if (!m) return null;
  return m.strong.includes(race) ? 'strong' : null;
}

/** Weapon types that are strong (and weak) against a race, for the bestiary. */
export function weaponsFor(race) {
  const strong = [], weak = [];
  for (const [w, m] of Object.entries(WEAPON_VS_RACE)) {
    if (m.strong.includes(race)) strong.push(w);
  }
  return { strong, weak };   // nothing resists any more, so `weak` stays empty
}

/** A friendly name for a weapon type id. */
const TYPE_NAME = { '2h_sword': 'two-handed sword', knuckles: 'monk knuckles', monk_gloves: 'monk gloves' };
export const weaponTypeName = (w) => TYPE_NAME[w] || w;
