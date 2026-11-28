const SAMPLE_RATE = 24000;
const MAX_VOICES = 16;
const STEAL_FADE = 0.02;
const DAMPER_FADE = 0.11;
const TAU = 2 * Math.PI;

export const isPianoKey = (midi) => Number.isInteger(midi) && midi >= 60 && midi <= 72;

// The felt hammer excites many modes at once. The upper modes lose energy
// sooner, leaving the lower strings to ring through the soundboard.
const PARTIALS = [
  [1, 0.83], [0.68, 0.51], [0.43, 0.36], [0.28, 0.27], [0.25, 0.20],
  [0.16, 0.165], [0.12, 0.131], [0.08, 0.108], [0.064, 0.092],
  [0.047, 0.076], [0.035, 0.065], [0.026, 0.058], [0.019, 0.049],
];
const STRINGS = [[-0.94, 0.27, 0.81], [0, 0.52, 1.12], [1.07, 0.21, 0.93]];

function addMode(samples, frequency, amount, decay, phase) {
  const angle = TAU * frequency / SAMPLE_RATE, damping = Math.exp(-1 / (decay * SAMPLE_RATE));
  const step = 2 * damping * Math.cos(angle), loss = damping * damping;
  let last = amount * Math.sin(phase - angle) / damping, current = amount * Math.sin(phase);
  // Stop this partial below an inaudible level. Advancing a damped oscillator
  // by recurrence keeps the first strike cheap enough to render on demand.
  const length = Math.min(samples.length, Math.ceil(8.2 * decay * SAMPLE_RATE));
  for (let i = 0; i < length; i++) {
    samples[i] += current;
    const next = step * current - loss * last;
    last = current;
    current = next;
  }
}

/** Render a struck key from scratch. Sample amplitudes are original, mono and bounded. */
export function pianoSample(midi) {
  if (!isPianoKey(midi)) return null;
  const high = (midi - 60) / 12, fundamental = 440 * 2 ** ((midi - 69) / 12);
  const samples = new Float32Array(Math.round(SAMPLE_RATE * (2.7 - 0.35 * high)));
  const stiffness = 0.00019 + 0.00017 * high;
  for (let i = 0; i < PARTIALS.length; i++) {
    const [amplitude, decay] = PARTIALS[i], harmonic = i + 1;
    const stretched = fundamental * harmonic * Math.sqrt((1 + stiffness * harmonic ** 2) / (1 + stiffness));
    for (const [cents, weight, sustain] of STRINGS) {
      const frequency = stretched * 2 ** (cents / 1200);
      addMode(samples, frequency, amplitude * weight, decay * sustain * (1 - 0.22 * high), 0.29 * harmonic + 0.17 * cents);
    }
  }
  // Short, quiet resonances from the key and soundboard give the attack some wood.
  addMode(samples, 185 + fundamental * 0.09, 0.105, 0.055, 0.1);
  addMode(samples, 378 + fundamental * 0.12, 0.069, 0.041, 0.6);

  const strikeLength = Math.round(SAMPLE_RATE * 0.052), attack = Math.round(SAMPLE_RATE * 0.003);
  const tail = Math.round(SAMPLE_RATE * 0.17), tapDecay = Math.exp(-1 / (0.011 * SAMPLE_RATE));
  let noise = midi * 9177, fast = 0, slow = 0, tap = 0.31, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    if (i < strikeLength) {
      noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
      const white = noise / 0x80000000 - 1;
      fast += 0.47 * (white - fast);
      slow += 0.105 * (white - slow);
      samples[i] += (fast - slow) * tap * Math.min(1, (strikeLength - i) / 90);
      tap *= tapDecay;
    }
    const rise = Math.min(1, i / attack), fall = Math.min(1, (samples.length - 1 - i) / tail);
    samples[i] *= rise * rise * (3 - 2 * rise) * fall;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const gain = (0.39 - 0.04 * high) / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return { samples, sampleRate: SAMPLE_RATE };
}

/** One shared instrument per audio context. Buffers are cached by pitch. */
export class Piano {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.output = output;
    this.notes = new Map();
    this.voices = new Set();
  }

  play(midi, durationSeconds) {
    if (!isPianoKey(midi)) return false;
    let buffer = this.notes.get(midi);
    if (!buffer) {
      const { samples, sampleRate } = pianoSample(midi);
      buffer = this.ctx.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);
      this.notes.set(midi, buffer);
    }

    const at = this.ctx.currentTime, source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    const hold = Number.isFinite(durationSeconds) ? Math.max(0.02, durationSeconds) : Infinity;
    const release = hold + DAMPER_FADE < buffer.duration ? at + hold : Infinity;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.output);
    const voice = { source, gain, release };
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      gain.disconnect();
    };
    if (this.voices.size >= MAX_VOICES) {
      const oldest = this.voices.values().next().value;
      this.voices.delete(oldest);
      const end = Math.max(at, Math.min(at + STEAL_FADE, oldest.release + DAMPER_FADE));
      const level = at <= oldest.release ? 1 : Math.max(0, 1 - (at - oldest.release) / DAMPER_FADE);
      oldest.gain.gain.cancelScheduledValues(at);
      oldest.gain.gain.setValueAtTime(level, at);
      oldest.gain.gain.linearRampToValueAtTime(0, end);
      oldest.source.stop(end);
    }
    source.start(at);
    if (release < Infinity) {
      gain.gain.setValueAtTime(1, release);
      gain.gain.linearRampToValueAtTime(0, release + DAMPER_FADE);
      source.stop(release + DAMPER_FADE);
    }
    this.voices.add(voice);
    return true;
  }
}
