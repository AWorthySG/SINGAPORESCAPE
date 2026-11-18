// Responsive layout on touch screens (the "Responsive layout" block at the end
// of styles/main.css, the Auto button and the sheet handles in index.html, and
// the small helpers in ui.js that drive them). No browser here, so the CSS and
// HTML are checked as text and the helpers against a tiny stand-in DOM.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** The CSS text of the last @media block with exactly this prelude (the
 *  responsive block is at the end of the file, after older ones). */
function mediaBlock(prelude) {
  const at = css.lastIndexOf(`@media ${prelude} {`);
  assert.ok(at >= 0, `@media ${prelude} exists`);
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1);
  }
  throw new Error('unbalanced block');
}

test('phones get one Auto button and sheet handles; desktop keeps them hidden', () => {
  // The Auto button lives in the action bar, beside the card of switches it opens.
  const bar = html.slice(html.indexOf('<div id="ability-bar">'), html.indexOf('<div id="adrenaline"'));
  assert.match(bar, /id="auto-menu-btn"[^>]*aria-controls="auto-row"/);
  assert.match(bar, /class="auto-row" id="auto-row"/);
  for (const id of ['auto-battle-btn', 'auto-gather-btn', 'auto-quest-btn', 'auto-battle-cfg']) assert.ok(bar.includes(`id="${id}"`), `${id} still reachable`);
  // Both sheets carry a drag handle.
  assert.match(html, /<div id="sidepanel">\s*(<!--[^]*?-->\s*)?<div class="sheet-handle"/);
  assert.match(html, /<div id="modal-window">\s*<div class="sheet-handle"/);
  // Hidden by default (desktop), shown only inside touch-only media blocks.
  assert.match(css, /\.sheet-handle \{ display: none; \}/);
  assert.match(css, /#auto-menu-btn \{ display: none; \}/);
  const phones = mediaBlock('(pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px)');
  assert.match(phones, /#auto-menu-btn \{\s*display: flex;/);
  assert.match(phones, /#ability-bar \.auto-row \{ display: none;/);
  assert.match(phones, /#ability-bar\.auto-open \.auto-row \{ display: flex; \}/);
});

test('touch screens get 44px targets, safe areas and an 85% sheet cap', () => {
  const touch = mediaBlock('(pointer: coarse)');
  for (const sel of ['.tab-btn', '.inv-slot', '.equip-slot', '.item-cell', '#wave-hud .wv-leave']) {
    assert.ok(touch.includes(sel), `${sel} is sized for fingers`);
  }
  assert.match(touch, /#modal-close \{ width: 44px; height: 44px;/);
  assert.match(touch, /#inv-sort \{ min-width: 44px; \}/);
  const phones = mediaBlock('(pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px)');
  for (const side of ['top', 'right', 'bottom', 'left']) assert.ok(phones.includes(`env(safe-area-inset-${side}`), `respects the ${side} safe area`);
  const portrait = mediaBlock('(pointer: coarse) and (max-width: 540px)');
  assert.match(portrait, /max-height: 85dvh/, 'sheets never cover more than 85% of the height');
  assert.match(portrait, /animation: sheetUp/, 'sheets slide up');
  const landscape = mediaBlock('(pointer: coarse) and (max-height: 500px)');
  assert.match(landscape, /animation: sheetIn/, 'landscape: the panel is a side sheet');
  // The minimap is drawn at 0.72 there, so its small buttons' tap areas reach
  // 62px to stay 44px on screen (22px fold button + 40, 36px orb + 28).
  assert.match(landscape, /#minimap-collapse::before \{ inset: -22px -18px -18px -22px; \}/);
  assert.match(landscape, /\.orb::before \{ inset: -14px; \}/);
  assert.match(portrait, /\.orb::before \{ inset: -6px; \}/, 'portrait: 46px orb tap areas in their row');
  // The info strip stacks by measured rows, so the boss bar, the Endless Gate
  // panel and the objectives can't overlap.
  assert.match(portrait, /#wave-hud \{\s*top: calc\(var\(--strip-t\) \+ var\(--boss-h\)\)/);
  assert.match(portrait, /top: calc\(var\(--strip-t\) \+ var\(--boss-h\) \+ var\(--wave-h\)\)/);
});

// A tiny stand-in for the few DOM calls the helpers make.
function fakeEl(id) {
  const classes = new Set();
  const listeners = {};
  return {
    id, children: [], attrs: {}, style: {},
    classList: {
      contains: (c) => classes.has(c),
      toggle: (c, on) => { const v = on === undefined ? !classes.has(c) : on; v ? classes.add(c) : classes.delete(c); return v; },
      add: (c) => classes.add(c), remove: (c) => classes.delete(c),
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    fire(t, e = {}) { for (const fn of listeners[t] || []) fn({ stopPropagation() {}, target: this, ...e }); },
    contains(el) { return el === this || this.children.includes(el); },
    querySelector: () => null,
  };
}

test('the Auto button opens and folds the card of switches; a tap elsewhere folds it', async () => {
  const { UI } = await import('../src/ui/ui.js');
  const bar = fakeEl('ability-bar'), btn = fakeEl('auto-menu-btn'), toggle = fakeEl('auto-gather-btn'), world = fakeEl('game-canvas');
  bar.children.push(btn, toggle);
  const docListeners = {};
  const prev = globalThis.document;
  globalThis.document = {
    getElementById: (id) => ({ 'ability-bar': bar, 'auto-menu-btn': btn })[id] || null,
    addEventListener: (t, fn) => { (docListeners[t] ||= []).push(fn); },
  };
  try {
    UI.prototype._initAutoMenu.call({});
    btn.fire('click');
    assert.ok(bar.classList.contains('auto-open'), 'opens');
    assert.equal(btn.attrs['aria-expanded'], 'true');
    for (const fn of docListeners.pointerdown) fn({ target: toggle });
    assert.ok(bar.classList.contains('auto-open'), 'a tap on a switch inside keeps it open');
    for (const fn of docListeners.pointerdown) fn({ target: world });
    assert.ok(!bar.classList.contains('auto-open'), 'a tap on the world folds it');
    assert.equal(btn.attrs['aria-expanded'], 'false');
  } finally {
    globalThis.document = prev;
  }
});

test('sheets: a swipe down or a tap on the handle closes; a short drag snaps back', async () => {
  const { UI } = await import('../src/ui/ui.js');
  const panel = fakeEl('sidepanel'), handle = fakeEl('handle'), head = fakeEl('panel-head');
  handle.classList.add('sheet-handle');
  handle.closest = head.closest = () => null;
  panel.querySelector = (s) => (s === '.sheet-handle' ? handle : null);
  let folded = 0;
  const prev = { document: globalThis.document, matchMedia: globalThis.matchMedia };
  globalThis.document = { getElementById: () => null };
  globalThis.matchMedia = (q) => ({ matches: !q.includes('max-height: 500px)') || q.includes('pointer'), addEventListener() {} });
  try {
    const ui = { el: { sidepanel: panel, panelHead: head, modalTitle: null }, _collapseApply: { panel: () => { folded++; } } };
    UI.prototype._initSheets.call(ui);
    // A long swipe down on the header folds the panel.
    head.fire('pointerdown', { clientX: 10, clientY: 100, pointerId: 1, target: head });
    head.fire('pointermove', { clientX: 10, clientY: 200 });
    assert.equal(panel.style.transform, 'translateY(100px)', 'the sheet follows the finger');
    head.fire('pointerup');
    assert.equal(folded, 1, 'a swipe down closes it');
    assert.equal(panel.style.transform, '');
    // A short drag snaps back.
    head.fire('pointerdown', { clientX: 10, clientY: 100, pointerId: 1, target: head });
    head.fire('pointermove', { clientX: 10, clientY: 130 });
    head.fire('pointerup');
    assert.equal(folded, 1, 'a short drag does not close it');
    // A tap on the handle closes it.
    handle.fire('pointerdown', { clientX: 10, clientY: 100, pointerId: 1, target: handle });
    handle.fire('pointerup');
    assert.equal(folded, 2, 'a tap on the handle closes it');
  } finally {
    globalThis.document = prev.document;
    globalThis.matchMedia = prev.matchMedia;
  }
});

test('touch screens show one Attack button: Interact steps aside when it would say Attack', async () => {
  const touch = mediaBlock('(pointer: coarse)');
  assert.match(touch, /#interact-btn\.is-attack \{ display: none; \}/);
  assert.ok(!/^#interact-btn\.is-attack/m.test(css.slice(0, css.indexOf('@media (pointer: coarse) {'))), 'desktop keeps its Interact button as it was');
  const { UI } = await import('../src/ui/ui.js');
  const cls = new Set();
  const verb = { innerHTML: '' };
  const btn = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) }, querySelector: (s) => (s === '.ib-verb' ? verb : null), prepend() {}, title: '' };
  const ui = { el: { interact: btn } };
  UI.prototype.setInteractLabel.call(ui, ['Attack', 'Goblin (level 2)']);
  assert.ok(cls.has('is-attack'), 'next to a foe it is the second Attack button, so it hides');
  UI.prototype.setInteractLabel.call(ui, ['Talk to', 'Auntie Mei']);
  assert.ok(!cls.has('is-attack'), 'it comes back for anything else');
  assert.equal(verb.innerHTML, 'Talk to', 'still naming the action');
  UI.prototype.setInteractLabel.call(ui, null);
  assert.ok(!cls.has('is-attack'));
});
