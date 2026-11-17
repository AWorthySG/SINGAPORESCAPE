// Interactive world objects: gathering nodes, processing stations, banks, scenery.
//
// type drives action routing in the game:
//   tree    -> Woodcutting     rock -> Mining        fishing -> Fishing
//   fire    -> Cooking (temp)  range -> Cooking      furnace -> Smithing (smelt)
//   anvil   -> Smithing (forge) bank -> Banking      scenery -> blocking decor
//
// Gathering rate is interpolated between lowChance (lvl 1) and highChance (lvl 99).
// depleteChance: probability the node is consumed after a successful gather.

import { HUNT } from './trades.js';

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
  bamboo: {
    name: 'Bamboo', label: 'Bamboo', type: 'tree', verb: 'Cut', emoji: '🎍', blocking: true,
    skill: 'woodcutting', level: 8, tool: 'axe', gives: 'bamboo', xp: 30,
    lowChance: 0.40, highChance: 0.92, depleteChance: 0.06, respawn: 6,
    examine: 'A fast-growing stand of bamboo. (Woodcutting 8)',
  },
  angsana: {
    name: 'Angsana tree', label: 'Angsana', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 22, tool: 'axe', gives: 'angsana_logs', xp: 55,
    lowChance: 0.24, highChance: 0.78, depleteChance: 0.12, respawn: 14,
    examine: 'A flowering angsana. (Woodcutting 22)',
  },
  teak: {
    name: 'Teak tree', label: 'Teak', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 35, tool: 'axe', gives: 'teak_logs', xp: 85,
    lowChance: 0.20, highChance: 0.70, depleteChance: 0.11, respawn: 18,
    examine: 'A straight, durable teak. (Woodcutting 35)',
  },
  mangrove: {
    name: 'Mangrove tree', label: 'Mangrove', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 40, tool: 'axe', gives: 'mangrove_logs', xp: 100,
    lowChance: 0.18, highChance: 0.66, depleteChance: 0.10, respawn: 20,
    examine: 'A tangle of salt-hardened mangrove. (Woodcutting 40)',
  },
  mahogany: {
    name: 'Mahogany tree', label: 'Mahogany', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 50, tool: 'axe', gives: 'mahogany_logs', xp: 125,
    lowChance: 0.15, highChance: 0.58, depleteChance: 0.09, respawn: 26,
    examine: 'A grand mahogany with rich red wood. (Woodcutting 50)',
  },
  tembusu: {
    name: 'Tembusu tree', label: 'Tembusu', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 68, tool: 'axe', gives: 'tembusu_logs', xp: 210,
    lowChance: 0.09, highChance: 0.44, depleteChance: 0.07, respawn: 55,
    examine: 'A majestic heritage tembusu. (Woodcutting 68)',
  },
  // ---- Endgame trees (Woodcutting 100-300) ----
  // Each tier's logs fletch that tier's bows, staves and wands (trades.js).
  // Every swing gives logs, so XP an hour is set by xp, how many trees share a
  // cluster (world.js places eight) and how fast felled ones grow back (quick
  // enough that a cluster never runs dry). Each tier gives about 35% more an
  // hour than the one before, starting from the magic tree, the best below
  // level 100; the xp was set by timing auto gather at each cluster, at the
  // same level for both trees so the past-99 XP bonus cancels out
  // (tests/wood-fletch-fire.test.mjs checks it). Until their own art arrives
  // they borrow an older tree's picture (`borrow`), recoloured (`tint`).
  seraya_tree: {
    name: 'Seraya tree', label: 'Seraya', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 100, tool: 'axe', gives: 'seraya_logs', xp: 315,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    borrow: 'mahogany', tint: 'hue-rotate(-20deg) saturate(1.15) brightness(1.05)',
    examine: 'A towering seraya, its trunk straight as a mast. (Woodcutting 100)',
  },
  meranti_tree: {
    name: 'Meranti tree', label: 'Meranti', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 130, tool: 'axe', gives: 'meranti_logs', xp: 440,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    borrow: 'teak', tint: 'hue-rotate(25deg) saturate(1.2) brightness(0.92)',
    examine: 'A red meranti, rising over the rainforest canopy. (Woodcutting 130)',
  },
  chengal_tree: {
    name: 'Chengal tree', label: 'Chengal', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 160, tool: 'axe', gives: 'chengal_logs', xp: 580,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    borrow: 'yew_tree', tint: 'sepia(0.35) saturate(1.3) hue-rotate(-10deg)',
    examine: 'An old chengal by the reservoir, its wood hard as iron. (Woodcutting 160)',
  },
  starfall_banyan: {
    name: 'Starfall banyan', label: 'Starfall banyan', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 200, tool: 'axe', gives: 'starwood_logs', xp: 760,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    borrow: 'rain_tree', tint: 'hue-rotate(170deg) saturate(1.3) brightness(1.08)',
    examine: 'A banyan that grew where a star fell. Its leaves glitter. (Woodcutting 200)',
  },
  // Night only: its wood can only be cut while the moon is up (game.isNight()).
  moonlit_kapok: {
    name: 'Moonlit kapok', label: 'Moonlit kapok', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 250, tool: 'axe', gives: 'moonwood_logs', xp: 1045, night: true,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    borrow: 'magic_tree', tint: 'hue-rotate(50deg) saturate(0.7) brightness(1.12)',
    examine: 'A pale kapok that only gives its wood by moonlight. (Woodcutting 250)',
  },
  keramat_tree: {
    name: 'Keramat tree', label: 'Keramat', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 300, tool: 'axe', gives: 'eternal_heartwood', xp: 1420,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    borrow: 'tembusu', tint: 'sepia(0.7) saturate(1.8) hue-rotate(-12deg) brightness(1.05)',
    examine: 'A sacred keramat tree, hung with offerings. Its heart is eternal. (Woodcutting 300)',
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
  // Mithril, adamantite and runite are sparse and slow to grow back, so their
  // xp (and respawn) are set so each beats granite and the tier below it an
  // hour, with runite still under obsidian (tests/levelling.test.mjs).
  mithril_rock: {
    name: 'Mithril rock', label: 'Mithril', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 50, tool: 'pickaxe', gives: 'mithril_ore', xp: 150,
    lowChance: 0.16, highChance: 0.60, depleteChance: 1, respawn: 30, ore: '#5b6bd6',
    examine: 'A rock streaked with mithril. (Mining 50)',
  },
  adamantite_rock: {
    name: 'Adamantite rock', label: 'Adamant', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 70, tool: 'pickaxe', gives: 'adamantite_ore', xp: 152,
    lowChance: 0.12, highChance: 0.48, depleteChance: 1, respawn: 30, ore: '#3fa06a',
    examine: 'A rock streaked with adamantite. (Mining 70)',
  },
  runite_rock: {
    name: 'Runite rock', label: 'Runite', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 85, tool: 'pickaxe', gives: 'runite_ore', xp: 210,
    lowChance: 0.08, highChance: 0.38, depleteChance: 1, respawn: 14, ore: '#46b3c4',
    examine: 'A rock glittering with rune. (Mining 85)',
  },
  gold_rock: {
    name: 'Gold rock', label: 'Gold', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 40, tool: 'pickaxe', gives: 'gold_ore', xp: 65,
    lowChance: 0.20, highChance: 0.70, depleteChance: 1, respawn: 20, ore: '#e8c84a',
    examine: 'A rock veined with gold. (Mining 40)',
  },
  clay_rock: {
    name: 'Clay rock', label: 'Clay', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 1, tool: 'pickaxe', gives: 'clay', xp: 12,
    lowChance: 0.45, highChance: 0.95, depleteChance: 1, respawn: 3, ore: '#b07a52',
    examine: 'A seam of soft clay.',
  },
  limestone_rock: {
    name: 'Limestone rock', label: 'Limestone', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 10, tool: 'pickaxe', gives: 'limestone', xp: 26,
    lowChance: 0.40, highChance: 0.90, depleteChance: 1, respawn: 5, ore: '#d8d2c0',
    examine: 'A pale limestone outcrop. (Mining 10)',
  },
  silver_rock: {
    name: 'Silver rock', label: 'Silver', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 20, tool: 'pickaxe', gives: 'silver_ore', xp: 40,
    lowChance: 0.35, highChance: 0.85, depleteChance: 1, respawn: 8, ore: '#d8dde6',
    examine: 'A rock streaked with silver. (Mining 20)',
  },
  sandstone_rock: {
    name: 'Sandstone rock', label: 'Sandstone', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 35, tool: 'pickaxe', gives: 'sandstone', xp: 55,
    lowChance: 0.25, highChance: 0.78, depleteChance: 1, respawn: 8, ore: '#d8c890',
    examine: 'A block of gritty sandstone. (Mining 35)',
  },
  gem_rock: {
    name: 'Gem rock', label: 'Gem', type: 'rock', verb: 'Mine', emoji: '💎', blocking: true,
    skill: 'mining', level: 40, tool: 'pickaxe', gives: 'sapphire', gemRock: true, xp: 65,
    lowChance: 0.16, highChance: 0.55, depleteChance: 1, respawn: 20, ore: '#9adcff',
    examine: 'A rock glittering with raw gems. (Mining 40)',
  },
  granite_rock: {
    name: 'Granite rock', label: 'Granite', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 45, tool: 'pickaxe', gives: 'granite', xp: 75,
    lowChance: 0.18, highChance: 0.64, depleteChance: 1, respawn: 12, ore: '#9a948a',
    examine: 'A heavy slab of speckled granite. (Mining 45)',
  },
  // ---- Endgame rocks (Mining 100-300) ----
  // Each tier's ore smelts into the bar for that tier's gear (smithing.js).
  // Every swing succeeds, so XP an hour is set by xp, how many rocks share a
  // cluster (world.js places eight) and how fast they grow back (quick enough
  // that a cluster never runs dry). Each tier gives about 35% more an hour than
  // the one before, starting from granite, the best rock below level 100; the
  // xp was set by timing auto gather at each cluster, whose layout changes the
  // walking, hence the uneven steps (tests/mining-smithing.test.mjs checks it).
  obsidian_vein: {
    name: 'Obsidian vein', label: 'Obsidian', type: 'rock', verb: 'Mine', emoji: '⬛', blocking: true,
    skill: 'mining', level: 100, tool: 'pickaxe', gives: 'obsidian_shard', xp: 82,
    lowChance: 0.2, highChance: 0.6, depleteChance: 1, respawn: 12, ore: '#4a3f5e',
    examine: 'A seam of glassy black obsidian, split by old fires. (Mining 100)',
  },
  orichalcum_rock: {
    name: 'Orichalcum rock', label: 'Orichalcum', type: 'rock', verb: 'Mine', emoji: '🪨', blocking: true,
    skill: 'mining', level: 130, tool: 'pickaxe', gives: 'orichalcum_ore', xp: 109,
    lowChance: 0.2, highChance: 0.6, depleteChance: 1, respawn: 12, ore: '#d08a3a',
    examine: 'A quarry face streaked with coppery-gold orichalcum. (Mining 130)',
  },
  jade_seam: {
    name: 'Jade seam', label: 'Jade', type: 'rock', verb: 'Mine', emoji: '🟢', blocking: true,
    skill: 'mining', level: 160, tool: 'pickaxe', gives: 'raw_jade', xp: 131,
    lowChance: 0.2, highChance: 0.6, depleteChance: 1, respawn: 12, ore: '#2f9a6a',
    examine: 'A seam of imperial jade under the old palace stones. (Mining 160)',
  },
  fallen_star: {
    name: 'Fallen star', label: 'Starmetal', type: 'rock', verb: 'Mine', emoji: '🌠', blocking: true,
    skill: 'mining', level: 200, tool: 'pickaxe', gives: 'starmetal_ore', xp: 202,
    lowChance: 0.2, highChance: 0.6, depleteChance: 1, respawn: 12, ore: '#6a7ad8',
    examine: 'A star that fell to earth, crusted with starmetal. (Mining 200)',
  },
  skyglass_crystal: {
    name: 'Skyglass crystal', label: 'Skyglass', type: 'rock', verb: 'Mine', emoji: '💠', blocking: true,
    skill: 'mining', level: 250, tool: 'pickaxe', gives: 'celestial_crystal', xp: 232,
    lowChance: 0.2, highChance: 0.6, depleteChance: 1, respawn: 12, ore: '#e8e2ff',
    examine: 'A spire of skyglass on the roof of the world. (Mining 250)',
  },
  eternal_lode: {
    name: 'Eternal lode', label: 'Eternal', type: 'rock', verb: 'Mine', emoji: '🟨', blocking: true,
    skill: 'mining', level: 300, tool: 'pickaxe', gives: 'eternal_ore', xp: 342,
    lowChance: 0.2, highChance: 0.6, depleteChance: 1, respawn: 12, ore: '#f5b82e',
    examine: 'A lode of golden eternal ore deep in the Shadow Rift. (Mining 300)',
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
    // Cage and harpoon fish pay more than the coastal rod spot's, so the
    // higher spots out-earn it at every level, sharks and manta rays most.
    catches: [
      { id: 'raw_grouper', level: 55, xp: 135, lowChance: 0.20, highChance: 0.62, weight: 40 },
      { id: 'raw_lobster', level: 40, xp: 105, lowChance: 0.25, highChance: 0.70, weight: 100 },
    ],
    examine: 'Bubbles rise where shellfish lurk. Set a lobster pot. (Fishing 40)',
  },
  harpoon_spot: {
    name: 'Harpoon fishing spot', label: 'Harpoon', type: 'fishing', verb: 'Harpoon', emoji: '🦈', blocking: false,
    skill: 'fishing', tool: 'harpoon', depleteChance: 0, respawn: 0,
    catches: [
      { id: 'raw_manta_ray', level: 84, xp: 215, lowChance: 0.08, highChance: 0.40, weight: 18 },
      { id: 'raw_shark', level: 76, xp: 185, lowChance: 0.10, highChance: 0.45, weight: 30 },
      { id: 'raw_stingray', level: 68, xp: 150, lowChance: 0.14, highChance: 0.52, weight: 40 },
      { id: 'raw_swordfish', level: 50, xp: 130, lowChance: 0.20, highChance: 0.60, weight: 60 },
      { id: 'raw_tuna', level: 35, xp: 100, lowChance: 0.25, highChance: 0.72, weight: 100 },
    ],
    examine: 'Big shadows circle in the deep water. Bring a harpoon. (Fishing 35)',
  },
  // ---- Endgame fishing spots (Fishing 100-300) ----
  // One fish each, cooked into that tier's dish (skilling.js COOKING). Every
  // cast catches, so XP an hour is just xp a cast: each tier gives about 35%
  // more than the one before, starting from the harpoon spot's average catch
  // (~134 xp once all five of its fish are open), the best below level 100
  // (tests/fish-cook.test.mjs times them). Until their own art arrives they
  // borrow an older spot's picture (`art`), recoloured (`tint`).
  dorado_spot: {
    name: 'Dorado fishing spot', label: 'Dorado', type: 'fishing', verb: 'Cast', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_dorado', level: 100, xp: 184, weight: 1 }],
    art: 'obj-sea_rod_spot', tint: 'sepia(0.6) saturate(2.2) hue-rotate(10deg) brightness(1.08)',
    examine: 'Flashes of gold and green chase bait round the islands. (Fishing 100)',
  },
  bluefin_spot: {
    name: 'Bluefin fishing spot', label: 'Bluefin', type: 'fishing', verb: 'Harpoon', emoji: '🦈', blocking: false,
    skill: 'fishing', tool: 'harpoon', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_bluefin_tuna', level: 130, xp: 249, weight: 1 }],
    art: 'obj-harpoon_spot', tint: 'hue-rotate(20deg) saturate(1.4) brightness(0.92)',
    examine: 'A school of giant bluefin boils the water off Changi. (Fishing 130)',
  },
  sailfish_spot: {
    name: 'Sailfish fishing spot', label: 'Sailfish', type: 'fishing', verb: 'Cast', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_sailfish', level: 160, xp: 337, weight: 1 }],
    art: 'obj-sea_rod_spot', tint: 'hue-rotate(60deg) saturate(1.5)',
    examine: 'Deep blue water past the Sentosa reef. A sail cuts the surface. (Fishing 160)',
  },
  // Moonfish rise to the surface by moonlight: +25% Fishing XP at night
  // (game.isNight(); see NIGHT_TREE_BONUS), never a lock.
  moonfish_spot: {
    name: 'Moonfish fishing spot', label: 'Moonfish', type: 'fishing', verb: 'Net', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'net', depleteChance: 0, respawn: 0, night: true,
    catches: [{ id: 'raw_moonfish', level: 200, xp: 455, weight: 1 }],
    art: 'obj-fishing_spot', tint: 'saturate(0.4) brightness(1.25)',
    examine: 'Round silver fish drift up the waterway when the moon is out. (Fishing 200)',
  },
  rift_eel_spot: {
    name: 'Rift eel fishing spot', label: 'Rift eel', type: 'fishing', verb: 'Cage', emoji: '🦞', blocking: false,
    skill: 'fishing', tool: 'lobster_pot', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_rift_eel', level: 250, xp: 615, weight: 1 }],
    art: 'obj-fishing_cage', tint: 'hue-rotate(230deg) saturate(1.6) brightness(0.9)',
    examine: 'Something long and glowing coils in the haunted shallows. (Fishing 250)',
  },
  arowana_pool: {
    name: 'Arowana pool', label: 'Arowana', type: 'fishing', verb: 'Lure', emoji: '🐉', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_dragon_arowana', level: 300, xp: 831, weight: 1 }],
    art: 'obj-rod_spot', tint: 'sepia(0.8) saturate(2.6) hue-rotate(-25deg) brightness(1.05)',
    examine: 'A still black pool in the Rift. A golden dragonfish circles below. (Fishing 300)',
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
  crafting_table: {
    name: 'Crafting table', type: 'craft', verb: 'Craft at', emoji: '🧰', blocking: true,
    skill: 'crafting', examine: 'A workbench for pottery and jewelry.',
  },

  // ---------------- Farming, Herblore, Fletching, Hunter ----------------
  farm_patch: {
    name: 'Farm patch', label: 'Patch', type: 'farm', verb: 'Tend', emoji: '🌱', blocking: false,
    skill: 'farming', examine: 'Rich, tilled soil. Plant a seed here, then come back to harvest.',
  },
  apothecary_table: {
    name: 'Apothecary table', type: 'herblore', verb: 'Brew at', emoji: '⚗️', blocking: true,
    skill: 'herblore', examine: 'Mortar, pestle and vials for brewing potions.',
  },
  fletching_bench: {
    name: 'Fletching bench', type: 'fletch', verb: 'Fletch at', emoji: '🏹', blocking: true,
    skill: 'fletching', examine: 'A bench for carving bows and tipping arrows.',
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

  // ---------------- Offering Shrine (material donations, see shrine.js) ----------------
  // Borrows the Monument's painted art (art), tinted gold so the two read apart.
  offering_shrine: {
    name: 'Offering Shrine', type: 'offering', verb: 'Offer at', emoji: '⛩️', blocking: true,
    art: 'obj-shrine', tint: 'sepia(0.6) saturate(1.6) brightness(1.05)',
    examine: 'A crystal shrine heaped with ore, gems, logs and herbs. Offerings here bless your fighting for good.',
  },

  // ---------------- A-Worthy Mascot Statue (rest point) ----------------
  mascot_statue: {
    name: 'A-Worthy Mascot Statue', type: 'rest', verb: 'Rest at', emoji: '🗿', blocking: true,
    examine: 'A big, friendly statue of the A-Worthy mascot. Rest here to recover health and run energy.',
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
  // ---- Endgame courses (Agility 100-300) ----
  // Six courses, each a loop of 4-5 obstacles spread round a square about ten
  // tiles across (world.js), so a lap is a real run. Every obstacle needs the
  // course level and has a markChance, so it counts as a course: the game
  // groups the obstacles within 12 tiles of each other (Game._agilityCourse).
  // The xp was set by timing auto gather laps at each course: each pays about
  // 35% more an hour (Marks of grace included) than the best course before it,
  // starting from the town course (tests/thieving-agility-tiers.test.mjs).
  // Until their own art arrives they borrow an older obstacle's picture, recoloured.
  supertree_skyway_stairs: {
    name: 'Spiral stair', label: 'Stair', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 100, xp: 124, markChance: 0.08, art: 'obj-agility_net', tint: 'hue-rotate(80deg) saturate(1.2)',
    examine: 'Up the spiral stair round a Supertree trunk. (Agility 100)',
  },
  supertree_skyway_bridge: {
    name: 'Skyway bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 100, xp: 124, markChance: 0.08, art: 'obj-agility_balance', tint: 'hue-rotate(80deg) saturate(1.2)',
    examine: 'A swaying walkway between the Supertrees. (Agility 100)',
  },
  supertree_skyway_vines: {
    name: 'Vine wall', label: 'Wall', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 100, xp: 124, markChance: 0.08, art: 'obj-agility_ledge', tint: 'hue-rotate(80deg) saturate(1.2)',
    examine: 'Hand over hand up a wall of creepers. (Agility 100)',
  },
  supertree_skyway_zipline: {
    name: 'Supertree zip-line', label: 'Zip-line', type: 'agility', verb: 'Ride', emoji: '🏃', blocking: false,
    skill: 'agility', level: 100, xp: 124, markChance: 0.08, art: 'obj-agility_zip', tint: 'hue-rotate(80deg) saturate(1.2)',
    examine: 'Down from the canopy on a humming wire. (Agility 100)',
  },
  container_yard_run_stack: {
    name: 'Container stack', label: 'Stack', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08, art: 'obj-agility_net', tint: 'hue-rotate(-30deg) saturate(1.4)',
    examine: 'Up a cargo net on the side of a container stack. (Agility 130)',
  },
  container_yard_run_gap: {
    name: 'Container gap', label: 'Gap', type: 'agility', verb: 'Leap', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08, art: 'obj-agility_ledge', tint: 'hue-rotate(-30deg) saturate(1.4)',
    examine: 'A long jump between two stacks. (Agility 130)',
  },
  container_yard_run_crane: {
    name: 'Crane hook', label: 'Hook', type: 'agility', verb: 'Swing on', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08, art: 'obj-agility_rope', tint: 'hue-rotate(-30deg) saturate(1.4)',
    examine: 'Swing across the yard on a crane hook. (Agility 130)',
  },
  container_yard_run_ropes: {
    name: 'Mooring ropes', label: 'Ropes', type: 'agility', verb: 'Balance on', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08, art: 'obj-agility_balance', tint: 'hue-rotate(-30deg) saturate(1.4)',
    examine: 'Walk the thick mooring ropes above the quay. (Agility 130)',
  },
  container_yard_run_chute: {
    name: 'Cargo chute', label: 'Chute', type: 'agility', verb: 'Slide down', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08, art: 'obj-agility_zip', tint: 'hue-rotate(-30deg) saturate(1.4)',
    examine: 'Down the cargo chute to the wharf. (Agility 130)',
  },
  canopy_course_rope_bridge: {
    name: 'Rope bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 160, xp: 247, markChance: 0.08, art: 'obj-agility_balance', tint: 'hue-rotate(50deg) saturate(1.3) brightness(0.9)',
    examine: 'A rope bridge strung between rainforest giants. (Agility 160)',
  },
  canopy_course_vine_swing: {
    name: 'Vine swing', label: 'Swing', type: 'agility', verb: 'Swing on', emoji: '🏃', blocking: false,
    skill: 'agility', level: 160, xp: 247, markChance: 0.08, art: 'obj-agility_rope', tint: 'hue-rotate(50deg) saturate(1.3) brightness(0.9)',
    examine: 'Swing on a liana across the creek. (Agility 160)',
  },
  canopy_course_treetop_walk: {
    name: 'Treetop walk', label: 'Walk', type: 'agility', verb: 'Edge across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 160, xp: 247, markChance: 0.08, art: 'obj-agility_ledge', tint: 'hue-rotate(50deg) saturate(1.3) brightness(0.9)',
    examine: 'Along a mossy branch high above the forest floor. (Agility 160)',
  },
  canopy_course_log_slide: {
    name: 'Log slide', label: 'Slide', type: 'agility', verb: 'Slide down', emoji: '🏃', blocking: false,
    skill: 'agility', level: 160, xp: 247, markChance: 0.08, art: 'obj-agility_zip', tint: 'hue-rotate(50deg) saturate(1.3) brightness(0.9)',
    examine: 'Down a fallen trunk to the ground. (Agility 160)',
  },
  cloud_steps_ledge: {
    name: 'Cliff ledge', label: 'Ledge', type: 'agility', verb: 'Edge across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08, art: 'obj-agility_ledge', tint: 'hue-rotate(180deg) saturate(0.8) brightness(1.15)',
    examine: 'A ledge no wider than your foot, above the clouds. (Agility 200)',
  },
  cloud_steps_stepping_stones: {
    name: 'Floating stones', label: 'Stones', type: 'agility', verb: 'Hop across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08, art: 'obj-agility_balance', tint: 'hue-rotate(180deg) saturate(0.8) brightness(1.15)',
    examine: 'Stones that hang in the air. Do not look down. (Agility 200)',
  },
  cloud_steps_rock_climb: {
    name: 'Rock face', label: 'Face', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08, art: 'obj-agility_net', tint: 'hue-rotate(180deg) saturate(0.8) brightness(1.15)',
    examine: 'A sheer face with a few good holds. (Agility 200)',
  },
  cloud_steps_cloud_bridge: {
    name: 'Cloud bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08, art: 'obj-agility_rope', tint: 'hue-rotate(180deg) saturate(0.8) brightness(1.15)',
    examine: 'A bridge of mist that holds your weight, mostly. (Agility 200)',
  },
  cloud_steps_glide: {
    name: 'Glide wire', label: 'Wire', type: 'agility', verb: 'Ride', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08, art: 'obj-agility_zip', tint: 'hue-rotate(180deg) saturate(0.8) brightness(1.15)',
    examine: 'A wire down the mountainside. (Agility 200)',
  },
  wraith_run_gravestones: {
    name: 'Gravestone hop', label: 'Hop', type: 'agility', verb: 'Hop across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 250, xp: 461, markChance: 0.08, art: 'obj-agility_balance', tint: 'grayscale(0.6) hue-rotate(120deg) brightness(1.05)',
    examine: 'Leap from headstone to headstone. Mind the residents. (Agility 250)',
  },
  wraith_run_broken_pier: {
    name: 'Broken pier', label: 'Pier', type: 'agility', verb: 'Edge across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 250, xp: 461, markChance: 0.08, art: 'obj-agility_ledge', tint: 'grayscale(0.6) hue-rotate(120deg) brightness(1.05)',
    examine: 'What is left of the old jetty. (Agility 250)',
  },
  wraith_run_lantern_swing: {
    name: 'Lantern swing', label: 'Swing', type: 'agility', verb: 'Swing on', emoji: '🏃', blocking: false,
    skill: 'agility', level: 250, xp: 461, markChance: 0.08, art: 'obj-agility_rope', tint: 'grayscale(0.6) hue-rotate(120deg) brightness(1.05)',
    examine: 'Swing on a rope hung with spirit lanterns. (Agility 250)',
  },
  wraith_run_ghost_bridge: {
    name: 'Ghost bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 250, xp: 461, markChance: 0.08, art: 'obj-agility_net', tint: 'grayscale(0.6) hue-rotate(120deg) brightness(1.05)',
    examine: 'A bridge that is only there when you believe in it. (Agility 250)',
  },
  rift_leap_chasm: {
    name: 'Chasm leap', label: 'Leap', type: 'agility', verb: 'Leap', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08, art: 'obj-agility_ledge', tint: 'hue-rotate(240deg) saturate(1.5) brightness(0.85)',
    examine: 'A jump across a crack in the world. (Agility 300)',
  },
  rift_leap_floating_rocks: {
    name: 'Floating rocks', label: 'Rocks', type: 'agility', verb: 'Hop across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08, art: 'obj-agility_balance', tint: 'hue-rotate(240deg) saturate(1.5) brightness(0.85)',
    examine: 'Rocks drifting over the void. (Agility 300)',
  },
  rift_leap_chain_climb: {
    name: 'Chain climb', label: 'Climb', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08, art: 'obj-agility_net', tint: 'hue-rotate(240deg) saturate(1.5) brightness(0.85)',
    examine: 'Up a great chain that anchors the Rift. (Agility 300)',
  },
  rift_leap_void_bridge: {
    name: 'Void bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08, art: 'obj-agility_rope', tint: 'hue-rotate(240deg) saturate(1.5) brightness(0.85)',
    examine: 'A bridge of dark light. (Agility 300)',
  },
  rift_leap_portal_dive: {
    name: 'Portal dive', label: 'Dive', type: 'agility', verb: 'Dive into', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08, art: 'obj-agility_zip', tint: 'hue-rotate(240deg) saturate(1.5) brightness(0.85)',
    examine: 'Through a portal and out at the start. (Agility 300)',
  },

  // ---------------- Thieving stalls ----------------
  // Steal from a stall: success yields loot + XP and empties the stall briefly;
  // failure stuns you. Loot is one weighted pick per successful theft. A stall
  // restocks every few ticks where a pocket can be picked every tick, so each
  // theft is worth a lot more XP: enough that a stall beats pickpocketing for a
  // good stretch of levels after it unlocks.
  stall_food: {
    name: 'Hawker stall', label: 'Hawker stall', type: 'stall', verb: 'Steal-from', emoji: '🍢', blocking: true,
    skill: 'thieving', level: 1, xp: 150, respawn: 4, examine: 'A food stall, ripe for a cheeky steal. (Thieving 1)',
    loot: [
      { id: 'coins', min: 5, max: 25, weight: 50 },
      { id: 'kaya_toast', weight: 20 }, { id: 'roti_prata', weight: 14 }, { id: 'chicken_rice', weight: 8 },
    ],
  },
  stall_market: {
    name: 'Market stall', label: 'Market stall', type: 'stall', verb: 'Steal-from', emoji: '🛍️', blocking: true,
    skill: 'thieving', level: 12, xp: 280, respawn: 6, examine: 'A bric-a-brac stall. (Thieving 12)',
    loot: [
      { id: 'coins', min: 25, max: 90, weight: 50 },
      { id: 'sapphire', weight: 10 }, { id: 'emerald', weight: 5 }, { id: 'gold_ore', weight: 14 },
    ],
  },
  stall_gem: {
    name: 'Gem stall', label: 'Gem stall', type: 'stall', verb: 'Steal-from', emoji: '💎', blocking: true,
    skill: 'thieving', level: 25, xp: 700, respawn: 9, examine: 'Glittering gems, lightly guarded. (Thieving 25)',
    loot: [
      { id: 'coins', min: 60, max: 200, weight: 40 },
      { id: 'sapphire', weight: 16 }, { id: 'emerald', weight: 12 }, { id: 'ruby', weight: 7 }, { id: 'diamond', weight: 2 },
    ],
  },
  // ---- Endgame chests (Thieving 160-300) ----
  // Worked like a stall (Game.stealFromStall): one weighted roll a success,
  // a stun when caught, and the chest relocks for `respawn` ticks. A chest is
  // cracked four times in five at its level (`sure`), not half the time. The
  // valuable things (refine scrolls, wards, endgame ore, rare amulets) are
  // rare rolls, so a chest pays mostly in coins. Each pays about 35% more an
  // hour, at its own level, than the best Thieving before it. Until their own
  // art arrives they borrow the gem stall's picture, recoloured.
  temple_vault: {
    name: 'Temple vault', label: 'Vault', type: 'stall', verb: 'Crack', emoji: '🧰', blocking: true,
    skill: 'thieving', level: 160, xp: 2450, respawn: 10, sure: 0.8, art: 'obj-stall_gem', tint: 'sepia(0.8) saturate(1.4) hue-rotate(60deg) brightness(0.85)',
    examine: 'A stone vault in the old temple, its lock worn smooth. (Thieving 160)',
    loot: [
      { id: 'coins', min: 500, max: 1500, weight: 66 },
      { id: 'sapphire', weight: 10 }, { id: 'emerald', weight: 8 }, { id: 'ruby', weight: 6 }, { id: 'diamond', weight: 4 },
      { id: 'refine_scroll', min: 1, max: 2, weight: 6 },
    ],
  },
  observatory_chest: {
    name: 'Observatory chest', label: 'Chest', type: 'stall', verb: 'Crack', emoji: '🧰', blocking: true,
    skill: 'thieving', level: 200, xp: 3610, respawn: 10, sure: 0.8, art: 'obj-stall_gem', tint: 'hue-rotate(190deg) saturate(1.2) brightness(1.1)',
    examine: 'A star-chart chest in the mountain observatory. (Thieving 200)',
    loot: [
      { id: 'coins', min: 800, max: 2000, weight: 66 },
      { id: 'ruby', weight: 10 }, { id: 'diamond', weight: 8 }, { id: 'emerald', weight: 10 },
      { id: 'starmetal_ore', weight: 6 },
    ],
  },
  smugglers_hold: {
    name: "Smugglers' hold", label: 'Hold', type: 'stall', verb: 'Crack', emoji: '🧰', blocking: true,
    skill: 'thieving', level: 250, xp: 5350, respawn: 10, sure: 0.8, art: 'obj-stall_gem', tint: 'sepia(0.9) saturate(0.8) brightness(0.75)',
    examine: 'A false-bottomed crate of contraband on the wharf. (Thieving 250)',
    loot: [
      { id: 'coins', min: 1000, max: 3000, weight: 70 },
      { id: 'upgrade_stone', min: 2, max: 5, weight: 26 },
      { id: 'upgrade_ward', weight: 4 },
    ],
  },
  rift_treasury: {
    name: 'Rift treasury', label: 'Treasury', type: 'stall', verb: 'Crack', emoji: '🧰', blocking: true,
    skill: 'thieving', level: 300, xp: 7800, respawn: 10, sure: 0.8, art: 'obj-stall_gem', tint: 'hue-rotate(250deg) saturate(1.6) brightness(0.8)',
    examine: 'The hoard of the Rift, guarded by nothing you can see. (Thieving 300)',
    // A rare-item table: weights out of 1000, so the merlion amulet is one success in a thousand.
    loot: [
      { id: 'coins', min: 2000, max: 5000, weight: 700 },
      { id: 'refine_scroll', min: 2, max: 4, weight: 90 },
      { id: 'eternal_ore', weight: 90 },
      { id: 'upgrade_ward', weight: 30 },
      { id: 'amulet_of_glory', weight: 89 },
      { id: 'merlion_amulet', weight: 1 },
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

// Hunter traps and trails (definitions in trades.js).
for (const [id, h] of Object.entries(HUNT)) {
  OBJECTS[id] = { ...h, label: h.name.split(' ')[0], type: 'hunt', verb: 'Check', emoji: '🪤', blocking: false, skill: 'hunter',
    examine: `${h.examine} (Hunter ${h.level})` };
}

export function getObject(id) {
  const obj = OBJECTS[id];
  if (!obj) throw new Error(`Unknown object id: ${id}`);
  return obj;
}
