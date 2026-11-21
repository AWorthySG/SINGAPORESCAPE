import { getItem } from '../data/items.js';
import { EQUIP_SLOTS } from './equipment.js';
import { MAX_ENCHANTS, ENCHANT_STEP, enchantPool, enchantLabel } from './mastery.js';
import { MAX_REFINE, refineTag } from './refine.js';
import { compareGear, gearRating, weaponStyle } from './gear.js';

// Carrying upgrades over. When you put a better piece into a slot that already
import { aOrAn } from '../core/utils.js';
// holds one, the old piece's refine level and enchantments move across to it,
// so outgrowing a piece doesn't throw away the scrolls and stones spent on it.
//
// The rules (kept simple, and moved rather than copied so swapping back and
// forth can never make more of anything):
//   better     a higher tier (a bigger base rating, the measure the gear guide
//              ranks a slot by) or an upgrade by compareGear, the same verdict
//              the tooltip and the chat give. A weapon must keep its style
//              (a staff never takes a sword's upgrades), and an off-hand
//              weapon only takes over from an off-hand weapon, not a shield.
//   refine     the two pieces swap refine levels, but at most ★10 goes across:
//              anything above ★10 stays behind on the old piece. A ★12 sword
//              replaced by a plain one leaves the new sword ★10 and the old ★2;
//              replaced by a ★3 one, the new sword is ★10 and the old ★5. The
//              total number of levels never changes. Nothing moves when the
//              new piece is already refined as high as what would arrive.
//   enchants   the old lines move across when the new piece has none, or when
//              they are worth more (lines are weighed by size against each
//              stat's base step, so a +6% crit beats a +3% crit damage). A line
//              the new piece can't roll (a Magic bonus line on a sword) stays
//              behind, and the new piece's own lines go to the old one: a swap
//              again. At most three lines on either piece.
//   not moved  mastery belongs to the gear type (every sword shares Sword
//              mastery, see mastery.js), so a new piece of the same type
//              already has it and there is nothing to move; quality belongs to
//              the copy that dropped with it and stays with that copy.
// Refine and enchant lines belong to an item id (every copy shares them), so nothing moves
// while the old type's record is still in use in another slot, such as a dual
// wielder's other hand. The one exception is a twin pair (the same weapon in
// both hands): its off-hand copy has a record of its own (Equipment.offRefines),
// so replacing that copy carries from the off-hand record, and a twin of the
// main weapon going into the off-hand takes the carry into its off-hand record.
// Replacing the main copy of a twin carries nothing, since the copy left in the
// off-hand goes on reading the main record (see Equipment.copyIn).

/** The most refine levels that move to a new piece. */
export const CARRY_CAP = 10;

/** Is `newId` (a copy of quality `q`) a better piece than `oldId` worn in `slot`, so it should take its upgrades? */
export function isBetterPiece(newId, oldId, equipment, slot, q = null) {
  if (!newId || !oldId || newId === oldId) return false;
  const a = getItem(newId).equip, b = getItem(oldId).equip;
  if (!a?.bonuses || !b?.bonuses) return false;
  if ((a.slot === 'weapon' || b.slot === 'weapon') && (a.slot !== b.slot || weaponStyle(newId) !== weaponStyle(oldId))) return false;
  if (a.slot !== 'weapon' && a.slot !== b.slot) return false;
  if (gearRating(newId) > gearRating(oldId)) return true;   // a higher tier
  return compareGear(newId, equipment, slot, q)?.verdict === 'upgrade';
}

// How much a set of enchant lines is worth: each line as a multiple of its stat's base step.
const linesWorth = (lines) => lines.reduce((s, l) => s + l.value / (ENCHANT_STEP[l.stat] || 1), 0);

/** What would move if `newId` (a copy of quality `q`) went into `slot` now (call it before the swap).
 *  Returns null when nothing would, or { from, to, slot, refine, enchants }:
 *  refine { carried, oldLeft } and enchants { moved, skipped, oldLeft }, each
 *  null when that part doesn't move. */
export function planCarry(equipment, newId, slot, q = null) {
  const oldId = equipment.get(slot);
  if (!isBetterPiece(newId, oldId, equipment, slot, q)) return null;
  // Which record each side reads: the old piece as worn now, the new one once worn there.
  const fromCopy = equipment.copyIn?.(slot) || 'main', toCopy = equipment.copyFor?.(newId, slot) || 'main';
  // The main record stays in use while the type is worn in the other hand.
  if (fromCopy === 'main' && EQUIP_SLOTS.some((s) => s !== slot && equipment.get(s) === oldId)) return null;
  let refine = null, enchants = null;
  const from = equipment.refineLevel(oldId, fromCopy), own = equipment.refineLevel(newId, toCopy);
  const carried = Math.min(from, CARRY_CAP);
  if (carried > own) refine = { carried, oldLeft: Math.min(MAX_REFINE, own + from - carried) };
  const oldLines = equipment.enchantLines(oldId, fromCopy), newLines = equipment.enchantLines(newId, toCopy);
  const pool = new Set(enchantPool(newId));
  const fit = oldLines.filter((l) => pool.has(l.stat)), skipped = oldLines.filter((l) => !pool.has(l.stat));
  if (fit.length && (!newLines.length || linesWorth(fit) > linesWorth(newLines))) {
    enchants = { moved: fit.slice(0, MAX_ENCHANTS), skipped, oldLeft: [...skipped, ...newLines].slice(0, MAX_ENCHANTS) };
  }
  if (!refine && !enchants) return null;
  return { from: oldId, to: newId, slot, fromCopy, toCopy, refine, enchants };
}

/** How `score(newId)` would come out once the upgrades a swap into `slot`
 *  carries have moved across (Equip best weighs a piece as it will be worn).
 *  The move is tried and undone on the spot; nothing is announced or saved. */
export function scoreAfterCarry(equipment, newId, slot, score, q = null) {
  const plan = planCarry(equipment, newId, slot, q);
  if (!plan) return score(newId);
  const keep = { r: { ...equipment.refines }, e: { ...equipment.enchants }, or: { ...equipment.offRefines }, oe: { ...equipment.offEnchants } };
  applyCarry(equipment, plan, { quiet: true });
  try { return score(newId); } finally {
    equipment.refines = keep.r; equipment.enchants = keep.e;
    if (equipment.offRefines) { equipment.offRefines = keep.or; equipment.offEnchants = keep.oe; }
  }
}

/** Move the upgrades a plan describes. */
export function applyCarry(equipment, plan, { quiet = false } = {}) {
  if (!plan) return;
  const { from, to, refine, enchants } = plan;
  // Each side's own record (a twin pair's off-hand copy has one of its own).
  const map = (kind, copy) => (equipment[`${kind}Map`] ? equipment[`${kind}Map`](copy) : equipment[`${kind}s`]);
  if (refine) {
    const rt = map('refine', plan.toCopy), rf = map('refine', plan.fromCopy);
    rt[to] = refine.carried;
    if (refine.oldLeft) rf[from] = refine.oldLeft; else delete rf[from];
  }
  if (enchants) {
    const et = map('enchant', plan.toCopy), ef = map('enchant', plan.fromCopy);
    et[to] = enchants.moved.map((l) => ({ ...l }));
    if (enchants.oldLeft.length) ef[from] = enchants.oldLeft.map((l) => ({ ...l })); else delete ef[from];
  }
  if (!quiet) equipment._changed();
}

/** "★8 refine and +6% crit chance enchant" (what moves, for the chat and the tooltip). */
export function carrySummary(plan) {
  if (!plan) return '';
  const parts = [];
  if (plan.refine) parts.push(`${refineTag(plan.refine.carried)} refine`);
  if (plan.enchants) parts.push(...plan.enchants.moved.map((l) => `${enchantLabel(l)} enchant`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/** The chat lines for a carry that has just happened. */
export function carryMessages(plan) {
  if (!plan) return [];
  const to = getItem(plan.to).name.toLowerCase(), from = getItem(plan.from).name.toLowerCase();
  const n = (plan.refine ? 1 : 0) + (plan.enchants?.moved.length || 0);
  const out = [`Your ${carrySummary(plan)} ${n > 1 ? 'carry' : 'carries'} over to your ${to}.`];
  const left = [];
  if (plan.refine?.oldLeft) left.push(refineTag(plan.refine.oldLeft));
  // (Lines that couldn't move are named on their own below.)
  const traded = plan.enchants ? plan.enchants.oldLeft.slice(plan.enchants.skipped.length) : [];
  if (traded.length) left.push(traded.map(enchantLabel).join(', '));
  if (left.length) out.push(`Your ${from} keeps ${left.join(' and ')}.`);
  if (plan.enchants?.skipped.length) {
    out.push(`${plan.enchants.skipped.map(enchantLabel).join(', ')} can't go on ${aOrAn(to)}, so ${plan.enchants.skipped.length > 1 ? 'they stay' : 'it stays'} on your ${from}.`);
  }
  return out;
}
