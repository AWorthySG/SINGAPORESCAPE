// Endgame Mining and Smithing (levels 100-300): the six new rock clusters, the
// ores and bars they give, and the anvil recipes for the obsidian to eternal
// gear that used to come only from monster drops.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { SMELT, SMITH } from '../src/data/smithing.js';
import { xpForLevel } from '../src/data/xp.js';
import { chebyshev } from '../src/core/utils.js';
import { findPath } from '../src/engine/pathfinding.js';
import { guideEntries } from '../src/game/skillguide.js';
import { itemIconSVG } from '../src/render/icons.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];   // nothing to interrupt the work
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
const step = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };
// Stand the player on a free tile next to an object.
function standBy(g, obj) {
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}

// Tier, rock, its ore, its bar, and the region the rock is found in.
const TIERS = [
  { lvl: 100, rock: 'obsidian_vein', ore: 'obsidian_shard', bar: 'obsidian_bar', metal: 'obsidian', zone: 'Tekong Badlands' },
  { lvl: 130, rock: 'orichalcum_rock', ore: 'orichalcum_ore', bar: 'orichalcum_bar', metal: 'orichalcum', zone: 'Tuas Docklands' },
  { lvl: 160, rock: 'jade_seam', ore: 'raw_jade', bar: 'jade_bar', metal: 'jade', zone: 'Temasek Ruins' },
  { lvl: 200, rock: 'fallen_star', ore: 'starmetal_ore', bar: 'starmetal_bar', metal: 'starmetal', zone: 'The Celestial Peaks' },
  { lvl: 250, rock: 'skyglass_crystal', ore: 'celestial_crystal', bar: 'celestial_bar', metal: 'celestial', zone: 'The Celestial Peaks' },
  { lvl: 300, rock: 'eternal_lode', ore: 'eternal_ore', bar: 'eternal_bar', metal: 'eternal', zone: 'The Shadow Rift' },
];

test('endgame rocks: a cluster of each in its region, every rock reachable', () => {
  const g = newGame();
  const cfg = g.pathCfg();
  for (const t of TIERS) {
    const def = OBJECTS[t.rock];
    assert.equal(def.type, 'rock'); assert.equal(def.level, t.lvl); assert.equal(def.gives, t.ore);
    assert.ok(ITEMS[t.ore] && ITEMS[t.bar], `${t.ore} and ${t.bar} exist`);
    const rocks = g.world.objects.filter((o) => o.objId === t.rock);
    assert.ok(rocks.length >= 6, `${t.rock}: ${rocks.length} placed`);
    const zone = g.world.zones.find((z) => z.name === t.zone);
    for (const r of rocks) assert.ok(r.x >= zone.x0 && r.x <= zone.x1 && r.y >= zone.y0 && r.y <= zone.y1, `${t.rock} at ${r.x},${r.y} is in ${t.zone}`);
    // One cluster: all within a few tiles of each other, so auto gather keeps going.
    assert.ok(rocks.every((r) => chebyshev(r.x, r.y, rocks[0].x, rocks[0].y) <= 8), `${t.rock} rocks are clustered`);
    // Every rock can be walked up to from the region's nearest MRT station.
    const mrt = g.world.objects.filter((o) => o.objId === 'mrt_station')
      .reduce((a, b) => (chebyshev(b.x, b.y, rocks[0].x, rocks[0].y) < chebyshev(a.x, a.y, rocks[0].x, rocks[0].y) ? b : a));
    const from = [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 2]].map(([dx, dy]) => ({ x: mrt.x + dx, y: mrt.y + dy })).find((p) => !g.world.isBlocked(p.x, p.y));
    for (const r of rocks) {
      assert.ok(chebyshev(r.x, r.y, mrt.x, mrt.y) >= 8, `${t.rock} at ${r.x},${r.y} leaves the station clear`);
      assert.ok(findPath(cfg, from, { x: r.x, y: r.y }, { reachAdjacent: true }).length > 0, `${t.rock} at ${r.x},${r.y} is reachable`);
    }
  }
});

test('endgame rocks: mined at the right level for their ore, refused below it', () => {
  const g = newGame();
  if (!g.inventory.has('bronze_pickaxe')) g.inventory.add('bronze_pickaxe', 1);
  for (const t of TIERS) {
    const rock = g.world.objects.find((o) => o.objId === t.rock);
    standBy(g, rock);
    setLevel(g, 'mining', t.lvl - 1);
    const said = [];
    const msg = g.msg.bind(g);
    g.msg = (m, c) => { said.push(m); return msg(m, c); };
    g.defaultObjectAction(rock);
    step(g, 6);
    assert.equal(g.inventory.count(t.ore), 0, `no ${t.ore} below Mining ${t.lvl}`);
    assert.ok(said.some((m) => m.includes(`Mining level of ${t.lvl}`)), 'told the level it needs');
    setLevel(g, 'mining', t.lvl);
    const xp0 = g.skills.xp.mining;
    g.defaultObjectAction(rock);
    step(g, 8);
    assert.ok(g.inventory.count(t.ore) >= 1, `mined ${t.ore}`);
    assert.ok(g.skills.xp.mining > xp0, 'and earned Mining XP');
    g.msg = msg;
  }
});

test('endgame bars: smelt at a furnace from ore and coal, at their Smithing level', () => {
  const g = newGame();
  const furnace = g.world.objects.find((o) => o.def.type === 'furnace');
  standBy(g, furnace);
  let prevXp = SMELT.find((r) => r.result === 'rune_bar').xp;
  for (const t of TIERS) {
    const r = SMELT.find((s) => s.result === t.bar);
    assert.ok(r, `${t.bar} has a smelting recipe`);
    assert.equal(r.level, t.lvl);
    assert.ok(r.inputs.some((i) => i.id === t.ore), `${t.bar} is smelted from ${t.ore}`);
    assert.ok(r.xp >= prevXp * 1.3, `${t.bar} smelts for about 35% more xp than the tier before`);
    prevXp = r.xp;
    for (const i of r.inputs) g.inventory.add(i.id, i.qty * 3);
    setLevel(g, 'smithing', t.lvl - 1);
    g.startSmelt(r, furnace); step(g, 3);
    assert.equal(g.inventory.count(t.bar), 0, `no ${t.bar} below Smithing ${t.lvl}`);
    setLevel(g, 'smithing', t.lvl);
    g.startSmelt(r, furnace); step(g, 3);
    assert.ok(g.inventory.count(t.bar) >= 3, `smelted ${t.bar}`);
    assert.equal(g.inventory.count(t.ore), 0, 'using up the ore');
    g.inventory.remove(t.bar, g.inventory.count(t.bar));
  }
});

test('endgame smithing: every metal melee weapon and plate piece of each tier, at the tier level and up', () => {
  const PIECES = ['dagger', 'sword', 'scimitar', 'mace', 'longsword', 'battleaxe', 'warhammer', '2h_sword', 'spear', 'claws', 'katana', 'halberd',
    'med_helm', 'full_helm', 'chainbody', 'platebody', 'platelegs', 'plateskirt', 'sq_shield', 'kiteshield', 'buckler', 'gauntlets', 'boots'];
  let prevBest = Math.max(...SMITH.filter((r) => r.bar === 'rune_bar' && !r.upgrade).map((r) => r.xp));
  for (const t of TIERS) {
    for (const p of PIECES) {
      const r = SMITH.find((s) => s.result === `${t.metal}_${p}`);
      assert.ok(r, `${t.metal}_${p} can be smithed`);
      assert.equal(r.bar, t.bar);
      assert.ok(r.level >= t.lvl && r.level < t.lvl + 20, `${r.result} at Smithing ${r.level}`);
    }
    // Gathering tools (tooltiers.js) are forged from the same bars, but aren't gear.
    const recs = SMITH.filter((s) => s.bar === t.bar && !ITEMS[s.result]?.tool);
    for (const r of recs) assert.ok(ITEMS[r.result]?.equip || ITEMS[r.result]?.roundStr, `${r.result} is real gear (or gun rounds)`);
    // One piece is forged a tick, so a tier's best piece is its XP an hour at the anvil.
    const best = Math.max(...recs.map((r) => r.xp));
    assert.ok(best >= prevBest * 1.35, `${t.metal}: best piece ${best} xp vs ${prevBest} before`);
    prevBest = best;
  }
  // The guide lists the new recipes, and the Mining guide the new rocks.
  assert.ok(guideEntries('smithing').some((e) => e.label === ITEMS.eternal_platebody.name && e.level === 314));
  for (const t of TIERS) assert.ok(guideEntries('mining').some((e) => e.objIds?.includes(t.rock) && e.level === t.lvl), `${t.rock} in the Mining guide`);
});

test('smithed endgame gear needs the level and comes out plain (no quality, no mastery head start)', () => {
  const g = newGame();
  if (!g.inventory.has('hammer')) g.inventory.add('hammer', 1);
  const anvil = g.world.objects.find((o) => o.def.type === 'anvil');
  standBy(g, anvil);
  const r = SMITH.find((s) => s.result === 'obsidian_platebody');
  g.inventory.add('obsidian_bar', 10);
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (m, c) => { said.push(m); return msg(m, c); };
  setLevel(g, 'smithing', r.level - 1);
  g.startSmith(r, anvil); step(g, 3);
  assert.equal(g.inventory.count('obsidian_platebody'), 0, 'too low a level forges nothing');
  assert.ok(said.some((m) => m.includes(`Smithing level of ${r.level}`)));
  setLevel(g, 'smithing', r.level);
  g.startSmith(r, anvil); step(g, 4);
  assert.ok(g.inventory.count('obsidian_platebody') >= 2, 'forged from 5 bars each');
  assert.equal(g.equipment.masteryRank('obsidian_platebody'), 0, 'no quality roll: mastery stays where it was');
  assert.ok(!said.some((m) => /^(Fine|Superior|Epic|Legendary|Mythic) /.test(m)), 'no quality message');
});

test('endgame ores and bars have their own sticker art', () => {
  for (const t of TIERS) {
    for (const id of [t.ore, t.bar]) assert.ok(itemIconSVG(id, 24).includes(`assets/icons/item-${id}.webp`), `${id} has its own art`);
  }
});

test('endgame Mining XP an hour: each tier well ahead of the one before, from granite up', () => {
  // A short auto-gather run at each rock, at its unlock level, with XP pinned
  // so the level doesn't change mid-run. (Measured over longer runs each step
  // is ~1.36-1.39x; the bar here leaves room for the dice.)
  const TICKS = 600;
  const rate = (rockId, lvl) => {
    const g = newGame();
    if (!g.inventory.has('bronze_pickaxe')) g.inventory.add('bronze_pickaxe', 1);
    setLevel(g, 'mining', lvl);
    const all = g.world.objects.filter((o) => o.objId === rockId);
    const near = (o) => all.filter((p) => chebyshev(p.x, p.y, o.x, o.y) <= 15).length;
    const start = all.reduce((a, b) => (near(b) > near(a) ? b : a));
    standBy(g, start);
    g.toggleAutoGather(true);
    g.defaultObjectAction(start);
    const base = g.skills.xp.mining;
    let gain = 0;
    for (let i = 0; i < TICKS; i++) {
      g.update(600);
      gain += g.skills.xp.mining - base; g.skills.xp.mining = base;
      // An endless bag: drop what was mined so the run never stops for space.
      for (const id of ['granite', ...TIERS.map((t) => t.ore), 'sapphire', 'emerald', 'ruby', 'diamond']) g.inventory.remove(id, g.inventory.count(id));
    }
    return gain * 6000 / TICKS;
  };
  let prev = rate('granite_rock', 100);
  for (const t of TIERS) {
    const r = rate(t.rock, t.lvl);
    assert.ok(r >= prev * 1.3, `${t.rock}: ${Math.round(r)} xp/h vs ${Math.round(prev)} before`);
    prev = r;
  }
});
