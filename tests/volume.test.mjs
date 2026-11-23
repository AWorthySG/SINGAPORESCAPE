// Separate volume levels for the sound effects and the background music
// (src/audio/sfx.js), under the overall volume, kept between visits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sfx } from '../src/audio/sfx.js';

// A pretend Web Audio: just enough nodes to see where each sound is routed.
function fakeAudio() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = (extra = {}) => ({ gain: param(), frequency: param(), out: [], connect(n) { this.out.push(n); return n; }, start() {}, stop() {}, ...extra });
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = node(); }
    createGain() { return node(); }
    createOscillator() { return node({ type: 'sine' }); }
    createBiquadFilter() { return node({ type: '', Q: param() }); }
    createBuffer(c, n) { const d = new Float32Array(n); return { length: n, getChannelData: () => d }; }
    createBufferSource() { return node({ buffer: null }); }
    resume() { return Promise.resolve(); }
  }
  globalThis.window = { AudioContext: Ctx };
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const bus = () => ({ on() {} });
// The music and ambience run on timers; the test keeps them from starting so
// node can exit (their ticks aren't what is tested here).
globalThis.setInterval = () => 0;

test('the sound effects and the music each have their own volume, under the overall one', () => {
  fakeAudio();
  const a = new Sfx(bus());
  assert.equal(a.sfxVolume, 1); assert.equal(a.musicVolume, 1);
  a.unlock();
  const music0 = a.musicGain.gain.value;
  assert.ok(music0 > 0);
  // Effects go through their own gain, into the master; the music has its own.
  a._tone(440, 0.1);
  const lastTone = a.sfxGain.out.length;
  assert.equal(a.sfxGain.out[0], a.master);
  assert.equal(lastTone, 1, 'the sfx gain feeds the master');
  a.setSfxVolume(0.3);
  assert.equal(a.sfxGain.gain.value, 0.3);
  assert.equal(a.musicGain.gain.value, music0, 'the music is untouched');
  a.setMusicVolume(0.5);
  assert.ok(Math.abs(a.musicGain.gain.value - music0 * 0.5) < 1e-9);
  assert.equal(a.sfxGain.gain.value, 0.3, 'the effects are untouched');
  // Music off is still off whatever its slider says, and back at its level when on.
  a.toggleMusic(); assert.equal(a.musicGain.gain.value, 0);
  a.toggleMusic(); assert.ok(Math.abs(a.musicGain.gain.value - music0 * 0.5) < 1e-9);
  // Out-of-range values are held to 0..1.
  a.setSfxVolume(7); assert.equal(a.sfxVolume, 1);
  a.setMusicVolume(-1); assert.equal(a.musicVolume, 0);
  // Kept for next time.
  a.setSfxVolume(0.25); a.setMusicVolume(0.75);
  const b = new Sfx(bus());
  assert.equal(b.sfxVolume, 0.25); assert.equal(b.musicVolume, 0.75);
  b.unlock();
  assert.equal(b.sfxGain.gain.value, 0.25);
  assert.ok(Math.abs(b.musicGain.gain.value - music0 * 0.75) < 1e-9);
});

test('without Web Audio the sliders still remember their levels', () => {
  const m = new Map();
  globalThis.window = {};
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const a = new Sfx(bus());
  a.unlock();
  a.setSfxVolume(0.4); a.setMusicVolume(0.6);
  assert.equal(a.sfxVolume, 0.4); assert.equal(a.musicVolume, 0.6);
});
