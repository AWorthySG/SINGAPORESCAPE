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
export const ABILITIES = [
  { id: 'power_strike', name: 'Power Strike', key: 'Z', icon: '💥', cost: 25, cd: 4, kind: 'attack',
    unlock: 1, dmgMul: 1.9, guaranteed: true, desc: 'A guaranteed, devastating blow (~1.9x damage).' },
  { id: 'flurry', name: 'Flurry', key: 'X', icon: '🌀', cost: 35, cd: 6, kind: 'attack',
    unlock: 1, hits: 3, dmgMul: 0.65, desc: 'Strike three rapid times in a single turn.' },
  { id: 'brace', name: 'Brace', key: 'C', icon: '🛡️', cost: 20, cd: 5, kind: 'guard',
    unlock: 1, guardTicks: 4, reduce: 0.5, desc: 'Halve incoming damage for 4 ticks — counter heavy blows.' },
  { id: 'second_wind', name: 'Second Wind', key: 'V', icon: '💚', cost: 60, cd: 12, kind: 'heal',
    unlock: 1, healFrac: 0.25, desc: 'Recover a quarter of your life in an instant.' },
  { id: 'onslaught', name: 'Onslaught', key: 'B', icon: '⚡', cost: 100, cd: 16, kind: 'attack',
    unlock: 45, hits: 4, dmgMul: 0.85, guaranteed: true,
    desc: 'Ultimate: four guaranteed strikes that spend all your adrenaline.' },
];

export const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
