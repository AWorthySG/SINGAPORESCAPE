// Endgame Fishing and Cooking (levels 100-300): the six new fishing spots and
// their fish, and the dishes those fish cook into, which heal a share of your
// life (and two lend a damage boost, one heals over time).
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { COOKING } from '../src/game/skilling.js';
import { TOOL_TIERS, toolId } from '../src/data/tooltiers.js';
import { DISHES } from '../src/data/cooking.js';
import { xpForLevel } from '../src/data/xp.js';
import { chebyshev } from '../src/core/utils.js';
import { findPath } from '../src/engine/pathfinding.js';
import { guideEntries } from '../src/game/skillguide.js';
import { materialKind } from '../src/game/materials.js';
import { itemIconSVG } from '../src/render/icons.js';
import { worldArt } from '../src/render/sprites.js';

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
const step = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };
const night = (g) => { g.playMs = 0; };   // midnight
const noon = (g) => { g.playMs = 0.5 * 10 * 60 * 1000; };   // high noon
// Stand the player on a free tile next to an object.
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
const TOOL_ITEM = { rod: 'fishing_rod', harpoon: 'harpoon', net: 'small_net', lobster_pot: 'lobster_pot' };
const giveTools = (g) => { for (const id of Object.values(TOOL_ITEM)) if (!g.inventory.has(id)) g.inventory.add(id, 1); };

// Tier, spot, raw fish, its dish, the share of life it heals, and the region.
const TIERS = [
  { lvl: 100, spot: 'dorado_spot', raw: 'raw_dorado', dish: 'grilled_dorado', pct: 0.4, zone: 'Southern Islands' },
  { lvl: 130, spot: 'bluefin_spot', raw: 'raw_bluefin_tuna', dish: 'tuna_sashimi', pct: 0.45, zone: 'Changi Coast' },
  { lvl: 160, spot: 'sailfish_spot', raw: 'raw_sailfish', dish: 'sambal_sailfish', pct: 0.5, zone: 'Sentosa Beach' },
  { lvl: 200, spot: 'moonfish_spot', raw: 'raw_moonfish', dish: 'moonfish_curry', pct: 0.55, zone: 'Punggol Waterway' },
  { lvl: 250, spot: 'rift_eel_spot', raw: 'raw_rift_eel', dish: 'rift_eel_claypot', pct: 0.6, zone: 'Pulau Hantu' },
  { lvl: 300, spot: 'arowana_pool', raw: 'raw_dragon_arowana', dish: 'arowana_feast', pct: 1, zone: 'The Shadow Rift' },
];

test('endgame fishing spots: a stretch of each in its region, on the shore, every spot reachable', () => {
  const g = newGame();
  const cfg = g.pathCfg();
  for (const t of TIERS) {
    const def = OBJECTS[t.spot];
    assert.equal(def.type, 'fishing'); assert.equal(def.skill, 'fishing');
    assert.deepEqual(def.catches.map((c) => [c.id, c.level]), [[t.raw, t.lvl]]);
    assert.ok(ITEMS[t.raw]?.tags.includes('raw') && ITEMS[t.dish]?.heal, `${t.raw} and ${t.dish} exist`);
    assert.ok(TOOL_ITEM[def.tool], `${t.spot} needs a real fishing tool (${def.tool})`);
    const spots = g.world.objects.filter((o) => o.objId === t.spot);
    assert.ok(spots.length >= 4, `${t.spot}: ${spots.length} placed`);
    const zone = g.world.zones.find((z) => z.name === t.zone);
    for (const s of spots) assert.ok(s.x >= zone.x0 && s.x <= zone.x1 && s.y >= zone.y0 && s.y <= zone.y1, `${t.spot} at ${s.x},${s.y} is in ${t.zone}`);
    assert.ok(spots.every((s) => chebyshev(s.x, s.y, spots[0].x, spots[0].y) <= 10), `${t.spot}s are in one stretch`);
    // Every spot is on the water and can be walked up to from the region's nearest MRT station.
    const mrt = g.world.objects.filter((o) => o.objId === 'mrt_station')
      .reduce((a, b) => (chebyshev(b.x, b.y, spots[0].x, spots[0].y) < chebyshev(a.x, a.y, spots[0].x, spots[0].y) ? b : a));
    const from = [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 2]].map(([dx, dy]) => ({ x: mrt.x + dx, y: mrt.y + dy })).find((p) => !g.world.isBlocked(p.x, p.y));
    for (const s of spots) {
      assert.equal(g.world.terrainAt(s.x, s.y), 2, `${t.spot} at ${s.x},${s.y} is on water`);
      // (Pulau Hantu's nearest station is across the strait on Pulau Ubin: a long walk.)
      assert.ok(findPath(cfg, from, { x: s.x, y: s.y }, { reachAdjacent: true, maxNodes: 200000 }).length > 0, `${t.spot} at ${s.x},${s.y} is reachable`);
    }
  }
});

test('endgame fishing: caught at the level with the right tool, refused below it or without the tool', () => {
  const g = newGame();
  const said = listen(g);
  for (const t of TIERS) {
    const spot = g.world.objects.find((o) => o.objId === t.spot);
    const tool = TOOL_ITEM[OBJECTS[t.spot].tool];
    standBy(g, spot); noon(g);
    // No tool: refused.
    for (const id of Object.values(TOOL_ITEM)) g.inventory.remove(id, g.inventory.count(id));
    setLevel(g, 'fishing', t.lvl);
    g.defaultObjectAction(spot); step(g, 4);
    assert.equal(g.inventory.count(t.raw), 0, `no ${t.raw} without a ${tool}`);
    giveTools(g);
    // Below the level: refused.
    setLevel(g, 'fishing', t.lvl - 1);
    g.defaultObjectAction(spot); step(g, 4);
    assert.equal(g.inventory.count(t.raw), 0, `no ${t.raw} below Fishing ${t.lvl}`);
    assert.ok(said.some((m) => m.includes('higher Fishing level')), 'told it needs a higher level');
    setLevel(g, 'fishing', t.lvl);
    const xp0 = g.skills.xp.fishing;
    g.defaultObjectAction(spot); step(g, 6);
    assert.ok(g.inventory.count(t.raw) >= 1, `caught ${t.raw}`);
    assert.ok(g.skills.xp.fishing > xp0, 'and earned Fishing XP');
    assert.equal(materialKind(t.raw), 'raw', `${t.raw} is a shrine material`);
    g.player.clearAction();
    g.inventory.remove(t.raw, g.inventory.count(t.raw));
  }
  for (const t of TIERS) assert.ok(guideEntries('fishing').some((e) => e.objIds?.includes(t.spot) && e.level === t.lvl), `${t.spot} in the Fishing guide`);
  assert.ok(guideEntries('fishing').some((e) => e.objIds?.includes('moonfish_spot') && e.detail.includes('night')), 'the guide tells of the night bonus');
});

test('the moonfish spot fishes any time, with bonus XP at night', () => {
  const g = newGame();
  giveTools(g);
  setLevel(g, 'fishing', 200);
  const spot = g.world.objects.find((o) => o.objId === 'moonfish_spot');
  standBy(g, spot);
  const run = (setTime) => {
    setTime(g);
    g.defaultObjectAction(spot);
    let gain = 0;
    for (let i = 0; i < 60; i++) {
      const before = g.skills.xp.fishing;
      g.update(600); setTime(g);
      gain += g.skills.xp.fishing - before;
      g.inventory.remove('raw_moonfish', g.inventory.count('raw_moonfish'));
    }
    g.player.clearAction();
    return gain;
  };
  const day = run(noon);
  assert.ok(day > 0, 'fishes fine by day');
  const nightXp = run(night);
  assert.ok(g.isNight());
  assert.ok(nightXp > day * 1.15, `more XP at night (${Math.round(nightXp)} vs ${Math.round(day)})`);
});

test('endgame cooking: each fish cooks at its level into its dish, plain, for more XP than the tier before', () => {
  const g = newGame();
  const range = g.world.objects.find((o) => o.def.type === 'range');
  standBy(g, range);
  const said = listen(g);
  // Each tier pays ~35% more a cook (cooking is an instant batch now, so XP an
  // hour follows the fishing); the best below 100 is the seafood platter dish.
  let prevBest = Math.max(...DISHES.map((d) => d.xp), ...Object.values(COOKING).filter((c) => c.level < 100).map((c) => c.xp * 1.04));
  for (const t of TIERS) {
    const c = COOKING[t.raw];
    assert.equal(c.result, t.dish); assert.equal(c.level, t.lvl);
    assert.ok(c.xp * 1.04 >= prevBest * 1.35, `${t.raw}: ${c.xp} xp (+4% perfect dishes) vs ${prevBest} before`);
    prevBest = c.xp * 1.04;
    g.inventory.add(t.raw, 3);
    setLevel(g, 'cooking', t.lvl - 1);
    g.startCooking(range, t.raw); step(g, 3);
    assert.equal(g.inventory.count(t.dish), 0, `can't cook ${t.raw} below Cooking ${t.lvl}`);
    assert.ok(said.some((m) => m.includes(`Cooking level of ${t.lvl}`)));
    setLevel(g, 'cooking', t.lvl);
    const xp0 = g.skills.xp.cooking;
    g.startCooking(range, t.raw); step(g, 6);
    assert.equal(g.inventory.count(t.dish), 3, `cooked three ${t.dish}`);
    assert.equal(g.inventory.count(t.raw), 0);
    assert.ok(g.skills.xp.cooking > xp0, 'for Cooking XP');
    assert.ok(guideEntries('cooking').some((e) => e.label === ITEMS[t.dish].name && e.level === t.lvl && e.detail.includes('%')), `${t.dish} in the Cooking guide`);
    g.inventory.remove(t.dish, 3);
  }
  // Food never burns (life skills never fail), so there are no burnt endgame dishes.
  for (const t of TIERS) assert.equal(ITEMS[`burnt_${t.raw.replace(/^raw_/, '')}`], undefined);
});

test('endgame dishes heal a share of maximum life', () => {
  const g = newGame();
  for (const t of TIERS) {
    assert.equal(ITEMS[t.dish].healPct + (ITEMS[t.dish].meal?.regenPct || 0), t.pct, `${t.dish} heals ${t.pct * 100}% in all`);
    setLevel(g, 'hitpoints', t.lvl);
    const max = g.maxHp();
    g.player.hp = 1;
    g.inventory.add(t.dish, 1);
    g.eatItem(g.inventory.slots.findIndex((s) => s?.id === t.dish));
    assert.equal(g.player.hp, Math.min(max, 1 + Math.max(ITEMS[t.dish].heal, Math.round(max * ITEMS[t.dish].healPct))), `${t.dish} at ${max} max life`);
    g.meal = null;
  }
  // Old food still heals its flat amount.
  g.player.hp = 1; g.inventory.add('shark', 1);
  g.eatItem(g.inventory.slots.findIndex((s) => s?.id === 'shark'));
  assert.equal(g.player.hp, 1 + ITEMS.shark.heal);
});

test('sambal sailfish and the arowana feast boost damage for a minute; moonfish curry heals over time', () => {
  const g = newGame();
  setLevel(g, 'hitpoints', 300);
  const dmg0 = g.perkMods().dmg || 0;
  for (const [dish, boost] of [['sambal_sailfish', 0.05], ['arowana_feast', 0.1]]) {
    g.meal = null;
    g.inventory.add(dish, 1);
    g.eatItem(g.inventory.slots.findIndex((s) => s?.id === dish));
    assert.ok(Math.abs((g.perkMods().dmg || 0) - dmg0 - boost) < 1e-9, `${dish}: +${boost * 100}% damage`);
    assert.equal(g.potionMods('magic').dmg, boost, 'whatever the fighting style');
    step(g, 95);   // 57 s: still going
    assert.ok((g.perkMods().dmg || 0) > dmg0, `${dish}: still boosted at 57 s`);
    step(g, 10);   // 63 s: worn off
    assert.equal(g.perkMods().dmg || 0, dmg0, `${dish}: worn off after 60 s`);
    assert.equal(g.meal, null);
  }
  // The curry: 30% at once, then the rest over twelve seconds.
  const max = g.maxHp();
  g.player.hp = 1;
  g.inventory.add('moonfish_curry', 1);
  g.eatItem(g.inventory.slots.findIndex((s) => s?.id === 'moonfish_curry'));
  const now = g.player.hp;
  assert.equal(now, 1 + Math.round(max * 0.3));
  step(g, 25);
  assert.ok(g.player.hp - now >= Math.floor(max * 0.25) - 2, `healed ${g.player.hp - now} more over time (of ${Math.round(max * 0.25)})`);
  assert.equal(g.meal, null, 'and it has run its course');
});

test('endgame fish, dishes and their spots have their own untinted art', () => {
  const declared = worldArt();
  for (const t of TIERS) {
    for (const id of [t.raw, t.dish]) {
      const html = itemIconSVG(id, 24);
      assert.ok(html.includes(`assets/icons/item-${id}.webp`) && !html.includes('filter:'), `${id} has its own sticker`);
    }
    const def = OBJECTS[t.spot];
    assert.ok(declared.has(`obj-${t.spot}`) && !def.art && !def.tint, `${t.spot} has its own spot picture`);
  }
});

test('endgame Fishing XP an hour: each spot well ahead of the best before it, at the same level', () => {
  // A short run at each spot with XP pinned, against the spot before at the
  // same level, so the past-99 XP bonus (and the bigger catches of a high
  // level) count the same for both. Measured at noon: the moonfish's night
  // bonus is on top. (Each step is ~1.3x; the bar leaves room for the dice.)
  // With the best rod and harpoon for the level, as a player would fish: the
  // net and lobster pot have no better tiers, so their spots' XP is set to
  // keep pace with tiered rods and harpoons (NODE_XP_TUNE in objects.js), and
  // with plain tools all round the arowana pool would trail the rift eel.
  const TICKS = 400;
  const rate = (spotId, lvl) => {
    const g = newGame();
    giveTools(g);
    const tier = TOOL_TIERS.reduce((b, t, i) => (t.level <= lvl ? i : b), 0);
    for (const tag of ['rod', 'harpoon']) g.inventory.add(toolId(tag, tier), 1);
    setLevel(g, 'fishing', lvl);
    noon(g);
    const spot = g.world.objects.find((o) => o.objId === spotId);
    standBy(g, spot);
    g.defaultObjectAction(spot);
    const base = g.skills.xp.fishing;
    let gain = 0;
    for (let i = 0; i < TICKS; i++) {
      g.update(600);
      noon(g);
      gain += g.skills.xp.fishing - base; g.skills.xp.fishing = base;
      // An endless bag: drop what was caught so the run never stops for space.
      for (const s of g.inventory.slots) if (s && (ITEMS[s.id].tags?.includes('raw') || ['old_boot', 'seaweed', 'pearl', 'coins'].includes(s.id))) g.inventory.remove(s.id, g.inventory.count(s.id));
      if (!g.player.action) g.defaultObjectAction(spot);
    }
    return gain * 6000 / TICKS;
  };
  let prev = 'harpoon_spot';
  for (const t of TIERS) {
    const before = rate(prev, t.lvl), now = rate(t.spot, t.lvl);
    assert.ok(now >= before * 1.25, `${t.spot}: ${Math.round(now)} xp/h vs ${prev} ${Math.round(before)} at level ${t.lvl}`);
    prev = t.spot;
  }
});
