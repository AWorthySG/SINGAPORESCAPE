import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { mulberry32 } from '../game/pets.js';
import { blendMood } from './ambience.js';
import { fxImage, drawFx } from './fxart.js';
import { motionOK } from './juice.js';
import { easeOut, smooth } from './motionkit.js';

// Weather and region moods, purely for looks (nothing here touches the game's
// rules). The forecast is worked out from the game clock alone, so the same
// moment of play always has the same sky: time is cut into slots of a couple
// of minutes and each slot's number is hashed into dry, rain or (rarer) storm.
// Depth comes from a few batches of rain, splashes and mist laid on the
// terrain, and thinner fog in the air. The sky's tints go to the light pass
// (lighting.js) as washes.

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
  'The Shadow Rift': [200, 36, 50, 0.16],
  'The Celestial Peaks': [190, 218, 255, 0.14],
  'Pulau Hantu': [120, 150, 200, 0.06],
};
const NO_SKY = [0, 0, 0, 0];
// Lands that keep some mist all day: the Wilderness's drifting murk.
export const HAZY = new Map([['The Wilderness', 0.45]]);

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

function rainAmount(slot, kind) {
  return kind === 2 ? 1 : kind === 1 ? 0.55 + hash01(slot * 31 + 7) * 0.3 : 0;
}

/**
 * The weather at a moment of play (game.playMs). Deterministic: the same
 * time always gives the same answer. Returns { rain 0..1, storm 0..1, flash 0..1 }.
 * Two wet slots share their midpoint at the seam. Dry boundaries ramp in
 * or out on the wet side, so rain, wind and storm light change together.
 */
export function weatherAt(ms, out = { rain: 0, storm: 0, flash: 0 }) {
  const slot = Math.floor(ms / WEATHER_SLOT_MS), into = ms - slot * WEATHER_SLOT_MS;
  const kind = slotWeather(slot);
  out.rain = 0; out.storm = 0; out.flash = 0;
  if (!kind) return out;
  out.rain = rainAmount(slot, kind);
  out.storm = kind === 2 ? 1 : 0;
  const left = into < RAMP_MS, right = into > WEATHER_SLOT_MS - RAMP_MS;
  if (left || right) {
    const adjacent = slot + (left ? -1 : 1), other = slotWeather(adjacent);
    const edge = 1 - smooth((left ? into : WEATHER_SLOT_MS - into) / RAMP_MS);
    const rain = other ? (out.rain + rainAmount(adjacent, other)) / 2 : 0;
    const storm = other ? (out.storm + (other === 2 ? 1 : 0)) / 2 : 0;
    out.rain += (rain - out.rain) * edge;
    out.storm += (storm - out.storm) * edge;
  }
  if (kind === 2) {
    // Lightning is one soft flash with a long tail. It settles before the
    // next second, even for the latest possible start.
    const sec = Math.floor(ms / 1000);
    if (hash01(sec * 131 + 5) < 0.09) {
      const at = hash01(sec * 17 + 3) * 700, d = ms - sec * 1000 - at;
      if (d > 0 && d < 300) {
        const seam = smooth(Math.min(into, WEATHER_SLOT_MS - into) / 400);
        out.flash = out.storm * seam * smooth(d / 44) * (1 - smooth((d - 55) / 245));
      }
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

const RAIN_CAP = 170, RAIN_CAP_LOW = 50, SNOW_CAP = 110, EMBER_CAP = 26, RIPPLE_CAP = 40, SPLASH_CAP = 36;
const FULL_RAIN = [
  { speed: 0.68, length: 0.67, width: 0.74, alpha: 0.34 },
  { speed: 0.89, length: 0.96, width: 1.06, alpha: 0.51 },
  { speed: 1.22, length: 1.29, width: 1.53, alpha: 0.7 },
];
const LIGHT_RAIN = [FULL_RAIN[0], FULL_RAIN[2]];
const TAU = Math.PI * 2;
const wrap = (v, span) => ((v % span) + span) % span;

function paving(tt) { return tt === TERRAIN.PATH || tt === TERRAIN.STONE; }
const puddleSeed = (x, y) => hash01(x * 92821 + y * 68917);

// Cloud shadows: on a clear day, big soft shadows of passing clouds drift
// across the land (and everyone on it). Each keeps its place in the world and
// slides east with the wind; they fade out at night, in rain (the sky is all
// cloud then) and under a roof.
export const CLOUD_COUNT = 4;
export const CLOUD_ALPHA = 0.2;
export const CLOUD_RES = 4;      // the cloud buffer is drawn at 1/4 of the screen's size   // how dark a cloud's shadow is at its middle
/** How strong the cloud shadows are: full on a dry day, none at night, in rain or under a roof. */
export function cloudShadeAt(day, rain, roofed) {
  if (roofed) return 0;
  return smooth((day - 0.35) / 0.4) * (1 - smooth(rain / 0.4));
}

export class Weather {
  constructor() {
    this._base = { rain: 0, storm: 0, flash: 0 };
    this.zone = '';
    this._weatherAt = null;
    this.wet = 0;          // how wet the ground is: rises in rain, dries slowly after
    this.mist = 0;
    this._drops = []; this._flakes = []; this._embers = []; this._ripples = [];
    this._splashes = [];   // rain bouncing off the ground (world coordinates)
    this._puddles = [];
    this._rippleCarry = 0;
    this._visualRand = mulberry32(0xae5742d);   // weather never rolls the game's random stream
    this.clouds = 0;       // cloud shadow strength (cloudShadeAt)
    this._cloudImg = null;
    this._sky = [0, 0, 0, 0];
    // The washes handed to the light pass: rain's grey, mist's pale veil, the region's sky.
    this._rainWash = [58, 78, 118, 0];   // a cool slate blue
    this._mistWash = [214, 224, 234, 0];
    this.state = { rain: 0, snow: 0, embers: 0, storm: 0, flash: 0, gloom: 0, clouds: 0, mist: 0, wet: 0, day: 1, calm: false, roofed: false,
      washes: [this._rainWash, this._mistWash, this._sky], flashWash: [236, 242, 255, 0] };
    // The light pass paints the cloud shadows into its own layer (lighting.js).
    this.state.cloudsInto = (g, ox, oy, vw, vh, t, scale) => this.drawCloudsInto(g, ox, oy, vw, vh, t, scale);
    this._mistImg = null;
    // Phones and small screens get half the rain and no puddle sheen.
    this._coarse = null;
    try { this._coarse = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null; } catch { this._coarse = null; }
  }

  /** A touch or small screen (checked live, so a rotated tablet follows). */
  small() {
    if (this._coarse && this._coarse.matches) return true;
    return typeof innerWidth === 'number' && innerWidth < 900;
  }

  /** Per frame: work out the sky for the region and time, and ease the ground's wetness. */
  update(game, dt) {
    const zone = game.currentZoneName || '';
    const ms = game.playMs || 0, base = weatherAt(ms, this._base);
    const w = regionWeather(zone, base), roofed = ROOFED.has(zone);
    const s = this.state;
    // A move into another climate keeps the sky on screen while it blends.
    // A loaded clock or a sealed room starts directly in its own conditions.
    const mix = this._weatherAt === null || Math.abs(ms - this._weatherAt) > 3000 || roofed ? 1 : 1 - Math.exp(-Math.max(0, dt) / 740);
    this._weatherAt = ms;
    s.rain += (w.rain - s.rain) * mix; s.snow += (w.snow - s.snow) * mix;
    s.embers += (w.embers - s.embers) * mix; s.storm += (w.storm - s.storm) * mix;
    s.calm = !motionOK(game); s.roofed = roofed;
    s.day = game.daylightFactor ? game.daylightFactor() : 1;
    s.flash = s.calm ? 0 : w.flash * Math.min(1, s.storm * 1.4);
    s.gloom = Math.max(s.rain * 0.46, s.storm * 0.76, s.snow * 0.2);
    this._rainWash[3] = s.rain * 0.11 + s.storm * 0.17;
    const phase = game.dayPhase ? game.dayPhase() : 0.5;
    const forestMist = MIST_REGIONS.has(zone) ? Math.max(mistAt(phase), w.rain * 0.42) : 0;
    const targetMist = Math.max(forestMist, HAZY.get(zone) || 0, w.storm * 0.28);
    this.mist = s.mist += (targetMist - s.mist) * mix;
    this._mistWash[3] = s.mist * 0.12;
    s.flashWash[3] = s.flash * 0.26;
    blendMood(this._sky, REGION_SKY[zone] || NO_SKY, dt);
    // Puddles come up over ~20s of rain and dry over a minute after.
    const target = Math.min(1, s.rain * 1.4);
    this.wet = roofed ? 0 : this.wet + (target - this.wet) * (1 - Math.exp(-Math.max(0, dt) / (target > this.wet ? 18000 : 56000)));
    s.wet = this.wet;
    this.zone = zone;
    this.clouds = cloudShadeAt(s.day, s.rain + s.snow, roofed);
    return s;
  }

  /** Ground-level weather, drawn under everyone: puddle sheen on paths and
   *  ripples where rain hits water. */
  drawGround(ctx, game, ox, oy, vw, vh, t, dt, low) {
    const s = this.state;
    // The light pass paints the cloud shadows (drawCloudsInto); trimmed or low
    // graphics go without.
    s.clouds = low ? 0 : this.clouds;
    if (low || s.roofed) {
      this._ripples.length = 0; this._splashes.length = 0; this._rippleCarry = 0;
      return;
    }
    const world = game.world;
    const x0 = Math.max(0, Math.floor(ox / TILE)), y0 = Math.max(0, Math.floor(oy / TILE));
    const x1 = Math.min(world.width - 1, Math.ceil((ox + vw) / TILE)), y1 = Math.min(world.height - 1, Math.ceil((oy + vh) / TILE));
    if (this.wet > 0.03 && !this.small()) {
      // A cool reflective centre and a narrow rim on the same wet patches.
      // Batch the paint and the rims so many wet tiles stay cheap to draw.
      const pts = this._puddles;
      pts.length = 0;
      ctx.save();
      ctx.globalAlpha = this.wet * 0.32;
      ctx.fillStyle = '#bed5e6';
      ctx.beginPath();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!paving(world.terrainAt(x, y))) continue;
        const h = puddleSeed(x, y);
        if (h > 0.28) continue;
        const cx = x * TILE + 8 + h * 50 - ox, cy = y * TILE + 10 + ((h * 977) % 1) * 14 - oy, rx = 6 + h * 26;
        pts.push(cx, cy, rx);
        ctx.moveTo(cx + rx, cy);
        ctx.ellipse(cx, cy, rx, rx * 0.4, 0, 0, TAU);
      }
      ctx.fill();
      ctx.globalAlpha = this.wet * 0.38; ctx.strokeStyle = '#ebf6fa'; ctx.lineWidth = 0.65;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 3) {
        const x = pts[i], y = pts[i + 1], r = pts[i + 2];
        ctx.moveTo(x + Math.cos(3.55) * r, y + Math.sin(3.55) * r * 0.4);
        ctx.ellipse(x, y, r, r * 0.4, 0, 3.55, 5.28);
      }
      ctx.stroke();
      ctx.restore();
    }
    this._drawGroundMist(ctx, ox, oy, vw, vh, t);
    // Raindrops meet the terrain, so their rings and splashes stay in place
    // while you walk past and tilt with the rest of the ground.
    const rp = this._ripples, sp = this._splashes;
    if (s.calm) { rp.length = 0; sp.length = 0; this._rippleCarry = 0; return; }
    if (s.rain > 0.05) {
      // Carry the fractional attempts forward so faster frames do not create more rain.
      this._rippleCarry += s.rain * dt * 0.4;
      const tries = Math.floor(this._rippleCarry);
      this._rippleCarry -= tries;
      const random = this._visualRand;
      for (let i = 0; i < tries; i++) {
        const tx = x0 + Math.floor(random() * (x1 - x0 + 1)), ty = y0 + Math.floor(random() * (y1 - y0 + 1));
        const tt = world.terrainAt(tx, ty);
        if (tt === TERRAIN.WATER) {
          if (rp.length < RIPPLE_CAP) rp.push({ x: tx * TILE + random() * TILE, y: ty * TILE + random() * TILE, life: 0 });
          continue;
        }
        if (!paving(tt)) continue;
        const h = puddleSeed(tx, ty);
        if (this.wet > 0.22 && h <= 0.28 && rp.length < RIPPLE_CAP) {
          const rx = 6 + h * 26;
          rp.push({ x: tx * TILE + 8 + h * 50 + (random() - 0.5) * rx * 1.2, y: ty * TILE + 10 + ((h * 977) % 1) * 14 + (random() - 0.5) * rx * 0.3, life: 0 });
        } else if (!this.small() && sp.length < SPLASH_CAP && random() < 0.21) {
          sp.push({ x: tx * TILE + random() * TILE, y: ty * TILE + random() * TILE, life: 0 });
        }
      }
    } else this._rippleCarry = 0;
    if (rp.length) {
      ctx.save();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1;
      for (let i = rp.length - 1; i >= 0; i--) {
        const r = rp[i];
        r.life += dt;
        if (r.life >= 650) { rp.splice(i, 1); continue; }
        const k = r.life / 650, spread = easeOut(k);
        ctx.globalAlpha = (1 - smooth(k)) * 0.62;
        ctx.beginPath(); ctx.ellipse(r.x - ox, r.y - oy, 1.4 + spread * 9, 0.8 + spread * 5, 0, 0, TAU); ctx.stroke();
        // A second, smaller ring a moment behind the first.
        if (k > 0.25) {
          const u = (k - 0.25) / 0.75;
          ctx.globalAlpha = Math.sin(u * Math.PI) * 0.34;
          ctx.beginPath(); ctx.ellipse(r.x - ox, r.y - oy, 1 + u * 5, 0.7 + u * 3.4, 0, 0, TAU); ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (sp.length) {
      ctx.save();
      ctx.strokeStyle = '#e3f4fc'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      for (let i = sp.length - 1; i >= 0; i--) {
        const p = sp[i];
        p.life += dt;
        if (p.life >= 250) { sp.splice(i, 1); continue; }
        const k = p.life / 250, r = 1.2 + easeOut(k) * 4, rise = Math.sin(k * Math.PI) * 4.2;
        const x = p.x - ox, y = p.y - oy;
        ctx.globalAlpha = (1 - smooth(k)) * 0.56;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.68, 0, 0, TAU);
        ctx.moveTo(x - r, y - rise); ctx.lineTo(x - r - 1.2, y - rise - 1.5);
        ctx.moveTo(x + r, y - rise); ctx.lineTo(x + r + 1.2, y - rise - 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // A soft irregular bank, baked once. Stretch the same texture into wisps
  // over the ground or wider layers in the air.
  _mist() {
    if (this._mistImg !== null) return this._mistImg;
    if (typeof document === 'undefined' || !document.createElement) return (this._mistImg = false);
    const cv = document.createElement('canvas'); cv.width = 192; cv.height = 72;
    const g = cv.getContext('2d');
    if (!g) return (this._mistImg = false);
    for (const [x, y, w, h, a] of [[94, 38, 89, 25, 0.8], [54, 31, 50, 24, 0.5], [127, 31, 58, 27, 0.51], [93, 26, 43, 24, 0.34]]) {
      g.setTransform(w, 0, 0, h, x, y);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      grd.addColorStop(0, `rgba(221,235,243,${a})`);
      grd.addColorStop(0.54, `rgba(221,235,243,${a * 0.44})`);
      grd.addColorStop(1, 'rgba(221,235,243,0)');
      g.fillStyle = grd; g.fillRect(-1, -1, 2, 2);
    }
    return (this._mistImg = cv);
  }

  _drawGroundMist(ctx, ox, oy, vw, vh, t) {
    if (this.mist <= 0.025) return;
    const img = this._mist();
    if (!img) return;
    const strideX = 318, strideY = 218, drift = this.state.calm ? 0 : t * 0.007;
    const x0 = Math.floor((ox - drift - 160) / strideX), x1 = Math.ceil((ox + vw - drift + 160) / strideX);
    const y0 = Math.floor((oy - 60) / strideY), y1 = Math.ceil((oy + vh + 60) / strideY);
    ctx.save();
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const seed = hash01(i * 571 + j * 1471), w = 200 + 142 * seed, h = 49 + 26 * seed;
      const x = i * strideX + seed * 90 + drift - ox, y = j * strideY + (seed * 97 % 1) * 110 - oy;
      if (x + w / 2 < 0 || y + h / 2 < 0 || x - w / 2 > vw || y - h / 2 > vh) continue;
      ctx.globalAlpha = this.mist * (0.23 + seed * 0.18);
      ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    }
    ctx.restore();
  }

  /** Weather in the air, over everything: mist banks, rain or snow, embers.
   *  Low graphics keeps a thinner rain and snow and skips the rest. */
  drawAir(ctx, ox, oy, vw, vh, t, dt, low) {
    const s = this.state;
    // A thinner foreground veil. The denser banks have already been drawn
    // on the terrain behind the buildings and characters.
    if (!low && !s.roofed && this.mist > 0.04) {
      const img = this._mist();
      if (img) {
        ctx.save();
        ctx.globalAlpha = this.mist * (0.12 + 0.15 * s.day);
        const bw = Math.max(vw, vh) * 0.83, bh = bw * 0.29;
        const spanX = vw + bw, spanY = vh + bh, drift = s.calm ? 0 : t * 0.013;
        for (let i = 0; i < 4; i++) {
          const x = wrap(i * 523 + drift * (1 + i * 0.26) - ox * 0.56, spanX) - bw * 0.5;
          const y = wrap(i * 389 - oy * 0.52, spanY) - bh * 0.5;
          ctx.drawImage(img, x - bw / 2, y - bh / 2, bw, bh);
        }
        ctx.restore();
      }
    }
    const move = s.calm ? 0 : dt, clock = s.calm ? 0 : t;
    this._rain(ctx, vw, vh, move, low, clock);
    this._snow(ctx, vw, vh, clock, move, low);
    if (!low) this._embersDraw(ctx, vw, vh, clock, move);
  }

  // A soft, lumpy cloud shadow, baked once: a few overlapping round blobs.
  _cloud() {
    if (this._cloudImg !== null) return this._cloudImg;
    if (typeof document === 'undefined' || !document.createElement) return (this._cloudImg = false);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    if (!g) return (this._cloudImg = false);
    for (const [x, y, r] of [[80, 70, 52], [130, 56, 60], [180, 72, 46], [118, 84, 50]]) {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(30,44,74,0.55)'); grd.addColorStop(0.7, 'rgba(30,44,74,0.45)'); grd.addColorStop(1, 'rgba(30,44,74,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
    }
    return (this._cloudImg = cv);
  }

  /**
   * Paint the cloud shadows into the light pass's small layer `g` (lighting.js),
   * which covers the screen at `scale` of its size: so the clouds ride the
   * pass's one full-screen composite instead of adding their own (big
   * full-screen layers were the costliest thing on slower phones).
   */
  drawCloudsInto(g, ox, oy, vw, vh, t, scale) {
    const k = this.state.clouds;
    if (!(k > 0.02)) return;
    const img = this._cloud();
    if (!img) return;
    const cw = Math.max(vw, vh) * 1.5, ch = cw * 0.5;
    const spanX = vw + cw * 1.2, spanY = vh + ch * 1.2;
    const drift = this.state.calm ? 0 : t * 0.012;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = Math.min(1, k * CLOUD_ALPHA / 0.55);
    // Big (a cloud is wider than the screen) and spaced so that one or two
    // are usually passing over you, with clear sky between.
    for (let i = 0; i < CLOUD_COUNT; i++) {
      // World-anchored (they slide with the ground as you walk) and drifting
      // east at a breeze's pace, each at its own speed.
      const x = wrap(i * 977 + drift * (1 + (i % 3) * 0.3) - ox, spanX) - cw;
      const y = wrap(i * 613 - oy, spanY) - ch;
      if (x > vw || y > vh || x + cw < 0 || y + ch < 0) continue;   // wholly off screen
      g.drawImage(img, x * scale, y * scale, cw * scale, ch * scale);
    }
    g.globalAlpha = 1;
  }

  _rain(ctx, vw, vh, dt, low, t = 0) {
    const s = this.state, drops = this._drops, random = this._visualRand;
    const small = this.small(), bands = low || small ? LIGHT_RAIN : FULL_RAIN;
    const want = Math.round((low ? RAIN_CAP_LOW : RAIN_CAP) * (small ? 0.5 : 1) * s.rain * Math.min(1.4, (vw * vh) / (1100 * 620)));
    while (drops.length < want) drops.push({ x: random() * (vw + 80), y: random() * vh, v: 0.84 + random() * 0.33 });
    if (drops.length > want) drops.length = want;
    if (!drops.length) return;
    const gust = Math.sin(t * 0.0017) * 0.045 + Math.sin(t * 0.0042) * 0.025;
    const slant = 0.2 + s.storm * 0.23 + gust * (0.22 + s.storm);
    const len = 15 + s.storm * 8, fall = 0.93 + s.storm * 0.35;
    ctx.save();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#e3f2ff';
    for (let z = 0; z < bands.length; z++) {
      const band = bands[z], speed = fall * band.speed;
      ctx.globalAlpha = band.alpha * (0.66 + s.rain * 0.34) * (0.8 + s.day * 0.2) * (s.calm ? 0.68 : 1);
      ctx.lineWidth = band.width;
      ctx.beginPath();
      for (let i = z; i < drops.length; i += bands.length) {
        const d = drops[i], step = speed * d.v * dt;
        d.y += step; d.x -= slant * step;
        if (d.y > vh + len || d.x < -25 || d.x > vw + 82) {
          d.y = -10 - random() * 40; d.x = random() * (vw + 80);
        }
        const l = len * d.v * band.length;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + slant * l, d.y - l);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _snow(ctx, vw, vh, t, dt, low) {
    const s = this.state, fl = this._flakes, random = this._visualRand;
    const want = Math.round((low ? SNOW_CAP / 3 : SNOW_CAP) * s.snow);
    while (fl.length < want) fl.push({ x: random() * vw, y: random() * vh, v: 0.6 + random() * 0.8, p: random() * 6 });
    if (fl.length > want) fl.length = want;
    if (!fl.length) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    for (const f of fl) {
      f.y += 0.035 * f.v * dt; f.x += Math.sin(t * 0.0012 + f.p) * 0.02 * dt;
      if (f.y > vh + 4) { f.y = -4; f.x = random() * vw; }
      const r = 1 + f.v;
      ctx.moveTo(f.x + r, f.y); ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // Embers rising through the Shadow Rift: the painted ember once it has
  // loaded (fxart.js), a small orange spark until then.
  _embersDraw(ctx, vw, vh, t, dt) {
    const s = this.state, em = this._embers, random = this._visualRand;
    const want = Math.round(EMBER_CAP * s.embers);
    while (em.length < want) em.push({ x: random() * vw, y: vh * (0.3 + random() * 0.8), v: 0.5 + random() * 0.7, p: random() * 6 });
    if (em.length > want) em.length = want;
    if (!em.length) return;
    const img = fxImage('particle-ember');
    ctx.save();
    for (const e of em) {
      e.y -= 0.022 * e.v * dt; e.x += Math.sin(t * 0.0016 + e.p) * 0.025 * dt;
      if (e.y < -10) { e.y = vh + 10; e.x = random() * vw; }
      ctx.globalAlpha = 0.55 + 0.4 * Math.sin(t * 0.006 + e.p * 3);
      if (img) drawFx(ctx, img, e.x, e.y, 7 + e.v * 5);
      else { ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(e.x, e.y, 1.6 + e.v, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
}
