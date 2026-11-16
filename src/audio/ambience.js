// Region ambience: quiet, looping sound beds synthesised with Web Audio (no
// files), crossfaded by region and time of day: cicadas and insects in the
// jungles by day, crickets after dark, waves on the coasts, a murmur with a
// hawker's sizzle and the odd clink of crockery in town, and a low wind in the
// lawless lands. Every node is made once when audio unlocks; after that only
// gain levels and the odd envelope change, so nothing piles up over a session.

export const BEDS = ['insects', 'crickets', 'waves', 'town', 'wind'];

const TOWN = new Set(['Kampong Glam', 'Chinatown', 'Marina Bay', 'Tuas Docklands', 'Singapore']);
const COAST = new Set(['Sentosa Beach', 'Changi Coast', 'Southern Islands', 'Coney Island', 'Punggol Waterway']);
const JUNGLE = new Set(['Bukit Timah', 'Jurong Forest', 'Mandai Rainforest', 'Sungei Buloh Wetlands', 'Pulau Ubin',
  'Kranji Farmlands', 'Gardens by the Bay']);
const RESERVOIR = new Set(['MacRitchie Reservoir']);
const BLEAK = new Set(['The Wilderness', 'Pulau Hantu', 'Tekong Badlands', 'The Shadow Rift', 'Temasek Ruins', 'The Celestial Peaks']);

/**
 * How loud each bed should be (0..1) in a region at a darkness level (0 noon
 * .. 1 midnight). Pure, so it can be tested without any audio.
 */
export function ambienceMix(zone, night = 0) {
  const day = 1 - night;
  const m = { insects: 0, crickets: 0, waves: 0, town: 0, wind: 0 };
  if (TOWN.has(zone)) {
    m.town = 0.75 * (1 - 0.6 * night);       // hawker centres quieten late at night
    m.crickets = 0.25 * night;
  } else if (COAST.has(zone)) {
    m.waves = 0.8;
    m.insects = 0.12 * day;
    m.crickets = 0.35 * night;
  } else if (JUNGLE.has(zone)) {
    m.insects = 0.7 * day;
    m.crickets = 0.75 * night;
    if (zone === 'Sungei Buloh Wetlands' || zone === 'Pulau Ubin') m.waves = 0.25;   // water at the mangrove edge
  } else if (RESERVOIR.has(zone)) {
    m.waves = 0.3;                            // a gentle lap on the shore
    m.insects = 0.45 * day;
    m.crickets = 0.6 * night;
  } else if (BLEAK.has(zone)) {
    m.wind = 0.7;
    m.crickets = 0.15 * night;
  } else {
    m.insects = 0.3 * day;
    m.crickets = 0.4 * night;
  }
  return m;
}

/** The fixed node graph for the beds, built on an existing AudioContext and
 *  connected into `out` (the game's master gain, so mute and volume apply). */
export class AmbienceBed {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(out);
    this.gain = {};
    for (const b of BEDS) { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.out); this.gain[b] = g; }
    // One looping second of white noise feeds every noisy bed through its own filter.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    const lfo = (freq, depth, param, type = 'sine') => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = depth;
      o.connect(g); g.connect(param); o.start();
    };
    const filter = (type, freq, q) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; noise.connect(f); return f; };
    const swell = (src, base, dest) => { const g = ctx.createGain(); g.gain.value = base; src.connect(g); g.connect(dest); return g; };
    // Waves: low rumbling noise that swells in and draws back every ~11s.
    const waves = swell(filter('lowpass', 520, 0.7), 0.55, this.gain.waves);
    lfo(0.09, 0.45, waves.gain);
    // Wind: a hollow band of noise, slowly gusting.
    const wind = swell(filter('bandpass', 320, 1.4), 0.5, this.gain.wind);
    lfo(0.05, 0.4, wind.gain);
    // Town: a crowd's murmur, the sizzle of a wok, and a clink now and then.
    swell(filter('bandpass', 440, 0.8), 0.6, this.gain.town);
    swell(filter('highpass', 5200, 0.5), 0.07, this.gain.town);
    this.clinkOsc = ctx.createOscillator();
    this.clinkOsc.type = 'triangle'; this.clinkOsc.frequency.value = 2600;
    this.clinkGain = ctx.createGain(); this.clinkGain.gain.value = 0;
    this.clinkOsc.connect(this.clinkGain); this.clinkGain.connect(this.gain.town); this.clinkOsc.start();
    // Cicadas: a narrow, buzzing band of noise pulsing fast, swelling slowly.
    const buzz = ctx.createGain(); buzz.gain.value = 0.5;
    filter('bandpass', 5600, 9).connect(buzz);
    lfo(28, 0.5, buzz.gain, 'square');
    const cicada = swell(buzz, 1.6, this.gain.insects);
    lfo(0.07, 1.3, cicada.gain);
    // Crickets: a high tone chirping in quick trills, in bursts.
    const tone = ctx.createOscillator();
    tone.type = 'sine'; tone.frequency.value = 4300;
    const trill = ctx.createGain(); trill.gain.value = 0.5;
    const burst = ctx.createGain(); burst.gain.value = 0.5;
    tone.connect(trill); trill.connect(burst); burst.connect(this.gain.crickets); tone.start();
    lfo(17, 0.5, trill.gain, 'square');
    lfo(0.7, 0.5, burst.gain, 'square');
    noise.start();
  }

  /** Ease every bed toward its level for this region and hour (over ~2s), and
   *  set the ambience's overall level (0 when switched off). */
  set(mix, level) {
    const t = this.ctx.currentTime;
    for (const b of BEDS) this.gain[b].gain.setTargetAtTime((mix[b] || 0) * BED_VOL[b], t, 1.2);
    this.out.gain.setTargetAtTime(level, t, 0.6);
    // In town, the odd clink of a spoon on a plate (an envelope on the one
    // tone, never a new node).
    if (mix.town > 0.2 && Math.random() < 0.3) {
      const at = t + Math.random() * 0.8;
      this.clinkOsc.frequency.setValueAtTime(2200 + Math.random() * 1400, at);
      this.clinkGain.gain.setValueAtTime(0, at);
      this.clinkGain.gain.linearRampToValueAtTime(0.05, at + 0.005);
      this.clinkGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      this.clinkGain.gain.setValueAtTime(0, at + 0.19);
    }
  }
}

// Each bed's loudest (before the overall ambience level and the game's volume).
const BED_VOL = { insects: 0.06, crickets: 0.025, waves: 0.32, town: 0.16, wind: 0.22 };
