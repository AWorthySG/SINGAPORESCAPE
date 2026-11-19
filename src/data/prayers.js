// Blessings (Prayer's loadout; the ids are still the old prayers'). Each needs a
// Prayer level and, once equipped in a blessing slot, is always on with no drain.
// It grants a combat multiplier (str/def/ranged/magic as a fraction), extra crit
// chance (`crit`, a fraction, for every fighting style) or `protect` (fraction of
// incoming damage prevented). `slots` is how many blessing slots it takes (1 unless
// given). Faith, the bar that fills as you fight, powers the Prayer Burst (see
// game/blessings.js).
// The Attack prayers (Clarity, Reflexes) once raised accuracy, but player hits
// always land now, so they grant crit chance instead.
export const PRAYERS = [
  // Spread over Prayer levels 1-300 so each tier is a real goal. Tier 1 = +10%,
  // tier 2 = +25% (ranged/magic +35%), tier 3 = +50% (ranged/magic +60%, at
  // 175/225). Protect from Melee stopped 60% while it drained points; always on it
  // stops 30% (a full block comes from the Burst instead). The level-300 blessing
  // raises all three melee stats at once, so it takes two slots.
  // `art` borrows another prayer's icon until a prayer gets its own.
  { id: 'thick_skin', name: 'Thick Skin', level: 1, def: 0.10 },
  { id: 'burst_strength', name: 'Burst of Strength', level: 5, str: 0.10 },
  { id: 'clarity', name: 'Clarity of Thought', level: 10, crit: 0.05 },
  { id: 'sharp_eye', name: 'Sharp Eye', level: 15, ranged: 0.10 },
  { id: 'mystic_will', name: 'Mystic Will', level: 20, magic: 0.10 },
  { id: 'rock_skin', name: 'Rock Skin', level: 40, def: 0.25 },
  { id: 'superhuman', name: 'Superhuman Strength', level: 50, str: 0.25 },
  { id: 'reflexes', name: 'Improved Reflexes', level: 60, crit: 0.10 },
  { id: 'eagle_eye', name: 'Eagle Eye', level: 70, ranged: 0.35 },
  { id: 'mystic_lore', name: 'Mystic Lore', level: 80, magic: 0.35 },
  { id: 'protect_melee', name: 'Protect from Melee', level: 99, protect: 0.30 },
  { id: 'steel_skin', name: 'Steel Skin', level: 150, def: 0.50 },
  { id: 'deadeye', name: 'Deadeye', level: 175, ranged: 0.60, art: 'eagle_eye', tint: 'hue-rotate(-60deg) saturate(1.6)' },
  { id: 'ultimate_strength', name: 'Ultimate Strength', level: 200, str: 0.50 },
  { id: 'mystic_might', name: 'Mystic Might', level: 225, magic: 0.60, art: 'mystic_lore', tint: 'hue-rotate(60deg) saturate(1.6)' },
  { id: 'incredible_reflexes', name: 'Incredible Reflexes', level: 250, crit: 0.20 },
  // The Worthy's blessing at 300: crit, Strength and Defence at once, a little stronger than the three tier-3 blessings and in two slots instead of three.
  { id: 'worthy_spirit', name: 'Spirit of the Worthy', level: 300, slots: 2, crit: 0.25, str: 0.60, def: 0.60, art: 'incredible_reflexes', tint: 'sepia(1) saturate(3) brightness(1.1)' },
];

export const PRAYER_BY_ID = Object.fromEntries(PRAYERS.map((p) => [p.id, p]));

// Blessings that conflict (only one of each group equipped at once).
export const PRAYER_GROUPS = {
  att: ['clarity', 'reflexes', 'incredible_reflexes', 'worthy_spirit'],
  str: ['burst_strength', 'superhuman', 'ultimate_strength', 'worthy_spirit'],
  def: ['thick_skin', 'rock_skin', 'steel_skin', 'worthy_spirit'],
  ranged: ['sharp_eye', 'eagle_eye', 'deadeye'],
  magic: ['mystic_will', 'mystic_lore', 'mystic_might'],
};

/** Blessing slots by Prayer level: the highest rung you have reached. */
export const BLESSING_SLOT_LADDER = [
  { level: 1, slots: 1 },
  { level: 40, slots: 2 },
  { level: 99, slots: 3 },
  { level: 175, slots: 4 },
  { level: 250, slots: 5 },
];
/** How many slots a blessing takes. */
export const blessingCost = (p) => p?.slots || 1;

// Faith: its cap is FAITH_BASE + Prayer level (prayer points before the rework,
// so bones and the Monument still fill it). Fighting fills a share of the cap,
// so a full bar takes about 45s of fighting at any level: roughly 19 hits landed,
// 15 taken and a few kills. Prayer gear (bonus `prayer`) speeds it up: +30 doubles it.
export const FAITH_BASE = 20;
export const FAITH_GAIN = { hit: 0.03, hurt: 0.02, kill: 0.05 };

// The Prayer Burst, for a full bar of Faith: a heal, a ward that stops every
// blow for BURST_WARD_TICKS (3s) and zeal (extra damage) for BURST_ZEAL_TICKS (about 8s).
export const BURST_WARD_TICKS = 5;
export const BURST_ZEAL_TICKS = 13;
/** The Burst's heal (share of max life) and zeal (extra damage) at a Prayer level:
 *  20% and 15% at level 1, about 30% and 25% at 99, topping out at 50% and 45% from level 300. */
export function burstPower(level) {
  const l = Math.max(1, level || 1);
  return { heal: Math.min(0.5, 0.2 + l / 1000), zeal: Math.min(0.45, 0.15 + l / 1000) };
}
