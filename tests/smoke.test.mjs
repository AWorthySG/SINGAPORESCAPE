import { test } from 'node:test';
import assert from 'node:assert/strict';

import { XP_TABLE, levelForXp, xpForLevel, levelProgress, xpToNext } from '../src/data/xp.js';
import { Inventory } from '../src/game/inventory.js';
import { Skills } from '../src/game/skillset.js';
import { Bank } from '../src/game/bank.js';
import { EventBus } from '../src/core/events.js';
import { findPath } from '../src/engine/pathfinding.js';
import { hitChance, maxHit, attackRoll, combatXp } from '../src/game/combat.js';
import { gatherChance } from '../src/game/skilling.js';
import { XP_RATE } from '../src/config.js';
import { NPCS, MONSTER_IDS, BOSS_IDS, getNpc } from '../src/data/npcs.js';
import { itemIconSVG, hasIcon, skillIconSVG } from '../src/render/icons.js';
import { ITEMS } from '../src/data/items.js';
import { SKILLS } from '../src/data/skills.js';
import { SPELLS } from '../src/data/magic.js';
import { PRAYERS } from '../src/data/prayers.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';

test('OSRS xp table matches known values', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 83);
  assert.equal(xpForLevel(10), 1154);
  assert.equal(xpForLevel(99), 13034431);
  assert.equal(XP_TABLE.length, 100);
});

test('levelForXp inverts the table', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(82), 1);
  assert.equal(levelForXp(83), 2);
  assert.equal(levelForXp(13034431), 99);
  assert.equal(levelForXp(999_999_999), 99);
});

test('level progress and xp-to-next are sane', () => {
  assert.ok(levelProgress(0) === 0);
  assert.equal(xpToNext(0), 83);
  assert.equal(xpToNext(13034431), 0);
});

test('items stack to 100 per slot; coins are uncapped', () => {
  const inv = new Inventory(new EventBus());
  // Coins are exempt from the cap -> a single slot.
  assert.equal(inv.add('coins', 5000), 5000);
  assert.equal(inv.count('coins'), 5000);
  assert.equal(inv.freeSlots(), 27);

  // 250 logs span 3 slots (100 + 100 + 50).
  assert.equal(inv.add('logs', 250), 250);
  assert.equal(inv.count('logs'), 250);
  assert.equal(inv.freeSlots(), 24); // 1 coins + 3 logs used
  assert.equal(inv.remove('logs', 120), 120);
  assert.equal(inv.count('logs'), 130);
});

test('per-slot cap fills the whole bag and blocks overflow', () => {
  const inv = new Inventory(new EventBus());
  // 28 slots x 100 = 2800 capacity for a capped item.
  assert.equal(inv.add('bones', 5000), 2800);
  assert.ok(inv.isFull());
  assert.equal(inv.canAdd('bones', 5), 0);
  assert.equal(inv.canAdd('coins', 5), 0); // no empty slot for a new item
});

test('a partial stack can still be topped up when all slots are used', () => {
  const inv = new Inventory(new EventBus());
  assert.equal(inv.add('bones', 2700), 2700); // 27 full slots
  assert.equal(inv.add('logs', 50), 50);      // 28th slot, partial
  assert.ok(inv.isFull());                     // no empty slots
  assert.equal(inv.canAdd('logs', 80), 50);    // can still top the 50 -> 100
  assert.equal(inv.add('logs', 80), 50);
  assert.equal(inv.count('logs'), 100);
  assert.equal(inv.canAdd('logs', 1), 0);      // now genuinely full
});

test('skills start at the buffed baseline and level up via xp', () => {
  const skills = new Skills(new EventBus());
  assert.equal(skills.hitpoints, 25);
  assert.equal(skills.attack, 15);
  assert.equal(skills.strength, 15);
  assert.equal(skills.defence, 12);
  assert.equal(skills.combatLevel(), 19);

  const baseline = xpForLevel(15);
  skills.addXp('attack', 100);
  assert.equal(skills.xp.attack, baseline + 100 * XP_RATE); // XP rate is applied
  skills.addXp('attack', 5000);
  assert.ok(skills.attack > 15); // and levels up with enough xp
});

test('loading a weak save floors stats to the baseline', () => {
  const skills = new Skills(new EventBus());
  skills.load({ attack: 0, strength: 0, defence: 0, hitpoints: 0, woodcutting: 5000 });
  assert.equal(skills.attack, 15);
  assert.equal(skills.strength, 15);
  assert.equal(skills.hitpoints, 25);
  assert.ok(skills.level('woodcutting') > 1); // existing progress preserved
});

test('bestiary has 300 monsters and 31 bosses, all well-formed', () => {
  assert.equal(MONSTER_IDS.length, 300);
  assert.equal(BOSS_IDS.length, 31);
  const ids = new Set([...MONSTER_IDS, ...BOSS_IDS]);
  assert.equal(ids.size, 331); // all ids unique
  for (const id of MONSTER_IDS) {
    const n = getNpc(id);
    assert.ok(n.attackable && n.sprite && n.color && n.level >= 1, `mob ${id} well-formed`);
    assert.ok(Array.isArray(n.dropTable), `mob ${id} has drops`);
  }
  for (const id of BOSS_IDS) {
    const b = getNpc(id);
    assert.ok(b.boss && b.scale > 1 && b.maxHp > 100, `boss ${id} well-formed`);
    assert.ok(b.mechanic, `boss ${id} has a mechanic`);
  }
  assert.ok(NPCS.chicken && NPCS.chicken.level === 1); // iconic ids preserved
});

test('new skills (Prayer, Thieving, Agility) exist with icons; gems have icons', () => {
  const ids = SKILLS.map((s) => s.id);
  for (const s of ['prayer', 'thieving', 'agility']) {
    assert.ok(ids.includes(s), `skill ${s} present`);
    assert.ok(skillIconSVG(s, 20).includes('<svg'));
  }
  for (const g of ['sapphire', 'emerald', 'ruby', 'diamond']) {
    assert.ok(hasIcon(g), `gem ${g} has icon`);
  }
});

test('Ranged & Magic skills + the spellbook exist', () => {
  const ids = SKILLS.map((s) => s.id);
  assert.ok(ids.includes('ranged') && ids.includes('magic'));
  assert.ok(skillIconSVG('ranged', 20).includes('<svg') && skillIconSVG('magic', 20).includes('<svg'));
  assert.ok(SPELLS.length >= 16, `spellbook has the full progression: ${SPELLS.length}`);
  for (const sp of SPELLS) assert.ok(sp.maxHit > 0 && sp.runes && sp.level >= 1, `spell ${sp.id} well-formed`);
  // Every rune referenced by a spell must be a real item.
  for (const sp of SPELLS) for (const r of Object.keys(sp.runes)) assert.ok(ITEMS[r], `spell ${sp.id} uses real rune ${r}`);
  for (const w of ['shortbow', 'yew_shortbow', 'staff', 'mystic_staff']) assert.ok(hasIcon(w), `weapon ${w} icon`);
});

test('achievements are defined, unique and well-formed', () => {
  assert.ok(ACHIEVEMENTS.length >= 18);
  const ids = new Set();
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.id && a.name && a.desc && a.cat, `achievement ${a.id} has fields`);
    assert.equal(typeof a.test, 'function', `achievement ${a.id} has a test`);
    assert.ok(!ids.has(a.id), `achievement id ${a.id} is unique`);
    ids.add(a.id);
  }
});

test('prayers are defined and well-formed', () => {
  assert.ok(PRAYERS.length >= 12);
  for (const p of PRAYERS) {
    assert.ok(p.level >= 1 && p.drain >= 1, `prayer ${p.id} well-formed`);
    assert.ok(p.protect || p.att || p.str || p.def || p.ranged || p.magic, `prayer ${p.id} has an effect`);
  }
});

test('every equippable item has its own custom icon', () => {
  const missing = Object.keys(ITEMS).filter((id) => ITEMS[id].equip && !hasIcon(id));
  assert.deepEqual(missing, [], `items missing icons: ${missing.join(', ')}`);
  assert.ok(itemIconSVG('rune_2h_sword', 24).includes('<svg'));
  assert.ok(itemIconSVG('merlion_blade', 24).includes('<svg'));
});

test('the tiered equipment generator produced a large gear set', () => {
  const weapons = Object.keys(ITEMS).filter((id) => ITEMS[id].equip?.slot === 'weapon');
  const armour = Object.keys(ITEMS).filter((id) => ITEMS[id].equip && ITEMS[id].equip.slot !== 'weapon');
  assert.ok(weapons.length >= 45, `weapons: ${weapons.length}`);
  assert.ok(armour.length >= 50, `armour pieces: ${armour.length}`);
  assert.ok(ITEMS.rune_2h_sword && ITEMS.bronze_gauntlets && ITEMS.mithril_boots);
});

test('the Dragon tier and new boss uniques exist with icons', () => {
  for (const id of ['dragon_scimitar', 'dragon_2h_sword', 'dragon_platebody', 'dragon_kiteshield', 'dragon_full_helm']) {
    assert.ok(ITEMS[id] && ITEMS[id].equip, `${id} is equippable`);
    assert.ok(hasIcon(id), `${id} has an icon`);
    assert.equal(ITEMS[id].equip.req.attack || ITEMS[id].equip.req.defence, 60, `${id} is end-game tier`);
  }
  for (const id of ['megalodon_jaw', 'phantom_robe', 'djinn_lamp', 'revenant_cape', 'adamant_arrow', 'rune_arrow']) {
    assert.ok(ITEMS[id], `${id} exists`);
    assert.ok(hasIcon(id), `${id} has an icon`);
  }
});

test('combat is beginner-friendly: weak town mobs and a punchy starter hit', () => {
  // Town starter monsters die fast now.
  assert.ok(getNpc('chicken').maxHp <= 6, `chicken hp ${getNpc('chicken').maxHp}`);
  assert.ok(getNpc('rat').maxHp <= 10, `rat hp ${getNpc('rat').maxHp}`);
  assert.ok(getNpc('goblin').maxHp <= 14 && getNpc('goblin').defence <= 4, 'goblin is squishy');
  // A fresh adventurer (Strength 15) with a bronze scimitar (+6 str) hits for 5+.
  assert.ok(maxHit(15, 3, 6) >= 5, `starter max hit ${maxHit(15, 3, 6)}`);
});

test('combat formulas produce valid ranges', () => {
  assert.ok(maxHit(1, 0, 0) >= 1);
  assert.ok(maxHit(99, 3, 14) > maxHit(1, 0, 0));
  const hc = hitChance(attackRoll(50, 3, 20), attackRoll(20, 0, 0));
  assert.ok(hc > 0 && hc <= 1);
  const xp = combatXp('aggressive', 10);
  assert.deepEqual(xp.find((x) => x.skill === 'strength').xp, 40);
});

test('gather chance stays within bounds and scales with level', () => {
  const lo = gatherChance(0.4, 0.95, 1);
  const hi = gatherChance(0.4, 0.95, 99);
  assert.ok(lo >= 0.05 && lo <= 0.99);
  assert.ok(hi > lo);
});

test('every shop stocks only real items; the archery shop exists', async () => {
  const { SHOPS } = await import('../src/data/shops.js');
  assert.ok(SHOPS.archery, 'archery shop exists');
  assert.ok(SHOPS.archery.stock.some((s) => s.id === 'magic_shortbow' || s.id === 'rune_arrow'));
  for (const [shopId, shop] of Object.entries(SHOPS)) {
    for (const entry of shop.stock) {
      assert.doesNotThrow(() => ITEMS[entry.id] || (() => { throw 0; })(), `${shopId} stocks unknown ${entry.id}`);
      assert.ok(ITEMS[entry.id], `${shopId} stocks unknown item ${entry.id}`);
    }
  }
});

test('slayer tasks/rewards are well-formed and a Slayer skill exists', async () => {
  const { SLAYER_TASKS, SLAYER_REWARDS, eligibleTasks } = await import('../src/data/slayer.js');
  assert.ok(SLAYER_TASKS.length >= 10);
  for (const t of SLAYER_TASKS) {
    assert.ok(t.family && t.name && t.req >= 1 && t.min >= 1 && t.max >= t.min, `task ${t.family} well-formed`);
    assert.ok(NPCS[MONSTER_IDS.find((id) => NPCS[id].family === t.family)], `task ${t.family} maps to a real monster`);
  }
  assert.ok(eligibleTasks(1).length >= 1 && eligibleTasks(99).length >= eligibleTasks(1).length);
  for (const r of SLAYER_REWARDS) { assert.ok(ITEMS[r.id], `reward ${r.id} is a real item`); assert.ok(r.cost >= 1); }
  assert.ok(SKILLS.map((s) => s.id).includes('slayer'));
  assert.ok(hasIcon('slayer_helmet') && hasIcon('slayer_ring'));
});

test('bank deposits and withdraws', () => {
  const bank = new Bank(new EventBus());
  bank.deposit('iron_ore', 10);
  bank.deposit('iron_ore', 5);
  assert.equal(bank.count('iron_ore'), 15);
  assert.equal(bank.withdraw('iron_ore', 20), 15);
  assert.equal(bank.count('iron_ore'), 0);
});

test('pathfinding finds a diagonal path on open ground', () => {
  const cfg = { width: 5, height: 5, isBlocked: () => false };
  const path = findPath(cfg, { x: 0, y: 0 }, { x: 4, y: 4 });
  assert.equal(path.length, 4);
  assert.deepEqual(path[path.length - 1], { x: 4, y: 4 });
});

test('pathfinding returns empty when unreachable', () => {
  const cfg = { width: 5, height: 5, isBlocked: (x) => x === 2 };
  const path = findPath(cfg, { x: 0, y: 0 }, { x: 4, y: 4 });
  assert.equal(path.length, 0);
});

test('pathfinding reachAdjacent stops next to a blocked target', () => {
  const cfg = { width: 5, height: 5, isBlocked: (x, y) => x === 2 && y === 2 };
  const path = findPath(cfg, { x: 0, y: 0 }, { x: 2, y: 2 }, { reachAdjacent: true });
  assert.ok(path.length > 0);
  const last = path[path.length - 1];
  assert.ok(Math.max(Math.abs(last.x - 2), Math.abs(last.y - 2)) <= 1);
  assert.ok(!(last.x === 2 && last.y === 2));
});

test('pathfinding does not cut blocked corners', () => {
  // From (0,0) to (1,1) with both orthogonal neighbours blocked => no path.
  const cfg = { width: 2, height: 2, isBlocked: (x, y) => (x === 1 && y === 0) || (x === 0 && y === 1) };
  const path = findPath(cfg, { x: 0, y: 0 }, { x: 1, y: 1 });
  assert.equal(path.length, 0);
});
