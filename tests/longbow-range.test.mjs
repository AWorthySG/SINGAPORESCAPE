// Longbow reach (the owner: "Reduce the attack range of longbows. It's way too
// far."). Longbows reached 15-28 tiles (33 with the Long Shot perk) while
// shortbows reach 5-9, pistols 7 and spells 8. Now every longbow reaches
// LONGBOW_RANGE tiles (LONGBOW_RANGE_LATE from the orichalcum tier on): a little
// more than the shortbow of its tier, magic and pistols, and no more.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, LONGBOW_RANGE, LONGBOW_RANGE_LATE, LONGBOW_LATE_LEVEL } from '../src/data/items.js';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { fakeStorage } from '../tools/balance/common.mjs';

const weapons = (type) => Object.entries(ITEMS).filter(([, it]) => it.equip?.slot === 'weapon' && !it.tool && it.equip.weaponType === type);

test('every longbow (boss signatures too) reaches 9 tiles, 10 from Ranged 100', () => {
  assert.equal(LONGBOW_RANGE, 9);
  assert.equal(LONGBOW_RANGE_LATE, 10);
  const bows = weapons('longbow');
  assert.ok(bows.length >= 13, `${bows.length} longbows`);
  for (const [id, it] of bows) {
    const want = (it.equip.req?.ranged || 1) >= LONGBOW_LATE_LEVEL ? LONGBOW_RANGE_LATE : LONGBOW_RANGE;
    assert.equal(it.equip.range, want, `${id} reaches ${it.equip.range}`);
    assert.ok(!/very long way/.test(it.examine || ''), `${id}: the examine text no longer promises a very long reach`);
  }
});

test('a longbow out-reaches the shortbow of its tier, spells and pistols, but only a little', () => {
  const shortAt = (lvl) => Math.max(...weapons('shortbow').filter(([, it]) => !it.signature && (it.equip.req?.ranged || 1) <= lvl).map(([, it]) => it.equip.range));
  for (const [id, it] of weapons('longbow')) {
    const r = it.equip.range, s = shortAt(it.equip.req?.ranged || 1);
    assert.ok(r > s && r - s <= 4, `${id}: ${r} against the best shortbow of its level (${s})`);
    assert.ok(r > 8 && r <= 10, `${id}: just past a spell's 8`);
  }
  for (const [id, it] of weapons('pistol')) assert.ok(it.equip.range < LONGBOW_RANGE, `${id} reaches less than a longbow`);
});

test('a new Ranger attacks from 9 tiles', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('ranger');
  assert.equal(g.equipment.get('weapon') && ITEMS[g.equipment.get('weapon')].equip.weaponType, 'longbow');
  assert.equal(g.attackRange(), LONGBOW_RANGE);
});
