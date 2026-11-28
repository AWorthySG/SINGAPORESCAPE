import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAVE_KEY } from '../src/config.js';
import { CLUE_SPOTS } from '../src/data/clues.js';
import { geographicTile } from '../src/data/worldlayout.js';
import { Game } from '../src/game/game.js';
import { loadGame, saveGame, snapshot } from '../src/game/save.js';
import { START } from '../src/game/waves.js';

function startLegacy() {
  const data = new Map();
  globalThis.localStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const game = new Game({ layout: 'legacy' });
  game.start();
  game.chooseClass('rogue');
  return game;
}

function loadGeographic() {
  const game = new Game({ layout: 'singapore' });
  assert.equal(game.world.layout, 'singapore');
  assert.equal(loadGame(game), true);
  return game;
}

const point = ({ x, y }) => ({ x, y });
const translated = ({ x, y }) => geographicTile(x, y);

test('legacy character, home and activities migrate to the new map and persist across reload', () => {
  const old = startLegacy();
  const position = old._nearestFree(83, 55);
  const deathSite = old._nearestFree(88, 58);
  old._placePlayer(position.x, position.y);
  old.play.grave = { ...deathSite, left: 90, coins: 11, items: [{ id: 'logs', qty: 4 }] };
  old.home.load({ owned: true, tiers: { patches: 2 }, chest: [{ id: 'plank', qty: 8 }] });
  const farm = old.world.objects.find((o) => o.def.type === 'farm' && !o.home);
  const homePatch = old.world.objects.find((o) => o.def.type === 'farm' && o.home);
  Object.assign(farm, { crop: 'chilli', growLeft: 16 });
  Object.assign(homePatch, { crop: 'kangkong', growLeft: 21 });
  old.player.action = { type: 'farm', obj: homePatch };
  old.clue = { tier: 'easy', item: 'clue_scroll_easy', casket: 'reward_casket_easy', step: 1, spots: CLUE_SPOTS.slice(6, 8) };
  old.quests.rq_chinatown = { state: 'active', step: 1, n: 0 };
  old.stationsFound.add('chinatown');
  old.worldEvents.done = 5;
  old.worldEvents.weekly = { week: '2026-11-23', region: 'Chinatown', kills: 8, gathers: 3, events: 2, claimed: false };
  assert.equal(saveGame(old), true);
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).worldLayout, undefined);

  const game = loadGeographic();
  assert.notDeepEqual(translated(position), position);
  assert.deepEqual(point(game.player), translated(position));
  assert.deepEqual(game.play.grave, { ...old.play.grave, ...translated(deathSite) });
  assert.deepEqual(game.home.chest, old.home.chest);
  assert.deepEqual(game.clue, { ...old.clue, spots: old.clue.spots.map((spot) => ({ ...spot, ...translated(spot) })) });
  assert.equal(game.quests.rq_chinatown.state, 'active');
  assert.ok(game.stationsFound.has('chinatown'));
  assert.equal(game.worldEvents.done, 5);
  assert.deepEqual(game.worldEvents.weekly, old.worldEvents.weekly);

  for (const source of [farm, homePatch]) {
    const { x, y } = translated(source);
    const patch = game.world.objectAt(x, y);
    assert.equal(patch?.def.type, 'farm');
    assert.equal(patch.home, source.home);
    assert.equal(patch.crop, source.crop);
    assert.equal(patch.growLeft, source.growLeft);
  }
  assert.deepEqual(game.resumeTask, { kind: 'work', id: 'farm_patch', ...translated(homePatch) });

  assert.equal(saveGame(game), true);
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).worldLayout, 'singapore');
  const loadedAgain = loadGeographic();
  assert.deepEqual(point(loadedAgain.player), point(game.player));
  assert.deepEqual(loadedAgain.play.grave, game.play.grave);
  assert.deepEqual(loadedAgain.resumeTask, game.resumeTask);
  assert.deepEqual(loadedAgain.clue, game.clue);
  assert.deepEqual(snapshot(loadedAgain).farms, snapshot(game).farms);
});

test('legacy resume walks move with the destination and quest checkpoints keep their IDs', () => {
  const old = startLegacy();
  const destination = old._nearestFree(55, 93);
  old.player.path = [destination];
  assert.equal(saveGame(old), true);
  assert.deepEqual(loadGeographic().resumeTask, { kind: 'walk', id: undefined, ...translated(destination) });

  old.player.path = [];
  old.quests.rq_chinatown = { state: 'active', step: 0, n: 0 };
  old.autoQuestId = 'rq_chinatown';
  assert.equal(saveGame(old), true);
  assert.deepEqual(loadGeographic().resumeTask, { kind: 'quest', id: 'rq_chinatown' });
});

test('unmapped old arena coordinates fall back safely without losing grave contents', () => {
  const old = startLegacy();
  old._placePlayer(START.x, START.y);
  old.play.grave = { ...START, left: 100, coins: 85, items: [{ id: 'logs', qty: 2 }] };
  assert.equal(saveGame(old), true);
  const game = loadGeographic();
  assert.deepEqual(point(game.player), game.world.spawnPoint);
  assert.deepEqual(game.play.grave, { ...old.play.grave, ...game.world.respawnPoint });
});
