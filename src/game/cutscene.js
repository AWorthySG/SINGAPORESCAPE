// A short in-engine scene: letterbox bars slide in, the camera eases toward
// whoever is speaking, their lines show one at a time in a speech bubble with
// their portrait, and the bars slide out again. Pure state (no DOM, no canvas):
// the story (src/game/story.js) drives it each frame, the camera reads `pan`,
// and the overlay in src/ui/storyui.js draws it.
//
// It never traps the player: a tap moves to the next line, Skip (or Esc) ends
// it, and every line moves on by itself after a while. With reduce motion the
// bars appear at once and the camera stays put (`pan` is always 0).

export const SCENE_IN_MS = 450;       // the bars slide in (and the camera eases over)
export const SCENE_OUT_MS = 350;      // ...and back out
export const LINE_GUARD_MS = 250;     // a tap this soon after a line appears doesn't skip it unread
export const lineMs = (text) => Math.min(9000, 2600 + 45 * String(text || '').length);   // a line moves on by itself after this

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class Cutscene {
  /** lines: [{ who, name, text }]; opts: { reduce, kind, title, focus(line) -> {x,y} | null } */
  constructor(lines, opts = {}) {
    this.lines = (lines || []).filter((l) => l && l.text);
    this.reduce = !!opts.reduce;
    this.kind = opts.kind || 'scene';
    this.title = opts.title || '';
    this.id = opts.id || null;
    this.phase = this.lines.length ? 'in' : 'done';
    this.t = 0;
    this.i = 0;
    this.skipped = false;
    if (this.reduce && this.phase === 'in') this.phase = 'line';
  }

  get done() { return this.phase === 'done'; }
  /** The line on show (null while the bars move). */
  get line() { return this.phase === 'line' ? this.lines[this.i] : null; }
  /** How far in the letterbox bars are (0..1). */
  get bars() {
    if (this.phase === 'done') return 0;
    if (this.reduce) return 1;
    if (this.phase === 'in') return ease(this.t / SCENE_IN_MS);
    if (this.phase === 'out') return 1 - ease(this.t / SCENE_OUT_MS);
    return 1;
  }
  /** How far the camera has eased toward the speaker (0..1); never with reduce motion. */
  get pan() { return this.reduce ? 0 : this.bars; }

  /** Advance the clock. Returns true when something visible changed (a new line, or the end). */
  update(dt) {
    if (this.phase === 'done') return false;
    this.t += dt;
    if (this.phase === 'in' && this.t >= SCENE_IN_MS) { this.phase = 'line'; this.t = 0; return true; }
    if (this.phase === 'line' && this.t >= lineMs(this.lines[this.i].text)) return this._advance();
    if (this.phase === 'out' && this.t >= SCENE_OUT_MS) { this.phase = 'done'; return true; }
    return false;
  }

  /** A tap: the next line (or straight to the first while the bars come in). */
  next() {
    if (this.phase === 'in') { this.phase = 'line'; this.t = 0; return true; }
    if (this.phase !== 'line' || this.t < LINE_GUARD_MS) return false;
    return this._advance();
  }

  /** Skip the rest: the bars slide away (at once with reduce motion). */
  skip() {
    if (this.phase === 'done' || this.phase === 'out') return false;
    this.skipped = true;
    this._end();
    return true;
  }

  _advance() {
    this.t = 0;
    if (++this.i < this.lines.length) return true;
    this.i = this.lines.length - 1;
    this._end();
    return true;
  }

  _end() {
    this.t = 0;
    this.phase = this.reduce ? 'done' : 'out';
  }
}
