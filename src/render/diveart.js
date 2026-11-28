// The painted reefs sit below the water. The dive flag and its buoy float on
// the surface, and the breath bar shows when a diver comes up for air.
import { TILE, TICK_MS } from '../config.js';
import { clamp } from '../core/utils.js';
import { DIVE_SPOT_BY_ID, SURFACE_TICKS } from '../data/diving.js';

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

export const DIVE_BED_BOX = [37, 26, 11];
export const DIVE_WATER_Y = 7;
const BUOY_X = 12;
const RED = '#c8594c';
const CREAM = '#fff2d6';

/** The seabed paint, kept stationary in the ground pass beneath the flag. */
export function drawDiveBed(ctx, obj, cx, cy, art = null) {
  const [maxW, maxH, foot] = DIVE_BED_BOX;
  ctx.save();
  if (art) {
    const scale = Math.min(maxW / art.naturalWidth, maxH / art.naturalHeight);
    const w = art.naturalWidth * scale, h = art.naturalHeight * scale;
    // Let the actual water colour through the stone and coral. The bright
    // buoy is drawn separately at full opacity on the surface.
    ctx.globalAlpha *= 0.83;
    ctx.drawImage(art, cx - w / 2, cy + foot - h, w, h);
  } else {
    // A muted patch of sand and the reef's own colour while its art loads.
    ctx.globalAlpha *= 0.56;
    ctx.fillStyle = '#387c85';
    ctx.beginPath(); ctx.ellipse(cx, cy + 5, 13, 5, .08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = obj.def.color || DIVE_SPOT_BY_ID[obj.objId]?.color || '#9ee0d0';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy + 1, 5, 3, -.38, 0, Math.PI * 2);
    ctx.ellipse(cx + 4, cy + 3, 4, 2.8, .36, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A diver-down flag with the pole fixed to the centre of the float. */
export function drawDiveFlag(ctx, x, y) {
  const top = y - 16;
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top - 0.7); ctx.stroke();
  ctx.fillStyle = RED;
  ctx.fillRect(x - 10, top, 10, 7);
  ctx.fillStyle = CREAM;
  ctx.beginPath(); ctx.moveTo(x - 3.2, top); ctx.lineTo(x - .8, top);
  ctx.lineTo(x - 7, top + 7); ctx.lineTo(x - 9.4, top + 7); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 0.8; ctx.strokeRect(x - 10, top, 10, 7);
  ctx.restore();
}

/** The waterline stays put as the buoy bobs. Reduced motion keeps one ring. */
export function drawDiveRipples(ctx, obj, cx, cy, time, reduced = false) {
  const phase = time * 0.0016 + (obj.x || 0) * 0.31 + (obj.y || 0) * 0.17;
  ctx.save();
  const alpha = ctx.globalAlpha;
  ctx.strokeStyle = '#e7f8f3'; ctx.lineWidth = 0.8;
  for (let i = 0; i < (reduced ? 1 : 2); i++) {
    const k = reduced ? 0.52 : (phase + i * 0.5) % 1;
    ctx.globalAlpha = alpha * k * (1 - k) * 1.9;
    ctx.beginPath();
    ctx.ellipse(cx + BUOY_X, cy + DIVE_WATER_Y, 3.2 + k * 5.2, 1.2 + k * 1.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Shared marker at the right of every reef, above the submerged artwork. */
export function drawDiveMarker(ctx, obj, cx, cy, time = 0, reduced = false, selected = false) {
  const x = cx + BUOY_X, waterY = cy + DIVE_WATER_Y;
  const beat = (obj.x || 0) * 1.7 + (obj.y || 0) * 0.9;
  const y = waterY - 1.6 + (reduced ? 0 : Math.sin(time * 0.003 + beat) * 0.9);
  drawDiveRipples(ctx, obj, cx, cy, time, reduced);
  ctx.save();
  if (selected) {
    ctx.strokeStyle = 'rgba(90,88,66,0.52)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(x, waterY, 9.5, 3.8, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffdf94'; ctx.lineWidth = 1.15; ctx.stroke();
  }
  ctx.fillStyle = RED; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y, 4.7, 3.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.fillRect(x - 3.95, y - 0.6, 7.9, 1.2);
  drawDiveFlag(ctx, x, y - 1.4);
  ctx.restore();
}

export const BREATH_BAR_W = 34;
export const BREATH_BAR_H = 5;
/** Breath left underwater or refilled at the surface, as a fraction of the bar. */
export function breathShown(game) {
  const a = game?.player?.action;
  if (a?.type !== 'dive' || !(a.maxBreath > 0)) return null;
  if (!(a.surface > 0)) return { frac: clamp(a.breath / a.maxBreath, 0, 1), up: false };
  const tick = clamp((game.tickAcc || 0) / TICK_MS, 0, 1);
  const frac = clamp((SURFACE_TICKS - a.surface + tick) / SURFACE_TICKS, 0, 1);
  return { frac, up: true };
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
    // The refill follows the actual surface pause, including between ticks.
    const alpha = ctx.globalAlpha;
    if (!game.reduceMotion) ctx.globalAlpha = alpha * (0.88 + 0.12 * Math.sin(now * 0.008));
    ctx.fillStyle = '#3a9ad8'; ctx.fillRect(x, y, w * b.frac, h);
    ctx.globalAlpha = alpha;
  } else {
    ctx.fillStyle = b.frac > 0.25 ? '#3a9ad8' : '#f2a03d';
    ctx.fillRect(x, y, Math.round(w * b.frac), h);
  }
  // A bubble at the left end says what the bar is.
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x - 6, y + h / 2, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
