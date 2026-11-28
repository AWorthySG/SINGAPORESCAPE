// Let players show through the upper floors when they walk behind the
// shophouse rows at Kampong Glam's south gate.
const SHOPS = new Set(['shophouse_row_mint', 'shophouse_row_peach']);

export const isDepthShop = (obj) => SHOPS.has(obj.objId);

// Source slices keep the trunk or front wall opaque as you walk behind it.
export function drawLayeredObject(ctx, img, x, y, w, h, alpha, solidPart) {
  // Recoloured scenery may come from a cached canvas.
  const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
  const top = Math.round(sh * (1 - solidPart));
  const topH = h * top / sh;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, 0, 0, sw, top, x, y, w, topH);
  ctx.restore();
  ctx.drawImage(img, 0, top, sw, sh - top, x, y + topH, w, h - topH);
}
