// The four newer life skills: Farming, Herblore, Fletching and Hunter.
//
//   Farming    plant seeds in a farm patch; after a while, harvest the crop.
//   Herblore   brew farmed herbs into potions at an apothecary table.
//   Fletching  carve logs into arrows, bows, staves and wands at a fletching bench.
//   Hunter     work traps and trails out in the wild for feathers, meat and hides.

// Crops: [id, name, Farming level, grow ticks (600ms each), plant xp, harvest xp per crop,
//         [min, max] yield, heal if edible, value, colour]. The seed is `${id}_seed`.
// chilli, pandan_leaves and lemongrass are the existing cooking herbs.
export const CROPS = [
  ['chilli', 'Chilli', 1, 50, 8, 6, [3, 6], 0, 8, '#e04a2a'],
  ['kangkong', 'Kangkong', 5, 60, 10, 8, [3, 6], 4, 10, '#4aa04a'],
  ['pandan_leaves', 'Pandan leaves', 8, 70, 12, 9, [3, 6], 0, 7, '#3aa060'],
  ['lemongrass', 'Lemongrass', 12, 80, 14, 11, [3, 6], 0, 9, '#a8c860'],
  ['sweet_potato', 'Sweet potato', 18, 100, 18, 14, [3, 6], 7, 16, '#c06a8a'],
  ['sireh_leaf', 'Sireh leaf', 22, 110, 22, 17, [2, 5], 0, 24, '#3a8a3a'],
  ['tongkat_ali', 'Tongkat ali', 30, 130, 28, 22, [2, 5], 0, 36, '#a86a3a'],
  ['misai_kucing', 'Misai kucing', 38, 150, 35, 28, [2, 5], 0, 50, '#b8a0e0'],
  ['hempedu_bumi', 'Hempedu bumi', 46, 170, 44, 34, [2, 5], 0, 64, '#5a9a4a'],
  ['butterfly_pea', 'Butterfly pea', 54, 190, 52, 40, [2, 5], 0, 80, '#3a5ad8'],
  ['rambutan', 'Rambutan', 60, 210, 60, 46, [3, 7], 14, 70, '#e0402a'],
  ['ginseng', 'Ginseng', 70, 240, 72, 56, [2, 4], 0, 130, '#e0c080'],
  ['mangosteen', 'Mangosteen', 80, 270, 85, 66, [3, 6], 20, 120, '#7a2a5a'],
  ['durian', 'Durian', 95, 320, 105, 82, [2, 4], 30, 220, '#b8a83a'],
  ['lingzhi', 'Lingzhi', 120, 380, 140, 110, [2, 4], 0, 420, '#a0402a'],
  ['snow_lotus', 'Snow lotus', 160, 450, 200, 160, [1, 3], 0, 900, '#f0f0ff'],
  ['peach_of_immortality', 'Peach of immortality', 220, 540, 300, 240, [1, 3], 60, 2400, '#f8a0a0'],
];
export const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c[0], c]));
export const CROP_BY_SEED = Object.fromEntries(CROPS.map((c) => [`${c[0]}_seed`, c]));
export const cropFor = (id) => {
  const c = CROP_BY_ID[id];
  return c && { id: c[0], name: c[1], level: c[2], grow: c[3], plantXp: c[4], harvestXp: c[5], yield: c[6], heal: c[7], value: c[8], color: c[9], seed: `${c[0]}_seed` };
};

// Potion effects stack with combat perks (see Game.perkMods): acc / dmg / crit add to
// hits, reduce cuts damage taken, heal restores a share of max life at once.
// `group` is the slot a potion fills (a new one of the same group replaces the old);
// `style` limits it to one fighting style.
const MIN = 60000;
export const POTIONS = {
  attack_potion: { name: 'Attack potion', level: 1, xp: 25, inputs: [['chilli', 1], ['vial', 1]], group: 'attack', fx: { acc: 0.08 }, ms: 5 * MIN, color: '#d8402a' },
  strength_potion: { name: 'Strength potion', level: 10, xp: 40, inputs: [['lemongrass', 1], ['vial', 1]], group: 'strength', fx: { dmg: 0.08 }, ms: 5 * MIN, color: '#3aa04a' },
  defence_potion: { name: 'Defence potion', level: 20, xp: 55, inputs: [['sireh_leaf', 1], ['vial', 1]], group: 'defence', fx: { reduce: 0.06 }, ms: 5 * MIN, color: '#3a7ad8' },
  ranging_potion: { name: 'Ranging potion', level: 30, xp: 70, inputs: [['tongkat_ali', 1], ['vial', 1]], group: 'ranging', style: 'ranged', fx: { acc: 0.07, dmg: 0.07 }, ms: 5 * MIN, color: '#5ac0a0' },
  magic_potion: { name: 'Magic potion', level: 38, xp: 85, inputs: [['misai_kucing', 1], ['vial', 1]], group: 'magic', style: 'magic', fx: { acc: 0.07, dmg: 0.07 }, ms: 5 * MIN, color: '#6a5ae0' },
  healing_potion: { name: 'Healing potion', level: 45, xp: 100, inputs: [['hempedu_bumi', 1], ['vial', 1]], fx: { heal: 0.35 }, color: '#e87aa0' },
  super_attack: { name: 'Super attack', level: 60, xp: 140, inputs: [['attack_potion', 1], ['butterfly_pea', 1]], group: 'attack', fx: { acc: 0.16 }, ms: 6 * MIN, color: '#a01a1a' },
  super_strength: { name: 'Super strength', level: 66, xp: 155, inputs: [['strength_potion', 1], ['butterfly_pea', 1]], group: 'strength', fx: { dmg: 0.16 }, ms: 6 * MIN, color: '#1a7a2a' },
  super_defence: { name: 'Super defence', level: 72, xp: 170, inputs: [['defence_potion', 1], ['butterfly_pea', 1]], group: 'defence', fx: { reduce: 0.12 }, ms: 6 * MIN, color: '#1a4aa0' },
  super_ranging: { name: 'Super ranging', level: 78, xp: 185, inputs: [['ranging_potion', 1], ['butterfly_pea', 1]], group: 'ranging', style: 'ranged', fx: { acc: 0.14, dmg: 0.14 }, ms: 6 * MIN, color: '#2a9a7a' },
  super_magic: { name: 'Super magic', level: 84, xp: 200, inputs: [['magic_potion', 1], ['butterfly_pea', 1]], group: 'magic', style: 'magic', fx: { acc: 0.14, dmg: 0.14 }, ms: 6 * MIN, color: '#4a2ac0' },
  super_healing: { name: 'Super healing', level: 90, xp: 220, inputs: [['healing_potion', 1], ['ginseng', 1]], fx: { heal: 0.6 }, color: '#d84a80' },
  elixir_of_temasek: { name: 'Elixir of Temasek', level: 110, xp: 420,
    inputs: [['super_attack', 1], ['super_strength', 1], ['super_defence', 1], ['lingzhi', 1], ['hornbill_casque', 1]],
    group: 'elixir', fx: { acc: 0.2, dmg: 0.2, reduce: 0.14 }, ms: 10 * MIN, color: '#f0c040' },
  immortal_elixir: { name: 'Immortal elixir', level: 180, xp: 950,
    inputs: [['elixir_of_temasek', 1], ['snow_lotus', 1], ['peach_of_immortality', 1], ['qilin_mane', 1]],
    group: 'elixir', fx: { acc: 0.3, dmg: 0.3, reduce: 0.2, crit: 0.05, heal: 0.5 }, ms: 10 * MIN, color: '#fff0a0' },
};
export const POTION_IDS = Object.keys(POTIONS);

// Fletching recipes, worked at a fletching bench. `qty` items come out per make.
export const FLETCH = [
  { result: 'arrow_shaft', qty: 15, inputs: [['logs', 1]], level: 1, xp: 5, tool: 'knife' },
  { result: 'apprentice_wand', qty: 1, inputs: [['logs', 1]], level: 3, xp: 8, tool: 'knife' },
  { result: 'shortbow', qty: 1, inputs: [['logs', 2]], level: 5, xp: 10, tool: 'knife' },
  { result: 'staff', qty: 1, inputs: [['logs', 2]], level: 8, xp: 14, tool: 'knife' },
  { result: 'longbow', qty: 1, inputs: [['logs', 3]], level: 10, xp: 20, tool: 'knife' },
  { result: 'bronze_arrow', qty: 15, inputs: [['arrow_shaft', 15], ['feather', 15], ['bronze_bar', 1]], level: 1, xp: 20 },
  { result: 'arrow_shaft', qty: 30, inputs: [['oak_logs', 1]], level: 15, xp: 10, tool: 'knife' },
  { result: 'iron_arrow', qty: 15, inputs: [['arrow_shaft', 15], ['feather', 15], ['iron_bar', 1]], level: 15, xp: 38 },
  { result: 'oak_wand', qty: 1, inputs: [['oak_logs', 1]], level: 18, xp: 25, tool: 'knife' },
  { result: 'oak_shortbow', qty: 1, inputs: [['oak_logs', 2]], level: 20, xp: 33, tool: 'knife' },
  { result: 'oak_longbow', qty: 1, inputs: [['oak_logs', 3]], level: 25, xp: 50, tool: 'knife' },
  { result: 'teak_wand', qty: 1, inputs: [['teak_logs', 1]], level: 28, xp: 45, tool: 'knife' },
  { result: 'steel_arrow', qty: 15, inputs: [['arrow_shaft', 15], ['feather', 15], ['steel_bar', 1]], level: 30, xp: 75 },
  { result: 'willow_shortbow', qty: 1, inputs: [['willow_logs', 2]], level: 35, xp: 66, tool: 'knife' },
  { result: 'maple_wand', qty: 1, inputs: [['maple_logs', 1]], level: 38, xp: 70, tool: 'knife' },
  { result: 'willow_longbow', qty: 1, inputs: [['willow_logs', 3]], level: 40, xp: 83, tool: 'knife' },
  { result: 'mithril_arrow', qty: 15, inputs: [['arrow_shaft', 15], ['feather', 15], ['mithril_bar', 1]], level: 45, xp: 113 },
  { result: 'maple_shortbow', qty: 1, inputs: [['maple_logs', 2]], level: 50, xp: 100, tool: 'knife' },
  { result: 'maple_longbow', qty: 1, inputs: [['maple_logs', 3]], level: 55, xp: 116, tool: 'knife' },
  { result: 'adamant_arrow', qty: 15, inputs: [['arrow_shaft', 15], ['feather', 15], ['adamant_bar', 1]], level: 60, xp: 150 },
  { result: 'yew_shortbow', qty: 1, inputs: [['yew_logs', 2]], level: 65, xp: 135, tool: 'knife' },
  { result: 'yew_longbow', qty: 1, inputs: [['yew_logs', 3]], level: 70, xp: 175, tool: 'knife' },
  { result: 'rune_arrow', qty: 15, inputs: [['arrow_shaft', 15], ['feather', 15], ['rune_bar', 1]], level: 75, xp: 188 },
  { result: 'magic_shortbow', qty: 1, inputs: [['magic_logs', 2]], level: 80, xp: 166, tool: 'knife' },
  { result: 'magic_longbow', qty: 1, inputs: [['magic_logs', 3]], level: 85, xp: 250, tool: 'knife' },
];

// Hunter grounds: work a trap until it springs. `gives` are rolled on each catch
// (`chance` defaults to 1). They reset after `respawn` ticks once they run dry.
export const HUNT = {
  bird_snare: { name: 'Bird snare', level: 1, xp: 30, lowChance: 0.45, highChance: 0.95, depleteChance: 0.15, respawn: 8,
    gives: [{ id: 'feather', min: 3, max: 8 }, { id: 'raw_chicken', chance: 0.4 }], color: '#caa15a', examine: 'A snare set among the bushes for junglefowl.' },
  squirrel_trap: { name: 'Squirrel trap', level: 12, xp: 50, lowChance: 0.35, highChance: 0.9, depleteChance: 0.15, respawn: 10,
    gives: [{ id: 'squirrel_pelt' }], color: '#a8743a', examine: 'A box trap baited for plantain squirrels.' },
  lizard_snare: { name: 'Lizard snare', level: 25, xp: 80, lowChance: 0.3, highChance: 0.85, depleteChance: 0.15, respawn: 12,
    gives: [{ id: 'lizard_skin' }], color: '#7a9a4a', examine: 'A noose snare by a sunny rock where lizards bask.' },
  mousedeer_trail: { name: 'Mousedeer trail', level: 40, xp: 120, lowChance: 0.25, highChance: 0.8, depleteChance: 0.15, respawn: 14,
    gives: [{ id: 'raw_venison' }, { id: 'feather', min: 1, max: 4, chance: 0.3 }], color: '#b08050', examine: 'Tiny hoofprints: a kancil passes this way.' },
  boar_pit: { name: 'Boar pit', level: 55, xp: 170, lowChance: 0.22, highChance: 0.75, depleteChance: 0.15, respawn: 16,
    gives: [{ id: 'raw_boar_meat' }, { id: 'boar_tusk', chance: 0.15 }], color: '#7a5a3a', examine: 'A covered pit on a wild boar run.' },
  python_trap: { name: 'Python trap', level: 70, xp: 230, lowChance: 0.18, highChance: 0.7, depleteChance: 0.15, respawn: 18,
    gives: [{ id: 'python_skin' }], color: '#8a7a4a', examine: 'A sturdy cage by the riverbank.' },
  crocodile_trap: { name: 'Crocodile trap', level: 90, xp: 320, lowChance: 0.15, highChance: 0.65, depleteChance: 0.15, respawn: 22,
    gives: [{ id: 'croc_hide' }], color: '#4a6a3a', examine: 'A heavy log trap at the water\'s edge. Careful.' },
  hornbill_nest: { name: 'Hornbill nest', level: 120, xp: 450, lowChance: 0.12, highChance: 0.6, depleteChance: 0.2, respawn: 30,
    gives: [{ id: 'hornbill_casque' }, { id: 'feather', min: 10, max: 20 }], color: '#e0b040', examine: 'High in a tualang tree: a hornbill nest.' },
  qilin_trail: { name: 'Qilin trail', level: 200, xp: 900, lowChance: 0.08, highChance: 0.5, depleteChance: 0.25, respawn: 45,
    gives: [{ id: 'qilin_mane' }], color: '#f0d070', examine: 'Golden hoofprints that glow faintly on the stone.' },
};

// Hunter goods worked into archer armour at a crafting table.
export const HIDE_CRAFT = [
  { result: 'leather_body', inputs: [{ id: 'squirrel_pelt', qty: 3 }], level: 10, xp: 40 },
  { result: 'coif', inputs: [{ id: 'lizard_skin', qty: 2 }], level: 20, xp: 60 },
  { result: 'leather_chaps', inputs: [{ id: 'lizard_skin', qty: 3 }], level: 22, xp: 75 },
  { result: 'studded_body', inputs: [{ id: 'python_skin', qty: 4 }], level: 38, xp: 140 },
  { result: 'dragonhide_vambraces', inputs: [{ id: 'croc_hide', qty: 2 }], level: 60, xp: 190 },
  { result: 'dragonhide_coif', inputs: [{ id: 'croc_hide', qty: 3 }], level: 62, xp: 230 },
  { result: 'dragonhide_chaps', inputs: [{ id: 'croc_hide', qty: 4 }], level: 65, xp: 280 },
  { result: 'dragonhide_body', inputs: [{ id: 'croc_hide', qty: 5 }], level: 70, xp: 350 },
];
