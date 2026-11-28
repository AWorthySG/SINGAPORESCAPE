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
  const scales = { C: [60, 62, 64, 65, 67, 69, 71, 72], F: [60, 62, 64, 65, 67, 69, 70, 72], G: [60, 62, 64, 66, 67, 69, 71, 72] };
  assert.equal(new Set(PIANO_SCORES.map(({ id }) => id)).size, PIANO_SCORES.length);
  for (const score of PIANO_SCORES) {
    const [count, beat] = score.timeSignature ?? [score.beatsPerBar, 4];
    assert.equal(score.beatsPerBar, count * 4 / beat, score.id);
    assert.deepEqual(score.measureStarts.slice(0, 1), [0], score.id);
    if (score.id in barCounts) assert.equal(score.measureStarts.length, barCounts[score.id], score.id);
    for (const { midi, beats } of score.notes) {
      assert.ok(scales[score.keySignature].includes(midi), score.id);
      assert.ok([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].includes(beats), score.id);
    }
    const last = score.measureStarts.length - 1;
    for (const [bar, start] of score.measureStarts.entries()) {
      const beats = score.notes.slice(start, score.measureStarts[bar + 1]).reduce((sum, note) => sum + note.beats, 0);
      assert.ok(beats > 0 && beats <= score.beatsPerBar, score.id + ' bar ' + (bar + 1));
      if (bar > 0 && bar < last) assert.equal(beats, score.beatsPerBar, score.id + ' bar ' + (bar + 1));
    }
  }
  assert.deepEqual(pitches(pianoScoreById('mary')).slice(0, 7), [64, 62, 60, 62, 64, 64, 64]);
  assert.deepEqual(pitches(pianoScoreById('twinkle')).slice(0, 7), [60, 60, 67, 67, 69, 69, 67]);
  assert.deepEqual(pitches(pianoScoreById('ode-to-joy')).slice(0, 8), [64, 64, 65, 67, 67, 65, 64, 62]);
  assert.ok(pitches(pianoScoreById('harbour-first-light')).includes(66));
  for (const id of [null, '', '__proto__', 'constructor']) assert.equal(pianoScoreById(id), null);
});

test('Row, Row, Row Your Boat and Jesus Loves Me both earn XP at a first Music stage', () => {
  const row = pianoScoreById('row-row-row-your-boat');
  const jesus = pianoScoreById('jesus-loves-me');
  assert.equal(row.name, 'Row, Row, Row Your Boat');
  assert.deepEqual(row.timeSignature, [6, 8]);
  assert.equal(row.measureStarts.length, 8);
  assert.deepEqual(pitches(row).slice(0, 5), [60, 60, 60, 62, 64]);
  assert.equal(jesus.name, 'Jesus Loves Me');
  assert.equal(jesus.measureStarts.length, 16);
  assert.deepEqual(pitches(jesus).slice(0, 7), [67, 64, 64, 62, 64, 67, 67]);
  assert.deepEqual(pitches(jesus).slice(jesus.measureStarts[8], jesus.measureStarts[10]), [67, 64, 67, 69, 72]);
  const game = freshGame();
  visitStage(game, STAGES[0]);
  for (const score of [row, jesus]) {
    assert.equal(score.level, 1);
    assert.equal(pianoLessonAvailable(game, score), true);
    const notes = pitches(score);
    assert.equal(finishPianoLesson(game, score.id, notes.slice(0, -1)), null);
    assert.equal(finishPianoLesson(game, score.id, notes).first, true);
    assert.equal(finishPianoLesson(game, score.id, notes).first, false);
  }
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
