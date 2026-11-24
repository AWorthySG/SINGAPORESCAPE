// Combat spells. Each needs a magic level, runes (item ids -> qty), gives a
// base max hit + magic xp per cast. Elemental tint drives the projectile colour
// (`critTint`, brighter, for a crit or a special: bolts used to turn purple on a
// crit, which late in the game was nearly every cast, so they hid their element).
// One spell per element. Its damage grows with Magic level instead of
// unlocking stronger tiers: base max hit = 2 + Magic/4, up to 20 (the old Wave
// spells' hit at Magic 72), then the Magic multiplier in combat.js on top.
export const SPELLS = [
  { id: 'wind_strike', name: 'Wind', level: 1, maxHit: 2, xp: 5.5, tint: '#bfe8d0', critTint: '#effff6', runes: { air_rune: 1, mind_rune: 1 } },
  { id: 'water_strike', name: 'Water', level: 5, maxHit: 2, xp: 7.5, tint: '#6fb6e0', critTint: '#b8e4ff', runes: { water_rune: 1, air_rune: 1, mind_rune: 1 } },
  { id: 'earth_strike', name: 'Earth', level: 9, maxHit: 2, xp: 9.5, tint: '#8a6a3a', critTint: '#e0b46a', runes: { earth_rune: 2, air_rune: 1, mind_rune: 1 } },
  { id: 'fire_strike', name: 'Fire', level: 13, maxHit: 2, xp: 11.5, tint: '#ef7a23', critTint: '#ffc04a', runes: { fire_rune: 3, air_rune: 2, mind_rune: 1 } },
  // The owner asked for more elements: Chaos, Dark and Blood, each on the
  // rarer runes (the general store and the elemental staves supply them).
  { id: 'chaos_strike', name: 'Chaos', level: 20, maxHit: 2, xp: 13.5, tint: '#d070ff', critTint: '#f4ccff', runes: { chaos_rune: 1, air_rune: 2, mind_rune: 1 } },
  { id: 'dark_strike', name: 'Dark', level: 30, maxHit: 2, xp: 15.5, tint: '#7a52c8', critTint: '#c2a6ff', runes: { death_rune: 1, air_rune: 2, mind_rune: 1 } },
  { id: 'blood_strike', name: 'Blood', level: 40, maxHit: 2, xp: 17.5, tint: '#d0243e', critTint: '#ff8a9a', runes: { blood_rune: 1, air_rune: 2, mind_rune: 1 } },
  // The Priest's and the Zealot's own elements (`cls`): each of those classes
  // casts only its own four (spellsFor), the Wizard and the Sorcerer the seven
  // above. Their runes follow the same ladder as the seven at about the same
  // levels (the level-1 spells take only the air and mind runes of every
  // caster's starter kit, so a new or old character can always cast), and only
  // existing runes: orbs and censers supply none for free, as before.
  { id: 'radiance_strike', name: 'Radiance', level: 1, maxHit: 2, xp: 5.5, tint: '#fff3b0', critTint: '#ffffff', runes: { air_rune: 1, mind_rune: 1 }, cls: 'priest' },
  { id: 'grace_strike', name: 'Grace', level: 10, maxHit: 2, xp: 9.5, tint: '#ffd98a', critTint: '#fff0c8', runes: { water_rune: 1, air_rune: 1, mind_rune: 1 }, cls: 'priest' },
  { id: 'judgement_strike', name: 'Judgement', level: 25, maxHit: 2, xp: 14.5, tint: '#cfe0ff', critTint: '#f4f8ff', runes: { chaos_rune: 1, air_rune: 2, mind_rune: 1 }, cls: 'priest' },
  { id: 'sanctuary_strike', name: 'Sanctuary', level: 40, maxHit: 2, xp: 17.5, tint: '#f6e7a8', critTint: '#fffbe6', runes: { nature_rune: 1, air_rune: 2, mind_rune: 1 }, cls: 'priest' },
  { id: 'holyfire_strike', name: 'Holy Fire', level: 1, maxHit: 2, xp: 5.5, tint: '#ffe9a0', critTint: '#fffbe0', runes: { air_rune: 1, mind_rune: 1 }, cls: 'zealot' },
  { id: 'wrath_strike', name: 'Wrath', level: 15, maxHit: 2, xp: 11.5, tint: '#ff6a4a', critTint: '#ffc08a', runes: { fire_rune: 2, air_rune: 1, mind_rune: 1 }, cls: 'zealot' },
  { id: 'ash_strike', name: 'Ash', level: 30, maxHit: 2, xp: 15.5, tint: '#b8a8a0', critTint: '#ffb070', runes: { death_rune: 1, fire_rune: 2, mind_rune: 1 }, cls: 'zealot' },
  { id: 'martyrdom_strike', name: 'Martyrdom', level: 45, maxHit: 2, xp: 18.5, tint: '#e04a5a', critTint: '#ffd27a', runes: { blood_rune: 1, air_rune: 2, mind_rune: 1 }, cls: 'zealot' },
];
export const SPELL_HIT_CAP = 20;
/** A spell's base max hit at a Magic level (before the Magic multiplier and the element's damage). */
export function spellBaseHit(spell, magic) {
  return Math.min(SPELL_HIT_CAP, spell.maxHit + Math.floor(magic / 4));
}

// Each spell's element is a damage type: it bites into some races (x1.5) and is
// resisted by others (x0.7), and every spell blasts the area around its target
// (see AOE_RADIUS) for the same damage. Each element also has its own effect, so
// the choice matters beyond damage (auto battle's Auto element weighs them all):
//   wind  (Gale)    the quickest casts and a keen edge: +15% crit chance;
//   water (Chill)   slows the foes it hits, and a chilled foe's blows land softer;
//   earth (Shatter) blasts a wide area and cracks armour, so every hit on it lands harder;
//   fire  (Ignite)  sets foes alight: stacking burns that go off every half
//                   second, and again whenever the burning foe takes damage;
//   chaos (Wild Surge) hits for half to double (1.25x on average), and one cast
//                   in four also burns, chills or cracks the foe at random;
//   dark  (Hex)     curses the foes it hits: each hex makes them take 5% more
//                   damage from you, up to 5;
//   blood (Siphon)  heals you a share of the damage it deals.
// The matchups used to only ever help (x1.3, never resisted), so a mage could
// cast one element at everything; the owner asked for strong and weak matchups to
// hit noticeably harder and softer, and for the effects to read clearly in a fight.
// `splat` is the colour of the element's hit numbers (`tint`, the projectile's, is
// too pale behind white digits).
export const ELEMENT_MATCHUP = { strong: 1.5, weak: 0.7 };
// The Light and Flame paths' damage beside the seven. The Priest and the Zealot
// used to cast Fire, whose Ignite is much the strongest effect on one foe in a
// long fight (it puts the Wizard at 2-4 times the median class there); without
// it they fell to a fifth and a third of the Wizard's single-target damage on
// tools/balance/classes.mjs. So every Light and Flame spell also burns like
// Ignite (PATH_BURN, the same numbers: the light sears, the flames burn) and
// each path's damage is scaled to fit. The four elements each cover more races
// than the Wizard's Fire-on-everything does, so the paths sit below 1: at these
// numbers the Priest deals 98-102% of the Wizard's single-target damage at
// levels 50-200 and 80% at 300 (kill speed 88-101%), the Zealot 103-119% at
// 50-200 and 86% at 300 (kill 87-116%). Martyrdom's +60% made the Zealot
// 1.3-1.8 times the Wizard where its strong races came up, before its strong
// list was narrowed to spirits and constructs.
export const LIGHT_POWER = 0.85, FLAME_POWER = 0.7;
const PATH_BURN = { share: 0.15, secs: 5, tickMs: 500, max: 20 };
export const ELEMENTS = {
  wind:  { name: 'Wind',  icon: '🌪️', splat: '#2f9a6a', strong: ['avian', 'spirit', 'bug'], weak: ['construct', 'dragon'],
    effect: 'Gale: casts 65% faster and +15% critical chance', castSpeed: 0.6, crit: 0.15 },
  water: { name: 'Water', icon: '💧', splat: '#2a7fc0', strong: ['dragon', 'demon', 'construct'], weak: ['aquatic', 'flora'],
    effect: 'Chill: casts 40% faster; chilled foes move and attack 60% slower and their blows do 25% less damage for 3s', castSpeed: 1 / 1.4, slowTicks: 5, chill: 0.25 },
  earth: { name: 'Earth', icon: '🪨', splat: '#8a6a3a', strong: ['beast', 'reptile', 'humanoid', 'aquatic'], weak: ['avian', 'spirit'],
    effect: 'Quake: blasts everything within 5 tiles. Shatter: each hit cracks the foe\'s armour, +6% armour pierce against it (up to 5 cracks, 6s) for every hit you land on it', aoeRadius: 5, shatter: { per: 6, max: 5, ticks: 10 } },
  fire:  { name: 'Fire',  icon: '🔥', splat: '#e0602a', strong: ['flora', 'undead', 'bug'], weak: ['aquatic', 'dragon', 'demon'],
    effect: 'Ignite: every hit adds a burn of 15% of the hit for 5s (up to 20 at once). A burning foe\'s burns all go off every 0.5s, and again every time it takes damage, burn ticks included; every burn can crit', ignite: { share: 0.15, secs: 5, tickMs: 500, max: 20 } },
  chaos: { name: 'Chaos', icon: '✴️', splat: '#a43ad0', strong: ['construct', 'dragon', 'spirit'], weak: ['demon', 'flora'],
    effect: 'Wild Surge: every cast hits for anywhere from half to double (1.25x on average), and one cast in four also burns, chills or cracks the foe at random', chaos: { min: 0.5, max: 2, surge: 0.25 } },
  dark:  { name: 'Dark',  icon: '🌑', splat: '#5a3a9a', strong: ['humanoid', 'avian', 'flora'], weak: ['undead', 'spirit'],
    effect: 'Hex: every hit curses the foe: it takes 5% more damage from you, every style, up to 5 hexes (+25%), for 6s', hex: { per: 5, max: 5, ticks: 10 } },
  blood: { name: 'Blood', icon: '🩸', splat: '#b0162e', strong: ['beast', 'reptile', 'aquatic'], weak: ['undead', 'construct'],
    effect: 'Siphon: heals you 12% of the damage it deals, its splash included', siphon: 0.12 },
  // The Priest's Light path (protect, heal, punish the unholy) and the Zealot's
  // Flame path (holy fire, wrath, sacrifice). What each effect does in a fight
  // lives in game/classelements.js; `power` is the path's damage beside the
  // seven (see LIGHT_POWER and FLAME_POWER below).
  radiance:  { name: 'Radiance', icon: '☀️', splat: '#c79600', strong: ['undead', 'spirit', 'bug'], weak: ['construct', 'flora'], power: LIGHT_POWER, ignite: PATH_BURN,
    effect: 'Dazzle: a beam of light. The foes it hits are dazzled for 3s: their attacks miss an extra 25% of the time', dazzle: { ticks: 5, miss: 0.25 } },
  grace:     { name: 'Grace', icon: '🪶', splat: '#c8801e', strong: ['demon', 'beast', 'avian'], weak: ['spirit'], power: LIGHT_POWER, ignite: PATH_BURN,
    effect: 'Ward: 20% of the damage it deals becomes a ward that soaks the blows you take (up to 20% of your life; it fades 8s after the last top-up)', ward: { share: 0.2, cap: 0.2, ticks: 13 } },
  judgement: { name: 'Judgement', icon: '⚖️', splat: '#3f6aa8', strong: ['humanoid', 'dragon', 'demon'], weak: ['bug', 'aquatic'], power: LIGHT_POWER, ignite: PATH_BURN,
    effect: 'Verdict: hits harder the more hurt the foe is, up to +60% on one at death\'s door (x1 + 0.6 x the share of its life missing)', verdict: 0.6 },
  sanctuary: { name: 'Sanctuary', icon: '⭕', splat: '#7f8f1e', strong: ['undead', 'aquatic', 'reptile', 'flora'], weak: ['dragon', 'demon'], power: LIGHT_POWER, ignite: PATH_BURN,
    effect: 'Consecrate: blasts everything within 4 tiles and heals you 2% of your life for each foe it hits (up to 10% a cast)', aoeRadius: 4, consecrate: { per: 0.02, cap: 0.1 } },
  holyfire:  { name: 'Holy Fire', icon: '🔆', splat: '#d9780a', strong: ['undead', 'flora', 'bug'], weak: ['aquatic', 'dragon'], power: FLAME_POWER, ignite: PATH_BURN,
    effect: 'Brand: every hit brands the foe (up to 5, for 6s). The fifth brand bursts: the whole hit again on the foe and all around it', brand: { max: 5, ticks: 10, burst: 1 } },
  wrath:     { name: 'Wrath', icon: '💢', splat: '#c3301e', strong: ['humanoid', 'demon', 'beast'], weak: ['construct', 'spirit'], power: FLAME_POWER, ignite: PATH_BURN,
    effect: 'Retribution: the damage you take is stored, and your next Wrath hits harder for it: twice the share of your life you lost, up to +50%; then the store empties', retribution: { per: 2, cap: 0.5 } },
  ash:       { name: 'Ash', icon: '🌫️', splat: '#76665f', strong: ['avian', 'construct', 'reptile'], weak: ['aquatic', 'undead'], power: FLAME_POWER, ignite: PATH_BURN,
    effect: 'Cinders: a foe it has struck that dies branded or burning (holy fire or Ignite) bursts into cinders, hitting foes within 2 tiles for 30% of the killing blow', cinders: { share: 0.3, ticks: 10 } },
  martyrdom: { name: 'Martyrdom', icon: '💔', splat: '#9a1a4a', strong: ['spirit', 'construct'], weak: ['humanoid', 'dragon'], power: FLAME_POWER, ignite: PATH_BURN,
    effect: 'Sacrifice: every cast costs 2% of your life (never taking you under a fifth of it) and hits 60% harder', sacrifice: { life: 0.02, dmg: 0.6 } },
};
for (const s of SPELLS) s.element = s.id.split('_')[0];
// (Say so on each of the paths' elements, after its own effect.)
for (const s of SPELLS) if (s.cls) ELEMENTS[s.element].effect += s.cls === 'priest' ? '. Its light sears too, burning like Fire\'s Ignite' : '. It burns too, like Fire\'s Ignite';
export const AOE_RADIUS = 2;   // tiles around the target that every spell also hits
/** 'strong' | 'weak' | null: how a spell's element fares against a race. */
export function elementMatchup(element, race) {
  const e = ELEMENTS[element];
  if (!e) return null;
  return e.strong.includes(race) ? 'strong' : e.weak.includes(race) ? 'weak' : null;
}
/** The damage multiplier for an element matchup ('strong' / 'weak' / null). */
export const elementMult = (m) => (m === 'strong' ? ELEMENT_MATCHUP.strong : m === 'weak' ? ELEMENT_MATCHUP.weak : 1);

export const SPELL_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
// Old saves may hold a retired tier (e.g. 'fire_wave'): it becomes that element's spell.
export const getSpell = (id) => SPELL_BY_ID[id] || SPELL_BY_ID[`${String(id).split('_')[0]}_strike`] || SPELLS[0];
/** The seven elements every caster had: the Wizard's and the Sorcerer's. */
export const WIZARD_ELEMENTS = SPELLS.filter((s) => !s.cls).map((s) => s.element);
const BY_CLASS = new Map();
/** The spells a class casts, lowest level first: the Priest and the Zealot their
 *  own four, every other class (and a character with none yet) the seven. */
export function spellsFor(cls) {
  let list = BY_CLASS.get(cls);
  if (!list) {
    list = SPELLS.filter((s) => s.cls === cls);
    if (!list.length) list = SPELLS.filter((s) => !s.cls);
    BY_CLASS.set(cls, list);
  }
  return list;
}
/** A chosen (or saved) spell as this class casts it: the spell itself if it is
 *  the class's, else the class's first. A Priest's or Zealot's save from before
 *  they had their own elements holds a Wizard element, and loads as this. */
export function classSpell(cls, id) {
  const list = spellsFor(cls), sp = getSpell(id);
  return list.includes(sp) ? sp : list[0];
}
