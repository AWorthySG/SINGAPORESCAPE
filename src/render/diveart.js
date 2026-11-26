// Diving's drawn pictures, while a reef's painted one loads (and headless): a reef in the water (a
// floating dive buoy in the reef's colour over a patch of coral and rippling
// rings) and the breath bar over the hero while they dive. Sticker style: navy
// ink #22304A, pastel fills. A few paths a frame, no garbage.
import { DIVE_SPOT_BY_ID } from '../data/diving.js';

const INK = '#22304A';

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
  // ...and its little flag on a stick.
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(cx + 5, by - 4); ctx.lineTo(cx + 5, by - 11); ctx.stroke();
  ctx.fillStyle = '#f06a5a';
  ctx.beginPath(); ctx.moveTo(cx + 5, by - 11); ctx.lineTo(cx + 10, by - 9); ctx.lineTo(cx + 5, by - 7); ctx.closePath(); ctx.fill(); ctx.stroke();
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
