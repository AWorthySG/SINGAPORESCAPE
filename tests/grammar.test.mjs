// "a" or "an" by sound (core/utils.js aOrAn), used wherever a message names a
// fish, gem, skill, class or item: "You catch an eel", "an Agility level".
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aOrAn } from '../src/core/utils.js';
import { ITEMS } from '../src/data/items.js';

test('aOrAn picks by sound', () => {
  for (const [w, want] of [['eel', 'an eel'], ['emerald', 'an emerald'], ['Agility', 'an Agility'], ['Archer', 'an Archer'], ['iron', 'an iron'],
    ['oak log', 'an oak log'], ['uncut ruby', 'an uncut ruby'], ['hour', 'an hour'], ['honour', 'an honour'],
    ['unicorn', 'a unicorn'], ['useful tip', 'a useful tip'], ['one-off', 'a one-off'], ['tuna', 'a tuna'], ['Swordsman', 'a Swordsman']]) {
    assert.equal(aOrAn(w), want);
  }
});

test('no message names a vowel-led thing with a bare "a ${...}" any more', () => {
  // The lines that used to: each now goes through aOrAn.
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  assert.match(src('ui/ui.js'), /you just advanced \$\{aOrAn\(sk\.name\)\} level/);
  assert.match(src('game/skilling.js'), /You chip out \$\{aOrAn\(oreName\)\}/);
  assert.match(src('game/skilling.js'), /You catch \$\{aOrAn\(nm\)\}/);
  assert.match(src('game/game.js'), /You are now \$\{aOrAn\(cls\.name\)\}/);
});

test('item descriptions built from a metal read "an iron tip", not "a iron tip"', () => {
  const bad = Object.entries(ITEMS).filter(([, it]) => /\ba [aeio]\w/i.test(it.examine || '')).map(([id, it]) => `${id}: ${it.examine}`);
  assert.deepEqual(bad, [], 'no "a" before a vowel in any examine text');
});

test('monster descriptions read "An imp", not "A imp"', async () => {
  const { NPCS } = await import('../src/data/npcs.js');
  const bad = Object.entries(NPCS).filter(([, d]) => /^A [aeio]\w/i.test(d.examine || '')).map(([id, d]) => `${id}: ${d.examine}`);
  assert.deepEqual(bad, []);
});
