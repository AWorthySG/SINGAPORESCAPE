// The Endless Gate (src/game/waves.js): a sealed arena where monsters come in
// endless, ever-stronger waves. Headless, deterministic game scenarios.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, clearSave } from '../src/game/save.js';
import { findPath } from '../src/engine/pathfinding.js';
import { ARENA, GATE, START, NEXT_WAVE_TICKS, MAX_ALIVE, BOSS_EVERY, inArena, wavePlan, waveCount, waveLevel } from '../src/game/waves.js';
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
  assert.equal(mobs.length, waveCount(1));
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
  assert.equal(waveMobs(g).length, waveCount(2));
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
  assert.ok(waveCount(30) > MAX_ALIVE, 'deep waves send more than can be out at once');
});

test('every 5th wave adds a champion and every 10th is a boss wave with its signature moves', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  g.waves.wave = 4;
  nextWave(g);
  assert.equal(g.waves.wave, 5);
  assert.equal(waveMobs(g).filter((n) => n.champion).length, 1, 'wave 5 has a champion');
  for (const n of waveMobs(g)) g.killNpc(n);
  g.waves.wave = BOSS_EVERY - 1;
  step(g, 1);
  nextWave(g);
  assert.equal(g.waves.wave, 10);
  const boss = waveMobs(g).find((n) => n.def.boss);
  assert.ok(boss, 'wave 10 has a boss');
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

test('death inside keeps every item and puts you back outside the gate', () => {
  const g = newGame();
  g.inventory.add('trout', 5);
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  nextWave(g);
  for (const n of waveMobs(g).slice(0, 2)) g.killNpc(n);
  step(g, 3);   // the kill drops fly in
  const before = JSON.stringify(g.inventory.serialize()), equip = JSON.stringify(g.equipment.serialize());
  g.player.hp = 0;
  g.playerDeath();
  assert.ok(!g.waves.active, 'the run ends');
  assert.equal(waveMobs(g).length, 0, 'its monsters are gone');
  step(g, RESPAWN_TICKS + 1);
  assert.ok(g.player.alive);
  assert.deepEqual({ x: g.player.x, y: g.player.y }, { x: GATE.x - 1, y: GATE.y + 1 }, 'you wake outside the gate');
  assert.equal(JSON.stringify(g.inventory.serialize()), before, 'nothing is lost');
  assert.equal(JSON.stringify(g.equipment.serialize()), equip, 'gear kept');
  assert.equal(g.player.hp, g.maxHp());
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
