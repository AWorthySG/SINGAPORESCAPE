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

const RAW = {
  // ---- Currency ----
  coins: { name: 'Coins', icon: '🪙', value: 1, stackable: true, maxStack: Infinity, examine: 'Lovely money!' },

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
  bones: { name: 'Bones', icon: '🦴', value: 1, examine: 'Ew, it\'s a pile of bones.' },
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
  emerald_amulet: { name: 'Emerald amulet', icon: '📿', value: 2600, examine: 'An amulet set with an emerald.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 5, strength: 5, defence: 5 } } },
  ruby_amulet: { name: 'Ruby amulet', icon: '📿', value: 6000, examine: 'An amulet set with a ruby.',
    equip: { slot: 'amulet', req: {}, bonuses: { strength: 11 } } },
  diamond_amulet: { name: 'Diamond amulet', icon: '📿', value: 12000, examine: 'An amulet set with a diamond.',
    equip: { slot: 'amulet', req: {}, bonuses: { attack: 9, strength: 9, defence: 9 } } },
  granite_shield: { name: 'Granite shield', icon: '🛡️', value: 9000, examine: 'A heavy shield carved from granite.',
    equip: { slot: 'shield', req: { defence: 45 }, bonuses: { defence: 22, strength: 3 } } },
  steel_bar: { name: 'Steel bar', icon: '⬜', value: 200, examine: 'A bar of steel.' },
  mithril_bar: { name: 'Mithril bar', icon: '🟦', value: 324, examine: 'A bar of mithril.' },
  adamant_bar: { name: 'Adamant bar', icon: '🟩', value: 800, examine: 'A bar of adamantite.' },
  rune_bar: { name: 'Runite bar', icon: '🟦', value: 3200, examine: 'A bar of runite.' },

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
    equip: { slot: 'cape', req: { defence: 40 }, bonuses: { attack: 6, strength: 8, defence: 8 } } },

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
    equip: { slot: 'head', req: { defence: 30 }, bonuses: { attack: 6, defence: 16 } } },
  island_aegis: { name: 'Island aegis', icon: '🛡️', value: 40000, examine: 'A bulwark awarded to a true Island Defender.',
    equip: { slot: 'shield', req: { defence: 40 }, bonuses: { strength: 5, defence: 24 } } },
  slayer_helmet: { name: 'Slayer helmet', icon: '💀', value: 45000, examine: 'A fearsome helm prized by slayers — boosts all combat.',
    equip: { slot: 'head', req: { defence: 10 }, bonuses: { attack: 10, strength: 8, defence: 14, ranged: 8, magic: 8 } } },
  slayer_ring: { name: 'Slayer ring', icon: '💍', value: 8000, examine: 'A ring etched with slayer runes.',
    equip: { slot: 'ring', req: {}, bonuses: { attack: 5, strength: 5, defence: 3 } } },
  trades_cape: { name: 'Trades cape', icon: '🧣', value: 30000, examine: 'Awarded by Cikgu Surya to a Master of Trades.',
    equip: { slot: 'cape', req: {}, bonuses: { attack: 4, strength: 4, defence: 6 } } },
  champions_cape: { name: "Champion's cape", icon: '🧣', value: 200000, examine: 'Only the Champion of Singapore may wear it.',
    equip: { slot: 'cape', req: { defence: 40 }, bonuses: { attack: 10, strength: 10, defence: 14, ranged: 8, magic: 8 } } },
  mark_of_grace: { name: 'Mark of grace', icon: '🪶', value: 40, stackable: true, examine: 'A token of agility — use it to catch your breath (restore run energy).' },

  // ---- Alignment arc rewards ----
  blessed_halo: { name: 'Blessed halo', icon: '😇', value: 80000, examine: 'A radiant halo earned through redemption.',
    equip: { slot: 'head', req: {}, bonuses: { defence: 12, magic: 8, strength: 2 } } },
  shadow_cloak: { name: 'Shadow cloak', icon: '🦇', value: 80000, examine: 'A cloak woven from darkness, granted to the corrupted.',
    equip: { slot: 'cape', req: {}, bonuses: { attack: 10, strength: 10, defence: 3 } } },
  seraph_blade: { name: 'Seraph blade', icon: '🗡️', value: 250000, examine: 'A radiant blade dropped by the Lion of Light.',
    equip: { slot: 'weapon', req: { attack: 40 }, bonuses: { attack: 72, strength: 68, defence: 6, magic: 10, speed: 4 } } },
  void_blade: { name: 'Void blade', icon: '🗡️', value: 260000, examine: 'A blade of pure darkness from the Shadow Sovereign.',
    equip: { slot: 'weapon', req: { attack: 50 }, bonuses: { attack: 88, strength: 84, defence: 2, speed: 4 } } },

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
    equip: { slot: 'weapon', combatType: 'ranged', req: { ranged: 1 }, bonuses: { ranged: 8, speed: 3 } } },
  oak_shortbow: { name: 'Oak shortbow', icon: '🏹', value: 120, examine: 'A shortbow of oak.',
    equip: { slot: 'weapon', combatType: 'ranged', req: { ranged: 5 }, bonuses: { ranged: 14, speed: 3 } } },
  willow_shortbow: { name: 'Willow shortbow', icon: '🏹', value: 400, examine: 'A springy willow bow.',
    equip: { slot: 'weapon', combatType: 'ranged', req: { ranged: 20 }, bonuses: { ranged: 24, speed: 3 } } },
  maple_shortbow: { name: 'Maple shortbow', icon: '🏹', value: 900, examine: 'A fine maple bow.',
    equip: { slot: 'weapon', combatType: 'ranged', req: { ranged: 30 }, bonuses: { ranged: 34, speed: 3 } } },
  yew_shortbow: { name: 'Yew shortbow', icon: '🏹', value: 2400, examine: 'A powerful yew bow.',
    equip: { slot: 'weapon', combatType: 'ranged', req: { ranged: 40 }, bonuses: { ranged: 48, speed: 3 } } },
  magic_shortbow: { name: 'Magic shortbow', icon: '🏹', value: 9000, examine: 'A swift bow of enchanted wood.',
    equip: { slot: 'weapon', combatType: 'ranged', req: { ranged: 50 }, bonuses: { ranged: 62, speed: 2 } } },
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
];
const _WEAPONS = [
  ['dagger', 'dagger', 4, 3, 4, 10], ['sword', 'sword', 5, 5, 5, 26], ['scimitar', 'scimitar', 7, 6, 4, 32],
  ['mace', 'mace', 6, 7, 5, 30], ['longsword', 'longsword', 9, 8, 5, 40], ['battleaxe', 'battleaxe', 10, 11, 6, 52],
  ['warhammer', 'warhammer', 8, 12, 6, 54], ['2h_sword', '2h sword', 14, 15, 7, 80],
];
const _ARMOURS = [
  ['med_helm', 'med helm', 'head', 4, 0, 18], ['full_helm', 'full helm', 'head', 6, 0, 44],
  ['chainbody', 'chainbody', 'body', 8, 0, 64], ['platebody', 'platebody', 'body', 12, 0, 100],
  ['platelegs', 'platelegs', 'legs', 10, 0, 64], ['sq_shield', 'sq shield', 'shield', 6, 0, 48],
  ['kiteshield', 'kiteshield', 'shield', 9, 0, 84], ['gauntlets', 'gauntlets', 'hands', 3, 1, 30],
  ['boots', 'boots', 'feet', 3, 0, 28],
];
for (const M of _METALS) {
  for (const [t, label, att, str, spd, v] of _WEAPONS) {
    const id = `${M.k}_${t}`;
    if (RAW[id]) continue;
    RAW[id] = { name: `${M.n} ${label}`, icon: '⚔️', value: Math.round(v * M.v), examine: `A ${M.n.toLowerCase()} ${label}.`,
      equip: { slot: 'weapon', req: { attack: M.ra }, bonuses: { attack: Math.round(att * M.m), strength: Math.round(str * M.m), speed: spd } } };
  }
  for (const [t, label, slot, def, att, v] of _ARMOURS) {
    const id = `${M.k}_${t}`;
    if (RAW[id]) continue;
    const bonuses = { defence: Math.round(def * M.m) };
    if (att) bonuses.attack = att;
    RAW[id] = { name: `${M.n} ${label}`, icon: '🛡️', value: Math.round(v * M.v), examine: `${M.n} ${label}.`,
      equip: { slot, req: { defence: M.rd }, bonuses } };
  }
}

// Weapon special attacks (the spec bar). Attached after generation so the tiered
// Dragon weapons can carry specs too. acc/dmg are multipliers; hits = swings;
// heal = fraction of damage returned as health.
const WEAPON_SPECS = {
  dragon_dagger: { name: 'Puncture', cost: 25, acc: 1.5, dmg: 1.15, hits: 2 },
  dragon_scimitar: { name: 'Sever', cost: 40, acc: 2.0, dmg: 1.25 },
  dragon_longsword: { name: 'Cleave', cost: 35, acc: 1.5, dmg: 1.3 },
  dragon_mace: { name: 'Crush', cost: 35, acc: 1.6, dmg: 1.35 },
  dragon_battleaxe: { name: 'Rampage', cost: 50, acc: 1.2, dmg: 1.7 },
  dragon_2h_sword: { name: 'Devastate', cost: 55, acc: 1.25, dmg: 1.7 },
  merlion_blade: { name: 'Tide Strike', cost: 50, acc: 2.0, dmg: 1.5, heal: 0.2 },
  tiger_fang: { name: 'Maul', cost: 40, acc: 1.6, dmg: 1.4 },
  tiger_kris: { name: 'Flurry', cost: 25, acc: 1.4, dmg: 1.1, hits: 2 },
  cursed_cutlass: { name: 'Plunder', cost: 45, acc: 1.5, dmg: 1.5, heal: 0.3 },
  megalodon_jaw: { name: 'Devour', cost: 55, acc: 1.4, dmg: 1.7, heal: 0.25 },
  leviathan_trident: { name: 'Riptide', cost: 50, acc: 1.6, dmg: 1.45, heal: 0.4 },
  // ranged
  yew_shortbow: { name: 'Pinpoint Shot', cost: 40, acc: 2.5, dmg: 1.25 },
  magic_shortbow: { name: 'Rapid Volley', cost: 50, acc: 1.3, dmg: 1.15, hits: 2 },
  // magic
  mystic_staff: { name: 'Spell Echo', cost: 45, acc: 1.4, dmg: 1.5 },
  ancient_staff: { name: 'Arcane Surge', cost: 55, acc: 1.5, dmg: 1.8 },
};
for (const [id, spec] of Object.entries(WEAPON_SPECS)) { if (RAW[id]) RAW[id].spec = spec; }

// Freeze each definition and attach its id for convenience.
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
