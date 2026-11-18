// Golden hours: each life skill has its own time of day, on the in-game clock,
// when its XP is worth GOLDEN_HOUR_XP times as much, just as combat XP is worth
// more at night (the night hunt). A game day is DAY_CYCLE_MS (10 real minutes),
// so a 6-hour window is about 2.5 real minutes, and every skill gets one each day.
// Windows are [from, to) in game hours (0-24); one that wraps past midnight
// has from > to. The reasons are flavour for the guide and the banner.

export const GOLDEN_HOUR_XP = 1.5;

export const SKILL_HOURS = {
  fishing:     { from: 4,  to: 10, when: 'Dawn',      why: 'the fish bite best at first light' },
  agility:     { from: 5,  to: 11, when: 'Morning',   why: 'cool air for a run' },
  farming:     { from: 6,  to: 12, when: 'Morning',   why: 'crops drink the morning dew' },
  woodcutting: { from: 8,  to: 14, when: 'Late morning', why: 'dry wood splits clean' },
  smithing:    { from: 11, to: 17, when: 'Afternoon', why: 'the forge runs hottest' },
  crafting:    { from: 12, to: 18, when: 'Afternoon', why: 'good light for fine work' },
  hunter:      { from: 16, to: 22, when: 'Dusk',      why: 'creatures stir as the day cools' },
  cooking:     { from: 17, to: 23, when: 'Evening',   why: 'dinner time at the hawker stalls' },
  fletching:   { from: 18, to: 24, when: 'Evening',   why: 'quiet hours by the lamp' },
  firemaking:  { from: 20, to: 2,  when: 'Night',     why: 'fires burn brightest in the dark' },
  thieving:    { from: 21, to: 3,  when: 'Night',     why: 'pockets are easier picked in the dark' },
  mining:      { from: 22, to: 4,  when: 'Night',     why: 'the tunnels are cool at night' },
  herblore:    { from: 0,  to: 6,  when: 'Small hours', why: 'herbs are potent by moonlight' },
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
  return w && inWindow(hour, w) ? GOLDEN_HOUR_XP : 1;
}

const fmt = (h) => { const hh = ((h % 24) + 24) % 24; const s = hh >= 12 ? 'PM' : 'AM'; const h12 = hh % 12 || 12; return `${h12} ${s}`; };
/** "6 AM – 12 PM" for a skill's window. */
export function windowLabel(skill) {
  const w = SKILL_HOURS[skill];
  return w ? `${fmt(w.from)} – ${fmt(w.to)}` : '';
}
