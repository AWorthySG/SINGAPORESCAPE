// Lightweight synthesised sound effects (no audio files). Created lazily on the
// first user gesture (browser autoplay policy). Fully guarded so it no-ops in
// headless/no-Web-Audio environments. Listens on the EventBus for 'sfx' names
// plus 'levelup'/'achievement'.
import { AmbienceBed, ambienceMix } from './ambience.js';
import { ACTION_SOUNDS } from './actionSounds.js';
import { ABILITY_SOUNDS, ELEMENT_SOUNDS, HURT_SOUNDS, IMPACT_SOUNDS, impactCrit } from './combatSounds.js';
import { RegionMusic } from './regionMusic.js';
import { musicTheme } from './musicThemes.js';
import { isPianoKey, Piano } from './piano.js';

const MUTE_KEY = 'singaporescape:muted';
const MUSIC_KEY = 'singaporescape:music';
const VOLUME_KEY = 'singaporescape:volume';
const AMBIENCE_KEY = 'singaporescape:ambience';
// Separate levels for the sound effects and the background music (the owner's
// ask), each 0..1 under the overall volume.
const SFX_VOL_KEY = 'singaporescape:sfxVolume';
const MUSIC_VOL_KEY = 'singaporescape:musicVolume';
const MASTER = 0.16;
const MUSIC_VOL = 0.5; // relative to master
const MUSIC_UPDATE_MS = 120;

// ---- Shaping the sounds of a fight ----
// A busy auto battle asked for 10 to 50 sounds a second: a swing and a hit on
// every beat, up to 18 hits in one instant from an Archer's arrows, an ability
// whoop every second, all at one fixed pitch. So: the shortest gap (seconds)
// between two starts of the same sound. Anything sooner would only pile on to
// the one already ringing, so it is skipped.
const GAP = { atk: 0.09, hit: 0.075, crit: 0.5, die: 0.07, hurt: 0.14, spec: 0.3, pickup: 0.15,
  droprare: 0.3, dropepic: 0.4, swish: 0.09, gather: 0.06, clang: 0.06, eat: 0.1, click: 0.03,
  make: 0.1, footstep: 0.09, interact: 0.09, journey: 0.2, ui: 0.045,
  avoid: 0.14, ultimate: 0.4, boss: 0.35, windup: 0.3, faith: 0.4, interrupt: 0.2, ready: 0.3, bless: 0.25 };
// Roughly how long each sound rings (default 0.15s), to count the voices sounding at once.
const RING = { die: 0.25, spec: 0.3, hurt: 0.18, droprare: 0.4, dropepic: 0.6, bossdie: 0.8, roar: 0.6,
  level: 0.45, achievement: 0.5, travel: 0.3, journey: 0.35, make: 0.23, interact: 0.22,
  windup: 0.3, faith: 0.39, boss: 0.36, ultimate: 0.34 };
// The everyday sounds of a fight: the first dropped when the mix is full, and a
// touch quieter while auto battle runs things. Kills, crits and drops never are.
const ROUTINE = new Set(['atk', 'hit', 'swish', 'pickup', 'gather', 'clang', 'make', 'footstep', 'avoid']);
const MAX_VOICES = 6;
const AUTO_LEVEL = 0.8;
const PITCH_JITTER = 0.045;   // ±4.5%: no two repeats alike, none out of tune
// The sounds that repeat through a fight get the nudge; chimes and fanfares stay put.
const JITTERED = new Set([...ROUTINE, 'crit', 'die', 'hurt', 'spec']);
// Kills in quick succession lift the kill's pop up a major pentatonic (a combo),
// back to the root after a pause.
const COMBO_STEPS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];
const COMBO_WINDOW = 2.5;
// Rounder stand-ins for the buzzy waves the weapon sounds were written with.
const SOFT_WAVE = { square: 'triangle', sawtooth: 'triangle' };
const ABILITY_GROUP = {
  dodge: 'avoid', block: 'avoid', ultimate: 'ultimate', boss: 'boss', windup: 'windup',
  faith: 'faith', interrupt: 'interrupt', ready: 'ready', bless: 'bless',
};

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const recipeFor = (table, key) => Object.hasOwn(table, key) ? table[key] : undefined;

export const LEVEL_GAP_AUTO = 4;   // seconds between level-up chimes on auto battle

export class Sfx {
  constructor(bus) {
    this.bus = bus;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;           // every sound effect goes through this, so its own slider sets them all
    this.music = null;
    this.musicSource = null;      // set by main: () => the current region name
    this.muted = this._loadMuted();
    this.volume = this._loadVolume();   // 0..1, scales everything
    this.musicOn = this._loadMusic();
    this.sfxVolume = this._loadLevel(SFX_VOL_KEY);
    this.musicVolume = this._loadLevel(MUSIC_VOL_KEY);
    this.ambienceOn = this._loadAmbience();
    this.amb = null;               // the region sound beds (ambience.js), made on unlock
    this.ambienceSource = null;    // set by main: () => ({ zone, night })
    this.autoSource = null;        // set by main: () => is auto battle on?
    this.combo = 0;                // kills in quick succession (see 'die')
    this._randomState = (Date.now() >>> 0) || 1;
    bus.on('sfx', (n) => this.play(n));
    // Many levels at once (a big batch, a boss) chime once, not once per level;
    // and on auto battle, where a new hero levels up almost every second, the
    // chime comes at most once every LEVEL_GAP_AUTO seconds so it stays a treat.
    bus.on('levelup', () => {
      const now = this.ctx?.currentTime ?? 0;
      const gap = this.autoSource?.() ? LEVEL_GAP_AUTO : 0.25;
      if (this.ctx && now - (this._lastLevel ?? -1) < gap) return;
      this._lastLevel = now;
      this.play('level');
    });
    bus.on('achievement', () => this.play('achievement'));
  }

  // All audio variation uses its own stream so sound and mute cannot change
  // gameplay rolls. An instance keeps its stream across unlocks and toggles.
  _random() {
    let state = this._randomState;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    this._randomState = state;
    return (state >>> 0) / 0x100000000;
  }

  /** Create / resume the AudioContext — must be called from a user gesture. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER * this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._musicLevel();
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      this._startMusic();
      this._startAmbience();
    } catch { this.ctx = null; }
  }

  // ---------------- Region ambience (see ambience.js) ----------------
  _startAmbience() {
    if (!this.ctx || this.amb) return;
    try { this.amb = new AmbienceBed(this.ctx, this.master, () => this._random()); } catch { this.amb = null; return; }
    // Once a second is plenty: the beds glide between levels on their own.
    this._ambTick();
    setInterval(() => this._ambTick(), 1000);
  }

  _ambTick() {
    const src = this.amb && this.ambienceSource && this.ambienceSource();
    if (!src) return;
    this.amb.set(ambienceMix(src.zone, src.night), this.ambienceOn ? 1 : 0);
  }

  toggleAmbience() {
    this.ambienceOn = !this.ambienceOn;
    try { localStorage.setItem(AMBIENCE_KEY, this.ambienceOn ? '1' : '0'); } catch { /* ignore */ }
    this._ambTick();
    return this.ambienceOn;
  }
  _loadAmbience() { try { return localStorage.getItem(AMBIENCE_KEY) !== '0'; } catch { return true; } }

  // ---------------- Region soundtrack ----------------
  _startMusic() {
    if (!this.ctx || this.music) return;
    this.music = new RegionMusic(this.ctx, this.musicGain, musicTheme);
    this._musicTick();
    setInterval(() => this._musicTick(), MUSIC_UPDATE_MS);
  }

  _musicTick() {
    if (this.ctx?.state !== 'running' || !this.musicSource) return;
    const audible = this.musicOn && !this.muted && this.volume > 0 && this.musicVolume > 0;
    this.music.update(this.musicSource(), audible);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    try { localStorage.setItem(MUSIC_KEY, this.musicOn ? '1' : '0'); } catch { /* ignore */ }
    if (this.musicGain) this.musicGain.gain.value = this._musicLevel();
    return this.musicOn;
  }
  /** The music's gain: off, or its share of the overall volume times its own slider. */
  _musicLevel() { return this.musicOn ? MUSIC_VOL * this.musicVolume : 0; }

  /** The sound effects' own volume (0..1), under the overall volume. */
  setSfxVolume(v) {
    this.sfxVolume = clamp01(v);
    try { localStorage.setItem(SFX_VOL_KEY, String(this.sfxVolume)); } catch { /* ignore */ }
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }
  /** The background music's own volume (0..1), under the overall volume. */
  setMusicVolume(v) {
    this.musicVolume = clamp01(v);
    try { localStorage.setItem(MUSIC_VOL_KEY, String(this.musicVolume)); } catch { /* ignore */ }
    if (this.musicGain) this.musicGain.gain.value = this._musicLevel();
  }
  _loadLevel(key) {
    try { const v = parseFloat(localStorage.getItem(key)); return Number.isFinite(v) ? clamp01(v) : 1; } catch { return 1; }
  }
  _loadMusic() { try { return localStorage.getItem(MUSIC_KEY) !== '0'; } catch { return true; } }

  setMuted(m) {
    this.muted = m;
    this._saveMuted(m);
    if (this.master) this.master.gain.value = m ? 0 : MASTER * this.volume;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* ignore */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER * this.volume;
  }
  _loadVolume() {
    try { const v = parseFloat(localStorage.getItem(VOLUME_KEY)); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; } catch { return 1; }
  }
  toggle() { this.setMuted(!this.muted); return this.muted; }

  /** Strike a key on the existing, gesture-unlocked audio context. */
  playPiano(midi, durationSeconds) {
    if (!isPianoKey(midi) || !this.ctx || !this.sfxGain || this.muted || this.volume <= 0 || this.sfxVolume <= 0) return false;
    if (this.ctx.state !== 'running') {
      if (this.ctx.state !== 'suspended' || typeof navigator === 'undefined' || !navigator.userActivation?.isActive) return false;
      this.unlock(); // A real key or tap can resume the context and schedule its first note together.
    }
    try {
      if (this._piano?.ctx !== this.ctx) this._piano = new Piano(this.ctx, this.sfxGain);
      return this._piano.play(midi, durationSeconds);
    } catch { return false; }
  }

  // play() sets this._pf (a small random pitch nudge) and this._vf (a level) for
  // the sound it is making; every tone and burst of that sound shares them.
  _tone(freq, dur, type = 'sine', t0 = 0, vol = 1, slideTo = null, attack = 0.006) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + t0;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const pf = this._pf || 1;
    o.type = type;
    o.frequency.setValueAtTime(freq * pf, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo * pf), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * (this._vf ?? 1)), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain || this.master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  /** A burst of noise, optionally shaped around a cutoff or centre frequency. */
  _noise(dur, vol = 0.4, t0 = 0, cutoff = 0, filter = 'lowpass') {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const n = Math.max(1, Math.floor(sr * dur));
    // One second of white noise, made once. Each burst plays a stretch of it
    // from a random point, rather than filling a fresh buffer with random
    // numbers for every hit and kill (several a second in a big fight).
    if (!this._noiseBuf || this._noiseBuf.length < n) {
      const buf = this.ctx.createBuffer(1, Math.max(sr, n), sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = this._random() * 2 - 1;
      this._noiseBuf = buf;
    }
    const len = this._noiseBuf.length;
    const t = this.ctx.currentTime + t0;
    const s = this.ctx.createBufferSource(); s.buffer = this._noiseBuf;
    const g = this.ctx.createGain();
    // A straight fade from `vol` to silence over the burst: the same decaying
    // envelope the old per-burst buffers had baked in.
    g.gain.setValueAtTime(vol * (this._vf ?? 1), t);
    g.gain.linearRampToValueAtTime(0, t + n / sr);
    const out = this.sfxGain || this.master, f = cutoff ? this._noiseFilter(cutoff, filter) : null;
    s.connect(g);
    if (f) { g.connect(f); f.connect(out); } else g.connect(out);
    s.start(t, Math.floor(this._random() * Math.max(1, len - n)) / sr, n / sr);
  }

  _noiseFilter(freq, type) {
    if (typeof this.ctx.createBiquadFilter !== 'function') return null;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = type === 'bandpass' ? 1.2 : 0.5;
    return f;
  }

  /** Each weapon kind's attack sound, made from a few short tones and bursts
   *  of noise (no sound files). Quick weapons are light and high, heavy ones low
   *  and thumping, bows twang, guns pop and spells shimmer. */
  _weapon(type) {
    // Swung several times a second, so square and saw waves come out as rounder
    // triangles and the noise is taken off its hissy top.
    const T = (f, d, w, t0, v, s) => this._tone(f, d, SOFT_WAVE[w] || w, t0, v, s), N = (d, v, t0) => this._noise(d, v, t0, 4200);
    switch (type) {
      case 'dagger': N(0.03, 0.12); T(1500, 0.05, 'sine', 0, 0.1, 700); break;
      case 'kerambit': N(0.03, 0.12); T(1400, 0.04, 'sine', 0, 0.1, 700); T(1700, 0.04, 'sine', 0.05, 0.08, 800); break;
      case 'claws': N(0.025, 0.14); N(0.025, 0.12, 0.045); N(0.025, 0.1, 0.09); T(2200, 0.03, 'triangle', 0, 0.05, 1400); break;
      case 'scimitar': N(0.06, 0.14); T(1100, 0.07, 'sine', 0, 0.12, 450); break;
      case 'sword': N(0.07, 0.15); T(900, 0.08, 'sine', 0, 0.12, 300); T(1900, 0.06, 'triangle', 0.03, 0.06); break;
      case 'katana': N(0.04, 0.16); T(2100, 0.06, 'sine', 0, 0.12, 700); T(3000, 0.08, 'triangle', 0.02, 0.05); break;
      case 'longsword': N(0.1, 0.16); T(700, 0.13, 'sine', 0, 0.13, 240); T(1500, 0.08, 'triangle', 0.05, 0.05); break;
      case '2h_sword': N(0.15, 0.2); T(480, 0.18, 'sine', 0, 0.16, 140); break;
      case 'parang': N(0.06, 0.2); T(320, 0.08, 'square', 0.02, 0.12, 110); break;
      case 'battleaxe': N(0.08, 0.2); T(240, 0.1, 'square', 0.03, 0.16, 80); break;
      case 'halberd': N(0.12, 0.17); T(520, 0.12, 'sine', 0, 0.12, 180); T(200, 0.08, 'square', 0.08, 0.12, 80); break;
      case 'spear': N(0.05, 0.14); T(520, 0.08, 'triangle', 0, 0.14, 1200); break;
      case 'mace': N(0.06, 0.22); T(140, 0.1, 'square', 0, 0.2, 60); break;
      case 'warhammer': N(0.1, 0.26); T(95, 0.16, 'sawtooth', 0, 0.22, 40); break;
      case 'toya': T(340, 0.06, 'triangle', 0, 0.2); T(260, 0.07, 'triangle', 0.05, 0.16); break;
      case 'knuckles': N(0.03, 0.2); T(170, 0.05, 'square', 0, 0.14, 80); N(0.03, 0.14, 0.09); T(240, 0.04, 'triangle', 0.09, 0.1, 120); break;   // a quick one-two thump
      case 'monk_gloves': N(0.05, 0.16); T(210, 0.07, 'triangle', 0, 0.14, 110); break;   // a soft, heavy slap
      case 'cane': T(760, 0.04, 'triangle', 0, 0.16); T(980, 0.05, 'triangle', 0.04, 0.12); break;
      case 'whip': N(0.025, 0.3); T(2600, 0.04, 'sine', 0.02, 0.12, 900); break;
      case 'fan': N(0.1, 0.08); T(600, 0.12, 'sine', 0, 0.1, 950); break;
      case 'shortbow': T(460, 0.1, 'triangle', 0, 0.18, 320); N(0.03, 0.06); break;
      case 'longbow': T(280, 0.18, 'triangle', 0, 0.2, 190); N(0.04, 0.07); break;
      case 'crossbow': T(1300, 0.02, 'square', 0, 0.1); N(0.04, 0.16, 0.02); T(170, 0.08, 'square', 0.02, 0.14, 90); break;
      case 'pistol': N(0.05, 0.3); T(320, 0.05, 'square', 0, 0.16, 90); break;
      case 'rifle': N(0.13, 0.36); T(150, 0.13, 'sawtooth', 0, 0.2, 40); break;
      case 'shuriken': T(1800, 0.06, 'sine', 0, 0.1, 2700); N(0.03, 0.06); break;
      case 'chakram': T(700, 0.12, 'triangle', 0, 0.12, 1150); T(1150, 0.08, 'triangle', 0.06, 0.06, 700); break;
      case 'staff': T(660, 0.14, 'sine', 0, 0.12, 990); T(1320, 0.1, 'triangle', 0.04, 0.05); break;
      case 'wand': T(1200, 0.08, 'triangle', 0, 0.1, 1800); T(2400, 0.06, 'sine', 0.03, 0.04); break;
      case 'orb': T(330, 0.18, 'sine', 0, 0.14, 440); T(660, 0.14, 'sine', 0.04, 0.05); break;
      case 'censer': T(2600, 0.03, 'triangle', 0, 0.06); T(3100, 0.03, 'triangle', 0.04, 0.05); N(0.12, 0.1, 0.05); T(180, 0.16, 'sine', 0.05, 0.12, 320); break;   // the chain clinks, the fire whooms
      case 'unarmed': N(0.04, 0.18); T(200, 0.05, 'square', 0, 0.1, 100); break;
      default: N(0.08, 0.16); T(900, 0.08, 'sine', 0, 0.12, 300);   // the old swish
    }
  }

  play(name) {
    if (!this.ctx || this.muted || typeof name !== 'string') return;
    const now = this.ctx.currentTime;
    const [family, detail, element] = name.split(':');
    let kind = family;
    let recipe;
    if (family === 'hit' || family === 'crit') {
      recipe = recipeFor(IMPACT_SOUNDS, detail);
      // Crit-heavy volleys get a crunch at most every half-second. The same
      // monster material still sounds on the blows in between.
      if (family === 'crit' && now - (this._last?.crit ?? -Infinity) < GAP.crit) kind = 'hit';
    } else if (family === 'hurt') {
      recipe = recipeFor(HURT_SOUNDS, detail);
    } else if (family === 'ability') {
      recipe = recipeFor(ABILITY_SOUNDS, detail);
      if (!recipe) return;
      kind = recipeFor(ABILITY_GROUP, detail) || 'spec';
    } else if (family !== 'atk' && detail !== undefined) {
      recipe = recipeFor(ACTION_SOUNDS, name);
      if (!recipe) return;
      if (family === 'travel') kind = 'journey';
    }
    if (kind === 'hit' && now - (this._last?.crit ?? -Infinity) < 0.03) return;
    if (!this._admit(kind, now)) return;
    this._pf = JITTERED.has(kind) ? 1 + (this._random() * 2 - 1) * PITCH_JITTER : 1;
    this._vf = ROUTINE.has(kind) && this.autoSource?.() ? AUTO_LEVEL : 1;
    try {
      if (kind === 'atk') {
        const accent = recipeFor(ELEMENT_SOUNDS, element);
        if (accent) this._vf *= 0.77;
        this._weapon(detail);
        if (accent) {
          // The short wand release needs less accent to stay at its usual level.
          if (detail === 'wand') this._vf *= 0.58;
          accent(this);
        }
      } else if (recipe) {
        recipe(this);
        if (kind === 'crit') impactCrit(this);
      } else {
        this._sound(kind, now);
      }
    } finally { this._pf = 1; this._vf = 1; }
  }

  /** May this sound start now? Not if the same one started a moment ago, nor
   *  (for an everyday sound) if the mix is already full. */
  _admit(kind, now) {
    const last = this._last || (this._last = {});
    if (now - (last[kind] ?? -Infinity) < (GAP[kind] || 0)) return false;
    const ringing = (this._ringing || []).filter((end) => end > now);
    this._ringing = ringing;
    if (ROUTINE.has(kind) && ringing.length >= MAX_VOICES) return false;
    ringing.push(now + (RING[kind] || 0.15));
    last[kind] = now;
    return true;
  }

  /** The next of `n` takes of a sound, in turn. */
  _rr(kind, n) {
    const r = this._takes || (this._takes = {});
    r[kind] = ((r[kind] ?? -1) + 1) % n;
    return r[kind];
  }

  _sound(name, now) {
    const last = this._last || {};
    const sameBeat = (k) => now - (last[k] ?? -Infinity) < 0.03;
    switch (name) {
      case 'island-note-0': case 'island-note-1': case 'island-note-2':
        this._tone([262, 330, 392][Number(name.at(-1))], 0.22, 'triangle', 0, 0.12);
        break;
      case 'hit': {
        // Three takes in turn, so a run of blows doesn't machine-gun. A swing on
        // this same beat already gave the whoosh, so the hit is just its thump.
        const v = this._rr('hit', 3), body = [170, 150, 190][v];
        this._tone(body, 0.09, 'triangle', 0, 0.5, body * 0.45, 0.004);
        if (!sameBeat('atk')) this._noise(0.045, 0.2, 0, [2400, 2000, 2800][v]);
        break;
      }
      case 'crit':   // the hit's thump, deeper, with a crunchy double crack and a glint on top
        this._tone(130, 0.14, 'triangle', 0, 0.55, 50, 0.004);
        this._noise(0.035, 0.3, 0, 5000); this._noise(0.03, 0.22, 0.035, 3000);
        this._tone(2200, 0.08, 'triangle', 0.01, 0.07, 1300);
        break;
      case 'swish': this._noise(0.08, 0.16, 0, 4200); this._tone(900, 0.08, 'sine', 0, 0.12, 300); break;
      case 'die': {
        // A round, meaty thump and a short bright pop. Kills in quick succession
        // lift the pop up the scale, back to the root after a pause.
        this.combo = now - (this._lastKill ?? -Infinity) < COMBO_WINDOW ? Math.min((this.combo || 0) + 1, COMBO_STEPS.length - 1) : 0;
        this._lastKill = now;
        this._tone(118, 0.24, 'triangle', 0, 0.62, 42, 0.012);
        this._noise(0.08, 0.24, 0, 1400);
        const pop = 660 * COMBO_STEPS[this.combo];
        this._tone(pop, 0.08, 'triangle', 0.025, 0.2, pop * 1.25);
        break;
      }
      case 'bossdie':
        this._noise(0.22, 0.4); this._tone(90, 0.5, 'sawtooth', 0, 0.5, 30);
        [392, 523, 659].forEach((f, i) => this._tone(f, 0.2, 'triangle', 0.18 + i * 0.11, 0.4));
        break;
      case 'hurt': this._tone(200, 0.16, 'triangle', 0, 0.42, 80, 0.008); this._noise(0.05, 0.16, 0, 900); break;   // a muffled thud, not a buzz
      case 'roar':   // a boss's entrance: a low growl rising into a bellow
        this._noise(0.5, 0.3); this._tone(70, 0.6, 'sawtooth', 0, 0.45, 150); this._tone(105, 0.5, 'square', 0.05, 0.2, 60);
        break;
      case 'eat': this._tone(300, 0.13, 'sine', 0, 0.5, 540); break;
      // Rare drops only: a soft bell (a chime and its overtone), and a gentle run for epic ones.
      case 'droprare': this._tone(1175, 0.4, 'sine', 0, 0.26, null, 0.01); this._tone(1760, 0.28, 'sine', 0.07, 0.12, null, 0.01); break;
      case 'dropepic': [784, 1047, 1319, 1568].forEach((f, i) => this._tone(f, 0.22, 'sine', i * 0.07, 0.3, null, 0.01)); this._tone(2093, 0.4, 'sine', 0.3, 0.14, null, 0.01); break;
      case 'pickup': {
        // A soft blip, stepping through three notes; a long stream of pickups
        // fades back a little, full again after a pause.
        this._pickRun = now - (this._lastPick ?? -Infinity) < 2 ? (this._pickRun || 0) + 1 : 0;
        this._lastPick = now;
        const f = [660, 742, 825][this._rr('pickup', 3)];
        this._tone(f, 0.07, 'sine', 0, 0.3 * Math.max(0.5, 1 - this._pickRun * 0.1), f * 1.3, 0.008);
        break;
      }
      case 'gather': this._tone(470, 0.09, 'triangle', 0, 0.35, 640); break;
      case 'clang': this._noise(0.03, 0.2); this._tone(840, 0.11, 'square', 0, 0.3, 620); this._tone(1260, 0.07, 'sine', 0, 0.18); break;
      // Abilities and a monster's wind-up: a soft rising swell, still clear as a warning.
      case 'spec': this._noise(0.16, 0.2, 0, 1800); this._tone(220, 0.2, 'triangle', 0, 0.32, 560, 0.02); break;
      case 'travel': this._tone(300, 0.28, 'sine', 0, 0.4, 760); break;
      case 'level': [523, 659, 784].forEach((f, i) => this._tone(f, 0.17, 'triangle', i * 0.1, 0.55)); break;
      case 'achievement': [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.18, 'triangle', i * 0.09, 0.55)); break;
      case 'click': this._tone(600, 0.04, 'square', 0, 0.25); break;
      default: break;
    }
  }

  _loadMuted() { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } }
  _saveMuted(m) { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ } }
}
