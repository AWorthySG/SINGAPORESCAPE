// A tidier phone screen: tips stop short of the orbs, the quick bar folds
// behind a "more" button, the Bag clears the orbs' labels, and a skill's
// level-ups share one toast.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placeLane } from '../src/ui/noticelane.js';

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

test('on a phone the tip lane stops short of the travel controls under the minimap', () => {
  // The travel controls reach farther into the playfield than the map square.
  const b = {
    'boss-bar': box(6, 6, 250, 48), 'quest-tracker': box(6, 60, 218, 66), 'minimap-panel': box(262, 6, 122, 122),
    'minimap-dock': box(236, 128, 148, 72), quickbar: box(276, 208, 46, 44), sidepanel: box(328, 208, 56, 62),
  };
  const at = placeLane(b, 390, 'phone');
  assert.ok(at.left + at.width <= 236 - 6, `ends at ${at.left + at.width}, before the travel dock at 236`);
  assert.ok(at.width >= 200, 'still a usable width');
});

test('the quick bar folds on phones, the Bag clears the orb labels, level-ups merge', () => {
  const qol = readFileSync(new URL('../styles/qol.css', import.meta.url), 'utf8');
  assert.match(qol, /#quickbar:not\(\.open\) \.qb-slot, #quickbar:not\(\.open\) \.qb-edit \{ display: none; \}/);
  const qb = readFileSync(new URL('../src/ui/quickbar.js', import.meta.url), 'utf8');
  assert.match(qb, /qb-more/);
  const compact = readFileSync(new URL('../styles/compact.css', import.meta.url), 'utf8');
  assert.match(compact, /#sidepanel\.collapsed \{ top: calc\(202px \+ var\(--sa-t\)\); \}/);
  const xp = readFileSync(new URL('../src/ui/xpdisplay.js', import.meta.url), 'utf8');
  assert.match(xp, /this\._lvlToasts\[skill\] = \{ el: t, from: first, timer \}/);
});
