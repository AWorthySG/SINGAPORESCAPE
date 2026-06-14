// Activatable prayers. Each needs a Prayer level, drains points while active, and
// grants a combat multiplier (att/str/def/ranged/magic as a fraction) or `protect`
// (fraction of incoming melee damage prevented). Prayer points cap = Prayer level.
export const PRAYERS = [
  { id: 'thick_skin', name: 'Thick Skin', level: 1, drain: 1, def: 0.05 },
  { id: 'burst_strength', name: 'Burst of Strength', level: 4, drain: 1, str: 0.05 },
  { id: 'clarity', name: 'Clarity of Thought', level: 7, drain: 1, att: 0.05 },
  { id: 'sharp_eye', name: 'Sharp Eye', level: 8, drain: 1, ranged: 0.05 },
  { id: 'mystic_will', name: 'Mystic Will', level: 9, drain: 1, magic: 0.05 },
  { id: 'rock_skin', name: 'Rock Skin', level: 10, drain: 2, def: 0.10 },
  { id: 'superhuman', name: 'Superhuman Strength', level: 13, drain: 2, str: 0.10 },
  { id: 'reflexes', name: 'Improved Reflexes', level: 16, drain: 2, att: 0.10 },
  { id: 'protect_melee', name: 'Protect from Melee', level: 25, drain: 4, protect: 0.40 },
  { id: 'eagle_eye', name: 'Eagle Eye', level: 26, drain: 3, ranged: 0.12 },
  { id: 'mystic_lore', name: 'Mystic Lore', level: 27, drain: 3, magic: 0.12 },
  { id: 'steel_skin', name: 'Steel Skin', level: 28, drain: 3, def: 0.15 },
  { id: 'ultimate_strength', name: 'Ultimate Strength', level: 31, drain: 3, str: 0.15 },
  { id: 'incredible_reflexes', name: 'Incredible Reflexes', level: 34, drain: 3, att: 0.15 },
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
