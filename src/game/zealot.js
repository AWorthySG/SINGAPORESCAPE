// The Zealot (a magic class, a fictional order of fire-keepers): a censer swung
// on a chain. Three things set it apart:
//  - holy fire: every spell cast through a censer leaves the foe burning, and
//    the burns stack (WOUNDS.holyfire and WOUND_BY_WEAPON in game.js; it is a
//    spell's burn, so it pays Magic XP). Searing Swing, Rekindle and Pillar of
//    Flame set fiercer ones (a skill's `holyfire` rider);
//  - Fervour: more damage the more hurt you are (below);
//  - skills paid for in life as well as adrenaline (a skill's `lifeCost`, see
//    Game._payAbility; never at or under LIFE_COST_FLOOR of your life, so auto
//    battle can't spend you to nothing).
// Kept out of game.js, which only calls in: _offensiveMods multiplies by
// fervour, WOUNDS.holyfire takes HOLY_FIRE's numbers, and the Stats tab
// (statsheet.js) shows Fervour too.

// fervour: the extra damage with no life left, in step with the life you are
// missing (+15% at half life, +30% at none). It was +60%: the Zealot's own life
// costs keep it at about two thirds of its life on a long fight, so up to level
// 100 or so (before Magic's Siphon perk heals the costs straight back) it hit
// a quarter harder than the Wizard on tools/balance/classes.mjs's dummies.
// orb: the share of its damage a Zealot deals through an orb, its second weapon;
// Fervour too burns only through a censer. Without them the orb hit 5-17% harder
// than the censer (the orb's scale is the Wizard's and Sorcerer's, set for them;
// holy fire adds little once Fire's Ignite is running), breaking the rule that a
// class's own type is its best weapon (combat.js WEAPON_DMG_MULT).
// Since the Zealot casts its own Flame path (magic.js; game/classelements.js)
// rather than Fire, its damage beside the Wizard's is set by FLAME_POWER there:
// 103-119% of the Wizard's single-target damage at levels 50-200 and 86% at 300.
// Martyrdom's life cost keeps it hurt, so Fervour keeps counting.
export const ZEALOT = { fervour: 0.3, orb: 0.85 };
// Holy fire (WOUNDS.holyfire in game.js): each spell through a censer adds a burn
// of `share` of its hit every second for `secs` seconds (15% of the hit in all,
// past armour), up to `stacks` at once. Unlike Fire's Ignite it never flares up
// on other hits, so it stays the same share of the damage at any cast speed (until
// the quickest casters reach the cap).
export const HOLY_FIRE = { share: 0.03, secs: 5, stacks: 50 };

const isZealot = (game) => game.jobClass === 'zealot';
const withCenser = (game) => isZealot(game) && game.weaponType?.() === 'censer';

/** The Zealot's damage multiplier from Fervour (1 at full life, with an orb, and for anyone else). */
export function fervour(game) {
  if (!withCenser(game)) return 1;
  const missing = 1 - game.player.hp / Math.max(1, game.maxHp());
  return 1 + ZEALOT.fervour * Math.max(0, Math.min(1, missing));
}

/** A Zealot casting through an orb, its second weapon: ZEALOT.orb (1 with a censer, and for anyone else). */
export const orbShare = (game) => (isZealot(game) && game.weaponType?.() === 'orb' ? ZEALOT.orb : 1);
