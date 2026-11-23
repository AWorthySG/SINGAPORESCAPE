// The gathering skills pay alike: Woodcutting, Mining and Hunter about the same
// XP an hour at each level, Fishing about a quarter more (GATHER_XP_MULT and
// NODE_XP_TUNE, objects.js), and the biggest farm a little more than their
// average, as it has fewer extras in play (FARM_XP_MULT and CROP_XP_TUNE,
// trades.js). Each skill is worked the way a player would: auto gather at its
// best node for the level, the best tool the level allows, an endless bag.
// (The extras, golden hours to whole seams, are off here: tests/seed.mjs.)
import { SEED, seedRandom } from './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { xpForLevel } from '../src/data/xp.js';
import { TOOL_TIERS, toolId } from '../src/data/tooltiers.js';
import { chebyshev } from '../src/core/utils.js';
import { CROPS, CROP_BY_SEED } from '../src/data/trades.js';
import { HOME_UPGRADES } from '../src/game/home.js';

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
const noon = (g) => { g.playMs = 0.5 * 10 * 60 * 1000; };   // no night bonuses (moonfish, moonlit kapok)
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
// The tiered tools each skill works with; the net and lobster pot have no tiers.
const TOOLS = { fishing: ['rod', 'harpoon'], woodcutting: ['axe'], mining: ['pickaxe'], hunter: ['snare'] };

// XP an hour from auto gather at the densest cluster of node `id`, XP pinned at `lvl`.
function rate(skill, id, lvl, ticks, seed) {
  seedRandom(seed);
  const g = newGame();
  g.skills.xp[skill] = xpForLevel(lvl);
  const tier = TOOL_TIERS.reduce((b, t, i) => (t.level <= lvl ? i : b), 0);
  for (const tag of TOOLS[skill]) g.inventory.add(toolId(tag, tier), 1);
  if (skill === 'fishing') for (const id2 of ['small_net', 'lobster_pot']) if (!g.inventory.has(id2)) g.inventory.add(id2, 1);
  noon(g);
  const all = g.world.objects.filter((o) => o.objId === id);
  const near = (o) => all.filter((p) => chebyshev(p.x, p.y, o.x, o.y) <= 15).length;
  const start = all.reduce((a, b) => (near(b) > near(a) ? b : a));
  const [dx, dy] = ADJ.find(([ax, ay]) => !g.world.isBlocked(start.x + ax, start.y + ay) && !g.world.objectAt(start.x + ax, start.y + ay));
  g.player.x = g.player.tx = start.x + dx; g.player.y = g.player.ty = start.y + dy;
  g.toggleAutoGather(true);
  g.defaultObjectAction(start);
  const base = g.skills.xp[skill];
  let gain = 0;
  for (let i = 0; i < ticks; i++) {
    g.update(600); noon(g);
    gain += g.skills.xp[skill] - base; g.skills.xp[skill] = base;
    // An endless bag: keep only the tools.
    for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s && !ITEMS[s.id]?.tool) g.inventory.removeAt(k, s.qty); }
  }
  return gain * 6000 / ticks;
}

// The best node of each skill at each level (Fishing: one fish to a spot since
// Nov 2026, so the best spot is the newest one open). Fishing spots never deplete and
// need no walking, so one run is exact; the others walk between nodes that run
// dry at random, so each is the mean of two seeded runs. Measured once, shared
// by both tests below.
const TICKS = 800;
const BEST = [
  { lvl: 10, fishing: 'sardine_spot', woodcutting: 'bamboo', mining: 'limestone_rock', hunter: 'bird_snare' },
  { lvl: 60, fishing: 'cobia_spot', woodcutting: 'yew_tree', mining: 'gem_rock', hunter: 'boar_pit' },
  { lvl: 99, fishing: 'manta_spot', woodcutting: 'magic_tree', mining: 'runite_rock', hunter: 'crocodile_trap' },
  { lvl: 250, fishing: 'rift_eel_spot', woodcutting: 'moonlit_kapok', mining: 'skyglass_crystal', hunter: 'naga_track' },
];
const OTHERS = ['woodcutting', 'mining', 'hunter'];
let measured = null;
function rates() {
  if (measured) return measured;
  measured = BEST.map((b) => {
    const r = { lvl: b.lvl, fishing: rate('fishing', b.fishing, b.lvl, TICKS, SEED) };
    for (const s of OTHERS) r[s] = (rate(s, b[s], b.lvl, TICKS, SEED) + rate(s, b[s], b.lvl, TICKS, SEED + 7919)) / 2;
    r.mid = OTHERS.map((s) => r[s]).sort((x, y) => x - y)[1];
    return r;
  });
  return measured;
}
const show = (r) => [...OTHERS, 'fishing'].map((s) => `${s} ${Math.round(r[s] / 1e3)}k`).join(', ');

test('Woodcutting, Mining and Hunter pay about the same XP an hour at each level', () => {
  // Nov 2026: Mining paid 2-4x Woodcutting and 3-11x Hunter, so the other two
  // were brought up to it (GATHER_XP_MULT and NODE_XP_TUNE, objects.js). Measured
  // with 800-tick runs over two seeds, each came out 0.92-1.10x the middle of the
  // three. (Each tree holds 10-20 logs, and the densest stand of a tree is its
  // grove where it has one, groves.js.)
  for (const r of rates()) {
    for (const s of OTHERS) {
      const x = r[s] / r.mid;
      assert.ok(x >= 0.85 && x <= 1.2, `level ${r.lvl}: ${s} is ${x.toFixed(2)}x the middle (${show(r)})`);
    }
  }
});

test('Fishing XP an hour sits about a quarter above the middle of Woodcutting, Mining and Hunter', () => {
  // Fishing is slower to engage with and levelled too slowly (the owner's call),
  // so it pays about 1.25x the others. Measured with 1000-tick runs the ratio came
  // out 1.19-1.23, 1.22-1.25, 1.23-1.25 and 1.19-1.21 at levels 10, 60, 99 and 250:
  // the bar leaves room for the dice either way.
  for (const r of rates()) {
    const x = r.fishing / r.mid;
    assert.ok(x >= 1.1 && x <= 1.42, `level ${r.lvl}: Fishing is ${x.toFixed(2)}x the middle of the others (${show(r)})`);
  }
});

// XP an hour from auto gather at the biggest farm a player works: the twelve
// Kranji patches and the six of the kampong home beside them (home.js), which
// auto gather tends with them. A farm is mostly waiting for its crops, so its
// XP an hour goes with its patches (the twelve alone earn about two thirds of
// it). Planting the newest crop the level allows (each pays more than the ones
// before it at its own level), XP pinned at `lvl`. Crops take 50-600 ticks to
// grow, so the run covers several harvests of every patch.
function farmRate(lvl, ticks, seed) {
  seedRandom(seed);
  const g = newGame();
  g.home.owned = true; g.home.tiers.patches = HOME_UPGRADES.patches.tiers.length - 1; g.home.refresh();
  g.skills.xp.farming = xpForLevel(lvl);
  const crop = CROPS.filter((c) => c[2] <= lvl).at(-1);
  g.inventory.add(`${crop[0]}_seed`, 1000);
  noon(g);
  const patches = g.world.objects.filter((o) => o.def.type === 'farm');
  const near = (o) => patches.filter((p) => chebyshev(p.x, p.y, o.x, o.y) <= 12).length;
  const start = patches.reduce((a, b) => (near(b) > near(a) ? b : a));
  const [dx, dy] = ADJ.find(([ax, ay]) => !g.world.isBlocked(start.x + ax, start.y + ay) && !g.world.objectAt(start.x + ax, start.y + ay));
  g.player.x = g.player.tx = start.x + dx; g.player.y = g.player.ty = start.y + dy;
  const tended = new Set(), plant = g.plantSeed.bind(g);
  g.plantSeed = (o, id) => { const ok = plant(o, id); if (ok) tended.add(o); return ok; };
  g.toggleAutoGather(true);
  g.defaultObjectAction(start);
  const base = g.skills.xp.farming;
  let gain = 0;
  for (let i = 0; i < ticks; i++) {
    g.update(600); noon(g);
    gain += g.skills.xp.farming - base; g.skills.xp.farming = base;
    for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s && !ITEMS[s.id]?.tool && !CROP_BY_SEED[s.id]) g.inventory.removeAt(k, s.qty); }
  }
  return { crop: crop[0], xp: gain * 6000 / ticks, patches: tended.size };
}

test('the biggest farm pays a little more than the average of Mining, Woodcutting and Fishing an hour', () => {
  // Nov 2026: a farm paid about a hundredth of the others, so every crop was
  // lifted. Farming has fewer extras in play (no streaks, lucky finds or level
  // haul), so with them off a farm pays a little more than the others; golden
  // hours, the unlocks and record harvests (jackpot.js) bring it to about their
  // average in play. Measured with 2400-tick runs, the ratio came out 1.09,
  // 1.42, 1.23 and 1.26 at levels 10, 60, 99 and 250 (at 60 this test mines the
  // gem rock, which pays less than the mithril rock the crops were tuned against).
  for (const r of rates()) {
    const avg = (r.mining + r.woodcutting + r.fishing) / 3;
    const f = farmRate(r.lvl, 2400, SEED);
    assert.equal(f.patches, 18, `level ${r.lvl}: auto gather tends the farm's twelve patches and the home's six`);
    const x = f.xp / avg;
    assert.ok(x >= 1 && x <= 1.6, `level ${r.lvl}: a farm of ${f.crop} pays ${x.toFixed(2)}x the average (${Math.round(f.xp / 1e3)}k vs ${show(r)})`);
  }
});
