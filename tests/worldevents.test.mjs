// Roaming world events and weekly region challenges (src/game/worldevents.js).
// Headless, deterministic game scenarios: events are started by hand or by
// running the scheduler's ticks, and every one must leave nothing behind.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave } from '../src/game/save.js';
import { chebyshev } from '../src/core/utils.js';
import { TERRAIN } from '../src/data/world.js';
import { EVENT_IDS, EVENT_GAP, FIRST_GAP, GATHER_GOAL, WEEKLY_TASKS, isoWeekKey, eventReward, weeklyCrate } from '../src/data/worldevents.js';

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
/** Everything an event has put into the world. */
const leftovers = (g) => ({
  npcs: g.npcs.filter((n) => n.worldEvent).length,
  objs: g.world.objects.filter((o) => o.worldEvent || o.def.worldEvent).length,
});
const noneLeft = (g, what) => assert.deepEqual(leftovers(g), { npcs: 0, objs: 0 }, `${what}: nothing left behind`);
/** Give a hero the gear and levels to take part in anything. */
function equip(g) {
  // No wild monster spoils a gathering test.
  g.npcs = g.npcs.filter((n) => !n.def.aggressive || n.worldEvent);
  for (const id of ['bronze_pickaxe', 'bronze_axe', 'small_net']) if (!g.hasTool({ bronze_pickaxe: 'pickaxe', bronze_axe: 'axe', small_net: 'net' }[id])) g.inventory.add(id, 1);
}
/** A kill by the player, the way combat does it. */
const kill = (g, n) => { n.hp = 0; g.killNpc(n); };

test('the scheduler waits for its gap, then starts an event; none start on their own headless', () => {
  const g = newGame();
  assert.equal(g.worldEvents.auto, false, 'headless games never start events by themselves');
  step(g, 1);
  const due = g.worldEvents.nextAt - g.tickCount;
  assert.ok(due >= FIRST_GAP[0] - 1 && due <= FIRST_GAP[1], `first event due in ${due} ticks`);
  g.worldEvents.auto = true;
  g.worldEvents.nextAt = g.tickCount + 5;
  step(g, 3);
  assert.equal(g.worldEvents.active, null, 'not yet');
  step(g, 4);
  assert.ok(g.worldEvents.active, 'an event started when due');
  assert.ok(EVENT_IDS.includes(g.worldEvents.active.kind));
  g.worldEvents.end(false);
  const gap = g.worldEvents.nextAt - g.tickCount;
  assert.ok(gap >= EVENT_GAP[0] && gap <= EVENT_GAP[1], 'the next one is 20-30 minutes off');
  noneLeft(g, 'ended');
});

test('an invasion storms a town; defeating enough invaders wins and pays out', () => {
  const g = newGame();
  const ev = g.worldEvents.start('invasion', { town: 'Kampong Glam' });
  assert.ok(ev, 'started');
  assert.equal(ev.place, 'Kampong Glam');
  assert.ok(ev.mobs.length > 0 && ev.mobs.length <= 6, 'a first wave of invaders, a few at a time');
  for (const n of ev.mobs) assert.ok(n.def.aggressive && n.temporary && n.worldEvent && !n.wave);
  const coins = g.inventory.count('coins');
  for (let guard = 0; guard < 60 && g.worldEvents.active; guard++) {
    for (const n of [...g.worldEvents.active.mobs]) if (n.alive) kill(g, n);
    step(g, 1);
  }
  assert.equal(g.worldEvents.active, null, 'the invasion is beaten');
  assert.equal(g.worldEvents.done, 1);
  assert.ok(g.inventory.count('coins') > coins, 'coins paid');
  assert.ok(g.inventory.count('upgrade_stone') >= 1, 'enhancement stones paid');
  noneLeft(g, 'invasion');
});

test('a rampaging champion is one tough monster; killing it ends the event well', () => {
  const g = newGame();
  const ev = g.worldEvents.start('rampage', { region: 'Bukit Timah' });
  assert.ok(ev);
  const [n] = ev.mobs;
  assert.ok(n.champion && /^Rampaging /.test(n.name), n.name);
  kill(g, n);
  step(g, 1);
  assert.equal(g.worldEvents.active, null);
  assert.equal(g.worldEvents.done, 1);
  noneLeft(g, 'rampage');
});

test('a fight event that runs out of time fails, pays nothing and cleans up', () => {
  const g = newGame();
  const ev = g.worldEvents.start('rampage', { region: 'Bukit Timah' });
  const coins = g.inventory.count('coins');
  ev.mobs[0].def = { ...ev.mobs[0].def, maxHit: 0, aggressive: false };
  step(g, ev.endTick - g.tickCount + 1);
  assert.equal(g.worldEvents.active, null, 'over');
  assert.equal(g.worldEvents.done, 0);
  assert.equal(g.inventory.count('coins'), coins);
  noneLeft(g, 'timed out');
});

test('a rare fish shoal sits by the shore, pays double XP and rewards the catch', () => {
  const g = newGame();
  equip(g);
  const ev = g.worldEvents.start('shoal', { region: 'Sentosa Beach' });
  assert.ok(ev, 'started');
  const spot = ev.objs[0];
  assert.equal(spot.def.type, 'fishing');
  assert.equal(g.world.terrainAt(spot.x, spot.y), 2, 'in the water');
  const base = g.worldEvents._shoalBase();
  assert.ok(spot.def.catches[spot.def.catches.length - 1].xp > 0);
  // Stand on the shore beside it and fish until the goal.
  const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: spot.x + dx, y: spot.y + dy })).find((t) => !g.world.isBlocked(t.x, t.y));
  placeAt(g, shore.x, shore.y);
  g.defaultObjectAction(spot);
  const xp0 = g.skills.xp.fishing;
  for (let i = 0; i < 300 && ev.gathers < GATHER_GOAL; i++) { if (!g.player.action) g.defaultObjectAction(spot); step(g, 1); }
  assert.ok(ev.gathers >= GATHER_GOAL, `fished ${ev.gathers} (${base})`);
  assert.ok(g.skills.xp.fishing > xp0);
  const got = g.worldEvents.end(true);
  assert.ok(got.some(([id]) => id === 'coins'));
  noneLeft(g, 'shoal');
  assert.equal(g.player.action, null, 'you stop fishing at the vanished shoal');
});

test('a meteor strike leaves a rich rock; swings use its charges and it crumbles away', () => {
  const g = newGame();
  equip(g);
  const ev = g.worldEvents.start('meteor', { region: 'Bukit Timah' });
  assert.ok(ev, 'started');
  const rock = ev.objs[0];
  assert.equal(rock.objId, 'fallen_star', 'drawn as a fallen star');
  assert.ok(rock.def.level <= g.skills.level('mining'), 'at a level you can mine');
  const dryGround = [TERRAIN.GRASS, TERRAIN.DARKGRASS, TERRAIN.SAND, TERRAIN.STONE];
  assert.ok(dryGround.includes(g.world.terrainAt(rock.x, rock.y)), 'no crater on a road or bridge');
  const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: rock.x + dx, y: rock.y + dy }))
    .filter(({ x, y }) => !g.world.isBlocked(x, y) && dryGround.includes(g.world.terrainAt(x, y)));
  assert.ok(sides.length >= 3, 'room to mine from several sides');
  const [near] = sides;
  placeAt(g, near.x, near.y);
  g.defaultObjectAction(rock);
  const ore = g.inventory.count(rock.def.gives);
  for (let i = 0; i < 400 && g.worldEvents.active; i++) step(g, 1);
  assert.equal(g.worldEvents.active, null, 'mined out');
  assert.ok(g.inventory.count(rock.def.gives) - ore >= 30, 'every charge gave ore (you keep swinging by yourself)');
  assert.equal(g.worldEvents.done, 1);
  noneLeft(g, 'meteor');
});

test('an ancient tree gives double XP and goes when the event ends', () => {
  const g = newGame();
  equip(g);
  const ev = g.worldEvents.start('grove', { region: 'Bukit Timah' });
  assert.ok(ev, 'started');
  const tree = ev.objs[0];
  assert.ok(/^Ancient /.test(tree.def.name));
  assert.equal(tree.def.depleteChance, 0);
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: tree.x + dx, y: tree.y + dy })).find((t) => !g.world.isBlocked(t.x, t.y));
  placeAt(g, near.x, near.y);
  for (let i = 0; i < 400 && ev.gathers < 5; i++) { if (!g.player.action) g.defaultObjectAction(tree); step(g, 1); }
  assert.ok(ev.gathers >= 5);
  step(g, ev.endTick - g.tickCount + 1);
  assert.equal(g.worldEvents.active, null, 'time is up');
  assert.equal(g.worldEvents.done, 1, 'taking part is enough for a gathering event');
  noneLeft(g, 'grove');
});

test('a lost merchant walks home while you stay near; ambushes stop him until beaten', () => {
  const g = newGame();
  const ev = g.worldEvents.start('escort', { region: 'MacRitchie Reservoir' });
  assert.ok(ev, 'started');
  const m = ev.npc;
  assert.ok(m && !m.attackable && m.worldEvent);
  const coins = g.inventory.count('coins');
  let ambushes = 0;
  for (let i = 0; i < 1200 && g.worldEvents.active; i++) {
    // Keep beside him (as a player escorting him would), and beat each ambush.
    if (g.worldEvents.active) placeAt(g, m.x, m.y);
    for (const n of g.worldEvents.active?.mobs || []) if (n !== m && n.alive) { ambushes++; kill(g, n); }
    step(g, 1);
  }
  assert.equal(g.worldEvents.active, null, 'he got home');
  assert.ok(ambushes >= 3, 'ambushed along the way');
  assert.equal(g.worldEvents.done, 1);
  assert.ok(g.inventory.count('coins') > coins);
  noneLeft(g, 'escort');
});

test('the merchant waits when you are far away, and can be overwhelmed', () => {
  const g = newGame();
  const ev = g.worldEvents.start('escort', { region: 'MacRitchie Reservoir' });
  const m = ev.npc;
  placeAt(g, 56, 53);   // Kampong Glam, far off
  const at = { x: m.x, y: m.y };
  step(g, 10);
  assert.deepEqual({ x: m.x, y: m.y }, at, 'he waits for you');
  m.escortHp = 0;
  step(g, 1);
  assert.equal(g.worldEvents.active, null, 'failed');
  assert.equal(g.worldEvents.done, 0);
  noneLeft(g, 'failed escort');
});

test('dying calls the event off and packs it away', () => {
  const g = newGame();
  g.worldEvents.start('invasion', { town: 'Kampong Glam' });
  g.player.hp = 0;
  g.playerDeath();
  assert.equal(g.worldEvents.active, null);
  noneLeft(g, 'death');
});

test('save and load: no event survives, but the schedule and the week do', () => {
  const store = fakeStorage();
  const g = newGame(store);
  step(g, 1);
  g.worldEvents.ensureWeek(isoWeekKey());
  g.worldEvents.weekly.kills = 12;
  g.worldEvents.done = 3;
  g.worldEvents.nextAt = g.tickCount + 500;
  g.worldEvents.start('invasion', { town: 'Kampong Glam' });
  assert.ok(saveGame(g));
  const h = new Game();
  h.start();
  h.ui = new Proxy({}, { get: () => () => {} });
  assert.ok(loadGame(h));
  assert.equal(h.worldEvents.active, null);
  noneLeft(h, 'loaded');
  assert.equal(h.worldEvents.done, 3);
  assert.equal(h.worldEvents.weekly.week, isoWeekKey());
  assert.equal(h.worldEvents.weekly.kills, 12);
  assert.equal(h.worldEvents.weekly.region, g.worldEvents.weekly.region);
  // Loading into a game with an event running clears it too.
  g.worldEvents.load(JSON.parse(JSON.stringify(g.worldEvents.serialize())));
  assert.equal(g.worldEvents.active, null);
  noneLeft(g, 'reloaded in place');
  // Older saves have none of it.
  g.worldEvents.load(undefined);
  assert.equal(g.worldEvents.done, 0);
  assert.equal(g.worldEvents.weekly.week, null);
});

test('weekly challenge: a seeded region per ISO week, progress in it, and a crate for all three', () => {
  assert.equal(isoWeekKey(new Date(2026, 10, 18)), '2026-W47');
  assert.equal(isoWeekKey(new Date(2027, 0, 1)), '2026-W53', 'early January can belong to the last week of the year before');
  assert.equal(isoWeekKey(new Date(2026, 0, 5)), '2026-W02');
  const g = newGame();
  assert.ok(g.worldEvents.ensureWeek('2026-W47'));
  assert.ok(!g.worldEvents.ensureWeek('2026-W47'), 'same week: nothing changes');
  const r = g.worldEvents.weekly.region;
  assert.ok(g.world.zones.some((z) => z.name === r && !z.wilderness), r);
  const g2 = newGame();
  g2.worldEvents.ensureWeek('2026-W47');
  assert.equal(g2.worldEvents.weekly.region, r, 'the same week picks the same region');
  // Kills in the region count; elsewhere they don't.
  const z = g.world.zones.find((q) => q.name === r);
  const inside = g.npcs.find((n) => n.def.attackable && !n.def.boss && g.world.zoneAt(n.x, n.y) === z);
  const outside = g.npcs.find((n) => n.def.attackable && !n.def.boss && g.world.zoneAt(n.x, n.y) !== z);
  if (inside) { kill(g, inside); assert.equal(g.worldEvents.weekly.kills, 1); }
  kill(g, outside);
  assert.equal(g.worldEvents.weekly.kills, inside ? 1 : 0);
  // Finish the three tasks.
  const casket0 = ['easy', 'medium', 'hard'].reduce((a, t) => a + g.inventory.count(`reward_casket_${t}`), 0);
  g.worldEvents._weekly('kills', 500);
  g.worldEvents._weekly('gathers', 50);
  assert.equal(g.worldEvents.weekly.claimed, false);
  g.worldEvents._weekly('events', 1);
  assert.equal(g.worldEvents.weekly.claimed, true);
  assert.ok(g.worldEvents.weeklyTasks().every((t) => t.done));
  assert.equal(['easy', 'medium', 'hard'].reduce((a, t) => a + g.inventory.count(`reward_casket_${t}`), 0), casket0 + 1, 'one reward crate');
  // A new week rolls over: a fresh board.
  assert.ok(g.worldEvents.ensureWeek('2026-W48'));
  assert.equal(g.worldEvents.weekly.kills, 0);
  assert.equal(g.worldEvents.weekly.claimed, false);
});

test('an event in the featured region counts for the weekly task', () => {
  const g = newGame();
  g.worldEvents.ensureWeek(isoWeekKey());
  g.worldEvents.weekly.region = 'Bukit Timah';
  const ev = g.worldEvents.start('rampage', { region: 'Bukit Timah' });
  kill(g, ev.mobs[0]);
  step(g, 1);
  assert.equal(g.worldEvents.weekly.events, 1);
});

test('rewards grow with level and shrink with a small share', () => {
  const lo = eventReward('invasion', 10, 1), hi = eventReward('invasion', 200, 1), part = eventReward('invasion', 200, 0.3);
  const c = (r) => r.find(([id]) => id === 'coins')[1];
  assert.ok(c(hi) > c(lo));
  assert.ok(c(part) < c(hi));
  assert.ok(hi.some(([id]) => id === 'refine_scroll'));
  assert.equal(eventReward('shoal', 50, 0).length, 0);
  assert.ok(weeklyCrate(150).some(([id]) => id === 'reward_casket_hard'));
  assert.equal(WEEKLY_TASKS.length, 3);
});

test('an idle game with no event costs one comparison a tick', () => {
  const g = newGame();
  step(g, 1);
  g.worldEvents.nextAt = g.tickCount + 1e9;
  const t0 = performance.now();
  for (let i = 0; i < 100000; i++) g.worldEvents.tick();
  assert.ok(performance.now() - t0 < 200);
});

test('the journal card shows the running event with a Go button, and the week\'s three tasks', async () => {
  const { eventsPanelHTML, eventTrackerRows, drawEventMarker } = await import('../src/ui/worldeventsui.js');
  const g = newGame();
  let html = eventsPanelHTML(g);
  assert.ok(html.includes('Weekly challenge'), 'the weekly card is always there');
  assert.equal((html.match(/we-task/g) || []).length, 3);
  assert.ok(!html.includes('we-go'), 'no Go without an event');
  g.worldEvents.start('invasion', { town: 'Kampong Glam' });
  html = eventsPanelHTML(g);
  assert.ok(html.includes('Monster invasion') && html.includes('we-go') && html.includes('Kampong Glam'));
  assert.equal(eventTrackerRows({ game: g }).length, 1);
  // The minimap marker draws on a stub canvas, near and far.
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => calls.push(k)), set: (t, k, v) => { t[k] = v; return true; } });
  drawEventMarker(ctx, g, 120, 120, g.worldEvents.active.x, g.worldEvents.active.y, 15, 4);
  drawEventMarker(ctx, g, 120, 120, g.worldEvents.active.x + 100, g.worldEvents.active.y, 15, 4);
  assert.ok(calls.includes('arc') && calls.includes('lineTo'));
  // Go walks you there.
  placeAt(g, 30, 20);
  assert.ok(g.worldEvents.travel());
  assert.ok(g.player.isMoving || g.player.path.length > 0, 'on the way');
});

test('falling after taking part in a gathering event still pays for what you gathered', () => {
  const g = newGame();
  equip(g);
  const ev = g.worldEvents.start('grove', { region: 'Bukit Timah' });
  ev.gathers = 6;
  g.player.hp = 0;
  g.playerDeath();
  assert.equal(g.worldEvents.active, null);
  assert.equal(g.worldEvents.done, 1);
  noneLeft(g, 'gathering death');
});

test('auto battle takes on event monsters nearby', () => {
  const g = newGame();
  const ev = g.worldEvents.start('rampage', { region: 'Bukit Timah' });
  const n = ev.mobs[0];
  placeAt(g, n.x + 2, n.y);
  n.target = null;
  g.npcs = g.npcs.filter((m) => m === n || !m.def.attackable || chebyshev(m.x, m.y, n.x, n.y) > 30);
  g.toggleAutoBattle(true);
  assert.equal(g._autoPickTarget(), n);
});
