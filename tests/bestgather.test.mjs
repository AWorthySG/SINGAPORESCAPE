// "The best you can" auto gather, from the Life skills shortcuts (game/quickbar.js
// startLifeSkill, game/whatnext.js, game.js autoGatherBest): the tap takes you to
// the best source you can get to without crossing a region too strong for you;
// what the mode then does by itself stays close and on foot, moves up only when a
// level opens something better, and gives way to whatever you choose yourself.
// Each test plays out a step of the review that found where it went wrong.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { startLifeSkill, lifeShortcutHint } from '../src/game/quickbar.js';
import { bestGatherPick, bestGatherNode } from '../src/game/whatnext.js';
import { zoneLevel } from '../src/data/world.js';
import { xpForLevel } from '../src/data/xp.js';
import { findPath } from '../src/engine/pathfinding.js';
import { chebyshev } from '../src/core/utils.js';

const quietUi = () => new Proxy({}, { get: () => () => {} });
/** A new game that remembers what it says; `calm`: no monster to spoil a long walk. */
function fresh({ calm = true } = {}) {
  const g = new Game();
  g.ui = quietUi();
  if (calm) g.npcs = g.npcs.filter((n) => !n.def?.attackable);
  g.said = [];
  const msg = g.msg.bind(g);
  g.msg = (t, c) => { g.said.push(t); return msg(t, c); };
  return g;
}
const GATHER = new Set(['woodcut', 'mine', 'fish', 'hunt']);
const near = (a, b) => chebyshev(a.x, a.y, b.x, b.y);
/** Play on until you stand at a node working it: the node. */
function arrive(g, ticks = 600) {
  for (let i = 0; i < ticks; i++) {
    g.update(600);
    const a = g.player.action;
    if (a && GATHER.has(a.type) && !g.player.isMoving && near(a.obj, g.player) <= 1 && g._autoLife) return a.obj;
  }
  return assert.fail(`never got to work (at ${g.player.x},${g.player.y})`);
}
/** Stand beside `o` (as if you had walked there). */
function placeBeside(g, o) {
  const t = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    .map(([dx, dy]) => ({ x: o.x + dx, y: o.y + dy })).find((s) => !g.world.isBlocked(s.x, s.y));
  const p = g.player;
  p.stopNow(); p.clearAction();
  p.x = p.tx = t.x; p.y = p.ty = t.y; p.progress = 0; p.moving = false; p.path = [];
}
const playUntil = (g, done, ticks = 300) => { for (let i = 0; i < ticks && !done(); i++) g.update(600); };
/** A trickle of XP from now on, so the levels come one at a time (life skills earn fast). */
const trickle = (g) => { g.skills.timeMult = () => 0.01; };
/** MRT rides so far (a first ride can pay an award, so coins don't tell). */
const rides = (g) => g.said.filter((m) => /^You take the MRT/.test(m)).length;
const nearestOf = (g, id, from = g.playerTile(), ok = () => true) =>
  g.world.objects.filter((o) => o.objId === id && !o.depleted && ok(o)).sort((a, b) => near(a, from) - near(b, from))[0];
/** Tiles that are safe for you (as the mode judges them, standing where you are now). */
function safeFor(g) {
  const t0 = g.playerTile(), here = g.world.zoneAt(t0.x, t0.y), fight = g.fightLevel();
  return (t) => { const z = g.world.zoneAt(t.x, t.y); return !z || z === here || (!z.wilderness && zoneLevel(z) <= fight + 10); };
}
/** Back to `at` with auto gather off: a fresh start for the next tap. */
function goHome(g, at) {
  const p = g.player;
  p.stopNow(); p.clearAction();
  p.x = p.tx = at.x; p.y = p.ty = at.y; p.progress = 0; p.moving = false; p.path = [];
  g.autoGather = false; g.autoGatherBest = null; g._autoLife = null;
}

test('the tap walks round regions too strong for you, rides the MRT where that is the safe way, or takes the best it can reach safely', () => {
  const g = fresh({ calm: false });
  g.inventory.add('fishing_rod', 1);
  const start = g.playerTile(), safe = safeFor(g);
  assert.equal(g.fightLevel(), 19);
  // Fishing 46: a plain Go to Changi Coast's spots walks through Tekong Badlands
  // and Gardens by the Bay (monsters of level 200 and more). The white pomfret's
  // spots (46) can only be reached through Gardens by the Bay, so the tap takes
  // the best catch it can walk to safely, the long way round by Pulau Ubin.
  g.skills.xp.fishing = xpForLevel(46);
  assert.ok(startLifeSkill(g, 'fishing'));
  const spot = g.player.action.obj;
  assert.notEqual(spot.objId, 'pomfret_spot');
  assert.equal(g.world.zoneAt(spot.x, spot.y).name, 'Changi Coast');
  assert.ok(g.player.path.length > 200, `a long walk (${g.player.path.length} steps)`);
  assert.ok(g.player.path.every(safe), 'every step of it keeps out of danger');
  const plain = findPath(g.pathCfg(), start, spot, { reachAdjacent: true, maxNodes: 150000 });
  assert.ok(plain.length && !plain.every(safe), 'where a plain walk there cuts through danger');
  // Fishing 25: pike only swim in Kranji Farmlands, ringed by regions of level
  // 100 and more. With no fare, the best catch you can walk to (marble goby)...
  goHome(g, start);
  g.skills.xp.fishing = xpForLevel(25);
  assert.equal(bestGatherPick(g, 'fishing').src.key, 'goby_spot:raw_marble_goby');
  // ...and the same with a fare but something (a monster left far behind) still
  // after you, as the MRT won't take you then: never the walk through danger.
  g.inventory.add('coins', 100);
  const stale = g.npcs.find((n) => n.alive && n.def.attackable && near(n, start) > 100);
  stale.target = g.player;
  assert.ok(startLifeSkill(g, 'fishing'));
  assert.equal(g.player.action.obj.objId, 'goby_spot');
  assert.ok(g.player.path.every(safe));
  assert.equal(rides(g), 0);
  // With nobody after you, the MRT is the safe way: a ride to Kranji, then a short walk.
  stale.target = null;
  goHome(g, start);
  assert.ok(startLifeSkill(g, 'fishing'));
  assert.equal(g.player.action.obj.objId, 'pike_spot');
  assert.equal(rides(g), 1);
  assert.equal(g.world.zoneAt(g.player.x, g.player.y).name, 'Kranji Farmlands');
  assert.ok(g.player.path.every(safe));
  assert.equal(g.autoGatherBest, 'fishing', "the tap's own ride keeps the mode on");
});

test("standing on a spent trap doesn't stop the Hunter shortcut: it takes you to the nearest ready one", () => {
  const g = fresh();
  g.inventory.add('hunting_snare', 1);
  const spent = nearestOf(g, 'bird_snare');
  g.player.x = g.player.tx = spent.x; g.player.y = g.player.ty = spent.y;   // a trap's tile can be stood on
  spent.depleted = true;
  const pick = bestGatherPick(g, 'hunter');
  assert.ok(pick, 'it used to give up: "There\'s nothing for Hunter I can take you to right now"');
  assert.equal(pick.obj.objId, 'bird_snare');
  assert.ok(pick.obj !== spent && !pick.obj.depleted);
  assert.notEqual(lifeShortcutHint(g, 'hunter'), 'Nothing at your level yet');
  assert.ok(startLifeSkill(g, 'hunter'));
  assert.equal(g.player.action.obj, pick.obj);
});

test('by itself the mode stays close and on foot: a better source far away is only told about, once; a ride you choose ends it', () => {
  const g = fresh();
  g.inventory.add('fishing_rod', 1);
  g.inventory.add('coins', 100);
  g.skills.xp.fishing = xpForLevel(25);
  trickle(g);
  assert.ok(startLifeSkill(g, 'fishing'));   // by MRT to Kranji's pike
  const spot = arrive(g);
  assert.equal(spot.objId, 'pike_spot');
  assert.equal(rides(g), 1);
  const at = g.playerTile();
  // Fishing 28 opens red snapper, at Sentosa Beach over 400 tiles away. It used
  // to ride (or walk through danger) straight there, at every level-up.
  g.skills.xp.fishing = xpForLevel(28) - 1;
  playUntil(g, () => g.skills.level('fishing') >= 28);
  assert.equal(g.skills.level('fishing'), 28);
  playUntil(g, () => false, 20);
  assert.equal(rides(g), 1, 'no MRT ride');
  assert.equal(g.player.action?.obj?.objId, 'pike_spot', 'still fishing the pike');
  assert.ok(near(g.playerTile(), at) <= 1, 'where it was');
  assert.deepEqual(g.said.filter((m) => /is open now/.test(m)),
    ['Raw red snapper (Fishing 28) is open now, in Sentosa Beach: tap Life skills > Fishing to go.']);
  assert.equal(g.autoGatherStatus(), 'Best Fishing: Pike pool');
  // You ride home yourself (the world map): that ends the mode and its loop, as
  // walking off does. It used to ride you straight back.
  assert.ok(g.mrtFromMap('kampong_glam'));
  assert.equal(g.autoGatherBest, null);
  assert.equal(g._autoLife, null);
  const home = g.playerTile();
  playUntil(g, () => false, 20);
  assert.equal(rides(g), 2, 'no ride back');
  assert.ok(near(g.playerTile(), home) <= 1 && !g.player.action, 'still at the station');
});

test('a level-up that opens nothing new leaves you be', () => {
  const g = fresh();
  g.inventory.add('fishing_rod', 1);
  g.skills.xp.fishing = xpForLevel(25);   // no fare for Kranji's pike: the marble goby it is
  trickle(g);
  assert.ok(startLifeSkill(g, 'fishing'));
  const spot = arrive(g);
  assert.equal(spot.objId, 'goby_spot');
  const at = g.playerTile();
  // 26 opens nothing (the pike were open already). The mode used to try to move up
  // at every level-up whenever you weren't on the very best source anywhere.
  g.skills.xp.fishing = xpForLevel(26) - 1;
  playUntil(g, () => g.skills.level('fishing') >= 26);
  assert.equal(g.skills.level('fishing'), 26);
  playUntil(g, () => false, 10);
  assert.equal(g.player.action?.obj, spot, 'still on the same spot');
  assert.ok(near(g.playerTile(), at) <= 1);
  assert.ok(!g.said.some((m) => /moves up|is open now/.test(m)), 'and nothing said');
  assert.equal(g.autoGatherBest, 'fishing');
});

test('a level-up on a world event node (the meteorite, a rare shoal) keeps you there', () => {
  const g = fresh();
  g.inventory.add('bronze_pickaxe', 1);
  g.skills.xp.mining = xpForLevel(14);   // iron opens at 15
  assert.ok(startLifeSkill(g, 'mining'));
  const met = g.worldEvents.start('meteor', { region: 'Bukit Timah' }).objs[0];
  placeBeside(g, met);
  g.defaultObjectAction(met);   // you mine it yourself
  trickle(g);
  g.skills.xp.mining = xpForLevel(15) - 1;
  playUntil(g, () => g.skills.level('mining') >= 15, 30);
  assert.equal(g.skills.level('mining'), 15);
  playUntil(g, () => false, 3);
  assert.equal(g.player.action?.obj, met, 'still mining the meteorite');
  assert.equal(g.autoGatherBest, null, 'a node you chose yourself ends "the best you can"');
  assert.ok(!g.said.some((m) => /moves up/.test(m)));
  g.worldEvents.end(false);

  // A rare shoal by MacRitchie Reservoir: the level that opens its perch pools
  // (Fishing 15) leaves you at the shoal.
  const h = fresh();
  h.inventory.add('fishing_rod', 1); h.inventory.add('small_net', 1);
  h.skills.xp.fishing = xpForLevel(14);
  trickle(h);
  assert.ok(startLifeSkill(h, 'fishing'));
  const shoal = h.worldEvents.start('shoal', { region: 'MacRitchie Reservoir' }).objs[0];
  placeBeside(h, shoal);
  h.defaultObjectAction(shoal);
  h.skills.xp.fishing = xpForLevel(15) - 1;
  playUntil(h, () => h.skills.level('fishing') >= 15, 60);
  assert.equal(h.skills.level('fishing'), 15);
  playUntil(h, () => false, 3);
  assert.equal(h.player.action?.obj, shoal, 'still fishing the shoal');
  assert.ok(!h.said.some((m) => /moves up/.test(m)));
});

test('a level-up never moves the mode itself off a world event node, though a better one is a few steps away', () => {
  // A school of fish visiting a rare shoal can lead auto gather onto it. Here the
  // tilapia pool the tap takes you to stands in for one (marked as an event's
  // shoal is), with MacRitchie's perch pools (Fishing 15) a short walk away.
  const g = fresh();
  g.inventory.add('fishing_rod', 1);
  g.skills.xp.fishing = xpForLevel(14);
  trickle(g);
  assert.ok(startLifeSkill(g, 'fishing'));
  const pool = arrive(g);
  assert.equal(pool.objId, 'tilapia_spot');
  pool.worldEvent = true;
  g.skills.xp.fishing = xpForLevel(15) - 1;
  playUntil(g, () => g.skills.level('fishing') >= 15, 60);
  assert.equal(g.skills.level('fishing'), 15);
  playUntil(g, () => false, 3);
  assert.equal(g.player.action?.obj, pool, 'still at the event node');
  assert.equal(g.autoGatherBest, 'fishing');
  assert.equal(bestGatherNode(g, 'fishing')?.objId, 'perch_spot', 'the pool it would have walked you to');
});

test('a node you choose yourself ends the mode: Interact, a guide\'s or the map\'s Go, steering, a ride, auto gather off', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  g.skills.xp.woodcutting = xpForLevel(42) - 1;   // mangrove (40) is the best; 42 opens nothing
  assert.ok(startLifeSkill(g, 'woodcutting'));
  assert.equal(g.player.action.obj.objId, 'mangrove');
  // Interact on an oak instead: at the next level-up you used to be walked off to the mangroves.
  const oak = nearestOf(g, 'oak');
  placeBeside(g, oak);
  g.defaultObjectAction(oak);
  playUntil(g, () => g.skills.level('woodcutting') >= 42);
  playUntil(g, () => false, 5);
  assert.equal(g.autoGatherBest, null);
  assert.equal(g.player.action?.obj?.objId, 'oak', 'still at the oaks: plain auto gather from here');
  assert.equal(g.autoGatherStatus(), 'Oak tree');
  assert.ok(!g.said.some((m) => /moves up|is open now/.test(m)));
  // A skill guide's (or the world map's) Go to an oak.
  assert.ok(startLifeSkill(g, 'woodcutting'));
  const other = nearestOf(g, 'oak', g.playerTile(), (o) => o !== oak);
  assert.ok(g.goToObject(other));
  assert.equal(g.autoGatherBest, 'woodcutting', 'on the way there it still stands...');
  playUntil(g, () => g.autoGatherBest === null);
  assert.equal(g.autoGatherBest, null, '...and ends at the first swing');
  assert.equal(g.player.action?.obj, other);
  // Steering.
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.setMoveInput(1, 0); g.update(50); g.setMoveInput(0, 0); g.update(50);
  assert.equal(g.autoGatherBest, null);
  // A ride you choose (a station's gates).
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.inventory.add('coins', 30);
  assert.ok(g.travelTo('chinatown'));
  assert.equal(g.autoGatherBest, null);
  assert.equal(g._autoLife, null);
  // Switching auto gather off, or ticking kinds of your own.
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.toggleAutoGather(false);
  assert.equal(g.autoGatherBest, null);
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.toggleGatherPick(['oak']);
  assert.equal(g.autoGatherBest, null);
});

test('death ends the mode: you wake in town and stay there', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  g.skills.xp.woodcutting = xpForLevel(99);   // magic trees, up in Bukit Timah
  assert.ok(startLifeSkill(g, 'woodcutting'));
  const tree = arrive(g);
  assert.equal(tree.objId, 'magic_tree');
  g.playerDeath();
  assert.equal(g.autoGatherBest, null);
  assert.equal(g._autoLife, null, 'it used to walk (or ride) you straight back to where you fell');
  playUntil(g, () => g.player.alive, 30);
  const woke = g.playerTile();
  playUntil(g, () => false, 15);
  assert.ok(!g.player.action && !g.player.isMoving && near(g.playerTile(), woke) === 0, 'still where you woke');
});

test('while auto quest is on, the mode starts no trips (it decides where you go)', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  trickle(g);   // (ordinary trees stay the best)
  assert.ok(startLifeSkill(g, 'woodcutting'));
  const tree = arrive(g);
  g.toggleAutoQuest(true);
  // The tree is felled: auto gather would walk on to the next one...
  tree.depleted = true;
  g.player.clearAction();
  g._autoGatherNext({}, tree);
  g._autoLifeTick();
  assert.ok(!g.player.action && !g.player.isMoving, '...but auto quest has the say');
  // With auto quest off again, on to the next tree.
  g.toggleAutoQuest(false);
  g._autoLifeTick();
  assert.equal(g.player.action?.obj?.objId, 'tree');
  assert.notEqual(g.player.action.obj, tree);
  assert.ok(g.player.action.best, "the mode's own pick");
});
