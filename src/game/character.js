import { TILE, TICK_MS } from '../config.js';
import { lerp } from '../core/utils.js';
import { swingBeats } from '../render/motionkit.js';

export const TURN_MS = 150;   // how long the turn-around takes on screen

// Shared movement for the player and NPCs. Movement is time-based and decoupled
// from the combat tick: walking = 1 tile / 600ms, running = 1 tile / 300ms.
// Easing steps for the drawn offset and walking weight. Most monsters share
// each frame's dt, so reuse the calculations across them.
let _easeDt = NaN, _offsetEase = 0, _walkEase = 0;
function animationEase(dt) {
  if (dt === _easeDt) return;
  _easeDt = dt;
  _offsetEase = 1 - Math.exp(-dt / 35);
  _walkEase = 1 - Math.exp(-dt / 82);
}
const _raw = { x: 0, y: 0 };   // scratch for _tickTimers (no new object per character per frame)
// Below this (a millionth of a pixel, or of a stride) the eased offset and walk
// weight are as good as settled, and are landed on exactly 0 (see _tickTimers).
const SETTLED = 1e-6;

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
    this.stepMul = 1;     // >1 walks slower (monsters and bosses amble), <1 faster
    this.runMul = 0.5;    // running step time as a share of walking
    // Combat-feel timers (ms): hit flash + attack lunge.
    this.hurt = 0;
    this.swing = 0;
    this.swingDur = 240;
    this.lungeDX = 0;
    this.lungeDY = 0;
    this.knock = 0;      // ms of hit knockback left
    this.knockDX = 0;
    this.knockDY = 0;
    // A blow dealt as a foe's swing starts lands on screen when the swing
    // does: until then (ms) the flinch and knockback wait, unaged. Only the
    // look waits; the damage was dealt on the game's own beat.
    this.strikeWait = 0;
    this.strikeFresh = false;   // set with it; the renderer holds what the blow spawned
    // Animation state for the renderer: walkPhase counts tiles walked (one
    // footstep each), animMove eases 0..1 as walking starts and stops, and
    // turnT runs down after the character turns to face the other way.
    this.walkPhase = 0;
    this.animMove = 0;
    this.turnT = 0;
    this._fx = 1;
    // The drawn lunge/knockback offset (see _tickTimers), made here with the
    // rest so every character keeps one object shape: the frame loop reads
    // hundreds of monsters, and a mix of shapes made each read slower.
    this._offX = 0;
    this._offY = 0;
    this._offOn = false;   // until the first frame the drawn offset is the raw one
  }

  /** Where the body should be pushed this instant: a swing's lunge (a small
   *  wind-up back, a quick strike out toward the target, then an eased return)
   *  plus any hit knockback easing home. Written into `out` when given. */
  _rawOffset(out = { x: 0, y: 0 }) {
    let x = 0, y = 0;
    const beats = swingBeats(this.swingProgress());
    if (beats) {
      const amp = -1.2 * beats.wind + 5 * beats.hit;
      x += this.lungeDX * amp; y += this.lungeDY * amp;
    }
    if (this.knock > 0 && !(this.strikeWait > 0)) {   // pushed back by a hit, easing home
      const k = this.knock / 160;
      x += this.knockDX * 4 * k * k; y += this.knockDY * 4 * k * k;
    }
    out.x = x; out.y = y;
    return out;
  }

  /** Pixel offset the body is drawn at. It glides toward _rawOffset over a few
   *  frames, so a swing cut short by the next one (fast attackers) or a change
   *  of target never makes the sprite jump. */
  renderOffset() {
    if (!this._offOn) return this._rawOffset();
    return { x: this._offX, y: this._offY };
  }

  /** Swing progress 0..1 while an attack animation plays, else -1. */
  swingProgress() { return this.swing > 0 ? 1 - this.swing / this.swingDur : -1; }

  setPath(path, running = false) {
    this.path = path ? [...path] : [];
    this.running = running;
    // A new route that starts by heading back to the tile we're leaving: turn
    // round on the spot instead of finishing the step and walking back.
    const back = this.path[0];
    if (this.moving && back && back.x === this.x && back.y === this.y && (this.x !== this.tx || this.y !== this.ty)) {
      const rest = this.path.slice(1);
      this.reverseStep();
      this.path = rest;
    }
    if (!this.moving) this._beginStep();
  }

  stop() {
    // Drop the rest of the route; a step already under way still finishes
    // (update() lands it on its tile), then the character stands still. Queuing
    // the current tile again here used to leave it "walking" on the spot.
    this.path = [];
  }

  /** Turn straight back mid-step: head for the tile we came from, keeping our
   *  on-screen position (no snap), so reversing feels instant. */
  reverseStep() {
    if (!this.moving) return;
    [this.x, this.tx] = [this.tx, this.x];
    [this.y, this.ty] = [this.ty, this.y];
    this.progress = Math.max(0, 1 - this.progress);
    this.facing = { dx: Math.sign(this.tx - this.x), dy: Math.sign(this.ty - this.y) };
    this.noteFacing();
    this.path = [];
  }

  /** Start the quick turn-around animation when the facing flips left/right. */
  noteFacing() {
    const fx = this.facing.dx < 0 ? -1 : this.facing.dx > 0 ? 1 : this._fx;
    if (fx !== this._fx) {
      this._fx = fx;
      // Reverse an interrupted turn at the same width and facing on screen.
      this.turnT = this.turnT > 0 ? TURN_MS - this.turnT : TURN_MS;
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
    this.noteFacing();
    // A diagonal step covers √2 tiles of ground, so give it √2 the time —
    // otherwise the entity visibly speeds up whenever it moves diagonally.
    const diagonal = this.facing.dx !== 0 && this.facing.dy !== 0;
    const base = TICK_MS * this.stepMul * (this.running ? this.runMul : 1);
    this.moveDuration = diagonal ? base * Math.SQRT2 : base;
    this.moving = true;
  }

  /** Combat-feel and animation timers, shared by every way of moving. */
  _tickTimers(dt) {
    if (this.strikeWait > 0) this.strikeWait = Math.max(0, this.strikeWait - dt);   // the flash and knock hold till it ends
    else {
      if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt);
      if (this.knock > 0) this.knock = Math.max(0, this.knock - dt);
    }
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt);
    if (this.turnT > 0) this.turnT = Math.max(0, this.turnT - dt);
    // Ease the drawn lunge/knockback offset toward where it should be (~35ms lag).
    animationEase(dt);
    const r = this._rawOffset(_raw);
    const ox = this._offOn ? this._offX : r.x, oy = this._offOn ? this._offY : r.y;
    this._offX = ox + (r.x - ox) * _offsetEase;
    this._offY = oy + (r.y - oy) * _offsetEase;
    this._offOn = true;
    this.animMove += ((this.moving ? 1 : 0) - this.animMove) * _walkEase;
    // All but settled: land on exactly 0, so a character at rest can skip its
    // frames (see update). Left alone the easing creeps on through ever tinier
    // numbers and never quite arrives.
    if (r.x === 0 && r.y === 0 && Math.abs(this._offX) < SETTLED && Math.abs(this._offY) < SETTLED) { this._offX = 0; this._offY = 0; }
    if (!this.moving && this.animMove < SETTLED) this.animMove = 0;
  }

  update(dt) {
    // At rest (standing still, every timer run down, the drawn offset and walk
    // weight settled at 0) a frame changes nothing, so skip it: most of the
    // monsters around you stand like this most of the time.
    if (!this.moving && this._offOn && this.animMove === 0 && this._offX === 0 && this._offY === 0 && !this.path.length
      && !(this.hurt > 0) && !(this.swing > 0) && !(this.knock > 0) && !(this.turnT > 0) && !(this.strikeWait > 0)) return;
    this._tickTimers(dt);
    if (!this.moving) {
      if (this.path.length) this._beginStep();
      if (!this.moving) return;
    }
    let travelled = -this.progress;
    this.progress += dt / this.moveDuration;
    let guard = 0;
    while (this.progress >= 1 && guard++ < 8) {
      // Land cleanly on the tile, then carry the overshoot into the next step as
      // real time — consecutive steps can differ in length (a diagonal takes √2
      // longer than a straight), so carrying a raw 0..1 fraction would jitter.
      const leftover = (this.progress - 1) * this.moveDuration;
      this.x = this.tx;
      this.y = this.ty;
      travelled += 1;
      if (this.path.length) {
        this._beginStep();
        this.progress = leftover / this.moveDuration;
      } else {
        this.moving = false;
        this.progress = 0;
        break;
      }
    }
    // Feet count completed steps and the fraction of the current step. A
    // frame spent standing at the end of a path adds no extra stride.
    this.walkPhase += travelled + this.progress;
  }

  get isMoving() { return this.moving; }

  /** Last left/right facing (-1 or 1). Straight up/down moves keep it, so the
   *  drawn sprite doesn't flip to face right whenever it climbs or descends. */
  get faceX() { return this._fx; }

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
