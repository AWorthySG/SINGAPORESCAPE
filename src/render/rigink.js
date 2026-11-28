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

/** Keep the silhouette readable at play size without a thick sticker edge. */
export const RIG_INK = 0.7;
export const INK_RGB = '#22304A';

/** Light the upper planes and shade the underside inside the painted alpha. */
export function shadeCreatureBody(g, x, y, w, h, top, bottom) {
  if (!g?.createLinearGradient) return;
  const light = g.createLinearGradient(0, top, 0, bottom);
  light.addColorStop(0, 'rgba(255,234,193,0.18)');
  light.addColorStop(0.38, 'rgba(255,234,193,0)');
  light.addColorStop(0.64, 'rgba(34,48,74,0.07)');
  light.addColorStop(1, 'rgba(34,48,74,0.30)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = light;
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = 'source-over';
}

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

const _rigDone = new WeakMap();   // a rig's pictures -> the size they were all inked at

/**
 * Whether every picture of a rig (`imgs`, by name; `files` the names) has its
 * navy copy for parts drawn `w` x `h` units at `res`, inking more of them
 * while `budget` (governor.js BakeBudget) allows. Inking is a few image copies
 * and a read-back per part, so a fresh rig costs a phone tens of milliseconds,
 * and entering an area brought every rig in view at once: one frame of most
 * of a second. Spread this way, a rig is ready a frame or a few later, and
 * until then the monster draws as its single sticker, which looks the same.
 * Once a rig is done the answer is kept, so it costs one lookup a frame.
 */
export function inkRig(imgs, files, w, h, res, budget, ink = RIG_INK, factory = null) {
  const key = `${w},${h},${res},${ink}`;
  if (_rigDone.get(imgs) === key) return true;
  for (const n of files) {
    const img = imgs[n];
    const e = img && _ink.get(img);
    if (e && e.pw === w && e.ph === h && e.res === res && e.ink === ink) continue;
    if (budget && !budget.ok()) return false;
    if (budget) budget.run(() => inkPart(img, w, h, res, ink, factory));
    else inkPart(img, w, h, res, ink, factory);
  }
  _rigDone.set(imgs, key);
  return true;
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
    // Keep only the painted crop at the rig's drawing density. Position the
    // light in the original canvas so adjacent layers share the same grade.
    if (cg.createLinearGradient) {
      const W = Math.min(out.sw, Math.ceil(out.aw * res)), H = Math.min(out.sh, Math.ceil(out.ah * res));
      const art = make(W, H), paint = art?.getContext('2d');
      if (paint) {
        paint.drawImage(img, sx, sy, out.sw, out.sh, 0, 0, W, H);
        const unit = H / out.sh;
        shadeCreatureBody(paint, 0, 0, W, H, -sy * unit, (NH - sy) * unit);
        out.art = art;
        // A fixed bitmap draws as cheaply as the unlit image each frame.
        if (typeof createImageBitmap === 'function') {
          createImageBitmap(art).then((bitmap) => { out.art = bitmap; }).catch(() => {});
        }
      }
    }
  }
  return out;
}
