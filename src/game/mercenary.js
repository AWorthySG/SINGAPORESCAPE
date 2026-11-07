// Mercenaries: the Merchant hires fighters with coins, as many as they can pay
// for. Each one follows the Merchant for a contract of 90 seconds, closes to
// within ALLY_RANGE of the closest monster and pelts it with coins, like the
// Merchant does, and then heads home. All their XP goes to Ranged.
// Monsters don't fight back against mercenaries: the Merchant pays them to
// take no risks.
// A-Worthlings: every time the Merchant attacks there is a 25% chance a
// mirror image of the Merchant appears. It throws coins like a mercenary, hitting
// for a quarter of the Merchant's own damage, and stays for good. Each of its
// swings has a 25% chance to split off a smaller A-Worthling (up to MAX_FOLLOWERS). Every A-Worthling, big or small, never misses and always hits
// for a fixed 25% of the Merchant's max melee hit.
import { chebyshev, randInt } from '../core/utils.js';
import { TICK_MS, COMBAT_BEAT_MS } from '../config.js';
import { combatXpRanged, playerAttackVsNpc, playerRangedVsNpc, critChance, CRIT_MULT, MEGA_CRIT_MULT, MEGA_CRIT_CHANCE } from './combat.js';
import { CLEAVE_SHARE } from '../data/classes.js';
import { getItem } from '../data/items.js';

export const MERC_TICKS = 150;            // 90 seconds at 0.6s a tick
export const FOLLOWER_CHANCE = 0.25;      // per Merchant attack
export const MAX_FOLLOWERS = 200;         // the most A-Worthling power, counted in 25% A-Worthlings (merged ones count for more)
export const MERGE_AT = 40;               // past this many on screen, the smallest A-Worthlings merge in pairs (less lag)
export const MERGE_TO = 30;               // ...until this many are left
export const SPLIT_CHANCE = 0.25;         // per A-Worthling swing: a smaller A-Worthling splits off
export const FOLLOWER_SHARE = 0.25;       // of the Merchant's melee damage
export const MERC_SHARE = 0.5;            // a mercenary hits for half the Merchant's melee damage (at least its hired power)
const SEEK = 10;                          // how far an ally looks for a monster
const ALLY_RANGE = SEEK;                  // allies throw coins at anything they can see
const STAY_NEAR = 3;                      // they stand within this of the Merchant (no walking)
const LEASH = 14;                         // allies don't chase further than this from the Merchant
const CATCH_UP = 24;                      // further than this from the Merchant (a teleport, the MRT): jump back to them
const MERC_KINDS = ['mercenary_sellsword', 'mercenary_bruiser', 'mercenary_spear_guard', 'mercenary_duellist'];
const MERC_NAMES = ['Ah Seng the Sellsword', 'Siti Steelhand', 'Big Raju', 'Old Tan', 'Mei the Blade', 'Kumar Ironjaw', 'Lim the Lancer', 'Farah Quickstep'];

/** What one mercenary costs to hire: more as the Merchant grows. */
export const hireCost = (game) => 80 + 15 * game.skills.combatLevel();

/** A mercenary's best hit: grows with the Merchant's level and gear Strength. */
export const mercPower = (game) => Math.max(2, Math.round(2 + game.skills.combatLevel() * 0.4 + (game.equipment.bonuses().ranged || 0) * 0.15));

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
  return spawnFollower(game);
}

/** Summon one A-Worthling next to the player. Returns it, or null. */
export function spawnFollower(game, parent = null) {
  const p = game.player;
  if (!p.alive) return null;
  // Total A-Worthling power (each 25% one counts 1, a merged one its share / 25%),
  // counted once a tick then kept up to date here, not by scanning every spawn.
  if (game._followerTick !== game.tickCount) {
    game._followerTick = game.tickCount;
    game._followerCount = activeFollowers(game).reduce((n, f) => n + (f.share || FOLLOWER_SHARE) / FOLLOWER_SHARE, 0);
  }
  if (game._followerCount >= MAX_FOLLOWERS) return null;
  const from = parent || p;
  const spot = game._nearestFree(from.x - 1, from.y);
  if (!spot) return null;
  const f = game.spawnNpc('aworthling', spot.x, spot.y, { temporary: true, wander: 0 });
  f.ally = true;
  f.follower = true;
  game._followerCount++;
  // A split-off A-Worthling is drawn smaller but hits just as hard (25%).
  f.share = FOLLOWER_SHARE;
  if (parent) f.def = { ...f.def, name: 'Little A-Worthling', scale: Math.max(0.45, (parent.def.scale || 1) * 0.8) };
  f.allyUntil = Infinity;            // A-Worthlings stay for good
  allyPace(f);
  if (!parent) game.spawnSparkle(f, '#f5b82e', 10);
  // Chat and the Combat tab are updated at most once a tick (see flushAllies),
  // so a swarm of new A-Worthlings doesn't flood the page.
  game._allyNews = game._allyNews || { spawned: 0, xp: {} };
  game._allyNews.spawned++;
  game._allyNews.dirty = true;
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

/** Monsters near the Merchant that allies may fight, found once a tick and
 *  shared by every ally (scanning the whole world per ally was the big cost). */
function nearbyFoes(game) {
  if (game._allyFoesTick === game.tickCount && game._allyFoes) return game._allyFoes;
  const p = game.player, out = [];
  for (const n of game.npcs) {
    if (Math.abs(n.x - p.x) > LEASH || Math.abs(n.y - p.y) > LEASH || !fairGame(game, n)) continue;
    out.push(n);
  }
  game._allyFoesTick = game.tickCount;
  game._allyFoes = out;
  return out;
}

/** The ally's foe: always the closest monster (ties keep the one it's already on). */
function pickTarget(game, m) {
  let best = null, bd = Infinity;
  for (const n of nearbyFoes(game)) {
    if (!n.alive || n.hp <= 0 || Math.abs(n.x - m.x) > SEEK || Math.abs(n.y - m.y) > SEEK) continue;
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
  for (const o of nearbyFoes(game)) {
    if (hit >= 3) break;
    if (o === target || o.hp <= 0 || o.temporary || !o.alive) continue;
    if (o.def.fixed && o.target !== game.player) continue;
    if (chebyshev(o.x, o.y, target.x, target.y) > 1) continue;
    const d = Math.min(o.hp, Math.max(1, Math.round(dmg * share)));
    o.takeDamage(d);
    allySplat(game, o, d, '#ffb347');
    allyXp(game, d);
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
  // Allies don't walk (path-finding for a crowd of them was the big lag): they
  // stand beside the Merchant and, when left behind, reappear next to them.
  if (chebyshev(m.x, m.y, p.x, p.y) > STAY_NEAR) {
    const spot = game._nearestFree(p.x + randInt(-2, 2), p.y + randInt(-2, 2));
    if (spot) { m.stopNow(); m.x = m.tx = spot.x; m.y = m.ty = spot.y; m._goal = null; }
  }
  // Throw coins at the closest monster in sight.
  const target = pickTarget(game, m);
  if (target) {
    if (chebyshev(m.x, m.y, target.x, target.y) <= ALLY_RANGE) {
      m.stop?.();
      // Allies swing exactly as fast as the Merchant: a weapon speed of N combat
      // beats (0.3s each) means 2/N swings per 0.6s tick, the remainder carried over.
      // No cap: past 6 swings a tick, each swing stands for a volley (damage multiplied to match).
      const rate = (TICK_MS / COMBAT_BEAT_MS) / Math.max(1e-9, game.equipment.weaponSpeed());
      const volley = Math.max(1, rate / 6);
      m.swingAcc = Math.min(6, (m.swingAcc || 0) + rate / volley);
      game._swingToward(m, target.x, target.y);
      // Both scale with the Merchant as they are now: levels, gear and upgrades.
      const own = merchantMax(game, target.def);
      const max = Math.round(volley * (m.follower ? Math.max(1, Math.round(own * (m.share || FOLLOWER_SHARE))) : Math.max(m.mercPower, Math.round(own * MERC_SHARE))));
      while (m.swingAcc >= 1 && target.hp > 0) {
        m.swingAcc--;
        if (m.follower && Math.random() < SPLIT_CHANCE) spawnFollower(game, m);
        // A-Worthlings hit a fixed 25% of the Merchant's max hit; mercenaries roll.
        let raw = m.follower ? max : Math.random() < 0.85 ? randInt(Math.ceil(max / 4), max) : 0;
        // Allies crit like the Merchant does (same crit chance, x2 or x4 on a mega crit).
        let critX = 0;
        if (raw > 0 && Math.random() < allyCritChance(game)) {
          critX = Math.random() < MEGA_CRIT_CHANCE ? MEGA_CRIT_MULT : CRIT_MULT;
          raw = Math.round(raw * (critX + (game.equipment.bonuses().critDmg || 0) / 100));
        }
        const dmg = Math.min(target.hp, raw);
        target.takeDamage(dmg);
        allySplat(game, target, dmg, m.follower ? '#f5b82e' : '#3fbf9f', critX);
        allyCoin(game, m, target);
        if (dmg > 0) {
          allyCleave(game, target, dmg);   // the coins scatter into foes beside the target
          // Every hit by the Merchant's allies earns the Merchant the full combat XP.
          allyXp(game, dmg);
        }
      }
      if (!target.target) target.target = p;
      // Kills by allies don't call up more A-Worthlings: only the Merchant's own do.
      if (target.hp <= 0) { game.killNpc(target, { byAlly: true }); m.swingAcc = 0; }
      return;
    }
  }
}

/** A thrown coin flying from an ally to its target (skipped when the screen is busy). */
function allyCoin(game, m, target) {
  if (game.effects.length >= 200) return;
  const from = m.renderCenter(), to = target.renderCenter();
  const life = Math.min(560, 120 + Math.hypot(to.x - from.x, to.y - from.y) / 0.6);
  game.effects.push({ type: 'projectile', kind: 'coin', x: from.x, y: from.y - 6, ex: to.x, ey: to.y - 8, color: '#f5b82e', life, maxLife: life, arc: 0 });
}


/** The Merchant's own max hit against a foe, in the style they fight in (coin
 *  throws are ranged now; a melee weapon in hand still counts as melee). */
function merchantMax(game, def) {
  if (game.combatMode() === 'ranged') {
    const w = game.equipment.get('weapon');
    const str = w ? Math.floor((getItem(w).equip?.bonuses?.ranged || 0) / 3) : 0;
    return playerRangedVsNpc(game.skills, game.equipment, game.player.rangedStyle, def, str).max;
  }
  return playerAttackVsNpc(game.skills, game.equipment, game.player.style, def).max;
}

/** The Merchant's own crit chance (level, gear and perks), shared by their allies. */
function allyCritChance(game) {
  const ranged = game.combatMode() === 'ranged';
  return critChance(ranged ? game.skills.ranged : game.skills.attack, game.equipment.bonuses().crit) + (game.perkMods?.(ranged ? 'ranged' : 'melee').crit || 0);
}

/** Hitsplats from allies: skipped once the screen is already full of effects. */
function allySplat(game, n, d, tint, critX = 0) {
  if (game.effects.length < 250 || critX) game.addHitsplat(n, d, critX && d > 0 ? { critX } : { tint });
  else if (d > 0) n.hurt = 200;
}

/** Ally XP is pooled and handed over once a tick: every XP gain redraws the
 *  Skills panel, so hundreds of small gains a tick froze the page. */
function allyXp(game, dmg) {
  game._allyNews = game._allyNews || { spawned: 0, xp: {} };
  const pool = game._allyNews.xp;
  // Allies throw coins, so every hit they land trains Ranged (with Defence and Hitpoints).
  for (const x of combatXpRanged(game.player.style, dmg)) pool[x.skill] = (pool[x.skill] || 0) + x.xp * game.combatXpMult();
}

/** Once a tick (from the game tick): give the pooled XP and post one line
 *  about new A-Worthlings. */
/** Merging: past MERGE_AT A-Worthlings, the two smallest join into one that hits
 *  as hard as both together (and looks a little bigger), until MERGE_TO are
 *  left. The same total damage, far fewer of them to move, path and draw. */
export function mergeFollowers(game) {
  const fs = activeFollowers(game);
  if (fs.length <= MERGE_AT) return 0;
  let merged = 0;
  while (fs.length > MERGE_TO) {
    // Always the two smallest (a merged one can merge again, growing bigger still).
    fs.sort((x, y) => (x.share || FOLLOWER_SHARE) - (y.share || FOLLOWER_SHARE));
    const a = fs.shift(), b = fs[0];
    b.share = (b.share || FOLLOWER_SHARE) + (a.share || FOLLOWER_SHARE);
    a.alive = false;   // removed with the other finished temporary NPCs
    const size = Math.min(1.6, 0.8 + 0.2 * Math.log2(b.share / FOLLOWER_SHARE));
    b.def = { ...b.def, name: b.share >= FOLLOWER_SHARE * 4 ? 'Big A-Worthling' : 'A-Worthling', scale: size };
    merged++;
  }
  if (merged) game.hasTemps = true;
  return merged;
}

export function flushAllies(game) {
  mergeFollowers(game);
  const news = game._allyNews;
  if (!news) return;
  for (const [skill, xp] of Object.entries(news.xp)) if (xp > 0) game.skills.addXp(skill, xp);
  news.xp = {};
  if (news.spawned) {
    game.msg(news.spawned === 1 ? 'An A-Worthling steps out to fight beside you!' : `${news.spawned} A-Worthlings step out to fight beside you!`, 'system');
    news.spawned = 0;
  }
  if (news.dirty) { news.dirty = false; game.bus.emit('mercs'); }
}
