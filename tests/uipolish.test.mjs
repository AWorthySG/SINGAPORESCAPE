// Interface polish: the accessibility settings (text size, colour-blind
// friendly colours, reduced motion) are saved and loaded, older saves get the
// defaults, and the small UI effects helpers behave without a DOM. The styles
// themselves are checked as text, as tests/layout.test.mjs does.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { saveGame, clearSave } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { TEXT_SIZES, nextTextSize, applyAccessibility, countUp, playCloseGhost, motionReduced, inlineIcon } from '../src/ui/uifx.js';

const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const freshGame = () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
};

test('a new game starts with normal text, standard colours and full motion', () => {
  const g = freshGame();
  assert.equal(g.textSize, 'normal');
  assert.equal(g.colourBlind, false);
  assert.equal(g.reduceMotion, false);
});

test('the accessibility settings are saved and loaded (older saves: the defaults)', () => {
  const g = freshGame();
  g.textSize = 'larger'; g.colourBlind = true; g.reduceMotion = true;
  saveGame(g);
  const again = new Game(); again.start();
  assert.equal(again.textSize, 'larger', 'text size kept across a reload');
  assert.equal(again.colourBlind, true, 'colour-blind colours kept');
  assert.equal(again.reduceMotion, true, 'reduced motion kept');
  // A save from before these settings, and one with a value we don't know.
  const data = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete data.settings.textSize; delete data.settings.colourBlind; delete data.settings.reduceMotion;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const old = new Game(); old.start();
  assert.equal(old.textSize, 'normal');
  assert.equal(old.colourBlind, false);
  assert.equal(old.reduceMotion, false);
  data.settings.textSize = 'enormous';
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const odd = new Game(); odd.start();
  assert.equal(odd.textSize, 'normal', 'an unknown size falls back to Normal');
});

test('text size cycles Normal, Large, Larger and round again', () => {
  assert.deepEqual(TEXT_SIZES, ['normal', 'large', 'larger']);
  assert.equal(nextTextSize('normal'), 'large');
  assert.equal(nextTextSize('large'), 'larger');
  assert.equal(nextTextSize('larger'), 'normal');
});

test('the effects helpers do nothing harmful without a DOM', () => {
  assert.equal(motionReduced(), true, 'no document: treat as still');
  assert.equal(applyAccessibility({ textSize: 'large', colourBlind: true }), 'large|true|false');
  assert.equal(applyAccessibility({}), 'normal|false|false');
  const el = { textContent: '', classList: { add() {}, remove() {} } };
  countUp(el, 'test-coins', 1234, (n) => `${n} coins`);
  assert.equal(el.textContent, '1234 coins', 'the final number is set at once');
  countUp(null, 'none', 5);   // no element: no throw
  playCloseGhost(null);
  assert.match(inlineIcon('<img>'), /class="ui-ic"/);
});

test('the stylesheet carries the settings, the motion opt-out and the shared components', () => {
  for (const sel of ['body[data-text-size="large"]', 'body[data-text-size="larger"]', 'body.cb-safe', 'body.reduce-motion *',
    '.ui-card', '.ui-pill', '.ui-btn-primary', '.ui-row', '.ui-badge', '.ui-stat', '.ui-section-title', '.modal-ghost']) {
    assert.ok(css.includes(sel), `${sel} is styled`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'the system setting is respected too');
  assert.match(css, /:focus-visible/, 'keyboard focus is visible');
  // No web fonts from other sites: the game is a static site with no dependencies.
  assert.doesNotMatch(css, /@import|fonts\.googleapis|url\(["']?https?:/);
});
