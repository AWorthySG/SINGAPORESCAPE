// Windows that remember where you were, and close easily (src/ui/windowease.js):
// the bank and Codex reopen on their tab and filters (across a reload too),
// each window keeps its scroll, Esc closes only the top-most thing, a tap
// outside closes a window (and walks: on the joystick) but never a dialogue or a confirmation,
// the Settings toggle, and older saves without the new fields.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { UI } from '../src/ui/ui.js';
import { openCodex } from '../src/ui/codexui.js';
import {
  WindowMemory, OPEN_GRACE_MS, outsideTapAction, closeTopWindow, toggleTapClose, tapCloseLabel,
  swipeCloses, snapshotUiMemory, applyUiMemory,
} from '../src/ui/windowease.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(fresh = true) {
  if (fresh) { globalThis.localStorage = fakeStorage(); clearSave(); }
  const g = new Game();
  g.start();
  if (fresh) g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
/** A stand-in for #modal-body: redrawing it throws the scroll to the top, as a browser does. */
function fakeBody() {
  return {
    scrollTop: 0, html: '',
    set innerHTML(v) { this.html = v; this.scrollTop = 0; },
    querySelector(sel) { return this.has?.(sel) || null; },
    contains: () => false,
  };
}
const classes = (hidden = true) => {
  const s = new Set(hidden ? ['hidden'] : []);
  return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c), toggle: (c, on) => on ? s.add(c) : s.delete(c) };
};
/** Just enough of the UI to open and close the shared window. */
function fakeUI(game) {
  const ui = {
    game, bus: game.bus, modal: null, _cardOpen: false,
    el: { modalBody: fakeBody(), modalTitle: { textContent: '' }, modalOverlay: { classList: classes() }, modalClose: { classList: classes(false) }, contextMenu: { classList: classes() } },
    _dropTips() {}, hideTooltip() {},
    hideContextMenu() { this.el.contextMenu.classList.add('hidden'); },
    closeTouchCard() { this._cardOpen = false; },
    openModal: UI.prototype.openModal, closeModal: UI.prototype.closeModal,
  };
  ui.winMem = new WindowMemory(ui);
  return ui;
}

test('a window reopens where it was scrolled to; a different window starts at its top', () => {
  const ui = fakeUI(newGame());
  const draw = (b) => { b.innerHTML = 'rows'; };
  ui.openModal('Bank of Singapore', draw);
  ui.el.modalBody.scrollTop = 520;
  ui.closeModal();
  assert.equal(ui.modal, null);
  ui.openModal('Gear Guide', draw);
  assert.equal(ui.el.modalBody.scrollTop, 0, 'another window opens at its own top');
  ui.el.modalBody.scrollTop = 90;
  // Opened from the Gear Guide: that one's place is kept too.
  ui.openModal('Bank of Singapore', draw);
  assert.equal(ui.el.modalBody.scrollTop, 520, 'the bank is back where it was');
  ui.openModal('Gear Guide', draw);
  assert.equal(ui.el.modalBody.scrollTop, 90);
});

test('opening and swapping shared dialogs keeps focus inside and remembers the original opener', () => {
  const ui = fakeUI(newGame());
  const ownerDocument = {};
  const focusable = () => ({ isConnected: true, focus() { ownerDocument.activeElement = this; } });
  const opener = focusable(), innerButton = focusable();
  const win = Object.assign(focusable(), { ownerDocument, contains: (el) => el === win || el === innerButton });
  ui.el.modalWindow = win;
  opener.focus();
  ui.openModal('Bank', () => {});
  assert.equal(ownerDocument.activeElement, win);
  innerButton.focus();
  ui.openModal('Class choice', () => { ownerDocument.activeElement = null; }, { locked: true });
  assert.equal(ownerDocument.activeElement, win);
  assert.equal(ui.el.modalClose.classList.contains('hidden'), true);
  ui.closeModal();
  assert.ok(ui.modal, 'a required choice stays open');
  ui.modal.locked = false;
  ui.closeModal();
  assert.equal(ownerDocument.activeElement, opener);
});

test('the bank search and the Codex section and filters come back after a reload', () => {
  const g = newGame();
  const ui = fakeUI(g);
  ui._bankSearch = 'ore';
  ui._codex = { search: 'slime', region: 'all', race: 'all', type: 'boss', disc: 'all', sort: 'name', minLevel: 5, maxLevel: null, shown: 40, id: null, view: 'items' };
  ui._gearGuide = { slot: 'body', style: 'magic' };
  ui._perksTab = 'ranged';
  ui._mapFilters = new Set(['mrt', 'shop']);
  ui.winMem.panelTab = 'skills';
  ui.closeModal();   // closing a window copies the choices into game.uiMemory
  assert.equal(g.uiMemory.win.bank.search, 'ore');
  assert.equal(saveGame(g), true);

  const g2 = newGame(false);
  assert.equal(g2.uiMemory.win.codex.view, 'items', 'saved with the game');
  const ui2 = fakeUI(g2);
  g2.bus.emit('tick');   // the UI picks the save's memory up once it has loaded
  assert.equal(ui2._bankSearch, 'ore', 'the bank search is back');
  assert.equal(ui2._codex.search, 'slime');
  assert.equal(ui2._codex.type, 'boss');
  assert.equal(ui2._codex.minLevel, 5);
  assert.equal(ui2._codex.shown, 40, 'the page size is the default, not saved');
  assert.deepEqual(ui2._gearGuide, { slot: 'body', style: 'magic' });
  assert.equal(ui2._perksTab, 'ranged');
  assert.deepEqual([...ui2._mapFilters], ['mrt', 'shop']);
  // Reopening the Codex with no section asked for: the one it was left on.
  let title = null;
  ui2.openModal = (t) => { title = t; ui2.modal = { title: t }; };
  openCodex(ui2);
  assert.equal(title, 'Item Encyclopedia', 'the Codex reopens on its last section');
  // A creature asked for still opens the monster list.
  openCodex(ui2, 'chicken');
  assert.equal(title, 'Monster Codex');
});

test('odd values in a save are skipped, not used', () => {
  const ui = { game: {} };
  applyUiMemory(ui, { win: { bank: { search: 42 }, codex: { search: { x: 1 }, sort: 'name' }, map: 'mrt', salvage: { offClass: true } } });
  assert.equal(ui._bankSearch, undefined);
  assert.equal(ui._codex.search, '', 'the default kept');
  assert.equal(ui._codex.sort, 'name');
  assert.equal(ui._mapFilters, undefined);
  assert.equal(ui._salvageFilters, undefined, 'only a whole set of salvage filters');
  applyUiMemory(ui, null);
  applyUiMemory(ui, 'junk');
  assert.deepEqual(snapshotUiMemory({}).win, {});
});

test('Esc closes the top-most thing only, including the Auto popover', () => {
  const ui = fakeUI(newGame());
  let autoOpen = true;
  ui._closeAutoMenu = (restoreFocus) => {
    assert.equal(restoreFocus, true);
    const wasOpen = autoOpen;
    autoOpen = false;
    return wasOpen;
  };
  ui.openModal('Bank of Singapore', (b) => { b.innerHTML = 'x'; });
  ui.el.contextMenu.classList.remove('hidden');
  assert.equal(closeTopWindow(ui), 'menu');
  assert.ok(ui.modal, 'the window under the menu is still open');
  ui._cardOpen = true;
  assert.equal(closeTopWindow(ui), 'card');
  assert.ok(ui.modal);
  assert.equal(closeTopWindow(ui), 'window');
  assert.equal(ui.modal, null);
  assert.equal(closeTopWindow(ui), 'auto');
  assert.equal(closeTopWindow(ui), null, 'nothing left to close');
  // The class picker can't be escaped.
  ui.openModal('Choose Your Class', () => {});
  ui.modal.kind = 'classpick'; ui.modal.locked = true;
  assert.equal(closeTopWindow(ui), null);
  assert.ok(ui.modal);
});

test('a tap outside closes a window and walks on, but never a dialogue or a confirmation', () => {
  const g = newGame();
  const ui = fakeUI(g);
  const later = () => ui.winMem.openedAt + OPEN_GRACE_MS + 1;
  ui.openModal('Bank of Singapore', () => {});
  ui.modal.kind = 'bank';
  assert.equal(outsideTapAction(ui, 'world', ui.winMem.openedAt + 10), 'none', 'not the tap that opened it');
  assert.equal(outsideTapAction(ui, 'world', later()), 'walk', 'over the game: close and walk there');
  assert.equal(outsideTapAction(ui, 'empty', later()), 'close');
  assert.equal(outsideTapAction(ui, 'hud', later()), 'none', 'a tap on the HUD leaves the window');
  assert.equal(outsideTapAction(ui, 'stick', later()), 'steer', 'a press on the joystick closes it and walks');
  // Dialogue waits for an answer.
  ui.modal.kind = 'dialogue';
  assert.equal(outsideTapAction(ui, 'world', later()), 'none');
  // A confirmation on show (Offer all, Dismantle...).
  ui.modal.kind = 'salvage';
  ui.el.modalBody.has = (sel) => (sel.includes('.salvage-confirm') ? {} : null);
  assert.equal(outsideTapAction(ui, 'world', later()), 'none');
  ui.el.modalBody.has = null;
  assert.equal(outsideTapAction(ui, 'world', later()), 'walk');
  // A locked window, and the setting turned off.
  ui.modal.locked = true;
  assert.equal(outsideTapAction(ui, 'world', later()), 'none');
  ui.modal.locked = false;
  g.tapClose = false;
  assert.equal(outsideTapAction(ui, 'world', later()), 'none');
  ui.closeModal();
  g.tapClose = true;
  assert.equal(outsideTapAction(ui, 'world', later()), 'none', 'no window, nothing to do');
});

test('Settings toggle: tap outside to close, saved with the settings', () => {
  const g = newGame();
  assert.equal(tapCloseLabel(g), 'Tap outside a window to close it: On', 'on by default');
  assert.equal(toggleTapClose(g), 'Tap outside a window to close it: Off');
  assert.equal(g.tapClose, false);
  assert.equal(g.saveSoon, true);
  saveGame(g);
  assert.equal(newGame(false).tapClose, false, 'kept across a reload');
  assert.equal(toggleTapClose(g), 'Tap outside a window to close it: On');
});

test('an older save without uiMemory or the setting loads, with the defaults', () => {
  const g = newGame();
  g.inventory.add('coins', 777);
  saveGame(g);
  const data = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete data.uiMemory;
  delete data.settings.tapClose;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const g2 = newGame(false);
  assert.equal(g2.inventory.count('coins'), g.inventory.count('coins'), 'the save loaded');
  assert.equal(g2.uiMemory, null);
  assert.notEqual(g2.tapClose, false, 'tap outside to close is on');
  const ui = fakeUI(g2);
  g2.bus.emit('tick');
  assert.equal(ui._bankSearch, undefined);
});

test('a swipe down the title closes; a sideways or short drag does not', () => {
  assert.equal(swipeCloses(0, 80), true);
  assert.equal(swipeCloses(10, 40), false, 'too short');
  assert.equal(swipeCloses(90, 70), false, 'mostly sideways');
  assert.equal(swipeCloses(0, -120), false, 'upwards');
});
