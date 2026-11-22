// The Skills & perks window lists a class's five skills in full, and the skill
// buttons use the game's own hover card (the browser's title tip never showed).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abilitiesFor } from '../src/data/abilities.js';
import { CLASSES } from '../src/data/classes.js';

const src = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');

test('every class has five skills with a key, a cooldown and a description to list', () => {
  for (const c of CLASSES) {
    const set = abilitiesFor(c.style, c.id);
    assert.equal(set.length, 5, c.id);
    for (const ab of set) assert.ok(ab.key && ab.desc && ab.cd > 0, `${c.id} ${ab.id}`);
  }
});

test('the window has a Skills section and the bar no longer relies on title tips', () => {
  assert.match(src, /_skillsSection\(cls\)/);
  assert.match(src, /<b>Skills<\/b>/);
  assert.match(src, /Skills &amp; perks<\/button>/);
  assert.doesNotMatch(src, /btn\.title = `\$\{ab\.name\}/);
  assert.match(src, /btn\._tipGet = \(\) => this\._skillTipHTML\(ab\)/);
});
