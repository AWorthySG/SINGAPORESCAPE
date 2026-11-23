// "Equip best in slot" is pinned at the top of the Gear view (it sat below the
// worn slots, so a phone's short sheet meant scrolling down to it and back up),
// and says how many upgrades the bag holds.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

test('the Equip best bar is built above the worn slots and counts the upgrades', () => {
  assert.match(ui, /this\._equipBestBar\(layout\);\n    layout\.innerHTML = '';/);
  assert.match(ui, /layout\.parentNode\?\.insertBefore\(bar, layout\)/);
  assert.match(ui, /const n = packUpgrades\(this\.game\)\.length;/);
  assert.doesNotMatch(ui, /this\.el\.equipBonuses\.prepend\(bis\)/, 'no second Equip best button further down');
});

test('it stays pinned while the Gear view scrolls, just under the Bag / Gear switch', () => {
  assert.match(css, /\.eq-bestbar \{ position: sticky;/);
  assert.match(ui, /bar\.style\.top = `\$\{Math\.round\(under - pad\)\}px`/);
});
