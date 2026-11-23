// The side panel's size (src/ui/panelsize.js, the panel-size block at the end
// of styles/compact.css and the rows in Settings → Display): the steps, the
// cap that keeps a bigger panel clear of the HUD, the saved choice, and the
// CSS that applies it. No browser here: the pure helpers are run, and the CSS
// and the settings code are checked as text.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PANEL_STEPS, PANEL_MAX, panelScaleCap, clampScale, snapScale, stepScale, scaleName,
  loadPanelPrefs, savePanelPrefs, applyPanelScale, PanelSizer,
} from '../src/ui/panelsize.js';
import { placeLane } from '../src/ui/noticelane.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};

test('three steps, Normal to Extra large, and a free drag up to 1.6x', () => {
  assert.deepEqual(PANEL_STEPS.map((s) => [s.name, s.s]), [['Normal', 1], ['Large', 1.25], ['Extra large', 1.5]]);
  assert.equal(PANEL_MAX, 1.6);
  assert.equal(clampScale(3), 1.6);
  assert.equal(clampScale(0.5), 1, 'never smaller than Normal');
  assert.equal(clampScale('nonsense'), 1);
  assert.equal(clampScale(1.5, 1.2), 1.2, 'held to the cap');
  assert.equal(snapScale(1.28), 1.25, 'a drag that ends near a step lands on it');
  assert.equal(snapScale(1.38), 1.38, 'between steps it stays where it was let go');
  assert.equal(stepScale(1, 1), 1.25);
  assert.equal(stepScale(1.38, 1), 1.5);
  assert.equal(stepScale(1.5, 1), PANEL_MAX, 'A+ past Extra large goes to the largest');
  assert.equal(stepScale(1.5, 1, true), 1, 'the Settings chip goes round to Normal');
  assert.equal(stepScale(1.38, -1), 1.25);
  assert.equal(stepScale(1, -1), 1);
  assert.deepEqual([1, 1.25, 1.5, 1.4].map(scaleName), ['Normal', 'Large', 'Extra large', '140%']);
});

test('the cap keeps a bigger panel clear of the minimap and the bottom-centre column', () => {
  // The common desktop windows: Extra large fits all three; 1366 stops just short of 1.6.
  for (const [vw, vh] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    const cap = panelScaleCap(vw, vh);
    assert.ok(cap >= 1.5, `${vw}x${vh}: Extra large fits (cap ${cap})`);
    // Its left edge stays right of the quick bar (centred, 304px wide) ...
    assert.ok(vw - 10 - 320 * cap >= vw / 2 + 152 + 10, `${vw}x${vh}: clear of the quick bar`);
    // ... and its header and five tabs fit under the minimap and the XP counter.
    assert.ok(vh - 10 - 316 * cap >= 272 - 1, `${vw}x${vh}: clear of the minimap and the XP counter`);
  }
  assert.ok(panelScaleCap(1366, 768) < PANEL_MAX);
  assert.equal(panelScaleCap(1920, 1080), PANEL_MAX);
  // Smaller windows get less, never less than Normal.
  const small = panelScaleCap(1100, 700);
  assert.ok(small > 1 && small < 1.25, `1100x700: ${small}`);
  assert.ok(panelScaleCap(1440, 600) < 1.2, 'a short window is held by its height');
  assert.equal(panelScaleCap(390, 844), 1, 'a phone: Normal');
  assert.ok(panelScaleCap(950, 900, 244) > panelScaleCap(950, 900, 320), 'a narrower Normal width can grow further');
});

test('the choice is saved on this device, and a broken or blocked store is harmless', () => {
  const store = memStore();
  assert.deepEqual(loadPanelPrefs(store), { s: 1, t: false }, 'nothing saved: Normal');
  savePanelPrefs({ s: 1.5, t: true }, store);
  assert.deepEqual(loadPanelPrefs(store), { s: 1.5, t: true });
  store.setItem('ss_ui_panel', '{not json');
  assert.deepEqual(loadPanelPrefs(store), { s: 1, t: false });
  store.setItem('ss_ui_panel', '{"s": 9}');
  assert.equal(loadPanelPrefs(store).s, PANEL_MAX, 'an out-of-range size is held to the largest');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadPanelPrefs(blocked), { s: 1, t: false });
  assert.doesNotThrow(() => savePanelPrefs({ s: 1.25, t: false }, blocked));
});

test('the sizer remembers its size headless, and puts --ps and the classes on the panel', () => {
  const store = memStore();
  const was = globalThis.localStorage;
  globalThis.localStorage = store;
  try {
    const sizer = new PanelSizer(null, null);   // no page (the tests): no controls, no throw
    sizer.set(1.25);
    assert.equal(sizer.scale, 1.25);
    assert.equal(sizer.label(), 'Large');
    sizer.step(1);
    assert.equal(sizer.chosen, 1.5);
    sizer.step(1, true);
    assert.equal(sizer.chosen, 1, 'Settings goes round');
    sizer.setBigText(true);
    assert.deepEqual(JSON.parse(store.getItem('ss_ui_panel')), { s: 1, t: 1 });
    assert.equal(new PanelSizer(null, null).bigText, true, 'a new page starts where the last left off');
  } finally { globalThis.localStorage = was; }
  // The stand-in panel: a style with setProperty and a classList.
  const props = {}, cls = new Set();
  const panel = { style: { setProperty: (k, v) => { props[k] = v; } }, classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) } };
  applyPanelScale(panel, 1.5, false);
  assert.equal(props['--ps'], '1.5');
  assert.ok(cls.has('ps-big') && !cls.has('menu-big'));
  applyPanelScale(panel, 1, true);
  assert.ok(!cls.has('ps-big'), 'Normal: the zoom rules stay off');
  assert.ok(cls.has('menu-big'), 'larger text in menus');
});

test('compact.css zooms the panel by --ps on mouse screens only, and touch screens get larger text', () => {
  const css = read('styles/compact.css');
  const at = css.indexOf('/* ---------- Side panel size');
  assert.ok(at > 0, 'the panel-size block is in compact.css');
  const block = css.slice(at);
  // Zoom only where the browser has it, and only for a mouse on a wide window.
  assert.match(block, /@supports \(zoom: 2\) \{\s*@media \(min-width: 900px\) and \(hover: hover\) and \(pointer: fine\) \{/);
  assert.match(block, /#sidepanel\.ps-big \{ zoom: var\(--ps, 1\); right: calc\(10px \/ var\(--ps, 1\)\); bottom: calc\(10px \/ var\(--ps, 1\)\); \}/);
  assert.match(block, /max-height: calc\(\(100dvh - 282px\) \/ var\(--ps, 1\)\)/, 'it stops under the minimap and the XP counter');
  // Touch screens: no zoom (iPhone Safari hit-tests it off), but larger text and cells.
  const touch = block.slice(block.indexOf('@media (pointer: coarse) and (hover: none) {'));
  assert.doesNotMatch(touch, /zoom/);
  assert.match(touch, /#sidepanel\.menu-big:not\(\.collapsed\) #inventory-grid \{ grid-template-columns: repeat\(auto-fill, minmax\(58px, 1fr\)\); \}/);
  // The controls show only where they work.
  assert.match(block, /\.ps-btns, \.ps-grip, #settings-panel \.set-ps-desk \{ display: none; \}/);
  assert.match(block, /@media not all and \(pointer: coarse\), not all and \(hover: none\) \{ #settings-panel \.set-ps-touch \{ display: none; \} \}/);
});

test('Settings → Display has the Side panel size chip and the Larger text switch', () => {
  const ui = read('src/ui/ui.js');
  const display = ui.slice(ui.indexOf("sec('Display');"), ui.indexOf("sec('Gameplay');"));
  assert.match(display, /cycle\('Side panel size', \(\) => ps\.label\(\), \(\) => ps\.step\(1, true\)\)/);
  assert.match(display, /size\.classList\.add\('set-ps-desk'\)/);
  assert.match(display, /row\('Larger text in menus', \(\) => ps\.bigText, \(\) => ps\.setBigText\(!ps\.bigText\)\)\.classList\.add\('set-ps-touch'\)/);
  assert.match(ui, /this\.panelSize = new PanelSizer\(this\.el\.sidepanel, this\.el\.panelHead\);/);
});

test('the notice lane stops short of a big side panel on a desktop', () => {
  const rect = (left, top, w, h) => ({ left, top, width: w, height: h, right: left + w, bottom: top + h });
  const base = { 'region-label': rect(590, 8, 186, 33) };
  const normal = placeLane({ ...base, sidepanel: rect(1036, 374, 320, 384) }, 1366, 'desk');
  assert.equal(normal.width, 360, 'a Normal panel is far away');
  const big = placeLane({ ...base, sidepanel: rect(847, 246, 509, 512) }, 1366, 'desk');
  assert.ok(big.left + big.width <= 847 - 8, `the lane ends before the panel (${big.left}+${big.width})`);
  assert.equal(big.left, normal.left, 'its left edge stays');
});
