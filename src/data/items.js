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

  // ---- Higher ores & bars ----
  mithril_ore: { name: 'Mithril ore', icon: '🔷', value: 162, examine: 'This needs refining.' },
  adamantite_ore: { name: 'Adamantite ore', icon: '🟢', value: 400, examine: 'This needs refining.' },
  runite_ore: { name: 'Runite ore', icon: '🔵', value: 1600, examine: 'This needs refining.' },
  gold_ore: { name: 'Gold ore', icon: '🟡', value: 150, examine: 'A glittering nugget of gold.' },
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
