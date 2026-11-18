// The kampong home's window (home.js): buy the plot and its upgrades, the
// storage chest, and the trophy wall; plus a small HOME button by the map that
// teleports you home once the plot is yours. Every tappable thing is a
// <button>, so phone sheets don't swallow taps. Does nothing without a DOM.
import { getItem, ITEMS } from '../data/items.js';
import { formatNumber } from '../core/utils.js';
import { itemIconSVG } from '../render/icons.js';
import { HOME_PRICE, HOME_UPGRADES, UPGRADE_KEYS, costText } from '../game/home.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TABS = [{ id: 'plot', name: 'House' }, { id: 'chest', name: 'Chest' }, { id: 'trophy', name: 'Trophies' }];

function plotHTML(game) {
  const h = game.home;
  if (!h.owned) {
    return `<div class="home-intro">A plot of Kranji farmland with room for a kampong house: your own storage chest, a cooking range, a hearth that never goes out, farm patches, a trophy wall and a teleport home.</div>`
      + `<button type="button" class="wm-go home-buy" data-buy="1"${h.canPay({ coins: HOME_PRICE }) ? '' : ' disabled'}>Buy the plot: ${formatNumber(HOME_PRICE)} coins</button>`;
  }
  const wait = h.tpWait();
  let html = `<div class="home-row"><span><b>Teleport home</b>${wait ? ` · recharging, ${Math.ceil(wait * 0.6)}s` : ' · ready'} (${esc(HOME_UPGRADES.portal.tiers[h.tiers.portal].desc.toLowerCase())})</span>`
    + `<button type="button" class="wm-go" data-tp="1"${wait ? ' disabled' : ''}>Go home</button></div>`;
  html += '<div class="home-sub">Upgrades (materials come from your pack, then the bank)</div>';
  for (const k of UPGRADE_KEYS) {
    const line = HOME_UPGRADES[k], now = line.tiers[h.tiers[k]], next = h.nextTier(k);
    html += `<div class="home-row"><span><b>${esc(line.name)}: ${esc(now.name)}</b><small>${esc(now.desc || '')}</small>`
      + (next ? `<small>Next: <b>${esc(next.name)}</b> (${esc(next.desc)}) for ${esc(costText(next.cost))}</small>` : '<small>Fully upgraded</small>') + '</span>'
      + (next ? `<button type="button" class="wm-go" data-up="${k}"${h.canPay(next.cost) ? '' : ' disabled'}>Upgrade</button>` : '') + '</div>';
  }
  return html;
}

function chestHTML(game) {
  const h = game.home;
  if (!h.owned) return '<div class="home-intro">Buy the plot to get a storage chest.</div>';
  const cell = (id, qty, attr) => `<button type="button" class="home-cell" ${attr}="${esc(id)}" title="${esc(getItem(id).name)}">${itemIconSVG(id, 30)}<span>${formatNumber(qty)}</span></button>`;
  const bag = new Map();
  for (const s of game.inventory.slots) if (s && s.id !== 'coins' && ITEMS[s.id]) bag.set(s.id, (bag.get(s.id) || 0) + s.qty);
  return `<div class="home-sub">In the chest: ${h.chest.length} of ${h.capacity} kinds. Tap to take out.</div>`
    + `<div class="home-grid">${h.chest.map((e) => cell(e.id, e.qty, 'data-out')).join('') || '<span class="modal-hint">Empty.</span>'}</div>`
    + '<div class="home-sub">Your pack. Tap to put away (all of that item).</div>'
    + `<div class="home-grid">${[...bag].map(([id, q]) => cell(id, q, 'data-in')).join('') || '<span class="modal-hint">Nothing to put away.</span>'}</div>`
    + '<button type="button" class="wm-go" data-bank="1">Open your bank</button>';
}

function trophyHTML(game) {
  const t = game.home.trophies();
  return '<div class="home-sub">Boss kills</div>'
    + (t.bosses.length ? t.bosses.map((b) => `<div class="home-row"><span><b>${esc(b.name)}</b></span><span>${formatNumber(b.kills)}</span></div>`).join('') : '<div class="modal-hint">No bosses beaten yet.</div>')
    + '<div class="home-sub">Rare finds (boss signature weapons you own)</div>'
    + (t.rares.length ? `<div class="home-grid">${t.rares.map((r) => `<span class="home-cell" title="${esc(r.name)}">${itemIconSVG(r.id, 30)}</span>`).join('')}</div>` : '<div class="modal-hint">None yet.</div>');
}

/** Open the home window at a tab ('plot', 'chest' or 'trophy'). */
export function openHome(ui, tab = 'plot') {
  const game = ui.game;
  let cur = tab;
  const render = (body) => {
    body.innerHTML = `<div class="sgx-chips home-tabs">${TABS.map((t) => `<button type="button" class="sgx-chip${t.id === cur ? ' on' : ''}" data-tab="${t.id}">${t.name}</button>`).join('')}</div>`
      + `<div class="home-body">${cur === 'chest' ? chestHTML(game) : cur === 'trophy' ? trophyHTML(game) : plotHTML(game)}</div>`;
    body.onclick = (ev) => {
      const b = ev.target.closest?.('button');
      if (!b || ui.modal?.kind !== 'home') return;
      const d = b.dataset, h = game.home;
      if (d.tab) cur = d.tab;
      else if (d.buy) h.buy();
      else if (d.up) h.upgrade(d.up);
      else if (d.tp) { h.teleport(); return; }
      else if (d.in) h.deposit(d.in);
      else if (d.out) h.withdraw(d.out);
      else if (d.bank) { ui.openBank(); return; }
      const sc = body.scrollTop; render(body); body.scrollTop = sc;
    };
  };
  ui.openModal('Kampong home', render);
  ui.modal.kind = 'home';
}

/** Wire the home window to the game (once, from UI.init). */
export function installHomeUI(ui) {
  if (typeof document === 'undefined' || ui._homeUI) return;
  ui._homeUI = true;
  const game = ui.game;
  const panel = document.getElementById('minimap-panel');
  let btn = null;
  if (panel) {
    btn = document.createElement('button');
    btn.id = 'home-btn';
    btn.type = 'button';
    btn.title = 'Teleport to your kampong home';
    btn.textContent = 'HOME';
    btn.addEventListener('click', () => game.home?.teleport());
    panel.appendChild(btn);
  }
  const sync = () => { if (btn) btn.classList.toggle('hidden', !game.home?.owned); };
  sync();
  ui.bus.on('homeopen', (tab) => openHome(ui, tab));
  ui.bus.on('home', () => {
    sync();
    if (ui.modal?.kind === 'home' && ui.el?.modalBody) { const b = ui.el.modalBody, sc = b.scrollTop; ui.modal.render(b); b.scrollTop = sc; }
  });
}
