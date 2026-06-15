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
  yew_tree: {
    name: 'Yew tree', label: 'Yew', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 60, tool: 'axe', gives: 'yew_logs', xp: 175,
    lowChance: 0.10, highChance: 0.48, depleteChance: 0.08, respawn: 40,
    examine: 'An ancient, gnarled yew. (Woodcutting 60)',
  },
  magic_tree: {
    name: 'Magic tree', label: 'Magic', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 75, tool: 'axe', gives: 'magic_logs', xp: 250,
    lowChance: 0.06, highChance: 0.35, depleteChance: 0.06, respawn: 90,
    examine: 'A tree humming with magical energy. (Woodcutting 75)',
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
  gold_rock: {
    name: 'Gold rock', label: 'Gold', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 40, tool: 'pickaxe', gives: 'gold_ore', xp: 65,
    lowChance: 0.20, highChance: 0.70, depleteChance: 1, respawn: 20, ore: '#e8c84a',
    examine: 'A rock veined with gold. (Mining 40)',
  },

  // ---------------- Fishing ----------------
  fishing_spot: {
    name: 'Net fishing spot', label: 'Net', type: 'fishing', verb: 'Net', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'net', depleteChance: 0, respawn: 0,
    // Level-gated catches; a weighted eligible-by-level entry is rolled.
    catches: [
      { id: 'raw_salmon', level: 30, xp: 70, lowChance: 0.22, highChance: 0.72, weight: 18 },
      { id: 'raw_mackerel', level: 16, xp: 45, lowChance: 0.25, highChance: 0.78, weight: 26 },
      { id: 'raw_trout', level: 20, xp: 50, lowChance: 0.25, highChance: 0.80, weight: 26 },
      { id: 'raw_sardine', level: 5, xp: 20, lowChance: 0.35, highChance: 0.85, weight: 50 },
      { id: 'raw_anchovy', level: 1, xp: 10, lowChance: 0.45, highChance: 0.95, weight: 100 },
    ],
    examine: 'Small fish dart about. Use a net here.',
  },
  rod_spot: {
    name: 'Rod fishing spot', label: 'Rod', type: 'fishing', verb: 'Lure', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [
      { id: 'raw_arowana', level: 80, xp: 240, lowChance: 0.05, highChance: 0.22, weight: 3 }, // prized & rare
      { id: 'raw_arapaima', level: 70, xp: 185, lowChance: 0.08, highChance: 0.38, weight: 12 },
      { id: 'raw_giant_snakehead', level: 55, xp: 130, lowChance: 0.12, highChance: 0.48, weight: 18 },
      { id: 'raw_speckled_temensis', level: 45, xp: 110, lowChance: 0.16, highChance: 0.56, weight: 24 },
      { id: 'raw_eel', level: 38, xp: 85, lowChance: 0.18, highChance: 0.62, weight: 28 },
      { id: 'raw_belida', level: 35, xp: 95, lowChance: 0.18, highChance: 0.60, weight: 28 },
      { id: 'raw_peacock_bass', level: 32, xp: 80, lowChance: 0.22, highChance: 0.68, weight: 36 },
      { id: 'raw_pike', level: 25, xp: 60, lowChance: 0.25, highChance: 0.74, weight: 44 },
      { id: 'raw_marble_goby', level: 24, xp: 70, lowChance: 0.20, highChance: 0.60, weight: 26 },
      { id: 'raw_trout', level: 20, xp: 50, lowChance: 0.28, highChance: 0.82, weight: 50 },
      { id: 'raw_ikan_keli', level: 18, xp: 52, lowChance: 0.30, highChance: 0.84, weight: 60 },
      { id: 'raw_climbing_perch', level: 15, xp: 48, lowChance: 0.30, highChance: 0.85, weight: 70 },
      { id: 'raw_tilapia', level: 12, xp: 38, lowChance: 0.32, highChance: 0.86, weight: 90 },
    ],
    examine: 'Calm freshwater — perfect for rod fishing. (Fishing 12)',
  },
  sea_rod_spot: {
    name: 'Coastal fishing spot', label: 'Cast', type: 'fishing', verb: 'Cast', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    // Singapore saltwater line fish, caught with a rod from the coast.
    catches: [
      { id: 'raw_giant_trevally', level: 65, xp: 165, lowChance: 0.10, highChance: 0.44, weight: 16 },
      { id: 'raw_hybrid_grouper', level: 62, xp: 160, lowChance: 0.12, highChance: 0.48, weight: 18 },
      { id: 'raw_cobia', level: 60, xp: 155, lowChance: 0.12, highChance: 0.50, weight: 22 },
      { id: 'raw_diamond_trevally', level: 58, xp: 150, lowChance: 0.14, highChance: 0.52, weight: 24 },
      { id: 'raw_coral_trout', level: 52, xp: 135, lowChance: 0.15, highChance: 0.55, weight: 28 },
      { id: 'raw_longfin_trevally', level: 50, xp: 125, lowChance: 0.16, highChance: 0.58, weight: 32 },
      { id: 'raw_tenggiri', level: 48, xp: 120, lowChance: 0.18, highChance: 0.60, weight: 36 },
      { id: 'raw_white_pomfret', level: 46, xp: 120, lowChance: 0.18, highChance: 0.58, weight: 30 },
      { id: 'raw_threadfin', level: 42, xp: 112, lowChance: 0.19, highChance: 0.60, weight: 34 },
      { id: 'raw_golden_snapper', level: 40, xp: 105, lowChance: 0.20, highChance: 0.64, weight: 38 },
      { id: 'raw_red_drum', level: 38, xp: 100, lowChance: 0.22, highChance: 0.66, weight: 46 },
      { id: 'raw_queenfish', level: 36, xp: 96, lowChance: 0.22, highChance: 0.68, weight: 50 },
      { id: 'raw_mangrove_jack', level: 34, xp: 92, lowChance: 0.24, highChance: 0.70, weight: 56 },
      { id: 'raw_milkfish', level: 30, xp: 86, lowChance: 0.26, highChance: 0.72, weight: 64 },
      { id: 'raw_barramundi', level: 30, xp: 88, lowChance: 0.26, highChance: 0.72, weight: 64 },
      { id: 'raw_red_snapper', level: 28, xp: 80, lowChance: 0.28, highChance: 0.76, weight: 90 },
    ],
    examine: 'Brackish coastal water teeming with sport fish. Cast a rod here. (Fishing 28)',
  },
  fishing_cage: {
    name: 'Cage fishing spot', label: 'Cage', type: 'fishing', verb: 'Cage', emoji: '🦞', blocking: false,
    skill: 'fishing', tool: 'lobster_pot', depleteChance: 0, respawn: 0,
    catches: [
      { id: 'raw_grouper', level: 55, xp: 110, lowChance: 0.20, highChance: 0.62, weight: 40 },
      { id: 'raw_lobster', level: 40, xp: 90, lowChance: 0.25, highChance: 0.70, weight: 100 },
    ],
    examine: 'Bubbles rise where shellfish lurk. Set a lobster pot. (Fishing 40)',
  },
  harpoon_spot: {
    name: 'Harpoon fishing spot', label: 'Harpoon', type: 'fishing', verb: 'Harpoon', emoji: '🦈', blocking: false,
    skill: 'fishing', tool: 'harpoon', depleteChance: 0, respawn: 0,
    catches: [
      { id: 'raw_manta_ray', level: 84, xp: 130, lowChance: 0.08, highChance: 0.40, weight: 18 },
      { id: 'raw_shark', level: 76, xp: 110, lowChance: 0.10, highChance: 0.45, weight: 30 },
      { id: 'raw_stingray', level: 68, xp: 100, lowChance: 0.14, highChance: 0.52, weight: 40 },
      { id: 'raw_swordfish', level: 50, xp: 100, lowChance: 0.20, highChance: 0.60, weight: 60 },
      { id: 'raw_tuna', level: 35, xp: 80, lowChance: 0.25, highChance: 0.72, weight: 100 },
    ],
    examine: 'Big shadows circle in the deep water. Bring a harpoon. (Fishing 35)',
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

  // ---------------- Hyco Education Obelisk (the hyco logo) ----------------
  hyco_obelisk: {
    name: 'Hyco Education Obelisk', type: 'rest', verb: 'Rest at', emoji: '🔵', blocking: true,
    examine: 'A monument to learning, presented by Hyco Education. Rest here to recover health and run energy.',
  },

  // ---------------- MRT station (fast travel) ----------------
  mrt_station: {
    name: 'MRT Station', label: 'MRT', type: 'transport', verb: 'Travel', emoji: '🚇', blocking: false,
    examine: 'A Mass Rapid Transit station. Tap in to travel across the island.',
  },

  // ---------------- Agility course ----------------
  agility_course: {
    name: 'Agility course', label: 'Agility', type: 'agility', verb: 'Train at', emoji: '🏃', blocking: true,
    skill: 'agility', xp: 18, examine: 'Clamber across to train your Agility.',
  },
  // A rooftop-style obstacle loop in Bukit Timah. Train each in turn; finishing a
  // full lap (touching every obstacle) grants a bonus and a Mark of grace.
  agility_balance: {
    name: 'Balance beam', label: 'Beam', type: 'agility', verb: 'Cross', emoji: '🪵', blocking: false,
    skill: 'agility', level: 1, xp: 22, markChance: 0.05, examine: 'Tip-toe across the beam. (Agility 1)',
  },
  agility_net: {
    name: 'Cargo net', label: 'Net', type: 'agility', verb: 'Climb', emoji: '🕸️', blocking: false,
    skill: 'agility', level: 5, xp: 30, markChance: 0.06, examine: 'Scramble up the net. (Agility 5)',
  },
  agility_rope: {
    name: 'Rope swing', label: 'Rope', type: 'agility', verb: 'Swing on', emoji: '🪢', blocking: false,
    skill: 'agility', level: 10, xp: 38, markChance: 0.07, examine: 'Swing across the gap. (Agility 10)',
  },
  agility_ledge: {
    name: 'Narrow ledge', label: 'Ledge', type: 'agility', verb: 'Edge across', emoji: '🧗', blocking: false,
    skill: 'agility', level: 15, xp: 46, markChance: 0.08, examine: 'Shuffle along the ledge. (Agility 15)',
  },
  agility_zip: {
    name: 'Zip-line', label: 'Zip', type: 'agility', verb: 'Ride', emoji: '🛝', blocking: false,
    skill: 'agility', level: 20, xp: 60, markChance: 0.10, finish: true, examine: 'Ride the zip-line home. (Agility 20)',
  },

  // ---------------- Thieving stalls ----------------
  // Steal from a stall: success yields loot + XP and empties the stall briefly;
  // failure stuns you. Loot is one weighted pick per successful theft.
  stall_food: {
    name: 'Hawker stall', label: 'Hawker stall', type: 'stall', verb: 'Steal-from', emoji: '🍢', blocking: true,
    skill: 'thieving', level: 1, xp: 16, respawn: 4, examine: 'A food stall, ripe for a cheeky steal. (Thieving 1)',
    loot: [
      { id: 'coins', min: 5, max: 25, weight: 50 },
      { id: 'kaya_toast', weight: 20 }, { id: 'roti_prata', weight: 14 }, { id: 'chicken_rice', weight: 8 },
    ],
  },
  stall_market: {
    name: 'Market stall', label: 'Market stall', type: 'stall', verb: 'Steal-from', emoji: '🛍️', blocking: true,
    skill: 'thieving', level: 12, xp: 40, respawn: 6, examine: 'A bric-a-brac stall. (Thieving 12)',
    loot: [
      { id: 'coins', min: 25, max: 90, weight: 50 },
      { id: 'sapphire', weight: 10 }, { id: 'emerald', weight: 5 }, { id: 'gold_ore', weight: 14 },
    ],
  },
  stall_gem: {
    name: 'Gem stall', label: 'Gem stall', type: 'stall', verb: 'Steal-from', emoji: '💎', blocking: true,
    skill: 'thieving', level: 25, xp: 75, respawn: 9, examine: 'Glittering gems, lightly guarded. (Thieving 25)',
    loot: [
      { id: 'coins', min: 60, max: 200, weight: 40 },
      { id: 'sapphire', weight: 16 }, { id: 'emerald', weight: 12 }, { id: 'ruby', weight: 7 }, { id: 'diamond', weight: 2 },
    ],
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
