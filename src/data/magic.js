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
//                   second, and again whenever the burning foe takes damage.
// The matchups used to only ever help (x1.3, never resisted), so a mage could
// cast one element at everything; the owner asked for strong and weak matchups to
// hit noticeably harder and softer, and for the effects to read clearly in a fight.
// `splat` is the colour of the element's hit numbers (`tint`, the projectile's, is
// too pale behind white digits).
export const ELEMENT_MATCHUP = { strong: 1.5, weak: 0.7 };
export const ELEMENTS = {
  wind:  { name: 'Wind',  icon: '🌪️', splat: '#2f9a6a', strong: ['avian', 'spirit', 'bug'], weak: ['construct', 'dragon'],
    effect: 'Gale: casts 65% faster and +15% critical chance', castSpeed: 0.6, crit: 0.15 },
  water: { name: 'Water', icon: '💧', splat: '#2a7fc0', strong: ['dragon', 'demon', 'construct'], weak: ['aquatic', 'flora'],
    effect: 'Chill: casts 40% faster; chilled foes move and attack 60% slower and their blows do 25% less damage for 3s', castSpeed: 1 / 1.4, slowTicks: 5, chill: 0.25 },
  earth: { name: 'Earth', icon: '🪨', splat: '#8a6a3a', strong: ['beast', 'reptile', 'humanoid', 'aquatic'], weak: ['avian', 'spirit'],
    effect: 'Quake: blasts everything within 5 tiles. Shatter: each hit cracks the foe\'s armour, +6% armour pierce against it (up to 5 cracks, 6s) for every hit you land on it', aoeRadius: 5, shatter: { per: 6, max: 5, ticks: 10 } },
  fire:  { name: 'Fire',  icon: '🔥', splat: '#e0602a', strong: ['flora', 'undead', 'bug'], weak: ['aquatic', 'dragon', 'demon'],
    effect: 'Ignite: every hit adds a burn of 15% of the hit for 5s (up to 20 at once). A burning foe\'s burns all go off every 0.5s, and again every time it takes damage, burn ticks included; every burn can crit', ignite: { share: 0.15, secs: 5, tickMs: 500, max: 20 } },
};
for (const s of SPELLS) s.element = s.id.split('_')[0];
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
