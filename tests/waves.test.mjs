// The Endless Gate (src/game/waves.js): a sealed arena where monsters come in
// endless, ever-stronger waves. Headless, deterministic game scenarios.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, clearSave } from '../src/game/save.js';
import { findPath } from '../src/engine/pathfinding.js';
import { ARENA, GATE, START, NEXT_WAVE_TICKS, MAX_ALIVE, BOSS_EVERY, MILESTONE_EVERY, inArena, wavePlan, waveCount, waveLevel,
  waveKinds, waveMobDef, gateMobDef, waveBossDef, bossChest, waveBonus, waveLeader, waveCurve, waveMight, GATE_HP, GATE_HIT, GATE_ACC, WAVE_BOSS_LIFE, GATE_CHAMPION_LIFE,
  SECOND_CHAMPION_FROM, THIRD_CHAMPION_FROM, HORDE_LIFE, SHRINE, SHRINE_LIFE, SHRINE_MEND, SPAWN_POINTS, GATE_RESPAWN_TICKS, GATE_FORGET, MAX_WAVE_COUNT,
  COIN_CAP, shrineChip, GATE_LOOT, gateDodgeMult, GATE_DODGE_MAX, DODGE_CAP_WAVE } from '../src/game/waves.js';
import { killXp, npcAttackVsPlayer } from '../src/game/combat.js';
import { HAZARD_DODGE_MULT, DODGE_AGILITY_XP, DODGE_BOSS_SHARE, DODGE_KILL_SHARE } from '../src/game/game.js';
import { damageNumber } from '../src/core/utils.js';
import { getNpc, ALL_MONSTER_IDS, ALL_BOSS_IDS } from '../src/data/npcs.js';
import { CHAMPION_HP_MULT } from '../src/game/npc.js';
import { RESPAWN_TICKS } from '../src/config.js';
import { ITEMS } from '../src/data/items.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(storage = fakeStorage()) {
  globalThis.localStorage = storage;
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.ui = new Proxy({}, { get: () => () => {} });
  return game;
}
const step = (game, ticks) => { for (let i = 0; i < ticks; i++) game.update(600); };
function placeAt(game, x, y) {
  const p = game.player;
  p.stopNow(); p.clearAction();
  p.x = p.tx = x; p.y = p.ty = y; p.progress = 0; p.moving = false; p.path = [];
}
const waveMobs = (game) => game.npcs.filter((n) => n.wave && n.alive);
/** Monsters moved by hand: drop the per-tick "who is near you" lists. */
const regrid = (game) => { game._near = game._around = null; };
/** Wave monsters that leave the shrine alone too (it never falls by accident). */
const spare = (game) => { for (const n of waveMobs(game)) n.attackCooldown = 99; };
/** Harmless wave monsters, so a long test can't end in a death. */
const tame = (game) => { for (const n of waveMobs(game)) { n.def = { ...n.def, maxHit: 0 }; n.attackCooldown = 99; } };
/** Run the countdown out and start the next wave. */
const nextWave = (game) => step(game, NEXT_WAVE_TICKS + 1);

test('the gate stands in Kampong Glam; entering and leaving puts you back where you were', () => {
  const g = newGame();
  const gate = g.world.objects.find((o) => o.objId === 'wave_gate');
  assert.ok(gate, 'the gate is in the world');
  assert.equal(g.world.zoneAt(gate.x, gate.y)?.name, 'Kampong Glam');
  assert.deepEqual({ x: gate.x, y: gate.y }, GATE);
  placeAt(g, GATE.x - 1, GATE.y + 1);
  assert.ok(g.waves.enter(), 'entered');
  assert.ok(g.waves.active);
  assert.ok(inArena(g.player.x, g.player.y), 'inside the arena');
  assert.deepEqual({ x: g.player.x, y: g.player.y }, START);
  assert.equal(g.currentZoneName, 'The Endless Gate');
  assert.ok(!g.zonesVisited.has('The Endless Gate'), 'the arena is not a region for the explorer achievements');
  nextWave(g);
  assert.ok(waveMobs(g).length > 0);
  assert.ok(g.waves.leave(), 'left');
  assert.ok(!g.waves.active);
  assert.deepEqual({ x: g.player.x, y: g.player.y }, { x: GATE.x - 1, y: GATE.y + 1 }, 'back where you came in');
  assert.equal(waveMobs(g).length, 0, 'the wave goes with the run');
  assert.ok(!g.npcs.some((n) => n.wave), 'no wave monster is left behind');
});

test('a wave banner names the real count and goes when you leave the gate', async () => {
  // A stray "Wave 1 · 0 monsters" banner once followed a player who left right
  // after a wave began: the count was read after spawning had emptied the plan,
  // and the 3s banner outlived the run. Uses the real banner methods from ui.js.
  const { UI } = await import('../src/ui/ui.js');
  const g = newGame();
  const fake = { el: {} };
  g.ui = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : typeof UI.prototype[k] === 'function' && /Banner$/.test(k) ? UI.prototype[k].bind(t) : () => {}) });
  // (Banners go to the notification lane: headless it keeps the queue and draws nothing.)
  const shown = () => fake.lane.queue.items.map((x) => x.html).join(' | ');
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  nextWave(g);
  assert.equal(g.waves.wave, 1);
  assert.match(shown(), new RegExp(`${waveCount(1) + 1} monsters`), 'the wave banner is up, counting the wave (and its champion), not what is left in the queue');
  assert.match(shown(), /led by Champion /, 'and names the champion leading it');
  assert.ok(g.waves.leave());
  assert.doesNotMatch(shown(), /Wave 1/, 'leaving takes the wave banner down at once');
  // Someone else's banner (a level-up, say) is left alone.
  g.ui.showBanner('Level up!');
  g.ui.hideBanner('waves');
  assert.match(shown(), /Level up!/, 'only the gate\'s own banner is cleared');
});

test('the exit portal and the gate work through the normal interact routing', () => {
  const g = newGame();
  let opened = 0;
  g.ui = new Proxy({}, { get: (_, k) => (k === 'openWaveGate' ? () => { opened++; g.waves.enter(); } : () => {}) });
  placeAt(g, GATE.x - 1, GATE.y);
  const gate = g.world.objects.find((o) => o.objId === 'wave_gate');
  g.defaultObjectAction(gate);
  step(g, 2);
  assert.equal(opened, 1, 'the gate opens its panel');
  assert.ok(g.waves.active);
  const exit = g.world.objects.find((o) => o.objId === 'wave_exit');
  g.defaultObjectAction(exit);
  step(g, 8);
  assert.ok(!g.waves.active, 'the portal leads out');
  assert.deepEqual({ x: g.player.x, y: g.player.y }, { x: GATE.x - 1, y: GATE.y });
});

test('wave 1 spawns inside the arena; clearing it pays a bonus and starts wave 2 after the delay', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  step(g, NEXT_WAVE_TICKS - 1);
  assert.equal(g.waves.wave, 0, 'a countdown before the first wave');
  step(g, 2);
  assert.equal(g.waves.wave, 1);
  const mobs = waveMobs(g);
  assert.equal(mobs.length, waveCount(1) + 1, 'the wave and its champion');
  for (const n of mobs) {
    assert.ok(n.x >= ARENA.x0 && n.x <= ARENA.x1 && n.y >= ARENA.y0 && n.y <= ARENA.y1, `${n.name} spawned on the arena floor`);
    assert.ok(n.temporary && n.def.aggressive, 'a temporary, aggressive spawn');
  }
  const coins = g.inventory.count('coins');
  for (const n of mobs) g.killNpc(n);
  step(g, 1);
  assert.ok(g.waves.nextAt > 0, 'the countdown to wave 2 is running');
  assert.ok(g.inventory.count('coins') > coins, 'the wave-clear bonus is paid');
  assert.ok(g.waves.countdown() > 0);
  step(g, NEXT_WAVE_TICKS - 2);
  assert.equal(g.waves.wave, 1, 'not before the delay');
  step(g, 2);
  assert.equal(g.waves.wave, 2, 'wave 2 has begun');
  assert.equal(waveMobs(g).length, waveCount(2) + 1);
  assert.ok(waveMobs(g)[0].def.level > mobs[0].def.level, 'wave 2 is stronger');
});

test('monster level, numbers, life and hits rise with the wave, gently and then steeply', () => {
  for (const base of [1, 3, 40, 500, 4000]) {
    let prev = null;
    for (let n = 1; n <= 60; n++) {
      const plan = wavePlan(n, base);
      const mob = plan.find((e) => !e.def.boss && !e.champion);
      assert.equal(mob.def.level, waveLevel(n, base));
      if (prev) {
        assert.ok(mob.def.level > prev.level, `wave ${n} (base ${base}) is a higher level`);
        assert.ok(waveCount(n) >= waveCount(n - 1));
      }
      prev = mob.def;
    }
  }
  // Gently at first, steeply later: the second ten waves climb more than the first ten.
  const L = (n) => waveLevel(n, 100);
  assert.ok(L(20) - L(10) > L(10) - L(1));
  assert.ok(L(1) < 100 && L(40) > 400, 'starts below you, ends far above you');
  // Each wave's monsters are a mix of existing kinds that changes from wave to wave.
  const kinds = (n) => [...new Set(wavePlan(n, 100).map((e) => e.id))].join();
  assert.notEqual(kinds(3), kinds(4));
  assert.ok(waveCount(200) + 3 <= MAX_ALIVE, 'even the deepest wave comes out all at once');
});

test('a champion leads every wave and every 5th is a boss wave with its signature moves', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.waves.wave = 3;
  nextWave(g);
  assert.equal(g.waves.wave, 4);
  assert.equal(waveMobs(g).filter((n) => n.champion).length, 1, 'wave 4 has a champion');
  for (const n of waveMobs(g)) g.killNpc(n);
  g.waves.wave = BOSS_EVERY - 1;
  step(g, 1);
  nextWave(g);
  assert.equal(g.waves.wave, BOSS_EVERY);
  const boss = waveMobs(g).find((n) => n.def.boss);
  assert.ok(boss, 'wave 5 has a boss');
  assert.equal(boss.def.level, g.waves.level, 'scaled to the wave');
  assert.ok(inArena(boss.x, boss.y));
  // The boss lays its ground markers in the arena like any boss.
  placeAt(g, boss.x + 1, boss.y);
  boss.target = g.player;
  g.bossHazard(boss);
  assert.ok(g.hazards.length > 0, 'a boss marker is down');
  // A boss wave pays a guaranteed chest on top of the bonus.
  const scrolls = g.inventory.count('refine_scroll'), wards = g.inventory.count('upgrade_ward');
  for (const n of waveMobs(g)) g.killNpc(n);
  step(g, 1);
  assert.ok(g.inventory.count('refine_scroll') >= scrolls + 2, 'refine scrolls from the chest');
  assert.ok(g.inventory.count('upgrade_ward') >= wards + 1, 'a ward from the chest');
});

test('your best wave is saved, loads back, and shows; a save made inside stores the way back', () => {
  const storage = fakeStorage();
  const g = newGame(storage);
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  for (let w = 1; w <= 3; w++) { nextWave(g); if (w < 3) { for (const n of waveMobs(g)) g.killNpc(n); step(g, 1); } }
  assert.equal(g.waves.best, 3);
  assert.notEqual(saveGame(g), false);
  const h = new Game();
  h.start();
  assert.equal(h.waves.best, 3, 'the best wave loads');
  assert.ok(!inArena(h.player.x, h.player.y), 'a save made inside the arena loads you outside it');
  assert.deepEqual({ x: h.player.x, y: h.player.y }, { x: GATE.x - 1, y: GATE.y + 1 });
  // Older saves have no record: it starts at 0.
  const fresh = newGame();
  assert.equal(fresh.waves.best, 0);
});

test('death inside keeps every item; you rise beside the shrine a few seconds later and the run goes on', () => {
  // The run used to end when you fell. Now the shrine is what ends it: you
  // rise beside it after GATE_RESPAWN_TICKS while the monsters keep at it.
  const g = newGame();
  g.inventory.add('trout', 5);
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.toggleAutoBattle(true);
  nextWave(g);
  for (const n of waveMobs(g).slice(0, 2)) g.killNpc(n);
  step(g, 3);   // the kill drops fly in
  const before = JSON.stringify(g.inventory.serialize()), equip = JSON.stringify(g.equipment.serialize());
  const left = waveMobs(g).length;
  // Two of them already at the shrine, harmless to you.
  for (const [i, n] of waveMobs(g).slice(0, 2).entries()) { n.stopNow(); n.x = n.tx = SHRINE.x - 1 + 2 * i; n.y = n.ty = SHRINE.y + 1; n.target = null; n.attackCooldown = 0; }
  for (const n of waveMobs(g)) n.def = { ...n.def, maxHit: 0 };
  g.player.hp = 0;
  g.playerDeath();
  assert.ok(g.waves.active, 'the run goes on');
  assert.equal(waveMobs(g).length, left, 'its monsters stay');
  assert.ok(!g.world.objects.some((o) => o.objId === 'gravestone' && inArena(o.x, o.y)), 'no gravestone in the gate');
  assert.ok(g.autoBattle, 'auto battle stays on, to fight on after you rise');
  step(g, RESPAWN_TICKS + 1);
  assert.ok(!g.player.alive, 'still down: longer than a fall outside');
  const hp0 = g.waves.shrine.hp;
  step(g, GATE_RESPAWN_TICKS - RESPAWN_TICKS);
  assert.ok(g.player.alive, 'up again');
  assert.ok(inArena(g.player.x, g.player.y) && Math.max(Math.abs(g.player.x - SHRINE.x), Math.abs(g.player.y - SHRINE.y)) <= 2, 'beside the shrine');
  assert.ok(g.waves.shrine.hp < SHRINE_LIFE && g.waves.shrine.hp <= hp0, 'the monsters went for the shrine while you were down');
  assert.equal(g.waves.run.deaths, 1);
  assert.equal(JSON.stringify(g.inventory.serialize()), before, 'nothing is lost');
  assert.equal(JSON.stringify(g.equipment.serialize()), equip, 'gear kept');
  assert.equal(g.player.hp, g.maxHp());
  // Leaving while down wakes you outside, not beside a shrine with no run.
  g.player.hp = 0;
  g.playerDeath();
  assert.ok(g.waves.leave());
  step(g, GATE_RESPAWN_TICKS + 1);
  assert.ok(g.player.alive && !inArena(g.player.x, g.player.y), 'woke outside the gate');
});

test('auto battle clears waves inside, eats, and never wanders out to quests or gathering', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.autoGather = true;   // these pause inside
  g.toggleAutoQuest(true);
  g.toggleAutoBattle(true);
  nextWave(g);
  assert.equal(g.waves.wave, 1);
  // A strong fighter against wave 1, which starts below your level anyway.
  for (const n of waveMobs(g)) { n.hp = Math.min(n.hp, 3); n.maxHp = Math.max(n.maxHp, 3); }
  tame(g);
  g.inventory.add('trout', 3);
  const food = () => g.inventory.slots.reduce((t, sl) => t + (sl && ITEMS[sl.id]?.heal ? sl.qty : 0), 0);
  const meals = food();
  g.player.hp = Math.floor(g.maxHp() * 0.2);
  let left = false;
  for (let t = 0; t < 300 && g.waves.wave < 2; t++) {
    step(g, 1);
    tame(g);
    if (!inArena(g.player.x, g.player.y)) left = true;
  }
  assert.ok(!left, 'auto battle never walked out of the arena');
  assert.ok(g.waves.wave >= 2, `auto battle cleared wave 1 (on wave ${g.waves.wave}, ${g.waves.left()} left)`);
  assert.ok(food() < meals, 'it ate when hurt');
  assert.ok(g.autoBattle, 'auto battle is still on');
  // Its level band never skips a wave monster, even one far below you.
  g.skills.addXp('attack', 5e7);
  const mob = waveMobs(g)[0];
  mob.target = null;
  assert.ok(!g._autoIsWeak(mob), 'a wave monster is never "too weak" to fight');
  assert.equal(g._autoPickTarget()?.wave, true, 'it picks a wave monster');
});

test('auto battle dodges a wave boss\'s ground markers inside the arena', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.waves.wave = BOSS_EVERY - 1;
  nextWave(g);
  const boss = waveMobs(g).find((n) => n.def.boss);
  tame(g);
  g.toggleAutoBattle(true);
  const at = g.playerTile();
  g.hazards.push({ cx: at.x, cy: at.y, r: 1, npc: boss, fireTick: g.tickCount + 5 });
  assert.ok(g.hazardAt(at.x, at.y));
  g._autoBattleTick();
  assert.ok(g._dodging, 'auto battle steps out of the marker');
  g.autoCfg.dodge = false;
  g._dodging = false;
  g._autoBattleTick();
  assert.ok(!g._dodging, 'not with auto dodge off');
});

test('the arena is sealed: world NPCs never enter, and nothing walks between it and the world', () => {
  const g = newGame();
  // Nothing in the world spawns there, and there is no road in or out.
  assert.ok(!g.npcs.some((n) => inArena(n.spawnX, n.spawnY)));
  assert.equal(findPath(g.pathCfg(), START, g.world.spawnPoint, { maxNodes: 20000 }).length, 0, 'no way out on foot');
  assert.equal(findPath(g.pathCfg(), g.world.spawnPoint, START, { maxNodes: 200000 }).length, 0, 'no way in on foot');
  // Something chasing you loses you at the gate.
  const foe = g.npcs.find((n) => n.attackable && !n.def.boss && n.alive);
  placeAt(g, GATE.x - 1, GATE.y + 1);
  foe.target = g.player;
  g.waves.enter();
  assert.equal(foe.target, null);
  nextWave(g);
  tame(g);
  for (let t = 0; t < 60; t++) { step(g, 1); tame(g); }
  const intruders = g.npcs.filter((n) => inArena(n.x, n.y) && !n.wave && !n.ally && !n.temporary);
  assert.deepEqual(intruders.map((n) => n.name), [], 'only wave monsters are inside');
  assert.ok(waveMobs(g).every((n) => inArena(n.x, n.y)), 'wave monsters never leave');
  // The world map still shows just the country, not the sea the arena sits in.
  assert.equal(g.world.mapHeight, 380);
});

// ---------------- A champion or boss in every wave, and tougher monsters ----------------

test('every wave is led by a champion or a boss, and bosses come every 5th wave', () => {
  assert.equal(BOSS_EVERY, 5);
  for (const base of [1, 10, 60, 150, 1000]) {
    for (let n = 1; n <= 45; n++) {
      const plan = wavePlan(n, base);
      const bosses = plan.filter((e) => e.def.boss), champs = plan.filter((e) => e.champion);
      assert.ok(bosses.length + champs.length >= 1, `wave ${n} (base ${base}) has a champion or boss`);
      assert.ok(plan[0].def.boss || plan[0].champion, 'the leader comes first, so MAX_ALIVE never holds it back');
      if (n % BOSS_EVERY === 0) {
        assert.equal(bosses.length, 1, `wave ${n} is a boss wave`);
        assert.equal(bosses[0].def.level, waveLevel(n, base), 'its boss is scaled to the wave');
        assert.ok(ALL_BOSS_IDS.includes(bosses[0].id) && !getNpc(bosses[0].id).fixed, 'a real, non-story boss');
      } else {
        assert.equal(bosses.length, 0, `wave ${n} has no boss`);
        assert.equal(champs.length, n >= SECOND_CHAMPION_FROM ? 2 : 1);
      }
      assert.match(waveLeader(plan), plan[0].def.boss ? new RegExp(plan[0].def.name) : /^Champion /);
    }
  }
});

test('gate monsters are tougher than the same monster at the same level outside, by a pinned factor', () => {
  // Pinned so a change to them is a choice: life x1.5, max hit x1.8, attack x1.3.
  assert.deepEqual([GATE_HP, GATE_HIT, GATE_ACC], [1.5, 1.8, 1.3]);
  const near = (a, b) => Math.abs(a - b) <= 1;
  let checked = 0;
  for (const id of ALL_MONSTER_IDS) {
    const d = getNpc(id);
    if (!d.attackable || d.boss || !(d.level > 0) || d.maxHit < 5) continue;
    // Wave 1 at the monster's own level is the monster as it is in the world...
    const g = gateMobDef(id, 1, d.level);
    assert.ok(near(g.maxHp, d.maxHp * GATE_HP), `${id}: life x${GATE_HP}`);
    assert.ok(near(g.maxHit, d.maxHit * GATE_HIT), `${id}: max hit x${GATE_HIT}`);
    assert.ok(near(g.attack, d.attack * GATE_ACC), `${id}: attack x${GATE_ACC}`);
    assert.equal(g.level, d.level);
    if (++checked >= 40) break;
  }
  assert.ok(checked >= 20);
  // ...and world events, which borrow waveMobDef at wave 1, are left as they were.
  const d = getNpc(waveKinds(1, 50)[0]);
  assert.equal(waveMobDef(waveKinds(1, 50)[0], 1, d.level).maxHp, d.maxHp);
  // Later waves pile more on top, faster than before (+6% life and +3% hits a wave, steepening).
  const id = waveKinds(1, 50)[0], a = gateMobDef(id, 1, 50), b = gateMobDef(id, 11, 50);
  assert.ok(b.maxHp / a.maxHp > 1.85 && b.maxHit / a.maxHit > 1.4, 'wave 11 at the same level: ~x1.9 life, ~x1.45 hits');
});

test('a gate champion has a fifth of a world champion\'s life; a gate boss is WAVE_BOSS_LIFE gate monsters', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.waves.wave = 2;
  nextWave(g);
  const champ = waveMobs(g).find((n) => n.champion);
  const plain = waveMobs(g).find((n) => !n.champion && n.npcId === champ.npcId);
  assert.ok(champ && plain);
  // x6 a gate monster; the wave's ordinary monsters have HORDE_LIFE of that
  // now (waves are twice the size), so x10 the ones beside it.
  assert.ok(Math.abs(champ.maxHp / plain.maxHp - CHAMPION_HP_MULT * GATE_CHAMPION_LIFE / HORDE_LIFE) < 0.1, 'x10 a horde monster');
  assert.equal(champ.hp, champ.maxHp);
  assert.ok(champ.def.maxHit > plain.def.maxHit && /^Champion /.test(champ.name), 'still a champion: harder hits and the label');
  // The boss's life is set by the wave, not by its own: two bosses at one wave last as long.
  const L = 120, mob = gateMobDef(waveKinds(15, L)[0], 15, L), real = (d) => d.maxHp * (d.hpScale || 1);
  const bosses = ALL_BOSS_IDS.filter((id) => getNpc(id).attackable && !getNpc(id).fixed).slice(0, 4);
  for (const id of bosses) {
    const b = waveBossDef(id, 15, L, mob);
    assert.ok(Math.abs(real(b) / real(mob) - WAVE_BOSS_LIFE) < 0.05, `${id}: ${WAVE_BOSS_LIFE} gate monsters' life`);
    assert.ok(b.boss && b.wave && b.level === L);
  }
});

test('milestone chests every 10th wave pay more than a plain boss chest', () => {
  assert.equal(MILESTONE_EVERY, 10);
  const get = (n, id) => bossChest(n, 100).find((e) => e[0] === id)[1];
  assert.equal(get(5, 'upgrade_ward'), 1);
  assert.equal(get(10, 'upgrade_ward'), 2, 'a milestone adds a ward');
  assert.ok(get(10, 'coins') > get(5, 'coins') * 2, 'and half as much again on a bigger purse');
});

test('a boss wave\'s boss, champions and markers are cleaned up on leaving, when the shrine falls and when cleared', () => {
  // (Death no longer ends a run: the shrine falling does, see below.)
  for (const how of ['leave', 'fall', 'clear']) {
    const g = newGame();
    placeAt(g, GATE.x - 1, GATE.y + 1);
    g.waves.enter();
    g.waves.wave = BOSS_EVERY - 1;
    nextWave(g);
    tame(g);
    const boss = waveMobs(g).find((n) => n.def.boss);
    assert.ok(boss && inArena(boss.x, boss.y), 'the boss spawns inside the arena');
    // A boss summon and a ground marker, as a real fight leaves them.
    const sum = g.npcs.find((n) => n.wave && !n.def.boss);
    g.npcs.push(Object.assign(Object.create(Object.getPrototypeOf(sum)), sum, { wave: false, temporary: true, entityId: -1 }));
    g.hazards.push({ cx: boss.x, cy: boss.y, r: 1, npc: boss, fireTick: g.tickCount + 9 });
    if (how === 'leave') g.waves.leave();
    else if (how === 'fall') { g.waves.shrine.hp = 1; g.waves.hitShrine(boss); }
    else { for (const n of waveMobs(g)) g.killNpc(n); step(g, 1); }
    assert.equal(waveMobs(g).length, 0, `${how}: no wave monster is left`);
    assert.ok(!g.npcs.some((n) => n.alive && n.temporary && !n.ally && inArena(n.x, n.y)), `${how}: no summon is left`);
    if (how !== 'clear') {
      assert.ok(!g.waves.active, `${how}: the run is over`);
      assert.ok(!g.hazards.some((h) => inArena(h.cx, h.cy)), `${how}: no boss marker is left`);
      assert.ok(!g.npcs.some((n) => n.wave), `${how}: nothing of the wave stays in the world`);
    } else assert.ok(g.waves.active && g.waves.nextAt > 0, 'clear: on to the next wave');
  }
});

test('auto battle clears a wave\'s escort first, then takes on its champion or boss', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.waves.wave = BOSS_EVERY - 1;
  nextWave(g);
  tame(g);
  const boss = waveMobs(g).find((n) => n.def.boss);
  // Everything comes for you in the gate: line them up next to you.
  const p = g.player;
  for (const [i, n] of waveMobs(g).entries()) { n.x = n.tx = p.x + 1; n.y = n.ty = p.y - 1 + i; n.target = p; }
  boss.x = boss.tx = p.x - 1; boss.y = boss.ty = p.y;
  const first = g._autoPickTarget();
  assert.ok(first && first.wave && !first.def.boss, 'an escort first');
  // A boss in the middle of a mechanic is dealt with at once.
  boss.mech = { type: 'cast', until: g.tickCount + 10 };
  assert.equal(g._autoPickTarget(), boss, 'a casting boss comes first');
  boss.mech = null;
  // With the escort down, the boss.
  for (const n of waveMobs(g)) if (n !== boss) g.killNpc(n);
  assert.equal(g._autoPickTarget(), boss, 'then the boss');
  // And it really fights a wave through, champion and all.
  g.waves.wave = 1;
  for (const n of waveMobs(g)) g.killNpc(n);
  step(g, 1);
  nextWave(g);
  assert.equal(g.waves.wave, 2);
  for (const n of waveMobs(g)) { n.hp = Math.min(n.hp, 3); n.maxHp = Math.max(n.maxHp, 3); }
  tame(g);
  g.toggleAutoBattle(true);
  for (let t = 0; t < 400 && g.waves.wave < 3; t++) { step(g, 1); tame(g); }
  assert.ok(g.waves.wave >= 3, `auto battle cleared wave 2, champion included (${g.waves.left()} left)`);
});

test('dodging in the gate pays Agility XP that grows with the wave, up to a cap', () => {
  assert.equal(gateDodgeMult(0), 1);
  for (let n = 1; n <= 30; n++) assert.ok(gateDodgeMult(n) >= gateDodgeMult(n - 1), `never less at wave ${n}`);
  assert.ok(gateDodgeMult(5) < gateDodgeMult(10) && gateDodgeMult(10) < gateDodgeMult(15), 'rises through the early waves');
  assert.equal(gateDodgeMult(20), GATE_DODGE_MAX);
  assert.equal(gateDodgeMult(1000), GATE_DODGE_MAX, 'capped, so deep waves cannot run away');

  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  nextWave(g);
  const mob = waveMobs(g)[0];
  assert.ok(mob, 'a wave monster to dodge');
  // The XP one marker dodge pays, from the same Agility XP each time.
  const xp0 = g.skills.xp.agility;
  const dodge = (npc) => { g.skills.xp.agility = xp0; g._dodgeXp(npc, HAZARD_DODGE_MULT); const d = g.skills.xp.agility - xp0; g.skills.xp.agility = xp0; return d; };
  g.waves.wave = 5; const at5 = dodge(mob);
  g.waves.wave = 15; const at15 = dodge(mob);
  g.waves.wave = 40; const at40 = dodge(mob);
  g.waves.wave = 80; const at80 = dodge(mob);
  assert.ok(at5 > 0);
  assert.ok(Math.abs(at15 / at5 - gateDodgeMult(15) / gateDodgeMult(5)) < 1e-6, `wave 15 pays ${at15}, wave 5 ${at5}`);
  assert.ok(Math.abs(at80 - at40) < 1e-6, 'past the cap the wave adds nothing more');
  // A wave monster's dodge pays the wave's share; the same monster outside a run
  // (or a world event's borrowed wave monster, which isn't one) pays as before.
  assert.equal(g.waves.dodgeXpMult(mob), gateDodgeMult(80));
  assert.equal(g.waves.dodgeXpMult({ def: mob.def }), 1, 'not one of the run\'s monsters');
  g.waves.leave();
  assert.equal(g.waves.dodgeXpMult(mob), 1, 'no run, no gate bonus');
});

const npcMax = (g, npc) => npcAttackVsPlayer(npc.def, g.skills, g.equipment, g.player.style).max;

test('outside the gate a dodge pays exactly what it always did', () => {
  const g = newGame();
  const p = g.player;
  const boss = g.spawnNpc('sand_scorpion_king', p.x + 60, p.y, { wander: 0 });
  const mob = g.npcs.find((n) => n.alive && n.def.attackable && !n.def.boss && n.def.maxHit > 0);
  const xp0 = g.skills.xp.agility;
  for (const [npc, mult] of [[boss, HAZARD_DODGE_MULT], [mob, 1]]) {
    g.skills.xp.agility = xp0;
    g._dodgeXp(npc, mult);
    const got = g.skills.xp.agility - xp0;
    // The formula before the gate bonus, through the same addXp.
    g.skills.xp.agility = xp0;
    g.skills.addXp('agility', Math.max(Math.max(1, npcMax(g, npc)) * DODGE_AGILITY_XP,
      (npc.maxHp || npc.def.hp || 1) * 3 * (npc.def.boss ? DODGE_BOSS_SHARE : DODGE_KILL_SHARE)) * mult * g.combatXpMult());
    assert.ok(got > 0 && Math.abs(got - (g.skills.xp.agility - xp0)) < 1e-6, `${npc.def.id}: ${got}`);
  }
});

test('a dodge shows the Agility XP it paid beside "Dodged!", when it is a point or more', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  nextWave(g);
  const mob = waveMobs(g)[0];
  g.waves.wave = 20;
  const label = () => g.effects.filter((e) => e.type === 'hitsplat' && e.entity === g.player && /Agility$/.test(e.text || ''));
  g.effects = [];
  const xp0 = g.skills.xp.agility;
  g._dodgeXp(mob, HAZARD_DODGE_MULT);
  const got = g.skills.xp.agility - xp0;
  assert.ok(got >= 1, `a wave 20 marker dodge pays ${got}`);
  assert.deepEqual(label().map((e) => e.text), [`+${damageNumber(got)} Agility`]);
  // A gain under a point shows nothing (the XP drop HUD still counts it).
  g.effects = [];
  const real = g.skills.addXp.bind(g.skills);
  g.skills.addXp = (id, amt) => real(id, 0.2 / 20);   // well under a point after the XP rate
  g._dodgeXp(mob);
  g.skills.addXp = real;
  assert.equal(label().length, 0);
});

test('with endless waves, a dodge deep in the gate pays no more than one at wave 20', () => {
  // Dodge XP grows with the monster's life and hits; uncapped, a wave 500
  // dodge paid tens of millions. Past DODGE_CAP_WAVE it is held to what a
  // monster of the same rank there pays (waves.dodgeRef).
  assert.equal(DODGE_CAP_WAVE, 20);
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  const xp0 = g.skills.xp.agility;
  const pay = (n, rank) => {
    g.waves.wave = n;
    const plan = wavePlan(n, g.fightLevel());
    const e = rank === 'boss' ? plan.find((x) => x.def.boss) : plan.find((x) => !x.def.boss && !x.champion);
    const npc = { def: e.def, maxHp: e.def.maxHp, wave: true };
    g.skills.xp.agility = xp0; g._dodgeXp(npc, rank === 'boss' ? HAZARD_DODGE_MULT : 1);
    const got = g.skills.xp.agility - xp0; g.skills.xp.agility = xp0;
    return got;
  };
  const mob20 = pay(20, 'mob'), boss20 = pay(20, 'boss');
  assert.ok(pay(10, 'mob') < mob20, 'still grows up to wave 20');
  for (const n of [30, 50, 100, 200, 500]) {
    assert.ok(Math.abs(pay(n, 'mob') - mob20) < 1e-6 * mob20, `wave ${n}: a monster's dodge pays wave 20's`);
    if (n % BOSS_EVERY === 0) assert.ok(Math.abs(pay(n, 'boss') - boss20) < 1e-6 * boss20, `wave ${n}: a boss marker pays wave 20's`);
  }
  assert.equal(g.waves.dodgeRef({ def: {}, wave: true }) !== null, true);
  g.waves.wave = 20;
  assert.equal(g.waves.dodgeRef({ def: {}, wave: true }), null, 'no cap up to wave 20');
});

// ---------------- The A-Worthy Shrine: tower defence ----------------

test('the A-Worthy Shrine stands in the middle of the hall, wearing the monument\'s picture', async () => {
  const g = newGame();
  const s = g.world.objects.find((o) => o.objId === 'gate_shrine');
  assert.ok(s && s.x === SHRINE.x && s.y === SHRINE.y && inArena(s.x, s.y), 'in the arena');
  assert.ok(g.world.isBlocked(s.x, s.y), 'solid');
  assert.equal(s.def.art, 'obj-shrine', 'borrows the A-Worthy Monument art');
  assert.notEqual(s.def.type, 'shrine', 'not a place to pray (that would heal you mid-wave)');
  const { worldArt } = await import('../src/render/sprites.js');
  assert.ok(worldArt().has(s.def.art));
  // Every spawn point is on the floor, along an edge, and away from the shrine.
  for (const sp of SPAWN_POINTS) {
    assert.ok(sp.x >= ARENA.x0 && sp.x <= ARENA.x1 && sp.y >= ARENA.y0 && sp.y <= ARENA.y1 && !g.world.isBlocked(sp.x, sp.y));
    assert.ok(sp.x === ARENA.x0 || sp.x === ARENA.x1 || sp.y === ARENA.y1, 'on an edge');
    assert.ok(Math.max(Math.abs(sp.x - SHRINE.x), Math.abs(sp.y - SHRINE.y)) >= 6);
  }
});

test('monsters come from the edges, go for the shrine, turn on you when hit, and go back when you walk off', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  // Out of their way in a corner by the way in.
  placeAt(g, ARENA.x0 + 2, ARENA.y0);
  nextWave(g);
  const mobs = waveMobs(g);
  assert.equal(mobs.length, waveCount(1) + 1);
  const near = (n) => SPAWN_POINTS.some((sp) => Math.max(Math.abs(n.x - sp.x), Math.abs(n.y - sp.y)) <= 2);
  assert.ok(mobs.every(near), 'every monster came in by a spawn point');
  assert.ok(new Set(mobs.map((n) => SPAWN_POINTS.findIndex((sp) => Math.max(Math.abs(n.x - sp.x), Math.abs(n.y - sp.y)) <= 2))).size >= 3, 'from several sides');
  tame(g);
  for (const n of waveMobs(g)) n.attackCooldown = 0;   // (tame holds them off the shrine too)
  let hitAt = -1;
  for (let t = 0; t < 60 && hitAt < 0; t++) {
    step(g, 1);
    for (const n of waveMobs(g)) n.def = { ...n.def, maxHit: 0 };
    if (g.waves.shrine.hp < SHRINE_LIFE) hitAt = t;
  }
  assert.ok(hitAt >= 0, 'the shrine is struck');
  const at = waveMobs(g).filter((n) => g.waves.besieging(n));
  assert.ok(at.length >= 1, 'monsters stand at the shrine striking it');
  assert.ok(waveMobs(g).every((n) => n.target !== g.player), 'none came for you, standing well off');
  // Hit one: it turns on you...
  const m = at[0];
  placeAt(g, m.x + (m.x <= SHRINE.x ? -1 : 1), m.y);
  g.attackNpc(m);
  step(g, 2);
  assert.equal(m.target, g.player, 'struck, it turns on you');
  assert.ok(!g.waves.besieging(m));
  // ...walk off out of its reach, and once it has gone a while unhit it goes back.
  g.player.clearAction();
  m.stepMul = 99;   // slow it right down so it can't keep up
  placeAt(g, ARENA.x0 + 1, ARENA.y0);
  step(g, 16);
  assert.equal(m.target, null, `it gave up on you (${GATE_FORGET} tiles off)`);
  // Chip damage grows with the wave and with who is striking.
  assert.ok(shrineChip(1, 'boss') > shrineChip(1, 'champion') && shrineChip(1, 'champion') > shrineChip(1, 'mob'));
  assert.ok(shrineChip(40, 'mob') > shrineChip(1, 'mob'));
});

test('clearing a wave mends the shrine a little', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  nextWave(g);
  g.waves.shrine.hp = 500;
  for (const n of waveMobs(g)) g.killNpc(n);
  step(g, 1);
  assert.equal(g.waves.shrine.hp, 500 + SHRINE_LIFE * SHRINE_MEND);
  assert.equal(g.waves.shrinePct(), 60);
});

test('the shrine falling ends the run: a summary, the best wave saved, and you are put back outside', () => {
  const storage = fakeStorage();
  const g = newGame(storage);
  let summary = null;
  g.bus.on('gateFallen', (s) => { summary = s; });
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  nextWave(g);
  for (const n of waveMobs(g)) g.killNpc(n);
  step(g, 1);
  nextWave(g);
  assert.equal(g.waves.wave, 2);
  const mob = waveMobs(g).find((n) => !n.champion);
  g.waves.shrine.hp = 3;
  g.waves.hitShrine(mob);   // lethal: a blow on wave 2 chips 4
  assert.ok(!g.waves.active, 'the run is over');
  assert.ok(summary, 'the summary went out');
  assert.equal(summary.wave, 2);
  assert.equal(summary.cleared, 1);
  assert.ok(summary.kills >= waveCount(1) + 1, 'counts what you beat');
  assert.ok(summary.got.some(([id, q]) => id === 'coins' && q > 0), 'and what it paid');
  assert.equal(g.waves.lastRun, summary);
  assert.deepEqual({ x: g.player.x, y: g.player.y }, { x: GATE.x - 1, y: GATE.y + 1 }, 'back where you came in');
  assert.ok(!g.npcs.some((n) => n.wave), 'its monsters are gone');
  assert.equal(g.waves.best, 2);
  assert.notEqual(saveGame(g), false);
  const h = new Game();
  h.start();
  assert.equal(h.waves.best, 2, 'the best wave is saved');
  assert.equal(h.waves.classBest(g.jobClass), 2);
  assert.ok(!h.waves.active && h.waves.shrine.hp === SHRINE_LIFE, 'no run (nor a broken shrine) comes back from a save');
  // Fallen while you were down: you wake outside.
  const k = newGame();
  placeAt(k, GATE.x - 1, GATE.y + 1);
  k.waves.enter();
  nextWave(k);
  k.player.hp = 0;
  k.playerDeath();
  k.waves.shrine.hp = 1;
  k.waves.hitShrine(waveMobs(k)[0]);
  step(k, GATE_RESPAWN_TICKS + 1);
  assert.ok(k.player.alive && !inArena(k.player.x, k.player.y), 'woke outside');
});

test('waves go on past 25, with no cap', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.waves.wave = 24;
  for (let w = 25; w <= 27; w++) {
    nextWave(g);
    assert.equal(g.waves.wave, w, `wave ${w} begins`);
    assert.ok(waveMobs(g).length > 0);
    tame(g); spare(g);
    // Clear it all, the queue too (they come in one a tick).
    for (let t = 0; t < 200 && (waveMobs(g).length || g.waves.queue.length); t++) { for (const n of waveMobs(g)) g.killNpc(n); step(g, 1); }
    assert.ok(g.waves.active && g.waves.nextAt > 0, `wave ${w} cleared, the next is coming`);
  }
  assert.ok(g.waves.best >= 27);
  // And the plans go on for ever.
  for (const n of [26, 60, 120, 300]) assert.ok(wavePlan(n, 80).length > 3, `wave ${n} has a plan`);
});

test('waves are about twice the size, with up to three champions, and still the leader first', () => {
  // waveCount was 3 + n/2 (3 at wave 1, 8 at wave 10, 13 at 20, cap 30); it is
  // now 5 + n (6, 15, 25), up to MAX_WAVE_COUNT.
  assert.equal(waveCount(1), 6);
  assert.equal(waveCount(10), 15);
  assert.equal(waveCount(20), 25);
  assert.equal(waveCount(1000), MAX_WAVE_COUNT);
  for (const n of [21, 49, 51, 99]) assert.equal(wavePlan(n, 60).filter((e) => e.champion).length, n >= THIRD_CHAMPION_FROM ? 3 : 2);
  const boss = wavePlan(30, 60);
  assert.ok(boss[0].def.boss && boss.length - 1 >= 4, 'a boss brings a bigger escort than the 2 it had');
  // Ordinary monsters have HORDE_LIFE of a gate monster's life; leaders keep theirs.
  const p = wavePlan(12, 60), plain = p.find((e) => !e.champion), g0 = gateMobDef(plain.id, 12, plain.def.level);
  assert.equal(plain.def.maxHp, Math.max(1, Math.round(g0.maxHp * HORDE_LIFE)));
  assert.equal(p[0].def.maxHp, gateMobDef(p[0].id, 12, p[0].def.level).maxHp);
});

test('a whole wave comes at once, even the biggest (the owner\'s ask)', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.waves.wave = 80;
  nextWave(g);
  assert.equal(g.waves.wave, 81);
  assert.ok(waveCount(81) + 3 <= MAX_ALIVE, 'room for the biggest wave');
  assert.equal(g.waves.queue.length, 0, 'none held back');
  const out = waveMobs(g).length;
  assert.ok(out >= waveCount(81), `all ${waveCount(81)}+ out at once (saw ${out})`);
  // ...each on its own tile inside the hall.
  const tiles = new Set(waveMobs(g).map((n) => n.x * 4096 + n.y));
  assert.equal(tiles.size, out);
  for (const n of waveMobs(g)) assert.ok(inArena(n.x, n.y));
  let seen = 0;
  for (let t = 0; t < 400 && (waveMobs(g).length || g.waves.queue.length); t++) {
    tame(g); spare(g);
    for (const n of waveMobs(g).slice(0, 4)) { g.killNpc(n); seen++; }
    step(g, 1);
  }
  assert.equal(seen, out, 'every one of them fell');
  assert.ok(g.waves.nextAt > 0, 'and the wave was cleared');
});

test('auto battle goes for the monsters striking the shrine first, leaders first', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.waves.wave = 2;
  nextWave(g);
  tame(g); spare(g);
  const p = g.player;
  placeAt(g, SHRINE.x, SHRINE.y - 4);
  const mobs = waveMobs(g), champ = mobs.find((n) => n.champion), plain = mobs.filter((n) => !n.champion);
  // Two plain ones on you, right beside you...
  for (const [i, n] of plain.slice(0, 2).entries()) { n.x = n.tx = p.x - 1 + 2 * i; n.y = n.ty = p.y; n.target = p; }
  // ...a third at the shrine, and the rest out of the way at the far end.
  const at = plain[2];
  at.x = at.tx = SHRINE.x + 1; at.y = at.ty = SHRINE.y + 1; at.target = null;
  for (const n of [...plain.slice(3), champ]) { n.x = n.tx = ARENA.x0 + 1 + (n.entityId % 5); n.y = n.ty = ARENA.y1; n.target = null; }
  regrid(g);
  assert.ok(g.waves.besieging(at));
  assert.equal(g._autoPickTarget(), at, 'the one at the shrine, past the two on you');
  // A champion at the shrine comes before a plain monster there.
  champ.x = champ.tx = SHRINE.x - 1; champ.y = champ.ty = SHRINE.y + 1;
  regrid(g);
  assert.equal(g._autoPickTarget(), champ, 'the champion at the shrine first');
  // Among plain ones away from the shrine, nearer the shrine first (all else equal).
  champ.x = champ.tx = ARENA.x0; champ.y = champ.ty = ARENA.y1;
  at.x = at.tx = ARENA.x1; at.y = at.ty = ARENA.y1;
  for (const n of plain.slice(0, 2)) { n.target = null; }
  plain[0].x = plain[0].tx = SHRINE.x - 2; plain[0].y = plain[0].ty = SHRINE.y - 6;   // 2 from you, 6 from the shrine
  plain[1].x = plain[1].tx = SHRINE.x + 2; plain[1].y = plain[1].ty = SHRINE.y - 2;   // 2 from you, 2 from the shrine
  regrid(g);
  assert.equal(g._autoPickTarget(), plain[1], 'the one nearer the shrine');
});

test('every scaling stays finite and sane at waves 50, 100, 200 and 500', () => {
  const ok = (v, what) => assert.ok(Number.isFinite(v) && v >= 0 && v < 1e15, `${what}: ${v}`);
  for (const base of [1, 60, 150, 4000]) {
    let prev = 0;
    for (const n of [50, 100, 101, 200, 500]) {
      const plan = wavePlan(n, base);
      assert.ok(plan.length <= 3 + MAX_WAVE_COUNT && plan.length >= 2);
      for (const e of plan) for (const k of ['level', 'maxHp', 'maxHit', 'attack', 'strength', 'defence']) ok(e.def[k], `wave ${n} base ${base} ${e.id}.${k}`);
      for (const e of plan) for (const x of killXp('attack', e.def.maxHp)) ok(x.xp, `wave ${n} kill XP`);
      for (const [id, q] of [...waveBonus(n, plan[0].def.level), ...bossChest(n, plan[0].def.level)]) {
        ok(q, `wave ${n} ${id}`);
        assert.ok(Number.isInteger(q), `${id} is a whole number`);
        if (id === 'coins') assert.ok(q <= COIN_CAP);
        else assert.ok(q <= 400, `${id} x${q} at wave ${n}: rewards stop growing past REWARD_WAVE_CAP`);
      }
      ok(shrineChip(n, 'boss'), 'shrine chip');
      assert.ok(shrineChip(n, 'boss') <= SHRINE_LIFE / 5, 'even a deep boss takes a few blows to break the shrine');
      assert.ok(plan[0].def.level > prev, 'still climbing');
      prev = plan[0].def.level;
    }
  }
  // Below the knee the curves are as they were; past it they climb in a straight line.
  assert.equal(waveCurve(50), 0.7 + 0.03 * 49 + 0.0025 * 49 ** 2);
  assert.equal(waveMight(50).hp, 1 + 0.06 * 49 + 0.003 * 49 ** 2);
  const d1 = waveCurve(301) - waveCurve(300), d2 = waveCurve(501) - waveCurve(500);
  assert.ok(Math.abs(d1 - d2) < 1e-9, 'linear past the knee');
  assert.ok(GATE_LOOT.length > 0);
});
