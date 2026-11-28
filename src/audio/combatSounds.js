// Short, layered sounds for what a blow lands on and what it does. Shared
// synthesis primitives in Sfx keep these on the same mixer as weapon swings.
const tone = (hz, duration, level, { bend = null, wave = 'sine', delay = 0, attack = 0.006 } = {}) =>
  (sfx) => sfx._tone(hz, duration, wave, delay, level, bend, attack);
const noise = (duration, cutoff, level, { delay = 0, filter = 'lowpass' } = {}) =>
  (sfx) => sfx._noise(duration, level, delay, cutoff, filter);
const cue = (...parts) => (sfx) => { for (const part of parts) part(sfx); };

export const IMPACT_SOUNDS = {
  // Soft hide and cloth have short, low weight with different transients.
  beast: cue(tone(134, 0.105, 0.35, { bend: 54, wave: 'triangle' }), noise(0.043, 660, 0.15)),
  humanoid: cue(tone(179, 0.076, 0.3, { bend: 76, wave: 'triangle' }), noise(0.028, 1320, 0.15)),
  reptile: cue(noise(0.047, 2350, 0.19, { filter: 'bandpass' }), tone(385, 0.059, 0.18, { bend: 165, wave: 'triangle' })),
  dragon: cue(tone(99, 0.145, 0.35, { bend: 43, wave: 'triangle' }), noise(0.064, 1470, 0.23),
    tone(685, 0.085, 0.12, { bend: 318, delay: 0.011 })),
  aquatic: cue(noise(0.061, 810, 0.22, { filter: 'bandpass' }), tone(265, 0.047, 0.23, { bend: 520 }),
    tone(760, 0.057, 0.1, { bend: 480, delay: 0.028 })),
  slime: cue(tone(171, 0.062, 0.29, { bend: 354 }), tone(310, 0.103, 0.16, { bend: 109, delay: 0.028 }),
    noise(0.052, 540, 0.1)),
  shell: cue(noise(0.022, 3320, 0.27), tone(992, 0.075, 0.2, { bend: 730, delay: 0.009 }),
    tone(285, 0.064, 0.16, { bend: 149, wave: 'triangle' })),
  bug: cue(tone(1370, 0.043, 0.19, { bend: 784, wave: 'triangle' }),
    noise(0.024, 3980, 0.17, { filter: 'bandpass' })),
  avian: cue(noise(0.073, 2850, 0.14, { filter: 'highpass' }),
    tone(1194, 0.074, 0.145, { bend: 834, attack: 0.012 })),
  undead: cue(tone(619, 0.064, 0.22, { wave: 'triangle', bend: 420 }),
    tone(829, 0.047, 0.14, { wave: 'triangle', bend: 620, delay: 0.032 }),
    noise(0.028, 2360, 0.12, { filter: 'bandpass' })),
  spirit: cue(noise(0.083, 3270, 0.105, { filter: 'highpass' }),
    tone(422, 0.13, 0.19, { bend: 980, attack: 0.027 }),
    tone(946, 0.091, 0.085, { bend: 1300, delay: 0.049, attack: 0.018 })),
  construct: cue(noise(0.073, 705, 0.34), tone(256, 0.073, 0.26, { bend: 91, wave: 'triangle' }),
    noise(0.026, 1880, 0.125, { delay: 0.043 })),
  metal: cue(tone(1088, 0.135, 0.24, { attack: 0.003 }),
    tone(1757, 0.153, 0.13, { attack: 0.003 }),
    tone(2581, 0.092, 0.077), noise(0.019, 4290, 0.09, { filter: 'highpass' })),
  demon: cue(tone(73, 0.152, 0.39, { bend: 123, wave: 'triangle', attack: 0.01 }),
    tone(136, 0.124, 0.14, { bend: 72, wave: 'triangle' }), noise(0.046, 1510, 0.14)),
  flora: cue(tone(396, 0.093, 0.25, { bend: 223, wave: 'triangle' }), noise(0.035, 1550, 0.21),
    tone(1011, 0.035, 0.1, { bend: 740, delay: 0.026 })),
};

// The same material still leads on a critical hit. A short double crack and
// bright tap make the distinction clear over the wind-up and regular blows.
export const impactCrit = cue(
  noise(0.022, 3900, 0.18, { delay: 0.009, filter: 'bandpass' }),
  noise(0.023, 2530, 0.14, { delay: 0.035, filter: 'bandpass' }),
  tone(2039, 0.071, 0.086, { bend: 1320, wave: 'triangle', delay: 0.015 }),
);

export const HURT_SOUNDS = {
  melee: cue(tone(200, 0.16, 0.42, { wave: 'triangle', bend: 80, attack: 0.008 }), noise(0.05, 900, 0.16)),
  heavy: cue(tone(102, 0.19, 0.49, { bend: 40, wave: 'triangle', attack: 0.011 }),
    noise(0.071, 1220, 0.25), tone(147, 0.081, 0.14, { bend: 63, delay: 0.037 })),
  magic: cue(tone(566, 0.11, 0.21, { bend: 208 }), tone(214, 0.099, 0.2, { wave: 'triangle', bend: 97 }),
    noise(0.049, 2270, 0.12, { filter: 'bandpass' })),
  hazard: cue(noise(0.082, 1750, 0.23, { filter: 'bandpass' }),
    tone(126, 0.13, 0.35, { bend: 56, wave: 'triangle' }), noise(0.033, 950, 0.13, { delay: 0.049 })),
};

export const ABILITY_SOUNDS = {
  attack: cue(noise(0.072, 2530, 0.21, { filter: 'bandpass' }),
    tone(312, 0.107, 0.32, { bend: 630, wave: 'triangle' })),
  guard: cue(tone(720, 0.075, 0.25, { wave: 'triangle', bend: 510 }), tone(1045, 0.142, 0.13, { delay: 0.028 })),
  buff: cue(tone(330, 0.126, 0.26, { wave: 'triangle', attack: 0.018 }),
    tone(494, 0.151, 0.2, { wave: 'triangle', delay: 0.064, attack: 0.014 })),
  heal: cue(tone(494, 0.136, 0.24, { attack: 0.014 }),
    tone(659, 0.174, 0.22, { delay: 0.042, attack: 0.014 }), tone(880, 0.168, 0.105, { delay: 0.095 })),
  ultimate: cue(noise(0.17, 840, 0.22), tone(113, 0.283, 0.41, { bend: 65, wave: 'triangle', attack: 0.012 }),
    tone(440, 0.162, 0.22, { delay: 0.044 }), tone(660, 0.21, 0.165, { delay: 0.114 })),
  ready: cue(tone(784, 0.064, 0.185), tone(1047, 0.082, 0.15, { delay: 0.038 })),
  special: cue(tone(378, 0.09, 0.3, { wave: 'triangle', bend: 890 }), noise(0.059, 2430, 0.16),
    tone(1390, 0.072, 0.11, { bend: 930, delay: 0.055 })),
  windup: cue(tone(138, 0.278, 0.34, { wave: 'triangle', bend: 287, attack: 0.065 }),
    tone(275, 0.215, 0.13, { bend: 450, delay: 0.075, attack: 0.044 })),
  dodge: cue(noise(0.07, 2140, 0.16, { filter: 'bandpass' }),
    tone(747, 0.053, 0.12, { bend: 1060 })),
  block: cue(noise(0.031, 1600, 0.16), tone(428, 0.119, 0.24, { wave: 'triangle', bend: 256 })),
  boss: cue(noise(0.166, 770, 0.24), tone(82, 0.34, 0.38, { wave: 'triangle', bend: 166, attack: 0.035 }),
    tone(164, 0.254, 0.14, { wave: 'triangle', bend: 98, delay: 0.053 })),
  interrupt: cue(tone(1125, 0.064, 0.23, { wave: 'triangle', bend: 493, attack: 0.003 }),
    noise(0.031, 2670, 0.17), tone(281, 0.1, 0.19, { bend: 160, delay: 0.045 })),
  faith: cue(tone(262, 0.255, 0.24, { wave: 'triangle', attack: 0.023 }),
    tone(523, 0.19, 0.2, { delay: 0.044 }), tone(784, 0.227, 0.16, { delay: 0.117 }),
    tone(1047, 0.21, 0.095, { delay: 0.164 })),
  bless: cue(tone(587, 0.115, 0.14), tone(880, 0.12, 0.11, { delay: 0.045, attack: 0.012 })),
};

// A quieter layer over the casting weapon. Its release still supplies the
// basic staff, wand, orb or censer sound.
export const ELEMENT_SOUNDS = {
  wind: cue(noise(0.086, 2950, 0.14, { filter: 'bandpass' }), tone(895, 0.082, 0.085, { bend: 1450 })),
  water: cue(tone(275, 0.072, 0.15, { bend: 620 }), tone(433, 0.097, 0.077, { bend: 810, delay: 0.037 })),
  earth: cue(noise(0.077, 710, 0.15), tone(127, 0.114, 0.17, { bend: 55, wave: 'triangle' })),
  fire: cue(noise(0.11, 1740, 0.17), tone(290, 0.084, 0.098, { bend: 125, wave: 'triangle' })),
  chaos: cue(tone(411, 0.104, 0.13, { bend: 1090, wave: 'triangle' }),
    tone(619, 0.087, 0.095, { bend: 255, delay: 0.022, wave: 'triangle' })),
  dark: cue(tone(207, 0.132, 0.16, { bend: 82, wave: 'triangle' }), noise(0.084, 920, 0.1, { delay: 0.024 })),
  blood: cue(tone(154, 0.074, 0.17, { bend: 248 }),
    tone(293, 0.089, 0.105, { bend: 146, wave: 'triangle', delay: 0.045 })),
  radiance: cue(tone(1047, 0.123, 0.106), tone(1568, 0.115, 0.08, { delay: 0.035 })),
  grace: cue(tone(494, 0.135, 0.12, { attack: 0.02 }), tone(659, 0.13, 0.08, { attack: 0.018, delay: 0.038 })),
  judgement: cue(tone(652, 0.12, 0.14, { bend: 440, wave: 'triangle' }),
    tone(1287, 0.085, 0.075, { delay: 0.016 })),
  sanctuary: cue(tone(330, 0.144, 0.13, { attack: 0.021 }),
    tone(660, 0.126, 0.092, { attack: 0.028, delay: 0.035 })),
  holyfire: cue(noise(0.093, 2150, 0.12, { filter: 'bandpass' }),
    tone(784, 0.104, 0.122, { bend: 1109, delay: 0.026 })),
  wrath: cue(tone(173, 0.106, 0.166, { bend: 104, wave: 'triangle' }),
    noise(0.027, 2830, 0.118), noise(0.032, 1720, 0.091, { delay: 0.037 })),
  ash: cue(noise(0.129, 1270, 0.133, { filter: 'bandpass' }), tone(267, 0.103, 0.106, { bend: 188, attack: 0.026 })),
  bloodprice: cue(tone(118, 0.082, 0.173, { bend: 59, wave: 'triangle' }),
    tone(178, 0.1, 0.141, { bend: 82, wave: 'triangle', delay: 0.064 })),
};
