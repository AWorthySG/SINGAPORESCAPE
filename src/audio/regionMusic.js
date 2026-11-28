// The score supplies the melody and chord voicings. Soft sustained tones keep
// neighbouring chords connected, with a little picking pattern below the lead.
const ACCOMPANIMENT = {
  still: { bass: [[0, 3.7]], picks: [[2.5], [1.5]] },
  tide: { bass: [[0, 2.05], [2.5, 1.15]], picks: [[1, 3], [0.75, 2]] },
  rolling: { bass: [[0, 1.8], [2, 1.65]], picks: [[0.5, 1.5, 2.75], [0.75, 1.75, 3]] },
  gentle: { bass: [[0, 3.6]], picks: [[1, 2.75], [0.75, 2.5]] },
};

/** Arrange a score into a loop of note events. Times are in seconds. */
export function compileTheme(score) {
  const beat = 60 / score.bpm;
  const bars = score.chords.length;
  const phraseDuration = bars * 4 * beat;
  const notes = [];
  let held = new Map();
  const backing = ACCOMPANIMENT[score.pattern] || ACCOMPANIMENT.gentle;
  const add = (time, midi, duration, velocity, voice) => {
    const note = { time: time * beat, midi, duration: duration * beat, velocity, voice };
    notes.push(note);
    return note;
  };
  for (let measure = 0; measure < bars * 2; measure++) {
    const bar = measure % bars;
    const variation = measure >= bars;
    const [bass, ...upper] = score.chords[bar];
    const start = measure * 4;
    const cadence = bar === bars - 1;
    for (const [index, [offset, length]] of backing.bass.entries()) {
      if (index === 0 || !cadence) add(start + offset, bass, length, index === 0 ? 0.64 : 0.45, 'bass');
    }
    // Carry common tones across the bar line. The remaining notes ease into
    // their new pitch in order, like players settling into the new chord.
    const next = new Map();
    for (const [index, midi] of upper.entries()) {
      const offset = 0.095 * index;
      const previous = held.get(midi);
      if (previous) previous.duration = (start + 3.86) * beat - previous.time;
      next.set(midi, previous || add(start + offset, midi, 3.86 - offset, 0.48 - index * 0.055, 'pad'));
    }
    held = next;
    if (upper.length) {
      const step = bar + Number(variation);
      const picks = backing.picks[step % backing.picks.length];
      const count = cadence ? Math.min(1, picks.length) : picks.length;
      for (let i = 0; i < count; i++) {
        const slot = (step + i) % upper.length;
        add(start + picks[i], upper[slot], 0.65, i === 0 ? 0.43 : 0.34, 'backing');
      }
    }
    const melody = score.melody[bar] || [];
    // The return leaves one of the ornaments out of alternating bars and
    // plays the remaining melody more softly over the changed picking.
    const omit = bar % 2 ? 0 : melody.length - 1;
    for (const [index, [offset, midi, length, velocity = 0.8]] of melody.entries()) {
      if (variation && melody.length > 1 && index === omit) continue;
      add(start + offset, midi, length, velocity * (variation ? 0.79 : 1), score.lead);
    }
  }
  notes.sort((a, b) => a.time - b.time);
  return { duration: phraseDuration * 2, phraseDuration, notes };
}

// Additive voices share the same envelope shape while each partial decays at
// its own rate. Keeping upper partials quiet leaves room for effects and beds.
// Partial fields are oscillator type, frequency ratio, peak gain, decay seconds.
const VOICES = {
  keys: { attack: 0.022, sustain: 0.28, release: 0.33, parts: [
    ['sine', 1, 0.195, 0.49], ['triangle', 2.005, 0.039, 0.17], ['sine', 3.008, 0.014, 0.12],
  ] },
  mallet: { attack: 0.012, sustain: 0.14, release: 0.26, parts: [
    ['sine', 1, 0.208, 0.37], ['sine', 3.01, 0.038, 0.11], ['sine', 4.07, 0.014, 0.075],
  ] },
  pluck: { attack: 0.009, sustain: 0.16, release: 0.22, parts: [
    ['triangle', 1, 0.17, 0.34], ['sine', 2, 0.071, 0.125], ['sine', 3.007, 0.037, 0.069],
  ] },
  flute: { attack: 0.094, sustain: 0.68, release: 0.24, vibrato: true, parts: [
    ['sine', 1, 0.162, 0.53], ['sine', 2, 0.039, 0.2], ['sine', 3, 0.011, 0.2],
  ] },
  bell: { attack: 0.014, sustain: 0.24, release: 0.48, parts: [
    ['sine', 1, 0.152, 0.47], ['sine', 2.4, 0.041, 0.28], ['sine', 3.02, 0.024, 0.14],
  ] },
  pad: { attack: 0.35, sustain: 0.83, release: 0.49, parts: [
    ['sine', 1, 0.048, 1.3], ['sine', 1.004, 0.018, 1.3],
  ] },
  bass: { attack: 0.12, sustain: 0.74, release: 0.33, parts: [
    ['sine', 1, 0.109, 0.63], ['sine', 2, 0.026, 0.39],
  ] },
  backing: { attack: 0.024, sustain: 0.18, release: 0.21, parts: [
    ['triangle', 1, 0.086, 0.29], ['sine', 2, 0.026, 0.11],
  ] },
};
const FLOOR = 0.0001;
const midiHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function releaseVoice(oscillator, gain, voices) {
  voices?.add(oscillator);
  oscillator.onended = () => {
    oscillator.disconnect?.();
    gain.disconnect?.();
    voices?.delete(oscillator);
  };
}

function addFluteVibrato(ctx, pitch, frequency, at, duration, end, voices) {
  const oscillator = ctx.createOscillator();
  const depth = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 5.1;
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(pitch * 0.004, at + Math.min(0.44, duration * 0.72));
  depth.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(depth);
  depth.connect(frequency);
  releaseVoice(oscillator, depth, voices);
  oscillator.start(at);
  oscillator.stop(end);
}

function scheduleNote(ctx, dest, note, at, voices) {
  if (note.velocity <= 0) return;
  const preset = VOICES[note.voice] || VOICES.keys;
  const frequency = midiHz(note.midi);
  const length = note.duration;
  const releaseAt = at + length;
  const end = releaseAt + preset.release;
  const attack = Math.min(preset.attack, length * 0.33);
  for (const [index, [type, ratio, volume, decay]] of preset.parts.entries()) {
    const pitch = frequency * ratio;
    if (pitch >= ctx.sampleRate * 0.48) continue;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(pitch, at);
    const peak = Math.max(FLOOR, volume * note.velocity);
    const sustain = Math.max(FLOOR, peak * preset.sustain);
    const decayAt = at + Math.min(length, attack + decay);
    const level = envelope.gain;
    level.setValueAtTime(FLOOR, at);
    level.linearRampToValueAtTime(peak, at + attack);
    level.exponentialRampToValueAtTime(sustain, decayAt);
    level.setValueAtTime(sustain, releaseAt);
    level.exponentialRampToValueAtTime(FLOOR, end);
    osc.connect(envelope);
    envelope.connect(dest);
    releaseVoice(osc, envelope, voices);
    if (preset.vibrato && index === 0 && length > 0.48) addFluteVibrato(ctx, pitch, osc.frequency, at, length, end, voices);
    osc.start(at);
    osc.stop(end + 0.005);
  }
}

/** Render a compiled phrase into an AudioContext or OfflineAudioContext. */
export function scheduleMusicNotes(ctx, dest, notes, at = 0) {
  for (const note of notes) scheduleNote(ctx, dest, note, at + note.time);
}

export const REGION_DWELL_SECONDS = 0.72;
export const REGION_FADE_SECONDS = 2.5;
// A little over a second covers ordinary background-tab timer throttling.
// A longer stall skips missed onsets rather than playing a backlog on resume.
const LOOKAHEAD = 1.25;
const START_DELAY = 0.045;

export class RegionMusic {
  constructor(ctx, output, getTheme) {
    this.ctx = ctx;
    this.output = output;
    this.getTheme = getTheme;
    this.cache = new WeakMap();
    this.active = null;
    this.outgoing = null;
    this.candidate = null;
    this.audible = true;
  }

  /** Called by the mixer. Audio time also freezes the phase during suspension. */
  update(zone, audible = true) {
    if (this.ctx.state && this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const score = this.getTheme(zone);
    const resumed = audible && !this.audible;
    this.audible = audible;

    if (this.outgoing && (!audible || now >= this.outgoing.retireAt)) {
      this._retire(this.outgoing, now);
      this.outgoing = null;
    }
    if (!score || score === this.active?.score) {
      this.candidate = null;
    } else if (!this.active || resumed) {
      this._switch(score, now, false);
    } else {
      if (this.candidate?.score !== score) this.candidate = { score, since: now };
      if (!this.outgoing && now - this.candidate.since >= REGION_DWELL_SECONDS) this._switch(score, now, audible);
    }
    if (!audible) return;
    if (this.active) this._fill(this.active, now, now + LOOKAHEAD);
    if (this.outgoing) this._fill(this.outgoing, now, Math.min(now + LOOKAHEAD, this.outgoing.retireAt));
  }

  _switch(score, now, crossfade) {
    if (this.active) {
      if (crossfade) {
        const outgoing = this.active;
        // A region can change during the initial fade-in. Begin the fade at
        // its actual envelope level to avoid a jump on the outgoing bus.
        const level = Math.min(1, (now - outgoing.fadeStart) / (outgoing.fadeEnd - outgoing.fadeStart));
        outgoing.gain.gain.cancelScheduledValues?.(now);
        outgoing.gain.gain.setValueAtTime(level, now);
        outgoing.retireAt = now + REGION_FADE_SECONDS;
        outgoing.gain.gain.linearRampToValueAtTime(0, outgoing.retireAt);
        this.outgoing = outgoing;
      } else {
        this._retire(this.active, now);
      }
    }
    const music = this.cache.get(score) || compileTheme(score);
    this.cache.set(score, music);
    const gain = this.ctx.createGain();
    const fadeEnd = now + (crossfade ? REGION_FADE_SECONDS : 0.85);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, fadeEnd);
    gain.connect(this.output);
    this.active = { score, music, gain, voices: new Set(), start: now + START_DELAY, loop: 0, index: 0, fadeStart: now, fadeEnd };
    this.candidate = null;
  }

  _retire(track, now) {
    track.gain.disconnect?.();
    for (const oscillator of track.voices) oscillator.stop(now);
    track.voices.clear();
  }

  _fill(track, now, until) {
    const { duration, notes } = track.music;
    if (!notes.length || !(duration > 0)) return;
    const pass = Math.floor((now - track.start) / duration);
    if (pass > track.loop) {
      track.loop = pass;
      track.index = 0;
    }
    for (;;) {
      const note = notes[track.index];
      const at = track.start + track.loop * duration + note.time;
      if (at >= until) break;
      if (at >= now) scheduleNote(this.ctx, track.gain, note, at, track.voices);
      track.index++;
      if (track.index === notes.length) {
        track.index = 0;
        track.loop++;
      }
    }
  }
}
