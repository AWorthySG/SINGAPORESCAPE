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
