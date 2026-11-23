// The whole tree, the whole seam (src/game/jackpot.js): now and then a swing
// takes every log left in a tree, or every ore left in a rock, at once, with
// XP for each, and the tree falls or the rock is mined out. Hunter's whole
// flock and Farming's record harvest are the same burst for a trap and a patch.
import './seed.mjs';   // seeded Math.random (and NODE_JACKPOT off before every test)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { resolveWoodcut, resolveMine, resolveFish, resolveHunt } from '../src/game/skilling.js';
import { FISH_SCHOOL, WILD_STOCK } from '../src/game/fishschool.js';
import {
  NODE_JACKPOT, JACKPOT_CHANCE, setJackpotRand, nodeJackpot, SEAM_MULT, huntJackpot, HUNT_STOCK, HUNT_CROWD, RECORD_STOCK, recordHarvest, many,
} from '../src/game/jackpot.js';
import { CROPS, cropFor, HUNT } from '../src/data/trades.js';
import { OBJECTS } from '../src/data/objects.js';
import { getItem } from '../src/data/items.js';
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

test('a lucky swing brings the whole tree down: ten times every log left, XP for each, and the tree falls', () => {
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
  // The swing's own log, then the 14 left ten times over (SEAM_MULT).
  assert.ok(got === 141 || got === 142, `1 + 14 x 10 logs (one more from a double): ${got}`);
  assert.ok(g.skills.xp.woodcutting - xp0 >= tree.def.xp * 141 - 1e-6, 'XP for every log');
  assert.ok(said.some((m) => /^The whole tree comes down at once: \d+ /.test(m)));
});

test('a lucky swing breaks the whole seam free: ten times every ore left, and the rock is mined out', () => {
  const g = newGame(); const said = listen(g);
  const rock = find(g, 'copper_rock');
  rock.oresLeft = 12;
  const ore0 = g.inventory.count('copper_ore'), xp0 = g.skills.xp.mining;
  setJackpotRand(() => 0);
  assert.equal(resolveMine(g, { obj: rock }), false);
  assert.equal(rock.depleted, true);
  const got = g.inventory.count('copper_ore') - ore0;
  // The swing's own ore, then the 11 left ten times over (SEAM_MULT).
  assert.equal(SEAM_MULT, 10);
  assert.ok(got === 111 || got === 112, `1 + 11 x 10 ores (one more from a rich seam): ${got}`);
  assert.ok(g.skills.xp.mining - xp0 >= rock.def.xp * 111 - 1e-6);
  assert.ok(said.some((m) => /^The whole seam breaks free: \d+ copper ore!$/.test(m)));
  // A gem rock rolls a gem for each piece.
  const gems = find(g, 'gem_rock');
  if (gems) {
    gems.oresLeft = 10;
    const before = g.inventory.slots.filter(Boolean).reduce((n, s) => n + s.qty, 0);
    assert.equal(resolveMine(g, { obj: gems }), false);
    const after = g.inventory.slots.filter(Boolean).reduce((n, s) => n + s.qty, 0);
    assert.ok(after - before >= 1 + 9 * 10, 'a gem for each piece, ten times over');
  }
});

test('an unlucky swing changes nothing, and it is about 1 in 20 (the owner doubled it from 1 in 40)', () => {
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
  assert.equal(JACKPOT_CHANCE, 0.05);
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

test('every fishing spot can net a whole school of the fish you hooked, as often as a whole seam', () => {
  const g = newGame(); const said = listen(g);
  g.skills.xp.fishing = xpForLevel(40);
  if (!g.inventory.has('harpoon')) g.inventory.add('harpoon', 1);
  FISH_SCHOOL.on = false;   // no school passing: just any spot
  const spot = find(g, 'harpoon_spot');
  const tuna = () => g.inventory.count('raw_tuna');
  const catchOnce = () => { const t = tuna(); assert.equal(resolveFish(g, { obj: spot }), true, 'a spot never runs dry'); return tuna() - t; };
  // A lucky catch: the fish, and a whole school of them with XP for each.
  const xp0 = g.skills.xp.fishing;
  setJackpotRand(() => 0);
  const got = catchOnce();
  // A school at any spot is sized like a whole seam: ten times a stock of 1-14 fish.
  assert.ok(got >= 1 + SEAM_MULT * WILD_STOCK[0] && got <= 2 + SEAM_MULT * WILD_STOCK[1], `the catch and a whole school: ${got}`);
  assert.ok(g.skills.xp.fishing - xp0 >= spot.def.catches[0].xp * (got - 2) - 1e-6, 'XP for every fish');
  assert.ok(said.some((m) => /^It was a whole school of tuna: you net \d+ at once!/.test(m)), said.slice(-3).join(' | '));
  assert.equal(g.fishSchools.netted, 1);
  // An unlucky one: just the fish (one, or two on a big catch).
  setJackpotRand(() => 0.99);
  assert.ok(catchOnce() <= 2);
  // And the switch turns it off with the seams and trees.
  NODE_JACKPOT.on = false;
  setJackpotRand(() => 0);
  assert.ok(catchOnce() <= 2);
});

test('at a spot a school is passing, a missed school roll still has the any-spot chance', () => {
  const g = newGame();
  g.skills.xp.fishing = xpForLevel(40);
  if (!g.inventory.has('harpoon')) g.inventory.add('harpoon', 1);
  FISH_SCHOOL.on = true;
  const spot = find(g, 'harpoon_spot');
  const s = g.fishSchools.spawn(spot); s.until = Infinity;
  g.fishSchools.rand = () => 0.99;   // the passing school's roll misses...
  setJackpotRand(() => 0);           // ...and the any-spot roll hits
  const n = g.fishSchools.onCatch(spot, 1, 'raw_tuna');
  assert.ok(n >= SEAM_MULT * WILD_STOCK[0] && n <= SEAM_MULT * WILD_STOCK[1], `a whole school of the fish you hooked (${n})`);
  assert.equal(g.fishSchools.at(spot), s, 'the passing school is still there for later');
});

test('a lucky catch springs the trap on a whole nest: ten times a stock of catches, XP for each, and the trap stays set', () => {
  const g = newGame(); const said = listen(g);
  g.skills.xp.hunter = xpForLevel(30);
  if (!g.inventory.has('hunting_snare')) g.inventory.add('hunting_snare', 1);
  const trap = find(g, 'lizard_snare');
  const skins = () => g.inventory.count('lizard_skin');
  const s0 = skins(), xp0 = g.skills.xp.hunter;
  setJackpotRand(() => 0);   // it hits, with the smallest stock: 1 x SEAM_MULT catches
  const rnd = Math.random;
  Math.random = () => 0.99;   // and the trap's own roll leaves it set
  try { assert.equal(resolveHunt(g, { obj: trap }), true, 'the trap stays set'); } finally { Math.random = rnd; }
  assert.equal(trap.depleted, false);
  const got = skins() - s0;
  assert.ok(got === 1 + SEAM_MULT * HUNT_STOCK[0] || got === 2 + SEAM_MULT * HUNT_STOCK[0], `the catch and a whole nest of ${SEAM_MULT}: ${got}`);
  const one = g.skills.xp.hunter - xp0;
  assert.ok(said.some((m) => m === 'It was a whole nest: you catch 10 lizard skins at once!'), said.slice(-3).join(' | '));
  // XP for every catch: eleven catches' worth, against one for an unlucky catch.
  trap.depleted = false;
  setJackpotRand(() => 0.99);
  const x1 = g.skills.xp.hunter, n1 = skins();
  resolveHunt(g, { obj: trap });
  assert.ok(skins() - n1 <= 2, 'an unlucky catch: just the catch');
  const plain = g.skills.xp.hunter - x1;
  assert.ok(Math.abs(one / plain - (1 + SEAM_MULT * HUNT_STOCK[0])) < 1e-9, `XP for each of the ${1 + SEAM_MULT * HUNT_STOCK[0]} catches (${one} vs ${plain})`);
  // A bird snare's catch is a handful of feathers, so its flock is ten handfuls.
  const snare = find(g, 'bird_snare');
  const f0 = g.inventory.count('feather');
  assert.equal(huntJackpot(g, snare, { xpEach: 1 }), 0, 'an unlucky roll');
  setJackpotRand(() => 0);
  assert.equal(huntJackpot(g, snare, { xpEach: 1 }), SEAM_MULT, 'ten catches');
  assert.equal(g.inventory.count('feather') - f0, SEAM_MULT * snare.def.gives[0].min, 'each its handful of feathers');
  NODE_JACKPOT.on = false;
  assert.equal(huntJackpot(g, trap, { xpEach: 1 }), 0, 'the switch turns it off with the seams');
});

test('a harvest can be a record one: the crop\'s own yield ten times a stock over again, XP for each crop', () => {
  const g = newGame(); const said = listen(g);
  // Fifty levels over the crop: green fingers adds a crop half the time.
  g.skills.xp.farming = xpForLevel(80);
  const patch = g.world.objects.find((o) => o.objId === 'farm_patch');
  const c = cropFor('tongkat_ali');
  const harvest = (r, rand = null) => {
    g.inventory.add(c.seed, 1);
    assert.ok(g.plantSeed(patch, c.seed));
    patch.growLeft = 0;
    setJackpotRand(r);
    const n0 = g.inventory.count(c.id), x0 = g.skills.xp.farming;
    const rnd = Math.random;
    if (rand) Math.random = rand;
    try { assert.ok(g.harvestPatch(patch)); } finally { Math.random = rnd; }
    return [g.inventory.count(c.id) - n0, g.skills.xp.farming - x0];
  };
  const [plain, plainXp] = harvest(() => 0.99);
  assert.ok(plain >= c.yield[0] && plain <= c.yield[1] + 1, `an ordinary harvest: ${plain}`);
  // The record harvest is sized on the crop's own roll, not on green fingers'
  // extra crop. The harvest's first two rolls at their lowest: a yield of 2,
  // and green fingers' crop; the record's stock at its smallest.
  const first = (k) => { let i = 0; const rnd = Math.random; return () => (i++ < k ? 0 : rnd()); };
  const [record, recordXp] = harvest(() => 0, first(2));
  const rolled = c.yield[0];
  assert.equal(record, rolled + 1 + rolled * SEAM_MULT * RECORD_STOCK[0], 'the harvest (2, and 1 from green fingers), then 2 x 10 more');
  assert.ok(Math.abs(recordXp / record - plainXp / plain) < 1e-6, 'XP for every crop');
  assert.ok(said.includes(`A record harvest! The patch gives ${rolled * SEAM_MULT} more tongkat ali.`), said.slice(-3).join(' | '));
  NODE_JACKPOT.on = false;
  assert.equal(recordHarvest(g, patch, c, 3), 0, 'the switch turns it off');
});

test('the whole flock and the record harvest are about 1 in 20, a better snare or none, and sized like a whole school', () => {
  assert.deepEqual(HUNT_STOCK, WILD_STOCK);
  assert.deepEqual(RECORD_STOCK, WILD_STOCK);
  const fake = { inventory: { canAdd: (id, k) => k, add() {} }, skills: { addXp() {} }, msg() {}, bus: { emit() {} }, player: {} };
  const trap = { x: 0, y: 0, def: { gives: [{ id: 'lizard_skin' }] } };
  const chilli = { id: 'chilli', name: 'Chilli', harvestXp: 1 };
  // About 1 in 20 each (a trap's whole flock takes no find share from the snare,
  // as a whole seam does from the pickaxe: nothing is used up, so it ran Hunter
  // past the others at the top).
  for (const f of [() => huntJackpot(fake, trap, { xpEach: 1 }), () => huntJackpot(fake, trap, { xpEach: 1, find: 1 }), () => recordHarvest(fake, trap, chilli, 3)]) {
    setJackpotRand(mulberry32(42));
    let hits = 0;
    for (let i = 0; i < 20000; i++) if (f()) hits++;
    assert.ok(Math.abs(hits / 20000 - JACKPOT_CHANCE) < 0.006, `about ${JACKPOT_CHANCE} (${hits / 20000})`);
  }
  // Ten times a stock of 1 to 14: 10 to 140 catches, or 10 to 140 times the yield.
  const rolls = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
  setJackpotRand(rolls(0, 0)); assert.equal(huntJackpot(fake, trap, { xpEach: 1 }), 10);
  setJackpotRand(rolls(0, 0.9999)); assert.equal(huntJackpot(fake, trap, { xpEach: 1 }), 140);
  setJackpotRand(rolls(0, 0)); assert.equal(recordHarvest(fake, trap, chilli, 3), 30);
  setJackpotRand(rolls(0, 0.9999)); assert.equal(recordHarvest(fake, trap, chilli, 3), 420);
  // Every trap says what it springs on ("Whole nest!").
  for (const id of Object.keys(HUNT)) assert.ok(['flock', 'nest', 'herd', 'warren', 'family'].includes(HUNT_CROWD[id]), id);
});

test('the chat counts a whole flock or a record harvest in plurals, with commas past 999', () => {
  // Every crop and every trap's catch: an "s" more, unless it's one of these.
  const ODD = {
    chilli: 'chillies', 'pandan leaves': 'pandan leaves', kangkong: 'kangkong', lemongrass: 'lemongrass', 'sweet potato': 'sweet potatoes',
    'sireh leaf': 'sireh leaves', 'tongkat ali': 'tongkat ali', 'misai kucing': 'misai kucing', 'hempedu bumi': 'hempedu bumi', ginseng: 'ginseng',
    lingzhi: 'lingzhi', 'snow lotus': 'snow lotuses', 'peach of immortality': 'peaches of immortality', 'eternal lotus': 'eternal lotuses',
    'raw venison': 'raw venison', 'raw boar meat': 'raw boar meat', 'pangolin scales': 'pangolin scales', 'colugo fur': 'colugo fur',
  };
  const names = [...CROPS.map((c) => c[1]), ...Object.keys(HUNT).map((id) => getItem(OBJECTS[id].gives[0].id).name)].map((n) => n.toLowerCase());
  for (const n of names) assert.equal(many(n), ODD[n] ?? `${n}s`, n);
  // A bird snare's whole flock: 140 handfuls of 3-8 feathers, counted with a comma.
  const g = newGame(); const said = listen(g);
  setJackpotRand((() => { let i = 0; return () => (i++ < 2 ? [0, 0.9999][i - 1] : 0.9999); })());
  const snare = find(g, 'bird_snare');
  assert.equal(huntJackpot(g, snare, { xpEach: 1 }), 140);
  const feathers = 140 * snare.def.gives[0].max;
  assert.ok(said.includes(`It was a whole flock: you catch ${feathers.toLocaleString('en-GB')} feathers at once!`), said.slice(-2).join(' | '));
  assert.ok(feathers > 999 && said.at(-1).includes(','));
});

test('the skill guides mention it', () => {
  assert.match(SKILL_GUIDES.woodcutting.use, /whole tree down at once/);
  assert.match(SKILL_GUIDES.mining.use, /whole seam free at once/);
  assert.match(SKILL_GUIDES.fishing.use, /at any spot, about one catch in 20 turns out to be a smaller school of the fish you hooked: 10 to 140/);
  assert.match(SKILL_GUIDES.hunter.use, /one catch in 20 springs the trap on a whole flock, nest or herd at once: 10 to 140/);
  assert.match(SKILL_GUIDES.farming.use, /one harvest in 20 is a record harvest: the patch gives 10 to 140 times its yield again/);
});
