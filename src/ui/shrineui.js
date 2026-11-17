// The Offering Shrine's "Offer other items" part (rules in src/game/offerings.js):
// every good in the pack with the points it gives, and "Offer all…" by kind
// (materials included), each with an in-window confirmation like the salvage
// windows'. ui.openOfferingShrine draws the rest of the window.
import { getItem } from '../data/items.js';
import { formatNumber } from '../core/utils.js';
import { itemIconSVG } from '../render/icons.js';
import { GOODS_KINDS, goodsKind, shrineGoods, goodsRefusal, goodsPoints, offerGoods, pointsText, bulkGoods, offerAllGoods } from '../game/offerings.js';
import { button, confirmBox } from './salvageui.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const name = (id) => esc(getItem(id).name);

/** Ask (in the window) to offer up to `qty` of a good. */
export function askGoods(ui, st, id, qty) {
  const g = ui.game, why = goodsRefusal(g, id);
  if (why) { st.result = esc(why); return; }
  const n = Math.min(qty, g.inventory.count(id));
  if (n <= 0) return;
  st.pending = {
    html: `Offer ${formatNumber(n)} x <b>${name(id)}</b> at the shrine: <b>+${pointsText(n * goodsPoints(id))} shrine points</b>.`,
    warn: GOODS_KINDS[goodsKind(id)]?.bulk === false ? 'you may still need it' : '',
    label: 'Offer',
    go: () => { const pts = offerGoods(g, id, n); return `Offered ${formatNumber(n)} x ${name(id)}: <b>+${formatNumber(pts)} shrine points</b>.`; },
  };
}

/** Draw the goods list and the "Offer all…" buttons into `body`. `st`: this part's { pending, result }. */
export function shrineGoodsSection(ui, body, st, rerender) {
  const g = ui.game;
  body.insertAdjacentHTML('beforeend', '<div class="ench-head shrine-head">Offer other items</div>'
    + '<div class="modal-hint">Anything else from your pack: food, potions, runes, arrows, bones, seeds and the rest, '
    + `for a 25th of what a material of the same value gives (1 point per ${formatNumber(250)} coins of value). Not coins, tokens, or what a quest still needs.</div>`);
  confirmBox(body, st, rerender);
  const list = document.createElement('div');
  list.className = 'gear-list feed-list salvage-list';
  const opts = shrineGoods(g);
  if (!opts.length) list.innerHTML = '<div class="modal-hint">You carry nothing else the shrine would take.</div>';
  for (const o of opts) {
    const row = document.createElement('div');
    row.className = 'gear-row feed-row salvage-row';
    row.innerHTML = `<span class="gear-ic">${itemIconSVG(o.id, 28)}</span>`
      + `<div class="gear-info"><div class="gear-name"><b>${name(o.id)}</b><span class="gear-tag">x${formatNumber(o.count)}</span><span class="gear-tag">${esc(GOODS_KINDS[o.kind].name)}</span></div>`
      + `<div class="gear-stats">${pointsText(o.per)} points each (${pointsText(o.per * o.count)} for all)</div></div>`;
    const btns = document.createElement('div');
    btns.className = 'qty-btns';
    const keepBack = !GOODS_KINDS[o.kind].bulk;   // tools and enchanting supplies: always ask first
    for (const [label, n] of [['1', 1], ['10', 10], ['All', o.count]]) {
      if (label === '10' ? o.count <= 10 : label === 'All' && o.count === 1) continue;
      btns.appendChild(button(label, () => {
        if (keepBack || label === 'All') askGoods(ui, st, o.id, n);
        else offerGoods(g, o.id, n);
        rerender();
      }, 'small'));
    }
    row.appendChild(btns);
    list.appendChild(row);
  }
  body.appendChild(list);

  // Offer all of a kind, keeping back a few of each if asked.
  body.insertAdjacentHTML('beforeend', '<div class="ench-head salvage-head">Offer all…</div>');
  const f = ui._shrineGoodsFilter || (ui._shrineGoodsFilter = { keep: 5 });
  const box = document.createElement('div');
  box.className = 'salvage-filters';
  box.innerHTML = 'Keep back <select>' + [[0, 'none'], [1, '1 of each'], [5, '5 of each'], [28, '28 of each'], [100, '100 of each']]
    .map(([v, t]) => `<option value="${v}"${f.keep === v ? ' selected' : ''}>${t}</option>`).join('') + '</select>'
    + '<div class="modal-hint">Never gear (it has its own "Offer all spare gear"), tools, enchanting supplies, or anything a quest needs.</div>';
  box.querySelector('select').addEventListener('change', (e) => { f.keep = Number(e.target.value); rerender(); });
  body.appendChild(box);
  const kinds = document.createElement('div');
  kinds.className = 'shrine-bulk';
  for (const kind of ['material', ...Object.keys(GOODS_KINDS).filter((k) => GOODS_KINDS[k].bulk)]) {
    const picks = bulkGoods(g, kind, f);
    if (!picks.length) continue;
    const items = picks.reduce((t, p) => t + p.n, 0), pts = picks.reduce((t, p) => t + p.points, 0);
    const label = kind === 'material' ? 'Materials' : GOODS_KINDS[kind].name;
    kinds.appendChild(button(`${label}<br><span>${formatNumber(items)} for +${pointsText(pts)}</span>`, () => {
      st.pending = {
        html: `Offer <b>${formatNumber(items)} ${esc(label.toLowerCase())}</b> (${picks.length} kind${picks.length > 1 ? 's' : ''}${f.keep ? `, keeping ${f.keep} of each` : ''}) at the shrine: <b>+${pointsText(pts)} shrine points</b>.`,
        warn: '',
        label: 'Offer all',
        go: () => { const r = offerAllGoods(g, kind, f); return `Offered <b>${formatNumber(r.items)}</b> ${esc(label.toLowerCase())}: <b>+${formatNumber(r.points)} shrine points</b>.`; },
      };
      rerender();
    }, 'small shrine-bulk-kind'));
    kinds.lastChild.dataset.kind = kind;
  }
  if (!kinds.children.length) kinds.innerHTML = '<div class="modal-hint">Nothing to offer in bulk.</div>';
  body.appendChild(kinds);
}
