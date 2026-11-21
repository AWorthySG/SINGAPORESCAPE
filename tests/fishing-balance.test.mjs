// Fishing keeps pace with the other gathering skills (Nov 2026: Fishing paid
// 0.53-0.96x the middle of Woodcutting, Mining and Hunter at most levels, so
// its spots were lifted in NODE_XP_TUNE, objects.js). Each skill is worked
// the way a player would: auto gather at its best node for the level, the
// best tool the level allows, an endless bag.
import { SEED, seedRandom } from './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { xpForLevel } from '../src/data/xp.js';
import { TOOL_TIERS, toolId } from '../src/data/tooltiers.js';
import { chebyshev } from '../src/core/utils.js';

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

test('Fishing XP an hour sits at or a little above the middle of Woodcutting, Mining and Hunter', () => {
  // The best node of each skill at each level. Fishing spots never deplete and
  // need no walking, so one run is exact; the others walk between nodes that
  // run dry at random, so each is the mean of two seeded runs. Measured with
  // 1000-1500-tick runs the ratio came out 1.02, 1.11, 1.15 and 1.07 (from 0.54,
  // 0.96, 0.82 and 0.53 before): the bar leaves room for the dice either way.
  const TICKS = 800;
  const BEST = [
    { lvl: 10, fishing: 'fishing_spot', woodcutting: 'bamboo', mining: 'limestone_rock', hunter: 'bird_snare' },
    { lvl: 60, fishing: 'harpoon_spot', woodcutting: 'yew_tree', mining: 'gem_rock', hunter: 'boar_pit' },
    { lvl: 99, fishing: 'harpoon_spot', woodcutting: 'magic_tree', mining: 'runite_rock', hunter: 'boar_pit' },
    { lvl: 250, fishing: 'rift_eel_spot', woodcutting: 'moonlit_kapok', mining: 'skyglass_crystal', hunter: 'naga_track' },
  ];
  for (const b of BEST) {
    const fish = rate('fishing', b.fishing, b.lvl, TICKS, SEED);
    const others = ['woodcutting', 'mining', 'hunter'].map((s) => (rate(s, b[s], b.lvl, TICKS, SEED) + rate(s, b[s], b.lvl, TICKS, SEED + 7919)) / 2);
    const mid = others.sort((x, y) => x - y)[1];
    const r = fish / mid;
    assert.ok(r >= 0.95 && r <= 1.4, `level ${b.lvl}: Fishing ${Math.round(fish)} xp/h is ${r.toFixed(2)}x the middle of the others (${others.map(Math.round).join(', ')})`);
  }
});
