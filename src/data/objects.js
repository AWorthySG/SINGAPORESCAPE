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
  // (tests/wood-fletch-fire.test.mjs checks it).
  seraya_tree: {
    name: 'Seraya tree', label: 'Seraya', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 100, tool: 'axe', gives: 'seraya_logs', xp: 315,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    examine: 'A towering seraya, its trunk straight as a mast. (Woodcutting 100)',
  },
  meranti_tree: {
    name: 'Meranti tree', label: 'Meranti', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 130, tool: 'axe', gives: 'meranti_logs', xp: 440,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    examine: 'A red meranti, rising over the rainforest canopy. (Woodcutting 130)',
  },
  chengal_tree: {
    name: 'Chengal tree', label: 'Chengal', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 160, tool: 'axe', gives: 'chengal_logs', xp: 580,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    examine: 'An old chengal by the reservoir, its wood hard as iron. (Woodcutting 160)',
  },
  starfall_banyan: {
    name: 'Starfall banyan', label: 'Starfall banyan', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 200, tool: 'axe', gives: 'starwood_logs', xp: 760,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    examine: 'A banyan that grew where a star fell. Its leaves glitter. (Woodcutting 200)',
  },
  // Night only: its wood can only be cut while the moon is up (game.isNight()).
  moonlit_kapok: {
    name: 'Moonlit kapok', label: 'Moonlit kapok', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 250, tool: 'axe', gives: 'moonwood_logs', xp: 1045, night: true,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
    examine: 'A pale kapok that only gives its wood by moonlight. (Woodcutting 250)',
  },
  keramat_tree: {
    name: 'Keramat tree', label: 'Keramat', type: 'tree', verb: 'Chop down', emoji: '🌳', blocking: true,
    skill: 'woodcutting', level: 300, tool: 'axe', gives: 'eternal_heartwood', xp: 1420,
    lowChance: 0.2, highChance: 0.6, depleteChance: 0.1, respawn: 12,
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
  // One fish to a spot (Nov 2026): each kind of spot catches one species, and
  // each species comes from one kind of spot, so where you fish picks the fish.
  // These five keep their ids (saves and quests name them) and the headline
  // catch of the mixed spots they used to be; the other species have spots of
  // their own (FISH_SPOTS below), and fishspots.js shares the world's spots out
  // between them, region by region.
  fishing_spot: {
    name: 'Anchovy shoal', label: 'Anchovy', type: 'fishing', verb: 'Net', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'net', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_anchovy', level: 1, xp: 10, weight: 1 }],
    examine: 'Tiny silver anchovies flicker in the shallows. Use a net here.',
  },
  rod_spot: {
    name: 'Trout pool', label: 'Trout', type: 'fishing', verb: 'Lure', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_trout', level: 20, xp: 50, weight: 1 }],
    examine: 'Cool, clear freshwater where trout rise to a lure. (Fishing 20)',
  },
  sea_rod_spot: {
    name: 'Red snapper run', label: 'Snapper', type: 'fishing', verb: 'Cast', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_red_snapper', level: 28, xp: 80, weight: 1 }],
    examine: 'Red snapper nose along the rocks. Cast a rod here. (Fishing 28)',
  },
  fishing_cage: {
    name: 'Lobster bed', label: 'Lobster', type: 'fishing', verb: 'Cage', emoji: '🦞', blocking: false,
    skill: 'fishing', tool: 'lobster_pot', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_lobster', level: 40, xp: 105, weight: 1 }],
    examine: 'Bubbles rise where lobsters lurk. Set a lobster pot. (Fishing 40)',
  },
  harpoon_spot: {
    name: 'Tuna shoal', label: 'Tuna', type: 'fishing', verb: 'Harpoon', emoji: '🦈', blocking: false,
    skill: 'fishing', tool: 'harpoon', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_tuna', level: 35, xp: 115, weight: 1 }],
    examine: 'Fat tuna boil the water out in the deep. Bring a harpoon. (Fishing 35)',
  },
  // ---- Endgame fishing spots (Fishing 100-300) ----
  // One fish each, cooked into that tier's dish (skilling.js COOKING). Every
  // cast catches, so XP an hour is just xp a cast: each tier gives about 35%
  // more than the one before, starting from the manta run, the best below
  // level 100 (tests/fish-cook.test.mjs times them). NODE_XP_TUNE below lifts each spot
  // to keep pace with the other gathering skills with the best tools to hand.
  // Each has its own picture (assets/world/).
  dorado_spot: {
    name: 'Dorado fishing spot', label: 'Dorado', type: 'fishing', verb: 'Cast', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_dorado', level: 100, xp: 184, weight: 1 }],
    examine: 'Flashes of gold and green chase bait round the islands. (Fishing 100)',
  },
  bluefin_spot: {
    name: 'Bluefin fishing spot', label: 'Bluefin', type: 'fishing', verb: 'Harpoon', emoji: '🦈', blocking: false,
    skill: 'fishing', tool: 'harpoon', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_bluefin_tuna', level: 130, xp: 249, weight: 1 }],
    examine: 'A school of giant bluefin boils the water off Changi. (Fishing 130)',
  },
  sailfish_spot: {
    name: 'Sailfish fishing spot', label: 'Sailfish', type: 'fishing', verb: 'Cast', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_sailfish', level: 160, xp: 337, weight: 1 }],
    examine: 'Deep blue water past the Sentosa reef. A sail cuts the surface. (Fishing 160)',
  },
  // Moonfish rise to the surface by moonlight: +25% Fishing XP at night
  // (game.isNight(); see NIGHT_TREE_BONUS), never a lock.
  moonfish_spot: {
    name: 'Moonfish fishing spot', label: 'Moonfish', type: 'fishing', verb: 'Net', emoji: '🎣', blocking: false,
    skill: 'fishing', tool: 'net', depleteChance: 0, respawn: 0, night: true,
    catches: [{ id: 'raw_moonfish', level: 200, xp: 455, weight: 1 }],
    examine: 'Round silver fish drift up the waterway when the moon is out. (Fishing 200)',
  },
  rift_eel_spot: {
    name: 'Rift eel fishing spot', label: 'Rift eel', type: 'fishing', verb: 'Cage', emoji: '🦞', blocking: false,
    skill: 'fishing', tool: 'lobster_pot', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_rift_eel', level: 250, xp: 615, weight: 1 }],
    examine: 'Something long and glowing coils in the haunted shallows. (Fishing 250)',
  },
  arowana_pool: {
    name: 'Arowana pool', label: 'Arowana', type: 'fishing', verb: 'Lure', emoji: '🐉', blocking: false,
    skill: 'fishing', tool: 'rod', depleteChance: 0, respawn: 0,
    catches: [{ id: 'raw_dragon_arowana', level: 300, xp: 831, weight: 1 }],
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
  offering_shrine: {
    name: 'Offering Shrine', type: 'offering', verb: 'Offer at', emoji: '⛩️', blocking: true,
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
  // Every obstacle has its own picture (assets/world/obj-<id>.webp).
  supertree_skyway_stairs: {
    name: 'Spiral stair', label: 'Stair', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 100, xp: 124, markChance: 0.08,
    examine: 'Up the spiral stair round a Supertree trunk. (Agility 100)',
  },
  supertree_skyway_bridge: {
    name: 'Skyway bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 100, xp: 124, markChance: 0.08,
    examine: 'A swaying walkway between the Supertrees. (Agility 100)',
  },
  supertree_skyway_vines: {
    name: 'Vine wall', label: 'Wall', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 100, xp: 124, markChance: 0.08,
    examine: 'Hand over hand up a wall of creepers. (Agility 100)',
  },
  supertree_skyway_zipline: {
    name: 'Supertree zip-line', label: 'Zip-line', type: 'agility', verb: 'Ride', emoji: '🏃', blocking: false,
    skill: 'agility', level: 100, xp: 124, markChance: 0.08,
    examine: 'Down from the canopy on a humming wire. (Agility 100)',
  },
  container_yard_run_stack: {
    name: 'Container stack', label: 'Stack', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08,
    examine: 'Up a cargo net on the side of a container stack. (Agility 130)',
  },
  container_yard_run_gap: {
    name: 'Container gap', label: 'Gap', type: 'agility', verb: 'Leap', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08,
    examine: 'A long jump between two stacks. (Agility 130)',
  },
  container_yard_run_crane: {
    name: 'Crane hook', label: 'Hook', type: 'agility', verb: 'Swing on', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08,
    examine: 'Swing across the yard on a crane hook. (Agility 130)',
  },
  container_yard_run_ropes: {
    name: 'Mooring ropes', label: 'Ropes', type: 'agility', verb: 'Balance on', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08,
    examine: 'Walk the thick mooring ropes above the quay. (Agility 130)',
  },
  container_yard_run_chute: {
    name: 'Cargo chute', label: 'Chute', type: 'agility', verb: 'Slide down', emoji: '🏃', blocking: false,
    skill: 'agility', level: 130, xp: 163, markChance: 0.08,
    examine: 'Down the cargo chute to the wharf. (Agility 130)',
  },
  canopy_course_rope_bridge: {
    name: 'Rope bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 160, xp: 247, markChance: 0.08,
    examine: 'A rope bridge strung between rainforest giants. (Agility 160)',
  },
  canopy_course_vine_swing: {
    name: 'Vine swing', label: 'Swing', type: 'agility', verb: 'Swing on', emoji: '🏃', blocking: false,
    skill: 'agility', level: 160, xp: 247, markChance: 0.08,
    examine: 'Swing on a liana across the creek. (Agility 160)',
  },
  canopy_course_treetop_walk: {
    name: 'Treetop walk', label: 'Walk', type: 'agility', verb: 'Edge across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 160, xp: 247, markChance: 0.08,
    examine: 'Along a mossy branch high above the forest floor. (Agility 160)',
  },
  canopy_course_log_slide: {
    name: 'Log slide', label: 'Slide', type: 'agility', verb: 'Slide down', emoji: '🏃', blocking: false,
    skill: 'agility', level: 160, xp: 247, markChance: 0.08,
    examine: 'Down a fallen trunk to the ground. (Agility 160)',
  },
  cloud_steps_ledge: {
    name: 'Cliff ledge', label: 'Ledge', type: 'agility', verb: 'Edge across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08,
    examine: 'A ledge no wider than your foot, above the clouds. (Agility 200)',
  },
  cloud_steps_stepping_stones: {
    name: 'Floating stones', label: 'Stones', type: 'agility', verb: 'Hop across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08,
    examine: 'Stones that hang in the air. Do not look down. (Agility 200)',
  },
  cloud_steps_rock_climb: {
    name: 'Rock face', label: 'Face', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08,
    examine: 'A sheer face with a few good holds. (Agility 200)',
  },
  cloud_steps_cloud_bridge: {
    name: 'Cloud bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08,
    examine: 'A bridge of mist that holds your weight, mostly. (Agility 200)',
  },
  cloud_steps_glide: {
    name: 'Glide wire', label: 'Wire', type: 'agility', verb: 'Ride', emoji: '🏃', blocking: false,
    skill: 'agility', level: 200, xp: 317, markChance: 0.08,
    examine: 'A wire down the mountainside. (Agility 200)',
  },
  wraith_run_gravestones: {
    name: 'Gravestone hop', label: 'Hop', type: 'agility', verb: 'Hop across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 250, xp: 461, markChance: 0.08,
    examine: 'Leap from headstone to headstone. Mind the residents. (Agility 250)',
  },
  wraith_run_broken_pier: {
    name: 'Broken pier', label: 'Pier', type: 'agility', verb: 'Edge across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 250, xp: 461, markChance: 0.08,
    examine: 'What is left of the old jetty. (Agility 250)',
  },
  wraith_run_lantern_swing: {
    name: 'Lantern swing', label: 'Swing', type: 'agility', verb: 'Swing on', emoji: '🏃', blocking: false,
    skill: 'agility', level: 250, xp: 461, markChance: 0.08,
    examine: 'Swing on a rope hung with spirit lanterns. (Agility 250)',
  },
  wraith_run_ghost_bridge: {
    name: 'Ghost bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 250, xp: 461, markChance: 0.08,
    examine: 'A bridge that is only there when you believe in it. (Agility 250)',
  },
  rift_leap_chasm: {
    name: 'Chasm leap', label: 'Leap', type: 'agility', verb: 'Leap', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08,
    examine: 'A jump across a crack in the world. (Agility 300)',
  },
  rift_leap_floating_rocks: {
    name: 'Floating rocks', label: 'Rocks', type: 'agility', verb: 'Hop across', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08,
    examine: 'Rocks drifting over the void. (Agility 300)',
  },
  rift_leap_chain_climb: {
    name: 'Chain climb', label: 'Climb', type: 'agility', verb: 'Climb', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08,
    examine: 'Up a great chain that anchors the Rift. (Agility 300)',
  },
  rift_leap_void_bridge: {
    name: 'Void bridge', label: 'Bridge', type: 'agility', verb: 'Cross', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08,
    examine: 'A bridge of dark light. (Agility 300)',
  },
  rift_leap_portal_dive: {
    name: 'Portal dive', label: 'Dive', type: 'agility', verb: 'Dive into', emoji: '🏃', blocking: false,
    skill: 'agility', level: 300, xp: 577, markChance: 0.08,
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
  // hour, at its own level, than the best Thieving before it. Each has its own
  // picture (assets/world/).
  temple_vault: {
    name: 'Temple vault', label: 'Vault', type: 'stall', verb: 'Crack', emoji: '🧰', blocking: true,
    skill: 'thieving', level: 160, xp: 2450, respawn: 10, sure: 0.8,
    examine: 'A stone vault in the old temple, its lock worn smooth. (Thieving 160)',
    loot: [
      { id: 'coins', min: 500, max: 1500, weight: 66 },
      { id: 'sapphire', weight: 10 }, { id: 'emerald', weight: 8 }, { id: 'ruby', weight: 6 }, { id: 'diamond', weight: 4 },
      { id: 'refine_scroll', min: 1, max: 2, weight: 6 },
    ],
  },
  observatory_chest: {
    name: 'Observatory chest', label: 'Chest', type: 'stall', verb: 'Crack', emoji: '🧰', blocking: true,
    skill: 'thieving', level: 200, xp: 3610, respawn: 10, sure: 0.8,
    examine: 'A star-chart chest in the mountain observatory. (Thieving 200)',
    loot: [
      { id: 'coins', min: 800, max: 2000, weight: 66 },
      { id: 'ruby', weight: 10 }, { id: 'diamond', weight: 8 }, { id: 'emerald', weight: 10 },
      { id: 'starmetal_ore', weight: 6 },
    ],
  },
  smugglers_hold: {
    name: "Smugglers' hold", label: 'Hold', type: 'stall', verb: 'Crack', emoji: '🧰', blocking: true,
    skill: 'thieving', level: 250, xp: 5350, respawn: 10, sure: 0.8,
    examine: 'A false-bottomed crate of contraband on the wharf. (Thieving 250)',
    loot: [
      { id: 'coins', min: 1000, max: 3000, weight: 70 },
      { id: 'upgrade_stone', min: 2, max: 5, weight: 26 },
      { id: 'upgrade_ward', weight: 4 },
    ],
  },
  rift_treasury: {
    name: 'Rift treasury', label: 'Treasury', type: 'stall', verb: 'Crack', emoji: '🧰', blocking: true,
    skill: 'thieving', level: 300, xp: 7800, respawn: 10, sure: 0.8,
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

  // ---------------- The Endless Gate (waves.js) ----------------
  // The way into the wave dungeon and the portal back out, each with its own picture.
  wave_gate: {
    name: 'The Endless Gate', label: 'Gate', type: 'gate', verb: 'Enter', emoji: '🌀', blocking: true,
    examine: 'An ancient arch humming with violet light. Beyond it, monsters come in endless waves.',
  },
  wave_exit: {
    name: 'Exit portal', label: 'Portal', type: 'gate', verb: 'Leave by', emoji: '🌀', blocking: true,
    examine: 'The way back out, to where you came in.',
  },
  // The heart of a run: the waves come for it, and the run ends when it falls.
  // It wears the A-Worthy Monument's picture; it isn't a place to pray.
  gate_shrine: {
    name: 'A-Worthy Shrine', label: 'Shrine', type: 'gate_shrine', art: 'obj-shrine', emoji: '⛩️', blocking: true,
    examine: 'The A-Worthy Shrine. The monsters of the gate want it broken; hold them off for as long as you can.',
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

  // ---------------- Kampong home (home.js) ----------------
  // Each has its own picture (assets/world/); `homeTab` is the panel each opens.
  home_plot: { name: 'Kampong plot', label: 'Home', type: 'home', homeTab: 'plot', verb: 'Visit', emoji: '🏡', blocking: false, examine: 'A plot of land in Kranji. Buy it and make it your kampong home.' },
  home_chest: { name: 'Storage chest', label: 'Chest', type: 'home', homeTab: 'chest', verb: 'Open', emoji: '🧰', blocking: true, examine: 'Your own storage chest. Only you have the key.' },
  home_trophy: { name: 'Trophy wall', label: 'Trophies', type: 'home', homeTab: 'trophy', verb: 'Admire', emoji: '🏆', blocking: true, examine: 'Your boss kills and rare finds, on show.' },
};

// ---------------- Landmarks and set dressing (landmarks.js places them) ----------------
// Painted set pieces that make each region recognisable. A landmark covers a
// `footprint` of [wide, deep] tiles, standing on its front-left tile, and
// blocks all of it (World.addObject); `artScale` is how much wider than its
// footprint its picture is drawn (sprites.js). Props (`prop`) are one tile, like a lamp.
// The laundry pole and five-foot-way lantern are animated (`frames`, one every
// `frameMs`), like a campfire; the lantern hangs `overhead`, so you walk under it.
const LANDMARKS = {
  shophouse_row_mint: [[3, 2], 'Shophouse row', 'Mint-green shophouses with teal shutters over a shady five-foot way.'],
  shophouse_row_peach: [[3, 2], 'Shophouse row', 'Peach and coral shophouses, their shutters thrown open to the street.'],
  shophouse_row_butter: [[3, 2], 'Shophouse row', 'Butter-yellow shophouses with red lanterns under the arches.'],
  shophouse_row_lilac: [[3, 2], 'Shophouse row', 'Lilac shophouses; a songbird chirps in a cage by the door.'],
  golden_dome_hall: [[4, 4], 'Golden-domed hall', 'A grand old hall under a gleaming golden dome, palms either side.'],
  hdb_block: [[4, 2], 'HDB block', 'A cheerful block of flats, laundry poles sticking out of every window.'],
  dragon_playground: [[3, 2], 'Dragon playground', 'A mosaic dragon with a slide for a tongue. Every kid in town has climbed it.'],
  hawker_centre: [[4, 3], 'Hawker centre', 'Fans whirring, woks clanging and the smell of a hundred dinners.'],
  chinese_temple: [[3, 3], 'Clan temple', 'Green roof tiles, little ceramic dragons and the drift of incense.'],
  wet_market: [[4, 3], 'Wet market', 'Fish on ice, greens in baskets and a floor that is never quite dry.'],
  lionfish_fountain: [[3, 3], 'Lion-fish fountain', 'Half lion, half fish, and very pleased to spout water at the bay.', 1.05],
  spiky_dome_theatre: [[4, 3], 'Spiky-domed theatre', 'A theatre under two spiky domes. Locals argue about which fruit it looks like.'],
  observation_wheel: [[4, 2], 'Observation wheel', 'A giant wheel turning slowly over the bay.', 1.05],
  flower_dome: [[4, 3], 'Flower dome', 'A great glasshouse full of flowers from cooler lands.'],
  supertree_tall: [[2, 2], 'Supertree', 'A towering tree of steel, wrapped in ferns and orchids.', 1.45],
  supertree_short: [[2, 2], 'Supertree', 'A young Supertree, its canopy strung with little lights.', 1.3],
  kelong: [[4, 3], 'Kelong', 'A fishing platform on stilts. Its net comes up full of silver every morning.'],
  lifeguard_tower: [[2, 2], 'Lifeguard tower', 'The flag is flying, so the sea is safe to swim today.', 1.25],
  lighthouse: [[2, 2], 'Lighthouse', 'Its lamp has guided boats past the islands for a hundred years.', 1.35],
  kusu_turtle_temple: [[3, 3], 'Turtle temple', 'A little island temple by a pond of sleepy turtles.'],
  stilt_house: [[3, 3], 'Kampong stilt house', 'A wooden house up on stilts, chickens pecking underneath.'],
  treetop_bridge: [[4, 2], 'Treetop bridge', 'A swaying rope bridge strung between two lookout towers.'],
  gantry_crane: [[3, 3], 'Gantry crane', 'A port crane on rails, lifting a container high over the wharf.', 1.15],
  temasek_gate: [[4, 2], 'Temasek gate', 'A crumbling stone gate carved with lions, older than anyone can say.'],
  kranji_farmhouse: [[3, 2], 'Kranji farmhouse', 'A farmhouse with a water tower, a vegetable patch and a goat.'],
  punggol_footbridge: [[4, 2], 'Waterway footbridge', 'A graceful arched footbridge over the waterway.'],
  celestial_pavilion: [[3, 3], 'Cloud-top pavilion', 'A pavilion on a cloud, waterfalls spilling off its edges.', 1.15],
  rift_obelisk: [[2, 2], 'Rift obelisk', 'A shard of the void, bound in chains that hum when you come near.', 1.3],
};
const PROPS = {
  kopitiam_table: ['Kopitiam table', 'A marble-topped table with kopi and kaya toast.'],
  kopitiam_stool: ['Kopitiam stools', 'A plastic stool and a wooden one. Everyone has a favourite.'],
  hawker_stall_noodle: ['Noodle stall', 'A pot of broth bubbling away under a striped awning.'],
  hawker_stall_satay: ['Satay cart', 'Skewers sizzling over the coals.'],
  hawker_stall_drinks: ['Drinks stall', 'Jars of bright cold drinks, ice clinking.'],
  hawker_stall_fruit: ['Fruit stall', 'Durians, mangosteens and pineapples, piled high.'],
  void_deck_bench: ['Void-deck bench', 'A stone table with a draughts board, and curved seats round it.'],
  heritage_lamp: ['Heritage lamp', 'An old cast-iron street lamp.'],
  signboard: ['Shop signboard', 'A hanging red signboard. The paint has worn smooth.'],
  trishaw: ['Trishaw', 'A flowery trishaw, waiting for its next passenger.'],
  bougainvillea_pot: ['Bougainvillea', 'A blue and white pot bursting with magenta flowers.'],
  dragon_jar: ['Dragon jar', 'A big glazed water jar with a golden dragon curling round it.'],
  push_cart: ['Ice-cream cart', 'Ice cream between wafers, or in bread. Both are correct.'],
  letterbox_bank: ['Letterboxes', 'A bank of green letterboxes for the block.'],
  rattan_chair: ['Rattan chair', 'A comfy rattan chair with a flowery cushion.'],
  bicycle: ['Bicycle', 'A green bicycle with a basket of flowers.'],
  incense_urn: ['Incense urn', 'Three joss sticks smoulder in a bronze urn.'],
  roadside_shrine: ['Roadside shrine', 'A little red shrine with a candle and an orange left as an offering.'],
  stone_lion: ['Stone lion', 'A stone guardian lion, one paw on a ball.'],
  lantern_post: ['Lantern post', 'Red lanterns swinging from a wooden post.'],
  fish_stall: ['Fish stall', 'The catch of the day on crushed ice.'],
  vegetable_crates: ['Vegetable crates', 'Crates of greens, chillies and bananas.'],
  rice_sacks: ['Rice sacks', 'Sacks of rice stacked on a pallet.'],
  dried_goods: ['Dried goods', 'Baskets of dried mushrooms, shrimp and anchovies.'],
  promenade_rail: ['Promenade railing', 'A glass railing along the water.'],
  promenade_rail_corner: ['Promenade railing', 'A glass railing turns the corner here.'],
  bay_bench: ['Bench', 'A wooden bench with a view of the water.'],
  bollard_light: ['Bollard light', 'A little light to keep you off the edge after dark.'],
  planter_box: ['Planter', 'A frangipani in a stone planter.'],
  orchid_planter: ['Orchid planter', 'A bed of purple and pink orchids.'],
  topiary: ['Topiary bird', 'A hedge clipped into a very round bird.'],
  fountain_small: ['Fountain', 'A little fountain bubbling in a stone basin.'],
  beach_umbrella_red: ['Beach umbrella', 'A red and white umbrella over a beach towel.'],
  beach_umbrella_teal: ['Beach umbrella', 'A teal and yellow umbrella over a cool box.'],
  deck_chair: ['Deck chair', 'A striped deck chair, warm from the sun.'],
  leaning_palm: ['Coconut palm', 'A coconut palm leaning out over the sand. Mind your head.'],
  surf_rack: ['Surfboard rack', 'Three bright surfboards in a rack.'],
  sampan: ['Sampan', 'A little wooden boat with a woven canopy and an eye painted on the bow.'],
  kelong_net: ['Drying net', 'A fishing net hung up to dry between two poles.'],
  kelong_stilts: ['Kelong stilts', 'Rope-bound stilts, all that is left of an old kelong.'],
  buoy_pile: ['Buoys', 'A heap of floats and a coil of rope.'],
  crab_trap: ['Crab trap', 'A woven trap. Someone is home.'],
  boardwalk: ['Boardwalk', 'Planks out over the water.'],
  boardwalk_corner: ['Boardwalk', 'The boardwalk turns here.'],
  trail_signpost: ['Trail signpost', 'Signs to the summit, the stream and the valley.'],
  trail_marker: ['Trail marker', 'A painted post that marks the trail.'],
  fallen_log: ['Fallen log', 'A mossy log, mushrooms sprouting along it.'],
  bird_hide: ['Bird hide', 'A wooden hide with a slot to watch the birds through.'],
  hay_bale: ['Hay bale', 'A round bale of golden hay.'],
  water_trough: ['Water trough', 'A stone trough with a tap, for the goats.'],
  durian_cart: ['Durian cart', 'A cart of durians. You can smell it from here.'],
  fish_rack: ['Fish rack', 'Fish drying in the sun on a bamboo rack.'],
  oil_drums: ['Oil drums', 'Rusty drums stacked on the wharf.'],
  mooring_bollard: ['Mooring bollard', 'An iron bollard with a heavy rope round it.'],
  broken_pillar: ['Broken pillar', 'A carved pillar, broken off and wrapped in vines.'],
  lion_stone: ['Lion stone', 'A boulder carved with a weathered lion.'],
  prayer_flags: ['Prayer flags', 'Coloured flags snapping in the mountain wind.'],
  cloud_lantern: ['Cloud lantern', 'A jade lantern that glows softly in the mist.'],
  rift_crystal: ['Rift crystal', 'A violet crystal, cold to the touch.'],
  void_brazier: ['Void brazier', 'It burns with a purple fire that gives no heat.'],
  ghost_lantern: ['Ghost lantern', 'A pale lantern on a crooked post. Nobody lit it.'],
  offering_table: ['Offering table', 'Oranges, rice and incense, left for the island\'s spirits.'],
  sandbag_wall: ['Sandbags', 'A low wall of sandbags from some old drill.'],
  rusty_tank: ['Water tank', 'A rusty water tank on stilts.'],
};
for (const [id, [footprint, name, examine, artScale]] of Object.entries(LANDMARKS)) {
  OBJECTS[id] = { name, type: 'scenery', emoji: '🏛️', blocking: true, footprint, ...(artScale ? { artScale } : {}), examine };
}
for (const [id, [name, examine]] of Object.entries(PROPS)) OBJECTS[id] = { name, type: 'scenery', emoji: '🪴', blocking: true, prop: true, examine };
OBJECTS.laundry_pole = { name: 'Laundry pole', type: 'scenery', emoji: '👕', blocking: true, frames: 4, frameMs: 240, examine: 'Washing flapping in the breeze.' };
OBJECTS.five_foot_lantern = { name: 'Lantern', type: 'scenery', emoji: '🏮', blocking: false, overhead: true, frames: 4, frameMs: 320, examine: 'A red lantern swaying over the five-foot way.' };

// Hunter traps and trails (definitions in trades.js).
for (const [id, h] of Object.entries(HUNT)) {
  OBJECTS[id] = { ...h, label: h.name.split(' ')[0], type: 'hunt', verb: 'Check', emoji: '🪤', blocking: false, skill: 'hunter',
    examine: `${h.examine} (Hunter ${h.level})` };
}

// Fishing spots with one species each (see the Fishing block above). Each kind
// borrows the picture of the old mixed spot it was carved from: a net, rod,
// coastal rod, cage or harpoon spot. [id, name, label, fish, level, xp, examine]
const FISH_SPOT_KINDS = {
  net: { verb: 'Net', emoji: '🎣', tool: 'net', art: 'obj-fishing_spot' },
  pool: { verb: 'Lure', emoji: '🎣', tool: 'rod', art: 'obj-rod_spot' },
  coast: { verb: 'Cast', emoji: '🎣', tool: 'rod', art: 'obj-sea_rod_spot' },
  cage: { verb: 'Cage', emoji: '🦞', tool: 'lobster_pot', art: 'obj-fishing_cage' },
  harpoon: { verb: 'Harpoon', emoji: '🦈', tool: 'harpoon', art: 'obj-harpoon_spot' },
};
export const FISH_SPOTS = {
  net: [
    ['sardine_spot', 'Sardine shoal', 'Sardine', 'raw_sardine', 5, 20, 'A glittering ball of sardines turns in the shallows.'],
    ['mackerel_spot', 'Mackerel shoal', 'Mackerel', 'raw_mackerel', 16, 45, 'Striped mackerel dart after the bait fish.'],
    ['salmon_spot', 'Salmon run', 'Salmon', 'raw_salmon', 30, 70, 'Pink-flanked salmon shoulder up the current.'],
  ],
  pool: [
    ['tilapia_spot', 'Tilapia pool', 'Tilapia', 'raw_tilapia', 12, 38, 'A warm, weedy pool. Tilapia nibble at anything.'],
    ['perch_spot', 'Climbing perch pool', 'Perch', 'raw_climbing_perch', 15, 48, 'Hardy little puyu hide in the reeds.'],
    ['keli_spot', 'Ikan keli pool', 'Keli', 'raw_ikan_keli', 18, 52, 'Whiskers stir the mud: catfish feed down there.'],
    ['goby_spot', 'Marble goby pool', 'Goby', 'raw_marble_goby', 24, 70, 'A dark, still pool where marble goby lie in wait.'],
    ['pike_spot', 'Pike pool', 'Pike', 'raw_pike', 25, 60, 'A long shadow waits among the weeds.'],
    ['peacock_bass_spot', 'Peacock bass pool', 'Bass', 'raw_peacock_bass', 32, 80, 'Peacock bass flash green and gold in the open water.'],
    ['belida_spot', 'Belida pool', 'Belida', 'raw_belida', 35, 95, 'Belida knifefish glide just under the surface.'],
    ['eel_spot', 'Eel pool', 'Eel', 'raw_eel', 38, 85, 'Something long and slippery winds through the roots.'],
    ['temensis_spot', 'Speckled temensis pool', 'Temensis', 'raw_speckled_temensis', 45, 110, 'Big speckled temensis hunt along the bank.'],
    ['snakehead_spot', 'Giant snakehead pool', 'Snakehead', 'raw_giant_snakehead', 55, 130, 'A giant snakehead guards its patch of the pool.'],
    ['arapaima_spot', 'Arapaima pool', 'Arapaima', 'raw_arapaima', 70, 185, 'A huge red-tailed arapaima rolls to gulp air.'],
    ['asian_arowana_spot', 'Asian arowana pool', 'Arowana', 'raw_arowana', 80, 240, 'A prized Asian arowana patrols the clear, cold water.'],
  ],
  coast: [
    ['milkfish_spot', 'Milkfish run', 'Milkfish', 'raw_milkfish', 30, 86, 'Silver milkfish graze along the brackish edge.'],
    ['barramundi_spot', 'Barramundi run', 'Barramundi', 'raw_barramundi', 30, 88, 'Barramundi lurk where the mangrove roots meet the tide.'],
    ['mangrove_jack_spot', 'Mangrove jack run', 'Jack', 'raw_mangrove_jack', 34, 92, 'Mangrove jacks strike from the shade of the roots.'],
    ['queenfish_spot', 'Queenfish run', 'Queenfish', 'raw_queenfish', 36, 96, 'Queenfish leap after the bait in the bay.'],
    ['red_drum_spot', 'Red drum run', 'Drum', 'raw_red_drum', 38, 100, 'Red drum grunt and tail over the sandy bottom.'],
    ['golden_snapper_spot', 'Golden snapper run', 'Golden', 'raw_golden_snapper', 40, 105, 'Golden snapper school round the old pier posts.'],
    ['threadfin_spot', 'Threadfin run', 'Threadfin', 'raw_threadfin', 42, 112, 'Threadfin trail their long fins through the murky shallows.'],
    ['pomfret_spot', 'White pomfret run', 'Pomfret', 'raw_white_pomfret', 46, 120, 'Flat white pomfret drift by like silver plates.'],
    ['tenggiri_spot', 'Tenggiri run', 'Tenggiri', 'raw_tenggiri', 48, 120, 'Fast tenggiri slice through the open water.'],
    ['longfin_spot', 'Longfin trevally run', 'Longfin', 'raw_longfin_trevally', 50, 125, 'Longfin trevally chase each other round the reef.'],
    ['coral_trout_spot', 'Coral trout run', 'Coral', 'raw_coral_trout', 52, 135, 'Spotted coral trout hide in the reef.'],
    ['diamond_trevally_spot', 'Diamond trevally run', 'Diamond', 'raw_diamond_trevally', 58, 150, 'Diamond trevally glint like cut glass.'],
    ['cobia_spot', 'Cobia run', 'Cobia', 'raw_cobia', 60, 155, 'A dark cobia shadows the drifting weed.'],
    ['hybrid_grouper_spot', 'Hybrid grouper run', 'Hybrid', 'raw_hybrid_grouper', 62, 160, 'Fat hybrid groupers sulk under the wharf.'],
    ['giant_trevally_spot', 'Giant trevally run', 'GT', 'raw_giant_trevally', 65, 165, 'Giant trevally smash the surface. Hold on tight.'],
  ],
  cage: [
    ['grouper_spot', 'Grouper reef', 'Grouper', 'raw_grouper', 55, 135, 'Groupers lurk in the reef. Set a lobster pot.'],
  ],
  harpoon: [
    ['swordfish_spot', 'Swordfish run', 'Swordfish', 'raw_swordfish', 50, 150, 'A swordfish bill slashes through the swell.'],
    ['stingray_spot', 'Stingray flats', 'Stingray', 'raw_stingray', 68, 290, 'Wide wings ripple over the sandy flats.'],
    ['shark_spot', 'Shark run', 'Shark', 'raw_shark', 76, 300, 'A grey fin circles in the deep water.'],
    ['manta_spot', 'Manta run', 'Manta', 'raw_manta_ray', 84, 320, 'Manta rays wheel slowly through the blue.'],
  ],
};
for (const [kind, list] of Object.entries(FISH_SPOTS)) {
  const k = FISH_SPOT_KINDS[kind];
  for (const [id, name, label, fish, level, xp, examine] of list) {
    OBJECTS[id] = { name, label, type: 'fishing', verb: k.verb, emoji: k.emoji, blocking: false, art: k.art,
      skill: 'fishing', tool: k.tool, depleteChance: 0, respawn: 0,
      catches: [{ id: fish, level, xp, weight: 1 }], examine: `${examine} (Fishing ${level})` };
  }
}

// XP audit (Nov 2026): XP an hour at each node, at its own level, by auto gather.
// Mining paid about a sixth of Woodcutting or Fishing at the same level, so every
// rock pays MINING_XP_MULT times its listed XP; and a few nodes paid less than the
// tier below them, so each is lifted until every tier pays at least ~10% more an
// hour than the one before it (the factors are measured, not guessed).
export const MINING_XP_MULT = 4;
// Gathering parity (Nov 2026): by then Mining paid 2-4x Woodcutting and 3-11x
// Hunter an hour (auto gather, the best tool for the level), and the owner chose
// to bring the others up to Mining rather than cut it. Each skill's nodes pay
// GATHER_XP_MULT times their listed XP, then NODE_XP_TUNE fits each node to its
// level band, so the best node of every gathering skill pays about what the best
// rock does at that level (measured at 10, 30, 60, 99, 150, 250 and 400; Fishing
// about a quarter more) and each node still out-earns the one below it at its own
// unlock level. Firemaking, Fletching and Cooking XP have their own tables, so are
// unchanged. (tests/fishing-balance.test.mjs keeps the four in step.)
export const GATHER_XP_MULT = { mining: MINING_XP_MULT, woodcutting: 2.2, hunter: 4, fishing: 2.3 };
export const NODE_XP_TUNE = {
  clay_rock: 1.4, limestone_rock: 1.07, silver_rock: 1.06,  // level 1-20 rocks in order
  gold_rock: 2.12, gem_rock: 2.32,                          // were below sandstone (lvl 35)
  // Rocks now hold 10-20 ores each (skilling.js ROCK_ORES), so XP an hour follows
  // XP a swing, not the walk between rocks: the mining ladder was re-measured and
  // set so each tier still pays more an hour than the one below it (runite had
  // jumped past the level 100+ rocks).
  adamantite_rock: 1.02, runite_rock: 0.77, obsidian_vein: 2.4,
  orichalcum_rock: 2.25, jade_seam: 2.75, fallen_star: 2.5, skyglass_crystal: 3.1, eternal_lode: 3.0,
  // Woodcutting: the level 40-59 trees most, as the gold and gem rocks open at 40.
  // (Measured with each tree holding 10-20 logs, skilling.js TREE_LOGS, at the
  // densest stand of each tree: its grove, groves.js, where it has one.)
  tree: 1.34, bamboo: 1.72, oak: 1.76, angsana: 1.34, willow: 1.2, teak: 1.18, mangrove: 1.96, rain_tree: 2.03,
  mahogany: 1.79, yew_tree: 1.32, tembusu: 1.16, magic_tree: 1.16,
  seraya_tree: 1.05, meranti_tree: 1.03, chengal_tree: 1.09, starfall_banyan: 1.1, moonlit_kapok: 1.16, keramat_tree: 1.16,
  // Hunter: the far-apart older traps are mostly walking, the endgame grounds are
  // capped by their slow resets, so each needs its own lift.
  bird_snare: 1.15, squirrel_trap: 1, lizard_snare: 0.8, mousedeer_trail: 1.75, boar_pit: 1.46, python_trap: 2.17,
  crocodile_trap: 2.55, pangolin_burrow: 2.01, hornbill_nest: 1.75, colugo_trap: 2.12, tiger_trail: 2.26,
  qilin_trail: 2.63, garuda_nest: 2.23, naga_track: 2.75, phoenix_roost: 2.6,
  // Fishing: about 1.25x the others (the owner's call: it levelled too slowly). A
  // spot's factor lifts its catch. Since each spot holds one fish (Nov 2026) the
  // factors are set so each spot pays a little more an hour than every spot below
  // it, at its own unlock level and with the best rod or harpoon for that level
  // (the net and lobster pot have no better tiers), while the best spot at each
  // level pays what the old mixed spots did (tests/fish-spots.test.mjs).
  fishing_spot: 3.55, sardine_spot: 2.5, tilapia_spot: 1.545, perch_spot: 1.366, mackerel_spot: 1.581, keli_spot: 1.339,
  rod_spot: 1.455, goby_spot: 1.063, pike_spot: 1.28, sea_rod_spot: 1, salmon_spot: 1.394, milkfish_spot: 0.978,
  barramundi_spot: 0.956, peacock_bass_spot: 1.053, mangrove_jack_spot: 0.932, belida_spot: 1.392, harpoon_spot: 1.15,
  queenfish_spot: 1.381, eel_spot: 1.565, red_drum_spot: 1.331, fishing_cage: 2.1, golden_snapper_spot: 1.81,
  threadfin_spot: 1.702, temensis_spot: 1.737, pomfret_spot: 1.596, tenggiri_spot: 1.599, longfin_spot: 1.539,
  swordfish_spot: 1.283, coral_trout_spot: 1.432, snakehead_spot: 1.493, grouper_spot: 1.783, diamond_trevally_spot: 1.299,
  cobia_spot: 1.261, hybrid_grouper_spot: 1.227, giant_trevally_spot: 1.195, stingray_spot: 0.683, arapaima_spot: 1.075,
  shark_spot: 0.685, asian_arowana_spot: 0.86, manta_spot: 0.679,
  dorado_spot: 1.52, bluefin_spot: 1.5, sailfish_spot: 1.47, moonfish_spot: 2.65, rift_eel_spot: 2.7, arowana_pool: 1.22,
};
// (Mithril, adamantite and obsidian dip below the rock before them only at their own
// unlock level, where the success chance is low; at the same level they rank in
// order, so they're left alone.)
for (const [id, o] of Object.entries(OBJECTS)) {
  const skillMult = GATHER_XP_MULT[o.skill] || 1, tune = NODE_XP_TUNE[id] || 1;
  // A fishing spot pays by its catches, so its factors lift each catch.
  if (o.catches) for (const c of o.catches) c.xp = Math.round(c.xp * skillMult * tune);
  if (typeof o.xp !== 'number') continue;
  if (skillMult !== 1) o.xp = Math.round(o.xp * skillMult * 10) / 10;
  if (tune !== 1) o.xp = Math.round(o.xp * tune * 10) / 10;
}

export function getObject(id) {
  const obj = OBJECTS[id];
  if (!obj) throw new Error(`Unknown object id: ${id}`);
  return obj;
}
