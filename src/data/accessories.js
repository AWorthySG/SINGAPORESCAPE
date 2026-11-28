// Equip bonuses are scaled by the jewellery pass in items.js. Recipes use
// materials from gathering skills so each pair has its own route to the table.
// Each row holds item details, followed by Crafting level, XP, inputs, examine
// text and an optional combat style.
export const CRAFTED_ACCESSORIES = [
  ['tideglass_ring', 'Tideglass ring', 'ring', { ranged: 15 }, { ranged: 5, crit: 1 }, 320,
    18, 65, [['silver_bar', 1], ['sea_glass', 2]], 'A wave-polished setting that steadies a shot.', 'ranged'],
  ['tideglass_amulet', 'Tideglass amulet', 'amulet', { ranged: 20 }, { ranged: 8, haste: 1 }, 780,
    24, 85, [['silver_bar', 1], ['sea_glass', 3], ['sapphire', 1]], 'Sea glass shaped into a breaking wave. It quickens ranged attacks.', 'ranged'],

  ['ironwood_ring', 'Ironwood ring', 'ring', { defence: 25 }, { defence: 6, hp: 3 }, 520,
    34, 105, [['steel_bar', 1], ['teak_logs', 2]], 'Hardwood bound in metal. Its wearer can take a heavier hit.'],
  ['ironwood_amulet', 'Ironwood amulet', 'amulet', { defence: 35 }, { defence: 10, hp: 6 }, 1050,
    42, 135, [['steel_bar', 2], ['teak_logs', 3], ['granite', 1]], 'A miniature shield with a hardwood heart. It adds armour and life.'],

  ['lantern_ring', 'Lantern ring', 'ring', { magic: 35 }, { magic: 7, magicStr: 2, prayer: 4 }, 3200,
    48, 150, [['gold_bar', 1], ['glass_orb', 1], ['ruby', 1]], 'A lamp held in a ring of gold. Its flame feeds both spells and faith.', 'magic'],
  ['lantern_amulet', 'Lantern amulet', 'amulet', { magic: 45 }, { magic: 12, magicStr: 3, prayer: 6 }, 4100,
    57, 190, [['gold_bar', 2], ['lantern', 1], ['ruby', 1]], 'A little temple lantern that strengthens spells and helps faith recover.', 'magic'],

  ['orchid_ring', 'Orchid ring', 'ring', { defence: 55 }, { attack: 6, strength: 5, dance: 6, lifesteal: 2 }, 2650,
    72, 255, [['adamant_bar', 1], ['coral_fragment', 1], ['emerald', 1]], 'An orchid carved in coral. Its wearer draws life from landed blows.', 'melee'],
  ['orchid_amulet', 'Orchid amulet', 'amulet', { defence: 65 }, { attack: 11, strength: 9, dance: 11, lifesteal: 3 }, 4250,
    85, 360, [['adamant_bar', 2], ['coral_fragment', 2], ['emerald', 1]], 'Three coral petals set in a pendant. Landed attacks return a share of life.', 'melee'],

  ['starfall_ring', 'Starfall ring', 'ring', { defence: 185 }, { attack: 9, ranged: 13, magic: 9, dance: 9, crit: 3, haste: 2 }, 31500,
    205, 1150, [['starmetal_bar', 1], ['star_coral', 2]], 'A fallen star in a silver setting. Its pulse quickens attacks and helps find openings.'],
  ['starfall_amulet', 'Starfall amulet', 'amulet', { defence: 200 }, { attack: 15, ranged: 23, magic: 15, dance: 15, crit: 3, haste: 4 }, 62500,
    215, 1300, [['starmetal_bar', 2], ['star_coral', 3]], 'A shard of starlight with a comet tail. Its rhythm makes attacks faster.'],

  ['riftguard_ring', 'Riftguard ring', 'ring', { defence: 235 }, { defence: 13, hp: 6, pierce: 3, bossDmg: 3 }, 50000,
    255, 1550, [['celestial_bar', 1], ['rift_coral', 2], ['obsidian_shard', 1]], 'A ring cut from rift coral. It holds steady when facing bosses and cuts through armour.'],
  ['riftguard_amulet', 'Riftguard amulet', 'amulet', { defence: 250 }, { defence: 20, hp: 12, pierce: 4, bossDmg: 5 }, 98000,
    270, 1700, [['celestial_bar', 2], ['rift_coral', 3], ['obsidian_shard', 2]], 'A rift crystal mounted behind a thin shield. It protects its wearer and weakens the armour of their foes.'],

  // Farmed leaves are pressed into the settings at a crafting table.
  ['pandan_leaf_ring', 'Pandan leaf ring', 'ring', { defence: 20 }, { lifesteal: 1, hp: 3, defence: 2 }, 420,
    28, 95, [['silver_bar', 1], ['pandan_leaves', 4]], 'A preserved pandan leaf sealed in glass. It steadies your guard and returns a little life.'],
  ['pandan_leaf_amulet', 'Pandan leaf amulet', 'amulet', { defence: 30 }, { lifesteal: 2, hp: 5, defence: 4 }, 1150,
    38, 125, [['gold_bar', 1], ['pandan_leaves', 6], ['emerald', 1]], 'Two leaves in green glass, suspended on a cord. Landed attacks return a little life.'],
];

// Clean excavated porcelain and mount it at the restoration bench.
export const RESTORED_ACCESSORIES = [
  ['heritage_porcelain_ring', 'Heritage porcelain ring', 'ring', { prayer: 35 }, { prayer: 5, defence: 3, critDmg: 2 }, 1100,
    75, 210, [['porcelain_shard', 3], ['old_coin', 2]], 'A blue porcelain fragment, bordered in old coin metal. It builds Faith and sharpens critical hits.'],
  ['heritage_porcelain_amulet', 'Heritage porcelain amulet', 'amulet', { prayer: 50 }, { prayer: 9, defence: 8, critDmg: 4 }, 2200,
    86, 300, [['porcelain_shard', 5], ['old_coin', 4], ['silver_bar', 1]], 'Cleaned and remounted at the restoration bench. Its calm design builds Faith and deepens critical hits.'],
];

// The Chinatown textile workshop gives these for two of its paid orders.
export const TEXTILE_ACCESSORIES = [
  ['batik_bloom_ring', 'Batik bloom ring', 'ring', { defence: 10 }, { haste: 1, crit: 1 }, 240,
    'Indigo cloth folded over a little bead. Its pattern helps its wearer strike quickly.'],
  ['batik_night_amulet', 'Batik night amulet', 'amulet', { defence: 25 }, { crit: 2, critDmg: 2, haste: 1 }, 450,
    'A woven medallion in the purple of mangosteen skin. It helps its wearer find weak spots.'],
];
