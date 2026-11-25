// Archaeology: dig the island's heritage sites for the everyday and ancient
// things people left behind (pottery, coins, kitchen things, traders' weights,
// Temasek-era trinkets), restore what you find at a restoration bench, and
// give the restored artefacts to the museum curator in Chinatown, set by set.
// Cosy by design: everyday and ancient objects only. No war relics, no remains.
//
//   Excavating  (gathering) a dig site never runs dry, like a fishing spot.
//               Each dig turns up the site's material (pottery shards, clay,
//               old coins...) and now and then an encrusted relic.
//   Restoring   (making) at a restoration bench, with a brush: an encrusted
//               relic and two of its site's material become the artefact.
//   The museum  each site's three artefacts are one collection set (a page of
//               the Collection log, so its title comes with it). A finished set
//               pays coins and Archaeology XP, and a small lasting perk: every
//               finished set makes relics a little likelier (RELIC_SET_BONUS).
//
// You can dig with your hands; a trowel (TROWELS, a ladder like the pickaxes')
// makes you faster and finds more. The rules live in src/game/archaeology.js;
// objects.js, items.js and trades-style recipe lists read the tables here, and
// digsites.js places the sites.

import { TOOL_TIERS } from './tooltiers.js';

export const DIG_TAG = 'trowel';

// ---------------- Trowels ----------------
// One per tool tier: the same levels and speed, double-find and rare-find
// bonuses as the pickaxes (tooltiers.js). The first five are sold at the
// Kampong General Store; the rest are crafted at a crafting table from two of
// the tier's bars and four of the site material before it (`from`).
const TROWEL_FROM = [null, null, null, null, null, 'porcelain_shard', 'bronze_fragment', 'jade_bead', 'ship_nail', 'star_glass', 'rift_amber', 'gold_leaf'];
const TROWEL_ART = ['bronze_pickaxe', 'iron_pickaxe', 'steel_pickaxe', 'mithril_pickaxe', 'adamant_pickaxe', 'rune_pickaxe',
  'obsidian_pickaxe', 'orichalcum_pickaxe', 'jade_pickaxe', 'starmetal_pickaxe', 'celestial_pickaxe', 'eternal_pickaxe'];
export const TROWELS = TOOL_TIERS.map((T, i) => {
  const M = T.metal[0].toUpperCase() + T.metal.slice(1);
  return { id: i ? `${T.metal}_trowel` : 'trowel', name: i ? `${M} trowel` : 'Trowel', tier: i, level: T.level, metal: T.metal,
    from: TROWEL_FROM[i], artFrom: [TROWEL_ART[i], 'saturate(0.8) brightness(1.05)'] };
});
export const SHOP_TROWEL_TIER = 4;

// ---------------- Dig sites and their sets ----------------
// [id, name, label, level, material, xp, region, [x0, y0, x1, y1], colour, examine,
//  set id, set name, set title, [[relic id, name, value, examine, sticker, tint] x3]]
// xp was fitted (measured, not guessed) so each site pays about what the best
// rock and tree pay an hour at its own level, with auto gather and the best
// trowel for the level, the extras off (the relics pay again at the bench).
// The jump at the Ubin dig follows the gold and gem rocks' at 40. Each site
// pays more a dig than the one before it (tests/archaeology.test.mjs).
const SITES = [
  ['kampong_ruins', 'Old kampong ruins', 'Kampong ruins', 1, 'pottery_shard', 69, 'Bukit Timah', [4, 4, 50, 40], '#c8a070',
    'The posts and hearth stones of an old kampong house, half under the grass.',
    'kampong_kitchen', 'Kampong kitchen', 'Kampong Keeper', [
      ['tiffin_carrier', 'Enamel tiffin carrier', 120, 'A stacked tiffin carrier, flowers still painted on the enamel.', 'jug', 'hue-rotate(160deg) saturate(1.4)'],
      ['belanga_pot', 'Clay belanga pot', 160, 'A round clay cooking pot, blackened by many a good curry.', 'pot', 'sepia(0.8) brightness(0.8)'],
      ['coconut_scraper', 'Coconut scraper', 220, 'A wooden stool with an iron scraper at one end. Every kitchen had one.', 'bowl', 'sepia(1) saturate(1.4) brightness(0.9)'],
    ]],
  ['coastal_midden', 'Coastal midden', 'Midden', 15, 'clay', 136, 'Sentosa Beach', [4, 85, 92, 102], '#d8c8a0',
    'An old heap of shells and broken pots where fisherfolk once lived by the shore.',
    'shore_life', 'Life by the shore', 'Shore Walker', [
      ['clay_net_weight', 'Clay net weight', 260, 'A fired clay weight with a hole for the net line.', 'clay', 'sepia(0.7) brightness(0.9)'],
      ['shell_bead_necklace', 'Shell bead necklace', 340, 'Tiny shell beads, strung and worn long ago.', 'holy_beads', 'sepia(0.6) brightness(1.1)'],
      ['rattan_fish_trap', 'Rattan fish trap', 420, 'A woven rattan fish trap, still holding its shape.', 'lobster_pot', 'sepia(0.8) saturate(1.2)'],
    ]],
  ['river_godowns', 'Riverside godowns', 'Godowns', 30, 'old_coin', 181, 'Marina Bay', [163, 104, 226, 150], '#b89a6a',
    'The footings of the old godowns where traders stored their goods by the river.',
    'river_trade', 'River trade', 'River Trader', [
      ['brass_trade_weight', 'Brass trade weight', 520, 'A little brass weight shaped like a bird, for weighing spices.', 'ring_of_kampong', 'sepia(1) saturate(1.8)'],
      ['spice_tin', 'Painted spice tin', 640, 'A tin box that still smells faintly of cloves.', 'jug', 'sepia(1) saturate(2) hue-rotate(-20deg)'],
      ['porcelain_teacup', 'Blue-and-white teacup', 800, 'A blue-and-white porcelain teacup, chipped but lovely.', 'bowl', 'hue-rotate(190deg) saturate(1.6) brightness(1.1)'],
    ]],
  ['ubin_dig', 'Old Ubin quarry dig', 'Quarry dig', 45, 'granite', 470, 'Pulau Ubin', [162, 30, 226, 96], '#a8a8a0',
    'Where the stonecutters of Pulau Ubin worked and lived beside the quarry.',
    'quarry_folk', 'Quarry folk', 'Stonecutter', [
      ['batu_giling', 'Batu giling', 1000, 'A granite grinding stone and roller, for making sambal.', 'granite_helm', 'grayscale(0.4) brightness(1.1)'],
      ['stonemason_chisel', 'Stonemason\'s chisel', 1250, 'A worn iron chisel, its handle polished by a stonecutter\'s grip.', 'chisel', 'sepia(0.6) brightness(0.85)'],
      ['stone_lion', 'Little stone lion', 1550, 'A palm-sized stone lion that once sat on a gatepost.', 'granite_helm', 'sepia(0.4) brightness(1.15)'],
    ]],
  ['fort_canning_dig', 'Fort Canning Hill dig', 'Fort Canning', 60, 'celadon_shard', 500, 'Bukit Timah', [52, 4, 92, 40], '#9ad0b0',
    'The old hill above the river, where the kings of Temasek kept their court.',
    'temasek_treasures', 'Temasek treasures', 'Keeper of Temasek', [
      ['gold_armlet', 'Gold armlet', 1900, 'A thin gold armlet, delicately worked, from the days of Temasek.', 'gold_ring', 'brightness(1.1)'],
      ['celadon_bowl', 'Celadon bowl', 2300, 'A sea-green celadon bowl that travelled a long way by junk.', 'bowl', 'hue-rotate(80deg) saturate(1.3) brightness(1.1)'],
      ['glass_bead_string', 'String of glass beads', 2800, 'Bright glass trade beads, red, yellow and blue.', 'holy_beads', 'hue-rotate(300deg) saturate(2)'],
    ]],
  ['kelong_dig', 'Old kelong posts', 'Kelong posts', 75, 'porcelain_shard', 540, 'Changi Coast', [232, 4, 296, 96], '#7ac0c8',
    'The stumps of an old kelong, a fishing hut on stilts, in the mud of the shore.',
    'kelong_days', 'Kelong days', 'Kelong Keeper', [
      ['kelong_lantern', 'Kelong lantern', 3400, 'A brass hurricane lantern that lit the kelong at night.', 'lantern', 'sepia(0.8) saturate(1.4)'],
      ['carved_float', 'Carved wooden float', 4000, 'A net float carved like a little fish.', 'bowl', 'sepia(1) saturate(1.6) hue-rotate(-10deg)'],
      ['brass_ship_bell', 'Brass ship bell', 4800, 'A small brass bell, rung to call the boats home.', 'ring_of_kampong', 'sepia(1) saturate(2) brightness(1.1)'],
    ]],
  // ---- Endgame sites (Archaeology 100-300), in the far regions ----
  ['plantation_dig', 'Old nutmeg plantation', 'Plantation', 100, 'bronze_fragment', 680, 'Kranji Farmlands', [402, 92, 536, 176], '#b8905a',
    'The overgrown rows of a nutmeg plantation, and the planter\'s house beside them.',
    'plantation_days', 'Plantation days', 'Planter', [
      ['nutmeg_grater', 'Nutmeg grater', 6000, 'A little silver grater for nutmeg, made to hang on a chain.', 'ring_of_kampong', 'grayscale(0.6) brightness(1.2)'],
      ['gambier_pot', 'Gambier pot', 7000, 'A big iron pot for boiling gambier leaves.', 'pot', 'grayscale(0.7) brightness(0.7)'],
      ['tally_stick', 'Planter\'s tally stick', 8200, 'A notched stick for counting sacks of spice.', 'arrow_shaft', 'sepia(1) brightness(0.9)'],
    ]],
  ['hermit_camp', 'Forest hermit\'s camp', 'Hermit\'s camp', 130, 'jade_bead', 951, 'Mandai Rainforest', [402, 182, 536, 276], '#7ab07a',
    'A clearing where a hermit once lived among the trees, growing herbs.',
    'forest_hermit', 'The forest hermit', 'Hermit\'s Friend', [
      ['herb_mortar', 'Stone herb mortar', 10000, 'A heavy stone mortar, green with old herbs.', 'pot', 'hue-rotate(60deg) saturate(1.4)'],
      ['bamboo_flute', 'Bamboo flute', 12000, 'A bamboo flute with six holes. It still plays.', 'arrow_shaft', 'hue-rotate(40deg) saturate(1.6) brightness(1.1)'],
      ['carved_walking_stick', 'Carved walking stick', 14500, 'A walking stick carved with vines and little birds.', 'arrow_shaft', 'sepia(1) saturate(1.3) brightness(0.8)'],
    ]],
  ['old_shipyard', 'Old shipyard', 'Shipyard', 160, 'ship_nail', 1253, 'Tuas Docklands', [4, 282, 176, 376], '#8aa0b8',
    'The slipways of a shipyard where wooden junks were built and mended.',
    'shipwrights', 'Shipwrights of Tuas', 'Shipwright', [
      ['caulking_mallet', 'Caulking mallet', 17000, 'A shipwright\'s mallet for packing the seams of a hull.', 'hammer', 'sepia(1) saturate(1.2)'],
      ['prow_figure', 'Carved prow figure', 20000, 'A painted wooden bird that once rode on the prow of a junk.', 'hornbill_casque', 'saturate(1.4) brightness(1.05)'],
      ['brass_compass', 'Brass compass', 24000, 'A brass compass, its needle still pointing true.', 'ring_of_kampong', 'sepia(1) saturate(2.2) brightness(1.15)'],
    ]],
  ['stargazer_terrace', 'Stargazers\' terrace', 'Terrace', 200, 'star_glass', 1670, 'The Celestial Peaks', [364, 282, 536, 376], '#9aa8e0',
    'A flat terrace high in the peaks where stargazers mapped the sky.',
    'stargazers', 'The stargazers', 'Stargazer', [
      ['bronze_astrolabe', 'Bronze astrolabe', 30000, 'A bronze astrolabe for telling the time by the stars.', 'starlit_pendant', 'sepia(0.8) saturate(1.6)'],
      ['star_chart_tile', 'Star chart tile', 36000, 'A glazed tile painted with the stars of the southern sky.', 'glass_orb', 'hue-rotate(200deg) saturate(1.5)'],
      ['bronze_sky_mirror', 'Bronze sky mirror', 43000, 'A round bronze mirror, polished to catch the moon.', 'starlit_pendant', 'sepia(1) saturate(1.3) brightness(1.2)'],
    ]],
  ['buried_courtyard', 'Buried courtyard', 'Courtyard', 250, 'rift_amber', 2473, 'The Shadow Rift', [202, 206, 396, 276], '#b07ad0',
    'A paved courtyard the Rift swallowed long ago, slowly coming back to the light.',
    'rift_courtyard', 'The buried courtyard', 'Courtyard Keeper', [
      ['jade_hairpin', 'Jade hairpin', 52000, 'A jade hairpin carved with a little plum blossom.', 'raw_jade', 'brightness(1.1)'],
      ['lacquer_box', 'Lacquer box', 62000, 'A red lacquer box with a gold crane on the lid.', 'reward_casket_medium', 'hue-rotate(-20deg) saturate(1.6)'],
      ['bronze_wind_chime', 'Bronze wind chime', 74000, 'Five bronze rods that ring softly in the breeze.', 'ring_of_kampong', 'sepia(1) saturate(1.5) brightness(0.95)'],
    ]],
  ['temasek_palace_dig', 'Palace of Temasek', 'Palace', 300, 'gold_leaf', 3198, 'Temasek Ruins', [184, 282, 356, 376], '#f0c850',
    'The floor of the old palace of Temasek, its gold still glinting in the earth.',
    'palace_temasek', 'Palace of Temasek', 'Heir of Temasek', [
      ['palace_seal', 'Palace seal', 90000, 'A carved seal the palace scribes pressed into wax.', 'temple_pendant', 'sepia(1) saturate(2) brightness(1.1)'],
      ['gold_hair_ornament', 'Gold hair ornament', 110000, 'A gold hair ornament shaped like a flower in bloom.', 'starlit_pendant', 'sepia(1) saturate(3) brightness(1.15)'],
      ['temasek_coin_hoard', 'Hoard of Temasek coins', 135000, 'A little jar full of coins from the days of Temasek.', 'reward_casket_hard', 'sepia(1) saturate(2.4) brightness(1.1)'],
    ]],
];

export const DIG_SITES = SITES.map(([id, name, label, level, gives, xp, region, rect, color, examine, set, setName, title, relics]) => ({
  id, name, label, level, gives, xp, region, rect, color, examine, set, setName, title,
  relics: relics.map(([rid, rname, value, rexamine, art, tint], i) => ({ id: rid, name: rname, value, examine: rexamine, artFrom: [art, tint],
    encrusted: `encrusted_${rid}`, weight: [55, 30, 15][i], level: level + 3 * i })),
}));
export const DIG_SITE_BY_ID = Object.fromEntries(DIG_SITES.map((s) => [s.id, s]));
export const DIG_SITE_SIZE = 5;   // dig spots a site holds, together

// ---------------- Relics ----------------
// A dig's chance of an encrusted relic (more with a better trowel's rare-find
// share), and how much each finished museum set adds to it.
export const RELIC_CHANCE = 0.04;
export const RELIC_SET_BONUS = 0.02;   // +2% of the chance per finished set (modest: all twelve add a quarter)
// Restoring: an encrusted relic and two of its site's material, at a
// restoration bench, with a brush. Its XP is RESTORE_XP_MULT times the site's
// dig XP over the relic chance, so restoring the relics an hour of digging
// turns up pays about what that hour of digging paid in play (rich layers and
// all), as the making skills do for the gathering ones (tools/balance/
// productionxp.mjs): measured at 0.9-1.3x at levels 30, 99, 200 and 500
// (tests/archaeology.test.mjs).
export const RESTORE_INPUT = 2;
export const RESTORE_XP_MULT = 4.5;

// The museum's sets, one per site, lowest first. A finished set pays coins and
// as much Archaeology XP as restoring five of its relics.
export const MUSEUM_SETS = DIG_SITES.map((s) => ({ id: s.set, name: s.setName, title: s.title, site: s.id, level: s.level,
  items: s.relics.map((r) => r.id), coins: Math.round(500 + s.level * s.level * 6), xp: Math.round(5 * RESTORE_XP_MULT * s.xp / RELIC_CHANCE) }));
export const MUSEUM_SET_BY_ID = Object.fromEntries(MUSEUM_SETS.map((m) => [m.id, m]));
export const museumPage = (setId) => `museum:${setId}`;

// ---------------- Items ----------------
const MATERIALS = {
  pottery_shard: ['Pottery shard', 6, 'A broken bit of an old clay pot.', ['bowl', 'sepia(0.7) brightness(0.85)']],
  old_coin: ['Old coin', 30, 'A worn little coin. You can just make out its stamp.', ['coins', 'sepia(1) saturate(0.8) brightness(0.8)']],
  celadon_shard: ['Celadon shard', 70, 'A sea-green sliver of celadon glaze.', ['molten_glass', 'hue-rotate(70deg) saturate(0.8)']],
  porcelain_shard: ['Porcelain shard', 95, 'A piece of blue-and-white porcelain.', ['bowl', 'hue-rotate(190deg) saturate(1.4) brightness(1.1)']],
  bronze_fragment: ['Bronze fragment', 140, 'A green-crusted scrap of old bronze.', ['bronze_bar', 'hue-rotate(60deg) saturate(0.7)']],
  jade_bead: ['Jade bead', 200, 'A polished jade bead with a hole through it.', ['raw_jade', 'brightness(1.15)']],
  ship_nail: ['Shipwright\'s nail', 280, 'A long square-cut nail from an old hull.', ['iron_bar', 'sepia(0.9) brightness(0.75)']],
  star_glass: ['Star glass', 380, 'A fleck of dark glass with tiny stars caught in it.', ['molten_glass', 'hue-rotate(220deg) saturate(1.6) brightness(0.8)']],
  rift_amber: ['Rift amber', 520, 'Violet amber from the Rift, warm to the touch.', ['phoenix_ember', 'hue-rotate(240deg) saturate(1.2)']],
  gold_leaf: ['Gold leaf', 720, 'A curl of beaten gold from the palace walls.', ['gold_bar', 'brightness(1.15)']],
};
/** Every Archaeology item, for items.js: the site materials, the relics (both
 *  encrusted and restored), the trowels and the brush. ('clay' and 'granite'
 *  are the old Mining items.) All borrow a sticker until their own arrives. */
export function digItems() {
  const out = {};
  for (const [id, [name, value, examine, art]] of Object.entries(MATERIALS)) out[id] = { name, icon: '🏺', value, stackable: true, examine, artFrom: art };
  for (const s of DIG_SITES) {
    for (const r of s.relics) {
      out[r.id] = { name: r.name, icon: '🏺', value: r.value, stackable: true, artefact: s.set,
        examine: `${r.examine} Give it to the museum curator in Chinatown for the "${s.setName}" set, or sell it.`, artFrom: r.artFrom };
      out[r.encrusted] = { name: `Encrusted ${r.name[0].toLowerCase()}${r.name.slice(1)}`, icon: '🪨', value: Math.round(r.value / 4), stackable: true,
        examine: `Something under a crust of earth: restore it at a restoration bench (Archaeology ${r.level}).`, artFrom: [r.artFrom[0], 'grayscale(0.8) sepia(0.6) brightness(0.65) contrast(0.9)'] };
    }
  }
  for (const t of TROWELS) {
    const T = TOOL_TIERS[t.tier], bits = [];
    if (T.speed) bits.push(`+${T.speed}% speed`);
    if (T.yield) bits.push(`+${Math.round(T.yield * 100)}% double finds`);
    if (T.find) bits.push(`+${Math.round(T.find * 100)}% relics`);
    out[t.id] = { name: t.name, icon: '🪏', value: Math.round(10 * T.value), tool: DIG_TAG, digTier: t.tier, toolLevel: t.level, toolSkill: 'archaeology', artFrom: t.artFrom,
      examine: `A trowel for digging carefully. Archaeology ${t.level} to use${bits.length ? `; ${bits.join(', ')}` : ''}. The best trowel you carry is used for you.` };
  }
  out.soft_brush = { name: 'Soft brush', icon: '🖌️', value: 8, tool: 'brush', artFrom: ['feather', 'sepia(0.6) brightness(0.95)'],
    examine: 'A soft brush for cleaning old finds. Restoring needs one.' };
  return out;
}

/** The restoring recipes (one per relic), in the trades.js shape: { result, qty, inputs: [[id, n]...], level, xp, tool }. */
export function restoreRecipes() {
  const out = [];
  for (const s of DIG_SITES) {
    for (const r of s.relics) {
      out.push({ result: r.id, qty: 1, inputs: [[r.encrusted, 1], [s.gives, RESTORE_INPUT]], level: r.level,
        xp: Math.round(RESTORE_XP_MULT * s.xp / RELIC_CHANCE), tool: 'brush' });
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

/** Crafting recipes for the trowels past the shop's tiers (crafting.js). */
export function trowelCraftRecipes() {
  return TROWELS.filter((t) => t.from).map((t) => ({ result: t.id, inputs: [{ id: `${t.metal}_bar`, qty: 2 }, { id: t.from, qty: 4 }],
    level: t.level + 3, xp: Math.round(40 + t.level * 2.2), tool: 'chisel', upgrade: true }));
}
