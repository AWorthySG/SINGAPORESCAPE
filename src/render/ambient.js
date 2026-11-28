// Ambient life: small looping touches that make the world feel lived in,
// purely for looks (nothing here is an entity, saved, or touches the game's
// rules, and it never rolls the game's Math.random).
//
// - Wind: one gusting breeze for the whole island, with gust fronts rolling
//   across the map (wind.js); palms, bamboo, trees, bushes and flowers lean
//   as a front passes and flutter on their own beat, and the leaves speed up
//   in it (the renderer shears each object's cached picture, so the cache is
//   untouched).
// - Water glints: sparkles of sun (or moon) winking on the water in view.
// - Bird flocks: now and then a little flock crosses the sky by day, its
//   shadows sliding over the ground below.
// - Town birds: a few mynas pecking about the town squares, scattering when
//   you walk up to them.
// - Hawker cats: a cat lazing beside some of the food stalls (curled asleep at
//   night), and steam curling up from the hawker stalls and kitchen ranges.
// - Drifting leaves and petals on the breeze: jungle leaves in the forests,
//   pink and frangipani petals in the towns and gardens.
//
// The birds, cat, steam, glints and tumbling leaves are painted four-frame loops
// (fxart.js), stepped gently; until they load the old drawn shapes stand in.
// Everything comes from fixed pools and a few baked sprites, is culled to the
// view, and switches off entirely in low graphics or while frames run slow
// (the renderer passes `low` for both: see governor.js).

import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { tileHash } from './terrainfx.js';
import { fxImage, fxLoop, drawFx } from './fxart.js';
import { plantLean, localWind } from './wind.js';
import { applyRow } from './projection.js';
import { arc } from './motionkit.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Regions by what drifts on their breeze, and where the town birds and the
// hawker cats live.
const LEAFY = new Set(['Bukit Timah', 'Jurong Forest', 'Mandai Rainforest', 'MacRitchie Reservoir', 'Pulau Ubin',
  'Sungei Buloh Wetlands', 'Coney Island', 'Transit Road, Nee Soon Camp']);
const PETALS = new Set(['Gardens by the Bay', 'Kampong Glam', 'Chinatown', 'Marina Bay', 'Kranji Farmlands', 'Punggol Waterway',
  'Sentosa Beach', 'Changi Coast']);
const TOWNS = new Set(['Kampong Glam', 'Chinatown', 'Marina Bay', 'Pulau Ubin', 'Kranji Farmlands', 'Punggol Waterway',
  'Transit Road, Nee Soon Camp']);
const GRIM = new Set(['The Wilderness', 'Pulau Hantu', 'Tekong Badlands', 'The Shadow Rift']);
const LEAF_ART = ['leaf_green', 'leaf_lime', 'leaf_green', 'leaf_dry'];
const PETAL_ART = ['petal_pink', 'frangipani', 'petal_pink', 'petal_red'];
// Which flock flies over each kind of place: egrets over the wetlands and the
// coasts, pigeons over the towns, mynas everywhere else.
const EGRET_SKIES = new Set(['Sungei Buloh Wetlands', 'Changi Coast', 'Sentosa Beach', 'Southern Islands', 'Punggol Waterway', 'MacRitchie Reservoir']);
const WING_MS = 110;     // a wingbeat frame
const PECK_MS = 260;     // a pecking pigeon's frame
const BIRD_HOP_MS = 160;
const TAIL_MS = 340;     // a cat's tail flick
const TUMBLE_MS = 180;   // a leaf or petal turning over
// The painted tumbling loops stand in for these single leaves and petals.
const TUMBLE = { leaf_green: 'leaf_tumble', leaf_lime: 'leaf_tumble', frangipani: 'petal_tumble' };
export const RIPPLE_CAP = 3;
const LEAF_COL = { leaf_green: '#7cc46a', leaf_lime: '#b8d860', leaf_dry: '#d9a066', petal_pink: '#f6a6c8', frangipani: '#fff4dc', petal_red: '#e8505a' };

// How far each kind of plant leans in a full gust (a shear factor), and how
// fast it flutters (radians per ms): the big trees slowly, flowers quickly.
// The low bushes and flowers sway only near you (SWAY_NEAR tiles), where the
// eye is: a sheared picture costs a little more to draw than a straight one.
export const SWAY = { palm: 0.075, bamboo: 0.06, tree: 0.03, bush: 0.05, flower: 0.08 };
const SWAY_FREQ = { palm: 0.0019, bamboo: 0.0026, tree: 0.0015, bush: 0.0034, flower: 0.0043 };
const LOW_PLANTS = new Set(['bush', 'flower']);
export const SWAY_NEAR = 12;
export const LEAF_CAP = 10;
export const GLINT_CAP = 16;
export const BIRD_CAP = 5;       // town birds in a group
export const FLOCK_CAP = 7;      // birds in a flock overhead
export const CAT_CAP = 3;
const STEAMERS = new Set(['stall_food', 'range', 'hawker_stall_noodle', 'hawker_stall_satay']);
const CAT_STALLS = new Set(['stall_food', 'stall_market', 'hawker_stall_noodle', 'fish_stall']);

function birdGround(world, x, y) {
  if (!world.inBounds(x, y) || world.isBlocked(x, y)) return false;
  const terrain = world.terrainAt(x, y);
  return terrain === TERRAIN.STONE || terrain === TERRAIN.PATH || terrain === TERRAIN.SAND;
}

/**
 * The island's breeze at time t (ms), 0 (still) .. 1 (a strong gust): a slow
 * swell of gusts, stronger in rain and storms.
 */
export function windAt(t, rain = 0, storm = 0) {
  const base = 0.38 + 0.22 * Math.sin(t * 0.00031) + 0.16 * Math.sin(t * 0.00083 + 1.3) + 0.08 * Math.sin(t * 0.0021 + 0.7);
  return clamp01(base + rain * 0.25 + storm * 0.45);
}

/** What kind of plant an object is for the breeze, or null if it doesn't sway. */
export function swayKind(o) {
  const t = o.def && o.def.type;
  if (t === 'tree') return o.depleted ? null : (o.objId === 'bamboo' ? 'bamboo' : 'tree');
  if (t === 'scenery' && SWAY[o.objId]) return o.objId;
  return null;
}

/** An object's lean in the breeze at time t: pushed over as a gust front
 *  rolls through its tile (wind.js), fluttering on a beat of its own. */
export function swayLean(o, t, wind) {
  const k = swayKind(o);
  if (!k) return 0;
  return plantLean(SWAY[k], o.x * TILE + TILE / 2, o.y * TILE, t, wind, SWAY_FREQ[k], tileHash(o.x, o.y, 61) * 6.283);
}

export class AmbientLife {
  constructor() {
    this.on = false;          // false in low graphics / while frames run slow: draw nothing
    this.wind = 0.4;
    this._seed = 0x6d2b79f5;  // its own random source
    this._gloom = 0; this._day = 1; this._night = 0; this._zone = '';
    this._px = 0; this._py = 0; this._t = 0;
    // Water tiles in view (flat [x, y, x, y, ...]), refreshed when the view moves a tile.
    this._water = []; this._waterKey = '';
    this.leaves = [];
    for (let i = 0; i < LEAF_CAP; i++) this.leaves.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, art: '', p: 0, spin: 0, life: 0 });
    this._leafIn = 0;
    this.flock = { on: false, x: 0, y: 0, vx: 0, vy: 0, n: 0, dir: 1, t: 0, sp: 'myna_fly' };
    this._flockIn = 9000;
    this.birds = { on: false, flee: false, x: 0, y: 0, t: 0, n: 0, m: [] };
    for (let i = 0; i < BIRD_CAP; i++) this.birds.m.push({ dx: 0, dy: 0, vx: 0, vy: 0, face: 1, p: 0, sp: 'myna', hop: 0, hx: 0, hy: 0 });
    this._birdsIn = 1500;
    this._sprites = {};       // baked sprites by name
    this.drawn = 0;           // things drawn last frame (tests and tuning)
  }

  rnd() {
    let s = this._seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this._seed = s;
    return (s >>> 0) / 4294967296;
  }

  get live() {
    let n = 0;
    for (const l of this.leaves) if (l.on) n++;
    return n + (this.flock.on ? this.flock.n : 0) + (this.birds.on ? this.birds.n : 0);
  }

  /**
   * Per frame: the breeze, and moving the leaves, flock and town birds on.
   * The view is (ox, oy, vw, vh) in world px; `night` 0 noon .. 1 midnight;
   * `wx` the weather's state; `low` turns it all off.
   */
  update(game, dt, t, ox, oy, vw, vh, night, wx, low) {
    dt = Math.min(100, Math.max(0, dt));
    this.on = !low;
    const rain = wx ? wx.rain || 0 : 0, storm = wx ? wx.storm || 0 : 0;
    this.wind = windAt(t, rain, storm);
    if (!this.on) { this._clear(); return; }
    this._gloom = wx ? wx.gloom || 0 : 0;
    this._night = night; this._day = clamp01(1 - (night - 0.3) / 0.35);
    const zone = (this._zone = game.currentZoneName || '');
    this._px = game.player ? game.player.x : 0; this._py = game.player ? game.player.y : 0;
    this._t = t;
    this._world = game.world;
    this._scanWater(game.world, ox, oy, vw, vh);
    this._updateLeaves(dt, zone, rain, ox, oy, vw, vh);
    this._updateFlock(dt, rain, ox, oy, vw, vh);
    this._updateBirds(game, dt, zone, rain, ox, oy, vw, vh);
  }

  _clear() {
    for (const l of this.leaves) l.on = false;
    this.flock.on = false; this.birds.on = false;
    this._water.length = 0; this._waterKey = '';
  }

  _scanWater(world, ox, oy, vw, vh) {
    const x0 = Math.max(0, Math.floor(ox / TILE)), y0 = Math.max(0, Math.floor(oy / TILE));
    const x1 = Math.min(world.width - 1, Math.floor((ox + vw) / TILE)), y1 = Math.min(world.height - 1, Math.floor((oy + vh) / TILE));
    const key = `${x0},${y0},${x1},${y1}`;
    if (key === this._waterKey) return;
    this._waterKey = key;
    const w = this._water; w.length = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (world.terrainAt(x, y) === TERRAIN.WATER) w.push(x, y);
  }

  // ---------------- Leaves and petals ----------------
  _updateLeaves(dt, zone, rain, ox, oy, vw, vh) {
    const kinds = LEAFY.has(zone) ? LEAF_ART : PETALS.has(zone) ? PETAL_ART : null;
    const wind = this.wind;
    for (const l of this.leaves) {
      if (!l.on) continue;
      l.life -= dt; l.p += dt;
      // Blown along by the breeze (faster as a gust front catches it up),
      // fluttering down and side to side.
      const lw = localWind(l.x, l.y, this._t, wind);
      l.x += (l.vx + lw * 0.035) * dt + Math.sin(l.p * 0.003 + l.spin) * 0.02 * dt;
      l.y += l.vy * dt + Math.cos(l.p * 0.0023 + l.spin) * 0.012 * dt;
      if (l.life <= 0 || l.x > ox + vw + 40 || l.y > oy + vh + 40 || l.x < ox - 80) l.on = false;
    }
    if (!kinds || GRIM.has(zone) || rain > 0.6) return;
    this._leafIn -= dt * (0.4 + wind);
    if (this._leafIn > 0) return;
    this._leafIn = (LEAFY.has(zone) ? 650 : 1100) + this.rnd() * 900;
    const l = this.leaves.find((q) => !q.on);
    if (!l) return;
    // In from the upwind (west) side or from the top of the view.
    if (this.rnd() < 0.5) { l.x = ox - 20; l.y = oy + this.rnd() * vh * 0.8; } else { l.x = ox + this.rnd() * vw * 0.8; l.y = oy - 20; }
    l.vx = 0.005 + this.rnd() * 0.02; l.vy = 0.012 + this.rnd() * 0.014;
    l.art = kinds[Math.floor(this.rnd() * kinds.length)];
    l.p = this.rnd() * 5000; l.spin = this.rnd() * 6.28; l.life = 9000 + this.rnd() * 5000; l.on = true;
  }

  // ---------------- A flock overhead ----------------
  _updateFlock(dt, rain, ox, oy, vw, vh) {
    const f = this.flock;
    if (f.on) {
      f.x += f.vx * dt; f.y += f.vy * dt; f.t += dt;
      if (f.t > 30000 || f.x < ox - 400 || f.x > ox + vw + 400 || f.y < oy - 400 || f.y > oy + vh + 400) f.on = false;
      return;
    }
    if (this._day < 0.5 || rain > 0.3) return;
    this._flockIn -= dt;
    if (this._flockIn > 0) return;
    this._flockIn = 16000 + this.rnd() * 22000;
    f.dir = this.rnd() < 0.5 ? 1 : -1;
    f.x = f.dir > 0 ? ox - 120 : ox + vw + 120;
    f.y = oy + vh * (0.15 + this.rnd() * 0.5);
    const sp = 0.07 + this.rnd() * 0.03;
    f.vx = sp * f.dir; f.vy = (this.rnd() - 0.4) * 0.025;
    f.n = 3 + Math.floor(this.rnd() * (FLOCK_CAP - 2)); f.t = 0; f.on = true;
    f.sp = EGRET_SKIES.has(this._zone) ? 'egret_fly' : TOWNS.has(this._zone) ? 'pigeon_fly' : 'myna_fly';
  }

  // Where flock member j sits relative to the leader: a loose V trailing behind.
  _flockPos(j, out) {
    const f = this.flock, rank = (j + 1) >> 1, side = j % 2 ? 1 : -1;
    out.x = f.x - f.dir * rank * 15 + Math.sin(f.t * 0.0013 + j * 2.1) * 3;
    out.y = f.y + side * rank * 10 + Math.cos(f.t * 0.0011 + j) * 2;
    return out;
  }

  // ---------------- Town birds ----------------
  _updateBirds(game, dt, zone, rain, ox, oy, vw, vh) {
    const b = this.birds;
    if (b.on) {
      b.t += dt;
      const p = game.player ? game.player.renderCenter() : null;
      if (!b.flee && p && Math.hypot(p.x - b.x, p.y - b.y) < TILE * 2.6) {
        // Startled: off they go, each its own way, wings beating.
        b.flee = true; b.t = 0;
        for (let i = 0; i < b.n; i++) {
          const m = b.m[i], away = Math.sign(b.x + m.dx - p.x) || 1;
          m.dy -= 2 * arc(m.hop / BIRD_HOP_MS); m.hop = 0;
          m.vx = away * (0.07 + this.rnd() * 0.06); m.vy = -0.09 - this.rnd() * 0.05; m.face = away;
        }
      }
      if (b.flee) {
        for (let i = 0; i < b.n; i++) { const m = b.m[i]; m.dx += m.vx * dt; m.dy += m.vy * dt; }
        if (b.t > 2200) { b.on = false; this._birdsIn = 14000; }
      } else {
        // Pecking about: now and then one hops a little way and turns round.
        for (let i = 0; i < b.n; i++) {
          const m = b.m[i];
          if (m.hop > 0) {
            const step = Math.min(dt, m.hop);
            m.dx += m.hx * step / BIRD_HOP_MS; m.dy += m.hy * step / BIRD_HOP_MS;
            m.hop -= step;
          }
          m.p += dt;
          if (m.p > 2400) {
            m.p = this.rnd() * 600;
            const hx = (this.rnd() - 0.5) * 10, hy = (this.rnd() - 0.5) * 6;
            if (this.rnd() < 0.4) m.face = -m.face;
            const x = Math.floor((b.x + m.dx + hx) / TILE), y = Math.floor((b.y + m.dy + hy) / TILE);
            if (birdGround(game.world, x, y)) { m.hx = hx; m.hy = hy; m.hop = BIRD_HOP_MS; }
          }
        }
      }
      if (b.x < ox - 60 || b.y < oy - 60 || b.x > ox + vw + 60 || b.y > oy + vh + 60) b.on = false;
      return;
    }
    if (!TOWNS.has(zone) || rain > 0.3 || this._night > 0.6) return;
    this._birdsIn -= dt;
    if (this._birdsIn > 0) return;
    this._birdsIn = 900;
    const w = game.world, p = game.player.renderCenter();
    const tx = Math.floor((ox + 40 + this.rnd() * (vw - 80)) / TILE), ty = Math.floor((oy + 40 + this.rnd() * (vh - 80)) / TILE);
    if (!birdGround(w, tx, ty)) return;
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE * 0.7;
    if (Math.hypot(p.x - x, p.y - y) < TILE * 5) return;
    b.on = true; b.flee = false; b.t = 0; b.x = x; b.y = y;
    b.n = 3 + Math.floor(this.rnd() * (BIRD_CAP - 2));
    for (let i = 0; i < b.n; i++) {
      const m = b.m[i];
      m.dx = (this.rnd() - 0.5) * 34; m.dy = (this.rnd() - 0.5) * 16; m.face = this.rnd() < 0.5 ? -1 : 1;
      const bx = Math.floor((x + m.dx) / TILE), by = Math.floor((y + m.dy) / TILE);
      if (!birdGround(w, bx, by)) { m.dx = 0; m.dy = 0; }
      m.p = this.rnd() * 2400; m.vx = 0; m.vy = 0; m.hop = 0;
      const r = this.rnd(); m.sp = r < 0.4 ? 'pigeon' : r < 0.8 ? 'myna' : 'sparrow';
    }
  }

  /** How far a plant leans in the breeze right now (0 when switched off; the
   *  low plants only within SWAY_NEAR tiles of you). */
  lean(o, t) {
    if (!this.on) return 0;
    if (LOW_PLANTS.has(o.objId) && (Math.abs(o.x - this._px) > SWAY_NEAR || Math.abs(o.y - this._py) > SWAY_NEAR)) return 0;
    return swayLean(o, t, this.wind);
  }

  // ---------------- Baked sprites ----------------
  _sprite(name) {
    if (name in this._sprites) return this._sprites[name];
    let cv = null;
    if (typeof document !== 'undefined' && document.createElement) {
      try { cv = document.createElement('canvas'); } catch { cv = null; }
      const g = cv && cv.getContext && cv.getContext('2d');
      if (!g) cv = null;
      else if (name === 'glint' || name === 'moonglint') {
        // A four-pointed twinkle with a soft halo.
        cv.width = cv.height = 32;
        const c = name === 'glint' ? '255,248,220' : '200,220,255';
        const halo = g.createRadialGradient(16, 16, 0, 16, 16, 9);
        halo.addColorStop(0, `rgba(${c},0.9)`); halo.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = halo; g.fillRect(0, 0, 32, 32);
        g.fillStyle = `rgba(${c},1)`;
        g.beginPath();
        g.moveTo(16, 1); g.quadraticCurveTo(17, 15, 31, 16); g.quadraticCurveTo(17, 17, 16, 31);
        g.quadraticCurveTo(15, 17, 1, 16); g.quadraticCurveTo(15, 15, 16, 1);
        g.fill();
      } else if (name === 'steam') {
        // A curl of steam in the sticker style: a white wisp with a faint ink
        // edge, so it reads on pale paving as well as dark ground.
        cv.width = 24; cv.height = 48;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(12, 45); g.bezierCurveTo(2, 34, 22, 26, 12, 15); g.quadraticCurveTo(7, 9, 13, 3);
        g.strokeStyle = 'rgba(70,86,130,0.35)'; g.lineWidth = 7.5; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 5; g.stroke();
      } else if (name.startsWith('cat')) {
        // Baked at twice its size, so it stays crisp on sharp screens.
        cv.width = 80; cv.height = 64;
        g.scale(2, 2);
        drawCat(g, 20, 26, name);
      }
    }
    return (this._sprites[name] = cv);
  }

  // ---------------- Drawing ----------------

  /** On the ground, under everyone: water glints, flock shadows, hawker cats,
   *  town birds pecking. `objs` are the objects in view. */
  drawGround(ctx, objs, ox, oy, t) {
    this.drawn = 0;
    if (!this.on) return;
    this._glints(ctx, ox, oy, t);
    const f = this.flock;
    if (f.on) {
      // The flock's shadows: well below and a little behind the birds.
      ctx.save();
      ctx.fillStyle = 'rgba(34,44,80,0.13)';
      ctx.beginPath();
      const q = this._q || (this._q = { x: 0, y: 0 });
      for (let j = 0; j < f.n; j++) {
        this._flockPos(j, q);
        const x = q.x - ox - 30 * f.dir, y = q.y - oy + 150;
        ctx.moveTo(x + 6, y); ctx.ellipse(x, y, 6, 2.4, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
    this._cats(ctx, objs, ox, oy, t);
    const b = this.birds;
    if (b.on && !b.flee) {
      for (let i = 0; i < b.n; i++) {
        const m = b.m[i], x = b.x + m.dx - ox, y = b.y + m.dy - oy;
        const lift = 2 * arc(m.hop / BIRD_HOP_MS);
        const peck = Math.sin(m.p * 0.006 + i) > 0.6;
        // A pigeon bobs through its painted pecking loop; mynas and sparrows peck now and then.
        const img = m.sp === 'pigeon' ? fxLoop('critter', 'pigeon_peck', t, PECK_MS, i * 397) : fxImage(`critter-${m.sp}${peck ? '_peck' : ''}`);
        ctx.fillStyle = 'rgba(34,48,74,0.18)';
        ctx.beginPath(); ctx.ellipse(x, y + 2.5, 4, 1.3, 0, 0, Math.PI * 2); ctx.fill();
        if (img) drawFx(ctx, img, x, y - 3 - lift, m.sp === 'pigeon' ? 13 : 12, m.face < 0);
        else drawBirdShape(ctx, x, y - 2 - lift, m.face, peck);
        this.drawn++;
      }
    }
  }

  _glints(ctx, ox, oy, t) {
    const w = this._water, n = w.length >> 1;
    if (!n) return;
    const day = this._day, clear = 1 - clamp01(this._gloom * 1.4);
    const strength = (day * 0.95 + (1 - day) * 0.5) * clear;
    if (strength < 0.05) return;
    // (The painted sparkle once it has loaded, else the baked twinkle.)
    const img = fxLoop('particle', 'sparkle', 0, 0, 0, 0) ? null : this._sprite(day > 0.5 ? 'glint' : 'moonglint');
    if (!img && !fxLoop('particle', 'sparkle', 0, 0, 0, 0)) return;
    // A few rings spreading on the water too (the painted ripple loop), by day and night.
    ctx.save();
    for (let i = 0; i < RIPPLE_CAP; i++) {
      const ph = (t + i * 1231) / 2600, cyc = Math.floor(ph), f = ph - cyc;
      const k = Math.floor(tileHash(i, cyc, 21) * n) * 2;
      const rip = fxLoop('particle', 'ripple', 0, 0, 0, f);
      if (!rip) break;
      ctx.globalAlpha = Math.sin(f * Math.PI) * 0.75 * (0.4 + 0.6 * clear);
      ctx.drawImage(rip, w[k] * TILE + 3 - ox, w[k + 1] * TILE + 12 - oy, 26, 10);
      this.drawn++;
    }
    const count = Math.min(GLINT_CAP, Math.ceil(n / 5));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const period = 1400 + (i % 5) * 260;
      const ph = (t + i * 397) / period, cyc = Math.floor(ph), f = ph - cyc;
      const h = tileHash(i, cyc, 7);
      const k = Math.floor(h * n) * 2;
      const x = w[k] * TILE + 4 + tileHash(i, cyc, 8) * (TILE - 8) - ox, y = w[k + 1] * TILE + 4 + tileHash(i, cyc, 9) * (TILE - 8) - oy;
      const s = Math.sin(f * Math.PI), a = s * s * strength;
      if (a < 0.03) continue;
      const r = (3 + h * 4) * (0.6 + 0.4 * s);
      // The painted sparkle grows from a dot to a star and back as it winks.
      const spark = fxLoop('particle', 'sparkle', 0, 0, 0, f);
      ctx.globalAlpha = spark ? Math.min(1, a * 1.4) : a;
      if (spark) ctx.drawImage(spark, x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
      else ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      this.drawn++;
    }
    ctx.restore();
  }

  _clearBeside(x, y) {
    const w = this._world;
    return !!w && w.inBounds(x, y) && !w.objectAt(x, y) && w.terrainAt(x, y) !== TERRAIN.WATER;
  }

  _cats(ctx, objs, ox, oy, t) {
    if (!objs) return;
    let n = 0;
    const asleep = this._night > 0.55;
    for (const o of objs) {
      if (n >= CAT_CAP) break;
      if (!CAT_STALLS.has(o.objId) || o.depleted) continue;
      const h = tileHash(o.x, o.y, 51);
      if (h > 0.75) continue;          // most stalls have a cat; not all
      n++;
      const coat = h < 0.3 ? 'ginger' : h < 0.55 ? 'calico' : 'grey';
      // Beside the stall, on whichever side is clear.
      let side = h * 10 % 1 < 0.5 ? -1 : 1;
      if (!this._clearBeside(o.x + side, o.y)) side = -side;
      if (!this._clearBeside(o.x + side, o.y)) continue;
      const x = o.x * TILE + TILE / 2 + side * 30 - ox, y = o.y * TILE + TILE / 2 + 14 - oy;
      // The painted cat: flicking its tail, or curled up asleep and breathing
      // slowly (the last two frames of its curling loop, in turn).
      const art = asleep ? fxLoop('critter', 'cat_curl', 0, 0, 0, Math.floor((t + h * 5000) / 1400) % 2 ? 0.5 : 0.75)
        : fxLoop('critter', 'cat_tail', t, TAIL_MS, h * 4000);
      const img = art || this._sprite(`cat-${coat}-${asleep ? 'z' : 's'}`);
      if (!img) continue;
      ctx.fillStyle = 'rgba(34,48,74,0.2)';
      ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      if (art) { drawFx(ctx, art, x, y - 11, 24, side > 0); this.drawn++; continue; }   // facing the stall
      ctx.drawImage(img, x - 20, y - 26, 40, 32);
      if (!asleep) {
        // The tail, swishing slowly.
        const sw = Math.sin(t * 0.0026 + h * 9) * 5;
        ctx.strokeStyle = '#22304A'; ctx.lineWidth = 4.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 6, y - 2); ctx.quadraticCurveTo(x + 15, y - 3, x + 13 + sw * 0.6, y - 12 - Math.abs(sw) * 0.3); ctx.stroke();
        ctx.strokeStyle = CAT_COATS[coat][0]; ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      this.drawn++;
    }
  }

  /** Over the objects they belong to: steam rising off hawker stalls and ranges. */
  drawOver(ctx, objs, ox, oy, t, pj = null) {
    if (!this.on || !objs) return;
    let img = null;
    ctx.save();
    for (const o of objs) {
      if (!STEAMERS.has(o.objId) || o.depleted) continue;
      const puff = !!fxLoop('particle', 'steam', 0, 0, 0, 0);   // the painted puffs, once loaded
      img = img || (puff ? null : this._sprite('steam'));
      if (!img && !puff) break;
      const cx = o.x * TILE + TILE / 2 - ox + (o.objId === 'range' ? 0 : -6), cy = o.y * TILE + TILE / 2 - oy - (o.objId === 'range' ? 16 : 22);
      const h = tileHash(o.x, o.y, 3) * 10;
      if (pj) applyRow(ctx, pj, o.y * TILE + 29 - oy);   // the depth view: at the stall's row
      // Three curls in turn, each rising, swaying, stretching and fading out.
      for (let i = 0; i < 3; i++) {
        const f = ((t * 0.00035 + i / 3 + h) % 1);
        const a = Math.sin(f * Math.PI);
        if (a < 0.05) continue;
        const sx = cx + (i - 1) * 6 + Math.sin(f * 4 + h + i) * 2 + f * this.wind * 8;
        ctx.globalAlpha = a * 0.8;
        if (puff) {
          // A wisp that billows into a cloud and breaks up as it rises (its four frames in turn).
          const hh = 9 + f * 9;
          drawFx(ctx, fxLoop('particle', 'steam', 0, 0, 0, f), sx, cy - f * 22 - hh / 2, hh);
        } else {
          const w = 6 + f * 3, hh = 10 + f * 8;
          ctx.drawImage(img, sx - w / 2, cy - f * 22 - hh, w, hh);
        }
        this.drawn++;
      }
    }
    ctx.restore();
  }

  /** In the air (under the light pass, so dusk and night colour them too):
   *  leaves and petals on the breeze, startled town birds, the flock overhead. */
  drawAir(ctx, ox, oy, t) {
    if (!this.on) return;
    ctx.save();
    for (const l of this.leaves) {
      if (!l.on) continue;
      // Tumbling: the leaf turns over, so its width swells and shrinks.
      const turn = Math.cos(l.p * 0.004 + l.spin), size = l.art === 'frangipani' ? 9 : 8;
      const x = l.x - ox, y = l.y - oy;
      ctx.globalAlpha = Math.min(1, l.life / 900);
      // A painted tumble where there is one (its frames do the turning), else the leaf squashed to turn.
      const loop = TUMBLE[l.art] && fxLoop('particle', TUMBLE[l.art], l.p, TUMBLE_MS, l.spin * 300);
      const img = loop || fxImage(`particle-${l.art}`);
      if (loop) drawFx(ctx, loop, x, y, size + 1);
      else if (img) ctx.drawImage(img, x - size * Math.abs(turn) / 2, y - size / 2, size * Math.max(0.15, Math.abs(turn)), size);
      else {
        ctx.fillStyle = LEAF_COL[l.art] || '#7cc46a';
        ctx.beginPath(); ctx.ellipse(x, y, 3.2 * Math.max(0.2, Math.abs(turn)), 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      this.drawn++;
    }
    ctx.globalAlpha = 1;
    const b = this.birds;
    if (b.on && b.flee) {
      for (let i = 0; i < b.n; i++) {
        const m = b.m[i], x = b.x + m.dx - ox, y = b.y + m.dy - oy;
        const up = Math.sin(t * 0.05 + i * 1.7) > 0;
        const img = m.sp === 'sparrow' ? fxImage(`critter-sparrow_${up ? 'up' : 'down'}`) : fxLoop('critter', `${m.sp}_fly`, t, WING_MS, i * 170);
        if (img) drawFx(ctx, img, x, y, m.sp === 'sparrow' ? 13 : 15, m.face < 0);
        else drawWings(ctx, x, y, up, 6);
        this.drawn++;
      }
    }
    const f = this.flock;
    if (f.on) {
      const q = this._q || (this._q = { x: 0, y: 0 });
      for (let j = 0; j < f.n; j++) {
        this._flockPos(j, q);
        const up = Math.sin(t * 0.03 + j * 1.9) > 0;
        // Each bird a little out of step with the next, so the flock shimmers.
        const img = fxLoop('critter', f.sp, t, WING_MS * 1.3, j * 210) || fxImage(`critter-myna_${up ? 'up' : 'down'}`);
        if (img) drawFx(ctx, img, q.x - ox, q.y - oy, f.sp === 'egret_fly' ? 18 : 16, f.dir < 0);
        else drawWings(ctx, q.x - ox, q.y - oy, up, 7);
        this.drawn++;
      }
    }
    ctx.restore();
  }
}

// ---------------- Small procedural shapes (until painted art exists) ----------------

const CAT_COATS = {
  ginger: ['#f2a65a', '#d9823a', '#fff3e2'],
  calico: ['#fff6ea', '#e09a52', '#3b3a48'],
  grey: ['#a9b0c2', '#848ba2', '#eef0f6'],
};

// A chibi cat in the sticker style (navy ink, white border) sitting or curled
// asleep, its feet at (x, y). `name` is 'cat-<coat>-<s|z>'.
function drawCat(g, x, y, name) {
  const [, coat, pose] = name.split('-');
  const [fur, patch, belly] = CAT_COATS[coat] || CAT_COATS.ginger;
  const ink = '#22304A';
  g.lineJoin = 'round';
  const shape = (fn, fill) => {
    g.beginPath(); fn();
    g.strokeStyle = '#ffffff'; g.lineWidth = 4.4; g.stroke();
    g.fillStyle = fill; g.fill();
    g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
  };
  if (pose === 'z') {
    // A loaf, tail wrapped round, eyes shut.
    shape(() => g.ellipse(x, y - 6, 12, 7, 0, 0, Math.PI * 2), fur);
    shape(() => { g.moveTo(x - 9, y - 11); g.arc(x - 9, y - 9, 6, 0, Math.PI * 2); }, fur);
    g.fillStyle = patch; g.beginPath(); g.ellipse(x + 4, y - 9, 5, 3, 0.3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x - 13, y - 13); g.lineTo(x - 13, y - 18); g.lineTo(x - 10, y - 14); g.stroke();
    g.beginPath(); g.moveTo(x - 12, y - 9); g.quadraticCurveTo(x - 11, y - 8, x - 10, y - 9); g.moveTo(x - 8, y - 9); g.quadraticCurveTo(x - 7, y - 8, x - 6, y - 9); g.stroke();
    return;
  }
  // Sitting up: body, then head with ears, a patch, a pale chest, and a face.
  shape(() => g.ellipse(x, y - 7, 7.5, 8, 0, 0, Math.PI * 2), fur);
  g.fillStyle = belly; g.beginPath(); g.ellipse(x - 1, y - 6, 3.6, 5, 0, 0, Math.PI * 2); g.fill();
  shape(() => {
    g.moveTo(x - 7, y - 17); g.lineTo(x - 6, y - 24); g.lineTo(x - 2, y - 20);
    g.lineTo(x + 2, y - 20); g.lineTo(x + 6, y - 24); g.lineTo(x + 7, y - 17);
    g.quadraticCurveTo(x + 8, y - 11, x, y - 11); g.quadraticCurveTo(x - 8, y - 11, x - 7, y - 17);
  }, fur);
  g.fillStyle = patch; g.beginPath(); g.ellipse(x + 3.5, y - 19, 3, 2.2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink;
  g.beginPath(); g.arc(x - 3, y - 16, 1.1, 0, Math.PI * 2); g.arc(x + 3, y - 16, 1.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f08aa0'; g.beginPath(); g.arc(x, y - 14.2, 0.9, 0, Math.PI * 2); g.fill();
}

// A little grey bird standing (until the painted ones load).
function drawBirdShape(ctx, x, y, face, peck) {
  ctx.fillStyle = '#7a8296';
  ctx.beginPath(); ctx.ellipse(x, y, 4, 2.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + face * 3.4, y - (peck ? 0 : 2.6), 1.8, 0, Math.PI * 2); ctx.fill();
}

// A bird in flight as a pair of wing strokes.
function drawWings(ctx, x, y, up, s) {
  ctx.strokeStyle = '#22304A'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s, y + (up ? -s * 0.5 : s * 0.3)); ctx.quadraticCurveTo(x - s * 0.4, y - (up ? s * 0.4 : 0), x, y);
  ctx.quadraticCurveTo(x + s * 0.4, y - (up ? s * 0.4 : 0), x + s, y + (up ? -s * 0.5 : s * 0.3));
  ctx.stroke();
}
