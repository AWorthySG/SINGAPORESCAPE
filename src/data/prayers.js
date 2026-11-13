// Activatable prayers. Each needs a Prayer level, drains points while active, and
// grants a combat multiplier (att/str/def/ranged/magic as a fraction) or `protect`
// (fraction of incoming melee damage prevented). Prayer points cap = Prayer level.
export const PRAYERS = [
  // Reworked: much stronger, and spread over Prayer levels 1-300 so each tier is
  // a real goal. Tier 1 = +10%, tier 2 = +25% (ranged/magic +35%), tier 3 = +50%
  // (ranged/magic +60%, at 175/225); Protect from Melee stops 60% of melee damage,
  // and the level-300 blessing raises all three melee stats at once.
  // `art` borrows another prayer's icon until a prayer gets its own.
  { id: 'thick_skin', name: 'Thick Skin', level: 1, drain: 1, def: 0.10 },
  { id: 'burst_strength', name: 'Burst of Strength', level: 5, drain: 1, str: 0.10 },
  { id: 'clarity', name: 'Clarity of Thought', level: 10, drain: 1, att: 0.10 },
  { id: 'sharp_eye', name: 'Sharp Eye', level: 15, drain: 1, ranged: 0.10 },
  { id: 'mystic_will', name: 'Mystic Will', level: 20, drain: 1, magic: 0.10 },
  { id: 'rock_skin', name: 'Rock Skin', level: 40, drain: 2, def: 0.25 },
  { id: 'superhuman', name: 'Superhuman Strength', level: 50, drain: 2, str: 0.25 },
  { id: 'reflexes', name: 'Improved Reflexes', level: 60, drain: 2, att: 0.25 },
  { id: 'eagle_eye', name: 'Eagle Eye', level: 70, drain: 3, ranged: 0.35 },
  { id: 'mystic_lore', name: 'Mystic Lore', level: 80, drain: 3, magic: 0.35 },
  { id: 'protect_melee', name: 'Protect from Melee', level: 99, drain: 4, protect: 0.60 },
  { id: 'steel_skin', name: 'Steel Skin', level: 150, drain: 3, def: 0.50 },
  { id: 'deadeye', name: 'Deadeye', level: 175, drain: 3, ranged: 0.60, art: 'eagle_eye', tint: 'hue-rotate(-60deg) saturate(1.6)' },
  { id: 'ultimate_strength', name: 'Ultimate Strength', level: 200, drain: 3, str: 0.50 },
  { id: 'mystic_might', name: 'Mystic Might', level: 225, drain: 3, magic: 0.60, art: 'mystic_lore', tint: 'hue-rotate(60deg) saturate(1.6)' },
  { id: 'incredible_reflexes', name: 'Incredible Reflexes', level: 250, drain: 3, att: 0.50 },
  // The Worthy's blessing at 300: all three melee stats at once, a little stronger and cheaper than running the three tier-3 prayers (drain 9).
  { id: 'worthy_spirit', name: 'Spirit of the Worthy', level: 300, drain: 8, att: 0.60, str: 0.60, def: 0.60, art: 'incredible_reflexes', tint: 'sepia(1) saturate(3) brightness(1.1)' },
];

export const PRAYER_BY_ID = Object.fromEntries(PRAYERS.map((p) => [p.id, p]));

// Prayers that conflict (only one of each group active at once).
export const PRAYER_GROUPS = {
  att: ['clarity', 'reflexes', 'incredible_reflexes', 'worthy_spirit'],
  str: ['burst_strength', 'superhuman', 'ultimate_strength', 'worthy_spirit'],
  def: ['thick_skin', 'rock_skin', 'steel_skin', 'worthy_spirit'],
  ranged: ['sharp_eye', 'eagle_eye', 'deadeye'],
  magic: ['mystic_will', 'mystic_lore', 'mystic_might'],
};
