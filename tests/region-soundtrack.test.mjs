import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { Sfx } from '../src/audio/sfx.js';
import { compileTheme } from '../src/audio/regionMusic.js';
import { MUSIC_THEMES, musicTheme } from '../src/audio/musicThemes.js';

test('the playable map and arenas each have their own soundtrack', () => {
  const game = new Game({ layout: 'singapore' });
  const regions = game.world.zones.map(({ name }) => name);
  assert.deepEqual(Object.keys(MUSIC_THEMES).sort(), ['Singapore', ...regions].sort());
  assert.equal(new Set(Object.values(MUSIC_THEMES).map(({ title }) => title)).size, regions.length + 1);
  assert.equal(musicTheme(undefined), musicTheme('Singapore'));
  assert.equal(musicTheme('constructor'), musicTheme('Singapore'));
});

test('each theme compiles to an original loop with valid notes at a gentle tempo', () => {
  const loops = new Set();
  for (const [region, score] of Object.entries(MUSIC_THEMES)) {
    assert.ok(score.bpm >= 56 && score.bpm <= 84, region);
    assert.equal(score.melody.length, score.chords.length, region);
    assert.ok(score.chords.length === 4 || score.chords.length === 8, region);
    for (const chord of score.chords) {
      assert.ok(chord.length >= 3 && chord.every((pitch) => Number.isInteger(pitch)), region);
    }
    for (const bar of score.melody) {
      for (const [beat, pitch, length, velocity = 1] of bar) {
        assert.ok(beat >= 0 && beat < 4 && length > 0, region);
        assert.ok(Number.isInteger(pitch) && pitch >= 48 && pitch <= 88, region);
        assert.ok(velocity > 0 && velocity <= 1, region);
      }
    }
    const loop = compileTheme(score);
    assert.ok(loop.duration > 0 && loop.notes.length > 0, region);
    assert.ok(loop.notes.every(({ time, duration }) => time >= 0 && time < loop.duration && duration > 0), region);
    loops.add(JSON.stringify(loop));
  }
  assert.equal(loops.size, Object.keys(MUSIC_THEMES).length);
});

test('the mixer observes map changes while music is off and skips suspended contexts', () => {
  const audio = new Sfx({ on() {} });
  let region = 'Kampong Glam';
  const updates = [];
  audio.music = { update: (...args) => updates.push(args) };
  audio.musicSource = () => region;
  audio.ctx = { state: 'suspended' };
  audio._musicTick();
  audio.ctx.state = 'running';
  audio._musicTick();
  audio.musicOn = false;
  region = 'Sentosa Beach';
  audio._musicTick();
  audio.musicOn = true;
  audio.musicVolume = 0;
  audio._musicTick();
  audio.musicVolume = 0.5;
  audio.muted = true;
  audio._musicTick();
  audio.muted = false;
  audio._musicTick();
  assert.deepEqual(updates, [
    ['Kampong Glam', true],
    ['Sentosa Beach', false],
    ['Sentosa Beach', false],
    ['Sentosa Beach', false],
    ['Sentosa Beach', true],
  ]);
});
