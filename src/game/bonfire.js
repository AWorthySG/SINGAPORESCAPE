// Bonfires (the owner's ask): lighting a fire burns every log of that kind in
// one go, onto one fire; more logs on a fire make it bigger and longer-lasting;
// and standing near a fire warms you, more strongly and from further away the
// bigger it is.
//
// Kept out of game.js and skilling.js: resolveFiremake calls burnAll, the tick
// calls tickWarmth, and outsideBonuses adds warmthBonus to your stats.

import { getItem } from '../data/items.js';
import { FIRE_LIFETIME_TICKS } from '../config.js';
import { randInt } from '../core/utils.js';
import { afterFireLit } from './skillunlocks.js';

import { FIRE_XP } from './skilling.js';
export const FIRE_LIFE_PER_LOG = 20;            // ticks each log after the first adds (12s)
export const FIRE_MAX_LIFE = 3000;              // ticks at most (30 minutes)

/** How many logs a fire holds (a plain fire is one). */
export const fireLogs = (o) => Math.max(1, o?.logs || 1);
/** Its size step: 1 log 0, 2-3 logs 1, 4-7 logs 2, ... (doubling each step). */
export const fireStep = (o) => Math.floor(Math.log2(fireLogs(o)));
/** The warmth a fire gives: +3% damage, and +3% more per doubling of its logs, at most +30%. */
export const warmthPct = (o) => Math.min(30, 3 * (1 + fireStep(o)));
/** How far it reaches (tiles): 3, and one more per doubling, at most 10. */
export const warmthRadius = (o) => Math.min(10, 3 + fireStep(o));
/** How much bigger it is drawn: 1x, up to 2.5x for a great bonfire. */
export const fireScale = (o) => Math.min(2.5, 1 + fireStep(o) * 0.15);

/** Add `n` logs to a fire: bigger, and burning longer. */
export function feedFire(fire, n) {
  if (!fire || n <= 0) return;
  fire.logs = fireLogs(fire) + n;
  fire.lifetime = Math.min(FIRE_MAX_LIFE, (fire.lifetime || FIRE_LIFETIME_TICKS) + n * FIRE_LIFE_PER_LOG);
}

/**
 * Burn up to `limit` logs (all, by default) of the kinds in `kinds` (the one
 * picked, or all you can burn, best first) on the tile the player stands on: a
 * new fire, or the one already there. You choose how many (ui.askFireLogs).
 * XP, ash and the odd coin are counted for each log, as when they burned one
 * by one. Returns how many logs burned.
 */
export function burnAll(game, kinds, limit = Infinity) {
  const p = game.player, lvl = game.skills.level('firemaking');
  let here = game.world.objectAt(p.x, p.y);
  if (here && here.def.type !== 'fire') return 0;
  let burned = 0, xp = 0, roars = 0, coins = 0;
  const ash = new Map();
  const held = game.inventory.hold?.();
  try {
    for (const id of kinds) {
      const def = getItem(id);
      if (lvl < (def.firemaking || 1)) continue;
      const n = Math.min(game.inventory.count(id), limit - burned);
      if (n <= 0) continue;
      game.inventory.remove(id, n);
      if (!here) { here = game.world.lightFire(p.x, p.y); if (!here) break; feedFire(here, n - 1); }
      else feedFire(here, n);
      afterFireLit(game, here, id);   // Firemaking unlocks (skillunlocks.js): longer burns, a log saved
      const base = Math.round((def.fmXp || 40) * FIRE_XP);
      for (let i = 0; i < n; i++) {
        // A fire occasionally roars up for bonus XP; rarely, something glints in the embers.
        if (Math.random() < 0.10) { xp += Math.round(base * 1.5); roars++; } else xp += base;
        if (Math.random() < 0.012) coins += randInt(15, 90);
      }
      if (def.ash) ash.set(def.ash, (ash.get(def.ash) || 0) + n);   // the endgame logs leave an ash
      burned += n;
    }
    for (const [id, n] of ash) {
      const room = Math.min(n, game.inventory.canAdd(id, n));
      if (room > 0) game.inventory.add(id, room);
      if (n > room) game.world.addGroundItem(id, n - room, p.x, p.y);
    }
    if (coins) game.inventory.add('coins', coins);
  } finally { if (held) game.inventory.release(); }
  if (!burned) return 0;
  game.skills.addXp('firemaking', xp);
  const size = fireLogs(here);
  game.msg(burned > 1
    ? `You pile ${burned} logs onto the fire${roars ? ` (it roars up ${roars} time${roars > 1 ? 's' : ''})` : ''}: a ${size}-log bonfire, warming everyone within ${warmthRadius(here)} tiles (+${warmthPct(here)}% damage).`
    : roars ? 'The fire roars to life — bonus Firemaking XP!' : 'The fire catches and the logs begin to burn.', burned > 1 || roars ? 'level' : undefined);
  if (coins) game.msg(`You spot ${coins} coins glinting in the ashes.`);
  if (roars) game.spawnSparkle?.(p, '#ffae3a', Math.min(16, 6 + roars));
  return burned;
}

/** The strongest warmth reaching the player from a fire nearby: { pct, logs } or null. */
export function warmthAt(game) {
  const p = game.player;
  if (!p?.alive) return null;
  const objs = game.world.objectsIn ? game.world.objectsIn(p.x - 10, p.y - 10, p.x + 10, p.y + 10) : game.world.objects;
  let best = null;
  for (const o of objs) {
    if (o.def?.type !== 'fire') continue;
    if (Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y)) > warmthRadius(o)) continue;
    const pct = warmthPct(o);
    if (!best || pct > best.pct) best = { pct, logs: fireLogs(o) };
  }
  return best;
}

/** Each tick: update the warmth, and say so when it starts, grows or fades. */
export function tickWarmth(game) {
  const w = warmthAt(game), pct = w?.pct || 0, was = game.warmth || 0;
  if (pct === was) return;
  game.warmth = pct;
  if (pct > was) game.msg(`A fire's warmth: +${pct}% damage while you stay near it.`, 'level');
  else if (!pct) game.msg('You leave the warmth of the fire.');
}

/** Warmth as bonuses for Equipment.extra (game.js outsideBonuses): damage for every style. */
export const warmthBonus = (game) => (game.warmth ? { atkPct: game.warmth, magPct: game.warmth } : null);
