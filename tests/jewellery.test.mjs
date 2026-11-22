// Stronger rings and amulets (items.js JEWELLERY_MULT), and the Gear Guide ranks
// each slot for a fighting style with the best in slot marked.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEMS, JEWELLERY_MULT } from '../src/data/items.js';
import { effectiveRating } from '../src/game/gear.js';

test('rings and amulets carry twice the fighting stats they did', () => {
  assert.equal(JEWELLERY_MULT, 2);
  // Known pieces, before -> after.
  assert.equal(ITEMS.eternal_amulet.equip.bonuses.attack, 52);   // was 26
  assert.equal(ITEMS.ruby_amulet.equip.bonuses.attack, 28);      // was 14
  assert.equal(ITEMS.merlion_amulet.equip.bonuses.ranged, 60);   // was 30
  assert.equal(ITEMS.temple_pendant.equip.bonuses.prayer, 8, 'prayer unchanged');
  // An endgame amulet now counts next to an endgame glove.
  const glove = ITEMS.eternal_mage_gloves.equip.bonuses.magic, amulet = ITEMS.eternal_amulet.equip.bonuses.magic;
  assert.ok(amulet >= glove * 0.4, `${amulet} vs gloves ${glove}`);
});

test('a style ranks its own jewellery first', () => {
  const rings = Object.keys(ITEMS).filter((id) => ITEMS[id].equip?.slot === 'ring');
  const top = (mode, lvl) => rings.filter((id) => Math.max(1, ...Object.values(ITEMS[id].equip.req || {})) <= lvl)
    .sort((a, b) => effectiveRating(b, {}, mode) - effectiveRating(a, {}, mode))[0];
  assert.equal(ITEMS[top('melee', 1)].equip.style, 'melee');
  assert.equal(ITEMS[top('ranged', 1)].equip.style, 'ranged');
  assert.equal(ITEMS[top('magic', 1)].equip.style, 'magic');
});

test('the Gear Guide marks the best in slot and the best you can wear now', () => {
  const src = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(src, /★ Best in slot/);
  assert.match(src, /★ Best you can wear now/);
  assert.match(src, /const score = \(id\) => effectiveRating\(id, \{\}, styleOf\(id\)\)/);
});
