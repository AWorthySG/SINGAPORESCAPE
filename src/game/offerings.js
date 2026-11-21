import { getItem } from '../data/items.js';
import { LIFE_STAGES, LIFE_STAGES_ADV, LIFE_STAGES_WILD } from '../data/lifeskills.js';
import { isBone } from '../data/bones.js';
import { materialKind, materialPoints } from './materials.js';
import { isSalvageable } from './salvage.js';

// Everything else the Offering Shrine takes. Materials (materials.js) and spare
import { aOrAn } from '../core/utils.js';
// gear (salvage.js) have their own rules; every other item, from food and
// potions to runes, arrows, seeds, bones, glassware and tools, is a GOOD, worth
// its shop value / 250 shrine points (a 25th of what a material of the same
// value gives). Fractions are kept on the shrine (Shrine.addPoints), so ten
// 25-coin arrows still come to a point.
//
// Why so little: goods are what monsters drop in bulk and what shops sell for
// coins, so they must never beat gathering. Measured with tools/balance/shrine.mjs
// (an hour of auto battle drops, everything "Offer all" takes with its default
// settings; enchanting supplies and tools are never in bulk):
//   level  50: goods ~3,000 points   gear ~5,700    woodcutting ~6,200    mining ~78,000
//   level 150: goods ~5,800          gear ~52,000   woodcutting ~106,000  mining ~408,000
//   level 250: goods ~11,000         gear ~174,000  woodcutting ~347,000  mining ~1,180,000
// so loot is a handy top-up early on and small change later. It also makes
// coins a poor road to blessings: shop goods give a point per 250 coins, and
// cooking a raw fish (a material, a tenth of its value) only lowers its worth.
//
// Never offered: coins (spend them instead), anything with no value (clue
// scrolls, caskets and nests: open them), the Mark of Grace and casino chips
// (tokens, not offerings), and an item a quest you are on still needs.
export const GOODS_RATE = 250;
const TOKENS = new Set(['coins', 'mark_of_grace', 'casino_chip']);
const ENCHANT = new Set(['upgrade_stone', 'refine_scroll', 'upgrade_ward']);

// The kinds of goods, in the order the shrine lists them. `bulk`: whether
// "Offer all" covers the kind (tools and enchanting supplies are kept back).
export const GOODS_KINDS = {
  food: { name: 'Food', bulk: true },
  potion: { name: 'Potions', bulk: true },
  ammo: { name: 'Runes and ammo', bulk: true },
  bone: { name: 'Bones', bulk: true },
  seed: { name: 'Seeds', bulk: true },
  misc: { name: 'Other goods', bulk: true },
  tool: { name: 'Tools', bulk: false },
  enchant: { name: 'Enchanting supplies', bulk: false },
};

/** The kind of good an item is, or null when it is gear, a material, or not offerable at all. */
export function goodsKind(id) {
  let it;
  try { it = getItem(id); } catch { return null; }
  if (TOKENS.has(id) || !(it.value > 0) || isSalvageable(id) || materialKind(id)) return null;
  const tags = it.tags || [];
  if (ENCHANT.has(id)) return 'enchant';
  if (it.tool) return 'tool';
  if (it.heal) return 'food';
  if (tags.includes('potion') || it.potion || /potion|elixir|draught|^super_|focus$/.test(id)) return 'potion';
  if (tags.includes('rune') || tags.includes('ammo')) return 'ammo';
  if (isBone(id)) return 'bone';
  if (tags.includes('seed') || /_seed$/.test(id)) return 'seed';
  return 'misc';
}

/** Shrine points one of a good gives (a fraction; see above). */
export function goodsPoints(id) {
  return goodsKind(id) ? (getItem(id).value || 0) / GOODS_RATE : 0;
}

/** Item ids a quest you are on still needs handed in (not to be offered). */
export function questNeeds(game) {
  const out = new Set(), q = game.quests || {};
  const on = (k) => q[k]?.state === 'active';
  if (on('smith_apprentice')) out.add('steel_bar');
  if (on('mystic_trial')) out.add('death_rune');
  if (on('island_provisions')) out.add('salmon');
  for (const [key, stages] of [['life_skills', LIFE_STAGES], ['life_skills_adv', LIFE_STAGES_ADV], ['life_skills_wild', LIFE_STAGES_WILD]]) {
    const st = on(key) && stages[(q[key].stage || 1) - 1];
    if (st?.need?.item) out.add(st.need.item);
  }
  if (on('bone_collector')) for (const s of game.inventory.slots) if (s && isBone(s.id)) out.add(s.id);
  return out;
}

/** Why the shrine won't take `id` as a good ('' if it will). */
export function goodsRefusal(game, id) {
  if (id === 'coins') return 'The shrine has no use for coins. Spend them, and offer what you buy.';
  if (questNeeds(game).has(id)) return `Keep your ${getItem(id).name.toLowerCase()}: a quest you are on needs it.`;
  if (!goodsKind(id)) {
    let it; try { it = getItem(id); } catch { return 'The shrine won\'t take that.'; }
    if (TOKENS.has(id)) return `The shrine won't take ${aOrAn(it.name.toLowerCase())}.`;
    if (!(it.value > 0)) return `The shrine won't take the ${it.name.toLowerCase()}: open or use it instead.`;
    return 'The shrine won\'t take that.';
  }
  return '';
}

/** The goods in your pack the shrine would take: [{ id, kind, count, per }], by kind then best first. */
export function shrineGoods(game) {
  const order = Object.keys(GOODS_KINDS), need = questNeeds(game), out = [];
  for (const s of game.inventory.slots) {
    if (!s || out.some((o) => o.id === s.id) || need.has(s.id)) continue;
    const kind = goodsKind(s.id);
    if (kind) out.push({ id: s.id, kind, count: game.inventory.count(s.id), per: goodsPoints(s.id) });
  }
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.per - a.per);
}

/** Offer up to `qty` of a good from your pack. Returns the whole shrine points it added (0 when refused). */
export function offerGoods(game, id, qty = 1, { quiet = false } = {}) {
  const why = goodsRefusal(game, id);
  if (why) { if (!quiet) game.msg(why); return 0; }
  const n = Math.min(Math.max(1, Math.floor(qty)), game.inventory.count(id));
  if (n <= 0) { if (!quiet) game.msg(`You have no ${getItem(id).name.toLowerCase()} in your pack.`); return 0; }
  game.inventory.remove(id, n);
  const got = game.shrine.addPoints(n * goodsPoints(id));
  game.saveSoon = true;
  game.bus.emit('shrine');
  if (!quiet) game.msg(`You offer ${n} x ${getItem(id).name} at the shrine: +${pointsText(n * goodsPoints(id))} shrine points.`, 'system');
  return got;
}

/** "12", "3.4" or "0.12": a fractional number of points, short. */
export function pointsText(p) {
  return p >= 100 ? String(Math.round(p)) : p >= 10 ? String(Math.round(p * 10) / 10) : String(Math.round(p * 100) / 100);
}

// ---------------- In bulk ----------------
// "Offer all" for one kind of good (or 'material' for life-skill materials, at
// their usual worth). `keep`: how many of each item to keep back (0 for none).
// Never touches gear (worn or not: gear has its own "Offer all spare gear"),
// quest items, tools or enchanting supplies.

/** What "Offer all" of a kind would take: [{ id, n, points }]. */
export function bulkGoods(game, kind, { keep = 0 } = {}) {
  const need = questNeeds(game), out = [];
  for (const s of game.inventory.slots) {
    if (!s || need.has(s.id) || out.some((o) => o.id === s.id)) continue;
    const isMat = kind === 'material' && materialKind(s.id);
    if (!isMat && (kind === 'material' || goodsKind(s.id) !== kind || !GOODS_KINDS[kind].bulk)) continue;
    const n = game.inventory.count(s.id) - Math.max(0, keep);
    if (n > 0) out.push({ id: s.id, n, points: n * (isMat ? materialPoints(s.id) : goodsPoints(s.id)) });
  }
  return out;
}

/** Offer everything "Offer all" of a kind would take. Returns { items, points } (whole points added). */
export function offerAllGoods(game, kind, opts = {}) {
  const sum = { items: 0, points: 0 };
  for (const p of bulkGoods(game, kind, opts)) {
    game.inventory.remove(p.id, p.n);
    sum.items += p.n;
    sum.points += game.shrine.addPoints(p.points);
  }
  if (sum.items) {
    game.saveSoon = true;
    game.bus.emit('shrine');
    game.spawnSparkle?.(game.player, '#ffe08a', 12);
    game.msg(`You offer ${sum.items} item${sum.items > 1 ? 's' : ''} at the shrine: +${sum.points} shrine points.`, 'level');
  } else game.msg('Nothing of that kind to offer.');
  return sum;
}
