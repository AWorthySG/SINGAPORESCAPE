import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANDINGS, VOYAGES } from '../src/data/islandlife.js';
import { SAILING_PRACTICE } from '../src/data/sailing.js';
import { xpForLevel } from '../src/data/xp.js';
import { Game } from '../src/game/game.js';
import {
  beginSailingPassage, finishVoyage, islandBook, islandClaimed, islandPractised, navigateSailingPassage,
  sailingPracticeRequirementsMet, takeChartedPassage, voyageRequirementsMet,
} from '../src/game/islandlife.js';
import { saveGame } from '../src/game/save.js';
import { sailingPassage } from '../src/game/sailing.js';
import { guideEntries } from '../src/game/skillguide.js';
import { COMBAT_LOCK_TICKS } from '../src/game/teleports.js';

function fresh(layout) {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const game = new Game({ layout });
  game.start();
  game.chooseClass('rogue');
  game.todayKey = () => '2026-11-28';
  return game;
}

function moor(game, dock) {
  const { x, y } = game.world.authoredTile(LANDINGS[dock]);
  game.player.x = game.player.tx = x;
  game.player.y = game.player.ty = y;
  game.updateRegion();
}

function pilot(game, passage) {
  let result;
  for (const leg of passage.legs) result = navigateSailingPassage(game, passage, leg.safe);
  return result;
}

test('route conditions stay fixed during an attempt and vary across new passages', () => {
  const route = VOYAGES[0];
  const start = sailingPassage(route, '2026-11-28', 0.1, 1);
  assert.deepEqual(start, sailingPassage(route, '2026-11-28', 0.1, 1));
  const later = sailingPassage(route, '2026-11-28', 0.4, 2);
  assert.equal(start.tide, 'Flood');
  assert.equal(later.tide, 'Ebb');
  assert.notDeepEqual(start.legs.map((leg) => leg.label), later.legs.map((leg) => leg.label));
  assert.ok(start.legs.every((leg) => leg.reading && leg.guide && (leg.safe === 0 || leg.safe === 1)));
  const practice = SAILING_PRACTICE[0];
  const flood = sailingPassage(practice, '2026-11-28', 0.1, 1, { practice: true });
  const ebb = sailingPassage(practice, '2026-11-28', 0.4, 1, { practice: true });
  assert.equal(flood.legs[2].safe, 1 - ebb.legs[2].safe, 'the same bend reverses the helm correction with the tide');
});

test('a wrong helm choice holds the marker and a guided charter still lands at the original dock', () => {
  const game = fresh();
  moor(game, 'changi');
  assert.equal(beginSailingPassage(game, 'ubin', { freight: true }), null);
  const passage = beginSailingPassage(game, 'ubin');
  const xp = game.skills.xp.sailing;
  assert.equal(navigateSailingPassage(game, passage, 1 - passage.legs[0].safe).outcome, 'recover');
  assert.equal(passage.values.length, 0);
  assert.equal(passage.corrections, 1);
  assert.equal(game.skills.xp.sailing, xp);
  assert.equal(pilot(game, passage).outcome, 'landed');
  assert.equal(game.currentZoneName, 'Pulau Ubin');
  assert.equal(navigateSailingPassage(game, passage, 0).outcome, 'closed');
  assert.deepEqual(islandBook(game).voyages, ['ubin']);
});

test('dock practice can earn experience twice on the same day and never claims freight coins', () => {
  const game = fresh();
  moor(game, 'changi');
  const coin = game.inventory.count('coins');
  const first = pilot(game, beginSailingPassage(game, 'changi_basics', { practice: true }));
  const repeat = pilot(game, beginSailingPassage(game, 'changi_basics', { practice: true }));
  assert.equal(first.outcome, 'trained');
  assert.equal(first.first, true);
  assert.equal(repeat.first, false);
  assert.ok(first.xp > repeat.xp && repeat.xp > 0);
  assert.ok(islandPractised(game, 'sailing', 'changi_basics'));
  assert.equal(game.inventory.count('coins'), coin);
  assert.equal(islandClaimed(game, 'freight:ubin'), false);
  assert.deepEqual(islandBook(game).voyages, []);
  assert.equal(saveGame(game), true);
  const loaded = new Game();
  loaded.start();
  assert.ok(islandPractised(loaded, 'sailing', 'changi_basics'));
});

test('advanced pilots respect their level, chart and dock and appear in the skill guide', () => {
  const game = fresh();
  for (const entry of SAILING_PRACTICE.slice(1)) {
    const open = () => beginSailingPassage(game, entry.id, { practice: true });
    moor(game, entry.from);
    game.skills.xp.sailing = xpForLevel(entry.level);
    assert.equal(open(), null, 'the chart is still required');
    islandBook(game).voyages.push(entry.requires);
    game.skills.xp.sailing = xpForLevel(entry.level - 1);
    assert.equal(open(), null, 'the skill level is still required');
    game.skills.xp.sailing = xpForLevel(entry.level);
    const passage = open();
    assert.ok(passage);
    assert.equal(pilot(game, passage).outcome, 'trained');
    assert.ok(guideEntries('sailing').some((row) => row.label === entry.name && row.level === entry.level));
  }
});

test('the Ubin certificate unlocks direct charted passage without XP or another freight payment', () => {
  const game = fresh();
  game.skills.xp.sailing = xpForLevel(25);
  moor(game, 'changi');
  assert.equal(finishVoyage(game, 'ubin', VOYAGES[0].course), true);
  assert.equal(finishVoyage(game, 'changi', VOYAGES[1].course), true);
  const freight = beginSailingPassage(game, 'ubin', { freight: true });
  assert.equal(pilot(game, freight).outcome, 'landed');
  assert.equal(takeChartedPassage(game, 'changi'), false);
  assert.equal(pilot(game, beginSailingPassage(game, 'ubin_creeks', { practice: true })).outcome, 'trained');
  const xp = game.skills.xp.sailing, coins = game.inventory.count('coins');
  assert.equal(takeChartedPassage(game, 'changi'), true);
  assert.equal(game.skills.xp.sailing, xp);
  assert.equal(game.inventory.count('coins'), coins);
  assert.equal(beginSailingPassage(game, 'ubin', { freight: true }), null);
  assert.ok(beginSailingPassage(game, 'ubin'));
});

test('a new attempt or leaving the dock closes the old passage before it awards anything', () => {
  const game = fresh();
  moor(game, 'changi');
  const first = beginSailingPassage(game, 'ubin');
  const latest = beginSailingPassage(game, 'ubin');
  assert.equal(navigateSailingPassage(game, first, first.legs[0].safe).outcome, 'closed');
  moor(game, 'marina');
  assert.equal(navigateSailingPassage(game, latest, latest.legs[0].safe).outcome, 'closed');
  assert.deepEqual(islandBook(game).voyages, []);
});

test('a transient combat lock still blocks boarding without invalidating dock requirements', () => {
  const game = fresh();
  moor(game, 'changi');
  game.teleports._hitTick = game.tickCount;
  const training = SAILING_PRACTICE[0];
  assert.equal(voyageRequirementsMet(game, VOYAGES[0]), true);
  assert.equal(sailingPracticeRequirementsMet(game, training), true);
  assert.equal(beginSailingPassage(game, 'ubin'), null);
  assert.equal(beginSailingPassage(game, training.id, { practice: true }), null);
  game.tickCount += COMBAT_LOCK_TICKS + 1;
  assert.ok(beginSailingPassage(game, training.id, { practice: true }));
});

test('the Changi dock is available once a stationary pursuer beyond its leash gives up', () => {
  const game = fresh('singapore');
  moor(game, 'changi');
  const ray = game.npcs.find((npc) => npc.npcId === 'estuarine_stingray'
    && Math.max(Math.abs(npc.spawnX - game.player.x), Math.abs(npc.spawnY - game.player.y)) === 24);
  assert.ok(ray);
  ray.x = ray.tx = ray.spawnX + 12;
  ray.y = ray.ty = ray.spawnY + 1;
  ray.target = game.player;
  ray.lastTargetTile = game.playerTile();
  assert.ok(game.teleports.blocked('voyage'));
  assert.equal(beginSailingPassage(game, 'ubin'), null);
  ray.tick(game);
  assert.equal(ray.target, null);
  assert.equal(game.teleports.blocked('voyage'), '');
  assert.ok(beginSailingPassage(game, 'ubin'));
});
