// Endgame Thieving and Agility (levels 100-300): two new marks to pickpocket
// (Marina Bay's high roller and Chinatown's jade merchant), four chests to
// crack (the Temasek temple vault to the Shadow Rift's treasury), and six
// obstacle courses with their obstacles spread out, so a lap is a real run.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { NPCS } from '../src/data/npcs.js';
import { SHOPS } from '../src/data/shops.js';
import { xpForLevel } from '../src/data/xp.js';
import { chebyshev } from '../src/core/utils.js';
import { findPath } from '../src/engine/pathfinding.js';
import { guideEntries } from '../src/game/skillguide.js';
import { itemIconSVG } from '../src/render/icons.js';
import { worldArt } from '../src/render/sprites.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(keepNpcs = false) {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  if (!keepNpcs) g.npcs = [];   // nothing to interrupt the work
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
const step = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId || obj.npcId}`);
}
function listen(g) {
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (m, c) => { said.push(m); return msg(m, c); };
  return said;
}
const inZone = (g, o, name) => {
  const z = g.world.zones.find((zz) => zz.name === name);
  return o.x >= z.x0 && o.x <= z.x1 && o.y >= z.y0 && o.y <= z.y1;
};
const reachable = (g, objs) => {
  const mrt = g.world.objects.filter((o) => o.objId === 'mrt_station')
    .reduce((a, b) => (chebyshev(b.x, b.y, objs[0].x, objs[0].y) < chebyshev(a.x, a.y, objs[0].x, objs[0].y) ? b : a));
  const from = [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 2]].map(([dx, dy]) => ({ x: mrt.x + dx, y: mrt.y + dy })).find((p) => !g.world.isBlocked(p.x, p.y));
  return objs.every((o) => findPath(g.pathCfg(), from, { x: o.x, y: o.y }, { reachAdjacent: true, maxNodes: 200000 }).length > 0);
};
// Strip the bag back to nothing after every tick: an endless bag for timing runs.
const emptyBag = (g) => { for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s) g.inventory.removeAt(k, s.qty); } };

const MARKS = [
  { lvl: 100, id: 'marina_high_roller', zone: 'Marina Bay', loot: ['coins', 'casino_chip'] },
  { lvl: 130, id: 'jade_merchant', zone: 'Chinatown', loot: ['coins', 'raw_jade'] },
];
const CHESTS = [
  { lvl: 160, id: 'temple_vault', zone: 'Temasek Ruins', loot: ['refine_scroll', 'diamond'] },
  { lvl: 200, id: 'observatory_chest', zone: 'The Celestial Peaks', loot: ['starmetal_ore', 'diamond'] },
  { lvl: 250, id: 'smugglers_hold', zone: 'Tuas Docklands', loot: ['upgrade_ward', 'upgrade_stone'] },
  { lvl: 300, id: 'rift_treasury', zone: 'The Shadow Rift', loot: ['refine_scroll', 'eternal_ore', 'merlion_amulet'] },
];
const COURSES = [
  { lvl: 100, id: 'supertree_skyway', zone: 'Gardens by the Bay' },
  { lvl: 130, id: 'container_yard_run', zone: 'Tuas Docklands' },
  { lvl: 160, id: 'canopy_course', zone: 'Mandai Rainforest' },
  { lvl: 200, id: 'cloud_steps', zone: 'The Celestial Peaks' },
  { lvl: 250, id: 'wraith_run', zone: 'Pulau Hantu' },
  { lvl: 300, id: 'rift_leap', zone: 'The Shadow Rift' },
];
const obstaclesOf = (course) => Object.keys(OBJECTS).filter((id) => id.startsWith(`${course}_`));

// ---------------- Thieving ----------------
test('the new marks stand in their towns, and are pickpocketed at their level for their loot', () => {
  const g = newGame(true);
  const said = listen(g);
  for (const m of MARKS) {
    const def = NPCS[m.id];
    assert.ok(def && !def.attackable && def.role === 'mark' && def.thieving.level === m.lvl, `${m.id} is a mark`);
    const npc = g.npcs.find((n) => n.npcId === m.id);
    assert.ok(npc, `${m.id} is in the world`);
    assert.ok(inZone(g, npc, m.zone), `${m.id} is in ${m.zone}`);
    for (const id of m.loot) assert.ok(def.thieving.loot.some((l) => l.id === id), `${m.id} carries ${id}`);
    assert.ok(ITEMS.casino_chip.value > 0, 'casino chips are worth coins');
    // Below the level: nothing; at it, a click picks the pocket (role 'mark').
    setLevel(g, 'thieving', m.lvl - 1);
    const before = g.inventory.count('coins');
    g.pickpocket(npc);
    assert.equal(g.inventory.count('coins'), before);
    assert.ok(said.some((s) => s.includes(`Thieving level ${m.lvl}`)));
    setLevel(g, 'thieving', m.lvl);
    const xp0 = g.skills.xp.thieving, evil0 = g.karma.evil;
    const got = new Set();
    for (let i = 0; i < 400; i++) {
      const counts = Object.fromEntries(m.loot.map((id) => [id, g.inventory.count(id)]));
      g.pickpocket(npc);
      for (const id of m.loot) if (g.inventory.count(id) > counts[id]) got.add(id);
    }
    for (const id of m.loot) assert.ok(got.has(id), `picked ${id} from the ${m.id}`);
    assert.ok(g.skills.xp.thieving > xp0, 'for Thieving XP');
    assert.ok(g.karma.evil > evil0, 'theft tips you toward evil, as ever');
    assert.deepEqual(g._interactLabel({ kind: 'npc', ref: npc }), ['Pickpocket', npc.name]);
  }
});

test('the chests sit in their regions, reachable, and are cracked at their level for their loot', () => {
  const g = newGame();
  const said = listen(g);
  for (const c of CHESTS) {
    const def = OBJECTS[c.id];
    assert.equal(def.type, 'stall'); assert.equal(def.level, c.lvl);
    const chests = g.world.objects.filter((o) => o.objId === c.id);
    assert.ok(chests.length >= 1, `${c.id} placed`);
    for (const o of chests) assert.ok(inZone(g, o, c.zone), `${c.id} at ${o.x},${o.y} is in ${c.zone}`);
    assert.ok(reachable(g, chests), `${c.id} can be walked to`);
    for (const id of c.loot) assert.ok(def.loot.some((l) => l.id === id), `${c.id} can hold ${id}`);
    // The valuable things are rare: refine scrolls, wards and the rest under a tenth of picks.
    const total = def.loot.reduce((t, l) => t + l.weight, 0);
    for (const l of def.loot) if (['refine_scroll', 'upgrade_ward', 'merlion_amulet', 'eternal_ore', 'starmetal_ore', 'raw_jade'].includes(l.id)) assert.ok(l.weight / total <= 0.1, `${c.id}: ${l.id} is rare`);
    const chest = chests[0];
    standBy(g, chest);
    setLevel(g, 'thieving', c.lvl - 1);
    g.stealFromStall(chest);
    assert.ok(said.some((s) => s.includes(`Thieving level ${c.lvl}`)));
    setLevel(g, 'thieving', c.lvl + 40);   // sure-handed
    const xp0 = g.skills.xp.thieving;
    for (let i = 0; i < 20; i++) { chest.depleted = false; g.player.hp = 1e6; g.playerStun = 0; g.stealFromStall(chest); }
    assert.ok(g.skills.xp.thieving > xp0, `${c.id} pays Thieving XP`);
    assert.ok(guideEntries('thieving').some((e) => e.objIds?.includes(c.id) && e.level === c.lvl), `${c.id} in the Thieving guide`);
    assert.ok(worldArt().has(`obj-${c.id}`) && !def.art && !def.tint, `${c.id} has its own untinted picture`);
  }
});

test('endgame Thieving XP an hour: each tier well ahead of the best before it, at the same level', () => {
  const TICKS = 2000;
  const pocket = (npcId, lvl) => {
    const g = newGame(true);
    const npc = g.npcs.find((n) => n.npcId === npcId);
    g.npcs = [npc]; npc.def = { ...npc.def, wander: 0 };
    setLevel(g, 'thieving', lvl);
    standBy(g, npc); g.toggleAutoGather(true); g.startPickpocket(npc);
    const base = g.skills.xp.thieving; let gain = 0;
    for (let i = 0; i < TICKS; i++) { g.player.hp = 1e6; g.update(600); gain += g.skills.xp.thieving - base; g.skills.xp.thieving = base; emptyBag(g); }
    return gain * 6000 / TICKS;
  };
  const chest = (id, lvl) => {
    const g = newGame();
    setLevel(g, 'thieving', lvl);
    const o = g.world.objects.find((x) => x.objId === id);
    standBy(g, o);
    const base = g.skills.xp.thieving; let gain = 0;
    for (let i = 0; i < TICKS; i++) {
      g.player.hp = 1e6;
      if (!g.player.action && !g.player.isMoving && !g.playerStun) g.defaultObjectAction(o);   // caught: try again
      g.update(600); gain += g.skills.xp.thieving - base; g.skills.xp.thieving = base; emptyBag(g);
    }
    return gain * 6000 / TICKS;
  };
  const rate = (id, lvl) => (NPCS[id] ? pocket(id, lvl) : chest(id, lvl));
  const before = { 100: ['villager', 'stall_gem'], 130: ['marina_high_roller'], 160: ['jade_merchant'], 200: ['temple_vault'], 250: ['observatory_chest'], 300: ['smugglers_hold'] };
  for (const t of [...MARKS, ...CHESTS]) {
    const prev = Math.max(...before[t.lvl].map((id) => rate(id, t.lvl))), now = rate(t.id, t.lvl);
    assert.ok(now >= prev * 1.2, `${t.id}: ${Math.round(now)} xp/h vs ${Math.round(prev)} before, at level ${t.lvl}`);
  }
});

// ---------------- Agility ----------------
test('six new courses: 4-5 spread-out obstacles each, in their regions, gated at the course level', () => {
  const g = newGame();
  for (const c of COURSES) {
    const ids = obstaclesOf(c.id);
    assert.ok(ids.length >= 4 && ids.length <= 5, `${c.id}: ${ids.length} obstacles`);
    const obs = ids.map((id) => g.world.objects.find((o) => o.objId === id));
    for (const [i, o] of obs.entries()) {
      assert.ok(o, `${ids[i]} is placed`);
      const d = OBJECTS[ids[i]];
      assert.equal(d.type, 'agility'); assert.equal(d.level, c.lvl); assert.ok(d.markChance > 0, `${ids[i]} counts as a course obstacle`);
      assert.ok(inZone(g, o, c.zone), `${ids[i]} at ${o.x},${o.y} is in ${c.zone}`);
      assert.ok(worldArt().has(`obj-${ids[i]}`) && !d.art && !d.tint, `${ids[i]} has its own untinted picture`);
    }
    // One course: the game groups obstacles within 12 tiles, so they must all be, and no others.
    for (const o of obs) assert.deepEqual(new Set(g._agilityCourse(o).map((x) => x.objId)), new Set(ids), `${c.id} is one course`);
    // Spread out: a lap walks a fair way, not tile to tile.
    let walk = 0;
    for (let i = 0; i < obs.length; i++) walk += chebyshev(obs[i].x, obs[i].y, obs[(i + 1) % obs.length].x, obs[(i + 1) % obs.length].y);
    assert.ok(walk >= 25, `${c.id}: a lap is ${walk} tiles`);
    assert.ok(reachable(g, obs), `${c.id} can be walked`);
    assert.ok(guideEntries('agility').some((e) => e.level === c.lvl && ids.some((id) => e.objIds?.includes(id))), `${c.id} in the Agility guide`);
  }
});

test('a new course: refused below its level, and a full lap pays the bonus and a mark', () => {
  for (const c of COURSES) {
    const g = newGame();
    const said = listen(g);
    const obs = obstaclesOf(c.id).map((id) => g.world.objects.find((o) => o.objId === id));
    setLevel(g, 'agility', c.lvl - 1);
    assert.equal(g.resolveAgility(obs[0]), false);
    assert.ok(said.some((s) => s.includes(`Agility level ${c.lvl}`)));
    setLevel(g, 'agility', c.lvl);
    g.inventory.remove('mark_of_grace', g.inventory.count('mark_of_grace'));
    for (const o of obs) g.resolveAgility(o);
    assert.ok(said.some((s) => s.includes('complete a lap')), `${c.id}: lap complete`);
    assert.ok(g.inventory.has('mark_of_grace'), 'and a mark');
  }
});

test('endgame Agility XP an hour (marks included): each course well ahead of the best before it', () => {
  const TICKS = 1500;
  const rate = (firstId, lvl) => {
    const g = newGame();
    setLevel(g, 'agility', lvl);
    g.toggleAutoGather(true);
    const first = g.world.objects.find((o) => o.objId === firstId);
    standBy(g, first);
    g.defaultObjectAction(first);
    const base = g.skills.xp.agility;
    let gain = 0, marks = 0;
    for (let i = 0; i < TICKS; i++) {
      g.update(600); g.runEnergy = 100;
      gain += g.skills.xp.agility - base; g.skills.xp.agility = base;
      marks += g.inventory.count('mark_of_grace'); g.inventory.remove('mark_of_grace', g.inventory.count('mark_of_grace'));
    }
    return (gain + marks * g.markOfGraceXp() * 20) * 6000 / TICKS;
  };
  let prev = 'agility_balance';
  for (const c of COURSES) {
    const first = obstaclesOf(c.id)[0];
    const before = rate(prev, c.lvl), now = rate(first, c.lvl);
    assert.ok(now >= before * 1.2, `${c.id}: ${Math.round(now)} xp/h vs ${prev} ${Math.round(before)} at level ${c.lvl}`);
    prev = first;
  }
});

test('casino chips sell at the general store and have their own sticker', () => {
  assert.ok(ITEMS.casino_chip.stackable);
  const html = itemIconSVG('casino_chip', 24);
  assert.ok(html.includes('assets/icons/item-casino_chip.webp') && !html.includes('filter:'), 'the chip has its own sticker');
  assert.ok(Object.values(SHOPS).some((s) => s.buysAnything), 'a shop takes anything');
});
