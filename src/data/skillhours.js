// Golden hours: each life skill has its own time of day, on the in-game clock,
// when its XP is worth GOLDEN_HOUR_XP times as much, just as combat XP is worth
// more at night (the night hunt). A game day is DAY_CYCLE_MS (10 real minutes),
// so a 12-hour window (doubled from 6 hours, the owner's call) is about 5 real
// minutes, and every skill gets one each day.
// Windows are [from, to) in game hours (0-24); one that wraps past midnight
// has from > to. The reasons are flavour for the guide and the banner.

export const GOLDEN_HOUR_XP = 1.5;
// How long each skill's window lasts, in game hours.
export const GOLDEN_HOURS_LEN = 12;
// A switch for the test suite: tests that pin exact XP amounts turn golden
// hours off (tests/seed.mjs) so the in-game clock can't shift their numbers.
export const GOLDEN = { on: true };

export const SKILL_HOURS = {
  fishing:     { from: 4,  to: 16, when: 'Dawn',      why: 'the fish bite best at first light' },
  agility:     { from: 5,  to: 17, when: 'Morning',   why: 'cool air for a run' },
  farming:     { from: 6,  to: 18, when: 'Morning',   why: 'crops drink the morning dew' },
  woodcutting: { from: 8,  to: 20, when: 'Late morning', why: 'dry wood splits clean' },
  smithing:    { from: 11, to: 23, when: 'Afternoon', why: 'the forge runs hottest' },
  crafting:    { from: 12, to: 24, when: 'Afternoon', why: 'good light for fine work' },
  hunter:      { from: 16, to: 4, when: 'Dusk',      why: 'creatures stir as the day cools' },
  cooking:     { from: 17, to: 5, when: 'Evening',   why: 'dinner time at the hawker stalls' },
  fletching:   { from: 18, to: 6, when: 'Evening',   why: 'quiet hours by the lamp' },
  firemaking:  { from: 20, to: 8,  when: 'Night',     why: 'fires burn brightest in the dark' },
  thieving:    { from: 21, to: 9,  when: 'Night',     why: 'pockets are easier picked in the dark' },
  mining:      { from: 22, to: 10,  when: 'Night',     why: 'the tunnels are cool at night' },
  herblore:    { from: 0,  to: 12,  when: 'Small hours', why: 'herbs are potent by moonlight' },
  diving:      { from: 9,  to: 21,  when: 'Midday',    why: 'the sun lights the reef right to the bottom' },
  construction: { from: 7, to: 19,  when: 'Daytime',   why: 'good light, and the neighbours are awake anyway' },
};

/** Is `hour` (0-24, fractional) inside the window [from, to)? */
export function inWindow(hour, { from, to }) {
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** The skills whose golden hours are on at `hour`. */
export function goldenSkills(hour) {
  return Object.keys(SKILL_HOURS).filter((s) => inWindow(hour, SKILL_HOURS[s]));
}

/** XP multiplier for `skill` at `hour`: GOLDEN_HOUR_XP in its window, else 1. */
export function goldenMult(skill, hour) {
  const w = SKILL_HOURS[skill];
  return GOLDEN.on && w && inWindow(hour, w) ? GOLDEN_HOUR_XP : 1;
}

const fmt = (h) => { const hh = ((h % 24) + 24) % 24; const s = hh >= 12 ? 'PM' : 'AM'; const h12 = hh % 12 || 12; return `${h12} ${s}`; };
/** "6 AM – 12 PM" for a skill's window. */
export function windowLabel(skill) {
  const w = SKILL_HOURS[skill];
  return w ? `${fmt(w.from)} – ${fmt(w.to)}` : '';
}
