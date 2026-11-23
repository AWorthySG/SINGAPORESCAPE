// Equip best's own rule, in one place. The green arrow on the bag, the Equip
// best bar's count, the "Wear it" note, the tracker's gear row, the hold
// card's verdict, the chat and bulk salvage all ask here, so they agree with
// what Equip best would really put on. They used to ask compareGear, which
// weighs a piece as it is in the bag: a plain Starmetal sword read
// "▼ Downgrade" against a ★9 jade sword with three lines, though Equip best
// wears it and the ★ and lines carry over to it (carry.js), and bulk dismantle
// could take it. No DOM, no Math.random.
import { getItem } from '../data/items.js';
import { EQUIP_SLOTS, canDualWield, canDualPair, offhandBlocked } from './equipment.js';
import { offenceFirstScore, gearRating, weaponStyle, statDeltas, swingBeats } from './gear.js';
import { planCarry, scoreAfterCarry } from './carry.js';
import { swapWorth } from './statworth.js';
import { betterRoundsInPack } from './rounds.js';

/** Equip best's test of one copy (a pack slot `s`, { id, q }): null when it
 *  would never go on, else { slot, gain, rank }. Equip best puts on the copy
 *  with the highest rank > 0, one at a time (Game.equipBest). */
export function pickGain(game, s, mode = game.combatMode()) {
  if (!s || !game._canEquipNow?.(s.id)) return null;
  const eqp = game.equipment, eq = getItem(s.id).equip;
  // Dual wielders keep their off-hand for a second weapon, not a shield.
  if (eq.slot === 'shield' && canDualWield(eqp.get('weapon'))) return null;
  // ...and a two-handed weapon leaves no hand for a shield at all (a bow still takes a quiver).
  if (eq.slot === 'shield' && offhandBlocked(eqp.get('weapon'), s.id)) return null;
  // A weapon of another type that pairs with the one in hand goes on the other hand
  // (a Monk's monk gloves beside its knuckles, Game.goesOffhand): it is weighed
  // against the off-hand's, striking on the main hand's beat, as Equip best's
  // off-hand pass weighs it.
  const main = eqp.get('weapon');
  if (eq.slot === 'weapon' && main && canDualPair(s.id, main) && eq.weaponType !== getItem(main).equip.weaponType) {
    const beats = swingBeats(main), off = eqp.get('shield');
    const offScore = (id, q = null) => offenceFirstScore(id, eqp, mode, eqp.copyFor(id, 'shield'), q, beats);
    const gain = offScore(s.id, s.q || null) - (canDualPair(off, main) ? offScore(off, eqp.qualityIn('shield')) : 0);
    return { slot: 'shield', gain, rank: gain > 0 ? gain : 0 };
  }
  const worn = eqp.get(eq.slot);
  // Keep to the weapon style you fight with (a staff won't replace a sword).
  if (eq.slot === 'weapon' && worn && weaponStyle(s.id) !== weaponStyle(worn)) return null;
  // Keep to the weapon type in hand: ratings can't compare a main and a secondary type fairly.
  // (A tool in hand, such as an axe, has no type and is always swapped for a weapon.)
  const wornType = worn && getItem(worn).equip.weaponType;
  if (eq.slot === 'weapon' && wornType && game.jobClass && eq.weaponType !== wornType) return null;
  // Offensive stats first: damage decides, Defence and HP only break a tie.
  // Each copy is weighed with its own quality (`q`), the worn piece with its own.
  const score = (id, q = null) => offenceFirstScore(id, eqp, mode, 'main', q);
  // Refine and enchantments carry over to a better piece (carry.js), and
  // mastery belongs to the gear type, so a higher tier of the same line
  // (the same weapon type, or the same armour family) goes on first, the
  // highest tier first, as long as it is at least as strong as the worn
  // piece once the carry is done (a plain higher tier won't replace a
  // Mythic copy that is still stronger). Anything else is weighed as it
  // will be worn, after the carry, and must be stronger.
  const q = s.q || null, wornQ = worn ? eqp.qualityIn(eq.slot) : null;
  const gain = (worn ? scoreAfterCarry(eqp, s.id, eq.slot, (id) => score(id, q), q) : score(s.id, q)) - (worn ? score(worn, wornQ) : 0);
  const sameLine = !!worn && (eq.slot === 'weapon' ? !!wornType : !!eq.family && eq.family === getItem(worn).equip.family);
  let rank = gain > 0 ? gain : 0;
  if (sameLine && gearRating(s.id) > gearRating(worn)) rank = gain >= 0 ? 1e15 + gearRating(s.id) : 0;
  return { slot: eq.slot, gain, rank };
}

/** Would Equip best put this copy on? (The green arrow, and every "upgrade" signal.) */
export const wouldWear = (game, s, mode) => (pickGain(game, s, mode)?.rank || 0) > 0;

/** What upgradeSlots' answer was worked out from: the pack's copies, what
 *  you wear (with each piece's ★, lines and mastery rank), your levels, class
 *  and style. Cheap next to weighing hundreds of pieces, which the Gear view
 *  would otherwise do on every redraw (and it redraws with every kill). */
function upgradeKey(game) {
  const eqp = game.equipment, sk = game.skills;
  const lines = (id, copy) => eqp.enchantLines(id, copy).map((l) => l.stat + l.value).join('+');
  let key = `${game.jobClass}|${game.combatMode()}|${Object.keys(sk.xp || {}).map((k) => sk.level(k)).join(',')}|${sk.danceLevel?.() ?? ''}|${eqp.ammo?.id || ''}#`;
  for (const slot of EQUIP_SLOTS) {
    const w = eqp.get(slot), c = eqp.copyIn(slot);
    key += w ? `${w}:${eqp.qualityIn(slot) || ''}:${eqp.refineLevel(w, c)}:${eqp.masteryRank(w)}:${lines(w, c)},` : ',';
  }
  key += '#';
  for (const s of game.inventory.slots) {
    if (!s) continue;
    const it = getItem(s.id);
    key += it.equip ? `${s.id}:${s.q || ''}:${eqp.refineLevel(s.id)}:${eqp.masteryRank(s.id)}:${lines(s.id, 'main')},` : it.roundStr != null ? `${s.id}*,` : '';
  }
  return key;
}

/** The slots Equip best would change: a Set of slot names ('ammo' for
 *  better rounds). Three better shields are one slot, one upgrade. */
export function upgradeSlots(game) {
  const key = upgradeKey(game), c = game._upSlots;
  if (c && c.key === key) return new Set(c.set);
  const out = new Set();
  const mode = game.combatMode();
  for (const s of game.inventory.slots) {
    const eq = s && getItem(s.id).equip;
    if (!eq || out.has(eq.slot)) continue;
    const p = pickGain(game, s, mode);
    if (p && p.rank > 0) out.add(p.slot);
  }
  if (betterRoundsInPack(game)) out.add('ammo');
  game._upSlots = { key, set: new Set(out) };
  return out;
}

/** How a piece in the pack would compare once the ★ and lines a swap carries
 *  over have moved to it (carry.js), for the hold card and the tooltip:
 *  null when nothing would carry (compareGear's own verdict stands), else
 *  { plan, verdict ('upgrade' | 'downgrade' | 'same'), deltas, worth }. */
export function carryPreview(game, id, q = null, mode = game.combatMode()) {
  const eqp = game.equipment, eq = getItem(id).equip;
  if (!eq) return null;
  const slot = eq.slot, worn = eqp.get(slot);
  if (!worn || worn === id) return null;
  const plan = planCarry(eqp, id, slot, q);
  if (!plan) return null;
  const copyIn = eqp.copyIn(slot), wornQ = eqp.qualityIn(slot);
  const now = eqp.itemBonuses(worn, copyIn, wornQ);
  const then = scoreAfterCarry(eqp, id, slot, (x) => eqp.itemBonuses(x, 'main', q), q);
  const gain = scoreAfterCarry(eqp, id, slot, (x) => offenceFirstScore(x, eqp, mode, 'main', q), q) - offenceFirstScore(worn, eqp, mode, copyIn, wornQ);
  const verdict = wouldWear(game, { id, q }, mode) || gain > 0 ? 'upgrade' : gain < 0 ? 'downgrade' : 'same';
  const deltas = statDeltas(then, now, id, worn);
  const worth = swapWorth(game, eqp.styleFits(id) ? then : {}, eqp.styleFits(worn) ? now : {});
  return { plan, verdict, deltas, worth };
}

/** What you wear, as Equip best's before-and-after picture (wornChanges). */
export function wornSnapshot(eq) {
  const q = {};
  for (const s of EQUIP_SLOTS) q[s] = eq.qualityIn(s);
  return { slots: { ...eq.slots }, q, r: { ...eq.refines }, or: { ...eq.offRefines }, e: { ...eq.enchants }, oe: { ...eq.offEnchants }, ammo: eq.ammo?.id || null };
}

/** What changed between two snapshots: [{ slot, from, to, q, carried }], one
 *  per slot whose piece or quality changed (`carried`: the new piece took
 *  over ★ or lines), and { slot: 'ammo', from, to } when the rounds changed. */
export function wornChanges(a, b) {
  const out = [];
  for (const slot of EQUIP_SLOTS) {
    const from = a.slots[slot] || null, to = b.slots[slot] || null;
    if (from === to && (a.q[slot] || null) === (b.q[slot] || null)) continue;
    const carried = !!to && ((b.r[to] || 0) > (a.r[to] || 0) || (b.or[to] || 0) > (a.or[to] || 0) || b.e[to] !== a.e[to] || b.oe[to] !== a.oe[to]);
    out.push({ slot, from, to, q: b.q[slot] || null, carried });
  }
  if (a.ammo !== b.ammo) out.push({ slot: 'ammo', from: a.ammo, to: b.ammo });
  return out;
}
