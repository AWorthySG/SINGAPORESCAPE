// A rock stands on its tile by the bottom of the paint, even when the source
// picture has a transparent margin. These sizes describe the stone, in world
// pixels, and its contact row relative to the tile centre.
import { TILE } from '../config.js';

const PROFILES = {
  copper_rock: [31, 27, 11, '#706c5c'], tin_rock: [29, 22, 10, '#737871'],
  iron_rock: [31, 27, 11, '#656158'], coal_rock: [32, 24, 11, '#565957'],
  mithril_rock: [32, 28, 11, '#657383'], adamantite_rock: [32, 30, 11, '#66776a'],
  runite_rock: [34, 31, 11, '#566e7f'], gold_rock: [31, 28, 10, '#726a53'],
  clay_rock: [30, 19, 10, '#9b745d'], limestone_rock: [31, 22, 10, '#99907b'],
  silver_rock: [30, 25, 11, '#767a78'], sandstone_rock: [32, 22, 10, '#a58765'],
  gem_rock: [33, 28, 11, '#77706f'], granite_rock: [34, 27, 11, '#80716d'],
  obsidian_vein: [32, 31, 11, '#504e61'], orichalcum_rock: [34, 32, 11, '#766156'],
  jade_seam: [35, 32, 11, '#627563'], fallen_star: [34, 34, 11, '#6c6759'],
  skyglass_crystal: [33, 37, 11, '#617483'], eternal_lode: [36, 37, 11, '#726082'],
  meteorite: [36, 30, 11, '#655746'],
};
const DEFAULT = [30, 24, 10, '#77766d'];
// Only interned world-rock keys enter this map. Skill effects can reuse the
// measured shape once its sprite has loaded, with stable bounds headlessly.
const aspects = new Map();

function rockSeed(x, y) {
  const a = Math.imul(x + 17, 0x27d4eb2d) ^ Math.imul(y + 29, 0x85ebca6b);
  return (a ^ (a >>> 16)) >>> 0;
}

/** Offsets from the tile centre, in world px. The strike stays on the full
 * face even on the swing that depletes it. Ground cues never use shake. */
export function rockLayout(obj, img = null) {
  const type = obj.worldEvent ? 'meteorite' : obj.objId;
  const [w, h, base, stone] = PROFILES[type] || DEFAULT;
  if (img && !aspects.has(type)) {
    const frame = frameFor(img);
    if (frame) aspects.set(type, frame.width / frame.height);
  }
  const aspect = aspects.get(type) ?? w / h;
  const seed = rockSeed(obj.x, obj.y);
  const scale = 0.96 + (seed & 255) / 255 * 0.08;
  const dx = (((seed >>> 8) & 255) / 255 - 0.5) * 2.2;
  const foot = base + (((seed >>> 16) & 255) / 255 - 0.5) * 1.55;
  const bodyHeight = Math.min(h, w / aspect) * scale;
  const width = bodyHeight * aspect * (obj.depleted ? 0.89 : 1);
  const height = bodyHeight * (obj.depleted ? 0.47 : 1);
  return { dx, foot, width, height, stone, seed, strikeX: dx, strikeY: foot - bodyHeight * 0.49,
    labelY: foot - height - 6, progressY: foot - height - 12 };
}

/** The struck face in world pixels. A source in world pixels draws the strike
 * towards the side within reach of the pick, while keeping it on the rock. */
export function rockImpactPoint(obj, source) {
  const rock = rockLayout(obj);
  const x = obj.x * TILE + TILE / 2 + rock.strikeX;
  const y = obj.y * TILE + TILE / 2 + rock.strikeY;
  if (!source) return { x, y };
  const dx = source.x - x, dy = source.y - y;
  const distance = Math.hypot(dx, dy) || 1;
  return { x: x + dx / distance * 6.1, y: y + dy / distance * 2.4 };
}

function oval(ctx, x, y, rx, ry, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

/** Soft rock contact and a couple of chips on the flat ground pass. */
export function drawMiningGround(ctx, cx, cy, rock, selected = false, pulse = 1) {
  const x = cx + rock.dx, y = cy + rock.foot;
  const broad = rock.width * 0.43;
  ctx.save();
  oval(ctx, x, y - 0.6, broad, 3.8, 'rgba(34,43,48,0.13)');
  oval(ctx, x, y - 0.9, broad * 0.78, 2.1, 'rgba(31,40,44,0.21)');
  // The chips follow the host stone's colour and stay put when a pick hits.
  // Keep them inside the work tile so closely spaced seams remain readable.
  const side = rock.seed & 0x1000000 ? 1 : -1;
  ctx.globalAlpha *= 0.52;
  oval(ctx, x + side * Math.min(13.4, broad * 0.96), y + 1.7, 1.65, 0.85, rock.stone);
  oval(ctx, x - side * Math.min(12.8, broad * 0.92), y + 0.55, 1.07, 0.63, rock.stone);
  ctx.restore();
  if (!selected) return;
  ctx.save();
  const rx = Math.max(12, rock.width * 0.5) * pulse;
  ctx.beginPath(); ctx.ellipse(x, y, rx, 4.1, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(34,48,74,0.47)'; ctx.lineWidth = 3.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,221,141,0.9)'; ctx.lineWidth = 1.45; ctx.stroke();
  ctx.restore();
}

// Images are interned by sprites.js. Scan each decoded alpha mask once; the
// result lives only as long as that image. Drawing never reads the game canvas.
const frames = new WeakMap();

function frameFor(img) {
  if (frames.has(img)) return frames.get(img);
  const width = img.naturalWidth, height = img.naturalHeight;
  let frame = { x: 0, y: 0, width, height };
  if (typeof document !== 'undefined') try {
    const cv = document.createElement('canvas');
    cv.width = width; cv.height = height;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(img, 0, 0);
    const { data } = c.getImageData(0, 0, width, height);
    let x0 = width, x1 = -1, y0 = height, y1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 64) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    frame = x1 >= x0 && y1 >= y0 ? { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } : null;
  } catch { /* keep the whole frame if pixel reads are unavailable */ }
  frames.set(img, frame);
  return frame;
}

function spentRock(img, frame) {
  if (frame.spent !== undefined) return frame.spent;
  frame.spent = null;
  if (typeof document !== 'undefined') try {
    const cv = document.createElement('canvas');
    cv.width = frame.width; cv.height = frame.height;
    const c = cv.getContext('2d');
    if ('filter' in c) c.filter = 'saturate(0.14) brightness(0.79) contrast(0.87)';
    c.drawImage(img, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
    c.filter = 'none';
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(91,89,76,0.24)';
    c.fillRect(0, 0, frame.width, frame.height);
    frame.spent = cv;
  } catch { /* the faceted fallback still clearly reads as depleted */ }
  return frame.spent;
}

function facet(ctx, fill, points) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.closePath(); ctx.fill();
}

// While the artist's picture is loading, keep the same dimensions and foot.
function drawRockFallback(ctx, obj, rock) {
  const w = rock.width * 0.5, h = rock.height;
  facet(ctx, obj.depleted ? '#6f6b5c' : rock.stone,
    [[-w, -h * 0.16], [-w * 0.77, -h * 0.62], [-w * 0.28, -h], [w * 0.39, -h * 0.91], [w, -h * 0.37], [w * 0.78, -h * 0.14], [w * 0.28, 0], [-w * 0.67, -h * 0.02]]);
  facet(ctx, 'rgba(246,235,209,0.25)', [[-w * 0.77, -h * 0.62], [-w * 0.28, -h], [w * 0.39, -h * 0.91], [w * 0.48, -h * 0.54], [-w * 0.26, -h * 0.48]]);
  facet(ctx, 'rgba(31,39,51,0.25)', [[-w * 0.26, -h * 0.48], [w * 0.48, -h * 0.54], [w, -h * 0.37], [w * 0.78, -h * 0.14], [w * 0.28, 0], [-w * 0.67, -h * 0.02]]);
  if (!obj.depleted && obj.def.ore) {
    const ore = obj.def.ore;
    facet(ctx, ore, [[-w * 0.55, -h * 0.55], [-w * 0.24, -h * 0.73], [w * 0.04, -h * 0.66], [-w * 0.22, -h * 0.51]]);
    facet(ctx, ore, [[w * 0.15, -h * 0.4], [w * 0.41, -h * 0.51], [w * 0.59, -h * 0.44], [w * 0.33, -h * 0.33]]);
  }
}

/** Draw the upright rock about precisely the row used in the ground pass. */
export function drawMiningRock(ctx, obj, img, cx, cy, reduced = false, rock = rockLayout(obj, img)) {
  const frame = img ? frameFor(img) : null;
  const spent = obj.depleted && frame ? spentRock(img, frame) : null;
  ctx.save();
  ctx.translate(cx + rock.dx, cy + rock.foot);
  if (!reduced && !obj.depleted && obj.shakeT > 0) {
    const tilt = Math.sin(obj.shakeT * 0.09) * Math.min(obj.shakeT / 280, 1) * 0.068;
    ctx.transform(1, 0, tilt, 1, 0, 0);
  }
  if (frame && (!obj.depleted || spent)) {
    const w = rock.width, h = rock.height;
    if (spent) ctx.drawImage(spent, -w / 2, -h, w, h);
    else ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height, -w / 2, -h, w, h);
  } else drawRockFallback(ctx, obj, rock);
  ctx.restore();
}
