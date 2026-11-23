import { getItem } from '../data/items.js';
import { CROP_BY_ID } from '../data/trades.js';
import { MASTERY_RANKS } from './mastery.js';

// Life-skill materials as a road to combat progression. Two sinks use them:
//   feeding gear mastery (Gear Mastery window): spend materials on an item
//     type to add mastery XP, as kills do;
//   the Offering Shrine in Kampong Glam (shrine.js): donate any material for
//     shrine points that buy permanent offensive blessings.
// (The third road, crafting upgrade stones, refine scrolls and wards, is plain
// recipes in smithing.js and crafting.js.)

// The kinds of material, and which items are which. Only things gathered or
// smelted count: no gear, food, potions, seeds or bones (Prayer has those).
const ORES = new Set(['copper_ore', 'tin_ore', 'iron_ore', 'coal', 'mithril_ore', 'adamantite_ore', 'runite_ore',
  'gold_ore', 'silver_ore', 'clay', 'limestone', 'sandstone', 'granite',
  'obsidian_shard', 'orichalcum_ore', 'raw_jade', 'starmetal_ore', 'celestial_crystal', 'eternal_ore']);
const GEMS = new Set(['sapphire', 'emerald', 'ruby', 'diamond', 'pearl']);
const TROPHIES = new Set(['hornbill_casque', 'qilin_mane',   // Hunter's rarest catches count as hides
  'pangolin_scales', 'colugo_fur', 'tiger_whisker', 'garuda_plume', 'naga_scale', 'phoenix_ember']);   // and the endgame ones (Hunter 100-300)

export const MATERIAL_KINDS = {
  bar: 'metal bars', gem: 'gems and pearls', log: 'logs', hide: 'pelts and hides', herb: 'herbs and crops',
  ore: 'ores and stone', raw: 'raw fish and meat', feather: 'feathers', ash: 'ashes',
};

/** The kind of material an item is ('bar', 'gem', 'log', 'hide', 'herb',
 *  'ore', 'raw', 'feather', 'ash'), or null when it isn't one. */
export function materialKind(id) {
  let it;
  try { it = getItem(id); } catch { return null; }
  if (it.equip || it.tool) return null;
  const tags = it.tags || [];
  if (/_bar$/.test(id)) return 'bar';
  if (GEMS.has(id)) return 'gem';
  if (tags.includes('log')) return 'log';
  if (tags.includes('hide') || TROPHIES.has(id)) return 'hide';
  if (tags.includes('herb') || tags.includes('crop') || CROP_BY_ID[id]) return 'herb';
  if (ORES.has(id)) return 'ore';
  if (tags.includes('raw')) return 'raw';
  if (id === 'feather') return 'feather';
  if (tags.includes('ash')) return 'ash';   // left by burning the endgame logs
  return null;
}

/** What one of a material is worth in shrine points (and the base of its
 *  mastery XP, see materialFeedXp): a tenth of its value (at least 1). Value already tracks how hard a material
 *  is to get (a rune bar 3200, a diamond 3000, magic logs 200, a croc hide
 *  300), so every tier is worth its effort and nothing needs a table. */
export function materialPoints(id) {
  if (!materialKind(id)) return 0;
  return Math.max(1, Math.round((getItem(id).value || 0) / 10));
}

// ---------------- Feeding gear mastery ----------------
// Which material feeds which gear, by what the gear is made of:
//   bars   metal weapons (swords to halberds, claws, pistols, shuriken...),
//          plate and anything else metal, shields
//   logs   bows, crossbows, staves, wands, canes and war fans (wood and bamboo)
//   hides  leather and hide armour (scout leather, archers' hide) and whips
//   gems   rings, amulets and orbs
//   herbs  robes, dancewear and capes: the game has no cloth or silk, so cloth
//          gear is fed with farmed herbs and crops, as the plant dyes and
//          charms woven into it (batik is dyed with plants, after all)
// Ores, raw fish, feathers and ashes feed no gear; they go to the shrine.
//
// Fed materials give mastery XP to ONE piece (kills give XP to every piece
// you wear, see mastery.js killMastery). One material's XP: 12 x its worth (a
// tenth of its value) to the power 0.8, and never less than the old points
// gave (10 XP a point, with its square-root taper). The old taper made the
// endgame bars nearly worthless (an eternal bar was 113 points, so Master took
// over seventy of them); now an eternal bar is ~7,600 XP and a rune bar ~1,200,
// so ten or so of the best bars take a new piece to Master, while cheap
// materials stay what they were (a bronze bar 30 XP).
//
// The cap: materials raise mastery only as far as Master (80,000 XP);
// Grandmaster and Ascended must be earned in battle, and the two ranks above
// those only from world bosses. The last material fed counts in full, so it
// may carry a piece a little past Master.
export const FEED_CAP_RANK = 4;   // Master
export const FEED_CAP = MASTERY_RANKS[FEED_CAP_RANK].xp;

const LOG_WEAPONS = new Set(['shortbow', 'longbow', 'crossbow', 'staff', 'wand', 'cane', 'fan']);

/** The material kind that feeds this item type, or null if it has no stats to master. */
export function feedKind(id) {
  let eq;
  try { eq = getItem(id).equip; } catch { return null; }
  if (!eq?.bonuses) return null;
  if (eq.slot === 'ring' || eq.slot === 'amulet') return 'gem';
  if (eq.slot === 'cape') return 'herb';
  if (eq.slot === 'weapon') {
    const t = eq.weaponType;
    if (LOG_WEAPONS.has(t)) return 'log';
    if (t === 'whip' || t === 'monk_gloves') return 'hide';   // leather lashes and wrapped gloves
    if (t === 'orb') return 'gem';
    return 'bar';
  }
  if (eq.family === 'leather' || eq.family === 'hide') return 'hide';
  if (eq.family === 'robes' || eq.family === 'dancewear') return 'herb';
  return 'bar';
}

/** Mastery XP one of a material gives the gear it feeds (whichever piece). */
export function materialFeedXp(matId) {
  if (!materialKind(matId)) return 0;
  const p = materialPoints(matId);
  return Math.max(10 * Math.min(p, Math.round(2 * Math.sqrt(p))), Math.round(12 * p ** 0.8));
}

/** Mastery XP one `matId` gives item type `gearId` (0 if it doesn't fit). */
export function feedXp(gearId, matId) {
  const k = feedKind(gearId);
  if (!k || materialKind(matId) !== k) return 0;
  return materialFeedXp(matId);
}
