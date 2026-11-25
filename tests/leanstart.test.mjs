// A leaner start (src/ui/title.js, src/ui/photomode.js): what the loading bar
// waits for, and how soon the Enter button shows on a slow phone.
//  - Only the title heroes the screen has room for are asked for (a phone
//    shows three of the six); the rest come when a wider screen draws them.
//  - The bar eases in real time on long frames, and the later title shots are
//    glanced at for one frame each, so a slow phone isn't held back.
//  - The postcard's mascot loads when postcard mode first opens.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TitleScreen, TITLE_HEROES, TITLE_SHOTS, titleSpots, titleCast } from '../src/ui/title.js';
import { TILE } from '../src/config.js';

test('the title cast: a phone shows three heroes, a wide screen all six, never more', () => {
  // Phone, portrait: a row of three under the card.
  assert.deepEqual(titleCast(390, 118, 362), ['swordsman', 'wizard', 'ranger']);
  // A small phone still gets two; a tablet in portrait four.
  assert.equal(titleCast(320, 118, 300).length, 2);
  assert.equal(titleCast(768, 150, 520).length, 4);
  // Wide: three a side of the card.
  assert.deepEqual(titleCast(1600, 150, 560), TITLE_HEROES);
  // Unmeasured card: the narrow row, as the stage draws it.
  assert.equal(titleCast(1600, 150).length, 4);
  for (const w of [280, 390, 540, 800, 1024, 1440, 1920, 3000]) {
    const spots = titleSpots(w, 150, Math.min(560, w - 20));
    assert.ok(spots.length >= 2 && spots.length <= TITLE_HEROES.length, `${w}px: ${spots.length} heroes`);
    for (const [x, fx] of spots) { assert.ok(x > 0 && x < w, 'on screen'); assert.ok(fx === 1 || fx === -1); }
    assert.deepEqual(titleCast(w, 150, Math.min(560, w - 20)), TITLE_HEROES.slice(0, spots.length), 'the cast is the heroes the stage draws');
  }
});

test('the title asks only for the heroes its screen shows', () => {
  const t = new TitleScreen(null);
  assert.deepEqual(t._cast(), TITLE_HEROES, 'headless (nothing to measure): the whole cast');
  t.el = { heroes: { clientWidth: 390, clientHeight: 118 } };
  t.splash = { querySelector: () => ({ getBoundingClientRect: () => ({ width: 362 }) }) };
  assert.deepEqual(t._cast(), ['swordsman', 'wizard', 'ranger']);
  t.el.heroes.clientWidth = 1600; t.el.heroes.clientHeight = 150;
  t.splash = { querySelector: () => ({ getBoundingClientRect: () => ({ width: 560 }) }) };
  assert.deepEqual(t._cast(), TITLE_HEROES);
  // warm() (before the game is built, or from attach()) asks for the measured
  // cast; attach() swings only theirs.
  const src = readFileSync(new URL('../src/ui/title.js', import.meta.url), 'utf8');
  const warm = src.slice(src.indexOf('  warm() {'), src.indexOf('  attach(game) {'));
  assert.match(warm, /for \(const id of this\._cast\(\)\) warmHero\(id\);/);
  assert.doesNotMatch(warm, /TITLE_HEROES/);
  const attach = src.slice(src.indexOf('  attach(game) {'), src.indexOf('  _cast() {'));
  assert.match(attach, /const cast = this\._cast\(\);\n\s*this\.warm\(\);/);
  assert.match(attach, /for \(const id of cast\) swingArtReady\(id\);/);
  assert.doesNotMatch(attach, /TITLE_HEROES/);
});

/** A title on a stand-in page, its pictures all in, run at `dt` ms a frame
 *  until the Enter button shows: the frames it took and where the camera went. */
function runToReady(dt) {
  const cls = () => { const s = new Set(); return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), contains: (c) => s.has(c), toggle() {} }; };
  const saved = globalThis.document;
  globalThis.document = { body: { classList: cls() } };
  try {
    const splash = { classList: cls(), querySelector: () => null, style: { setProperty() {} } };
    const t = new TitleScreen(splash, { still: false, lowFx: true });
    t.tracker.job('pictures'); t.tracker.done('pictures');
    const cam = { cx: 0, cy: 0, setZoomMul() {} };
    t.game = { camera: cam };
    const spots = [];
    let frames = 0;
    while (!t.ready && frames < 200) { t.frame(dt); frames++; spots.push([cam.cx / TILE, cam.cy / TILE]); }
    return { frames, spots, ready: t.ready };
  } finally { globalThis.document = saved; }
}

test('a slow phone sees the Enter button soon after its pictures are in', () => {
  // Four frames a second (the main loop caps a frame at 250 ms).
  const slow = runToReady(250);
  assert.ok(slow.ready);
  // Two opening frames, the bar's ease (in real time, not a tenth of a second
  // a frame), one glance at each later shot, then ready.
  assert.ok(slow.frames <= 2 + 3 + (TITLE_SHOTS.length - 1) + 1, `${slow.frames} frames`);
  // Each later shot is glanced at once, in order.
  const glances = slow.spots.filter(([x, y]) => TITLE_SHOTS.slice(1).some((s) => s.from[0] === x && s.from[1] === y));
  assert.deepEqual(glances, TITLE_SHOTS.slice(1).map((s) => s.from));
  // A fast screen still shows the bar for its minimum (it never just flashes past).
  const fast = runToReady(16);
  assert.ok(fast.ready && fast.frames * 16 >= 700, `${fast.frames} frames at 16 ms`);
});

test('the postcard mascot is asked for when postcard mode opens, not at start-up', () => {
  const src = readFileSync(new URL('../src/ui/photomode.js', import.meta.url), 'utf8');
  const ctor = src.slice(src.indexOf('  constructor(game, canvas) {'), src.indexOf('  _build() {'));
  assert.doesNotMatch(ctor, /new Image/);
  const frame = src.slice(src.indexOf('  frame() {'), src.indexOf('  close() {'));
  assert.match(frame, /if \(!this\.logo && typeof Image === 'function'\) \{ this\.logo = new Image\(\); this\.logo\.src = 'assets\/mascot-login\.webp'; \}/);
  // A snap before it arrives simply leaves the corner without it.
  assert.match(src, /logo: this\.logo && this\.logo\.complete && this\.logo\.naturalWidth \? this\.logo : null/);
});
