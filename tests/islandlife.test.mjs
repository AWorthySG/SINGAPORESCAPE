import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Game } from '../src/game/game.js';
import { LANDINGS, LOOM, PHOTO_ASSIGNMENTS, STAGES } from '../src/data/islandlife.js';
import { exploreCove, finishIslandTune, finishVoyage, islandBook, learnIslandTune, makeIslandPattern, recordIslandPhoto, restoreIslandLife } from '../src/game/islandlife.js';
import { saveGame } from '../src/game/save.js';
import { drawIslandSites } from '../src/render/islandlife.js';

function fresh() {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const g = new Game(); g.start(); g.chooseClass('rogue');
  return g;
}
function visit(g, { x, y }) {
  g.player.x = g.player.tx = x;
  g.player.y = g.player.ty = y;
  g.updateRegion();
}

test('voyages follow the chart, land at the correct port and open cove finds once', () => {
  const g = fresh();
  assert.equal(finishVoyage(g, 'ubin', [0, 1, 0]), false);
  visit(g, LANDINGS.changi);
  assert.equal(finishVoyage(g, 'ubin', [1, 1, 0]), false);
  assert.equal(finishVoyage(g, 'ubin', [0, 1, 0]), true);
  assert.equal(g.currentZoneName, 'Pulau Ubin');
  assert.equal(finishVoyage(g, 'changi', [1, 0, 1]), true);
  assert.equal(finishVoyage(g, 'cove', [1, 1, 0, 1]), true);
  assert.equal(exploreCove(g, 'line'), true);
  assert.equal(exploreCove(g, 'reef'), true);
  assert.equal(exploreCove(g, 'survey'), true);
  assert.equal(exploreCove(g, 'line'), false);
});

test('photos respect the location and dusk, award one print, and have display art', () => {
  const g = fresh();
  for (const p of PHOTO_ASSIGNMENTS) assert.ok(existsSync(new URL(`../assets/postcards/${p.art}.webp`, import.meta.url)), p.art);
  visit(g, PHOTO_ASSIGNMENTS[0]);
  g.dayPhase = () => .5;
  assert.equal(recordIslandPhoto(g), null);
  g.dayPhase = () => .75;
  assert.equal(recordIslandPhoto(g)?.id, 'dome');
  assert.equal(recordIslandPhoto(g), null);
});

test('textiles cost ingredients, music checks its stage and performance, and both persist', () => {
  const g = fresh();
  visit(g, LOOM);
  const coins = g.inventory.count('coins');
  assert.equal(makeIslandPattern(g, 'chilli'), false);
  g.inventory.add('chilli', 1);
  assert.equal(makeIslandPattern(g, 'chilli'), true);
  assert.equal(g.inventory.count('chilli'), 0);
  assert.equal(g.inventory.count('coins'), coins - 8);
  assert.equal(learnIslandTune(g, 'kopi'), false);
  visit(g, STAGES[0]);
  assert.equal(learnIslandTune(g, 'kopi'), true);
  assert.equal(finishIslandTune(g, 'kopi', [0, 1, 2, 1], 10), false);
  assert.equal(finishIslandTune(g, 'kopi', [0, 1, 1, 1], 1500), false);
  assert.equal(finishIslandTune(g, 'kopi', [0, 1, 2, 1], 1500), true);
  assert.equal(saveGame(g), true);
  const next = new Game(); next.start();
  assert.equal(islandBook(next).scarf, 'chilli');
  assert.deepEqual(islandBook(next).tunes, ['kopi']);
  assert.equal(next.skills.xp.music, g.skills.xp.music);
  assert.deepEqual(restoreIslandLife({ photos: ['unknown'], display: 'unknown' }), restoreIslandLife());
});

test('landings have distinctive sails which stay still under Reduce motion', () => {
  const g = fresh();
  const { x, y } = LANDINGS.changi;
  const draw = (t, calm) => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, k) => (...args) => calls.push([k, ...args]) });
    drawIslandSites(ctx, g, x * 32 - 20, y * 32 - 20, 96, 96, t, calm);
    assert.ok(calls.some(([op]) => op === 'lineTo'));
    return calls;
  };
  assert.deepEqual(draw(0, true), draw(960, true));
  assert.notDeepEqual(draw(0, false), draw(960, false));
});
