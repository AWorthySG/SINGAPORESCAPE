// A long game's pack holds hundreds of pieces (it is endless), and every
// pickup redrew it: cells you have scrolled past now skip the browser's layout
// work, and whether each piece beats your gear is worked out once until your
// gear, levels or style change (ui.js renderInventory).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');

test('off-screen pack cells skip layout, and the grid contains its changes', () => {
  assert.match(css, /\.inv-slot \{ content-visibility: auto; contain-intrinsic-size: auto 52px; \}/);
  assert.match(css, /#inventory-grid \{ contain: layout style; \}/);
});

test('the green arrow is worked out once per piece until gear, levels or style change', () => {
  assert.match(ui, /if \(this\._betterKey !== gearKey\) \{ this\._betterKey = gearKey; this\._betterOf = new Map\(\); \}/);
  assert.match(ui, /better = betterOf\.get\(bk\);/);
});
