// Offering one item at the Offering Shrine in a single tap or key press: the
// Offer / 10 / All buttons on every row of the shrine window, the bag's
// "Offer at shrine" menu items, and the hotkeys (ui._initWindowHotkeys: point
// at a row, or at an item in your bag while the window is open, and press 1, 5,
// X (10) or A (all)).
//
// Everything goes at once, boss uniques and signature weapons included: the
// owner plays on a phone and wanted one tap, no confirmation. Only "Offer all
// spare gear…" and "Offer all…" by kind, which take many kinds at once, still
// ask first.
import { getItem } from '../data/items.js';
import { formatNumber } from '../core/utils.js';
import { isSalvageable, previewOffer, offerGear } from '../game/salvage.js';
import { materialPoints } from '../game/materials.js';
import { goodsRefusal, goodsPoints, offerGoods, pointsText } from '../game/offerings.js';

/** The window's hint lines: one for taps (every device), one for the keys
 *  (hidden on touch screens, as the shop's is). */
export const TAP_HINT = 'Tap <b>Offer</b>, <b>10</b> or <b>All</b> on any row to offer it at once, or long-press an item in your bag: <b>Offer at shrine</b>.';
export const HOT_HINT = 'Or point at a row, or at an item in your bag, and press <kbd>1</kbd> <kbd>5</kbd> <kbd>X</kbd> (10) or <kbd>A</kbd> (all).';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Offer `n` (Infinity: all) of `id` at once. `st`: the gear part's
 *  { pending, result }, `stGoods`: the other items part's (each gets the
 *  result line). Returns 'offered', or '' when nothing went. */
export function hotOffer(ui, st, stGoods, id, n) {
  const g = ui.game, have = g.inventory.count(id);
  if (!id || have <= 0) return '';
  const qty = n === Infinity ? have : Math.min(n, have);
  if (isSalvageable(id)) {
    const pv = previewOffer(g, id, qty);
    if (!pv.n) { st.pending = null; st.result = 'You can\'t offer gear you are wearing: take it off first.'; return ''; }
    const pts = offerGear(g, id, qty);
    st.pending = null;
    st.result = pts ? `Offered ${pv.n} x <b>${esc(getItem(id).name)}</b>: <b>+${formatNumber(pts)} shrine points</b>.` : 'Nothing was offered.';
    return pts ? 'offered' : '';
  }
  if (materialPoints(id)) return g.donateToShrine(id, qty) ? 'offered' : '';
  const why = goodsRefusal(g, id);
  if (why) { stGoods.pending = null; stGoods.result = esc(why); return ''; }
  const pts = qty * goodsPoints(id);
  offerGoods(g, id, qty);
  stGoods.pending = null;
  stGoods.result = `Offered ${formatNumber(qty)} x <b>${esc(getItem(id).name)}</b>: <b>+${pointsText(pts)} shrine points</b>.`;
  return 'offered';
}

