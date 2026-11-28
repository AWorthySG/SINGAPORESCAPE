// A common colour finish and soft rim light for the painted hero.
//
// At play size a dark hero (the Rogue's teal hood, a Ninja's navy) is about the
// colour of its own ink outline, so after dark it reads as one dark blob on
// the ground. Each hero picture gets a thin band of cool light just inside the
// ink, brightest on the side the moon is (up and to the left), and a faint fill
// over its dark colours. It is laid on with 'screen', which lifts dark colours
// and leaves light ones almost as they were: plain to see on the Rogue, barely
// there on the Paladin. The ink itself (the very darkest colours) is left
// alone, so the outline stays crisp.
//
// Baked once a picture (a couple of milliseconds, a few a frame at most) into a
// cached canvas; every frame after just draws that. Headless (no DOM) the
// pictures are drawn as they are.

const RIM = [206, 226, 255];      // a cool moonlit white
export const RIM_K = 0.45;        // how strongly the rim is screened on at its brightest
export const FILL_K = 0.08;       // ...and the fill over the dark colours
const LIGHT = [-0.5, -0.866];     // where the light comes from: up and a little left
const INK_LUM = [0.045, 0.13];    // luminance below the first is ink (no rim); full rim above the second
const NAVY_INK = [0.15, 0.2];     // ...and for the navy ink (#22304A and the painted navy line) the same, a little lighter
const MAX_BAKES = 1;              // pictures baked a frame at most, so a new class never hitches

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Match the outline and highlight colours across the original painted parts. */
export function gradeHeroPaint(px) {
  for (let o = 0; o < px.length; o += 4) {
    const r = px[o], g = px[o + 1], b = px[o + 2], alpha = px[o + 3];
    const low = Math.min(r, g, b);
    if (alpha === 0 || low > 232) continue;   // clear pixels and the white sticker border
    const range = Math.max(r, g, b) - low;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const edge = Math.min(1, alpha / 128);
    // Give neutral strokes navy ink without recolouring shadow hues. Fade the
    // warm side of the grade into white so painted highlights retain their detail.
    const ink = (1 - smooth(19, 67, luma)) * (1 - smooth(13, 44, range)) * edge;
    const warmth = smooth(132, 224, luma) * (1 - smooth(62, 143, range)) * (1 - smooth(218, 232, low)) * edge;
    const temper = 0.1 * smooth(74, 170, range) * edge;
    px[o] = r + (luma - r) * temper - 5 * ink + 4 * warmth;
    px[o + 1] = g + (luma - g) * temper + 3 * ink;
    px[o + 2] = b + (luma - b) * temper + 14 * ink - 5 * warmth;
  }
  return px;
}

/**
 * Lay the rim and fill onto RGBA pixels `px` (w x h), in place. Pure, so the
 * tests can run it without a canvas. White sticker border pixels count as
 * outside the figure, so the rim sits inside the ink outline, not on it.
 */
export function rimLight(px, w, h) {
  // Distance (a 3-4 chamfer, so 3 a pixel) from the outside of the figure, on
  // a grid with a clear one-pixel margin so no lookup needs a bounds check.
  const W = w + 2, H = h + 2, INF = 1 << 28;
  const d = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  let top = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y + 1) * W + x + 1;
    if (px[(y * w + x) * 4 + 3] < 128) stack[top++] = j; else d[j] = INF;
  }
  // Outside is the clear background and the white sticker border joined to
  // it (a flood in from the clear pixels), not white eyes or teeth inside.
  while (top) {
    const j = stack[--top];
    for (let k = 0; k < 4; k++) {
      const q = k === 0 ? j - 1 : k === 1 ? j + 1 : k === 2 ? j - W : j + W;
      if (!d[q]) continue;
      const o = ((((q / W) | 0) - 1) * w + (q % W) - 1) * 4;
      if (px[o] > 232 && px[o + 1] > 232 && px[o + 2] > 232) { d[q] = 0; stack[top++] = q; }
    }
  }
  for (let y = 1; y <= h; y++) for (let j = y * W + 1, e = j + w; j < e; j++) {
    if (d[j]) d[j] = Math.min(d[j], d[j - 1] + 3, d[j - W] + 3, d[j - W - 1] + 4, d[j - W + 1] + 4);
  }
  for (let y = h; y >= 1; y--) for (let j = y * W + w, e = y * W; j > e; j--) {
    if (d[j]) d[j] = Math.min(d[j], d[j + 1] + 3, d[j + W] + 3, d[j + W + 1] + 4, d[j + W - 1] + 4);
  }
  // The band's width follows the picture's size (the art is drawn at a few
  // sizes), so it comes out about the same on screen: a pixel or two.
  const band = Math.max(5, Math.round(Math.max(w, h) * 0.05)) * 3, reach = band * 1.6;
  const r0 = RIM[0] / 255, r1 = RIM[1] / 255, r2 = RIM[2] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y + 1) * W + x + 1, di = d[j];
    if (!di) continue;
    const o = (y * w + x) * 4;
    const r = px[o] / 255, g = px[o + 1] / 255, b = px[o + 2] / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // The ink (the very darkest colours) and the light colours are left alone.
    // The navy ink is lighter than black, so a dark, blue-led colour up to its
    // lightness counts as ink too (a navy or teal cloth is lighter still, and lit).
    const notInk = smooth(INK_LUM[0], INK_LUM[1], lum) * (b - r > 0.04 ? smooth(NAVY_INK[0], NAVY_INK[1], lum) : 1), dim = smooth(0.95, 0.4, r > g ? (r > b ? r : b) : g > b ? g : b);
    if (notInk <= 0 || dim <= 0) continue;
    let k = FILL_K;
    if (di <= reach) {
      // Which way the edge faces: down the slope of the distance, outward.
      const nx = d[j - 1] - d[j + 1], ny = d[j - W] - d[j + W];
      const len = Math.sqrt(nx * nx + ny * ny) || 1;
      const face = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1]) / len);
      // In from the edge's soft (anti-aliased) pixels and the ink, then out over the band.
      const fall = smooth(6, 12, di) * (di <= band ? 1 : 1 - (di - band) / (band * 0.6));
      k += RIM_K * fall * (0.3 + 0.7 * face);
    }
    k = (k > 1 ? 1 : k) * notInk * dim;
    if (k <= 0.002) continue;
    // Screen: 1 - (1 - c)(1 - light), so dark colours lift and light ones barely move.
    px[o] = 255 - (255 - px[o]) * (1 - k * r0);
    px[o + 1] = 255 - (255 - px[o + 1]) * (1 - k * r1);
    px[o + 2] = 255 - (255 - px[o + 2]) * (1 - k * r2);
  }
  return px;
}

const _lit = new WeakMap();   // picture -> its lit copy (0 while it is being made, null if it can't be)
let _frameAt = -1, _baked = 0;

/** Bake the rim and colour finish into a canvas of `src` (`w` x `h`). */
export function bakeRim(src, w, h) {
  try {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    if (!g) return null;
    g.drawImage(src, 0, 0);
    const data = g.getImageData(0, 0, w, h);
    rimLight(data.data, w, h);
    gradeHeroPaint(data.data);
    g.putImageData(data, 0, 0);
    return cv;
  } catch { return null; }
}

/**
 * The hero picture `img` with its colour finish and rim light: the treated
 * copy once it is ready, the picture itself until then (still loading, being
 * baked, or no DOM). The copy is turned back into an image, not left a
 * canvas: the browser shrinks images smoothly to the hero's small size but
 * canvases crudely, which made the outline sparkle.
 */
export function heroLit(img) {
  if (!img || typeof document === 'undefined') return img;
  const got = _lit.get(img);
  if (got !== undefined) return got || img;
  if (!img.complete || !img.naturalWidth) return img;
  const now = typeof performance !== 'undefined' ? Math.floor(performance.now() / 16) : 0;
  if (now !== _frameAt) { _frameAt = now; _baked = 0; }
  if (_baked >= MAX_BAKES) return img;
  _baked++;
  const cv = bakeRim(img, img.naturalWidth, img.naturalHeight);
  if (!cv || typeof cv.toBlob !== 'function' || typeof URL === 'undefined' || typeof Image === 'undefined') {
    _lit.set(img, cv);
    return cv || img;
  }
  _lit.set(img, 0);
  cv.toBlob((blob) => {
    if (!blob) { _lit.set(img, null); return; }
    const lit = new Image();
    lit.onload = () => _lit.set(img, lit);
    lit.onerror = () => _lit.set(img, null);
    lit.src = URL.createObjectURL(blob);
  });
  return img;
}
