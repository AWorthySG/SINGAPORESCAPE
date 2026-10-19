// Active combat abilities. Fuelled by Adrenaline (built by landing and taking
// hits), each ability has an adrenaline cost and a cooldown in game ticks.
//
// kind:
//   'attack' — armed like a special; the modifiers apply to your next hit
//              (dmgMul scales damage, hits>1 strikes repeatedly, guaranteed skips
//               the accuracy roll).
//   'guard'  — applied immediately; halves incoming damage for guardTicks (the
//              counter to a monster's telegraphed heavy blow).
//   'heal'   — applied immediately; restores healFrac of max life.
// `unlock` is the combat level the ability becomes usable (abilities ramp in as
// the player grows; the ultimate is gated behind a high level + full adrenaline).
// `mode` ties an attack ability to the equipped weapon's combat style
// ('melee' | 'ranged' | 'magic'); the action bar shows only the set for the
// weapon in hand, so each hotkey slot (Z / X / B) swaps with your weapon.
// `instant` fires straight away at your current target instead of waiting for
// the next swing.
export const ABILITIES = [
  // ---- Melee (swords, scimitars, maces, axes…) ----
  { id: 'power_strike', name: 'Power Strike', key: 'Z', icon: '💥', cost: 25, cd: 4, kind: 'attack', mode: 'melee',
    unlock: 1, dmgMul: 1.9, guaranteed: true, desc: 'A guaranteed, devastating blow (~1.9x damage).' },
  { id: 'flurry', name: 'Flurry', key: 'X', icon: '🌀', cost: 35, cd: 6, kind: 'attack', mode: 'melee',
    unlock: 1, hits: 3, dmgMul: 0.65, desc: 'Strike three rapid times in a single turn.' },
  // ---- Ranged (bows) ----
  { id: 'snapshot', name: 'Snapshot', key: 'Z', icon: '🏹', cost: 30, cd: 5, kind: 'attack', mode: 'ranged',
    unlock: 1, hits: 3, dmgMul: 0.8, instant: true, desc: 'Loose three arrows instantly at your target.' },
  { id: 'piercing_shot', name: 'Piercing Shot', key: 'X', icon: '🎯', cost: 35, cd: 6, kind: 'attack', mode: 'ranged',
    unlock: 1, dmgMul: 1.8, guaranteed: true, desc: 'A guaranteed, armour-piercing arrow (~1.8x damage).' },
  // ---- Magic (staves) ----
  { id: 'arcane_surge', name: 'Arcane Surge', key: 'Z', icon: '✨', cost: 25, cd: 4, kind: 'attack', mode: 'magic',
    unlock: 1, dmgMul: 1.9, guaranteed: true, desc: 'Your next spell surges: guaranteed, ~1.9x damage.' },
  { id: 'mana_burst', name: 'Mana Burst', key: 'X', icon: '🔮', cost: 35, cd: 6, kind: 'attack', mode: 'magic',
    unlock: 1, dmgMul: 2.4, instant: true, desc: 'Instantly unleash a burst of raw magic (~2.4x damage).' },
  // ---- Shared ----
  { id: 'brace', name: 'Brace', key: 'C', icon: '🛡️', cost: 20, cd: 5, kind: 'guard',
    unlock: 1, guardTicks: 4, reduce: 0.5, desc: 'Halve incoming damage for 4 ticks — counter heavy blows.' },
  { id: 'second_wind', name: 'Second Wind', key: 'V', icon: '💚', cost: 60, cd: 12, kind: 'heal',
    unlock: 1, healFrac: 0.25, desc: 'Recover a quarter of your life in an instant.' },
  // ---- Ultimates ----
  { id: 'onslaught', name: 'Onslaught', key: 'B', icon: '⚡', cost: 100, cd: 16, kind: 'attack', mode: 'melee',
    unlock: 45, hits: 4, dmgMul: 0.85, guaranteed: true,
    desc: 'Ultimate: four guaranteed strikes that spend all your adrenaline.' },
  { id: 'arrow_storm', name: 'Arrow Storm', key: 'B', icon: '🌧️', cost: 100, cd: 16, kind: 'attack', mode: 'ranged',
    unlock: 45, hits: 5, dmgMul: 0.8, guaranteed: true, instant: true,
    desc: 'Ultimate: rain five guaranteed arrows down on your target at once.' },
  { id: 'meteor', name: 'Meteor', key: 'B', icon: '☄️', cost: 100, cd: 16, kind: 'attack', mode: 'magic',
    unlock: 45, dmgMul: 3.2, guaranteed: true, instant: true,
    desc: 'Ultimate: call down a guaranteed meteor (~3.2x damage).' },
];

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

const SLOT_ORDER = ['Z', 'X', 'C', 'V', 'B'];
/** The five abilities on the bar for a combat style, in hotkey order. */
export function abilitiesFor(mode) {
  return SLOT_ORDER.map((k) => ABILITIES.find((a) => a.key === k && (!a.mode || a.mode === mode))).filter(Boolean);
}
