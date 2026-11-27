// Your hawker stall's window (Hawkering, hawkerstall.js). Three tabs, every
// tappable thing a finger-sized <button>:
//   Stall  rent it, open up, auto-serve on or off, and the queue: each customer
//          a card with their portrait, their order (have/need), a patience bar
//          and a Serve button.
//   Wok    the signature dishes you cook at the stall (the shared recipe menu).
//   Menu   what customers can order, level by level: the price, the XP a serve
//          and the XP an hour with auto-serve.
// Redraws on the game's 'hawker' event. Does nothing without a DOM.
import { getItem } from '../data/items.js';
import { formatNumber } from '../core/utils.js';
import { itemIconSVG, skillIconSVG } from '../render/icons.js';
import { townArtSrc } from '../render/sprites.js';
import { ORDERS, STALL_RENT, VIP_LEVEL, SERVICE } from '../data/hawkering.js';
import { TICK_MS } from '../config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TABS = [{ id: 'stall', name: 'Stall' }, { id: 'wok', name: 'Wok' }, { id: 'menu', name: 'Menu' }];
const short = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : formatNumber(Math.round(n)));
const stars = (n) => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '') + '☆'.repeat(5 - Math.ceil(n));
const portrait = (id) => {
  const src = townArtSrc(id);
  return src ? `<img class="hwk-face" src="${esc(src)}" alt="" loading="lazy">` : '<span class="hwk-face">🙂</span>';
};

/** A serve's XP now (as Skills.addXp adds it), and about that an hour with auto-serve. */
function xpFigures(game, id) {
  const h = game.hawker, each = game.skills.xpAtLevel('hawkering', h.xpFor(id));
  return { each, hour: each * (3600000 / TICK_MS) / h.service().ticks };
}

function stallHTML(game) {
  const h = game.hawker;
  if (!h.rented) {
    return '<div class="home-intro">Rent your own stall at the Marina Bay hawker centre. Townsfolk queue with orders: serve them dishes you have cooked (from your pack, or your bank: a runner fetches them) for coins, tips and Hawkering XP.</div>'
      + `<button type="button" class="wm-go home-buy" data-rent="1"${game.inventory.count('coins') >= STALL_RENT ? '' : ' disabled'}>Rent the stall: ${formatNumber(STALL_RENT)} coins</button>`;
  }
  const open = h.isOpen(), svc = h.service();
  let html = `<div class="home-row"><span class="hwk-head">${skillIconSVG('hawkering', 26)}<span><b>Hawkering ${h.level} · <span class="hwk-stars" title="Reputation ${Math.round(h.rep)} of 100">${stars(h.stars())}</span></b>`
    + `<small>${svc.counters} counters · a serve every ${(svc.ticks * TICK_MS / 1000).toFixed(1)}s · streak ${h.streak}${h.bestStreak ? ` (best ${h.bestStreak})` : ''}</small></span></span>`
    + (open ? '<button type="button" class="wm-go" data-close="1">Close up</button>' : '<button type="button" class="wm-go" data-open="1">Open up</button>') + '</div>';
  html += `<div class="home-row"><span><b>Auto-serve</b><small>${game.autoGather ? 'On: serving from what you carry, best first.' : 'Off: tap Serve for each customer.'}</small></span>`
    + `<button type="button" class="wm-go${game.autoGather ? ' on' : ''}" data-auto="1">${game.autoGather ? 'Turn off' : 'Turn on'}</button></div>`;
  if (h.today.served) html += `<div class="home-sub">This session: ${formatNumber(h.today.served)} served, ${formatNumber(h.today.coins)} coins (${formatNumber(h.today.tips)} in tips)${h.today.walked ? `, ${h.today.walked} walked off` : ''}</div>`;
  if (!open) return `${html}<div class="modal-hint">${h.menu().length ? 'Open up to start serving.' : 'You have nothing to sell: cook some dishes first (the Menu tab says what customers order).'}</div>`;
  if (!h.queue.length) return `${html}<div class="modal-hint">${h.menu().length ? 'Customers are on their way...' : 'You have run out of dishes to sell.'}</div>`;
  html += '<div class="hwk-queue">' + h.queue.map((c, i) => {
    const have = h.have(c.order) >= c.qty, left = Math.max(0, c.patience / c.max);
    return `<div class="hwk-cust${c.vip ? ' vip' : ''}">${portrait(c.npcId)}<span class="hwk-txt"><b>${esc(c.name)}${c.vip ? ' <i>VIP</i>' : ''}</b>`
      + `<small>${itemIconSVG(c.order, 18)} ${c.qty > 1 ? `${c.qty} x ` : ''}${esc(getItem(c.order).name)}${have ? '' : ' (you have none)'}</small>`
      + `<span class="hwk-pat"><span style="width:${Math.round(left * 100)}%" class="${left < 0.3 ? 'low' : ''}"></span></span></span>`
      + `<button type="button" class="wm-go" data-serve="${i}"${have ? '' : ' disabled'}>Serve</button></div>`;
  }).join('') + '</div>';
  return html;
}

function menuHTML(game) {
  const h = game.hawker, lvl = h.level;
  const rows = ORDERS.map((o) => {
    const locked = o.level > lvl, x = xpFigures(game, o.id), have = h.have(o.id);
    return `<div class="sgx-spot${locked ? ' locked' : ''}"><span class="sgx-spot-ic">${itemIconSVG(o.id, 30)}<span class="sgx-spot-lv">${locked ? '&#128274;' : ''}${o.level}</span></span>`
      + `<span class="sgx-spot-txt"><b>${esc(getItem(o.id).name)}</b><small>${formatNumber(h.price(o.id))} coins + tip · you have ${formatNumber(have)}</small>`
      + `<small>${locked ? `Needs Hawkering ${o.level}` : `+${short(x.each)} xp a serve · ~${short(x.hour)} xp an hour on auto-serve`}</small></span></div>`;
  }).join('');
  const svc = (s) => `${s.counters} counters, a serve every ${(s.ticks * TICK_MS / 1000).toFixed(1)}s`;
  const next = SERVICE.find((s) => s.level > lvl);
  return `<div class="modal-hint">Customers order the best dish you have that your level allows (pack and bank). VIP regulars come by from level ${VIP_LEVEL} with special orders and big tips.`
    + ` Now: ${svc(h.service())}.${next ? ` At level ${next.level}: ${svc(next)}.` : ''}</div>`
    + `<div class="sgx-spots">${rows}</div>`;
}

/** Open the stall window at a tab ('stall', 'wok' or 'menu'). */
export function openHawker(ui, tab = 'stall') {
  const game = ui.game;
  let cur = tab;
  if (cur === 'wok') { ui.openRecipeMenu('hawkering', game.hawker.obj); return; }
  const render = (body) => {
    body.innerHTML = `<div class="sgx-chips home-tabs">${TABS.map((t) => `<button type="button" class="sgx-chip${t.id === cur ? ' on' : ''}" data-tab="${t.id}">${t.name}</button>`).join('')}</div>`
      + `<div class="home-body">${cur === 'menu' ? menuHTML(game) : stallHTML(game)}</div>`;
    body.onclick = (ev) => {
      const b = ev.target.closest?.('button');
      if (!b || ui.modal?.kind !== 'hawker') return;
      const d = b.dataset, h = game.hawker;
      if (d.tab === 'wok') { ui.openRecipeMenu('hawkering', h.obj); return; }
      if (d.tab) cur = d.tab;
      else if (d.rent) h.rent();
      else if (d.open) h.open();
      else if (d.close) game.player.clearAction();
      else if (d.auto) game.toggleAutoGather();
      else if (d.serve) h.serve(Number(d.serve));
      const sc = body.scrollTop; render(body); body.scrollTop = sc;
    };
  };
  ui.openModal('Your hawker stall', render);
  ui.modal.kind = 'hawker';
}

/** Wire the stall window to the game (once, from UI.init). */
export function installHawkerUI(ui) {
  if (typeof document === 'undefined' || ui._hawkerUI) return;
  ui._hawkerUI = true;
  ui.bus.on('hawkeropen', (tab) => openHawker(ui, tab));
  // Redraw on the stall's news, at most a few times a second (a busy stall changes every tick).
  let queued = false;
  ui.bus.on('hawker', () => {
    if (ui.modal?.kind !== 'hawker' || queued) return;
    queued = true;
    setTimeout(() => { queued = false; if (ui.modal?.kind === 'hawker' && ui.el?.modalBody) { const b = ui.el.modalBody, sc = b.scrollTop; ui.modal.render(b); b.scrollTop = sc; } }, 150);
  });
}
