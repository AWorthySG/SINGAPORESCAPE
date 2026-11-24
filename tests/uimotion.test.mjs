// UI motion (src/ui/motion.js and the motion block at the end of
// styles/compact.css): one set of timings, sheets and windows that slide away,
// dialogue that glides, rows that rise in, hops for loot and XP, a burst for
// milestone levels. Every helper must be a no-op headless (no document), under
// reduced motion (the system's or Settings') and, for the costly ones, in low
// graphics; and the real state change must never wait for an animation.
import './seed.mjs';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DUR, motionOff, easeHeight, swapIn, staggerIn, bump, exitGhost, sheetCloseGhost, celebrateLevel, installPressStates,
  STAGGER_MAX,
} from '../src/ui/motion.js';
import { countUp } from '../src/ui/uifx.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// A tiny stand-in page: a body with a class list, and matchMedia answering
// `reduce` for prefers-reduced-motion.
function fakePage({ reduce = false, bodyClass = [] } = {}) {
  const cls = new Set(bodyClass);
  globalThis.document = {
    body: { classList: { contains: (c) => cls.has(c), add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: () => {} } },
    addEventListener: () => {},
    getElementById: () => null,
  };
  globalThis.matchMedia = (q) => ({ matches: /prefers-reduced-motion: reduce/.test(q) ? reduce : false });
}
function el(h = 100) {
  const anims = [];
  const e = {
    h, anims,
    getBoundingClientRect: () => ({ height: e.h }),
    getAnimations: () => [],
    animate(frames, opts) { const a = { frames, opts, cancel() {}, playState: 'running' }; anims.push(a); return a; },
  };
  return e;
}
afterEach(() => { delete globalThis.document; delete globalThis.matchMedia; });

test('motion helpers do nothing headless, and the real change still happens', () => {
  assert.equal(motionOff(), true, 'no page: still');
  let ran = 0;
  easeHeight(el(), () => ran++);
  assert.equal(ran, 1, 'easeHeight always runs the redraw');
  for (const f of [() => swapIn(el()), () => staggerIn({ children: [el()] }), () => bump({}), () => exitGhost({}, 'x'),
    () => sheetCloseGhost({}), () => celebrateLevel({ skill: 'attack', name: 'Melee', level: 10 }), () => installPressStates()]) {
    assert.doesNotThrow(f);
  }
  assert.equal(celebrateLevel({ skill: 'attack', name: 'Melee', level: 10 }), null);
  assert.deepEqual(DUR, { fast: 120, med: 180, slow: 260 });
});

test('reduced motion (system or Settings) and low graphics turn the extras off', () => {
  fakePage();
  assert.equal(motionOff({}), false, 'a page that allows motion');
  assert.equal(motionOff({ lowFx: true }), false, 'cheap moves stay in low graphics');
  assert.equal(motionOff({ lowFx: true }, true), true, 'costly ones go');
  fakePage({ reduce: true });
  assert.equal(motionOff({}), true, 'the system asks for less motion');
  fakePage({ bodyClass: ['reduce-motion'] });
  assert.equal(motionOff({}), true, 'Settings > Reduce motion');
});

test('easeHeight glides a box from its old height to its new one, only when it changed', () => {
  fakePage();
  const box = el(400);
  easeHeight(box, () => { box.h = 250; }, {});
  assert.equal(box.anims.length, 1);
  assert.deepEqual(box.anims[0].frames.map((f) => f.height), ['400px', '250px']);
  assert.equal(box.anims[0].opts.duration, DUR.med);
  const same = el(300);
  easeHeight(same, () => { same.h = 302; }, {});
  assert.equal(same.anims.length, 0, 'a couple of pixels is not worth a move');
  fakePage({ reduce: true });
  const still = el(400);
  easeHeight(still, () => { still.h = 200; }, {});
  assert.equal(still.anims.length, 0, 'reduced motion: the box just changes');
  assert.equal(still.h, 200);
});

test('easeHeight leaves a window that is still opening alone', () => {
  fakePage();
  const box = el(500);
  box.getAnimations = () => [{ playState: 'running' }];
  let ran = 0;
  easeHeight(box, () => { ran++; box.h = 300; }, {});
  assert.equal(ran, 1);
  assert.equal(box.anims.length, 0);
});

test('rows rise in one after another, capped, and only with motion allowed', () => {
  fakePage();
  const rows = Array.from({ length: 30 }, () => el());
  staggerIn({ children: rows }, {});
  const moved = rows.filter((r) => r.anims.length);
  assert.equal(moved.length, STAGGER_MAX, 'only the first rows animate');
  assert.ok(moved[3].anims[0].opts.delay > moved[1].anims[0].opts.delay, 'each a little later');
  for (const r of moved) for (const f of r.anims[0].frames) assert.deepEqual(Object.keys(f).sort(), ['opacity', 'transform'], 'transform and opacity only');
  fakePage({ bodyClass: ['reduce-motion'] });
  const still = Array.from({ length: 3 }, () => el());
  staggerIn({ children: still }, {});
  assert.ok(still.every((r) => !r.anims.length));
});

test('countUp never shows a number outside its range when a frame time is early', () => {
  fakePage();
  const queue = [];
  globalThis.requestAnimationFrame = (cb) => queue.push(cb);
  const out = { textContent: '', isConnected: true, classList: { add() {}, remove() {} } };
  const seen = [];
  countUp(out, 'test-early', 1000, (n) => { seen.push(n); return String(n); }, 200);
  // A frame stamped before the count began (timeline throttling), then the rest.
  const t0 = performance.now();
  for (let i = 0, t = t0 - 5000; queue.length && i < 200; i++, t += 50) queue.shift()(t);
  delete globalThis.requestAnimationFrame;
  assert.ok(seen.every((n) => n >= 200 && n <= 1000), `stayed in range: ${seen.join(',')}`);
  assert.equal(seen.at(-1), 1000);
});

test('the motion block: tokens, exits, burst and stillness rules', () => {
  const css = read('styles/compact.css');
  const block = css.slice(css.indexOf('/* ---------- Motion: one set of timings'));
  assert.ok(block.length > 100, 'the block is at the end of compact.css');
  for (const t of ['--dur-1: 120ms', '--dur-2: 180ms', '--dur-3: 260ms', '--ease-std:', '--ease-pop:', '--ease-exit:']) assert.ok(block.includes(t), t);
  // The older names follow the set.
  assert.match(block, /--ui-fast: var\(--dur-1\)/);
  assert.match(block, /--ease-out: var\(--ease-std\)/);
  // New keyframes move only transform and opacity.
  const bare = strip(block);
  for (const [, name, body] of bare.matchAll(/@keyframes (\w+) \{([^]*?\})\s*\}/g)) {
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    for (const p of props) assert.ok(['transform', 'opacity'].includes(p), `${name} moves only transform/opacity (found ${p})`);
  }
  // Stillness: both the system setting and Settings > Reduce motion hide the burst and ghosts.
  assert.match(bare, /@media \(prefers-reduced-motion: reduce\) \{[^]*#lvl-burst, \.ui-ghost \{ display: none !important; \}/);
  assert.match(bare, /body\.reduce-motion :is\(#lvl-burst, \.ui-ghost\) \{ display: none !important; \}/);
  // Ghosts never take taps; the burst never does either.
  assert.match(bare, /\.ui-ghost, \.ui-ghost \* \{ pointer-events: none !important; \}/);
  assert.match(bare, /#lvl-burst \{[^}]*pointer-events: none;/);
  // Not the phone block's exact header (layout tests read main.css's by its text).
  assert.ok(!block.includes('@media (pointer: coarse) and (max-width: 540px) {'));
});

test('ui.js hooks the motion in without changing when state changes', () => {
  const src = read('src/ui/ui.js');
  assert.match(src, /from '\.\/motion\.js'/);
  // The sheet's exit copy is made before the panel folds; the fold itself is immediate.
  assert.match(src, /sheetCloseGhost\(panel, this\.game\);\n\s*panel\.classList\.toggle\('collapsed', collapsed\);/);
  // A window opened from another fades in; a fresh one staggers its sections.
  assert.match(src, /if \(swap\) swapIn\(this\.el\.modalBody, this\.game\);\n\s*else staggerIn\(this\.el\.modalBody, this\.game\);/);
  assert.match(src, /celebrateLevel\(\{ skill: last\.sk\.id/);
});

test('the modulepreload list carries motion.js', () => {
  assert.ok(read('index.html').includes('src/ui/motion.js'), 'index.html preloads the new module');
});
