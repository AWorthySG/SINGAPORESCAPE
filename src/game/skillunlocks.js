// Skill unlocks (src/data/unlocks.js): what each life skill's 10/25/50/75/99
// rungs do while you train, the level-up banner when one opens, and the skill
// teleports. Kept out of game.js: the game calls runSkillAction around each
// continuous gathering or making action, farmFx when planting and harvesting,
// afterFireLit when a fire catches, and installSkillUnlocks once at boot.
//
// The rolls use a small generator of their own (as culling.js does), so an
// unlock never shifts the game's Math.random sequence that seeded tests replay.
import { SKILL_UNLOCKS, UNLOCKS, UNLOCK_LEVELS, UNLOCK_TOP_MULT, SKILL_TELEPORT_TICKS, ACTION_SKILL, GATHER_KINDS, MAKE_KINDS,
  GATHER_CONSUMABLES, GATHER_BREW_KEYS } from '../data/unlocks.js';
import { LIFE_MAX_LEVEL, towardTop } from '../data/xp.js';
import { POTIONS } from '../data/trades.js';
import { STATION_BY_ID } from '../data/transport.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { getItem } from '../data/items.js';
import { playIconHTML } from '../render/icons.js';
import { WHOLE_HAUL } from './jackpot.js';

import { aOrAn, formatNumber } from '../core/utils.js';
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

/** How much stronger every unlock is at `level` than at the last rung (99):
 *  1 up to 99, then a straight line to UNLOCK_TOP_MULT at level 9999, and on at
 *  the same pace to UNLOCK_FULL_MULT at level 30,000 (LIFE_MAX_LEVEL). */
export const unlockGrowth = (level) => 1 + (UNLOCK_TOP_MULT - 1) * towardTop(level, UNLOCK_LEVELS[UNLOCK_LEVELS.length - 1]);
/** The most an unlock grows, at the life skills' top level (about x2.51). */
export const UNLOCK_FULL_MULT = unlockGrowth(LIFE_MAX_LEVEL);
/** " (x2.51 at level 30,000)", or " (as strong as they get)" there: the end of the tooltip's and guide's growth line. */
export const unlockTopText = (level, they = 'they') => (level >= LIFE_MAX_LEVEL ? ` (as strong as ${they} get${they === 'it' ? 's' : ''})`
  : ` (x${UNLOCK_FULL_MULT.toFixed(2)} at level ${formatNumber(LIFE_MAX_LEVEL)})`);
/** unlockGrowth as the tooltip and the skill guide quote it ('x1.05'), or ''
 *  while it would still read x1.00 (levels 100 to 198 grow it by under 0.5%). */
export const unlockGrowthText = (level) => { const s = unlockGrowth(level).toFixed(2); return s === '1.00' ? '' : `x${s}`; };

/** Summed effects of every rung unlocked at `level`: { double, quick, save, keep, grow, burn },
 *  grown by unlockGrowth past level 99. (Lures, decoys, brews and the kampong
 *  home's range add to them afterwards and don't grow.) */
export function unlockFxAt(skill, level) {
  const out = {};
  if (!UNLOCKS.on) return out;
  for (const u of SKILL_UNLOCKS[skill] || []) {
    if (level < u.level || !u.fx) continue;
    for (const [k, v] of Object.entries(u.fx)) out[k] = (out[k] || 0) + v;
  }
  const m = unlockGrowth(level);
  if (m !== 1) for (const k in out) out[k] *= m;   // (no key list: a batch asks this for every make)
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
  if (!st) { game.msg(`You haven't unlocked ${aOrAn(skillName(skill))} teleport yet.`); return false; }
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

/** A node's own product, by id: a tree's log, a rock's ore, a fishing spot's
 *  fish, a trap's main catch and anything that always comes with it (a hornbill
 *  nest's feathers), not a bonus with a chance of its own (a boar's tusk). */
function ownProduct(def) {
  if (Array.isArray(def?.gives)) return new Set(def.gives.filter((g, i) => !i || g.chance === undefined).map((g) => g.id));
  return new Set([def?.gives, ...(def?.catches || []).map((c) => c.id)].filter(Boolean));
}
/** What a gather's double copies, [id, n], from what the gather itself gave
 *  (`plain`, in bag order): the most of the node's own product it gave (a
 *  double or triple log, a big catch, a handful of feathers), else the biggest
 *  gain, never coins unless that's all there was. A stall's theft: its loot. */
function doubleOf(a, plain) {
  const loot = plain.filter(([id]) => id !== 'coins');
  if (a.type !== 'stall' && loot.length) {
    const mine = ownProduct(a.obj?.def), hit = loot.filter(([id]) => mine.has(id));
    if (hit.length) return hit.sort((x, y) => y[1] - x[1])[0];
  }
  return loot.sort((x, y) => y[1] - x[1])[0] || plain[0];
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
  const gained = [], spent = [], haul = new Map();
  let going;
  if (MAKE_KINDS.has(a.type) && game.inventory.journal) {
    // Making runs thousands at a time in a batch: the inventory notes what each
    // one changed, rather than counting the whole bag twice per item. Spent
    // items come in the order of their first slot, as the count gave them.
    game.inventory.journal();
    try { going = resolver(); } finally {
      const j = game.inventory.endJournal();
      for (const [id, e] of j) if (e.n > 0) gained.push([id, e.n]);
      for (const [id, e] of [...j].filter(([, x]) => x.n < 0).sort((x, y) => x[1].at - y[1].at)) spent.push([id, -e.n]);
    }
  } else {
    const before = bagCounts(game);
    WHOLE_HAUL.got = haul;   // a whole tree, seam, school or flock in it (jackpot.js)
    try { going = resolver(); } finally { WHOLE_HAUL.got = null; }
    const after = bagCounts(game);
    for (const [id, n] of after) if (n > (before.get(id) || 0)) gained.push([id, n - (before.get(id) || 0)]);
    for (const [id, n] of before) if ((after.get(id) || 0) < n) spent.push([id, n - (after.get(id) || 0)]);
  }
  if (GATHER_KINDS.has(a.type) && gained.length) {
    // A lure or decoy in the pack: one is used on each catch, for a better chance of two.
    const c = GATHER_CONSUMABLES[skill];
    let double = fx.double || 0;
    if (c && game.inventory.count(c.id) > 0) { game.inventory.remove(c.id, 1); double += c.double; }
    // Copy what the gather itself gave, never a whole tree, seam, school or
    // flock that came with it (jackpot.js): copying those once turned a double
    // tuna into hundreds.
    const plain = gained.map(([id, n]) => [id, n - (haul.get(id) || 0)]).filter(([, n]) => n > 0);
    const main = doubleOf(a, plain);
    if (roll(game, double) && main && game.inventory.canAdd(main[0], main[1]) >= main[1]) {
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
  const open = all.filter((u) => level >= u.level).length, next = nextUnlock(skill, level), m = unlockGrowth(level), shown = unlockGrowthText(level);
  // Past 99 the bonuses (not the teleport or a recipe) keep growing.
  return `<br>Unlocks: <b>${open} of ${all.length}</b>` + (next ? `<br>At level ${next.level}: ${next.name} (${next.desc})` : '<br>Every unlock open')
    + (m > 1 ? `${shown ? `, each bonus now ${shown} as strong` : ', and their bonuses keep growing'}${unlockTopText(level)}` : '');
}

/** The level-up banner for a new unlock (and its chat line). */
export function announceUnlocks(game, skill, level) {
  // An instant batch (autoprocess.js) can open several rungs at once: it tells
  // each skill's new unlocks together when it ends (flushUnlockNews).
  const news = game._batchNews?.unlocks;
  if (news) { for (const u of unlocksAt(skill, level)) (news[skill] ||= []).push(u); return; }
  for (const u of unlocksAt(skill, level)) {
    game.msg(`${skillName(skill)} ${level} unlock: ${u.name}. ${u.desc}.`, 'level');
    game.banner?.(`<span class="big">${playIconHTML('ui-skill_unlock', 28)} ${u.name}</span>${skillName(skill)} ${level} unlock: ${u.desc}`);
  }
}

/** A batch's new unlocks ({ skill: [rung...] }): one line and one banner per
 *  skill, naming every rung that opened (a single rung reads as it always has). */
export function flushUnlockNews(game, news) {
  for (const [skill, list] of Object.entries(news || {})) {
    if (list.length === 1) { const u = list[0]; announceUnlocks(game, skill, u.level); continue; }
    const top = list[list.length - 1].level;
    game.msg(`${skillName(skill)} ${top}: ${list.length} unlocks opened. ${list.map((u) => `${u.name} (${u.desc})`).join('; ')}.`, 'level');
    game.banner?.(`<span class="big">${playIconHTML('ui-skill_unlock', 28)} ${list.length} new unlocks</span>${skillName(skill)} ${top}: ${list.map((u) => u.name).join(', ')}`);
  }
}

/** Listen for level-ups (once, at boot). */
export function installSkillUnlocks(game) {
  game.bus.on('levelup', (p) => { if (p?.skill && SKILL_UNLOCKS[p.skill]) announceUnlocks(game, p.skill, p.level); });
}

export { UNLOCK_LEVELS };
