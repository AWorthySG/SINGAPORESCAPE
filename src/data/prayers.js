// Activatable prayers. Each needs a Prayer level, drains points while active, and
// grants a combat multiplier (att/str/def/ranged/magic as a fraction) or `protect`
// (fraction of incoming melee damage prevented). Prayer points cap = Prayer level.
export const PRAYERS = [
  // Reworked: much stronger, and spread over Prayer levels 1-250 so each tier is
  // a real goal. Tier 1 = +10%, tier 2 = +25% (ranged/magic +35%), tier 3 = +50%;
  // Protect from Melee stops 60% of melee damage.
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
  { id: 'ultimate_strength', name: 'Ultimate Strength', level: 200, drain: 3, str: 0.50 },
  { id: 'incredible_reflexes', name: 'Incredible Reflexes', level: 250, drain: 3, att: 0.50 },
];

export const PRAYER_BY_ID = Object.fromEntries(PRAYERS.map((p) => [p.id, p]));

// Prayers that conflict (only one of each group active at once).
export const PRAYER_GROUPS = {
  att: ['clarity', 'reflexes', 'incredible_reflexes'],
  str: ['burst_strength', 'superhuman', 'ultimate_strength'],
  def: ['thick_skin', 'rock_skin', 'steel_skin'],
  ranged: ['sharp_eye', 'eagle_eye'],
  magic: ['mystic_will', 'mystic_lore'],
};
