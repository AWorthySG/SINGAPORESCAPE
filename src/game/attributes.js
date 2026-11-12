// Attributes: Strength, Intelligence and Dexterity. You earn stat points as
// your best fighting skill (Melee, Ranged, Magic or a Dancer's pooled
// Agility + Ranged) grows, and spend them freely; a reset refunds them all for
// coins. Each point adds damage for its style plus one flavour bonus:
//   Strength      melee damage, and max life
//   Intelligence  spell damage, and spell crit chance
//   Dexterity     ranged and whip damage, and attack speed (any style)
// Points come as the square root of your fighting level and stop at
// MAX_STAT_POINTS (reached at level 10,000), so late-game damage stays bounded.

export const ATTRS = ['str', 'int', 'dex'];
export const ATTR_NAMES = { str: 'Strength', int: 'Intelligence', dex: 'Dexterity' };
export const MAX_STAT_POINTS = 100;
export const DMG_PER_POINT = 0.005;        // +0.5% damage for its style
export const LIFE_PER_STR = 0.005;         // +0.5% max life
export const CRIT_PER_INT = 0.001;         // +0.1% spell crit chance
export const SPEED_PER_DEX = 0.25;         // +0.25% attack speed
export const RESET_COST_PER_POINT = 500;   // coins per point refunded

/** Stat points earned at a fighting level. */
export const statPointsAt = (level) => Math.min(MAX_STAT_POINTS, Math.floor(Math.sqrt(Math.max(0, level || 0))));

/** The attribute that powers a combat style's damage. */
export const attrForMode = (mode) => (mode === 'magic' ? 'int' : mode === 'ranged' || mode === 'dance' ? 'dex' : 'str');

/** What a spread of points does, for the stats panel. */
export function attrSummary(a) {
  return {
    str: `+${(a.str * DMG_PER_POINT * 100).toFixed(1)}% melee damage, +${(a.str * LIFE_PER_STR * 100).toFixed(1)}% max life`,
    int: `+${(a.int * DMG_PER_POINT * 100).toFixed(1)}% spell damage, +${(a.int * CRIT_PER_INT * 100).toFixed(1)}% spell crit`,
    dex: `+${(a.dex * DMG_PER_POINT * 100).toFixed(1)}% ranged & whip damage, +${(a.dex * SPEED_PER_DEX).toFixed(1)}% attack speed`,
  };
}
