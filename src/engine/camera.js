import { TILE } from '../config.js';
import { lerp } from '../core/utils.js';

// Camera centred on a world pixel point, with smooth follow.
export class Camera {
  constructor() {
    this.cx = 0; // world-pixel x at the centre of the viewport
    this.cy = 0;
    this.viewW = 0;
    this.viewH = 0;
    this.zoom = 1;     // screen pixels per world pixel
    this.snapped = false;
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
   * Follow a world-pixel target (usually the player's centre).
   * `smoothing` is expressed per 60fps frame and corrected for the real frame
   * time so the camera glides identically on 30Hz, 60Hz and 144Hz displays
   * (a raw per-frame lerp speeds up / stutters with the refresh rate).
   */
  follow(targetX, targetY, smoothing = 0.18, clampRect = null, dt = 1000 / 60) {
    if (!this.snapped) {
      this.cx = targetX;
      this.cy = targetY;
      this.snapped = true;
    } else {
      const k = 1 - Math.pow(1 - smoothing, Math.max(0, dt) / (1000 / 60));
      this.cx = lerp(this.cx, targetX, k);
      this.cy = lerp(this.cy, targetY, k);
    }
    if (clampRect) {
      const halfW = this.viewW / 2, halfH = this.viewH / 2;
      const worldW = clampRect.width * TILE, worldH = clampRect.height * TILE;
      // Only clamp if the world is larger than the viewport on that axis.
      if (worldW > this.viewW) this.cx = Math.max(halfW, Math.min(worldW - halfW, this.cx));
      if (worldH > this.viewH) this.cy = Math.max(halfH, Math.min(worldH - halfH, this.cy));
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
