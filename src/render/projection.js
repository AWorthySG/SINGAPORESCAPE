// The depth view's projection (Settings > Depth view): the one place that says
// where a point of the flat world lands on the screen once the camera is
// tilted, and back. The camera (taps, the hover tile, the Codex's monster
// picker), the renderer (ground, sprites, labels, lights) and the depth pass
// (depthview.js) all go through it, so what you see and what you tap agree.
//
// The ground is a plane seen by a camera leaning back: rows further up the
// screen are further away, so they are drawn smaller and closer together, and
// the top of the screen shows more of the world. As a formula, with (u, v) a
// point's offset from the camera's centre in world pixels:
//
//   s = 1 / (1 - k v)          how much bigger than flat that row is drawn
//   X = cx + u s               (cx: the middle of the screen)
//   Y = cy + c v s             (cy: where the camera's centre sits; c squashes the ground)
//
// That is a true perspective (a homography): straight lines stay straight and
// every row stays level. Sprites don't lie on the ground, they stand on it, so
// they are not squashed: each is drawn at its row's scale s about its feet
// (rowTransform), which keeps the sticker art upright and whole.
//
// Tilt 0 is the flat view exactly (k = 0, c = 1), and callers keep their old
// flat code for it. Everything here is pure: no DOM, no game.

/** The default tilt, and how each part of the look grows with it. */
export const DEPTH_TILT = 1;
const RECEDE = 0.3;     // k at tilt 1, per screen height: the top row is about 0.83x, the bottom about 1.13x
const SQUASH = 0.09;    // the ground is this much flatter than flat at tilt 1
const LOWER = 0.05;     // the camera's centre (you) sits this far below the middle of the screen at tilt 1
const MARGIN = 2;       // world px of ground drawn past the screen's edge, so the warp never samples outside it

/**
 * The projection for a screen of `vw` x `vh` world pixels (the camera's view)
 * at `tilt` (0 flat .. 1 the default), written into `out`. It also carries the
 * flat rectangle the tilted screen sees, offset from the flat view's top-left:
 * the renderer draws the world over that rectangle (fx0, fy0, fw, fh), and its
 * flat centre is (fcx, fcy) inside it.
 */
export function makeProjection(tilt, vw, vh, out = {}) {
  const t = Math.max(0, Math.min(1.5, tilt || 0));
  out.tilt = t;
  out.vw = vw; out.vh = vh;
  out.k = vh > 0 ? (RECEDE * t) / vh : 0;
  out.c = 1 - SQUASH * t;
  out.scx = vw / 2;
  out.scy = vh * (0.5 + LOWER * t);
  // The flat rows at the top and bottom of the screen, and the row widths there.
  const vTop = relV(out, 0), vBot = relV(out, vh);
  const sTop = 1 / (1 - out.k * vTop);
  const hw = out.scx / sTop;   // the top row is the widest (it is the furthest away)
  const m = t > 0 ? MARGIN : 0;
  out.fx0 = vw / 2 - hw - m;
  out.fy0 = vh / 2 + vTop - m;
  out.fw = 2 * hw + 2 * m;
  out.fh = vBot - vTop + 2 * m;
  out.fcx = vw / 2 - out.fx0;
  out.fcy = vh / 2 - out.fy0;
  out.sTop = sTop;
  out.sBot = 1 / (1 - out.k * vBot);
  return out;
}

/** The flat row offset v (from the camera's centre) that lands on screen row Y. */
export function relV(pj, Y) {
  const dy = Y - pj.scy;
  return dy / (pj.c + pj.k * dy);
}

/** How much bigger than flat the flat row `v` (offset from the centre) is drawn. */
export function rowScaleRel(pj, v) {
  return 1 / Math.max(0.2, 1 - pj.k * v);
}

/** Screen point for a flat offset (u, v) from the camera's centre. */
export function projectRel(pj, u, v, out = {}) {
  const s = rowScaleRel(pj, v);
  out.x = pj.scx + u * s;
  out.y = pj.scy + pj.c * v * s;
  out.s = s;
  return out;
}

/** The flat offset (u, v) from the camera's centre under screen point (X, Y). */
export function unprojectRel(pj, X, Y, out = {}) {
  const v = relV(pj, Y), s = rowScaleRel(pj, v);
  out.u = (X - pj.scx) / s;
  out.v = v;
  out.s = s;
  return out;
}

/** Screen point for a world point, with the camera centred on (cx, cy). */
export function worldToScreen(pj, wx, wy, cx, cy, out = {}) {
  return projectRel(pj, wx - cx, wy - cy, out);
}

/** World point under a screen point, with the camera centred on (cx, cy). */
export function screenToWorld(pj, X, Y, cx, cy, out = {}) {
  const r = unprojectRel(pj, X, Y, out);
  out.x = cx + r.u;
  out.y = cy + r.v;
  return out;
}

/**
 * The drawing transform for things standing on flat row `fy` (in the
 * renderer's flat coordinates, whose centre is (fcx, fcy)): drawn at that
 * row's scale about the row, so a sprite's feet land on its spot of the tilted
 * ground and the sprite stays upright. `rise` stretches it up a touch more
 * (trees and buildings standing tall). Written into `out` as a matrix
 * a, d (scales) and e, f (offsets), in world px: x' = a x + e, y' = d y + f.
 */
export function rowTransform(pj, fy, rise = 0, out = {}) {
  const v = fy - pj.fcy, s = rowScaleRel(pj, v);
  const Y = pj.scy + pj.c * v * s, d = s * (1 + rise);
  out.a = s; out.d = d;
  out.e = pj.scx - s * pj.fcx;
  out.f = Y - d * fy;
  out.s = s;
  return out;
}

const _m = {};
/** Set `ctx` to draw at flat row `fy` (rowTransform), on top of the canvas's
 *  base scale `D` (device px per world px). No projection: nothing changes. */
export function applyRow(ctx, pj, fy, rise = 0) {
  if (!pj) return;
  const m = rowTransform(pj, fy, rise, _m), D = pj.D || 1;
  ctx.setTransform(D * m.a, 0, 0, D * m.d, D * m.e, D * m.f);
}

/** Back to drawing straight onto the screen (world px, no tilt). */
export function applyScreen(ctx, pj) {
  if (!pj) return;
  const D = pj.D || 1;
  ctx.setTransform(D, 0, 0, D, 0, 0);
}

/** A flat point (renderer coordinates) on the screen: { x, y, s }. */
export function projectFlat(pj, fx, fy, out = {}) {
  return projectRel(pj, fx - pj.fcx, fy - pj.fcy, out);
}
