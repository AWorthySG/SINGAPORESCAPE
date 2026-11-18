import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { blendMood } from './ambience.js';
import { fxImage, drawFx } from './fxart.js';

// Weather and region moods, purely for looks (nothing here touches the game's
// rules). The forecast is worked out from the game clock alone, so the same
// moment of play always has the same sky: time is cut into slots of a couple
// of minutes and each slot's number is hashed into dry, rain or (rarer) storm.
// On screen: cheap rain streaks drawn as one path, ripples on water, a wet
// sheen on paths, dawn mist in the forests, embers drifting through the Shadow
// Rift and snow on the Celestial Peaks. The sky's tints go to the light pass
// (lighting.js) as washes, so they cost no extra full-screen fill.

export const WEATHER_SLOT_MS = 137000;   // a slot of weather: about 2.3 minutes of play
export const RAIN_CHANCE = 0.2;          // share of slots that rain (storms included)
export const STORM_CHANCE = 0.05;        // share of slots that storm
const RAMP_MS = 25000;                   // rain eases in and out over this long
// Places with no open sky: the Endless Gate's sealed arena.
const ROOFED = new Set(['The Endless Gate']);
// Forests and reservoirs that fill with mist at dawn.
export const MIST_REGIONS = new Set(['Bukit Timah', 'MacRitchie Reservoir', 'Mandai Rainforest', 'Jurong Forest', 'Sungei Buloh Wetlands']);
// Regions with a sky of their own, layered over their colour mood: the Rift's
// blood-red sky, the Peaks' thin cold air.
export const REGION_SKY = {
  'The Shadow Rift': [190, 40, 56, 0.12],
  'The Celestial Peaks': [196, 222, 255, 0.1],
  'Pulau Hantu': [120, 150, 200, 0.06],
};
const NO_SKY = [0, 0, 0, 0];

/** A whole number hashed to [0, 1): the forecast's only source of chance. */
export function hash01(n) {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The weather a slot rolls: 0 dry, 1 rain, 2 storm. */
export function slotWeather(slot) {
  const u = hash01(slot * 7919 + 13);
  return u < STORM_CHANCE ? 2 : u < RAIN_CHANCE ? 1 : 0;
}

/**
 * The weather at a moment of play (game.playMs). Deterministic: the same
 * time always gives the same answer. Returns { rain 0..1, storm 0..1, flash 0..1 }.
 * Rain eases in and out at a slot's edges unless the next slot rains too.
 */
export function weatherAt(ms, out = { rain: 0, storm: 0, flash: 0 }) {
  const slot = Math.floor(ms / WEATHER_SLOT_MS), into = ms - slot * WEATHER_SLOT_MS;
  const kind = slotWeather(slot);
  out.rain = 0; out.storm = 0; out.flash = 0;
  if (!kind) return out;
  const heavy = kind === 2 ? 1 : 0.55 + hash01(slot * 31 + 7) * 0.3;
  let ramp = 1;
  if (!slotWeather(slot - 1)) ramp = Math.min(ramp, into / RAMP_MS);
  if (!slotWeather(slot + 1)) ramp = Math.min(ramp, (WEATHER_SLOT_MS - into) / RAMP_MS);
  ramp = Math.max(0, Math.min(1, ramp));
  out.rain = heavy * ramp;
  if (kind === 2) {
    out.storm = ramp;
    // Lightning: some seconds of a storm hold a flash, at a hashed moment in it.
    const sec = Math.floor(ms / 1000);
    if (hash01(sec * 131 + 5) < 0.09) {
      const at = hash01(sec * 17 + 3) * 700, d = ms - sec * 1000 - at;
      if (d >= 0 && d < 420) out.flash = ramp * (d < 90 ? 1 : d < 160 ? 0.35 : d < 230 ? 0.8 : Math.exp(-(d - 230) / 70));
    }
  }
  return out;
}

/** How misty the forests are at a time of day (phase 0..1, dawn at 0.25). */
export function mistAt(phase) {
  const d = (phase - 0.27) / 0.06;
  return Math.exp(-d * d);
}

/** What the sky does in a region right now: rain becomes snow on the Peaks,
 *  the Rift never rains (it smoulders), and roofed places have no weather. */
export function regionWeather(zone, base) {
  if (ROOFED.has(zone)) return { rain: 0, snow: 0, embers: 0, storm: 0, flash: 0 };
  if (zone === 'The Shadow Rift') return { rain: 0, snow: 0, embers: 1, storm: 0, flash: 0 };
  if (zone === 'The Celestial Peaks') return { rain: 0, snow: Math.max(0.3, base.rain), embers: 0, storm: 0, flash: 0 };
  return { rain: base.rain, snow: 0, embers: 0, storm: base.storm, flash: base.flash };
}

const RAIN_CAP = 170, RAIN_CAP_LOW = 50, SNOW_CAP = 110, EMBER_CAP = 26, RIPPLE_CAP = 26;

export class Weather {
  constructor() {
    this._base = { rain: 0, storm: 0, flash: 0 };
    this.zone = '';
    this.wet = 0;          // how wet the ground is: rises in rain, dries slowly after
    this.mist = 0;
    this._drops = []; this._flakes = []; this._embers = []; this._ripples = [];
    this._sky = [0, 0, 0, 0];
    // The washes handed to the light pass: rain's grey, mist's pale veil, the region's sky.
    this._rainWash = [70, 82, 108, 0];
    this._mistWash = [228, 236, 240, 0];
    this.state = { rain: 0, snow: 0, embers: 0, storm: 0, flash: 0, gloom: 0,
      washes: [this._rainWash, this._mistWash, this._sky], flashWash: [236, 242, 255, 0] };
    this._mistImg = null;
  }

  /** Per frame: work out the sky for the region and time, and ease the ground's wetness. */
  update(game, dt) {
    const zone = game.currentZoneName || '';
    const base = weatherAt(game.playMs || 0, this._base);
    const w = regionWeather(zone, base);
    const s = this.state;
    s.rain = w.rain; s.snow = w.snow; s.embers = w.embers; s.storm = w.storm; s.flash = w.flash;
    s.gloom = Math.max(w.rain * 0.45, w.storm * 0.75, w.snow * 0.2);
    this._rainWash[3] = w.rain * 0.08 + w.storm * 0.1;
    const phase = game.dayPhase ? game.dayPhase() : 0.5;
    this.mist = MIST_REGIONS.has(zone) ? Math.max(mistAt(phase), w.rain * 0.35) : 0;
    this._mistWash[3] = this.mist * 0.1;
    s.flashWash[3] = w.flash * 0.32;
    blendMood(this._sky, REGION_SKY[zone] || NO_SKY, dt);
    // Puddles come up over ~20s of rain and dry over a minute after.
    const target = ROOFED.has(zone) ? 0 : Math.min(1, w.rain * 1.4);
    this.wet += (target - this.wet) * Math.min(1, dt / (target > this.wet ? 20000 : 60000));
    this.zone = zone;
    return s;
  }

  /** Ground-level weather, drawn under everyone: puddle sheen on paths and
   *  ripples where rain hits water. */
  drawGround(ctx, game, ox, oy, vw, vh, t, dt, low) {
    const s = this.state;
    if (low) return;
    const world = game.world;
    const x0 = Math.max(0, Math.floor(ox / TILE)), y0 = Math.max(0, Math.floor(oy / TILE));
    const x1 = Math.min(world.width - 1, Math.ceil((ox + vw) / TILE)), y1 = Math.min(world.height - 1, Math.ceil((oy + vh) / TILE));
    if (this.wet > 0.03) {
      // Puddles: a pale sky-blue sheen on some path and paving tiles (picked
      // by the tile's spot, so they stay put), all filled in one go.
      ctx.save();
      ctx.globalAlpha = this.wet * 0.3;
      ctx.fillStyle = '#cfe0f4';
      ctx.beginPath();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const tt = world.terrainAt(x, y);
        if (tt !== TERRAIN.PATH && tt !== TERRAIN.STONE) continue;
        const h = hash01(x * 92821 + y * 68917);
        if (h > 0.28) continue;
        const cx = x * TILE + 8 + h * 50 - ox, cy = y * TILE + 10 + ((h * 977) % 1) * 14 - oy, rx = 6 + h * 26;
        ctx.moveTo(cx + rx, cy);
        ctx.ellipse(cx, cy, rx, rx * 0.36, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
    // Ripples: rain landing on water tiles in view.
    const rp = this._ripples;
    if (s.rain > 0.05) {
      const spawn = s.rain * dt * 0.06;
      for (let i = 0; i < spawn && rp.length < RIPPLE_CAP; i++) {
        const tx = x0 + Math.floor(Math.random() * (x1 - x0 + 1)), ty = y0 + Math.floor(Math.random() * (y1 - y0 + 1));
        if (world.terrainAt(tx, ty) !== TERRAIN.WATER) continue;
        rp.push({ x: tx * TILE + Math.random() * TILE, y: ty * TILE + Math.random() * TILE, life: 0 });
      }
    }
    if (rp.length) {
      ctx.save();
      ctx.strokeStyle = '#eef6ff'; ctx.lineWidth = 1.2;
      for (let i = rp.length - 1; i >= 0; i--) {
        const r = rp[i];
        r.life += dt;
        if (r.life >= 650) { rp.splice(i, 1); continue; }
        const k = r.life / 650;
        ctx.globalAlpha = (1 - k) * 0.7;
        ctx.beginPath(); ctx.ellipse(r.x - ox, r.y - oy, 2 + k * 9, 1 + k * 4, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // A soft white blob for the mist, baked once.
  _mist() {
    if (this._mistImg !== null) return this._mistImg;
    if (typeof document === 'undefined' || !document.createElement) return (this._mistImg = false);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    const g = cv.getContext('2d');
    if (!g) return (this._mistImg = false);
    const grd = g.createRadialGradient(64, 32, 0, 64, 32, 64);
    grd.addColorStop(0, 'rgba(240,244,246,0.9)'); grd.addColorStop(0.5, 'rgba(240,244,246,0.45)'); grd.addColorStop(1, 'rgba(240,244,246,0)');
    g.setTransform(1, 0, 0, 0.5, 0, 16); g.fillStyle = grd; g.fillRect(0, -32, 128, 128);
    return (this._mistImg = cv);
  }

  /** Weather in the air, over everything: mist banks, rain or snow, embers.
   *  Low graphics keeps a thinner rain and snow and skips the rest. */
  drawAir(ctx, ox, oy, vw, vh, t, dt, low) {
    const s = this.state;
    // Mist: a few big soft banks drifting slowly across the forest floor.
    if (!low && this.mist > 0.05) {
      const img = this._mist();
      if (img) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, this.mist * 0.5);
        const bw = Math.max(vw, vh) * 0.75, bh = bw * 0.38;
        const spanX = vw + bw, spanY = vh + bh;
        const wrap = (v, m) => ((v % m) + m) % m;
        for (let i = 0; i < 7; i++) {
          // Each bank keeps its place in the world (sliding with the camera at
          // a slower parallax) and drifts slowly east.
          const x = wrap(i * 523 + t * 0.006 * (1 + (i % 3) * 0.4) - ox * 0.3, spanX) - bw * 0.5;
          const y = wrap(i * 389 - oy * 0.3, spanY) - bh * 0.5;
          ctx.drawImage(img, x - bw / 2, y - bh / 2, bw, bh);
        }
        ctx.restore();
      }
    }
    this._rain(ctx, vw, vh, dt, low);
    this._snow(ctx, vw, vh, t, dt, low);
    if (!low) this._embersDraw(ctx, vw, vh, t, dt);
  }

  _rain(ctx, vw, vh, dt, low) {
    const s = this.state, drops = this._drops;
    const want = Math.round((low ? RAIN_CAP_LOW : RAIN_CAP) * s.rain * Math.min(1.4, (vw * vh) / (1100 * 620)));
    while (drops.length < want) drops.push({ x: Math.random() * (vw + 80), y: Math.random() * vh, v: 0.75 + Math.random() * 0.5 });
    if (drops.length > want) drops.length = want;
    if (!drops.length) return;
    const slant = 0.22 + s.storm * 0.25, len = 13 + s.storm * 6, fall = 0.9 + s.storm * 0.3;
    ctx.save();
    ctx.strokeStyle = 'rgba(214,226,246,0.55)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const d of drops) {
      d.y += fall * d.v * dt; d.x -= slant * fall * d.v * dt;
      if (d.y > vh + 10 || d.x < -20) { d.y = -10 - Math.random() * 40; d.x = Math.random() * (vw + 80); }
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + slant * len * d.v, d.y - len * d.v);
    }
    ctx.stroke();
    ctx.restore();
  }

  _snow(ctx, vw, vh, t, dt, low) {
    const s = this.state, fl = this._flakes;
    const want = Math.round((low ? SNOW_CAP / 3 : SNOW_CAP) * s.snow);
    while (fl.length < want) fl.push({ x: Math.random() * vw, y: Math.random() * vh, v: 0.6 + Math.random() * 0.8, p: Math.random() * 6 });
    if (fl.length > want) fl.length = want;
    if (!fl.length) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    for (const f of fl) {
      f.y += 0.035 * f.v * dt; f.x += Math.sin(t * 0.0012 + f.p) * 0.02 * dt;
      if (f.y > vh + 4) { f.y = -4; f.x = Math.random() * vw; }
      const r = 1 + f.v;
      ctx.moveTo(f.x + r, f.y); ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // Embers rising through the Shadow Rift: the painted ember once it has
  // loaded (fxart.js), a small orange spark until then.
  _embersDraw(ctx, vw, vh, t, dt) {
    const s = this.state, em = this._embers;
    const want = Math.round(EMBER_CAP * s.embers);
    while (em.length < want) em.push({ x: Math.random() * vw, y: vh * (0.3 + Math.random() * 0.8), v: 0.5 + Math.random() * 0.7, p: Math.random() * 6 });
    if (em.length > want) em.length = want;
    if (!em.length) return;
    const img = fxImage('particle-ember');
    ctx.save();
    for (const e of em) {
      e.y -= 0.022 * e.v * dt; e.x += Math.sin(t * 0.0016 + e.p) * 0.025 * dt;
      if (e.y < -10) { e.y = vh + 10; e.x = Math.random() * vw; }
      ctx.globalAlpha = 0.55 + 0.4 * Math.sin(t * 0.006 + e.p * 3);
      if (img) drawFx(ctx, img, e.x, e.y, 7 + e.v * 5);
      else { ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(e.x, e.y, 1.6 + e.v, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
}
