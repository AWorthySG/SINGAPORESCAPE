// Mining in a late game: a whole seam tells the bag once, not once per ore;
// the level haul counts the bag in one pass; and a folded bag skips redraws
// until it is opened (ui.js renderInventory).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { NODE_JACKPOT, setJackpotRand } from '../src/game/jackpot.js';
import { resolveMine } from '../src/game/skilling.js';

test('a whole seam adds its hundreds of ores with a handful of bag updates', () => {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseClass('rogue'); g.ui = new Proxy({}, { get: () => () => {} });
  g.skills.xp.mining = xpForLevel(60);
  if (!g.inventory.has('bronze_pickaxe')) g.inventory.add('bronze_pickaxe', 1);
  const rock = g.world.objects.find((o) => o.objId === 'copper_rock');
  rock.oresLeft = 20;
  NODE_JACKPOT.on = true; setJackpotRand(() => 0);
  let emits = 0;
  g.bus.on('inventory', () => { emits++; });
  const ore0 = g.inventory.count('copper_ore');
  try { resolveMine(g, { obj: rock }); } finally { NODE_JACKPOT.on = false; setJackpotRand(Math.random); }
  assert.ok(g.inventory.count('copper_ore') - ore0 >= 1 + 19 * 10, 'the whole seam, ten times over');
  assert.ok(emits <= 5, `told the bag ${emits} times (was once per ore, about 190)`);
});

test('the level haul counts the bag once, and a folded bag waits to redraw', () => {
  const haul = readFileSync(new URL('../src/game/levelhaul.js', import.meta.url), 'utf8');
  assert.doesNotMatch(haul, /game\.inventory\.count\(sl\.id\)/, 'no count() per slot');
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /this\._invStale = true;\n      return;/);
  assert.match(ui, /if \(view === 'inventory' && this\._invStale\) this\.renderInventory\(\);/);
  assert.match(ui, /if \(key === 'panel' && !collapsed && this\._invStale\) this\.renderInventory\(\);/);
});
