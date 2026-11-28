// The sounds of a fight (src/audio/sfx.js): rate-limited, varied, rounder, with
// a kill combo, so a long auto battle is pleasant to listen to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sfx } from '../src/audio/sfx.js';
import { ACTION_SOUNDS } from '../src/audio/actionSounds.js';
import { ABILITY_SOUNDS, HURT_SOUNDS, IMPACT_SOUNDS } from '../src/audio/combatSounds.js';
import { ELEMENTS } from '../src/data/magic.js';

// A pretend Web Audio that records every node made and where it connects.
function fakeAudio() {
  const made = [];
  const param = () => { const ev = []; return { ev, value: 0, setValueAtTime: (v, t) => ev.push(['set', v, t]), linearRampToValueAtTime: (v, t) => ev.push(['lin', v, t]), exponentialRampToValueAtTime: (v, t) => ev.push(['exp', v, t]), setTargetAtTime: (v, t) => ev.push(['target', v, t]) }; };
  const node = (kind, extra = {}) => { const n = { kind, gain: param(), frequency: param(), Q: param(), out: [], connect(to) { this.out.push(to); return to; }, start() {}, stop() {}, ...extra }; made.push(n); return n; };
  class Ctx {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = node('dest'); }
    createGain() { return node('gain'); }
    createOscillator() { return node('osc', { type: 'sine' }); }
    createBiquadFilter() { return node('filter', { type: '' }); }
    createBuffer(c, n) { const d = new Float32Array(n); return { length: n, getChannelData: () => d }; }
    createBufferSource() { return node('noise', { buffer: null }); }
    resume() { return Promise.resolve(); }
  }
  globalThis.window = { AudioContext: Ctx };
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  return made;
}
const bus = () => ({ on() {} });
// The music and ambience run on timers; keep them from starting so node can exit.
globalThis.setInterval = () => 0;

function setup() {
  const made = fakeAudio();
  const s = new Sfx(bus());
  s.unlock();
  made.length = 0;   // forget the music's own nodes
  return { s, made };
}
const voices = (made) => made.filter((n) => n.kind === 'osc' || n.kind === 'noise');
const oscs = (made) => made.filter((n) => n.kind === 'osc');
const startHz = (o) => o.frequency.ev[0][1];

test('the same sound asked for again within its window plays once, then again after it', () => {
  const { s, made } = setup();
  s.play('hit');
  const one = voices(made).length;
  assert.ok(one > 0);
  // An Archer's volley: eighteen hits in the same instant.
  for (let i = 0; i < 17; i++) s.play('hit');
  assert.equal(voices(made).length, one, 'the rest of the volley adds nothing');
  s.ctx.currentTime = 0.05; s.play('hit');
  assert.equal(voices(made).length, one, 'still inside the window');
  s.ctx.currentTime = 0.2; s.play('hit');
  assert.ok(voices(made).length > one, 'a later blow sounds again');
  // Swings of every weapon share one window.
  made.length = 0;
  s.ctx.currentTime = 1; s.play('atk:sword'); s.play('atk:dagger'); s.play('atk:sword');
  const swing = voices(made).length;
  s.ctx.currentTime = 1.2; s.play('atk:dagger');
  assert.ok(voices(made).length > swing);
});

test('a hit on the same beat as its swing is just the thump, and a crit stands in for the hit', () => {
  const { s, made } = setup();
  s.play('hit');
  assert.equal(made.filter((n) => n.kind === 'noise').length, 1, 'a hit on its own has its crack');
  made.length = 0;
  s.ctx.currentTime = 1; s.play('atk:sword'); const swing = made.filter((n) => n.kind === 'noise').length;
  s.play('hit');
  assert.equal(made.filter((n) => n.kind === 'noise').length, swing, 'the swing gave the whoosh');
  made.length = 0;
  s.ctx.currentTime = 2; s.play('crit'); const crit = voices(made).length;
  s.play('hit');
  assert.equal(voices(made).length, crit, 'no ordinary hit over the crit');
  assert.ok(made.filter((n) => n.kind === 'noise').length >= 2, 'the crit crunches twice');
  // Crits on beat after beat (an Archer's volleys): the crunch now and then, plain hits between.
  made.length = 0; s.ctx.currentTime = 2.3; s.play('crit');
  assert.ok(voices(made).length > 0 && voices(made).length < crit, 'a crit straight after another lands as a hit');
  made.length = 0; s.ctx.currentTime = 2.6; s.play('crit');
  assert.equal(voices(made).length, crit, 'half a second on, the crunch again');
});

test('a tick of loot pickups is one soft blip, and a long stream of them fades back', () => {
  const { s, made } = setup();
  for (let i = 0; i < 6; i++) s.play('pickup');
  assert.equal(oscs(made).length, 1, 'six things swept up at once: one sound');
  const peak = (o) => Math.max(...o.out[0].gain.ev.map((e) => e[1]));   // the level of the gain each tone feeds
  const first = peak(oscs(made)[0]);
  for (let t = 1; t <= 6; t++) { s.ctx.currentTime = t * 0.6; s.play('pickup'); }
  const later = oscs(made).map(peak);
  assert.equal(later.length, 7, 'one a tick');
  assert.ok(later[6] < first * 0.6, `a long run is quieter (${later[6]} vs ${first})`);
  s.ctx.currentTime = 20; s.play('pickup');
  assert.equal(peak(oscs(made).at(-1)), first, 'full again after a pause');
});

test('kills in quick succession climb in pitch, and drop back after a pause', () => {
  const { s, made } = setup();
  // The kill's pop is its last tone.
  const pop = () => { made.length = 0; s.play('die'); return startHz(oscs(made).at(-1)); };
  const run = [];
  for (let i = 0; i < 5; i++) { s.ctx.currentTime = i * 0.8; run.push(pop()); }
  assert.equal(s.combo, 4);
  for (let i = 1; i < run.length; i++) assert.ok(run[i] > run[i - 1], `kill ${i + 1} is higher (${run.map(Math.round)})`);
  s.ctx.currentTime = 10;
  const again = pop();
  assert.equal(s.combo, 0);
  assert.ok(Math.abs(again / run[0] - 1) < 0.1, 'back to the first note');
  // It tops out rather than climbing for ever.
  for (let i = 0; i < 30; i++) { s.ctx.currentTime = 10 + (i + 1) * 0.5; pop(); }
  assert.equal(s.combo, 7);
});

test('repeats are nudged in pitch, a little and never far', () => {
  const { s, made } = setup();
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    made.length = 0;
    s.ctx.currentTime = i;
    s.play('atk:sword');
    const r = startHz(oscs(made)[0]) / 900;   // the sword's ring starts at 900Hz
    assert.ok(r >= 0.955 - 1e-9 && r <= 1.045 + 1e-9, `within ±4.5% (${r})`);
    seen.add(r.toFixed(4));
  }
  assert.ok(seen.size > 20, 'no two alike');
  // The level-up chime is left exactly as it was.
  made.length = 0; s.ctx.currentTime = 100; s.play('level');
  assert.deepEqual(oscs(made).map(startHz), [523, 659, 784]);
});

test('every sound goes through the sound-effects slider, and auto battle sits a little lower', () => {
  const { s, made } = setup();
  const names = ['atk:sword', 'atk:warhammer', 'atk:pistol', 'hit', 'crit', 'die', 'bossdie', 'hurt', 'spec', 'pickup', 'droprare', 'dropepic', 'level', 'roar'];
  names.forEach((n, i) => { s.ctx.currentTime = i; s.play(n); });
  const reachesSfx = (n, depth = 0) => n === s.sfxGain || (depth < 4 && n.out.some((o) => reachesSfx(o, depth + 1)));
  for (const v of voices(made)) assert.ok(reachesSfx(v), `${v.kind} reaches sfxGain`);
  // No buzzy waves in the everyday sounds of a fight.
  made.length = 0;
  ['atk:mace', 'atk:warhammer', 'atk:rifle', 'atk:battleaxe'].forEach((n, i) => { s.ctx.currentTime = 50 + i; s.play(n); });
  ['hit', 'crit', 'die', 'hurt', 'spec'].forEach((n, i) => { s.ctx.currentTime = 60 + i; s.play(n); });
  assert.ok(oscs(made).every((o) => o.type === 'sine' || o.type === 'triangle'), oscs(made).map((o) => o.type).join());
  // Swings are a little quieter while auto battle runs; kills are not.
  const level = (name, t) => { made.length = 0; s.ctx.currentTime = t; s.play(name); return Math.max(...made.filter((n) => n.kind === 'gain').flatMap((g) => g.gain.ev.map((e) => e[1]))); };
  const swingManual = level('atk:sword', 100), killManual = level('die', 110);
  s.autoSource = () => true;
  assert.ok(Math.abs(level('atk:sword', 120) - swingManual * 0.8) < 1e-9);
  assert.equal(level('die', 130), killManual);
});

test('too many sounds at once: the everyday ones wait, the payoffs still play', () => {
  const { s, made } = setup();
  ['die', 'crit', 'spec', 'hurt', 'droprare', 'dropepic'].forEach((n) => s.play(n));
  const before = voices(made).length;
  s.play('pickup'); s.play('atk:sword'); s.play('hit');
  assert.equal(voices(made).length, before, 'the mix is full');
  s.play('bossdie');
  assert.ok(voices(made).length > before, 'a boss falling always sounds');
});

test('without Web Audio every sound is a quiet no-op', () => {
  globalThis.window = {};
  const s = new Sfx(bus());
  s.unlock();
  for (const n of ['atk:sword', 'hit', 'crit', 'die', 'pickup', 'droprare', 'spec', 'hurt']) s.play(n);
  assert.equal(s.ctx, null);
});

test('on auto battle the level-up chime comes at most once every few seconds', async () => {
  const { LEVEL_GAP_AUTO } = await import('../src/audio/sfx.js');
  assert.equal(LEVEL_GAP_AUTO, 4);
  const handlers = {};
  const bus = { on: (n, f) => { handlers[n] = f; } };
  const { Sfx } = await import('../src/audio/sfx.js');
  const a = new Sfx(bus);
  const played = [];
  a.play = (n) => played.push(n);
  let auto = true;
  a.autoSource = () => auto;
  a.ctx = { currentTime: 10 };
  handlers.levelup(); a.ctx.currentTime = 11; handlers.levelup(); a.ctx.currentTime = 13.9; handlers.levelup();
  assert.equal(played.length, 1, 'one chime in four seconds of auto battle');
  a.ctx.currentTime = 14.1; handlers.levelup();
  assert.equal(played.length, 2);
  auto = false; a.ctx.currentTime = 14.5; handlers.levelup();
  assert.equal(played.length, 3, 'off auto battle, a quarter of a second apart is enough');
});

const timbre = (made) => made.flatMap((node) => {
  if (node.kind === 'osc') return [[node.type, ...node.frequency.ev.map((e) => e[1])]];
  if (node.kind === 'filter') return [[node.type, node.frequency.value]];
  return [];
});

test('material impacts have distinct timbres and keep their ordinary hit material on a critical', () => {
  const { s, made } = setup();
  s._random = () => 0.5;
  const heard = new Set();
  Object.keys(IMPACT_SOUNDS).forEach((material, i) => {
    made.length = 0;
    s.ctx.currentTime = i * 2;
    s.play(`hit:${material}`);
    const ordinary = timbre(made);
    assert.ok(ordinary.length > 0, material);
    heard.add(JSON.stringify(ordinary));

    made.length = 0;
    s.ctx.currentTime += 1;
    s.play(`crit:${material}`);
    const critical = timbre(made);
    assert.deepEqual(critical.slice(0, ordinary.length), ordinary, material);
    assert.ok(critical.length > ordinary.length, 'critical accent');
  });
  assert.equal(heard.size, Object.keys(IMPACT_SOUNDS).length);
});

test('impacts share the existing volley limit, and crit cooldown plays the struck material', () => {
  const { s, made } = setup();
  s._random = () => 0.5;
  s.play('crit:metal');
  const first = voices(made).length;
  s.play('hit:slime');
  s.play('crit:beast');
  assert.equal(voices(made).length, first, 'no layered impacts on a crit');

  made.length = 0;
  s.ctx.currentTime = 0.04;
  s.play('crit:slime');
  const fallback = timbre(made);
  s.play('hit:beast');
  s.play('hit');
  assert.deepEqual(timbre(made), fallback, 'all hits share one limit');

  made.length = 0;
  s.ctx.currentTime = 1;
  s.play('hit:slime');
  assert.ok(fallback.length > 0, 'suppressed impacts did not take the hit slot');
  assert.deepEqual(timbre(made), fallback);
});

test('all spell elements have a distinct layer and share the weapon attack slot', () => {
  const { s, made } = setup();
  s._random = () => 0.5;
  s.play('atk:staff');
  const core = timbre(made);
  const heard = new Set();
  Object.keys(ELEMENTS).forEach((element, i) => {
    made.length = 0;
    s.ctx.currentTime = i + 1;
    s.play(`atk:staff:${element}`);
    const release = timbre(made);
    assert.deepEqual(release.slice(0, core.length), core, element);
    assert.ok(release.length > core.length, element);
    heard.add(JSON.stringify(release));
    s.play('atk:wand');
    assert.deepEqual(timbre(made), release, 'elemental casts and other attacks share one limit');
  });
  assert.equal(heard.size, Object.keys(ELEMENTS).length);
});

test('action and combat recipes stay behind the SFX slider and reuse the noise buffer', () => {
  const { s, made } = setup();
  const names = [...Object.keys(ACTION_SOUNDS),
    ...Object.keys(HURT_SOUNDS).map((key) => `hurt:${key}`),
    ...Object.keys(ABILITY_SOUNDS).map((key) => `ability:${key}`)];
  const reachesSfx = (n, depth = 0) => n === s.sfxGain || (depth < 4 && n.out.some((o) => reachesSfx(o, depth + 1)));
  const buffers = new Set();
  names.forEach((name, i) => {
    made.length = 0;
    s.ctx.currentTime = i + 1;
    s.play(name);
    const played = voices(made);
    assert.ok(played.length > 0, name);
    assert.ok(played.every((voice) => reachesSfx(voice)), name);
    played.filter((voice) => voice.kind === 'noise').forEach((voice) => buffers.add(voice.buffer));
  });
  assert.equal(buffers.size, 1);

  made.length = 0;
  s.setMuted(true);
  s.ctx.currentTime += 1;
  ['hit:metal', 'atk:staff:wind', 'ability:ultimate', 'gather:fishing'].forEach((name) => s.play(name));
  assert.equal(voices(made).length, 0);
});

test('rapid footsteps and material gather cues share limits within their families', () => {
  const { s, made } = setup();
  for (const prefix of ['gather:', 'footstep:']) {
    const [first, next] = Object.keys(ACTION_SOUNDS).filter((key) => key.startsWith(prefix));
    s.play(first);
    const count = voices(made).length;
    s.play(next);
    assert.equal(voices(made).length, count);
    s.ctx.currentTime += 0.2;
    s.play(next);
    assert.ok(voices(made).length > count);
  }
});

test('audio does not consume the game random stream', () => {
  fakeAudio();
  const original = Math.random;
  const originalTimer = globalThis.setInterval;
  const timers = [];
  try {
    Math.random = () => { throw new Error('audio used gameplay randomness'); };
    globalThis.setInterval = (fn) => timers.push(fn);
    const s = new Sfx(bus());
    s._randomState = 123456;
    s.ambienceSource = () => ({ zone: 'Chinatown', night: 0 });
    s.unlock();
    assert.ok(s.ctx);
    assert.ok(s.amb);
    assert.equal(timers.length, 2);
    for (const tick of timers) tick();
    for (const name of ['atk:staff:wind', 'crit:metal', 'hit:beast', 'gather:mining']) s.play(name);
    assert.ok(s._noiseBuf);
  } finally {
    Math.random = original;
    globalThis.setInterval = originalTimer;
  }
});
