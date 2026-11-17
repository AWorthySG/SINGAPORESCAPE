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
  // Endgame crops (Farming 100-300), slotted in level order (seedFor in npcs.js
  // takes the last crop at or under a monster's level). Every seed is sold at
  // the farm shop. Each tier earns about 35% more XP a patch an hour than the
  // best crop you could grow before it (tests/hunt-farm-herb.test.mjs).
  ['torch_ginger', 'Torch ginger', 100, 300, 130, 104, [3, 6], 0, 600, '#e8405a'],
  ['lingzhi', 'Lingzhi', 120, 380, 140, 110, [2, 4], 0, 420, '#a0402a'],
  ['black_nutmeg', 'Black nutmeg', 130, 360, 245, 196, [3, 5], 0, 900, '#4a3a3a'],
  ['snow_lotus', 'Snow lotus', 160, 450, 200, 160, [1, 3], 0, 900, '#f0f0ff'],
  ['golden_durian', 'Golden durian', 160, 420, 454, 363, [2, 5], 45, 1300, '#f0c030'],
  ['starbloom', 'Starbloom', 200, 480, 855, 684, [2, 4], 0, 1900, '#7a8af0'],
  ['peach_of_immortality', 'Peach of immortality', 220, 540, 300, 240, [1, 3], 60, 2400, '#f8a0a0'],
  ['moon_orchid', 'Moon orchid', 250, 540, 1462, 1170, [2, 4], 0, 2800, '#d8d0f8'],
  ['eternal_lotus', 'Eternal lotus', 300, 600, 3230, 2584, [1, 3], 0, 4000, '#f5c84a'],
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
  attack_potion: { name: 'Attack potion', level: 1, xp: 25, inputs: [['chilli', 1], ['vial', 1]], group: 'attack', fx: { crit: 0.04 }, ms: 5 * MIN, color: '#d8402a' },
  strength_potion: { name: 'Strength potion', level: 10, xp: 40, inputs: [['lemongrass', 1], ['vial', 1]], group: 'strength', fx: { dmg: 0.08 }, ms: 5 * MIN, color: '#3aa04a' },
  defence_potion: { name: 'Defence potion', level: 20, xp: 55, inputs: [['sireh_leaf', 1], ['vial', 1]], group: 'defence', fx: { reduce: 0.06 }, ms: 5 * MIN, color: '#3a7ad8' },
  ranging_potion: { name: 'Ranging potion', level: 30, xp: 70, inputs: [['tongkat_ali', 1], ['vial', 1]], group: 'ranging', style: 'ranged', fx: { crit: 0.03, dmg: 0.07 }, ms: 5 * MIN, color: '#5ac0a0' },
  magic_potion: { name: 'Magic potion', level: 38, xp: 85, inputs: [['misai_kucing', 1], ['vial', 1]], group: 'magic', style: 'magic', fx: { crit: 0.03, dmg: 0.07 }, ms: 5 * MIN, color: '#6a5ae0' },
  healing_potion: { name: 'Healing potion', level: 45, xp: 100, inputs: [['hempedu_bumi', 1], ['vial', 1]], fx: { heal: 0.35 }, color: '#e87aa0' },
  super_attack: { name: 'Super attack', level: 60, xp: 140, inputs: [['attack_potion', 1], ['butterfly_pea', 1]], group: 'attack', fx: { crit: 0.08 }, ms: 6 * MIN, color: '#a01a1a' },
  super_strength: { name: 'Super strength', level: 66, xp: 155, inputs: [['strength_potion', 1], ['butterfly_pea', 1]], group: 'strength', fx: { dmg: 0.16 }, ms: 6 * MIN, color: '#1a7a2a' },
  super_defence: { name: 'Super defence', level: 72, xp: 170, inputs: [['defence_potion', 1], ['butterfly_pea', 1]], group: 'defence', fx: { reduce: 0.12 }, ms: 6 * MIN, color: '#1a4aa0' },
  super_ranging: { name: 'Super ranging', level: 78, xp: 185, inputs: [['ranging_potion', 1], ['butterfly_pea', 1]], group: 'ranging', style: 'ranged', fx: { crit: 0.06, dmg: 0.14 }, ms: 6 * MIN, color: '#2a9a7a' },
  super_magic: { name: 'Super magic', level: 84, xp: 200, inputs: [['magic_potion', 1], ['butterfly_pea', 1]], group: 'magic', style: 'magic', fx: { crit: 0.06, dmg: 0.14 }, ms: 6 * MIN, color: '#4a2ac0' },
  super_healing: { name: 'Super healing', level: 90, xp: 220, inputs: [['healing_potion', 1], ['ginseng', 1]], fx: { heal: 0.6 }, color: '#d84a80' },
  elixir_of_temasek: { name: 'Elixir of Temasek', level: 110, xp: 420,
    inputs: [['super_attack', 1], ['super_strength', 1], ['super_defence', 1], ['lingzhi', 1], ['hornbill_casque', 1]],
    group: 'elixir', fx: { crit: 0.08, dmg: 0.2, reduce: 0.14 }, ms: 10 * MIN, color: '#f0c040' },
  immortal_elixir: { name: 'Immortal elixir', level: 180, xp: 950,
    inputs: [['elixir_of_temasek', 1], ['snow_lotus', 1], ['peach_of_immortality', 1], ['qilin_mane', 1]],
    group: 'elixir', fx: { dmg: 0.3, reduce: 0.2, crit: 0.12, heal: 0.5 }, ms: 10 * MIN, color: '#fff0a0' },
  // ---- Endgame brews (Herblore 100-300): an endgame crop, a Hunter catch and
  // an ash from the endgame logs. Each has a group of its own, so it stacks
  // with the older potions (as the elixirs do). New effect keys, all read by
  // the combat code through perkMods: haste (attack speed, a fraction), boss
  // (damage to bosses and champions), lifesteal (share of damage dealt
  // healed) and maxhp (max life). Each brew pays about 35% more XP than the
  // best brew before it (one brew a tick, so that is XP an hour too). ----
  super_might_potion: { name: 'Super might potion', level: 100, xp: 300, inputs: [['torch_ginger', 1], ['pangolin_scales', 1], ['fine_ash', 1]],
    group: 'might', fx: { dmg: 0.15 }, ms: 6 * MIN, color: '#e8405a' },
  super_haste_potion: { name: 'Super haste potion', level: 130, xp: 570, inputs: [['black_nutmeg', 1], ['colugo_fur', 1], ['fine_ash', 1]],
    group: 'haste', fx: { haste: 0.15 }, ms: 6 * MIN, color: '#5ad0e0' },
  tigers_focus: { name: "Tiger's focus", level: 160, xp: 770, inputs: [['golden_durian', 1], ['tiger_whisker', 1], ['ember_ash', 1]],
    group: 'focus', fx: { crit: 0.10 }, ms: 6 * MIN, color: '#f08a2a' },
  garuda_draught: { name: 'Garuda draught', level: 200, xp: 1290, inputs: [['starbloom', 1], ['garuda_plume', 1], ['star_ash', 1]],
    group: 'garuda', fx: { boss: 0.25 }, ms: 8 * MIN, color: '#7a8af0' },
  naga_elixir: { name: 'Naga elixir', level: 250, xp: 1745, inputs: [['moon_orchid', 1], ['naga_scale', 1], ['ghost_ash', 1]],
    group: 'naga', fx: { lifesteal: 0.05, maxhp: 0.2 }, ms: 8 * MIN, color: '#3ab08a' },
  // Everything the five above give, in one, and while it runs it saves you
  // once from death (Game.playerDeath: back on your feet at `revive` of your
  // life, and the elixir is used up). It stands in for the five (`covers`):
  // drinking one of them as well adds nothing.
  phoenix_elixir: { name: 'Phoenix elixir', level: 300, xp: 2360, inputs: [['eternal_lotus', 1], ['phoenix_ember', 1], ['eternal_ash', 1]],
    group: 'phoenix', covers: ['might', 'haste', 'focus', 'garuda', 'naga'], revive: 0.5,
    fx: { dmg: 0.15, haste: 0.15, crit: 0.10, boss: 0.25, lifesteal: 0.05, maxhp: 0.2 }, ms: 10 * MIN, color: '#ff7a2a' },
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

// ---- Endgame fletching (Fletching 100-300): the bows, staves, wands, rifles
// and crossbows that otherwise only drop, carved from the endgame logs ----
// Rifles and crossbows also take the tier's bar (smithing.js), as do arrows.
// Levels are the tier's level plus small per-piece offsets, as above. `xp` is
// the tier's best make (a longbow or rifle), each tier about 35% more than the
// last, starting from the magic longbow's 250: one make is a tick whatever
// it is, so that is also ~35% more XP an hour. Other pieces earn a share of it.
// Fletched gear is always plain: quality is only rolled for monster drops.
// Signature and boss weapons stay drop-only.
const _FLETCH_TIERS = [
  { k: 'obsidian', log: 'seraya_logs', base: 100, xp: 340, shafts: 45 },
  { k: 'orichalcum', log: 'meranti_logs', base: 130, xp: 460, shafts: 50 },
  { k: 'jade', log: 'chengal_logs', base: 160, xp: 625, shafts: 55, arrow: true },
  { k: 'starmetal', log: 'starwood_logs', base: 200, xp: 845, shafts: 60, arrow: true },
  { k: 'celestial', log: 'moonwood_logs', base: 250, xp: 1145, shafts: 65 },
  { k: 'eternal', log: 'eternal_heartwood', base: 300, xp: 1550, shafts: 70, arrow: true },
];
// [piece, logs, bars, level offset, share of the tier's xp]
const _FLETCH_PIECES = [['wand', 1, 0, 0, 0.4], ['staff', 2, 0, 3, 0.65], ['bow', 2, 0, 5, 0.65],
  ['crossbow', 2, 1, 8, 0.9], ['longbow', 3, 0, 10, 1], ['rifle', 2, 2, 12, 1]];
const _NO_SUCH = new Set(['obsidian_bow', 'orichalcum_bow', 'orichalcum_staff']);   // never made at these tiers
for (const T of _FLETCH_TIERS) {
  FLETCH.push({ result: 'arrow_shaft', qty: T.shafts, inputs: [[T.log, 1]], level: T.base, xp: Math.round(T.xp * 0.1), tool: 'knife' });
  for (const [p, logs, bars, off, share] of _FLETCH_PIECES) {
    const result = `${T.k}_${p}`;
    if (_NO_SUCH.has(result)) continue;
    const inputs = [[T.log, logs]];
    if (bars) inputs.push([`${T.k}_bar`, bars]);
    FLETCH.push({ result, qty: 1, inputs, level: T.base + off, xp: Math.round(T.xp * share), tool: 'knife' });
  }
  // Fifteen arrows from shafts, feathers and one bar, like the older arrows.
  if (T.arrow) FLETCH.push({ result: `${T.k}_arrow`, qty: 15, inputs: [['arrow_shaft', 15], ['feather', 15], [`${T.k}_bar`, 1]], level: T.base + 4, xp: Math.round(T.xp * 0.75) });
}

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
  // Crocodile, hornbill and qilin spring more often and reset faster than the
  // traps below them, so each tier out-earns the last an hour (the qilin trail
  // used to earn less than a crocodile trap).
  crocodile_trap: { name: 'Crocodile trap', level: 90, xp: 320, lowChance: 0.15, highChance: 0.65, depleteChance: 0.12, respawn: 18,
    gives: [{ id: 'croc_hide' }], color: '#4a6a3a', examine: 'A heavy log trap at the water\'s edge. Careful.' },
  hornbill_nest: { name: 'Hornbill nest', level: 120, xp: 500, lowChance: 0.12, highChance: 0.6, depleteChance: 0.12, respawn: 20,
    gives: [{ id: 'hornbill_casque' }, { id: 'feather', min: 10, max: 20 }], color: '#e0b040', examine: 'High in a tualang tree: a hornbill nest.' },
  qilin_trail: { name: 'Qilin trail', level: 200, xp: 900, lowChance: 0.08, highChance: 0.5, depleteChance: 0.15, respawn: 22,
    gives: [{ id: 'qilin_mane' }], color: '#f0d070', examine: 'Golden hoofprints that glow faintly on the stone.' },
  // ---- Endgame Hunter (100-300) ----
  // Each catch goes into that tier's Herblore brew (POTIONS). They lie in
  // grounds of five (world.js) that run dry quicker and take longer to reset
  // than the traps above, so a round of the five has some waiting in it. The
  // xp was set by timing auto gather at each ground: each tier earns about
  // 35% more an hour than the best before it, at the same level (the qilin
  // trail among them; tests/hunt-farm-herb.test.mjs). Until their own art
  // arrives they borrow an older trap's picture (`art`), recoloured (`tint`).
  // The tiger trail is the Night Safari's: +25% XP at night (`night`), never a lock.
  pangolin_burrow: { name: 'Pangolin burrow', level: 100, xp: 520, lowChance: 0.2, highChance: 0.6, depleteChance: 0.35, respawn: 45,
    gives: [{ id: 'pangolin_scales' }], color: '#a8743a', art: 'obj-boar_pit', tint: 'sepia(0.4) saturate(1.2) brightness(1.05)',
    examine: 'A burrow dug under a fig tree. Something scaly snuffles inside.' },
  colugo_trap: { name: 'Colugo trap', level: 130, xp: 720, lowChance: 0.2, highChance: 0.6, depleteChance: 0.35, respawn: 45,
    gives: [{ id: 'colugo_fur' }], color: '#8a8a7a', art: 'obj-squirrel_trap', tint: 'saturate(0.6) brightness(0.95)',
    examine: 'A padded box trap on a tree trunk, where colugos glide in to land.' },
  tiger_trail: { name: 'Tiger trail', level: 160, xp: 960, night: true, lowChance: 0.2, highChance: 0.6, depleteChance: 0.35, respawn: 45,
    gives: [{ id: 'tiger_whisker' }], color: '#f08a2a', art: 'obj-mousedeer_trail', tint: 'sepia(0.6) saturate(2) hue-rotate(-15deg)',
    examine: 'Huge pawprints on the Night Safari track. Best followed after dark.' },
  garuda_nest: { name: 'Garuda nest', level: 200, xp: 1340, lowChance: 0.2, highChance: 0.6, depleteChance: 0.35, respawn: 45,
    gives: [{ id: 'garuda_plume' }], color: '#7a8af0', art: 'obj-hornbill_nest', tint: 'hue-rotate(180deg) saturate(1.3) brightness(1.08)',
    examine: 'A great nest on a crag, lined with feathers that shimmer like the sky.' },
  naga_track: { name: 'Naga track', level: 250, xp: 1830, lowChance: 0.2, highChance: 0.6, depleteChance: 0.35, respawn: 45,
    gives: [{ id: 'naga_scale' }], color: '#3ab08a', art: 'obj-python_trap', tint: 'hue-rotate(90deg) saturate(1.2) brightness(0.95)',
    examine: 'A wide, winding track in the sand, leading down to the haunted shore.' },
  phoenix_roost: { name: 'Phoenix roost', level: 300, xp: 2450, lowChance: 0.2, highChance: 0.6, depleteChance: 0.35, respawn: 45,
    gives: [{ id: 'phoenix_ember' }], color: '#ff7a2a', art: 'obj-qilin_trail', tint: 'sepia(0.8) saturate(3) hue-rotate(-30deg)',
    examine: 'A scorched ring of stones where a phoenix comes to rest. Still warm.' },
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
