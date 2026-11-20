// Endgame Crafting (levels 100-300): jewellery cut from the endgame ores and
// bars, for every fighting style, and the Dancer's war fans and later whips,
// which used to come only from monster drops.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS, ACCESSORY_STYLE, ENDGAME_JEWELLERY, accessoriesFor } from '../src/data/items.js';
import { CRAFT } from '../src/data/crafting.js';
import { xpForLevel } from '../src/data/xp.js';
import { effectiveParts } from '../src/game/gear.js';
import { guideEntries } from '../src/game/skillguide.js';
import { itemIconSVG } from '../src/render/icons.js';

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

// Tier, its jewellery, the stat it brings, what it is cut from, and its later whip.
const TIERS = [
  { lvl: 100, metal: 'obsidian', jewel: 'obsidian_ring', stat: 'critDmg', from: 'obsidian_shard' },
  { lvl: 130, metal: 'orichalcum', jewel: 'orichalcum_amulet', stat: 'pierce', from: 'orichalcum_bar' },
  { lvl: 160, metal: 'jade', jewel: 'jade_ring', stat: 'lifesteal', from: 'raw_jade', whip: 'jade_whip' },
  { lvl: 200, metal: 'starmetal', jewel: 'star_amulet', stat: 'crit', from: 'starmetal_ore', whip: 'starmetal_whip' },
  { lvl: 250, metal: 'celestial', jewel: 'celestial_ring', stat: 'haste', from: 'celestial_crystal', whip: 'astral_whip' },
  { lvl: 300, metal: 'eternal', jewel: 'eternal_amulet', stat: 'atkPct', from: 'eternal_ore', whip: 'eternal_whip' },
];
const STYLES = ['melee', 'ranged', 'magic', 'dance'];
const fakeEq = { itemBonuses: (id) => ITEMS[id].equip.bonuses };

test('endgame jewellery: every style, worn from its tier, an upgrade on the best ring or amulet, never dropped', () => {
  assert.equal(ENDGAME_JEWELLERY.length, TIERS.length);
  for (const t of TIERS) {
    const it = ITEMS[t.jewel], eq = it.equip;
    assert.ok(eq, `${t.jewel} is gear`);
    assert.deepEqual(eq.req, { defence: t.lvl });
    assert.equal(eq.style, undefined, `${t.jewel} suits every style`);
    assert.ok(eq.bonuses[t.stat] > 0, `${t.jewel} brings ${t.stat}`);
    // Better than the best styled piece of its slot, for every fighting style.
    const others = Object.keys(ACCESSORY_STYLE).filter((id) => ITEMS[id]?.equip.slot === eq.slot);
    for (const st of STYLES) {
      const best = Math.max(...others.map((id) => effectiveParts(id, fakeEq, st).offence));
      const mine = effectiveParts(t.jewel, fakeEq, st).offence;
      assert.ok(mine > best, `${t.jewel} for ${st}: ${mine} vs ${best}`);
    }
    // Crafted only: no monster or boss drops it.
    for (const lvl of [100, 200, 300, 450]) assert.ok(!accessoriesFor(lvl).includes(t.jewel), `${t.jewel} is not a drop`);
  }
  // Each later piece of a slot is stronger than the one before.
  for (const slot of ['ring', 'amulet']) {
    const line = TIERS.filter((t) => ITEMS[t.jewel].equip.slot === slot).map((t) => effectiveParts(t.jewel, fakeEq, 'melee').offence);
    for (let i = 1; i < line.length; i++) assert.ok(line[i] > line[i - 1], `${slot}s climb with the tiers`);
  }
  // The eternal amulet is all-round: physical and magic damage both.
  assert.ok(ITEMS.eternal_amulet.equip.bonuses.magPct > 0);
  // Worn from its Defence level, not before.
  const g = newGame();
  setLevel(g, 'defence', 99);
  assert.ok(!g._canEquipNow('obsidian_ring'));
  setLevel(g, 'defence', 100);
  assert.ok(g._canEquipNow('obsidian_ring'));
});

test('endgame crafting: jewellery, war fans and whips at their levels, inputs used up, plain', () => {
  const g = newGame();
  if (!g.inventory.has('chisel')) g.inventory.add('chisel', 1);
  const table = g.world.objects.find((o) => o.def.type === 'craft');
  standBy(g, table);
  const said = listen(g);
  let prevBest = Math.max(...CRAFT.filter((r) => r.level < 100).map((r) => r.xp));
  assert.equal(prevBest, 400, 'the upgrade ward is the best make below 100');
  for (const t of TIERS) {
    const recs = CRAFT.filter((r) => r.level >= t.lvl && r.level < t.lvl + 20 && [t.jewel, `${t.metal}_fan`, t.whip].includes(r.result));
    const jewel = recs.find((r) => r.result === t.jewel);
    assert.ok(jewel, `${t.jewel} can be crafted`);
    assert.equal(jewel.level, t.lvl); assert.equal(jewel.tool, 'chisel');
    assert.deepEqual(jewel.inputs.map((i) => i.id), [t.from]);
    assert.ok(recs.some((r) => r.result === `${t.metal}_fan`), `${t.metal}_fan can be crafted`);
    if (t.whip) assert.ok(recs.some((r) => r.result === t.whip), `${t.whip} can be crafted`);
    for (const r of recs) {
      assert.equal(CRAFT.filter((x) => x.result === r.result).length, 1, `${r.result} has one recipe`);
      assert.ok(ITEMS[r.result]?.equip, `${r.result} is real gear`);
      for (const { id, qty } of r.inputs) assert.ok(ITEMS[id], `${id} exists`), g.inventory.add(id, qty);
      setLevel(g, 'crafting', r.level - 1);
      g.startCraft(r, table); step(g, 2);
      assert.equal(g.inventory.count(r.result), 0, `no ${r.result} below Crafting ${r.level}`);
      assert.ok(said.some((m) => m.includes(`Crafting level of ${r.level}`)));
      setLevel(g, 'crafting', r.level);
      const xp0 = g.skills.xp.crafting;
      g.startCraft(r, table); step(g, 3);
      assert.equal(g.inventory.count(r.result), 1, `crafted ${r.result}`);
      for (const { id } of r.inputs) assert.equal(g.inventory.count(id), 0, `using up the ${id}`);
      assert.ok(g.skills.xp.crafting > xp0, 'for Crafting XP');
      assert.equal(g.equipment.masteryRank(r.result), 0, 'no mastery head start');
      g.inventory.remove(r.result, 1);
      assert.ok(guideEntries('crafting').some((e) => e.label === ITEMS[r.result].name && e.level === r.level), `${r.result} in the Crafting guide`);
    }
    // A batch is instant now (makeBatch), so XP an hour is set by how fast you
    // gather the inputs; per make, each tier's best still pays ~35% more.
    const best = Math.max(...recs.map((r) => r.xp));
    assert.ok(best >= prevBest * 1.35, `${t.metal}: best make ${best} xp vs ${prevBest} before`);
    prevBest = best;
  }
  assert.ok(!said.some((m) => /^(Fine|Superior|Epic|Legendary|Mythic) /.test(m)), 'no quality roll on crafted gear');
});

test('robes, hide and dancewear above level 100 stay drop-only (nothing to make them from yet)', () => {
  for (const id of ['astral_robe_top', 'eternal_robe_top', 'starhide_body', 'eternalhide_body', 'jade_dancer_top', 'eternal_dancer_top']) {
    assert.ok(ITEMS[id], `${id} exists`);
    assert.ok(!CRAFT.some((r) => r.result === id), `${id} is not crafted`);
  }
});

test('endgame jewellery has its own untinted sticker', () => {
  for (const t of TIERS) {
    const html = itemIconSVG(t.jewel, 24);
    assert.ok(html.includes(`assets/icons/item-${t.jewel}.webp`) && !html.includes('filter:'), `${t.jewel} has its own sticker`);
  }
});
