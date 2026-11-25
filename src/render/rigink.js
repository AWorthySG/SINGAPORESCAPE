// Monsters and bosses with moving parts (the rigs in sprites.js and
// creatureRigs.js) should look like the single-picture monsters beside them:
// the same navy ink line round the outside, and the same size on screen.
//
// A single picture is baked once into a sticker with a navy ink ring traced
// round its silhouette (sprites.js bakeSticker, MONSTER_BOX.ink). A rig is
// posed afresh every frame, so its outline can't be baked whole. Instead each
// part gets a navy copy of itself, grown by the ring's width, baked once and
// kept: the rig draws all the navy copies first, with the same pose as the
// parts, then the parts over them. Where parts overlap, the parts cover the
// navy, so only the ring round the outside of the whole body shows, which is
// what the sticker's ring is. A navy copy is small (baked at the rig's own
// drawing resolution, not the art's, and cut down to what it covers), and
// each part is drawn from just the box that holds its paint, so the extra
// drawImage per part costs about what the unused canvas round the parts did.

/** The ink line's width in local units: the same as the monster stickers' (sprites.js MONSTER_BOX.ink). */
export const RIG_INK = 1.3;
export const INK_RGB = '#22304A';

/**
 * How much bigger or smaller a rig is drawn than its `fit` gives, so it covers
 * the same area on screen as the single picture of the same monster (with its
 * ink line). Measured in the browser: each rig at rest beside its still, the
 * square root of the ratio of their painted areas. Only rigs more than 4% out
 * are listed; most rigs' `fit` already matches. Re-measure when a parts sheet
 * or a still is redrawn.
 */
export const RIG_SIZE = {
  rat: 0.72, goblin: 1.068, mud_crab: 1.085, fruit_bat: 1.116, outlaw: 1.076, skeleton: 1.056,
  carnivorous_plant: 1.125, hornbill: 1.062, sea_turtle: 1.066, vampire_bat: 1.136, pink_dolphin: 1.047,
  kingfisher: 1.064, sambar_deer: 1.046, chilli_crab: 1.073, spider_queen: 1.094, sentosa_kraken: 1.052,
  bedok_bandit_lord: 1.043, mangrove_hydra: 1.047, coral_leviathan: 1.049, sentosa_megalodon: 1.055,
  shadow_sovereign: 1.068, kusu_tortoise: 1.063, rift_tyrant: 1.06, kranji_buffalo_king: 1.059,
  punggol_lantern_spirit: 1.104, tuas_crane_colossus: 1.072, kelong_king_crab: 1.049, buaya_putih: 1.058,
  ubin_quarry_python: 1.044, kopitiam_roach_queen: 1.042, bakau_mud_lobster: 1.063, kranji_bullfrog_emperor: 1.046,
  sea_eagle_sovereign: 1.046, slag_titan: 1.066, atlas_moth_empress: 1.111, great_argus_monarch: 1.103,
  jade_moon_hare: 1.107, fenghuang: 1.134,
};
export const rigSize = (id) => RIG_SIZE[id] || 1;

/** The rectangle (local units) a part's navy copy is drawn over, for a part drawn over (x0, y0, w, h). */
export function inkRect(x0, y0, w, h, ink = RIG_INK, out = {}) {
  const p = ink + 0.5;   // the ring, and half a unit for its soft edge
  out.x = x0 - p; out.y = y0 - p; out.w = w + 2 * p; out.h = h + 2 * p; out.pad = p;
  return out;
}

const _ink = new WeakMap();   // part picture -> its navy copy and crop (see inkPart)
const RING = 16;              // stamps round the circle (as the stickers' ring)

/**
 * A part picture `img`, drawn `w` x `h` units, made ready to draw with its ink
 * line: { cv, x, y, w, h } the navy copy (its silhouette grown by `ink`
 * units, baked at `res` pixels a unit and cut down to what it covers) and
 * where it goes relative to the part's top-left; and { sx, sy, sw, sh, ax,
 * ay, aw, ah } the part of the picture that holds paint (source pixels) and
 * where that goes. A part's layer is mostly empty canvas (all of a rig's
 * layers share one size), so drawing just these rectangles spares the
 * blending of all that air, which pays for the navy copy. Made once and kept
 * (a picture belongs to one rig, so it is always asked for at one size; the
 * lookup allocates nothing); null without a canvas (headless) or until the
 * picture has loaded.
 */
export function inkPart(img, w, h, res, ink = RIG_INK, factory = null) {
  if (!img || !(img.naturalWidth || img.width)) return null;
  const e = _ink.get(img);
  if (e && e.pw === w && e.ph === h && e.res === res && e.ink === ink) return e.part;
  let out = null;
  try {
    const make = factory || ((W, H) => {
      if (typeof document === 'undefined' || !document.createElement) return null;
      const c = document.createElement('canvas'); c.width = W; c.height = H; return c;
    });
    const r = inkRect(0, 0, w, h, ink);
    const W = Math.ceil(r.w * res), H = Math.ceil(r.h * res);
    const sil = make(W, H), cv = make(W, H);
    const sg = sil && sil.getContext('2d'), g = cv && cv.getContext('2d', { willReadFrequently: true });
    if (sg && g) {
      // The part's silhouette in navy, at the copy's resolution...
      sg.drawImage(img, r.pad * res, r.pad * res, w * res, h * res);
      sg.globalCompositeOperation = 'source-in'; sg.fillStyle = INK_RGB; sg.fillRect(0, 0, W, H);
      // ...stamped round a circle the ring's width across, and once in the middle.
      for (let i = 0; i < RING; i++) {
        const a = (i / RING) * Math.PI * 2;
        g.drawImage(sil, Math.cos(a) * ink * res, Math.sin(a) * ink * res);
      }
      g.drawImage(sil, 0, 0);
      const b = paintBox(g, W, H);
      if (b) out = cropPart(img, cv, b, r, w, h, res, ink, make);
      else out = { cv, x: r.x, y: r.y, w: r.w, h: r.h, sw: 0 };   // (couldn't read it back: whole layers)
    }
  } catch { out = null; }
  _ink.set(img, { pw: w, ph: h, res, ink, part: out });
  return out;
}

// The box of pixels holding any paint in a canvas: [x0, y0, x1, y1), or null if it can't be read.
function paintBox(g, W, H) {
  let d;
  try { d = g.getImageData(0, 0, W, H).data; } catch { return null; }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (d[row + x * 4 + 3] > 8) { if (x < x0) x0 = x; if (x >= x1) x1 = x + 1; if (y < y0) y0 = y; y1 = y + 1; }
    }
  }
  return x1 > x0 ? [x0, y0, x1, y1] : [0, 0, 1, 1];
}

/** The navy copy cut to its box `b` (copy pixels), and the matching crop of the picture. */
function cropPart(img, cv, b, r, w, h, res, ink, make) {
  const [x0, y0, x1, y1] = b, cw = x1 - x0, ch = y1 - y0;
  const cut = make(cw, ch), cg = cut && cut.getContext('2d');
  if (!cg) return { cv, x: r.x, y: r.y, w: r.w, h: r.h, sw: 0 };
  cg.drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
  const out = { cv: cut, x: r.x + x0 / res, y: r.y + y0 / res, w: cw / res, h: ch / res, sw: 0 };
  // The paint lies inside the navy copy's box, the ring's width in from it (less a
  // little slack for the soft edge): that much of the picture is all that's drawn.
  const m = Math.max(0, ink - 0.4);
  const ax0 = Math.max(0, out.x + m), ay0 = Math.max(0, out.y + m);
  const ax1 = Math.min(w, out.x + out.w - m), ay1 = Math.min(h, out.y + out.h - m);
  if (ax1 > ax0 && ay1 > ay0) {
    const NW = img.naturalWidth || img.width, NH = img.naturalHeight || img.height;
    const sx = Math.floor(ax0 / w * NW), sy = Math.floor(ay0 / h * NH);
    const sx1 = Math.min(NW, Math.ceil(ax1 / w * NW)), sy1 = Math.min(NH, Math.ceil(ay1 / h * NH));
    out.sx = sx; out.sy = sy; out.sw = sx1 - sx; out.sh = sy1 - sy;
    out.ax = sx / NW * w; out.ay = sy / NH * h; out.aw = out.sw / NW * w; out.ah = out.sh / NH * h;
  }
  return out;
}
