// Smithing recipes.
// SMELT: ore -> bar at a furnace. SMITH: bar -> item at an anvil (requires a hammer).

export const SMELT = [
  { result: 'bronze_bar', inputs: [{ id: 'copper_ore', qty: 1 }, { id: 'tin_ore', qty: 1 }], level: 1, xp: 6.2 },
  { result: 'iron_bar', inputs: [{ id: 'iron_ore', qty: 1 }], level: 15, xp: 12.5, successChance: 0.5 },
  { result: 'steel_bar', inputs: [{ id: 'iron_ore', qty: 1 }, { id: 'coal', qty: 2 }], level: 30, xp: 17.5 },
  { result: 'mithril_bar', inputs: [{ id: 'mithril_ore', qty: 1 }, { id: 'coal', qty: 4 }], level: 50, xp: 30 },
  { result: 'adamant_bar', inputs: [{ id: 'adamantite_ore', qty: 1 }, { id: 'coal', qty: 6 }], level: 70, xp: 37.5 },
  { result: 'rune_bar', inputs: [{ id: 'runite_ore', qty: 1 }, { id: 'coal', qty: 8 }], level: 85, xp: 50 },
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
  { result: 'steel_scimitar', bar: 'steel_bar', barCount: 2, level: 30, xp: 75 },
  { result: 'steel_full_helm', bar: 'steel_bar', barCount: 2, level: 37, xp: 75 },
  { result: 'steel_kiteshield', bar: 'steel_bar', barCount: 3, level: 43, xp: 112.5 },
  { result: 'steel_platebody', bar: 'steel_bar', barCount: 5, level: 48, xp: 187.5 },
  { result: 'mithril_scimitar', bar: 'mithril_bar', barCount: 2, level: 55, xp: 100 },
  { result: 'mithril_full_helm', bar: 'mithril_bar', barCount: 2, level: 60, xp: 100 },
  { result: 'mithril_platebody', bar: 'mithril_bar', barCount: 5, level: 68, xp: 250 },
  { result: 'adamant_scimitar', bar: 'adamant_bar', barCount: 2, level: 75, xp: 125 },
  { result: 'rune_scimitar', bar: 'rune_bar', barCount: 2, level: 90, xp: 150 },
  { result: 'rune_full_helm', bar: 'rune_bar', barCount: 3, level: 92, xp: 225 },
  { result: 'rune_kiteshield', bar: 'rune_bar', barCount: 3, level: 94, xp: 225 },
  { result: 'rune_platebody', bar: 'rune_bar', barCount: 5, level: 99, xp: 375 },
];
