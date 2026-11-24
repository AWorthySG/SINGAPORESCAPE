// The Priest (a magic class of holy orbs): every spell that lands heals it a
// little of what it dealt, it smites the unholy (undead, spirits and demons)
// harder, and its skills lift its blessings (a buff's `bless`) and fill its
// Faith (`faith`, abilities.js). Kept out of game.js, which only calls in:
// _applyPlayerHit adds spellLifesteal to a hit's lifesteal, _offensiveMods
// multiplies by smite, and the Stats tab (statsheet.js) shows both.
import { raceOf } from '../data/races.js';

// heal: the share of each spell's direct hit healed back (splashes, echoes and
// burns heal nothing); smite: extra damage against the unholy; power: the
// Priest's own damage knob, for balance (its orbs are the Wizard's and the
// Sorcerer's second weapon too, so their damage scale in combat.js is theirs).
// At 1.06, with Uplift's +30%, the Priest deals 93% of the Wizard's single-target
// damage at level 100, 88% at 200 and 85% at 300 on tools/balance/classes.mjs's
// dummies (102%, 93% and 97% on bosses), which have no blessings for Uplift to
// lift. (At 1 it fell to 80-83% at levels 200-300.) At level 50 it deals only
// 71-74%: from Magic 50 to 59 the Wizard has the speed-4 ancient staff while the
// Priest's orbs cast at speed 5 until the dragon orb (Magic 60); below and above
// that window it is level with the Wizard or a little under.
//
// Since the Priest casts its own Light path (magic.js; game/classelements.js)
// rather than Fire, its damage beside the Wizard's is set by LIGHT_POWER there:
// 98-102% of the Wizard's single-target damage at levels 50-200 and 80% at 300.
// censer: the share of its damage a Priest deals through a censer, its second
// weapon. The censer's holy fire burns on top of the Light path's own searing,
// which put the censer level with the orb (100%) and broke the rule that a
// class's own type is its best weapon (combat.js WEAPON_DMG_MULT), as the
// Zealot's orb once did (zealot.js ZEALOT.orb).
export const PRIEST = { heal: 0.08, smite: 0.3, power: 1.06, censer: 0.9 };
// The races the Holy path smites too (UNHOLY_RACES in game.js).
const UNHOLY = new Set(['undead', 'spirit', 'demon']);

const isPriest = (game) => game.jobClass === 'priest';

/** Is this foe undead, a spirit or a demon? */
export const unholy = (npc) => !!npc?.def && UNHOLY.has(raceOf(npc.def, npc.npcId));

/** The lifesteal (in %) on a Priest's spells: 0 for anyone else, or out of Magic. */
export const spellLifesteal = (game) => (isPriest(game) && game.combatMode() === 'magic' ? PRIEST.heal * 100 : 0);

/** A Priest's damage multiplier against this foe (1 for anyone else), a censer's lesser share included. */
export const smite = (game, npc) => (isPriest(game) ? PRIEST.power * (unholy(npc) ? 1 + PRIEST.smite : 1)
  * (game.weaponType?.() === 'censer' ? PRIEST.censer : 1) : 1);
