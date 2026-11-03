// Mercenaries: the Merchant hires fighters with coins, as many as they can pay
// for. Each one follows the Merchant for a contract of 90 seconds, runs at the
// closest monster, cleaves like the Merchant's own weapon, and then heads home.
// Monsters don't fight back against mercenaries: the Merchant pays them to
// take no risks.
// A-Worthlings: every time the Merchant attacks there is a 20% chance a
// mirror image of the Merchant appears. It fights like a mercenary, hitting for
// a quarter of the Merchant's own melee damage, and stays for good.
import { chebyshev, randInt } from '../core/utils.js';
import { TICK_MS, COMBAT_BEAT_MS } from '../config.js';
import { findPath } from '../engine/pathfinding.js';
import { combatXp, playerAttackVsNpc } from './combat.js';
import { CLEAVE_SHARE } from '../data/classes.js';

export const MERC_TICKS = 150;            // 90 seconds at 0.6s a tick
export const FOLLOWER_CHANCE = 0.2;       // per Merchant attack
export const MAX_FOLLOWERS = 40;          // a ceiling so a long session can't bog the game down
export const FOLLOWER_SHARE = 0.25;       // of the Merchant's melee damage
export const MERC_SHARE = 0.5;            // a mercenary hits for half the Merchant's melee damage (at least its hired power)
const SEEK = 10;                          // how far an ally looks for a monster
const LEASH = 14;                         // allies don't chase further than this from the Merchant
const CATCH_UP = 24;                      // further than this from the Merchant (a teleport, the MRT): jump back to them
const MERC_KINDS = ['mercenary_sellsword', 'mercenary_bruiser', 'mercenary_spear_guard', 'mercenary_duellist'];
const MERC_NAMES = ['Ah Seng the Sellsword', 'Siti Steelhand', 'Big Raju', 'Old Tan', 'Mei the Blade', 'Kumar Ironjaw', 'Lim the Lancer', 'Farah Quickstep'];

/** What one mercenary costs to hire: more as the Merchant grows. */
export const hireCost = (game) => 80 + 15 * game.skills.combatLevel();

/** A mercenary's best hit: grows with the Merchant's level and gear Strength. */
export const mercPower = (game) => Math.max(2, Math.round(2 + game.skills.combatLevel() * 0.4 + (game.equipment.bonuses().strength || 0) * 0.15));

export const activeMercs = (game) => game.npcs.filter((n) => n.ally && n.alive && !n.follower);
export const activeFollowers = (game) => game.npcs.filter((n) => n.ally && n.alive && n.follower);

/** Hire one mercenary next to the player. Returns the mercenary, or null. */
export function hire(game) {
  const p = game.player;
  if (game.jobClass !== 'merchant') { game.msg('Only a Merchant can hire mercenaries.', 'system'); return null; }
  if (!p.alive) return null;
  const cost = hireCost(game);
  if (game.inventory.count('coins') < cost) { game.msg(`A mercenary costs ${cost} coins.`, 'system'); return null; }
  const spot = game._nearestFree(p.x + 1, p.y);
  if (!spot) return null;
  game.inventory.remove('coins', cost);
  const m = game.spawnNpc(MERC_KINDS[Math.floor(Math.random() * MERC_KINDS.length)], spot.x, spot.y, { temporary: true, wander: 0 });
  m.ally = true;
  // Name and attackability come from the definition (a mercenary's look, a fighter's name).
  m.def = { ...m.def, name: MERC_NAMES[Math.floor(Math.random() * MERC_NAMES.length)], role: null, attackable: false, dialogue: null };
  m.allyUntil = game.tickCount + MERC_TICKS;
  allyPace(m);
  m.mercPower = mercPower(game);
  game.spawnSparkle(m, '#3fbf9f', 12);
  game.msg(`You hire ${m.name} for ${cost} coins (90 seconds).`, 'level');
  game.bus.emit('mercs');
  return m;
}

/** A Merchant attack may call up an A-Worthling (a mirror image of the Merchant). */
export function onMerchantAttack(game) {
  if (game.jobClass !== 'merchant' || Math.random() >= FOLLOWER_CHANCE) return null;
  if (activeFollowers(game).length >= MAX_FOLLOWERS) return null;
  return spawnFollower(game);
}

/** Summon one A-Worthling next to the player. Returns it, or null. */
export function spawnFollower(game) {
  const p = game.player;
  if (!p.alive) return null;
  const spot = game._nearestFree(p.x - 1, p.y);
  if (!spot) return null;
  const f = game.spawnNpc('aworthling', spot.x, spot.y, { temporary: true, wander: 0 });
  f.ally = true;
  f.follower = true;
  f.allyUntil = Infinity;            // A-Worthlings stay for good
  allyPace(f);
  game.spawnSparkle(f, '#f5b82e', 14);
  game.msg('An A-Worthling, your mirror image, steps out to fight beside you!', 'system');
  game.bus.emit('mercs');
  return f;
}

/** Allies keep the Merchant's pace and run when they move (townsfolk amble otherwise). */
function allyPace(m) { m.stepMul = 0.7; m.runMul = 0.4; }

/** Is this monster fair game for an ally? Bosses only once the fight with them has started. */
function fairGame(game, n) {
  if (!n.alive || !n.attackable || n.ally) return false;
  if (!n.def.boss) return true;
  const a = game.player.action;
  return n.target === game.player || (a && a.type === 'attack' && a.npc === n);
}

/** The ally's foe: always the closest monster (ties keep the one it's already on). */
function pickTarget(game, m) {
  const p = game.player;
  let best = null, bd = Infinity;
  for (const n of game.npcs) {
    if (Math.abs(n.x - m.x) > SEEK || Math.abs(n.y - m.y) > SEEK || !fairGame(game, n)) continue;
    if (chebyshev(n.x, n.y, p.x, p.y) > LEASH) continue;
    const d = chebyshev(n.x, n.y, m.x, m.y);
    if (d < bd || (d === bd && n === m.allyTarget)) { bd = d; best = n; }
  }
  m.allyTarget = best;
  return best;
}

/** Ally cleave: a share of the hit sweeps into up to 3 foes beside the target,
 *  the same share as the Merchant's weapon (canes 40%). */
export function allyCleave(game, target, dmg) {
  const share = CLEAVE_SHARE[game.weaponType()] || CLEAVE_SHARE.cane;
  let hit = 0;
  for (const o of game.npcs) {
    if (hit >= 3) break;
    if (o === target || o.hp <= 0 || o.temporary || !fairGame(game, o)) continue;
    if (o.def.fixed && o.target !== game.player) continue;
    if (chebyshev(o.x, o.y, target.x, target.y) > 1) continue;
    const d = Math.min(o.hp, Math.max(1, Math.round(dmg * share)));
    o.takeDamage(d);
    game.addHitsplat(o, d, { tint: '#ffb347' });
    for (const x of combatXp(game.player.style, d)) game.skills.addXp(x.skill, x.xp * game.combatXpMult());
    if (!o.target) o.target = game.player;
    if (o.hp <= 0) game.killNpc(o, { byAlly: true });
    hit++;
  }
}

/** One game tick of a mercenary or A-Worthling (called from NPC.tick for allies). */
export function mercTick(game, m) {
  const p = game.player;
  // A mercenary's contract ends on time, or if the Merchant falls. A-Worthlings
  // never leave: they just wait while the Merchant is down.
  if (game.tickCount >= m.allyUntil || (!p.alive && !m.follower)) {
    m.alive = false;
    game.spawnSparkle(m, m.follower ? '#f5b82e' : '#3fbf9f', 8);
    game.msg(m.follower ? 'Your A-Worthling shimmers and fades away.' : `${m.name}'s contract is up.`, 'system');
    game.bus.emit('mercs');
    return;
  }
  if (!p.alive) return;
  // Left far behind (the Merchant teleported or rode the MRT): jump to them.
  if (chebyshev(m.x, m.y, p.x, p.y) > CATCH_UP) {
    const spot = game._nearestFree(p.x, p.y + 1);
    if (spot) { m.stopNow(); m.x = m.tx = spot.x; m.y = m.ty = spot.y; m._goal = null; game.spawnSparkle(m, m.follower ? '#f5b82e' : '#3fbf9f', 8); }
    return;
  }
  // Run at the closest monster.
  const target = pickTarget(game, m);
  if (target) {
    if (chebyshev(m.x, m.y, target.x, target.y) <= 1) {
      m.stop?.();
      // Allies swing exactly as fast as the Merchant: a weapon speed of N combat
      // beats (0.3s each) means 2/N swings per 0.6s tick, the remainder carried over.
      m.swingAcc = Math.min(6, (m.swingAcc || 0) + (TICK_MS / COMBAT_BEAT_MS) / Math.max(0.25, game.equipment.weaponSpeed()));
      game._swingToward(m, target.x, target.y);
      // Both scale with the Merchant as they are now: levels, gear and upgrades.
      const own = playerAttackVsNpc(game.skills, game.equipment, p.style, target.def).max;
      const max = m.follower ? Math.max(1, Math.round(own * FOLLOWER_SHARE)) : Math.max(m.mercPower, Math.round(own * MERC_SHARE));
      while (m.swingAcc >= 1 && target.hp > 0) {
        m.swingAcc--;
        const dmg = Math.min(target.hp, Math.random() < 0.85 ? randInt(Math.ceil(max / 4), max) : 0);
        target.takeDamage(dmg);
        game.addHitsplat(target, dmg, { tint: m.follower ? '#f5b82e' : '#3fbf9f' });
        if (dmg > 0) {
          game._slash(target, '#bff5e6');
          allyCleave(game, target, dmg);
          // Every hit by the Merchant's allies earns the Merchant the full combat XP.
          for (const x of combatXp(p.style, dmg)) game.skills.addXp(x.skill, x.xp * game.combatXpMult());
        }
      }
      if (!target.target) target.target = p;
      // Kills by allies don't call up more A-Worthlings: only the Merchant's own do.
      if (target.hp <= 0) { game.killNpc(target, { byAlly: true }); m.swingAcc = 0; }
      return;
    }
    walkTo(game, m, target);
    return;
  }
  // Nothing to fight: keep close to the Merchant.
  if (chebyshev(m.x, m.y, p.x, p.y) > 2) walkTo(game, m, p);
}

function walkTo(game, m, to) {
  if (m.isMoving && m._goal && m._goal.x === to.x && m._goal.y === to.y) return;
  const path = findPath(game.pathCfg(), { x: m.x, y: m.y }, { x: to.x, y: to.y }, { reachAdjacent: true, maxNodes: 1500 });
  if (path.length) { m.setPath(path, true); m._goal = { x: to.x, y: to.y }; }
}
