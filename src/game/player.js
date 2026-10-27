import { Character } from './character.js';
import { uid } from '../core/utils.js';
import { TILE, TICK_MS } from '../config.js';

// Free movement, MOBA style: the player glides anywhere rather than hopping
// tile to tile. fx/fy is the true position in tile units (a tile's centre is
// its whole-number coordinate); x/y stay the whole tile underfoot, so combat,
// gathering, saves and everything else that thinks in tiles is unchanged.
const BODY = 0.3;        // half-width of the player's footprint, in tiles
const LOOKAHEAD = 6;     // how many waypoints ahead a route may cut straight to

// The player. Holds combat/action state; skills, inventory and equipment live
// on the Game so the UI and save system can reach them directly.
export class Player extends Character {
  constructor(x, y) {
    super(x, y);
    this.entityId = uid();
    this.name = 'A-Worthling';
    // Quicker on their feet than the old 1 tile / 0.6s: walk ~0.42s a tile,
    // run ~0.17s a tile.
    this.stepMul = 0.7;
    this.runMul = 0.4;
    this.hp = 10;
    this.alive = true;

    this.target = null;        // NPC being attacked
    this.attackCooldown = 0;   // combat beats (300ms) until next swing
    this.action = null;        // pending interaction (resolved on arrival / each tick)

    this.style = 'accurate';   // melee combat style id
    this.rangedStyle = 'accurate'; // ranged style id
    this.danceStyle = 'flourish';  // Dancer (whip) style id
    this.spell = 'wind_strike';    // selected combat spell
    this.autoRetaliate = true;
    this.respawnTimer = 0;

    this.fx = x; this.fy = y;
    this._lx = x; this._ly = y;   // the tile last set here; any other change is a teleport
    this.stick = null;            // the held joystick direction {x, y}, or null
    this.walkable = () => true;   // set by the Game: (tileX, tileY) => can stand there
  }

  /** Top speed in tiles per millisecond (the old step times, as a speed). */
  speed() { return 1 / (TICK_MS * this.stepMul * (this.running ? this.runMul : 1)); }

  setPath(path, running = false) {
    this.path = path ? [...path] : [];
    this.running = running;
    this.moving = this.path.length > 0;
  }

  // Stopping is immediate: there's no step to finish.
  stop() { this.path = []; this.moving = false; }
  stopNow() { this.path = []; this.moving = false; this.tx = this.x; this.ty = this.y; }
  reverseStep() { this.path = []; }
  stepTile() { return { x: this.x, y: this.y }; }

  renderCenter() { return { x: this.fx * TILE + TILE / 2, y: this.fy * TILE + TILE / 2 }; }

  /** Is the footprint centred at (cx, cy) clear of walls, water and objects? */
  _free(cx, cy) {
    for (const ox of [-BODY, BODY]) for (const oy of [-BODY, BODY]) {
      if (!this.walkable(Math.round(cx + ox), Math.round(cy + oy))) return false;
    }
    return true;
  }

  /** Can the footprint travel in a straight line from a to b? */
  _clear(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.2);
    for (let i = 1; i <= n; i++) if (!this._free(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  }

  /** Move by (dx, dy), sliding along anything in the way. Returns the distance moved. */
  _slide(dx, dy) {
    const x0 = this.fx, y0 = this.fy;
    if (dx && this._free(this.fx + dx, this.fy)) this.fx += dx;
    else if (dx) this._nudge('y', dx, dy);
    if (dy && this._free(this.fx, this.fy + dy)) this.fy += dy;
    else if (dy) this._nudge('x', dy, dx);
    return Math.hypot(this.fx - x0, this.fy - y0);
  }

  /** Blocked head-on near a corner: ease sideways round it rather than sticking.
   *  `side` is the axis to ease along; `along` the blocked move, `across` the other. */
  _nudge(side, along, across) {
    if (Math.abs(across) > Math.abs(along) * 0.5) return;    // already sliding: let it
    const step = Math.abs(along);
    for (const off of [0.12, 0.24, 0.36, 0.48]) {
      for (const sgn of across ? [Math.sign(across)] : [1, -1]) {
        const o = off * sgn;
        const ok = side === 'y'
          ? this._free(this.fx + along, this.fy + o) && this._free(this.fx, this.fy + o)
          : this._free(this.fx + o, this.fy + along) && this._free(this.fx + o, this.fy);
        if (!ok) continue;
        const m = Math.min(step, Math.abs(o)) * Math.sign(o);
        if (side === 'y') this.fy += m; else this.fx += m;
        return;
      }
    }
  }

  _face(dx, dy) {
    const d = Math.hypot(dx, dy);
    if (!d) return;
    // Mostly up or down keeps the side you were facing, as tile steps did.
    this.facing = { dx: Math.abs(dx) > d * 0.35 ? Math.sign(dx) : 0, dy: Math.abs(dy) > d * 0.35 ? Math.sign(dy) : 0 };
    this.noteFacing();
  }

  update(dt) {
    this._tickTimers(dt);
    // Placed somewhere new by the game (teleport, respawn, load): jump there.
    if (this.x !== this._lx || this.y !== this._ly) { this.fx = this.x; this.fy = this.y; }
    const budget = this.speed() * dt;
    let moved = 0;
    if (this.stick) {
      // Joystick: full speed past a light push, slower for a gentle one.
      const m = Math.hypot(this.stick.x, this.stick.y);
      const k = budget * Math.min(1, 0.45 + m * 0.75) / (m || 1);
      const dx = this.stick.x * k, dy = this.stick.y * k;
      this._face(dx, dy);
      moved = this._slide(dx, dy);
      this.path = [];
    } else if (this.path.length) {
      moved = this._follow(budget);
    }
    this.moving = moved > 1e-6 || this.path.length > 0;
    this.walkPhase += moved;   // one footstep per tile of ground covered
    // Keep the tile underfoot (and the tile "being stepped to") current.
    const tx = Math.round(this.fx), ty = Math.round(this.fy);
    if (this.walkable(tx, ty)) { this.x = this.tx = tx; this.y = this.ty = ty; }
    this._lx = this.x; this._ly = this.y;
  }

  /** Walk a route, cutting straight to the furthest waypoint in clear view
   *  instead of zigzagging tile by tile. */
  _follow(budget) {
    let moved = 0, guard = 0;
    while (budget > 1e-6 && this.path.length && guard++ < 8) {
      for (let i = Math.min(this.path.length - 1, LOOKAHEAD); i > 0; i--) {
        if (this._clear(this.fx, this.fy, this.path[i].x, this.path[i].y)) { this.path.splice(0, i); break; }
      }
      const t = this.path[0];
      const dx = t.x - this.fx, dy = t.y - this.fy, d = Math.hypot(dx, dy);
      this._face(dx, dy);
      if (d <= budget) {
        if (this._free(t.x, t.y)) { this.fx = t.x; this.fy = t.y; }
        this.path.shift(); budget -= d; moved += d;
        continue;
      }
      const got = this._slide(dx / d * budget, dy / d * budget);
      moved += got;
      // Wedged on a corner (we started off-centre): head for the middle of our tile first.
      if (got < budget * 0.2) {
        const cx = Math.round(this.fx), cy = Math.round(this.fy);
        if ((cx !== t.x || cy !== t.y) && Math.hypot(cx - this.fx, cy - this.fy) > 0.02) this.path.unshift({ x: cx, y: cy });
        else { this.fx = t.x; this.fy = t.y; this.path.shift(); }
      }
      budget = 0;
    }
    return moved;
  }

  setAction(action) {
    this.action = action;
    this.target = action && action.type === 'attack' ? action.npc : null;
  }

  clearAction() {
    this.action = null;
    this.target = null;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    return this.hp;
  }

  heal(amount, maxHp) {
    this.hp = Math.min(maxHp, this.hp + amount);
  }
}
