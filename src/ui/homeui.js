// The kampong home's window (home.js): buy the plot, build it up room by room
// with Construction (the Build tab), the storage chest, the portal arch and the
// trophy wall; plus a small HOME button by the map that teleports you home once
// the plot is yours. Every tappable thing is a <button>, so phone sheets don't
// swallow taps. Does nothing without a DOM.
//
// The Build tab: a chip for each room (a dot on those with something you can
// build now), then the chosen room's hotspots as cards. Each card says what
// stands there now and its perk, and the next build: the Construction level it
// needs, the XP it pays, the perk it adds, and each material as an icon with
// how many you have (pack and bank) against how many it takes.
import { displayIslandPrint, islandAlbumHTML } from './islandlifeui.js';
import { getItem, ITEMS } from '../data/items.js';
import { formatNumber } from '../core/utils.js';
import { itemIconSVG, playIconHTML, skillIconSVG } from '../render/icons.js';
import { HOME_PRICE, HOME_UPGRADES, ROOMS } from '../game/home.js';
import { makeXp } from '../game/skilling.js';

/** 1,234 / 12.3K / 4.5M / 1.2B: short enough for a pill. */
const shortXp = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : formatNumber(n));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TABS = [{ id: 'build', name: 'Build' }, { id: 'chest', name: 'Chest' }, { id: 'portals', name: 'Portals' }, { id: 'trophy', name: 'Trophies' }, { id: 'album', name: 'Album' }];

/** Has the player all it takes to build the next tier of `key` now? */
const canBuild = (game, key) => !game.home.whyNot(key);
const roomCanBuild = (game, room) => room.lines.some((k) => canBuild(game, k));

function buyHTML(game) {
  const h = game.home;
  return `<div class="home-intro">A plot of Kranji farmland with room for a kampong house: your own storage chest, a cooking range, a hearth that never goes out, farm patches, a trophy wall and a teleport home. Then build it up with Construction: a parlour, a workshop, an altar, a bedroom, a portal room and more.</div>`
    + `<button type="button" class="wm-go home-buy" data-buy="1"${h.canPay({ coins: HOME_PRICE }) ? '' : ' disabled'}>Buy the plot: ${formatNumber(HOME_PRICE)} coins</button>`;
}

/** One material chip: its icon and have/need, green when you have enough. */
function matChip(game, id, need) {
  const have = id === 'coins' ? game.inventory.count('coins') : game.inventory.count(id) + game.bank.count(id);
  const ok = have >= need;
  const name = id === 'coins' ? '' : ` <i>${esc(getItem(id).name)}</i>`;   // named: an icon alone is a guess on a phone
  return `<span class="bld-mat${ok ? ' ok' : ''}" title="${esc(getItem(id).name)}">${itemIconSVG(id, 22)}<span>${formatNumber(Math.min(have, need))}/${formatNumber(need)}${name}</span></span>`;
}

/** A hotspot's card: what stands there and the next build. */
function spotHTML(game, key) {
  const h = game.home, line = HOME_UPGRADES[key], now = line.tiers[h.tiers[key]], next = h.nextTier(key);
  let html = `<div class="bld-spot"><div class="bld-now"><b>${esc(line.name)}: ${esc(now.name)}</b><small>${esc(now.desc || '')}</small></div>`;
  if (!next) return `${html}<div class="bld-done">Fully built</div></div>`;
  const lvl = game.skills.level('construction'), need = next.level || 1;
  const xp = Math.round(game.skills.xpAtLevel('construction', makeXp(game, 'construction', next.xp || 0)));
  const why = h.whyNot(key);
  const mats = [...Object.entries(next.cost?.items || {}).map(([id, n]) => matChip(game, id, n)), next.cost?.coins ? matChip(game, 'coins', next.cost.coins) : ''].join('');
  html += `<div class="bld-next"><div class="bld-next-head"><span>Next: <b>${esc(next.name)}</b></span>`
    + `<span class="bld-lv${lvl >= need ? ' ok' : ''}">Lvl ${need}</span><span class="bld-xp">+${shortXp(xp)} xp</span></div>`
    + `<small class="bld-perk">${esc(next.desc)}</small><div class="bld-mats">${mats}</div>`
    + `<div class="bld-go"><small>${why ? esc(why) : 'Ready to build'}</small><button type="button" class="wm-go" data-up="${key}"${why ? ' disabled' : ''}>Build</button></div></div>`;
  return `${html}</div>`;
}

function buildHTML(game, room) {
  const h = game.home;
  if (!h.owned) return buyHTML(game);
  const wait = h.tpWait();
  let html = `<div class="home-row"><span class="bld-head">${skillIconSVG('construction', 26)}<span><b>Construction ${game.skills.level('construction')}</b>`
    + `<small>${game.hasTool?.('hammer') ? 'Hammer in hand. Materials come from your pack, then the bank.' : 'You need a hammer to build.'}</small></span></span>`
    + `<button type="button" class="wm-go" data-tp="1"${wait ? ' disabled' : ''} title="${esc(HOME_UPGRADES.portal.tiers[h.tiers.portal].desc)}">${wait ? `Home in ${Math.ceil(wait * 0.6)}s` : 'Go home'}</button></div>`;
  html += `<div class="sgx-chips bld-rooms">${ROOMS.map((r) => `<button type="button" class="sgx-chip${r.id === room ? ' on' : ''}${roomCanBuild(game, r) ? ' can' : ''}" data-room="${r.id}">${r.icon} ${esc(r.name)}</button>`).join('')}</div>`;
  const R = ROOMS.find((r) => r.id === room) || ROOMS[0];
  return `${html}<div class="bld-room">${R.lines.map((k) => spotHTML(game, k)).join('')}</div>`;
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

function portalsHTML(game) {
  const h = game.home;
  if (!h.owned) return '<div class="home-intro">Buy the plot first.</div>';
  if (!h.portalTicks) return '<div class="home-intro">Build a portal frame in your portal room (Construction 45) and step through to the MRT of any region you have visited.</div>';
  const wait = h.portalWait(), list = h.portalTargets();
  return `<div class="home-sub">${wait ? `Recharging: ${Math.ceil(wait * 0.6)}s` : 'Ready'} · ${esc(HOME_UPGRADES.portals.tiers[h.tiers.portals].name)}</div>`
    + (list.length ? list.map((st) => `<div class="home-row"><span><b>${esc(st.name)}</b></span><button type="button" class="wm-go" data-portal="${st.id}"${wait ? ' disabled' : ''}>Go</button></div>`).join('')
      : '<div class="modal-hint">Visit a region with an MRT station first.</div>');
}

function trophyHTML(game) {
  const t = game.home.trophies(), boss = game.home.trophyBoss();
  return (boss ? `<div class="home-sub">Your trophies spur you on: +${boss}% damage to bosses</div>` : '')
    + '<div class="home-sub">Boss kills</div>'
    + (t.bosses.length ? t.bosses.map((b) => `<div class="home-row"><span><b>${esc(b.name)}</b></span><span>${formatNumber(b.kills)}</span></div>`).join('') : '<div class="modal-hint">No bosses beaten yet.</div>')
    + '<div class="home-sub">Rare finds (boss signature weapons you own)</div>'
    + (t.rares.length ? `<div class="home-grid">${t.rares.map((r) => `<span class="home-cell" title="${esc(r.name)}">${itemIconSVG(r.id, 30)}</span>`).join('')}</div>` : '<div class="modal-hint">None yet.</div>');
}

/** Open the home window at a tab ('build', 'chest', 'portals' or 'trophy'; the
 *  plot board's old 'plot' is the Build tab). A tab of 'build:<room>' opens
 *  that room (each piece of furniture opens its own). */
export function openHome(ui, tab = 'build') {
  const game = ui.game;
  let [cur, room] = String(tab || 'build').split(':');
  if (cur === 'plot') cur = 'build';
  if (!ROOMS.some((r) => r.id === room)) room = (ROOMS.find((r) => roomCanBuild(game, r)) || ROOMS[0]).id;
  const render = (body) => {
    const album = () => game.home.owned
      ? '<div class="island-album">' + (islandAlbumHTML(game) || '<p>Complete Photography assignments to add prints.</p>') + '</div>'
      : '<div class="home-intro">Buy the plot to display your prints.</div>';
    const page = cur === 'album' ? album() : cur === 'chest' ? chestHTML(game) : cur === 'trophy' ? trophyHTML(game) : cur === 'portals' ? portalsHTML(game) : buildHTML(game, room);
    body.innerHTML = `<div class="sgx-chips home-tabs">${TABS.map((t) => `<button type="button" class="sgx-chip${t.id === cur ? ' on' : ''}" data-tab="${t.id}">${t.name}</button>`).join('')}</div>`
      + `<div class="home-body">${page}</div>`;
    body.onclick = (ev) => {
      const b = ev.target.closest?.('button');
      if (!b || ui.modal?.kind !== 'home') return;
      const d = b.dataset, h = game.home;
      if (d.tab) cur = d.tab;
      else if (d.island?.startsWith('display:')) displayIslandPrint(game, d.island.slice(8));
      else if (d.room) room = d.room;
      else if (d.buy) h.buy();
      else if (d.up) h.upgrade(d.up);
      else if (d.tp) { h.teleport(); return; }
      else if (d.portal) { h.portalTo(d.portal); return; }
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
    btn.innerHTML = `${playIconHTML('ui-home', 14)}HOME`;
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
