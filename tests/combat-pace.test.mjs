// Combat levelling pace: combat XP grows with your fighting level, so Melee,
// Ranged and Magic don't stall in the 70s-90s and on the long road past 99.
// The full measurements (hours of auto battle to each level) live in
// tools/balance/xp.mjs; these checks are exact sums, so they can't flake.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { combatLevelXpMult, COMBAT_LEVEL_XP } from '../src/game/combat.js';
import { NPC } from '../src/game/npc.js';
import { getNpc, ALL_MONSTER_IDS } from '../src/data/npcs.js';
import { xpForLevel } from '../src/data/xp.js';
import { DAY_CYCLE_MS } from '../src/config.js';

const FIGHT_SKILL = { corsair: 'attack', archer: 'ranged', wizard: 'magic' };
const MONS = ALL_MONSTER_IDS.map((id) => ({ id, ...getNpc(id) })).filter((d) => d.attackable && !d.boss && !d.fixed);
/** The ordinary monster closest to level L. */
const monsterNear = (L) => MONS.reduce((a, b) => (Math.abs(b.level - L) < Math.abs(a.level - L) ? b : a));

/** XP into the class's fighting skill (and Defence) for one kill of `def` at fighting level L, by day, no streak. */
function killGain(g, cls, L, def) {
  const sk = FIGHT_SKILL[cls];
  g.skills.xp[sk] = xpForLevel(L);
  if (sk === 'attack' && 'strength' in g.skills.xp) g.skills.xp.strength = g.skills.xp.attack;
  g.playMs = DAY_CYCLE_MS / 2;   // high noon: no night bonus
  g.killStreak = 0; g._lastKillTick = -1e9;
  const n = new NPC(def.id, g.player.x + 1, g.player.y, 0, {});
  const s0 = g.skills.xp[sk], d0 = g.skills.xp.defence;
  g.killNpc(n);
  return { skill: g.skills.xp[sk] - s0, defence: g.skills.xp.defence - d0 };
}

/** Kills of level-matched monsters (kill reward only) to climb from `from` to `to`. */
function killsBetween(cls, from, to) {
  const g = freshGame(cls);
  let kills = 0;
  for (let L = from; L < to; L++) kills += (xpForLevel(L + 1) - xpForLevel(L)) / killGain(g, cls, L, monsterNear(L)).skill;
  return kills;
}

test('combat XP boost: x1 to level 40, rising evenly to x2.5 at 80, and no further', () => {
  assert.equal(combatLevelXpMult(1), 1);
  assert.equal(combatLevelXpMult(COMBAT_LEVEL_XP.from), 1);
  assert.equal(combatLevelXpMult(60), 1.75);
  assert.equal(combatLevelXpMult(80), 2.5);
  assert.equal(combatLevelXpMult(300), 2.5);
  for (let L = 1; L < 120; L++) assert.ok(combatLevelXpMult(L + 1) >= combatLevelXpMult(L), `never drops at ${L}`);
});

test('a kill at Melee, Ranged or Magic 90 pays 2.5x what the same kill paid at 30, and Defence keeps in step', () => {
  const def = monsterNear(60);
  for (const cls of Object.keys(FIGHT_SKILL)) {
    const g = freshGame(cls);
    const lo = killGain(g, cls, 30, def), hi = killGain(g, cls, 90, def);
    assert.ok(Math.abs(hi.skill / lo.skill - 2.5) < 0.01, `${cls}: x${(hi.skill / lo.skill).toFixed(2)}`);
    assert.ok(Math.abs(hi.defence / lo.defence - 2.5) < 0.01, `${cls}: Defence x${(hi.defence / lo.defence).toFixed(2)}`);
    // Defence and Hitpoints get a third of the fighting skill's share (a little more against Magic's three quarters).
    const ratio = hi.defence / hi.skill;
    assert.ok(ratio > 0.3 && ratio < 0.45, `${cls}: Defence ${ratio.toFixed(2)} of the fighting skill`);
  }
});

test('Melee and Ranged earn the same per kill; Magic three quarters (each cast pays the rest)', () => {
  const [melee, ranged, magic] = Object.keys(FIGHT_SKILL).map((cls) => killsBetween(cls, 60, 99));
  assert.ok(Math.abs(ranged / melee - 1) < 0.01, `kills from 60 to 99: Melee ${Math.round(melee)}, Ranged ${Math.round(ranged)}`);
  assert.ok(Math.abs(magic / melee - 4 / 3) < 0.01, `Magic ${Math.round(magic)} on kill rewards alone`);
});

test('the climb to 99 and on to 200 takes about 2.5x fewer kills than it did', () => {
  // Before the boost, Melee 80 -> 99 took ~2,200 level-matched kills (kill reward
  // only; the damage trickle adds a third more XP) and 99 -> 200 about 14,400.
  const to99 = killsBetween('corsair', 80, 99), to200 = killsBetween('corsair', 99, 200);
  assert.ok(to99 < 1000, `Melee 80 -> 99: ${Math.round(to99)} kills`);
  assert.ok(to99 > 600, `but still a climb (${Math.round(to99)} kills)`);
  assert.ok(to200 < 6500, `Melee 99 -> 200: ${Math.round(to200)} kills`);
  assert.ok(to200 > 4500, `and a long road (${Math.round(to200)} kills)`);
});
