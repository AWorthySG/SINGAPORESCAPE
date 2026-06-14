import { TILE, TICK_MS } from '../config.js';
import { lerp } from '../core/utils.js';

// Shared movement for the player and NPCs. Movement is time-based and decoupled
// from the combat tick: walking = 1 tile / 600ms, running = 1 tile / 300ms.
export class Character {
  constructor(x, y) {
    this.x = x;   // current tile
    this.y = y;
    this.tx = x;  // tile being moved toward
    this.ty = y;
    this.progress = 0;
    this.moving = false;
    this.running = false;
    this.path = [];
    this.facing = { dx: 0, dy: 1 };
    this.moveDuration = TICK_MS;
  }

  setPath(path, running = false) {
    this.path = path ? [...path] : [];
    this.running = running;
    if (!this.moving) this._beginStep();
  }

  stop() {
    this.path = [];
    if (this.moving) {
      // Finish the current step so we land cleanly on a tile.
      this.path = [{ x: this.tx, y: this.ty }];
    }
  }

  stopNow() {
    this.path = [];
    this.moving = false;
    this.progress = 0;
    this.tx = this.x;
    this.ty = this.y;
  }

  _beginStep() {
    const next = this.path.shift();
    if (!next) { this.moving = false; this.progress = 0; return; }
    this.tx = next.x;
    this.ty = next.y;
    this.facing = { dx: Math.sign(this.tx - this.x), dy: Math.sign(this.ty - this.y) };
    this.moveDuration = this.running ? TICK_MS / 2 : TICK_MS;
    this.moving = true;
  }

  update(dt) {
    if (!this.moving) {
      if (this.path.length) this._beginStep();
      if (!this.moving) return;
    }
    this.progress += dt / this.moveDuration;
    let guard = 0;
    while (this.progress >= 1 && guard++ < 8) {
      this.x = this.tx;
      this.y = this.ty;
      this.progress -= 1;
      if (this.path.length) {
        this._beginStep();
      } else {
        this.moving = false;
        this.progress = 0;
        break;
      }
    }
  }

  get isMoving() { return this.moving; }

  /** Authoritative tile the entity occupies. */
  tile() { return { x: this.x, y: this.y }; }

  /** Pixel centre for rendering (interpolated mid-step). */
  renderCenter() {
    const fx = this.x * TILE + TILE / 2;
    const fy = this.y * TILE + TILE / 2;
    if (!this.moving) return { x: fx, y: fy };
    const txp = this.tx * TILE + TILE / 2;
    const typ = this.ty * TILE + TILE / 2;
    return { x: lerp(fx, txp, this.progress), y: lerp(fy, typ, this.progress) };
  }
}
