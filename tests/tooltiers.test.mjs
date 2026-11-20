// Tiered gathering tools (src/data/tooltiers.js, src/game/tools.js): an axe,
// pickaxe, rod, harpoon and snare for each smithing metal. The best one you
// carry or wield that your level allows is used, each tier is faster than the
// last, they are smithed, fletched or bought, and old saves are untouched.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game, GATHER_SPEED } from '../src/game/game.js';
import { clearSave, saveGame, loadGame } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { SMITH } from '../src/data/smithing.js';
import { FLETCH } from '../src/data/trades.js';
import { SHOPS } from '../src/data/shops.js';
import { xpForLevel } from '../src/data/xp.js';
import { TOOL_TIERS, TOOL_KINDS, SHOP_TOOL_TIER, toolId, toolIds } from '../src/data/tooltiers.js';
import { bestTool, canUseTool, toolBonus, toolLadder } from '../src/game/tools.js';
import { resolveMine, resolveWoodcut } from '../src/game/skilling.js';
import { nextJob } from '../src/game/autoprocess.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
// An empty bag and empty hands but for `ids`.
function only(g, ...ids) {
  for (let k = 0; k < g.inventory.slots.length; k++) g.inventory.slots[k] = null;
  g.equipment.slots.weapon = null;
  for (const id of ids) g.inventory.add(id, 1);
}

test('every kind has twelve tiers on the smelting ladder, with the agreed ids and names', () => {
  assert.deepEqual(TOOL_TIERS.map((t) => t.level), [1, 15, 30, 50, 70, 85, 100, 130, 160, 200, 250, 300]);
  assert.deepEqual(toolIds('axe').slice(0, 3), ['bronze_axe', 'iron_axe', 'steel_axe']);
  assert.equal(toolId('pickaxe', 11), 'eternal_pickaxe');
  assert.equal(toolId('rod', 0), 'fishing_rod');
  assert.equal(ITEMS.iron_rod.name, 'Iron fishing rod');
  assert.equal(ITEMS.iron_harpoon.name, 'Iron harpoon');
  assert.equal(ITEMS.iron_snare.name, 'Iron hunting snare');
  for (const K of TOOL_KINDS) {
    toolIds(K.tag).forEach((id, i) => {
      const it = ITEMS[id];
      assert.ok(it, `${id} is an item`);
      assert.equal(it.tool, K.tag, `${id} is a ${K.tag}`);
      assert.equal(it.toolTier, i);
      assert.equal(it.toolLevel, TOOL_TIERS[i].level);
      assert.equal(it.toolSkill, K.skill);
      if (i) assert.match(it.examine, new RegExp(`${TOOL_TIERS[i].level} to use; \\+${TOOL_TIERS[i].speed}% speed`), `${id}'s tooltip shows its level and bonus`);
    });
  }
  // Axes and pickaxes can be wielded, as the bronze ones always could; the rest can't.
  assert.equal(ITEMS.rune_axe.equip.slot, 'weapon');
  assert.equal(ITEMS.rune_rod.equip, undefined);
  // Each tier is strictly better than the one below it.
  for (let i = 1; i < TOOL_TIERS.length; i++) {
    const a = TOOL_TIERS[i - 1], b = TOOL_TIERS[i];
    assert.ok(b.level > a.level && b.speed > a.speed && b.yield >= a.yield && b.find >= a.find && b.value > a.value, b.metal);
  }
});

test('the best tool you carry or wield and can use is the one used', () => {
  const g = newGame();
  only(g, 'bronze_axe', 'rune_axe', 'iron_axe');
  setLevel(g, 'woodcutting', 20);
  assert.equal(bestTool(g, 'axe'), 'iron_axe', 'rune needs 85: iron is the best you can use at 20');
  setLevel(g, 'woodcutting', 90);
  assert.equal(bestTool(g, 'axe'), 'rune_axe');
  assert.equal(toolBonus(g, 'axe').speed, TOOL_TIERS[5].speed);
  // A wielded tool counts too, and the bag can still beat it.
  only(g, 'steel_pickaxe');
  g.equipment.slots.weapon = 'iron_pickaxe';
  setLevel(g, 'mining', 99);
  assert.equal(bestTool(g, 'pickaxe'), 'steel_pickaxe');
  only(g);
  g.equipment.slots.weapon = 'adamant_pickaxe';
  assert.equal(bestTool(g, 'pickaxe'), 'adamant_pickaxe');
  // Rods and harpoons are separate kinds, each choosing its own best.
  only(g, 'fishing_rod', 'mithril_rod', 'harpoon', 'obsidian_harpoon');
  setLevel(g, 'fishing', 60);
  assert.equal(bestTool(g, 'rod'), 'mithril_rod');
  assert.equal(bestTool(g, 'harpoon'), 'harpoon', 'obsidian needs Fishing 100');
  // The hero is drawn holding the tool in use.
  return import('../src/render/heroanim.js').then(({ actionPropId }) => {
    assert.equal(actionPropId(g, { type: 'fish', obj: { def: { tool: 'rod' } } }), 'mithril_rod');
    assert.equal(actionPropId(g, { type: 'fish', obj: { def: { tool: 'harpoon' } } }), 'harpoon');
  });
});

test('a tool your level is too low for does nothing: you are told what you need', () => {
  const g = newGame();
  const rock = g.world.objects.find((o) => o.objId === 'copper_rock');
  const said = [];
  g.msg = (t) => said.push(t);
  only(g, 'iron_pickaxe');
  setLevel(g, 'mining', 10);
  assert.equal(canUseTool(g, 'iron_pickaxe'), false);
  assert.equal(g.hasTool('pickaxe'), false);
  assert.equal(resolveMine(g, { obj: rock }), false);
  assert.equal(g.inventory.count('copper_ore'), 0);
  assert.ok(said.some((t) => t === 'You need Mining 15 to use your iron pickaxe.'), said.join(' | '));
  setLevel(g, 'mining', 15);
  assert.equal(g.hasTool('pickaxe'), true);
  assert.equal(resolveMine(g, { obj: rock }), true);
  assert.ok(g.inventory.count('copper_ore') >= 1);
  // With nothing at all, the old line still shows.
  only(g);
  said.length = 0;
  const tree = g.world.objects.find((o) => o.objId === 'tree');
  assert.equal(resolveWoodcut(g, { obj: tree }), false);
  assert.ok(said.includes('You need an axe to chop this tree.'));
  // A tool too good for you sits beside one you can use: the usable one works.
  only(g, 'bronze_axe', 'eternal_axe');
  setLevel(g, 'woodcutting', 1);
  assert.equal(bestTool(g, 'axe'), 'bronze_axe');
  const logs = g.inventory.count('logs');
  resolveWoodcut(g, { obj: tree });
  assert.ok(g.inventory.count('logs') > logs, 'chops with the bronze axe');
});

// Rolls of a gathering action over `ticks` ticks, standing beside a node, with tool `id`.
function rollsWith(id, type, tag, skill, ticks = 600) {
  const g = newGame();
  only(g, id);
  setLevel(g, skill, 300);
  const p = g.player;
  const obj = { x: p.x + 1, y: p.y, depleted: false, def: { tool: tag } };
  let calls = 0;
  const a = { type, obj };
  for (let t = 0; t < ticks; t++) g._tickContinuous(a, obj, () => { calls++; return true; });
  return calls;
}

test('each tier gathers faster than the one below it, and the speed is what it says', () => {
  for (const [tag, type, skill] of [['axe', 'woodcut', 'woodcutting'], ['pickaxe', 'mine', 'mining'], ['rod', 'fish', 'fishing'],
    ['harpoon', 'fish', 'fishing'], ['snare', 'hunt', 'hunter']]) {
    let prev = 0;
    const base = rollsWith(toolId(tag, 0), type, tag, skill);
    toolIds(tag).forEach((id, i) => {
      const n = rollsWith(id, type, tag, skill);
      assert.ok(n > prev, `${id}: ${n} rolls vs ${prev} with the tier below`);
      // Speed is a share of the base pace (GATHER_SPEED and the skill's unlocks).
      const want = 600 * GATHER_SPEED * TOOL_TIERS[i].speed / 100;
      assert.ok(Math.abs(n - base - want) <= 3, `${id}: ${n - base} extra rolls, expected about ${want}`);
      prev = n;
    });
  }
});

test('metal axes, pickaxes and harpoons are smithed; rods and snares fletched; shops sell iron to adamant', () => {
  const smith = new Map(SMITH.map((r) => [r.result, r]));
  const fletch = new Map(FLETCH.map((r) => [r.result, r]));
  for (const K of TOOL_KINDS) {
    TOOL_TIERS.forEach((T, i) => {
      const id = toolId(K.tag, i);
      if (!i && !['axe', 'pickaxe'].includes(K.tag)) return;   // the tier-1 rod, harpoon and snare are bought
      if (['axe', 'pickaxe', 'harpoon'].includes(K.tag)) {
        const r = smith.get(id);
        assert.ok(r, `${id} has a smithing recipe`);
        assert.equal(r.bar, `${T.metal}_bar`);
        assert.ok(r.level >= T.level && r.level <= T.level + 5, `${id} at Smithing ${r.level}`);
        assert.ok(r.upgrade, `${id} stays out of Smith all`);
      } else {
        const r = fletch.get(id);
        assert.ok(r, `${id} has a fletching recipe`);
        assert.ok(r.inputs.some(([x]) => x === `${T.metal}_bar`), `${id} takes a ${T.metal} bar`);
        assert.ok(r.inputs.every(([x]) => ITEMS[x]), `${id}'s inputs are real items`);
        assert.ok(r.level >= T.level && r.level <= T.level + 5);
      }
    });
  }
  // The General Store sells every tool bronze to adamant, and no shop sells rune or finer.
  const general = new Set(SHOPS.general.stock.map((s) => s.id));
  for (const K of TOOL_KINDS) {
    for (let i = 0; i <= SHOP_TOOL_TIER; i++) assert.ok(general.has(toolId(K.tag, i)), `${toolId(K.tag, i)} in the General Store`);
    for (let i = SHOP_TOOL_TIER + 1; i < TOOL_TIERS.length; i++) {
      for (const [sid, shop] of Object.entries(SHOPS)) assert.ok(!shop.stock.some((s) => s.id === toolId(K.tag, i)), `${toolId(K.tag, i)} not sold at ${sid}`);
    }
  }
  // "Smith all" and "Fletch all" never spend bars on tools.
  const g = newGame();
  only(g, 'hammer', 'knife');
  setLevel(g, 'smithing', 20); setLevel(g, 'fletching', 20);
  g.inventory.add('iron_bar', 4);
  const s = nextJob(g, 'smith');
  assert.ok(s && !ITEMS[s.recipe.result].tool, `Smith all made ${s?.recipe.result}`);
  g.inventory.add('oak_logs', 4);
  const j = nextJob(g, 'fletching');
  assert.ok(!j || !ITEMS[j.recipe.result].tool, `Fletch all made ${j?.recipe.result}`);
});

test('the skill guide lists each skill\'s tools, ticking the one in use', async () => {
  const g = newGame();
  only(g, 'bronze_axe', 'steel_axe');
  setLevel(g, 'woodcutting', 40);
  const rows = toolLadder(g, 'woodcutting');
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.filter((r) => r.inUse).map((r) => r.id), ['steel_axe']);
  assert.equal(toolLadder(g, 'fishing').length, 24, 'rods and harpoons');
  assert.equal(toolLadder(g, 'cooking').length, 0);
  const { toolLadderHTML } = await import('../src/ui/skillguideui.js');
  const html = toolLadderHTML(g, 'woodcutting');
  assert.match(html, /data-item="steel_axe"[^]*?&#10003; [^]*?\(in use\)/);
  assert.match(html, /\+48% speed, \+10% double yield, \+60% rare finds/);
  assert.equal(toolLadderHTML(g, 'cooking'), '');
});

test('the tiered tools have their own stickers (Part F), held like the tier-1 tool', async () => {
  const { itemIconSVG, itemArtSrc } = await import('../src/render/icons.js');
  const { propPoint } = await import('../src/render/heroanim.js');
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  for (const K of TOOL_KINDS) {
    for (const id of toolIds(K.tag).slice(1)) {
      assert.equal(itemArtSrc(id), `assets/icons/item-${id}.webp`, id);
      assert.ok(existsSync(fileURLToPath(new URL(`../assets/icons/item-${id}.webp`, import.meta.url))), `item-${id}.webp`);
      assert.doesNotMatch(itemIconSVG(id, 24), /filter:/, `${id} is not tinted`);
      // Held just like the tier-1 tool.
      assert.deepEqual(propPoint(id, 0.5, 0.5, 0), propPoint(K.base, 0.5, 0.5, 0), `${id} held like ${K.base}`);
    }
  }
});

test('old saves load untouched, and a save with tiered tools round-trips', () => {
  const g = newGame();
  only(g, 'bronze_axe', 'bronze_pickaxe', 'fishing_rod', 'hunting_snare');
  setLevel(g, 'woodcutting', 30);
  saveGame(g);
  // A save from before the tiers holds only the tier-1 tools, and the save
  // format is unchanged (no new fields), so it loads as it always did.
  const g2 = new Game(); g2.start(); assert.ok(loadGame(g2), 'loads');
  assert.equal(bestTool(g2, 'axe'), 'bronze_axe');
  assert.ok(g2.hasTool('snare') && g2.hasTool('rod') && g2.hasTool('pickaxe'));
  // Now with an iron axe wielded and a steel one in the bag.
  only(g2, 'steel_axe');
  g2.equipment.slots.weapon = 'iron_axe';
  saveGame(g2);
  const g3 = new Game(); g3.start(); assert.ok(loadGame(g3));
  assert.equal(g3.equipment.get('weapon'), 'iron_axe');
  assert.equal(bestTool(g3, 'axe'), 'steel_axe');
});
