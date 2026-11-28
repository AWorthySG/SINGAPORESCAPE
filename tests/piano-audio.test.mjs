import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Piano, pianoSample } from '../src/audio/piano.js';
import { Sfx } from '../src/audio/sfx.js';

function energy(tone, start, end) {
  const { samples, sampleRate } = tone, from = Math.round(start * sampleRate), to = Math.round(end * sampleRate);
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] ** 2;
  return Math.sqrt(sum / (to - from));
}

function amplitude(tone, frequency, start, end) {
  const { samples, sampleRate } = tone, from = Math.round(start * sampleRate), to = Math.round(end * sampleRate);
  const radianStep = Math.PI * 2 * frequency / sampleRate;
  let sine = 0, cosine = 0;
  for (let i = from; i < to; i++) {
    sine += samples[i] * Math.sin(radianStep * i);
    cosine += samples[i] * Math.cos(radianStep * i);
  }
  return Math.hypot(sine, cosine) / (to - from);
}

function audioContext() {
  const sources = [], buffers = [];
  const node = () => ({ links: [], connect(out) { this.links.push(out); }, disconnect() { this.links.length = 0; } });
  return {
    state: 'running', currentTime: 3, buffers, sources,
    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      const buffer = { channels, length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
      buffers.push(buffer);
      return buffer;
    },
    createGain() {
      const events = [];
      return { ...node(), gain: { events, value: 1, cancelScheduledValues() {},
        setValueAtTime(value, time) { events.push([value, time]); }, linearRampToValueAtTime(value, time) { events.push([value, time]); } } };
    },
    createBufferSource() {
      const source = { ...node(), start(time) { this.started = time; }, stop(time) { this.stopped = time; } };
      sources.push(source);
      return source;
    },
  };
}

test('middle C to upper C have tuned, bright strikes and a softer ringing tail', () => {
  for (const midi of [60, 61, 69, 72]) {
    const tone = pianoSample(midi), frequency = 440 * 2 ** ((midi - 69) / 12);
    assert.ok(tone.samples.length > 2 * tone.sampleRate);
    assert.equal(Math.abs(tone.samples[0]), 0, 'starts without a click');
    assert.equal(Math.abs(tone.samples.at(-1)), 0, 'the tail ends at silence');
    assert.ok(tone.samples.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= .4));
    assert.ok(amplitude(tone, frequency, .10, .28) > 5 * amplitude(tone, frequency * .944, .10, .28), 'pitch peaks around the intended key');
    assert.ok(amplitude(tone, frequency * 3, .01, .08) > 5 * amplitude(tone, frequency * 3, .6, .7), 'the upper harmonics fade first');
    assert.ok(energy(tone, .01, .034) > 0.05, 'the hammer speaks immediately');
    assert.ok(energy(tone, .02, .12) > 2 * energy(tone, .7, .8));
    assert.ok(energy(tone, 1.1, 1.2) > energy(tone, 1.9, 2), 'the lower modes keep ringing');
  }
  for (const value of [59, 73, 60.5, NaN, '60', null]) assert.equal(pianoSample(value), null);
});

test('piano notes overlap and reuse buffers, with older voices faded when the pool fills', () => {
  const ctx = audioContext(), output = ctx.createGain(), piano = new Piano(ctx, output);
  assert.equal(piano.play(60), true);
  assert.equal(piano.play(64), true);
  assert.equal(piano.play(67), true);
  assert.equal(piano.play(60), true);
  assert.equal(ctx.buffers.length, 3);
  assert.equal(ctx.sources[0].buffer, ctx.sources[3].buffer);
  assert.ok(ctx.sources.every((source) => source.links[0].links[0] === output && source.started === 3 && !source.stopped));
  for (let i = 0; i < 13; i++) piano.play(60);
  assert.ok(ctx.sources[0].stopped > 3, 'oldest voice receives a short fade before stopping');
  assert.equal(ctx.sources[1].stopped, undefined);
  assert.equal(piano.voices.size, 16);
  ctx.sources.at(-1).onended();
  assert.equal(piano.voices.size, 15);
  assert.equal(ctx.sources.at(-1).links.length, 0);
});

test('a recorded key duration releases the sound smoothly before the natural tail', () => {
  const ctx = audioContext(), piano = new Piano(ctx, ctx.createGain());
  assert.equal(piano.play(69, 0.4), true);
  const voice = ctx.sources[0];
  const events = voice.links[0].gain.events;
  assert.deepEqual(events, [[1, 3.4], [0, 3.4 + 0.11]]);
  assert.equal(voice.stopped, 3.4 + 0.11);
  assert.equal(piano.play(69, 5), true);
  assert.equal(ctx.sources[1].stopped, undefined, 'a long key does not extend the sound beyond the sample');
});

test('Sfx piano uses the gesture-unlocked context and the effects bus, respecting silence settings', () => {
  const audio = new Sfx({ on() {} });
  assert.equal(audio.playPiano(60), false, 'a piano note never creates an audio context');
  const ctx = audioContext();
  audio.ctx = ctx;
  audio.sfxGain = ctx.createGain();
  audio.master = ctx.createGain();
  audio.sfxGain.connect(audio.master);
  ctx.state = 'suspended';
  assert.equal(audio.playPiano(60), false, 'no automatic playback before a gesture');
  ctx.state = 'running';
  audio.setMuted(true);
  assert.equal(audio.playPiano(61), false);
  audio.setMuted(false);
  audio.setVolume(0);
  assert.equal(audio.playPiano(62), false);
  audio.setVolume(1);
  audio.setSfxVolume(0);
  assert.equal(audio.playPiano(63), false);
  audio.setSfxVolume(.4);
  assert.equal(audio.playPiano(73), false);
  assert.equal(ctx.sources.length, 0);
  assert.equal(audio.playPiano(64), true);
  assert.equal(ctx.sources[0].links[0].links[0], audio.sfxGain);
  assert.equal(audio.sfxGain.gain.value, .4);
  assert.equal(audio.master.gain.value, .16);
});
