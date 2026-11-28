import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STAGES } from '../src/data/islandlife.js';
import { PIANO_SCORES, pianoScoreById } from '../src/data/piano.js';
import { xpForLevel } from '../src/data/xp.js';
import { Game } from '../src/game/game.js';
import { atIslandSite, finishPianoLesson, islandBook, islandPractised, islandSiteTile, pianoLessonAvailable } from '../src/game/islandlife.js';
import { saveGame } from '../src/game/save.js';

function freshGame() {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const game = new Game();
  game.start();
  game.chooseClass('rogue');
  game.skills.timeMult = () => 1;
  return game;
}

function visitStage(game, stage) {
  const { x, y } = islandSiteTile(game.world, stage);
  game.player.x = game.player.tx = x;
  game.player.y = game.player.ty = y;
  game.updateRegion();
  assert.equal(atIslandSite(game, stage), true);
}

const pitches = (score) => score.notes.map(({ midi }) => midi);

test('piano scores cover complete arrangements in their written metres and fit the keyboard', () => {
  const barCounts = {
    mary: 8, twinkle: 12, 'ode-to-joy': 16, 'harbour-first-light': 8,
    'kampong-glam-rain': 16, 'pulau-ubin-ferry': 16, 'botanic-gardens-nocturne': 20, 'singapore-river-finale': 24,
  };
  const scales = { C: [60, 62, 64, 65, 67, 69, 71, 72], G: [60, 62, 64, 66, 67, 69, 71, 72] };
  assert.deepEqual(PIANO_SCORES.map(({ id }) => id), Object.keys(barCounts));
  for (const score of PIANO_SCORES) {
    let inBar = 0, bars = 0;
    for (const { midi, beats } of score.notes) {
      assert.ok(scales[score.keySignature].includes(midi), score.id);
      assert.ok([0.5, 1, 1.5, 2, 3, 4].includes(beats), score.id);
      inBar += beats;
      assert.ok(inBar <= score.beatsPerBar, score.id);
      if (inBar === score.beatsPerBar) {
        bars++;
        inBar = 0;
      }
    }
    assert.equal(bars, barCounts[score.id], score.id);
    assert.equal(inBar, 0, score.id);
  }
  assert.deepEqual(pitches(pianoScoreById('mary')).slice(0, 7), [64, 62, 60, 62, 64, 64, 64]);
  assert.deepEqual(pitches(pianoScoreById('twinkle')).slice(0, 7), [60, 60, 67, 67, 69, 69, 67]);
  assert.deepEqual(pitches(pianoScoreById('ode-to-joy')).slice(0, 8), [64, 64, 65, 67, 67, 65, 64, 62]);
  assert.ok(pitches(pianoScoreById('harbour-first-light')).includes(66));
  for (const id of [null, '', '__proto__', 'constructor']) assert.equal(pianoScoreById(id), null);
});

test('the four advanced piano scores lengthen with each Music milestone and remain repeatable', () => {
  const game = freshGame();
  visitStage(game, STAGES[0]);
  const advanced = PIANO_SCORES.filter(({ level }) => level >= 25);
  assert.deepEqual(advanced.map(({ level, xp }) => [level, xp]), [[25, 190], [50, 490], [75, 1150], [99, 2050]]);
  let previousNoteCount = 0;
  for (const score of advanced) {
    const notes = pitches(score);
    assert.ok(notes.length > previousNoteCount, score.id);
    previousNoteCount = notes.length;
    game.skills.xp.music = xpForLevel(score.level) - 1;
    assert.equal(finishPianoLesson(game, score.id, notes), null, score.id);
    game.skills.xp.music = xpForLevel(score.level);
    const first = finishPianoLesson(game, score.id, notes);
    const repeat = finishPianoLesson(game, score.id, notes);
    assert.equal(first.first, true, score.id);
    assert.equal(repeat.first, false, score.id);
    assert.ok(first.xp > repeat.xp && repeat.xp >= score.xp, score.id);
  }
});

test('piano XP requires the entire score at an available venue and the score music level', () => {
  const game = freshGame();
  const mary = pianoScoreById('mary');
  const twinkle = pianoScoreById('twinkle');
  const notes = pitches(mary);
  assert.equal(pianoLessonAvailable(game, mary), false);
  assert.equal(finishPianoLesson(game, mary.id, notes), null);
  visitStage(game, STAGES[1]);
  assert.equal(pianoLessonAvailable(game, mary.id), false);
  visitStage(game, STAGES[0]);
  assert.equal(pianoLessonAvailable(game, mary.id), true);
  assert.equal(pianoLessonAvailable(game, { ...twinkle, level: 1 }), false);
  assert.equal(finishPianoLesson(game, twinkle.id, pitches(twinkle)), null);
  assert.equal(finishPianoLesson(game, '__proto__', notes), null);
  assert.equal(finishPianoLesson(game, mary.id, notes.slice(0, -1)), null);
  assert.equal(finishPianoLesson(game, mary.id, [60, ...notes.slice(1)]), null);
  assert.equal(finishPianoLesson(game, mary.id, [...notes, 60]), null);
  assert.equal(finishPianoLesson(game, mary.id, notes.map(String)), null);
  game.teleports._hitTick = game.tickCount;
  assert.equal(finishPianoLesson(game, mary.id, notes), null);
  assert.equal(game.skills.xp.music, 0);
  assert.equal(islandPractised(game, 'music', 'piano:mary'), false);
  game.teleports._hitTick = -Infinity;
  game.skills.xp.music = xpForLevel(twinkle.level);
  visitStage(game, STAGES[1]);
  assert.ok(finishPianoLesson(game, twinkle.id, pitches(twinkle))?.xp > 0);
});

test('piano first-clear bonus survives saving, and repeated full scores grant Music XP', () => {
  const game = freshGame();
  visitStage(game, STAGES[0]);
  const mary = pianoScoreById('mary');
  const notes = pitches(mary);
  const base = game.skills.xpAtLevel('music', mary.xp);
  const coins = [game.inventory.count('coins'), game.bank.count('coins')];
  assert.deepEqual(finishPianoLesson(game, mary.id, notes), { xp: base * 1.5, first: true });
  assert.deepEqual(finishPianoLesson(game, mary.id, notes), { xp: base, first: false });
  assert.equal(game.skills.xp.music, base * 2.5);
  assert.deepEqual(islandBook(game).performed, []);
  assert.equal(islandBook(game).daily, null);
  assert.deepEqual([game.inventory.count('coins'), game.bank.count('coins')], coins);
  saveGame(game);
  const loaded = new Game();
  loaded.start();
  loaded.skills.timeMult = () => 1;
  assert.equal(islandPractised(loaded, 'music', 'piano:mary'), true);
  assert.deepEqual(finishPianoLesson(loaded, mary.id, notes), { xp: base, first: false });
});
