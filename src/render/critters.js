import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';

// Ambient critters: butterflies over grass and flowers by day, fireflies near
// water and jungle at night, birds that sit on the ground and flutter off when
// you come close, and the odd gecko on a wall. Drawn with a few canvas strokes
// (no images), purely cosmetic: not entities, never saved, no effect on play.
// A fixed pool of objects is reused (nothing is allocated per frame), they only
// spawn inside the view and vanish once they leave it.

export const CRITTER_CAP = 12;       // at most this many at once
export const CRITTER_CAP_LOW = 4;    // ...in low graphics
const MARGIN = 40;                   // px past the view edge before one is dropped
const BIRD_FLEE = TILE * 3;          // birds take off when you come this close
const GECKO_FLEE = TILE * 1.5;
const BUTTERFLY = 0, FIREFLY = 1, BIRD = 2, GECKO = 3;
const WINGS = ['#F5B82E', '#EF476F', '#5FAEE3', '#FFFFFF', '#B98AE8', '#FF9F6A'];
const JUNGLE = new Set(['Bukit Timah', 'Jurong Forest', 'Mandai Rainforest', 'Sungei Buloh Wetlands',
  'MacRitchie Reservoir', 'Pulau Ubin', 'Kranji Farmlands', 'Gardens by the Bay', 'Punggol Waterway']);
const GRIM = new Set(['The Wilderness', 'Pulau Hantu', 'Tekong Badlands', 'The Shadow Rift']);
const PERCH = new Set(['wall', 'ruin', 'bank', 'stall', 'transport', 'lamp', 'shrine']);

export class Critters {
  constructor(cap = CRITTER_CAP) {
    this.pool = [];
    for (let i = 0; i < cap; i++) {
      this.pool.push({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0, max: 1, phase: 0, flee: false, col: '', ax: 0, ay: 0, next: 0 });
    }
    this._spawnIn = 0;
    // Its own random source, so critters never shift the game's Math.random rolls.
    this._seed = 0x2545f491;
  }

  rnd() {
    let s = this._seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this._seed = s;
    return (s >>> 0) / 4294967296;
  }

  get count() { let n = 0; for (const c of this.pool) if (c.on) n++; return n; }

  /**
   * Move them on, drop any that left the view (ox, oy, vw, vh: the view in
   * world px), and now and then spawn one somewhere fitting inside it.
   * `env`: { world, zone, night (0..1), px, py (the player's centre), low }.
   */
  update(dt, env, ox, oy, vw, vh) {
    dt = Math.min(100, Math.max(0, dt));
    const cap = env.low ? CRITTER_CAP_LOW : CRITTER_CAP;
    let live = 0;
    for (const c of this.pool) {
      if (!c.on) continue;
      this._move(c, dt, env);
      if (c.x < ox - MARGIN || c.y < oy - MARGIN || c.x > ox + vw + MARGIN || c.y > oy + vh + MARGIN || c.life <= 0) c.on = false;
      else live++;
    }
    this._spawnIn -= dt;
    if (this._spawnIn <= 0) {
      this._spawnIn = 220 + this.rnd() * 300;
      if (live < cap) this._trySpawn(env, ox, oy, vw, vh);
    }
  }

  _free() { for (const c of this.pool) if (!c.on) return c; return null; }

  /** Pick a tile in view and, if it suits a critter for this time of day, put one there. */
  _trySpawn(env, ox, oy, vw, vh) {
    const w = env.world;
    if (!w || GRIM.has(env.zone)) return null;
    const tx = Math.floor((ox + this.rnd() * vw) / TILE), ty = Math.floor((oy + this.rnd() * vh) / TILE);
    if (!w.inBounds(tx, ty)) return null;
    const t = w.terrainAt(tx, ty), o = w.objectAt(tx, ty);
    const grassy = t === TERRAIN.GRASS || t === TERRAIN.DARKGRASS;
    const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
    const far = Math.hypot(wx - env.px, wy - env.py) > BIRD_FLEE * 1.4;
    const r = this.rnd();
    let kind = -1;
    if (o && PERCH.has(o.def.type === 'scenery' ? o.objId : o.def.type)) {
      if (r < (env.night > 0.5 ? 0.6 : 0.3) && far) kind = GECKO;
    } else if (env.night > 0.5) {
      const W = TERRAIN.WATER;
      const wet = w.terrainAt(tx + 1, ty) === W || w.terrainAt(tx - 1, ty) === W || w.terrainAt(tx, ty + 1) === W || w.terrainAt(tx, ty - 1) === W;
      if (grassy && (wet || JUNGLE.has(env.zone)) && r < 0.75) kind = FIREFLY;
      else if (grassy && r < 0.2) kind = FIREFLY;
    } else if (o && (o.objId === 'flower' || o.objId === 'bush')) {
      if (r < 0.8) kind = BUTTERFLY;
    } else if (!o && grassy && r < 0.3) {
      kind = BUTTERFLY;
    } else if (!o && far && !w.isBlocked(tx, ty) && t !== TERRAIN.WATER && r < 0.35 && this._countKind(BIRD) < 4) {
      kind = BIRD;
    }
    if (kind < 0) return null;
    const c = this._free();
    if (!c) return null;
    c.on = true; c.kind = kind; c.t = 0; c.flee = false; c.phase = this.rnd() * 6.28; c.next = 0;
    c.vx = 0; c.vy = 0;
    if (kind === BUTTERFLY) {
      c.x = wx + (this.rnd() - 0.5) * 16; c.y = wy - 10; c.max = c.life = 9000 + this.rnd() * 6000;
      c.col = WINGS[Math.floor(this.rnd() * WINGS.length)];
      const a = this.rnd() * 6.28; c.vx = Math.cos(a) * 0.022; c.vy = Math.sin(a) * 0.012;
    } else if (kind === FIREFLY) {
      c.x = wx + (this.rnd() - 0.5) * 24; c.y = wy - 6 - this.rnd() * 10; c.max = c.life = 6000 + this.rnd() * 5000;
    } else if (kind === BIRD) {
      c.x = wx + (this.rnd() - 0.5) * 16; c.y = wy + 6; c.max = c.life = 16000 + this.rnd() * 8000;
      c.col = this.rnd() < 0.5 ? '#6b5440' : '#4f5d74';   // a sparrow brown or a myna grey
      c.ax = this.rnd() < 0.5 ? -1 : 1;                   // which way it faces
    } else {
      // On the object's front face, partway up.
      c.x = wx + (this.rnd() - 0.5) * 14; c.y = wy - 4 - this.rnd() * 14; c.max = c.life = 12000 + this.rnd() * 6000;
      c.col = this.rnd() < 0.6 ? '#86c46e' : '#cbb38a';
      c.ax = c.x; c.ay = c.y;
    }
    return c;
  }

  _countKind(k) { let n = 0; for (const c of this.pool) if (c.on && c.kind === k) n++; return n; }

  _move(c, dt, env) {
    c.t += dt; c.life -= dt;
    const dx = c.x - env.px, dy = c.y - env.py, d = Math.hypot(dx, dy) || 1;
    if (c.kind === BUTTERFLY) {
      // A meandering flutter: the heading wanders, with a bob on top.
      const turn = Math.sin(c.t * 0.0013 + c.phase) * 0.0016 * dt;
      const cs = Math.cos(turn), sn = Math.sin(turn);
      const vx = c.vx * cs - c.vy * sn, vy = c.vx * sn + c.vy * cs;
      c.vx = vx; c.vy = vy;
      c.x += c.vx * dt; c.y += c.vy * dt + Math.sin(c.t * 0.006 + c.phase) * 0.02 * dt;
    } else if (c.kind === FIREFLY) {
      c.x += Math.sin(c.t * 0.0007 + c.phase) * 0.006 * dt;
      c.y += Math.cos(c.t * 0.0009 + c.phase * 1.3) * 0.004 * dt;
    } else if (c.kind === BIRD) {
      if (!c.flee && (d < BIRD_FLEE || c.life < 1500)) {
        // Off it goes: up and away from you.
        c.flee = true; c.vx = (dx / d) * 0.1 + (dx >= 0 ? 0.03 : -0.03); c.vy = -0.07;
        c.ax = c.vx < 0 ? -1 : 1; c.life = Math.max(c.life, 2500);
      }
      if (c.flee) { c.vy -= 0.00012 * dt; c.x += c.vx * dt; c.y += c.vy * dt; }
      else if (c.t > c.next) {
        // Now and then a little hop, or a turn to look the other way.
        c.next = c.t + 600 + this.rnd() * 1400;
        if (this.rnd() < 0.5) c.x += (this.rnd() - 0.5) * 8; else c.ax = -c.ax;
      }
    } else {
      if (!c.flee && d < GECKO_FLEE) { c.flee = true; c.life = Math.min(c.life, 320); }
      if (c.flee) c.y -= 0.08 * dt;   // scurries up and out of sight
      else if (c.t > c.next) {
        c.next = c.t + 1200 + this.rnd() * 2200;
        c.ax = c.x + (this.rnd() - 0.5) * 10; c.ay = c.y + (this.rnd() - 0.5) * 8;
      } else { c.x += (c.ax - c.x) * Math.min(1, dt * 0.02); c.y += (c.ay - c.y) * Math.min(1, dt * 0.02); }
    }
  }

  /** Fade in over the first half-second and out over the last. */
  _alpha(c) { return Math.max(0, Math.min(1, c.t / 500, c.life / 600)); }

  /** Things on the ground or a wall (sitting birds, geckos): drawn under the sprites. */
  drawGround(ctx, ox, oy) {
    for (const c of this.pool) {
      if (!c.on || !(c.kind === GECKO || (c.kind === BIRD && !c.flee))) continue;
      ctx.globalAlpha = this._alpha(c);
      const x = c.x - ox, y = c.y - oy;
      if (c.kind === BIRD) drawSitting(ctx, c, x, y);
      else drawGecko(ctx, c, x, y);
    }
    ctx.globalAlpha = 1;
  }

  /** Things in the air (butterflies, fireflies, birds taking off): drawn over everything. */
  drawAir(ctx, ox, oy, timeMs) {
    let glow = false;
    for (const c of this.pool) {
      if (!c.on || c.kind === GECKO || (c.kind === BIRD && !c.flee)) continue;
      const x = c.x - ox, y = c.y - oy, a = this._alpha(c);
      if (c.kind === FIREFLY) {
        if (!glow) { ctx.globalCompositeOperation = 'lighter'; glow = true; }
        const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(timeMs * 0.0035 + c.phase));
        ctx.globalAlpha = a * pulse * 0.35; ctx.fillStyle = '#d8ff6a';
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 6.283); ctx.fill();
        ctx.globalAlpha = a * pulse; ctx.fillStyle = '#fbffc8';
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 6.283); ctx.fill();
        continue;
      }
      if (glow) { ctx.globalCompositeOperation = 'source-over'; glow = false; }
      ctx.globalAlpha = a;
      if (c.kind === BUTTERFLY) drawButterfly(ctx, c, x, y, timeMs);
      else drawFlying(ctx, c, x, y, timeMs);
    }
    if (glow) ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

const INK = '#22304A';

function drawButterfly(ctx, c, x, y, t) {
  const flap = Math.abs(Math.sin(t * 0.03 + c.phase));   // wings open and close
  const w = 1.4 + flap * 4.2;
  ctx.fillStyle = c.col; ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(x - w * 0.6, y - 1, w * 0.7, 3.6, -0.4, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + w * 0.6, y - 1, w * 0.7, 3.6, 0.4, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(x - 0.6, y - 3.5, 1.2, 5.5);
}

function drawSitting(ctx, c, x, y) {
  // A plump little bird pecking about: body, head, a beak and a tail.
  const peck = Math.max(0, Math.sin(c.t * 0.008 + c.phase)) > 0.92 ? 1.2 : 0;
  const f = c.ax;
  ctx.fillStyle = 'rgba(34,48,74,0.18)';
  ctx.beginPath(); ctx.ellipse(x, y + 2.5, 3.5, 1.2, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = c.col; ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - f * 3, y - 1); ctx.lineTo(x - f * 6, y - 3); ctx.lineTo(x - f * 5.5, y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y - 1, 3.6, 2.6, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + f * 3, y - 3.4 + peck, 1.9, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#F5B82E';
  ctx.beginPath(); ctx.moveTo(x + f * 4.6, y - 3.8 + peck); ctx.lineTo(x + f * 6.6, y - 3.2 + peck); ctx.lineTo(x + f * 4.6, y - 2.6 + peck); ctx.fill();
}

function drawFlying(ctx, c, x, y, t) {
  const flap = Math.sin(t * 0.05 + c.phase) * 3.5;   // quick wingbeats
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 5, y - flap); ctx.quadraticCurveTo(x - 2, y - 1, x, y); ctx.quadraticCurveTo(x + 2, y - 1, x + 5, y - flap); ctx.stroke();
  ctx.fillStyle = c.col;
  ctx.beginPath(); ctx.ellipse(x, y + 0.5, 2.2, 1.6, 0, 0, 6.283); ctx.fill();
}

function drawGecko(ctx, c, x, y) {
  // A cicak on the wall: a slim body, a curling tail and four splayed feet.
  ctx.strokeStyle = c.col; ctx.lineCap = 'round';
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x, y - 3.5); ctx.lineTo(x, y + 2); ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.quadraticCurveTo(x + 1, y + 6, x + 3.5, y + 6.5); ctx.stroke();
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - 2.5, y - 3); ctx.lineTo(x + 2.5, y - 1);
  ctx.moveTo(x + 2.5, y - 3); ctx.lineTo(x - 2.5, y - 1);
  ctx.moveTo(x - 2.5, y + 2.5); ctx.lineTo(x + 2.5, y + 0.5);
  ctx.moveTo(x + 2.5, y + 2.5); ctx.lineTo(x - 2.5, y + 0.5);
  ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(x - 0.4, y - 4, 0.8, 0.8);
}
