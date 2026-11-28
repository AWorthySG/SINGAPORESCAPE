import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleGameShortcut, openKeyboardControls } from '../src/ui/keyboard.js';
import { PANEL_SHORTCUTS } from '../src/data/keyboard.js';

function fixture() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  const game = {
    attackNearest: record('attack'), nextTarget: record('target'),
    interact: record('interact'), activateAbilityKey: record('ability'),
    goToNearest: record('go'), toggleAutoBattle: record('auto battle'),
    equipBest: record('equip best'),
    prayerBurst: record('burst'), questTravel: record('quest'),
    quests: { rq_kampong_glam: { state: 'active' } },
    questGuide: (id) => ({ kind: id === 'rq_kampong_glam' ? 'talk' : 'none' }),
    play: {}, tickCount: 10,
  };
  const ui = {
    showPanelView: record('panel'), openLifeSkills: record('life'),
    quickBar: { tap: record('slot') },
    closeModal() { calls.push(['close']); this.modal = null; },
  };
  const press = (key, options) => {
    const event = { key, preventDefault() { this.defaultPrevented = true; }, ...options };
    const handled = handleGameShortcut(event, game, ui);
    assert.equal(!!event.defaultPrevented, handled || !!options?.defaultPrevented);
    return handled;
  };
  return { game, ui, calls, press };
}

test('every numbered shortcut opens the named view, including the inventory after Gear', () => {
  const { calls, press } = fixture();
  const views = ['equipment', 'inventory', 'skills', 'combat', 'quests', 'settings', 'prayer', 'stats', 'story', 'achievements'];
  for (const view of views) assert.equal(press(PANEL_SHORTCUTS[view]), true);
  assert.deepEqual(calls, views.map((view) => ['panel', view]));
});

test('quick actions, combat and Shift slots route to the same actions as the HUD', () => {
  const { game, calls, press } = fixture();
  press('N');
  press('j');
  press('E', { shiftKey: true });
  press('Q', { shiftKey: true });
  press('G', { shiftKey: true });
  press('l');
  press('Tab');
  press(' ');
  press('Z');
  press('^', { code: 'Digit6', shiftKey: true });
  assert.deepEqual(calls, [
    ['go', ['bank_booth']], ['quest', 'rq_kampong_glam'],
    ['go', ['bank_booth']], ['quest', 'rq_kampong_glam'], ['life'], ['burst'], ['target'], ['interact'], ['ability', 'z'], ['slot', 5],
  ]);
  assert.equal(game.play.handsOnTick, 10);
});

test('Shift+B equips the best gear once per press and plain B still uses the fifth ability', () => {
  const { calls, press } = fixture();
  assert.equal(press('B', { shiftKey: true }), true);
  assert.equal(press('B', { shiftKey: true, repeat: true }), false);
  assert.equal(press('B', { shiftKey: true, target: { tagName: 'INPUT' } }), false);
  assert.equal(press('B', { shiftKey: true, ctrlKey: true }), false);
  assert.equal(press('b'), true);
  assert.deepEqual(calls, [['equip best'], ['ability', 'b']]);
});

test('browser modifiers, held keys, text fields and native focus keep their own behaviour', () => {
  const { calls, press } = fixture();
  const control = { closest: (selector) => selector.includes('button') ? {} : null };
  assert.equal(press('G', { metaKey: true }), false);
  assert.equal(press('N', { ctrlKey: true }), false);
  assert.equal(press('F', { altKey: true }), false);
  assert.equal(press('t', { repeat: true }), false);
  assert.equal(press('2', { defaultPrevented: true }), false);
  assert.equal(press('e', { isComposing: true }), false);
  assert.equal(press('1', { target: { tagName: 'SELECT' } }), false);
  assert.equal(press('n', { target: { tagName: 'INPUT' } }), false);
  assert.equal(press('Tab', { shiftKey: true }), false);
  assert.equal(press('Tab', { target: control }), false);
  assert.equal(press(' ', { target: control }), false);
  assert.deepEqual(calls, []);
});

test('a foreground window keeps game keys quiet and Escape closes just the top window', () => {
  const { calls, ui, press } = fixture();
  ui.modal = { kind: 'shop' };
  assert.equal(press('1'), false);
  assert.equal(press('!', { code: 'Digit1', shiftKey: true }), false);
  assert.equal(press('t'), false);
  assert.equal(press('Escape', { target: { tagName: 'INPUT' } }), true);
  assert.equal(press('t'), true);
  assert.deepEqual(calls, [['close'], ['auto battle']]);
});

test('Tab loops through visible controls in the foreground dialog, including search', () => {
  const { ui, press } = fixture();
  const ownerDocument = {};
  const control = ({ hidden = false, disabled = false } = {}) => ({
    tabIndex: 0, matches: () => disabled, getClientRects: () => hidden ? [] : [{}], closest: () => null,
    focus() { ownerDocument.activeElement = this; },
  });
  const [first, middle, last] = [control(), control(), control()];
  const window = { ownerDocument, querySelectorAll: () => [first, control({ hidden: true }), middle, last, control({ disabled: true })] };
  ui.el = { modalWindow: window };
  ui.modal = {};
  first.focus();
  assert.equal(press('Tab', { shiftKey: true }), true);
  assert.equal(ownerDocument.activeElement, last);
  assert.equal(press('Tab', { repeat: true }), true);
  assert.equal(ownerDocument.activeElement, first);
  middle.focus();
  assert.equal(press('Tab'), false, 'the browser moves through interior controls');
  ownerDocument.activeElement = null;
  assert.equal(press('Tab'), true, 'a redraw cannot send focus behind the dialog');
  assert.equal(ownerDocument.activeElement, first);

  const searchInput = control();
  ui.cmdSearch = { isOpen: () => true, el: { querySelector: () => ({ ownerDocument, querySelectorAll: () => [searchInput] }) } };
  assert.equal(press('Tab'), true);
  assert.equal(ownerDocument.activeElement, searchInput);
});

test('the keyboard reference shows the actual panel and action shortcuts', () => {
  const body = {};
  const ui = { openModal(title, render) { assert.equal(title, 'Keyboard controls'); render(body); } };
  openKeyboardControls(ui);
  assert.match(body.innerHTML, /Worn Equipment<\/dt><dd><kbd>6<\/kbd>/);
  assert.match(body.innerHTML, /Equip best in slot<\/dt><dd><kbd>Shift\+B<\/kbd>/);
  assert.match(body.innerHTML, /Open Life skills<\/dt><dd><kbd>Shift\+G<\/kbd>/);
  assert.match(body.innerHTML, /Custom quick bar slots<\/dt><dd><kbd>Shift\+1–6<\/kbd>/);
});
