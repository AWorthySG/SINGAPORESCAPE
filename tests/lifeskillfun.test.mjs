// Gathering extras (streaks, lucky finds, skilling contracts), resource zones
// and the Town / Grave teleports: gathering.js, resourcezones.js,
// teleports.js and the zones block in data/world.js.
import './seed.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame, loadGame } from '../src/game/save.js';
import { findPath } from '../src/engine/pathfinding.js';
import { chebyshev } from '../src/core/utils.js';
import { getDialogue } from '../src/data/dialogue.js';
import {
  GATHER_FUN, STREAK_STEP, STREAK_GAP_TICKS, STREAK_XP_STEP, STREAK_TIERS, makeContracts, streakXpMult, nodeLevel, Gathering,
} from '../src/game/gathering.js';
import { resourceZoneAt, zoneNodes, zoneSummary } from '../src/game/resourcezones.js';
import { CAST_TICKS, TOWN_COOLDOWN_TICKS } from '../src/game/teleports.js';

beforeEach(() => { GATHER_FUN.on = true; });

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function boot() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass('swordsman');
  // No wandering monster can break a cast or a streak by chance.
  g.npcs = g.npcs.filter((n) => !n.attackable);
  return g;
}
const step = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };
const bag = (g) => { const m = new Map(); for (const s of g.inventory.slots) if (s) m.set(s.id, (m.get(s.id) || 0) + s.qty); return m; };
/** One successful gather at `obj`, as the game's gathering tick would report it. */
function gatherOnce(g, obj, id, type) {
  const before = bag(g);
  g.inventory.add(id, 1);
  g.tickCount++;
  return g.gathering.onGather({ type }, obj, before);
}

// ---------------- Resource zones ----------------
const ZONES = {
  ubin_quarry: { skill: 'mining', region: 'Pulau Ubin', min: 20 },
  tekong_deep_mine: { skill: 'mining', region: 'Tekong Badlands', min: 16 },
  jurong_timberland: { skill: 'woodcutting', region: 'Jurong Forest', min: 20 },
  coney_old_growth: { skill: 'woodcutting', region: 'Coney Island', min: 15 },
  changi_pier: { skill: 'fishing', region: 'Changi Coast', min: 15 },
  buloh_hunting: { skill: 'hunter', region: 'Sungei Buloh Wetlands', min: 15 },
};

test('resource zones: dense with their skill\'s nodes, signposted, in their region and reachable from Kampong Glam', () => {
  const g = boot();
  const zones = g.world.resourceZones;
  assert.deepEqual(zones.map((z) => z.id).sort(), Object.keys(ZONES).sort());
  const cfg = g.pathCfg();
  const from = { x: 58, y: 55 };   // Kampong Glam's plaza
  for (const z of zones) {
    const want = ZONES[z.id];
    assert.equal(z.skill, want.skill, z.id);
    assert.equal(g.world.zoneAt(z.cx, z.cy)?.name, want.region, `${z.name} lies in ${want.region}`);
    const nodes = g.world.objects.filter((o) => o.def.skill === z.skill && o.x >= z.x0 && o.x <= z.x1 && o.y >= z.y0 && o.y <= z.y1);
    assert.ok(nodes.length >= want.min, `${z.name}: ${nodes.length} nodes`);
    // Far denser than the region around it: at least one node per 10 tiles of its patch.
    assert.ok(nodes.length * 10 >= (z.x1 - z.x0 + 1) * (z.y1 - z.y0 + 1), `${z.name} is dense`);
    assert.ok(new Set(nodes.map((o) => o.objId)).size >= 4, `${z.name} has a spread of tiers`);
    const sign = g.world.objects.find((o) => o.objId === 'sign' && o.x === z.cx && o.y === z.cy);
    assert.equal(sign?.sign, z.name, `${z.name} has its signpost`);
    assert.equal(resourceZoneAt(g.world, z.cx, z.cy), z);
    assert.ok(zoneSummary(g.world, z).startsWith(z.name));
    assert.ok(zoneNodes(g.world, z).length >= 4);
    // Every node can be walked up to from town (the signpost too).
    assert.ok(findPath(cfg, from, { x: z.cx, y: z.cy }, { maxNodes: 300000 }).length > 0, `${z.name}'s signpost is reachable`);
    for (const o of nodes) {
      assert.ok(findPath(cfg, from, { x: o.x, y: o.y }, { reachAdjacent: true, maxNodes: 300000 }).length > 0, `${o.objId} at ${o.x},${o.y} is reachable`);
    }
  }
});

test('resource zones suit their region: the Ubin quarry starts at level 1, the Tekong mine is for the high tiers', () => {
  const g = boot();
  const lv = (id) => zoneNodes(g.world, g.world.resourceZones.find((z) => z.id === id)).map((e) => e.level);
  assert.equal(Math.min(...lv('ubin_quarry')), 1);
  assert.ok(Math.max(...lv('ubin_quarry')) <= 45);
  const tekong = zoneNodes(g.world, g.world.resourceZones.find((z) => z.id === 'tekong_deep_mine')).map((e) => e.objId);
  for (const id of ['mithril_rock', 'adamantite_rock', 'runite_rock']) assert.ok(tekong.includes(id), `Tekong has ${id}`);
  assert.ok(lv('coney_old_growth').filter((l) => l >= 60).length >= 2, 'yews and magic trees in the Coney woods');
});

test('resource zones are calm: monsters camped beside them don\'t attack on sight', () => {
  const g = boot();
  for (const z of g.world.resourceZones) {
    const near = g.npcs.filter((n) => n.def.attackable && Math.max(Math.abs(n.x - z.cx), Math.abs(n.y - z.cy)) <= 10);
    assert.equal(near.filter((n) => n.def.aggressive).length, 0, `${z.name}: no monster attacks on sight`);
  }
});

test('walking into a resource zone says what it holds', () => {
  const g = boot();
  const z = g.world.resourceZones.find((x) => x.id === 'jurong_timberland');
  const said = [];
  g.bus.on('chat', (m) => said.push(m.text));
  g.player.x = g.player.tx = z.cx; g.player.y = g.player.ty = z.cy;
  step(g, 1);
  assert.ok(said.some((t) => t.startsWith('You enter Jurong Timberland:')), said.join(' | '));
  step(g, 3);
  assert.equal(said.filter((t) => t.startsWith('You enter Jurong Timberland')).length, 1, 'once per visit');
});

// ---------------- Streaks and lucky finds ----------------
test('a gathering streak builds XP in steps, and ends after a pause or a change of skill', () => {
  const g = boot();
  g.gathering.rand = () => 0.99;   // no lucky finds in this test
  const tree = g.world.objects.find((o) => o.objId === 'tree');
  const rock = g.world.objects.find((o) => o.objId === 'copper_rock');
  for (let i = 0; i < STREAK_STEP - 1; i++) gatherOnce(g, tree, 'logs', 'woodcut');
  assert.equal(g.gathering.xpMult('woodcutting'), 1);
  gatherOnce(g, tree, 'logs', 'woodcut');
  assert.equal(g.gathering.streak.count, STREAK_STEP);
  assert.equal(g.gathering.xpMult('woodcutting'), 1 + STREAK_XP_STEP);
  assert.equal(g.gathering.xpMult('mining'), 1, 'only the skill on a streak');
  // The bonus reaches XP gains through Skills.timeMult.
  const x0 = g.skills.xp.woodcutting;
  g.skills.addXp('woodcutting', 100);
  const gained = g.skills.xp.woodcutting - x0;
  const x1 = g.skills.xp.mining;
  g.skills.addXp('mining', 100);
  assert.ok(Math.abs(gained / (g.skills.xp.mining - x1) - (1 + STREAK_XP_STEP)) < 0.03, 'woodcutting XP is worth 2% more');
  // It tops out.
  assert.equal(streakXpMult(STREAK_STEP * 99), 1 + STREAK_TIERS * STREAK_XP_STEP);
  // Switching skill starts again.
  gatherOnce(g, rock, 'copper_ore', 'mine');
  assert.deepEqual([g.gathering.streak.skill, g.gathering.streak.count], ['mining', 1]);
  // A long pause ends it.
  for (let i = 0; i <= STREAK_GAP_TICKS + 1; i++) { g.tickCount++; g.gathering.tick(); }
  assert.equal(g.gathering.streak, null);
  // A failed attempt (nothing gathered) doesn't count.
  assert.equal(g.gathering.onGather({ type: 'woodcut' }, tree, bag(g)), false);
  assert.equal(g.gathering.streak, null);
});

test('a real chop builds a streak; with the extras switched off nothing changes', () => {
  const g = boot();
  g.player.hp = 9999;
  const tree = g.world.objects.find((o) => o.def.type === 'tree' && o.def.level <= g.skills.level('woodcutting')
    && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !g.world.isBlocked(o.x + dx, o.y + dy)));
  const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: tree.x + dx, y: tree.y + dy })).find((t) => !g.world.isBlocked(t.x, t.y));
  g.player.x = g.player.tx = adj.x; g.player.y = g.player.ty = adj.y;
  g.beginAction({ type: 'woodcut', obj: tree }, { x: tree.x, y: tree.y }, true);
  // (Check as soon as a log lands: a plain tree falls after one, and a streak
  // left idle long enough ends.)
  for (let i = 0; i < 60 && !g.gathering.streak; i++) step(g, 1);
  assert.ok(g.gathering.streak?.skill === 'woodcutting' && g.gathering.streak.count >= 1, 'chopping counts');
  GATHER_FUN.on = false;
  assert.equal(g.gathering.xpMult('woodcutting'), 1);
});

test('a lucky find pays coins, the skill\'s rare find and bonus XP, with a banner', () => {
  const g = boot();
  g.gathering.rand = () => 0;   // every roll lucky
  const tree = g.world.objects.find((o) => o.objId === 'oak');
  const banners = [];
  g.banner = (h) => banners.push(h);
  const coins = g.inventory.count('coins'), nests = g.inventory.count('birds_nest'), xp = g.skills.xp.woodcutting;
  gatherOnce(g, tree, 'oak_logs', 'woodcut');
  assert.ok(g.inventory.count('coins') > coins, 'coins');
  assert.equal(g.inventory.count('birds_nest'), nests + 1, "a bird's nest");
  assert.ok(g.skills.xp.woodcutting > xp, 'bonus XP');
  assert.ok(banners.some((h) => h.includes('Lucky find')));
  // Each skill has its own find.
  const rock = g.world.objects.find((o) => o.objId === 'iron_rock');
  const gems = () => ['sapphire', 'emerald', 'ruby', 'diamond'].reduce((s, id) => s + g.inventory.count(id), 0);
  const gem0 = gems();
  gatherOnce(g, rock, 'iron_ore', 'mine');
  assert.equal(gems(), gem0 + 1, 'a gem');
  const spot = g.world.objects.find((o) => o.objId === 'fishing_spot');
  const p0 = g.inventory.count('pearl');
  gatherOnce(g, spot, 'raw_anchovy', 'fish');
  assert.equal(g.inventory.count('pearl'), p0 + 1, 'a pearl');
});

// ---------------- Contracts ----------------
test('skilling contracts: three a day in different gathering skills, at nodes you can use and that exist', () => {
  const present = new Set(['tree', 'oak', 'willow', 'copper_rock', 'iron_rock', 'fishing_spot', 'bird_snare', 'squirrel_trap']);
  const levels = { woodcutting: 20, mining: 20, fishing: 10, hunter: 15 };
  const a = makeContracts('2026-11-19', levels, present);
  assert.deepEqual(a, makeContracts('2026-11-19', levels, present), 'the same board all day');
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((k) => k.skill)).size, 3, 'three different skills');
  for (const k of a) {
    assert.ok(present.has(k.objId), k.objId);
    assert.ok(k.need >= 25 && k.need <= 50 && k.coins > 0 && k.xp > 0);
  }
  assert.ok(!a.some((k) => k.objId === 'willow'), 'never above your level');
  // The talk option is there in Kampong Glam.
  assert.ok(getDialogue('tutor').start.options.some((o) => o.action === 'skillContracts'));
});

test('a contract counts gathers at its node, pays coins and XP when done, and a full board builds a streak', () => {
  const g = boot();
  g.todayKey = () => '2026-11-12';   // one day's board, even if the run crosses midnight
  g.gathering.rand = () => 0.99;
  const list = g.gathering.ensureContracts();
  assert.equal(list.length, 3);
  const TYPE = { woodcutting: 'woodcut', mining: 'mine', fishing: 'fish', hunter: 'hunt' };
  const coins0 = g.inventory.count('coins');
  for (const k of list) {
    const obj = g.world.objects.find((o) => o.objId === k.objId);
    const xp0 = g.skills.xp[k.skill];
    for (let i = 0; i < k.need; i++) gatherOnce(g, obj, 'feather', TYPE[k.skill]);
    assert.ok(k.done, `${Gathering.contractText(k)} done`);
    assert.ok(g.skills.xp[k.skill] - xp0 >= k.xp, 'its XP is paid');
  }
  const paid = g.inventory.count('coins') - coins0;
  assert.ok(paid >= list.reduce((s, k) => s + k.coins, 0) + 300, 'coins and the full-board bonus');
  assert.equal(g.gathering.contracts.streak, 1);
  // Saved and restored.
  saveGame(g);
  const g2 = new Game();
  loadGame(g2);
  assert.deepEqual(g2.gathering.contracts.list, g.gathering.contracts.list);
  assert.equal(g2.gathering.contracts.streak, 1);
  // A nonsense save is dropped, not trusted.
  g2.gathering.load({ contracts: { list: [{ objId: 'nope', skill: 'mining', need: 5 }], streak: 'x' } });
  assert.deepEqual(g2.gathering.contracts.list, []);
  assert.equal(g2.gathering.contracts.streak, 0);
});

test('contract levels follow the node: a fishing spot counts its lowest catch', () => {
  const g = boot();
  const spot = g.world.objects.find((o) => o.objId === 'fishing_spot');
  assert.equal(nodeLevel(spot.def), 1);
});

// ---------------- Teleports ----------------
test('Town teleport: a short cast brings you back to Kampong Glam, then it recharges', () => {
  const g = boot();
  g.player.x = g.player.tx = 64; g.player.y = g.player.ty = 20;   // Bukit Timah
  assert.notEqual(g.world.zoneAt(g.player.x, g.player.y)?.name, 'Kampong Glam');
  assert.ok(g.teleports.start('town'));
  step(g, CAST_TICKS - 1);
  assert.ok(g.teleports.cast, 'still casting');
  step(g, 1);
  assert.equal(g.teleports.cast, null);
  assert.equal(g.world.zoneAt(g.player.x, g.player.y)?.name, 'Kampong Glam');
  assert.ok(chebyshev(g.player.x, g.player.y, 58, 55) <= 2);
  // Recharging.
  assert.ok(g.teleports.townWait() > 0);
  assert.equal(g.teleports.start('town'), false);
  step(g, TOWN_COOLDOWN_TICKS);
  assert.equal(g.teleports.townWait(), 0);
  assert.equal(g.teleports.status('town').status, 'Ready');
});

test('Town teleport: moving or taking a hit breaks the cast, and it can\'t start mid-fight', () => {
  const g = boot();
  g.player.x = g.player.tx = 64; g.player.y = g.player.ty = 20;
  assert.ok(g.teleports.start('town'));
  step(g, 1);
  g.player.x += 1; g.player.tx = g.player.x;   // walked off
  step(g, 1);
  assert.equal(g.teleports.cast, null, 'moving cancels');
  assert.equal(g.player.x, 65);
  // A hit during the cast.
  assert.ok(g.teleports.start('town'));
  step(g, 1);
  g.player.hp -= 1;
  step(g, 1);
  assert.equal(g.teleports.cast, null, 'a hit cancels');
  // Just hit: no new cast for a few seconds.
  assert.equal(g.teleports.start('town'), false);
  assert.match(g.teleports.blocked('town'), /fight/);
  step(g, 10);
  assert.equal(g.teleports.blocked('town'), '');
  // Pressing again cancels a cast.
  assert.ok(g.teleports.start('town'));
  assert.equal(g.teleports.start('town'), false);
  assert.equal(g.teleports.cast, null);
});

test('Grave teleport: after a death it takes you to your gravestone, which hands your things back', () => {
  const g = boot();
  g.player.x = g.player.tx = 64; g.player.y = g.player.ty = 20;
  g.inventory.add('coins', 1000);
  assert.equal(g.teleports.start('grave'), false, 'no gravestone yet');
  g.playerDeath();
  const gr = g.play.grave;
  assert.ok(gr && gr.coins > 0);
  step(g, 30);   // respawn in town
  assert.ok(g.player.alive);
  assert.equal(g.world.zoneAt(g.player.x, g.player.y)?.name, 'Kampong Glam');
  const coins = g.inventory.count('coins');
  assert.ok(g.teleports.start('grave'));
  step(g, CAST_TICKS + 1);
  assert.ok(chebyshev(g.player.x, g.player.y, gr.x, gr.y) <= 1, 'beside the stone');
  assert.equal(g.play.grave, null, 'the stone handed everything back');
  assert.equal(g.inventory.count('coins'), coins + gr.coins);
  assert.equal(g.teleports.status('grave').status, 'No gravestone');
});
