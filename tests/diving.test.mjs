// Diving (src/data/diving.js, src/game/diving.js): the reefs and where they
// lie, the breath meter, the gear ladder, pearls, the sunken chest, the whole
// reef bed, the skill guide's wiring, auto gather, saves, and XP an hour in
// step with Mining and Woodcutting.
import { SEED, seedRandom } from './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame, loadGame } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { CRAFT } from '../src/data/crafting.js';
import { SHOPS } from '../src/data/shops.js';
import { SKILL_BY_ID } from '../src/data/skills.js';
import { xpForLevel } from '../src/data/xp.js';
import { TOOL_TIERS, toolId } from '../src/data/tooltiers.js';
import { SKILL_UNLOCKS } from '../src/data/unlocks.js';
import { SKILL_HOURS } from '../src/data/skillhours.js';
import { buildWorld, TERRAIN } from '../src/data/world.js';
import { DIVE_GEAR, DIVE_SPOTS, DIVE_REEF_SIZE, PEARL_GRADES, PEARL_JEWELLERY, SURFACE_TICKS, SHOP_DIVE_TIER, maxBreath, levelBreath } from '../src/data/diving.js';
import { resolveDive, diveBreath, bestDiveGear, setDiveRand, findPearl, sunkenChest, diveJackpot } from '../src/game/diving.js';
import { NODE_JACKPOT } from '../src/game/jackpot.js';
import { LIFE_PERKS } from '../src/game/lifeperks.js';
import { toolLadder } from '../src/game/tools.js';
import { gatherSources, diveSpotList, guideEntries, GATHER_SKILLS, SKILL_GUIDES } from '../src/game/skillguide.js';
import { xpRate } from '../src/game/xprate.js';
import { chebyshev } from '../src/core/utils.js';
import { TICK_MS } from '../src/config.js';
import { breathShown, diveShoreAt, drawDiveRipples } from '../src/render/diveart.js';

test('the breath bar refills steadily over the actual surface pause', () => {
  const action = { type: 'dive', maxBreath: 10, breath: 0, surface: SURFACE_TICKS };
  const g = { player: { action }, tickAcc: 0 };
  assert.deepEqual(breathShown(g), { frac: 0, up: true });
  g.tickAcc = TICK_MS / 2;
  assert.equal(breathShown(g).frac, 0.5 / SURFACE_TICKS);
  g.tickAcc = TICK_MS;
  const past = breathShown(g).frac;
  action.surface--; g.tickAcc = 0;
  assert.equal(breathShown(g).frac, past, 'crossing a tick boundary does not jump');
  g.tickAcc = TICK_MS * 0.98;
  assert.ok(breathShown(g).frac > 0.98);
  action.surface = 0; action.breath = action.maxBreath;
  assert.deepEqual(breathShown(g), { frac: 1, up: false });
});

test('the painted reef ripple grows around the buoy and keeps its anchor', () => {
  const rings = [];
  const ctx = { globalAlpha: 1, save() {}, restore() {}, beginPath() {}, stroke() {}, ellipse: (...args) => rings.push(args) };
  const reef = { x: 12, y: 20 };
  drawDiveRipples(ctx, reef, 100, 80, 0);
  drawDiveRipples(ctx, reef, 100, 80, 50);
  assert.equal(rings.length, 4);
  for (const [x, y] of rings) assert.deepEqual([x, y], [112, 87]);
  assert.notEqual(rings[0][2], rings[2][2], 'the same ring grows across frames');
});

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
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
const noon = (g) => { g.playMs = 0.5 * 10 * 60 * 1000; };   // no night bonus (the moonlit lagoon)
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
/** Stand beside a reef of `id` (the densest stretch of it) and return it. */
function standBy(g, id) {
  const all = g.world.objects.filter((o) => o.objId === id);
  const near = (o) => all.filter((p) => chebyshev(p.x, p.y, o.x, o.y) <= 15).length;
  const spot = all.reduce((a, b) => (near(b) > near(a) ? b : a));
  const [dx, dy] = ADJ.find(([ax, ay]) => !g.world.isBlocked(spot.x + ax, spot.y + ay) && !g.world.objectAt(spot.x + ax, spot.y + ay));
  g.player.x = g.player.tx = spot.x + dx; g.player.y = g.player.ty = spot.y + dy;
  return spot;
}

test('Diving is a gathering skill with reefs from level 1 to 300, each in its own region', () => {
  assert.equal(SKILL_BY_ID.diving.group, 'gathering');
  assert.ok(GATHER_SKILLS.includes('diving') && SKILL_GUIDES.diving.use);
  const levels = DIVE_SPOTS.map((s) => s.level);
  assert.deepEqual([...levels].sort((a, b) => a - b), levels, 'listed lowest first');
  assert.equal(levels[0], 1);
  assert.equal(levels.at(-1), 300);
  assert.ok(levels.filter((l) => l >= 100).length >= 6, 'six endgame reefs');
  for (const s of DIVE_SPOTS) {
    const d = OBJECTS[s.id];
    assert.equal(d.type, 'dive'); assert.equal(d.skill, 'diving'); assert.equal(d.blocking, false);
    assert.ok(ITEMS[s.gives]?.stackable, `${s.gives} is a stackable item`);
    assert.equal(d.catches[0].level, s.level);
  }
  // Each reef pays more a dive than the one before it.
  for (let i = 1; i < DIVE_SPOTS.length; i++) assert.ok(DIVE_SPOTS[i].xp > DIVE_SPOTS[i - 1].xp, DIVE_SPOTS[i].id);
});

test('every reef is placed in its region, in the water, with land you can walk to beside it', () => {
  const w = buildWorld();
  const zoneAt = (x, y) => w.zones.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);
  const g = newGame();
  for (const s of DIVE_SPOTS) {
    const os = w.objects.filter((o) => o.objId === s.id);
    assert.equal(os.length, DIVE_REEF_SIZE, `${s.id}: ${os.length} placed`);
    for (const o of os) {
      assert.equal(zoneAt(o.x, o.y)?.name, s.region, `${s.id} in ${s.region}`);
      assert.equal(w.terrain[o.y * w.width + o.x], TERRAIN.WATER, `${s.id} at ${o.x},${o.y} is in the water`);
      const stand = diveShoreAt(g.world, o);
      assert.ok(stand && !g.world.isBlocked(stand.x, stand.y), `${s.id} has a walkable shore marker`);
      assert.notEqual(g.world.terrainAt(stand.x, stand.y), TERRAIN.WATER, 'the marker is on dry ground');
      assert.equal(Math.abs(stand.x - o.x) + Math.abs(stand.y - o.y), 1, 'you can dive from the marker');
    }
    // Far regions for the endgame reefs, as the endgame fish.
    if (s.level >= 130) assert.ok(zoneAt(os[0].x, os[0].y).far || zoneAt(os[0].x, os[0].y).lo >= 120, `${s.id} is in a far region`);
    // The game walks you there from Kampong Glam.
    const reef = g.world.objects.find((o) => o.objId === s.id);
    g.player.x = g.player.tx = 58; g.player.y = g.player.ty = 55;
    assert.ok(g.goToObject(reef), `${s.id} can be walked to`);
  }
  // Placed after everything else: the world without the late additions is untouched.
  const bare = buildWorld({ groves: false });
  assert.equal(bare.objects.filter((o) => OBJECTS[o.objId]?.type === 'dive').length, 0);
});

test('a dive lasts your breath, then you come up for air for a moment, then dive again', () => {
  const g = newGame();
  const spot = standBy(g, 'shell_shallows');
  noon(g);
  g.defaultObjectAction(spot);
  const trace = [];
  for (let i = 0; i < 40; i++) {
    const before = g.inventory.count('seashell');
    g.update(600);
    const a = g.player.action;
    trace.push({ up: a?.surface > 0, got: g.inventory.count('seashell') > before, max: a?.maxBreath });
  }
  const firstUp = trace.findIndex((t) => t.up);
  assert.ok(firstUp > 0 && trace.slice(0, firstUp).some((t) => t.got), 'dives first, then surfaces');
  // After the first dive: runs of gathering ticks (a full breath each) between
  // pauses of SURFACE_TICKS with nothing gathered, the bar showing it.
  const runs = [];
  for (const t of trace.slice(firstUp + 1)) {   // (the tick that runs out of breath gathers, then comes up)
    if (!runs.length || runs.at(-1).got !== t.got) runs.push({ got: t.got, n: 0, max: t.max });
    runs.at(-1).n++;
  }
  const pauses = runs.slice(0, -1).filter((r) => !r.got), dives = runs.slice(0, -1).filter((r) => r.got);
  assert.ok(pauses.length >= 1 && dives.length >= 1, JSON.stringify(runs));
  for (const r of pauses) assert.equal(r.n, SURFACE_TICKS, 'up for air for SURFACE_TICKS');
  for (const r of dives) assert.equal(r.n, r.max, `a dive gathers for as many ticks as your breath: ${JSON.stringify(runs)}`);
  assert.equal(g.player.action?.type, 'dive', 'still diving afterwards');
});

test('breath grows with level and with dive gear; the best gear you can use is picked', () => {
  assert.ok(levelBreath(99) > levelBreath(50) && levelBreath(50) > levelBreath(1));
  assert.ok(levelBreath(5000) > levelBreath(99), 'and keeps growing past 99');
  for (let i = 1; i < DIVE_GEAR.length; i++) {
    assert.ok(DIVE_GEAR[i].breath > DIVE_GEAR[i - 1].breath, DIVE_GEAR[i].id);
    assert.equal(DIVE_GEAR[i].level, TOOL_TIERS[i].level, 'the tool tiers\' levels');
  }
  assert.deepEqual(DIVE_GEAR.slice(0, 4).map((x) => x.id), ['snorkel', 'dive_mask', 'swim_fins', 'wetsuit']);
  const g = newGame();
  setLevel(g, 'diving', 40);
  assert.equal(diveBreath(g), maxBreath(40, -1), 'free-diving with no gear');
  g.inventory.add('snorkel', 1); g.inventory.add('swim_fins', 1); g.inventory.add('air_tank', 1);
  assert.equal(bestDiveGear(g), 'swim_fins', 'the air tank needs Diving 70');
  assert.equal(diveBreath(g), levelBreath(40) + DIVE_GEAR[2].breath);
  setLevel(g, 'diving', 70);
  assert.equal(bestDiveGear(g), 'air_tank');
  // The guide's gear ladder ticks the piece in use.
  const rows = toolLadder(g, 'diving');
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.filter((r) => r.inUse).map((r) => r.id), ['air_tank']);
  assert.match(rows[0].bonus, /\+1 breath/);
  // Shops sell the snorkel to the air tank; the rest are crafted from bars and the reefs' finds.
  const general = new Set(SHOPS.general.stock.map((s) => s.id));
  for (const gear of DIVE_GEAR) {
    if (gear.tier <= SHOP_DIVE_TIER) assert.ok(general.has(gear.id), `${gear.id} in the General Store`);
    else {
      const r = CRAFT.find((c) => c.result === gear.id);
      assert.ok(r && r.upgrade && r.inputs.every((i) => ITEMS[i.id]), `${gear.id} is crafted`);
      assert.ok(r.level >= gear.level, `${gear.id} at Crafting ${r.level}`);
    }
  }
});

test('a dive gives the reef\'s catch and XP; a level too low stops it', () => {
  const g = newGame();
  const said = [];
  g.msg = (t) => said.push(t);
  const reef = g.world.objects.find((o) => o.objId === 'coral_garden');
  const a = { type: 'dive', obj: reef };
  assert.equal(resolveDive(g, a), false);
  assert.ok(said.some((t) => /Diving level of 32/.test(t)));
  setLevel(g, 'diving', 40);
  const xp0 = g.skills.xp.diving;
  assert.equal(resolveDive(g, a), true);
  assert.equal(g.inventory.count('coral_fragment'), 1);
  assert.ok(g.skills.xp.diving > xp0);
});

test('oyster beds give pearls by grade; a sunken chest holds coins, a gem and a clue; a whole reef bed now and then', () => {
  const g = newGame();
  // A deep bed's weights reach the perfect pearl.
  const bed = DIVE_SPOTS.find((s) => s.id === 'abyssal_pearl_bed');
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(findPearl(g, bed.pearl));
  for (const id of seen) assert.ok(PEARL_GRADES.includes(id));
  assert.ok(seen.has('perfect_pearl') || seen.has('golden_pearl'), 'the deep beds give the rare grades');
  assert.ok(!seen.has('seed_pearl'), 'and never a seed pearl');
  // The chest.
  const reef = g.world.objects.find((o) => o.objId === 'sunken_junk');
  const coins = g.inventory.count('coins');
  const r = sunkenChest(g, reef, 70);
  assert.ok(g.inventory.count('coins') > coins && ITEMS[r.gem]);
  assert.equal(r.clue, 'clue_scroll_hard');
  assert.ok(g.world.groundItems.some((gi) => gi.id === 'clue_scroll_hard'), 'the clue floats up beside you');
  // Pearls and chests come from resolveDive's own dice.
  setLevel(g, 'diving', 30);
  setDiveRand(() => 0);   // every roll lands
  try {
    const oy = g.world.objects.find((o) => o.objId === 'oyster_bed');
    const before = PEARL_GRADES.reduce((s, id) => s + g.inventory.count(id), 0);
    resolveDive(g, { type: 'dive', obj: oy });
    assert.ok(PEARL_GRADES.reduce((s, id) => s + g.inventory.count(id), 0) > before, 'a pearl');
    // The whole reef bed (jackpot.js's switch, off in the tests).
    NODE_JACKPOT.on = true;
    const n = diveJackpot(g, oy, { xpEach: 10 });
    assert.ok(n >= 10 && n <= 140, `${n} at once`);
  } finally { setDiveRand(Math.random); NODE_JACKPOT.on = false; }
});

test('pearls feed Crafting: pearl jewellery steps up the magic ladder', () => {
  let prev = { ring: 0, amulet: 0 };
  for (const [id, , slot, P, , level] of PEARL_JEWELLERY) {
    const it = ITEMS[id], r = CRAFT.find((c) => c.result === id);
    assert.ok(it?.equip && r, `${id} is jewellery with a recipe`);
    assert.equal(it.equip.slot, slot);
    assert.equal(r.level, level);
    assert.ok(r.inputs.some((i) => PEARL_GRADES.includes(i.id)), `${id} takes a pearl`);
    assert.ok(it.equip.bonuses.magic > 0, `${id} is a caster's piece`);
    assert.ok(P > prev[slot], `${id} beats the one before it`);
    prev[slot] = P;
  }
  // Within the existing ladder: no stronger than the best magic pieces of its band.
  assert.ok(ITEMS.perfect_pearl_amulet.equip.bonuses.magic <= ITEMS.occult_necklace.equip.bonuses.magic);
  assert.ok(ITEMS.lustrous_pearl_ring.equip.bonuses.magic > ITEMS.pearl_ring.equip.bonuses.magic);
});

test('Diving has unlocks, a teleport, golden hours, a life perk and a skill guide with reef cards', () => {
  assert.deepEqual(SKILL_UNLOCKS.diving.map((u) => u.level), [10, 25, 50, 75, 99]);
  assert.ok(SKILL_UNLOCKS.diving.some((u) => u.teleport === 'sentosa'));
  assert.ok(SKILL_HOURS.diving);
  assert.ok(LIFE_PERKS.diving);
  const g = newGame();
  const rows = gatherSources().filter((s) => s.skill === 'diving');
  assert.equal(rows.length, DIVE_SPOTS.length);
  assert.ok(rows.find((s) => s.key === 'oyster_bed').gives.some((x) => x.id === 'seed_pearl' && x.rare), 'oyster beds list their pearls');
  assert.equal(guideEntries('diving').length, DIVE_SPOTS.length);
  const cards = diveSpotList(g);
  assert.equal(cards.length, DIVE_SPOTS.length);
  assert.match(cards[0].text, /^Shell shallows: seashell \(level 1\), Sentosa Beach$/);
  return import('../src/ui/skillguideui.js').then(({ placeCards, skillListHTML }) => {
    assert.equal(placeCards(g, 'diving').length, DIVE_SPOTS.length);
    // Auto gather's tick boxes in the reef list.
    const html = skillListHTML(g, 'diving', { filter: 'all' }).html;
    assert.match(html, /data-pick="shell_shallows"/);
    assert.match(html, /xp\/hr/, 'with XP an hour');
  });
});

test('auto gather dives: a ticked reef, and the Life skills shortcut to the best reef you can dive', async () => {
  const g = newGame();
  setLevel(g, 'diving', 15);
  g.toggleGatherPick(['sea_glass_cove']);
  assert.ok(g.startGatherPicks(), 'Start walks to the ticked reef');
  for (let i = 0; i < 400 && g.player.action?.type !== 'dive'; i++) g.update(600);
  assert.equal(g.player.action?.obj?.objId, 'sea_glass_cove');
  for (let i = 0; i < 30; i++) g.update(600);
  assert.ok(g.inventory.count('sea_glass') > 0, 'diving for sea glass');
  g.clearGatherPicks();
  // The shortcut: the best reef for the level (no gear needed).
  const { startLifeSkill } = await import('../src/game/quickbar.js');
  const h = newGame();
  setLevel(h, 'diving', 25);
  h.player.x = h.player.tx = 58; h.player.y = h.player.ty = 55;
  assert.ok(startLifeSkill(h, 'diving'));
  assert.equal(h.autoGatherBest, 'diving');
  assert.equal(h.player.action?.obj?.objId, 'oyster_bed', 'the best reef your level allows');
});

test('an old save loads with Diving at level 1; a new save keeps it', () => {
  const g = newGame();
  // A save from before Diving: no diving XP in it at all.
  delete g.skills.xp.diving;
  saveGame(g);
  const g2 = new Game(); g2.start();
  assert.ok(loadGame(g2));
  assert.equal(g2.skills.level('diving'), 1);
  setLevel(g2, 'diving', 77);
  g2.inventory.add('rebreather', 1);
  saveGame(g2);
  const g3 = new Game(); g3.start();
  assert.ok(loadGame(g3));
  assert.equal(g3.skills.level('diving'), 77);
  assert.equal(g3.inventory.count('rebreather'), 1);
});

// ---------------- XP parity ----------------
// XP an hour from auto gather at a node, XP pinned at `lvl`, the best gear for
// the level, an endless bag (as tests/fishing-balance.test.mjs times them; the
// extras, golden hours to whole reef beds, are off: tests/seed.mjs).
const TOOLS = { woodcutting: 'axe', mining: 'pickaxe' };
function rate(skill, id, lvl, ticks, seed) {
  seedRandom(seed);
  const g = newGame();
  setLevel(g, skill, lvl);
  const tier = TOOL_TIERS.reduce((b, t, i) => (t.level <= lvl ? i : b), 0);
  g.inventory.add(skill === 'diving' ? DIVE_GEAR[tier].id : toolId(TOOLS[skill], tier), 1);
  noon(g);
  const start = standBy(g, id);
  g.toggleAutoGather(true);
  g.defaultObjectAction(start);
  const base = g.skills.xp[skill];
  let gain = 0;
  for (let i = 0; i < ticks; i++) {
    g.update(600); noon(g);
    gain += g.skills.xp[skill] - base; g.skills.xp[skill] = base;
    for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s && !ITEMS[s.id]?.tool) g.inventory.removeAt(k, s.qty); }
  }
  return gain * 6000 / ticks;
}
// The best node of each skill at each level (the measured best, as
// fishing-balance.test.mjs picks them), and Diving's newest reef.
const BEST = [
  { lvl: 30, mining: 'coal_rock', woodcutting: 'willow', diving: 'oyster_bed' },
  { lvl: 99, mining: 'runite_rock', woodcutting: 'magic_tree', diving: 'black_coral_reef' },
  { lvl: 200, mining: 'fallen_star', woodcutting: 'starfall_banyan', diving: 'star_coral_trench' },
  { lvl: 500, mining: 'eternal_lode', woodcutting: 'keramat_tree', diving: 'sunken_palace' },
];

test('Diving pays about what Mining and Woodcutting do an hour, at levels 30, 99, 200 and 500', () => {
  for (const b of BEST) {
    const two = (s) => (rate(s, b[s], b.lvl, 800, SEED) + rate(s, b[s], b.lvl, 800, SEED + 7919)) / 2;
    const mining = two('mining'), wood = two('woodcutting');
    const diving = rate('diving', b.diving, b.lvl, 600, SEED);   // a reef never runs dry: one run is exact
    const x = diving / ((mining + wood) / 2);
    assert.ok(x >= 0.9 && x <= 1.3, `level ${b.lvl}: Diving is ${x.toFixed(2)}x their average (mining ${Math.round(mining / 1e3)}k, woodcutting ${Math.round(wood / 1e3)}k, diving ${Math.round(diving / 1e3)}k)`);
  }
});

test('each reef pays more an hour than the one before it, at its own level, and the guide\'s XP an hour agrees with a dive', () => {
  let prev = 0;
  for (const s of DIVE_SPOTS) {
    const r = rate('diving', s.id, s.level, 120, SEED);
    assert.ok(r > prev, `${s.id}: ${Math.round(r)} an hour against ${Math.round(prev)} at the reef before it`);
    prev = r;
  }
  // xprate.js works it out from the rules: within a few percent of a headless run.
  const lvl = 99, g = newGame();
  setLevel(g, 'diving', lvl);
  g.inventory.add(DIVE_GEAR[5].id, 1);
  const src = gatherSources().find((x) => x.key === 'black_coral_reef');
  const want = xpRate(g, src).perHour, got = rate('diving', 'black_coral_reef', lvl, 600, SEED);
  assert.ok(Math.abs(got / want - 1) < 0.05, `xprate ${Math.round(want)} against a run's ${Math.round(got)}`);
});
