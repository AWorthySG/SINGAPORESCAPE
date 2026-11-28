import { bakeBudget } from './governor.js';

// Let players show through the upper floors when they walk behind the
// shophouse rows at Kampong Glam's south gate.
const SHOPS = new Set(['shophouse_row_mint', 'shophouse_row_peach']);

export const isDepthShop = (obj) => SHOPS.has(obj.objId);

// Source slices keep the trunk or front wall opaque as you walk behind it.
export function drawLayeredObject(ctx, img, x, y, w, h, alpha, solidPart) {
  // Recoloured scenery may come from a cached canvas.
  const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
  const top = Math.round(sh * (1 - solidPart));
  const topH = h * top / sh;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, 0, 0, sw, top, x, y, w, topH);
  ctx.restore();
  ctx.drawImage(img, 0, top, sw, sh - top, x, y + topH, w, h - topH);
}

// Two small light masks per building picture. They keep the painted details
// visible, and blending their weights lets the light travel without rebaking.
const sunMasks = new WeakMap();
const MASK_SIZE = 128;

export function buildingSun(sun, sky, out = {}) {
  const east = (1 - sun.kx / sun.len) / 2;
  const strength = sun.day * sky;
  out.east = east * strength;
  out.west = (1 - east) * strength;
  return out;
}

function makeSunMask(img, w, h, east) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  if (!g) return null;
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-in';
  const light = g.createLinearGradient(east ? w : 0, 0, east ? 0 : w, h * 0.84);
  light.addColorStop(0, 'rgba(255,223,153,0.37)');
  light.addColorStop(0.32, 'rgba(255,236,185,0.12)');
  light.addColorStop(0.51, 'rgba(255,237,205,0)');
  light.addColorStop(0.69, 'rgba(78,93,132,0.11)');
  light.addColorStop(1, 'rgba(41,52,83,0.29)');
  g.fillStyle = light;
  g.fillRect(0, 0, w, h);
  return cv;
}

export function drawBuildingSun(ctx, img, x, y, w, h, light, upperAlpha) {
  let masks = sunMasks.get(img);
  if (masks === undefined) {
    if (typeof document === 'undefined' || !bakeBudget.ok()) return;
    const srcW = img.naturalWidth || img.width, srcH = img.naturalHeight || img.height;
    const s = Math.min(1, MASK_SIZE / Math.max(srcW, srcH));
    const mw = Math.max(1, Math.round(srcW * s)), mh = Math.max(1, Math.round(srcH * s));
    try { masks = bakeBudget.run(() => [makeSunMask(img, mw, mh, true), makeSunMask(img, mw, mh, false)]); }
    catch { masks = [null, null]; }
    sunMasks.set(img, masks);
  }
  const alpha = ctx.globalAlpha;
  for (let i = 0; i < 2; i++) {
    const strength = i === 0 ? light.east : light.west;
    if (!masks[i] || strength < 0.02) continue;
    ctx.globalAlpha = alpha * strength;
    if (upperAlpha < 1) drawLayeredObject(ctx, masks[i], x, y, w, h, upperAlpha, 0.34);
    else ctx.drawImage(masks[i], x, y, w, h);
  }
  ctx.globalAlpha = alpha;
}
