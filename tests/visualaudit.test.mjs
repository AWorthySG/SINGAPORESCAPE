// The visual audit's fixes (phone first): title cards kept clear of a phone's
// HUD column, world map lettering sized for the screen, the minimap's long area
// names set smaller, and the CSS for the standing pill, the chat, the empty
// blessing slot and the tip during a story scene. The styles are checked as
// text, as tests/layout.test.mjs does.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { titleRoom, arrivalSize, PHONE_HUD_COLUMN } from '../src/render/postcard.js';
import { UI, mapLabelPx, MAP_GROVE_NAMES_K, MINIMAP_LONG_NAME } from '../src/ui/ui.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('a title card keeps left of a portrait phone\'s HUD column, and has the whole width elsewhere', () => {
  // iPhone 13 upright: 390 x 664 CSS px at zoom 1.
  const phone = titleRoom(390, 664, 1);
  assert.ok(phone.cx + phone.w / 2 <= 390 - PHONE_HUD_COLUMN + 0.01, 'its right end stops at the HUD column');
  assert.ok(phone.cx - phone.w / 2 >= 0, 'and its left end on screen');
  assert.ok(phone.cx < 195, 'so it centres left of the middle');
  // The arrival postcard baked for that room fits inside it (the renderer adds back its 24px margin).
  assert.ok(arrivalSize(Math.min(390, phone.w + 24)).w + 16 <= phone.w + 24);
  // A zoomed-in phone (view units are CSS px over the zoom) keeps the same column clear.
  const zoomed = titleRoom(390 / 1.2, 664 / 1.2, 1.2);
  assert.ok((zoomed.cx + zoomed.w / 2) * 1.2 <= 390 - PHONE_HUD_COLUMN + 0.01);
  // A desktop (1440 x 900 at the camera's 1.875 zoom), a tablet and a phone held sideways: centred, full width.
  for (const [vw, vh, z] of [[768, 480, 1.875], [820, 1180, 1], [844, 390, 1]]) {
    assert.deepEqual(titleRoom(vw, vh, z), { cx: vw / 2, w: vw });
  }
});

test('the renderer draws its title cards in that room', () => {
  const src = read('src/render/renderer.js');
  assert.match(src, /titleRoom\(vw, vh, this\.game\.camera\?\.zoom \|\| 1\)/);
  assert.match(src, /this\.postcards\.draw\(ctx, tc, vw, vh, a, room\) \|\| this\._titlePlaque\(tc, room, y, size\)/);
});

test('world map lettering is sized for the screen, never under its old size', () => {
  // Desktop: the 1080px canvas shown at 620px (k = 1.74); a phone at about 3.1.
  assert.equal(mapLabelPx(8.5, 1.74, 9), 15);
  assert.equal(mapLabelPx(8.5, 3.1, 9), 26);
  assert.equal(mapLabelPx(8.5, 0.5, 9), 9, 'the old size is the floor');
  assert.ok(MAP_GROVE_NAMES_K > 1.74 && MAP_GROVE_NAMES_K < 3.1, 'a desktop names its groves, a phone keeps only their dots');
  const src = read('src/ui/ui.js');
  // Zone names go on last, over every dot, and stay inside the map's edges.
  const map = src.slice(src.indexOf('openWorldMap(focus = null) {'));
  assert.ok(map.indexOf('// Zone labels last') > map.indexOf('for (const g of game.world.groves'));
  assert.match(map, /Math\.min\(cnv\.width - w2, Math\.max\(w2,/);
});

test('a long area name under the minimap is marked to be set smaller', () => {
  const box = () => { const on = new Set(); return { on, classList: { toggle(c, v) { if (v) on.add(c); else on.delete(c); } } }; };
  const ui = { el: { region: { classList: { toggle() {} } }, minimapRegion: box() } };
  UI.prototype.setRegion.call(ui, 'Kampong Glam', 0);
  assert.ok(!ui.el.minimapRegion.on.has('long'));
  UI.prototype.setRegion.call(ui, 'Sungei Buloh Wetlands', 0);
  assert.ok(ui.el.minimapRegion.on.has('long'));
  UI.prototype.setRegion.call(ui, 'Chinatown', 3);   // "Chinatown (Lvl 3)" is just over
  assert.ok('Chinatown (Lvl 3)'.length > MINIMAP_LONG_NAME && ui.el.minimapRegion.on.has('long'));
  const css = read('styles/minimap.css');
  assert.match(css, /#minimap-panel #minimap-region\.long \{ font-size: var\(--fs-xs\);/);
  assert.match(css, /@media \(max-width: 540px\) \{ #minimap-panel #minimap-region\.long \{ font-size: var\(--fs-cap\);/);
});

test('phone CSS: the standing pill clears the quick-use slot, the chat shows its lines, the slot and tip stay tidy', () => {
  const compact = read('styles/compact.css');
  assert.match(compact, /@media \(pointer: coarse\) and \(max-width: 540px\) \{\s*#rep-pill \{ left: calc\(12px[^}]*transform: none; max-width: calc\(100vw - 166px\)/);
  const main = read('styles/main.css');
  assert.match(main, /\.chat-tab \{ display: flex; align-items: center; justify-content: center; padding-block: 0; \}/);
  assert.match(main, /#chatbox:not\(\.collapsed\) \{\s*left: calc\(6px \+ var\(--sa-l\)\);[^}]*height: 172px;/);
  const bless = read('styles/blessings.css');
  assert.match(bless, /#prayer-panel \.bl-slot\.empty \{ min-height: 52px; justify-content: flex-end;/);
  assert.match(read('styles/story.css'), /body:has\(\.story-scene:not\(\.hidden\)\) #notice-lane \.nl-tip \{ visibility: hidden; \}/);
});
