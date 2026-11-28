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

test('touch screens get one Auto button and phones get sheet handles', () => {
  // The Auto button lives in the action bar, beside the card of switches it opens.
  const bar = html.slice(html.indexOf('<div id="ability-bar">'), html.indexOf('<div id="adrenaline"'));
  assert.match(bar, /id="auto-menu-btn"[^>]*aria-controls="auto-row"/);
  assert.match(bar, /class="auto-row" id="auto-row"/);
  for (const id of ['auto-battle-btn', 'auto-gather-btn', 'auto-quest-btn', 'auto-battle-cfg']) assert.ok(bar.includes(`id="${id}"`), `${id} still reachable`);
  // Both sheets carry a drag handle.
  assert.match(html, /<div id="sidepanel">\s*(<!--[^]*?-->\s*)?<div class="sheet-handle"/);
  const modal = html.match(/<div id="modal-window"[^>]*>(?=\s*<div class="sheet-handle")/)?.[0] ?? '';
  assert.match(modal, /\brole="dialog"/);
  assert.match(modal, /\baria-modal="true"/);
  assert.match(modal, /\baria-labelledby="modal-title"/);
  assert.match(modal, /\btabindex="-1"/);
  // Hidden by default (desktop), shown only inside touch-only media blocks.
  assert.match(css, /\.sheet-handle \{ display: none; \}/);
  assert.match(css, /#auto-menu-btn \{ display: none; \}/);
  const touch = mediaBlock('(pointer: coarse)');
  assert.match(touch, /#auto-menu-btn \{\s*display: flex;/);
  assert.match(touch, /#ability-bar \.auto-row \{ display: none;/);
  assert.match(touch, /#ability-bar\.auto-open \.auto-row \{ display: flex; \}/);
  const phones = mediaBlock('(pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px)');
  assert.match(phones, /#sidepanel:not\(\.collapsed\) \.sheet-handle \{ display: block; \}/);
});

test('touch screens get 44px targets, safe areas and an 85% sheet cap', () => {
  const touch = mediaBlock('(pointer: coarse)');
  for (const sel of ['.tab-btn', '.inv-slot', '.equip-slot', '.item-cell', '#wave-hud .wv-leave']) {
    assert.ok(touch.includes(sel), `${sel} is sized for fingers`);
  }
  assert.match(touch, /#modal-close \{ width: 44px; height: 44px;/);
  assert.match(touch, /#inv-sort \{ min-width: 44px; \}/);
  for (const side of ['top', 'right', 'bottom', 'left']) assert.ok(touch.includes(`env(safe-area-inset-${side}`), `respects the ${side} safe area`);
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

test('tablet menus start folded and respect a saved preference to keep them open', async () => {
  const { UI } = await import('../src/ui/ui.js');
  const saved = globalThis.matchMedia;
  // A tall, wide touch viewport matches only the pointer part of the query.
  globalThis.matchMedia = (query) => ({ matches: query.includes('(pointer: coarse)') });
  try {
    const panel = fakeEl('sidepanel'), chat = fakeEl('chatbox');
    const ui = { _collapse: {}, _fullForBag() {}, _catchUpPanels() {}, _drawChat() {} };
    UI.prototype._wireCollapse.call(ui, 'panel', panel, fakeEl('panel-collapse'), 'panel');
    UI.prototype._wireCollapse.call(ui, 'chat', chat, fakeEl('chat-collapse'), 'chat');
    assert.ok(panel.classList.contains('collapsed') && chat.classList.contains('collapsed'));
    ui._collapse.panel = false;
    UI.prototype._wireCollapse.call(ui, 'panel', panel, fakeEl('panel-collapse'), 'panel');
    assert.ok(!panel.classList.contains('collapsed'));
  } finally { globalThis.matchMedia = saved; }
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
  globalThis.matchMedia = (q) => ({ matches: q.includes('(orientation: portrait)'), addEventListener() {} });
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
  const btn = fakeEl('interact-btn');
  btn.classList.toggle = (c, on) => (on ? cls.add(c) : cls.delete(c));
  btn.querySelector = (s) => (s === '.ib-verb' ? verb : null);
  const ui = { el: { interact: btn } };
  UI.prototype.setInteractLabel.call(ui, ['Attack', 'Goblin (level 2)']);
  assert.ok(cls.has('is-attack'), 'next to a foe it is the second Attack button, so it hides');
  UI.prototype.setInteractLabel.call(ui, ['Talk to', 'Auntie Mei']);
  assert.ok(!cls.has('is-attack'), 'it comes back for anything else');
  assert.equal(btn.attrs['aria-label'], 'Talk to Auntie Mei');
  assert.equal(verb.innerHTML, 'Talk to<span class="ib-noun">Auntie Mei</span>', 'naming the action and who it is with');
  UI.prototype.setInteractLabel.call(ui, null);
  assert.ok(!cls.has('is-attack'));
});

test('the notification lane: top centre on a desktop, under the objectives on a phone, beside the strip on its side', async () => {
  const { placeLane } = await import('../src/ui/noticelane.js');
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  // Desktop: centred under the region name, and below a boss bar that shares the top centre.
  const desk = placeLane({ 'region-label': rect(540, 10, 200, 28), 'quest-tracker': rect(10, 44, 200, 60) }, 1280, 'desk');
  assert.deepEqual(desk, { top: 48, left: 460, width: 360 });
  const boss = placeLane({ 'region-label': rect(540, 10, 200, 28), 'boss-bar': rect(440, 44, 400, 70) }, 1280, 'desk');
  assert.equal(boss.top, 120, 'under the boss bar');
  // Phone portrait in a fight: boss bar, then the Endless Gate panel, then the
  // objectives down the left; the lane goes under them, left of the minimap.
  const phone = placeLane({
    'boss-bar': rect(6, 6, 278, 48), 'wave-hud': rect(6, 54, 278, 50), 'quest-tracker': rect(6, 104, 200, 40),
    'minimap-panel': rect(296, 6, 126, 150), 'minimap-dock': rect(296, 156, 126, 72), sidepanel: rect(366, 236, 56, 56),
  }, 428, 'phone');
  assert.deepEqual(phone, { top: 150, left: 6, width: 284 });
  // The minimap folded (just its small button left): the lane stops short of
  // the launcher, which stays where it was under the minimap's place.
  const folded = placeLane({
    'quest-tracker': rect(6, 6, 200, 200), 'minimap-panel': rect(346, 6, 38, 38), sidepanel: rect(330, 194, 52, 52),
  }, 390, 'phone');
  assert.deepEqual(folded, { top: 212, left: 6, width: 318 }, 'clear of the Bag / Skills launcher');
  // A very narrow phone: the lane descends below the footer and leaves quick-use accessible.
  const tiny = placeLane({
    'quest-tracker': rect(6, 6, 120, 40), 'minimap-panel': rect(180, 6, 134, 150),
    'minimap-dock': rect(154, 156, 160, 58), quickbar: rect(208, 222, 44, 44), sidepanel: rect(258, 222, 56, 56),
  }, 320, 'phone');
  assert.deepEqual(tiny, { top: 220, left: 6, width: 196 });
  // A phone on its side: along the top, right of the objectives, short of the Bag.
  const side = (extra = {}) => ({
    'quest-tracker': rect(6, 6, 186, 58), sidepanel: rect(472, 6, 56, 56),
    'minimap-panel': rect(616, 6, 128, 130), 'minimap-dock': rect(604, 136, 140, 64), ...extra,
  });
  const flat = placeLane(side(), 750, 'flat');
  assert.deepEqual([flat.top, flat.left], [6, 200], 'level with the objectives, just right of them');
  assert.ok(flat.left + flat.width <= 472 - 8, 'stops short of the Bag launcher');
  const fight = placeLane(side({ 'boss-bar': rect(6, 6, 300, 50), 'wave-hud': rect(6, 60, 300, 50) }), 750, 'flat');
  assert.equal(fight.left, 314);
  assert.equal(fight.top, 68, 'too little room beside the Bag, so just below it');
});

test('phone sheet: the five tabs share one row, and the body is not size-contained', () => {
  const phones = mediaBlock('(pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px)');
  const tabs = (html.match(/<button class="tab-btn[^"]*" data-view=/g) || []).length;
  assert.equal(tabs, 5, 'five panel tabs');
  // Equal columns, one per tab, instead of a row that scrolls (and on iPhone
  // dropped taps); with five, each is a big target with its label showing.
  assert.match(phones, /#sidepanel:not\(\.collapsed\) #panel-tabs \{\s*display: grid; grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);
  assert.match(phones, /#sidepanel:not\(\.collapsed\) \.tab-btn \{[^}]*min-height: 56px;/);
  assert.match(phones, /#sidepanel:not\(\.collapsed\) \.tab-btn \.tab-label \{ display: block;/);
  assert.match(mediaBlock('(pointer: coarse)'), /\.subtab-btn \{ min-height: 44px; \}/, 'sub-tabs are full-size touch targets');
  assert.ok(!/#sidepanel:not\(\.collapsed\) #panel-tabs \{[^}]*overflow-x: auto/.test(phones), 'the tab row no longer scrolls');
  assert.match(phones, /#sidepanel:not\(\.collapsed\) \.tab-btn \{ min-width: 0;/, 'tabs may shrink below the 44px min-width to fit');
  const body = phones.match(/#sidepanel:not\(\.collapsed\) #panel-body \{[^}]*\}/)?.[0] || '';
  assert.match(body, /contain: none/, 'no size containment on the sheet body');
  assert.match(body, /overflow-y: auto/);
  // Minimal HUD never fades an open sheet.
  assert.match(phones, /#game-root\.hud-min #sidepanel:not\(\.collapsed\) \{ opacity: 1; \}/);
});

test('Minimal HUD on a phone keeps the folded Bag / Skills launcher (it used to fade out while exploring)', () => {
  const phones = mediaBlock('(pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px)');
  const strip = (s) => s.replace(/\/\*[^]*?\*\//g, '');
  // The side panel never fades out any more (#518): on a mouse screen it folds
  // to its tab icons instead, and that fold is kept off touch screens.
  assert.ok(!/#game-root\.hud-min #sidepanel:not\(:hover\) \{ opacity: 0; \}/.test(css), 'no fade');
  assert.match(css, /@media \(pointer: fine\) \{\s*#game-root\.hud-min #sidepanel:not\(:hover\):not\(\.collapsed\)/, 'the fold is for mouse screens only');
  // On phones the folded launcher stays solid (iOS only "hovers" the last thing tapped).
  const rule = strip(phones).match(/([^{}]+)\{ opacity: 1; \}/g)?.find((r) => r.includes('#sidepanel.collapsed')) || '';
  assert.ok(rule.split('{')[0].split(',').map((s) => s.trim()).includes('#game-root.hud-min #sidepanel.collapsed'), 'the folded launcher stays solid');
  // Nothing else on a phone fades or hides the launcher's tab.
  assert.ok(!/#sidepanel\.collapsed \.tab-btn\.active\s*\{[^}]*(display: none|opacity: 0|visibility: hidden)/.test(css));
});

test('touch screens: tapped divs and rows show the pointer cursor (iOS only clicks "clickable" things)', () => {
  const touch = mediaBlock('(pointer: coarse)');
  const rule = touch.replace(/\/\*[^]*?\*\//g, '').match(/([^{}]+)\{ cursor: pointer; \}/)?.[1] || '';
  for (const sel of ['.inv-slot', '.equip-slot.filled', '.prayer-cell', '.quest-row.can-go', '.skill-cell', '.ctx-item', 'summary']) {
    assert.ok(rule.split(',').map((s) => s.trim()).includes(sel), `${sel} has cursor: pointer`);
  }
});

test('sheets never start a drag (or capture the pointer) on a tab, slot, row or button', async () => {
  const { UI, sheetDragStarts } = await import('../src/ui/ui.js');
  // closest() stand-in: the element "matches" when the selector list names its tag or one of its classes.
  const el = (tag, cls = '') => ({ closest: (sel) => (sel.split(',').map((s) => s.trim()).some((s) => s === tag || cls.split(' ').some((c) => c && s === `.${c}`)) ? {} : null) });
  for (const [tag, cls] of [['button', ''], ['a', ''], ['input', ''], ['summary', ''], ['label', ''], ['div', 'inv-slot filled'], ['button', 'tab-btn'],
    ['div', 'equip-slot'], ['div', 'prayer-cell'], ['div', 'quest-row can-go'], ['div', 'item-cell'], ['div', 'ctx-item']]) {
    assert.equal(sheetDragStarts(el(tag, cls)), false, `${tag}.${cls} keeps its tap`);
  }
  assert.equal(sheetDragStarts(el('span', 'panel-title')), true, 'the header text drags');
  assert.equal(sheetDragStarts(el('div', 'sheet-handle')), true, 'the handle drags');
  assert.equal(sheetDragStarts(null), true);

  // Wired up: a pointerdown on a button inside the header does nothing, and a
  // plain tap on the header never takes the pointer; only a real drag does.
  const listeners = {};
  let captured = 0;
  const head = { classList: { contains: () => false }, addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); }, setPointerCapture: () => { captured++; } };
  const panel = { classList: { contains: () => false }, style: {}, querySelector: () => null };
  const fire = (t, e) => { for (const fn of listeners[t] || []) fn(e); };
  let folded = 0;
  const prev = { document: globalThis.document, matchMedia: globalThis.matchMedia };
  globalThis.document = { getElementById: () => null };
  globalThis.matchMedia = (q) => ({ matches: q.includes('(orientation: portrait)'), addEventListener() {} });
  try {
    UI.prototype._initSheets.call({ el: { sidepanel: panel, panelHead: head, modalTitle: null }, _collapseApply: { panel: () => { folded++; } } });
    fire('pointerdown', { clientX: 10, clientY: 100, pointerId: 1, target: el('button') });
    fire('pointermove', { clientX: 10, clientY: 300, pointerId: 1 });
    fire('pointerup', {});
    assert.equal(folded, 0, 'a press on the fold button is not a drag');
    assert.equal(panel.style.transform, undefined, 'and the sheet did not move');
    fire('pointerdown', { clientX: 10, clientY: 100, pointerId: 1, target: el('span') });
    fire('pointermove', { clientX: 10, clientY: 102, pointerId: 1 });
    fire('pointerup', {});
    assert.equal(captured, 0, 'a tap on the header takes no pointer capture');
    fire('pointerdown', { clientX: 10, clientY: 100, pointerId: 1, target: el('span') });
    fire('pointermove', { clientX: 10, clientY: 200, pointerId: 1 });
    assert.equal(captured, 1, 'a drag does');
    fire('pointerup', {});
    assert.equal(folded, 1, 'and a long one closes the sheet');
  } finally {
    globalThis.document = prev.document;
    globalThis.matchMedia = prev.matchMedia;
  }
});

test('second-finger taps on a tab icon still click the tab, and never eat the next ordinary tap', async () => {
  const { clickSecondFingerTaps } = await import('../src/engine/input.js');
  const on = {};
  clickSecondFingerTaps({ addEventListener: (type, fn) => { on[type] = fn; } });
  let clicks = 0;
  const tab = { isConnected: true, tagName: 'BUTTON', closest: () => null, click: () => { clicks++; } };
  const icon = { parentElement: tab };                 // an <svg> inside the tab: no click()
  tab.contains = (x) => x === tab || x === icon;
  on.pointerdown({ pointerType: 'touch', isPrimary: false, pointerId: 3, clientX: 5, clientY: 5, timeStamp: 1000, target: icon });
  on.pointerup({ pointerId: 3, clientX: 5, clientY: 5, timeStamp: 1080 });
  assert.equal(clicks, 1, 'the tab around the icon is clicked');
  // The browser's own click for that tap, aimed at the icon, is the duplicate.
  let stopped = false;
  on.click({ isTrusted: true, target: icon, timeStamp: 1100, stopImmediatePropagation: () => { stopped = true; }, preventDefault() {} });
  assert.ok(stopped, 'its duplicate is dropped');
  // Second-finger tap with no browser click, then a quick ordinary tap on the same tab.
  on.pointerdown({ pointerType: 'touch', isPrimary: false, pointerId: 4, clientX: 5, clientY: 5, timeStamp: 2000, target: tab });
  on.pointerup({ pointerId: 4, clientX: 5, clientY: 5, timeStamp: 2060 });
  assert.equal(clicks, 2);
  on.pointerdown({ pointerType: 'touch', isPrimary: true, pointerId: 5, clientX: 5, clientY: 5, timeStamp: 2200, target: tab });
  stopped = false;
  on.click({ isTrusted: true, target: tab, timeStamp: 2280, stopImmediatePropagation: () => { stopped = true; }, preventDefault() {} });
  assert.ok(!stopped, 'the ordinary tap that followed keeps its click');
});

test('a quick second tap on the tab just opened does not fold the phone sheet', async () => {
  const { UI } = await import('../src/ui/ui.js');
  const mkCls = (init = []) => { const s = new Set(init); return { contains: (c) => s.has(c), toggle: (c, on) => { if (on ?? !s.has(c)) s.add(c); else s.delete(c); } }; };
  const panel = { classList: mkCls(['compact-ui']) };
  const tabs = ['inventory', 'skills'].map((view) => {
    const l = [];
    return { dataset: { view }, classList: mkCls(view === 'inventory' ? ['active'] : []), addEventListener: (t, fn) => l.push(fn), click() { l.forEach((fn) => fn()); } };
  });
  const prev = { document: globalThis.document, performance: Object.getOwnPropertyDescriptor(globalThis, 'performance') };
  let now = 1000;
  globalThis.document = { querySelectorAll: (s) => (s.includes('tab-btn') ? tabs : []), getElementById: (id) => (id === 'sidepanel' ? panel : null) };
  Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true, writable: true });
  let folds = 0;
  const ui = { _dropTips() {}, _showPanelView() {}, _collapseApply: { panel: (c) => { if (c) folds++; } } };
  try {
    UI.prototype._bindTabs.call(ui);
    tabs[1].click(); now += 150; tabs[1].click();
    assert.equal(folds, 0, 'a double tap on Skills leaves the sheet open');
    now += 1000; tabs[1].click();
    assert.equal(folds, 1, 'a later tap on the open tab still folds it');
  } finally {
    globalThis.document = prev.document;
    Object.defineProperty(globalThis, 'performance', prev.performance);
  }
});

test('five panel tabs: every view sits in exactly one tab, and the number keys pick the tabs', async () => {
  const { PANEL_TABS, tabOfView } = await import('../src/ui/ui.js');
  const tabViews = [...html.matchAll(/<button class="tab-btn[^"]*" data-view="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabViews, Object.keys(PANEL_TABS), 'Bag, Skills, Combat, Journal, Settings, in that order');
  const panelViews = [...html.matchAll(/<section class="panel-view[^"]*" data-view="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(Object.values(PANEL_TABS).flat().sort(), [...panelViews].sort(), 'each view in one tab, none lost');
  assert.deepEqual(PANEL_TABS.inventory, ['inventory', 'equipment']);
  assert.deepEqual(PANEL_TABS.combat, ['combat', 'prayer', 'stats']);
  assert.deepEqual(PANEL_TABS.quests, ['quests', 'achievements', 'story']);
  assert.equal(tabOfView('prayer'), 'combat');
  assert.equal(tabOfView('achievements'), 'quests');
  assert.match(html, /<div id="panel-body">\s*<div id="panel-subtabs"/, 'the sub-tab row heads the panel body');
  const { PANEL_SHORTCUTS } = await import('../src/data/keyboard.js');
  assert.deepEqual(tabViews.map((view) => PANEL_SHORTCUTS[view]), ['1', '2', '3', '4', '5']);
  assert.deepEqual(Object.keys(PANEL_SHORTCUTS).sort(), panelViews.sort(), 'every view has a direct shortcut');
});

test('sub-tabs switch views inside a tab, and each tab remembers the one it last showed', async () => {
  const { UI } = await import('../src/ui/ui.js');
  const mkCls = (init = []) => { const s = new Set(init); return { contains: (c) => s.has(c), toggle: (c, on) => { if (on ?? !s.has(c)) s.add(c); else s.delete(c); } }; };
  let focused;
  const clickable = (props, init) => {
    const listeners = new Map(), attrs = {};
    return {
      ...props, classList: mkCls(init), attrs,
      setAttribute: (key, value) => { attrs[key] = value; },
      addEventListener: (type, fn) => listeners.set(type, fn),
      click() { listeners.get('click')?.(); },
      press(key) { listeners.get('keydown')?.({ key, preventDefault() {}, stopPropagation() {} }); },
      focus() { focused = this; },
    };
  };
  const panel = { classList: mkCls() };
  const tabs = ['inventory', 'skills', 'combat', 'quests', 'settings'].map((view) => clickable({ dataset: { view } }, view === 'inventory' ? ['active'] : []));
  const views = ['inventory', 'equipment', 'skills', 'combat', 'prayer', 'quests', 'stats', 'achievements', 'settings'].map((view) => ({ dataset: { view }, classList: mkCls() }));
  let subBtns = [];
  const row = {
    dataset: {}, classList: mkCls(['hidden']), attrs: {},
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
    set innerHTML(h) { this.html = h; subBtns = [...h.matchAll(/data-view="([a-z]+)"/g)].map((m) => clickable({ dataset: { view: m[1] } })); },
    querySelectorAll: () => subBtns,
  };
  const store = {};
  const prev = { document: globalThis.document, localStorage: globalThis.localStorage };
  globalThis.document = {
    querySelectorAll: (s) => (s.includes('tab-btn') ? tabs : s.includes('panel-view') ? views : []),
    getElementById: (id) => ({ sidepanel: panel, 'panel-subtabs': row }[id] || null),
  };
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  const shown = () => views.filter((v) => !v.classList.contains('hidden')).map((v) => v.dataset.view);
  let statsDrawn = 0;
  const ui = Object.assign(Object.create(UI.prototype), { el: {}, _dropTips() {}, renderStatsPanel() { statsDrawn++; } });
  try {
    ui._bindTabs();
    tabs[2].click();
    assert.deepEqual(shown(), ['combat'], 'Combat opens on its first view');
    assert.ok(!row.classList.contains('hidden'));
    assert.deepEqual(subBtns.map((b) => b.dataset.view), ['combat', 'prayer', 'stats']);
    assert.equal(row.attrs['aria-label'], 'Combat views');
    assert.deepEqual(subBtns.map((b) => b.tabIndex), [0, -1, -1]);
    for (const view of ['combat', 'prayer', 'stats']) {
      assert.ok(row.html.includes(`id="combat-tab-${view}" aria-controls="panel-view-${view}"`));
      assert.ok(html.includes(`id="panel-view-${view}" role="tabpanel" aria-labelledby="combat-tab-${view}"`));
    }
    subBtns[0].press('ArrowRight');
    assert.deepEqual(shown(), ['prayer']);
    assert.equal(focused, subBtns[1]);
    assert.deepEqual(subBtns.map((b) => b.tabIndex), [-1, 0, -1]);
    subBtns[1].press('Home');
    assert.deepEqual(shown(), ['combat']);
    assert.equal(focused, subBtns[0]);
    subBtns[2].click();
    assert.deepEqual(shown(), ['stats']);
    assert.equal(statsDrawn, 1, 'the stats sheet is brought up to date when shown');
    assert.ok(tabs[2].classList.contains('active'), 'the Combat tab stays lit');
    tabs[1].click();
    assert.deepEqual(shown(), ['skills']);
    assert.ok(row.classList.contains('hidden'), 'a one-view tab shows no sub-tab row');
    tabs[2].click();
    assert.deepEqual(shown(), ['stats'], 'Combat comes back on Stats, the sub-tab it last showed');
    assert.equal(JSON.parse(store.ss_ui_subtab).combat, 'stats', 'remembered for next time');
    // Code can open a view directly: the right tab lights and the sub-tab switches.
    ui.showPanelView('achievements');
    assert.deepEqual(shown(), ['achievements']);
    assert.deepEqual(tabs.filter((t) => t.classList.contains('active')).map((t) => t.dataset.view), ['quests']);
    assert.ok(subBtns.find((b) => b.dataset.view === 'achievements').classList.contains('active'));
    // A fresh UI reads the memory back.
    const ui2 = Object.assign(Object.create(UI.prototype), { el: {}, _dropTips() {}, renderStatsPanel() {} });
    ui2._bindTabs();
    tabs[3].click();
    assert.deepEqual(shown(), ['achievements']);
  } finally {
    globalThis.document = prev.document;
    globalThis.localStorage = prev.localStorage;
  }
});

test('the stylesheet is well formed: no merge leftovers, every block closed', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['styles/main.css', ...(['styles/accounts.css', 'styles/title.css', 'styles/story.css'])]) {
    let css; try { css = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'); } catch { continue; }
    assert.ok(!/^(<{7}|={7}|>{7})/m.test(css), `${f}: no merge conflict markers`);
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    let depth = 0;
    for (const ch of bare) { if (ch === '{') depth++; else if (ch === '}') { depth--; assert.ok(depth >= 0, `${f}: an extra }`); } }
    assert.equal(depth, 0, `${f}: every { is closed`);
  }
});

test('the pinch guard listens to touchmove only on WebKit, so other browsers never wait on it to scroll', async () => {
  const { guardTouchZoom } = await import('../src/engine/input.js');
  const listen = (win) => {
    const on = {};
    guardTouchZoom({ defaultView: win, addEventListener: (type, fn, opts) => { on[type] = opts; } });
    return on;
  };
  const chrome = listen({});
  assert.equal(chrome.touchmove, undefined, 'no page-wide touchmove listener without gesture events');
  assert.equal(chrome.touchend?.passive, false, 'the double-tap guard stays');
  assert.equal(chrome.gesturestart?.passive, false);
  const safari = listen({ ongesturestart: null });
  assert.equal(safari.touchmove?.passive, false, 'Safari still has its pinch guard');
});
