// The shophouse rows at Kampong Glam's south gate occupy an existing footprint.
// Draw the top, front and short end of their raised pavement in world units.
const SHOPS = new Set(['shophouse_row_mint', 'shophouse_row_peach']);

export const isDepthShop = (obj) => SHOPS.has(obj.objId) && obj.y >= 64 && obj.y <= 86 && obj.x >= 42 && obj.x <= 74;

export function drawShopStep(ctx, cx, foot, width) {
  const half = width * 0.42, left = cx - half, right = cx + half, apron = foot + 7;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx + 2, apron + 4, half + 2, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34,48,74,.22)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(left, foot - 5); ctx.lineTo(right - 4, foot - 5);
  ctx.lineTo(right, apron); ctx.lineTo(left - 5, apron); ctx.closePath();
  ctx.fillStyle = '#E6CFAF'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(left - 5, apron); ctx.lineTo(right, apron);
  ctx.lineTo(right, apron + 4); ctx.lineTo(left - 5, apron + 4); ctx.closePath();
  ctx.fillStyle = '#A8846E'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(right - 4, foot - 5); ctx.lineTo(right, apron);
  ctx.lineTo(right, apron + 4); ctx.lineTo(right - 4, foot - 1); ctx.closePath();
  ctx.fillStyle = '#917361'; ctx.fill();
  ctx.strokeStyle = 'rgba(93,68,56,.36)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = left + 12; x < right - 10; x += 18) { ctx.moveTo(x, foot - 4); ctx.lineTo(x - 2, apron); }
  ctx.stroke();
  ctx.restore();
}

// Source slices keep the trunk or front wall opaque as you walk behind it.
export function drawLayeredObject(ctx, img, x, y, w, h, alpha, solidPart) {
  const top = Math.round(img.naturalHeight * (1 - solidPart));
  const topH = h * top / img.naturalHeight;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, 0, 0, img.naturalWidth, top, x, y, w, topH);
  ctx.restore();
  ctx.drawImage(img, 0, top, img.naturalWidth, img.naturalHeight - top, x, y + topH, w, h - topH);
}
