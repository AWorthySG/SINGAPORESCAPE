// World bosses drop gathering tools (src/game/bosstools.js): now and then a
// boss in the open world leaves an axe, pickaxe, rod, harpoon or snare of the
// best metal its level reaches, iron at least.
import './seed.mjs';
import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ALL_BOSS_IDS } from '../src/data/npcs.js';
import { TOOL_TIERS, TOOL_KINDS, toolIds } from '../src/data/tooltiers.js';
import { bossToolTier, bossToolDrop, setBossToolRand, BOSS_TOOL_CHANCE, BOSS_TOOLS } from '../src/game/bosstools.js';
import { mulberry32 } from '../src/game/pets.js';

beforeEach(() => { BOSS_TOOLS.on = true; });
afterEach(() => setBossToolRand(mulberry32(3)));
const tierOf = (metal) => TOOL_TIERS.findIndex((t) => t.metal === metal);

test('a boss drops the best tool metal its level reaches, never below iron', () => {
  assert.equal(bossToolTier(1), tierOf('iron'));
  assert.equal(bossToolTier(20), tierOf('iron'));
  assert.equal(bossToolTier(70), tierOf('adamant'));
  assert.equal(bossToolTier(99), tierOf('rune'));
  assert.equal(bossToolTier(130), tierOf('orichalcum'));
  assert.equal(bossToolTier(5000), tierOf('eternal'));
  assert.ok(BOSS_TOOL_CHANCE > 0.2 && BOSS_TOOL_CHANCE < 0.6);
});

test('only world bosses drop tools, of every kind, and a real boss kill carries one', () => {
  const m = new Map(); globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave(); const g = new Game(); g.start(); g.chooseClass('swordsman'); g.ui = new Proxy({}, { get: () => () => {} });
  const boss = g.spawnNpc(ALL_BOSS_IDS[0], g.player.x + 2, g.player.y, { wander: 0 });
  setBossToolRand(() => 0);   // always drops, the first kind
  const d = bossToolDrop(boss);
  assert.ok(d, 'a world boss drops one');
  assert.ok(toolIds(TOOL_KINDS[0].tag).includes(d[0]), `an ${TOOL_KINDS[0].tag} (${d[0]})`);
  // Not from the Endless Gate's bosses, temporary ones or plain monsters.
  assert.equal(bossToolDrop({ ...boss, def: boss.def, wave: 3 }), null);
  assert.equal(bossToolDrop({ ...boss, def: boss.def, temporary: true }), null);
  const mob = g.npcs.find((n) => !n.def.boss && n.def.attackable);
  assert.equal(bossToolDrop(mob), null);
  // Every kind comes up.
  let i = 0; const seen = new Set();
  setBossToolRand(() => { i++; return i % 2 ? 0 : ((i / 2) % TOOL_KINDS.length) / TOOL_KINDS.length + 0.01; });
  for (let k = 0; k < 20; k++) { const x = bossToolDrop(boss); if (x) seen.add(TOOL_KINDS.find((t) => toolIds(t.tag).includes(x[0])).tag); }
  assert.equal(seen.size, TOOL_KINDS.length, 'axes, pickaxes, rods, harpoons and snares');
  // In a real kill's loot.
  setBossToolRand(() => 0);
  const said = []; const msg = g.msg.bind(g); g.msg = (t, c) => { said.push(t); return msg(t, c); };
  let got = null; g._autoLoot = (loot) => { got = loot; };   // the kill's loot, as it goes to be picked up
  g.rollDrops(boss);
  assert.ok(said.some((t) => /^Tool drop! /.test(t)), 'announced');
  assert.ok(got && got.some((e) => toolIds(TOOL_KINDS[0].tag).includes(e[0])), 'in the loot');
});
