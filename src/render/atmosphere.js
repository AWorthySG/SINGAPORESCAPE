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

import { moodFor, MOOD_BLEND_MS } from './ambience.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------- Region grade across borders ----------------

export const BLEND_TILES = 9;   // how far (tiles) around you the neighbouring regions are felt
// A 3x3 ring of samples: you count most, the sides less, the corners least.
const SAMPLES = [[0, 0, 4], [1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [1, 1, 1], [-1, 1, 1], [1, -1, 1], [-1, -1, 1]];

// Directional evening light, night colour and strength, and the colour of the
// distant air. Deep canopy and enclosed arenas also hold some shade by day.
const palette = (dusk, night, haze, shade = 0, cover = 0) => ({ dusk, night, haze, shade, cover });
const DEFAULT_LIGHT = palette([255, 128, 64, 0.22], [42, 65, 152, 0], [212, 221, 238, 0]);
const REGION_LIGHT = {
  'Kampong Glam': palette([255, 173, 77, 0.25], [54, 61, 116, 0.42], [248, 223, 174, 0.18]),
  Chinatown: palette([245, 124, 113, 0.27], [99, 45, 96, 0.63], [245, 193, 174, 0.23]),
  'Marina Bay': palette([255, 168, 73, 0.32], [35, 87, 192, 0.77], [175, 211, 250, 0.34]),
  'Bukit Timah': palette([226, 199, 117, 0.16], [36, 92, 101, 0.61], [179, 209, 152, 0.4], 0.07),
  'Jurong Forest': palette([216, 209, 134, 0.16], [39, 73, 93, 0.61], [183, 197, 155, 0.34], 0.08),
  'Mandai Rainforest': palette([205, 195, 120, 0.14], [26, 83, 75, 0.75], [141, 195, 166, 0.54], 0.16),
  'MacRitchie Reservoir': palette([233, 198, 160, 0.17], [44, 100, 155, 0.56], [190, 222, 227, 0.45]),
  'Sungei Buloh Wetlands': palette([223, 205, 155, 0.13], [39, 110, 118, 0.63], [159, 212, 193, 0.53], 0.05),
  'Coney Island': palette([249, 200, 136, 0.18], [37, 94, 129, 0.5], [166, 211, 195, 0.32]),
  'Pulau Ubin': palette([250, 192, 109, 0.19], [57, 92, 118, 0.46], [218, 215, 166, 0.29]),
  'Sentosa Beach': palette([255, 180, 102, 0.25], [51, 108, 175, 0.55], [249, 226, 174, 0.19]),
  'Changi Coast': palette([249, 194, 165, 0.18], [37, 99, 157, 0.61], [178, 218, 232, 0.44]),
  'Southern Islands': palette([237, 188, 183, 0.18], [34, 105, 167, 0.72], [163, 211, 229, 0.39]),
  'Gardens by the Bay': palette([239, 158, 205, 0.19], [92, 74, 171, 0.68], [205, 191, 236, 0.32]),
  'Punggol Waterway': palette([240, 177, 158, 0.18], [55, 101, 170, 0.54], [190, 219, 237, 0.37]),
  'Kranji Farmlands': palette([253, 196, 106, 0.22], [71, 81, 126, 0.44], [231, 224, 174, 0.28]),
  'Transit Road, Nee Soon Camp': palette([255, 170, 101, 0.23], [43, 71, 144, 0.52], [174, 202, 207, 0.31]),
  'Tuas Docklands': palette([216, 154, 149, 0.16], [45, 75, 113, 0.55], [171, 187, 204, 0.38], 0.04),
  'Temasek Ruins': palette([242, 166, 106, 0.21], [72, 83, 106, 0.56], [214, 182, 142, 0.35], 0.08),
  'Tekong Badlands': palette([249, 142, 84, 0.24], [110, 61, 74, 0.69], [218, 158, 117, 0.41], 0.12),
  'The Wilderness': palette([233, 133, 104, 0.19], [98, 59, 87, 0.65], [190, 150, 152, 0.39], 0.13),
  'Pulau Hantu': palette([195, 147, 205, 0.17], [77, 57, 144, 0.73], [185, 169, 225, 0.48], 0.19),
  'The Shadow Rift': palette([211, 105, 174, 0.22], [99, 39, 129, 0.82], [172, 125, 202, 0.54], 0.25),
  'The Celestial Peaks': palette([209, 183, 239, 0.15], [57, 100, 178, 0.68], [184, 208, 248, 0.47], 0.06),
  'The Endless Gate': palette([212, 164, 223, 0], [99, 66, 139, 0.88], [184, 152, 220, 0], 0.4, 1),
};
const COLOURS = ['dusk', 'night', 'haze'];
const makeLight = () => palette([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);

export function regionLightFor(name) {
  return Object.hasOwn(REGION_LIGHT, name) ? REGION_LIGHT[name] : DEFAULT_LIGHT;
}

/**
 * The region mood at tile (tx, ty), blended with the regions around it.
 * `zoneName(x, y)` names the region at a tile; `mood(name)` gives its
 * [r, g, b, a] (moodFor, or the game's choice-shaded worldMood). Colours are
 * mixed weighted by their strength, so a faint region next to a strong one
 * doesn't wash it out. Writes into `out`.
 */
export function blendedMood(zoneName, mood, tx, ty, out = [0, 0, 0, 0], reach = BLEND_TILES, light = null) {
  let r = 0, g = 0, b = 0, a = 0, wsum = 0;
  if (light) {
    for (const key of COLOURS) light[key].fill(0);
    light.shade = light.cover = 0;
  }
  for (const [dx, dy, w] of SAMPLES) {
    const name = zoneName(tx + dx * reach, ty + dy * reach);
    const m = mood(name) || moodFor('');
    const wa = w * m[3];
    r += m[0] * wa; g += m[1] * wa; b += m[2] * wa; a += wa; wsum += w;
    if (light) {
      const from = regionLightFor(name);
      for (const key of COLOURS) for (let i = 0; i < 4; i++) light[key][i] += from[key][i] * w;
      light.shade += from.shade * w;
      light.cover += from.cover * w;
    }
  }
  if (a > 0) { out[0] = r / a; out[1] = g / a; out[2] = b / a; } else { out[0] = out[1] = out[2] = 0; }
  out[3] = wsum ? a / wsum : 0;
  if (light) {
    for (const key of COLOURS) for (let i = 0; i < 4; i++) light[key][i] /= wsum;
    light.shade /= wsum;
    light.cover /= wsum;
  }
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
    this._at = '';          // the tile and region the palette was last sampled at
    this._world = null;
    this._targetLight = makeLight();
    this.mood = moodFor('').slice();
    this.light = makeLight();
    this._started = false;
    this._tg = timeGrade(0.5);
    this._crisp = [0, 0, 0, 0];
    this._pools = new Map();   // light-pool sprites by colour
  }

  /** The blended region mood around the player, re-sampled only on a new tile. */
  regionMood(game, moodOf) {
    const p = game.player, w = game.world;
    const zone = game.currentZoneName;
    const key = `${p?.x},${p?.y},${zone}`;
    if (key !== this._at || w !== this._world) {
      this._at = key; this._world = w;
      const style = regionLightFor(zone);
      if (p && w?.zoneAt && !style.cover) {
        blendedMood((x, y) => w.zoneAt(x, y)?.name || zone, moodOf, p.x, p.y, this._mood, BLEND_TILES, this._targetLight);
      } else {
        // A sealed arena, including its perimeter, has one indoor palette.
        const mood = moodOf(zone);
        for (let i = 0; i < 4; i++) this._mood[i] = mood[i];
        for (const k of COLOURS) for (let i = 0; i < 4; i++) this._targetLight[k][i] = style[k][i];
        this._targetLight.shade = style.shade; this._targetLight.cover = style.cover;
      }
    }
    return this._mood;
  }

  /** Keep the washes, light map and distant air on the same easing curve. */
  update(game, moodOf, dt) {
    const targetMood = this.regionMood(game, moodOf), from = this._targetLight, light = this.light;
    const k = this._started ? 1 - Math.exp(-Math.max(0, dt) / MOOD_BLEND_MS) : 1;
    this._started = true;
    for (let i = 0; i < 4; i++) this.mood[i] += (targetMood[i] - this.mood[i]) * k;
    for (const key of COLOURS) for (let i = 0; i < 4; i++) light[key][i] += (from[key][i] - light[key][i]) * k;
    light.shade += (from.shade - light.shade) * k;
    light.cover += (from.cover - light.cover) * k;
    return light;
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
    out[3] = mood[3] * (1 - CRISP_CLEAR * tg.crisp * (1 - this.light.cover));
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
