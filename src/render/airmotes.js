// Things in the air, by region and time of day, purely for looks (nothing here
// is an entity, saved, or touches the game's rules; it has its own random
// source and never rolls the game's Math.random):
//
// - Motes: specks of pollen and dust catching the sun in the forests, gardens
//   and wetlands by day (a few in the towns too), drifting on the breeze.
// - Glow-flies: soft points of green-gold light blinking low over the jungle
//   and the wetlands at night (the painted fireflies in critters.js are the
//   close-up ones; these are the many far off).
// - Sea spray: droplets flicked up off the shoreline on the coasts, more in a
//   gust.
// - Sand: streaks of dust and sand skimming over the ground in the badlands
//   and the ruins when a gust front passes.
//
// All of it rides the one wind field (wind.js), so a gust that bends the
// palms also hurries the motes and lifts the sand. One fixed pool with a hard
// cap (nothing allocated per frame), spawned only inside the view and dropped
// as soon as it leaves it. Low graphics turns it off; frames running slow
// (governor.js) and Reduce motion keep only a few, drifting more gently.

import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { localWind, gustAt, WIND_DX, WIND_DY } from './wind.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export const MOTE_CAP = 36;        // in the air at once, at most
export const MOTE_CAP_TRIM = 10;   // ...while frames run slow
export const MOTE_CAP_CALM = 16;   // ...with Reduce motion on
const MARGIN = 30;                 // px past the view edge before one is dropped
export const MOTE = 0, GLOW = 1, SPRAY = 2, SAND = 3;

// Where each thing is in the air.
const GREEN = new Set(['Bukit Timah', 'Jurong Forest', 'Mandai Rainforest', 'MacRitchie Reservoir', 'Pulau Ubin',
  'Sungei Buloh Wetlands', 'Coney Island', 'Gardens by the Bay', 'Kranji Farmlands', 'Punggol Waterway']);
const TOWNS = new Set(['Kampong Glam', 'Chinatown', 'Marina Bay']);
const COASTS = new Set(['Changi Coast', 'Sentosa Beach', 'Southern Islands', 'Coney Island', 'Pulau Ubin', 'Tuas Docklands', 'Pulau Hantu']);
const DUSTY = new Set(['Tekong Badlands', 'The Wilderness', 'Temasek Ruins', 'Tuas Docklands']);

/**
 * How many of each kind to bring in per second in `zone` at a darkness
 * `night` (0 noon .. 1 midnight), with the weather `wx` ({ rain, gloom }) and
 * the island's breeze `wind` (0..1). A plain function so the tests can check
 * the rules headless: [motes, glow-flies, spray, sand].
 */
export function moteRates(zone, night, wx, wind, out = [0, 0, 0, 0]) {
  const rain = wx ? wx.rain || 0 : 0;
  const dry = 1 - smooth(0.2, 0.6, rain);
  const day = 1 - smooth(0.4, 0.62, night), dark = smooth(0.5, 0.75, night);
  out[MOTE] = (GREEN.has(zone) ? 3.2 : TOWNS.has(zone) ? 1 : 0) * day * dry;
  out[GLOW] = (GREEN.has(zone) ? 2.4 : 0) * dark * dry;
  out[SPRAY] = COASTS.has(zone) ? 1.2 + wind * 3.5 : 0;   // splashes (a few droplets each)
  out[SAND] = DUSTY.has(zone) ? (4 + wind * 14) * dry : 0;
  return out;
}

export class AirMotes {
  constructor(cap = MOTE_CAP) {
    this.pool = [];
    for (let i = 0; i < cap; i++) this.pool.push({ on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, ph: 0, s: 1 });
    this.on = false;
    this.cap = cap;
    this._acc = [0, 0, 0, 0];
    this._rates = [0, 0, 0, 0];
    this._seed = 0x1b873593;   // its own random source
    this._shore = []; this._shoreKey = '';   // shoreline water tiles in view, flat [x, y, ...]
    this._sprites = {};
    this._calm = false;
    this._cap = cap;
    this.drawn = 0;
  }

  rnd() {
    let s = this._seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this._seed = s;
    return (s >>> 0) / 4294967296;
  }

  get live() { let n = 0; for (const p of this.pool) if (p.on) n++; return n; }

  /**
   * Per frame. The view is (ox, oy, vw, vh) in world px; `night` 0 noon .. 1
   * midnight; `wx` the weather's state; `wind` the island's breeze (ambient.js
   * windAt). `o`: { low (off), trim (a few only), calm (Reduce motion) }.
   */
  update(game, dt, t, ox, oy, vw, vh, night, wx, wind, o = {}) {
    dt = Math.min(100, Math.max(0, dt));
    this.on = !o.low;
    if (!this.on) { for (const p of this.pool) p.on = false; this._acc.fill(0); return; }
    this._calm = !!o.calm;
    const cap = this._cap = Math.min(this.pool.length, o.trim ? MOTE_CAP_TRIM : o.calm ? MOTE_CAP_CALM : this.cap);
    const slow = o.calm ? 0.6 : 1;
    let live = 0;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.age += dt;
      const w = localWind(p.x, p.y, t, wind);
      if (p.k === MOTE) {
        // Drifting on the breeze, bobbing gently.
        p.x += (p.vx + w * 0.012 * WIND_DX) * dt * slow + Math.sin(p.age * 0.0017 + p.ph) * 0.006 * dt;
        p.y += (p.vy + w * 0.012 * WIND_DY) * dt * slow + Math.cos(p.age * 0.0013 + p.ph) * 0.004 * dt;
      } else if (p.k === GLOW) {
        // Wandering in slow loops, low over the ground.
        p.x += (Math.sin(p.age * 0.0009 + p.ph) * 0.014 + w * 0.004) * dt * slow;
        p.y += Math.sin(p.age * 0.0013 + p.ph * 1.7) * 0.009 * dt * slow;
      } else if (p.k === SPRAY) {
        // Flicked up, carried a little downwind, falling back.
        p.vy += 0.00022 * dt;
        p.x += (p.vx + w * 0.02) * dt; p.y += p.vy * dt;
      } else {
        // Sand skims along with the gust.
        p.x += (p.vx + w * 0.16 * WIND_DX) * dt * slow; p.y += (p.vy + w * 0.16 * WIND_DY) * dt * slow;
      }
      if (p.age >= p.life || p.x < ox - MARGIN || p.y < oy - MARGIN || p.x > ox + vw + MARGIN || p.y > oy + vh + MARGIN) p.on = false;
      else live++;
    }
    const zone = game.currentZoneName || '';
    const r = moteRates(zone, night, wx, wind, this._rates);
    if (r[SPRAY] > 0) this._scanShore(game.world, ox, oy, vw, vh); else { this._shore.length = 0; this._shoreKey = ''; }
    for (let k = 0; k < 4; k++) {
      if (!(r[k] > 0)) { this._acc[k] = 0; continue; }
      this._acc[k] = Math.min(4, this._acc[k] + r[k] * (o.calm ? 0.5 : 1) * dt / 1000);
      while (this._acc[k] >= 1) {
        this._acc[k] -= 1;
        if (live >= cap) break;
        if (this._spawn(game.world, k, t, ox, oy, vw, vh, wind)) live = this.live;
      }
    }
  }

  _free() { for (const p of this.pool) if (!p.on) return p; return null; }

  _spawn(world, k, t, ox, oy, vw, vh, wind) {
    const p = this._free();
    if (!p) return false;
    let x = ox + this.rnd() * vw, y = oy + this.rnd() * vh;
    if (k === SPRAY) {
      const sh = this._shore, n = sh.length >> 1;
      if (!n) return false;
      const i = Math.floor(this.rnd() * n) * 2;
      x = sh[i] * TILE + this.rnd() * TILE; y = sh[i + 1] * TILE + TILE * (0.3 + this.rnd() * 0.5);
      // A splash: a few droplets fanning up from one spot on the shoreline.
      let q = p;
      for (let j = 0; j < 4 && q; j++) {
        q.vx = (this.rnd() - 0.5) * 0.05; q.vy = -0.04 - this.rnd() * 0.045;
        q.life = 480 + this.rnd() * 420; q.s = 1 + this.rnd() * 1.3;
        q.k = k; q.x = x + (this.rnd() - 0.5) * 6; q.y = y; q.age = 0; q.ph = 0; q.on = true;
        q = j < 3 && this.live < this._cap ? this._free() : null;
      }
      return true;
    } else {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (!world || !world.inBounds(tx, ty) || world.terrainAt(tx, ty) === TERRAIN.WATER) return false;
      if (k === MOTE) {
        p.vx = (this.rnd() - 0.5) * 0.006; p.vy = (this.rnd() - 0.6) * 0.006;
        p.life = 5000 + this.rnd() * 4000; p.s = 1.4 + this.rnd() * 1.6;
      } else if (k === GLOW) {
        p.vx = 0; p.vy = 0;
        p.life = 6000 + this.rnd() * 5000; p.s = 2.2 + this.rnd() * 1.6;
      } else {
        // Sand: only where a gust is passing, so it comes in waves with the fronts.
        if (gustAt(x, y, t) < 0.35 && this.rnd() > 0.3) return false;
        p.vx = 0.02 + this.rnd() * 0.03; p.vy = (this.rnd() - 0.5) * 0.012;
        p.life = 1100 + this.rnd() * 1100; p.s = 8 + this.rnd() * 10 * (0.6 + wind);
      }
    }
    p.k = k; p.x = x; p.y = y; p.age = 0; p.ph = this.rnd() * 6.283; p.on = true;
    return true;
  }

  // The water tiles in view with land beside them (the shoreline), refreshed
  // only when the view moves onto a new tile.
  _scanShore(world, ox, oy, vw, vh) {
    if (!world) return;
    const x0 = Math.max(1, Math.floor(ox / TILE)), y0 = Math.max(1, Math.floor(oy / TILE));
    const x1 = Math.min(world.width - 2, Math.floor((ox + vw) / TILE)), y1 = Math.min(world.height - 2, Math.floor((oy + vh) / TILE));
    const key = `${x0},${y0},${x1},${y1}`;
    if (key === this._shoreKey) return;
    this._shoreKey = key;
    const s = this._shore; s.length = 0;
    const W = TERRAIN.WATER;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (world.terrainAt(x, y) !== W) continue;
      if (world.terrainAt(x + 1, y) !== W || world.terrainAt(x - 1, y) !== W || world.terrainAt(x, y + 1) !== W || world.terrainAt(x, y - 1) !== W) s.push(x, y);
    }
  }

  // A soft round glow, baked once per colour (none headless).
  _glow(rgb) {
    if (rgb in this._sprites) return this._sprites[rgb];
    let cv = null;
    if (typeof document !== 'undefined' && document.createElement) {
      try {
        cv = document.createElement('canvas'); cv.width = cv.height = 16;
        const g = cv.getContext && cv.getContext('2d');
        if (!g) cv = null;
        else {
          const grd = g.createRadialGradient(8, 8, 0, 8, 8, 8);
          grd.addColorStop(0, `rgba(${rgb},1)`); grd.addColorStop(0.35, `rgba(${rgb},0.55)`); grd.addColorStop(1, `rgba(${rgb},0)`);
          g.fillStyle = grd; g.fillRect(0, 0, 16, 16);
        }
      } catch { cv = null; }
    }
    return (this._sprites[rgb] = cv);
  }

  // A soft wisp of dust, long along the wind (none headless).
  _dust() {
    if ('dust' in this._sprites) return this._sprites.dust;
    let cv = null;
    if (typeof document !== 'undefined' && document.createElement) {
      try {
        cv = document.createElement('canvas'); cv.width = 64; cv.height = 16;
        const g = cv.getContext && cv.getContext('2d');
        if (!g) cv = null;
        else {
          g.scale(4, 1);
          const grd = g.createRadialGradient(8, 8, 0, 8, 8, 8);
          grd.addColorStop(0, 'rgba(246,228,190,1)'); grd.addColorStop(0.5, 'rgba(240,218,176,0.5)'); grd.addColorStop(1, 'rgba(236,212,168,0)');
          g.fillStyle = grd; g.fillRect(0, 0, 16, 16);
        }
      } catch { cv = null; }
    }
    return (this._sprites.dust = cv);
  }

  /** Sand and spray, in the world (under the light pass, so night darkens them). */
  drawLow(ctx, ox, oy) {
    this.drawn = 0;
    if (!this.on) return;
    let sand = 0, spray = 0;
    for (const p of this.pool) if (p.on) { if (p.k === SAND) sand++; else if (p.k === SPRAY) spray++; }
    const dust = sand ? this._dust() : null;
    if (dust) {
      // Wisps of dust along the wind: the whole layer is turned to the wind's
      // heading once, so each wisp is one straight stamp.
      ctx.save();
      const ca = WIND_DX, sa = WIND_DY;
      ctx.rotate(Math.atan2(sa, ca));
      for (const p of this.pool) {
        if (!p.on || p.k !== SAND) continue;
        const f = p.age / p.life, a = Math.sin(f * Math.PI);
        const x = p.x - ox, y = p.y - oy, u = x * ca + y * sa, v = y * ca - x * sa;
        const len = p.s * (1.6 + f), th = 4 + p.s * 0.22;
        ctx.globalAlpha = a * 0.62;
        ctx.drawImage(dust, u - len, v - th / 2, len * 2, th);
        this.drawn++;
      }
      ctx.restore();
    }
    if (!spray) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (const p of this.pool) {
      if (!p.on || p.k !== SPRAY) continue;
      const f = p.age / p.life;
      ctx.globalAlpha = Math.sin(f * Math.PI) * 0.85;
      ctx.beginPath(); ctx.arc(p.x - ox, p.y - oy, p.s * (1 - f * 0.4), 0, Math.PI * 2); ctx.fill();
      this.drawn++;
    }
    ctx.restore();
  }

  /** Motes and glow-flies: points of light, over the night's darkness. */
  drawGlow(ctx, ox, oy, t) {
    if (!this.on) return;
    let sun = null, fly = null;
    let saved = false;
    for (const p of this.pool) {
      if (!p.on || (p.k !== MOTE && p.k !== GLOW)) continue;
      const f = p.age / p.life, life = smooth(0, 0.12, f) * (1 - smooth(0.8, 1, f));
      let a, img;
      if (p.k === MOTE) {
        // Twinkling as it turns in the light.
        a = life * (0.35 + 0.25 * Math.sin(t * 0.004 + p.ph * 3));
        img = sun || (sun = this._glow('255,246,210'));
      } else {
        // A slow blink: dark most of the time, then a soft glow.
        const b = Math.sin(p.age * (this._calm ? 0.0012 : 0.0019) + p.ph);
        a = life * (0.12 + 0.88 * (b > 0 ? b * b * b : 0));
        img = fly || (fly = this._glow('214,255,120'));
      }
      if (!img || a < 0.02) continue;
      if (!saved) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; saved = true; }
      ctx.globalAlpha = Math.min(1, a);
      const r = p.s * (p.k === GLOW ? 2.8 : 1.6);
      ctx.drawImage(img, p.x - ox - r, p.y - oy - r, r * 2, r * 2);
      this.drawn++;
    }
    if (saved) ctx.restore();
  }
}
