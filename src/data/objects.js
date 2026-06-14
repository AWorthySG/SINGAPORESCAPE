// Interactive world objects: gathering nodes, processing stations, banks, scenery.
//
// type drives action routing in the game:
//   tree    -> Woodcutting     rock -> Mining        fishing -> Fishing
//   fire    -> Cooking (temp)  range -> Cooking      furnace -> Smithing (smelt)
//   anvil   -> Smithing (forge) bank -> Banking      scenery -> blocking decor
//
// Gathering rate is interpolated between lowChance (lvl 1) and highChance (lvl 99).
// depleteChance: probability the node is consumed after a successful gather.

export const OBJECTS = {
  // ---------------- Trees ----------------
  tree: {
    name: 'Tree', label: 'Tree', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 1, tool: 'axe', gives: 'logs', xp: 25,
    lowChance: 0.45, highChance: 0.95, depleteChance: 0.10, respawn: 10,
    examine: 'A sturdy tree.',
  },
  oak: {
    name: 'Oak tree', label: 'Oak', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 15, tool: 'axe', gives: 'oak_logs', xp: 37.5,
    lowChance: 0.25, highChance: 0.80, depleteChance: 0.125, respawn: 14,
    examine: 'A grand old oak. (Woodcutting 15)',
  },
  willow: {
    name: 'Willow tree', label: 'Willow', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 30, tool: 'axe', gives: 'willow_logs', xp: 67.5,
    lowChance: 0.20, highChance: 0.72, depleteChance: 0.125, respawn: 16,
    examine: 'Its branches droop into the water. (Woodcutting 30)',
  },
  rain_tree: {
    name: 'Rain tree', label: 'Rain Tree', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 45, tool: 'axe', gives: 'maple_logs', xp: 100,
    lowChance: 0.16, highChance: 0.62, depleteChance: 0.10, respawn: 22,
    examine: 'A vast, umbrella-shaped rain tree. (Woodcutting 45)',
  },

  // ---------------- Rocks ----------------
  copper_rock: {
    name: 'Copper rock', label: 'Copper', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 1, tool: 'pickaxe', gives: 'copper_ore', xp: 17.5,
    lowChance: 0.40, highChance: 0.95, depleteChance: 1, respawn: 4, ore: '#c97b3a',
    examine: 'A rock containing copper.',
  },
  tin_rock: {
    name: 'Tin rock', label: 'Tin', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 1, tool: 'pickaxe', gives: 'tin_ore', xp: 17.5,
    lowChance: 0.40, highChance: 0.95, depleteChance: 1, respawn: 4, ore: '#cfcfcf',
    examine: 'A rock containing tin.',
  },
  iron_rock: {
    name: 'Iron rock', label: 'Iron', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 15, tool: 'pickaxe', gives: 'iron_ore', xp: 35,
    lowChance: 0.35, highChance: 0.90, depleteChance: 1, respawn: 6, ore: '#a45a3a',
    examine: 'A rock containing iron. (Mining 15)',
  },
  coal_rock: {
    name: 'Coal rock', label: 'Coal', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 30, tool: 'pickaxe', gives: 'coal', xp: 50,
    lowChance: 0.25, highChance: 0.80, depleteChance: 1, respawn: 10, ore: '#2a2a2a',
    examine: 'A rock containing coal. (Mining 30)',
  },
  mithril_rock: {
    name: 'Mithril rock', label: 'Mithril', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 50, tool: 'pickaxe', gives: 'mithril_ore', xp: 80,
    lowChance: 0.16, highChance: 0.60, depleteChance: 1, respawn: 30, ore: '#5b6bd6',
    examine: 'A rock streaked with mithril. (Mining 50)',
  },
  adamantite_rock: {
    name: 'Adamantite rock', label: 'Adamant', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 70, tool: 'pickaxe', gives: 'adamantite_ore', xp: 95,
    lowChance: 0.12, highChance: 0.48, depleteChance: 1, respawn: 50, ore: '#3fa06a',
    examine: 'A rock streaked with adamantite. (Mining 70)',
  },
  runite_rock: {
    name: 'Runite rock', label: 'Runite', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 85, tool: 'pickaxe', gives: 'runite_ore', xp: 125,
    lowChance: 0.08, highChance: 0.38, depleteChance: 1, respawn: 90, ore: '#46b3c4',
    examine: 'A rock glittering with rune. (Mining 85)',
  },

  // ---------------- Fishing ----------------
  fishing_spot: {
    name: 'Net fishing spot', label: 'Net', type: 'fishing', verb: 'Net', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'net', depleteChance: 0, respawn: 0,
    // Level-gated catches; a weighted eligible-by-level entry is rolled.
    catches: [
      { id: 'raw_trout', level: 20, xp: 50, lowChance: 0.25, highChance: 0.80, weight: 30 },
      { id: 'raw_sardine', level: 5, xp: 20, lowChance: 0.35, highChance: 0.85, weight: 50 },
      { id: 'raw_anchovy', level: 1, xp: 10, lowChance: 0.45, highChance: 0.95, weight: 100 },
    ],
    examine: 'Small fish dart about. Use a net here.',
  },
  fishing_cage: {
    name: 'Cage fishing spot', label: 'Cage', type: 'fishing', verb: 'Cage', emoji: '🦞', blocking: false,
    skill: 'fishing', tool: 'net', depleteChance: 0, respawn: 0,
    catches: [
      { id: 'raw_swordfish', level: 50, xp: 100, lowChance: 0.20, highChance: 0.60, weight: 35 },
      { id: 'raw_lobster', level: 40, xp: 90, lowChance: 0.25, highChance: 0.70, weight: 100 },
    ],
    examine: 'Bubbles rise where shellfish lurk. (Fishing 40)',
  },

  // ---------------- Processing ----------------
  fire: {
    name: 'Fire', type: 'fire', verb: 'Cook on', emoji: '🔥', blocking: false,
    examine: 'A roaring fire.',
  },
  range: {
    name: 'Cooking range', type: 'range', verb: 'Cook on', emoji: '🍳', blocking: true,
    examine: 'A hot cooking range.',
  },
  furnace: {
    name: 'Furnace', type: 'furnace', verb: 'Smelt at', emoji: '🏭', blocking: true,
    skill: 'smithing', examine: 'A furnace for smelting ore.',
  },
  anvil: {
    name: 'Anvil', type: 'anvil', verb: 'Smith at', emoji: '🛠️', blocking: true,
    skill: 'smithing', tool: 'hammer', examine: 'A heavy iron anvil.',
  },

  // ---------------- Banking ----------------
  bank_booth: {
    name: 'Bank booth', type: 'bank', verb: 'Use', emoji: '🏦', blocking: true,
    examine: 'Deposit your items here for safe keeping.',
  },

  // ---------------- A-Worthy Monument (the A Worthy logo) ----------------
  shrine: {
    name: 'A-Worthy Monument', type: 'shrine', verb: 'Pray at', emoji: '✝️', blocking: true,
    examine: 'A grand monument raised to those who proved worthy. Praying here mends your wounds.',
  },

  // ---------------- Scenery (blocking decor) ----------------
  wall: { name: 'Wall', type: 'scenery', emoji: '🧱', blocking: true, examine: 'A stone wall.' },
  ruin: { name: 'Ruins', type: 'scenery', emoji: '🏚️', blocking: true, examine: 'Crumbling ruins from a forgotten age.' },
  fence: { name: 'Fence', type: 'scenery', emoji: '🪵', blocking: true, examine: 'A wooden fence.' },
  bush: { name: 'Bush', type: 'scenery', emoji: '🌿', blocking: false, examine: 'A leafy bush.' },
  flower: { name: 'Flowers', type: 'scenery', emoji: '🌺', blocking: false, examine: 'Pretty orchids.' },
  palm: { name: 'Palm tree', type: 'scenery', emoji: '🌴', blocking: true, examine: 'A tall palm.' },
  lamp: { name: 'Lamp post', type: 'scenery', emoji: '🏮', blocking: true, examine: 'It lights the path.' },
  sign: { name: 'Signpost', type: 'scenery', emoji: '🪧', blocking: false, examine: 'Welcome to Kampong Glam!' },
};

export function getObject(id) {
  const obj = OBJECTS[id];
  if (!obj) throw new Error(`Unknown object id: ${id}`);
  return obj;
}
