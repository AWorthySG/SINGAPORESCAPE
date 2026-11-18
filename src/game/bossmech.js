// Boss mechanics: the one thing each boss asks you to *do* (see
// src/data/bossMechanics.js for who does what). Kept out of game.js: the game
// calls in from a handful of one-line hooks:
//   doTick            -> tickBossMechanics      start, run and clean up
//   _applyPlayerHit   -> mechOnPlayerHit         shields soak hits, exposed bosses take more
//   abilities / specs -> mechAbilityUsed         interrupts a cast
//   auto battle       -> mechAutoFight           turn on healers, interrupt casts
//   hazards           -> inHazard                the safe circle's hole in the red
// Nothing here is saved: a mechanic only lives as long as the fight.
import { BOSS_MECHANICS, MECH_STYLES } from '../data/bossMechanics.js';
import { chebyshev } from '../core/utils.js';
import { TICK_MS } from '../config.js';

export const MECH_FIRST_TICKS = 10;   // ~6s into a fight before the first one
export const MECH_EVERY_TICKS = 26;   // then one every ~15s (counted from when the last one ends)
export const MECH_RANGE = 10;         // the boss must be fighting you within this many tiles
export const MECH_LEAVE = 15;         // walk further than this and it's called off
// Style shield.
export const SHIELD_TICKS = 18;       // ~11s to break it
export const SHIELD_POOL = 0.04;      // of the boss's life
export const SHIELD_WRONG = 0.25;     // what a hit of the wrong style does to it
export const SHIELD_BURST = 0.25;     // of your life when it bursts unbroken
export const SHIELD_MEND = 0.05;      // and the boss mends this much
export const EXPOSED_TICKS = 6;       // broken: the boss takes extra damage for ~3.6s
export const EXPOSED_MULT = 1.5;
// Safe circle.
export const CIRCLE_TICKS = 5;        // ~3s to get into the green
export const CIRCLE_R = 6;            // the red covers 13x13 tiles round you
export const CIRCLE_SAFE_R = 1;       // the green circle is 3x3
// Healing adds.
export const ADDS_TICKS = 30;         // they fade after ~18s
export const HEAL_EVERY = 3;          // each heals every ~1.8s...
export const HEAL_FRAC = 0.015;       // ...this much of the boss's life...
export const HEAL_CAP = 0.15;         // ...up to this much in all
// Interruptible cast.
export const CAST_TICKS = 6;          // ~3.6s cast bar
export const CAST_HIT = 0.35;         // of your life if it lands (never a one-shot)
export const CAST_STAGGER = 4;        // ticks the boss reels when interrupted

const msg = (g, t) => g.msg(t, 'combat');
const active = (g) => g._mechActive || (g._mechActive = new Set());

/** Is (x, y) inside this hazard? A safe-circle hazard has a hole in it. */
export function inHazard(h, x, y) {
  if (Math.abs(x - h.cx) > h.r || Math.abs(y - h.cy) > h.r) return false;
  const s = h.safe;
  return !(s && Math.abs(x - s.cx) <= s.r && Math.abs(y - s.cy) <= s.r);
}

/** Each game tick: run the mechanics under way and start new ones. */
export function tickBossMechanics(game) {
  const p = game.player;
  for (const n of active(game)) {
    const m = n.mech;
    if (!m) { active(game).delete(n); continue; }
    if (!n.alive || n.hp <= 0) { clearMechanic(game, n, 'dead'); continue; }
    if (!p.alive || n.target !== p || chebyshev(p.x, p.y, n.x, n.y) > MECH_LEAVE) { clearMechanic(game, n, 'left'); continue; }
    STEP[m.type]?.(game, n, m);
  }
  if (!p.alive) return;
  for (const n of game.nearbyNpcs()) {
    if (!n.alive || !n.def.boss || n.mech || n.ally || n.target !== p) continue;
    if (!BOSS_MECHANICS[n.npcId] || chebyshev(p.x, p.y, n.x, n.y) > MECH_RANGE) continue;
    if (n._mechCd == null) n._mechCd = MECH_FIRST_TICKS;
    if (--n._mechCd > 0) continue;
    startMechanic(game, n);
  }
}

/** Start this boss's mechanic now (the tick does this on its timer). */
export function startMechanic(game, n) {
  const md = BOSS_MECHANICS[n.npcId];
  if (!md || n.mech || !game.player.alive) return null;
  const m = START[md.type]?.(game, n, md);
  if (!m) { n._mechCd = MECH_EVERY_TICKS; return null; }
  m.type = md.type; m.md = md; m.since = game.tickCount;
  n.mech = m;
  n._mechN = (n._mechN || 0) + 1;
  active(game).add(n);
  game.bus.emit('sfx', 'spec');
  return m;
}

/** End a boss's mechanic, tidying up whatever it left in the world. */
export function clearMechanic(game, n, why = 'done') {
  const m = n.mech;
  active(game).delete(n);
  if (!m) return;
  n.mech = null;
  n._mechCd = why === 'left' ? MECH_FIRST_TICKS : MECH_EVERY_TICKS;
  if (m.hz) game.hazards = game.hazards.filter((h) => h !== m.hz);
  if (m.adds) {
    const gone = new Set(m.adds);
    for (const a of m.adds) { a.alive = false; a.mechHealer = null; }
    game.npcs = game.npcs.filter((a) => !gone.has(a));
    const pl = game.player;
    if (pl.target && gone.has(pl.target)) pl.target = null;
    if (pl.action?.type === 'attack' && gone.has(pl.action.npc)) pl.clearAction?.();
    if (why === 'dead' && m.adds.length) msg(game, `With ${n.name} gone, its healers fade away.`);
  }
}

// ---------------- Starting each kind ----------------
const START = {
  shield(game, n, md) {
    const style = md.styles[(n._mechN || 0) % md.styles.length];
    const st = MECH_STYLES[style];
    const pool = Math.max(1, Math.round(n.maxHp * SHIELD_POOL));
    game.addHitsplat(n, 0, { text: `${st.label} shield!` });
    game.spawnSparkle(n, st.color, 16);
    msg(game, `${n.name} raises its ${md.name}, a ${st.name} shield! Only ${st.name} attacks break it quickly.`);
    if (game.combatMode() !== style) msg(game, `Switch to ${st.name} (${st.how}) to break it, or it bursts in your face.`);
    return { style, hp: pool, max: pool, until: game.tickCount + SHIELD_TICKS };
  },
  circle(game, n, md) {
    const at = game.playerTile();
    const safe = safeSpot(game, at, n);
    if (!safe) return null;
    const hz = { cx: at.x, cy: at.y, r: CIRCLE_R, npc: n, kind: 'circle', sign: false, mech: true,
      safe: { cx: safe.x, cy: safe.y, r: CIRCLE_SAFE_R },
      fireTick: game.tickCount + CIRCLE_TICKS, start: performance.now(), dur: CIRCLE_TICKS * TICK_MS };
    game.hazards.push(hz);
    game.addHitsplat(n, 0, { text: md.name });
    game.addHitsplat(game.player, 0, { text: 'Into the green!' });
    game.spawnSparkle(n, '#ff5a5a', 14);
    game.addShake?.(2, 200);
    msg(game, `${n.name} unleashes ${md.name}! Everything round you is about to be hit: get into the green circle!`);
    return { hz, until: hz.fireTick };
  },
  adds(game, n, md) {
    const adds = [];
    for (let i = 0; i < (md.n || 2); i++) {
      const t = game._nearestFree(n.x + [-2, 2, 0][i % 3], n.y + (i === 2 ? 2 : 1));
      if (!t || (t.x === game.player.x && t.y === game.player.y)) continue;
      const a = game.spawnNpc(md.id, t.x, t.y, { temporary: true, wander: 0 });
      if (!a) continue;
      // Healers keep to their work: weak, never the first to strike, no higher level than their boss.
      a.def = { ...a.def, name: `${a.def.name} healer`, aggressive: false, maxHit: 1, level: Math.min(a.def.level || 1, n.def.level || 1) };
      a.mechHealer = n;
      adds.push(a);
    }
    if (!adds.length) return null;
    game.addHitsplat(n, 0, { text: md.name });
    game.spawnSparkle(n, '#5fe08a', 14);
    msg(game, `${n.name} calls its ${md.name}! Kill them before they heal it.`);
    return { adds, healed: 0, cap: Math.round(n.maxHp * HEAL_CAP), next: game.tickCount + HEAL_EVERY, until: game.tickCount + ADDS_TICKS };
  },
  cast(game, n, md) {
    n.attackCooldown = Math.max(n.attackCooldown || 0, CAST_TICKS + 1);   // it stands and channels
    n.castT = 700; n.castCol = '#b48aff';
    game.addHitsplat(n, 0, { text: `Casting ${md.name}!` });
    game.spawnSparkle(n, '#b48aff', 14);
    msg(game, `${n.name} begins casting ${md.name}! Use a skill or a special attack to interrupt it.`);
    return { until: game.tickCount + CAST_TICKS, start: performance.now(), dur: CAST_TICKS * TICK_MS };
  },
};

/** A walkable spot 3 tiles from you for the green circle, as near the boss as
 *  can be (so a melee fighter can often keep swinging from inside it). */
function safeSpot(game, at, boss) {
  const w = game.world;
  for (const d of [3, 2, 4]) {
    const opts = [];
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const x = at.x + dx, y = at.y + dy;
      if (!w.inBounds(x, y) || w.isBlocked(x, y)) continue;
      opts.push({ x, y, k: chebyshev(x, y, boss.x, boss.y) + Math.random() * 2 });
    }
    if (opts.length) return opts.sort((a, b) => a.k - b.k)[0];
  }
  return null;
}

// ---------------- Each tick of a mechanic ----------------
const STEP = {
  shield(game, n, m) {
    if (game.tickCount < m.until) return;
    // Left standing: it bursts.
    const st = MECH_STYLES[m.style];
    hurtPlayer(game, n, SHIELD_BURST, st.color);
    const mend = Math.round(n.maxHp * SHIELD_MEND);
    n.hp = Math.min(n.maxHp, n.hp + mend);
    game.addHitsplat(n, 0, { text: 'Shield bursts!' });
    game.spawnSparkle(n, '#5fe08a', 10);
    msg(game, `${n.name}'s ${m.md.name} bursts, and it mends itself!`);
    clearMechanic(game, n);
  },
  circle(game, n, m) {
    if (game.tickCount >= m.until) clearMechanic(game, n);   // the hazard itself hit or missed you
  },
  adds(game, n, m) {
    const alive = m.adds.filter((a) => a.alive && a.hp > 0);
    if (!alive.length) {
      game.addHitsplat(n, 0, { text: 'Healers down!' });
      game._gainAdrenaline?.(10);
      msg(game, `You cut down ${n.name}'s healers!`);
      clearMechanic(game, n);
      return;
    }
    if (game.tickCount >= m.until) {
      msg(game, `${n.name}'s ${m.md.name} drift away.`);
      clearMechanic(game, n);
      return;
    }
    if (game.tickCount < m.next) return;
    m.next = game.tickCount + HEAL_EVERY;
    const want = Math.max(1, Math.round(n.maxHp * HEAL_FRAC)) * alive.length;
    const amt = Math.min(want, m.cap - m.healed, n.maxHp - n.hp);
    if (amt <= 0) return;
    n.hp += amt; m.healed += amt;
    if (n.recentDmg > 0) n.recentDmg = Math.max(0, n.recentDmg - amt);
    game.addHitsplat(n, 0, { text: `+${amt}` });
    game.spawnSparkle(n, '#5fe08a', 6);
    if (!m.saidHeal) { m.saidHeal = true; msg(game, `The ${m.md.name} heal ${n.name}!`); }
  },
  cast(game, n, m) {
    if (game.tickCount < m.until) { n.attackCooldown = Math.max(n.attackCooldown || 0, 1); return; }
    hurtPlayer(game, n, CAST_HIT, '#b48aff');
    game.addShake?.(4, 300);
    msg(game, `${n.name}'s ${m.md.name} lands!`);
    clearMechanic(game, n);
  },
};

/** A mechanic's blow on you: a share of your life, softened by protection,
 *  bracing and perks like any boss blow. */
function hurtPlayer(game, n, frac, color) {
  const p = game.player;
  if (!p.alive) return 0;
  let dmg = Math.ceil(game.maxHp() * frac);
  const prot = game.protectFactor();
  if (prot) dmg = Math.floor(dmg * (1 - prot));
  if (game.braceTicks > 0) dmg = Math.floor(dmg * 0.5);
  dmg = Math.min(p.hp, game._perkReduce(dmg, n));
  p.takeDamage(dmg);
  game.addHitsplat(p, dmg, { crit: dmg > 0 });
  if (dmg > 0) game.spawnHitSparks?.(p, color);
  game.bus.emit('sfx', 'hurt'); game.bus.emit('hp');
  if (p.hp <= 0) game.playerDeath();
  return dmg;
}

// ---------------- Hooks the game calls ----------------
/** A hit of yours is about to land on `npc`: a style shield soaks it (the
 *  right style cracks it much faster) and an exposed boss takes extra. */
export function mechOnPlayerHit(game, npc, dmg) {
  if (dmg <= 0) return dmg;
  if (npc.mechExposed > game.tickCount) dmg = Math.round(dmg * EXPOSED_MULT);
  const m = npc.mech;
  if (!m || m.type !== 'shield') return dmg;
  const right = game.combatMode() === m.style;
  m.hp -= right ? dmg : dmg * SHIELD_WRONG;
  if (m.hp > 0) {
    if (!right && !m.saidWrong) { m.saidWrong = true; game.addHitsplat(npc, 0, { text: 'Resisted!' }); }
    return 0;
  }
  // Broken: the boss is left exposed.
  npc.mechExposed = game.tickCount + EXPOSED_TICKS;
  game.addHitsplat(npc, 0, { text: 'Shield broken!' });
  game.spawnSparkle(npc, MECH_STYLES[m.style].color, 18);
  game._gainAdrenaline?.(15);
  game.bus.emit('sfx', 'spec');
  msg(game, `You shatter ${npc.name}'s ${m.md.name}! It is exposed.`);
  clearMechanic(game, npc);
  return 0;
}

/** You used a skill or a special attack: it interrupts a boss's cast. */
export function mechAbilityUsed(game) {
  const p = game.player;
  for (const n of active(game)) {
    const m = n.mech;
    if (!m || m.type !== 'cast' || !n.alive || chebyshev(p.x, p.y, n.x, n.y) > MECH_RANGE + 2) continue;
    n.attackCooldown = Math.max(n.attackCooldown || 0, CAST_STAGGER);
    n.castT = 0;
    game.addHitsplat(n, 0, { text: 'Interrupted!' });
    game.spawnSparkle(n, '#7fd8ff', 16);
    game._gainAdrenaline?.(10);
    msg(game, `You interrupt ${n.name}'s ${m.md.name}!`);
    clearMechanic(game, n);
  }
}

/** Auto battle, mid-fight with `tgt`: keep the stall clock running while a
 *  mechanic holds the boss up, interrupt a cast with any ready skill, and
 *  turn on healers. Returns a healer to switch to, or null. */
export function mechAutoFight(game, tgt, fight) {
  const boss = tgt.mechHealer || tgt;
  const m = boss.mech;
  if (!m) return null;
  if (fight) fight.since = game.tickCount;   // a shield or healers aren't a stalled fight
  if (m.type === 'cast' && game.autoCfg?.abilities !== false && !game.armedAbility) game._autoAbility(() => true);
  if (m.type === 'adds' && !tgt.mechHealer) {
    const p = game.player;
    const h = m.adds.filter((a) => a.alive && a.hp > 0).sort((a, b) => chebyshev(p.x, p.y, a.x, a.y) - chebyshev(p.x, p.y, b.x, b.y))[0];
    return h || null;
  }
  return null;
}

/** The boss bar's prompt while a mechanic is under way ('' when none). */
export function mechLabel(game, boss) {
  const m = boss?.mech;
  if (!m) return '';
  const left = Math.max(0, Math.ceil((m.until - game.tickCount) * TICK_MS / 1000));
  switch (m.type) {
    case 'shield': {
      const st = MECH_STYLES[m.style];
      return `🛡 ${st.label} shield (${Math.max(0, Math.ceil(m.hp / m.max * 100))}%): hit it with ${st.name}! ${left}s`;
    }
    case 'circle': return '◎ Get into the green circle!';
    case 'adds': return `✚ Kill the healers! (${m.adds.filter((a) => a.alive && a.hp > 0).length} left)`;
    case 'cast': return `⏳ ${m.md.name}: use a skill to interrupt! ${left}s`;
    default: return '';
  }
}
