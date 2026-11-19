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
  BURST_WARD_TICKS, BURST_ZEAL_TICKS, burstPower,
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

/** The blessings that share a conflict group with `id` (not counting itself). */
function rivals(id) {
  const out = new Set();
  for (const ids of Object.values(PRAYER_GROUPS)) if (ids.includes(id)) for (const o of ids) if (o !== id) out.add(o);
  return out;
}

/** A loadout made valid for a Prayer level: unknown or locked blessings, a later
 *  rival of one already kept, and whatever no longer fits the slots are dropped
 *  (earlier entries win). Used when loading a save. */
export function trimBlessings(level, ids) {
  const out = [], cap = blessingSlots(level);
  for (const id of ids || []) {
    const p = PRAYER_BY_ID[id];
    if (!p || p.level > level || out.includes(id)) continue;
    const r = rivals(id);
    if (out.some((o) => r.has(o))) continue;
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

/** Equip a blessing. A rival in the same group is swapped out; otherwise it
 *  needs a free slot. Returns true when it is on. */
export function equipBlessing(game, id) {
  const p = PRAYER_BY_ID[id];
  if (!p) return false;
  const set = game.activePrayers;
  if (set.has(id)) return true;
  if (game.skills.prayer < p.level) { game.msg(`You need Prayer level ${p.level} for ${p.name}.`); return false; }
  const r = rivals(id);
  const kept = [...set].filter((o) => !r.has(o));
  const cap = blessingSlots(game.skills.prayer);
  if (slotsUsed(kept) + blessingCost(p) > cap) {
    game.msg(blessingCost(p) > cap ? `${p.name} needs ${blessingCost(p)} blessing slots.`
      : 'Your blessing slots are full. Take one off first (tap it in the slot strip).');
    return false;
  }
  for (const o of r) set.delete(o);
  set.add(id);
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

/** Auto battle fires the Burst when Faith is full and you are in trouble
 *  (below 40% life) or fighting a boss or champion. */
export function shouldAutoBurst(game) {
  if (!faithFull(game) || !game.player.alive) return false;
  if (game.player.hp < game.maxHp() * 0.4) return true;
  const n = game.player.action?.type === 'attack' ? game.player.action.npc : null;
  return !!(n && n.alive && (n.def?.boss || n.champion));
}
