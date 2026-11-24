// "The best you can" auto gather, from the Life skills shortcuts (game/quickbar.js
// startLifeSkill, game/whatnext.js, game.js autoGatherBest): the tap takes you to
// the best source you can get to without crossing a region too strong for you or
// coming within reach of a monster that would set on you; what the mode then does
// by itself stays close and on foot, moves up only when a level opens something
// better, and gives way to whatever you choose yourself. Each test plays out a
// step of the reviews that found where it went wrong.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
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
/** A test of whether tile t lies within reach (and `extra` tiles more) of a monster
 *  that would set on you, any not too weak to bother with you as npc.js decides:
 *  worked out here from the monsters themselves. */
function reachOf(g) {
  const fight = g.fightLevel();
  const foes = g.npcs.filter((n) => n.def.attackable && n.def.aggressive && (n.def.ignoreLevelGate || fight <= n.def.level * 2 + 1));
  return (t, extra = 0) => foes.some((n) => chebyshev(t.x, t.y, n.spawnX, n.spawnY) <= (n.wander || 0) + (n.def.aggroRange || 4) + extra);
}
/** Back to `at` with auto gather off: a fresh start for the next tap. */
function goHome(g, at) {
  const p = g.player;
  p.stopNow(); p.clearAction();
  p.x = p.tx = at.x; p.y = p.ty = at.y; p.progress = 0; p.moving = false; p.path = [];
  g.autoGather = false; g.autoGatherBest = null; g._autoLife = null;
}
/** The middle of a stretch of open land in one region, `hw` tiles either side and
 *  `hh` above and below: room to set out monsters and trees of a test's own. */
function openLand(g, hw, hh) {
  const W = g.world;
  for (let y = hh; y < W.height - hh; y += 3) for (let x = hw; x < W.width - hw; x += 3) {
    const z = W.zoneAt(x, y);
    let ok = !!z && !z.wilderness && !z.instance;
    for (let j = y - hh; ok && j <= y + hh; j++) for (let i = x - hw; ok && i <= x + hw; i++) ok = !W.isBlocked(i, j) && W.zoneAt(i, j) === z;
    if (ok) return { x, y };
  }
  return assert.fail('no open land');
}
/** Every tree in the world felled for good (no timer: it never grows back), so a
 *  test's own trees are the only ones standing. */
const fellAll = (g) => { for (const o of g.world.objects) if (o.objId === 'tree') { o.depleted = true; o.respawnTimer = 0; } };

test('the tap keeps out of danger: regions far above you, and the reach of any monster that would set on you', () => {
  // The regions alone (no monsters about): Fishing 46's best catch a safe walk
  // reaches is Changi Coast's threadfin, the long way round by Pulau Ubin (the
  // white pomfret there can only be reached through Gardens by the Bay), where a
  // plain Go cuts through Tekong Badlands and Gardens by the Bay (monsters of
  // level 200 and more).
  const c = fresh();
  c.inventory.add('fishing_rod', 1);
  const start = c.playerTile(), safe = safeFor(c);
  assert.equal(c.fightLevel(), 19);
  c.skills.xp.fishing = xpForLevel(46);
  assert.ok(startLifeSkill(c, 'fishing'));
  const spot = c.player.action.obj;
  assert.equal(spot.objId, 'threadfin_spot');
  assert.equal(c.world.zoneAt(spot.x, spot.y).name, 'Changi Coast');
  assert.ok(c.player.path.length > 200, `a long walk (${c.player.path.length} steps)`);
  assert.ok(c.player.path.every(safe), 'every step of it keeps out of danger');
  // The danger the walk keeps out of is real: Gardens by the Bay and Tekong
  // Badlands count as unsafe. (A plain shortest walk used to cut through them,
  // but which of several equally short walks A* picks shifts whenever something
  // on the way moves, such as Kampong Glam's plaza props, so that is no test.)
  const unsafeIn = (name) => { const W = c.world; for (let y = 0; y < W.height; y += 2) for (let x = 0; x < W.width; x += 2) if (W.zoneAt(x, y)?.name === name && !W.isBlocked(x, y) && !safe({ x, y })) return true; return false; };
  assert.ok(unsafeIn('Gardens by the Bay') && unsafeIn('Tekong Badlands'), 'the regions on the way are danger to a level 19');
  const plain = findPath(c.pathCfg(), start, spot, { reachAdjacent: true, maxNodes: 150000 });
  assert.ok(plain.length && c.player.path.length <= plain.length * 1.6, 'and keeping out of it costs a sensible detour at most');
  // With the monsters about, a region's level says little: Sentosa Beach counts
  // as level 0, yet its sea snakes (level 81) set on a new fighter, who never
  // fights back while fishing, and an AFK fisher there died within a minute. The
  // tap goes to the best catch out of reach of every monster that would set on
  // you, on a walk that never comes within it.
  const g = fresh({ calm: false });
  g.inventory.add('fishing_rod', 1);
  const home = g.playerTile(), reach = reachOf(g);
  const clear = () => !reach(g.player.action.obj, 1) && g.player.path.every((t) => !reach(t));
  g.skills.xp.fishing = xpForLevel(46);
  assert.ok(startLifeSkill(g, 'fishing'));
  assert.equal(g.player.action.obj.objId, 'sea_rod_spot', 'a red snapper run');
  assert.ok(clear(), 'out of every such monster\'s reach, there and on the way');
  assert.equal(g.said.at(-1), "That's the best you can get to safely: Raw white pomfret (Fishing 46) lies among or past monsters that would set on you.",
    'and it says why (a red snapper at Fishing 46 looked like a mistake)');
  assert.ok(g.world.objects.some((o) => o.objId === 'sea_rod_spot' && reach(o)), 'though the runs further along the beach lie within one');
  // Fishing 25: every pike pool in Kranji Farmlands lies within some monster's
  // reach, so with the fare it's still never the pike, and the ride keeps clear too.
  goHome(g, home);
  g.skills.xp.fishing = xpForLevel(25);
  g.inventory.add('coins', 100);
  assert.ok(g.world.objects.filter((o) => o.objId === 'pike_spot').every((o) => reach(o, 1)));
  assert.ok(startLifeSkill(g, 'fishing'));
  assert.notEqual(g.player.action.obj.objId, 'pike_spot');
  assert.ok(clear());
  assert.equal(g.autoGatherBest, 'fishing', "the tap's own ride keeps the mode on");
  // A monster left far behind still after you: the MRT won't take you, and the
  // tap walks to the best it can reach on foot instead, never through danger.
  goHome(g, home);
  const stale = g.npcs.find((n) => n.alive && n.def.attackable && near(n, home) > 100);
  stale.target = g.player;
  const before = rides(g);
  assert.ok(startLifeSkill(g, 'fishing'));
  assert.equal(rides(g), before, 'no ride');
  assert.ok(clear());
  stale.target = null;
});

test('a monster that would set on you walls off its reach; one too weak to bother with you does not', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  const tree = bestGatherPick(g, 'woodcutting').obj;
  // A dire goblin (level 15) by that tree would set on a fighting level 19 (npc.js:
  // anyone up to twice its level and one): the tap takes you to another tree, and
  // the walk there keeps out of its reach.
  const gob = new NPC('dire_goblin', tree.x + 1, tree.y, 3);
  g.npcs.push(gob);
  const reach = (t, extra = 0) => chebyshev(t.x, t.y, gob.spawnX, gob.spawnY) <= gob.wander + gob.def.aggroRange + extra;
  assert.ok(!reach(g.playerTile()));
  assert.ok(startLifeSkill(g, 'woodcutting'));
  const other = g.player.action.obj;
  assert.equal(other.objId, 'tree');
  assert.ok(other !== tree && !reach(other, 1), `another tree (${other.x},${other.y}), out of its reach`);
  assert.ok(g.player.path.every((t) => !reach(t)));
  // A wild goblin (level 7) leaves a fighting level 19 be: the tree is as good as ever.
  g.npcs = g.npcs.filter((n) => n !== gob);
  g.npcs.push(new NPC('wild_goblin', tree.x + 1, tree.y, 3));
  assert.equal(bestGatherPick(g, 'woodcutting').obj, tree);
});

test("in a monster's reach already (or on its edge, beside a node), the way on goes no nearer its home, and into no other's reach", () => {
  // The real world: Woodcutting 8 at the bamboo by 37,33 in Bukit Timah, worked
  // from 36,32, out of every monster's aggro reach but on the edge of a feral
  // fruit bat's (the danger grid's extra tile). Standing there let the next walk
  // through every reach close by: when the bamboo was cut down, the walk to the
  // next one went 14 steps through the bat's reach, 3 tiles from its roost.
  const g = fresh({ calm: false });
  g.inventory.add('bronze_axe', 1);
  g.skills.xp.woodcutting = xpForLevel(8);
  const reach = reachOf(g), bamboo = g.world.objectAt(37, 33);
  assert.equal(bamboo?.objId, 'bamboo');
  goHome(g, { x: 36, y: 32 });
  assert.ok(!reach(g.playerTile()) && reach(g.playerTile(), 1), 'out of reach, on the edge of one');
  g.autoGather = true; g.autoGatherBest = 'woodcutting'; g._autoLife = { kind: 'gather', objId: 'bamboo' };
  bamboo.depleted = true;
  g._autoGatherNext({}, bamboo);
  assert.ok(g.player.path.every((t) => !reach(t)), `no step within reach (${g.player.path.filter((t) => reach(t)).length} were)`);

  // A goblin's home 3 tiles off (you walked in yourself): the tap walks you round
  // it to the tree beyond, never nearer. It used to walk you over its home.
  const h = fresh();
  h.inventory.add('bronze_axe', 1);
  const c = openLand(h, 20, 8);
  fellAll(h);
  const gob = new NPC('dire_goblin', c.x, c.y, 1);   // reach: wander 1 + aggro 4 (and the grid's extra tile)
  h.npcs.push(gob);
  const tree = h.world.addObject('tree', c.x + 9, c.y);
  goHome(h, { x: c.x - 3, y: c.y });
  assert.ok(startLifeSkill(h, 'woodcutting'));
  assert.equal(h.player.action.obj, tree);
  assert.ok(h.player.path.every((t) => near(t, gob) >= 3), `${Math.min(...h.player.path.map((t) => near(t, gob)))} tiles from its home at the nearest`);

  // On the edge of one goblin's reach beside a tree, with a second goblin between
  // you and the next tree: the walk goes round the second, never into its reach.
  const k = fresh();
  k.inventory.add('bronze_axe', 1);
  const o = openLand(k, 20, 8), at = { x: o.x + 6, y: o.y };
  fellAll(k);
  const a = new NPC('dire_goblin', at.x + 6, at.y, 1), b = new NPC('dire_goblin', at.x - 9, at.y, 1);
  k.npcs.push(a, b);
  const felled = k.world.addObject('tree', at.x - 1, at.y), next = k.world.addObject('tree', at.x - 18, at.y);
  goHome(k, at);
  k.autoGather = true; k.autoGatherBest = 'woodcutting'; k._autoLife = { kind: 'gather', objId: 'tree' };
  felled.depleted = true;
  k._autoGatherNext({}, felled);
  assert.equal(k.player.action?.obj, next);
  const into = (t) => near(t, b) <= b.wander + b.def.aggroRange;
  assert.ok(k.player.path.every((t) => !into(t) && near(t, a) >= near(at, a)), `${k.player.path.filter(into).length} steps within the second goblin's reach`);
});

test("the mode's own move up keeps out of every monster's reach too", () => {
  const g = fresh({ calm: false });
  g.inventory.add('fishing_rod', 1);
  g.skills.xp.fishing = xpForLevel(27);
  trickle(g);
  assert.ok(startLifeSkill(g, 'fishing'));
  arrive(g);
  // Fishing 28 opens red snapper, on Sentosa Beach a short walk south. The move up
  // used to take a new fighter to the run by the sea snakes and sand scorpions,
  // where it died within a minute (auto retaliate stays quiet while you fish).
  const reach = reachOf(g);
  g.skills.xp.fishing = xpForLevel(28) - 1;
  playUntil(g, () => g.player.action?.obj?.objId === 'sea_rod_spot', 100);
  const run = g.player.action?.obj;
  assert.equal(run?.objId, 'sea_rod_spot', 'moved up to a red snapper run');
  assert.ok(!reach(run, 1) && g.player.path.every((t) => !reach(t)), 'one out of their reach, by a walk that keeps out of it');
  assert.equal(g.autoGatherBest, 'fishing');
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

test("walled in by monsters' reach, the shortcut says so and what would help, not that there's nothing at your level", () => {
  // Four goblins about you, each home 3 tiles off: every step from here goes
  // nearer one of them. The grid said "Nothing at your level yet", and the tap
  // "There's nothing for Woodcutting I can take you to", with trees all round.
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  const c = openLand(g, 20, 8);
  for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) g.npcs.push(new NPC('dire_goblin', c.x + dx, c.y + dy, 1));
  goHome(g, c);
  assert.equal(lifeShortcutHint(g, 'woodcutting'), 'None safe to reach from here');
  assert.equal(startLifeSkill(g, 'woodcutting'), false);
  assert.equal(g.said.at(-1), "There's no safe way from here to anywhere you can train Woodcutting: move away from the monsters about you, or carry 30 coins for the MRT.");
  // With the fare, the MRT takes you clear of them.
  g.inventory.add('coins', 100);
  assert.match(lifeShortcutHint(g, 'woodcutting'), /^Tree \(lvl 1\)$/);
  assert.ok(startLifeSkill(g, 'woodcutting'));
  assert.equal(rides(g), 1);
  // With nothing you can work at all (no axe), it's still "nothing".
  const h = fresh();
  assert.equal(lifeShortcutHint(h, 'woodcutting'), 'Nothing at your level yet');
  assert.equal(startLifeSkill(h, 'woodcutting'), false);
  assert.equal(h.said.at(-1), "There's nothing for Woodcutting I can take you to right now.");
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
  // You ride home yourself (the world map): that ends the mode, which used to
  // ride you straight back. Plain auto gather carries on where you land, as it
  // always has.
  assert.ok(g.mrtFromMap('kampong_glam'));
  assert.equal(g.autoGatherBest, null);
  assert.equal(g._autoLife?.objId, 'pike_spot');
  const home = g.playerTile();
  playUntil(g, () => false, 20);
  assert.equal(rides(g), 2, 'no ride back');
  assert.ok(near(g.playerTile(), home) <= 30, 'it stays about the station');
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
  playUntil(g, () => false, 10);
  assert.equal(g.player.action?.obj, met, 'still mining the meteorite');
  assert.equal(g.autoGatherBest, null, 'a node you chose yourself ends "the best you can"');
  assert.ok(!g.said.some((m) => /moves up/.test(m)));
  g.worldEvents.end(false);

  // A rare shoal by MacRitchie Reservoir with the mode itself on it, as following
  // a school there leaves it (your own tap, as above, would end the mode before
  // its level-up came): the level that opens the perch pools a few steps off
  // (Fishing 15) leaves it at the shoal.
  const h = fresh();
  h.inventory.add('fishing_rod', 1); h.inventory.add('small_net', 1);
  h.skills.xp.fishing = xpForLevel(14);
  trickle(h);
  assert.ok(startLifeSkill(h, 'fishing'));
  const shoal = h.worldEvents.start('shoal', { region: 'MacRitchie Reservoir' }).objs[0];
  placeBeside(h, shoal);
  assert.ok(h._gatherAt(shoal), "the mode's own pick");
  h.skills.xp.fishing = xpForLevel(15) - 1;
  playUntil(h, () => h.skills.level('fishing') >= 15, 60);
  assert.equal(h.skills.level('fishing'), 15);
  h.skills.timeMult = () => 0;   // no more levels: the shoal's double XP brings one every few ticks, and a move up waits for them to settle
  playUntil(h, () => false, 10);
  assert.equal(h.player.action?.obj, shoal, 'still fishing the shoal');
  assert.equal(h.autoGatherBest, 'fishing', 'in the mode');
  assert.equal(bestGatherNode(h, 'fishing')?.objId, 'perch_spot', 'though a perch pool is close by');
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
  playUntil(g, () => false, 10);
  assert.equal(g.player.action?.obj, pool, 'still at the event node');
  assert.equal(g.autoGatherBest, 'fishing');
  assert.equal(bestGatherNode(g, 'fishing')?.objId, 'perch_spot', 'the pool it would have walked you to');
});

test('a world event that ends leaves auto gather at work unless you were at its node, and the HUD never shows a mode that has stopped', () => {
  // Waiting for the trees about you to grow back when a grove of their kind ends
  // far off: the job went with it (it was dropped by kind), and neither the mode
  // nor plain auto gather ever started again, the HUD still saying "Best Woodcutting".
  for (const best of [true, false]) {
    const g = fresh();
    g.inventory.add('bronze_axe', 1);
    g.skills.timeMult = () => 0;   // Woodcutting 1 throughout: ordinary trees are your best, and the grove's
    if (best) assert.ok(startLifeSkill(g, 'woodcutting'));
    else { g.toggleAutoGather(true); assert.ok(g.goToObject(nearestOf(g, 'tree'))); }
    arrive(g);
    const p = g.playerTile(), about = g.world.objects.filter((o) => o.objId === 'tree' && near(o, p) <= 60);
    for (const o of about) { o.depleted = true; o.respawnTimer = 0; }
    g.player.clearAction();
    playUntil(g, () => false, 3);
    const grove = g.worldEvents.start('grove', { region: 'Bukit Timah' }).objs[0];
    assert.ok(grove.objId === 'tree' && near(grove, p) > 1);
    g.worldEvents.end(false, 'time');
    for (const o of about) o.depleted = false;   // they grow back
    playUntil(g, () => g.player.action, 30);
    assert.equal(g.player.action?.obj?.objId, 'tree', best ? 'the mode chops on' : 'plain auto gather chops on');
    assert.equal(g.autoGatherStatus(), best ? 'Best Woodcutting: Tree' : 'Tree');
  }
  // The mode on a rare shoal (as a school leads it there) when the event ends: it
  // fishes on at a pool of its own. It used to stop there for good.
  const h = fresh();
  h.inventory.add('fishing_rod', 1); h.inventory.add('small_net', 1);
  h.skills.xp.fishing = xpForLevel(14);
  h.skills.timeMult = () => 0;
  assert.ok(startLifeSkill(h, 'fishing'));
  const spot = arrive(h);
  const shoal = h.worldEvents.start('shoal', { region: h.world.zoneAt(spot.x, spot.y).name }).objs[0];
  assert.equal(shoal.objId, spot.objId, 'a shoal of the kind the mode is on');
  placeBeside(h, shoal);
  assert.ok(h._gatherAt(shoal));
  playUntil(h, () => false, 3);
  h.worldEvents.end(false, 'time');
  playUntil(h, () => h.player.action, 30);
  assert.equal(h.player.action?.obj?.objId, spot.objId);
  assert.equal(h.autoGatherBest, 'fishing');
  // Plain auto gather beside the meteorite between swings, when it crumbles away:
  // it stops there, as it always has.
  const k = fresh();
  k.inventory.add('bronze_pickaxe', 1);
  const met = k.worldEvents.start('meteor', { region: 'Bukit Timah' }).objs[0];
  placeBeside(k, met);
  k.toggleAutoGather(true);
  k.defaultObjectAction(met);
  playUntil(k, () => k._autoLife, 30);
  k.player.clearAction();
  k.worldEvents.end(false, 'time');
  assert.equal(k._autoLife, null);
  assert.equal(k.autoGatherStatus(), 'Start gathering');
  // Clearing your own ticked kinds (the Auto menu) leaves the mode at work, though
  // it is on one of them; and a mode with no node in hand and none to go back to
  // isn't shown as at work.
  const m = fresh();
  m.inventory.add('bronze_axe', 1);
  m.gatherPicks.add('tree');
  assert.ok(startLifeSkill(m, 'woodcutting'));
  m.clearGatherPicks();
  assert.deepEqual(m._autoLife, { kind: 'gather', objId: 'tree' });
  m.player.clearAction(); m._autoLife = null;
  assert.equal(m.autoGatherStatus(), 'Start gathering');
});

test('a node you choose yourself ends the mode (Interact, a Go, steering, a ride, the map, a teleport, auto gather off); your own tap on its kind does not', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  g.skills.xp.woodcutting = xpForLevel(42) - 1;   // mangrove (40) is the best; 42 opens nothing
  assert.ok(startLifeSkill(g, 'woodcutting'));
  const mangrove = g.player.action.obj;
  assert.equal(mangrove.objId, 'mangrove');
  // Your own tap on a mangrove (back to work after a fight, say) carries on in the
  // mode: it used to end it, and auto gather then dropped to whatever tree stood nearest.
  g.player.clearAction();
  g.defaultObjectAction(mangrove);
  playUntil(g, () => g.player.action?.obj === mangrove && g._autoLife && !g.player.isMoving);
  assert.equal(g.autoGatherBest, 'woodcutting');
  assert.ok(g.player.action.best, "the mode's own again");
  assert.equal(g.autoGatherStatus(), 'Best Woodcutting: Mangrove tree');
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
  // A tap on the ground, the map's Travel, a teleport: the HUD used to go on
  // saying "Best Woodcutting" with the loop long gone.
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.walkTo({ x: g.player.x, y: g.player.y + 1 });
  assert.equal(g.autoGatherBest, null);
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.travelToTile({ x: g.player.x + 3, y: g.player.y });
  assert.equal(g.autoGatherBest, null);
  assert.ok(startLifeSkill(g, 'woodcutting'));
  assert.ok(g.teleports.start('town'));
  assert.equal(g.autoGatherBest, null);
  g.teleports.interrupt('');
  // A farming tap: farming's loop takes over auto gather's, and the HUD went on
  // saying "Best Woodcutting" while you farmed.
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.inventory.add('chilli_seed', 1);
  assert.ok(startLifeSkill(g, 'farming'));
  playUntil(g, () => g._autoLife?.kind === 'farm', 300);
  assert.equal(g.autoGatherBest, null);
  assert.equal(g.autoGatherStatus(), 'Farming');
  // Switching auto gather off, or ticking kinds of your own.
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.toggleAutoGather(false);
  assert.equal(g.autoGatherBest, null);
  assert.ok(startLifeSkill(g, 'woodcutting'));
  g.toggleGatherPick(['oak']);
  assert.equal(g.autoGatherBest, null);
});

test('death ends the mode: plain auto gather carries on near where you wake, never back where you fell', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  g.inventory.add('coins', 100);
  g.skills.xp.woodcutting = xpForLevel(99);   // magic trees, up in Bukit Timah
  assert.ok(startLifeSkill(g, 'woodcutting'));
  const tree = arrive(g);
  assert.equal(tree.objId, 'magic_tree');
  g.playerDeath();
  assert.equal(g.autoGatherBest, null, 'it used to walk (or ride) you straight back to where you fell');
  playUntil(g, () => g.player.alive, 30);
  const woke = g.playerTile();
  playUntil(g, () => false, 30);
  assert.equal(rides(g), 0);
  assert.ok(near(g.playerTile(), woke) <= 30, 'about the town (as plain auto gather always has)');
  assert.notEqual(g.player.action?.obj?.objId, 'magic_tree', 'not back at the magic trees');
});

test('a tap switches auto quest off; while you have it on again, the mode starts no trips (it decides where you go)', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  g.inventory.add('fishing_rod', 1);
  g.inventory.add('coins', 100);
  // With auto quest on, a tap rode you off to fish and auto quest rode you straight
  // back for its next step: a Life skills shortcut switches it off, as it does auto battle.
  g.skills.xp.fishing = xpForLevel(25);
  g.toggleAutoQuest(true);
  assert.ok(startLifeSkill(g, 'fishing'));
  assert.equal(g.autoQuest, false);
  assert.ok(g.said.includes('Auto quest off: you went to train Fishing.'));
  const spot = g.player.action.obj;
  playUntil(g, () => false, 5);
  assert.equal(g.player.action?.obj, spot, 'still on the way there');
  assert.equal(rides(g), 1, 'one ride, no ride back');
  goHome(g, { x: 58, y: 55 });
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

test('one big haul moves you up to the best source close by, and one line says where a tap takes you for better', () => {
  const g = fresh();
  g.inventory.add('fishing_rod', 1); g.inventory.add('small_net', 1);
  trickle(g);
  assert.ok(startLifeSkill(g, 'fishing'));
  const shoal = arrive(g);
  assert.equal(shoal.objId, 'fishing_spot', 'the anchovy shoal south of town');
  // One haul from Fishing 24 to 44 (a level-up for each level, as Skills.addXp tells
  // them): red snapper (28) opens a short walk away on Sentosa Beach, threadfin
  // (42) far off at Changi Coast. The mode used to move only to the overall best,
  // which never came close, and stayed on the anchovy for good.
  g.skills.xp.fishing = xpForLevel(44);
  for (let l = 25; l <= 44; l++) g.bus.emit('levelup', { skill: 'fishing', level: l });
  playUntil(g, () => g.player.action?.obj?.objId === 'sea_rod_spot', 15);
  assert.equal(g.player.action?.obj?.objId, 'sea_rod_spot');
  assert.deepEqual(g.said.filter((m) => /moves up|is open now/.test(m)),
    ['Auto gather moves up to the red snapper run. Raw threadfin (Fishing 42) is open now, in Changi Coast: tap Life skills > Fishing to go.']);
});

test("a new character's run of levels brings one move up, within half a minute, not a line at each", () => {
  const g = fresh();
  g.inventory.add('fishing_rod', 1); g.inventory.add('small_net', 1);
  let first = null;
  g.bus.on('levelup', () => { first ??= g.tickCount; });
  assert.ok(startLifeSkill(g, 'fishing'));
  // Fishing levels come every tick or two at first: the mode waits for them to
  // settle, but never more than 30 seconds (50 ticks).
  playUntil(g, () => g.player.action?.obj?.objId === 'sea_rod_spot', 80);
  assert.equal(g.player.action?.obj?.objId, 'sea_rod_spot');
  assert.ok(g.tickCount - first <= 51, `moved up ${g.tickCount - first} ticks after the first level`);
  assert.equal(g.said.filter((m) => /moves up|is open now/.test(m)).length, 1);
});

test('the mode waits for a school of fish passing its spot to swim off before it moves up', () => {
  const g = fresh();
  g.inventory.add('fishing_rod', 1);
  g.skills.xp.fishing = xpForLevel(14);
  trickle(g);
  assert.ok(startLifeSkill(g, 'fishing'));
  const pool = arrive(g);
  assert.equal(pool.objId, 'tilapia_spot');
  g.fishSchools.rand = () => 0.99;   // it stays its full time (and, schools being off in tests/seed.mjs, is never netted)
  g.fishSchools.spawn(pool);
  // Fishing 15 opens the perch pools a few steps away: the catch that brought it
  // used to walk you off the school there and then.
  g.skills.xp.fishing = xpForLevel(15) - 1;
  playUntil(g, () => g.skills.level('fishing') >= 15, 60);
  playUntil(g, () => false, 10);
  assert.ok(g.fishSchools.at(pool), 'the school is still there');
  assert.equal(g.player.action?.obj, pool, 'and so are you');
  // Once it has swum off, you move up.
  playUntil(g, () => !g.fishSchools.at(pool), 100);
  playUntil(g, () => g.player.action?.obj !== pool, 15);
  assert.ok(g.player.action?.obj && g.player.action.obj !== pool);
  assert.ok(g.said.some((m) => /^Auto gather moves up to the /.test(m)));
});

test("best spots you can't reach safely neither stall the mode nor bring news of them", () => {
  const g = fresh();
  g.inventory.add('fishing_rod', 1);
  g.skills.xp.fishing = xpForLevel(45);
  trickle(g);
  // Beside Changi Coast's threadfin, where the tap's walk round by Pulau Ubin ends.
  const spot = g.world.objects.find((o) => o.objId === 'threadfin_spot' && o.x === 287 && o.y === 75);
  placeBeside(g, spot);
  assert.ok(startLifeSkill(g, 'fishing'));
  assert.equal(g.player.action.obj, spot);
  // Fishing 46 opens white pomfret, whose spots a few steps off can only be reached
  // through Gardens by the Bay: no word of it (a tap would only bring you back here)...
  g.skills.xp.fishing = xpForLevel(46) - 1;
  playUntil(g, () => g.skills.level('fishing') >= 46, 100);
  playUntil(g, () => false, 10);
  assert.equal(g.player.action?.obj, spot);
  assert.ok(!g.said.some((m) => /is open now|moves up/.test(m)));
  // ...and after an interruption (a fight, the bank) you fish on here. The mode used
  // to spend its few tries on the pomfret's spots, and never fished again.
  g.player.clearAction();
  playUntil(g, () => g.player.action, 3);
  assert.equal(g.player.action?.obj, spot);
  assert.equal(bestGatherNode(g, 'fishing'), spot);
});

test('a school is followed only somewhere safe', () => {
  const g = fresh();
  g.inventory.add('fishing_rod', 1);
  g.skills.xp.fishing = xpForLevel(14);
  assert.ok(startLifeSkill(g, 'fishing'));
  const pool = arrive(g);
  assert.equal(pool.objId, 'tilapia_spot');
  const other = nearestOf(g, pool.objId, g.playerTile(), (o) => o !== pool && near(o, g.player) <= 10);
  assert.ok(other, 'another tilapia pool close by');
  g.fishSchools.rand = () => 0.99;
  // A monster that would set on you by the other pool: auto gather used to follow
  // a school there all the same, by a plain walk.
  const gob = new NPC('dire_goblin', other.x + 1, other.y, 3);
  g.npcs.push(gob);
  g.fishSchools.spawn(other);
  assert.equal(g.player.action?.obj, pool, 'it stays put');
  g.fishSchools.leave(g.fishSchools.at(other));
  // Without the monster, it follows, and the pick is still the mode's own.
  g.npcs = g.npcs.filter((n) => n !== gob);
  g.fishSchools.spawn(other);
  assert.equal(g.player.action?.obj, other);
  assert.ok(g.player.action.best);
  assert.ok(g.said.includes('Auto gather follows the school.'));
});

test('back over a border you crossed a moment ago is no news, but stepping out of the Wilderness always is', () => {
  const g = fresh(), W = g.world;
  /** Two walkable tiles side by side in two regions, the second the Wilderness or not. */
  const border = (wild) => {
    for (let y = 1; y < W.height; y++) for (let x = 1; x < W.width - 1; x++) {
      const a = W.zoneAt(x, y), b = W.zoneAt(x + 1, y);
      if (a && b && a !== b && !a.wilderness && !a.instance && !b.instance && !!b.wilderness === wild
        && !W.isBlocked(x, y) && !W.isBlocked(x + 1, y)) return [{ x, y, name: a.name }, { x: x + 1, y, name: b.name }];
    }
    return assert.fail('no border');
  };
  const step = (t) => { goHome(g, t); for (let i = 0; i < 3; i++) g.update(600); };
  const told = (name) => g.said.filter((m) => m.startsWith(`You enter ${name}`)).length;
  // Auto gather's traps either side of a border told you both regions' names
  // hundreds of times an hour: each is said once a minute at most.
  const [a, b] = border(false);
  step(a);
  g.said.length = 0;
  step(b); step(a); step(b); step(a);
  assert.deepEqual([told(a.name), told(b.name)], [0, 1]);
  // Into the Wilderness and straight back out: the way out was kept quiet too,
  // and that line is all that tells you you've left it (no safe healing there).
  const [c, d] = border(true);
  step(c);
  g.said.length = 0;
  step(d);
  assert.ok(g.said.some((m) => m.startsWith('You enter the Wilderness')));
  step(c);
  assert.equal(told(c.name), 1, `"You enter ${c.name}" on the way out`);
});
