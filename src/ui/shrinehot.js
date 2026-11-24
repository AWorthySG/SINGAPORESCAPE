// Offering Shrine hotkeys for single items (ui._initWindowHotkeys): point at a
// row of the shrine window, or at an item in your bag while the window is open,
// and press 1, 5, X (10) or A (all) to offer it.
//
// Materials and plain goods go at once, as the materials list always has.
// Gear goes at once too, unless the piece is one you would want to think about
// first (a boss unique or signature weapon, an Epic copy or better, or better
// than what you wear: salvageWarning): then the first press puts up the usual
// confirmation and a second press of the same key offers it. Tools and
// enchanting supplies (goods "Offer all" keeps back) ask the same way.
import { getItem } from '../data/items.js';
import { formatNumber } from '../core/utils.js';
import { isSalvageable, salvageWarning, previewOffer, offerGear } from '../game/salvage.js';
import { materialPoints } from '../game/materials.js';
import { GOODS_KINDS, goodsKind, goodsRefusal, goodsPoints, offerGoods, pointsText } from '../game/offerings.js';
import { askOffer } from './salvageui.js';
import { askGoods } from './shrineui.js';

/** The window's hint line (it lists the keys). */
export const HOT_HINT = 'Point at anything in the list, or in your bag, and press <kbd>1</kbd> <kbd>5</kbd> <kbd>X</kbd> (10) or <kbd>A</kbd> (all) to offer it. '
  + 'Boss uniques, signature weapons, Epic or better pieces, gear better than yours, tools and enchanting supplies ask first: press the key again to offer.';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Offer `n` (Infinity: all) of `id` from a hotkey. `st`: the gear part's
 *  { pending, result }, `stGoods`: the other items part's. Returns what
 *  happened: 'offered', 'asked' (a confirmation is up: press again), or ''. */
export function hotOffer(ui, st, stGoods, id, n) {
  const g = ui.game, have = g.inventory.count(id);
  if (!id || have <= 0) return '';
  const qty = n === Infinity ? have : Math.min(n, have);
  const key = `${id}:${qty}`;
  if (isSalvageable(id)) {
    const pv = previewOffer(g, id, qty);
    if (!pv.n) { st.pending = null; st.result = 'You can\'t offer gear you are wearing: take it off first.'; return ''; }
    if (salvageWarning(g, id, pv.copies[pv.copies.length - 1])) return confirmOrAsk(st, key, () => askOffer(ui, st, id, qty));
    const pts = offerGear(g, id, qty);
    st.pending = null;
    st.result = pts ? `Offered ${pv.n} x <b>${esc(getItem(id).name)}</b>: <b>+${formatNumber(pts)} shrine points</b>.` : 'Nothing was offered.';
    return pts ? 'offered' : '';
  }
  if (materialPoints(id)) return g.donateToShrine(id, qty) ? 'offered' : '';
  const why = goodsRefusal(g, id);
  if (why) { stGoods.pending = null; stGoods.result = esc(why); return ''; }
  if (GOODS_KINDS[goodsKind(id)]?.bulk === false) return confirmOrAsk(stGoods, key, () => askGoods(ui, stGoods, id, qty));
  const pts = qty * goodsPoints(id);
  offerGoods(g, id, qty);
  stGoods.pending = null;
  stGoods.result = `Offered ${formatNumber(qty)} x <b>${esc(getItem(id).name)}</b>: <b>+${pointsText(pts)} shrine points</b>.`;
  return 'offered';
}

// A second press of the same key on the same item offers what the first asked
// about; any other press asks afresh (and replaces the old question).
function confirmOrAsk(s, key, ask) {
  if (s.pending?.hot === key) {
    const go = s.pending.go;
    s.pending = null;
    s.result = go();
    return 'offered';
  }
  s.result = null;
  ask();
  if (s.pending) s.pending.hot = key;
  return s.pending ? 'asked' : '';
}
