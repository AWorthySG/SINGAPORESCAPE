// Adaptive trim: when the game's own work each frame (update, drawing, the
// minimap) keeps running long, the purely decorative extras step down to their
// low-graphics versions (reflections in the water, ambient critters, weather
// particles, the second foam layer, the moving parts of pack monsters, and all
// of ambient.js: the breeze, water glints, flocks, town birds, hawker cats,
// steam and drifting leaves) until
// things are quick again. The pictures themselves, lighting and effects are
// never touched, so on a machine that keeps up the look is exactly as before.
// It works on the frame's work time rather than the
// time between frames, so a screen capped at 30fps (an iPhone in Low Power
// Mode) isn't mistaken for a slow one. Resolution is a separate, later step
// (main.js scales the canvas down when frames stay very slow).

// Frames that keep coming slower than this (ms between them, smoothed) also
// trim, whatever the game's own work: a phone whose painting can't keep up
// (the work time looks fine, the screen doesn't). Above a 30fps cap (33ms),
// so an iPhone in Low Power Mode isn't mistaken for a slow one.
export const SLOW_FRAME_MS = 36;
/** Whether frames arriving `slowAvg` ms apart (smoothed) call for the trim. */
export function slowFrames(slowAvg) { return slowAvg > SLOW_FRAME_MS; }
/** Whether to lower the resolution: frames still slower than ~30fps with the
 *  extras already trimmed (the picture's sharpness is the last thing to go). */
export function shouldScaleDown(slowAvg, trimmed) { return slowAvg > 33 && trimmed; }

/** How long after play starts before frames count toward the trim and the
 *  resolution: the first area's ground, pictures and monster outlines are
 *  still being made ready then (spread over frames, see BakeBudget below). */
export const SETTLE_MS = 3000;
/** Whether this frame should count toward the trim and the resolution: only
 *  in play (not on the title, whose loading runs slow on any phone) and once
 *  play has run for SETTLE_MS. */
export function judgeFrames(playing, playMs) { return !!playing && playMs >= SETTLE_MS; }

export const TRIM_ON_MS = 14;       // average work above this (ms) for TRIM_ON_HOLD: trim
export const TRIM_OFF_MS = 9;       // ...below this for TRIM_OFF_HOLD: back to full
export const TRIM_ON_HOLD = 1500;
export const TRIM_OFF_HOLD = 8000;  // slow to come back, so it doesn't flicker on and off

export class FxGovernor {
  constructor() {
    this.avg = 0;        // rolling average work per frame (ms)
    this.trim = false;
    this._since = null;  // when the wanted state last matched the current one
  }

  /** Note one frame's work (ms) at time `t` (ms); returns whether to trim. */
  frame(workMs, t) {
    if (!(workMs >= 0) || workMs > 250) return this.trim;   // a stall or a tab switch: ignore it
    this.avg = this.avg ? this.avg * 0.95 + workMs * 0.05 : workMs;
    const want = this.trim ? this.avg > TRIM_OFF_MS : this.avg > TRIM_ON_MS;
    if (want === this.trim || this._since === null) { this._since = t; return this.trim; }
    if (t - this._since >= (this.trim ? TRIM_OFF_HOLD : TRIM_ON_HOLD)) { this.trim = want; this._since = t; }
    return this.trim;
  }
}

/**
 * A time allowance a frame for one-off bakes that would otherwise all land in
 * one frame: when a rigged monster's pictures arrive, every part gets its ink
 * outline baked (rigink.js), and the depth view bakes a soft outline of each
 * tree and landmark for its cast shadow (depthview.js). Entering an area (or
 * starting the game) asked for all of them at once: most of a second in one
 * frame on a phone. The renderer starts each frame with frame(); bakers ask
 * ok() first and report what they spent. Once `ms` is used up nothing more is
 * baked until the next frame (the first bake of a frame always may run, so
 * each frame makes progress). Without frames (nothing drawing the world) the
 * allowance comes back after `idle` ms. What isn't ready yet draws as it would
 * before its pictures came: the monster's single sticker, or no cast shadow
 * for that tree a moment longer.
 */
export class BakeBudget {
  constructor(ms = 6, idle = 250, clock = () => performance.now()) {
    this.ms = ms; this.idle = idle; this.clock = clock;
    this.spent = 0; this.at = -Infinity;
  }
  /** A new frame: a fresh allowance. */
  frame() { this.spent = 0; this.at = this.clock(); }
  /** Whether a bake may run now. */
  ok() {
    if (this.spent >= this.ms && this.clock() - this.at >= this.idle) this.frame();
    return this.spent < this.ms;
  }
  /** Note a bake that took `ms`. */
  spend(ms) { this.spent += Math.max(0, ms); }
  /** Run `bake()` and note its time. */
  run(bake) {
    const t0 = this.clock();
    try { return bake(); } finally { this.spend(this.clock() - t0); }
  }
}
/** The one allowance the renderer's bakes share (renderer.js starts its frames). */
export const bakeBudget = new BakeBudget();
