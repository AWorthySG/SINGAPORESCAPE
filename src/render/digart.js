// Archaeology's pictures until the painted ones arrive: a dig site (a square
// trench in the earth, pegged out with string, a shard peeking out in the
// site's colour) and the restoration bench. Sticker style: navy ink #22304A,
// pastel fills. A few paths a frame, no garbage.
const INK = '#22304A';

/** A dig site at tile centre (cx, cy). */
export function drawDigSite(ctx, obj, cx, cy) {
  const col = obj.def.color || '#c8a070';
  // The trench: dug-over earth, darker inside.
  ctx.fillStyle = '#b8936a'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.rect(cx - 11, cy - 3, 22, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6a48';
  ctx.fillRect(cx - 8, cy, 16, 8);
  // A find peeking out, in the site's colour.
  ctx.fillStyle = col; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx + 2, cy + 5, 4, 2.4, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Pegs at the corners, and the string between them.
  ctx.strokeStyle = '#f4ecd8'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.rect(cx - 11, cy - 3, 22, 14); ctx.stroke();
  ctx.fillStyle = '#e8c070'; ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
  for (const [x, y] of [[-11, -3], [11, -3], [-11, 11], [11, 11]]) { ctx.beginPath(); ctx.rect(cx + x - 1.2, cy + y - 5, 2.4, 6); ctx.fill(); ctx.stroke(); }
}

/** The restoration bench at tile centre (cx, cy): a table with a brush and a little pot on it. */
export function drawRestoreBench(ctx, cx, cy) {
  ctx.fillStyle = 'rgba(34,48,74,0.18)';
  ctx.beginPath(); ctx.ellipse(cx, cy + 11, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  ctx.fillStyle = '#9a6a44';
  ctx.beginPath(); ctx.rect(cx - 10, cy + 1, 3, 10); ctx.rect(cx + 7, cy + 1, 3, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c89a6a';
  ctx.beginPath(); ctx.rect(cx - 13, cy - 3, 26, 5); ctx.fill(); ctx.stroke();
  // A little restored pot and a brush.
  ctx.fillStyle = '#e88a5a';
  ctx.beginPath(); ctx.ellipse(cx - 4, cy - 7, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f4e4c0';
  ctx.beginPath(); ctx.rect(cx + 3, cy - 6, 7, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a4a3a'; ctx.fillRect(cx + 9, cy - 6.5, 2.5, 3);
}
