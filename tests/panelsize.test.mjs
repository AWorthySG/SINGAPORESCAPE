// The side panel's size (src/ui/panelsize.js, the panel-size block at the end
// of styles/compact.css and the rows in Settings → Display): the steps make
// the panel's WINDOW bigger (its width and its body's height), not its text;
// the fit that keeps it clear of the HUD; the saved choice and the move from
// #579's zoom; and the CSS that applies it. No browser here: the pure helpers
// are run, and the CSS and the settings code are checked as text.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PANEL_STEPS, PANEL_FULL, PANEL_MAX_W, panelFit, resolvePanelSize, stepIndex, stepSize, sizeName,
  snapSize, cleanW, cleanH, migrateZoom, loadPanelPrefs, savePanelPrefs, applyPanelSize, PanelSizer,
} from '../src/ui/panelsize.js';
import { placeLane } from '../src/ui/noticelane.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const N = { w: 0, h: 0 }, L = { w: 400, h: 640 }, XL = { w: 480, h: 760 }, FULL = { w: 520, h: PANEL_FULL };

test('four steps that grow the window: Normal, Large, Extra large, Full height', () => {
  assert.deepEqual(PANEL_STEPS.map((s) => [s.name, s.w, s.h]),
    [['Normal', 0, 0], ['Large', 400, 640], ['Extra large', 480, 760], ['Full height', 520, PANEL_FULL]]);
  // Each step is bigger than the last both ways.
  for (let i = 1; i < PANEL_STEPS.length; i++) {
    assert.ok(PANEL_STEPS[i].w > PANEL_STEPS[i - 1].w && PANEL_STEPS[i].h > PANEL_STEPS[i - 1].h);
  }
  assert.deepEqual(stepSize(N, 1), L);
  assert.deepEqual(stepSize(L, 1), XL);
  assert.deepEqual(stepSize(XL, 1), FULL);
  assert.deepEqual(stepSize(FULL, 1), FULL, '+ stops at Full height');
  assert.deepEqual(stepSize(FULL, 1, true), N, 'the Settings chip goes round to Normal');
  assert.deepEqual(stepSize(L, -1), N);
  assert.deepEqual(stepSize(N, -1), N);
  // A dragged size steps to the step past it, or back to the one under it.
  assert.deepEqual(stepSize({ w: 430, h: 700 }, 1), XL);
  assert.deepEqual(stepSize({ w: 430, h: 700 }, -1), L);
  assert.equal(stepIndex({ w: 430, h: 700 }), -1);
  assert.deepEqual([N, L, XL, FULL, { w: 430, h: 700 }].map(sizeName), ['Normal', 'Large', 'Extra large', 'Full height', 'Custom']);
  // Saved numbers kept sane.
  assert.equal(cleanW('nonsense'), 0);
  assert.equal(cleanW(-5), 0);
  assert.equal(cleanW(5000), PANEL_MAX_W);
  assert.equal(cleanH(50), 240, 'a body never shorter than 240px');
  assert.equal(cleanH(1e9), PANEL_FULL);
});

test('the fit keeps a bigger panel clear of the minimap and the bottom-centre column', () => {
  // [window, the widest it can be, the tallest its body can be]
  const cases = [[1366, 768, 509, 450], [1440, 900, 546, 582], [1920, 1080, 720, 762], [2000, 1300, 720, 982]];
  for (const [vw, vh, w, h] of cases) {
    const fit = panelFit(vw, vh);
    assert.deepEqual(fit, { w, h }, `${vw}x${vh}`);
    // Its left edge stays right of the quick bar (centred, 304px wide) ...
    assert.ok(vw - 10 - fit.w >= vw / 2 + 152 + 10, `${vw}x${vh}: clear of the quick bar`);
    // ... and its header and body fit under the minimap, orbs and XP counter.
    assert.ok(vh - 10 - 36 - fit.h >= 272, `${vw}x${vh}: clear of the minimap and the XP counter`);
  }
  assert.equal(panelFit(390, 844).w, 320, 'never narrower than Normal');
  assert.equal(panelFit(950, 900, 244).w, 301, 'a narrower window: the room right of the quick bar');
});

test('each step at the common desktop windows: bigger than Normal, cut where the window is small', () => {
  const at = (vw, vh, size) => resolvePanelSize(size, panelFit(vw, vh), 320);
  // 2000x1300 (the owner's window): every step fits; Full height takes the whole free column.
  assert.deepEqual(at(2000, 1300, N), { w: 320, h: 0, big: false, cut: false }, 'Normal: the CSS as it was');
  assert.deepEqual(at(2000, 1300, L), { w: 400, h: 640, big: true, cut: false });
  assert.deepEqual(at(2000, 1300, XL), { w: 480, h: 760, big: true, cut: false });
  assert.deepEqual(at(2000, 1300, FULL), { w: 520, h: 982, big: true, cut: false });
  // 1920x1080: Extra large just fits; Full height is all the room there is.
  assert.deepEqual(at(1920, 1080, XL), { w: 480, h: 760, big: true, cut: false });
  assert.deepEqual(at(1920, 1080, FULL), { w: 520, h: 762, big: true, cut: false });
  // 1440x900 and 1366x768: shorter, so the taller steps are cut to the free height.
  assert.deepEqual(at(1440, 900, L), { w: 400, h: 582, big: true, cut: true });
  assert.deepEqual(at(1440, 900, FULL), { w: 520, h: 582, big: true, cut: false }, 'Full height is never "cut"');
  assert.deepEqual(at(1366, 768, XL), { w: 480, h: 450, big: true, cut: true });
  assert.deepEqual(at(1366, 768, FULL), { w: 509, h: 450, big: true, cut: true }, 'and too narrow for its width');
  // Normal's body at 1366x768 is min(520, 768 - 420) = 348: Large is still taller.
  assert.ok(at(1366, 768, L).h > 348);
  // A drag past the window holds at the fit; a width-only drag keeps Normal's height.
  assert.deepEqual(at(1366, 768, { w: 700, h: 0 }), { w: 509, h: 0, big: true, cut: true });
});

test('a drag settles on a step, Normal or Full height when it ends near one', () => {
  const fit = panelFit(2000, 1300);
  assert.deepEqual(snapSize({ w: 408, h: 632 }, fit), L);
  assert.deepEqual(snapSize({ w: 330, h: 0 }, fit), N, 'back near Normal\'s width');
  assert.deepEqual(snapSize({ w: 520, h: 975 }, fit), FULL, 'at the top of the free room');
  assert.deepEqual(snapSize({ w: 600, h: 975 }, fit), { w: 600, h: PANEL_FULL });
  assert.deepEqual(snapSize({ w: 430, h: 700 }, fit), { w: 430, h: 700 }, 'between steps it stays where it was let go');
});

test('the choice is saved on this device, an old zoom moves over, and a broken store is harmless', () => {
  const store = memStore();
  assert.deepEqual(loadPanelPrefs(store), { w: 0, h: 0, t: false }, 'nothing saved: Normal');
  savePanelPrefs({ w: 480, h: 760, t: true }, store);
  assert.deepEqual(JSON.parse(store.getItem('ss_ui_panel')), { v: 2, w: 480, h: 760, t: 1 });
  assert.deepEqual(loadPanelPrefs(store), { w: 480, h: 760, t: true });
  // #579 saved a zoom { s, t }: it becomes the window step nearest it, its text switch kept.
  for (const [s, want] of [[1, N], [1.25, L], [1.38, XL], [1.5, XL], [1.6, XL], ['x', N]]) {
    store.setItem('ss_ui_panel', JSON.stringify({ s, t: 1 }));
    assert.deepEqual(loadPanelPrefs(store), { ...want, t: true }, `zoom ${s}`);
    assert.deepEqual(migrateZoom(s), want);
  }
  store.setItem('ss_ui_panel', '{not json');
  assert.deepEqual(loadPanelPrefs(store), { w: 0, h: 0, t: false });
  store.setItem('ss_ui_panel', '{"v":2,"w":99999,"h":-3}');
  assert.deepEqual(loadPanelPrefs(store), { w: PANEL_MAX_W, h: 0, t: false }, 'out-of-range numbers are held');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadPanelPrefs(blocked), { w: 0, h: 0, t: false });
  assert.doesNotThrow(() => savePanelPrefs({ w: 400, h: 640, t: false }, blocked));
});

test('the sizer remembers its size headless, and puts the sizes and classes on the panel', () => {
  const store = memStore();
  const was = globalThis.localStorage;
  globalThis.localStorage = store;
  try {
    const sizer = new PanelSizer(null, null);   // no page (the tests): no controls, no throw
    sizer.set(L);
    assert.deepEqual(sizer.chosen, L);
    assert.equal(sizer.label(), 'Large');
    sizer.step(1);
    assert.deepEqual(sizer.chosen, XL);
    sizer.step(1, true);
    sizer.step(1, true);
    assert.deepEqual(sizer.chosen, N, 'Settings goes round');
    sizer.set({ w: 430, h: 700 });
    assert.equal(sizer.label(), 'Custom (430 wide, 700 tall)');
    sizer.set(N);
    sizer.setBigText(true);
    assert.deepEqual(JSON.parse(store.getItem('ss_ui_panel')), { v: 2, w: 0, h: 0, t: 1 });
    assert.equal(new PanelSizer(null, null).bigText, true, 'a new page starts where the last left off');
  } finally { globalThis.localStorage = was; }
  // The stand-in panel: a style with setProperty / removeProperty and a classList.
  const props = {}, cls = new Set();
  const panel = {
    style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } },
    classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) },
  };
  applyPanelSize(panel, { w: 480, h: 760, big: true }, 320, false);
  assert.deepEqual(props, { '--ps-w': '480px', '--ps-dw': '160px', '--ps-h': '760px' });
  assert.ok(cls.has('ps-big') && cls.has('ps-tall') && !cls.has('menu-big'));
  assert.ok(!Object.keys(props).some((k) => k === '--ps'), 'no zoom factor any more');
  applyPanelSize(panel, { w: 320, h: 0, big: false }, 320, true);
  assert.ok(!cls.has('ps-big') && !cls.has('ps-tall'), 'Normal: the size rules stay off');
  assert.equal(props['--ps-h'], undefined);
  assert.ok(cls.has('menu-big'), 'bigger menu text');
});

test('compact.css sizes the window, not the text: no zoom, the bag keeps its cell size', () => {
  const css = read('styles/compact.css');
  const at = css.indexOf('/* ---------- Side panel size');
  assert.ok(at > 0, 'the panel-size block is in compact.css');
  const block = css.slice(at);
  const rules = block.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /zoom|--ps[,)]|@supports/, 'no CSS zoom left');
  assert.doesNotMatch(rules, /font-size[^;]*--ps/, 'the text never follows the size');
  // Mouse screens on a wide window: the width, the body's height, and the panel stops under the minimap.
  assert.match(rules, /@media \(min-width: 900px\) and \(hover: hover\) and \(pointer: fine\) \{/);
  assert.match(rules, /#sidepanel\.ps-big:not\(\.collapsed\) \{ width: var\(--ps-w, var\(--panel-w\)\); max-height: calc\(100dvh - 282px\); \}/);
  assert.match(rules, /#sidepanel\.ps-tall:not\(\.collapsed\) #panel-body \{ height: min\(var\(--ps-h\), calc\(100dvh - 318px\)\); \}/);
  // The bag: Normal's cell size (a quarter of Normal's row), so a wider panel holds more columns.
  assert.match(rules, /#sidepanel\.ps-big:not\(\.collapsed\) #inventory-grid \{\s*grid-template-columns: repeat\(auto-fill, calc\(\(100% - var\(--ps-dw, 0px\) - 15px\) \/ 4\)\);/);
  // Grips for the width, the height and both.
  for (const g of ['ps-grip', 'ps-grip-top', 'ps-grip-corner']) assert.match(rules, new RegExp(`\\.${g} \\{ position: absolute;`));
  // Touch screens: bigger menu text, only when picked (.menu-big).
  const touch = rules.slice(rules.indexOf('@media (pointer: coarse) and (hover: none) {'));
  assert.match(touch, /#sidepanel\.menu-big:not\(\.collapsed\) #inventory-grid \{ grid-template-columns: repeat\(auto-fill, minmax\(58px, 1fr\)\); \}/);
  // The controls show only where they work.
  assert.match(rules, /\.ps-btns, \.ps-grip, \.ps-grip-top, \.ps-grip-corner, #settings-panel \.set-ps-desk \{ display: none; \}/);
  assert.match(rules, /@media not all and \(pointer: coarse\), not all and \(hover: none\) \{ #settings-panel \.set-ps-touch \{ display: none; \} \}/);
});

test('Settings → Display has the Side panel size chip and the Bigger menu text switch', () => {
  const ui = read('src/ui/ui.js');
  const display = ui.slice(ui.indexOf("sec('Display');"), ui.indexOf("sec('Gameplay');"));
  assert.match(display, /cycle\('Side panel size', \(\) => ps\.label\(\), \(\) => ps\.step\(1, true\)\)/);
  assert.match(display, /size\.classList\.add\('set-ps-desk'\)/);
  assert.match(display, /row\('Bigger menu text', \(\) => ps\.bigText, \(\) => ps\.setBigText\(!ps\.bigText\)\)\.classList\.add\('set-ps-touch'\)/);
  assert.doesNotMatch(display, /Larger text in menus/);
  assert.match(ui, /this\.panelSize = new PanelSizer\(this\.el\.sidepanel, this\.el\.panelHead\);/);
  assert.doesNotMatch(ui, /currentCSSZoom/, 'nothing measures a zoom any more');
});

test('the notice lane stops short of a big side panel on a desktop', () => {
  const rect = (left, top, w, h) => ({ left, top, width: w, height: h, right: left + w, bottom: top + h });
  const base = { 'region-label': rect(590, 8, 186, 33) };
  const normal = placeLane({ ...base, sidepanel: rect(1036, 374, 320, 384) }, 1366, 'desk');
  assert.equal(normal.width, 360, 'a Normal panel is far away');
  const big = placeLane({ ...base, sidepanel: rect(847, 282, 509, 476) }, 1366, 'desk');
  assert.ok(big.left + big.width <= 847 - 8, `the lane ends before the panel (${big.left}+${big.width})`);
  assert.equal(big.left, normal.left, 'its left edge stays');
});
