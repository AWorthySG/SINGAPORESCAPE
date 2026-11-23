// Atmosphere: the parts of the colour grade that depend on WHERE you stand and
// WHEN, layered with the light pass (lighting.js) and the golden hour
// (cosylight.js).
//
// - Region grade blended across borders: rather than snapping to the region
//   you are in, the mood is a weighted mix of the regions a few tiles around
//   you, so walking from the town into the jungle the green haze creeps in
//   before the region's name changes. Sampled only when you change tile.
// - The time of day's own light: at a bright midday the sun burns off part of
//   the region's haze so colours read crisp, and the night's darkness deepens
//   from a dusky indigo to a clear moonlit blue. Both are folded into the light
//   pass's one full-screen fill, so they cost no extra layer (a full-screen
//   blend layer measured several ms a frame on software-drawn canvases).
// - Cached light pools for the warm glow under lamps and fires drawn with the
//   objects: one baked radial sprite per colour, never a gradient per frame.
//
// The maths (grade selection, border blending) is plain functions so the tests
// can check it headless; the drawing does nothing without a DOM.

import { moodFor } from './ambience.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------- Region grade across borders ----------------

export const BLEND_TILES = 9;   // how far (tiles) around you the neighbouring regions are felt
// A 3x3 ring of samples: you count most, the sides less, the corners least.
const SAMPLES = [[0, 0, 4], [1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [1, 1, 1], [-1, 1, 1], [1, -1, 1], [-1, -1, 1]];

/**
 * The region mood at tile (tx, ty), blended with the regions around it.
 * `zoneName(x, y)` names the region at a tile; `mood(name)` gives its
 * [r, g, b, a] (moodFor, or the game's choice-shaded worldMood). Colours are
 * mixed weighted by their strength, so a faint region next to a strong one
 * doesn't wash it out. Writes into `out`.
 */
export function blendedMood(zoneName, mood, tx, ty, out = [0, 0, 0, 0], reach = BLEND_TILES) {
  let r = 0, g = 0, b = 0, a = 0, wsum = 0;
  for (const [dx, dy, w] of SAMPLES) {
    const m = mood(zoneName(tx + dx * reach, ty + dy * reach)) || moodFor('');
    const wa = w * m[3];
    r += m[0] * wa; g += m[1] * wa; b += m[2] * wa; a += wa; wsum += w;
  }
  if (a > 0) { out[0] = r / a; out[1] = g / a; out[2] = b / a; } else { out[0] = out[1] = out[2] = 0; }
  out[3] = wsum ? a / wsum : 0;
  return out;
}

// ---------------- The time of day's light ----------------

/**
 * How much of each time-of-day look to lay on at `phase` (0 midnight, 0.25
 * dawn, 0.5 noon, 0.75 dusk), and how much rain or storm (`gloom` 0..1, from
 * weather.js) mutes it:
 *   crisp  0..1  the bright midday lift (none in the rain: overcast is flat)
 *   moon   0..1  the moonlit blue (strongest in the small hours)
 */
export function timeGrade(phase, gloom = 0, out = { crisp: 0, moon: 0 }) {
  const p = ((phase % 1) + 1) % 1;
  const elev = Math.sin((p - 0.25) * 2 * Math.PI);   // the sun's height: 1 at noon, -1 at midnight
  out.crisp = smooth(0.45, 0.95, elev) * (1 - clamp01(gloom * 1.6));
  out.moon = smooth(-0.15, -0.75, elev);
  return out;
}

export const CRISP_CLEAR = 0.5;   // how much of the region's haze the midday sun burns off

// The night's darkness colour: a dusky indigo in the evening, deepening to a
// clear moonlit blue in the small hours. The light pass multiplies by it, so
// it is a cool blue rather than near-black: white comes out a pale moonlit
// blue and the ink stays darkest.
const DUSK_DARK = [40, 30, 110], MOON_DARK = [22, 56, 160];

/** The colour of the night layer for a moonlight level (0..1), into `out` (its alpha is left alone). */
export function moonDark(moon, out = [0, 0, 0, 0]) {
  for (let i = 0; i < 3; i++) out[i] = DUSK_DARK[i] + (MOON_DARK[i] - DUSK_DARK[i]) * moon;
  return out;
}

/** The renderer's region grade and time-of-day light, with its baked pictures. */
export class Atmosphere {
  constructor() {
    this.ok = typeof document !== 'undefined' && !!document.createElement;
    this._mood = [0, 0, 0, 0];
    this._at = '';          // the tile (and region tone) the mood was last sampled at
    this._tg = timeGrade(0.5);
    this._crisp = [0, 0, 0, 0];
    this._pools = new Map();   // light-pool sprites by colour
  }

  /** The blended region mood around the player, re-sampled only on a new tile. */
  regionMood(game, moodOf) {
    const p = game.player, w = game.world;
    if (!p || !w || !w.zoneAt) return moodOf(game.currentZoneName);
    const key = `${p.x},${p.y},${game.currentZoneName}`;
    if (key !== this._at) {
      this._at = key;
      blendedMood((x, y) => (w.zoneAt(x, y)?.name) || game.currentZoneName, moodOf, p.x, p.y, this._mood);
    }
    return this._mood;
  }

  _canvas(w, h) {
    try {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      return cv.getContext('2d') ? cv : null;
    } catch { return null; }
  }

  /**
   * The region mood with the time of day folded in: at a bright midday the
   * sun burns off part of the haze, so colours read clean and crisp. Costs no
   * extra layer (the light pass paints the result in its one fill).
   */
  crisp(mood, phase, gloom) {
    const tg = timeGrade(phase, gloom, this._tg), out = this._crisp;
    out[0] = mood[0]; out[1] = mood[1]; out[2] = mood[2];
    out[3] = mood[3] * (1 - CRISP_CLEAR * tg.crisp);
    return out;
  }

  /** A soft additive pool of light (r px) at (cx, cy) in colour `rgb`, from a
   *  sprite baked once per colour. Draws nothing headless. */
  pool(ctx, cx, cy, r, rgb, alpha) {
    if (!this.ok || !(alpha > 0.004) || !(r > 0)) return;
    const key = rgb.join(',');
    let cv = this._pools.get(key);
    if (cv === undefined) {
      cv = this._canvas(64, 64);
      if (cv) {
        const g = cv.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
        grd.addColorStop(0, `rgba(${key},1)`);
        grd.addColorStop(1, `rgba(${key},0)`);
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      }
      this._pools.set(key, cv);
    }
    if (!cv) return;
    const a0 = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(cv, cx - r, cy - r, r * 2, r * 2);
    ctx.globalAlpha = a0; ctx.globalCompositeOperation = op;
  }
}
