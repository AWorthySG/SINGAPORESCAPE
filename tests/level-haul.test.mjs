// A bigger haul as you level (src/game/levelhaul.js): each gather has a
// +0.2%-a-level chance (up to 50%) of a bonus one of what it gave, with its
// XP, never taken from the tree or rock.
import './seed.mjs';   // seeded Math.random (and LEVEL_HAUL off before every test)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { LEVEL_HAUL, levelHaulPct, levelHaul, setHaulRand, LEVEL_HAUL_CAP } from '../src/game/levelhaul.js';
import { mulberry32 } from '../src/game/pets.js';
import { toolLadderHTML } from '../src/ui/skillguideui.js';

beforeEach(() => { LEVEL_HAUL.on = true; });
afterEach(() => setHaulRand(mulberry32(5)));

test('the bonus-haul chance climbs steadily and stops at the cap', () => {
  assert.equal(levelHaulPct(1), 0);
  assert.ok(Math.abs(levelHaulPct(51) - 10) < 1e-9);
  assert.ok(Math.abs(levelHaulPct(99) - 19.6) < 1e-9);
  assert.equal(levelHaulPct(251), LEVEL_HAUL_CAP);
  assert.equal(levelHaulPct(9999), LEVEL_HAUL_CAP);
  for (let l = 2; l < 260; l++) assert.ok(levelHaulPct(l) >= levelHaulPct(l - 1));
});

function newGame() {
  const m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave(); const g = new Game(); g.start(); g.chooseStartingStyle('melee'); g.ui = new Proxy({}, { get: () => () => {} }); g.npcs = [];
  for (const t of ['bronze_axe', 'bronze_pickaxe']) if (!g.inventory.has(t)) g.inventory.add(t, 1);
  return g;
}

test('a bonus haul adds one more of what you gathered, with its XP, and never takes from the node', () => {
  const g = newGame();
  g.skills.xp.woodcutting = xpForLevel(99);
  const tree = g.world.objects.find((o) => o.objId === 'tree' && !o.depleted);
  tree.logsLeft = 15;
  const before = g._bagCounts();
  g.inventory.add('logs', 1); g.inventory.add('birds_nest', 1);   // as if a swing gave a log and a nest
  const x0 = g.skills.xp.woodcutting;
  setHaulRand(() => 0);   // under any chance above 0
  assert.equal(levelHaul(g, { type: 'woodcut' }, tree, before), 'logs', 'the log, not the nest');
  assert.equal(g.inventory.count('logs') - (before.get('logs') || 0), 2);
  assert.ok(g.skills.xp.woodcutting > x0, 'with its XP');
  assert.equal(tree.logsLeft, 15, 'the tree keeps its logs');
  // At level 1 there's no chance; a making action never gets it; the switch turns it off.
  g.skills.xp.woodcutting = 0;
  assert.equal(levelHaul(g, { type: 'woodcut' }, tree, before), null);
  assert.equal(levelHaul(g, { type: 'smelt' }, tree, before), null);
  LEVEL_HAUL.on = false; g.skills.xp.woodcutting = xpForLevel(99);
  assert.equal(levelHaul(g, { type: 'woodcut' }, tree, before), null);
});

test('in play, a high-level miner gets about the bonus share more ore from the same rocks', () => {
  const ore = (lvl, on) => {
    LEVEL_HAUL.on = on; setHaulRand(mulberry32(11));
    const g = newGame();
    g.skills.xp.mining = xpForLevel(lvl);
    const rock = g.world.objects.find((o) => o.objId === 'copper_rock' && !o.depleted);
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const x = rock.x + dx, y = rock.y + dy; if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; break; } }
    rock.def = { ...rock.def, depleteChance: 0 };
    rock.oresLeft = 1e9;   // never runs dry, so only the haul counts
    const n0 = g.inventory.count('copper_ore');
    g.defaultObjectAction(rock);
    for (let i = 0; i < 400; i++) { g.update(600); if (!g.player.action) g.defaultObjectAction(rock); }
    return g.inventory.count('copper_ore') - n0;
  };
  const off = ore(200, false), on = ore(200, true);
  assert.ok(on > off * 1.25 && on < off * 1.6, `about 40% more at level 200 (${on} vs ${off})`);
});

test('the Tools section of a gathering guide shows the chance', () => {
  const g = newGame();
  g.skills.xp.mining = xpForLevel(99);
  assert.match(toolLadderHTML(g, 'mining'), /19\.6% chance of a bonus one with each haul/);
});
