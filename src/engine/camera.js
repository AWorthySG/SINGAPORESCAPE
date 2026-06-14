import { TILE } from '../config.js';
import { lerp } from '../core/utils.js';

// Camera centred on a world pixel point, with smooth follow.
export class Camera {
  constructor() {
    this.cx = 0; // world-pixel x at the centre of the viewport
    this.cy = 0;
    this.viewW = 0;
    this.viewH = 0;
    this.snapped = false;
  }

  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  /** Follow a world-pixel target (usually the player's centre). */
  follow(targetX, targetY, smoothing = 0.18, clampRect = null) {
    if (!this.snapped) {
      this.cx = targetX;
      this.cy = targetY;
      this.snapped = true;
    } else {
      this.cx = lerp(this.cx, targetX, smoothing);
      this.cy = lerp(this.cy, targetY, smoothing);
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
    return { x: wx - this.originX, y: wy - this.originY };
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.originX, y: sy + this.originY };
  }

  /** Convert a screen pixel to a tile coordinate. */
  screenToTile(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  }
}
