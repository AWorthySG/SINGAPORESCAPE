// Blessings and Faith: Prayer's loadout (the rework of toggled, draining prayers).
//
// Blessings (data/prayers.js) are equipped into slots that grow with Prayer
// level; an equipped one is always on and costs nothing to keep. The equipped
// set is still `game.activePrayers` (its ids are the old prayers'), so combat,
// the stat sheet and the renderer read it as before.
//
// Faith (`game.prayerPoints`, the old field, kept for saves) fills as you fight,
// bury bones or kneel at a Monument. A full bar pays for the Prayer Burst: a
// heal, a short ward that stops every blow, and a few seconds of extra damage.
import {
  PRAYER_BY_ID, PRAYER_GROUPS, BLESSING_SLOT_LADDER, blessingCost, FAITH_GAIN,
  BURST_WARD_TICKS, BURST_ZEAL_TICKS, burstPower, STACK_SHARE, STACK_CAP,
} from '../data/prayers.js';

/** Blessing slots at a Prayer level (BLESSING_SLOT_LADDER). */
export function blessingSlots(level) {
  let n = 0;
  for (const r of BLESSING_SLOT_LADDER) if ((level || 1) >= r.level) n = r.slots;
  return n;
}

/** Slots taken by a set (or list) of blessing ids. */
export function slotsUsed(ids) {
  let n = 0;
  for (const id of ids) n += blessingCost(PRAYER_BY_ID[id]);
  return n;
}

/** The blessings that share a group (a type) with `id` (not counting itself). */
export function rivals(id) {
  const out = new Set();
  for (const ids of Object.values(PRAYER_GROUPS)) if (ids.includes(id)) for (const o of ids) if (o !== id) out.add(o);
  return out;
}

const BONUS_KEYS = ['att', 'str', 'def', 'ranged', 'magic', 'crit'];

/** What a loadout grants in all, as fractions: { att, str, def, ranged, magic,
 *  crit, protect }. Blessings of the same type stack: per bonus, the strongest
 *  counts in full and every other one at STACK_SHARE, up to STACK_CAP in all. (Each bonus belongs to
 *  one type, so this is the same as tapering within a group.) A blessing is
 *  counted once however it is listed. */
export function blessingBonus(ids) {
  const ps = [...new Set(ids || [])].map((id) => PRAYER_BY_ID[id]).filter(Boolean);
  const out = { protect: 0 };
  for (const k of BONUS_KEYS) {
    const vals = ps.map((p) => p[k] || 0).filter((v) => v > 0).sort((a, b) => b - a);
    const sum = vals.reduce((n, v, i) => n + (i ? v * STACK_SHARE : v), 0);
    out[k] = vals.length > 1 ? Math.min(STACK_CAP, sum) : sum;   // the cap only reins in a stack
  }
  for (const p of ps) out.protect = Math.max(out.protect, p.protect || 0);
  return out;
}

/** A loadout made valid for a Prayer level: unknown, repeated or locked
 *  blessings and whatever no longer fits the slots are dropped (earlier
 *  entries win). Blessings of the same type may stay together. Used when
 *  loading a save. */
export function trimBlessings(level, ids) {
  const out = [], cap = blessingSlots(level);
  for (const id of ids || []) {
    const p = PRAYER_BY_ID[id];
    if (!p || p.level > level || out.includes(id)) continue;
    if (slotsUsed(out) + blessingCost(p) > cap) continue;
    out.push(id);
  }
  return out;
}

/** A sensible loadout for a fighting style at a Prayer level: the best unlocked
 *  blessing of each group, in the order that style gets most from (damage,
 *  then Defence, then crits, then protection), as many as the slots hold. Used
 *  for a save that has no loadout yet, so nobody loses their prayer bonuses to
 *  the rework, and for a new character. */
export function starterBlessings(level, mode = 'melee') {
  const order = mode === 'ranged' ? ['ranged', 'def', 'att'] : mode === 'magic' ? ['magic', 'def', 'att'] : ['str', 'def', 'att'];
  const best = (group) => PRAYER_GROUPS[group].map((id) => PRAYER_BY_ID[id])
    .filter((p) => p && p.level <= level && blessingCost(p) === 1)
    .sort((a, b) => b.level - a.level)[0]?.id;
  const want = order.map(best).filter(Boolean);
  const protect = PRAYER_BY_ID.protect_melee;
  if (protect && protect.level <= level) want.push(protect.id);
  return trimBlessings(level, want);
}

/** What tapping a blessing would do, without doing it (the panel shows it too):
 *  { kind, out, with }. kind is 'remove' (it is on), 'locked', 'too_big' (more
 *  slots than you have), 'add' (a free slot), 'stack' (a free slot, and it
 *  stacks with `with`, equipped blessings of its type), 'swap' (no free slot:
 *  `out`, the weakest of its type, come off to make room) or 'full' (no room,
 *  and nothing of its type to swap). */
export function blessingAction(game, id) {
  const p = PRAYER_BY_ID[id], set = game.activePrayers;
  if (!p) return { kind: 'none', out: [], with: [] };
  if (set.has(id)) return { kind: 'remove', out: [], with: [] };
  if (game.skills.prayer < p.level) return { kind: 'locked', out: [], with: [] };
  const cap = blessingSlots(game.skills.prayer), cost = blessingCost(p);
  if (cost > cap) return { kind: 'too_big', out: [], with: [] };
  const r = rivals(id), same = [...set].filter((o) => r.has(o));
  if (slotsUsed(set) + cost <= cap) return { kind: same.length ? 'stack' : 'add', out: [], with: same };
  // Full: the weakest of its type (lowest level first) make room, as few as will do.
  const weakest = same.sort((a, b) => PRAYER_BY_ID[a].level - PRAYER_BY_ID[b].level);
  const out = [];
  let used = slotsUsed(set);
  for (const o of weakest) {
    if (used + cost <= cap) break;
    out.push(o); used -= blessingCost(PRAYER_BY_ID[o]);
  }
  if (used + cost > cap) return { kind: 'full', out: [], with: [] };
  return { kind: 'swap', out, with: same.filter((o) => !out.includes(o)) };
}

/** Equip a blessing: into a free slot (stacking with others of its type), or
 *  with the slots full in place of the weakest of its type. Returns true when it is on. */
export function equipBlessing(game, id) {
  const p = PRAYER_BY_ID[id];
  if (!p) return false;
  const set = game.activePrayers;
  if (set.has(id)) return true;
  const act = blessingAction(game, id);
  if (act.kind === 'locked') { game.msg(`You need Prayer level ${p.level} for ${p.name}.`); return false; }
  if (act.kind === 'too_big') { game.msg(`${p.name} needs ${blessingCost(p)} blessing slots.`); return false; }
  if (act.kind === 'full') { game.msg('Your blessing slots are full. Take one off first (tap it in the slot strip).'); return false; }
  for (const o of act.out) set.delete(o);
  set.add(id);
  if (act.kind === 'stack') game.msg(`${p.name} stacks with ${act.with.map((o) => PRAYER_BY_ID[o].name).join(' and ')}: the weaker bonuses count at ${Math.round(STACK_SHARE * 100)}%.`);
  game.spawnSparkle?.(game.player, '#ffe89a', 6);
  game.bus.emit('prayer');
  return true;
}

export function unequipBlessing(game, id) {
  if (!game.activePrayers.delete(id)) return false;
  game.bus.emit('prayer');
  return true;
}

export function toggleBlessing(game, id) {
  return game.activePrayers.has(id) ? !unequipBlessing(game, id) : equipBlessing(game, id);
}

/** Faith gained as a share of the cap (FAITH_GAIN), faster with prayer gear. */
export function gainFaith(game, frac) {
  const max = game.maxPrayer();
  if (!(frac > 0) || game.prayerPoints >= max) return;
  const gear = game.equipment.bonuses().prayer || 0;
  game.prayerPoints = Math.min(max, game.prayerPoints + max * frac * (1 + gear / 30));
  game.bus.emit('prayer');
}

export const faithGain = (game, kind) => gainFaith(game, FAITH_GAIN[kind] || 0);

/** Is Faith full enough for a Burst? (A hair under, so float sums still count.) */
export const faithFull = (game) => game.prayerPoints >= game.maxPrayer() - 1e-6;

/** The Prayer Burst: spends a full bar of Faith. Returns true when it went off. */
export function prayerBurst(game) {
  const p = game.player;
  if (!p.alive) return false;
  if (!faithFull(game)) {
    game.msg(`Your Faith is not full yet (${Math.floor(100 * game.prayerPoints / game.maxPrayer())}%). Fight, bury bones or kneel at a Monument to fill it.`);
    return false;
  }
  const pow = burstPower(game.skills.prayer);
  game.prayerPoints = 0;
  const heal = Math.max(1, Math.round(game.maxHp() * pow.heal));
  p.hp = Math.min(game.maxHp(), p.hp + heal);
  game.burstWard = BURST_WARD_TICKS;
  game.burstZeal = BURST_ZEAL_TICKS;
  game.addHitsplat?.(p, 0, { text: 'Prayer Burst' });
  game.spawnSparkle?.(p, '#ffe89a', 22);
  game.bus.emit('sfx', 'spec');
  game.msg(`Prayer Burst! You heal ${heal}, a ward stops every blow for 3s, and you deal +${Math.round(pow.zeal * 100)}% damage for 8s.`, 'combat');
  game.bus.emit('hp'); game.bus.emit('prayer');
  return true;
}

/** The Burst's extra damage while its zeal lasts (0 otherwise). */
export const burstZeal = (game) => (game.burstZeal > 0 ? burstPower(game.skills.prayer).zeal : 0);

/** Each tick: the Burst's ward and zeal run down. */
export function tickBlessings(game) {
  if (!(game.burstWard > 0) && !(game.burstZeal > 0)) return;
  if (game.burstWard > 0) game.burstWard--;
  if (game.burstZeal > 0) game.burstZeal--;
  if (!game.burstWard && !game.burstZeal) game.bus.emit('prayer');
}

/** The Burst fires by itself as soon as Faith is full and you are in a fight
 *  (the owner's call): attacking a living monster, or being targeted by one,
 *  at any range, so a longbow or a staff at the far end of its reach counts
 *  too. It used to wait for low life or a boss, which a ranged fighter who is
 *  rarely hit almost never reached. */
export function shouldAutoBurst(game) {
  if (!faithFull(game) || !game.player.alive) return false;
  const a = game.player.action;
  if (a?.type === 'attack' && a.npc?.alive) return true;
  return game.nearbyNpcs().some((n) => n.alive && n.target === game.player);
}
