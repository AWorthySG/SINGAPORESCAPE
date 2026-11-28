import { bakeBudget } from './governor.js';

const GARDEN_PLANTS = {
  palm: 'palm', leaning_palm: 'palm',
  bush: 'bush',
  flower: 'flower', bougainvillea_pot: 'flower', orchid_planter: 'flower',
  tiled_planter: 'flower', planter_box: 'flower',
};

export function foliageKind(o) {
  const type = o.def?.type;
  if (type === 'tree') return o.depleted ? null : (o.objId === 'bamboo' ? 'bamboo' : 'tree');
  return type === 'scenery' ? GARDEN_PLANTS[o.objId] || null : null;
}

// Light on the crown and cool shade underneath give the painted leaves volume.
// Bake the grade into the source once so it bends with the art in one pass.
const lit = new WeakMap();
export function foliageArt(img) {
  let art = lit.get(img);
  if (art !== undefined) return art || img;
  if (typeof document === 'undefined' || !bakeBudget.ok()) return img;
  art = bakeBudget.run(() => {
    try {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.min(1, 160 / Math.max(iw, ih));
      const c = document.createElement('canvas');
      const w = c.width = Math.max(1, Math.round(iw * s)), h = c.height = Math.max(1, Math.round(ih * s));
      const g = c.getContext('2d');
      if (!g) return null;
      g.drawImage(img, 0, 0, w, h);
      g.globalCompositeOperation = 'source-atop';
      const light = g.createLinearGradient(0, 0, w * 0.46, h);
      light.addColorStop(0, 'rgba(255,233,155,0.31)');
      light.addColorStop(0.29, 'rgba(253,243,184,0.09)');
      light.addColorStop(0.46, 'rgba(234,236,199,0)');
      light.addColorStop(0.75, 'rgba(31,66,67,0.18)');
      light.addColorStop(1, 'rgba(30,52,71,0.26)');
      g.fillStyle = light;
      g.fillRect(0, 0, w, h);
      return c;
    } catch { return null; }
  });
  lit.set(img, art);
  return art || img;
}

/** Bend rises through the trunk and reaches its full distance at the tips. */
export function foliageOffset(lean, height, fraction) {
  return -lean * height * 1.55 * fraction * fraction;
}

/**
 * Draw continuous bands of the sprite with a bend that increases up the stem.
 * The bottom remains anchored. The upper bands can fade when a player is behind.
 */
export function drawFoliage(ctx, img, x, y, w, h, lean, upperAlpha) {
  if (!lean && upperAlpha >= 1) { ctx.drawImage(img, x, y, w, h); return; }
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const root = Math.round(ih * 0.77);
  const stops = lean ? [Math.round(root * 0.48), root, ih] : [root, ih];
  let top = 0, dx = foliageOffset(lean, h, 1);
  for (const end of stops) {
    if (end <= top) continue;
    const yy = y + h * top / ih, dh = h * (end - top) / ih;
    const next = foliageOffset(lean, h, 1 - end / ih), shear = (next - dx) / dh;
    ctx.save();
    if (end <= root) ctx.globalAlpha *= upperAlpha;
    if (shear) ctx.transform(1, 0, shear, 1, dx - yy * shear, 0);
    ctx.drawImage(img, 0, top, iw, end - top, x, yy, w, dh);
    ctx.restore();
    top = end;
    dx = next;
  }
}
