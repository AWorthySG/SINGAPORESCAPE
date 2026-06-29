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
    // Combat-feel timers (ms): hit flash + attack lunge.
    this.hurt = 0;
    this.swing = 0;
    this.lungeDX = 0;
    this.lungeDY = 0;
  }

  /** Pixel lunge offset while mid-swing (out toward the target and back). */
  renderOffset() {
    if (this.swing <= 0) return { x: 0, y: 0 };
    const amp = Math.sin((1 - this.swing / 180) * Math.PI) * 5;
    return { x: this.lungeDX * amp, y: this.lungeDY * amp };
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
    // A diagonal step covers √2 tiles of ground, so give it √2 the time —
    // otherwise the entity visibly speeds up whenever it moves diagonally.
    const diagonal = this.facing.dx !== 0 && this.facing.dy !== 0;
    const base = this.running ? TICK_MS / 2 : TICK_MS;
    this.moveDuration = diagonal ? base * Math.SQRT2 : base;
    this.moving = true;
  }

  update(dt) {
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt);
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt);
    if (!this.moving) {
      if (this.path.length) this._beginStep();
      if (!this.moving) return;
    }
    this.progress += dt / this.moveDuration;
    let guard = 0;
    while (this.progress >= 1 && guard++ < 8) {
      // Land cleanly on the tile, then carry the overshoot into the next step as
      // real time — consecutive steps can differ in length (a diagonal takes √2
      // longer than a straight), so carrying a raw 0..1 fraction would jitter.
      const leftover = (this.progress - 1) * this.moveDuration;
      this.x = this.tx;
      this.y = this.ty;
      if (this.path.length) {
        this._beginStep();
        this.progress = leftover / this.moveDuration;
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

  /** Tile to plan a fresh path FROM: the tile we're stepping onto when mid-step,
   *  otherwise the tile we occupy. Re-pathing from the stale `x,y` while between
   *  tiles makes an entity briefly walk backwards (visible chase jitter). */
  stepTile() { return this.moving ? { x: this.tx, y: this.ty } : { x: this.x, y: this.y }; }

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
