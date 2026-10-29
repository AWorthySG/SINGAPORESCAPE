// Life skills and getting around: skill guides, MRT stations found on foot and
// ridden from the world map, auto gather, gathering popups and the Interact
// button's level warning.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, clearSave } from '../src/game/save.js';
import { OBJECTS } from '../src/data/objects.js';
import { STATION_BY_ID, MRT_FARE } from '../src/data/transport.js';
import { GUIDE_SKILLS, guideEntries } from '../src/game/skillguide.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.ui = new Proxy({}, { get: () => () => {} });
  return game;
}

function placeAt(game, x, y) {
  const p = game.player;
  p.stopNow(); p.clearAction();
  p.x = p.tx = x; p.y = p.ty = y; p.progress = 0; p.moving = false; p.path = [];
  if ('fx' in p) { p.fx = x; p.fy = y; }
}

test('every life skill has a guide, sorted by level, pointing at real objects', () => {
  for (const s of GUIDE_SKILLS) {
    const e = guideEntries(s);
    assert.ok(e.length > 0, `${s} guide has entries`);
    for (let i = 1; i < e.length; i++) assert.ok(e[i].level >= e[i - 1].level, `${s} sorted`);
    for (const x of e) for (const id of x.objIds || []) assert.ok(OBJECTS[id], `${s}: ${id} is a real object`);
  }
});

test('MRT stations are found on foot and can then be ridden from the world map', () => {
  const game = newGame();
  const far = STATION_BY_ID.bukit_timah;
  assert.ok(game.stationsFound.has('kampong_glam'), 'the home station is known from the start');
  assert.ok(!game.stationsFound.has('bukit_timah'));
  game.inventory.add('coins', 500);
  assert.equal(game.mrtFromMap('bukit_timah'), false, "can't ride to a station you haven't found");
  // Walk past it: it's added.
  placeAt(game, far.x, far.y);
  game.updateRegion();
  assert.ok(game.stationsFound.has('bukit_timah'));
  // Ride home and back again, paying the fare each time.
  const coins = game.inventory.count('coins');
  assert.equal(game.mrtFromMap('kampong_glam'), true);
  assert.equal(game.inventory.count('coins'), coins - MRT_FARE);
  assert.ok(Math.abs(game.player.x - STATION_BY_ID.kampong_glam.x) <= 3);
  assert.equal(game.mrtFromMap('bukit_timah'), true);
  assert.ok(Math.abs(game.player.y - far.y) <= 3);

  // Found stations and the auto-gather switch survive a save and load.
  game.autoGather = true;
  saveGame(game);
  const g2 = new Game();
  loadGame(g2);
  assert.ok(g2.stationsFound.has('bukit_timah') && g2.stationsFound.has('kampong_glam'));
  assert.equal(g2.autoGather, true);
});

test('auto gather moves on to the next tree of the same kind when one is felled', () => {
  const game = newGame();
  const trees = game.world.objects.filter((o) => o.objId === 'tree' && !o.depleted);
  // Pick a tree with another of its kind close by.
  let felled = null, next = null;
  for (const t of trees) {
    const near = trees.find((o) => o !== t && Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y)) <= 8);
    if (near) { felled = t; next = near; break; }
  }
  assert.ok(felled, 'found two trees close together');
  const free = game._nearestFree(felled.x, felled.y + 1);
  placeAt(game, free.x, free.y);
  game.autoGather = true;
  felled.depleted = true;
  assert.equal(game._autoGatherNext({ type: 'woodcut', obj: felled }, felled), true);
  const a = game.player.action;
  assert.ok(a && a.type === 'woodcut' && a.obj !== felled && a.obj.objId === 'tree', 'heads for another tree');
  // Off: nothing happens.
  game.player.clearAction();
  game.autoGather = false;
  game._tickContinuous({ type: 'woodcut', obj: felled }, felled, () => false);
  assert.ok(!game.player.action || game.player.action.obj !== a.obj);
});

test('each item gathered pops up over the player', () => {
  const game = newGame();
  const tree = game.world.objects.find((o) => o.objId === 'tree' && !o.depleted);
  const free = game._nearestFree(tree.x, tree.y + 1);
  placeAt(game, free.x, free.y);
  game.effects.length = 0;
  game._tickContinuous({ type: 'woodcut', obj: tree }, tree, () => { game.inventory.add('logs', 2); return true; });
  assert.ok(game.effects.some((e) => e.type === 'hitsplat' && e.text === '+2 Logs'), 'shows +2 Logs');
});

test('the Interact label warns when your level is too low and names the skill', () => {
  const game = newGame();
  const magic = game.world.objects.find((o) => o.objId === 'magic_tree');
  const plain = game.world.objects.find((o) => o.objId === 'tree');
  const low = game._interactLabel({ kind: 'obj', ref: magic });
  assert.equal(low[2], 'woodcutting');
  assert.equal(low[3], true);
  assert.match(low[1], /needs Woodcutting 75/);
  const ok = game._interactLabel({ kind: 'obj', ref: plain });
  assert.equal(ok[2], 'woodcutting');
  assert.equal(ok[3], false);
});

test('Go from a guide walks to the nearest spot, however far', () => {
  const game = newGame();
  assert.equal(game.goToNearest(['furnace']), true);
  assert.ok(game.player.action?.type === 'smeltmenu' || game.player.isMoving);
  assert.equal(game.goToNearest(['no_such_thing']), false);
});
