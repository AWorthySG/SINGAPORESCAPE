// Clean the remaining backing once, before drawing or tinting the art.
const MATTED_ART = {
  'creatures/species/banded_leaf_monkey': {},
  'creatures/species/field_rat': { trim: true },
  'creatures/species/house_crow': { gaps: [[143, 207]], trim: true },
  'creatures/species/jenglot': {},
  'creatures/species/wild_hornet': {},
  'creatures/bosses/drowned_admiral': {},
  'creatures/bosses/kusu_tortoise': {},
  'world/stump-oak': { exterior: false, trim: true },
};
// Trapped white backing in gaps between branches, roots and fins.
const PAINT_GAPS = {
  'world/tree-angsana': [[106, 117]],
  'world/tree-bamboo': [[118, 94], [124, 67]],
  'world/tree-chengal_tree': [[108, 97]],
  'world/tree-mangrove': [[57, 103], [97, 107], [115, 100], [22, 147], [117, 120], [133, 157], [102, 128]],
  'world/tree-rain_tree': [[64, 99], [127, 90], [96, 99], [81, 89], [34, 98], [44, 97]],
  'world/tree-starfall_banyan': [[67, 98], [121, 71], [88, 69], [64, 71]],
  'world/tree-tembusu': [[68, 98]],
  'world/tree-willow': [[70, 141], [103, 155]],
  'icons/item-raw_eel': [[37, 128]],
  'icons/item-raw_giant_snakehead': [[97, 101], [100, 91]],
  'icons/item-raw_lobster': [[47, 96], [115, 91], [38, 56], [89, 101], [99, 99], [41, 117], [22, 100], [25, 69]],
  'icons/item-raw_mangrove_jack': [[38, 72], [37, 93]],
  'icons/item-raw_rift_eel': [[82, 118]],
  'icons/item-raw_tilapia': [[109, 47], [122, 75]],
};
for (const [key, gaps] of Object.entries(PAINT_GAPS)) {
  MATTED_ART[key] = { gaps, exterior: false, trim: key === 'icons/item-raw_mangrove_jack' };
}
const cutoutProfile = (src) => {
  const key = src?.match(/(?:^|\/)assets\/(.+)\.webp(?:[?#].*)?$/)?.[1];
  return Object.hasOwn(MATTED_ART, key) ? MATTED_ART[key] : null;
};
export const hasWhiteMatte = (src) => !!cutoutProfile(src);

const CLEAR = 64;
const LIGHT = 180;
const SPREAD = 54;

// Distance to the original transparent edge gives the body more weight than
// a detached strip of ink around it.
function edgeDistance(pixels, w, h) {
  const d = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    d[i] = pixels[i * 4 + 3] <= CLEAR ? 0 : 1 + Math.min(x ? d[i - 1] : 0, y ? d[i - w] : 0);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    d[i] = Math.min(d[i], 1 + Math.min(x + 1 < w ? d[i + 1] : 0, y + 1 < h ? d[i + w] : 0));
  }
  return d;
}

/** Remove the pale backing reachable from transparent pixels. The ink around
 *  the paint stops the fill, including the ink around eyes and white wings. */
export function removeWhiteMatte(pixels, w, h, { gaps = [], exterior = true, trim = false } = {}) {
  const count = w * h;
  const cut = new Uint8Array(count);
  const pending = new Int32Array(count);
  const distance = trim ? edgeDistance(pixels, w, h) : null;
  let read = 0, write = 0;
  const add = (i) => {
    if (cut[i]) return;
    const p = i * 4;
    if (!pixels[p + 3]) return;
    const lo = Math.min(pixels[p], pixels[p + 1], pixels[p + 2]);
    const hi = Math.max(pixels[p], pixels[p + 1], pixels[p + 2]);
    if (lo < LIGHT || hi - lo > SPREAD) return;
    cut[i] = 1;
    pending[write++] = i;
  };
  if (exterior) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (pixels[i * 4 + 3] > CLEAR) {
        if (!x || x === w - 1 || !y || y === h - 1) add(i);
        continue;
      }
      if (x > 0) add(i - 1);
      if (x + 1 < w) add(i + 1);
      if (y > 0) add(i - w);
      if (y + 1 < h) add(i + w);
    }
  }
  for (const [x, y] of gaps) if (x < w && y < h) add(y * w + x);
  while (read < write) {
    const i = pending[read++], x = i % w;
    if (x > 0) add(i - 1);
    if (x + 1 < w) add(i + 1);
    if (i >= w) add(i - w);
    if (i < count - w) add(i + w);
  }
  if (!write) return trim && keepMainShape(pixels, w, h, pending, distance);

  // The first pixel of ink is sometimes blended against that backing. Use
  // the neighbouring ink's colour and its remaining coverage at that edge.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = i * 4;
    if (cut[i]) { pixels[p + 3] = 0; continue; }
    if (!pixels[p + 3]) continue;
    if (!(x > 0 && cut[i - 1] || x + 1 < w && cut[i + 1] || y > 0 && cut[i - w] || y + 1 < h && cut[i + w])) continue;
    if (pixels[p + 3] <= CLEAR) { pixels[p + 3] = 0; continue; }
    const lo = Math.min(pixels[p], pixels[p + 1], pixels[p + 2]);
    const hi = Math.max(pixels[p], pixels[p + 1], pixels[p + 2]);
    if (lo < 112 || hi - lo > SPREAD) continue;
    let ink = -1, inkHi = 126;
    for (let sy = Math.max(0, y - 1); sy <= Math.min(h - 1, y + 1); sy++) {
      for (let sx = Math.max(0, x - 1); sx <= Math.min(w - 1, x + 1); sx++) {
        const q = (sy * w + sx) * 4;
        if (pixels[q + 3] < 196) continue;
        const peak = Math.max(pixels[q], pixels[q + 1], pixels[q + 2]);
        if (peak < inkHi) { ink = q; inkHi = peak; }
      }
    }
    if (ink < 0) continue;
    pixels[p + 3] *= (255 - hi) / (255 - inkHi);
    pixels[p] = pixels[ink];
    pixels[p + 1] = pixels[ink + 1];
    pixels[p + 2] = pixels[ink + 2];
  }
  if (trim) keepMainShape(pixels, w, h, pending, distance);
  return true;
}

// Ink outside the removed white rim becomes a separate shape. Keep the art
// and its antialiased edge.
function keepMainShape(pixels, w, h, pending, distance) {
  const labels = new Int32Array(w * h);
  let chosen = 0, largest = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] || pixels[i * 4 + 3] <= CLEAR) continue;
    const label = i + 1;
    labels[i] = label;
    pending[0] = i;
    let read = 0, write = 1, mass = 0;
    while (read < write) {
      const p = pending[read++], x = p % w, y = Math.floor(p / w);
      mass += Math.min(8, distance[p]);
      for (let sy = Math.max(0, y - 1); sy <= Math.min(h - 1, y + 1); sy++) {
        for (let sx = Math.max(0, x - 1); sx <= Math.min(w - 1, x + 1); sx++) {
          const q = sy * w + sx;
          if (labels[q] || pixels[q * 4 + 3] <= CLEAR) continue;
          labels[q] = label;
          pending[write++] = q;
        }
      }
    }
    if (mass > largest) { largest = mass; chosen = label; }
  }
  if (!chosen) return false;
  let removed = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (labels[i] === chosen || !pixels[i * 4 + 3]) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h && labels[i + dy * w + dx] === chosen) edge = true;
    }
    if (labels[i] || !edge) { pixels[i * 4 + 3] = 0; removed = true; }
  }
  return removed;
}

const cleaned = new WeakMap();
const bySource = new Map();
/** The version of a loaded image drawn into the world. Fish keep a separate
 *  treatment here since their source pictures double as item stickers. */
export function worldCutout(img) {
  if (!img?.complete || !img.naturalWidth || typeof document === 'undefined') return img;
  const hit = cleaned.get(img);
  if (hit) return hit;
  let art = img;
  const profile = cutoutProfile(img.src);
  if (profile) {
    if (!bySource.has(img.src)) {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (g?.getImageData) {
        g.drawImage(img, 0, 0);
        const picture = g.getImageData(0, 0, c.width, c.height);
        if (picture?.data && removeWhiteMatte(picture.data, c.width, c.height, profile)) {
          g.putImageData(picture, 0, 0);
          art = c;
        }
      }
      bySource.set(img.src, art === img ? null : art);
    }
    art = bySource.get(img.src) || img;
  }
  cleaned.set(img, art);
  return art;
}

const portraits = new Map();
/** Share the cutout with HTML portraits that use an img or CSS background. */
export function cutoutPortrait(src, show) {
  if (!hasWhiteMatte(src) || typeof Image === 'undefined' || typeof document === 'undefined') { show(src); return; }
  if (!portraits.has(src)) {
    const img = new Image();
    img.src = src;
    const ready = img.decode().then(() => {
      const art = worldCutout(img);
      return art === img ? src : art.toDataURL();
    }).catch(() => {
      portraits.delete(src);
      return src;
    });
    portraits.set(src, ready);
  }
  portraits.get(src).then(show);
}

export function loadCutoutPortraits(root) {
  for (const img of root.querySelectorAll('img[data-cutout-src]')) {
    cutoutPortrait(img.dataset.cutoutSrc, (src) => { img.src = src; });
  }
}
