import { isDepthShop } from './streetdepth.js';
import { TILE } from '../config.js';

// Atmosphere for the renderer: each region's colour mood (blended as you
// travel and folded into the day/night wash, so the whole grade is ONE
// full-screen fill a frame), a cached edge vignette, and the small ways world
// objects react to you (bushes sway as you brush past, tall things you walk
// behind turn see-through). Pure maths where it can be, so it is testable
// without a canvas.

// Region moods [r, g, b, alpha]: warm gold in the towns, green in the jungles,
// cool blue-green on the coasts and mangroves, pale mist on the reservoirs,
// red-tinged and ominous in the lawless lands. Kept faint: a grade, not a filter.
export const ZONE_MOOD = {
  'Kampong Glam': [255, 206, 130, 0.07],
  Chinatown: [255, 186, 140, 0.07],
  'Marina Bay': [150, 178, 238, 0.08],   // cool glass and water, lit warm and neon by night
  'Bukit Timah': [150, 214, 130, 0.08],   // a humid green haze
  'Jurong Forest': [130, 204, 140, 0.07],
  'Mandai Rainforest': [110, 196, 132, 0.09],
  'MacRitchie Reservoir': [214, 232, 246, 0.1],
  'Punggol Waterway': [196, 226, 240, 0.08],
  'Sungei Buloh Wetlands': [130, 206, 196, 0.08],
  'Sentosa Beach': [255, 220, 150, 0.07],   // sunny and warm
  'Changi Coast': [150, 214, 230, 0.06],
  'Southern Islands': [140, 210, 238, 0.07],
  'Pulau Ubin': [214, 228, 150, 0.06],
  'Coney Island': [186, 226, 166, 0.06],
  'Gardens by the Bay': [196, 236, 206, 0.05],
  'Kranji Farmlands': [238, 220, 140, 0.06],
  'Transit Road, Nee Soon Camp': [228, 224, 164, 0.07],
  'Tuas Docklands': [166, 178, 200, 0.08],
  'Temasek Ruins': [218, 186, 146, 0.08],
  'The Celestial Peaks': [212, 212, 250, 0.08],
  'The Wilderness': [196, 84, 76, 0.13],
  'Pulau Hantu': [150, 125, 200, 0.14],
  'Tekong Badlands': [190, 96, 86, 0.12],
  'The Shadow Rift': [110, 70, 140, 0.18],
  Singapore: [255, 236, 214, 0],
};
export const MOOD_BLEND_MS = 330;   // time constant: ~95% of the way across in a second

/** The mood for a region (unknown regions get none). */
export function moodFor(zoneName) {
  return ZONE_MOOD[zoneName] || ZONE_MOOD.Singapore;
}

/** Ease `cur` (a mood, changed in place) toward `target` over dt ms, the same
 *  at any frame rate. */
export function blendMood(cur, target, dt) {
  const k = 1 - Math.exp(-Math.max(0, dt) / MOOD_BLEND_MS);
  for (let i = 0; i < 4; i++) cur[i] += (target[i] - cur[i]) * k;
  return cur;
}

/**
 * Fold several translucent colour washes, painted one over another, into a
 * single wash that looks exactly the same: one full-screen fill instead of
 * several. Each wash is [r, g, b, a]; writes the result into `out`.
 */
export function composeWashes(washes, out = [0, 0, 0, 0]) {
  let keep = 1, r = 0, g = 0, b = 0;   // keep: how much of the scene survives
  for (const w of washes) {
    const a = w[3];
    if (!(a > 0)) continue;
    r = r * (1 - a) + w[0] * a; g = g * (1 - a) + w[1] * a; b = b * (1 - a) + w[2] * a;
    keep *= 1 - a;
  }
  const A = 1 - keep;
  out[0] = A > 0 ? r / A : 0; out[1] = A > 0 ? g / A : 0; out[2] = A > 0 ? b / A : 0; out[3] = A;
  return out;
}

/** The day/night washes for a darkness level (0 noon .. 1 midnight): a peach
 *  dusk glow that peaks with the sun on the horizon, and a cool blue night
 *  (low graphics' only night; a lavender one greyed the white sticker rims). */
export function dayNightWashes(night, out = [[255, 170, 160, 0], [60, 84, 172, 0]]) {
  const day = 1 - night;
  const duskiness = 4 * day * night;
  out[0][3] = duskiness > 0.02 ? duskiness * 0.12 : 0;
  out[1][3] = night > 0.05 ? Math.min(0.26, night * night * 0.32) : 0;
  return out;
}

/** A soft edge vignette baked once to a small canvas (it is all smooth
 *  gradient, so a little one stretched to the screen looks the same and costs
 *  one cheap image draw a frame). Null without a DOM. */
export function buildVignette(vw, vh) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const w = 160, h = Math.max(40, Math.round(160 * vh / Math.max(1, vw)));
  let cv, g;
  try { cv = document.createElement('canvas'); cv.width = w; cv.height = h; g = cv.getContext('2d'); } catch { return null; }
  if (!g) return null;
  const edge = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.72);
  edge.addColorStop(0, 'rgba(40,46,90,0)');
  edge.addColorStop(0.6, 'rgba(40,46,90,0.08)');
  edge.addColorStop(1, 'rgba(34,40,84,0.3)');
  g.fillStyle = edge; g.fillRect(0, 0, w, h);
  return cv;
}

/** The vignette's small canvas height for a vw x vh view (buildVignette): it
 *  depends on the view's shape only, so a fight's zoom doesn't remake it. */
export const vignetteKey = (vw, vh) => Math.max(40, Math.round(160 * vh / Math.max(1, vw)));

/**
 * A soft full-screen picture (the edge vignette, the hit pulse, the hurt
 * flash) drawn from a copy at the screen's own pixels. Stretching a small
 * picture over the whole screen, or filling it with a radial gradient, costs
 * a phone several milliseconds a frame (every pixel is worked out afresh);
 * copying a picture already the screen's size, pixel for pixel, is a fraction
 * of that. The copy is painted by `paint(g, W, H)` (W x H device pixels, the
 * same spot `vw` x `vh` covers through the current transform) and made again
 * only when `key` or the screen's size changes: a fight's zoom leaves the
 * screen's pixels alone (the view shrinks as the scale grows), so it doesn't.
 * Sizes within 1/64 of a pixel count as the same. Kept in `slot`.
 *
 * Returns false (draw as before) without a canvas, or when the transform
 * turns, skews or shifts the screen (only a plain scale maps it pixel for pixel).
 */
export function drawScreenPic(ctx, slot, key, vw, vh, paint, make = makeCanvas) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  if (!m || m.b || m.c || m.e || m.f || !(m.a > 0) || !(m.d > 0)) return false;
  const W = vw * m.a, H = vh * m.d;
  const k = `${key}|${Math.round(W * 64)}x${Math.round(H * 64)}`;
  if (slot.key !== k) {
    const cv = slot.cv || make();
    const g = cv && cv.getContext && cv.getContext('2d');
    if (!g) return false;
    const w = Math.ceil(W), h = Math.ceil(H);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    paint(g, W, H);
    slot.cv = cv; slot.key = k;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(slot.cv, 0, 0);
  ctx.setTransform(m.a, 0, 0, m.d, 0, 0);
  return true;
}
function makeCanvas() {
  if (typeof document === 'undefined' || !document.createElement) return null;
  try { return document.createElement('canvas'); } catch { return null; }
}

// ---------------- Object reactions ----------------
// Tall things that can hide you when you walk behind them, with roughly how
// far their picture reaches above and to each side of the tile centre.
const TALL = { tree: [62, 30], bank: [42, 28], transport: [38, 33], stall: [38, 28], shrine: [44, 27],
  offering: [44, 27], rest: [42, 24], furnace: [38, 25], range: [34, 25] };
const TALL_SCENERY = { palm: [54, 25], ruin: [32, 22], wall: [24, 20] };
const BRUSHY = new Set(['bush', 'flower']);   // what sways as you push through it
export const SEE_THROUGH_ALPHA = 0.45;
const FADE_RATE = 0.008;      // per ms: ~0.15s to fade either way
const BRUSH_MS = 650;         // how long a brushed bush keeps swaying

/** Is a point (the player's centre, world px) hidden behind this object's picture? */
export function hidesPoint(o, px, py) {
  const t = o.def.type;
  if (t === 'tree' && o.depleted) return false;   // a stump hides nothing
  if (o.def.footprint) {
    // A landmark: behind its footprint, under a picture about as tall as it is drawn wide.
    const [w, d] = o.def.footprint, back = (o.y + 1 - d) * TILE, tall = w * TILE * (o.def.artScale || 1.1) * 1.05;
    return py < back + 4 && py + 12 > (o.y + 1) * TILE - tall && Math.abs(px - (o.x + w / 2) * TILE) < w * TILE / 2;
  }
  const box = TALL[t] || (t === 'scenery' && TALL_SCENERY[o.objId]);
  if (!box) return false;
  const cx = o.x * TILE + TILE / 2, cy = o.y * TILE + TILE / 2;
  // Behind (north of) the base, within the picture's height and width.
  return py < cy - 4 && py + 12 > cy - box[0] && Math.abs(px - cx) < box[1];
}

/** Keeps the few objects near the player that are fading or swaying. */
export class ObjectReactions {
  constructor() {
    this.fade = new Map();    // object -> current alpha (only while below 1)
    this.brush = new Map();   // object -> ms of sway left
    this._near = new Set();   // reused each frame
  }

  /** Per frame: look at the few tiles around the player only. */
  update(game, dt) {
    const p = game.player, w = game.world;
    const c = p.renderCenter();
    const near = this._near;
    near.clear();
    if (p.alive) {
      const tx = Math.floor(c.x / TILE), ty = Math.floor(c.y / TILE);
      for (let y = ty - 1; y <= ty + 3; y++) for (let x = tx - 1; x <= tx + 1; x++) {
        const o = w.objectAt(x, y);
        if (!o) continue;
        if (hidesPoint(o, c.x, c.y)) { near.add(o); if (!this.fade.has(o)) this.fade.set(o, 1); }
        else if (BRUSHY.has(o.objId) && p.moving && Math.abs(o.x - p.x) <= 1 && Math.abs(o.y - p.y) <= 1 && !(this.brush.get(o) > BRUSH_MS * 0.6)) {
          this.brush.set(o, BRUSH_MS);
        }
      }
    }
    if (p.alive && c.x > 41 * TILE && c.x < 79 * TILE && c.y > 52 * TILE && c.y < 87 * TILE) {
      for (const o of w.landmarks || []) {
        if (!isDepthShop(o) || !hidesPoint(o, c.x, c.y)) continue;
        near.add(o);
        if (!this.fade.has(o)) this.fade.set(o, 1);
      }
    }
    for (const [o, a] of this.fade) {
      const target = near.has(o) ? SEE_THROUGH_ALPHA : 1;
      const na = target < a ? Math.max(target, a - FADE_RATE * dt) : Math.min(target, a + FADE_RATE * dt);
      if (na >= 1) this.fade.delete(o); else this.fade.set(o, na);
    }
    for (const [o, ms] of this.brush) {
      if (ms - dt <= 0) this.brush.delete(o); else this.brush.set(o, ms - dt);
    }
  }

  /** The object's opacity this frame (1 unless you're behind it). */
  alpha(o) { return this.fade.get(o) ?? 1; }

  /** The object's sideways lean this frame (0 unless brushed): a damped wobble. */
  skew(o, timeMs) {
    const ms = this.brush.get(o);
    if (!ms) return 0;
    const k = ms / BRUSH_MS;
    return Math.sin(timeMs * 0.022 + o.x) * 0.28 * k * k;
  }
}
