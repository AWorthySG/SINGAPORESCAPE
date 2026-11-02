// Mercenaries: the Merchant hires fighters with coins. Each one follows the
// Merchant for a contract of 90 seconds, piles onto whatever the Merchant is
// fighting (or anything attacking them), and then heads home. Monsters don't
// fight back against mercenaries: the Merchant pays them to take no risks.
import { chebyshev, randInt } from '../core/utils.js';
import { findPath } from '../engine/pathfinding.js';
import { combatXp } from './combat.js';

export const MAX_MERCS = 3;
export const MERC_TICKS = 150;            // 90 seconds at 0.6s a tick
const MERC_NAMES = ['Ah Seng the Sellsword', 'Siti Steelhand', 'Big Raju', 'Old Tan', 'Mei the Blade', 'Kumar Ironjaw', 'Lim the Lancer', 'Farah Quickstep'];

/** What one mercenary costs to hire: more as the Merchant grows. */
export const hireCost = (game) => 80 + 15 * game.skills.combatLevel();

/** A mercenary's best hit: grows with the Merchant's level and gear Strength. */
export const mercPower = (game) => Math.max(2, Math.round(2 + game.skills.combatLevel() * 0.4 + (game.equipment.bonuses().strength || 0) * 0.15));

export const activeMercs = (game) => game.npcs.filter((n) => n.ally && n.alive);

/** Hire one mercenary next to the player. Returns the mercenary, or null. */
export function hire(game) {
  const p = game.player;
  if (game.jobClass !== 'merchant') { game.msg('Only a Merchant can hire mercenaries.', 'system'); return null; }
  if (!p.alive) return null;
  if (activeMercs(game).length >= MAX_MERCS) { game.msg(`You already have ${MAX_MERCS} mercenaries on contract.`, 'system'); return null; }
  const cost = hireCost(game);
  if (game.inventory.count('coins') < cost) { game.msg(`A mercenary costs ${cost} coins.`, 'system'); return null; }
  const spot = game._nearestFree(p.x + 1, p.y);
  if (!spot) return null;
  game.inventory.remove('coins', cost);
  const m = game.spawnNpc('villager', spot.x, spot.y, { temporary: true, wander: 0 });
  m.ally = true;
  // Name and attackability come from the definition (a villager's look, a fighter's name).
  m.def = { ...m.def, name: MERC_NAMES[Math.floor(Math.random() * MERC_NAMES.length)], role: null, attackable: false, dialogue: null };
  m.allyUntil = game.tickCount + MERC_TICKS;
  m.mercPower = mercPower(game);
  m.mercCd = 0;
  game.spawnSparkle(m, '#3fbf9f', 12);
  game.msg(`You hire ${m.name} for ${cost} coins (90 seconds).`, 'level');
  game.bus.emit('mercs');
  return m;
}

/** One game tick of a mercenary (called from NPC.tick for allies). */
export function mercTick(game, m) {
  const p = game.player;
  if (game.tickCount >= m.allyUntil || !p.alive) {
    m.alive = false;
    game.spawnSparkle(m, '#3fbf9f', 8);
    game.msg(`${m.name}'s contract is up.`, 'system');
    game.bus.emit('mercs');
    return;
  }
  if (m.mercCd > 0) m.mercCd--;
  // Fight what the Merchant fights, or whatever is hunting the Merchant.
  const a = p.action;
  let target = a && a.type === 'attack' && a.npc && a.npc.alive ? a.npc : null;
  if (!target) {
    let bd = Infinity;
    for (const n of game.npcs) {
      if (!n.alive || !n.attackable || n.target !== p) continue;
      const d = chebyshev(n.x, n.y, p.x, p.y);
      if (d <= 8 && d < bd) { bd = d; target = n; }
    }
  }
  if (target) {
    if (chebyshev(m.x, m.y, target.x, target.y) <= 1) {
      if (m.mercCd > 0) return;
      m.stop?.();
      m.mercCd = 2;
      game._swingToward(m, target.x, target.y);
      const max = m.mercPower;
      const dmg = Math.min(target.hp, Math.random() < 0.85 ? randInt(Math.ceil(max / 4), max) : 0);
      target.takeDamage(dmg);
      game.addHitsplat(target, dmg, { tint: '#3fbf9f' });
      if (dmg > 0) {
        game._slash(target, '#bff5e6');
        // The Merchant learns from watching: half the usual combat XP.
        for (const x of combatXp(p.style, dmg)) game.skills.addXp(x.skill, x.xp * 0.5 * game.combatXpMult());
      }
      if (!target.target) target.target = p;
      if (target.hp <= 0) game.killNpc(target);
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
