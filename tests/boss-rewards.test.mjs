import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BOSS_REWARDS, rollBossReward } from '../src/data/bossRewards.js';
import { CRAFT } from '../src/data/crafting.js';
import { restoreRecipes } from '../src/data/archaeology.js';
import { classGearFor, equivalentArmour, equivalentWeapon } from '../src/data/classes.js';
import { ITEMS } from '../src/data/items.js';
import { LOOMS, PATTERNS } from '../src/data/islandlife.js';
import { getNpc } from '../src/data/npcs.js';
import { xpForLevel } from '../src/data/xp.js';
import { dropChances } from '../src/game/codex.js';
import { Game } from '../src/game/game.js';
import { makeIslandPattern } from '../src/game/islandlife.js';
import { itemSources } from '../src/game/skillguide.js';
import { hasIcon, itemArtSrc } from '../src/render/icons.js';

function fresh() {
  const save = new Map();
  globalThis.localStorage = { getItem: (k) => save.get(k) ?? null, setItem: (k, v) => save.set(k, v), removeItem: (k) => save.delete(k) };
  const g = new Game();
  g.start();
  g.chooseClass('rogue');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}

function nearStation(g, type) {
  const obj = g.world.objects.find((o) => o.def.type === type);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = obj.x + dx, y = obj.y + dy;
    if (g.world.isBlocked(x, y) || g.world.objectAt(x, y)) continue;
    g.player.x = g.player.tx = x;
    g.player.y = g.player.ty = y;
    return obj;
  }
  throw new Error(`No room beside ${type}`);
}

test('boss trophies use their own rare roll, keep their identity, and appear in both guides', () => {
  const g = fresh();
  for (const [npcId, rewards] of Object.entries(BOSS_REWARDS)) {
    const npc = g.npcs.find((n) => n.npcId === npcId);
    assert.ok(npc?.def.boss, npcId);
    assert.deepEqual(new Set(rewards.map((r) => ITEMS[r.id].equip.slot)), new Set([ITEMS[rewards[0].id].equip.slot, 'body', 'weapon']));
    assert.equal(rollBossReward(rewards, () => 0.9), null);
    let previous = 0;
    for (const { id, chance } of rewards) {
      assert.ok(chance > 0 && chance <= 0.06);
      const roll = previous + chance / 2;
      previous += chance;
      const originalRandom = Math.random;
      let loot = [];
      g._autoLoot = (rolled) => { loot = rolled; };
      try {
        Math.random = () => roll;
        g.rollDrops(npc);
      } finally {
        Math.random = originalRandom;
      }
      const trophies = loot.filter(([item]) => ITEMS[item].bossReward);
      assert.deepEqual(trophies.map(([item, qty, rarity]) => [item, qty, rarity]), [[id, 1, 'legendary']]);
      assert.ok(g.collection.log[`boss:${npcId}`]?.[id], `${id} fills its Collection Log entry`);
      assert.equal(dropChances(getNpc(npcId)).find((d) => d.id === id)?.chance, chance);
      assert.deepEqual(itemSources(id).map((s) => [s.kind, s.npcId, s.chance]), [['drop', npcId, chance]], `${id} has one earning source`);
    }
  }
});

test('generic classes and gear conversions cannot award boss trophies', () => {
  const classes = ['juggernaut', 'sorcerer', 'ranger', 'knight'];
  for (const [i, rewards] of Object.values(BOSS_REWARDS).entries()) {
    const armour = ITEMS[rewards[1].id], weapon = ITEMS[rewards[2].id];
    const lvl = (it) => Math.max(...Object.values(it.equip.req));
    assert.ok(!ITEMS[classGearFor(classes[i], lvl(armour), () => 0.25)].bossReward);
    assert.ok(!ITEMS[classGearFor(classes[i], lvl(armour), () => 0.75)].bossReward);
    assert.ok(!ITEMS[equivalentArmour(armour.id, armour.equip.family)].bossReward);
    assert.ok(!ITEMS[equivalentWeapon(weapon.id, weapon.equip.weaponType)].bossReward);
  }
});

test('life-skill jewellery can be crafted, restored and earned from paid textile orders', () => {
  const g = fresh();
  g.npcs = [];
  for (const [skill, type, tool, ids] of [
    ['crafting', 'craft', 'chisel', ['pandan_leaf_ring', 'pandan_leaf_amulet']],
    ['archaeology', 'restore', 'soft_brush', ['heritage_porcelain_ring', 'heritage_porcelain_amulet']],
  ]) {
    g.inventory.add(tool, 1);
    const station = nearStation(g, type);
    for (const id of ids) {
      const r = (type === 'restore' ? restoreRecipes() : CRAFT).find((entry) => entry.result === id);
      g.skills.xp[skill] = xpForLevel(r.level);
      for (const input of r.inputs) g.inventory.add(input.id || input[0], input.qty || input[1]);
      if (type === 'craft') g.startCraft(r, station, 1);
      else g.startRecipe(skill, r, station, 1);
      for (let i = 0; i < 3; i++) g.update(600);
      assert.equal(g.inventory.count(id), 1, id);
      assert.deepEqual(itemSources(id).map((s) => [s.kind, s.recipe.skill]), [['recipe', skill]]);
    }
  }

  const workshop = LOOMS.find((site) => site.level === 8);
  g.player.x = g.player.tx = workshop.x;
  g.player.y = g.player.ty = workshop.y;
  g.skills.xp.textile_arts = xpForLevel(22);
  g.inventory.add('coins', 100);
  for (const p of PATTERNS.filter((row) => row.reward)) {
    g.inventory.add(p.dye, 5);
    assert.equal(makeIslandPattern(g, p.id, { order: true }), false, 'learn the pattern first');
    assert.equal(makeIslandPattern(g, p.id), true);
    assert.equal(g.inventory.count(p.reward), 0, 'printing a scarf gives no jewellery');
    assert.equal(makeIslandPattern(g, p.id, { order: true }), true);
    assert.equal(makeIslandPattern(g, p.id, { order: true }), false, 'one order per day');
    assert.equal(g.inventory.count(p.reward), 1);
    assert.deepEqual(itemSources(p.reward), [{ kind: 'textileOrder', name: p.name, level: p.level }]);
  }
});

test('the eighteen new pieces have original inventory artwork and vector fallbacks', () => {
  const ids = [...Object.values(BOSS_REWARDS).flat().map((r) => r.id),
    'pandan_leaf_ring', 'pandan_leaf_amulet', 'heritage_porcelain_ring', 'heritage_porcelain_amulet',
    ...PATTERNS.filter((p) => p.reward).map((p) => p.reward)];
  assert.equal(new Set(ids).size, 18);
  for (const id of ids) {
    assert.ok(hasIcon(id), id);
    assert.equal(itemArtSrc(id), `assets/icons/item-${id}.webp`);
    assert.ok(existsSync(new URL(`../${itemArtSrc(id)}`, import.meta.url)), id);
  }
});
