import { TILE } from '../config.js';

// Camera centred on a world pixel point, with smooth follow.
const FRAME_MS = 1000 / 60;   // the follow's `smoothing` is per frame at this rate
const STEP_MS = 4;            // the spring is stepped in slices no longer than this
const JUMP_PX = TILE * 3;     // a target moving further than this in one frame jumped
export class Camera {
  constructor() {
    this.cx = 0; // world-pixel x at the centre of the viewport
    this.cy = 0;
    this.viewW = 0;
    this.viewH = 0;
    this.zoom = 1;     // screen pixels per world pixel
    this.snapped = false;
    this.vx = 0; this.vy = 0;   // the follow spring's velocity (world px per ms)
    this._tx = null; this._ty = null;   // where the target was last frame
    // The screen's own zoom (set on resize) times a small cinematic push-in
    // (fights, boss entrances; see cinematics.js). Kept apart so a resize never
    // loses the push-in and the push-in never drifts the screen's zoom.
    this.screenW = 0;
    this.screenH = 0;
    this.baseZoom = 1;
    this.zoomMul = 1;
    this.dpr = 1;      // canvas pixels per CSS pixel, for the renderer's transform
  }

  /** Size the view to a screen of w x h CSS pixels at the given zoom: the view
   *  (viewW/viewH) is measured in world pixels, so a bigger zoom shows less. */
  resize(w, h, zoom = 1, dpr = this.dpr) {
    this.screenW = w;
    this.screenH = h;
    this.baseZoom = zoom;
    this.dpr = dpr;
    this._applyZoom();
  }

  /** Push the view in (k > 1) or back out about the screen centre. The view and
   *  both conversions below use the same zoom, so taps and the hover marker
   *  still land on the right tile mid-zoom. */
  setZoomMul(k) {
    if (k === this.zoomMul) return;
    this.zoomMul = k;
    this._applyZoom();
  }

  _applyZoom() {
    this.zoom = this.baseZoom * this.zoomMul;
    this.viewW = this.screenW / this.zoom;
    this.viewH = this.screenH / this.zoom;
  }

  /**
   * Follow a world-pixel target (usually the player's centre) on a critically
   * damped spring: it eases into a walk and out of a stop without overshoot,
   * and keeps the same lag behind a walking target as the old per-frame lerp
   * did (`smoothing` is still that lerp's amount per 60fps frame; 1 snaps).
   *
   * The spring is stepped in small fixed slices (STEP_MS) with the target
   * moved smoothly across the frame, so the camera glides the same at 30Hz,
   * 60Hz and 144Hz, and a long frame (a hitch on a phone) no longer shortens
   * the lag and jolts you a few pixels across the screen. A target that jumps
   * (a teleport, a respawn) is chased from where it lands instead.
   */
  follow(targetX, targetY, smoothing = 0.18, clampRect = null, dt = 1000 / 60) {
    if (!this.snapped || smoothing >= 1) {
      this.cx = targetX;
      this.cy = targetY;
      this.vx = this.vy = 0;
      this.snapped = true;
    } else {
      dt = Math.max(0, dt);
      const tau = -FRAME_MS / Math.log(1 - Math.max(1e-4, smoothing));   // the old lerp's lag (ms)
      const omega = 2 / tau;   // a critically damped spring with that lag behind a steady walk
      const px = this._tx ?? targetX, py = this._ty ?? targetY;
      const jump = Math.abs(targetX - px) > JUMP_PX || Math.abs(targetY - py) > JUMP_PX;
      const n = Math.max(1, Math.ceil(dt / STEP_MS)), h = dt / n, decay = Math.exp(-omega * h);
      let vx = this.vx || 0, vy = this.vy || 0, x = this.cx, y = this.cy;
      for (let i = 1; i <= n; i++) {
        const f = jump ? 1 : i / n;
        const tx = px + (targetX - px) * f, ty = py + (targetY - py) * f;
        // The exact step of a critically damped spring toward a still target.
        let e = x - tx, tmp = (vx + omega * e) * h;
        vx = (vx - omega * tmp) * decay; x = tx + (e + tmp) * decay;
        e = y - ty; tmp = (vy + omega * e) * h;
        vy = (vy - omega * tmp) * decay; y = ty + (e + tmp) * decay;
      }
      this.cx = x; this.cy = y; this.vx = vx; this.vy = vy;
    }
    this._tx = targetX; this._ty = targetY;
    if (clampRect) {
      const halfW = this.viewW / 2, halfH = this.viewH / 2;
      const worldW = clampRect.width * TILE, worldH = clampRect.height * TILE;
      // Only clamp if the world is larger than the viewport on that axis
      // (held against an edge, the spring stops rather than winding up).
      if (worldW > this.viewW) { const c = Math.max(halfW, Math.min(worldW - halfW, this.cx)); if (c !== this.cx) { this.cx = c; this.vx = 0; } }
      if (worldH > this.viewH) { const c = Math.max(halfH, Math.min(worldH - halfH, this.cy)); if (c !== this.cy) { this.cy = c; this.vy = 0; } }
    }
  }

  get originX() { return this.cx - this.viewW / 2; }
  get originY() { return this.cy - this.viewH / 2; }

  worldToScreen(wx, wy) {
    return { x: (wx - this.originX) * this.zoom, y: (wy - this.originY) * this.zoom };
  }

  screenToWorld(sx, sy) {
    return { x: sx / this.zoom + this.originX, y: sy / this.zoom + this.originY };
  }

  /** Convert a screen pixel to a tile coordinate. */
  screenToTile(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  }
}

/**
 * Critically damped spring towards `target` (the "smooth damp" used by game
 * cameras): eases in and out without overshoot, and gives the same motion at
 * any frame rate. `st` carries the velocity between calls ({ v: 0 } to start);
 * `smoothMs` is roughly the time it takes to arrive.
 */
export function smoothDamp(cur, target, st, smoothMs, dtMs) {
  const omega = 2 / Math.max(1, smoothMs);
  const x = omega * Math.max(0, dtMs);
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (st.v + omega * change) * dtMs;
  st.v = (st.v - omega * temp) * decay;
  return target + (change + temp) * decay;
}
