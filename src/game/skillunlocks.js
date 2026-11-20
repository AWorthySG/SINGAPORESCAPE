// Skill unlocks (src/data/unlocks.js): what each life skill's 10/25/50/75/99
// rungs do while you train, the level-up banner when one opens, and the skill
// teleports. Kept out of game.js: the game calls runSkillAction around each
// continuous gathering or making action, farmFx when planting and harvesting,
// afterFireLit when a fire catches, and installSkillUnlocks once at boot.
//
// The rolls use a small generator of their own (as culling.js does), so an
// unlock never shifts the game's Math.random sequence that seeded tests replay.
import { SKILL_UNLOCKS, UNLOCKS, UNLOCK_LEVELS, SKILL_TELEPORT_TICKS, ACTION_SKILL, GATHER_KINDS, MAKE_KINDS,
  GATHER_CONSUMABLES, GATHER_BREW_KEYS } from '../data/unlocks.js';
import { POTIONS } from '../data/trades.js';
import { STATION_BY_ID } from '../data/transport.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { getItem } from '../data/items.js';
import { playIconHTML } from '../render/icons.js';

const skillName = (s) => SKILL_BY_ID[s]?.name || s;

/** Unlock dice: xorshift on a seed kept on the game. */
export function unlockRand(game) {
  let h = game._unlockSeed ?? 0x2545f491;
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  game._unlockSeed = h >>> 0;
  return (h >>> 0) / 4294967296;
}

/** A skill's ladder with each rung's state: [{ ...rung, unlocked }]. */
export function unlockLadder(skill, level = 1) {
  return (SKILL_UNLOCKS[skill] || []).map((u) => ({ ...u, unlocked: level >= u.level }));
}

/** The rungs that open at exactly this level (usually one, or none). */
export function unlocksAt(skill, level) {
  return (SKILL_UNLOCKS[skill] || []).filter((u) => u.level === level);
}

/** The next locked rung above `level`, or null. */
export function nextUnlock(skill, level) {
  return (SKILL_UNLOCKS[skill] || []).find((u) => u.level > level) || null;
}

/** Summed effects of every rung unlocked at `level`: { double, quick, save, keep, grow, burn }. */
export function unlockFxAt(skill, level) {
  const out = {};
  if (!UNLOCKS.on) return out;
  for (const u of SKILL_UNLOCKS[skill] || []) {
    if (level < u.level || !u.fx) continue;
    for (const [k, v] of Object.entries(u.fx)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

/** The player's unlock effects for a skill, with any gathering brew they have running. */
export function unlockFx(game, skill) {
  const out = unlockFxAt(skill, game.skills.level(skill));
  const key = GATHER_BREW_KEYS[skill];
  if (key) for (const id of Object.keys(game.potions || {})) {
    const v = POTIONS[id]?.fx?.[key];
    if (v) out.double = (out.double || 0) + v;
  }
  return out;
}

const roll = (game, p) => p > 0 && unlockRand(game) < p;

/** The teleport a skill has unlocked (a station id), or null. */
export function skillTeleportOf(game, skill) {
  const lvl = game.skills.level(skill);
  return (SKILL_UNLOCKS[skill] || []).find((u) => u.teleport && lvl >= u.level)?.teleport || null;
}

/** Ticks left before a skill teleport can be used again. */
export const skillTeleportWait = (game) => Math.max(0, (game._skillTpReady || 0) - (game.tickCount || 0));

/** Move the player to the nearest free tile around (x, y): shared by the skill and home teleports. */
export function teleportPlayer(game, x, y, text) {
  const tile = game._nearestFree?.(x, y) || (game.world.isBlocked(x, y) ? null : { x, y });
  if (!tile) { game.msg('The way there is blocked.'); return false; }
  const p = game.player;
  p.stopNow?.(); p.clearAction?.();
  p.x = p.tx = tile.x; p.y = p.ty = tile.y; p.progress = 0; p.moving = false; p.path = [];
  game.spawnSparkle?.(p, '#8fd6ff', 14);
  if (text) game.msg(text, 'system');
  game.bus.emit('sfx', 'travel');
  game.updateRegion?.();
  game.ui?.closeModal?.();
  return true;
}

/** Teleport to a skill's training area (an unlock at level 50 for most skills). */
export function skillTeleport(game, skill) {
  const st = STATION_BY_ID[skillTeleportOf(game, skill)];
  if (!st) { game.msg(`You haven't unlocked a ${skillName(skill)} teleport yet.`); return false; }
  if (!game.player.alive || game.waves?.active) { game.msg("You can't teleport right now."); return false; }
  const wait = skillTeleportWait(game);
  if (wait > 0) { game.msg(`Your skill teleports need ${Math.ceil(wait * 0.6)}s more to recharge.`); return false; }
  if (!teleportPlayer(game, st.x, st.y, `You teleport to ${st.name} to train ${skillName(skill)}.`)) return false;
  game._skillTpReady = (game.tickCount || 0) + SKILL_TELEPORT_TICKS;
  return true;
}

/** Which skill a continuous action trains, or null. */
export const actionSkill = (a) => (a?.type === 'recipe' ? a.skill : ACTION_SKILL[a?.type]) || null;

function bagCounts(game) {
  const m = new Map();
  for (const sl of game.inventory.slots) if (sl) m.set(sl.id, (m.get(sl.id) || 0) + sl.qty);
  return m;
}

/** Run one continuous action with the skill's unlocks: a double yield (and a
 *  lure or decoy spent) after a gather, inputs kept after a make, a node kept
 *  from running dry, and a second action in the same tick. Returns whether the
 *  action goes on, as the resolver does. */
export function runSkillAction(game, a, resolver) {
  const skill = actionSkill(a);
  if (!skill || !SKILL_UNLOCKS[skill]) return resolver();
  const fx = unlockFx(game, skill);
  const obj = a.obj;
  // A station can lend bonuses of its own (the kampong home's upgraded range, home.js).
  if (obj?.homeFx) for (const [k, v] of Object.entries(obj.homeFx)) fx[k] = (fx[k] || 0) + v;
  const wasDepleted = !!obj?.depleted;
  const before = bagCounts(game);
  let going = resolver();
  const after = bagCounts(game);
  const gained = [], spent = [];
  for (const [id, n] of after) if (n > (before.get(id) || 0)) gained.push([id, n - (before.get(id) || 0)]);
  for (const [id, n] of before) if ((after.get(id) || 0) < n) spent.push([id, n - (after.get(id) || 0)]);
  if (GATHER_KINDS.has(a.type) && gained.length) {
    // A lure or decoy in the pack: one is used on each catch, for a better chance of two.
    const c = GATHER_CONSUMABLES[skill];
    let double = fx.double || 0;
    if (c && game.inventory.count(c.id) > 0) { game.inventory.remove(c.id, 1); double += c.double; }
    // The main yield: the biggest non-coin gain (coins only if that's all there was).
    const main = gained.filter(([id]) => id !== 'coins').sort((x, y) => y[1] - x[1])[0] || gained[0];
    if (main && roll(game, double) && game.inventory.canAdd(main[0], main[1]) >= main[1]) {
      game.inventory.add(main[0], main[1]);
      game.msg(`Skill unlock: a double ${getItem(main[0]).name.toLowerCase()}!`);
    }
  }
  if (MAKE_KINDS.has(a.type) && spent.length && gained.length && roll(game, fx.save)) {
    for (const [id, n] of spent) game.inventory.add(id, n);
    if (a.tally) a.tally.kept++;   // a batch tells it in its summary (makeBatch, autoprocess.js)
    else game.msg('Skill unlock: you keep your materials.');
    going = true;
  }
  if (obj && !wasDepleted && obj.depleted && roll(game, fx.keep)) {
    obj.depleted = false; obj.respawnTimer = 0;
    game.msg(obj.def.type === 'stall' ? 'Skill unlock: the stall is still stocked.' : 'Skill unlock: it holds for another go.');
    going = true;
  }
  if (going && roll(game, fx.quick)) going = resolver();
  return going;
}

/** Farming unlocks: { double (chance of an extra crop), grow (share faster) }. */
export const farmFx = (game) => unlockFx(game, 'farming');
/** Roll a farming unlock's extra crop: 1 or 0. */
export const extraCrop = (game) => (roll(game, farmFx(game).double) ? 1 : 0);
/** Grow ticks for a crop after the Farming unlocks. */
export const growTicks = (game, ticks) => Math.max(1, Math.round(ticks * (1 - Math.min(0.5, farmFx(game).grow || 0))));

/** After a fire catches: it burns longer, and a log may be kept. */
export function afterFireLit(game, fire, logId) {
  const fx = unlockFx(game, 'firemaking');
  if (fire && fx.burn && fire.lifetime) fire.lifetime = Math.round(fire.lifetime * (1 + fx.burn));
  if (roll(game, fx.save)) { game.inventory.add(logId, 1); game.msg('Skill unlock: the log catches without burning away.'); }
}

/** The skill tooltip's unlock lines (HTML-safe: the data has no markup): how
 *  many rungs are open, and the next one. '' for skills without unlocks. */
export function unlockTipText(skill, level) {
  const all = SKILL_UNLOCKS[skill];
  if (!all) return '';
  const open = all.filter((u) => level >= u.level).length, next = nextUnlock(skill, level);
  return `<br>Unlocks: <b>${open} of ${all.length}</b>` + (next ? `<br>At level ${next.level}: ${next.name} (${next.desc})` : '<br>Every unlock open');
}

/** The level-up banner for a new unlock (and its chat line). */
export function announceUnlocks(game, skill, level) {
  for (const u of unlocksAt(skill, level)) {
    game.msg(`${skillName(skill)} ${level} unlock: ${u.name}. ${u.desc}.`, 'level');
    game.banner?.(`<span class="big">${playIconHTML('ui-skill_unlock', 28)} ${u.name}</span>${skillName(skill)} ${level} unlock: ${u.desc}`);
  }
}

/** Listen for level-ups (once, at boot). */
export function installSkillUnlocks(game) {
  game.bus.on('levelup', (p) => { if (p?.skill && SKILL_UNLOCKS[p.skill]) announceUnlocks(game, p.skill, p.level); });
}

export { UNLOCK_LEVELS };
