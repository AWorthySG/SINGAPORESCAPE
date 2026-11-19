// The Enchant window tags each of the three offers against the lines the piece
// already has (compareEnchantOffer in src/game/mastery.js): new line, stacks,
// better / weaker / same than the line it replaces, or a new stat in its place.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compareEnchantOffer, enchantValue, rollEnchantOffers, enchantedBonuses, MAX_ENCHANTS } from '../src/game/mastery.js';

const L = (stat, value) => ({ stat, value });

test('no enchantments yet: every offer is a new line', () => {
  for (const o of rollEnchantOffers('bronze_sword', () => 0.5)) {
    const v = compareEnchantOffer(o, []);
    assert.equal(v.kind, 'new');
    assert.equal(v.text, 'New: adds a line');
  }
});

test('a free slot: a new stat adds a line, a stat already there stacks (with the total)', () => {
  const lines = [L('crit', 2)];
  assert.equal(compareEnchantOffer(L('haste', 1), lines).kind, 'new');
  const v = compareEnchantOffer(L('crit', 2), lines);
  assert.equal(v.kind, 'stack');
  assert.equal(v.text, 'Stacks with your crit chance: +4% in all');
  // That total is what the item really gets: lines add up.
  assert.equal(enchantedBonuses({}, [...lines, L('crit', 2)]).crit, 4);
});

test('replacing a line of the same stat: better, weaker or the same', () => {
  const lines = [L('crit', 2), L('haste', 1), L('bossDmg', 3)];
  assert.equal(lines.length, MAX_ENCHANTS);
  const better = compareEnchantOffer(L('crit', 3), lines, 0);
  assert.deepEqual(better, { kind: 'better', text: '▲ Better than your current +2% crit chance' });
  const weaker = compareEnchantOffer(L('crit', 1), lines, 0);
  assert.deepEqual(weaker, { kind: 'weaker', text: '▼ Weaker than your current +2% crit chance' });
  assert.equal(compareEnchantOffer(L('crit', 2), lines, 0).kind, 'same');
});

test('replacing a line of another stat: a swap, or a stack with a line that stays', () => {
  const lines = [L('crit', 2), L('haste', 1), L('bossDmg', 3)];
  const swap = compareEnchantOffer(L('pierce', 1), lines, 1);
  assert.deepEqual(swap, { kind: 'swap', text: 'New stat, in place of +1% attack speed' });
  const stack = compareEnchantOffer(L('crit', 2), lines, 1);   // haste goes, crit doubles up
  assert.equal(stack.kind, 'stack');
  assert.equal(stack.text, 'Stacks with your crit chance: +4% in all');
});

test('a full piece before a line is chosen: measured against its line of that stat, if any', () => {
  const lines = [L('crit', 2), L('haste', 1), L('bossDmg', 3)];
  assert.equal(compareEnchantOffer(L('crit', 2), lines).kind, 'same');
  assert.equal(compareEnchantOffer(L('pierce', 1), lines).kind, 'swap');
});

test('on one item a stat\'s line is always the same size, so a fresh pick never reads as weaker', () => {
  const id = 'rune_sword';
  const lines = rollEnchantOffers(id, () => 0.1);
  for (const o of rollEnchantOffers(id, () => 0.1)) {
    assert.equal(o.value, enchantValue(id, o.stat));
    assert.notEqual(compareEnchantOffer(o, lines, lines.findIndex((l) => l.stat === o.stat)).kind, 'weaker');
  }
});
