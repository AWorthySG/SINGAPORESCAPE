// Smithing recipes.
// SMELT: ore -> bar at a furnace. SMITH: bar -> item at an anvil (requires a hammer).

export const SMELT = [
  { result: 'bronze_bar', inputs: [{ id: 'copper_ore', qty: 1 }, { id: 'tin_ore', qty: 1 }], level: 1, xp: 6.2 },
  { result: 'iron_bar', inputs: [{ id: 'iron_ore', qty: 1 }], level: 15, xp: 12.5, successChance: 0.5 },
];

export const SMITH = [
  { result: 'bronze_dagger', bar: 'bronze_bar', barCount: 1, level: 1, xp: 12.5 },
  { result: 'bronze_sword', bar: 'bronze_bar', barCount: 1, level: 4, xp: 12.5 },
  { result: 'bronze_scimitar', bar: 'bronze_bar', barCount: 2, level: 5, xp: 25 },
  { result: 'bronze_helm', bar: 'bronze_bar', barCount: 2, level: 7, xp: 25 },
  { result: 'wooden_shield', bar: 'bronze_bar', barCount: 2, level: 8, xp: 25 },
  { result: 'bronze_kiteshield', bar: 'bronze_bar', barCount: 3, level: 12, xp: 37.5 },
  { result: 'bronze_platelegs', bar: 'bronze_bar', barCount: 3, level: 16, xp: 37.5 },
  { result: 'bronze_platebody', bar: 'bronze_bar', barCount: 5, level: 18, xp: 62.5 },
  { result: 'iron_scimitar', bar: 'iron_bar', barCount: 2, level: 20, xp: 50 },
  { result: 'iron_full_helm', bar: 'iron_bar', barCount: 2, level: 26, xp: 50 },
  { result: 'iron_platebody', bar: 'iron_bar', barCount: 5, level: 33, xp: 125 },
];
