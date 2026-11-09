// Combat spells. Each needs a magic level, runes (item ids -> qty), gives a
// base max hit + magic xp per cast. Elemental tint drives the projectile colour.
// One spell per element. Its damage grows with Magic level instead of
// unlocking stronger tiers: base max hit = 2 + Magic/4, up to 20 (the old Wave
// spells' hit at Magic 72), then the Magic multiplier in combat.js on top.
export const SPELLS = [
  { id: 'wind_strike', name: 'Wind', level: 1, maxHit: 2, xp: 5.5, tint: '#bfe8d0', runes: { air_rune: 1, mind_rune: 1 } },
  { id: 'water_strike', name: 'Water', level: 5, maxHit: 2, xp: 7.5, tint: '#6fb6e0', runes: { water_rune: 1, air_rune: 1, mind_rune: 1 } },
  { id: 'earth_strike', name: 'Earth', level: 9, maxHit: 2, xp: 9.5, tint: '#8a6a3a', runes: { earth_rune: 2, air_rune: 1, mind_rune: 1 } },
  { id: 'fire_strike', name: 'Fire', level: 13, maxHit: 2, xp: 11.5, tint: '#ef7a23', runes: { fire_rune: 3, air_rune: 2, mind_rune: 1 } },
];
export const SPELL_HIT_CAP = 20;
/** A spell's base max hit at a Magic level (before the Magic multiplier and the element's damage). */
export function spellBaseHit(spell, magic) {
  return Math.min(SPELL_HIT_CAP, spell.maxHit + Math.floor(magic / 4));
}

// Each spell's element is a damage type: it bites into some races and is
// shrugged off by others (like weapon types do), and every spell blasts the
// area around its target (see AOE_RADIUS) for the same damage.
// Each element also has its own effect, so the choice matters beyond damage:
//   wind casts twice as fast, water slows foes and casts a little faster,
//   earth blasts a wide area, fire hits 50% harder.
export const ELEMENTS = {
  wind:  { name: 'Wind',  icon: '🌪️', strong: ['avian', 'spirit', 'bug'], weak: ['construct', 'dragon'],
    effect: 'Gale: casts twice as fast', castSpeed: 0.5 },
  water: { name: 'Water', icon: '💧', strong: ['dragon', 'demon', 'construct'], weak: ['aquatic', 'flora'],
    effect: 'Tide: slows the foes it hits (they move and attack slower for 3s); casts 30% faster', castSpeed: 1 / 1.3, slowTicks: 5 },
  earth: { name: 'Earth', icon: '🪨', strong: ['beast', 'reptile', 'humanoid', 'aquatic'], weak: ['avian', 'spirit'],
    effect: 'Quake: blasts everything within 5 tiles', aoeRadius: 5 },
  fire:  { name: 'Fire',  icon: '🔥', strong: ['flora', 'undead', 'bug'], weak: ['aquatic', 'dragon', 'demon'],
    effect: 'Ignite: every hit adds a burn of 25% of the hit every second until the foe dies; burns stack without limit', ignite: { share: 0.25 } },
};
for (const s of SPELLS) s.element = s.id.split('_')[0];
export const AOE_RADIUS = 2;   // tiles around the target that every spell also hits
/** 'strong' | 'weak' | null: how a spell's element fares against a race. */
export function elementMatchup(element, race) {
  const e = ELEMENTS[element];
  if (!e) return null;
  return e.strong.includes(race) ? 'strong' : e.weak.includes(race) ? 'weak' : null;
}

export const SPELL_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
// Old saves may hold a retired tier (e.g. 'fire_wave'): it becomes that element's spell.
export const getSpell = (id) => SPELL_BY_ID[id] || SPELL_BY_ID[`${String(id).split('_')[0]}_strike`] || SPELLS[0];
