// Every upgraded gathering tool can be smithed at an anvil (smithing.js): axes,
// pickaxes, harpoons, fishing rods and hunting snares, iron to eternal, and the
// anvil's menu shows them first ("Gathering tools").
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { SMITH, smithToolRows, SMITH_TOOL_KINDS } from '../src/data/smithing.js';
import { TOOL_TIERS, toolId } from '../src/data/tooltiers.js';

test('every tool tier past the bought ones has an anvil recipe', () => {
  for (const [tag] of SMITH_TOOL_KINDS) {
    TOOL_TIERS.forEach((T, i) => {
      if (i === 0 && tag !== 'axe' && tag !== 'pickaxe') return;
      const r = SMITH.find((s) => s.result === toolId(tag, i));
      assert.ok(r, `${toolId(tag, i)} can be smithed`);
      assert.equal(r.bar, `${T.metal}_bar`);
      assert.ok(r.upgrade, 'never made by "Smith all"');
    });
  }
});

test('the anvil lists the tools you can make, and the next tier up, first', () => {
  const at1 = smithToolRows(1).map((r) => r.result);
  assert.ok(at1.includes('iron_rod') && at1.includes('iron_snare') && at1.includes('iron_pickaxe'), 'the next tier up shows from the start');
  assert.ok(!at1.includes('steel_rod'), 'not every tier at once');
  const at72 = smithToolRows(72).filter((r) => r.toolTag === 'pickaxe').map((r) => r.result);
  assert.deepEqual(at72.slice(0, 2), ['rune_pickaxe', 'adamant_pickaxe'], 'best first: the next tier, then the best you can make');
});

test('a smith hammers an iron fishing rod and an iron snare from bars', () => {
  const m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave(); const g = new Game(); g.start(); g.chooseStartingStyle('melee'); g.ui = new Proxy({}, { get: () => () => {} }); g.npcs = [];
  g.skills.xp.smithing = xpForLevel(30);
  if (!g.inventory.has('hammer')) g.inventory.add('hammer', 1);
  const anvil = g.world.objects.find((o) => o.def.type === 'anvil');
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const x = anvil.x + dx, y = anvil.y + dy; if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; break; } }
  for (const id of ['iron_rod', 'iron_snare']) {
    g.inventory.add('iron_bar', 2);
    g.startSmith(SMITH.find((s) => s.result === id), anvil);
    for (let i = 0; i < 6; i++) g.update(600);
    assert.equal(g.inventory.count(id), 1, `smithed ${id}`);
  }
});
