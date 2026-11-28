// Diving's drawn pictures, while a reef's painted one loads (and headless): a reef in the water (a
// floating dive buoy in the reef's colour over a patch of coral and rippling
// rings) and the breath bar over the hero while they dive. Sticker style: navy
// ink #22304A, pastel fills. A few paths a frame, no garbage.
import { TILE } from '../config.js';
import { DIVE_SPOT_BY_ID } from '../data/diving.js';

const INK = '#22304A';
const SHORE_SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** A walkable shore tile beside the reef, with room to see the marker. */
export function diveShoreAt(world, reef) {
  let fallback = null;
  for (const [dx, dy] of SHORE_SIDES) {
    const x = reef.x + dx, y = reef.y + dy;
    if (world.isBlocked(x, y)) continue;
    const tile = { x, y };
    if (!world.objectAt(x, y)) return tile;
    fallback ||= tile;
  }
  return fallback;
}

// Inlay the mask at the standing tile, once per chunk and once per shared approach.
export function paintDiveShoreTiles(ctx, world, x0, y0, x1, y1) {
  const nearby = world.objectsIn?.(x0 - 1, y0 - 1, x1, y1);
  if (!nearby) return;
  const seen = new Set();
  for (const o of nearby) {
    if (o.def.type !== 'dive') continue;
    const at = diveShoreAt(world, o);
    if (!at || at.x < x0 || at.y < y0 || at.x >= x1 || at.y >= y1) continue;
    const key = at.y * world.width + at.x;
    if (seen.has(key)) continue;
    seen.add(key);
    const x = (at.x - x0 + .5) * TILE, y = (at.y - y0 + .5) * TILE;
    ctx.fillStyle = '#315b64';
    ctx.beginPath(); ctx.ellipse(x, y, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fdf2d1';
    ctx.beginPath();
    ctx.ellipse(x - 3, y, 3.4, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 3, y, 3.4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fdf2d1'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 8, y - 1); ctx.lineTo(x + 8, y - 4); ctx.stroke();
  }
}

/** A red-and-white dive flag. Its pole ends at the float at (x, y). */
export function drawDiveFlag(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 19); ctx.stroke();
  ctx.fillStyle = '#e76b57';
  ctx.fillRect(x, y - 19, 12, 8);
  ctx.fillStyle = '#fff7dc';
  ctx.beginPath(); ctx.moveTo(x + 1, y - 19); ctx.lineTo(x + 4, y - 19);
  ctx.lineTo(x + 11, y - 11); ctx.lineTo(x + 8, y - 11); ctx.closePath(); ctx.fill();
  ctx.strokeRect(x, y - 19, 12, 8);
  ctx.restore();
}

/** A reef at tile centre (cx, cy). The buoy bobs on its own beat (its tile). */
export function drawDiveSpot(ctx, obj, cx, cy, time = 0) {
  const col = obj.def.color || DIVE_SPOT_BY_ID[obj.objId]?.color || '#9ee0d0';
  const beat = (obj.x || 0) * 1.7 + (obj.y || 0) * 0.9;
  // The reef under the surface: a soft patch in its colour.
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(cx, cy + 5, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Rings spreading from where a diver went down.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 2; i++) {
    const k = ((time * 0.0025 + beat + i * 1.2) % 2.4);
    ctx.globalAlpha = Math.max(0, 0.6 - k / 4);
    ctx.beginPath(); ctx.ellipse(cx, cy + 4, 5 + k * 5, 2 + k * 2, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Bubbles rising.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 3; i++) {
    const u = ((time * 0.0008 + beat * 0.3 + i / 3) % 1);
    ctx.globalAlpha = 1 - u;
    ctx.beginPath(); ctx.arc(cx - 6 + i * 5 + Math.sin(u * 6 + i) * 1.2, cy + 4 - u * 9, 1 + (i % 2) * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The buoy: a round float in the reef's colour with a white band, bobbing.
  const bob = Math.sin(time * 0.003 + beat) * 1.2;
  const by = cy - 2 + bob;
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(cx + 5, by, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx + 1.2, by - 0.9, 7.6, 1.8);
  drawDiveFlag(ctx, cx + 5, by - 2);
}

export const BREATH_BAR_W = 34;
export const BREATH_BAR_H = 5;
/** Breath to show while diving: { frac (0..1 of the dive left), up (coming up for air) }, or null. */
export function breathShown(game) {
  const a = game?.player?.action;
  if (a?.type !== 'dive' || !(a.maxBreath > 0)) return null;
  return { frac: a.surface > 0 ? 0 : Math.max(0, Math.min(1, a.breath / a.maxBreath)), up: a.surface > 0 };
}

/** The breath bar centred at (cx, y top), over the hero, while they dive. */
export function drawBreathBar(ctx, game, cx, y, now = 0) {
  const b = breathShown(game);
  if (!b) return;
  const w = BREATH_BAR_W, h = BREATH_BAR_H, x = cx - w / 2;
  ctx.fillStyle = INK; ctx.fillRect(x - 2.5, y - 2.5, w + 5, h + 5);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  ctx.fillStyle = '#cfe6f2'; ctx.fillRect(x, y, w, h);
  if (b.up) {
    // Up for air: the bar fills back up, pulsing.
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now * 0.012);
    ctx.fillStyle = '#8fd6ff'; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = b.frac > 0.25 ? '#3a9ad8' : '#f2a03d';
    ctx.fillRect(x, y, Math.round(w * b.frac), h);
  }
  // A bubble at the left end says what the bar is.
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x - 6, y + h / 2, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
