// Boss telegraphs and their aftermath share the same floor coordinates.
import { TILE } from '../config.js';
import { hazardIn, hazardPulse } from './creatureanim.js';
import { fxFade, fxGlow, fxProgress, fxRing, fxWave } from './fxdepth.js';
import { clamp01, easeOut, smooth } from './motionkit.js';
import { applyScreen, projectFlat } from './projection.js';

const INK = '#22304A';
const TAU = Math.PI * 2;
const BLAST = '#ff9b62';

/** A triangle means danger on the ground or above a creature. */
export function drawDangerMark(ctx, x, y, size = 10) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y + size * 0.7);
  ctx.lineTo(x - size, y + size * 0.7);
  ctx.closePath();
  ctx.strokeStyle = '#FFF8E9'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#FBE3B0'; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = INK; ctx.font = '900 12px Nunito,"Trebuchet MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', x, y + 1);
  ctx.restore();
}

/** Over a boss (or one of its healers), after the creature is drawn. */
export function drawBossMech(ctx, n, cx, cy, sc, timeMs, ox, oy, pj = null, detail = true, calm = false) {
  const m = n.mech;
  if (n.mechHealer && n.mechHealer.alive) drawBeam(ctx, n, cx, cy, ox, oy, timeMs, pj, detail, calm);
  if (!m) return;
  if (m.type === 'cast') drawCastBar(ctx, m, cx, cy - 34 * sc - 10, timeMs, detail);
}

function drawCastBar(ctx, m, cx, y, timeMs, detail) {
  const k = clamp01((timeMs - m.start) / m.dur);
  const w = 54, h = 8, x = cx - w / 2;
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = k > 0.75 ? '#e04a3a' : '#9a6ae8';
  ctx.fillRect(x, y, w * k, h);
  if (detail) {
    ctx.fillStyle = '#ffffff66'; ctx.fillRect(x, y, w * k, 2);
    ctx.fillStyle = '#22304a55'; ctx.fillRect(x, y + h - 2, w * k, 2);
  }
  ctx.font = '900 10px Nunito,"Trebuchet MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.fillStyle = INK;
  ctx.strokeText(m.md.name, cx, y - 3); ctx.fillText(m.md.name, cx, y - 3);
  ctx.restore();
}

const _from = {}, _to = {};
function drawBeam(ctx, n, cx, cy, ox, oy, timeMs, pj, detail, calm) {
  const boss = n.mechHealer, b = boss.renderCenter();
  const bOff = boss.renderOffset?.();
  let x = cx, y = cy - 6, bx = b.x - ox + (bOff?.x ?? 0), by = b.y - oy - 6 + (bOff?.y ?? 0);
  const labelY = cy - 26;
  ctx.save();
  if (pj) {
    // Project both ends independently so the tether reaches each character
    // even when the healer stands further up or down the hill.
    const fromRow = n.renderCenter().y - oy + 12, toRow = b.y - oy + 12;
    const a = projectFlat(pj, cx, fromRow, _from);
    const end = projectFlat(pj, bx, toRow, _to);
    x = a.x; y = a.y + (y - fromRow) * a.s;
    bx = end.x; by = end.y + (by - toRow) * end.s;
    applyScreen(ctx, pj);
  }
  const dx = bx - x, dy = by - y, len = Math.hypot(dx, dy) || 1;
  const bend = detail && !calm ? Math.sin(timeMs * 0.012) * Math.min(7, len * 0.09) : 0;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dx * 0.5 - dy / len * bend, y + dy * 0.5 + dx / len * bend, bx, by);
  ctx.strokeStyle = '#214c41'; ctx.lineWidth = detail ? 6 : 4; ctx.globalAlpha = 0.68; ctx.stroke();
  ctx.strokeStyle = '#64de9b'; ctx.lineWidth = detail ? 4 : 2; ctx.globalAlpha = 0.95; ctx.stroke();
  if (detail) {
    fxGlow(ctx, bx, by, 19, 15, '#72ffb1', 0.57);
    ctx.setLineDash([7, 6]); ctx.lineDashOffset = calm ? 0 : -timeMs * 0.038;
    ctx.strokeStyle = '#e6fff0'; ctx.lineWidth = 1.35; ctx.stroke();
  }
  ctx.restore();
  // A little green cross over the healer.
  ctx.save();
  ctx.globalAlpha = 1; ctx.fillStyle = '#5fe08a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(cx - 2.5, labelY - 7, 5, 14); ctx.rect(cx - 7, labelY - 2.5, 14, 5);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** The green circle in a safe-circle hazard (drawn over its red). */
export function drawSafeZone(ctx, h, ox, oy, timeMs, tile, detail = true, calm = false) {
  const s = h.safe;
  const cx = (s.cx + 0.5) * tile - ox, cy = (s.cy + 0.5) * tile - oy, r = (s.r + 0.5) * tile;
  const pulse = calm ? 0.5 : 0.5 + Math.sin(timeMs * 0.008) * 0.5;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(95,224,138,${(0.45 + pulse * 0.15).toFixed(3)})`;
  ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#FFF8E9'; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#22543C'; ctx.stroke();
  if (detail) fxRing(ctx, cx, cy, r * 0.84, r * 0.84, '#e2ffc4', 1.5, 0.56, true);
  ctx.font = '900 12px Nunito,"Trebuchet MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#1f6a3a';
  ctx.strokeText('SAFE', cx, cy); ctx.fillText('SAFE', cx, cy);
  ctx.restore();
}

/** The outline always shows the exact marked tiles. Only the fill counts up. */
export function drawBossTelegraph(ctx, h, ox, oy, timeMs, detail, calm) {
  const age = timeMs - h.start, k = clamp01(age / h.dur);
  const x = (h.cx - h.r) * TILE - ox, y = (h.cy - h.r) * TILE - oy, w = (h.r * 2 + 1) * TILE;
  const pulse = calm ? 0.5 : hazardPulse(age, h.dur);
  const cx = x + w / 2, cy = y + w / 2;
  ctx.save();
  ctx.globalAlpha = hazardIn(age);
  ctx.fillStyle = `rgba(226,55,81,${0.2 + pulse * 0.08})`;
  ctx.fillRect(x, y, w, w);
  const iw = w * k;
  ctx.fillStyle = `rgba(180,47,49,${0.22 + k * 0.28})`;
  ctx.fillRect(cx - iw / 2, cy - iw / 2, iw, iw);
  if (detail) {
    const edge = Math.min(8, w * 0.12);
    ctx.fillStyle = '#54253644';
    ctx.fillRect(x + 2, y + w - edge, w - 4, edge - 2);
    ctx.fillRect(x + w - edge, y + 2, edge - 2, w - edge - 2);
    if (h.sign !== false) fxGlow(ctx, cx, cy, w * 0.44, w * 0.44, '#ff7751', 0.28 * smooth(k), 'source-over');
  }
  // Cream and navy stay legible on grass, paving and water.
  ctx.strokeStyle = '#FFF8E9'; ctx.lineWidth = 3.5;
  ctx.strokeRect(x + 2, y + 2, w - 4, w - 4);
  ctx.setLineDash([6, 4]); ctx.lineDashOffset = calm ? 0 : -timeMs * 0.02;
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, w - 4, w - 4);
  ctx.setLineDash([]);
  if (h.safe) drawSafeZone(ctx, h, ox, oy, timeMs, TILE, detail, calm);
  const centreSafe = h.safe && Math.hypot(h.cx - h.safe.cx, h.cy - h.safe.cy) <= h.safe.r + 0.5;
  if (h.sign !== false && !centreSafe) drawDangerMark(ctx, cx, cy, 8 + pulse);
  ctx.restore();
}

/** The shockwave is painted into the terrain, so the camera tilts it with the floor. */
export function drawBossShockwave(ctx, e, ox, oy, detail) {
  const x = e.x - ox, y = e.y - oy, t = fxProgress(e);
  ctx.save();
  if (e.safe) {
    const sx = (e.safe.cx + 0.5) * TILE - ox, sy = (e.safe.cy + 0.5) * TILE - oy, r = (e.safe.r + 0.5) * TILE;
    const pad = e.r * 1.22 + 5;
    ctx.beginPath(); ctx.rect(x - pad, y - pad, 2 * pad, 2 * pad);
    ctx.moveTo(sx + r, sy); ctx.arc(sx, sy, r, 0, TAU);
    ctx.clip('evenodd');
  }
  fxWave(ctx, x, y, e.r, 1, e.color || BLAST, t, detail);
  ctx.restore();
}

/** Short airborne shards sit above the wave, on the same depth as their base. */
export function drawBossBlastSparks(ctx, e, ox, oy, pj, calm) {
  const t = fxProgress(e), spread = easeOut(t), a = fxFade(t);
  const n = e.r <= TILE ? 4 : 7, h = (calm ? 8 : 24) * Math.sin(Math.PI * t);
  const col = e.color || BLAST;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ang = i / n * TAU + (e.x + e.y) * 0.008;
    const r = e.r * (0.32 + spread * (0.36 + (i % 3) * 0.09));
    const wx = e.x + Math.cos(ang) * r, wy = e.y + Math.sin(ang) * r;
    if (e.safe && Math.hypot(wx - (e.safe.cx + 0.5) * TILE, wy - (e.safe.cy + 0.5) * TILE) < (e.safe.r + 0.5) * TILE) continue;
    const x = wx - ox, y = wy - oy, height = h * (0.65 + (i % 3) * 0.18);
    if (pj) {
      const p = projectFlat(pj, x, y, _from);
      applyScreen(ctx, pj);
      ctx.translate(p.x, p.y); ctx.scale(p.s, p.s);
    } else ctx.translate(x, y);
    ctx.globalAlpha = a * 0.85; ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 0.75;
    ctx.beginPath(); ctx.moveTo(-3, -height + 3); ctx.lineTo(0, -height - 4); ctx.lineTo(2.5, -height + 1);
    ctx.lineTo(1, -height + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff3cd'; ctx.fillRect(-0.95, -height - 1.5, 1.1, 3);
    if (!pj) ctx.translate(-x, -y);
  }
  ctx.restore();
}
