import { bakeBudget } from './governor.js';

// Warm key light and a cooler underside, clipped to the painted silhouette.
// The sky chooses the palette. The facing controls which side of the source
// faces the light when the sprite is mirrored.
const LIGHT = {
  dawn:   ['rgba(255,221,168,0.24)', 'rgba(70,78,122,0.21)', 1],
  day:    ['rgba(255,241,195,0.20)', 'rgba(53,75,111,0.16)', 0],
  dusk:   ['rgba(255,200,138,0.25)', 'rgba(82,65,116,0.23)', -1],
  cloud:  ['rgba(222,239,246,0.18)', 'rgba(47,72,108,0.15)', 0],
  night:  ['rgba(180,216,255,0.27)', 'rgba(47,54,100,0.22)', -1],
};

export function actorLight(phase, sky) {
  if (phase < 0.26 || phase > 0.75) return 'night';
  if (sky < 0.66) return 'cloud';
  if (phase < 0.39) return 'dawn';
  if (phase > 0.61) return 'dusk';
  return 'day';
}

function paintLight(g, light, face, { x, y, w, h }, bounds = { x, y, w, h }) {
  const [top, shade, side] = LIGHT[light];
  const from = 0.5 + side * (face < 0 ? -0.42 : 0.42);
  const ray = g.createLinearGradient(x + from * w, y, x + (1 - from) * w, y + h);
  ray.addColorStop(0, top);
  ray.addColorStop(0.45, 'rgba(255,255,255,0)');
  ray.addColorStop(0.66, 'rgba(47,60,95,0.045)');
  ray.addColorStop(1, shade);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = ray;
  g.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  g.globalCompositeOperation = 'source-over';
}

function canvas(w, h) {
  if (typeof document === 'undefined') return null;
  try {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    return g?.createLinearGradient ? { cv, g } : null;
  } catch { return null; }
}

// The regular actors still draw one image per part. Cache the two most recent
// looks per picture so turning around reuses a bake and crowds stay cheap.
const colours = new WeakMap();
export function litActor(img, light, face) {
  if (!img || !light || typeof document === 'undefined') return img;
  const key = LIGHT[light][2] && face < 0 ? light + '-' : light;
  let looks = colours.get(img);
  const cached = looks?.get(key);
  if (cached !== undefined) return cached?.image || img;
  if (!bakeBudget.ok()) return img;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) return img;
  const entry = bakeBudget.run(() => {
    const layer = canvas(w, h);
    if (!layer) return null;
    const { cv, g } = layer;
    g.drawImage(img, 0, 0);
    paintLight(g, light, face, { x: 0, y: 0, w, h });
    const entry = { image: cv };
    if (typeof createImageBitmap === 'function') {
      createImageBitmap(cv).then(bitmap => { entry.image = bitmap; }).catch(() => {});
    }
    return entry;
  });
  if (!looks) { looks = new Map(); colours.set(img, looks); }
  if (looks.size === 2) looks.delete(looks.keys().next().value);
  looks.set(key, entry);
  return entry?.image || img;
}

// The player has one composed light pass for their whole pose, so both arms
// and equipment catch the same light. Attack trails and halos draw outside it.
const HERO_LAYER = { x: -92, y: -94, w: 184, h: 148 };
const HERO_BODY = { x: -23, y: -43, w: 46, h: 58 };
let heroLayer;
export function beginHeroLight(light, ctx) {
  if (!light) return null;
  const { x, y, w, h } = HERO_LAYER;
  const wanted = ctx.getTransform?.().d > 2.25 ? 3 : 2;
  if (!heroLayer || heroLayer.cv.width < w * wanted) heroLayer = canvas(w * wanted, h * wanted) || heroLayer;
  if (!heroLayer) return null;
  heroLayer.screen = ctx;
  const { g } = heroLayer, res = heroLayer.cv.width / w;
  g.setTransform(res, 0, 0, res, -x * res, -y * res);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(x, y, w, h);
  return g;
}

export function finishHeroLight(ctx, light, face) {
  const { x, y, w, h } = HERO_LAYER;
  paintLight(heroLayer.g, light, face, HERO_BODY, HERO_LAYER);
  ctx.drawImage(heroLayer.cv, x, y, w, h);
  heroLayer.screen = null;
}

/** Where a point on the hero actually goes on screen, including through the light layer. */
export function heroCanvasPoint(ctx, x, y, out) {
  const m = ctx.getTransform();
  out.x = m.a * x + m.c * y + m.e;
  out.y = m.b * x + m.d * y + m.f;
  if (ctx === heroLayer?.g && heroLayer.screen?.getTransform) {
    const s = heroLayer.screen.getTransform();
    const res = heroLayer.cv.width / HERO_LAYER.w;
    const lx = out.x / res + HERO_LAYER.x, ly = out.y / res + HERO_LAYER.y;
    out.x = s.a * lx + s.c * ly + s.e;
    out.y = s.b * lx + s.d * ly + s.f;
  }
  return out;
}
