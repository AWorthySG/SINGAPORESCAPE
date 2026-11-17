import { getItem } from '../data/items.js';
import { CLASS_BY_ID, canWear, canWield } from '../data/classes.js';
import { reqLevel, MASTERY_RANKS, STONE, WARD } from './mastery.js';
import { SCROLL } from './refine.js';
import { FEED_CAP, FEED_CAP_RANK } from './materials.js';
import { QUALITY } from './loot.js';
import { EQUIP_SLOTS } from './equipment.js';
import { tierOf, compareGear } from './gear.js';

// Spare gear as a road to progression. Two things to do with a piece you won't
// wear (any class's, any slot), both in the Gear Mastery window and on the
// pack's item menu:
//   sacrifice  feed it to another item type's mastery, as materials are fed;
//   dismantle  break it down into upgrade stones, sometimes a refine scroll,
//              and (from the best qualities and the boss uniques) a ward.
//
// What a piece is worth: its WORTH, the same for both.
//   level     its highest requirement, with diminishing returns: the square
//             root of 1 + level/10 (level 1: 1, level 40: 2.2, level 250: 5.1)
//   tier      where it ranks in its slot, x0.8 (the weakest) to x1.2 (the best)
//   quality   the quality it dropped with (see below): x1 plain, x1.25 Fine,
//             x1.6 Superior, x2.2 Epic, x3.5 Legendary, x6 Mythic
//   unique    boss uniques and signature weapons x25 (counted as level 60 or more)
//
// Measured with a headless hour of auto battle drops (tools/balance/salvage.mjs)
// at levels 50, 150 and 250: about 0.5 pieces of gear drop per kill (champions'
// thirty rolls are most of them), mostly well below your level, at an average
// worth of about 2-3. So:
//   sacrifice: worth x1 mastery points (x1.5 when it's the same kind of gear:
//     same weapon type, or same slot and armour family), at least 1. An hour's
//     drops, all sacrificed into one piece, come to roughly the mastery that
//     hour's kills gave each piece you wore (about 0.75, 1.1 and 1.3 times as
//     much at levels 50, 150 and 250). Kills feed every worn piece, sacrifice
//     only one, so battle stays the main road; and like materials, sacrifice
//     stops at Master.
//   dismantle: worth x0.06 upgrade stones and worth x0.008 refine scrolls,
//     each rounded up or down at random so a plain piece gives a stone now and
//     then and a good one every time. Dismantling every gear drop adds about
//     35-50% to the stones and 35-50% to the scrolls that kills already drop.
//     A Legendary piece has a 5% chance of an upgrade ward and a Mythic 25%
//     (about 40% more wards in all); a boss unique always gives at least one
//     scroll and has a 50% chance of a ward.
//
// Quality: a quality drop raises the item type's mastery (loot.js), but every
// copy shares the type's mastery, so to tell copies apart the game also keeps a
// tally of how many copies of each type dropped at each quality
// (Equipment.quality, saved). Copies of a type look the same in the pack, so
// when one goes, the plainest goes first: the good ones are kept until the last.

export const QUALITY_KEYS = ['fine', 'superior', 'epic', 'legendary', 'mythic'];
export const QUALITY_MULT = { plain: 1, fine: 1.25, superior: 1.6, epic: 2.2, legendary: 3.5, mythic: 6 };
export const UNIQUE_MULT = 25;
export const UNIQUE_MIN_LEVEL = 60;
export const SACRIFICE_RATE = 1;
export const SAME_KIND_MULT = 1.5;
export const STONE_RATE = 0.06;
export const SCROLL_RATE = 0.008;
export const WARD_CHANCE = { legendary: 0.05, mythic: 0.25, unique: 0.5 };

// Boss-only uniques (plus every boss's signature weapon, marked on the item).
const BOSS_UNIQUES = new Set(['tiger_kris', 'merlion_blade', 'cursed_cutlass', 'seraph_blade', 'megalodon_jaw', 'granite_maul',
  'void_blade', 'leviathan_trident', 'tiger_fang', 'merlion_amulet', 'warlord_cape', 'boar_tusk', 'garuda_wings', 'hydra_leather',
  'treant_shield', 'phantom_robe', 'djinn_lamp', 'revenant_cape']);

/** Is this a boss unique or a boss's signature weapon? */
export function isUniqueGear(id) {
  return BOSS_UNIQUES.has(id) || !!getItem(id).signature;
}

/** Can this be sacrificed or dismantled at all? (Gear with stats; not tools.) */
export function isSalvageable(id) {
  let it;
  try { it = getItem(id); } catch { return false; }
  return !!it.equip?.bonuses && !it.tool;
}

/** What a copy of `id` at quality `q` ('plain', 'fine' .. 'mythic') is worth (see above). */
export function gearWorth(id, q = 'plain') {
  if (!isSalvageable(id)) return 0;
  const uniq = isUniqueGear(id);
  const lvl = uniq ? Math.max(UNIQUE_MIN_LEVEL, reqLevel(id)) : reqLevel(id);
  const t = tierOf(id);
  const tier = 0.8 + 0.4 * (t.of > 1 ? 1 - (t.rank - 1) / (t.of - 1) : 1);
  return Math.sqrt(1 + lvl / 10) * tier * (QUALITY_MULT[q] || 1) * (uniq ? UNIQUE_MULT : 1);
}

/** Same kind of gear: the same weapon type, or the same slot (and armour family, if either has one). */
export function sameKind(a, b) {
  const ea = getItem(a).equip, eb = getItem(b).equip;
  if (!ea || !eb || ea.slot !== eb.slot) return false;
  if (ea.slot === 'weapon') return ea.weaponType === eb.weaponType;
  return (ea.family || null) === (eb.family || null);
}

/** Mastery points one copy of `srcId` at quality `q` gives item type `targetId`. */
export function sacrificePoints(targetId, srcId, q = 'plain') {
  const w = gearWorth(srcId, q);
  if (!w || !isSalvageable(targetId)) return 0;
  return Math.max(1, Math.round(SACRIFICE_RATE * w * (sameKind(targetId, srcId) ? SAME_KIND_MULT : 1)));
}

/** What dismantling one copy is expected to give: { stones, scrolls, ward } (averages; ward is a chance). */
export function dismantleYield(id, q = 'plain') {
  const w = gearWorth(id, q);
  if (!w) return { stones: 0, scrolls: 0, ward: 0 };
  const uniq = isUniqueGear(id);
  return {
    stones: STONE_RATE * w,
    scrolls: Math.max(uniq ? 1 : 0, SCROLL_RATE * w),
    ward: uniq ? WARD_CHANCE.unique : WARD_CHANCE[q] || 0,
  };
}

/** Round an average up or down at random, so the average is what you get. */
const rollAmount = (avg, rand) => Math.floor(avg) + (rand() < avg - Math.floor(avg) ? 1 : 0);

/** Roll one dismantle: { stones, scrolls, wards }. */
export function rollDismantle(id, q = 'plain', rand = Math.random) {
  const y = dismantleYield(id, q);
  return { stones: rollAmount(y.stones, rand), scrolls: rollAmount(y.scrolls, rand), wards: rand() < y.ward ? 1 : 0 };
}

// ---------------- Copies and their quality ----------------

/** How many copies of `id` you own: pack, bank and worn. */
function ownedCount(game, id) {
  let n = game.inventory.count(id) + (game.bank?.count(id) || 0);
  for (const s of EQUIP_SLOTS) if (game.equipment.get(s) === id) n++;
  return n;
}

/** Record a quality drop of `id` (called from rollDrops). */
export function recordQuality(equipment, id, q) {
  const i = QUALITY_KEYS.indexOf(q);
  if (i < 0) return;
  const row = equipment.quality[id] || (equipment.quality[id] = [0, 0, 0, 0, 0]);
  row[i]++;
}

/** The qualities of the copies of `id` in your pack, plainest first, e.g.
 *  ['plain', 'plain', 'fine', 'epic']. Quality copies are counted as in the
 *  pack (they arrive there), and the tally never counts more copies than you own. */
export function packQualities(game, id) {
  const n = game.inventory.count(id);
  const row = game.equipment.quality[id] || [];
  const tally = [];
  for (let i = QUALITY_KEYS.length - 1; i >= 0; i--) for (let k = 0; k < (row[i] || 0); k++) tally.push(QUALITY_KEYS[i]);
  const owned = ownedCount(game, id);
  const best = tally.slice(0, Math.min(owned, n));   // best first
  const out = new Array(n - best.length).fill('plain');
  return out.concat(best.reverse());
}

/** One copy of `id` at quality `q` is gone: take it off the tally. */
function useCopy(game, id, q) {
  const i = QUALITY_KEYS.indexOf(q), row = game.equipment.quality[id];
  if (i < 0 || !row) return;
  row[i] = Math.max(0, row[i] - 1);
  if (row.every((x) => !x)) delete game.equipment.quality[id];
}

/** Why `id` should be thought about twice before it goes ('' if not):
 *  it is better than what you wear, a boss unique, or of high quality. */
export function salvageWarning(game, id, q = 'plain') {
  const out = [];
  const cmp = compareGear(id, game.equipment);
  if (cmp && (cmp.verdict === 'upgrade' || cmp.verdict === 'empty') && game._canEquipNow?.(id)) out.push('it is better than what you wear');
  if (isUniqueGear(id)) out.push(getItem(id).signature ? 'it is a boss\'s signature weapon' : 'it is a boss unique');
  if (QUALITY_KEYS.indexOf(q) >= QUALITY_KEYS.indexOf('epic')) out.push(`it is ${QUALITY[q].label} quality`);
  return out.join(', ');
}

// ---------------- Sacrifice ----------------

/** Can `id` take sacrifices right now? '' if so, else why not. */
function targetProblem(game, id) {
  if (!isSalvageable(id)) return 'That has no stats to master.';
  if (!EQUIP_SLOTS.some((s) => game.equipment.get(s) === id) && !game.inventory.count(id)) return 'Wear or carry the gear you want to strengthen.';
  if (game.equipment.masteryPoints(id) >= FEED_CAP) return `Sacrifices can take gear only to ${MASTERY_RANKS[FEED_CAP_RANK].name} mastery. Fight with it to go further.`;
  return '';
}

/** The gear in your pack that could be sacrificed to `targetId`, best first:
 *  [{ id, count, qualities, points (the next copy), total (all copies), warn }]. */
export function sacrificeOptions(game, targetId) {
  const out = [];
  for (const s of game.inventory.slots) {
    if (!s || !isSalvageable(s.id) || out.some((o) => o.id === s.id)) continue;
    const qs = packQualities(game, s.id);
    out.push({ id: s.id, count: qs.length, qualities: qs, points: sacrificePoints(targetId, s.id, qs[0]),
      total: qs.reduce((t, q) => t + sacrificePoints(targetId, s.id, q), 0), warn: salvageWarning(game, s.id, qs[qs.length - 1]) });
  }
  return out.sort((a, b) => b.points - a.points || b.total - a.total);
}

/** What sacrificing up to `qty` copies of `srcId` to `targetId` would give,
 *  without doing it: { n, points, copies (their qualities) }. Stops at Master. */
export function previewSacrifice(game, targetId, srcId, qty = 1) {
  const qs = packQualities(game, srcId);
  let pts = game.equipment.masteryPoints(targetId), points = 0;
  const copies = [];
  for (const q of qs) {
    if (copies.length >= qty || pts >= FEED_CAP) break;
    const p = sacrificePoints(targetId, srcId, q);
    copies.push(q); points += p; pts += p;
  }
  return { n: copies.length, points, copies };
}

/** Sacrifice up to `qty` copies of `srcId` (from your pack) to item type
 *  `targetId`'s mastery. Plainest copies go first; only what it takes to reach
 *  Master is used. Returns the mastery points added (0 when refused). */
export function sacrificeGear(game, targetId, srcId, qty = 1, { quiet = false } = {}) {
  const why = targetProblem(game, targetId);
  if (why) { if (!quiet) game.msg(why); return 0; }
  if (!isSalvageable(srcId)) { if (!quiet) game.msg(`${getItem(srcId).name} can't be sacrificed.`); return 0; }
  if (!game.inventory.count(srcId)) {
    if (!quiet) game.msg(EQUIP_SLOTS.some((s) => game.equipment.get(s) === srcId) ? 'You can\'t sacrifice gear you are wearing: take it off first.' : `You have no ${getItem(srcId).name.toLowerCase()} in your pack.`);
    return 0;
  }
  // The target itself, when it's the only copy and not worn, can't be fed to itself.
  const worn = EQUIP_SLOTS.some((s) => game.equipment.get(s) === targetId);
  let limit = qty;
  if (srcId === targetId && !worn) limit = Math.min(qty, game.inventory.count(srcId) - 1);
  if (limit <= 0) { if (!quiet) game.msg('Keep at least one to strengthen.'); return 0; }
  const pv = previewSacrifice(game, targetId, srcId, limit);
  if (!pv.n) return 0;
  game.inventory.remove(srcId, pv.n);
  for (const q of pv.copies) useCopy(game, srcId, q);
  game._addMastery(targetId, pv.points);
  game.equipment._changed();
  if (!quiet) {
    game.spawnSparkle?.(game.player, '#ffd24a', 10);
    game.msg(`You sacrifice ${pv.n} x ${getItem(srcId).name} to your ${getItem(targetId).name.toLowerCase()}: +${pv.points} mastery.`, 'system');
  }
  return pv.points;
}

// ---------------- Dismantle ----------------

/** Dismantle up to `qty` copies of `id` from your pack (plainest first) into
 *  stones, scrolls and wards. Returns { n, stones, scrolls, wards } (n 0 when refused). */
export function dismantleGear(game, id, qty = 1, { quiet = false, rand = Math.random } = {}) {
  const none = { n: 0, stones: 0, scrolls: 0, wards: 0 };
  if (!isSalvageable(id)) { if (!quiet) game.msg(`${getItem(id).name} can't be dismantled.`); return none; }
  const qs = packQualities(game, id).slice(0, Math.max(0, Math.floor(qty)));
  if (!qs.length) {
    if (!quiet) game.msg(EQUIP_SLOTS.some((s) => game.equipment.get(s) === id) ? 'You can\'t dismantle gear you are wearing: take it off first.' : `You have no ${getItem(id).name.toLowerCase()} in your pack.`);
    return none;
  }
  const got = { n: qs.length, stones: 0, scrolls: 0, wards: 0 };
  for (const q of qs) {
    const r = rollDismantle(id, q, rand);
    got.stones += r.stones; got.scrolls += r.scrolls; got.wards += r.wards;
    useCopy(game, id, q);
  }
  game.inventory.remove(id, qs.length);
  if (got.stones) game.inventory.add(STONE, got.stones);
  if (got.scrolls) game.inventory.add(SCROLL, got.scrolls);
  if (got.wards) game.inventory.add(WARD, got.wards);
  if (!quiet) {
    game.spawnSparkle?.(game.player, '#5FAEE3', 8);
    game.msg(`You dismantle ${qs.length} x ${getItem(id).name}: ${yieldText(got)}.`, 'system');
  }
  return got;
}

/** "3 upgrade stones, 1 refine scroll" (or "nothing useful"). */
export function yieldText(y) {
  const parts = [];
  if (y.stones) parts.push(`${y.stones} upgrade stone${y.stones > 1 ? 's' : ''}`);
  if (y.scrolls) parts.push(`${y.scrolls} refine scroll${y.scrolls > 1 ? 's' : ''}`);
  if (y.wards) parts.push(`${y.wards} upgrade ward${y.wards > 1 ? 's' : ''}`);
  return parts.length ? parts.join(', ') : 'nothing useful this time';
}

// ---------------- In bulk ----------------
// Filters for "Dismantle all" and "Sacrifice all":
//   offClass   gear your class can't wear or wield
//   belowTier  gear below the level of what you wear in its slot
//   (neither ticked: any spare gear)
//   below      only copies of a quality below this ('fine' .. 'mythic';
//              'any' for no limit; 'fine' means plain copies only)
// Never included, whatever the filters: gear better than what you wear (or
// for an empty slot), boss uniques and signature weapons, and the target piece.

/** Is `id` gear your class can't use? */
export function offClass(game, id) {
  const cls = game.jobClass && CLASS_BY_ID[game.jobClass];
  if (!cls) return false;
  const eq = getItem(id).equip;
  return (eq.weaponType && !canWield(cls.id, eq.weaponType)) || !canWear(cls.id, id);
}

/** Is `id` below the level of what you wear in its slot? */
export function belowWornTier(game, id) {
  const worn = game.equipment.get(getItem(id).equip.slot);
  return !!worn && worn !== id && reqLevel(id) < reqLevel(worn);
}

/** The copies a bulk action would take: [{ id, qualities }]. */
export function bulkPicks(game, filters = {}, exclude = null) {
  const { offClass: oc = false, belowTier: bt = false, below = 'any' } = filters;
  const cut = below === 'any' ? Infinity : QUALITY_KEYS.indexOf(below);
  const out = [];
  for (const s of game.inventory.slots) {
    if (!s || s.id === exclude || !isSalvageable(s.id) || out.some((o) => o.id === s.id)) continue;
    if (isUniqueGear(s.id)) continue;
    const cmp = compareGear(s.id, game.equipment);
    if (cmp && (cmp.verdict === 'upgrade' || cmp.verdict === 'empty') && game._canEquipNow?.(s.id)) continue;
    if ((oc || bt) && !((oc && offClass(game, s.id)) || (bt && belowWornTier(game, s.id)))) continue;
    const qs = packQualities(game, s.id).filter((q) => QUALITY_KEYS.indexOf(q) < cut);
    if (qs.length) out.push({ id: s.id, qualities: qs });
  }
  return out;
}

/** Dismantle everything the filters pick. Returns { pieces, stones, scrolls, wards }. */
export function dismantleAll(game, filters = {}, { rand = Math.random } = {}) {
  const sum = { pieces: 0, stones: 0, scrolls: 0, wards: 0 };
  for (const p of bulkPicks(game, filters)) {
    const r = dismantleGear(game, p.id, p.qualities.length, { quiet: true, rand });
    sum.pieces += r.n; sum.stones += r.stones; sum.scrolls += r.scrolls; sum.wards += r.wards;
  }
  if (sum.pieces) game.msg(`You dismantle ${sum.pieces} piece${sum.pieces > 1 ? 's' : ''} of gear: ${yieldText(sum)}.`, 'level');
  else game.msg('No spare gear matches.');
  return sum;
}

/** What "Sacrifice all" would give `targetId`: { pieces, points } (stops at Master). */
export function previewSacrificeAll(game, targetId, filters = {}) {
  let pts = game.equipment.masteryPoints(targetId), pieces = 0, points = 0;
  for (const p of bulkPicks(game, filters, targetId)) {
    for (const q of p.qualities) {
      if (pts >= FEED_CAP) return { pieces, points };
      const v = sacrificePoints(targetId, p.id, q);
      pieces++; points += v; pts += v;
    }
  }
  return { pieces, points };
}

/** Sacrifice everything the filters pick to `targetId`, until it reaches
 *  Master. Returns { pieces, points }. */
export function sacrificeAll(game, targetId, filters = {}) {
  const sum = { pieces: 0, points: 0 };
  const why = targetProblem(game, targetId);
  if (why) { game.msg(why); return sum; }
  for (const p of bulkPicks(game, filters, targetId)) {
    if (game.equipment.masteryPoints(targetId) >= FEED_CAP) break;
    const before = game.inventory.count(p.id);
    const pts = sacrificeGear(game, targetId, p.id, p.qualities.length, { quiet: true });
    sum.points += pts; sum.pieces += before - game.inventory.count(p.id);
  }
  if (sum.pieces) {
    game.spawnSparkle?.(game.player, '#ffd24a', 14);
    game.msg(`You sacrifice ${sum.pieces} piece${sum.pieces > 1 ? 's' : ''} of gear to your ${getItem(targetId).name.toLowerCase()}: +${sum.points} mastery.`, 'level');
  } else game.msg('No spare gear matches.');
  return sum;
}
