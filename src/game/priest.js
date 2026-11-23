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
export const PRIEST = { heal: 0.08, smite: 0.3, power: 1.06 };
// The races the Holy path smites too (UNHOLY_RACES in game.js).
const UNHOLY = new Set(['undead', 'spirit', 'demon']);

const isPriest = (game) => game.jobClass === 'priest';

/** Is this foe undead, a spirit or a demon? */
export const unholy = (npc) => !!npc?.def && UNHOLY.has(raceOf(npc.def, npc.npcId));

/** The lifesteal (in %) on a Priest's spells: 0 for anyone else, or out of Magic. */
export const spellLifesteal = (game) => (isPriest(game) && game.combatMode() === 'magic' ? PRIEST.heal * 100 : 0);

/** A Priest's damage multiplier against this foe (1 for anyone else). */
export const smite = (game, npc) => (isPriest(game) ? PRIEST.power * (unholy(npc) ? 1 + PRIEST.smite : 1) : 1);
