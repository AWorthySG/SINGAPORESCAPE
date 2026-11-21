// The whole tree, the whole seam (src/game/jackpot.js): now and then a swing
// takes every log left in a tree, or every ore left in a rock, at once, with
// XP for each, and the tree falls or the rock is mined out.
import './seed.mjs';   // seeded Math.random (and NODE_JACKPOT off before every test)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { resolveWoodcut, resolveMine } from '../src/game/skilling.js';
import { NODE_JACKPOT, JACKPOT_CHANCE, setJackpotRand, nodeJackpot } from '../src/game/jackpot.js';
import { mulberry32 } from '../src/game/pets.js';
import { SKILL_GUIDES } from '../src/game/skillguide.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];
  g.skills.xp.woodcutting = xpForLevel(60); g.skills.xp.mining = xpForLevel(60);
  for (const id of ['bronze_axe', 'bronze_pickaxe']) if (!g.inventory.has(id)) g.inventory.add(id, 1);
  return g;
}
const listen = (g) => { const said = []; const msg = g.msg.bind(g); g.msg = (m, c) => { said.push(m); return msg(m, c); }; return said; };
const find = (g, id) => g.world.objects.find((o) => o.objId === id && !o.depleted);

beforeEach(() => { NODE_JACKPOT.on = true; });
afterEach(() => { setJackpotRand(mulberry32(1)); });

test('a lucky swing brings the whole tree down: every log left, XP for each, and the tree falls', () => {
  const g = newGame(); const said = listen(g);
  const tree = find(g, 'tree');
  tree.logsLeft = 15;
  const logs0 = g.inventory.count(tree.def.gives), xp0 = g.skills.xp.woodcutting;
  setJackpotRand(() => 0);   // the jackpot hits
  const going = resolveWoodcut(g, { obj: tree });
  assert.equal(going, false, 'nothing left to chop');
  assert.equal(tree.depleted, true, 'the tree falls');
  assert.equal(tree.logsLeft, undefined, 'a fresh count once it regrows');
  const got = g.inventory.count(tree.def.gives) - logs0;
  assert.ok(got === 15 || got === 16, `all 15 logs (one more from a double): ${got}`);
  assert.ok(g.skills.xp.woodcutting - xp0 >= tree.def.xp * 15 - 1e-6, 'XP for every log');
  assert.ok(said.some((m) => /^The whole tree comes down at once: \d+ /.test(m)));
});

test('a lucky swing breaks the whole seam free: every ore left, and the rock is mined out', () => {
  const g = newGame(); const said = listen(g);
  const rock = find(g, 'copper_rock');
  rock.oresLeft = 12;
  const ore0 = g.inventory.count('copper_ore'), xp0 = g.skills.xp.mining;
  setJackpotRand(() => 0);
  assert.equal(resolveMine(g, { obj: rock }), false);
  assert.equal(rock.depleted, true);
  const got = g.inventory.count('copper_ore') - ore0;
  assert.ok(got === 12 || got === 13, `all 12 ores (one more from a rich seam): ${got}`);
  assert.ok(g.skills.xp.mining - xp0 >= rock.def.xp * 12 - 1e-6);
  assert.ok(said.some((m) => /^The whole seam breaks free: \d+ copper ore!$/.test(m)));
  // A gem rock rolls a gem for each piece.
  const gems = find(g, 'gem_rock');
  if (gems) {
    gems.oresLeft = 10;
    const before = g.inventory.slots.filter(Boolean).reduce((n, s) => n + s.qty, 0);
    assert.equal(resolveMine(g, { obj: gems }), false);
    const after = g.inventory.slots.filter(Boolean).reduce((n, s) => n + s.qty, 0);
    assert.ok(after - before >= 10, 'ten gems');
  }
});

test('an unlucky swing changes nothing, and it is about 1 in 40', () => {
  const g = newGame();
  const tree = find(g, 'tree');
  tree.logsLeft = 15;
  setJackpotRand(() => 0.99);
  assert.equal(resolveWoodcut(g, { obj: tree }), true, 'keep chopping');
  assert.ok(tree.logsLeft >= 13 && tree.logsLeft <= 14, 'one log (or two) out of the tree');
  // The odds, straight from the roll.
  setJackpotRand(mulberry32(42));
  let hits = 0;
  const fake = { inventory: { canAdd: () => 1, add() {} }, skills: { addXp() {} }, msg() {}, bus: { emit() {} }, player: {} };
  const obj = { x: 0, y: 0, def: {} };
  for (let i = 0; i < 20000; i++) if (nodeJackpot(fake, obj, { kind: 'mining', left: 1, xpEach: 1, pick: () => 'copper_ore' })) hits++;
  assert.ok(Math.abs(hits / 20000 - JACKPOT_CHANCE) < 0.006, `about ${JACKPOT_CHANCE} (${hits / 20000})`);
  assert.equal(JACKPOT_CHANCE, 0.025);
});

test('the last log or ore is never a jackpot, and the switch turns it all off', () => {
  const g = newGame();
  setJackpotRand(() => 0);
  const tree = find(g, 'tree');
  tree.logsLeft = 1;
  const said = listen(g);
  resolveWoodcut(g, { obj: tree });
  assert.ok(!said.some((m) => m.startsWith('The whole tree')), 'nothing left to take');
  NODE_JACKPOT.on = false;
  const rock = find(g, 'copper_rock');
  rock.oresLeft = 12;
  assert.equal(resolveMine(g, { obj: rock }), true, 'off: an ordinary swing');
});

test('the skill guides mention it', () => {
  assert.match(SKILL_GUIDES.woodcutting.use, /whole tree down at once/);
  assert.match(SKILL_GUIDES.mining.use, /whole seam free at once/);
});
