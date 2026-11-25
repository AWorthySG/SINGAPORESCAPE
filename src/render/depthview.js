import { TILE } from '../config.js';
import { DEPTH_TILT, relV, rowScaleRel } from './projection.js';
import { worldArtBox, worldArtMax, SHADOW_RGB } from './sprites.js';
import { clamp01, smooth } from './motionkit.js';

// The depth view (Settings > Depth view, on by default): the flat world seen
// by a camera leaning back a little, using the same 2D sticker art.
//
//  - The ground (terrain, water, decals, puddles, cast shadows) is drawn flat
//    into one offscreen canvas a little bigger than the screen, then copied to
//    the screen in thin rows, each at its own scale (warp): far rows smaller,
//    near rows larger. One extra full-screen copy a frame.
//  - Sprites, labels and effects are drawn straight to the screen, each at its
//    row's scale about its feet (projection.js applyRow), so they stay upright.
//  - Trees, buildings and landmarks cast a soft copy of their outline across
//    the ground, long and slanting in the morning and evening, short at noon.
//  - The far edge fades into a light haze in the sky's colour, with a few
//    soft wisps drifting slower than the ground (a parallax layer).
//
// Low graphics, headless runs and the setting turned off keep the flat view
// (tilt 0), which is exactly the old renderer. Reduce motion keeps the tilt
// still: no lean-in during fights, no easing, no drifting wisps.

const EASE_MS = 260;       // the tilt eases in and out over about this long
const LEAN_K = 2.5;        // a fight's camera push-in (zoomMul 1.06) leans the tilt a touch further
const LEAN_MAX = 0.18;
const STRIP_JUMP = 1.8;    // device px: the most a vertical line may step between two warp rows
const STRIP_MIN = 3, STRIP_MAX = 24;   // device px per warp row
// The ground canvas's resolution against the screen's. Its far rows are drawn
// smaller than flat anyway; the soft painted ground loses little, and the
// canvas (a fifth again bigger than the screen) costs no more to paint than flat.
const GROUND_RES = 0.85, GROUND_RES_TRIM = 0.7;   // (the second while frames run slow, governor.js)
const HAZE_TOP = 0.34;     // the haze reaches this far down the screen
const SHADOW_MIN_H = 40;   // world px: shorter pictures (flowers, bushes, rocks) keep their contact shadow only
const SIL_MAX = 112;       // px: outlines are baked at most this tall (they are soft anyway)
const SIL_PAD = 4;         // px of blur margin round a baked outline
const ART_AHEAD = 12 * TILE;   // world px: a landmark's picture is asked for this far ahead of its shadow reaching the screen

/** The tilt the view should have now: 0 (flat) when the setting is off, in
 *  low graphics or without a screen to draw on; else the default, leaning in
 *  a touch while the camera pushes in for a fight (not with Reduce motion). */
export function depthTarget(game, cam = game?.camera, canDraw = typeof document !== 'undefined') {
  if (!game || !canDraw || game.depthView === false || game.lowFx || game.depthPaused) return 0;
  if (game.reduceMotion) return DEPTH_TILT;
  const lean = Math.max(0, Math.min(LEAN_MAX, ((cam?.zoomMul || 1) - 1) * LEAN_K));
  return DEPTH_TILT * (1 + lean);
}

/** A device whose frames keep running slow (the governor's trim, governor.js)
 *  for GIVE_UP_MS on end while tilted gets the flat view back for this visit:
 *  sets game.depthPaused and says so once. Settings > Depth view clears it. */
export const GIVE_UP_MS = 8000;
export function slowGiveUp(game, st, tilted, dt) {
  // Only while you play: the title screen's loading runs slow on any phone (its clock, playMs, stands still).
  const playing = game.playMs !== st.play;
  st.play = game.playMs;
  if (!playing) return false;
  st.ms = tilted && game.fxTrim ? (st.ms || 0) + dt : 0;
  if (st.ms < GIVE_UP_MS || game.depthPaused) return false;
  game.depthPaused = true;
  game.msg?.('Depth view is off for now: this device is running slow. Settings > Depth view turns it back on.', 'system');
  return true;
}

/** Ease the tilt toward `target` over `dt` ms; Reduce motion snaps it. */
export function easeTilt(cur, target, dt, calm = false) {
  if (calm || !(dt > 0)) return target;
  const k = 1 - Math.exp(-dt / EASE_MS);
  const t = cur + (target - cur) * k;
  return Math.abs(t - target) < 0.002 ? target : t;
}

/**
 * Which way and how far a standing thing's shadow falls at a day phase
 * (0..1 from midnight; sunrise near 0.25, noon 0.5, sunset near 0.75), per
 * world px of its height, on the flat ground: `kx` across (west, -x, in the
 * morning; east by evening), `ky` up the screen (negative: the sun sits to
 * the south), `alpha` how dark. Night has no cast shadow (`on` false): the
 * moon leaves only the soft contact shadows.
 */
export function shadowVec(phase, out = {}) {
  const a = (phase - 0.25) * 2 * Math.PI;   // 0 at sunrise, pi/2 at noon, pi at sunset
  const elev = Math.sin(a);
  const day = smooth((elev + 0.04) / 0.22);
  const low = 1 - clamp01(elev);
  const len = 0.28 + 0.9 * low * low;       // short with the sun high, long near the horizon
  out.on = day > 0.02;
  out.kx = -Math.cos(a) * len;              // away from the sun as it crosses from east to west
  out.ky = -0.5 * len;                      // ...and up the screen, away from the southern sun
  out.len = len;
  out.alpha = 0.36 * day;
  return out;
}

/** The haze colour for a day phase, nudged toward the region's mood. */
const SKY = [
  [0.0, [64, 78, 128]], [0.22, [96, 104, 160]], [0.28, [255, 200, 176]], [0.36, [206, 226, 246]],
  [0.5, [214, 232, 250]], [0.64, [234, 230, 220]], [0.72, [255, 186, 150]], [0.78, [150, 128, 186]],
  [0.86, [72, 84, 136]], [1.0, [64, 78, 128]],
];
export function hazeColour(phase, mood = null, out = [0, 0, 0]) {
  let i = 0;
  while (i < SKY.length - 2 && phase > SKY[i + 1][0]) i++;
  const [p0, c0] = SKY[i], [p1, c1] = SKY[i + 1];
  const f = clamp01((phase - p0) / (p1 - p0));
  for (let j = 0; j < 3; j++) out[j] = c0[j] + (c1[j] - c0[j]) * f;
  if (mood && mood[3] > 0) for (let j = 0; j < 3; j++) out[j] += (mood[j] - out[j]) * Math.min(0.35, mood[3] * 2);
  return out;
}

export class DepthView {
  constructor() {
    this.ok = typeof document !== 'undefined' && !!document.createElement;
    this.buf = null; this.g = null;
    this._sil = new WeakMap();
    this._box = {};
    this._sv = {};
    this._hz = [0, 0, 0];
    this._hazePic = null; this._hazeKey = '';
    this._wisp = null;
    this.strips = 0;
    this.shadows = 0;
  }

  /** The offscreen ground canvas for this frame, sized to the projection's
   *  flat rectangle at GROUND_RES of `D` device px per world px; its context
   *  is returned scaled, cleared to `bg` and clipped to the part the screen
   *  shows (a trapezoid: the near rows are narrower). Null when it can't be made. */
  begin(pj, D, bg, trim = false) {
    if (!this.ok) return null;
    if (!this.buf) {
      try { this.buf = document.createElement('canvas'); this.g = this.buf.getContext('2d', { alpha: false }); } catch { this.g = null; }
      if (!this.g) { this.ok = false; return null; }
    }
    const G = this.G = D * (trim ? GROUND_RES_TRIM : GROUND_RES);
    const w = Math.ceil(pj.fw * G), h = Math.ceil(pj.fh * G);
    if (this.buf.width !== w || this.buf.height !== h) { this.buf.width = w; this.buf.height = h; }
    const g = this.g;
    if (this._clip) { g.restore(); this._clip = false; }   // (a frame that failed mid-ground)
    g.setTransform(G, 0, 0, G, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // Nothing outside the trapezoid is ever copied to the screen: don't paint it.
    const hb = pj.scx / pj.sBot + 4;
    g.save(); this._clip = true;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(pj.fw, 0); g.lineTo(pj.fcx + hb, pj.fh); g.lineTo(pj.fcx - hb, pj.fh); g.closePath(); g.clip();
    g.fillStyle = bg; g.fillRect(0, 0, pj.fw, pj.fh);
    return g;
  }

  /**
   * Copy the ground canvas onto the screen through the projection: one thin
   * row at a time, each scaled to its distance. Rows are whole device pixels
   * (so no seams), and thin enough that a vertical edge steps by less than
   * STRIP_JUMP device px from one to the next.
   */
  warp(ctx, pj, D, W, H) {
    const buf = this.buf, G = this.G || D;
    if (!buf) return;
    if (this._clip) { this.g.restore(); this._clip = false; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bw = buf.width, bh = buf.height;
    // From the projection: a vertical line at the screen's edge moves
    // (vw/2)(k/c)/s device px per device px of row, so rows are kept to
    // STRIP_JUMP over that (thinner for the nearer, bigger rows).
    const edge = pj.scx * pj.k / pj.c;
    let n = 0;
    for (let y0 = 0; y0 < H;) {
      const va = relV(pj, y0 / D);
      const sa = rowScaleRel(pj, va);
      const step = edge > 0 ? Math.max(STRIP_MIN, Math.min(STRIP_MAX, Math.floor(STRIP_JUMP * sa / edge))) : H;
      const y1 = Math.min(H, y0 + step);
      const vb = relV(pj, y1 / D), s = rowScaleRel(pj, relV(pj, (y0 + y1) / 2 / D));
      const hw = pj.scx / s;
      let sx = (pj.fcx - hw) * G, sw = 2 * hw * G;
      let sy = (pj.fcy + va) * G, sh = (vb - va) * G;
      // Keep the source inside the canvas (Safari draws nothing otherwise).
      if (sx < 0) { sw += sx; sx = 0; }
      if (sx + sw > bw) sw = bw - sx;
      if (sy < 0) { sh += sy; sy = 0; }
      if (sy + sh > bh) sh = bh - sy;
      if (sw > 0 && sh > 0) ctx.drawImage(buf, sx, sy, sw, sh, 0, y0, W, y1 - y0);
      y0 = y1; n++;
    }
    this.strips = n;
  }

  /** A navy outline of a picture, soft-edged, baked once per picture. */
  _silhouette(img) {
    let s = this._sil.get(img);
    if (s !== undefined) return s;
    s = null;
    try {
      const r = Math.min(1, SIL_MAX / img.naturalHeight), w = Math.max(2, Math.round(img.naturalWidth * r)), h = Math.max(2, Math.round(img.naturalHeight * r));
      const pad = SIL_PAD;
      const a = document.createElement('canvas'); a.width = w; a.height = h;
      const ga = a.getContext('2d');
      ga.drawImage(img, 0, 0, w, h);
      ga.globalCompositeOperation = 'source-in';
      ga.fillStyle = `rgb(${SHADOW_RGB})`; ga.fillRect(0, 0, w, h);
      const b = document.createElement('canvas'); b.width = w + pad * 2; b.height = h + pad * 2;
      const gb = b.getContext('2d');
      if ('filter' in gb) gb.filter = 'blur(1.6px)';
      gb.drawImage(a, pad, pad);
      s = { cv: b };
    } catch { s = null; }
    this._sil.set(img, s);
    return s;
  }

  /**
   * Cast shadows of the trees, buildings and landmarks in view onto the flat
   * ground canvas `g` (world px, origin ox, oy), for the sun at `phase`: each a
   * soft navy copy of its outline, laid down from its base along the sun's
   * line and sheared with it. Short and tucked behind at noon, long and
   * slanting at morning and evening, none at night.
   */
  castShadows(g, objs, landmarks, ox, oy, vw, vh, phase, time, D) {
    this.shadows = 0;
    const sv = shadowVec(phase, this._sv);
    if (!sv.on || !this.ok) return;
    const box = this._box;
    g.globalAlpha = sv.alpha;
    // (bx, by): the middle of the picture's base, less `sink` px (its foot).
    const one = (o, bx, by, sink) => {
      // Every landmark on the island comes through here: one whose shadow
      // couldn't come near the screen even at its largest is passed over
      // before its picture is asked for (else they all load at start-up).
      // Those a short walk away are still asked for, so none pops in.
      const m = worldArtMax(o, time);
      if (!m) return;
      const far = m[1] * sv.len + m[0] + ART_AHEAD, fy = by + m[2] - sink;
      if (bx < -far || bx > vw + far || fy < -far || fy > vh + m[1] + far) return;
      const b = worldArtBox(o, time, box);
      if (!b || b.h < SHADOW_MIN_H) return;
      by += b.foot - sink;
      const reach = b.h * sv.len + b.w;
      if (bx < -reach || bx > vw + reach || by < -reach || by > vh + b.h + reach) return;
      const sil = this._silhouette(b.img);
      if (!sil) return;
      // Picture space: x across from the base's middle, y up (negative) from the base.
      // On the ground: x' = x - kx y, y' = -ky y (ky < 0 lays it up the screen).
      g.setTransform(D, 0, -sv.kx * D, -sv.ky * D, bx * D, by * D);   // (D: the ground canvas's px per world px)
      // The baked outline carries a blur margin: map its inner box onto the picture's.
      const pw = sil.cv.width, ph = sil.cv.height, ix = b.w / (pw - 2 * SIL_PAD), iy = b.h / (ph - 2 * SIL_PAD);
      g.drawImage(sil.cv, -b.w / 2 - SIL_PAD * ix, -b.h - SIL_PAD * iy, pw * ix, ph * iy);
      this.shadows++;
    };
    for (const o of objs) {
      if (o.def.footprint || o.def.overhead || o.depleted) continue;
      const t = o.def.type;
      if (t === 'fishing' || t === 'fire' || t === 'farm') continue;
      one(o, o.x * TILE + TILE / 2 - ox, o.y * TILE + TILE / 2 - oy, 2);
    }
    for (const o of landmarks || []) {
      const fw = o.def.footprint[0];
      one(o, o.x * TILE + fw * TILE / 2 - ox, o.y * TILE + TILE / 2 - oy, 3);
    }
    g.setTransform(D, 0, 0, D, 0, 0);
    g.globalAlpha = 1;
  }

  /**
   * The far edge's haze: a soft band in the sky's colour at the top of the
   * screen (vw x vh, world px), strongest at the very top, and a few pale
   * wisps in it drifting slower than the ground below (parallax with the
   * camera's centre camX). `calm` (Reduce motion) stops their own drift.
   */
  haze(ctx, pj, phase, mood, camX, time, calm, trim) {
    const tilt = pj.tilt;
    if (!(tilt > 0.01)) return;
    const col = hazeColour(phase, mood, this._hz);
    const night = phase < 0.24 || phase > 0.8;
    const a = (night ? 0.34 : 0.58) * Math.min(1, tilt);
    const band = pj.vh * HAZE_TOP;
    // One gradient fill (made again only when its colour or size moves on).
    const key = `${col[0] >> 3},${col[1] >> 3},${col[2] >> 3},${Math.round(a * 40)},${band | 0}`;
    if (key !== this._hazeKey) { this._hazeKey = key; this._hazePic = this._hazeFill(ctx, col, a, band); }
    if (this._hazePic) { ctx.fillStyle = this._hazePic; ctx.fillRect(0, 0, pj.vw, band); }
    if (trim) return;
    const wisp = this._wisp || (this._wisp = this._bakeWisp());
    if (!wisp) return;
    // Wisps sit in the top of the band, moving at 40% of the ground's pace.
    const span = pj.vw + 240, drift = calm ? 0 : time * 0.004;
    ctx.globalAlpha = night ? 0.1 : 0.22;
    for (let i = 0; i < 4; i++) {
      const w = 150 + 40 * (i % 2), h = 26 + 8 * (i % 3);
      const x = ((((i * 0.31 + 0.07) * span - camX * 0.4 + drift * (1 + i * 0.3)) % span) + span) % span - 120;
      const y = band * (0.12 + 0.14 * (i % 3));
      ctx.drawImage(wisp, x - w / 2, y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  _hazeFill(ctx, col, a, band) {
    if (!ctx.createLinearGradient) return null;
    const gr = ctx.createLinearGradient(0, 0, 0, band);
    const c = `${col[0] | 0},${col[1] | 0},${col[2] | 0}`;
    gr.addColorStop(0, `rgba(${c},${a.toFixed(3)})`);
    gr.addColorStop(0.35, `rgba(${c},${(a * 0.5).toFixed(3)})`);
    gr.addColorStop(1, `rgba(${c},0)`);
    return gr;
  }

  _bakeWisp() {
    try {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
      const g = cv.getContext('2d');
      g.setTransform(4, 0, 0, 1, 64, 16);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(-16, -16, 32, 32);
      return cv;
    } catch { return null; }
  }
}
