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
  { id: 'fire_blast', name: 'Fire Blast', level: 59, maxHit: 16, xp: 34.5, tint: '#ff5a2a', runes: { fire_rune: 5, air_rune: 4, death_rune: 1 } },
];

export const SPELL_BY_ID = Object.fromEntries(SPELLS.map((s) => [s.id, s]));
export const getSpell = (id) => SPELL_BY_ID[id] || SPELLS[0];
