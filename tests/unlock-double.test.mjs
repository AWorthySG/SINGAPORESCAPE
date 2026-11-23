// The skill unlocks' double (src/game/skillunlocks.js runSkillAction): a copy
// of what the gather itself gave of the node's own product (a log, a double or
// triple log, a handful of feathers), never of the whole tree, seam, school or
// flock that came in the same action (jackpot.js, fishschool.js), nor of a gem
// or a trap's bonus catch. It used to copy the action's biggest gain, so "a
// double raw tuna" could add hundreds of fish.
import './seed.mjs';   // seeded Math.random (and the unlocks and extras off before every test)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel, MAX_LEVEL } from '../src/data/xp.js';
import { UNLOCKS } from '../src/data/unlocks.js';
import { runSkillAction } from '../src/game/skillunlocks.js';
import { resolveWoodcut, resolveMine, resolveFish, resolveHunt } from '../src/game/skilling.js';
import { NODE_JACKPOT, SEAM_MULT, setJackpotRand } from '../src/game/jackpot.js';
import { FISH_SCHOOL, WILD_STOCK, SCHOOL_HAUL } from '../src/game/fishschool.js';
import { mulberry32 } from '../src/game/pets.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} }); g.npcs = [];
  for (const t of ['bronze_axe', 'bronze_pickaxe', 'harpoon', 'hunting_snare']) if (!g.inventory.has(t)) g.inventory.add(t, 1);
  g.fishSchools.rand = mulberry32(7);   // the schools' own rolls, pinned
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
const find = (g, id) => g.world.objects.find((o) => o.objId === id && !o.depleted);
/** Run `fn` with Math.random giving `r` every time. */
function withRandom(r, fn) {
  const seeded = Math.random;
  Math.random = () => r;
  try { return fn(); } finally { Math.random = seeded; }
}
const counts = (g) => { const m = new Map(); for (const s of g.inventory.slots) if (s) m.set(s.id, (m.get(s.id) || 0) + s.qty); return m; };
const diff = (from, to) => Object.fromEntries([...to].filter(([id, n]) => n !== (from.get(id) || 0)).map(([id, n]) => [id, n - (from.get(id) || 0)]));

/** One gather through the skill unlocks, the way the game runs it, with every
 *  unlock roll coming up (the unlock dice are an xorshift, which stays at 0
 *  from a seed of 0). Returns what the action itself gave and what the unlock
 *  double added after it (null if it didn't come), by item. */
function gather(g, type, obj, resolve) {
  const start = counts(g);
  let gave = null, atDouble = null;
  const msg = g.msg.bind(g);
  g.msg = (t, c) => { if (!atDouble && t.startsWith('Skill unlock: a double')) atDouble = counts(g); return msg(t, c); };
  g._unlockSeed = 0;
  const a = { type, obj };
  try {
    // (A quick action runs the resolver again after the double: only the first counts.)
    runSkillAction(g, a, () => { const going = resolve(g, a); gave ??= counts(g); return going; });
  } finally { g.msg = msg; }
  return { gave: diff(start, gave), double: atDouble && diff(gave, atDouble) };
}

// (The level haul and the gathering extras stay off: gather() runs the action
// alone, not the tick around it that rolls them.)
beforeEach(() => { UNLOCKS.on = NODE_JACKPOT.on = FISH_SCHOOL.on = true; });
afterEach(() => { setJackpotRand(mulberry32(1)); });

test('a whole tree in the same swing as an unlock double: the double is one more log', () => {
  const g = newGame();
  setLevel(g, 'woodcutting', 20);
  const tree = find(g, 'tree');
  tree.logsLeft = 15;
  setJackpotRand(() => 0);   // the whole tree comes down
  const r = withRandom(0.99, () => gather(g, 'woodcut', tree, resolveWoodcut));   // no double log, nest or herb of its own
  assert.equal(r.gave.logs, 1 + 14 * SEAM_MULT, "the swing's log, then the 14 left ten times over");
  assert.deepEqual(r.double, { logs: 1 }, 'the double: one log, not another whole tree');
});

test('a whole seam in the same swing as an unlock double: the double is one more ore', () => {
  const g = newGame();
  setLevel(g, 'mining', 20);
  const rock = find(g, 'copper_rock');
  rock.oresLeft = 12;
  setJackpotRand(() => 0);   // the whole seam breaks free
  const r = withRandom(0.99, () => gather(g, 'mine', rock, resolveMine));
  assert.equal(r.gave.copper_ore, 1 + 11 * SEAM_MULT);
  assert.deepEqual(r.double, { copper_ore: 1 }, 'the double: one ore, not another whole seam');
});

test('a whole school at any spot, or a passing school, in the same catch as an unlock double: the double is one more fish', () => {
  const g = newGame();
  setLevel(g, 'fishing', 40);
  const spot = find(g, 'harpoon_spot');
  // At any spot: a whole school of the fish you hooked, 10-140 of them.
  setJackpotRand(() => 0);
  let r = withRandom(0.99, () => gather(g, 'fish', spot, resolveFish));   // no big catch of its own
  const wild = r.gave.raw_tuna - 1;
  assert.ok(wild >= SEAM_MULT * WILD_STOCK[0] && wild <= SEAM_MULT * WILD_STOCK[1], `the fish and a whole school (${wild})`);
  assert.deepEqual(r.double, { raw_tuna: 1 }, 'the double: one tuna, not another school');
  // A school passing the spot, netted whole: 250 fish and more.
  setJackpotRand(() => 0.99);
  g.fishSchools.rand = () => 0;   // the catch nets it
  g.fishSchools.spawn(spot).until = Infinity;
  r = withRandom(0.99, () => gather(g, 'fish', spot, resolveFish));
  assert.ok(r.gave.raw_tuna >= 1 + SCHOOL_HAUL[0], `the fish and the passing school (${r.gave.raw_tuna})`);
  assert.deepEqual(r.double, { raw_tuna: 1 });
});

test('an ordinary double still works: one more log, ore or fish', () => {
  const g = newGame();
  setLevel(g, 'woodcutting', 20); setLevel(g, 'mining', 20); setLevel(g, 'fishing', 40);
  setJackpotRand(() => 0.99);   // no whole tree, seam or school
  const tree = find(g, 'tree');
  tree.logsLeft = 15;
  let r = withRandom(0.99, () => gather(g, 'woodcut', tree, resolveWoodcut));
  assert.deepEqual(r.gave, { logs: 1 });
  assert.deepEqual(r.double, { logs: 1 });
  assert.equal(tree.logsLeft, 14, 'the double comes on top of the tree, as before');
  const rock = find(g, 'copper_rock');
  rock.oresLeft = 12;
  r = withRandom(0.99, () => gather(g, 'mine', rock, resolveMine));
  assert.deepEqual(r.gave, { copper_ore: 1 });
  assert.deepEqual(r.double, { copper_ore: 1 });
  r = withRandom(0.99, () => gather(g, 'fish', find(g, 'harpoon_spot'), resolveFish));
  assert.deepEqual(r.gave, { raw_tuna: 1 });
  assert.deepEqual(r.double, { raw_tuna: 1 });
});

test('a double or triple log is copied whole, as before', () => {
  const g = newGame();
  setLevel(g, 'woodcutting', MAX_LEVEL);
  setJackpotRand(() => 0.99);
  // At level 9999 a double log is certain and a third can come (EXTRA_AT_TOP), with a bird's nest.
  const tree = find(g, 'tree');
  tree.logsLeft = 15;
  const r = withRandom(0, () => gather(g, 'woodcut', tree, resolveWoodcut));
  assert.deepEqual(r.gave, { logs: 3, birds_nest: 1 });
  assert.deepEqual(r.double, { logs: 3 }, 'the three logs again, never the nest');
});

test('never a copy of the gems: one more ore', () => {
  const g = newGame();
  setLevel(g, 'mining', MAX_LEVEL);
  setJackpotRand(() => 0.99);
  // The last ore in a rock, with a lucky gem and a second like it: more gems than ore.
  const rock = find(g, 'copper_rock');
  rock.oresLeft = 1;
  const r = withRandom(0, () => gather(g, 'mine', rock, resolveMine));
  assert.deepEqual(r.gave, { copper_ore: 1, sapphire: 2 });
  assert.deepEqual(r.double, { copper_ore: 1 }, 'the ore, never the gems');
});

test('at a trap the double is one more of its main catch, never the bonus catch with it', () => {
  const g = newGame();
  setLevel(g, 'hunter', 55);
  g.inventory.add('boar_tusk', 1);   // a tusk already in the bag, ahead of the meat
  const pit = find(g, 'boar_pit');
  const r = withRandom(0, () => gather(g, 'hunt', pit, resolveHunt));
  assert.ok(r.gave.raw_boar_meat >= 1, 'the boar');
  assert.equal(r.gave.boar_tusk, 1, 'and a tusk with it');
  assert.deepEqual(r.double, { raw_boar_meat: 1 }, 'the meat, not an 8,000-coin tusk');
});

test('a whole flock in the same catch as an unlock double: the double is the snare\'s own catch', () => {
  const g = newGame();
  setLevel(g, 'hunter', 20);
  const snare = find(g, 'bird_snare');
  setJackpotRand(() => 0);   // the whole flock: ten catches of 3 feathers each
  const r = withRandom(0.99, () => gather(g, 'hunt', snare, resolveHunt));   // 8 feathers, no chicken
  assert.equal(r.gave.feather, 8 + SEAM_MULT * 3, "the snare's 8 feathers and the flock's");
  assert.deepEqual(r.double, { feather: 8 }, 'the 8 feathers again, not another flock');
});

test("an ordinary trap's double copies its whole catch: a bird snare's feathers, a hornbill nest's feathers", () => {
  const g = newGame();
  setLevel(g, 'hunter', 120);
  setJackpotRand(() => 0.99);   // no whole flock
  let r = withRandom(0.99, () => gather(g, 'hunt', find(g, 'bird_snare'), resolveHunt));
  assert.deepEqual(r.gave, { feather: 8 });
  assert.deepEqual(r.double, { feather: 8 }, 'all 8 feathers, as on a bird snare before');
  // A hornbill nest always gives a casque and 10-20 feathers: the double copies
  // the feathers, as it always has, never a 1,500-coin casque.
  r = withRandom(0.99, () => gather(g, 'hunt', find(g, 'hornbill_nest'), resolveHunt));
  assert.deepEqual(r.gave, { hornbill_casque: 1, feather: 20 });
  assert.deepEqual(r.double, { feather: 20 });
});

test("a stall's double is the theft's loot again, as before", () => {
  const g = newGame();
  setLevel(g, 'thieving', 20);
  const stall = find(g, 'stall_food');
  const r = withRandom(0, () => gather(g, 'stall', stall, (gm, a) => gm.stealFromStall(stall, a)));   // 5 coins
  assert.deepEqual(r.gave, { coins: 5 });
  assert.deepEqual(r.double, { coins: 5 });
});
