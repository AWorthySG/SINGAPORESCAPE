// Settings > Show performance (src/ui/perfhud.js): the readout's figures are
// plain functions, checked here on made-up frames, and the readout itself runs
// headless on a real game (no page: it keeps its words in `text`). Off, main.js
// never loads the module and its frame loop reads no clock.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { TILE } from '../src/config.js';
import { moduleGraph } from '../tools/modulepreload.mjs';
import {
  quantile, frameFigures, creatureCounts, bagCounts, perSecond, perfText, PerfHud, WINDOW_MS, REFRESH_MS,
} from '../src/ui/perfhud.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function freshGame() {
  globalThis.localStorage = fakeStorage();
  const g = new Game();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.start(); g.chooseStartingStyle('melee');
  return g;
}

test('quantiles by nearest rank: the median and the time only the slowest 5% go over', () => {
  assert.equal(quantile([], 0.5), 0);
  assert.equal(quantile([7], 0.95), 7);
  const s = Array.from({ length: 20 }, (_, i) => i + 1);   // 1..20
  assert.equal(quantile(s, 0.5), 10);
  assert.equal(quantile(s, 0.95), 19, 'one frame in twenty is slower');
  assert.equal(quantile(s, 1), 20);
});

test('frame figures: fps from the gaps, median and p95 frame time, and the script split', () => {
  assert.equal(frameFigures([], [], [], []), null);
  const n = 20, gaps = Array(n).fill(100);
  gaps[3] = 300;   // one hitch in twenty: under the worst 5%
  const f = frameFigures(gaps, Array(n).fill(20), Array(n).fill(40), Array(n).fill(65));
  assert.equal(f.frames, 20);
  assert.equal(f.frameMs, 110);
  assert.ok(Math.abs(f.fps - 1000 / 110) < 1e-9);
  assert.equal(f.p50, 100);
  assert.equal(f.p95, 100);
  assert.deepEqual([f.upd, f.ren, f.work], [20, 40, 65]);
  assert.deepEqual([f.updMax, f.renMax], [20, 40]);
  gaps[9] = 250;   // two in twenty: the worst 5% now shows a hitch
  const upd = Array(n).fill(20);
  upd[9] = 180;   // ...and the slowest update says the update made it
  const g = frameFigures(gaps, upd, Array(n).fill(40), Array(n).fill(65));
  assert.equal(g.p95, 250);
  assert.deepEqual([g.updMax, g.renMax], [180, 40]);
  assert.equal(gaps[3], 300, 'the gaps passed in are left as they were');
});

test('creature counts: what is in view is drawn (falling bodies too), monsters count as alive', () => {
  const cam = { originX: 0, originY: 0, viewW: 10 * TILE, viewH: 8 * TILE };
  const npc = (x, y, o = {}) => ({ x, y, alive: true, attackable: true, def: {}, ...o });
  const npcs = [
    npc(2, 2),                                                  // a monster in view
    npc(5, 5, { ally: true }),                                  // your mercenary: drawn, not a foe
    npc(6, 3, { attackable: false }),                           // a townsperson: drawn, not a foe
    npc(4, 4, { alive: false, attackable: false, deathT: 200 }),   // keeling over: still drawn
    npc(3, 3, { alive: false, attackable: false, deathT: 0 }),     // dead and gone
    npc(40, 40),                                                // a monster nearby, off screen
    npc(13, 4, { def: { scale: 3 } }),                          // a big boss just past the edge
    npc(13, 4),                                                 // ...where a small one isn't drawn
  ];
  assert.deepEqual(creatureCounts(npcs, cam), { drawn: 5, alive: 4 });
  assert.deepEqual(creatureCounts([], cam), { drawn: 0, alive: 0 });
});

test('bag counts, chat lines a second, and the readout lines', () => {
  assert.deepEqual(bagCounts({ slots: [{ id: 'coins', qty: 5 }, null, { id: 'logs', qty: 1 }, null] }), { used: 2, size: 4 });
  assert.deepEqual(bagCounts(null), { used: 0, size: 0 });
  assert.equal(perSecond([[10, 500], [12, 500]]), 22);
  assert.equal(perSecond([]), 0);
  const fig = {
    frames: 30, fps: 6.1, frameMs: 163.9, p50: 160, p95: 220.4, upd: 24.13, ren: 48.3, work: 75, updMax: 90.24, renMax: 61,
    canvasW: 780, canvasH: 1688, dpr: 2, deviceDpr: 3, autoScale: 0.85, trim: true, low: false,
    drawn: 14, alive: 37, bagUsed: 663, bagSize: 668, chat: 22,
  };
  assert.equal(perfText(fig), [
    '6.1 fps · frame p50 160 · p95 220',
    'script 75.0 of 164 ms a frame',
    'upd 24.1 · draw 48.3 · rest 2.6',
    'slowest upd 90.2 · draw 61.0',
    'canvas 780×1688 · 2.00 of 3x',
    'res 85% · trim on · low gfx off',
    'mobs 14 drawn · 37 alive near',
    'bag 663/668 · chat 22.0 lines/s',
  ].join('\n'));
  // Quick frames keep a decimal; before any frame there is nothing to time yet.
  assert.match(perfText({ ...fig, fps: 60, frameMs: 16.67, p50: 16.6, p95: 18.25 }), /^60\.0 fps · frame p50 16\.6 · p95 18\.3\nscript 75\.0 of 16\.7 ms a frame/);
  assert.match(perfText({ ...fig, frames: 0 }), /^measuring…\ncanvas 780×1688/);
});

test('the readout runs headless on a real game: frames, the window, pauses, chat, bag and canvas', () => {
  const g = freshGame();
  g._movePlayerNear(58, 55, 3);
  g.camera.resize(390, 664, 1.6, 2);
  g.update(16);
  const hud = new PerfHud(g, { width: 780, height: 1688 }, () => 0.85);
  assert.equal(hud.el, null, 'no page: no element');
  assert.equal(hud.text, 'measuring…');

  // Two seconds of slow frames, then six of quick ones: the slow ones fall out of the window.
  let t = 1000;
  for (let i = 0; i < 10; i++) hud.frame(t += 200, 50, 100, 160);
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) g.msg('A line for the chat.');
    hud.frame(t += 100, 20, 40, 65);
  }
  const lines = hud.text.split('\n');
  assert.equal(lines[0], '10.0 fps · frame p50 100 · p95 100');
  assert.equal(lines[1], 'script 65.0 of 100 ms a frame');
  assert.equal(lines[2], 'upd 20.0 · draw 40.0 · rest 5.0');
  assert.equal(lines[3], 'slowest upd 20.0 · draw 40.0', 'the slow frames have left the window');
  assert.equal(lines[4], 'canvas 780×1688 · 2.00 of 1x');
  assert.equal(lines[5], 'res 85% · trim off · low gfx off');
  const near = g.nearbyNpcs();
  assert.equal(lines[6], `mobs ${creatureCounts(near, g.camera).drawn} drawn · ${near.filter((n) => n.attackable && !n.ally).length} alive near`);
  const { used, size } = bagCounts(g.inventory);
  assert.ok(used > 0 && size >= used);
  assert.match(lines[7], new RegExp(`^bag ${used}/${size} · chat 2\\.0 lines/s$`), 'a line every half second');

  // A hidden tab (seconds between frames) is a pause, not a slow frame, and
  // the time away doesn't water down the chat's lines a second.
  hud.frame(t += 6000, 20, 40, 65);
  for (let i = 0; i < 10; i++) hud.frame(t += 100, 20, 40, 65);
  assert.match(hud.text, /^10\.0 fps · frame p50 100 · p95 100\n/);
  assert.match(hud.text, /chat 1\.\d lines\/s$/);

  // It only ever reads the game: no dice rolled, no tick, nobody moved.
  const rnd = Math.random;
  let rolls = 0;
  Math.random = () => { rolls++; return rnd(); };
  const tick = g.tickCount, pos = [g.player.x, g.player.y], list = g.nearbyNpcs();
  try { for (let i = 0; i < 20; i++) hud.frame(t += REFRESH_MS, 20, 40, 65); } finally { Math.random = rnd; }
  assert.equal(rolls, 0);
  assert.equal(g.tickCount, tick);
  assert.deepEqual([g.player.x, g.player.y], pos);
  assert.equal(g.nearbyNpcs(), list, 'the nearby list is read, not rebuilt');

  // Off, it stops counting the chat.
  g.msg('Counted.');
  assert.equal(hud.chatLines, 1);
  hud.remove();
  g.msg('Not counted.');
  assert.equal(hud.chatLines, 1);
  assert.ok(WINDOW_MS / REFRESH_MS >= 2);
});

test('off, it costs nothing: main.js loads the module only when on, and reads no clock for it', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(!moduleGraph().includes('src/ui/perfhud.js'), 'not in the static import graph (or the preload list)');
  assert.match(main, /import\('\.\/ui\/perfhud\.js'\)/);
  assert.match(main, /const ph = perfHud, p0 = ph \? now\(\) : 0;/);
  assert.match(main, /ph\?\.frame\(t, p1 - p0, p3 - p2\);/);
  // The readout is told about the frame after the governor has timed it.
  assert.ok(main.indexOf('ph?.frame(') > main.indexOf('game.fxTrim = governor.frame('));
  // Off by default, kept on this device, and the Settings button flips it.
  assert.match(main, /localStorage\.getItem\(PERF_KEY\) === '1'/);
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /Show performance: \$\{this\.perfOn \? 'On' : 'Off'\}/);
  assert.match(ui, /this\.setPerf\?\.\(!this\.perfOn\)/);
});
