// Clue scrolls & treasure trails.
//
// Monsters rarely drop a clue scroll. Reading it reveals a riddle pointing to a
// landmark; travel there and dig to advance the trail. Finishing the trail yields
// a reward casket whose loot table scales with the clue's tier.
//
// One trail is active at a time (game.clue). A trail is { tier, item, casket,
// step, spots: [{x,y,hint}] }.

export const CLUE_TIERS = {
  easy: {
    item: 'clue_scroll_easy', casket: 'reward_casket_easy', steps: 2, rolls: 2,
    reward: [
      { id: 'coins', min: 300, max: 1200, weight: 40 },
      { id: 'sapphire', weight: 15 }, { id: 'emerald', weight: 8 },
      { id: 'steel_platebody', weight: 10 }, { id: 'steel_scimitar', weight: 10 },
      { id: 'mithril_arrow', min: 30, max: 80, weight: 12 },
      { id: 'lobster', min: 3, max: 6, weight: 12 },
    ],
  },
  medium: {
    item: 'clue_scroll_medium', casket: 'reward_casket_medium', steps: 3, rolls: 2,
    reward: [
      { id: 'coins', min: 1200, max: 4000, weight: 38 },
      { id: 'emerald', weight: 14 }, { id: 'ruby', weight: 8 },
      { id: 'mithril_platebody', weight: 10 }, { id: 'mithril_scimitar', weight: 10 },
      { id: 'amulet_of_power', weight: 8 },
      { id: 'rune_arrow', min: 40, max: 120, weight: 12 },
    ],
  },
  hard: {
    item: 'clue_scroll_hard', casket: 'reward_casket_hard', steps: 4, rolls: 3,
    reward: [
      { id: 'coins', min: 4000, max: 12000, weight: 34 },
      { id: 'ruby', weight: 12 }, { id: 'diamond', weight: 6 },
      { id: 'rune_platebody', weight: 9 }, { id: 'rune_scimitar', weight: 9 },
      { id: 'amulet_of_glory', weight: 8 },
      { id: 'dragon_scimitar', weight: 3 }, // rare grand prize
    ],
  },
};

// Pick the clue tier a monster of `level` drops.
export function clueTierForLevel(level) {
  return level >= 45 ? 'hard' : level >= 20 ? 'medium' : 'easy';
}

// Dig spots across the island; each riddle points at a recognisable landmark and
// sits on a reachable tile beside it.
export const CLUE_SPOTS = [
  { x: 56, y: 55, hint: 'Dig where the Kampong Guide greets newcomers.' },
  { x: 52, y: 48, hint: 'Dig beside the Bank of Singapore in Kampong Glam.' },
  { x: 59, y: 51, hint: 'Dig at the foot of the A-Worthy Monument.' },
  { x: 60, y: 62, hint: 'Dig near the kampung hawker stalls.' },
  { x: 37, y: 33, hint: 'Dig by the chicken pen in Bukit Timah.' },
  { x: 36, y: 52, hint: 'Dig on the banks of MacRitchie Reservoir.' },
  { x: 84, y: 54, hint: 'Dig near the Hyco obelisk in Chinatown.' },
  { x: 87, y: 50, hint: 'Dig outside the Chinatown bank.' },
  { x: 57, y: 88, hint: 'Dig on the golden sands of Sentosa Beach.' },
  { x: 70, y: 53, hint: 'Dig by the Kampong Glam MRT station.' },
];
