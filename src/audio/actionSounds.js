// Short acoustic cues for work, traversal and interactions. Parts use seconds
// and relative gain so every cue stays behind the existing SFX and master mix.
const tone = (hz, seconds, level, { delay = 0, bend = null, wave = 'sine', attack = 0.006 } = {}) =>
  (sfx) => sfx._tone(hz, seconds, wave, delay, level, bend, attack);
const noise = (seconds, cutoff, level, delay = 0) => (sfx) => sfx._noise(seconds, level, delay, cutoff);
const cue = (...parts) => (sfx) => { for (const part of parts) part(sfx); };

export const ACTION_SOUNDS = Object.freeze({
  // Gather on contact. The first sound locates the tool, the quieter tail
  // suggests what came loose from it.
  'gather:woodcutting': cue(                           // hollow chop, then a flake splits
    tone(215, 0.075, 0.30, { bend: 105, wave: 'triangle', attack: 0.003 }),
    noise(0.024, 1720, 0.14), noise(0.035, 2670, 0.09, 0.035),
  ),
  'gather:mining': cue(                                // hard pick, loose grit
    noise(0.043, 3180, 0.22),
    tone(1280, 0.073, 0.21, { bend: 1040, attack: 0.003 }),
    tone(358, 0.061, 0.13, { delay: 0.028, bend: 190, wave: 'triangle' }),
  ),
  'gather:fishing': cue(                               // surface splash with two drops
    noise(0.095, 1890, 0.23),
    tone(210, 0.081, 0.23, { bend: 632 }),
    tone(320, 0.056, 0.15, { delay: 0.052, bend: 778 }),
  ),
  'gather:hunter': cue(                                // latch, then a soft trap thump
    tone(525, 0.035, 0.25, { bend: 265, wave: 'triangle', attack: 0.003 }),
    noise(0.022, 1090, 0.15),
    tone(151, 0.070, 0.19, { delay: 0.034, bend: 89, wave: 'triangle' }),
  ),
  'gather:diving': cue(                                // a darker, rounder trail of bubbles
    noise(0.11, 490, 0.17),
    tone(132, 0.105, 0.21, { bend: 355, attack: 0.014 }),
    tone(263, 0.100, 0.16, { delay: 0.059, bend: 525, attack: 0.012 }),
  ),
  'gather:archaeology': cue(                           // a brush crosses the dirt twice
    noise(0.05, 3100, 0.17), noise(0.064, 2220, 0.16, 0.064),
    tone(592, 0.028, 0.12, { delay: 0.118, bend: 420, wave: 'triangle', attack: 0.003 }),
  ),
  'gather:farming': cue(                               // roots and loose soil
    noise(0.098, 840, 0.22), noise(0.05, 1670, 0.13, 0.039),
    tone(380, 0.047, 0.16, { delay: 0.038, bend: 255, wave: 'triangle' }),
  ),

  'make:cooking': cue(                                 // oil sizzles as something lands
    noise(0.174, 2980, 0.23),
    noise(0.022, 3700, 0.10, 0.042), noise(0.034, 2350, 0.11, 0.091),
  ),
  'make:smithing': cue(                                // anvil with two uneven partials
    noise(0.019, 2440, 0.16),
    tone(765, 0.199, 0.28, { attack: 0.003 }),
    tone(1403, 0.14, 0.14, { delay: 0.008, attack: 0.004 }),
  ),
  'make:smelting': cue(                                // warm furnace, then a cooling ingot
    noise(0.176, 610, 0.27),
    tone(204, 0.15, 0.22, { bend: 110, attack: 0.022 }),
    tone(995, 0.089, 0.15, { delay: 0.137, bend: 875 }),
  ),
  'make:crafting': cue(                                // two dry bench taps
    tone(605, 0.043, 0.21, { bend: 300, wave: 'triangle', attack: 0.003 }),
    noise(0.035, 1250, 0.12, 0.022),
    tone(887, 0.057, 0.14, { delay: 0.078, bend: 579, wave: 'triangle' }),
  ),
  'make:fletching': cue(                               // quick knife shavings
    noise(0.031, 2610, 0.18), noise(0.029, 2020, 0.17, 0.048), noise(0.034, 1740, 0.19, 0.099),
    tone(299, 0.044, 0.12, { delay: 0.108, bend: 226, wave: 'triangle' }),
  ),
  'make:herblore': cue(                                // dropping liquid into glass
    tone(428, 0.093, 0.21, { bend: 884, attack: 0.009 }),
    tone(1237, 0.101, 0.15, { delay: 0.048, bend: 1410 }),
    noise(0.069, 1250, 0.13, 0.079),
  ),
  'make:construction': cue(                            // paired mallet hits
    tone(248, 0.075, 0.29, { bend: 105, wave: 'triangle', attack: 0.003 }),
    noise(0.03, 1200, 0.14),
    tone(202, 0.084, 0.24, { delay: 0.080, bend: 91, wave: 'triangle', attack: 0.003 }),
    noise(0.033, 990, 0.12, 0.080),
  ),
  'make:firemaking': cue(                              // tinder scrape, then ember pops
    noise(0.040, 2260, 0.20), noise(0.106, 1160, 0.18, 0.045),
    tone(580, 0.026, 0.15, { delay: 0.055, bend: 325, attack: 0.003 }),
    tone(842, 0.026, 0.11, { delay: 0.115, bend: 435, attack: 0.003 }),
  ),
  'make:hawker': cue(                                  // ceramic plate set onto the counter
    tone(622, 0.112, 0.24, { attack: 0.003 }),
    tone(1148, 0.077, 0.14, { delay: 0.019, bend: 1009 }),
    noise(0.064, 1760, 0.12, 0.033),
  ),
  'make:archaeology': cue(                             // a sweep and the restored piece's click
    noise(0.097, 2510, 0.18),
    tone(411, 0.045, 0.19, { delay: 0.072, bend: 272, wave: 'triangle' }),
    tone(737, 0.086, 0.13, { delay: 0.101, attack: 0.009 }),
  ),

  // Footfalls sit well below a tool. The dry toe, soft rustle and hollow deck
  // are recognizable even with a quiet music bed underneath them.
  'footstep:stone': cue(tone(670, 0.039, 0.11, { bend: 380, wave: 'triangle', attack: 0.003 }), noise(0.022, 1940, 0.075)),
  'footstep:grass': cue(noise(0.065, 785, 0.13), tone(166, 0.048, 0.06, { bend: 88 })),
  'footstep:path': cue(noise(0.044, 1420, 0.135), tone(241, 0.041, 0.065, { bend: 118, wave: 'triangle' })),
  'footstep:wood': cue(tone(320, 0.061, 0.115, { bend: 168, wave: 'triangle', attack: 0.003 }), noise(0.018, 1030, 0.07)),
  'footstep:sand': cue(noise(0.077, 1420, 0.12), noise(0.027, 2120, 0.07, 0.036)),
  'footstep:water': cue(noise(0.086, 1360, 0.12), tone(154, 0.067, 0.085, { delay: 0.018, bend: 410 })),

  // A door opens into a space. Item transfers and other actions use smaller
  // gestures inside that space, so the interaction and its result can coexist.
  'interact:bank': cue(
    tone(216, 0.095, 0.22, { bend: 118, wave: 'triangle' }),
    noise(0.043, 870, 0.15), tone(668, 0.058, 0.15, { delay: 0.064, bend: 520, attack: 0.004 }),
  ),
  'interact:shop': cue(tone(776, 0.122, 0.19), tone(1163, 0.092, 0.13, { delay: 0.068 })),
  'interact:talk': cue(tone(286, 0.065, 0.15, { bend: 325, wave: 'triangle' }), tone(438, 0.082, 0.15, { delay: 0.058, bend: 492 })),
  'interact:buy': cue(tone(961, 0.061, 0.21), tone(1451, 0.084, 0.17, { delay: 0.047, attack: 0.004 })),
  'interact:sell': cue(tone(1090, 0.073, 0.19, { bend: 903 }), tone(648, 0.063, 0.21, { delay: 0.07, wave: 'triangle' })),
  'interact:deposit': cue(
    tone(546, 0.061, 0.15, { bend: 415, wave: 'triangle' }),
    tone(282, 0.077, 0.20, { delay: 0.048, bend: 205, wave: 'triangle' }), noise(0.037, 1210, 0.11, 0.044),
  ),
  'interact:withdraw': cue(tone(330, 0.055, 0.17, { bend: 440, wave: 'triangle' }), tone(721, 0.084, 0.17, { delay: 0.054, bend: 781 })),
  'interact:equip': cue(noise(0.049, 1770, 0.16), tone(645, 0.055, 0.18, { delay: 0.033, bend: 580, wave: 'triangle' })),
  'interact:unequip': cue(noise(0.063, 1110, 0.15), tone(386, 0.05, 0.14, { delay: 0.014, bend: 223, wave: 'triangle' })),
  'interact:bury': cue(noise(0.128, 570, 0.20), tone(149, 0.082, 0.14, { delay: 0.041, bend: 74, wave: 'triangle' })),
  'interact:offer': cue(tone(427, 0.135, 0.16, { attack: 0.014 }), tone(641, 0.154, 0.15, { delay: 0.063, attack: 0.018 })),
  'interact:altar': cue(tone(246, 0.208, 0.19, { attack: 0.022 }), tone(371, 0.181, 0.145, { delay: 0.037, attack: 0.029 })),
  'interact:rest': cue(noise(0.139, 420, 0.14), tone(245, 0.133, 0.16, { bend: 165, attack: 0.02 })),
  'interact:plant': cue(
    noise(0.057, 1000, 0.16), tone(360, 0.038, 0.15, { delay: 0.027, bend: 240, wave: 'triangle' }),
    tone(648, 0.041, 0.12, { delay: 0.072, bend: 505 }),
  ),
  'interact:read': cue(noise(0.105, 2640, 0.18), noise(0.038, 1720, 0.09, 0.056)),
  'interact:quest': cue(tone(392, 0.092, 0.17, { wave: 'triangle' }), tone(587, 0.14, 0.16, { delay: 0.087, attack: 0.009 })),
  'interact:potion': cue(
    tone(565, 0.059, 0.20, { bend: 278 }), tone(325, 0.057, 0.17, { delay: 0.043, bend: 184 }),
    noise(0.062, 760, 0.12, 0.046),
  ),
  'interact:agility': cue(noise(0.064, 1540, 0.15), tone(365, 0.072, 0.18, { bend: 560 }), tone(221, 0.078, 0.14, { delay: 0.067, bend: 123, wave: 'triangle' })),
  'interact:thieve': cue(noise(0.061, 2110, 0.13), tone(750, 0.037, 0.17, { delay: 0.049, bend: 617, attack: 0.003 })),
  'interact:stall': cue(tone(303, 0.068, 0.17, { bend: 202, wave: 'triangle' }), tone(817, 0.093, 0.17, { delay: 0.057 })),
  'interact:door': cue(noise(0.064, 1040, 0.18), tone(469, 0.055, 0.16, { delay: 0.055, bend: 256, wave: 'triangle' })),
  'interact:workbench': cue(tone(405, 0.063, 0.19, { bend: 280, wave: 'triangle', attack: 0.004 }), noise(0.044, 1840, 0.14, 0.032)),
  'interact:home': cue(tone(218, 0.11, 0.16, { bend: 162, wave: 'triangle' }), tone(437, 0.148, 0.14, { delay: 0.064, attack: 0.015 })),
  'interact:alchemy': cue(noise(0.087, 1800, 0.17), tone(464, 0.111, 0.16, { bend: 916 }), tone(1260, 0.078, 0.15, { delay: 0.071, attack: 0.009 })),
  'interact:defeat': cue(
    tone(293, 0.15, 0.19, { bend: 221, attack: 0.016 }),
    tone(185, 0.18, 0.16, { delay: 0.115, bend: 148, attack: 0.02 }),
  ),
  'interact:revive': cue(tone(349, 0.075, 0.19, { bend: 472 }), tone(709, 0.125, 0.18, { delay: 0.055, attack: 0.009 })),
  'interact:refine': cue(
    noise(0.033, 2060, 0.16), tone(543, 0.072, 0.19, { wave: 'triangle' }),
    tone(980, 0.123, 0.17, { delay: 0.050, bend: 1058, attack: 0.009 }),
  ),
  'interact:refine_fail': cue(noise(0.046, 1110, 0.16), tone(370, 0.132, 0.19, { bend: 168, wave: 'triangle' })),

  'travel:teleport': cue(
    noise(0.156, 1900, 0.20),
    tone(360, 0.144, 0.23, { bend: 862, attack: 0.014 }),
    tone(1046, 0.131, 0.17, { delay: 0.123, bend: 923, attack: 0.012 }),
  ),
  'travel:mrt': cue(
    noise(0.192, 515, 0.18, 0.056),
    tone(610, 0.072, 0.21, { wave: 'triangle', attack: 0.004 }),
    tone(808, 0.093, 0.18, { delay: 0.076, attack: 0.008 }),
    tone(109, 0.156, 0.13, { delay: 0.078, bend: 76, attack: 0.022 }),
  ),
  'travel:ferry': cue(
    noise(0.211, 1230, 0.21),
    tone(189, 0.193, 0.18, { bend: 148, attack: 0.024 }),
    tone(271, 0.161, 0.13, { delay: 0.074, bend: 201, attack: 0.016 }),
  ),
  'travel:cast': cue(tone(242, 0.185, 0.175, { bend: 430, attack: 0.035 }), tone(363, 0.146, 0.124, { delay: 0.066, bend: 645, attack: 0.021 })),
  'travel:fizzle': cue(noise(0.113, 1190, 0.15), tone(418, 0.151, 0.22, { bend: 185, attack: 0.011 })),

  'ui:tab': tone(485, 0.035, 0.115, { bend: 540, attack: 0.004 }),
  'ui:item': tone(592, 0.054, 0.12, { bend: 730, wave: 'triangle' }),
  'ui:choice': cue(tone(420, 0.044, 0.111), tone(638, 0.061, 0.13, { delay: 0.047 })),
  'ui:panel': cue(noise(0.031, 1000, 0.088), tone(305, 0.062, 0.115, { bend: 221, wave: 'triangle' })),
});
