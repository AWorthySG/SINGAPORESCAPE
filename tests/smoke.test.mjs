import { test } from 'node:test';
import assert from 'node:assert/strict';

import { XP_TABLE, levelForXp, xpForLevel, levelProgress, xpToNext } from '../src/data/xp.js';
import { Inventory } from '../src/game/inventory.js';
import { Skills } from '../src/game/skillset.js';
import { Equipment } from '../src/game/equipment.js';
import { Bank } from '../src/game/bank.js';
import { EventBus } from '../src/core/events.js';
import { findPath } from '../src/engine/pathfinding.js';
import { hitChance, maxHit, attackRoll, combatXp } from '../src/game/combat.js';
import { gatherChance } from '../src/game/skilling.js';
import { XP_RATE } from '../src/config.js';
import { NPCS, MONSTER_IDS, BOSS_IDS, getNpc } from '../src/data/npcs.js';
import { itemIconSVG, hasIcon, skillIconSVG, pngItems } from '../src/render/icons.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  assert.equal(XP_TABLE.length, 1000, 'levels run to 999');
  for (let l = 2; l <= 999; l++) assert.ok(XP_TABLE[l] > XP_TABLE[l - 1], `level ${l} costs more xp`);
});

test('levelForXp inverts the table', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(82), 1);
  assert.equal(levelForXp(83), 2);
  assert.equal(levelForXp(13034431), 99);
  assert.equal(levelForXp(13034431 - 1), 98);
  assert.equal(levelForXp(xpForLevel(500)), 500);
  assert.equal(levelForXp(xpForLevel(999)), 999);
  assert.equal(levelForXp(1e15), 999, 'capped at 999');
});

test('level progress and xp-to-next are sane', () => {
  assert.ok(levelProgress(0) === 0);
  assert.equal(xpToNext(0), 83);
  assert.ok(xpToNext(13034431) > 0, 'level 99 is no longer the cap');
  assert.equal(xpToNext(xpForLevel(999)), 0);
});

test('items stack to 999 per slot; coins are uncapped', () => {
  const inv = new Inventory(new EventBus());
  // Coins are exempt from the cap -> a single slot.
  assert.equal(inv.add('coins', 5000), 5000);
  assert.equal(inv.count('coins'), 5000);
  assert.equal(inv.slots.filter(Boolean).length, 1);
  // 2500 logs span 3 slots (999 + 999 + 502).
  assert.equal(inv.add('logs', 2500), 2500);
  assert.equal(inv.count('logs'), 2500);
  assert.equal(inv.slots.filter(Boolean).length, 4);
  assert.equal(inv.slots.find((x) => x?.id === 'logs').qty, 999);
  assert.equal(inv.remove('logs', 1200), 1200);
  assert.equal(inv.count('logs'), 1300);
});

test('the inventory is unlimited: it grows past 28 slots and always keeps a spare row', () => {
  const inv = new Inventory(new EventBus());
  assert.equal(inv.size, 28);
  // 50,000 bones need 51 slots of 999: everything fits.
  assert.equal(inv.canAdd('bones', 50000), 50000);
  assert.equal(inv.add('bones', 50000), 50000);
  assert.equal(inv.count('bones'), 50000);
  assert.ok(!inv.isFull());
  assert.ok(inv.size >= 54, `grew to hold them with a spare row (size ${inv.size})`);
  assert.equal(inv.slots.slice(-4).filter((x) => x === null).length, 4, 'four empty slots stay open');
  assert.equal(inv.add('coins', 7), 7, 'a brand-new item still fits');
  // Clearing out shrinks back down to the normal 28.
  inv.remove('bones', 50000); inv.remove('coins', 7);
  assert.equal(inv.size, 28);
});

test('an unlimited inventory survives save/load', () => {
  const inv = new Inventory(new EventBus());
  inv.add('bones', 4000);
  const inv2 = new Inventory(new EventBus());
  inv2.load(inv.serialize());
  assert.equal(inv2.count('bones'), 4000);
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

test('monsters drop level-appropriate combat equipment (weapons & armour)', () => {
  // Sample a low/mid/high regular monster; each should drop several equippable items.
  for (const id of ['goblin', 'wild_boar', 'skeleton']) {
    const n = getNpc(id);
    if (!n || n.boss) continue;
    const equip = n.dropTable.filter((d) => d.id && ITEMS[d.id] && ITEMS[d.id].equip);
    const weapons = equip.filter((d) => ITEMS[d.id].equip.slot === 'weapon');
    const armour = equip.filter((d) => ITEMS[d.id].equip.slot !== 'weapon');
    assert.ok(weapons.length >= 2, `${id} drops multiple weapons`);
    assert.ok(armour.length >= 2, `${id} drops armour`);
  }
});

test('bestiary has 452 monsters and 48 bosses, all well-formed', () => {
  assert.equal(MONSTER_IDS.length, 452); // 300 + 48 endgame + 72 far-region species forms + 32 Celestial / Divine
  assert.equal(BOSS_IDS.length, 48); // 31 + the two alignment-arc bosses + 5 open-world/endgame + 10 far-region bosses
  const ids = new Set([...MONSTER_IDS, ...BOSS_IDS]);
  assert.equal(ids.size, 500); // all ids unique
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
    assert.ok(/<svg|assets\/icons\/skill-/.test(skillIconSVG(s, 20)), `skill ${s} has an icon (vector or mascot art)`);
  }
  for (const g of ['sapphire', 'emerald', 'ruby', 'diamond']) {
    assert.ok(hasIcon(g), `gem ${g} has icon`);
  }
});

test('Ranged & Magic skills + the spellbook exist', () => {
  const ids = SKILLS.map((s) => s.id);
  assert.ok(ids.includes('ranged') && ids.includes('magic'));
  assert.ok(skillIconSVG('ranged', 20).includes('assets/icons/skill-ranged.webp') && skillIconSVG('magic', 20).includes('assets/icons/skill-magic.webp'));
  assert.ok(SPELLS.length >= 16, `spellbook has the full progression: ${SPELLS.length}`);
  for (const sp of SPELLS) assert.ok(sp.maxHit > 0 && sp.runes && sp.level >= 1, `spell ${sp.id} well-formed`);
  // Every rune referenced by a spell must be a real item.
  for (const sp of SPELLS) for (const r of Object.keys(sp.runes)) assert.ok(ITEMS[r], `spell ${sp.id} uses real rune ${r}`);
  for (const w of ['shortbow', 'yew_shortbow', 'staff', 'mystic_staff']) assert.ok(hasIcon(w), `weapon ${w} icon`);
});

test('every skill is labelled: it has a group and a short description', async () => {
  const { SKILL_GROUPS } = await import('../src/data/skills.js');
  const groups = new Set(SKILL_GROUPS.map((g) => g.id));
  for (const sk of SKILLS) {
    assert.ok(groups.has(sk.group), `${sk.id} sits in a known group`);
    assert.ok(typeof sk.desc === 'string' && sk.desc.length > 10 && sk.desc.length < 90, `${sk.id} has a short description`);
  }
});

test('every mascot icon the game references exists on disk', async () => {
  const { ABILITIES } = await import('../src/data/abilities.js');
  const { abilityIconHTML, tabIconSVG } = await import('../src/render/icons.js');
  const dir = fileURLToPath(new URL('../assets/icons/', import.meta.url));
  const onDisk = new Set(readdirSync(dir));
  const refs = [
    ...ABILITIES.map((a) => abilityIconHTML(a.id)),
    ...['inventory', 'equipment', 'skills', 'combat', 'prayer', 'quests', 'achievements', 'settings'].map((t) => tabIconSVG(t)),
    ...SKILLS.map((sk) => skillIconSVG(sk.id)),
    ...Object.keys(ITEMS).map((id) => itemIconSVG(id)),
  ];
  for (const html of refs) {
    const m = html.match(/assets\/icons\/([\w-]+\.webp)/);
    if (m) assert.ok(onDisk.has(m[1]), `${m[1]} exists`);
  }
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
  // Gear now uses sticker artwork, with the vector kept as a fallback.
  assert.ok(itemIconSVG('rune_2h_sword', 24).includes('assets/icons/item-rune_2h_sword.webp'));
  assert.ok(itemIconSVG('merlion_blade', 24).includes('assets/icons/item-merlion_blade.webp'));
});

test('every item has A-Worthy sticker artwork, ahead of any older painted PNG', () => {
  // Sticker artwork (assets/icons/item-<id>.webp) wins over the older
  // hand-drawn PNGs in assets/items/, which stay as a fallback.
  assert.ok(itemIconSVG('nasi_lemak', 32).includes('assets/icons/item-nasi_lemak.webp'), 'nasi lemak uses its sticker artwork');
  assert.ok(itemIconSVG('logs', 32).includes('assets/icons/item-logs.webp'), 'logs use the sticker artwork');
  assert.ok(itemIconSVG('raw_arowana', 24).includes('assets/icons/item-raw_arowana.webp'));
  assert.ok(itemIconSVG('venison', 24).includes('assets/icons/item-venison.webp'));
  for (const id of Object.keys(ITEMS)) assert.ok(itemIconSVG(id, 24).includes('assets/icons/item-'), `${id} has sticker artwork`);
  // Painted items still retain a vector fallback (so hasIcon stays true).
  assert.ok(hasIcon('logs') && hasIcon('raw_barramundi'));
});

test('PNG_ITEMS stays in lock-step with the files under assets/items/', () => {
  const dir = fileURLToPath(new URL('../assets/items/', import.meta.url));
  const onDisk = new Set(readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));
  const declared = pngItems();
  const missingFiles = [...declared].filter((id) => !onDisk.has(id));
  const undeclared = [...onDisk].filter((id) => !declared.has(id));
  assert.deepEqual(missingFiles, [], `declared in PNG_ITEMS but no file: ${missingFiles.join(', ')}`);
  assert.deepEqual(undeclared, [], `file on disk but not in PNG_ITEMS: ${undeclared.join(', ')}`);
  // Every painted id (bar the currency) must be a real game item.
  const orphans = [...declared].filter((id) => id !== 'coins' && !ITEMS[id]);
  assert.deepEqual(orphans, [], `painted ids with no item: ${orphans.join(', ')}`);
});

test('new content: capes, granite maul and cooking herbs are wired up & sourced', async () => {
  const [{ SHOPS }, { CRAFT }, { DISHES }] = await Promise.all([
    import('../src/data/shops.js'), import('../src/data/crafting.js'), import('../src/data/cooking.js'),
  ]);
  // Cultural capes — equippable back-slot gear, bought at the general store.
  for (const id of ['batik_cape', 'songket_cape']) {
    assert.equal(ITEMS[id].equip.slot, 'cape', `${id} is a cape`);
    assert.ok(hasIcon(id), `${id} has an icon`);
    assert.ok(SHOPS.general.stock.some((s) => s.id === id), `${id} is sold somewhere`);
  }
  // Granite maul — a crushing 2H weapon with a spec, crafted from granite.
  assert.equal(ITEMS.granite_maul.equip.slot, 'weapon');
  assert.ok(ITEMS.granite_maul.spec, 'granite maul has a special attack');
  assert.ok(CRAFT.some((r) => r.result === 'granite_maul' && r.inputs.some((i) => i.id === 'granite')));
  // Herbs — stackable ingredients, buyable at the hawker, feeding new dishes.
  const herbs = ['chilli', 'galangal', 'lemongrass', 'pandan_leaves', 'turmeric'];
  for (const h of herbs) {
    assert.ok(ITEMS[h]?.stackable, `${h} is a stackable ingredient`);
    assert.ok(SHOPS.hawker.stock.some((s) => s.id === h), `${h} is sold at the hawker`);
  }
  const herbDishes = DISHES.filter((d) => d.inputs.some((i) => herbs.includes(i.id)));
  assert.ok(herbDishes.length >= 3, `herbs unlock new dishes: ${herbDishes.length}`);
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

test('armour set bonuses apply only when the full set is worn', () => {
  const eq = new Equipment(new EventBus());
  eq.set('head', 'dragon_full_helm');
  eq.set('body', 'dragon_platebody');
  assert.deepEqual(eq.activeSets(), [], 'partial set gives no bonus');
  const partial = eq.bonuses().strength;
  eq.set('legs', 'dragon_platelegs');
  assert.deepEqual(eq.activeSets(), ['Dragon'], 'full set detected');
  assert.ok(eq.bonuses().strength > partial, 'set bonus added on completion');
});

test('combat is fast-paced: quick weapons swing every tick', () => {
  const eq = new Equipment(new EventBus());
  eq.set('weapon', 'bronze_scimitar');
  assert.equal(eq.weaponSpeed(), 1, 'scimitar swings every tick (0.6s)');
  eq.set('weapon', 'bronze_axe');
  assert.equal(eq.weaponSpeed(), 2, 'slower weapons are still quicker than before');
  eq.clearSlot('weapon');
  assert.equal(eq.weaponSpeed(), 2, 'unarmed sped up too');
});

test('select weapons carry special attacks', () => {
  for (const id of ['dragon_scimitar', 'dragon_dagger', 'merlion_blade', 'cursed_cutlass']) {
    const sp = ITEMS[id].spec;
    assert.ok(sp && sp.name && sp.cost >= 1 && sp.cost <= 100, `${id} has a valid spec`);
  }
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

test('gear guide: ranks gear per slot and says whether a piece is an upgrade', async () => {
  const { gearRating, compareGear, gearBySlot, tierOf, meetsReq } = await import('../src/game/gear.js');
  const eq = new Equipment(new EventBus());
  // Better metal, better score.
  assert.ok(gearRating('steel_scimitar') > gearRating('iron_scimitar'));
  assert.ok(gearRating('iron_platebody') > gearRating('bronze_platebody'));
  // An empty slot is always filled; then a stronger piece is an upgrade and a weaker one isn't.
  assert.equal(compareGear('bronze_platebody', eq).verdict, 'empty');
  eq.set('body', 'bronze_platebody');
  const up = compareGear('iron_platebody', eq);
  assert.equal(up.verdict, 'upgrade');
  assert.ok(up.deltas.some((d) => d.key === 'defence' && d.delta > 0));
  assert.equal(compareGear('leather_body', eq).verdict, 'downgrade');
  assert.equal(compareGear('bronze_platebody', eq).verdict, 'worn');
  // A bow next to a sword is a change of style, not a straight upgrade.
  eq.set('weapon', 'bronze_sword');
  assert.equal(compareGear('shortbow', eq).verdict, 'style');
  // Every slot list is sorted best first and covers every equippable item.
  const by = gearBySlot();
  let total = 0;
  for (const [slot, ids] of Object.entries(by)) {
    total += ids.length;
    for (let i = 1; i < ids.length; i++) assert.ok(gearRating(ids[i - 1]) >= gearRating(ids[i]), `${slot} sorted`);
  }
  assert.equal(total, Object.values(ITEMS).filter((it) => it.equip && by[it.equip.slot]).length);
  assert.equal(tierOf(by.body[0]).rank, 1);
  // Requirements are reported, not just enforced.
  const skills = new Skills(new EventBus());
  assert.equal(meetsReq('bronze_sword', skills).ok, true);
  const hi = by.weapon.find((id) => (ITEMS[id].equip.req?.attack || 0) >= 40);
  assert.equal(meetsReq(hi, skills).ok, false);
});

test('inventory sort merges split stacks and groups by type; categories drive the tabs', async () => {
  const { itemCategory } = await import('../src/game/inventory.js');
  assert.equal(itemCategory('coins'), 'coins');
  assert.equal(itemCategory('bronze_sword'), 'gear');
  assert.equal(itemCategory('chicken_rice'), 'food');
  assert.equal(itemCategory('iron_ore'), 'materials');
  assert.equal(itemCategory('logs'), 'materials');
  const inv = new Inventory(new EventBus());
  inv.add('logs', 5); inv.add('bronze_sword', 1); inv.add('coins', 10); inv.add('chicken_rice', 2);
  // Split the logs into two partial stacks by hand.
  inv.slots[inv.slots.findIndex((x) => x === null)] = { id: 'logs', qty: 3 };
  inv.sort();
  const ids = inv.slots.filter(Boolean).map((x) => x.id);
  assert.deepEqual(ids, ['coins', 'bronze_sword', 'chicken_rice', 'logs'], 'coins, gear, food, materials');
  assert.equal(inv.count('logs'), 8, 'nothing lost');
  assert.equal(inv.slots.filter((x) => x && x.id === 'logs').length, 1, 'split stacks merged');
  assert.ok(inv.size >= 28, 'keeps the normal pack size');
});

test('monsters and bosses drop archery loot: bows, arrows and ranged armour', () => {
  const ids = (d) => new Set((d.dropTable || []).map((x) => x.id));
  const low = ids(getNpc('goblin'));
  assert.ok(low.has('shortbow') && low.has('bronze_arrow') && low.has('coif'), 'a low monster drops a shortbow, arrows and a coif');
  const high = MONSTER_IDS.map(getNpc).find((d) => d.level >= 75);
  assert.ok(ids(high).has('magic_shortbow') && ids(high).has('dragonhide_body'), 'a high monster drops a magic shortbow and dragonhide');
  for (const id of BOSS_IDS) {
    const t = ids(getNpc(id));
    assert.ok([...t].some((x) => /bow$/.test(x)), `${id} drops a bow`);
    assert.ok([...t].some((x) => /_arrow$/.test(x)), `${id} drops arrows`);
    for (const x of t) if (x) assert.ok(ITEMS[x], `${id} drop ${x} is a real item`);
  }
});

test('monsters and bosses drop magic loot: staves, robes and runes', () => {
  const ids = (d) => new Set((d.dropTable || []).map((x) => x.id));
  const low = ids(getNpc('goblin'));
  assert.ok(low.has('staff') && low.has('mind_rune') && low.has('wizard_hat'), 'a low monster drops a staff, runes and wizard robes');
  const high = MONSTER_IDS.map(getNpc).find((d) => d.level >= 70);
  const h = ids(high);
  assert.ok((h.has('death_staff') || h.has('blood_staff')) && h.has('blood_rune') && h.has('mystic_top'), 'a high monster drops top staves, blood runes and mystic robes');
  for (const id of BOSS_IDS) {
    const t = ids(getNpc(id));
    assert.ok([...t].some((x) => /staff$/.test(x)), `${id} drops a staff`);
    assert.ok([...t].some((x) => /_rune$/.test(x)), `${id} drops runes`);
    for (const x of t) if (x) assert.ok(ITEMS[x], `${id} drop ${x} is a real item`);
  }
});
