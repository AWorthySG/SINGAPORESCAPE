// Pop and fade (the "Pop and fade" block at the end of styles/compact.css,
// copyCanvases in src/ui/uifx.js): windows and the side panel pop open and
// leave with a quick fade, on the compositor only, and stay still with
// reduced motion (the system's or Settings'). No browser here, so the CSS is
// checked as text and the canvas copy against stand-ins.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { copyCanvases } from '../src/ui/uifx.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[^]*?\*\//g, '');
const compact = read('styles/compact.css');
const block = strip(compact.slice(compact.indexOf('/* ---------- Pop and fade: windows and the side panel')));

test('the pop block is there, at the end, and moves only transform and opacity', () => {
  assert.ok(block.length > 200, 'the block exists');
  for (const [, name, body] of block.matchAll(/@keyframes (\w+) \{([^]*?\})\s*\}/g)) {
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    for (const p of props) assert.ok(['transform', 'opacity'].includes(p), `${name} moves only transform/opacity (found ${p})`);
  }
  // Every animation it names is one of its own keyframes or an older one.
  for (const k of ['uiSheetPop', 'uiSideSheetPop', 'uiPanelPop', 'uiSheetAway', 'uiSideSheetAway']) assert.match(block, new RegExp(`@keyframes ${k} \\{`));
  // No bare touch block, and not the phone block's exact header (tests/layout.test.mjs reads main.css's by its text).
  assert.doesNotMatch(block, /@media \(pointer: coarse\)\s*\{/);
  assert.ok(!block.includes('@media (pointer: coarse) and (max-width: 540px) {'));
  // Braces balance.
  assert.equal((block.match(/\{/g) || []).length, (block.match(/\}/g) || []).length);
});

test('windows and the side panel pop open on the middle timing and leave with a quick fade', () => {
  const phone = block.slice(block.indexOf('@media (max-width: 540px) and (pointer: coarse) {'));
  assert.match(phone, /#sidepanel:not\(\.collapsed\)[^{]*#modal-window[^{]*\{\s*animation-name: uiSheetPop; animation-duration: var\(--dur-2\);/);
  assert.match(phone, /\.modal-ghost #modal-window, #sidepanel\.ui-ghost\.sheet-ghost \{ animation: uiSheetAway var\(--dur-1\) var\(--ease-exit\) forwards; \}/);
  const land = block.slice(block.indexOf('@media (pointer: coarse) and (max-height: 500px) {'));
  assert.match(land, /animation-name: uiSideSheetPop; animation-duration: var\(--dur-2\);/);
  const mouse = block.slice(block.indexOf('@media (prefers-reduced-motion: no-preference) and (pointer: fine) {'));
  assert.match(mouse, /#modal-window \{ animation-duration: var\(--dur-2\); \}/);
  assert.match(mouse, /#sidepanel:not\(\.collapsed\) \{ animation: uiPanelPop var\(--dur-2\) var\(--ease-pop\);/);
  // The pop overshoots in scale only, so a bottom sheet never lifts off the screen's foot.
  const pop = block.slice(block.indexOf('@keyframes uiSheetPop'));
  assert.match(pop, /65% \{ opacity: 1; transform: translateY\(0\) scale\(1\.0\d+\); \}/);
  // The tokens it leans on: 180 ms to open, 120 ms to leave.
  assert.match(compact, /--dur-1: 120ms; --dur-2: 180ms;/);
});

test('reduced motion, the system\'s or Settings\', keeps windows and the panel still', () => {
  const sel = ':is(#modal-window, #sidepanel, .modal-ghost, .modal-ghost #modal-window) { animation: none; }';
  assert.ok(block.includes(`@media (prefers-reduced-motion: reduce) {\n  ${sel}\n}`), 'the system setting');
  assert.ok(block.includes(`body.reduce-motion ${sel}`), 'Settings > Reduce motion');
  // ...on top of the blanket rules that cut every duration.
  const main = read('styles/main.css');
  assert.match(main, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{\s*transition-duration: 0\.01ms !important;/);
  assert.match(main, /body\.reduce-motion \*, body\.reduce-motion \*::before, body\.reduce-motion \*::after \{/);
  // The opening pops only play where motion is allowed: on mouse screens inside no-preference.
  assert.match(block, /@media \(prefers-reduced-motion: no-preference\) and \(pointer: fine\) \{\s*#modal-window/);
});

test('one press each: the panel tabs and fold buttons no longer sink twice', () => {
  assert.match(block, /:is\(#panel-tabs \.tab-btn, #panel-body \.subtab-btn, #panel-body \.inv-tab, \.close-x\):active:not\(:disabled\) \{ transform: none; \}/);
  assert.match(block, /#quest-tracker :is\(\.trk-fold, \.trk-more\):active \{ scale: \.96; \}/);
});

test('a closing copy keeps its canvases\' pictures (cloneNode copies none)', () => {
  const canvas = (w, h) => {
    const c = { width: w, height: h, drawn: [] };
    c.getContext = () => ({ drawImage: (src, x, y) => c.drawn.push([src, x, y]) });
    return c;
  };
  const holder = (cs) => ({ querySelectorAll: (s) => (s === 'canvas' ? cs : []) });
  const a = [canvas(320, 200), canvas(0, 0), canvas(64, 64)];
  const b = [canvas(300, 150), canvas(300, 150), canvas(300, 150)];
  assert.equal(copyCanvases(holder(a), holder(b)), 2);
  assert.deepEqual([b[0].width, b[0].height], [320, 200]);
  assert.equal(b[0].drawn[0][0], a[0]);
  assert.equal(b[1].drawn.length, 0, 'an empty canvas is left alone');
  assert.equal(b[2].drawn[0][0], a[2]);
  // Capped, and safe with nothing to copy or a canvas that throws.
  const many = Array.from({ length: 40 }, () => canvas(8, 8));
  assert.equal(copyCanvases(holder(many), holder(Array.from({ length: 40 }, () => canvas(1, 1))), 24), 24);
  assert.equal(copyCanvases(null, holder(b)), 0);
  const bad = canvas(5, 5); bad.getContext = () => { throw new Error('tainted'); };
  assert.equal(copyCanvases(holder([canvas(5, 5)]), holder([bad])), 0);
  // Both exits use it.
  assert.match(read('src/ui/uifx.js'), /copyCanvases\(overlay, ghost\);\n\s*overlay\.after\(ghost\);/);
  assert.match(read('src/ui/motion.js'), /const c = v\.cloneNode\(true\); copyCanvases\(v, c\);/);
});
