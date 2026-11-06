// Combat spells. Each needs a magic level, runes (item ids -> qty), gives a
// base max hit + magic xp per cast. Elemental tint drives the projectile colour.
export const SPELLS = [
  { id: 'wind_strike', name: 'Wind Strike', level: 1, maxHit: 2, xp: 5.5, tint: '#bfe8d0', runes: { air_rune: 1, mind_rune: 1 } },
  { id: 'water_strike', name: 'Water Strike', level: 5, maxHit: 4, xp: 7.5, tint: '#6fb6e0', runes: { water_rune: 1, air_rune: 1, mind_rune: 1 } },
  { id: 'earth_strike', name: 'Earth Strike', level: 9, maxHit: 6, xp: 9.5, tint: '#8a6a3a', runes: { earth_rune: 2, air_rune: 1, mind_rune: 1 } },
  { id: 'fire_strike', name: 'Fire Strike', level: 13, maxHit: 8, xp: 11.5, tint: '#ef7a23', runes: { fire_rune: 3, air_rune: 2, mind_rune: 1 } },
  { id: 'wind_bolt', name: 'Wind Bolt', level: 17, maxHit: 9, xp: 13.5, tint: '#bfe8d0', runes: { air_rune: 2, chaos_rune: 1 } },
  { id: 'water_bolt', name: 'Water Bolt', level: 23, maxHit: 10, xp: 16.5, tint: '#6fb6e0', runes: { water_rune: 2, air_rune: 2, chaos_rune: 1 } },
  { id: 'earth_bolt', name: 'Earth Bolt', level: 29, maxHit: 11, xp: 19.5, tint: '#8a6a3a', runes: { earth_rune: 3, air_rune: 2, chaos_rune: 1 } },
  { id: 'fire_bolt', name: 'Fire Bolt', level: 35, maxHit: 12, xp: 22.5, tint: '#ef7a23', runes: { fire_rune: 4, air_rune: 3, chaos_rune: 1 } },
  { id: 'wind_blast', name: 'Wind Blast', level: 41, maxHit: 13, xp: 25.5, tint: '#bfe8d0', runes: { air_rune: 3, death_rune: 1 } },
  { id: 'water_blast', name: 'Water Blast', level: 47, maxHit: 14, xp: 28.5, tint: '#6fb6e0', runes: { water_rune: 3, air_rune: 3, death_rune: 1 } },
  { id: 'earth_blast', name: 'Earth Blast', level: 53, maxHit: 15, xp: 31.5, tint: '#8a6a3a', runes: { earth_rune: 4, air_rune: 3, death_rune: 1 } },
  { id: 'fire_blast', name: 'Fire Blast', level: 59, maxHit: 16, xp: 34.5, tint: '#ff5a2a', runes: { fire_rune: 5, air_rune: 4, death_rune: 1 } },
  { id: 'wind_wave', name: 'Wind Wave', level: 62, maxHit: 17, xp: 36.0, tint: '#d6f5e2', runes: { air_rune: 5, blood_rune: 1 } },
  { id: 'water_wave', name: 'Water Wave', level: 65, maxHit: 18, xp: 37.5, tint: '#8fd0f0', runes: { water_rune: 5, air_rune: 5, blood_rune: 1 } },
  { id: 'earth_wave', name: 'Earth Wave', level: 70, maxHit: 19, xp: 40.0, tint: '#a07a4a', runes: { earth_rune: 5, air_rune: 5, blood_rune: 1 } },
  { id: 'fire_wave', name: 'Fire Wave', level: 75, maxHit: 20, xp: 42.5, tint: '#ff7a3a', runes: { fire_rune: 7, air_rune: 5, blood_rune: 1 } },
];

// Each spell's element is a damage type: it bites into some races and is
// shrugged off by others (like weapon types do), and every spell blasts the
// area around its target (see AOE_RADIUS) for the same damage.
// Each element also has its own effect, so the choice matters beyond damage:
//   wind casts quickest, water can freeze, earth hits the widest area, fire burns.
export const ELEMENTS = {
  wind:  { name: 'Wind',  icon: '🌪️', strong: ['avian', 'spirit', 'bug'], weak: ['construct', 'dragon'],
    effect: 'Gale: casts 30% faster', castSpeed: 0.7 },
  water: { name: 'Water', icon: '💧', strong: ['dragon', 'demon', 'construct'], weak: ['aquatic', 'flora'],
    effect: 'Freeze: 30% chance the target can\'t strike for 2s', freezeChance: 0.3, freezeBeats: 7 },
  earth: { name: 'Earth', icon: '🪨', strong: ['beast', 'reptile', 'humanoid', 'aquatic'], weak: ['avian', 'spirit'],
    effect: 'Quake: blasts a wider area (3 tiles)', aoeRadius: 3 },
  fire:  { name: 'Fire',  icon: '🔥', strong: ['flora', 'undead', 'bug'], weak: ['aquatic', 'dragon', 'demon'],
    effect: 'Burn: the target burns for 20% of the hit each tick for 3 ticks', burnShare: 0.2, burnTicks: 3 },
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
export const getSpell = (id) => SPELL_BY_ID[id] || SPELLS[0];
