import { HIDE_CRAFT } from './trades.js';
import { diveCraftRecipes } from './diving.js';
import { trowelCraftRecipes } from './archaeology.js';
import { CRAFTED_ACCESSORIES } from './accessories.js';

// Crafting recipes. Worked at a crafting table: inputs -> result. Jewelry needs a
// chisel. Gives the materials gathered from the new mining/woodcutting nodes a use.
export const CRAFT = [
  { result: 'pot', inputs: [{ id: 'clay', qty: 1 }], level: 1, xp: 6 },
  { result: 'bowl', inputs: [{ id: 'clay', qty: 1 }], level: 5, xp: 9 },
  { result: 'gold_ring', inputs: [{ id: 'gold_bar', qty: 1 }], level: 5, xp: 18 },
  { result: 'gold_amulet', inputs: [{ id: 'gold_bar', qty: 1 }], level: 8, xp: 30 },
  { result: 'sapphire_ring', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'sapphire', qty: 1 }], level: 12, xp: 50, tool: 'chisel' },
  { result: 'sapphire_amulet', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'sapphire', qty: 1 }], level: 16, xp: 65, tool: 'chisel' },
  { result: 'emerald_amulet', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'emerald', qty: 1 }], level: 27, xp: 90, tool: 'chisel' },
  { result: 'ruby_amulet', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'ruby', qty: 1 }], level: 42, xp: 125, tool: 'chisel' },
  { result: 'granite_shield', inputs: [{ id: 'granite', qty: 2 }], level: 50, xp: 130 },
  { result: 'diamond_amulet', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'diamond', qty: 1 }], level: 55, xp: 165, tool: 'chisel' },
  { result: 'granite_maul', inputs: [{ id: 'granite', qty: 5 }], level: 58, xp: 240 },

  // ---- Pottery ----
  { result: 'jug', inputs: [{ id: 'clay', qty: 1 }], level: 8, xp: 12 },
  { result: 'pie_dish', inputs: [{ id: 'clay', qty: 1 }], level: 10, xp: 14 },

  // ---- Glassblowing (sandstone -> glass) ----
  { result: 'molten_glass', inputs: [{ id: 'sandstone', qty: 1 }], level: 20, xp: 35 },
  { result: 'vial', inputs: [{ id: 'molten_glass', qty: 1 }], level: 22, xp: 18 },
  { result: 'glass_orb', inputs: [{ id: 'molten_glass', qty: 1 }], level: 28, xp: 30 },
  { result: 'lantern', inputs: [{ id: 'molten_glass', qty: 1 }, { id: 'bronze_bar', qty: 1 }], level: 33, xp: 45 },

  // ---- Gem rings (need a chisel) ----
  { result: 'emerald_ring', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'emerald', qty: 1 }], level: 30, xp: 95, tool: 'chisel' },
  { result: 'ruby_ring', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'ruby', qty: 1 }], level: 44, xp: 130, tool: 'chisel' },
  { result: 'diamond_ring', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'diamond', qty: 1 }], level: 58, xp: 170, tool: 'chisel' },

  // ---- Pearl jewellery: a caster's first rungs, and prayer beads ----
  { result: 'pearl_ring', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'pearl', qty: 1 }], level: 10, xp: 40, tool: 'chisel' },
  { result: 'holy_beads', inputs: [{ id: 'pearl', qty: 2 }], level: 12, xp: 45 },
  { result: 'pearl_amulet', inputs: [{ id: 'silver_bar', qty: 1 }, { id: 'pearl', qty: 2 }], level: 14, xp: 55, tool: 'chisel' },
  { result: 'ring_of_devotion', inputs: [{ id: 'gold_bar', qty: 1 }, { id: 'pearl', qty: 1 }], level: 20, xp: 70, tool: 'chisel' },

  // ---- Specialised jewellery pairs ----
  ...CRAFTED_ACCESSORIES.map(([result, , , , , , level, xp, materials]) => ({
    result, level, xp, tool: 'chisel', inputs: materials.map(([id, qty]) => ({ id, qty })),
  })),

  // ---- Granite armour ----
  { result: 'granite_helm', inputs: [{ id: 'granite', qty: 1 }], level: 45, xp: 90 },
  { result: 'granite_legs', inputs: [{ id: 'granite', qty: 3 }], level: 55, xp: 170 },
  { result: 'granite_body', inputs: [{ id: 'granite', qty: 4 }], level: 60, xp: 230 },

  // ---- Hunter hides into archer armour ----
  ...HIDE_CRAFT,

  // ---- Diving: pearl jewellery, and dive gear past the shop's (diving.js) ----
  ...diveCraftRecipes(),
  // ---- Archaeology: trowels past the shop's (archaeology.js) ----
  ...trowelCraftRecipes(),

  // ---- Refine scrolls and upgrade wards (see refine.js and mastery.js) ----
  // Crafting, because it is already the trade that sets gems into metal with
  // a chisel; the feathers are the quills the smith-lore is written with
  // (Hunter's bird snares). `qty` come out per make; `upgrade` keeps these out
  // of "Craft all", so gems and bars are only spent on them by choice.
  //
  // Scroll yield against combat: a good fight around level 100 drops about ten
  // scrolls in ten minutes (0.8% a kill at ~30 kills a minute, a champion's
  // 35%, a boss's 6-10). A gem rock gives a level-40+ miner roughly 8 gems in
  // ten minutes (half sapphires, a quarter emeralds, then rubies and the odd
  // diamond), and the bars take about as long again, so twenty minutes of
  // gathering and crafting comes to about 12-16 scrolls for a crafter who can
  // use every tier (fewer lower down): close to the pace of fighting. Each
  // scroll costs some 420-890 coins of gem and bar, against 60-350 for a
  // stone, so scrolls stay the dearer of the two; the higher tiers give more
  // per craft, making the most of a rare gem.
  { result: 'refine_scroll', qty: 1, inputs: [{ id: 'sapphire', qty: 1 }, { id: 'steel_bar', qty: 1 }, { id: 'feather', qty: 5 }], level: 35, xp: 60, tool: 'chisel', upgrade: true },
  { result: 'refine_scroll', qty: 2, inputs: [{ id: 'emerald', qty: 1 }, { id: 'mithril_bar', qty: 1 }, { id: 'feather', qty: 5 }], level: 52, xp: 110, tool: 'chisel', upgrade: true },
  { result: 'refine_scroll', qty: 4, inputs: [{ id: 'ruby', qty: 1 }, { id: 'adamant_bar', qty: 1 }, { id: 'feather', qty: 10 }], level: 70, xp: 200, tool: 'chisel', upgrade: true },
  { result: 'refine_scroll', qty: 7, inputs: [{ id: 'diamond', qty: 1 }, { id: 'rune_bar', qty: 1 }, { id: 'feather', qty: 10 }], level: 90, xp: 340, tool: 'chisel', upgrade: true },
  // Skill chain: Smithing's hooks and Hunter's feathers make lures that help Fishing.
  { result: 'feather_lure', qty: 10, inputs: [{ id: 'barbed_hooks', qty: 10 }, { id: 'feather', qty: 10 }], level: 25, xp: 40 },
  // Wards are rare: a boss drops 1-3, a champion one time in ten. Making one
  // takes two top gems, a pearl and two adamant bars (some 6,400 coins of
  // material for a 2,500-coin ward), and the hornbill casque recipe is for
  // the very top end (Hunter 120 to catch one).
  { result: 'upgrade_ward', qty: 1, inputs: [{ id: 'diamond', qty: 1 }, { id: 'ruby', qty: 1 }, { id: 'pearl', qty: 1 }, { id: 'adamant_bar', qty: 2 }], level: 80, xp: 400, tool: 'chisel', upgrade: true },
  { result: 'upgrade_ward', qty: 3, inputs: [{ id: 'hornbill_casque', qty: 1 }, { id: 'diamond', qty: 1 }, { id: 'rune_bar', qty: 2 }], level: 120, xp: 900, tool: 'chisel', upgrade: true },
];

// ---- Endgame crafting (Crafting 100-300) ----
// The endgame jewellery (items.js ENDGAME_JEWELLERY), cut from the tier's ore
// or bar with a chisel, and the Dancer's war fans and later whips, which
// otherwise only drop: a fan is the tier's bar beaten into ribs and fletched
// with feathers, a whip the bar drawn into links over a braided crocodile-hide
// core. Levels are the tier's level plus small per-piece offsets. `xp` is the
// tier's best make (its jewellery, or its whip), each tier about 35% more than
// the last, starting from the upgrade ward (400), the best make below level
// 100 that needs no rare Hunter trophy: one make is a tick whatever it is, so
// that is also ~35% more XP an hour. (The casque ward, 900 at level 120, sits
// above the 100 tier; its hornbill casques are too rare to train on.)
// Crafted gear is always plain: quality is only rolled for monster drops.
// Robes, hide and dancewear stay drop-only: the game has no cloth, silk or
// endgame hide to make them from.
const _CRAFT_TIERS = [
  { k: 'obsidian', base: 100, xp: 540, jewel: 'obsidian_ring', from: ['obsidian_shard', 2] },
  { k: 'orichalcum', base: 130, xp: 729, jewel: 'orichalcum_amulet', from: ['orichalcum_bar', 2] },
  { k: 'jade', base: 160, xp: 985, jewel: 'jade_ring', from: ['raw_jade', 2], whip: 'jade_whip' },
  { k: 'starmetal', base: 200, xp: 1330, jewel: 'star_amulet', from: ['starmetal_ore', 2], whip: 'starmetal_whip' },
  { k: 'celestial', base: 250, xp: 1796, jewel: 'celestial_ring', from: ['celestial_crystal', 2], whip: 'astral_whip' },
  { k: 'eternal', base: 300, xp: 2425, jewel: 'eternal_amulet', from: ['eternal_ore', 2], whip: 'eternal_whip' },
];
for (const T of _CRAFT_TIERS) {
  const bar = `${T.k}_bar`;
  CRAFT.push({ result: T.jewel, inputs: [{ id: T.from[0], qty: T.from[1] }], level: T.base, xp: T.xp, tool: 'chisel' });
  CRAFT.push({ result: `${T.k}_fan`, inputs: [{ id: bar, qty: 1 }, { id: 'feather', qty: 20 }], level: T.base + 4, xp: Math.round(T.xp * 0.75) });
  if (T.whip) CRAFT.push({ result: T.whip, inputs: [{ id: bar, qty: 2 }, { id: 'croc_hide', qty: 2 }], level: T.base + 8, xp: T.xp });
}
