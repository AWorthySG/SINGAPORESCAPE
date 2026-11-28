import { TUNES } from './islandlife.js';

// The first phrase stays recognisable. Encores reprise it with a short ending,
// and the duets leave a phrase for the stage partner to play.
const VOICINGS = {
  kopi: { bpm: 90, ending: [2, 1, 0], variation: [0, 1, 0, 2, 1, 0], partner: [0, 1, 2], response: [1, 2, 0] },
  market: { bpm: 98, ending: [1, 2, 0], variation: [1, 2, 1, 0, 2, 0], partner: [1, 0, 2], response: [1, 2, 1] },
  harbour: { bpm: 84, ending: [1, 0, 1], variation: [2, 0, 1, 2, 1, 0], partner: [2, 1, 2], response: [1, 0, 1] },
  rain: { bpm: 88, ending: [2, 1, 0], variation: [0, 0, 2, 1, 2, 0], partner: [0, 2, 1], response: [0, 1, 1] },
  tide: { bpm: 86, ending: [1, 0, 1], variation: [1, 2, 1, 0, 1, 2], partner: [1, 2, 0], response: [0, 1, 2] },
  lanterns: { bpm: 94, ending: [1, 2, 0], variation: [2, 1, 0, 2, 1, 0], partner: [2, 0, 1], response: [1, 2, 2] },
};

export const MUSIC_ARRANGEMENTS = {
  standard: { name: 'Guided performance', level: 1 },
  encore: { name: 'Encore', level: 3 },
  variation: { name: 'Variation', level: 25 },
  duet: { name: 'Duet', level: 50 },
};

export const MUSIC_PROJECTS = [
  { id: 'hawker-set', name: 'Marina Bay evening set', stage: 'marina', level: 75, tunes: ['harbour', 'rain'], xp: 1100, bpm: 86 },
  { id: 'shore-set', name: 'Sentosa shore set', stage: 'sentosa', level: 75, tunes: ['market', 'tide'], xp: 1100, bpm: 90 },
  { id: 'festival-set', name: 'Lantern festival finale', stage: 'marina', level: 99, tunes: ['kopi', 'harbour', 'lanterns'], xp: 2000, bpm: 92 },
];

const tuneById = Object.fromEntries(TUNES.map((tune) => [tune.id, tune]));
export const encoreNotes = (tune) => [...tune.notes, ...(VOICINGS[tune.id]?.ending ?? tune.notes.slice(0, 2))];

export function musicTuneChart(tuneId, arrangement = 'standard') {
  if (!Object.hasOwn(tuneById, tuneId) || !Object.hasOwn(MUSIC_ARRANGEMENTS, arrangement)) return null;
  const tune = tuneById[tuneId], style = MUSIC_ARRANGEMENTS[arrangement];
  const { bpm, variation, partner, response } = VOICINGS[tune.id];
  const alternate = { standard: tune.notes, encore: encoreNotes(tune), variation: [...tune.notes, ...variation] };
  const xp = { standard: tune.xp, encore: tune.xp * 2, variation: Math.round(tune.xp * 1.5) + 130, duet: Math.round(tune.xp * 2) + 330 };
  const name = arrangement === 'standard' ? tune.name : `${tune.name} · ${style.name}`;
  return {
    key: `tune:${tune.id}:${arrangement}`, tune, arrangement, name, bpm, xp: xp[arrangement],
    level: Math.max(tune.level, style.level), partner: arrangement === 'duet' ? partner : null,
    phrases: arrangement === 'duet' ? [{ name: tune.name, notes: tune.notes }, { name: 'Your answer', notes: response }] : [{ name: tune.name, notes: alternate[arrangement] }],
  };
}

export function musicProjectChart(id) {
  const project = MUSIC_PROJECTS.find((entry) => entry.id === id);
  if (!project) return null;
  return {
    ...project, key: `project:${project.id}`,
    phrases: project.tunes.map((tuneId) => ({ name: tuneById[tuneId].name, notes: encoreNotes(tuneById[tuneId]) })),
  };
}

export function musicChartByKey(key) {
  const [kind, id, arrangement] = typeof key === 'string' ? key.split(':') : [];
  const chart = kind === 'tune' ? musicTuneChart(id, arrangement) : kind === 'project' ? musicProjectChart(id) : null;
  return chart?.key === key ? chart : null;
}

export const MUSIC_PRACTICE_KEYS = [
  ...TUNES.flatMap((tune) => Object.keys(MUSIC_ARRANGEMENTS).map((style) => musicTuneChart(tune.id, style).key)),
  ...MUSIC_PROJECTS.map((project) => musicProjectChart(project.id).key),
];

export const musicChartNotes = (chart) => chart.phrases.flatMap((phrase) => phrase.notes);
export const musicBeatMs = (chart) => 60000 / chart.bpm;
export const musicBeatWindow = (chart) => Math.max(150, musicBeatMs(chart) * 0.25);

/** Each correctly played note resets the pulse. A missed beat leaves room to recover on the next note. */
export function musicBeatQuality(chart, timings) {
  if (!Array.isArray(timings) || timings.length !== musicChartNotes(chart).length) return 0;
  const beat = musicBeatMs(chart), window = musicBeatWindow(chart);
  let last = 0, onBeat = 0;
  for (const time of timings) {
    if (!Number.isFinite(time) || time < last) return 0;
    if (Math.abs(time - last - beat) <= window) onBeat++;
    last = time;
  }
  return onBeat / timings.length;
}
