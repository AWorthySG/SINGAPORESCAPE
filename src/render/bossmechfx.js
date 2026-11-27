// Drawing for boss mechanics (src/game/bossmech.js): the cast bar, the
// healers' green beam and the safe circle.
// Simple procedural shapes in the sticker palette: no new art needed.

const INK = '#22304A';

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
export function drawBossMech(ctx, n, cx, cy, sc, timeMs, ox, oy) {
  const m = n.mech;
  if (n.mechHealer && n.mechHealer.alive) drawBeam(ctx, n, cx, cy, ox, oy, timeMs);
  if (!m) return;
  if (m.type === 'cast') drawCastBar(ctx, m, cx, cy - 34 * sc - 10);
}

function drawCastBar(ctx, m, cx, y) {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  const k = Math.max(0, Math.min(1, (now - m.start) / m.dur));
  const w = 54, h = 8, x = cx - w / 2;
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = k > 0.75 ? '#e04a3a' : '#9a6ae8';
  ctx.fillRect(x, y, w * k, h);
  ctx.font = '900 10px Nunito,"Trebuchet MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.fillStyle = INK;
  ctx.strokeText(m.md.name, cx, y - 3); ctx.fillText(m.md.name, cx, y - 3);
  ctx.restore();
}

function drawBeam(ctx, n, cx, cy, ox, oy, timeMs) {
  const b = n.mechHealer.renderCenter();
  const bx = b.x - ox, by = b.y - oy;
  ctx.save();
  ctx.strokeStyle = '#5fe08a'; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
  ctx.setLineDash([6, 5]); ctx.lineDashOffset = -timeMs * 0.04;
  ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(bx, by - 6); ctx.stroke();
  ctx.setLineDash([]);
  // A little green cross over the healer.
  ctx.globalAlpha = 1; ctx.fillStyle = '#5fe08a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  const y = cy - 26;
  ctx.beginPath();
  ctx.rect(cx - 2.5, y - 7, 5, 14); ctx.rect(cx - 7, y - 2.5, 14, 5);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** The green circle in a safe-circle hazard (drawn over its red). */
export function drawSafeZone(ctx, h, ox, oy, timeMs, TILE) {
  const s = h.safe;
  const cx = (s.cx + 0.5) * TILE - ox, cy = (s.cy + 0.5) * TILE - oy, r = (s.r + 0.5) * TILE;
  const pulse = 0.5 + Math.sin(timeMs * 0.012) * 0.5;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(95,224,138,${(0.45 + pulse * 0.15).toFixed(3)})`;
  ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = '#FFF8E9'; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#22543C'; ctx.stroke();
  ctx.font = '900 12px Nunito,"Trebuchet MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#1f6a3a';
  ctx.strokeText('SAFE', cx, cy); ctx.fillText('SAFE', cx, cy);
  ctx.restore();
}
