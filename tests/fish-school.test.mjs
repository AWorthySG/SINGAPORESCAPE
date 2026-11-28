// Schools of fish (src/game/fishschool.js): now and then a school visits a
// fishing spot near you for 20-40 seconds, and a catch there may net the whole
// school at once, 250-650 fish with XP for each.
import { seedRandom } from './seed.mjs';   // seeded Math.random (and FISH_SCHOOL off before every test)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { OBJECTS } from '../src/data/objects.js';
import { xpForLevel } from '../src/data/xp.js';
import { chebyshev } from '../src/core/utils.js';
import { mulberry32 } from '../src/game/pets.js';
import { FISH_SCHOOL, SCHOOL_STAY, SCHOOL_GAP, SCHOOL_HAUL, SCHOOL_NEAR, SCHOOL_AUTO, SCHOOL_HAUL_MAX, haulBonus } from '../src/game/fishschool.js';
import { SKILL_GUIDES } from '../src/game/skillguide.js';
import { drawFishSchool } from '../src/render/fishschoolfx.js';

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
  g.npcs = [];   // nothing to interrupt the fishing
  g.fishSchools.rand = mulberry32(7);   // its own rolls, pinned
  g.skills.xp.fishing = xpForLevel(40);
  for (const id of ['harpoon', 'small_net', 'fishing_rod']) if (!g.inventory.has(id)) g.inventory.add(id, 1);
  g.playMs = 0.5 * 10 * 60 * 1000;   // noon
  return g;
}
const step = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };
function standBy(g, obj) {
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
function listen(g) {
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (m, c) => { said.push(m); return msg(m, c); };
  return said;
}
const harpoonSpot = (g) => g.world.objects.find((o) => o.objId === 'harpoon_spot');
const tuna = (g) => g.inventory.count('raw_tuna');

beforeEach(() => { FISH_SCHOOL.on = true; });

test('a school turns up at a spot near you, is announced, and swims off after its time', () => {
  const g = newGame();
  const said = listen(g);
  const spot = harpoonSpot(g);
  standBy(g, spot);
  const fs = g.fishSchools;
  step(g, 1);   // the first tick sets when the first school is due
  assert.ok(fs.nextAt >= g.tickCount + SCHOOL_GAP[0] - 1 && fs.nextAt <= g.tickCount + SCHOOL_GAP[1], 'the first school is a few minutes off');
  fs.nextAt = g.tickCount + 1;
  step(g, 2);
  assert.equal(fs.list.length, 1, 'a school arrived');
  const s = fs.list[0];
  assert.equal(s.obj.def.type, 'fishing');
  assert.ok(chebyshev(s.obj.x, s.obj.y, g.player.x, g.player.y) <= SCHOOL_NEAR, 'at a spot near you');
  assert.ok(s.obj.def.catches.some((c) => c.id === s.fishId), "one of that spot's fish");
  const stay = s.until - s.from;
  assert.ok(stay >= SCHOOL_STAY[0] && stay <= SCHOOL_STAY[1], `stays 20-40 seconds (${stay} ticks)`);
  assert.ok(said.some((m) => /^A school of .+ is passing the .+!$/.test(m)), 'announced in the chat');
  // Not netted (nobody's fishing): it swims off when its time is up.
  step(g, s.until - g.tickCount + 1);
  assert.equal(fs.at(s.obj), null, 'gone');
  assert.ok(said.some((m) => /^The school of .+ swims off\.$/.test(m)), 'told it swam off');
});

test('netting the school: 250-650 fish at once, XP for each, and it is used up', () => {
  const g = newGame();
  const said = listen(g);
  const spot = harpoonSpot(g);
  standBy(g, spot);
  const fs = g.fishSchools;
  fs.nextAt = Infinity;   // no other school wanders in
  const s = fs.spawn(spot);
  s.fishId = 'raw_tuna'; s.until = g.tickCount + 1000;
  fs.rand = () => 0.1;   // under the 1 in 2: the next catch nets it
  const xpCalls = [];
  const addXp = g.skills.addXp.bind(g.skills);
  g.skills.addXp = (id, amt) => { xpCalls.push([id, amt]); return addXp(id, amt); };
  const t0 = tuna(g);
  const n = fs.onCatch(spot, 1);
  assert.ok(n >= SCHOOL_HAUL[0] && n <= SCHOOL_HAUL_MAX, `a haul of 250-650 (${n})`);
  assert.equal(n, Math.min(SCHOOL_HAUL_MAX, s.size + haulBonus(40, null)));
  assert.equal(tuna(g) - t0, n, 'all of them in the bag');
  assert.deepEqual(xpCalls, [['fishing', OBJECTS.harpoon_spot.catches.find((c) => c.id === 'raw_tuna').xp * n]], 'XP for each fish');
  assert.ok(said.some((m) => m.startsWith(`You net the whole school: ${n} tuna`)), 'told in the chat');
  assert.equal(fs.at(spot), null, 'used up');
  assert.equal(fs.onCatch(spot, 1), 0, 'nothing more to net');
  assert.equal(fs.netted, 1);

  // In play: fishing at a schooling spot nets it, with the catch's own fish too.
  const s2 = fs.spawn(spot);
  s2.until = g.tickCount + 1000;
  const id = s2.fishId, c0 = g.inventory.count(id);
  g.defaultObjectAction(spot);
  step(g, 4);
  assert.equal(fs.netted, 2, 'netted while fishing');
  assert.ok(g.inventory.count(id) - c0 >= SCHOOL_HAUL[0], 'a whole school more of its fish');
  assert.equal(fs.at(spot), null);
});

test('the haul grows with Fishing level and a rune-or-better tool, to 751 at most', () => {
  assert.deepEqual(SCHOOL_HAUL, [250, 450], 'fifty times the old 5-9');
  assert.equal(haulBonus(1, null), 0);
  assert.equal(haulBonus(60, { speed: 0 }), 50);
  assert.equal(haulBonus(250, { speed: 40 }), 150);
  // Past level 100 the level part grows slowly on, to +150 at level 9999, and
  // on at the same pace to +251 at 30,000 (the life skills' top level).
  assert.equal(haulBonus(999, null), 104);
  assert.equal(haulBonus(9999, null), 150);
  assert.equal(haulBonus(30000, null), 251);
  assert.ok(SCHOOL_HAUL[1] + haulBonus(30000, { speed: 99 }) === SCHOOL_HAUL_MAX, 'the biggest school is the most there can be');
  assert.equal(SCHOOL_HAUL_MAX, 751);
});

test('a catch nets the school about 1 in 2 times (the owner doubled it from 1 in 4); otherwise fishing goes on as normal', () => {
  const g = newGame();
  const spot = harpoonSpot(g);
  standBy(g, spot);
  const fs = g.fishSchools;
  fs.nextAt = Infinity;
  let netted = 0, tries = 0;
  for (let i = 0; i < 400; i++) {
    const s = fs.spawn(spot); s.until = Infinity;
    tries++;
    if (fs.onCatch(spot, 1) > 0) netted++;
  }
  const r = netted / tries;
  assert.ok(r > 0.42 && r < 0.58, `about a half (${r.toFixed(2)})`);
});

test('a full bag takes only what fits', () => {
  const g = newGame();
  const said = listen(g);
  const spot = harpoonSpot(g);
  const fs = g.fishSchools;
  fs.nextAt = Infinity;
  const s = fs.spawn(spot);
  s.fishId = 'raw_tuna';
  fs.rand = () => 0.1;
  g.inventory.canAdd = (id, qty) => Math.min(qty, 3);   // room for three
  const t0 = tuna(g);
  assert.equal(fs.onCatch(spot, 1), 3);
  assert.equal(tuna(g) - t0, 3);
  assert.ok(said.some((m) => m.includes('(all your bag could hold)')));
  // No room at all: the school stays for later.
  const s2 = fs.spawn(spot);
  g.inventory.canAdd = () => 0;
  assert.equal(fs.onCatch(spot, 1), 0);
  assert.equal(fs.at(spot), s2, 'still there');
});

test('auto gather moves to a school at a spot of the same kind close by', () => {
  const g = newGame();
  const all = g.world.objects.filter((o) => o.objId === 'harpoon_spot');
  let pair = null;
  for (const a of all) {
    const b = all.find((o) => o !== a && chebyshev(a.x, a.y, o.x, o.y) >= 3 && chebyshev(a.x, a.y, o.x, o.y) <= SCHOOL_AUTO - 2);
    if (b) { pair = [a, b]; break; }
  }
  assert.ok(pair, 'two harpoon spots a few tiles apart');
  const [a, b] = pair;
  standBy(g, a);
  g.fishSchools.nextAt = Infinity;
  g.toggleAutoGather(true);
  g.defaultObjectAction(a);
  step(g, 2);
  assert.equal(g.player.action?.obj, a);
  g.fishSchools.spawn(b);
  assert.equal(g.player.action?.obj, b, 'off to the school');
  // Without auto gather, you stay put.
  g.toggleAutoGather(false);
  g.fishSchools.leave(g.fishSchools.at(b));
  g.defaultObjectAction(a); step(g, 2);
  g.fishSchools.spawn(b);
  assert.equal(g.player.action?.obj, a);
});

test('with the switch off, fishing is unchanged: no schools, and a school left at the spot is never netted', () => {
  const run = (withSchool) => {
    FISH_SCHOOL.on = false;
    seedRandom();
    const g = newGame();
    const spot = harpoonSpot(g);
    standBy(g, spot);
    if (withSchool) { const s = g.fishSchools.spawn(spot); s.until = Infinity; }
    g.fishSchools.rand = () => 0;   // would net on every catch, if it were on
    g.defaultObjectAction(spot);
    step(g, 200);
    return { xp: g.skills.xp.fishing, tuna: tuna(g), schools: g.fishSchools.list.length, netted: g.fishSchools.netted };
  };
  const plain = run(false), schooled = run(true);
  assert.equal(plain.schools, 0, 'none turned up on their own');
  assert.equal(schooled.netted, 0);
  assert.deepEqual({ ...schooled, schools: 0 }, plain, 'the same catches and XP either way');
});

test('the Fishing guide tells of schools', () => {
  assert.match(SKILL_GUIDES.fishing.use, /school of fish/);
  assert.match(SKILL_GUIDES.fishing.use, /net the whole school/);
  assert.ok(SKILL_GUIDES.fishing.use.includes(`${SCHOOL_HAUL[0]} to ${SCHOOL_HAUL_MAX} fish`), 'the guide gives the real range');
});

test('drawing a school is cheap canvas work, simpler in low graphics', () => {
  let calls = 0;
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => { calls++; }), set: (t, k, v) => { t[k] = v; return true; } });
  const s = { from: 0, until: 50 };
  drawFishSchool(ctx, 100, 100, 1234, s, 20, false);
  const full = calls; calls = 0;
  drawFishSchool(ctx, 100, 100, 1234, s, 20, true);
  assert.ok(full > 0 && full < 200, `a handful of shapes (${full} calls)`);
  assert.ok(calls < full, 'low graphics draws less');
});

test('a school fades to zero rather than vanishing at the tick it leaves', () => {
  const s = { from: 20, until: 70 };
  const alphaAt = (tick) => {
    const alphas = [];
    const ctx = new Proxy({ fill: () => alphas.push(ctx.globalAlpha) }, { get: (t, k) => (k in t ? t[k] : () => {}) });
    drawFishSchool(ctx, 100, 100, 1234, s, tick, true);
    return alphas[0] || 0;
  };
  assert.equal(alphaAt(20), 0);
  assert.ok(alphaAt(20.5) > 0 && alphaAt(20.5) < alphaAt(21.5));
  assert.equal(alphaAt(40), 0.6);
  assert.ok(alphaAt(69.99) > 0 && alphaAt(69.99) < 0.0001);
  assert.equal(alphaAt(70), 0);
});
