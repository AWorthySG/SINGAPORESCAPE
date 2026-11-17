// The two-handed grip: a two-handed weapon can't share the hands with a shield,
// buckler or quiver, so it carries what a same-tier off-hand would give (the
// kiteshield's Defence and life, the buckler's or quiver's offensive extras).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS, gripBonus } from '../src/data/items.js';
import { isTwoHanded, TWO_HANDED } from '../src/game/equipment.js';
import { freshGame } from '../tools/balance/common.mjs';
import { UI } from '../src/ui/ui.js';

const TIERS = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'dragon', 'obsidian', 'orichalcum', 'jade', 'starmetal', 'celestial', 'eternal'];
const kite = (t) => ITEMS[`${t}_kiteshield`].equip.bonuses;

test('every two-handed weapon of tier T has at least the tier-T kiteshield\'s Defence and life', () => {
  for (const t of TIERS) {
    for (const w of ['warhammer', '2h_sword', 'katana', 'halberd', 'claws', 'crossbow', 'rifle']) {
      const it = ITEMS[`${t}_${w}`];
      assert.ok(it, `${t}_${w} exists`);
      assert.ok(isTwoHanded(it.id));
      assert.ok((it.equip.bonuses.defence || 0) >= kite(t).defence, `${it.id}: ${it.equip.bonuses.defence} Defence < ${kite(t).defence}`);
      assert.ok((it.equip.bonuses.hp || 0) >= kite(t).hp, `${it.id}: ${it.equip.bonuses.hp} life < ${kite(t).hp}`);
      assert.equal(it.equip.grip.tier, t);
    }
    // Melee two-handers take the buckler's offence, ranged ones the quiver's.
    const buck = ITEMS[`${t}_buckler`].equip.bonuses, quiv = ITEMS[`${t}_quiver`].equip.bonuses;
    assert.deepEqual({ ...ITEMS[`${t}_halberd`].equip.grip, tier: undefined }, { defence: kite(t).defence, hp: kite(t).hp, atkPct: buck.atkPct, haste: buck.haste, tier: undefined });
    assert.equal(ITEMS[`${t}_rifle`].equip.grip.ranged, quiv.ranged);
    assert.equal(ITEMS[`${t}_rifle`].equip.grip.atkPct, quiv.atkPct);
  }
  // Every two-hander has a grip (wooden bows, uniques, signatures by their level); nothing else does.
  for (const it of Object.values(ITEMS)) {
    const two = it.equip?.slot === 'weapon' && TWO_HANDED.has(it.equip.weaponType);
    assert.equal(!!it.equip?.grip, two, it.id);
  }
  assert.equal(ITEMS.shortbow.equip.grip.tier, 'bronze');
  assert.equal(ITEMS.sig_singa_of_temasek.equip.grip.tier, 'eternal');
  assert.deepEqual(gripBonus({ k: 'rune' }, false), { defence: kite('rune').defence, hp: kite('rune').hp, atkPct: ITEMS.rune_buckler.equip.bonuses.atkPct, haste: ITEMS.rune_buckler.equip.bonuses.haste });
});

test('a two-handed fighter is as sturdy as a one-handed fighter with the same-tier kiteshield', () => {
  for (const t of ['bronze', 'rune', 'dragon', 'jade', 'eternal']) {
    const two = freshGame('gladiator'), one = freshGame('swordsman');
    for (const g of [two, one]) for (const s of Object.keys(g.equipment.slots)) g.equipment.slots[s] = null;
    two.equipment.slots.weapon = `${t}_2h_sword`;
    one.equipment.slots.weapon = `${t}_sword`;
    one.equipment.slots.shield = `${t}_kiteshield`;
    const a = two.equipment.bonuses(), b = one.equipment.bonuses();
    // The two-hander's own stats carry no Defence or life apart from the grip.
    assert.equal(a.defence, b.defence, `${t}: Defence`);
    assert.equal(a.hp, b.hp, `${t}: life`);
    assert.equal(two.maxHp(), one.maxHp(), `${t}: max life`);
  }
});

test('the grip never stacks with an off-hand: the shield slot stays empty under a two-hander', () => {
  const g = freshGame('halberdier');
  const w = g.equipment.get('weapon');
  assert.ok(isTwoHanded(w));
  const before = g.equipment.bonuses().defence;
  g.inventory.add('bronze_kiteshield', 1);
  g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'bronze_kiteshield'));
  assert.equal(g.equipment.get('shield'), null);
  assert.equal(g.equipment.bonuses().defence, before);
});

test('the item tooltip names the two-handed grip', () => {
  const g = freshGame('ranger');
  const ui = { game: g, _gearStats: UI.prototype._gearStats };
  const html = UI.prototype._gearTip.call(ui, 'rune_crossbow');
  const gr = ITEMS.rune_crossbow.equip.grip;
  assert.ok(html.includes(`Two-handed grip: +${gr.defence} Defence, +${gr.hp} life, +${gr.ranged} Ranged, +${gr.atkPct}% damage, +${gr.haste}% attack speed`), html);
  assert.ok(html.includes('makes up for having no off-hand'));
  assert.ok(!UI.prototype._gearTip.call(ui, 'rune_kiteshield').includes('Two-handed grip'));
  assert.ok(!/NaN|undefined/.test(html));
});
