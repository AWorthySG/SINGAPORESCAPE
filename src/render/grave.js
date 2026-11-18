// The gravestone left where you last fell (see game/playbalance.js), drawn
// procedurally in the sticker style: a rounded grey headstone with a navy ink
// outline (no white border), a little cross, a grassy mound, and a soft pulse
// so it is easy to spot on the way back. (No painted art for it yet.)

const INK = '#22304A';

/** Draw the gravestone with its base centre at (x, y) on screen. */
export function drawGrave(ctx, x, y, timeMs = 0) {
  if (!ctx) return;
  ctx.save();
  // A soft glow on the ground that pulses gently, so you can find it again.
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 420);
  ctx.globalAlpha = 0.25 + 0.2 * pulse;
  ctx.fillStyle = '#bfe8ff';
  ctx.beginPath(); ctx.ellipse(x, y, 15 + pulse * 2, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // Mound.
  ctx.fillStyle = '#8fbf6a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y - 1, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Headstone: just the stone and its navy ink line (no white border, like all world art).
  const stone = (pad) => {
    const w = 16 + pad * 2, h = 20 + pad, l = x - w / 2, t = y - 2 - h;
    ctx.beginPath();
    ctx.moveTo(l, y - 2); ctx.lineTo(l, t + w / 2);
    ctx.arc(x, t + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(l + w, y - 2); ctx.closePath();
  };
  ctx.fillStyle = '#b9c2cf'; stone(0); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(x - 3, y - 15, 3.5, 0, Math.PI * 2); ctx.fill();
  // Cross.
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 7); ctx.moveTo(x - 4, y - 14); ctx.lineTo(x + 4, y - 14); ctx.stroke();
  ctx.restore();
}
