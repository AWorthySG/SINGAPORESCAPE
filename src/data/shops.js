import { REGION_SHOPS } from './regionQuests.js';
import { TOOL_KINDS, SHOP_TOOL_TIER, toolId } from './tooltiers.js';
import { DIVE_GEAR, SHOP_DIVE_TIER } from './diving.js';

// Shop stock definitions.
//   buyMul:  multiplier on item value for the price the PLAYER pays to buy.
//   sellMul: multiplier on item value for the price the player RECEIVES when selling.
export const SHOPS = {
  general: {
    name: 'Kampong General Store',
    buyMul: 1.0,
    sellMul: 0.4,
    buysAnything: true,
    stock: [
      // Dancer gear: whips and the silk outfit.
      { id: 'leather_whip', qty: 10 },
      { id: 'rattan_whip', qty: 5 },
      { id: 'studded_whip', qty: 3 },
      { id: 'silk_headdress', qty: 6 },
      { id: 'silk_dancer_top', qty: 6 },
      { id: 'silk_dancer_skirt', qty: 6 },
      { id: 'silk_slippers', qty: 6 },
      { id: 'silk_bangles', qty: 6 },
      { id: 'silk_sash', qty: 6 },
      { id: 'bronze_axe', qty: 10 },
      { id: 'bronze_pickaxe', qty: 10 },
      { id: 'small_net', qty: 10 },
      { id: 'fishing_rod', qty: 10 },
      { id: 'lobster_pot', qty: 10 },
      { id: 'harpoon', qty: 10 },
      { id: 'fishing_bait', qty: 1000 },
      { id: 'tinderbox', qty: 10 },
      { id: 'hammer', qty: 10 },
      { id: 'chisel', qty: 10 },
      { id: 'knife', qty: 10 },
      { id: 'hunting_snare', qty: 10 },
      { id: 'bronze_dagger', qty: 5 },
      { id: 'wooden_shield', qty: 5 },
      { id: 'leather_body', qty: 5 },
      { id: 'bronze_scout_hood', qty: 5 },
      { id: 'bronze_scout_jerkin', qty: 5 },
      { id: 'bronze_scout_breeches', qty: 5 },
      { id: 'bronze_med_helm', qty: 5 },
      { id: 'bronze_chainbody', qty: 5 },
      { id: 'bronze_platelegs', qty: 5 },
      { id: 'shortbow', qty: 5 },
      { id: 'bronze_arrow', qty: 1000 },
      { id: 'iron_arrow', qty: 1000 },
      { id: 'steel_arrow', qty: 1000 },
      // Rounds for Pistolers' and Snipers' guns (rounds.js).
      { id: 'bronze_rounds', qty: 1000 },
      { id: 'iron_rounds', qty: 1000 },
      { id: 'steel_rounds', qty: 1000 },
      { id: 'feather', qty: 1000 },
      { id: 'batik_cape', qty: 5 },
      { id: 'songket_cape', qty: 2 },
    ],
  },
  farming: {
    name: 'Kranji Farm Supplies',
    buyMul: 1.0,
    sellMul: 0.5,
    buysAnything: false,
    stock: [
      { id: 'chilli_seed', qty: 200 },
      { id: 'kangkong_seed', qty: 200 },
      { id: 'pandan_leaves_seed', qty: 200 },
      { id: 'lemongrass_seed', qty: 150 },
      { id: 'sweet_potato_seed', qty: 150 },
      { id: 'sireh_leaf_seed', qty: 100 },
      { id: 'tongkat_ali_seed', qty: 100 },
      { id: 'misai_kucing_seed', qty: 80 },
      { id: 'hempedu_bumi_seed', qty: 60 },
      { id: 'butterfly_pea_seed', qty: 50 },
      { id: 'rambutan_seed', qty: 40 },
      { id: 'ginseng_seed', qty: 20 },
      // The endgame seeds (Farming 100-300), priced by their crop (a third of its
      // value). Otherwise only the strongest monsters drop them, which left
      // Farming the slowest skill to train past 99.
      { id: 'torch_ginger_seed', qty: 200 },
      { id: 'black_nutmeg_seed', qty: 200 },
      { id: 'golden_durian_seed', qty: 150 },
      { id: 'starbloom_seed', qty: 150 },
      { id: 'moon_orchid_seed', qty: 100 },
      { id: 'eternal_lotus_seed', qty: 100 },
      { id: 'vial', qty: 500 },
      { id: 'knife', qty: 10 },
      { id: 'hunting_snare', qty: 10 },
      { id: 'feather', qty: 2000 },
      { id: 'arrow_shaft', qty: 2000 },
    ],
  },
  archery: {
    name: 'Archery Emporium',
    buyMul: 1.0,
    sellMul: 0.45,
    buysAnything: false,
    stock: [
      { id: 'shortbow', qty: 10 },
      { id: 'oak_shortbow', qty: 8 },
      { id: 'willow_shortbow', qty: 6 },
      { id: 'maple_shortbow', qty: 4 },
      { id: 'yew_shortbow', qty: 2 },
      { id: 'longbow', qty: 8 },
      { id: 'oak_longbow', qty: 6 },
      { id: 'willow_longbow', qty: 4 },
      { id: 'maple_longbow', qty: 2 },
      { id: 'coif', qty: 10 },
      { id: 'hide_vest', qty: 10 },
      { id: 'leather_chaps', qty: 10 },
      { id: 'studded_body', qty: 6 },
      { id: 'dragonhide_coif', qty: 3 },
      { id: 'dragonhide_vambraces', qty: 3 },
      { id: 'dragonhide_chaps', qty: 3 },
      { id: 'dragonhide_body', qty: 2 },
      { id: 'bronze_arrow', qty: 2000 },
      { id: 'iron_arrow', qty: 2000 },
      { id: 'steel_arrow', qty: 2000 },
      { id: 'mithril_arrow', qty: 1500 },
      { id: 'adamant_arrow', qty: 1000 },
      { id: 'rune_arrow', qty: 500 },
      // Gun rounds, and the special rounds (rounds.js).
      { id: 'bronze_rounds', qty: 2000 },
      { id: 'iron_rounds', qty: 2000 },
      { id: 'steel_rounds', qty: 2000 },
      { id: 'mithril_rounds', qty: 1500 },
      { id: 'adamant_rounds', qty: 1000 },
      { id: 'rune_rounds', qty: 500 },
      { id: 'incendiary_rounds', qty: 300 },
      { id: 'frost_rounds', qty: 300 },
      { id: 'shock_rounds', qty: 300 },
    ],
  },
  magic: {
    name: 'Mystic Supplies',
    buyMul: 1.0,
    sellMul: 0.5,
    buysAnything: false,
    stock: [
      { id: 'staff', qty: 10 },
      { id: 'magic_staff', qty: 3 },
      { id: 'mystic_staff', qty: 2 },
      { id: 'air_staff', qty: 2 },
      { id: 'water_staff', qty: 2 },
      { id: 'earth_staff', qty: 2 },
      { id: 'fire_staff', qty: 2 },
      { id: 'nature_staff', qty: 1 },
      { id: 'apprentice_wand', qty: 10 },
      { id: 'teak_wand', qty: 3 },
      { id: 'novice_tome', qty: 6 },
      { id: 'wizard_hat', qty: 10 },
      { id: 'wizard_robe_top', qty: 10 },
      { id: 'wizard_robe_bottom', qty: 10 },
      { id: 'mystic_hat', qty: 4 },
      { id: 'mystic_top', qty: 3 },
      { id: 'mystic_bottom', qty: 3 },
      { id: 'air_rune', qty: 5000 },
      { id: 'water_rune', qty: 5000 },
      { id: 'earth_rune', qty: 5000 },
      { id: 'fire_rune', qty: 5000 },
      { id: 'mind_rune', qty: 5000 },
      { id: 'chaos_rune', qty: 1000 },
      { id: 'death_rune', qty: 250 },
      { id: 'blood_rune', qty: 150 },
      { id: 'nature_rune', qty: 500 },
      { id: 'occult_necklace', qty: 1 },
    ],
  },
  hawker: {
    name: 'Hawker Centre',
    buyMul: 1.0,
    sellMul: 0.5,
    buysAnything: false,
    stock: [
      { id: 'kaya_toast', qty: 50 },
      { id: 'satay', qty: 40 },
      { id: 'roti_prata', qty: 30 },
      { id: 'chicken_rice', qty: 20 },
      { id: 'laksa', qty: 15 },
      { id: 'nasi_lemak', qty: 10 },
      // fresh herbs for home cooking
      { id: 'chilli', qty: 100 },
      { id: 'galangal', qty: 100 },
      { id: 'lemongrass', qty: 100 },
      { id: 'pandan_leaves', qty: 100 },
      { id: 'turmeric', qty: 100 },
      // dry goods for a hawker stall's signature dishes (Hawkering, hawkering.js)
      { id: 'bread', qty: 200 },
      { id: 'tea_leaves', qty: 200 },
      { id: 'condensed_milk', qty: 200 },
      { id: 'flour', qty: 200 },
      { id: 'rice', qty: 200 },
      { id: 'kway_teow', qty: 200 },
      { id: 'egg', qty: 200 },
    ],
  },
};

// Every class can buy a starter weapon: bronze, iron and steel of each metal
// weapon type, added to the General Store (bows, staves, wands and whips are
// already sold by the Fletcher, the Mystic Merchant and the store).
const CLASS_METAL_WEAPONS = ['dagger', 'sword', 'scimitar', 'mace', 'longsword', 'battleaxe', 'warhammer', '2h_sword', 'spear', 'claws', 'katana', 'halberd', 'cane', 'pistol', 'shuriken', 'rifle',
  'knuckles', 'orb', 'censer'];
for (const [metal, qty] of [['bronze', 5], ['iron', 3], ['steel', 2]]) {
  for (const t of CLASS_METAL_WEAPONS) {
    const id = `${metal}_${t}`;
    if (!SHOPS.general.stock.some((s) => s.id === id)) SHOPS.general.stock.push({ id, qty });
  }
}
// Secondary types only in bronze, to keep the shop list short on phones: better ones
// come from drops and smithing.
for (const t of ['parang', 'kerambit', 'toya', 'crossbow', 'chakram', 'orb', 'fan', 'monk_gloves']) {
  if (!SHOPS.general.stock.some((s) => s.id === `bronze_${t}`)) SHOPS.general.stock.push({ id: `bronze_${t}`, qty: 5 });
}

// Starter accessories for every style (the cheaper rungs of the ladder).
for (const id of ['gold_amulet', 'emerald_amulet', 'gold_ring', 'emerald_ring', 'batik_cape', 'trades_cape', 'songket_cape', 'amulet_of_power', 'merdeka_medallion', 'sapphire_amulet', 'sapphire_ring', 'ruby_ring', 'ring_of_kampong', 'warlord_cape', 'garuda_wings', 'revenant_cape',
  'pearl_ring', 'pearl_amulet', 'holy_beads', 'pilgrim_cape']) {
  if (!SHOPS.general.stock.some((s) => s.id === id)) SHOPS.general.stock.push({ id, qty: 3 });
}
// The Fletcher sells studded quivers, a ranged off-hand.
for (const [metal, qty] of [['bronze', 5], ['iron', 3], ['steel', 2]]) { const id = `${metal}_quiver`; if (!SHOPS.archery.stock.some((s) => s.id === id)) SHOPS.archery.stock.push({ id, qty }); }

// Every armour family can buy its first boots and gloves (bronze and iron).
for (const [metal, qty] of [['bronze', 5], ['iron', 3]]) {
  for (const t of ['boots', 'gauntlets', 'scout_boots', 'scout_gloves', 'hide_boots', 'hide_vambraces', 'mage_boots', 'mage_gloves']) {
    const id = `${metal}_${t}`;
    if (!SHOPS.general.stock.some((s) => s.id === id)) SHOPS.general.stock.push({ id, qty });
  }
}

// Better gathering tools, iron to adamant, beside the tier-1 ones (tooltiers.js).
// Rune and finer are smithed, fletched or dropped, never sold.
{
  const at = SHOPS.general.stock.findIndex((s) => s.id === 'hunting_snare') + 1;
  const tools = [];
  for (let i = 1; i <= SHOP_TOOL_TIER; i++) for (const K of TOOL_KINDS) tools.push({ id: toolId(K.tag, i), qty: Math.max(2, 10 - 2 * i) });
  SHOPS.general.stock.splice(at, 0, ...tools);
}
// Dive gear (diving.js): the snorkel to the air tank, after the tools. The rest are crafted.
SHOPS.general.stock.push(...DIVE_GEAR.slice(0, SHOP_DIVE_TIER + 1).map((g) => ({ id: g.id, qty: Math.max(2, 10 - 2 * g.tier) })));

// The shops region story quests open (regionQuests.js).
Object.assign(SHOPS, REGION_SHOPS);

export function getShop(id) {
  const shop = SHOPS[id];
  if (!shop) throw new Error(`Unknown shop id: ${id}`);
  return shop;
}
