import { CROPS } from './trades.js';
import { BOSS_ABILITIES } from './bossAbilities.js';
// NPC registry. Monsters are generated from archetype "bases" × rank tiers into a
// 169-strong bestiary (scaled stats + level-tiered drops), plus 15 hand-authored
// bosses and the townsfolk. Sprites are drawn from def.sprite + def.color.

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Toughness: how much longer monsters and bosses take to bring down than the
// base formulas, through extra health and a sturdier defence (fewer of your
// hits land). Champions, ranks and special spawns all scale from these.
export const MONSTER_TOUGHNESS = { hp: 2.5, defence: 1.25 };
export const BOSS_TOUGHNESS = { hp: 3, defence: 1.2 };
// The first town monsters (level 5 and under: chickens, rats, goblins) stay
// quick to beat so new players can find their feet; toughness then ramps in to
// its full amount by level 15.
const toughAt = (level, full) => 1 + (full - 1) * Math.min(1, Math.max(0, (level - 5) / 10));

function statsFor(level) {
  return {
    maxHp: Math.max(3, Math.round((level * 1.7 + 2) * toughAt(level, MONSTER_TOUGHNESS.hp))),
    attack: Math.max(1, Math.round(level * 0.85)),
    strength: Math.max(1, Math.round(level * 0.85)),
    defence: Math.max(1, Math.round(level * 0.6 * toughAt(level, MONSTER_TOUGHNESS.defence))), // still lowish, so hits land fairly reliably
    maxHit: Math.max(1, Math.ceil(level / 11)),
    attackSpeed: level > 60 ? 5 : 4,
  };
}

// Monsters drop level-appropriate combat equipment (weapons + armour) so hunting
// is a real way to kit out, plus coins/ore. One entry is rolled per kill.
// Metal tier for a level, bronze to eternal, and the tier after it.
const METAL_TIERS = [[10, 'bronze'], [22, 'iron'], [40, 'steel'], [58, 'mithril'], [75, 'adamant'], [95, 'rune'], [125, 'dragon'],
  [150, 'obsidian'], [185, 'orichalcum'], [225, 'jade'], [270, 'starmetal'], [310, 'celestial'], [Infinity, 'eternal']];
function metalFor(level) { return METAL_TIERS.find(([max]) => level < max)[1]; }
function nextMetal(tier) { const i = METAL_TIERS.findIndex(([, t]) => t === tier); return METAL_TIERS[Math.min(METAL_TIERS.length - 1, i + 1)][1]; }
// Arrows of a metal tier (the endgame metals share the nearest arrow).
const ARROW_FOR = { obsidian: 'dragon_arrow', orichalcum: 'dragon_arrow', dragon: 'dragon_arrow', jade: 'jade_arrow', starmetal: 'starmetal_arrow', celestial: 'starmetal_arrow', eternal: 'eternal_arrow' };

// The best seed a monster of this level might carry.
function seedFor(level) {
  let best = CROPS[0];
  for (const c of CROPS) if (c[2] <= level * 0.9) best = c;
  return `${best[0]}_seed`;
}

function dropsFor(level) {
  const tier = metalFor(level);
  const ore = { bronze: 'copper_ore', iron: 'iron_ore', steel: 'coal', mithril: 'mithril_ore', adamant: 'adamantite_ore' }[tier] || 'runite_ore';
  const next = nextMetal(tier);
  const t = [
    { nothing: true, weight: Math.max(6, Math.round(30 - level / 3)) },
    { id: 'coins', min: Math.max(2, Math.round(level * 0.7)), max: Math.max(8, level * 9), weight: 48 },
    { id: ore, min: 1, max: 3, weight: 12 },
    // Arrows of the area's tier, so archers can keep hunting.
    { id: ARROW_FOR[tier] || `${tier}_arrow`, min: 8, max: 25, weight: 10 },
  ];
  // Farming: seeds that suit the area.
  t.push({ id: seedFor(level), min: 1, max: 3, weight: 4 }, { id: seedFor(level / 2), min: 1, max: 4, weight: 4 });
  // Archery gear: a bow of the area's tier and ranged armour, like the melee pool.
  t.push({ id: bowFor(level), weight: 14 });         // ~1 kill in 10
  t.push({ id: bowFor(level + 20), weight: 6 });     // often the next bow up
  t.push({ id: bowFor(level + 40), weight: 2 });     // and now and then a much stronger one
  for (const id of rangedArmourFor(level)) t.push({ id, weight: 3 });
  // Magic gear: staves of the area's tier (~1 kill in 10 drops one), robes and runes.
  const staves = stavesFor(level);
  for (const id of staves) t.push({ id, weight: 14 / staves.length });
  for (const id of robesFor(level)) t.push({ id, weight: 3 });
  for (const r of runesFor(level)) t.push({ id: r.id, min: r.min, max: r.max, weight: r.weight });
  t.push({ id: longbowFor(level), weight: 5 }, { id: wandFor(level), weight: 4 }, { id: tomeFor(level), weight: 2 });
  // Dancer gear: a whip of the area's tier (~1 kill in 18), sometimes the next one up, and outfit pieces.
  t.push({ id: whipFor(level), weight: 8 }, { id: whipFor(level + 20), weight: 2 });
  for (const id of dancerFor(level)) t.push({ id, weight: 2 });
  // Tier-appropriate gear pool — the main way to obtain combat equipment.
  for (const w of ['scimitar', 'sword', 'mace', 'longsword', 'dagger', 'spear', 'claws', 'katana']) t.push({ id: `${tier}_${w}`, weight: 4 });
  t.push({ id: `${tier}_dagger`, weight: 6 });       // daggers come in pairs for dual wielding: extra weight
  for (const a of ['med_helm', 'chainbody', 'platelegs', 'plateskirt', 'kiteshield', 'buckler', 'boots', 'gauntlets']) t.push({ id: `${tier}_${a}`, weight: 3 });
  if (level >= 30) t.push({ id: `${tier}_full_helm`, weight: 3 }, { id: `${tier}_platebody`, weight: 2 }, { id: `${tier}_battleaxe`, weight: 3 });
  if (level >= 50) t.push({ id: `${tier}_2h_sword`, weight: 2 }, { id: `${tier}_halberd`, weight: 2 });
  // A rare glimpse of the next tier up.
  t.push({ id: `${next}_scimitar`, weight: METAL_TIERS.findIndex(([, m]) => m === next) >= 6 ? 1 : 2 });
  return t;
}

// Bow and ranged armour that suit a monster's level.
function bowFor(level) {
  return level < 10 ? 'shortbow' : level < 22 ? 'oak_shortbow' : level < 40 ? 'willow_shortbow'
    : level < 58 ? 'maple_shortbow' : level < 75 ? 'yew_shortbow' : level < 95 ? 'magic_shortbow'
    : level < 115 ? 'dark_bow' : level < 135 ? 'crystal_bow' : level < 160 ? 'twisted_bow'
    : level < 200 ? 'jade_bow' : level < 245 ? 'starmetal_bow' : level < 300 ? 'celestial_bow' : 'eternal_bow';
}
function rangedArmourFor(level) {
  const hide = (t) => [`${t}_coif`, `${t}_body`, `${t}_chaps`, `${t}_vambraces`];
  return level < 40 ? ['coif', 'leather_chaps', 'studded_body']
    : level < 120 ? hide('dragonhide') : level < 250 ? hide('starhide') : hide('eternalhide');
}

// Staves, robes and runes that suit a monster's level.
function stavesFor(level) {
  return level < 10 ? ['staff'] : level < 20 ? ['air_staff', 'water_staff']
    : level < 35 ? ['earth_staff', 'fire_staff', 'magic_staff'] : level < 50 ? ['nature_staff', 'mystic_staff']
    : level < 65 ? ['chaos_staff', 'ancient_staff'] : level < 85 ? ['death_staff', 'blood_staff'] : level < 105 ? ['obsidian_staff']
    : level < 135 ? ['jade_staff'] : level < 165 ? ['imperial_staff'] : level < 220 ? ['starmetal_staff'] : level < 300 ? ['celestial_staff'] : ['eternal_staff'];
}
function longbowFor(level) {
  return level < 10 ? 'longbow' : level < 22 ? 'oak_longbow' : level < 40 ? 'willow_longbow'
    : level < 58 ? 'maple_longbow' : level < 75 ? 'yew_longbow' : level < 95 ? 'magic_longbow' : level < 125 ? 'dragon_longbow'
    : level < 150 ? 'obsidian_longbow' : level < 185 ? 'orichalcum_longbow' : level < 225 ? 'jade_longbow' : level < 270 ? 'starmetal_longbow'
    : level < 310 ? 'celestial_longbow' : 'eternal_longbow';
}
function wandFor(level) {
  return level < 10 ? 'apprentice_wand' : level < 25 ? 'oak_wand' : level < 35 ? 'teak_wand' : level < 50 ? 'maple_wand' : level < 75 ? 'mystic_wand'
    : level < 95 ? 'master_wand' : level < 125 ? 'obsidian_wand' : level < 150 ? 'orichalcum_wand' : level < 185 ? 'jade_wand'
    : level < 225 ? 'starmetal_wand' : level < 280 ? 'celestial_wand' : 'eternal_wand';
}
function tomeFor(level) { return level < 45 ? 'novice_tome' : level < 80 ? 'arcane_tome' : 'merlion_tome'; }
// The Dancer's whips, one per tier, and the silk / golden dancer outfits.
function whipFor(level) {
  return level < 12 ? 'leather_whip' : level < 24 ? 'rattan_whip' : level < 40 ? 'studded_whip' : level < 55 ? 'serpent_whip'
    : level < 70 ? 'coral_whip' : level < 90 ? 'orchid_whip' : level < 110 ? 'dragon_whip' : level < 140 ? 'celestial_whip'
    : level < 185 ? 'jade_whip' : level < 225 ? 'starmetal_whip' : level < 290 ? 'astral_whip' : 'eternal_whip';
}
function dancerFor(level) {
  const tier = level < 60 ? 'silk' : level < 130 ? 'golden' : level < 300 ? 'jade' : 'eternal';
  return ['headdress', 'dancer_top', 'dancer_skirt', 'slippers', 'bangles', 'sash'].map((p) => `${tier}_${p}`);
}
function robesFor(level) {
  const robes = (t) => [`${t}_hat`, `${t}_robe_top`, `${t}_robe_bottom`];
  return level < 30 ? ['wizard_hat', 'wizard_robe_top', 'wizard_robe_bottom'] : level < 100 ? ['mystic_hat', 'mystic_top', 'mystic_bottom']
    : level < 250 ? robes('astral') : robes('eternal');
}
function runesFor(level) {
  const q = (base) => ({ min: Math.round(base * (1 + level / 30)), max: Math.round(base * 3 * (1 + level / 30)) });
  const out = [{ id: 'mind_rune', ...q(8), weight: 4 }, { id: ['air_rune', 'water_rune', 'earth_rune', 'fire_rune'][level % 4], ...q(10), weight: 6 }];
  if (level >= 15) out.push({ id: 'chaos_rune', ...q(4), weight: 4 }, { id: 'nature_rune', ...q(2), weight: 3 });
  if (level >= 35) out.push({ id: 'death_rune', ...q(3), weight: 3 });
  if (level >= 55) out.push({ id: 'blood_rune', ...q(2), weight: 3 });
  return out;
}

function makeMob(id, name, sprite, color, level, zone, aggro, family) {
  return { name, level, attackable: true, sprite, color, zone, family, ...statsFor(level),
    aggressive: aggro, aggroRange: aggro ? 4 : 0, respawn: Math.min(18, Math.max(10, Math.round(10 + level / 40))), wander: 4,   // 6-11s, so high-level areas refill as fast as low ones
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
  ['Jungle wraith', 'ghost', '#9fb0d8', 64, 'Pulau Hantu', true],
  ['Hantu raya', 'ghost', '#b8a0c0', 66, 'Pulau Hantu', true],
  ['Pocong', 'undead', '#e8e2d0', 70, 'Pulau Hantu', true],
  ['Cursed pirate', 'undead', '#7a6a4a', 72, 'Pulau Hantu', true],
  ['Penanggal', 'ghost', '#c06a7a', 78, 'Pulau Hantu', true],
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

const TARGET_MONSTERS = 300;
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
      // High-level generic mobs drift into the Wilderness, but island-native
      // families always stay on their island.
      const zone = bzone === 'Pulau Hantu' ? 'Pulau Hantu' : (level >= 45 ? 'The Wilderness' : bzone);
      // A mix of temperaments: Young and plain-rank monsters keep to themselves;
      // from Wild up, only naturally aggressive species attack on sight.
      _mobs[id] = makeMob(id, name, sprite, color, level, zone, baggro && rank.agg, slug(bn));
      count++;
    }
  }
}
// Endgame monsters: Mythic, Primordial and Eternal forms of the fiercest
// species (levels ~165-320) for the Southern Islands and the Shadow Rift.
const ENDGAME_RANKS = [
  { p: 'Mythic', lo: 165, hi: 215, zone: 'Southern Islands', scale: 1.15 },
  { p: 'Primordial', lo: 215, hi: 265, zone: 'The Shadow Rift', scale: 1.25 },
  { p: 'Eternal', lo: 265, hi: 320, zone: 'The Shadow Rift', scale: 1.35 },
];
const ENDGAME_BASES = ['Imp', 'Sea snake', 'Box jellyfish', 'Jungle spider', 'Wild boar', 'Tarantula', 'Reef shark', 'Wraith', 'Komodo dragon',
  'Stone golem', 'Reticulated python', 'Saltwater crocodile', 'Forest drake', 'Hantu raya', 'Cursed pirate', 'Penanggal'];
for (const rank of ENDGAME_RANKS) {
  ENDGAME_BASES.forEach((bn, i) => {
    const b = BASES.find((x) => x[0] === bn);
    if (!b) return;
    const [, sprite, color] = b;
    const level = Math.round(rank.lo + (rank.hi - rank.lo) * i / (ENDGAME_BASES.length - 1));
    const id = slug(`${rank.p} ${bn}`);
    _mobs[id] = { ...makeMob(id, `${rank.p} ${bn}`, sprite, color, level, rank.zone, true, slug(bn)), scale: rank.scale };
  });
}
// The far regions (east and south of the open world): their own species, each in
// three forms spread across its region's level band.
const FAR_BASES = [
  // [name, sprite, color, zone, aggressive]
  ['Water monitor', 'reptile', '#5a6a3a', 'Punggol Waterway', true],
  ['Grey heron', 'fowl', '#b8c0c8', 'Punggol Waterway', false],
  ['Mudskipper', 'seacreature', '#7a8a5a', 'Punggol Waterway', false],
  ['River otter', 'beast', '#6a5038', 'Punggol Waterway', true],
  ['Water buffalo', 'beast', '#4a4a4a', 'Kranji Farmlands', false],
  ['House crow', 'fowl', '#2a2a30', 'Kranji Farmlands', true],
  ['Field rat', 'rodent', '#8a7050', 'Kranji Farmlands', true],
  ['Scarecrow', 'humanoid', '#caa05a', 'Kranji Farmlands', true],
  ['Banded leaf monkey', 'primate', '#3a3a3a', 'Mandai Rainforest', true],
  ['Sun bear', 'beast', '#2a2420', 'Mandai Rainforest', true],
  ['Clouded leopard', 'beast', '#a08a5a', 'Mandai Rainforest', true],
  ['Bunian', 'ghost', '#a8e0c0', 'Mandai Rainforest', true],
  ['Dock rat', 'rodent', '#6a6a70', 'Tuas Docklands', true],
  ['Rust golem', 'golem', '#a0582a', 'Tuas Docklands', true],
  ['Smuggler', 'humanoid', '#3a4a5a', 'Tuas Docklands', true],
  ['Drowned sailor', 'undead', '#7aa0a0', 'Tuas Docklands', true],
  ['Temasek guardian', 'golem', '#caa86a', 'Temasek Ruins', true],
  ['Ancient naga', 'serpent', '#2f8a6a', 'Temasek Ruins', true],
  ['Ruin wraith', 'ghost', '#c8b8a0', 'Temasek Ruins', true],
  ['Bronze warrior', 'undead', '#c07b3a', 'Temasek Ruins', true],
  ['Storm drake', 'drake', '#5a7ac0', 'The Celestial Peaks', true],
  ['Celestial qilin', 'beast', '#e8d080', 'The Celestial Peaks', true],
  ['Jinn', 'demon', '#4a3a8a', 'The Celestial Peaks', true],
  ['Garuda fledgling', 'fowl', '#e0b040', 'The Celestial Peaks', true],
];
// Level bands of the far regions (kept in step with world.js).
export const FAR_BANDS = {
  'Punggol Waterway': [40, 110], 'Kranji Farmlands': [15, 80], 'Mandai Rainforest': [150, 240],
  'Tuas Docklands': [220, 300], 'Temasek Ruins': [290, 380], 'The Celestial Peaks': [360, 450],
};
const FAR_FORMS = [{ p: '', at: 0.1, scale: 1 }, { p: 'Elder', at: 0.5, scale: 1.1 }, { p: 'Ancient', at: 0.9, scale: 1.2 }];
FAR_BASES.forEach(([bn, sprite, color, zone, aggro], i) => {
  const [lo, hi] = FAR_BANDS[zone];
  for (const f of FAR_FORMS) {
    const name = (f.p ? f.p + ' ' : '') + bn;
    // Stagger the species a little so each band is evenly covered.
    const level = Math.round(lo + (hi - lo) * Math.min(1, f.at + (i % 4) * 0.03));
    const id = slug(name);
    _mobs[id] = { ...makeMob(id, name, sprite, color, level, zone, aggro || !!f.p, slug(bn)), scale: f.scale };
  }
});
// Celestial and Divine forms of the fiercest species, for the two highest regions.
for (const rank of [{ p: 'Celestial', lo: 320, hi: 380, zone: 'Temasek Ruins', scale: 1.4 }, { p: 'Divine', lo: 380, hi: 450, zone: 'The Celestial Peaks', scale: 1.45 }]) {
  ENDGAME_BASES.forEach((bn, i) => {
    const b = BASES.find((x) => x[0] === bn);
    const level = Math.round(rank.lo + (rank.hi - rank.lo) * i / (ENDGAME_BASES.length - 1));
    const id = slug(`${rank.p} ${bn}`);
    _mobs[id] = { ...makeMob(id, `${rank.p} ${bn}`, b[1], b[2], level, rank.zone, true, slug(bn)), scale: rank.scale };
  });
}
for (const id of Object.keys(_mobs)) MONSTER_IDS.push(id);

// ---------------- Bosses (15) ----------------
function makeBoss(id, name, sprite, color, level, zone, scale, drops) {
  return { name, level, attackable: true, boss: true, sprite, color, scale, zone,
    maxHp: Math.round((level * 4.5 + 30) * BOSS_TOUGHNESS.hp),
    attack: Math.round(level * 1.05), strength: Math.round(level * 1.05), defence: Math.round(level * 0.95 * BOSS_TOUGHNESS.defence),
    maxHit: Math.ceil(level / 7) + 3, attackSpeed: 5,
    // Bosses never ambush — you have to walk up and start the fight yourself.
    // Once engaged they still fight back and chase normally.
    aggressive: false, aggroRange: 0, respawn: Math.min(100, Math.round(60 + level / 8)), wander: 3,   // about 40-60s
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
  orang_minyak: makeBoss('orang_minyak', 'Orang Minyak', 'humanoid', '#1f1f1f', 158, 'Pulau Hantu', 2.6,
    [{ id: 'cursed_cutlass', weight: 9 }, { id: 'dragon_2h_sword', weight: 12 }, { id: 'dragon_platebody', weight: 14 }, { id: 'occult_necklace', weight: 10 }, { id: 'runite_ore', min: 3, max: 8, weight: 28 }]),
  // Alignment-arc bosses, placed by hand (fixed): a radiant guardian of the light
  // by the town temple, and a dark sovereign deep in the Wilderness.
  lion_of_light: { ...makeBoss('lion_of_light', 'Lion of Light', 'beast', '#ffe08a', 72, 'Kampong Glam', 2.1,
    [{ id: 'seraph_blade', weight: 8 }, { id: 'blessed_halo', weight: 6 }, { id: 'rune_platebody', weight: 18 }, { id: 'runite_ore', min: 2, max: 5, weight: 26 }, { id: 'amulet_of_glory', weight: 12 }]), fixed: true },
  shadow_sovereign: { ...makeBoss('shadow_sovereign', 'The Shadow Sovereign', 'demon', '#3a2a52', 120, 'The Wilderness', 2.4,
    [{ id: 'void_blade', weight: 8 }, { id: 'shadow_cloak', weight: 6 }, { id: 'dragon_platebody', weight: 16 }, { id: 'runite_ore', min: 3, max: 7, weight: 26 }, { id: 'occult_necklace', weight: 12 }]), fixed: true },
};
// ---- Open-world and endgame bosses ----
const tierGear = (lvl, w) => [
  { id: `${metalFor(lvl)}_platebody`, weight: 14 * w }, { id: `${metalFor(lvl)}_full_helm`, weight: 14 * w }, { id: `${metalFor(lvl)}_platelegs`, weight: 12 * w },
  { id: `${metalFor(lvl)}_2h_sword`, weight: 10 * w }, { id: `${metalFor(lvl)}_katana`, weight: 10 * w }, { id: `${metalFor(lvl)}_halberd`, weight: 8 * w },
  { id: `${nextMetal(metalFor(lvl))}_scimitar`, weight: 5 * w }, { id: `${nextMetal(metalFor(lvl))}_platebody`, weight: 3 * w },
  { id: 'runite_ore', min: 3, max: 10, weight: 12 }, { id: 'diamond', min: 1, max: 3, weight: 8 },
];
Object.assign(BOSS_DEFS, {
  supertree_guardian: makeBoss('supertree_guardian', 'Supertree Guardian', 'plant', '#2f9a6a', 140, 'Gardens by the Bay', 2.3, tierGear(140, 1)),
  coney_behemoth: makeBoss('coney_behemoth', 'Coney Island Behemoth', 'beast', '#8a5a3a', 155, 'Coney Island', 2.3, tierGear(155, 1)),
  kusu_tortoise: makeBoss('kusu_tortoise', 'Great Kusu Tortoise', 'turtle', '#3a8a6a', 195, 'Southern Islands', 2.5, tierGear(195, 1)),
  rift_tyrant: makeBoss('rift_tyrant', 'Rift Tyrant', 'demon', '#5a1a6a', 260, 'The Shadow Rift', 2.6, tierGear(260, 1)),
  eternal_wyrm: makeBoss('eternal_wyrm', 'The Eternal Wyrm', 'drake', '#f5b82e', 320, 'The Shadow Rift', 2.8,
    [...tierGear(320, 1), { id: 'eternal_bow', weight: 4 }, { id: 'eternal_staff', weight: 4 }, { id: 'eternal_whip', weight: 4 }, { id: 'eternal_2h_sword', weight: 4 }]),
  // The far regions
  kranji_buffalo_king: makeBoss('kranji_buffalo_king', 'Kranji Buffalo King', 'beast', '#3a3a3a', 80, 'Kranji Farmlands', 2.2, tierGear(80, 1)),
  punggol_lantern_spirit: makeBoss('punggol_lantern_spirit', 'Punggol Lantern Spirit', 'ghost', '#ffc870', 110, 'Punggol Waterway', 2.2, tierGear(110, 1)),
  harimau_jadian: makeBoss('harimau_jadian', 'Harimau Jadian', 'beast', '#d08a3a', 210, 'Mandai Rainforest', 2.5, tierGear(210, 1)),
  bunian_queen: makeBoss('bunian_queen', 'Bunian Queen', 'ghost', '#8ae0b0', 235, 'Mandai Rainforest', 2.5, tierGear(235, 1)),
  tuas_crane_colossus: makeBoss('tuas_crane_colossus', 'Tuas Crane Colossus', 'golem', '#e0a030', 270, 'Tuas Docklands', 2.7, tierGear(270, 1)),
  drowned_admiral: makeBoss('drowned_admiral', 'The Drowned Admiral', 'undead', '#5a8a9a', 295, 'Tuas Docklands', 2.6, tierGear(295, 1)),
  singa_of_temasek: makeBoss('singa_of_temasek', 'Singa of Temasek', 'beast', '#f0c040', 350, 'Temasek Ruins', 2.8, tierGear(350, 1.2)),
  spirit_of_badang: makeBoss('spirit_of_badang', 'Spirit of Badang', 'humanoid', '#8a6a4a', 380, 'Temasek Ruins', 2.8, tierGear(380, 1.2)),
  celestial_garuda: makeBoss('celestial_garuda', 'The Celestial Garuda', 'drake', '#ffd860', 420, 'The Celestial Peaks', 2.9,
    [...tierGear(420, 1.3), { id: 'eternal_bow', weight: 6 }, { id: 'eternal_whip', weight: 6 }]),
  jade_dragon: makeBoss('jade_dragon', 'The Jade Emperor\'s Dragon', 'drake', '#2f9a6a', 450, 'The Celestial Peaks', 3.0,
    [...tierGear(450, 1.5), { id: 'eternal_bow', weight: 6 }, { id: 'eternal_staff', weight: 6 }, { id: 'eternal_whip', weight: 6 }, { id: 'eternal_2h_sword', weight: 6 }]),
});
const BOSS_IDS = Object.keys(BOSS_DEFS);

// Give every boss a special mechanic (cycled) + a special-attack cadence.
const MECHANICS = ['slam', 'heal', 'summon', 'enrage', 'frenzy'];
BOSS_IDS.forEach((id, i) => {
  BOSS_DEFS[id].mechanic = MECHANICS[i % MECHANICS.length];
  BOSS_DEFS[id].specialEvery = 9;
  // Each boss's own signature move and ground-attack patterns (see bossAbilities.js).
  if (BOSS_ABILITIES[id]) BOSS_DEFS[id].ability = BOSS_ABILITIES[id];
});

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
  { id: 'nature_rune', min: 5, max: 25, weight: 8 },
  { id: 'chaos_staff', weight: 2 },
  { id: 'death_staff', weight: 1 },
  { id: 'blood_staff', weight: 1 },
];

// ---------------- Townsfolk ----------------
const TOWNSFOLK = {
  guide: { name: 'Kampong Guide', level: 0, attackable: false, role: 'dialogue', wander: 0, examine: 'He looks like he knows his way around.', dialogue: 'guide' },
  shopkeeper: { name: 'Shopkeeper', level: 0, attackable: false, role: 'shop', wander: 0, examine: 'He owns the general store.', shop: 'general' },
  banker: { name: 'Banker', level: 0, attackable: false, role: 'bank', wander: 0, examine: 'He can look after my valuables.' },
  hawker: { name: 'Hawker Auntie', level: 0, attackable: false, role: 'shop', wander: 0, examine: 'She sells delicious local food.', shop: 'hawker' },
  mage: { name: 'Mystic Merchant', level: 0, attackable: false, role: 'shop', wander: 0, examine: 'She trades in staves and runes.', shop: 'magic' },
  fletcher: { name: 'Fletcher', level: 0, attackable: false, role: 'shop', wander: 0, examine: 'He sells bows, arrows and ranged armour.', shop: 'archery' },
  slayer_master: { name: 'Slayer Master Rajan', level: 0, attackable: false, role: 'dialogue', wander: 0, examine: 'He assigns Slayer tasks to the worthy.', dialogue: 'slayer' },
  skills_tutor: { name: 'Cikgu Surya', level: 0, attackable: false, role: 'dialogue', wander: 0, examine: 'A patient teacher of the island\'s trades.', dialogue: 'tutor' },
  light_priestess: { name: 'Sister Mei', level: 0, attackable: false, role: 'dialogue', wander: 0, examine: 'A serene priestess who offers the path of redemption.', dialogue: 'priestess' },
  shadow_broker: { name: 'The Tempter', level: 0, attackable: false, role: 'dialogue', wander: 0, examine: 'A hooded figure who whispers of corruption.', dialogue: 'tempter' },
  farmer: { name: 'Farmer Lim', level: 0, attackable: false, role: 'shop', wander: 0, examine: 'He sells seeds, vials, knives and snares.', shop: 'farming' },
  villager: { name: 'Villager', level: 0, attackable: false, role: 'dialogue', wander: 5, examine: 'A local resident.', dialogue: 'villager' },
};

export const NPCS = {};
for (const id of MONSTER_IDS) NPCS[id] = _mobs[id];
// Every boss also drops archery loot: a bow a tier above its level, a big
// bundle of good arrows, and dragonhide.
for (const id of BOSS_IDS) {
  const b = BOSS_DEFS[id];
  const lvl = b.level || 1;
  const arrow = lvl < 50 ? 'mithril_arrow' : lvl < 90 ? 'adamant_arrow' : 'rune_arrow';
  b.dropTable = [...(b.dropTable || []),
    { id: bowFor(lvl + 25), weight: 20 },
    { id: bowFor(lvl + 50), weight: 8 },
    { id: arrow, min: 60, max: 200, weight: 8 },
    ...rangedArmourFor(Math.max(40, lvl)).map((a) => ({ id: a, weight: 3 })),
    // A pair-worthy dagger for dual wielders.
    { id: lvl < 60 ? 'adamant_dagger' : lvl < 100 ? 'rune_dagger' : `${metalFor(lvl)}_dagger`, weight: 12 },
    // Dancer loot: a whip a tier or two up, and dancer outfit pieces.
    { id: whipFor(lvl + 20), weight: 14 }, { id: whipFor(lvl + 45), weight: 5 },
    ...dancerFor(Math.max(30, lvl)).map((a) => ({ id: a, weight: 2 })),
    { id: longbowFor(lvl + 20), weight: 8 }, { id: wandFor(lvl + 20), weight: 6 }, { id: tomeFor(lvl + 20), weight: 4 },
    // Magic loot: a staff a tier above, mystic robes and big bundles of strong runes.
    ...stavesFor(lvl + 20).map((st) => ({ id: st, weight: 20 / 2 })),
    ...robesFor(Math.max(30, lvl)).map((a) => ({ id: a, weight: 3 })),
    { id: lvl < 60 ? 'death_rune' : 'blood_rune', min: 40, max: 150, weight: 8 },
    { id: 'chaos_rune', min: 60, max: 200, weight: 6 },
    { id: 'nature_rune', min: 20, max: 80, weight: 5 },
    // Farming: rare seeds, and the high-level herbs' seeds from the strongest.
    { id: seedFor(lvl), min: 2, max: 5, weight: 8 },
  ];
}
for (const id of BOSS_IDS) NPCS[id] = BOSS_DEFS[id];
Object.assign(NPCS, TOWNSFOLK);

export { MONSTER_IDS, BOSS_IDS };

export function getNpc(id) {
  const npc = NPCS[id];
  if (!npc) throw new Error(`Unknown npc id: ${id}`);
  return npc;
}
