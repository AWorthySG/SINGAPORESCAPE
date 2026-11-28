import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileTheme, REGION_DWELL_SECONDS, REGION_FADE_SECONDS, RegionMusic, scheduleMusicNotes } from '../src/audio/regionMusic.js';

const river = {
  title: 'By the water', bpm: 80, lead: 'flute', pattern: 'tide',
  chords: [[43, 55, 59, 62], [40, 55, 59, 64], [41, 53, 57, 60], [43, 55, 57, 62]],
  melody: [[[0.5, 67, 1, 0.65], [2.75, 74, 0.75]], [[0, 72, 1.5]], [], [[1, 69, 1.8]]],
};
const city = { ...river, title: 'City at dusk', lead: 'keys', pattern: 'gentle' };
const forest = { ...river, title: 'Forest at noon', lead: 'mallet', pattern: 'still' };
const themes = { river, city, forest };

function audio() {
  const oscillators = [];
  const audioParam = () => ({
    value: 0, events: [],
    setValueAtTime(value, time) { this.events.push(['set', value, time]); },
    linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); },
    exponentialRampToValueAtTime(value, time) { this.events.push(['exp', value, time]); },
    cancelScheduledValues(time) { this.events.push(['cancel', time]); },
  });
  const node = (param) => ({
    [param]: audioParam(), connections: [],
    connect(other) { this.connections.push(other); },
    disconnect() { this.connections.length = 0; },
  });
  const ctx = {
    currentTime: 0, sampleRate: 48000, state: 'running',
    createGain: () => node('gain'),
    createOscillator() {
      const osc = { ...node('frequency'), start(at) { this.startAt = at; }, stop(at) { this.stopAt = at; } };
      oscillators.push(osc);
      return osc;
    },
  };
  const output = ctx.createGain();
  const player = new RegionMusic(ctx, output, (zone) => themes[zone]);
  const at = (time, zone, audible) => { ctx.currentTime = time; player.update(zone, audible); };
  return { ctx, oscillators, output, player, at };
}

test('themes preserve the authored melody, leave its rests and sustain common chord tones', () => {
  const { notes, duration, phraseDuration } = compileTheme(river);
  assert.equal(phraseDuration, 12);
  assert.equal(duration, 24);
  const melody = notes.filter((note) => note.voice === 'flute');
  const lead = melody.filter((note) => note.time < phraseDuration);
  const returnLead = melody.filter((note) => note.time >= phraseDuration);
  assert.deepEqual(lead.map((note) => [note.time, note.midi, note.velocity]), [
    [0.375, 67, 0.65], [2.0625, 74, 0.8], [3, 72, 0.8], [9.75, 69, 0.8],
  ]);
  assert.equal(returnLead.length, 3, 'the return is less busy');
  assert.ok(returnLead.every((note) => lead.some((original) =>
    original.time + phraseDuration === note.time && original.midi === note.midi && original.velocity > note.velocity)));
  const common = notes.filter((note) => note.voice === 'pad' && note.midi === 55);
  assert.equal(common.filter((note) => note.time < 6).length, 1);
  assert.ok(common[0].duration > 5.5, 'one held note connects the first two chords');
  assert.ok(notes.every((note, index) => index === 0 || note.time >= notes[index - 1].time));
  assert.notDeepEqual(notes.filter((note) => note.voice === 'backing'), compileTheme(city).notes.filter((note) => note.voice === 'backing'));
});

test('the synthesiser schedules note envelopes and ends every oscillator', () => {
  const { ctx, output, oscillators } = audio();
  scheduleMusicNotes(ctx, output, [{ time: 0.5, midi: 69, duration: 1.4, velocity: 0.75, voice: 'flute' }], 2);
  const [lead, vibrato] = oscillators;
  assert.equal(lead.frequency.events[0][1], 440);
  assert.equal(vibrato.frequency.value, 5.1);
  assert.ok(oscillators.every((osc) => osc.startAt === 2.5 && osc.stopAt > 3.9));
  const envelope = lead.connections[0];
  assert.equal(envelope.connections[0], output);
  assert.ok(envelope.gain.events.some(([kind, value]) => kind === 'linear' && value > 0));
  lead.onended();
  assert.equal(envelope.connections.length, 0);
  assert.equal(lead.connections.length, 0);
});

test('short visits do not switch the music, stable regions crossfade and old tracks retire', () => {
  const { output, player, at } = audio();
  at(0, 'river');
  const old = player.active;
  at(0.12, 'city');
  at(0.60, 'river');
  assert.equal(player.active, old);
  at(1, 'city');
  at(1 + REGION_DWELL_SECONDS + 0.01, 'city');
  assert.equal(player.active.score, city);
  assert.equal(player.active.gain.connections[0], output);
  assert.equal(player.outgoing, old);
  assert.deepEqual(old.gain.gain.events.at(-1), ['linear', 0, old.retireAt]);
  assert.equal(old.retireAt, player.active.fadeStart + REGION_FADE_SECONDS);
  const retireAt = old.retireAt;
  const oldVoices = [...old.voices];
  at(2, 'forest');
  at(3, 'forest');
  assert.equal(player.active.score, city, 'only one outgoing track at a time');
  at(retireAt + 0.01, 'forest');
  assert.equal(old.gain.connections.length, 0);
  assert.equal(old.voices.size, 0);
  assert.ok(oldVoices.every((osc) => osc.stopAt === retireAt + 0.01));
  assert.equal(player.active.score, forest);
  assert.equal(player.outgoing.score, city);
});

test('mute tracks regions without oscillators and re-entry picks the current score', () => {
  const { oscillators, player, at } = audio();
  at(0, 'river', false);
  const old = player.active;
  at(0.8, 'city', false);
  assert.equal(oscillators.length, 0);
  at(0.9, 'city');
  assert.equal(player.active.score, city);
  assert.equal(player.outgoing, null);
  assert.equal(old.gain.connections.length, 0);
  assert.ok(oscillators.length > 0);
});

test('undisturbed loops and a late tick schedule only the next audible onsets', () => {
  const { ctx, oscillators, player, at } = audio();
  at(0, 'river');
  const first = oscillators.length;
  at(0, 'river');
  assert.equal(oscillators.length, first, 'repeated observations do not replay scheduled notes');
  at(23.8, 'river');
  const loop = player.active.start + compileTheme(river).duration;
  assert.ok(oscillators.slice(first).some((osc) => osc.startAt === loop), 'a repeat begins on the exact next bar');

  ctx.state = 'suspended';
  const beforePause = oscillators.length;
  at(24, 'river');
  assert.equal(oscillators.length, beforePause);
  ctx.state = 'running';
  at(300.1, 'river');
  const afterPause = oscillators.slice(beforePause);
  assert.ok(afterPause.length > 0);
  assert.ok(afterPause.every((osc) => osc.startAt >= 300.1 && osc.startAt < 301.35));
});
