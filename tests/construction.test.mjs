// Construction, the making skill of the kampong home: planks sawn at a
// sawmill, bricks fired at a kiln, nails hammered with Smithing, furniture
// built at a workbench (the lumber yards), and the home's builds and room
// perks (home.js). Also: its XP an hour matches the other making skills, its
// wiring (guide, unlocks, golden hours, perk, pet, lesson) is all there, and
// saves from before it load with every home upgrade kept.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { xpForLevel } from '../src/data/xp.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { SKILL_BY_ID } from '../src/data/skills.js';
import { SMITH } from '../src/data/smithing.js';
import { CONSTRUCT, CON_TIERS, CON_STATIONS, conRecipes } from '../src/data/construction.js';
import { SKILL_UNLOCKS, UNLOCKS } from '../src/data/unlocks.js';
import { GATHER_FUN } from '../src/game/gathering.js';
import { FISH_SCHOOL } from '../src/game/fishschool.js';
import { NODE_JACKPOT } from '../src/game/jackpot.js';
import { LEVEL_HAUL } from '../src/game/levelhaul.js';
import { SKILL_HOURS } from '../src/data/skillhours.js';
import { LIFE_STAGES_WILD } from '../src/data/lifeskills.js';
import { LIFE_PERKS } from '../src/game/lifeperks.js';
import { SKILL_PETS } from '../src/game/pets.js';
import { makeXp, makeXpMult, PRODUCTION_XP_MULT } from '../src/game/skilling.js';
import { HOME_PRICE, HOME_UPGRADES, ROOMS, UPGRADE_KEYS } from '../src/game/home.js';
import { YARD_ANCHORS } from '../src/game/construction.js';
import { recipesFor, SKILL_GUIDES, MAKE_SKILLS, itemEntry } from '../src/game/skillguide.js';
import { TRAIN_SKILLS, trainingFor } from '../src/game/foryou.js';
import { LIFE_SHORTCUTS } from '../src/game/quickbar.js';
import { applyAway, RESTED_RATE, FOCUS_MAX_MS } from '../src/game/playbalance.js';
import { ALTAR_XP_MULT } from '../src/data/bones.js';
import { itemIconSVG, skillIconSVG } from '../src/render/icons.js';
import { playerAt, gatherHour, bestMake, measureMake, GATHER } from '../tools/balance/productionxp.mjs';

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
const setLevel = (g, s, l) => { g.skills.xp[s] = xpForLevel(l); };
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
/** Give everything a home build's next tier takes (and the level and a hammer). */
function kitFor(g, key) {
  const next = g.home.nextTier(key);
  setLevel(g, 'construction', Math.max(g.skills.level('construction'), next.level || 1));
  if (!g.hasTool('hammer')) g.inventory.add('hammer', 1);
  g.inventory.add('coins', next.cost?.coins || 0);
  for (const [id, n] of Object.entries(next.cost?.items || {})) g.bank.deposit(id, n);
}

// ---------------- The skill and its materials ----------------

test('Construction is a making skill with planks, nails, bricks and furniture at every tier', () => {
  assert.equal(SKILL_BY_ID.construction.group, 'making');
  assert.equal(CON_TIERS.length, 12);
  for (const t of CON_TIERS) {
    for (const id of [t.plank, t.nails, t.furniture]) assert.ok(ITEMS[id], `${id} is an item`);
    assert.ok(ITEMS[t.log]?.tags.includes('log'), `${t.plank} comes from a log (${t.log})`);
    assert.ok(ITEMS[t.bar], `${t.nails} come from a bar (${t.bar})`);
    // Nails: fifteen from a bar at an anvil, for less Smithing XP a bar than the tier's other pieces.
    const nail = SMITH.find((r) => r.result === t.nails);
    assert.ok(nail && nail.bar === t.bar && nail.qty === 15 && nail.barCount === 1, `${t.nails} at the anvil`);
    const best = Math.max(...SMITH.filter((r) => r.bar === t.bar && r.result !== t.nails && !r.upgrade).map((r) => r.xp / r.barCount));
    assert.ok(nail.xp <= best, `${t.nails}: ${nail.xp} xp a bar, never more than the tier's best piece (${best})`);
  }
  // Endgame (100+) builds use the endgame logs and bars.
  for (const t of CON_TIERS.filter((x) => x.level >= 100)) assert.ok(ITEMS[t.log].firemaking >= 100, `${t.plank}: an endgame log`);
  assert.ok(ITEMS.brick);
  // Each recipe is worked at a real station type, and its inputs are real items.
  for (const r of CONSTRUCT) {
    assert.ok(r.at.every((t) => CON_STATIONS.includes(t)), r.result);
    for (const [id] of r.inputs) assert.ok(ITEMS[id], `${r.result} takes ${id}`);
  }
  // Furniture sells for about what went in: building is not a way to mint coins.
  for (const r of CONSTRUCT.filter((x) => x.at.includes('build'))) {
    const parts = r.inputs.reduce((s, [id, n]) => s + ITEMS[id].value * n, 0);
    assert.ok(ITEMS[r.result].value <= parts * 1.15, `${r.result} is worth about its parts`);
  }
  // Until their own stickers arrive they borrow one, recoloured (the skill's icon is a vector).
  for (const id of ['plank', 'heartwood_plank', 'bronze_nails', 'eternal_nails', 'brick', 'wooden_stool', 'starwood_lantern_stand']) {
    assert.match(itemIconSVG(id), /assets\/icons\/item-(arrow_shaft|barbed_hooks|clay|lobster_pot|lantern)\.webp/, `${id} borrows a sticker`);
  }
  assert.match(skillIconSVG('construction'), /<svg/);
});

test('the lumber yards stand in Kampong Glam and Kranji, clear of the home plot, the same every boot', () => {
  const g = newGame();
  assert.equal(g.lumberYards.length, YARD_ANCHORS.length);
  for (const y of g.lumberYards) {
    assert.equal(g.world.zoneAt(y.x, y.y)?.name, y.name === 'Kranji' ? 'Kranji Farmlands' : 'Kampong Glam', y.name);
    for (const id of ['sawmill', 'kiln', 'workbench']) assert.ok(g.world.objects.some((o) => o.objId === id && Math.abs(o.x - y.x) <= 5 && Math.abs(o.y - y.y) <= 3), `${y.name}: ${id}`);
  }
  const o = g.home.origin;
  for (const s of g.world.objects.filter((x) => ['sawmill', 'kiln', 'workbench'].includes(x.objId))) {
    assert.ok(s.x < o.x || s.x >= o.x + 9 || s.y < o.y || s.y >= o.y + 8, 'not on the home plot');
  }
  const g2 = new Game();
  assert.deepEqual(g2.lumberYards, g.lumberYards);
  assert.deepEqual(g2.home.origin, g.home.origin, 'the home plot is where it always was');
});

test('sawing, firing and building: each make pays its boosted XP, and "Do all" works through the pack', () => {
  const g = newGame();
  const at = (id) => g.world.objects.find((o) => o.objId === id);
  // Planks at the sawmill.
  const saw = at('sawmill');
  standBy(g, saw);
  setLevel(g, 'construction', 99);
  g.inventory.add('logs', 6); g.inventory.add('oak_logs', 4);
  const xp0 = g.skills.xp.construction;
  const per = (r) => g.skills.xpAtLevel('construction', makeXp(g, 'construction', r.xp));
  const want = 6 * per(CONSTRUCT.find((r) => r.result === 'plank')) + 4 * per(CONSTRUCT.find((r) => r.result === 'oak_plank'));
  g.startAll('saw', saw);
  g.update(600);
  assert.equal(g.inventory.count('logs') + g.inventory.count('oak_logs'), 0, 'every log sawn');
  assert.equal(g.inventory.count('plank'), 6); assert.equal(g.inventory.count('oak_plank'), 4);
  near(g.skills.xp.construction - xp0, want, 'sawing pays each plank\'s XP');
  // Bricks at the kiln.
  const kiln = at('kiln');
  standBy(g, kiln);
  g.inventory.add('clay', 5);
  g.startAll('kiln', kiln);
  g.update(600);
  assert.equal(g.inventory.count('brick'), 5);
  // Furniture at the workbench needs a hammer.
  const wb = at('workbench');
  standBy(g, wb);
  for (let k = 0; k < g.inventory.size; k++) if (g.inventory.slotAt(k)?.id === 'hammer') g.inventory.removeAt(k, 1);
  g.bank.withdraw?.('hammer', 99); g.inventory.remove('hammer', 99);
  g.inventory.add('iron_nails', 8);
  const stool = CONSTRUCT.find((r) => r.result === 'oak_chair');
  g.startRecipe('construction', stool, wb);
  g.update(600);
  assert.equal(g.inventory.count('oak_chair'), 0, 'no hammer, no chair');
  g.inventory.add('hammer', 1);
  g.startRecipe('construction', stool, wb);
  g.update(600);
  assert.equal(g.inventory.count('oak_chair'), 1, 'built with a hammer');
  // The workbench builds but doesn't saw, and the sawmill doesn't build.
  assert.ok(conRecipes('build').every((r) => !r.at.includes('saw')));
  assert.ok(conRecipes('homebench').some((r) => r.at.includes('saw')) && conRecipes('homebench').some((r) => r.at.includes('build')), 'the home workbench does both');
  assert.ok(MAKE_SKILLS.includes('construction'));
  assert.ok(recipesFor('construction').length === CONSTRUCT.length, 'the skill guide lists every recipe');
});

// ---------------- XP parity ----------------

test('XP an hour: Construction pays what the other making skills do at levels 30, 99, 200 and 500', () => {
  // Measured as tools/balance/productionxp.mjs does, with everything in play
  // (seed.mjs switches these off for the other tests; beforeEach puts that back).
  UNLOCKS.on = GATHER_FUN.on = FISH_SCHOOL.on = NODE_JACKPOT.on = LEVEL_HAUL.on = true;
  for (const L of [30, 99, 200, 500]) {
    const g = playerAt(L, 20261112);
    const { perItem, best } = gatherHour(g);
    const avg = GATHER.reduce((a, s) => a + best[s].perHour, 0) / GATHER.length;
    const hour = (skill) => {
      const m = bestMake(g, skill, perItem);
      let xp = measureMake(g, m.r, 6);
      for (const c of m.chain) if (c.r.skill === skill) xp += c.n * measureMake(g, c.r, 6);
      return xp / m.hours;
    };
    const con = hour('construction');
    const others = ['smithing', 'crafting', 'fletching'].map(hour);
    const making = others.reduce((a, b) => a + b, 0) / others.length;
    assert.ok(con / avg > 0.85 && con / avg < 1.15, `level ${L}: Construction ${(con / avg).toFixed(2)}x the gathering average`);
    assert.ok(con / making > 0.85 && con / making < 1.15, `level ${L}: Construction ${(con / making).toFixed(2)}x Smithing, Crafting and Fletching`);
  }
  // The making multiple is lifted at every level and held past the last.
  const t = PRODUCTION_XP_MULT.construction;
  for (const [l, m] of t) near(makeXpMult('construction', l), m, `at ${l}`);
  near(makeXpMult('construction', 9999), t[t.length - 1][1], 'past the last');
});

// ---------------- The home ----------------

test('home builds are Construction builds: level, hammer and materials gate them, and they pay XP', () => {
  const g = newGame();
  const h = g.home;
  assert.match(h.whyNot('workshop'), /Buy the plot/);
  g.inventory.add('coins', HOME_PRICE);
  assert.ok(h.buy());
  // Every line's tiers past the first have a level, XP and a cost.
  for (const k of UPGRADE_KEYS) for (const t of HOME_UPGRADES[k].tiers.slice(1)) {
    assert.ok(t.level >= 1 && t.xp > 0 && t.cost, `${k} ${t.name}`);
    for (const id of Object.keys(t.cost.items || {})) assert.ok(ITEMS[id], `${k} ${t.name} takes ${id}`);
  }
  // Endgame builds (100+) take the endgame planks and nails.
  for (const k of UPGRADE_KEYS) for (const t of HOME_UPGRADES[k].tiers.filter((x) => x.level >= 100)) {
    assert.ok(Object.keys(t.cost.items).some((id) => CON_TIERS.some((c) => c.level >= 100 && (c.plank === id || c.nails === id || c.furniture === id))), `${k} ${t.name}`);
  }
  // Every line is on a room card, once.
  assert.deepEqual(ROOMS.flatMap((r) => r.lines).sort(), [...UPGRADE_KEYS].sort());
  // Too low a level.
  const next = h.nextTier('storage');
  g.inventory.add('coins', next.cost.coins);
  for (const [id, n] of Object.entries(next.cost.items)) g.inventory.add(id, n);
  assert.match(h.whyNot('storage'), /Construction level of 30/);
  assert.equal(h.upgrade('storage'), false);
  setLevel(g, 'construction', 30);
  if (!g.hasTool('hammer')) g.inventory.add('hammer', 1);
  const xp0 = g.skills.xp.construction, pays = g.skills.xpAtLevel('construction', makeXp(g, 'construction', next.xp));
  assert.equal(h.upgrade('storage'), true);
  assert.equal(h.capacity, 48);
  near(g.skills.xp.construction - xp0, pays, 'the build pays its XP');
  assert.equal(g.inventory.count('teak_plank'), 0, 'the planks are used');
});

test('rooms put their furniture in the plot and give their perks', () => {
  const g = newGame();
  const h = g.home;
  g.inventory.add('coins', HOME_PRICE);
  h.buy();
  const inPlot = (id) => g.world.objects.filter((o) => o.objId === id && h.isHome(o.x, o.y));
  // Workshop: a workbench, an anvil, then a crafting table and fletching bench, then kept materials at all of them.
  for (let t = 1; t <= 4; t++) { kitFor(g, 'workshop'); assert.ok(h.upgrade('workshop'), `workshop ${t}`); }
  for (const id of ['home_workbench', 'anvil', 'crafting_table', 'fletching_bench']) {
    assert.equal(inPlot(id).length, 1, id);
    assert.deepEqual(inPlot(id)[0].homeFx, { save: 0.05 }, `${id}: the Master workshop's kept materials`);
  }
  // The home workbench saws and builds.
  const hb = inPlot('home_workbench')[0];
  standBy(g, hb);
  g.inventory.add('logs', 3);
  g.startAll('homebench', hb);
  g.update(600);
  assert.equal(g.inventory.count('logs'), 0, 'sawn at home');
  // Altar: offering bones at home pays less than a monument until the top tier.
  assert.equal(h.altarMult(), 1);
  kitFor(g, 'altar'); h.upgrade('altar');
  const altar = inPlot('home_altar')[0];
  assert.ok(altar);
  standBy(g, altar);
  assert.equal(g.altarMult(), 1.5);
  g.inventory.add('bones', 10);
  const p0 = g.skills.xp.prayer;
  g.buryAllBones(true);
  const offered = g.skills.xp.prayer - p0;
  g.inventory.add('bones', 10);
  const p1 = g.skills.xp.prayer;
  g.buryAllBones(false);
  near(offered / (g.skills.xp.prayer - p1), 1.5, 'the offering table pays 1.5x');
  for (let t = 2; t <= 4; t++) { kitFor(g, 'altar'); h.upgrade('altar'); }
  assert.equal(h.altarMult(), ALTAR_XP_MULT, 'the top altar matches a monument');
  for (const t of HOME_UPGRADES.altar.tiers) assert.ok((t.mult || 1) <= ALTAR_XP_MULT, 'never above a monument');
  // Bedroom: rested XP builds faster while you're away.
  kitFor(g, 'bedroom'); h.upgrade('bedroom');
  g.play.rested = 0;
  applyAway(g, 60 * 60 * 1000);
  near(g.play.rested, 60 * 60 * 1000 * RESTED_RATE * 1.25, 'a sleeping mat: 25% faster');
  // Parlour: Focus refills while you're at home, not elsewhere.
  kitFor(g, 'parlour'); h.upgrade('parlour');
  assert.equal(inPlot('home_parlour').length, 1);
  g.play.focus = 0;
  g.player.x = g.player.tx = h.origin.x + 4; g.player.y = g.player.ty = h.origin.y + 5;
  h.tick();
  assert.ok(g.play.focus > 0 && g.play.focus < FOCUS_MAX_MS, 'refills at home');
  const f = g.play.focus;
  g.player.x = g.player.tx = 60; g.player.y = g.player.ty = 55;
  h.tick();
  assert.equal(g.play.focus, f, 'not away from home');
  // Trophy hall: a little extra boss damage.
  const boss0 = g.equipment.bonuses().bossDmg;
  kitFor(g, 'trophy'); h.upgrade('trophy');
  assert.equal(g.equipment.bonuses().bossDmg - boss0, 2);
  // Bank chest.
  kitFor(g, 'bank'); h.upgrade('bank');
  assert.equal(inPlot('home_bank')[0]?.def.type, 'bank');
  // Portals: to the MRT of any region you've visited, with a recharge.
  kitFor(g, 'portals'); h.upgrade('portals');
  g.zonesVisited = new Set(['Kampong Glam']);
  assert.ok(h.portalTargets().length >= 1 && h.portalTargets().every((s) => g.world.zoneAt(s.x, s.y)?.name === 'Kampong Glam'), 'only the regions you have visited');
  assert.equal(h.portalTo('kranji'), false, 'not a region you have visited');
  assert.equal(h.portalTo(h.portalTargets()[0].id), true);
  assert.ok(h.portalWait() > 0);
  assert.equal(h.portalTo(h.portalTargets()[0].id), false, 'recharging');
  // Each piece of furniture opens its room in the Build window.
  for (const id of ['home_parlour', 'home_bed']) assert.ok(ROOMS.some((r) => r.id === OBJECTS[id].room), id);
});

// ---------------- Saves ----------------

test('a save from before Construction loads at level 1 with every home upgrade and its perk kept', () => {
  const g = newGame();
  const h = g.home;
  g.inventory.add('coins', HOME_PRICE);
  h.buy();
  // As bought under the old coin prices: set straight to the tiers.
  Object.assign(h.tiers, { storage: 2, range: 2, patches: 2, decor: 2, portal: 1 });
  h.refresh();
  assert.ok(saveGame(g));
  const raw = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY));
  delete raw.skills.construction;
  raw.home.tiers = { storage: 2, range: 2, patches: 2, decor: 2, portal: 1 };   // no Construction lines
  delete raw.home.portalWait;
  globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.equal(g2.skills.level('construction'), 1, 'Construction starts at level 1');
  assert.equal(g2.skills.xp.construction, 0);
  assert.deepEqual({ ...g2.home.tiers }, { storage: 2, range: 2, patches: 2, decor: 2, portal: 1, parlour: 0, bank: 0, workshop: 0, altar: 0, bedroom: 0, portals: 0, trophy: 0 });
  assert.equal(g2.home.capacity, 96, 'the granite strongbox is kept');
  const range = g2.world.objects.find((o) => o.objId === 'range' && o.home);
  assert.deepEqual(range.homeFx, { save: 0.10, quick: 0.05 }, 'the hawker range keeps its perk');
  assert.equal(g2.home.tpTicks, 400, 'swift return is kept');
  assert.equal(g2.world.objects.filter((o) => o.objId === 'farm_patch' && o.home).length, 6);
  // A new save round-trips the new lines.
  kitFor(g2, 'workshop'); g2.home.upgrade('workshop');
  setLevel(g2, 'construction', 77);
  saveGame(g2);
  const g3 = new Game();
  assert.ok(loadGame(g3));
  assert.equal(g3.home.tiers.workshop, 1);
  assert.equal(g3.skills.level('construction'), 77);
  assert.ok(g3.world.objects.some((o) => o.objId === 'home_workbench' && g3.home.isHome(o.x, o.y)));
});

// ---------------- Wiring ----------------

test('Construction is wired in: guide, unlocks, golden hours, life perk, pet, shortcut, For you and the lesson', () => {
  assert.ok(SKILL_GUIDES.construction.use && SKILL_GUIDES.construction.where.every((id) => OBJECTS[id]));
  assert.deepEqual(SKILL_UNLOCKS.construction.map((u) => u.level), [10, 25, 50, 75, 99]);
  assert.equal(SKILL_UNLOCKS.construction.find((u) => u.teleport).teleport, 'kranji', 'the teleport goes to the Kranji lumber yard, not home');
  assert.ok(SKILL_HOURS.construction);
  assert.equal(LIFE_PERKS.construction.stat, 'mobDmg');
  assert.ok(SKILL_PETS.construction);
  assert.ok(LIFE_SHORTCUTS.includes('construction') && TRAIN_SKILLS.includes('construction'));
  const st = LIFE_STAGES_WILD[LIFE_STAGES_WILD.length - 1];
  assert.equal(st.skill, 'construction', 'the lesson joins Trades of the Wild at the end (a course under way keeps its place)');
  assert.ok(ITEMS[st.need.item]);
  const g = newGame();
  setLevel(g, 'construction', 40);
  assert.ok(trainingFor(g, 'construction', 1).length, 'For you suggests something');
  assert.ok(itemEntry('teak_plank').other.some((o) => o.kind === 'build'), 'the Resources index names the home builds a plank goes into');
  // The lesson: sawn planks, guided to the sawmill once you have logs.
  g.startLife('life_skills_wild');
  g.quests.life_skills_wild.stage = LIFE_STAGES_WILD.length;
  g._beginLifeStage?.('life_skills_wild');
  assert.equal(g.questGuide('life_skills_wild').objId, 'tree', 'chop logs first');
  g.inventory.add('logs', 5);
  assert.equal(g.questGuide('life_skills_wild').objId, 'sawmill');
});
