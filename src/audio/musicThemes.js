import { COAST_THEMES } from './musicCoast.js';
import { GREEN_THEMES } from './musicGreen.js';
import { WILD_THEMES } from './musicWild.js';

// Heard on the title screen and on roads between named regions.
const ISLAND_THEME = {
  title: 'Between the Islands',
  bpm: 68,
  lead: 'keys',
  pattern: 'gentle',
  chords: [
    [41, 57, 60, 64], [50, 57, 60, 65], [46, 53, 57, 62], [48, 55, 57, 64],
    [45, 55, 60, 64], [50, 57, 65, 72], [43, 53, 58, 62], [48, 55, 60, 65],
  ],
  melody: [
    [[0.5, 69, 1], [2, 72, 1.4]],
    [[0, 76, 1.5, 0.65], [2.5, 74, 1]],
    [[0.5, 72, 0.8], [1.5, 69, 2]],
    [[1, 67, 1], [2.75, 64, 0.9, 0.6]],
    [[0.5, 69, 0.9], [2, 76, 1.4]],
    [[0.25, 77, 0.75, 0.64], [1.5, 74, 1.6]],
    [[0.75, 70, 1.2], [2.5, 69, 0.75]],
    [[0, 67, 1], [1.5, 65, 1.8]],
  ],
};

export const MUSIC_THEMES = Object.freeze({
  Singapore: ISLAND_THEME,
  ...COAST_THEMES,
  ...GREEN_THEMES,
  ...WILD_THEMES,
});

export function musicTheme(zone) {
  return Object.hasOwn(MUSIC_THEMES, zone) ? MUSIC_THEMES[zone] : ISLAND_THEME;
}
