// The XP display's bookkeeping, kept free of the DOM so it can be tested (the
// drawing lives in src/ui/xpdisplay.js):
//  - one running counter: gains add up while they keep coming, and a gap of
//    XP_IDLE_MS starts the next run from zero;
//  - which skills gained in the current run (their icons sit beside the total)
//    and which one gained last (it gets the progress ring);
//  - a rolling XP-per-hour rate for each skill over the last XP_RATE_WINDOW_MS,
//    kept in coarse buckets so a long session stays a handful of numbers.
// Nothing here is saved: rates start afresh each session.

export const XP_IDLE_MS = 3000;                  // the counter fades after this long without a gain
export const XP_RATE_WINDOW_MS = 10 * 60 * 1000; // XP/hour looks back this far
export const XP_RATE_BUCKET_MS = 15 * 1000;      // gains are summed in buckets this long
export const XP_RATE_MIN_SPAN_MS = 60 * 1000;    // a first lucky minute can't claim a huge rate
export const XP_RUN_SKILLS = 5;                  // at most this many skill icons beside the total

import { isMilestoneLevel } from '../render/combatfx.js';

/** Did going from level `from` to `to` pass a milestone (every tenth level,
 *  99)? Only those get the big centre-screen celebration; the rest a toast. */
export function crossesMilestone(from, to) {
  if (to - from >= 10) return true;   // ten levels in a row always hold a tenth
  for (let l = from + 1; l <= to; l++) if (isMilestoneLevel(l)) return true;
  return false;
}

// Settings > XP display.
export const XP_DISPLAY_MODES = ['combined', 'skill', 'off'];
export const XP_DISPLAY_NAMES = { combined: 'Combined', skill: 'Per skill', off: 'Off' };
/** The player's XP display choice (older saves and fresh games: Combined). */
export const xpDisplayMode = (game) => (XP_DISPLAY_MODES.includes(game?.xpDisplay) ? game.xpDisplay : 'combined');
export const nextXpDisplay = (mode) => XP_DISPLAY_MODES[(XP_DISPLAY_MODES.indexOf(mode) + 1) % XP_DISPLAY_MODES.length];

export class XpTracker {
  constructor() {
    this.run = null;          // { total, skills: [ids, oldest first], start, t }
    this.last = null;         // skill id that gained most recently
    this.buckets = new Map(); // skill id -> [{ t, xp }], oldest first
  }

  /** A gain of `amount` XP in `skill` at time `now` (ms). Returns the run. */
  add(skill, amount, now) {
    if (!(amount > 0) || !skill) return this.run;
    if (!this.active(now)) this.run = { total: 0, skills: [], start: now, t: now };
    const r = this.run;
    r.total += amount;
    r.t = now;
    const i = r.skills.indexOf(skill);
    if (i >= 0) r.skills.splice(i, 1);
    r.skills.push(skill);
    if (r.skills.length > XP_RUN_SKILLS) r.skills.shift();
    this.last = skill;
    // Rate buckets.
    let b = this.buckets.get(skill);
    if (!b) this.buckets.set(skill, b = []);
    const top = b[b.length - 1];
    if (top && now - top.t < XP_RATE_BUCKET_MS) top.xp += amount;
    else b.push({ t: now, xp: amount });
    this._prune(b, now);
    return r;
  }

  /** Is a run still counting (a gain within the last XP_IDLE_MS)? */
  active(now) {
    return !!this.run && now - this.run.t < XP_IDLE_MS;
  }

  /** The current run's total, or 0 once it has gone idle. */
  total(now) {
    return this.active(now) ? this.run.total : 0;
  }

  _prune(b, now) {
    while (b.length && now - b[0].t > XP_RATE_WINDOW_MS) b.shift();
  }

  /** Rolling XP per hour in `skill`: everything gained in the window, spread
   *  over the time since the window's first gain (at least a minute). */
  ratePerHour(skill, now) {
    const b = this.buckets.get(skill);
    if (!b) return 0;
    this._prune(b, now);
    if (!b.length) return 0;
    let sum = 0;
    for (const e of b) sum += e.xp;
    const span = Math.max(XP_RATE_MIN_SPAN_MS, now - b[0].t);
    return Math.round(sum / span * 3600000);
  }
}
