// Archaeology (src/data/archaeology.js, src/game/archaeology.js): the dig
// sites and where they lie, digging and its relics, the trowels, restoring at
// the bench, the museum and its sets, the skill guide's wiring, auto gather,
// saves, and XP an hour in step with Mining and Woodcutting (digging) and
// with the making skills (restoring).
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
import { buildWorld } from '../src/data/world.js';
import { DIG_SITES, DIG_SITE_SIZE, TROWELS, MUSEUM_SETS, SHOP_TROWEL_TIER, RELIC_CHANCE, RELIC_SET_BONUS, museumPage, restoreRecipes } from '../src/data/archaeology.js';
import { resolveExcavate, setDigRand, findRelic, digJackpot, relicChance, museumSets, donateAll, setsDone } from '../src/game/archaeology.js';
import { NODE_JACKPOT } from '../src/game/jackpot.js';
import { LEVEL_HAUL } from '../src/game/levelhaul.js';
import { GATHER_FUN } from '../src/game/gathering.js';
import { LIFE_PERKS } from '../src/game/lifeperks.js';
import { toolLadder, bestTool } from '../src/game/tools.js';
import { gatherSources, digSiteList, recipesFor, GATHER_SKILLS, SKILL_GUIDES } from '../src/game/skillguide.js';
import { tradeRecipes, nextJob } from '../src/game/autoprocess.js';
import { xpRate } from '../src/game/xprate.js';
import { chebyshev } from '../src/core/utils.js';

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
const noon = (g) => { g.playMs = 0.5 * 10 * 60 * 1000; };
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, id) {
  const all = g.world.objects.filter((o) => o.objId === id);
  const near = (o) => all.filter((p) => chebyshev(p.x, p.y, o.x, o.y) <= 15).length;
  const spot = all.reduce((a, b) => (near(b) > near(a) ? b : a));
  const [dx, dy] = ADJ.find(([ax, ay]) => !g.world.isBlocked(spot.x + ax, spot.y + ay) && !g.world.objectAt(spot.x + ax, spot.y + ay));
  g.player.x = g.player.tx = spot.x + dx; g.player.y = g.player.ty = spot.y + dy;
  return spot;
}

test('Archaeology is a gathering skill with dig sites from level 1 to 300, each with a museum set of three', () => {
  assert.equal(SKILL_BY_ID.archaeology.group, 'gathering');
  assert.ok(GATHER_SKILLS.includes('archaeology') && SKILL_GUIDES.archaeology.use);
  const levels = DIG_SITES.map((s) => s.level);
  assert.deepEqual([...levels].sort((a, b) => a - b), levels);
  assert.equal(levels[0], 1); assert.equal(levels.at(-1), 300);
  assert.ok(levels.filter((l) => l >= 100).length >= 6, 'six endgame sites');
  for (let i = 1; i < DIG_SITES.length; i++) assert.ok(DIG_SITES[i].xp > DIG_SITES[i - 1].xp, DIG_SITES[i].id);
  // The sites the owner named are there.
  for (const id of ['kampong_ruins', 'coastal_midden', 'river_godowns', 'ubin_dig', 'fort_canning_dig']) assert.ok(OBJECTS[id], id);
  assert.ok(MUSEUM_SETS.some((m) => m.name === 'Temasek treasures') && MUSEUM_SETS.some((m) => m.name === 'Kampong kitchen'));
  for (const s of DIG_SITES) {
    assert.equal(OBJECTS[s.id].type, 'dig');
    assert.ok(ITEMS[s.gives], `${s.gives} is an item`);
    assert.equal(s.relics.length, 3);
    for (const r of s.relics) {
      assert.ok(ITEMS[r.id] && ITEMS[r.encrusted], r.id);
      assert.equal(ITEMS[r.id].artefact, s.set);
      // Cosy: everyday and ancient things only.
      assert.doesNotMatch(`${r.name} ${r.examine}`, /\b(war|bomb|shell casing|bullet|helmet|grave|skull|bone|remains|weapon|sword|gun)\b/i, r.id);
    }
  }
});

test('every site is placed in its region, reachable, and the museum stands in Chinatown with its bench', () => {
  const w = buildWorld();
  const zoneAt = (x, y) => w.zones.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);
  const g = newGame();
  for (const s of DIG_SITES) {
    const os = w.objects.filter((o) => o.objId === s.id);
    assert.equal(os.length, DIG_SITE_SIZE, `${s.id}: ${os.length} placed`);
    for (const o of os) assert.equal(zoneAt(o.x, o.y)?.name, s.region, `${s.id} in ${s.region}`);
    if (s.level >= 100) assert.ok(zoneAt(os[0].x, os[0].y).far || zoneAt(os[0].x, os[0].y).lo >= 120, `${s.id} is in a far region`);
    const site = g.world.objects.find((o) => o.objId === s.id);
    g.player.x = g.player.tx = 58; g.player.y = g.player.ty = 55;
    assert.ok(g.goToObject(site), `${s.id} can be walked to`);
  }
  const cur = w.npcSpawns.filter((n) => n.npcId === 'museum_curator'), bench = w.objects.filter((o) => o.objId === 'restoration_bench');
  assert.equal(cur.length, 1); assert.equal(bench.length, 1);
  assert.equal(zoneAt(cur[0].x, cur[0].y).name, 'Chinatown');
  assert.ok(chebyshev(cur[0].x, cur[0].y, bench[0].x, bench[0].y) <= 1, 'the bench beside her');
  // Placed after everything else: the world without the late additions has none.
  const bare = buildWorld({ groves: false });
  assert.equal(bare.objects.filter((o) => OBJECTS[o.objId]?.type === 'dig').length, 0);
});

test('a dig gives the site\'s find and XP, relics now and then, and you can dig with your hands', () => {
  const g = newGame();
  const said = [];
  g.msg = (t) => said.push(t);
  const site = g.world.objects.find((o) => o.objId === 'river_godowns');
  assert.equal(resolveExcavate(g, { type: 'excavate', obj: site }), false);
  assert.ok(said.some((t) => /Archaeology level of 30/.test(t)));
  setLevel(g, 'archaeology', 35);
  assert.equal(bestTool(g, 'trowel'), null, 'no trowel');
  const xp0 = g.skills.xp.archaeology;
  setDigRand(() => 0.99);   // no relic, no double
  try { assert.equal(resolveExcavate(g, { type: 'excavate', obj: site }), true); } finally { setDigRand(Math.random); }
  assert.equal(g.inventory.count('old_coin'), 1);
  assert.ok(g.skills.xp.archaeology > xp0);
  // A relic: one of the site's three, encrusted.
  const s = DIG_SITES.find((x) => x.id === 'river_godowns');
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(findRelic(g, s, 35));
  assert.deepEqual([...seen].sort(), s.relics.map((r) => r.encrusted).sort(), 'all three turn up');
  // The whole trench (jackpot.js's switch, off in the tests).
  NODE_JACKPOT.on = true;
  setDigRand(() => 0);
  try { const n = digJackpot(g, site, { xpEach: 10 }); assert.ok(n >= 10 && n <= 140); } finally { setDigRand(Math.random); NODE_JACKPOT.on = false; }
});

test('trowels: twelve tiers on the tool levels, the best you can use picked, shops sell five, the rest crafted; relics likelier with a better one', () => {
  assert.deepEqual(TROWELS.map((t) => t.level), TOOL_TIERS.map((t) => t.level));
  const g = newGame();
  setLevel(g, 'archaeology', 40);
  g.inventory.add('trowel', 1); g.inventory.add('steel_trowel', 1); g.inventory.add('adamant_trowel', 1);
  assert.equal(bestTool(g, 'trowel'), 'steel_trowel', 'adamant needs 70');
  const rows = toolLadder(g, 'archaeology');
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.filter((r) => r.inUse).map((r) => r.id), ['steel_trowel']);
  const general = new Set(SHOPS.general.stock.map((s) => s.id));
  assert.ok(general.has('soft_brush'));
  for (const t of TROWELS) {
    if (t.tier <= SHOP_TROWEL_TIER) assert.ok(general.has(t.id), `${t.id} sold`);
    else { const r = CRAFT.find((c) => c.result === t.id); assert.ok(r && r.upgrade && r.inputs.every((i) => ITEMS[i.id]), `${t.id} crafted`); }
  }
  setLevel(g, 'archaeology', 300);
  g.inventory.add('eternal_trowel', 1);
  assert.ok(relicChance(g) > RELIC_CHANCE, 'the best trowel finds more relics');
});

test('restoring at the bench: a relic, two of its site\'s finds and a brush make the artefact, one at a time or "Restore all"', () => {
  const g = newGame();
  setLevel(g, 'archaeology', 20);
  const bench = g.world.objects.find((o) => o.objId === 'restoration_bench');
  const recipes = tradeRecipes('archaeology');
  assert.equal(recipes.length, DIG_SITES.length * 3);
  assert.deepEqual(recipesFor('archaeology').filter((r) => r.kind === 'restore').length, recipes.length);
  const r = recipes.find((x) => x.result === 'tiffin_carrier');
  g.inventory.add('encrusted_tiffin_carrier', 2); g.inventory.add('pottery_shard', 4);
  assert.equal(nextJob(g, 'archaeology'), null, 'no brush, no restoring');
  g.inventory.add('soft_brush', 1);
  const job = nextJob(g, 'archaeology');
  assert.equal(job?.recipe.result, 'tiffin_carrier');
  for (const [dx, dy] of ADJ) if (!g.world.isBlocked(bench.x + dx, bench.y + dy)) { g.player.x = g.player.tx = bench.x + dx; g.player.y = g.player.ty = bench.y + dy; break; }
  const xp0 = g.skills.xp.archaeology;
  g.startAll('archaeology', bench);
  for (let i = 0; i < 5; i++) g.update(600);
  assert.equal(g.inventory.count('tiffin_carrier'), 2, 'both restored');
  assert.equal(g.inventory.count('pottery_shard'), 0);
  assert.ok(g.skills.xp.archaeology > xp0 + r.xp, 'restoring pays Archaeology XP');
});

test('the museum: give Curator Siti the pieces, finish a set for coins, XP, a title and likelier relics', async () => {
  const g = newGame();
  const set = MUSEUM_SETS[0];
  g.inventory.add(set.items[0], 2); g.inventory.add(set.items[1], 1);
  let st = museumSets(g)[0];
  assert.deepEqual(st.have, set.items.slice(0, 2));
  const { museumHTML } = await import('../src/ui/museumui.js');
  assert.match(museumHTML(g), /data-give="1"/);
  let r = donateAll(g);
  assert.deepEqual(r.given, set.items.slice(0, 2));
  assert.equal(g.inventory.count(set.items[0]), 1, 'a duplicate stays in your pack, to sell');
  assert.equal(museumSets(g)[0].got.length, 2);
  const coins = g.inventory.count('coins'), xp = g.skills.xp.archaeology, chance = relicChance(g);
  g.inventory.add(set.items[2], 1);
  r = donateAll(g);
  assert.deepEqual(r.finished, [set.id]);
  assert.ok(g.inventory.count('coins') >= coins + set.coins, 'its coins (an achievement may add more)');
  assert.ok(g.skills.xp.archaeology > xp);
  assert.equal(setsDone(g), 1);
  assert.ok(Math.abs(relicChance(g) / chance - (1 + RELIC_SET_BONUS)) < 1e-9, 'relics a little likelier');
  assert.ok(g.collection.titles().some((t) => t.title === set.title), 'its Collection log title');
  // Nothing more to give: the button goes.
  assert.doesNotMatch(museumHTML(g), /data-give="1"/);
  // Saved and loaded with the Collection log.
  saveGame(g);
  const g2 = new Game(); g2.start(); assert.ok(loadGame(g2));
  assert.equal(setsDone(g2), 1);
  assert.equal(g2.collection.log[museumPage(set.id)][set.items[2]], 1);
});

test('Archaeology has unlocks, a teleport, golden hours, a life perk and a guide with site cards and tick boxes', async () => {
  assert.deepEqual(SKILL_UNLOCKS.archaeology.map((u) => u.level), [10, 25, 50, 75, 99]);
  assert.ok(SKILL_UNLOCKS.archaeology.some((u) => u.teleport === 'chinatown'));
  assert.ok(SKILL_HOURS.archaeology); assert.ok(LIFE_PERKS.archaeology);
  const g = newGame();
  const rows = gatherSources().filter((s) => s.skill === 'archaeology');
  assert.equal(rows.length, DIG_SITES.length);
  assert.ok(rows[0].gives.some((x) => /^encrusted_/.test(x.id) && x.rare), 'relics listed as rare finds');
  assert.equal(digSiteList(g).length, DIG_SITES.length);
  const { placeCards, skillListHTML } = await import('../src/ui/skillguideui.js');
  const cards = placeCards(g, 'archaeology');
  assert.equal(cards.length, DIG_SITES.length + 1, 'the sites and the bench');
  assert.match(skillListHTML(g, 'archaeology', { filter: 'all' }).html, /data-pick="kampong_ruins"/);
  assert.match(skillListHTML(g, 'archaeology', { filter: 'restore' }).html, /Enamel tiffin carrier/);
});

test('auto gather digs: a ticked site, and the Life skills shortcut to the best site you can dig', async () => {
  const g = newGame();
  g.toggleGatherPick(['kampong_ruins']);
  assert.ok(g.startGatherPicks());
  for (let i = 0; i < 400 && g.player.action?.type !== 'excavate'; i++) g.update(600);
  assert.equal(g.player.action?.obj?.objId, 'kampong_ruins');
  for (let i = 0; i < 20; i++) g.update(600);
  assert.ok(g.inventory.count('pottery_shard') > 0);
  const { startLifeSkill } = await import('../src/game/quickbar.js');
  const h = newGame();
  setLevel(h, 'archaeology', 20);
  h.player.x = h.player.tx = 58; h.player.y = h.player.ty = 55;
  assert.ok(startLifeSkill(h, 'archaeology'));
  assert.equal(h.player.action?.obj?.objId, 'coastal_midden', 'the best site your level allows');
});

test('an old save loads with Archaeology at level 1; a new save keeps it', () => {
  const g = newGame();
  delete g.skills.xp.archaeology;
  saveGame(g);
  const g2 = new Game(); g2.start();
  assert.ok(loadGame(g2));
  assert.equal(g2.skills.level('archaeology'), 1);
  setLevel(g2, 'archaeology', 64);
  g2.inventory.add('encrusted_gold_armlet', 1);
  saveGame(g2);
  const g3 = new Game(); g3.start(); assert.ok(loadGame(g3));
  assert.equal(g3.skills.level('archaeology'), 64);
  assert.equal(g3.inventory.count('encrusted_gold_armlet'), 1);
});

// ---------------- XP parity ----------------
const TOOLS = { woodcutting: 'axe', mining: 'pickaxe' };
function rate(skill, id, lvl, ticks, seed) {
  seedRandom(seed);
  const g = newGame();
  setLevel(g, skill, lvl);
  const tier = TOOL_TIERS.reduce((b, t, i) => (t.level <= lvl ? i : b), 0);
  g.inventory.add(skill === 'archaeology' ? TROWELS[tier].id : toolId(TOOLS[skill], tier), 1);
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
const BEST = [
  { lvl: 30, mining: 'coal_rock', woodcutting: 'willow', archaeology: 'river_godowns' },
  { lvl: 99, mining: 'runite_rock', woodcutting: 'magic_tree', archaeology: 'kelong_dig' },
  { lvl: 200, mining: 'fallen_star', woodcutting: 'starfall_banyan', archaeology: 'stargazer_terrace' },
  { lvl: 500, mining: 'eternal_lode', woodcutting: 'keramat_tree', archaeology: 'temasek_palace_dig' },
];

test('digging pays about what Mining and Woodcutting do an hour, at levels 30, 99, 200 and 500', () => {
  for (const b of BEST) {
    const two = (s) => (rate(s, b[s], b.lvl, 800, SEED) + rate(s, b[s], b.lvl, 800, SEED + 7919)) / 2;
    const mining = two('mining'), wood = two('woodcutting');
    const dig = rate('archaeology', b.archaeology, b.lvl, 400, SEED);   // a site never runs dry: one run is exact
    const x = dig / ((mining + wood) / 2);
    assert.ok(x >= 0.85 && x <= 1.25, `level ${b.lvl}: digging is ${x.toFixed(2)}x their average (mining ${Math.round(mining / 1e3)}k, woodcutting ${Math.round(wood / 1e3)}k, digging ${Math.round(dig / 1e3)}k)`);
  }
});

test('each site out-earns the one before it; restoring what an hour of digging finds pays about that hour again', () => {
  let prev = 0;
  for (const s of DIG_SITES) {
    const r = rate('archaeology', s.id, s.level, 120, SEED);
    assert.ok(r > prev, `${s.id}: ${Math.round(r)} against ${Math.round(prev)}`);
    prev = r;
  }
  // Making parity, as tools/balance/productionxp.mjs measures the making skills:
  // the XP an hour of digging pays in play (xprate.js, the rich layers, level
  // haul and streaks on), against restoring the relics that hour turns up. Each
  // site's own relics at its level, with the best trowel.
  NODE_JACKPOT.on = LEVEL_HAUL.on = GATHER_FUN.on = true;   // (tests/seed.mjs turns them off again)
  const restore = new Map(restoreRecipes().map((r) => [r.result, r]));
  for (const b of BEST) {
    const g = newGame();
    setLevel(g, 'archaeology', b.lvl);
    g.inventory.add(TROWELS[TOOL_TIERS.reduce((a, t, i) => (t.level <= b.lvl ? i : a), 0)].id, 1);
    const site = DIG_SITES.find((s) => s.id === b.archaeology), src = gatherSources().find((s) => s.key === site.id);
    const r = xpRate(g, src);
    const digsAnHour = r.perHour * (r.parts.rolls || 1) / g.skills.xpAtLevel('archaeology', src.xp);
    const w = site.relics.reduce((a, x) => a + x.weight, 0);
    const perRelic = site.relics.reduce((a, x) => a + restore.get(x.id).xp * x.weight / w, 0);
    const restoring = digsAnHour * relicChance(g) * g.skills.xpAtLevel('archaeology', perRelic);
    const x = restoring / r.perHour;
    assert.ok(x >= 0.7 && x <= 1.5, `level ${b.lvl}: restoring an hour's relics pays ${x.toFixed(2)}x the hour's digging`);
  }
});
