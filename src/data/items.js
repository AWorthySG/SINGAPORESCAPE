// Item registry. Every item the game knows about lives here.
//
// Fields:
//   name       display name
//   icon       emoji used as the item sprite
//   examine    flavour text (right-click -> Examine)
//   value      base shop value in coins
//   stackable  true for currency / arrows-style items
//   heal       hitpoints restored when eaten (makes it edible)
//   tool       gathering/crafting tool tag ('axe','pickaxe','net','tinderbox','hammer')
//   equip      { slot, req?, bonuses?: {attack,strength,defence,speed} }
//   tags       misc tags (e.g. 'log' for firemaking, 'raw' for cooking)

import { CROPS, POTIONS } from './trades.js';
import { signatureWeapons } from './bossWeapons.js';
import { TOOL_KINDS, TOOL_TIERS, toolId, toolBonusText } from './tooltiers.js';

import { aOrAn, AOrAn } from '../core/utils.js';
const RAW = {
  // ---- Currency ----
  coins: { name: 'Coins', icon: '🪙', value: 1, stackable: true, maxStack: Infinity, examine: 'Lovely money!' },
  // Enchanting (see mastery.js): stones pay for an enchant, a ward rerolls the three lines on offer.
  upgrade_stone: { name: 'Upgrade stone', icon: '💎', value: 150, stackable: true, examine: 'A dense, glittering stone. Enchanters use it to weave bonus powers into gear.' },
  upgrade_ward: { name: 'Upgrade ward', icon: '📜', value: 2500, stackable: true, examine: 'A blessed scroll. When enchanting, it crumbles to reroll the three enchantments on offer.' },
  // Refining (see refine.js): scrolls are the only way to pay for a refine attempt.
  refine_scroll: { name: 'Refine scroll', icon: '📘', value: 1200, stackable: true, examine: 'A shimmering scroll of smith-lore. The only way to refine gear from ★1 to ★15.' },

  // ---- Tools ----
  bronze_axe: { name: 'Bronze axe', icon: '🪓', value: 16, tool: 'axe',
    examine: 'A woodcutter\'s axe.', equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 2, strength: 3, speed: 5 } } },
  bronze_pickaxe: { name: 'Bronze pickaxe', icon: '⛏️', value: 16, tool: 'pickaxe',
    examine: 'Used for mining.', equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 2, strength: 2, speed: 5 } } },
  small_net: { name: 'Small fishing net', icon: '🕸️', value: 5, tool: 'net', examine: 'Useful for catching small fish.' },
  tinderbox: { name: 'Tinderbox', icon: '🧰', value: 1, tool: 'tinderbox', examine: 'Useful for lighting fires.' },
  hammer: { name: 'Hammer', icon: '🔨', value: 1, tool: 'hammer', examine: 'Good for smithing.' },

  // ---- Woodcutting ----
  logs: { name: 'Logs', icon: '🪵', value: 4, tags: ['log'], firemaking: 1, fmXp: 40, examine: 'A bundle of logs.' },
  oak_logs: { name: 'Oak logs', icon: '🪵', value: 12, tags: ['log'], firemaking: 15, fmXp: 60, examine: 'Logs cut from an oak tree.' },
  willow_logs: { name: 'Willow logs', icon: '🪵', value: 20, tags: ['log'], firemaking: 30, fmXp: 90, examine: 'Logs cut from a willow tree.' },

  // ---- Mining / Smithing ore & bars ----
  copper_ore: { name: 'Copper ore', icon: '🟤', value: 3, examine: 'This needs refining.' },
  tin_ore: { name: 'Tin ore', icon: '⚪', value: 3, examine: 'This needs refining.' },
  iron_ore: { name: 'Iron ore', icon: '🔘', value: 17, examine: 'This needs refining.' },
  coal: { name: 'Coal', icon: '⬛', value: 45, examine: 'A lump of coal.' },
  bronze_bar: { name: 'Bronze bar', icon: '🟫', value: 30, examine: 'A bar of bronze.' },
  iron_bar: { name: 'Iron bar', icon: '⬜', value: 80, examine: 'A bar of iron.' },

  // ---- Fishing / Cooking ----
  raw_anchovy: { name: 'Raw anchovy', icon: '🐟', value: 6, tags: ['raw'], examine: 'I should cook this first.' },
  raw_sardine: { name: 'Raw sardine', icon: '🐟', value: 8, tags: ['raw'], examine: 'I should cook this first.' },
  raw_trout: { name: 'Raw trout', icon: '🐠', value: 20, tags: ['raw'], examine: 'I should cook this first.' },
  anchovy: { name: 'Grilled anchovy', icon: '🍤', value: 12, heal: 1, examine: 'Crispy ikan bilis.' },
  sardine: { name: 'Grilled sardine', icon: '🍢', value: 16, heal: 4, examine: 'A grilled sardine.' },
  trout: { name: 'Grilled trout', icon: '🍣', value: 30, heal: 7, examine: 'A nicely grilled trout.' },
  burnt_fish: { name: 'Burnt fish', icon: '🪨', value: 1, examine: 'Oops. Charcoal for dinner.' },

  // ---- Shop food (Singapore hawker fare) ----
  kaya_toast: { name: 'Kaya toast', icon: '🍞', value: 8, heal: 3, examine: 'Toast with kaya and butter.' },
  chicken_rice: { name: 'Chicken rice', icon: '🍚', value: 30, heal: 9, examine: 'Hainanese chicken rice. Shiok!' },
  roti_prata: { name: 'Roti prata', icon: '🫓', value: 18, heal: 6, examine: 'Crispy roti prata with curry.' },

  // ---- Weapons ----
  bronze_dagger: { name: 'Bronze dagger', icon: '🗡️', value: 10, examine: 'A vicious-looking dagger.',
    equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 4, strength: 3, speed: 4 } } },
  bronze_sword: { name: 'Bronze sword', icon: '🗡️', value: 26, examine: 'A bronze sword.',
    equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 5, strength: 5, speed: 5 } } },
  bronze_scimitar: { name: 'Bronze scimitar', icon: '🗡️', value: 32, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 7, strength: 6, speed: 4 } } },
  iron_scimitar: { name: 'Iron scimitar', icon: '⚔️', value: 112, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 1 }, bonuses: { attack: 10, strength: 9, speed: 4 } } },
  steel_scimitar: { name: 'Steel scimitar', icon: '⚔️', value: 400, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 5 }, bonuses: { attack: 15, strength: 14, speed: 4 } } },

  // ---- Armour ----
  wooden_shield: { name: 'Wooden shield', icon: '🛡️', value: 20, examine: 'A solid wooden shield.',
    equip: { slot: 'shield', req: { defence: 1 }, bonuses: { defence: 4 } } },
  bronze_kiteshield: { name: 'Bronze kiteshield', icon: '🛡️', value: 84, examine: 'A medium, kite-shaped shield.',
    equip: { slot: 'shield', req: { defence: 1 }, bonuses: { defence: 8 } } },
  bronze_helm: { name: 'Bronze full helm', icon: '⛑️', value: 44, examine: 'A full helmet.',
    equip: { slot: 'head', req: { defence: 1 }, bonuses: { defence: 5 } } },
  bronze_platebody: { name: 'Bronze platebody', icon: '🦺', value: 100, examine: 'Provides excellent protection.',
    equip: { slot: 'body', req: { defence: 1 }, bonuses: { defence: 11 } } },
  bronze_platelegs: { name: 'Bronze platelegs', icon: '👖', value: 64, examine: 'These look pretty heavy.',
    equip: { slot: 'legs', req: { defence: 1 }, bonuses: { defence: 9 } } },
  iron_platebody: { name: 'Iron platebody', icon: '🦺', value: 280, examine: 'Provides excellent protection.',
    equip: { slot: 'body', req: { defence: 1 }, bonuses: { defence: 18 } } },
  iron_full_helm: { name: 'Iron full helm', icon: '⛑️', value: 84, examine: 'A full helmet.',
    equip: { slot: 'head', req: { defence: 1 }, bonuses: { defence: 8 } } },
  leather_body: { name: 'Leather body', icon: '🧥', value: 14, examine: 'It\'s a leather body.',
    equip: { slot: 'body', req: { defence: 1 }, bonuses: { defence: 3 } } },

  // ---- Misc / quest-ish ----
  bones: { name: 'Bones', icon: '🦴', value: 1, prayerXp: 75, prayerRestore: 1, tags: ['bone'], examine: 'Ew, it\'s a pile of bones.' },
  // Better bones (bones.js): stronger bands, champions and bosses drop these. Not stackable,
  // so the boss and champion stack multipliers never touch them.
  big_bones: { name: 'Big bones', icon: '🦴', value: 25, prayerXp: 200, prayerRestore: 2, tags: ['bone'], examine: 'Hefty bones from a sturdy creature.' },
  heavy_bones: { name: 'Heavy bones', icon: '🦴', value: 80, prayerXp: 500, prayerRestore: 4, tags: ['bone'], examine: 'Thick, dense bones. Worth a prayer.' },
  ancient_bones: { name: 'Ancient bones', icon: '🦴', value: 250, prayerXp: 1500, prayerRestore: 8, tags: ['bone'], examine: 'Old, dark bones that hum faintly.' },
  spirit_bones: { name: 'Spirit bones', icon: '🦴', value: 700, prayerXp: 4000, prayerRestore: 15, tags: ['bone'], examine: 'Pale bones that glow with a spirit\'s light.' },
  champion_bones: { name: 'Champion bones', icon: '🦴', value: 400, prayerXp: 5000, prayerRestore: 10, tags: ['bone'], examine: 'Gold-flecked bones from a champion. A worthy offering.' },
  titan_bones: { name: 'Titan bones', icon: '🦴', value: 1500, prayerXp: 6000, prayerRestore: 25, tags: ['bone'], examine: 'Enormous bones from a fallen boss.' },
  dragon_bones: { name: 'Dragon bones', icon: '🦴', value: 8000, prayerXp: 15000, prayerRestore: 50, tags: ['bone'], examine: 'Scaled bones, still warm. A dragon\'s remains.' },
  fiend_bones: { name: 'Fiend bones', icon: '🦴', value: 6000, prayerXp: 12000, prayerRestore: 50, tags: ['bone'], examine: 'Horned black bones that smell of smoke.' },
  legend_bones: { name: 'Bones of Legend', icon: '🦴', value: 15000, prayerXp: 30000, prayerRestore: 100, tags: ['bone'], examine: 'The bones of a legend of the island. Handle with respect.' },
  feather: { name: 'Feather', icon: '🪶', value: 2, stackable: true, examine: 'A small feather.' },
  raw_chicken: { name: 'Raw chicken', icon: '🍗', value: 4, tags: ['raw'], examine: 'I need to cook this first.' },
  cooked_chicken: { name: 'Cooked chicken', icon: '🍗', value: 8, heal: 3, examine: 'Mmm chicken.' },
  egg: { name: 'Egg', icon: '🥚', value: 4, examine: 'A nice fresh egg.' },
  amulet_of_power: { name: 'Amulet of power', icon: '📿', value: 1000, examine: 'A powerful amulet.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 6, strength: 6, defence: 6 } } },

  // ---- Higher woodcutting ----
  maple_logs: { name: 'Rain-tree logs', icon: '🪵', value: 36, tags: ['log'], firemaking: 45, fmXp: 135, examine: 'Logs from a mighty rain tree.' },
  yew_logs: { name: 'Yew logs', icon: '🪵', value: 80, tags: ['log'], firemaking: 60, fmXp: 175, examine: 'Logs from an ancient yew.' },
  magic_logs: { name: 'Magic logs', icon: '🪵', value: 200, tags: ['log'], firemaking: 75, fmXp: 250, examine: 'Faintly glowing enchanted logs.' },
  // ---- More tree species (logs) ----
  bamboo: { name: 'Bamboo', icon: '🎍', value: 8, tags: ['log'], firemaking: 8, fmXp: 35, examine: 'A fast-growing bamboo stalk.' },
  angsana_logs: { name: 'Angsana logs', icon: '🪵', value: 16, tags: ['log'], firemaking: 22, fmXp: 70, examine: 'Logs from a flowering angsana.' },
  teak_logs: { name: 'Teak logs', icon: '🪵', value: 30, tags: ['log'], firemaking: 35, fmXp: 110, examine: 'Fine, durable teak.' },
  mangrove_logs: { name: 'Mangrove logs', icon: '🪵', value: 40, tags: ['log'], firemaking: 40, fmXp: 125, examine: 'Salt-hardened mangrove wood.' },
  mahogany_logs: { name: 'Mahogany logs', icon: '🪵', value: 60, tags: ['log'], firemaking: 50, fmXp: 160, examine: 'Rich red mahogany.' },
  tembusu_logs: { name: 'Tembusu logs', icon: '🪵', value: 120, tags: ['log'], firemaking: 68, fmXp: 220, examine: 'Dense wood from a heritage tembusu.' },
  // ---- Endgame logs (Woodcutting 100-300) ----
  // They fletch the obsidian to eternal bows, staves, wands, rifles and
  // crossbows (trades.js FLETCH). Each burns for about 35% more Firemaking XP
  // than the tier before (magic logs 250 -> 340 ...), and leaves an ash behind.
  seraya_logs: { name: 'Seraya logs', icon: '🪵', value: 600, tags: ['log'], firemaking: 100, fmXp: 340, ash: 'fine_ash', examine: 'Pale, straight-grained logs from a towering seraya.' },
  meranti_logs: { name: 'Meranti logs', icon: '🪵', value: 900, tags: ['log'], firemaking: 130, fmXp: 460, ash: 'fine_ash', examine: 'Red meranti from deep in the Mandai rainforest.' },
  chengal_logs: { name: 'Chengal logs', icon: '🪵', value: 1300, tags: ['log'], firemaking: 160, fmXp: 625, ash: 'ember_ash', examine: 'Chengal: so hard it was once used for temple beams.' },
  starwood_logs: { name: 'Starwood logs', icon: '🪵', value: 1900, tags: ['log'], firemaking: 200, fmXp: 845, ash: 'star_ash', examine: 'Wood from a banyan that grew where a star fell. It twinkles.' },
  moonwood_logs: { name: 'Moonwood logs', icon: '🪵', value: 2800, tags: ['log'], firemaking: 250, fmXp: 1145, ash: 'ghost_ash', examine: 'Silvery kapok wood, cut by moonlight on Pulau Hantu.' },
  eternal_heartwood: { name: 'Eternal heartwood', icon: '🪵', value: 4000, tags: ['log'], firemaking: 300, fmXp: 1550, ash: 'eternal_ash', examine: 'The golden heart of a keramat tree. It is warm to the touch.' },
  // Ashes left by burning the endgame logs. Shrine materials for now; Herblore will use them later.
  fine_ash: { name: 'Fine ash', icon: '🩶', value: 150, stackable: true, tags: ['ash'], examine: 'Soft grey ash from seraya or meranti logs.' },
  ember_ash: { name: 'Ember ash', icon: '🟠', value: 300, stackable: true, tags: ['ash'], examine: 'Chengal ash that still glows with tiny embers.' },
  star_ash: { name: 'Star ash', icon: '✨', value: 600, stackable: true, tags: ['ash'], examine: 'Ash from starwood, flecked with glittering motes.' },
  ghost_ash: { name: 'Ghost ash', icon: '🌫️', value: 900, stackable: true, tags: ['ash'], examine: 'Pale moonwood ash. It drifts upwards when you are not looking.' },
  eternal_ash: { name: 'Eternal ash', icon: '🟡', value: 1500, stackable: true, tags: ['ash'], examine: 'Golden ash from eternal heartwood. It never cools.' },

  // ---- Higher ores & bars ----
  mithril_ore: { name: 'Mithril ore', icon: '🔷', value: 162, examine: 'This needs refining.' },
  adamantite_ore: { name: 'Adamantite ore', icon: '🟢', value: 400, examine: 'This needs refining.' },
  runite_ore: { name: 'Runite ore', icon: '🔵', value: 1600, examine: 'This needs refining.' },
  gold_ore: { name: 'Gold ore', icon: '🟡', value: 150, examine: 'A glittering nugget of gold.' },
  // ---- More mining materials ----
  clay: { name: 'Clay', icon: '🟫', value: 6, examine: 'Soft clay, handy for crafting.' },
  limestone: { name: 'Limestone', icon: '⬜', value: 10, examine: 'A block of pale limestone.' },
  silver_ore: { name: 'Silver ore', icon: '⚪', value: 60, examine: 'Refines into shining silver.' },
  sandstone: { name: 'Sandstone', icon: '🟨', value: 14, examine: 'A gritty block of sandstone.' },
  granite: { name: 'Granite', icon: '🪨', value: 50, examine: 'A heavy slab of speckled granite.' },
  // ---- Endgame ores (Mining 100-300), smelted into the endgame bars ----
  obsidian_shard: { name: 'Obsidian shard', icon: '⬛', value: 2400, examine: 'Glassy black rock from the Tekong Badlands. It smelts into obsidian.' },
  orichalcum_ore: { name: 'Orichalcum ore', icon: '🟠', value: 3600, examine: 'Coppery-gold ore hauled out of the Tuas quarries.' },
  raw_jade: { name: 'Raw jade', icon: '🟢', value: 5200, examine: 'A rough lump of imperial jade from the Temasek Ruins.' },
  starmetal_ore: { name: 'Starmetal ore', icon: '🌠', value: 7600, examine: 'A shard of a fallen star, still faintly warm.' },
  celestial_crystal: { name: 'Celestial crystal', icon: '💠', value: 11000, examine: 'Skyglass from the summit of the Celestial Peaks. It hums softly.' },
  eternal_ore: { name: 'Eternal ore', icon: '🟨', value: 16000, examine: 'Golden ore from the Shadow Rift that never tarnishes.' },

  // ---- Crafting: tool, pottery & jewelry ----
  chisel: { name: 'Chisel', icon: '🔧', value: 1, tool: 'chisel', examine: 'For cutting gems and shaping jewelry.' },
  pot: { name: 'Pot', icon: '🏺', value: 10, examine: 'A simple clay pot.' },
  bowl: { name: 'Bowl', icon: '🥣', value: 12, examine: 'A handy clay bowl.' },
  gold_ring: { name: 'Gold ring', icon: '💍', value: 350, examine: 'A simple gold ring.',
    equip: { slot: 'ring', req: {}, bonuses: { strength: 2 } } },
  gold_amulet: { name: 'Gold amulet', icon: '📿', value: 600, examine: 'A gleaming gold amulet.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 3, strength: 3 } } },
  sapphire_ring: { name: 'Sapphire ring', icon: '💍', value: 900, examine: 'A gold ring set with a sapphire.',
    equip: { slot: 'ring', req: {}, bonuses: { magic: 4, defence: 2 } } },
  sapphire_amulet: { name: 'Sapphire amulet', icon: '📿', value: 1400, examine: 'An amulet set with a sapphire.',
    equip: { slot: 'amulet', req: {}, bonuses: { magic: 8, magicStr: 1 } } },
  pearl_ring: { name: 'Pearl ring', icon: '💍', value: 500, examine: 'A silver ring set with a Singapore river pearl.', equip: { slot: 'ring', req: {}, bonuses: {} } },
  pearl_amulet: { name: 'Pearl amulet', icon: '📿', value: 800, examine: 'A string of pearls that steadies a caster.', equip: { slot: 'amulet', req: {}, bonuses: {} } },
  emerald_amulet: { name: 'Emerald amulet', icon: '📿', value: 2600, examine: 'An amulet set with an emerald.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 5, strength: 5, defence: 5 } } },
  ruby_amulet: { name: 'Ruby amulet', icon: '📿', value: 6000, examine: 'An amulet set with a ruby.',
    equip: { slot: 'amulet', req: {}, bonuses: { strength: 11 } } },
  diamond_amulet: { name: 'Diamond amulet', icon: '📿', value: 12000, examine: 'An amulet set with a diamond.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 9, strength: 9, defence: 9 } } },
  granite_shield: { name: 'Granite shield', icon: '🛡️', value: 9000, examine: 'A heavy shield carved from granite.',
    equip: { slot: 'shield', req: { defence: 45 }, bonuses: { defence: 22, strength: 3 } } },
  // gem rings (jewelry tier)
  emerald_ring: { name: 'Emerald ring', icon: '💍', value: 1800, examine: 'A ring set with an emerald.',
    equip: { slot: 'ring', req: {}, bonuses: { attack: 2, strength: 2, defence: 2 } } },
  ruby_ring: { name: 'Ruby ring', icon: '💍', value: 4200, examine: 'A ring set with a ruby.',
    equip: { slot: 'ring', req: {}, bonuses: { strength: 5 } } },
  diamond_ring: { name: 'Diamond ring', icon: '💍', value: 9000, examine: 'A ring set with a diamond.',
    equip: { slot: 'ring', req: {}, bonuses: { attack: 4, strength: 4, defence: 4 } } },
  // granite armour
  granite_helm: { name: 'Granite helm', icon: '⛑️', value: 6000, examine: 'A helm hewn from solid granite.',
    equip: { slot: 'head', req: { defence: 45 }, bonuses: { defence: 13, strength: 1 } } },
  granite_legs: { name: 'Granite legs', icon: '👖', value: 14000, examine: 'Heavy granite leg armour.',
    equip: { slot: 'legs', req: { defence: 50 }, bonuses: { defence: 18, strength: 2 } } },
  granite_body: { name: 'Granite body', icon: '🦺', value: 22000, examine: 'A cuirass carved from granite.',
    equip: { slot: 'body', req: { defence: 55 }, bonuses: { defence: 26, strength: 2 } } },
  granite_maul: { name: 'Granite maul', icon: '⚔️', value: 32000, examine: 'A colossal two-handed maul hewn from a single block of granite.',
    equip: { slot: 'weapon', req: { attack: 50, strength: 50 }, bonuses: { attack: 58, strength: 82, speed: 7 } } },
  // glassblowing
  molten_glass: { name: 'Molten glass', icon: '🫧', value: 20, examine: 'Glass made from sandstone, ready to blow.' },
  vial: { name: 'Vial', icon: '🧪', value: 25, examine: 'A small glass vial.' },
  glass_orb: { name: 'Glass orb', icon: '🔮', value: 90, examine: 'A delicate blown-glass orb.' },
  lantern: { name: 'Lantern', icon: '🏮', value: 220, examine: 'A glass lantern that lights the dark.' },
  // pottery
  jug: { name: 'Jug', icon: '🏺', value: 14, examine: 'A clay jug for holding liquids.' },
  pie_dish: { name: 'Pie dish', icon: '🥧', value: 16, examine: 'A clay dish for baking pies.' },
  // ---- Cooking herbs & ingredients ----
  chilli: { name: 'Chilli', icon: '🌶️', value: 8, stackable: true, tags: ['herb'], examine: 'A fiery red chilli — the heart of a good sambal.' },
  galangal: { name: 'Galangal', icon: '🫚', value: 10, stackable: true, tags: ['herb'], examine: 'An aromatic rhizome, cousin to ginger.' },
  lemongrass: { name: 'Lemongrass', icon: '🌿', value: 9, stackable: true, tags: ['herb'], examine: 'A fragrant stalk of lemongrass.' },
  pandan_leaves: { name: 'Pandan leaves', icon: '🍃', value: 7, stackable: true, tags: ['herb'], examine: 'Sweet, fragrant pandan — the vanilla of the East.' },
  turmeric: { name: 'Turmeric', icon: '🫚', value: 11, stackable: true, tags: ['herb'], examine: 'A golden root that colours and flavours a dish.' },
  // ---- Cultural capes ----
  batik_cape: { name: 'Batik cape', icon: '🧣', value: 6000, examine: 'A cape block-printed with traditional batik patterns.',
    equip: { slot: 'cape', req: {}, bonuses: { attack: 3, strength: 3, defence: 4, ranged: 3, magic: 3 } } },
  songket_cape: { name: 'Songket cape', icon: '🧣', value: 48000, examine: 'Woven with gold thread — fit for royalty.',
    equip: { slot: 'cape', req: { defence: 30 }, bonuses: { attack: 6, strength: 6, defence: 8, ranged: 6, magic: 6 } } },

  // ---- Combination dishes (Cooking) ----
  meat_pie: { name: 'Meat pie', icon: '🥧', value: 120, heal: 13, examine: 'A hearty meat pie.' },
  laksa: { name: 'Laksa', icon: '🍜', value: 150, heal: 15, examine: 'Spicy coconut laksa — shiok!' },
  fish_pie: { name: 'Fish pie', icon: '🥧', value: 180, heal: 16, examine: 'A flaky fish pie.' },
  seafood_stew: { name: 'Seafood stew', icon: '🍲', value: 260, heal: 19, examine: 'A rich pot of seafood stew.' },
  seafood_platter: { name: 'Seafood platter', icon: '🍱', value: 420, heal: 26, examine: 'A lavish seafood platter — the finest meal around.' },
  steel_bar: { name: 'Steel bar', icon: '⬜', value: 200, examine: 'A bar of steel.' },
  mithril_bar: { name: 'Mithril bar', icon: '🟦', value: 324, examine: 'A bar of mithril.' },
  adamant_bar: { name: 'Adamant bar', icon: '🟩', value: 800, examine: 'A bar of adamantite.' },
  rune_bar: { name: 'Runite bar', icon: '🟦', value: 3200, examine: 'A bar of runite.' },
  // Smelted from silver and gold ore at a furnace; jewellery is made from them.
  silver_bar: { name: 'Silver bar', icon: '⬜', value: 150, examine: 'A bar of shining silver, for jewellery.' },
  gold_bar: { name: 'Gold bar', icon: '🟨', value: 360, examine: 'A heavy bar of gold, for jewellery.' },
  // Endgame bars (Smithing 100-300): they forge the obsidian to eternal gear.
  obsidian_bar: { name: 'Obsidian bar', icon: '⬛', value: 4800, examine: 'A bar of tempered obsidian.' },
  orichalcum_bar: { name: 'Orichalcum bar', icon: '🟧', value: 7200, examine: 'A bar of orichalcum.' },
  jade_bar: { name: 'Jade bar', icon: '🟩', value: 10400, examine: 'Jade, fired hard as steel.' },
  starmetal_bar: { name: 'Starmetal bar', icon: '🟦', value: 15200, examine: 'A bar of starmetal. Its surface glitters like the night sky.' },
  celestial_bar: { name: 'Celestial bar', icon: '⬜', value: 22000, examine: 'A bar of celestial skyglass, light as a feather.' },
  eternal_bar: { name: 'Eternal bar', icon: '🟨', value: 32000, examine: 'A bar of eternal gold. Nothing marks it.' },

  // ---- Higher fishing / cooking ----
  raw_lobster: { name: 'Raw lobster', icon: '🦞', value: 70, tags: ['raw'], examine: 'I should cook this first.' },
  lobster: { name: 'Lobster', icon: '🦞', value: 120, heal: 12, examine: 'A tasty cooked lobster.' },
  raw_swordfish: { name: 'Raw swordfish', icon: '🐟', value: 100, tags: ['raw'], examine: 'I should cook this first.' },
  swordfish: { name: 'Swordfish', icon: '🐟', value: 180, heal: 14, examine: 'A hearty cooked swordfish.' },
  raw_salmon: { name: 'Raw salmon', icon: '🐟', value: 40, tags: ['raw'], examine: 'I should cook this first.' },
  salmon: { name: 'Salmon', icon: '🐟', value: 75, heal: 9, examine: 'A cooked salmon.' },
  raw_tuna: { name: 'Raw tuna', icon: '🐟', value: 60, tags: ['raw'], examine: 'I should cook this first.' },
  tuna: { name: 'Tuna', icon: '🐟', value: 110, heal: 10, examine: 'A cooked tuna.' },
  raw_shark: { name: 'Raw shark', icon: '🦈', value: 200, tags: ['raw'], examine: 'I should cook this first.' },
  shark: { name: 'Shark', icon: '🦈', value: 360, heal: 20, examine: 'A cooked shark — the finest food on the island.' },
  raw_mackerel: { name: 'Raw mackerel', icon: '🐟', value: 24, tags: ['raw'], examine: 'I should cook this first.' },
  mackerel: { name: 'Mackerel', icon: '🐟', value: 44, heal: 6, examine: 'A grilled mackerel.' },
  raw_pike: { name: 'Raw pike', icon: '🐟', value: 36, tags: ['raw'], examine: 'I should cook this first.' },
  pike: { name: 'Pike', icon: '🐟', value: 66, heal: 8, examine: 'A cooked river pike.' },
  raw_eel: { name: 'Raw eel', icon: '🐍', value: 58, tags: ['raw'], examine: 'I should cook this first.' },
  eel: { name: 'Cooked eel', icon: '🐍', value: 105, heal: 11, examine: 'A cooked eel — surprisingly tasty.' },
  raw_grouper: { name: 'Raw grouper', icon: '🐟', value: 120, tags: ['raw'], examine: 'I should cook this first.' },
  grouper: { name: 'Grouper', icon: '🐟', value: 210, heal: 16, examine: 'A hearty steamed grouper.' },
  raw_stingray: { name: 'Raw stingray', icon: '🐟', value: 170, tags: ['raw'], examine: 'I should cook this first.' },
  stingray: { name: 'Stingray', icon: '🐟', value: 300, heal: 18, examine: 'A grilled stingray, sambal-style.' },
  raw_manta_ray: { name: 'Raw manta ray', icon: '🐟', value: 260, tags: ['raw'], examine: 'I should cook this first.' },
  manta_ray: { name: 'Manta ray', icon: '🐟', value: 470, heal: 22, examine: 'A magnificent cooked manta ray.' },

  // ---- Singapore freshwater fish ----
  raw_tilapia: { name: 'Raw tilapia', icon: '🐟', value: 28, tags: ['raw'], examine: 'A common pond tilapia. Cook it first.' },
  tilapia: { name: 'Tilapia', icon: '🐟', value: 50, heal: 7, examine: 'Steamed tilapia.' },
  raw_marble_goby: { name: 'Raw marble goby', icon: '🐟', value: 140, tags: ['raw'], examine: 'Soon hock — a prized delicacy. Cook it first.' },
  marble_goby: { name: 'Marble goby', icon: '🐟', value: 250, heal: 9, examine: 'Steamed soon hock. Very shiok!' },
  raw_peacock_bass: { name: 'Raw peacock bass', icon: '🐟', value: 60, tags: ['raw'], examine: 'A feisty peacock bass. Cook it first.' },
  peacock_bass: { name: 'Peacock bass', icon: '🐟', value: 110, heal: 11, examine: 'Grilled peacock bass.' },
  raw_speckled_temensis: { name: 'Raw speckled temensis', icon: '🐟', value: 90, tags: ['raw'], examine: 'A big speckled peacock bass. Cook it first.' },
  speckled_temensis: { name: 'Speckled temensis', icon: '🐟', value: 165, heal: 14, examine: 'A hearty grilled temensis.' },
  raw_giant_snakehead: { name: 'Raw giant snakehead', icon: '🐟', value: 120, tags: ['raw'], examine: 'A fearsome toman. Cook it first.' },
  giant_snakehead: { name: 'Giant snakehead', icon: '🐟', value: 210, heal: 16, examine: 'Cooked toman — rich and filling.' },

  // ---- Singapore saltwater fish ----
  raw_red_snapper: { name: 'Raw red snapper', icon: '🐟', value: 55, tags: ['raw'], examine: 'A red snapper. Cook it first.' },
  red_snapper: { name: 'Red snapper', icon: '🐟', value: 100, heal: 10, examine: 'Grilled red snapper.' },
  raw_golden_snapper: { name: 'Raw golden snapper', icon: '🐟', value: 130, tags: ['raw'], examine: 'Jenahak — a premium catch. Cook it first.' },
  golden_snapper: { name: 'Golden snapper', icon: '🐟', value: 230, heal: 13, examine: 'Steamed jenahak.' },
  raw_mangrove_jack: { name: 'Raw mangrove jack', icon: '🐟', value: 70, tags: ['raw'], examine: 'A hard-fighting mangrove jack. Cook it first.' },
  mangrove_jack: { name: 'Mangrove jack', icon: '🐟', value: 130, heal: 12, examine: 'Grilled mangrove jack.' },
  raw_barramundi: { name: 'Raw barramundi', icon: '🐟', value: 60, tags: ['raw'], examine: 'A silver barramundi (seabass). Cook it first.' },
  barramundi: { name: 'Barramundi', icon: '🐟', value: 110, heal: 12, examine: 'Steamed barramundi.' },
  raw_red_drum: { name: 'Raw red drum', icon: '🐟', value: 75, tags: ['raw'], examine: 'A red drum (ang zor). Cook it first.' },
  red_drum: { name: 'Red drum', icon: '🐟', value: 135, heal: 13, examine: 'Grilled red drum.' },
  raw_tenggiri: { name: 'Raw tenggiri', icon: '🐟', value: 85, tags: ['raw'], examine: 'A Spanish mackerel (tenggiri). Cook it first.' },
  tenggiri: { name: 'Tenggiri', icon: '🐟', value: 155, heal: 14, examine: 'Grilled tenggiri steak.' },
  raw_longfin_trevally: { name: 'Raw longfin trevally', icon: '🐟', value: 95, tags: ['raw'], examine: 'A longfin trevally. Cook it first.' },
  longfin_trevally: { name: 'Longfin trevally', icon: '🐟', value: 170, heal: 15, examine: 'Grilled longfin trevally.' },
  raw_giant_trevally: { name: 'Raw giant trevally', icon: '🐟', value: 160, tags: ['raw'], examine: 'A mighty GT. Cook it first.' },
  giant_trevally: { name: 'Giant trevally', icon: '🐟', value: 290, heal: 18, examine: 'A huge cooked GT.' },
  raw_diamond_trevally: { name: 'Raw diamond trevally', icon: '🐟', value: 120, tags: ['raw'], examine: 'A shimmering diamond trevally. Cook it first.' },
  diamond_trevally: { name: 'Diamond trevally', icon: '🐟', value: 215, heal: 16, examine: 'Grilled diamond trevally.' },
  raw_hybrid_grouper: { name: 'Raw hybrid grouper', icon: '🐟', value: 150, tags: ['raw'], examine: 'A plump hybrid grouper. Cook it first.' },
  hybrid_grouper: { name: 'Hybrid grouper', icon: '🐟', value: 270, heal: 17, examine: 'Steamed hybrid grouper.' },

  // ---- More freshwater species ----
  raw_climbing_perch: { name: 'Raw climbing perch', icon: '🐟', value: 30, tags: ['raw'], examine: 'A hardy puyu. Cook it first.' },
  climbing_perch: { name: 'Climbing perch', icon: '🐟', value: 54, heal: 7, examine: 'Fried puyu.' },
  raw_ikan_keli: { name: 'Raw ikan keli', icon: '🐟', value: 34, tags: ['raw'], examine: 'A whiskered catfish. Cook it first.' },
  ikan_keli: { name: 'Ikan keli', icon: '🐟', value: 60, heal: 8, examine: 'Grilled catfish.' },
  raw_belida: { name: 'Raw belida', icon: '🐟', value: 80, tags: ['raw'], examine: 'A knifefish, great for fish cake. Cook it first.' },
  belida: { name: 'Belida', icon: '🐟', value: 145, heal: 12, examine: 'Cooked knifefish.' },
  raw_arapaima: { name: 'Raw arapaima', icon: '🐟', value: 200, tags: ['raw'], examine: 'A colossal arapaima. Cook it first.' },
  arapaima: { name: 'Arapaima', icon: '🐟', value: 360, heal: 19, examine: 'A vast slab of cooked arapaima.' },
  raw_arowana: { name: 'Raw arowana', icon: '🐉', value: 2000, tags: ['raw'], examine: 'A prized Asian arowana — a dragonfish! Worth a fortune.' },
  arowana: { name: 'Arowana', icon: '🐉', value: 3500, heal: 16, examine: 'The legendary dragonfish, prepared.' },

  // ---- More saltwater species ----
  raw_milkfish: { name: 'Raw milkfish', icon: '🐟', value: 56, tags: ['raw'], examine: 'A bony bangus. Cook it first.' },
  milkfish: { name: 'Milkfish', icon: '🐟', value: 100, heal: 11, examine: 'Grilled bangus.' },
  raw_queenfish: { name: 'Raw queenfish', icon: '🐟', value: 70, tags: ['raw'], examine: 'A sleek talang. Cook it first.' },
  queenfish: { name: 'Queenfish', icon: '🐟', value: 128, heal: 12, examine: 'Grilled queenfish.' },
  raw_threadfin: { name: 'Raw threadfin', icon: '🐟', value: 130, tags: ['raw'], examine: 'Kurau — a premium fish. Cook it first.' },
  threadfin: { name: 'Threadfin', icon: '🐟', value: 235, heal: 14, examine: 'Steamed kurau.' },
  raw_white_pomfret: { name: 'Raw white pomfret', icon: '🐟', value: 150, tags: ['raw'], examine: 'A prized white pomfret. Cook it first.' },
  white_pomfret: { name: 'White pomfret', icon: '🐟', value: 270, heal: 14, examine: 'Teochew steamed pomfret.' },
  raw_coral_trout: { name: 'Raw coral trout', icon: '🐟', value: 140, tags: ['raw'], examine: 'A vivid kerapu. Cook it first.' },
  coral_trout: { name: 'Coral trout', icon: '🐟', value: 250, heal: 16, examine: 'Steamed coral trout.' },
  raw_cobia: { name: 'Raw cobia', icon: '🐟', value: 120, tags: ['raw'], examine: 'A muscular cobia. Cook it first.' },
  cobia: { name: 'Cobia', icon: '🐟', value: 215, heal: 17, examine: 'Grilled cobia steak.' },

  // ---- Endgame fish (Fishing 100-300) and their dishes (Cooking 100-300) ----
  // Life at these levels runs to hundreds, so these dishes heal a share of your
  // maximum life (healPct; `heal` is the least they give) instead of a fixed
  // amount. Two also lend a short damage boost and one heals over time (`meal`,
  // see Game.eatItem); a new meal replaces the last one's boost.
  raw_dorado: { name: 'Raw dorado', icon: '🐟', value: 400, tags: ['raw'], examine: 'A blunt-headed mahi-mahi, gold and green. Cook it first.' },
  grilled_dorado: { name: 'Grilled dorado', icon: '🐟', value: 700, heal: 40, healPct: 0.4, examine: 'Charred dorado with lime. Heals 40% of your life.' },
  raw_bluefin_tuna: { name: 'Raw bluefin tuna', icon: '🐟', value: 650, tags: ['raw'], examine: 'A huge, deep-bodied bluefin. Cook it first.' },
  tuna_sashimi: { name: 'Tuna sashimi', icon: '🍣', value: 1100, heal: 58, healPct: 0.45, examine: 'Thick slices of bluefin belly. Heals 45% of your life.' },
  raw_sailfish: { name: 'Raw sailfish', icon: '🐟', value: 1000, tags: ['raw'], examine: 'A sailfish, its great fin folded. Cook it first.' },
  sambal_sailfish: { name: 'Sambal sailfish', icon: '🌶️', value: 1700, heal: 80, healPct: 0.5, meal: { ms: 60000, fx: { dmg: 0.05 } },
    examine: 'Sailfish grilled in fiery sambal. Heals 50% of your life and fires you up: +5% damage for 60 seconds.' },
  raw_moonfish: { name: 'Raw moonfish', icon: '🐟', value: 1500, tags: ['raw'], examine: 'A round, silver moonfish that glows faintly. Cook it first.' },
  moonfish_curry: { name: 'Moonfish curry', icon: '🍛', value: 2500, heal: 60, healPct: 0.3, meal: { ms: 12000, regenPct: 0.25 },
    examine: 'A slow-cooked fish head curry. Heals 30% of your life at once and 25% more over 12 seconds.' },
  raw_rift_eel: { name: 'Raw rift eel', icon: '🐍', value: 2200, tags: ['raw'], examine: 'A long eel that glows violet from within. Cook it first.' },
  rift_eel_claypot: { name: 'Rift eel claypot', icon: '🍲', value: 3600, heal: 150, healPct: 0.6, examine: 'Eel braised in a sizzling claypot. Heals 60% of your life.' },
  raw_dragon_arowana: { name: 'Raw dragon arowana', icon: '🐉', value: 3500, tags: ['raw'], examine: 'A golden dragonfish from the Shadow Rift. Cook it first.' },
  arowana_feast: { name: 'Arowana feast', icon: '🐉', value: 6000, heal: 300, healPct: 1, meal: { ms: 60000, fx: { dmg: 0.1 } },
    examine: 'A banquet fit for an emperor. Heals all of your life and fills you with strength: +10% damage for 60 seconds.' },
  // Skill-chain dishes (cooking.js DISHES): boss-fight meals from Hunter, Farming and Fishing goods.
  // `artFrom` borrows another item's sticker, tinted, until their own art arrives (icons.js).
  boar_rendang: { name: 'Boar rendang', icon: '🍛', value: 450, heal: 24, meal: { ms: 120000, fx: { boss: 0.08 } }, artFrom: ['laksa', 'sepia(0.6) saturate(1.8) hue-rotate(-20deg) brightness(0.9)'],
    examine: 'Wild boar slow-cooked in spiced coconut. Heals 24 and steels you for a boss: +8% damage to bosses and champions for 2 minutes.' },
  fish_head_curry: { name: 'Fish head curry', icon: '🍛', value: 1200, heal: 34, meal: { ms: 180000, fx: { boss: 0.12, reduce: 0.05 } }, artFrom: ['seafood_stew', 'sepia(0.5) saturate(2) hue-rotate(-25deg)'],
    examine: 'A whole fish head in a fiery curry. Heals 34; for 3 minutes +12% damage to bosses and champions and 5% less damage taken.' },

  // ---- Fishing bait, junk & treasure ----
  fishing_bait: { name: 'Fishing bait', icon: '🪱', value: 2, stackable: true, tags: ['bait'], examine: 'Improves your catch rate when fishing.' },
  old_boot: { name: 'Old boot', icon: '🥾', value: 1, examine: 'You fished up someone\'s old boot. Charming.' },
  seaweed: { name: 'Seaweed', icon: '🌿', value: 2, examine: 'A clump of soggy seaweed.' },
  pearl: { name: 'Pearl', icon: '🦪', value: 600, examine: 'A lustrous pearl from an oyster.' },
  birds_nest: { name: "Bird's nest", icon: '🪺', value: 0, examine: 'Knocked from a tree while chopping — open it for a surprise.' },

  // ---- Fishing tools ----
  fishing_rod: { name: 'Fishing rod', icon: '🎣', value: 8, tool: 'rod', examine: 'For luring freshwater fish.' },
  lobster_pot: { name: 'Lobster pot', icon: '🪤', value: 20, tool: 'lobster_pot', examine: 'A cage for trapping lobster and grouper.' },
  harpoon: { name: 'Harpoon', icon: '🔱', value: 30, tool: 'harpoon', examine: 'For spearing big sea creatures.' },

  // ---- More hawker fare ----
  laksa: { name: 'Laksa', icon: '🍜', value: 60, heal: 11, examine: 'Spicy coconut noodle soup. Power up!' },
  satay: { name: 'Satay', icon: '🍢', value: 25, heal: 7, examine: 'Grilled skewers with peanut sauce.' },
  nasi_lemak: { name: 'Nasi lemak', icon: '🍱', value: 90, heal: 16, examine: 'Coconut rice with all the sides. Very filling.' },

  // ---- Weapons (higher tiers) ----
  mithril_scimitar: { name: 'Mithril scimitar', icon: '⚔️', value: 1300, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 20 }, bonuses: { attack: 21, strength: 20, speed: 4 } } },
  adamant_scimitar: { name: 'Adamant scimitar', icon: '⚔️', value: 3200, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 30 }, bonuses: { attack: 29, strength: 28, speed: 4 } } },
  rune_scimitar: { name: 'Rune scimitar', icon: '⚔️', value: 25600, examine: 'A vicious, curved sword.',
    equip: { slot: 'weapon', req: { attack: 40 }, bonuses: { attack: 45, strength: 44, speed: 4 } } },

  // ---- Armour (steel / mithril / rune) ----
  steel_full_helm: { name: 'Steel full helm', icon: '⛑️', value: 350, examine: 'A full helmet.',
    equip: { slot: 'head', req: { defence: 5 }, bonuses: { defence: 12 } } },
  steel_platebody: { name: 'Steel platebody', icon: '🦺', value: 1200, examine: 'Provides excellent protection.',
    equip: { slot: 'body', req: { defence: 5 }, bonuses: { defence: 26 } } },
  steel_kiteshield: { name: 'Steel kiteshield', icon: '🛡️', value: 640, examine: 'A medium, kite-shaped shield.',
    equip: { slot: 'shield', req: { defence: 5 }, bonuses: { defence: 18 } } },
  mithril_platebody: { name: 'Mithril platebody', icon: '🦺', value: 3900, examine: 'Provides excellent protection.',
    equip: { slot: 'body', req: { defence: 20 }, bonuses: { defence: 34 } } },
  mithril_full_helm: { name: 'Mithril full helm', icon: '⛑️', value: 1100, examine: 'A full helmet.',
    equip: { slot: 'head', req: { defence: 20 }, bonuses: { defence: 16 } } },
  rune_platebody: { name: 'Rune platebody', icon: '🦺', value: 39000, examine: 'Provides superb protection.',
    equip: { slot: 'body', req: { defence: 40 }, bonuses: { defence: 60 } } },
  rune_full_helm: { name: 'Rune full helm', icon: '⛑️', value: 11000, examine: 'A full helmet.',
    equip: { slot: 'head', req: { defence: 40 }, bonuses: { defence: 30 } } },
  rune_kiteshield: { name: 'Rune kiteshield', icon: '🛡️', value: 21000, examine: 'A large, kite-shaped shield.',
    equip: { slot: 'shield', req: { defence: 40 }, bonuses: { defence: 42 } } },

  // ---- Boss-only uniques ----
  merlion_blade: { name: 'Merlion blade', icon: '🗡️', value: 120000, examine: 'A legendary blade blessed by the sea.',
    equip: { slot: 'weapon', req: { attack: 50 }, bonuses: { attack: 60, strength: 58, speed: 3 } } },
  merlion_amulet: { name: 'Merlion amulet', icon: '📿', value: 50000, examine: 'It hums with the tide.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 10, strength: 10, defence: 8 } } },
  warlord_cape: { name: "Warlord's cape", icon: '🧣', value: 80000, examine: 'Torn from a fallen wilderness lord.',
    equip: { slot: 'cape', req: { defence: 40 }, bonuses: { attack: 4, strength: 6, defence: 9 } } },
  boar_tusk: { name: 'Boar tusk', icon: '🦷', value: 8000, examine: 'A huge tusk from the Boar King.',
    equip: { slot: 'amulet', req: {}, bonuses: { strength: 8, defence: 2 } } },

  // ---- Accessories (amulets / rings / capes) ----
  worthy_sigil: { name: 'A-Worthy Sigil', icon: '📿', value: 25000, examine: 'A blessing earned by honouring the island\'s two pillars.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 12, strength: 12, defence: 10 } } },
  amulet_of_strength: { name: 'Amulet of strength', icon: '📿', value: 2000, examine: 'Boosts raw power.',
    equip: { slot: 'amulet', req: {}, bonuses: { strength: 10 } } },
  amulet_of_glory: { name: 'Amulet of glory', icon: '📿', value: 8000, examine: 'A glorious amulet.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 10, strength: 8, defence: 8 } } },
  ring_of_kampong: { name: 'Ring of Kampong', icon: '💍', value: 3000, examine: 'A lucky local ring.',
    equip: { slot: 'ring', req: {}, bonuses: { attack: 4, strength: 4, defence: 4 } } },
  ring_of_might: { name: 'Ring of might', icon: '💍', value: 5000, examine: 'It pulses with strength.',
    equip: { slot: 'ring', req: {}, bonuses: { strength: 8 } } },
  fire_cape: { name: 'Fire cape', icon: '🧣', value: 60000, examine: 'Singed, but glorious.',
    equip: { slot: 'cape', req: { defence: 40 }, bonuses: { attack: 6, strength: 8, defence: 8, crit: 5 } } },

  // ---- New boss uniques ----
  tiger_fang: { name: 'Tiger fang', icon: '🗡️', value: 90000, examine: 'A fang from the Night Safari Tiger.',
    equip: { slot: 'weapon', req: { attack: 45 }, bonuses: { attack: 52, strength: 56, speed: 4 } } },
  leviathan_trident: { name: 'Leviathan trident', icon: '🔱', value: 150000, examine: 'Dredged from the deep.',
    equip: { slot: 'weapon', req: { attack: 55 }, bonuses: { attack: 70, strength: 56, speed: 5 } } },
  garuda_wings: { name: 'Garuda wings', icon: '🪽', value: 120000, examine: 'Wings of the great Garuda.',
    equip: { slot: 'cape', req: { defence: 45 }, bonuses: { attack: 6, strength: 6, defence: 10 } } },
  hydra_leather: { name: 'Hydra leather body', icon: '🦺', value: 70000, examine: 'Tough, scaly hide.',
    equip: { slot: 'body', req: { defence: 40 }, bonuses: { defence: 48 } } },
  treant_shield: { name: 'Treant shield', icon: '🛡️', value: 75000, examine: 'Living bark that turns aside blows.',
    equip: { slot: 'shield', req: { defence: 45 }, bonuses: { defence: 50 } } },
  megalodon_jaw: { name: 'Megalodon jaw', icon: '🦈', value: 160000, examine: 'The serrated jaw of the Sentosa Megalodon.',
    equip: { slot: 'weapon', req: { attack: 60 }, bonuses: { attack: 78, strength: 72, speed: 5 } } },
  phantom_robe: { name: 'Phantom robe', icon: '🥼', value: 95000, examine: 'Woven from the mist of the Changi Phantom.',
    equip: { slot: 'body', req: { magic: 50, defence: 40 }, bonuses: { magic: 22, magicStr: 2, defence: 14 } } },
  djinn_lamp: { name: 'Djinn lamp', icon: '🪔', value: 110000, examine: 'A lamp that channels the Pulau Hantu Djinn.',
    equip: { slot: 'amulet', req: { magic: 50 }, bonuses: { magic: 18, magicStr: 3, attack: 6 } } },
  revenant_cape: { name: 'Revenant cape', icon: '🧣', value: 130000, examine: 'Tattered shroud of the Bukit Brown Revenant.',
    equip: { slot: 'cape', req: { defence: 50 }, bonuses: { attack: 8, strength: 8, defence: 12 } } },
  cursed_cutlass: { name: 'Cursed cutlass', icon: '🗡️', value: 175000, examine: 'A pirate blade from haunted Pulau Hantu.',
    equip: { slot: 'weapon', req: { attack: 60 }, bonuses: { attack: 80, strength: 76, speed: 4 } } },

  // ---- Quest & special rewards ----
  tiger_kris: { name: 'Tiger kris', icon: '🗡️', value: 18000, examine: 'A wavy ceremonial blade, swift and deadly.',
    equip: { slot: 'weapon', req: { attack: 30 }, bonuses: { attack: 34, strength: 30, speed: 3 } } },
  merdeka_medallion: { name: 'Merdeka medallion', icon: '📿', value: 15000, examine: 'A medallion bearing the crescent and stars.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 8, strength: 8, defence: 8 } } },
  kampong_gauntlets: { name: 'Kampong gauntlets', icon: '🧤', value: 12000, examine: 'Sturdy gloves blessed by the village smith.',
    equip: { slot: 'hands', req: {}, bonuses: { attack: 9, strength: 9, defence: 7 } } },
  champions_helm: { name: "Champion's helm", icon: '⛑️', value: 20000, examine: 'Worn by the island\'s defenders.',
    equip: { slot: 'head', req: { defence: 30 }, bonuses: { attack: 6, defence: 16, hp: 8 } } },
  island_aegis: { name: 'Island aegis', icon: '🛡️', value: 40000, examine: 'A bulwark awarded to a true Island Defender.',
    equip: { slot: 'shield', req: { defence: 40 }, bonuses: { strength: 5, defence: 24, hp: 12 } } },
  slayer_helmet: { name: 'Slayer helmet', icon: '💀', value: 45000, examine: 'A fearsome helm prized by slayers: boosts all combat, and +10% damage against your Slayer task.',
    equip: { slot: 'head', req: { defence: 10 }, bonuses: { attack: 10, strength: 8, defence: 14, ranged: 8, magic: 8, crit: 5 } } },
  slayer_ring: { name: 'Slayer ring', icon: '💍', value: 8000, examine: 'A ring etched with slayer runes.',
    equip: { slot: 'ring', req: {}, bonuses: { attack: 5, strength: 5, defence: 3 } } },
  trades_cape: { name: 'Trades cape', icon: '🧣', value: 30000, examine: 'Awarded by Cikgu Surya to a Master of Trades.',
    equip: { slot: 'cape', req: {}, bonuses: { attack: 4, strength: 4, defence: 6 } } },
  champions_cape: { name: "Champion's cape", icon: '🧣', value: 200000, examine: 'Only the Champion of Singapore may wear it.',
    equip: { slot: 'cape', req: { defence: 40 }, bonuses: { attack: 10, strength: 10, defence: 14, ranged: 8, magic: 8, crit: 6, hp: 12 } } },
  mark_of_grace: { name: 'Mark of grace', icon: '🪶', value: 40, stackable: true, examine: 'A token of agility. Use it to trade for Agility experience (the same amount at any level).' },

  // ---- Alignment arc rewards ----
  blessed_halo: { name: 'Blessed halo', icon: '😇', value: 80000, examine: 'A radiant halo earned through redemption.',
    equip: { slot: 'head', req: {}, bonuses: { defence: 12, magic: 8, strength: 2 } } },
  shadow_cloak: { name: 'Shadow cloak', icon: '🦇', value: 80000, examine: 'A cloak woven from darkness, granted to the corrupted.',
    equip: { slot: 'cape', req: {}, bonuses: { attack: 10, strength: 10, defence: 3 } } },
  seraph_blade: { name: 'Seraph blade', icon: '🗡️', value: 250000, examine: 'A radiant blade dropped by the Lion of Light.',
    equip: { slot: 'weapon', req: { attack: 40 }, bonuses: { attack: 72, strength: 68, defence: 6, magic: 10, speed: 4, crit: 8 } } },
  void_blade: { name: 'Void blade', icon: '🗡️', value: 260000, examine: 'A blade of pure darkness from the Shadow Sovereign.',
    equip: { slot: 'weapon', req: { attack: 50 }, bonuses: { attack: 88, strength: 84, defence: 2, speed: 4, crit: 10 } } },

  // ---- Clue scrolls & treasure trails ----
  clue_scroll_easy: { name: 'Clue scroll (easy)', icon: '📜', value: 0, examine: 'Read it to begin an easy treasure trail.' },
  clue_scroll_medium: { name: 'Clue scroll (medium)', icon: '📜', value: 0, examine: 'Read it to begin a medium treasure trail.' },
  clue_scroll_hard: { name: 'Clue scroll (hard)', icon: '📜', value: 0, examine: 'Read it to begin a hard treasure trail.' },
  reward_casket_easy: { name: 'Reward casket (easy)', icon: '🧰', value: 0, examine: 'Open it for your easy trail loot!' },
  reward_casket_medium: { name: 'Reward casket (medium)', icon: '🧰', value: 0, examine: 'Open it for your medium trail loot!' },
  reward_casket_hard: { name: 'Reward casket (hard)', icon: '🧰', value: 0, examine: 'Open it for your hard trail loot!' },

  // ---- Ranged: bows & arrows ----
  bronze_arrow: { name: 'Bronze arrow', icon: '🏹', value: 1, stackable: true, tags: ['ammo'], arrowStr: 7, examine: 'Arrows with bronze heads.' },
  iron_arrow: { name: 'Iron arrow', icon: '🏹', value: 3, stackable: true, tags: ['ammo'], arrowStr: 10, examine: 'Arrows with iron heads.' },
  steel_arrow: { name: 'Steel arrow', icon: '🏹', value: 6, stackable: true, tags: ['ammo'], arrowStr: 16, examine: 'Arrows with steel heads.' },
  mithril_arrow: { name: 'Mithril arrow', icon: '🏹', value: 12, stackable: true, tags: ['ammo'], arrowStr: 22, examine: 'Arrows with mithril heads.' },
  adamant_arrow: { name: 'Adamant arrow', icon: '🏹', value: 24, stackable: true, tags: ['ammo'], arrowStr: 31, examine: 'Arrows with adamant heads.' },
  rune_arrow: { name: 'Rune arrow', icon: '🏹', value: 50, stackable: true, tags: ['ammo'], arrowStr: 49, examine: 'Arrows with runite heads.' },
  shortbow: { name: 'Shortbow', icon: '🏹', value: 50, examine: 'A simple shortbow.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 12, req: { ranged: 1 }, bonuses: { ranged: 8, speed: 3 } } },
  oak_shortbow: { name: 'Oak shortbow', icon: '🏹', value: 120, examine: 'A shortbow of oak.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 13, req: { ranged: 5 }, bonuses: { ranged: 14, speed: 3 } } },
  willow_shortbow: { name: 'Willow shortbow', icon: '🏹', value: 400, examine: 'A springy willow bow.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 14, req: { ranged: 20 }, bonuses: { ranged: 24, speed: 3 } } },
  maple_shortbow: { name: 'Maple shortbow', icon: '🏹', value: 900, examine: 'A fine maple bow.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 15, req: { ranged: 30 }, bonuses: { ranged: 34, speed: 3 } } },
  yew_shortbow: { name: 'Yew shortbow', icon: '🏹', value: 2400, examine: 'A powerful yew bow.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 16, req: { ranged: 40 }, bonuses: { ranged: 48, speed: 3 } } },
  magic_shortbow: { name: 'Magic shortbow', icon: '🏹', value: 9000, examine: 'A swift bow of enchanted wood.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 18, req: { ranged: 50 }, bonuses: { ranged: 62, speed: 2 } } },
  dark_bow: { name: 'Dark bow', icon: '🏹', value: 30000, examine: 'A brooding bow that fires shadowy arrows.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 19, req: { ranged: 60 }, bonuses: { ranged: 84, crit: 3, speed: 2 } } },
  crystal_bow: { name: 'Crystal bow', icon: '🏹', value: 90000, examine: 'Light as glass, sharp as starlight.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 20, req: { ranged: 75 }, bonuses: { ranged: 110, crit: 5, speed: 2 } } },
  twisted_bow: { name: 'Twisted bow', icon: '🏹', value: 300000, examine: 'A legendary bow. The stronger the foe, the harder it hits.',
    equip: { slot: 'weapon', combatType: 'ranged', range: 22, req: { ranged: 90 }, bonuses: { ranged: 145, crit: 8, speed: 2 } } },
  coif: { name: 'Coif', icon: '⛑️', value: 60, examine: 'A padded mail hood.',
    equip: { slot: 'head', req: { ranged: 1 }, bonuses: { ranged: 3, defence: 2 } } },
  leather_chaps: { name: 'Leather chaps', icon: '👖', value: 40, examine: 'Light leg armour.',
    equip: { slot: 'legs', req: { ranged: 1 }, bonuses: { ranged: 2, defence: 2 } } },
  studded_body: { name: 'Studded body', icon: '🦺', value: 600, examine: 'Leather reinforced with studs.',
    equip: { slot: 'body', req: { ranged: 20, defence: 20 }, bonuses: { ranged: 10, defence: 8 } } },
  dragonhide_coif: { name: 'Dragonhide coif', icon: '⛑️', value: 1800, examine: 'A hood of toughened dragonhide.',
    equip: { slot: 'head', req: { ranged: 40 }, bonuses: { ranged: 8, defence: 6 } } },
  dragonhide_body: { name: 'Dragonhide body', icon: '🦺', value: 6000, examine: 'A body of toughened dragonhide.',
    equip: { slot: 'body', req: { ranged: 40, defence: 30 }, bonuses: { ranged: 20, defence: 16 } } },
  dragonhide_chaps: { name: 'Dragonhide chaps', icon: '👖', value: 4000, examine: 'Leg armour of toughened dragonhide.',
    equip: { slot: 'legs', req: { ranged: 40 }, bonuses: { ranged: 14, defence: 10 } } },

  // ---- Magic: staves, runes & robes ----
  staff: { name: 'Staff', icon: '🪄', value: 30, examine: 'A basic magical staff.',
    equip: { slot: 'weapon', combatType: 'magic', req: { magic: 1 }, bonuses: { magic: 6, speed: 5 } } },
  magic_staff: { name: 'Magic staff', icon: '🪄', value: 1500, examine: 'A staff humming with power.',
    equip: { slot: 'weapon', combatType: 'magic', req: { magic: 20 }, bonuses: { magic: 16, magicStr: 1, speed: 5 } } },
  mystic_staff: { name: 'Mystic staff', icon: '🪄', value: 6000, examine: 'A staff of the mystics.',
    equip: { slot: 'weapon', combatType: 'magic', req: { magic: 40 }, bonuses: { magic: 28, magicStr: 3, speed: 5 } } },
  ancient_staff: { name: 'Ancient staff', icon: '🪄', value: 16000, examine: 'A staff thrumming with ancient power.',
    equip: { slot: 'weapon', combatType: 'magic', req: { magic: 50 }, bonuses: { magic: 42, magicStr: 5, speed: 4 } } },
  // Elemental staves: each supplies unlimited runes of its element while wielded.
  air_staff: { name: 'Air staff', icon: '🪄', value: 1500, examine: 'A staff of swirling wind. Gives unlimited air runes.',
    equip: { slot: 'weapon', combatType: 'magic', runes: 'air_rune', req: { magic: 10 }, bonuses: { magic: 10, speed: 5 } } },
  water_staff: { name: 'Water staff', icon: '🪄', value: 1800, examine: 'A staff that drips with sea spray. Gives unlimited water runes.',
    equip: { slot: 'weapon', combatType: 'magic', runes: 'water_rune', req: { magic: 15 }, bonuses: { magic: 11, speed: 5 } } },
  earth_staff: { name: 'Earth staff', icon: '🪄', value: 2100, examine: 'A staff crowned with living rock. Gives unlimited earth runes.',
    equip: { slot: 'weapon', combatType: 'magic', runes: 'earth_rune', req: { magic: 20 }, bonuses: { magic: 12, speed: 5 } } },
  fire_staff: { name: 'Fire staff', icon: '🪄', value: 2500, examine: 'A staff that never stops smouldering. Gives unlimited fire runes.',
    equip: { slot: 'weapon', combatType: 'magic', runes: 'fire_rune', req: { magic: 25 }, bonuses: { magic: 13, speed: 5 } } },
  nature_staff: { name: 'Nature staff', icon: '🪄', value: 6000, examine: 'A staff of twisting vines, still growing. Gives unlimited nature runes.',
    equip: { slot: 'weapon', combatType: 'magic', runes: 'nature_rune', req: { magic: 35 }, bonuses: { magic: 18, magicStr: 1, speed: 5 } } },
  chaos_staff: { name: 'Chaos staff', icon: '🪄', value: 12000, examine: 'A staff that crackles with wild magic. Gives unlimited chaos runes.',
    equip: { slot: 'weapon', combatType: 'magic', runes: 'chaos_rune', req: { magic: 45 }, bonuses: { magic: 24, magicStr: 2, speed: 5 } } },
  death_staff: { name: 'Death staff', icon: '🪄', value: 24000, examine: 'A bone staff topped with a grinning skull. Gives unlimited death runes.',
    equip: { slot: 'weapon', combatType: 'magic', runes: 'death_rune', req: { magic: 55 }, bonuses: { magic: 32, magicStr: 3, speed: 5 } } },
  blood_staff: { name: 'Blood staff', icon: '🪄', value: 40000, examine: 'A staff that pulses like a heartbeat. Gives unlimited blood runes.',
    equip: { slot: 'weapon', combatType: 'magic', runes: 'blood_rune', req: { magic: 65 }, bonuses: { magic: 40, magicStr: 4, speed: 4 } } },
  dragonhide_vambraces: { name: 'Dragonhide vambraces', icon: '🧤', value: 2500, examine: 'Bracers of toughened dragonhide.',
    equip: { slot: 'hands', req: { ranged: 40 }, bonuses: { ranged: 6, defence: 4 } } },
  nature_rune: { name: 'Nature rune', icon: '🌀', value: 150, stackable: true, tags: ['rune'], examine: 'A rune of nature. Powers the Alchemy spell.' },
  air_rune: { name: 'Air rune', icon: '🌀', value: 4, stackable: true, tags: ['rune'], examine: 'A rune of air.' },
  water_rune: { name: 'Water rune', icon: '🌀', value: 4, stackable: true, tags: ['rune'], examine: 'A rune of water.' },
  earth_rune: { name: 'Earth rune', icon: '🌀', value: 4, stackable: true, tags: ['rune'], examine: 'A rune of earth.' },
  fire_rune: { name: 'Fire rune', icon: '🌀', value: 4, stackable: true, tags: ['rune'], examine: 'A rune of fire.' },
  mind_rune: { name: 'Mind rune', icon: '🌀', value: 3, stackable: true, tags: ['rune'], examine: 'A rune of the mind.' },
  chaos_rune: { name: 'Chaos rune', icon: '🌀', value: 90, stackable: true, tags: ['rune'], examine: 'A rune of chaos.' },
  death_rune: { name: 'Death rune', icon: '🌀', value: 200, stackable: true, tags: ['rune'], examine: 'A rune of death.' },
  blood_rune: { name: 'Blood rune', icon: '🌀', value: 380, stackable: true, tags: ['rune'], examine: 'A rune pulsing with life force.' },
  occult_necklace: { name: 'Occult necklace', icon: '📿', value: 30000, examine: 'Amplifies magical might.',
    equip: { slot: 'amulet', req: { magic: 40 }, bonuses: { magic: 12, magicStr: 5 } } },
  wizard_hat: { name: 'Wizard hat', icon: '🎩', value: 30, examine: 'A pointy hat.',
    equip: { slot: 'head', req: { magic: 1 }, bonuses: { magic: 2 } } },
  wizard_robe_top: { name: 'Wizard robe top', icon: '🥼', value: 40, examine: 'A wizard\'s robe.',
    equip: { slot: 'body', req: { magic: 1 }, bonuses: { magic: 4 } } },
  wizard_robe_bottom: { name: 'Wizard robe bottom', icon: '👖', value: 36, examine: 'Wizard\'s skirt.',
    equip: { slot: 'legs', req: { magic: 1 }, bonuses: { magic: 3 } } },
  mystic_hat: { name: 'Mystic hat', icon: '🎩', value: 1500, examine: 'Enchanted headwear.',
    equip: { slot: 'head', req: { magic: 20, defence: 20 }, bonuses: { magic: 6, magicStr: 1 } } },
  mystic_top: { name: 'Mystic robe top', icon: '🥼', value: 4000, examine: 'Enchanted robes.',
    equip: { slot: 'body', req: { magic: 20, defence: 20 }, bonuses: { magic: 10, magicStr: 1 } } },
  mystic_bottom: { name: 'Mystic robe bottom', icon: '👖', value: 3000, examine: 'Enchanted robes.',
    equip: { slot: 'legs', req: { magic: 20, defence: 20 }, bonuses: { magic: 8, magicStr: 1 } } },

  // ---- Gems (rare drops) ----
  sapphire: { name: 'Sapphire', icon: '💎', value: 250, examine: 'A precious blue gem.' },
  emerald: { name: 'Emerald', icon: '💎', value: 500, examine: 'A precious green gem.' },
  ruby: { name: 'Ruby', icon: '💎', value: 1200, examine: 'A precious red gem.' },
  diamond: { name: 'Diamond', icon: '💎', value: 3000, examine: 'A precious, sparkling gem.' },
};

// ---- Generated tiered equipment (weapons + armour, bronze -> rune) ----
// Existing hand-authored ids are preserved (the loop skips anything already defined).
const _METALS = [
  { k: 'bronze', n: 'Bronze', ra: 1, rd: 1, m: 1.0, v: 1 },
  { k: 'iron', n: 'Iron', ra: 1, rd: 1, m: 1.5, v: 2.4 },
  { k: 'steel', n: 'Steel', ra: 5, rd: 5, m: 2.3, v: 6 },
  { k: 'mithril', n: 'Mithril', ra: 20, rd: 20, m: 3.5, v: 14 },
  { k: 'adamant', n: 'Adamant', ra: 30, rd: 30, m: 4.7, v: 34 },
  { k: 'rune', n: 'Rune', ra: 40, rd: 40, m: 7.2, v: 120 },
  { k: 'dragon', n: 'Dragon', ra: 60, rd: 60, m: 9.5, v: 340 },
  // Endgame metals, for the levels beyond 99.
  { k: 'obsidian', n: 'Obsidian', ra: 80, rd: 80, m: 12, v: 600 },
  { k: 'orichalcum', n: 'Orichalcum', ra: 100, rd: 100, m: 15, v: 1100 },
  { k: 'jade', n: 'Jade', ra: 130, rd: 130, m: 19, v: 2000 },
  { k: 'starmetal', n: 'Starmetal', ra: 170, rd: 170, m: 24, v: 3600 },
  { k: 'celestial', n: 'Celestial', ra: 220, rd: 220, m: 30, v: 6500 },
  { k: 'eternal', n: 'Eternal', ra: 300, rd: 300, m: 40, v: 12000 },
];
const _WEAPONS = [
  ['dagger', 'dagger', 4, 3, 4, 10], ['sword', 'sword', 5, 5, 5, 26], ['scimitar', 'scimitar', 7, 6, 4, 32],
  ['mace', 'mace', 6, 7, 5, 30], ['longsword', 'longsword', 9, 8, 5, 40], ['battleaxe', 'battleaxe', 10, 11, 6, 52],
  ['warhammer', 'warhammer', 8, 12, 6, 54], ['2h_sword', '2h sword', 14, 15, 7, 80],
  // Newer families: a long-reaching spear, quick claws that crit, a balanced katana
  // with a keen edge, and a slow, huge-hitting halberd. [.., crit %]
  ['spear', 'spear', 9, 7, 5, 36], ['claws', 'claws', 6, 6, 4, 34, 4],
  ['katana', 'katana', 9, 9, 5, 60, 3], ['halberd', 'halberd', 13, 16, 7, 84],
];
const _ARMOURS = [
  ['med_helm', 'med helm', 'head', 4, 0, 18], ['full_helm', 'full helm', 'head', 6, 0, 44],
  ['chainbody', 'chainbody', 'body', 8, 0, 64], ['platebody', 'platebody', 'body', 12, 0, 100],
  ['platelegs', 'platelegs', 'legs', 10, 0, 64], ['sq_shield', 'sq shield', 'shield', 6, 0, 48],
  ['kiteshield', 'kiteshield', 'shield', 9, 0, 84], ['gauntlets', 'gauntlets', 'hands', 3, 1, 30],
  ['boots', 'boots', 'feet', 3, 0, 28],
  ['plateskirt', 'plateskirt', 'legs', 9, 1, 60], ['buckler', 'buckler', 'shield', 4, 3, 36],
];
// Melee reach in tiles: every melee weapon strikes from 2 tiles (less running
// around); long weapons reach 3, and the Lancer's spears the furthest, 4.
export const MELEE_REACH = 2;
export const SPEAR_REACH = 4;
const _REACH = { spear: SPEAR_REACH, halberd: 3, longsword: 3, '2h_sword': 3 };
// Each metal shield has its own role, so none is simply a weaker kiteshield:
//  - kiteshield: the tank's shield, the most Defence plus bonus life;
//  - sq shield: balanced, about 70% of a kite's Defence and a little Armour pierce (plate's theme);
//  - buckler: the duellist's parry shield, the melee counterpart of the quiver: under half a
//    kite's Defence, but a Physical damage bonus and Attack speed that grow with the tier.
// (The old buckler's flat +3 Attack meant nothing past the first few tiers.)
const _SHIELD_ROLES = {
  kiteshield: (M) => ({ bonuses: { defence: Math.round(9 * M.m), hp: Math.round(1.5 * M.m) }, examine: `${AOrAn(M.n.toLowerCase())} kiteshield: the most Defence and extra life, for holding the line.` }),
  sq_shield: (M) => ({ bonuses: { defence: Math.round(6.3 * M.m), pierce: 1 + Math.floor(M.rd / 75) }, examine: `${AOrAn(M.n.toLowerCase())} square shield: solid Defence, and its rim bites through armour.` }),
  buckler: (M) => ({ bonuses: { defence: Math.round(4 * M.m), atkPct: 2 + 2 * Math.floor(M.rd / 75), haste: 1 + Math.floor(M.rd / 120) },
    examine: `A small ${M.n.toLowerCase()} buckler for parrying: light Defence, but quicker, harder strikes.` }),
};
for (const M of _METALS) {
  for (const [t, label, att, str, spd, v, crit] of _WEAPONS) {
    const id = `${M.k}_${t}`;
    if (RAW[id]) continue;
    const bonuses = { attack: Math.round(att * M.m), strength: Math.round(str * M.m), speed: spd };
    if (crit) bonuses.crit = crit;
    RAW[id] = { name: `${M.n} ${label}`, icon: '⚔️', value: Math.round(v * M.v), examine: `${AOrAn(M.n.toLowerCase())} ${label}.`,
      equip: { slot: 'weapon', req: { attack: M.ra }, bonuses, range: _REACH[t] || MELEE_REACH } };
  }
  for (const [t, label, slot, def, att, v] of _ARMOURS) {
    const id = `${M.k}_${t}`, role = _SHIELD_ROLES[t]?.(M);
    // The hand-authored kiteshields (bronze, steel, rune) take their role's stats too.
    if (RAW[id]) { if (role) RAW[id] = { ...RAW[id], examine: role.examine, equip: { ...RAW[id].equip, bonuses: role.bonuses } }; continue; }
    const bonuses = role ? role.bonuses : { defence: Math.round(def * M.m) };
    if (att && !role) bonuses.attack = att;
    RAW[id] = { name: `${M.n} ${label}`, icon: '🛡️', value: Math.round(v * M.v), examine: role ? role.examine : `${M.n} ${label}.`,
      equip: { slot, req: { defence: M.rd }, bonuses } };
  }
}

// Hand-authored metal weapons (defined above the generator) get the same reach rules.
for (const M of _METALS) for (const [t] of _WEAPONS) { const it = RAW[`${M.k}_${t}`]; if (it?.equip && it.equip.range == null) it.equip.range = _REACH[t] || MELEE_REACH; }

// ---- The Dancer: whips and dancer outfits ----
// Whips are the Dancer's weapon: a quick lash that reaches 3 tiles. Dancers fight
// with Agility (damage) and their `dance` gear bonus.
const _WHIPS = [
  // id, name, Agility needed, dance bonus, crit %, value, examine
  ['leather_whip', 'Leather whip', 1, 6, 0, 60, 'A supple leather whip. Every Dancer starts with one.'],
  ['rattan_whip', 'Rattan whip', 10, 12, 1, 300, 'A springy rotan cane whip, a kampong classic.'],
  ['studded_whip', 'Studded whip', 20, 19, 2, 900, 'Brass studs make every crack ring out.'],
  ['serpent_whip', 'Sea serpent whip', 35, 30, 3, 3000, 'Woven from sea-snake hide; it hisses as it cracks.'],
  ['coral_whip', 'Coral whip', 50, 42, 4, 9000, 'Living coral beads glow along its length.'],
  ['orchid_whip', 'Orchid whip', 65, 56, 5, 26000, 'Vanda Miss Joaquim orchids bloom wherever it lands.'],
  ['dragon_whip', 'Dragon whip', 80, 72, 6, 80000, 'Dragonhide braided with a molten-red core.'],
  ['celestial_whip', 'Celestial whip', 95, 90, 8, 240000, 'Spun from starlight. It leaves trails of sparkles.'],
];
for (const [id, name, lvl, dance, crit, value, examine] of _WHIPS) {
  const bonuses = { dance, speed: 4 };
  if (crit) bonuses.crit = crit;
  RAW[id] = { name, icon: '〰️', value, examine, equip: { slot: 'weapon', combatType: 'dance', range: 3, req: { agility: lvl }, bonuses } };
}
// Two dancer outfits: flowing silk to start, and a golden festival set.
const _DANCER = [
  ['headdress', 'headdress', 'head', 2, 2], ['dancer_top', 'dancer top', 'body', 5, 4], ['dancer_skirt', 'dancer skirt', 'legs', 4, 3],
  ['slippers', 'slippers', 'feet', 2, 1], ['bangles', 'bangles', 'hands', 3, 1], ['sash', 'sash', 'cape', 3, 1],
];
for (const [tier, label, req, mult, vmul] of [['silk', 'Silk', 1, 1, 1], ['golden', 'Golden', 60, 4, 40]]) {
  for (const [t, name, slot, dance, def] of _DANCER) {
    RAW[`${tier}_${t}`] = { name: `${label} ${name}`, icon: '🎀', value: Math.round((40 + dance * 20) * vmul),
      examine: tier === 'silk' ? `Flowing silk ${name}, made for dancing.` : `A golden festival ${name}, glittering with sequins.`,
      equip: { slot, req: { agility: req }, bonuses: { dance: dance * mult, defence: def * mult } } };
  }
}

// ---- Longbows, wands and spell tomes ----
// Longbows hit harder and reach a little further than shortbows, but draw more
// slowly. (Their reach here is overwritten: see LONGBOW_RANGE below.)
const _LONGBOWS = [['longbow', 'Longbow', 1, 10, 15, 80], ['oak_longbow', 'Oak longbow', 5, 17, 16, 200], ['willow_longbow', 'Willow longbow', 20, 29, 17, 600],
  ['maple_longbow', 'Maple longbow', 30, 41, 18, 1300], ['yew_longbow', 'Yew longbow', 40, 58, 19, 3400], ['magic_longbow', 'Magic longbow', 50, 75, 21, 12000]];
for (const [id, name, lvl, ranged, range, value] of _LONGBOWS) {
  RAW[id] = { name, icon: '🏹', value, examine: 'A tall bow: slow to draw, heavy arrows, and a little more reach than a shortbow.',
    equip: { slot: 'weapon', combatType: 'ranged', range, req: { ranged: lvl }, bonuses: { ranged, speed: 4 } } };
}
// Wands cast faster than staves but carry less power.
const _WANDS = [['apprentice_wand', 'Apprentice wand', 1, 5, 0, 60], ['teak_wand', 'Teak wand', 20, 13, 1, 1400],
  ['mystic_wand', 'Mystic wand', 40, 23, 2, 5800], ['master_wand', 'Master wand', 60, 36, 4, 20000]];
for (const [id, name, lvl, magic, magicStr, value] of _WANDS) {
  const bonuses = { magic, speed: 4 };
  if (magicStr) bonuses.magicStr = magicStr;
  RAW[id] = { name, icon: '🪄', value, examine: 'A slim wand for quick casting.', equip: { slot: 'weapon', combatType: 'magic', req: { magic: lvl }, bonuses } };
}
// Tomes are a caster's off-hand: they go in the shield slot.
const _TOMES = [['novice_tome', 'Novice tome', 1, 6, 0, 2, 120], ['arcane_tome', 'Arcane tome', 40, 16, 2, 4, 6000], ['merlion_tome', 'Tome of the Merlion', 70, 28, 4, 8, 40000]];
for (const [id, name, lvl, magic, magicStr, defence, value] of _TOMES) {
  const bonuses = { magic, defence };
  if (magicStr) bonuses.magicStr = magicStr;
  RAW[id] = { name, icon: '📘', value, examine: 'A book of spells, held in the off-hand.', equip: { slot: 'shield', req: { magic: lvl }, bonuses } };
}

// ---- Endgame gear for every style (levels 100-300) ----
// Bows beyond the Twisted bow, and arrows to match.
for (const [id, name, lvl, ranged, range, value, examine] of [
  ['jade_bow', 'Jade bow', 130, 190, 23, 600000, 'A bow carved from a single piece of imperial jade.'],
  ['starmetal_bow', 'Starmetal bow', 170, 240, 24, 1500000, 'Forged from a fallen star; its string hums.'],
  ['celestial_bow', 'Celestial bow', 220, 300, 25, 4000000, 'Arrows leave it trailing light.'],
  ['eternal_bow', 'Eternal bow', 300, 390, 26, 12000000, 'A bow that has never missed in a thousand years.'],
]) RAW[id] = { name, icon: '🏹', value, examine, equip: { slot: 'weapon', combatType: 'ranged', range, req: { ranged: lvl }, bonuses: { ranged, crit: Math.round(lvl / 20), speed: 2 } } };
for (const [id, name, arrowStr, value] of [['dragon_arrow', 'Dragon arrow', 70, 120], ['jade_arrow', 'Jade arrow', 95, 260], ['starmetal_arrow', 'Starmetal arrow', 125, 600], ['eternal_arrow', 'Eternal arrow', 170, 1500]]) {
  RAW[id] = { name, icon: '🏹', value, stackable: true, tags: ['ammo'], arrowStr, examine: `Arrows tipped with ${name.split(' ')[0].toLowerCase()}.` };
}
// Rounds for guns (pistols and sniper rifles), one per bar tier. They go in the
// ammo slot (see rounds.js) and add `roundStr` to the gun's own power: about a
// third of the matching arrow's strength, as guns were balanced to need no ammo
// and fire much faster than bows. Smithed 20 to a bar (smithing.js). Each has
// its own sticker (icons.js ITEM_ART).
for (const [k, roundStr, value] of [['bronze', 2, 1], ['iron', 3, 3], ['steel', 5, 6], ['mithril', 7, 12], ['adamant', 10, 24], ['rune', 16, 50],
  ['obsidian', 23, 120], ['orichalcum', 27, 180], ['jade', 32, 260], ['starmetal', 42, 600], ['celestial', 50, 900], ['eternal', 57, 1500]]) {
  const n = k[0].toUpperCase() + k.slice(1);
  // Where to get them: the shops stock bronze to rune (bronze and iron at the General Store too).
  const where = ['bronze', 'iron'].includes(k) ? 'Sold at the General Store and the Archery Emporium, or smithed'
    : ['steel', 'mithril', 'adamant', 'rune'].includes(k) ? 'Sold at the Archery Emporium, or smithed' : 'Only smithed';
  RAW[`${k}_rounds`] = { name: `${n} rounds`, icon: '🔫', value, stackable: true, tags: ['ammo'], roundStr,
    examine: `${n} rounds for Pistolers' pistols and Snipers' rifles: +${roundStr} shot power on top of the gun's own. `
      + `They load into your ammo slot, and the gun reloads from the best rounds in your pack. A pistol uses one up about every 20 shots, a rifle about every 5. `
      + `${where} (20 from ${aOrAn(`${k} bar`)})${RAW[`${k === 'obsidian' ? 'dragon' : k}_arrow`] ? `; monsters that drop ${k === 'obsidian' ? 'dragon' : k} arrows drop these for gun users instead` : ''}.` };
}
// Special rounds: rune-strength rounds with an extra effect on one hit in five (rounds.js).
for (const [id, name, special, effect] of [
  ['incendiary_rounds', 'Incendiary rounds', 'fire', 'one hit in five bursts into flame for 30% more damage'],
  ['frost_rounds', 'Frost rounds', 'frost', 'one hit in five chills the foe, slowing it for 3s'],
  ['shock_rounds', 'Shock rounds', 'shock', 'one hit in five arcs into a foe nearby for half the hit'],
]) RAW[id] = { name, icon: '🔫', value: 80, stackable: true, tags: ['ammo'], roundStr: 16, special,
  examine: `Special rounds for pistols and sniper rifles, as strong as rune rounds (+16 shot power), and ${effect}. `
    + 'Sold at the Archery Emporium and found in treasure caskets; they are never smithed.' };
// Ranged armour sets above dragonhide.
for (const [tier, label, lvl, mult, vmul] of [['starhide', 'Starhide', 120, 3.5, 30], ['eternalhide', 'Eternal hide', 250, 8, 300]]) {
  for (const [t, name, slot, ranged, def] of [['coif', 'coif', 'head', 8, 6], ['body', 'body', 'body', 20, 16], ['chaps', 'chaps', 'legs', 14, 10], ['vambraces', 'vambraces', 'hands', 6, 4]]) {
    RAW[`${tier}_${t}`] = { name: `${label} ${name}`, icon: '🦺', value: Math.round((ranged + def) * 100 * vmul / 10), examine: `${label} ${name}, shimmering and light.`,
      equip: { slot, req: { ranged: lvl }, bonuses: { ranged: Math.round(ranged * mult), defence: Math.round(def * mult) } } };
  }
}
// Staves and robes beyond the death and blood staves.
for (const [id, name, lvl, magic, magicStr, value] of [['jade_staff', 'Jade staff', 100, 60, 7, 500000], ['starmetal_staff', 'Starmetal staff', 160, 85, 10, 1400000],
  ['celestial_staff', 'Celestial staff', 220, 115, 14, 4000000], ['eternal_staff', 'Eternal staff', 300, 160, 20, 12000000]]) {
  RAW[id] = { name, icon: '🪄', value, examine: 'A staff of immense power.', equip: { slot: 'weapon', combatType: 'magic', req: { magic: lvl }, bonuses: { magic, magicStr, speed: 4 } } };
}
for (const [tier, label, lvl, mult, vmul] of [['astral', 'Astral', 100, 4, 30], ['eternal', 'Eternal', 250, 9, 300]]) {
  for (const [t, name, slot, magic, mstr] of [['hat', 'hat', 'head', 6, 1], ['robe_top', 'robe top', 'body', 10, 1], ['robe_bottom', 'robe bottom', 'legs', 8, 1]]) {
    RAW[`${tier}_${t}`] = { name: `${label} ${name}`, icon: '🥼', value: Math.round(magic * 1000 * vmul / 10), examine: `${label} robes woven with starlight.`,
      equip: { slot, req: { magic: lvl }, bonuses: { magic: Math.round(magic * mult), magicStr: Math.round(mstr * mult), defence: Math.round(4 * mult) } } };
  }
}
// Whips beyond the Celestial whip, and two more dancer outfits.
for (const [id, name, lvl, dance, crit, value, examine] of [
  ['jade_whip', 'Jade whip', 130, 120, 9, 700000, 'Polished jade links that sing when cracked.'],
  ['starmetal_whip', 'Starmetal whip', 170, 160, 10, 1600000, 'A comet-tail of starmetal.'],
  ['eternal_whip', 'Eternal whip', 300, 240, 12, 12000000, 'It dances on its own if you let it.'],
]) RAW[id] = { name, icon: '〰️', value, examine, equip: { slot: 'weapon', combatType: 'dance', range: 3, req: { agility: lvl }, bonuses: { dance, crit, speed: 4 } } };
for (const [tier, label, req, mult, vmul] of [['jade', 'Jade', 130, 9, 400], ['eternal', 'Eternal', 300, 18, 3000]]) {
  for (const [t, name, slot, dance, def] of _DANCER) {
    RAW[`${tier}_${t}`] = { name: `${label} ${name}`, icon: '🎀', value: Math.round((40 + dance * 20) * vmul), examine: `${AOrAn(label.toLowerCase())} ${name} for the greatest dancers.`,
      equip: { slot, req: { agility: req }, bonuses: { dance: dance * mult, defence: def * mult } } };
  }
}

// ---- Filling every weapon type's ladder (levels 1-300) ----
// Each weapon type has a weapon at every tier, so every job class can progress.
for (const [id, name, lvl, ranged, range, value] of [
  ['dragon_longbow', 'Dragon longbow', 60, 95, 22, 90000], ['obsidian_longbow', 'Obsidian longbow', 80, 122, 23, 200000],
  ['orichalcum_longbow', 'Orichalcum longbow', 100, 152, 24, 400000], ['jade_longbow', 'Jade longbow', 130, 210, 25, 700000],
  ['starmetal_longbow', 'Starmetal longbow', 170, 265, 26, 1700000], ['celestial_longbow', 'Celestial longbow', 220, 330, 27, 4500000],
  ['eternal_longbow', 'Eternal longbow', 300, 430, 28, 13000000],
]) RAW[id] = { name, icon: '🏹', value, examine: 'A tall bow: slow to draw, heavy arrows, and a little more reach than a shortbow.', equip: { slot: 'weapon', combatType: 'ranged', range, req: { ranged: lvl }, bonuses: { ranged, speed: 4 } } };
for (const [id, name, lvl, value] of [['oak_wand', 'Oak wand', 5, 200], ['maple_wand', 'Maple wand', 30, 3000], ['obsidian_wand', 'Obsidian wand', 80, 90000],
  ['orichalcum_wand', 'Orichalcum wand', 100, 300000], ['jade_wand', 'Jade wand', 130, 600000], ['starmetal_wand', 'Starmetal wand', 170, 1500000],
  ['celestial_wand', 'Celestial wand', 220, 4000000], ['eternal_wand', 'Eternal wand', 300, 12000000]]) {
  const bonuses = { magic: Math.round(lvl * 0.45 + 5), speed: 4 };
  if (lvl >= 20) bonuses.magicStr = Math.floor(lvl / 20);
  RAW[id] = { name, icon: '🪄', value, examine: 'A slim wand for quick casting.', equip: { slot: 'weapon', combatType: 'magic', req: { magic: lvl }, bonuses } };
}
RAW.obsidian_staff = { name: 'Obsidian staff', icon: '🪄', value: 200000, examine: 'Volcanic glass that drinks in spells.', equip: { slot: 'weapon', combatType: 'magic', req: { magic: 80 }, bonuses: { magic: 50, magicStr: 6, speed: 4 } } };
RAW.imperial_staff = { name: 'Imperial staff', icon: '🪄', value: 800000, examine: 'Carried by the court sorcerers of old.', equip: { slot: 'weapon', combatType: 'magic', req: { magic: 130 }, bonuses: { magic: 72, magicStr: 8, speed: 4 } } };
RAW.astral_whip = { name: 'Astral whip', icon: '〰️', value: 4000000, examine: 'Each crack opens a tiny window onto the stars.', equip: { slot: 'weapon', combatType: 'dance', range: 3, req: { agility: 220 }, bonuses: { dance: 200, crit: 11, speed: 4 } } };

// Weapon special attacks (the spec bar). Attached after generation so the tiered
// Dragon weapons can carry specs too. dmg is a multiplier; hits = swings;
// heal = fraction of damage returned as health.
const WEAPON_SPECS = {
  dragon_dagger: { name: 'Puncture', cost: 25, dmg: 1.15, hits: 2 },
  dragon_scimitar: { name: 'Sever', cost: 40, dmg: 1.25 },
  dragon_longsword: { name: 'Cleave', cost: 35, dmg: 1.3 },
  dragon_mace: { name: 'Crush', cost: 35, dmg: 1.35 },
  dragon_battleaxe: { name: 'Rampage', cost: 50, dmg: 1.7 },
  dragon_2h_sword: { name: 'Devastate', cost: 55, dmg: 1.7 },
  // Endgame melee specials
  jade_katana: { name: 'Jade Wind', cost: 40, dmg: 1.4, hits: 2 },
  starmetal_halberd: { name: 'Meteor Sweep', cost: 55, dmg: 2.0 },
  celestial_scimitar: { name: 'Heaven Cut', cost: 45, dmg: 1.6 },
  eternal_2h_sword: { name: 'Endless Edge', cost: 60, dmg: 2.4 },
  eternal_claws: { name: 'Eternal Rend', cost: 50, dmg: 1.0, hits: 4 },
  celestial_bow: { name: 'Starlight Volley', cost: 55, dmg: 1.3, hits: 3 },
  eternal_bow: { name: 'Thousand Arrows', cost: 60, dmg: 1.2, hits: 4 },
  eternal_whip: { name: 'Endless Waltz', cost: 60, dmg: 1.2, hits: 5 },
  merlion_blade: { name: 'Tide Strike', cost: 50, dmg: 1.5, heal: 0.2 },
  tiger_fang: { name: 'Maul', cost: 40, dmg: 1.4 },
  granite_maul: { name: 'Quake', cost: 50, dmg: 1.7 },
  tiger_kris: { name: 'Flurry', cost: 25, dmg: 1.1, hits: 2 },
  cursed_cutlass: { name: 'Plunder', cost: 45, dmg: 1.5, heal: 0.3 },
  megalodon_jaw: { name: 'Devour', cost: 55, dmg: 1.7, heal: 0.25 },
  leviathan_trident: { name: 'Riptide', cost: 50, dmg: 1.45, heal: 0.4 },
  // ranged
  yew_shortbow: { name: 'Pinpoint Shot', cost: 40, dmg: 1.25 },
  magic_shortbow: { name: 'Rapid Volley', cost: 50, dmg: 1.15, hits: 2 },
  dark_bow: { name: 'Descent of Darkness', cost: 55, dmg: 1.5, hits: 2 },
  crystal_bow: { name: 'Prism Shot', cost: 45, dmg: 1.6 },
  twisted_bow: { name: 'Storm of Arrows', cost: 60, dmg: 1.4, hits: 3 },
  // dance
  orchid_whip: { name: 'Petal Storm', cost: 45, dmg: 1.2, hits: 3 },
  dragon_whip: { name: 'Dragon Lash', cost: 50, dmg: 1.8 },
  celestial_whip: { name: 'Starfall Dance', cost: 60, dmg: 1.3, hits: 4 },
  // magic
  mystic_staff: { name: 'Spell Echo', cost: 45, dmg: 1.5 },
  ancient_staff: { name: 'Arcane Surge', cost: 55, dmg: 1.8 },
};
for (const [id, spec] of Object.entries(WEAPON_SPECS)) { if (RAW[id]) RAW[id].spec = spec; }

// ---- Farming, Herblore, Fletching and Hunter (see trades.js) ----
for (const [id, name, lvl, , , , , heal, value] of CROPS) {
  RAW[`${id}_seed`] = { name: `${name} seed`, icon: '🌱', value: Math.max(2, Math.round(value / 3)), stackable: true, tags: ['seed'],
    examine: `Plant it in a farm patch to grow ${name.toLowerCase()}. (Farming ${lvl})` };
  if (!RAW[id]) RAW[id] = { name, icon: heal ? '🍈' : '🌿', value, stackable: true, tags: heal ? ['crop'] : ['crop', 'herb'], ...(heal ? { heal } : {}),
    examine: heal ? `Fresh ${name.toLowerCase()} from the farm. Heals ${heal}.` : `A farmed herb, ready for Herblore.` };
}
for (const [id, p] of Object.entries(POTIONS)) {
  const what = p.desc || (p.fx.heal && !p.fx.dmg && !p.fx.crit ? `Restores ${Math.round(p.fx.heal * 100)}% of your life.` : `Boosts you in a fight for ${Math.round(p.ms / 60000)} minutes.`);
  RAW[id] = { name: p.name, icon: '🧪', value: Math.round(20 + p.level * p.level * 0.6), stackable: true, potion: true, tags: ['potion'], examine: `${what} (Herblore ${p.level})`, ...(p.artFrom ? { artFrom: p.artFrom } : {}) };
}
Object.assign(RAW, {
  knife: { name: 'Knife', icon: '🔪', value: 6, tool: 'knife', examine: 'For fletching logs into shafts, bows, staves and wands.' },
  hunting_snare: { name: 'Hunting snare', icon: '🪢', value: 10, tool: 'snare', examine: 'Rope and pegs for working Hunter traps.' },
  arrow_shaft: { name: 'Arrow shaft', icon: '🥢', value: 1, stackable: true, examine: 'Add feathers and a metal bar to make arrows.' },
  squirrel_pelt: { name: 'Squirrel pelt', icon: '🟫', value: 18, stackable: true, tags: ['hide'], examine: 'Soft fur. Craft three into a leather body.' },
  lizard_skin: { name: 'Lizard skin', icon: '🟩', value: 40, stackable: true, tags: ['hide'], examine: 'Scaly skin, good for a coif or chaps.' },
  raw_venison: { name: 'Raw venison', icon: '🥩', value: 45, tags: ['raw'], examine: 'Mousedeer meat. Cook it first.' },
  venison: { name: 'Venison', icon: '🍖', value: 80, heal: 13, examine: 'Roast venison.' },
  raw_boar_meat: { name: 'Raw boar meat', icon: '🥩', value: 70, tags: ['raw'], examine: 'Wild boar. Cook it first.' },
  boar_steak: { name: 'Boar steak', icon: '🍖', value: 130, heal: 17, examine: 'A thick, smoky boar steak.' },
  // Skill-chain tools (smithing, crafting and fletching feed Fishing and Hunter; see unlocks.js GATHER_CONSUMABLES).
  barbed_hooks: { name: 'Barbed hooks', icon: '🪝', value: 6, stackable: true, artFrom: ['arrow_shaft', 'grayscale(0.8) brightness(1.1)'],
    examine: 'Little iron hooks. Craft them with feathers into fishing lures. (Smithing 25)' },
  feather_lure: { name: 'Feather lure', icon: '🪶', value: 12, stackable: true, artFrom: ['fishing_bait', 'hue-rotate(160deg) saturate(1.6)'],
    examine: 'A bright lure. One is used on each catch while you carry them: +10% chance of a double catch. (Crafting 25)' },
  bamboo_decoy: { name: 'Bamboo decoy', icon: '🎋', value: 15, stackable: true, artFrom: ['arrow_shaft', 'hue-rotate(60deg) saturate(1.5)'],
    examine: 'A carved bird decoy. One is used on each Hunter catch while you carry them: +10% chance of a second catch. (Fletching 25)' },
  python_skin: { name: 'Python skin', icon: '🟨', value: 120, stackable: true, tags: ['hide'], examine: 'A patterned skin. Craft four into a studded body.' },
  croc_hide: { name: 'Crocodile hide', icon: '🟢', value: 300, stackable: true, tags: ['hide'], examine: 'Tough as armour. Craft it into dragonhide.' },
  hornbill_casque: { name: 'Hornbill casque', icon: '🟠', value: 1500, stackable: true, examine: 'A rare casque, prized by herbalists.' },
  qilin_mane: { name: 'Qilin mane', icon: '✨', value: 6000, stackable: true, examine: 'A lock of golden mane from a celestial qilin.' },
  // Endgame Hunter catches (Hunter 100-300); each goes into its tier's Herblore brew (trades.js POTIONS).
  pangolin_scales: { name: 'Pangolin scales', icon: '🟤', value: 700, stackable: true, examine: 'Overlapping scales shed by a Sunda pangolin. Herbalists grind them.' },
  colugo_fur: { name: 'Colugo fur', icon: '🩶', value: 1000, stackable: true, examine: 'Soft grey fur from a gliding colugo.' },
  tiger_whisker: { name: 'Tiger whisker', icon: '〰️', value: 1500, stackable: true, examine: 'A stiff whisker from a Malayan tiger. Said to sharpen the eye.' },
  garuda_plume: { name: 'Garuda plume', icon: '🪶', value: 2200, stackable: true, examine: 'A sky-blue plume from a garuda\'s nest.' },
  naga_scale: { name: 'Naga scale', icon: '🟢', value: 3200, stackable: true, examine: 'A jade-green scale as big as your palm, from a sea naga.' },
  phoenix_ember: { name: 'Phoenix ember', icon: '🔥', value: 4600, stackable: true, examine: 'A glowing ember from a phoenix roost. It never goes out.' },
  // Lifted from Marina Bay's high rollers (Thieving 100). Any shop that buys everything changes them for coins.
  casino_chip: { name: 'Casino chip', icon: '🪙', value: 250, stackable: true, examine: 'A heavy chip from the Marina Bay casino. Worth 250 coins to the right shopkeeper.' },
});

// ---- Weapons for the newer classes, one per metal tier ----
// Pistols (Pistoler): dual wielded, need no ammo, light shots fired very fast.
// Shurikens (Ninja): thrown, need no ammo, and ricochet into a second foe.
// Canes (Merchant): a ranged weapon that flicks coins at the foe. Every throw
// costs coins (see Game.coinThrowCost); the Merchant's other strength is the
// mercenaries they hire.
for (const M of _METALS) {
  const tag = M.n.toLowerCase();
  if (!RAW[`${M.k}_pistol`]) RAW[`${M.k}_pistol`] = { name: `${M.n} pistol`, icon: '🔫', value: Math.round(28 * M.v), examine: `${AOrAn(tag)} flintlock pistol. Best in pairs.`,
    equip: { slot: 'weapon', combatType: 'ranged', noAmmo: true, req: { ranged: M.ra }, bonuses: { ranged: Math.round(5 * M.m), speed: 3 }, range: 7 } };
  if (!RAW[`${M.k}_shuriken`]) RAW[`${M.k}_shuriken`] = { name: `${M.n} shuriken`, icon: '✴️', value: Math.round(30 * M.v), examine: `${M.n} throwing stars that skip from foe to foe.`,
    equip: { slot: 'weapon', combatType: 'ranged', noAmmo: true, req: { ranged: M.ra }, bonuses: { ranged: Math.round(8 * M.m), speed: 4 }, range: 8 } };
  // Sniper rifles (Sniper): the longest reach in the game and huge shots, fired slowly. No ammo.
  if (!RAW[`${M.k}_rifle`]) RAW[`${M.k}_rifle`] = { name: `${M.n} sniper rifle`, icon: '🎯', value: Math.round(40 * M.v), examine: `A long ${tag}-barrelled sniper rifle. One shot, one kill.`,
    equip: { slot: 'weapon', combatType: 'ranged', noAmmo: true, req: { ranged: M.ra }, bonuses: { ranged: Math.round(14 * M.m), speed: 8 }, range: 32 + Math.floor(M.ra / 40) } };   // the furthest in the game (longbows reach 9-10)
  if (!RAW[`${M.k}_cane`]) RAW[`${M.k}_cane`] = { name: `${M.n}-tipped cane`, icon: '🦯', value: Math.round(26 * M.v), examine: `A merchant's cane with ${aOrAn(tag)} tip, for flicking coins at foes. Every throw costs money.`,
    equip: { slot: 'weapon', combatType: 'ranged', noAmmo: true, coins: true, req: { ranged: M.ra }, bonuses: { ranged: Math.round(8 * M.m), speed: 4 }, range: 8 } };
}

// ---- Secondary weapon types, one per metal tier (see SECONDARY_WEAPON in classes.js); quivers are a ranged off-hand ----
for (const M of _METALS) {
  const add = (id, def) => { if (!RAW[id]) RAW[id] = def; };
  const { k, n, m, v } = M, r = M.ra, tag = n.toLowerCase(), R = Math.round;
  add(`${k}_parang`, { name: `${n} parang`, icon: '🔪', value: R(30 * v), examine: `A heavy ${tag} jungle parang: wide, chopping sweeps.`,
    equip: { slot: 'weapon', req: { attack: r }, bonuses: { attack: R(4 * m), strength: R(7 * m), speed: 5 }, range: MELEE_REACH } });
  add(`${k}_kerambit`, { name: `${n} kerambit`, icon: '🗡️', value: R(30 * v), examine: `A curved ${tag} kerambit. Quick, and best in pairs.`,
    equip: { slot: 'weapon', req: { attack: r }, bonuses: { attack: R(5 * m), strength: R(5 * m), speed: 4, crit: 5 }, range: MELEE_REACH } });
  add(`${k}_toya`, { name: `${n}-capped toya`, icon: '🥢', value: R(34 * v), examine: `A silat fighting staff with ${tag} caps. Guards as well as it strikes.`,
    equip: { slot: 'weapon', req: { attack: r }, bonuses: { attack: R(7 * m), strength: R(6 * m), defence: R(3 * m), speed: 5 }, range: MELEE_REACH } });
  add(`${k}_crossbow`, { name: `${n} crossbow`, icon: '🏹', value: R(40 * v), examine: `${AOrAn(tag)}-limbed crossbow. Its bolts punch through armour. No ammo needed.`,
    equip: { slot: 'weapon', combatType: 'ranged', noAmmo: true, req: { ranged: r }, bonuses: { ranged: R(11 * m), speed: 5 }, range: 10 } });
  add(`${k}_chakram`, { name: `${n} chakram`, icon: '⭕', value: R(32 * v), examine: `${AOrAn(tag)} throwing ring that bounces between foes. No ammo needed.`,
    equip: { slot: 'weapon', combatType: 'ranged', noAmmo: true, req: { ranged: r }, bonuses: { ranged: R(9 * m), speed: 4 }, range: 7 } });
  add(`${k}_orb`, { name: `${n} orb`, icon: '🔮', value: R(36 * v), examine: `A crystal orb in ${aOrAn(tag)} cage. Focused spells that hurt big foes.`,
    // Orbs cast at a staff's pace: slow below the dragon tier, quicker from it (as staves turn
    // quicker from about level 50-65), so their damage scale can sit just under a staff's.
    equip: { slot: 'weapon', combatType: 'magic', req: { magic: r }, bonuses: { magic: R(4 * m + 2), ...(r >= 15 ? { magicStr: R(r / 15) } : {}), speed: r >= 60 ? 4 : 5 } } });
  add(`${k}_fan`, { name: `${n} war fan`, icon: '🪭', value: R(30 * v), examine: `A dancer's kipas with ${tag} ribs: quick flicks up close.`,
    equip: { slot: 'weapon', combatType: 'dance', req: { agility: r }, bonuses: { dance: R(5 * m + 1), crit: 2 + Math.floor(r / 60), speed: 4 }, range: 2 } });
  add(`${k}_quiver`, { name: `${n}-studded quiver`, icon: '🎒', value: R(24 * v), examine: `A quiver with ${tag} studs: steadier, quicker shots.`,
    equip: { slot: 'shield', style: 'ranged', req: { ranged: r }, bonuses: { ranged: R(3 * m), atkPct: 2 * (1 + Math.floor(r / 60)), haste: 1 + Math.floor(r / 100) } } });
}

// ---- The Monk's fist weapons, one per metal tier ----
// Monk knuckles (the Monk's own type): quick jabs that crit. Monk gloves (its second
// type): heavier, slower palm strikes that get past armour and guard a little. They
// pair as one dual-wield kind (equipment.js dualType): knuckles punch from the main
// hand, gloves palm-strike from the off-hand. ("Monk gloves", as scout and mage
// gloves are already hand armour.)
for (const M of _METALS) {
  const add = (id, def) => { if (!RAW[id]) RAW[id] = def; };
  const { k, n, m, v } = M, r = M.ra, tag = n.toLowerCase(), R = Math.round;
  add(`${k}_knuckles`, { name: `${n} monk knuckles`, icon: '👊', value: R(30 * v), examine: `${n}-plated monk knuckles: quick jabs that find the weak spot. Wear monk gloves on the other hand.`,
    equip: { slot: 'weapon', req: { attack: r }, bonuses: { attack: R(6 * m), strength: R(5 * m), speed: 4, crit: 4 }, range: MELEE_REACH } });
  add(`${k}_monk_gloves`, { name: `${n} monk gloves`, icon: '🧤', value: R(32 * v), examine: `Wrapped monk gloves with ${tag} studs: heavy palm strikes that get past armour.`,
    equip: { slot: 'weapon', req: { attack: r }, bonuses: { attack: R(6 * m), strength: R(9 * m), defence: R(2 * m), speed: 4 }, range: MELEE_REACH } });
}

// A first hide body for archers (the studded body needs Ranged 20).
RAW.hide_vest = { name: 'Hide vest', icon: '🦺', value: 30, examine: 'A soft hide vest that leaves the arms free to draw a bow.',
  equip: { slot: 'body', req: { ranged: 1 }, bonuses: { ranged: 4, defence: 3 } } };

// ---- Light armour for the agile melee classes ----
// Rogues, Corsairs, Brawlers and Samurai wear scout gear instead of plate: about
// two thirds of plate's Defence, plus Attack and crit. One set per metal tier.
const _SCOUT = [['scout_hood', 'scout hood', 'head', 3, 1, 1, 22], ['scout_jerkin', 'scout jerkin', 'body', 6, 2, 2, 60], ['scout_breeches', 'scout breeches', 'legs', 5, 1, 1, 40]];
for (const M of _METALS) {
  for (const [t, label, slot, def, att, crit, v] of _SCOUT) {
    const id = `${M.k}_${t}`;
    if (RAW[id]) continue;
    RAW[id] = { name: `${M.n} ${label}`, icon: '🧥', value: Math.round(v * M.v), examine: `Light ${M.n.toLowerCase()}-studded leather for quick fighters.`,
      equip: { slot, req: { defence: M.rd }, bonuses: { defence: Math.round(def * M.m), attack: Math.round(att * M.m), crit } } };
  }
}

// ---- Boots and gloves for every armour family ----
// Metal boots and gauntlets are plate (pure Defence); the other families get
// their own at every metal tier: scout boots and gloves (Defence, Attack, crit),
// hide boots and vambraces (Ranged), and mage boots and gloves (Magic).
const _LIMBS = [
  ['scout_boots', 'scout boots', 'feet', 0.66, (m) => ({ attack: Math.max(1, Math.round(m * 0.5)), crit: 1 }), 'defence', 'Light studded boots for quick feet.', 26],
  ['scout_gloves', 'scout gloves', 'hands', 0.66, (m) => ({ attack: Math.max(1, Math.round(m)), crit: 1 }), 'defence', 'Studded leather gloves with a sure grip.', 28],
  ['hide_boots', 'hide boots', 'feet', 0.6, (m) => ({ ranged: Math.max(1, Math.round(m * 2)) }), 'ranged', 'Soft hide boots for a steady stance.', 26],
  ['hide_vambraces', 'hide vambraces', 'hands', 0.6, (m) => ({ ranged: Math.max(1, Math.round(m * 3)) }), 'ranged', 'Hide bracers that guard the bow arm.', 30],
  ['mage_boots', 'mage boots', 'feet', 0.5, (m) => ({ magic: Math.max(1, Math.round(m * 2)) }), 'magic', 'Woven boots humming with quiet power.', 26],
  ['mage_gloves', 'mage gloves', 'hands', 0.5, (m) => ({ magic: Math.max(1, Math.round(m * 3)), ...(m >= 7 ? { magicStr: 1 } : {}) }), 'magic', 'Silk gloves that steady a casting hand.', 30],
];
for (const M of _METALS) {
  for (const [t, label, slot, defShare, extra, reqSkill, examine, v] of _LIMBS) {
    const id = `${M.k}_${t}`;
    if (RAW[id]) continue;
    RAW[id] = { name: `${M.n} ${label}`, icon: slot === 'feet' ? '🥾' : '🧤', value: Math.round(v * M.v), examine,
      equip: { slot, req: { [reqSkill]: reqSkill === 'defence' ? M.rd : M.ra }, bonuses: { defence: Math.max(1, Math.round(3 * M.m * defShare)), ...extra(M.m) } } };
  }
}

// ---- Armour families ----
// Each class wears one family of helm, body and legs armour (see ARMOUR_FAMILY in
// classes.js): plate for heavy melee, scout leather for agile melee, hide for
// archers, robes for casters and dancewear for the Dancer, and the matching
// gloves and boots. Shields, capes and jewellery stay open to everyone, and so
// do a few special helms.
export const ARMOUR_SLOTS = ['head', 'body', 'legs', 'hands', 'feet'];
const ANY_ARMOUR = new Set(['slayer_helmet', 'champions_helm', 'blessed_halo']);
function armourFamily(id, eq) {
  if (!ARMOUR_SLOTS.includes(eq.slot) || ANY_ARMOUR.has(id)) return null;
  const b = eq.bonuses || {};
  if (b.dance) return 'dancewear';
  if (b.magic || b.magicStr) return 'robes';
  if (b.ranged) return 'hide';
  if (/_scout_/.test(id) || id === 'leather_body' || id === 'hydra_leather') return 'leather';
  return 'plate';
}
// Each family's own offensive stat, on every helm, body and legs piece, growing
// with the piece's level. Every family pierces armour as plate does (see below);
// on top of that scout leather sharpens crits, hide quickens your shots, robes
// add Magic bonus % and dancewear steals life.
// (Class balance: hide's power step was halved, as five pieces gave archers
// +60% damage on top of their haste at level 200; plate pierces a little more,
// since monster armour ate most of it; scout leather gained a little speed.)
// Hide's power is armour pierce now, as much as plate's (it was +1% Attack
// bonus a step). Boss armour (30-60%) took a third to a half off every arrow
// and bullet, while plate's pierce cancelled it, and gear upgrades grew that
// pierce (52 -> 80 at level 300) while hide's Attack bonus % was drowned out
// by enchant lines: Archers, Pistolers and Snipers took twice as long as a
// Swordsman over a real boss fight (tools/balance/bossfight.mjs) though the
// dummy lab, plain gear on lightly armoured dummies, had them level.
// Scout leather, robes and dancewear followed: their classes did 0.52-0.72 of the
// median class's damage in real level-1000 boss fights, every blow and spell
// losing a share to armour (spells meet armour just as blows do, and gear's pierce
// counts for them: Game._offensiveMods). They pierce at plate's rate too. Leather's
// crit damage and robes' Magic bonus % were halved to make room: with both in
// full, Rogues and Corsairs ran at 1.3-2 times the median class and casters 1.25-1.35.
const FAMILY_STAT = {
  plate: (r) => ({ pierce: 1 + Math.floor(r / 25) }),
  leather: (r) => ({ pierce: 1 + Math.floor(r / 25), critDmg: Math.round(1.5 * (1 + Math.floor(r / 30))), haste: Math.floor(r / 75) }),
  hide: (r) => ({ pierce: 1 + Math.floor(r / 25), haste: 1 + Math.floor(r / 60) }),   // arrows that punch through, and quick hands
  robes: (r) => ({ pierce: 1 + Math.floor(r / 25), magPct: 1 + Math.floor(r / 30) }),   // casters' Magic bonus %
  dancewear: (r) => ({ pierce: 1 + Math.floor(r / 25), lifesteal: 1 + Math.floor(r / 60) }),
};
for (const [id, it] of Object.entries(RAW)) {
  const eq = it.equip;
  if (!eq) continue;
  const fam = armourFamily(id, eq);
  if (!fam) continue;
  eq.family = fam;
  const req = Math.max(1, ...Object.values(eq.req || {}));
  eq.bonuses = { ...(eq.bonuses || {}), ...FAMILY_STAT[fam](req) };
}

// Freeze each definition and attach its id for convenience.
// ---- Weapon types (one per job class) ----
// Every weapon belongs to exactly one type; a job class can only wield its own.
export const WEAPON_TYPES = ['dagger', 'sword', 'scimitar', 'mace', 'longsword', 'battleaxe', 'warhammer', '2h_sword', 'spear', 'claws', 'katana', 'halberd',
  'shortbow', 'longbow', 'staff', 'wand', 'whip', 'pistol', 'shuriken', 'cane', 'rifle',
  'knuckles'];   // (newer classes' types go on the end: MELEE_FAMILIES takes the first 12)
const UNIQUE_TYPE = { tiger_kris: 'dagger', merlion_blade: 'sword', cursed_cutlass: 'scimitar', seraph_blade: 'longsword', megalodon_jaw: 'battleaxe',
  granite_maul: 'warhammer', void_blade: 'katana', leviathan_trident: 'spear', tiger_fang: 'claws' };
// Secondary weapon types: no class of their own; each class wields one (SECONDARY_WEAPON in classes.js).
export const SECONDARY_WEAPON_TYPES = ['parang', 'kerambit', 'toya', 'crossbow', 'chakram', 'orb', 'fan', 'monk_gloves'];
// Each type once, though a type may be one class's own and another's second (a Set keeps the order).
export const ALL_WEAPON_TYPES = [...new Set([...WEAPON_TYPES, ...SECONDARY_WEAPON_TYPES])];
const MELEE_FAMILIES = [...WEAPON_TYPES.slice(0, 12), 'parang', 'kerambit', 'toya', 'knuckles', 'monk_gloves'].sort((a, b) => b.length - a.length);   // '2h_sword' before 'sword'
function classifyWeapon(id, eq) {
  if (UNIQUE_TYPE[id]) return UNIQUE_TYPE[id];
  if (eq.combatType === 'dance') return /_fan$/.test(id) ? 'fan' : 'whip';
  if (eq.combatType === 'magic') return /_orb$/.test(id) ? 'orb' : /wand$/.test(id) ? 'wand' : 'staff';
  if (eq.combatType === 'ranged' && /_cane$/.test(id)) return 'cane';
  if (eq.combatType === 'ranged' && /_rifle$/.test(id)) return 'rifle';
  if (eq.combatType === 'ranged' && /_crossbow$/.test(id)) return 'crossbow';
  if (eq.combatType === 'ranged' && /_chakram$/.test(id)) return 'chakram';
  if (eq.combatType === 'ranged') return /_pistol$/.test(id) ? 'pistol' : /_shuriken$/.test(id) ? 'shuriken' : /longbow$/.test(id) ? 'longbow' : 'shortbow';
  if (/_cane$/.test(id)) return 'cane';
  return MELEE_FAMILIES.find((f) => id.endsWith('_' + f)) || null;
}
// Boss signature weapons (see bossWeapons.js): one per boss, each a stronger
// copy of its class's plain weapon at the boss's tier. Added before the weapons
// are classified, so they get their type's usual stat and attack speed too.
const _SIG = signatureWeapons(RAW, classifyWeapon, new Set(Object.keys(UNIQUE_TYPE)));
Object.assign(RAW, _SIG.items);
Object.assign(UNIQUE_TYPE, _SIG.types);
// Shortbows are close-range bows: a quarter of the reach they had, but every
// shot looses a spread of three arrows (see SHORTBOW_ARROWS in game.js).
export const SHORTBOW_RANGE_MULT = 0.25;
// ...plus this many tiles (asked for 1.5; reach is counted in whole tiles, so 2).
export const SHORTBOW_RANGE_ADD = 2;
// Longbows reach LONGBOW_RANGE tiles, LONGBOW_RANGE_LATE from Ranged
// LONGBOW_LATE_LEVEL (the orichalcum tier) on. They used to reach 15-28 tiles
// (33 with the Long Shot perk): the owner found that far too far. Now they
// out-reach the shortbow of the same tier by 1-3 tiles, magic (8) by 1-2 and
// pistols (7) by 2-3, a modest edge that keeps the longbow's identity.
export const LONGBOW_RANGE = 9;
export const LONGBOW_RANGE_LATE = 10;
export const LONGBOW_LATE_LEVEL = 100;
for (const [id, it] of Object.entries(RAW)) {
  if (it.equip?.slot === 'weapon' && !it.tool) it.equip.weaponType = classifyWeapon(id, it.equip);
  if (it.equip?.weaponType === 'shortbow' && it.equip.range) it.equip.range = Math.max(3, Math.round(it.equip.range * SHORTBOW_RANGE_MULT)) + SHORTBOW_RANGE_ADD;
  if (it.equip?.weaponType === 'longbow') it.equip.range = (it.equip.req?.ranged || 1) >= LONGBOW_LATE_LEVEL ? LONGBOW_RANGE_LATE : LONGBOW_RANGE;
  // Every spear (uniques and boss signatures too) reaches SPEAR_REACH tiles.
  if (it.equip?.weaponType === 'spear') it.equip.range = Math.max(it.equip.range || 0, SPEAR_REACH);
}

// ---- Offensive stats on weapons, jewellery, capes and boss uniques ----
// Each weapon type leans on the stat that suits it (daggers find gaps for
// bigger crits, maces crack armour, bows and pistols fire faster...), growing
// gently with the weapon's level. All in percent, kept modest so armour,
// jewellery and weapon can stack together without any one piece dominating.
const WEAPON_STAT = {
  dagger: 'critDmg', claws: 'critDmg', katana: 'critDmg', rifle: 'critDmg', shuriken: 'atkPct', shortbow: 'atkPct', pistol: 'atkPct',
  mace: 'pierce', warhammer: 'pierce', spear: 'pierce', longsword: 'pierce', longbow: 'pierce',
  '2h_sword': 'bossDmg', halberd: 'bossDmg', battleaxe: 'atkPct', staff: 'magPct', wand: 'magPct', sword: 'atkPct',
  scimitar: 'lifesteal', whip: 'lifesteal', cane: 'lifesteal',
  parang: 'bossDmg', kerambit: 'critDmg', toya: 'pierce', crossbow: 'pierce', chakram: 'atkPct', orb: 'bossDmg', fan: 'critDmg',
  knuckles: 'critDmg', monk_gloves: 'pierce',
};
// Size of one "step" of each stat (critDmg and bossDmg run bigger numbers).
const STAT_STEP = { critDmg: 3, bossDmg: 2, pierce: 1, haste: 1, lifesteal: 1, atkPct: 2, magPct: 2 };
const reqOf = (eq) => Math.max(1, ...Object.values(eq.req || {}));
for (const it of Object.values(RAW)) {
  const eq = it.equip;
  const k = eq && eq.slot === 'weapon' && !it.tool && WEAPON_STAT[eq.weaponType];
  if (!k) continue;
  // One step at level 1, one more every 40 levels (haste and lifesteal every 60).
  const steps = 1 + Math.floor(reqOf(eq) / (k === 'haste' || k === 'lifesteal' ? 60 : 40));
  eq.bonuses = { ...eq.bonuses, [k]: (eq.bonuses[k] || 0) + steps * STAT_STEP[k] };
}
// Every weapon also carries attack speed %: 2% at level 1, +1% every 15 levels
// (now uncapped, so it keeps paying off on top-tier gear).
for (const it of Object.values(RAW)) {
  const eq = it.equip;
  if (!eq || eq.slot !== 'weapon' || it.tool || !eq.combatType && !eq.weaponType) continue;
  eq.bonuses = { ...eq.bonuses, haste: (eq.bonuses.haste || 0) + 2 + Math.floor(reqOf(eq) / 15) };
}
// Hand-picked extras for jewellery, capes and the boss uniques: each one's flavour.
const OFFENCE_EXTRA = {
  // Rings and amulets
  gold_ring: { critDmg: 2 }, sapphire_ring: { haste: 1 }, emerald_ring: { lifesteal: 1 }, ruby_ring: { pierce: 2 },
  diamond_ring: { critDmg: 6 }, ring_of_kampong: { bossDmg: 3 }, ring_of_might: { pierce: 3 }, slayer_ring: { bossDmg: 4, critDmg: 4 },
  amulet_of_power: { critDmg: 3 }, gold_amulet: { lifesteal: 1 }, sapphire_amulet: { haste: 1 }, emerald_amulet: { lifesteal: 1 },
  ruby_amulet: { pierce: 2 }, diamond_amulet: { critDmg: 6 }, merlion_amulet: { bossDmg: 5, lifesteal: 1 }, boar_tusk: { pierce: 2 },
  worthy_sigil: { bossDmg: 4 }, amulet_of_strength: { critDmg: 4 }, amulet_of_glory: { critDmg: 4, haste: 1 },
  djinn_lamp: { bossDmg: 6 }, merdeka_medallion: { haste: 2, critDmg: 4 }, occult_necklace: { bossDmg: 8 },
  // Capes and sashes
  batik_cape: { haste: 1 }, songket_cape: { critDmg: 3 }, warlord_cape: { pierce: 3, bossDmg: 3 }, fire_cape: { bossDmg: 6, critDmg: 4 },
  garuda_wings: { haste: 3 }, revenant_cape: { lifesteal: 2 }, champions_cape: { bossDmg: 5, critDmg: 5 }, shadow_cloak: { critDmg: 8 },
  silk_sash: { lifesteal: 1 }, golden_sash: { lifesteal: 2 }, jade_sash: { lifesteal: 2, haste: 1 }, eternal_sash: { lifesteal: 3, haste: 2 },
  // Boss uniques
  tiger_kris: { critDmg: 12, lifesteal: 1 }, merlion_blade: { bossDmg: 10, lifesteal: 2 }, cursed_cutlass: { lifesteal: 4, haste: 2 },
  seraph_blade: { pierce: 6, bossDmg: 6 }, megalodon_jaw: { bossDmg: 12, critDmg: 6 }, granite_maul: { pierce: 10 },
  void_blade: { critDmg: 15, pierce: 3 }, leviathan_trident: { pierce: 8, bossDmg: 6 }, tiger_fang: { critDmg: 14, haste: 2 },
  slayer_helmet: { bossDmg: 6, critDmg: 4 }, champions_helm: { bossDmg: 4, pierce: 2 }, blessed_halo: { lifesteal: 1, bossDmg: 2 },
  kampong_gauntlets: { pierce: 2, critDmg: 3 }, island_aegis: { lifesteal: 1 },
};
Object.assign(OFFENCE_EXTRA, _SIG.extras);   // each signature weapon's two extras
for (const [id, extra] of Object.entries(OFFENCE_EXTRA)) {
  const eq = RAW[id]?.equip;
  if (!eq) continue;
  const b = { ...(eq.bonuses || {}) };
  for (const [k, v] of Object.entries(extra)) b[k] = (b[k] || 0) + v;
  eq.bonuses = b;
}

// ---- The two-handed grip ----
// Two-handed weapons need both hands, so their wielders can never hold a shield,
// buckler or quiver (see isTwoHanded in equipment.js). To make up for the empty
// off-hand, each one carries what a same-tier off-hand would give: the
// kiteshield's Defence and bonus life, plus the buckler's offensive extras
// (melee) or the quiver's (bows, crossbows and rifles). The tier is the
// weapon's metal; wooden bows, boss uniques and signature weapons take the
// metal whose level is closest to theirs. Read straight from those shield-slot
// items, so the grip keeps in step if they are retuned. The grip is part of the
// weapon's bonuses (tooltips, Equip best and the Stats tab all see it) and is
// also kept as `grip` so the tooltip can name it.
export const TWO_HANDED_TYPES = new Set(['longbow', 'shortbow', 'crossbow', 'rifle', 'katana', 'warhammer', '2h_sword', 'halberd', 'claws']);
// The Archer's shortbow and the Ranger's longbow are drawn from a quiver at the
// hip, so a quiver (and nothing else) may sit in the off-hand with them. Their
// grip keeps only the kiteshield's share (Defence and life): the quiver's share
// now comes from a real quiver instead of being built in.
export const QUIVER_BOW_TYPES = new Set(['shortbow', 'longbow']);
const _metalOf = (id, eq) => _METALS.find((M) => id.startsWith(M.k + '_'))
  || _METALS.reduce((best, M) => (Math.abs(M.rd - reqOf(eq)) < Math.abs(best.rd - reqOf(eq)) ? M : best));
/** The grip bonus a two-handed weapon of metal tier M gets. */
export function gripBonus(M, ranged, quiverBow = false) {
  const kite = RAW[`${M.k}_kiteshield`].equip.bonuses;
  if (quiverBow) return { defence: kite.defence, hp: kite.hp };
  const off = ranged ? RAW[`${M.k}_quiver`].equip.bonuses : RAW[`${M.k}_buckler`].equip.bonuses;
  const g = { defence: kite.defence, hp: kite.hp, atkPct: off.atkPct, haste: off.haste };
  if (ranged) g.ranged = off.ranged;
  return g;
}
for (const [id, it] of Object.entries(RAW)) {
  const eq = it.equip;
  if (!eq || eq.slot !== 'weapon' || it.tool || !TWO_HANDED_TYPES.has(eq.weaponType)) continue;
  const grip = gripBonus(_metalOf(id, eq), eq.combatType === 'ranged', QUIVER_BOW_TYPES.has(eq.weaponType));
  const b = { ...eq.bonuses };
  for (const [k, v] of Object.entries(grip)) b[k] = (b[k] || 0) + v;
  eq.bonuses = b;
  eq.grip = { ...grip, tier: _metalOf(id, eq).k };
}

// ---- Accessories: each one suits a single fighting style ----
// Every amulet, ring and cape now belongs to melee, ranged or magic, and each
// style gets a matching ladder of power P (3, 6, 10, 14, 20 for amulets;
// 2, 5, 8 for rings; 3, 6, 10 for capes), so no style is short-changed.
// P turns into that style's stats, worth the same in a fight:
//   melee  +P Attack, +P Strength (and +P Dance: the Dancer fights up close too)
//   ranged +1.5P Ranged (only half the Ranged bonus counts towards damage)
//   magic  +P Magic, +P/4 magic damage (each point is a full extra max hit)
// Defence, HP, crit and the offensive stats (pierce, crit damage, haste,
// lifesteal, boss damage) stay as they were. Dancer sashes keep their stats.
export const ACCESSORY_SLOTS = ['amulet', 'ring', 'cape'];
export const ACCESSORY_STYLE = {
  // Amulets
  gold_amulet: ['melee', 3], amulet_of_power: ['melee', 6], amulet_of_strength: ['melee', 10], ruby_amulet: ['melee', 14], worthy_sigil: ['melee', 20],
  emerald_amulet: ['ranged', 3], merdeka_medallion: ['ranged', 6], boar_tusk: ['ranged', 10], amulet_of_glory: ['ranged', 14], merlion_amulet: ['ranged', 20],
  sapphire_amulet: ['magic', 6], diamond_amulet: ['magic', 10], djinn_lamp: ['magic', 14], occult_necklace: ['magic', 20],
  pearl_amulet: ['magic', 3],
  // Rings
  gold_ring: ['melee', 2], ruby_ring: ['melee', 5], ring_of_might: ['melee', 8],
  emerald_ring: ['ranged', 2], ring_of_kampong: ['ranged', 5], slayer_ring: ['ranged', 8],
  sapphire_ring: ['magic', 5], diamond_ring: ['magic', 8],
  pearl_ring: ['magic', 2],
  // Capes
  batik_cape: ['melee', 3], warlord_cape: ['melee', 6], fire_cape: ['melee', 10],
  trades_cape: ['ranged', 3], garuda_wings: ['ranged', 6], shadow_cloak: ['ranged', 10],
  songket_cape: ['magic', 3], revenant_cape: ['magic', 6], champions_cape: ['magic', 10],
};
/** Accessories that suit a monster or boss of this level: the ladder rungs
 *  around its power band (level 1 drops P 2-3 pieces, level 100 up to P 10ish,
 *  level 200+ the P 20 ones). Optionally only one fighting style. */
export function accessoriesFor(level, style = null) {
  // (minP stops at 7 so the best rings, P 8, and capes, P 10, keep dropping at high levels.)
  const maxP = 3 + (level || 1) / 12, minP = Math.min(7, maxP * 0.35);
  return Object.entries(ACCESSORY_STYLE).filter(([, [st, P]]) => P <= maxP && P >= minP && (!style || st === style)).map(([id]) => id);
}

/** The fighting stats an accessory of `style` and power `P` gives. */
export function accessoryStats(style, P) {
  if (style === 'ranged') return { ranged: Math.round(P * 1.5) };
  if (style === 'magic') return { magic: P, magicStr: Math.max(1, Math.round(P / 4)) };
  return { attack: P, strength: P, dance: P };
}
const FIGHT_KEYS = ['attack', 'strength', 'ranged', 'magic', 'magicStr', 'dance'];
for (const [id, [style, P]] of Object.entries(ACCESSORY_STYLE)) {
  const eq = RAW[id]?.equip;
  if (!eq) continue;
  const b = { ...(eq.bonuses || {}) };
  for (const k of FIGHT_KEYS) delete b[k];
  eq.bonuses = { ...b, ...accessoryStats(style, P) };
  eq.style = style;
}

// ---- Endgame jewellery (Crafting 100-300) ----
// Crafted from the endgame ores and bars (crafting.js), never dropped (so they
// stay out of ACCESSORY_STYLE and the loot tables). Each suits every fighting
// style: it carries all three styles' stats at power P, a little above the
// best styled piece (P 20 amulets, P 8 rings), plus one offensive stat of its
// own, kept below the boss uniques'. Worn from the Defence level of its tier.
// id, name, slot, level, P, its own stat, value, examine
export const ENDGAME_JEWELLERY = [
  ['obsidian_ring', 'Obsidian ring', 'ring', 100, 9, { critDmg: 9 }, 400000, 'A band of polished obsidian, edged like a blade. Its crits cut deeper.'],
  ['orichalcum_amulet', 'Orichalcum amulet', 'amulet', 130, 22, { pierce: 5 }, 800000, 'A coppery-gold torc. Blows struck by its wearer split armour.'],
  ['jade_ring', 'Jade ring', 'ring', 160, 10, { lifesteal: 3 }, 1500000, 'An imperial jade ring, cool against the skin. It drinks a little of every wound.'],
  ['star_amulet', 'Star amulet', 'amulet', 200, 24, { crit: 4 }, 3000000, 'A star sapphire cut from fallen starmetal. It finds the weak spot for you.'],
  ['celestial_ring', 'Celestial ring', 'ring', 250, 11, { haste: 4 }, 6000000, 'A skyglass ring, light as air. Your hands move quicker for it.'],
  ['eternal_amulet', 'Eternal amulet', 'amulet', 300, 26, { atkPct: 6, magPct: 6 }, 12000000, 'Eternal gold that never tarnishes. Every blow and spell lands harder.'],
];
for (const [id, name, slot, lvl, P, extra, value, examine] of ENDGAME_JEWELLERY) {
  RAW[id] = { name, icon: slot === 'ring' ? '💍' : '📿', value, examine,
    equip: { slot, req: { defence: lvl }, bonuses: { ...accessoryStats('melee', P), ...accessoryStats('ranged', P), ...accessoryStats('magic', P), ...extra } } };
}

// ---- Prayer accessories: no fighting stats, but Faith fills faster (bonus `prayer`, see blessings.js gainFaith) ----
export const PRAYER_GEAR = [
  // id, name, slot, Prayer level, prayer, defence, hp, value, examine
  ['holy_beads', 'Holy beads', 'amulet', 10, 4, 2, 0, 800, 'Pearl beads worn smooth by quiet prayer.'],
  ['ring_of_devotion', 'Ring of devotion', 'ring', 20, 3, 0, 3, 1500, 'A gold band set with a single pearl.'],
  ['pilgrim_cape', 'Pilgrim cape', 'cape', 30, 5, 4, 0, 4000, 'A plain travelling cape that keeps the spirit steady.'],
  ['temple_pendant', 'Temple pendant', 'amulet', 45, 8, 5, 6, 20000, 'Warm to the touch, like incense smoke.'],
  ['ring_of_serenity', 'Ring of serenity', 'ring', 60, 6, 0, 8, 45000, 'Calm settles over you while you wear it.'],
  ['lantern_cape', 'Lantern cape', 'cape', 70, 10, 8, 10, 90000, 'Mid-Autumn lanterns glow along its hem.'],
  ['starlit_pendant', 'Starlit pendant', 'amulet', 85, 14, 10, 15, 250000, 'A pendant holding a little piece of the night sky.'],
];
for (const [id, name, slot, lvl, prayer, defence, hp, value, examine] of PRAYER_GEAR) {
  if (RAW[id]) continue;
  const bonuses = { prayer }; if (defence) bonuses.defence = defence; if (hp) bonuses.hp = hp;
  RAW[id] = { name, icon: slot === 'ring' ? '💍' : slot === 'cape' ? '🧣' : '📿', value, examine, equip: { slot, req: { prayer: lvl }, bonuses } };
}

// ---- Pest Control (src/game/culling.js): its tokens, and the token shop's own goods ----
Object.assign(RAW, {
  pest_token: { name: 'Pest Control token', icon: '🪙', value: 1, stackable: true, examine: 'Paid by Officer Aziz for clearing pests. Spend them at his token shop.' },
  hunter_bait: { name: 'Hunter bait', icon: '🪱', value: 3, stackable: true, examine: 'A smelly lure. One is used per trap catch: more Hunter XP, and sometimes a second catch.' },
  forager_lamp: { name: 'Forager\'s lamp', icon: '🪔', value: 1, examine: 'Rub it for experience in a gathering skill of your choice.' },
  codex_quill: { name: 'Codex quill', icon: '🪶', value: 1, examine: 'Read it and your next 200 kills count double towards codex mastery.' },
  // No fighting stats, so it suits every style: it keeps the bugs off while you hunt.
  mosquito_net_cape: { name: 'Mosquito-net cape', icon: '🧣', value: 1, examine: 'Fine netting worn as a cape. +5% Hunter XP while worn.',
    equip: { slot: 'cape', req: {}, bonuses: { defence: 3, hp: 2 } } },
});

// ---- Tiered gathering tools (tooltiers.js) ----
// The old tier-1 tool of each kind gets its tier marked; the iron to eternal
// ones are built here. Axes and pickaxes can be wielded, as the bronze ones
// can (with a little more bite each tier, still far below a real weapon).
for (const K of TOOL_KINDS) {
  TOOL_TIERS.forEach((T, i) => {
    const id = toolId(K.tag, i);
    const M = T.metal[0].toUpperCase() + T.metal.slice(1);
    const how = toolBonusText(T);
    const tier = { tool: K.tag, toolTier: i, toolLevel: T.level, toolSkill: K.skill, toolBase: K.base, toolMetal: T.metal };
    if (RAW[id]) { Object.assign(RAW[id], tier); return; }
    const base = RAW[K.base];
    const it = { name: K.name(M), icon: base.icon, value: base.value * T.value, ...tier,
      examine: `${base.examine} ${M}: ${K.skill[0].toUpperCase() + K.skill.slice(1)} ${T.level} to use; ${how}. The best tool you can use is picked for you.` };
    if (base.equip) it.equip = { slot: 'weapon', req: { attack: 1 }, bonuses: { ...base.equip.bonuses, attack: base.equip.bonuses.attack + i, strength: base.equip.bonuses.strength + i } };
    RAW[id] = it;
  });
}

// ---- Stronger rings and amulets ----
// The owner found jewellery too weak to matter (an eternal amulet gave +26
// Attack next to eternal mage gloves' +120 Magic). Every ring and amulet's
// fighting stats count JEWELLERY_MULT times, its Defence and life
// JEWELLERY_GUARD_MULT times and its offensive extras and Magic damage
// JEWELLERY_EXTRA_MULT times (Magic damage weighs eight times a point of
// Magic, so it rises less; at 2.5x a level-300 Wizard felled bosses in about a
// minute). Rounded, at least 1 where there was any. Prayer stays as it was.
export const JEWELLERY_MULT = 2, JEWELLERY_GUARD_MULT = 2, JEWELLERY_EXTRA_MULT = 1.5;
const JEWEL_FIGHT = ['attack', 'strength', 'ranged', 'magic', 'dance'];
const JEWEL_GUARD = ['defence', 'hp'];
const JEWEL_EXTRA = ['magicStr', 'crit', 'critDmg', 'pierce', 'lifesteal', 'haste', 'bossDmg', 'atkPct', 'magPct'];
for (const it of Object.values(RAW)) {
  const eq = it.equip;
  if (!eq || (eq.slot !== 'ring' && eq.slot !== 'amulet')) continue;
  const b = { ...(eq.bonuses || {}) };
  const scale = (keys, m) => { for (const k of keys) if (b[k]) b[k] = Math.max(1, Math.round(b[k] * m)); };
  scale(JEWEL_FIGHT, JEWELLERY_MULT); scale(JEWEL_GUARD, JEWELLERY_GUARD_MULT); scale(JEWEL_EXTRA, JEWELLERY_EXTRA_MULT);
  eq.bonuses = b;
}

export const ITEMS = Object.fromEntries(
  Object.entries(RAW).map(([id, def]) => [id, Object.freeze({ id, ...def })])
);

export function getItem(id) {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown item id: ${id}`);
  return item;
}

export function isStackable(id) {
  return !!ITEMS[id]?.stackable;
}
