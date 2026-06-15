// NPC registry. Monsters are generated from archetype "bases" × rank tiers into a
// 169-strong bestiary (scaled stats + level-tiered drops), plus 15 hand-authored
// bosses and the townsfolk. Sprites are drawn from def.sprite + def.color.

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function statsFor(level) {
  return {
    maxHp: Math.max(3, Math.round(level * 2.6 + 3)),
    attack: Math.max(1, Math.round(level * 0.95)),
    strength: Math.max(1, Math.round(level * 0.95)),
    defence: Math.max(1, Math.round(level * 0.8)),
    maxHit: Math.max(1, Math.ceil(level / 9) + 1),
    attackSpeed: level > 60 ? 5 : 4,
  };
}

function dropsFor(level) {
  const t = [
    { nothing: true, weight: Math.max(8, Math.round(40 - level / 3)) },
    { id: 'coins', min: Math.max(1, Math.round(level * 0.6)), max: Math.max(6, level * 8), weight: 55 },
  ];
  if (level < 10) t.push({ id: 'copper_ore', min: 1, max: 2, weight: 10 }, { id: 'bronze_dagger', weight: 6 });
  else if (level < 22) t.push({ id: 'iron_ore', min: 1, max: 2, weight: 10 }, { id: 'iron_scimitar', weight: 6 }, { id: 'steel_bar', weight: 4 });
  else if (level < 40) t.push({ id: 'coal', min: 1, max: 3, weight: 10 }, { id: 'steel_scimitar', weight: 6 }, { id: 'mithril_ore', weight: 5 });
  else if (level < 65) t.push({ id: 'mithril_ore', min: 1, max: 2, weight: 8 }, { id: 'mithril_scimitar', weight: 6 }, { id: 'adamantite_ore', weight: 4 }, { id: 'mithril_platebody', weight: 2 });
  else t.push({ id: 'adamantite_ore', min: 1, max: 2, weight: 8 }, { id: 'adamant_scimitar', weight: 5 }, { id: 'runite_ore', weight: 4 }, { id: 'rune_scimitar', weight: 1 });
  return t;
}

function makeMob(id, name, sprite, color, level, zone, aggro) {
  return { name, level, attackable: true, sprite, color, zone, ...statsFor(level),
    aggressive: aggro, aggroRange: aggro ? 4 : 0, respawn: Math.max(10, Math.round(10 + level / 3)), wander: 4,
    examine: `A ${name.toLowerCase()} (level ${level}).`,
    alwaysDrop: [{ id: 'bones' }], dropTable: dropsFor(level) };
}

// Archetype bases (Singapore-flavoured). [name, sprite, color, baseLevel, zone, aggressive]
const BASES = [
  ['Chicken', 'fowl', '#f3f0e6', 1, 'Bukit Timah', false],
  ['Rat', 'rodent', '#8f8f93', 3, 'Bukit Timah', false],
  ['Goblin', 'greenman', '#4f9a3f', 5, 'Bukit Timah', true],
  ['Macaque', 'primate', '#7a5a3a', 8, 'MacRitchie Reservoir', true],
  ['Monitor lizard', 'reptile', '#6b8a42', 14, 'MacRitchie Reservoir', true],
  ['Wild boar', 'beast', '#7a5a3a', 18, 'Bukit Timah', true],
  ['King cobra', 'serpent', '#3c8a3f', 16, 'Bukit Timah', true],
  ['Giant crab', 'crab', '#d8566f', 22, 'Sentosa Beach', false],
  ['Mud crab', 'crab', '#7a6a4a', 12, 'Sentosa Beach', false],
  ['Sand scorpion', 'scorpion', '#caa05a', 20, 'Sentosa Beach', true],
  ['Jungle spider', 'spider', '#5a4a6a', 24, 'Bukit Timah', true],
  ['Swamp slime', 'slime', '#5fa05a', 10, 'MacRitchie Reservoir', false],
  ['Mosquito', 'insect', '#6a7a4a', 6, 'MacRitchie Reservoir', true],
  ['Fruit bat', 'bat', '#5a4a3a', 9, 'Bukit Timah', true],
  ['Pangolin', 'beast', '#8a7a4a', 15, 'Bukit Timah', false],
  ['Sea snake', 'serpent', '#3a7a8a', 26, 'Sentosa Beach', true],
  ['Reef shark', 'seacreature', '#7fb6dd', 34, 'Sentosa Beach', true],
  ['Bandit', 'humanoid', '#7a5a3a', 28, 'The Wilderness', true],
  ['Outlaw', 'humanoid', '#3a3a44', 30, 'The Wilderness', true],
  ['Wraith', 'ghost', '#9fb0d8', 40, 'The Wilderness', true],
  ['Skeleton', 'undead', '#e8e2d0', 36, 'The Wilderness', true],
  ['Stone golem', 'golem', '#9a948a', 45, 'The Wilderness', true],
  ['Imp', 'demon', '#c0432a', 12, 'The Wilderness', true],
  ['Forest drake', 'drake', '#3f8a5a', 50, 'Bukit Timah', true],
  ['Will-o-wisp', 'wisp', '#9ad0ff', 7, 'MacRitchie Reservoir', true],
  ['Carnivorous plant', 'plant', '#3c8a3f', 22, 'Bukit Timah', true],
  ['Komodo dragon', 'reptile', '#8a7a4a', 38, 'Sentosa Beach', true],
  ['Tarantula', 'spider', '#6a4a3a', 30, 'Bukit Timah', true],
  ['Stray dog', 'hound', '#8a6a4a', 7, 'Bukit Timah', true],
  ['Civet', 'beast', '#6a5a3a', 11, 'Bukit Timah', false],
  ['Hornbill', 'fowl', '#2a2a2a', 13, 'Bukit Timah', true],
  ['Box jellyfish', 'jellyfish', '#c8a0e0', 17, 'Sentosa Beach', true],
  ['Praying mantis', 'mantis', '#6aa03a', 19, 'Bukit Timah', true],
  ['Sea turtle', 'turtle', '#3a7a5a', 16, 'Sentosa Beach', false],
  ['Vampire bat', 'bat', '#5a2a3a', 21, 'Bukit Timah', true],
  ['Wild dog', 'hound', '#7a5a3a', 25, 'MacRitchie Reservoir', true],
  ['Smooth otter', 'beast', '#6a5038', 10, 'MacRitchie Reservoir', false],
  ['Pink dolphin', 'seacreature', '#e6a6c0', 29, 'Sentosa Beach', false],
  ['Kingfisher', 'fowl', '#1f8aa0', 9, 'MacRitchie Reservoir', true],
  ['Flying fox', 'bat', '#3a2620', 23, 'Bukit Timah', true],
  ['Reticulated python', 'serpent', '#6a5a3a', 42, 'MacRitchie Reservoir', true],
  ['Saltwater crocodile', 'reptile', '#46583a', 48, 'MacRitchie Reservoir', true],
  ['Pontianak', 'ghost', '#d8c0c8', 38, 'The Wilderness', true],
  ['Toyol', 'greenman', '#8a9a5a', 14, 'The Wilderness', true],
  ['Horseshoe crab', 'crab', '#6a5a4a', 18, 'Sentosa Beach', false],
  ['Sambar deer', 'beast', '#8a6a4a', 20, 'MacRitchie Reservoir', false],
];

const RANKS = [
  { p: '', m: 1, agg: false },
  { p: 'Young', m: 0.55, agg: false },
  { p: 'Wild', m: 1.35, agg: true },
  { p: 'Feral', m: 1.8, agg: true },
  { p: 'Elder', m: 2.3, agg: true },
  { p: 'Dire', m: 3.0, agg: true },
  { p: 'Ancient', m: 3.8, agg: true },
];

const TARGET_MONSTERS = 280;
const MONSTER_IDS = [];
const _mobs = {};
{
  const seen = new Set();
  let count = 0;
  outer:
  for (const rank of RANKS) {
    for (const b of BASES) {
      if (count >= TARGET_MONSTERS) break outer;
      const [bn, sprite, color, blvl, bzone, baggro] = b;
      const name = (rank.p ? rank.p + ' ' : '') + bn;
      let id = slug(name);
      while (seen.has(id)) id += '_x';
      seen.add(id);
      const level = Math.max(1, Math.min(124, Math.round(blvl * rank.m)));
      const zone = level >= 45 ? 'The Wilderness' : bzone;
      _mobs[id] = makeMob(id, name, sprite, color, level, zone, baggro || rank.agg);
      count++;
    }
  }
}
for (const id of Object.keys(_mobs)) MONSTER_IDS.push(id);

// ---------------- Bosses (15) ----------------
function makeBoss(id, name, sprite, color, level, zone, scale, drops) {
  return { name, level, attackable: true, boss: true, sprite, color, scale, zone,
    maxHp: Math.round(level * 4.5 + 30),
    attack: Math.round(level * 1.05), strength: Math.round(level * 1.05), defence: Math.round(level * 0.95),
    maxHit: Math.ceil(level / 7) + 3, attackSpeed: 5,
    aggressive: true, aggroRange: 7, respawn: Math.round(60 + level), wander: 3,
    examine: `${name} — a fearsome boss (level ${level}).`,
    alwaysDrop: [{ id: 'bones' }, { id: 'coins', min: level * 8, max: level * 32 }],
    dropTable: drops };
}

const BOSS_DEFS = {
  boar_king: makeBoss('boar_king', 'The Boar King', 'beast', '#6b4a2a', 60, 'Bukit Timah', 1.9,
    [{ id: 'boar_tusk', weight: 22 }, { id: 'adamant_scimitar', weight: 30 }, { id: 'rune_full_helm', weight: 14 }, { id: 'rune_bar', min: 1, max: 3, weight: 26 }, { id: 'rune_scimitar', weight: 8 }]),
  goblin_warchief: makeBoss('goblin_warchief', 'Goblin Warchief', 'greenman', '#3f7a2f', 35, 'Bukit Timah', 1.7,
    [{ id: 'steel_scimitar', weight: 24 }, { id: 'mithril_ore', min: 1, max: 2, weight: 16 }, { id: 'adamant_scimitar', weight: 8 }, { id: 'amulet_of_power', weight: 4 }]),
  macaque_alpha: makeBoss('macaque_alpha', 'Macaque Alpha', 'primate', '#6a4a2a', 45, 'MacRitchie Reservoir', 1.7,
    [{ id: 'mithril_scimitar', weight: 20 }, { id: 'mithril_platebody', weight: 12 }, { id: 'adamantite_ore', weight: 14 }, { id: 'amulet_of_power', weight: 4 }]),
  reservoir_serpent: makeBoss('reservoir_serpent', 'Reservoir Serpent', 'serpent', '#2f7a8a', 75, 'MacRitchie Reservoir', 2.0,
    [{ id: 'rune_bar', min: 1, max: 2, weight: 22 }, { id: 'adamant_scimitar', weight: 22 }, { id: 'runite_ore', weight: 18 }, { id: 'merlion_amulet', weight: 6 }]),
  chilli_crab: makeBoss('chilli_crab', 'Chilli Crab Colossus', 'crab', '#d83b2e', 70, 'Sentosa Beach', 2.0,
    [{ id: 'rune_kiteshield', weight: 18 }, { id: 'adamant_scimitar', weight: 24 }, { id: 'runite_ore', weight: 20 }, { id: 'rune_platebody', weight: 6 }]),
  spider_queen: makeBoss('spider_queen', 'Jungle Spider Queen', 'spider', '#5a3a6a', 80, 'Bukit Timah', 2.0,
    [{ id: 'rune_full_helm', weight: 20 }, { id: 'mithril_platebody', weight: 18 }, { id: 'runite_ore', weight: 20 }, { id: 'rune_scimitar', weight: 6 }]),
  ancient_tembusu: makeBoss('ancient_tembusu', 'Ancient Tembusu', 'plant', '#3c8a3f', 88, 'Bukit Timah', 2.1,
    [{ id: 'rune_full_helm', weight: 18 }, { id: 'mithril_platebody', weight: 16 }, { id: 'runite_ore', weight: 20 }, { id: 'maple_logs', min: 5, max: 15, weight: 20 }, { id: 'rune_scimitar', weight: 8 }]),
  merlion: makeBoss('merlion', 'The Merlion', 'seacreature', '#cfe4ee', 90, 'Sentosa Beach', 2.1,
    [{ id: 'merlion_amulet', weight: 22 }, { id: 'rune_platebody', weight: 20 }, { id: 'runite_ore', min: 1, max: 3, weight: 30 }, { id: 'merlion_blade', weight: 7 }, { id: 'rune_kiteshield', weight: 14 }]),
  timah_drake: makeBoss('timah_drake', 'Bukit Timah Drake', 'drake', '#3f8a5a', 100, 'Bukit Timah', 2.1,
    [{ id: 'rune_platebody', weight: 18 }, { id: 'rune_scimitar', weight: 16 }, { id: 'runite_ore', min: 2, max: 4, weight: 26 }, { id: 'merlion_blade', weight: 5 }]),
  bandit_kingpin: makeBoss('bandit_kingpin', 'Bandit Kingpin', 'humanoid', '#6a4a2a', 85, 'The Wilderness', 2.0,
    [{ id: 'warlord_cape', weight: 14 }, { id: 'rune_scimitar', weight: 20 }, { id: 'runite_ore', weight: 20 }, { id: 'rune_full_helm', weight: 12 }]),
  bone_colossus: makeBoss('bone_colossus', 'Bone Colossus', 'undead', '#e8e2d0', 95, 'The Wilderness', 2.2,
    [{ id: 'rune_platebody', weight: 18 }, { id: 'rune_kiteshield', weight: 16 }, { id: 'runite_ore', min: 2, max: 4, weight: 26 }, { id: 'merlion_amulet', weight: 8 }]),
  molten_golem: makeBoss('molten_golem', 'Molten Golem', 'golem', '#b3552a', 105, 'The Wilderness', 2.2,
    [{ id: 'rune_scimitar', weight: 18 }, { id: 'rune_platebody', weight: 16 }, { id: 'runite_ore', min: 2, max: 5, weight: 28 }, { id: 'amulet_of_power', weight: 10 }]),
  sentosa_kraken: makeBoss('sentosa_kraken', 'Sentosa Kraken', 'seacreature', '#3a6a8a', 110, 'Sentosa Beach', 2.3,
    [{ id: 'merlion_blade', weight: 8 }, { id: 'rune_platebody', weight: 18 }, { id: 'runite_ore', min: 2, max: 5, weight: 28 }, { id: 'warlord_cape', weight: 8 }]),
  demon_lord: makeBoss('demon_lord', 'Demon Lord of Pulau', 'demon', '#a02a2a', 130, 'The Wilderness', 2.3,
    [{ id: 'merlion_blade', weight: 8 }, { id: 'warlord_cape', weight: 16 }, { id: 'rune_platebody', weight: 18 }, { id: 'runite_ore', min: 2, max: 6, weight: 30 }]),
  wilderness_warlord: makeBoss('wilderness_warlord', 'Wilderness Warlord', 'humanoid', '#3a3340', 120, 'The Wilderness', 2.2,
    [{ id: 'warlord_cape', weight: 22 }, { id: 'rune_scimitar', weight: 22 }, { id: 'rune_platebody', weight: 16 }, { id: 'runite_ore', min: 2, max: 5, weight: 26 }, { id: 'merlion_blade', weight: 6 }]),
  sand_scorpion_king: makeBoss('sand_scorpion_king', 'Sand Scorpion King', 'scorpion', '#caa05a', 65, 'Sentosa Beach', 1.9,
    [{ id: 'rune_kiteshield', weight: 16 }, { id: 'adamant_scimitar', weight: 24 }, { id: 'runite_ore', weight: 20 }, { id: 'ring_of_might', weight: 10 }]),
  durian_behemoth: makeBoss('durian_behemoth', 'Durian Behemoth', 'plant', '#caa83a', 60, 'Sentosa Beach', 1.9,
    [{ id: 'rune_full_helm', weight: 16 }, { id: 'adamant_scimitar', weight: 22 }, { id: 'runite_ore', weight: 20 }, { id: 'ring_of_kampong', weight: 12 }]),
  bedok_bandit_lord: makeBoss('bedok_bandit_lord', 'Bedok Bandit Lord', 'humanoid', '#5a4a2a', 70, 'The Wilderness', 2.0,
    [{ id: 'warlord_cape', weight: 14 }, { id: 'rune_scimitar', weight: 20 }, { id: 'runite_ore', weight: 20 }, { id: 'amulet_of_glory', weight: 8 }]),
  hungry_ghost_king: makeBoss('hungry_ghost_king', 'Hungry Ghost King', 'ghost', '#9fb0d8', 88, 'The Wilderness', 2.1,
    [{ id: 'amulet_of_glory', weight: 16 }, { id: 'rune_full_helm', weight: 18 }, { id: 'runite_ore', weight: 22 }, { id: 'garuda_wings', weight: 6 }]),
  night_safari_tiger: makeBoss('night_safari_tiger', 'Night Safari Tiger', 'beast', '#e8a23a', 92, 'Bukit Timah', 2.1,
    [{ id: 'tiger_fang', weight: 10 }, { id: 'rune_scimitar', weight: 18 }, { id: 'runite_ore', min: 2, max: 4, weight: 26 }, { id: 'amulet_of_glory', weight: 10 }]),
  mangrove_hydra: makeBoss('mangrove_hydra', 'Mangrove Hydra', 'serpent', '#3a7a8a', 95, 'MacRitchie Reservoir', 2.2,
    [{ id: 'hydra_leather', weight: 16 }, { id: 'rune_scimitar', weight: 16 }, { id: 'runite_ore', min: 1, max: 3, weight: 28 }, { id: 'leviathan_trident', weight: 4 }]),
  tualang_treant: makeBoss('tualang_treant', 'Tualang Treant', 'plant', '#5a7a3a', 105, 'Bukit Timah', 2.2,
    [{ id: 'treant_shield', weight: 16 }, { id: 'rune_platebody', weight: 16 }, { id: 'maple_logs', min: 10, max: 25, weight: 20 }, { id: 'runite_ore', min: 2, max: 4, weight: 24 }, { id: 'garuda_wings', weight: 5 }]),
  coral_leviathan: makeBoss('coral_leviathan', 'Coral Leviathan', 'seacreature', '#2f7a9a', 125, 'Sentosa Beach', 2.4,
    [{ id: 'leviathan_trident', weight: 8 }, { id: 'rune_platebody', weight: 18 }, { id: 'runite_ore', min: 2, max: 6, weight: 30 }, { id: 'merlion_blade', weight: 6 }]),
  the_garuda: makeBoss('the_garuda', 'The Garuda', 'drake', '#caa15a', 135, 'Bukit Timah', 2.4,
    [{ id: 'garuda_wings', weight: 12 }, { id: 'rune_platebody', weight: 18 }, { id: 'runite_ore', min: 2, max: 6, weight: 28 }, { id: 'merlion_blade', weight: 6 }]),
  rune_golem: makeBoss('rune_golem', 'Rune Golem', 'golem', '#46b3c4', 140, 'The Wilderness', 2.4,
    [{ id: 'rune_platebody', weight: 20 }, { id: 'rune_scimitar', weight: 18 }, { id: 'runite_ore', min: 3, max: 7, weight: 30 }, { id: 'leviathan_trident', weight: 5 }]),
  sentosa_megalodon: makeBoss('sentosa_megalodon', 'Sentosa Megalodon', 'seacreature', '#5a7a8a', 145, 'Sentosa Beach', 2.5,
    [{ id: 'megalodon_jaw', weight: 9 }, { id: 'dragon_platebody', weight: 14 }, { id: 'runite_ore', min: 3, max: 7, weight: 28 }, { id: 'dragon_scimitar', weight: 10 }]),
  changi_phantom: makeBoss('changi_phantom', 'Changi Phantom', 'ghost', '#aeb8d8', 128, 'The Wilderness', 2.3,
    [{ id: 'phantom_robe', weight: 12 }, { id: 'death_rune', min: 10, max: 30, weight: 24 }, { id: 'dragon_med_helm', weight: 12 }, { id: 'mystic_top', weight: 10 }]),
  pulau_hantu_djinn: makeBoss('pulau_hantu_djinn', 'Pulau Hantu Djinn', 'demon', '#7a3a8a', 132, 'The Wilderness', 2.3,
    [{ id: 'djinn_lamp', weight: 10 }, { id: 'dragon_dagger', weight: 14 }, { id: 'chaos_rune', min: 15, max: 40, weight: 24 }, { id: 'dragon_battleaxe', weight: 9 }]),
  bukit_brown_revenant: makeBoss('bukit_brown_revenant', 'Bukit Brown Revenant', 'undead', '#cdbfae', 138, 'The Wilderness', 2.4,
    [{ id: 'revenant_cape', weight: 11 }, { id: 'dragon_platelegs', weight: 14 }, { id: 'runite_ore', min: 3, max: 8, weight: 28 }, { id: 'dragon_longsword', weight: 9 }]),
  dragon_kiln_wyrm: makeBoss('dragon_kiln_wyrm', 'Dragon Kiln Wyrm', 'drake', '#c0392b', 150, 'The Wilderness', 2.5,
    [{ id: 'dragon_2h_sword', weight: 8 }, { id: 'dragon_platebody', weight: 14 }, { id: 'dragon_kiteshield', weight: 12 }, { id: 'dragon_scimitar', weight: 12 }, { id: 'megalodon_jaw', weight: 4 }]),
};
const BOSS_IDS = Object.keys(BOSS_DEFS);

// Give every boss a special mechanic (cycled) + a special-attack cadence.
const MECHANICS = ['slam', 'heal', 'summon', 'enrage', 'frenzy'];
BOSS_IDS.forEach((id, i) => { BOSS_DEFS[id].mechanic = MECHANICS[i % MECHANICS.length]; BOSS_DEFS[id].specialEvery = 9; });

// Shared rare drop table — a small chance on any kill, larger for bosses.
export const RARE_DROP_TABLE = [
  { id: 'coins', min: 500, max: 5000, weight: 40 },
  { id: 'sapphire', weight: 24 },
  { id: 'emerald', weight: 18 },
  { id: 'ruby', weight: 10 },
  { id: 'diamond', weight: 5 },
  { id: 'runite_ore', min: 1, max: 3, weight: 14 },
  { id: 'amulet_of_glory', weight: 6 },
  { id: 'rune_scimitar', weight: 5 },
  { id: 'rune_platebody', weight: 3 },
  { id: 'merlion_blade', weight: 1 },
];

// ---------------- Townsfolk ----------------
const TOWNSFOLK = {
  guide: { name: 'Kampong Guide', level: 0, attackable: false, role: 'dialogue', wander: 0, examine: 'He looks like he knows his way around.', dialogue: 'guide' },
  shopkeeper: { name: 'Shopkeeper', level: 0, attackable: false, role: 'shop', wander: 0, examine: 'He owns the general store.', shop: 'general' },
  banker: { name: 'Banker', level: 0, attackable: false, role: 'bank', wander: 0, examine: 'He can look after my valuables.' },
  hawker: { name: 'Hawker Auntie', level: 0, attackable: false, role: 'shop', wander: 0, examine: 'She sells delicious local food.', shop: 'hawker' },
  mage: { name: 'Mystic Merchant', level: 0, attackable: false, role: 'shop', wander: 0, examine: 'She trades in staves and runes.', shop: 'magic' },
  villager: { name: 'Villager', level: 0, attackable: false, role: 'dialogue', wander: 5, examine: 'A local resident.', dialogue: 'villager' },
};

export const NPCS = {};
for (const id of MONSTER_IDS) NPCS[id] = _mobs[id];
for (const id of BOSS_IDS) NPCS[id] = BOSS_DEFS[id];
Object.assign(NPCS, TOWNSFOLK);

export { MONSTER_IDS, BOSS_IDS };

export function getNpc(id) {
  const npc = NPCS[id];
  if (!npc) throw new Error(`Unknown npc id: ${id}`);
  return npc;
}
