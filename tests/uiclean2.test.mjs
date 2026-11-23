// UI clean-up, round 2: Settings in grouped cards of switch rows, a shorter
// phone sheet (no title row, Bag | Gear and the filters in one strip, the Bag
// opening full), the quick actions grid, the Monster Codex opening on what
// you have met, dialogue farewells, bank pins only where chosen, one sticker
// family for banners and toasts, and one close button. Headless: a small
// stand-in DOM where a method builds elements, the CSS checked as text.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { UI, farewellSplit } from '../src/ui/ui.js';
import { codexListHTML, defaultCodexState, activeFilterCount } from '../src/ui/codexui.js';
import { markKept } from '../src/ui/bankkeepui.js';
import { toggleKeep } from '../src/game/bankkeep.js';
import { qbLabel } from '../src/ui/quickbar.js';
import { cardHTML } from '../src/ui/noticelane.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
/** A UI stand-in: the real methods, no-ops for everything else. */
function uiFor(g, el = {}, own = {}) {
  const t = { game: g, el, ...own };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : typeof UI.prototype[k] === 'function' ? UI.prototype[k].bind(o) : () => {}) });
}

// A small element: children, classes, attributes, listeners, and a
// querySelector that hands back one child per selector (made on first ask).
function el(tag = 'div') {
  const cls = new Set();
  const e = {
    tag, children: [], parentNode: null, attrs: {}, on: {}, sub: {}, title: '', hidden: false, dataset: {}, _text: '',
    get className() { return [...cls].join(' '); },
    set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
    classList: {
      add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)), contains: (c) => cls.has(c),
      toggle: (c, on) => { const want = on === undefined ? !cls.has(c) : !!on; if (want) cls.add(c); else cls.delete(c); return want; },
    },
    get textContent() { return this._text; }, set textContent(v) { this._text = String(v); },
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; }, get innerHTML() { return this._html || ''; },
    appendChild(c) { c.parentNode?.children && (c.parentNode.children = c.parentNode.children.filter((x) => x !== c)); c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, ref) { c.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); return c; },
    before(c) { const p = this.parentNode; if (!p) return; c.parentNode?.children && (c.parentNode.children = c.parentNode.children.filter((x) => x !== c)); c.parentNode = p; p.children.splice(p.children.indexOf(this), 0, c); },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
    addEventListener(t, fn) { (this.on[t] ||= []).push(fn); },
    click() { for (const fn of this.on.click || []) fn({ target: this }); },
    querySelector(sel) { return (this.sub[sel] ||= el()); },
    querySelectorAll() { return []; },
  };
  return e;
}
const walk = (n, out = []) => { out.push(n); for (const c of n.children) walk(c, out); return out; };

// ---------------- Settings ----------------
test('Settings: grouped cards of label + switch rows; every switch still works', () => {
  const g = newGame();
  g.audio = { muted: false, musicOn: true, ambienceOn: true, volume: 1, sfxVolume: 1, musicVolume: 1,
    unlock() {}, toggle() { this.muted = !this.muted; return this.muted; }, toggleMusic() { this.musicOn = !this.musicOn; return this.musicOn; },
    toggleAmbience() { this.ambienceOn = !this.ambienceOn; return this.ambienceOn; } };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = { createElement: el };
  try {
    const panel = el();
    const ui = uiFor(g, { settings: panel }, { updateDayNight() {}, _minimalHudTick() {}, _now: () => 0, lane: { dismissKind() {} }, perfOn: false, setPerf(on) { this.perfOn = on; } });
    UI.prototype._buildSettingsPanel.call(ui);
    const groups = panel.children.filter((c) => c.classList.contains('set-group'));
    assert.deepEqual(groups.map((x) => x.children[0].textContent), ['Account', 'Sound', 'Display', 'Gameplay', 'Help']);
    const sound = groups[1];
    assert.deepEqual(sound.children.filter((c) => c.className === 'set-slider').length, 3, 'the three volume sliders sit together in Sound');
    assert.ok(groups.every((x, i) => i === 1 || !x.children.some((c) => c.className === 'set-slider')));
    const rows = walk(panel).filter((n) => n.classList.contains('set-row'));
    const row = (label) => rows.find((r) => r.querySelector('.set-lbl').textContent === label);
    // Each switch: a role="switch" with aria-checked, its title the old pill's words.
    const sw = row('Sound');
    assert.equal(sw.attrs.role, 'switch');
    assert.equal(sw.attrs['aria-checked'], 'true');
    assert.equal(sw.title, 'Sound: On');
    sw.click();
    assert.equal(g.audio.muted, true);
    assert.equal(sw.attrs['aria-checked'], 'false');
    assert.equal(sw.title, 'Sound: Off');
    for (const [label, read] of [['Minimal HUD', () => !!g.minimalHud], ['Colour-blind friendly', () => !!g.colourBlind],
      ['Reduce motion', () => !!g.reduceMotion], ['Screen shake', () => g.screenShake !== false], ['Tips', () => g.tipsOn !== false],
      ['Tap outside a window to close it', () => g.tapClose !== false], ['Show performance', () => !!ui.perfOn], ['Music', () => g.audio.musicOn]]) {
      const r = row(label);
      assert.ok(r, `${label} has a row`);
      const was = read();
      r.click();
      assert.equal(read(), !was, `${label} flips`);
      assert.equal(r.classList.contains('on'), !was, `${label} shows it`);
    }
    // The few-choice rows show their value on a chip and move on with a tap.
    const labels = row('World labels');
    assert.ok(labels.classList.contains('set-cycle'));
    const before = labels.querySelector('.set-val').textContent;
    labels.click();
    assert.notEqual(labels.querySelector('.set-val').textContent, before);
    // Round 1's entries are kept: postcard mode and the time of day, in Display.
    const display = groups[2];
    assert.ok(display.children.some((c) => /^Postcard mode/.test(c.textContent)));
    assert.ok(display.children.some((c) => c.className === 'set-clock'));
    // A tip card's "Don't show tips" turns the Tips switch off where it shows.
    g.tipsOn = true; ui._tipsBtn.refresh();
    UI.prototype.tipsOff.call(ui);
    assert.equal(row('Tips').attrs['aria-checked'], 'false');
  } finally { if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document; }
  const css = strip(read('styles/compact.css'));
  assert.match(css, /#settings-panel \.set-row\.on \.ab-switch \{ background: var\(--aw-accent/);
});

// ---------------- Phone sheet ----------------
test('the phone sheet: the Bag and Gear open full; the bag filters join the Bag | Gear row on a touch phone', () => {
  const g = newGame();
  const panel = el();
  panel.classList.add('compact-ui');
  const ui = uiFor(g, { sidepanel: panel });
  ui._panelView = 'inventory';
  UI.prototype._fullForBag.call(ui);
  assert.ok(panel.classList.contains('sheet-full'), 'Bag: full');
  panel.classList.remove('sheet-full');
  ui._panelView = 'equipment';
  UI.prototype._fullForBag.call(ui);
  assert.ok(panel.classList.contains('sheet-full'), 'Gear: full');
  panel.classList.remove('sheet-full');
  ui._panelView = 'skills';
  UI.prototype._fullForBag.call(ui);
  assert.ok(!panel.classList.contains('sheet-full'), 'Skills: half, as before');
  ui._panelView = 'inventory';
  panel.classList.add('collapsed');
  UI.prototype._fullForBag.call(ui);
  assert.ok(!panel.classList.contains('sheet-full'), 'never while folded');
  panel.classList.remove('collapsed', 'compact-ui');
  UI.prototype._fullForBag.call(ui);
  assert.ok(!panel.classList.contains('sheet-full'), 'desktops and tablets: no snap at all');

  // The strip: the filters move into the sub-tab row and back out.
  const view = el(), row = el(), bar = el(), grid = el();
  view.appendChild(bar); view.appendChild(grid);
  const byId = { 'panel-subtabs': row, 'inventory-bar': bar, 'inventory-grid': grid };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document'), hadMM = globalThis.matchMedia;
  globalThis.document = { getElementById: (id) => byId[id] || null, createElement: el };
  globalThis.matchMedia = (q) => ({ matches: q.includes('coarse') });
  try {
    panel.classList.add('compact-ui');
    UI.prototype._renderSubtabs.call(ui, 'inventory', 'inventory');
    assert.equal(bar.parentNode, row, 'in the row on the Bag');
    assert.ok(row.classList.contains('with-bag'));
    UI.prototype._renderSubtabs.call(ui, 'inventory', 'equipment');
    assert.equal(bar.parentNode, view, 'back over the bag under Gear');
    assert.ok(view.children.indexOf(bar) < view.children.indexOf(grid));
    UI.prototype._renderSubtabs.call(ui, 'inventory', 'inventory');
    UI.prototype._renderSubtabs.call(ui, 'skills', 'skills');
    assert.equal(bar.parentNode, view, 'and before the row is redrawn for another tab');
    globalThis.matchMedia = () => ({ matches: false });
    UI.prototype._renderSubtabs.call(ui, 'inventory', 'inventory');
    assert.equal(bar.parentNode, view, 'a mouse keeps the old layout');
  } finally {
    if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document;
    if (hadMM) globalThis.matchMedia = hadMM; else delete globalThis.matchMedia;
  }
  const css = strip(read('styles/compact.css'));
  assert.match(css, /#sidepanel:not\(\.collapsed\) #panel-head \{ display: none; \}/, 'no title row on a phone sheet');
  assert.match(css, /#panel-subtabs\.with-bag \{[^}]*overflow-x: auto/, 'one sideways strip');
});

// ---------------- Quick actions ----------------
test('quick actions: one box that is no box on a desktop and a labelled grid on a phone', () => {
  assert.equal(qbLabel('Eat <best>'), '<span class="qb-lbl" aria-hidden="true">Eat &lt;best&gt;</span>');
  const src = read('src/ui/quickbar.js');
  assert.match(src, /html \+= '<div class="qb-pop">';/);
  assert.match(src, /document\.addEventListener\('pointerdown', \(e\) => \{\s*if \(el\.classList\.contains\('open'\) && !el\.contains\(e\.target\)\) el\.classList\.remove\('open'\);/, 'a tap elsewhere folds it');
  const css = strip(read('styles/compact.css'));
  assert.match(css, /#quickbar \.qb-pop \{ display: contents; \}/, 'desktop: the row as it was');
  assert.match(css, /#quickbar\.open \.qb-pop \{[^}]*position: absolute; top: calc\(100% \+ 8px\); right: -4px;[^}]*grid-template-columns: repeat\(2, 60px\)/, 'phone: two columns under the button, at the right edge');
});

// ---------------- Monster Codex ----------------
test('the Monster Codex opens on what you have met, with a friendly word while that is nothing', () => {
  const g = newGame();
  g.kills = {};
  const st = defaultCodexState();
  assert.equal(st.disc, 'seen');
  assert.equal(activeFilterCount(st), 0);
  const empty = codexListHTML(g, st);
  assert.match(empty, /class="cx-empty"/);
  assert.match(empty, /cx-show-unseen/);
  assert.doesNotMatch(empty, /cx-row/, 'no wall of silhouettes');
  // A search or a filter that finds nothing says so plainly instead.
  assert.match(codexListHTML(g, { ...st, search: 'zzz' }), /No creatures match/);
  assert.equal(activeFilterCount({ ...st, region: 'Bukit Timah', minLevel: 3 }), 2);
  assert.equal(activeFilterCount({ ...st, disc: 'all' }), 1);
  g.kills = { chicken: 2 };
  const one = codexListHTML(g, st);
  assert.equal((one.match(/class="cx-row[ "]/g) || []).length, 1, 'the one met');
  const src = read('src/ui/codexui.js');
  assert.match(src, /body\.appendChild\(search\);/, 'the search on its own row');
  assert.match(src, /cx-filter-chip/);
});

// ---------------- Dialogue ----------------
test('a dialogue keeps its farewell apart, as a small button', () => {
  const ask = { label: 'Where am I?', next: 'where' }, bye = { label: 'Goodbye.', next: 'end' };
  assert.deepEqual(farewellSplit([ask, bye]), { main: [ask], bye });
  assert.deepEqual(farewellSplit([ask, { label: 'Leave.' }]).bye, { label: 'Leave.' }, 'no next ends it too');
  assert.equal(farewellSplit([bye]).bye, null, 'a lone farewell stays the one choice');
  const act = { label: 'Any skilling contracts today?', next: 'end', action: 'skillContracts' };
  assert.equal(farewellSplit([ask, act]).bye, null, 'a choice that does something is not a farewell');
  assert.equal(farewellSplit([bye, ask]).bye, null, 'only the last one');
  const src = read('src/ui/ui.js');
  assert.match(src, /const art = speakerArt\(npc\.npcId\);/, 'the speaker\'s portrait');
  assert.match(src, /b\.className = 'dlg-bye';/);
});

// ---------------- Bank pins ----------------
test('bank pins: always on the items you chose to keep, on hover for tools and coins', () => {
  const g = newGame();
  const ui = { game: g };
  const cell = () => el();
  assert.ok(!markKept(ui, cell(), 'bones').classList.contains('bank-kept'), 'loot: no pin');
  const axe = markKept(ui, cell(), 'bronze_axe');
  assert.ok(axe.classList.contains('bank-kept') && axe.classList.contains('bank-kept-auto'), 'a tool: kept, pin on hover');
  toggleKeep(g, 'bones');
  const kept = markKept(ui, cell(), 'bones');
  assert.ok(kept.classList.contains('bank-kept') && !kept.classList.contains('bank-kept-auto'), 'chosen: the pin shows');
  const css = strip(read('styles/compact.css'));
  assert.match(css, /\.item-cell\.bank-kept-auto::after \{ opacity: 0; \}/);
  assert.match(css, /\.item-cell\.bank-kept-auto:hover::after, \.item-cell\.bank-kept-auto:focus-visible::after \{ opacity: 1; \}/);
});

// ---------------- Banners, toasts and close buttons ----------------
test('banners and toasts are one sticker family; every close is one .close-x', () => {
  const css = strip(read('styles/compact.css'));
  const fam = /#hover-text, #region-label, #notice-lane \.nl-card, #rep-pill, #cloud-toast \{([^}]*)\}/.exec(css);
  assert.ok(fam, 'one rule for all five');
  for (const want of ['var(--paper', 'border: 2px solid var(--aw-ink', 'var(--shadow-float-sm']) assert.ok(fam[1].includes(want), want);
  assert.match(css, /@keyframes stickerIn \{ from \{ opacity: 0; translate: 0 -6px; scale: \.96; \}/);
  // The entry never holds its last frame: the pill's fade out and Minimal HUD's hiding still work.
  for (const m of css.matchAll(/animation: stickerIn [^;]*;/g)) assert.match(m[0], /backwards;$/);
  const html = read('index.html');
  for (const id of ['modal-close', 'panel-collapse', 'chat-collapse', 'minimap-collapse']) assert.match(html, new RegExp(`id="${id}" class="close-x"`), id);
  assert.match(cardHTML({ id: 1, kind: 'tip', html: 'hi', count: 1 }), /class="nl-x close-x"/);
  assert.match(read('src/ui/accountui.js'), /class="acct-x close-x"/);
  assert.match(read('src/ui/photomode.js'), /class="pm-x close-x"/);
  assert.match(css, /\.close-x, #modal-close\.close-x, [^{]*\{[^}]*background: #fff none; border: 2px solid var\(--aw-ink/);
  // The world's signposts are drawn as the same card.
  const r = read('src/render/renderer.js');
  const sign = r.slice(r.indexOf('// Directional signposts'), r.indexOf('_place(x, y, hw)'));
  assert.match(sign, /ctx\.fillStyle = '#FFFCF5'/);
  assert.match(sign, /ctx\.strokeStyle = '#22304A'/);
});

test('one width for the Codex-type windows', () => {
  const css = strip(read('styles/compact.css'));
  assert.match(css, /--modal-w-codex: min\(720px, 96vw\)/);
  assert.match(css, /#modal-window:is\(.*:has\(\.codex-grid\)\) \{ width: var\(--modal-w-codex\); \}/, 'the Knowledge Codex too');
});
