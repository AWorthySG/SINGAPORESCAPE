// Construction: the materials and furniture of the kampong home (home.js).
//
//   Planks  logs sawn at a sawmill (the lumber yards in Kampong Glam and by
//           Kranji, src/game/construction.js) or your home workbench; each
//           plank follows its log's tier.
//   Bricks  clay fired at a kiln (each lumber yard has one).
//   Nails   hammered from bars at an anvil, with Smithing (smithing.js):
//           fifteen to a bar, each nail following its bar's tier.
//   Furniture
//           planks, nails and bricks built at a workbench: a stool, a chair, a
//           table... up to an eternal heartwood rocking chair. Building them is
//           how you train; they sell, and the bigger home builds take some.
//
// Every make here trains Construction through the shared recipe action
// (Game.startRecipe, skilling.js resolveRecipe), in one shape: { result, qty,
// inputs: [[id, n]], level, xp, at: [station types] }. `at` says where it is
// worked: 'saw' (a sawmill), 'kiln' or 'build' (a workbench); the home
// workbench ('homebench') does both sawing and building.
// XP is as listed times Construction's making multiple (PRODUCTION_XP_MULT in
// skilling.js), fitted so an hour of it pays what Smithing, Crafting and
// Fletching do. Kept free of items.js: items.js reads conItems() from here.

import { aOrAn } from '../core/utils.js';

// One row per tier: its plank, the nail that goes with it and the furniture
// built from both. Levels follow the logs (Woodcutting) and the bars (Smithing).
const TIERS = [
  { k: 'plank', name: 'Plank', log: 'logs', lvl: 1, xp: 3, nail: 'bronze', smith: 1, sxp: 10,
    item: ['wooden_stool', 'Wooden stool', 'A three-legged kampong stool. Simple and sturdy.'], flvl: 1, planks: 2, nails: 5, bricks: 0, fxp: 18 },
  { k: 'oak_plank', name: 'Oak plank', log: 'oak_logs', lvl: 15, xp: 6, nail: 'iron', smith: 15, sxp: 20,
    item: ['oak_chair', 'Oak chair', 'A straight-backed oak chair, for the kopi at dawn.'], flvl: 15, planks: 3, nails: 8, bricks: 0, fxp: 42 },
  { k: 'teak_plank', name: 'Teak plank', log: 'teak_logs', lvl: 30, xp: 11, nail: 'steel', smith: 30, sxp: 30,
    item: ['teak_table', 'Teak table', 'A teak dining table on a brick footing. Seats six, or eight if you squeeze.'], flvl: 33, planks: 4, nails: 10, bricks: 2, fxp: 90 },
  { k: 'mahogany_plank', name: 'Mahogany plank', log: 'mahogany_logs', lvl: 45, xp: 17, nail: 'mithril', smith: 50, sxp: 40,
    item: ['mahogany_cabinet', 'Mahogany cabinet', 'A tall red cabinet for the good plates.'], flvl: 50, planks: 4, nails: 12, bricks: 2, fxp: 140 },
  { k: 'yew_plank', name: 'Yew plank', log: 'yew_logs', lvl: 60, xp: 24, nail: 'adamant', smith: 70, sxp: 50,
    item: ['yew_bookcase', 'Yew bookcase', 'Shelves for every book in the kampong.'], flvl: 62, planks: 5, nails: 12, bricks: 2, fxp: 200 },
  { k: 'magic_plank', name: 'Magic plank', log: 'magic_logs', lvl: 75, xp: 34, nail: 'rune', smith: 85, sxp: 60,
    item: ['magic_wardrobe', 'Magic wardrobe', 'It always seems to have room for one more sarong.'], flvl: 78, planks: 5, nails: 15, bricks: 3, fxp: 290 },
  // Endgame (Construction 100-300): the endgame logs and bars.
  { k: 'seraya_plank', name: 'Seraya plank', log: 'seraya_logs', lvl: 100, xp: 46, nail: 'obsidian', smith: 100, sxp: 82,
    item: ['seraya_daybed', 'Seraya daybed', 'A pale wood daybed for long, lazy afternoons.'], flvl: 100, planks: 5, nails: 15, bricks: 3, fxp: 390 },
  { k: 'meranti_plank', name: 'Meranti plank', log: 'meranti_logs', lvl: 130, xp: 62, nail: 'orichalcum', smith: 130, sxp: 110,
    item: ['meranti_screen', 'Meranti screen', 'A carved folding screen of red meranti.'], flvl: 130, planks: 5, nails: 15, bricks: 3, fxp: 530 },
  { k: 'chengal_plank', name: 'Chengal plank', log: 'chengal_logs', lvl: 160, xp: 84, nail: 'jade', smith: 160, sxp: 150,
    item: ['tok_panjang_table', 'Tok panjang table', 'A long Peranakan feasting table in chengal. The whole family fits.'], flvl: 160, planks: 6, nails: 15, bricks: 4, fxp: 720 },
  { k: 'starwood_plank', name: 'Starwood plank', log: 'starwood_logs', lvl: 200, xp: 113, nail: 'starmetal', smith: 200, sxp: 202,
    item: ['starwood_lantern_stand', 'Starwood lantern stand', 'A lantern stand that glows faintly on its own.'], flvl: 200, planks: 6, nails: 15, bricks: 4, fxp: 970 },
  { k: 'moonwood_plank', name: 'Moonwood plank', log: 'moonwood_logs', lvl: 250, xp: 153, nail: 'celestial', smith: 250, sxp: 274,
    item: ['moonwood_wayang_stage', 'Moonwood wayang stage', 'A little shadow-puppet stage in silvery moonwood.'], flvl: 250, planks: 6, nails: 15, bricks: 4, fxp: 1310 },
  { k: 'heartwood_plank', name: 'Heartwood plank', log: 'eternal_heartwood', lvl: 300, xp: 206, nail: 'eternal', smith: 300, sxp: 370,
    item: ['heartwood_rocking_chair', 'Heartwood rocking chair', 'A golden rocking chair that is always warm. Grandma approves.'], flvl: 300, planks: 6, nails: 15, bricks: 4, fxp: 1770 },
];
// Each tier's wood colour [base, highlight], for the stand-in icons (icons.js).
export const CON_WOOD = {
  plank: ['#c8a06a', '#e4c48e'], oak_plank: ['#b08048', '#d0a46a'], teak_plank: ['#c0905e', '#dcb07e'], mahogany_plank: ['#a8584a', '#c87a62'],
  yew_plank: ['#9a744e', '#c09a6a'], magic_plank: ['#8ab8d0', '#c0e4f4'], seraya_plank: ['#d4b088', '#ecd0aa'], meranti_plank: ['#9a4a32', '#c06a4a'],
  chengal_plank: ['#7a5a2a', '#a07a40'], starwood_plank: ['#4a5ac8', '#9aaaf0'], moonwood_plank: ['#a8b0c8', '#e0e6f4'], heartwood_plank: ['#c8962a', '#f5c84a'],
};
export const CON_TIERS = TIERS.map((t) => ({ plank: t.k, log: t.log, nails: `${t.nail}_nails`, bar: `${t.nail}_bar`, furniture: t.item[0], level: t.lvl }));

// Item values, worked out from what goes in (a plank a little more than its
// log, nails a little more than their share of the bar), so building is never
// a way to mint coins: furniture sells for about what its parts did.
// The log, bar and clay values come from items.js (`value`, passed in).
const NAILS_PER_BAR = 15;
export const BRICK = 'brick';

/** The items Construction adds, as items.js wants them. `value(id)` gives an
 *  existing item's value (logs, bars, clay). Until their stickers arrive they
 *  borrow one in their tier's colours, with vectors as the fallback (icons.js). */
export function conItems(value) {
  const out = {};
  for (const t of TIERS) {
    out[t.k] = { name: t.name, icon: '🪵', value: Math.max(2, Math.round(value(t.log) * 1.2)), stackable: true, tags: ['plank'],
      examine: `A sawn ${t.k === 'plank' ? '' : `${t.name.toLowerCase().replace(/ plank$/, '')} `}plank, ready for building. (Construction ${t.lvl})` };
    const nail = `${t.nail}_nails`, metal = t.nail[0].toUpperCase() + t.nail.slice(1);
    out[nail] = { name: `${metal} nails`, icon: '📌', value: Math.max(1, Math.round(value(`${t.nail}_bar`) * 1.1 / NAILS_PER_BAR)), stackable: true, tags: ['nails'],
      examine: `${metal} nails for Construction, ${NAILS_PER_BAR} hammered from ${aOrAn(t.nail === 'rune' ? 'runite' : t.nail)} bar. (Smithing ${t.smith})` };
  }
  out[BRICK] = { name: 'Brick', icon: '🧱', value: Math.round(value('clay') * 1.5), stackable: true, tags: ['brick'],
    examine: 'A fired clay brick. (Construction 1)' };
  for (const t of TIERS) {
    const [id, name, examine] = t.item;
    const parts = t.planks * out[t.k].value + t.nails * out[`${t.nail}_nails`].value + t.bricks * out[BRICK].value;
    out[id] = { name, icon: '🪑', value: Math.round(parts * 1.1), stackable: true, tags: ['furniture'], examine: `${examine} (Construction ${t.flvl})` };
  }
  return out;
}

// ---------------- Recipes ----------------
// Sawing a plank is a tick at the sawmill, a brick a tick at the kiln, a piece
// of furniture a tick at the workbench: making is instant (autoprocess.js).
export const CONSTRUCT = [
  ...TIERS.map((t) => ({ result: t.k, qty: 1, inputs: [[t.log, 1]], level: t.lvl, xp: t.xp, at: ['saw'] })),
  { result: BRICK, qty: 1, inputs: [['clay', 1]], level: 1, xp: 4, at: ['kiln'] },
  ...TIERS.map((t) => ({ result: t.item[0], qty: 1, level: t.flvl, xp: t.fxp, at: ['build'], tool: 'hammer',
    inputs: [[t.k, t.planks], [`${t.nail}_nails`, t.nails], ...(t.bricks ? [[BRICK, t.bricks]] : [])] })),
];
/** Construction's station types, as an object's `type` (objects.js): the
 *  home workbench ('homebench') both saws and builds. */
export const CON_STATIONS = ['saw', 'kiln', 'build', 'homebench'];
/** The recipes worked at a station of this type. */
export const conRecipes = (type) => CONSTRUCT.filter((r) => r.at.includes(type) || (type === 'homebench' && (r.at.includes('saw') || r.at.includes('build'))));

// ---------------- Nails (Smithing) ----------------
// Fifteen from a bar, at each bar's own Smithing level, for a little less XP
// a bar than a dagger: nails are a material, never the best Smithing an hour.
export const NAIL_SMITH = TIERS.map((t) => ({ result: `${t.nail}_nails`, qty: NAILS_PER_BAR, bar: `${t.nail}_bar`, barCount: 1, level: t.smith, xp: t.sxp }));
