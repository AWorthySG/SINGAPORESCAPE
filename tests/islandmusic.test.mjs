import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAGES, TUNES } from '../src/data/islandlife.js';
import { MUSIC_PRACTICE_KEYS, musicBeatMs, musicBeatQuality, musicChartByKey, musicChartNotes, musicProjectChart, musicTuneChart } from '../src/data/islandmusic.js';
import { xpForLevel } from '../src/data/xp.js';
import { Game } from '../src/game/game.js';
import { atIslandSite, encoreNotes, finishIslandTune, islandBook, islandMusicAvailable, islandPractised, islandSiteTile, learnIslandTune, performIslandMusic } from '../src/game/islandlife.js';
import { saveGame } from '../src/game/save.js';
import { playMusicNote, startMusicAttempt } from '../src/ui/islandmusicui.js';

function setup(level, stage = STAGES[0]) {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const game = new Game(); game.start(); game.chooseClass('rogue');
  game.skills.xp.music = xpForLevel(level);
  game.skills.timeMult = () => 1;
  visit(game, stage);
  return game;
}

function visit(game, stage) {
  const { x, y } = islandSiteTile(game.world, stage);
  game.player.x = game.player.tx = x;
  game.player.y = game.player.ty = y;
  game.updateRegion();
  assert.equal(atIslandSite(game, stage), true);
}

test('guided notes survive mistakes and long pauses, with a one-time bonus and repeat completion XP', () => {
  const game = setup(3), chart = musicTuneChart('kopi');
  assert.equal(learnIslandTune(game, 'kopi'), true);
  const attempt = startMusicAttempt(chart);
  assert.equal(playMusicNote(attempt, 0, 0), true);
  assert.equal(playMusicNote(attempt, 2, 3), false);
  assert.deepEqual(attempt.notes, [0]);
  for (const note of [1, 2, 1]) assert.equal(playMusicNote(attempt, note, 60000), true);
  assert.deepEqual(attempt.timings, []);
  const expected = game.skills.xpAtLevel('music', chart.xp);
  const first = performIslandMusic(game, chart.key, attempt.notes);
  const repeat = performIslandMusic(game, chart.key, attempt.notes);
  assert.deepEqual([first.xp, repeat.xp], [expected * 1.5, expected]);
  assert.deepEqual([first.first, repeat.first], [true, false]);
  assert.deepEqual([first.tip, repeat.tip], [12, 0]);
  game.tickCount += 2;
  const later = performIslandMusic(game, chart.key, attempt.notes);
  assert.deepEqual([later.xp, later.tip], [expected, 12]);
  assert.equal(islandPractised(game, 'music', chart.key), true);
  assert.equal(performIslandMusic(game, chart.key, [0, 1, 1, 1]), null);
  assert.equal(finishIslandTune(game, 'kopi', chart.tune.notes, 20), false);
});

test('beat scoring rewards up to 25% without a timing failure, and resynchronizes after a missed beat', () => {
  const game = setup(3), chart = musicTuneChart('kopi');
  learnIslandTune(game, 'kopi');
  const notes = musicChartNotes(chart), beat = musicBeatMs(chart);
  performIslandMusic(game, chart.key, notes);
  const base = game.skills.xpAtLevel('music', chart.xp);
  const clean = [1, 2, 3, 4].map((step) => step * beat);
  const recovered = [1, 4, 5, 6].map((step) => step * beat);
  assert.equal(musicBeatQuality(chart, clean), 1);
  assert.equal(musicBeatQuality(chart, recovered), .75);
  assert.equal(musicBeatQuality(chart, [beat, Infinity, 4, 6]), 0);
  assert.equal(performIslandMusic(game, chart.key, notes, { mode: 'beat', timings: clean }).xp, base * 1.25);
  assert.equal(performIslandMusic(game, chart.key, notes, { mode: 'beat', timings: [0, 0, 0, 0] }).xp, base);
});

test('premium encores keep the main melody and can be claimed once daily across the stages', () => {
  const game = setup(8, STAGES[1]), tune = TUNES[0];
  const standard = musicTuneChart(tune.id), encore = musicTuneChart(tune.id, 'encore');
  assert.deepEqual(encoreNotes(tune).slice(0, tune.notes.length), tune.notes);
  assert.notDeepEqual(encoreNotes(tune), tune.notes);
  assert.equal(learnIslandTune(game, tune.id), true);
  assert.equal(performIslandMusic(game, encore.key, musicChartNotes(encore)), null);
  const main = performIslandMusic(game, standard.key, musicChartNotes(standard));
  const premium = performIslandMusic(game, encore.key, musicChartNotes(encore));
  assert.equal(premium.tip, main.tip * 3);
  assert.equal(premium.xp, main.xp * 2);
  assert.equal(performIslandMusic(game, encore.key, musicChartNotes(encore)), null);
  visit(game, STAGES[0]);
  assert.equal(islandMusicAvailable(game, encore), false);
});

test('higher arrangements and venue sets respect levels, locations and repertoire, and persist', () => {
  const game = setup(24, STAGES[1]);
  learnIslandTune(game, 'kopi');
  const variation = musicTuneChart('kopi', 'variation'), duet = musicTuneChart('kopi', 'duet');
  assert.equal(islandMusicAvailable(game, variation), false);
  game.skills.xp.music = xpForLevel(25);
  assert.equal(islandMusicAvailable(game, variation), true);
  assert.equal(islandMusicAvailable(game, duet), false);
  const variationResult = performIslandMusic(game, variation.key, musicChartNotes(variation));
  assert.deepEqual([variationResult.first, variationResult.tip], [true, 0]);
  game.skills.xp.music = xpForLevel(50);
  const duetResult = performIslandMusic(game, duet.key, musicChartNotes(duet));
  assert.deepEqual([duetResult.first, duetResult.tip], [true, 0]);
  const set = musicProjectChart('hawker-set'), festival = musicProjectChart('festival-set');
  game.skills.xp.music = xpForLevel(75);
  assert.equal(islandMusicAvailable(game, set), false);
  for (const id of ['kopi', 'harbour', 'rain', 'lanterns']) {
    learnIslandTune(game, id);
    const song = musicTuneChart(id);
    assert.ok(performIslandMusic(game, song.key, musicChartNotes(song)));
  }
  assert.equal(performIslandMusic(game, set.key, musicChartNotes(set)).tip, 0);
  assert.equal(islandMusicAvailable(game, festival), false);
  game.skills.xp.music = xpForLevel(99);
  visit(game, STAGES[2]);
  assert.equal(islandMusicAvailable(game, festival), false);
  visit(game, STAGES[1]);
  assert.equal(performIslandMusic(game, festival.key, musicChartNotes(festival)).first, true);
  saveGame(game);
  const loaded = new Game(); loaded.start();
  assert.equal(islandPractised(loaded, 'music', festival.key), true);
  assert.ok(islandBook(loaded).performed.includes('lanterns'));
});

test('the score catalogue has finite distinct practice keys and rejects malformed or prototype IDs', () => {
  assert.equal(MUSIC_PRACTICE_KEYS.length, new Set(MUSIC_PRACTICE_KEYS).size);
  for (const key of MUSIC_PRACTICE_KEYS) assert.ok(musicChartNotes(musicChartByKey(key)).length > 0);
  for (const key of [null, '', 'tune:kopi', 'tune:__proto__:standard', 'tune:kopi:constructor', 'project:hawker-set:extra']) assert.equal(musicChartByKey(key), null);
  assert.equal(musicTuneChart('constructor'), null);
});
