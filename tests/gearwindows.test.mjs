// The gear windows (Gear Mastery, Enchant, Refine, Sacrifice, Dismantle, the
// shrine's "Offer gear") on a phone: a tap redraws the window in place without
// losing its scroll, a new window starts at its top, and auto battle's own MRT
// trips no longer close a window the player is using.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { STATIONS, MRT_FARE } from '../src/data/transport.js';
import { redraw } from '../src/ui/salvageui.js';
import { UI } from '../src/ui/ui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass('swordsman');
  const ui = { closed: 0 };
  g.ui = new Proxy(ui, { get: (t, k) => (k === 'closeModal' ? () => { t.closed++; } : k in t ? t[k] : () => {}) });
  return { g, ui };
}

/** A stand-in for #modal-body: rebuilding its contents (as a window's render
 *  does) throws the scroll back to the top, as a browser does. */
function fakeBody(details = []) {
  return {
    scrollTop: 0, html: '', details,
    set innerHTML(v) { this.html = v; this.scrollTop = 0; this.details = this.details.map(() => ({ open: false })); },
    querySelectorAll(sel) { return sel === 'details' ? this.details : []; },
  };
}

test('a tap redraws a gear window in place: same scroll, open notes stay open', () => {
  const body = fakeBody([{ open: true }, { open: false }]);
  body.scrollTop = 413;
  let renders = 0;
  redraw(body, (b) => { renders++; b.innerHTML = '<p>rebuilt</p>'; });
  assert.equal(renders, 1, 'drawn once');
  assert.equal(body.html, '<p>rebuilt</p>');
  assert.equal(body.scrollTop, 413, 'the list stays where the finger was');
  assert.deepEqual(body.details.map((d) => d.open), [true, false], 'the open "How it works" note stays open');
  // At the top it stays at the top (nothing to restore).
  const top = fakeBody();
  redraw(top, (b) => { b.innerHTML = 'x'; });
  assert.equal(top.scrollTop, 0);
});

test('a new window opens at its top, not part-way down from the last one', () => {
  const body = fakeBody();
  body.scrollTop = 894;   // Gear Mastery scrolled down to a piece
  const ui = {
    el: { modalBody: body, modalTitle: { textContent: '' }, modalOverlay: { classList: { remove() {}, add() {} } } },
    _dropTips() {},
  };
  let seen = null;
  UI.prototype.openModal.call(ui, 'Dismantle gear', (b) => { seen = b.scrollTop; b.innerHTML = 'rows'; });
  assert.equal(seen, 0, 'the new window is drawn from its top');
  assert.equal(ui.modal.title, 'Dismantle gear');
});

test('an MRT hop auto battle makes on its own leaves the open window alone; one you choose closes it', () => {
  const { g, ui } = newGame();
  g.inventory.add('coins', MRT_FARE * 10);
  const p = g.player;
  // The station farthest from the start: a trip long enough to ride the MRT.
  const far = STATIONS.reduce((b, s) => (Math.hypot(s.x - p.x, s.y - p.y) > Math.hypot(b.x - p.x, b.y - p.y) ? s : b));
  const start = { x: p.x, y: p.y };
  assert.ok(g._autoRun(() => g.travelToTile(far)));
  assert.ok(Math.hypot(p.x - start.x, p.y - start.y) > 30, 'auto battle rode the MRT');
  assert.equal(ui.closed, 0, 'the window the player had open stayed open');
  assert.equal(g._autoTrip, false, 'the flag never outlives the auto step');
  // The same ride chosen by the player (MRT window, world map) closes the window.
  g.travelTo(STATIONS.find((s) => s !== far).id);
  assert.equal(ui.closed, 1);
});

test('the auto step clears its flag even if it throws', () => {
  const { g } = newGame();
  assert.throws(() => g._autoRun(() => { throw new Error('boom'); }));
  assert.equal(g._autoTrip, false);
});
