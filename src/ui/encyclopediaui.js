// The encyclopedia sections of the Codex window, beside Monsters and the
// Compendium (codexui.js owns the window and its switch):
//
//  - Items: every item, searchable, found ones in colour and the rest as
//    silhouettes. An item's page is the skill guide's Resources page (who
//    drops it, which nodes give it, what makes it and what it makes) with a
//    Go button to the nearest source on top.
//  - Places: every region, with what lives there and a small map.
//  - For you: what to train, hunt and wear next at your levels.
//  - Search: one box over everything, your recent pages, and your
//    discoveries with their rewards.
//
// Every page is one HTML string in a fresh wrapper with a single click
// listener, like the Compendium, so the builders run in the tests without a
// DOM. Taps on [data-ency] links anywhere in the game land in openEntry (links.js).
import { ITEMS, getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { formatNumber } from '../core/utils.js';
import { itemIconSVG } from '../render/icons.js';
import { CODEX_IDS } from '../game/codex.js';
import { nearestObject } from '../game/skillguide.js';
import {
  ITEM_SHELVES, searchItems, itemKind, shopsFor, nearestSource, goToSource, nearestNpcSpawn,
} from '../game/encyclopedia.js';
import { discoveryCategories, discoveryTotals, claimDiscovery, obtainableItems } from '../game/discovery.js';
import { itemPageHTML } from './skillguideui.js';
import { codexSwitchHTML } from './compendiumui.js';
import { openCodex, openCompendium } from './codexui.js';
import { openSkillGuide } from './skillguideui.js';
import { regionPageHTML, regionListHTML } from './regionui.js';
import { forYouHTML } from './foryouui.js';
import { searchHTML, searchResultsHTML, noteRecent } from './searchui.js';

export const ITEM_PAGE = 40;
export const ENCY_VIEWS = ['items', 'places', 'foryou', 'search'];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pctOf = (a, b) => (b ? Math.floor((a / b) * 100) : 0);

/** The encyclopedia's remembered state (on the UI between openings). */
export function encyState(ui) {
  return ui._ency || (ui._ency = {
    items: { search: '', cat: 'all', disc: 'all', shown: ITEM_PAGE, id: null },
    places: { id: null },
    foryou: {},
    search: { query: '' },
  });
}

/** A progress bar like the Codex's: "Found 12 / 593 · 2%". */
export function barHTML(seen, total, label = 'Found ') {
  return `<div class="cx-prog"><span class="cx-prog-label">${label}<b>${formatNumber(seen)} / ${formatNumber(total)}</b> · ${pctOf(seen, total)}%</span>` +
    `<span class="cx-bar"><i style="width:${pctOf(seen, total)}%"></i></span></div>`;
}

/** An item's icon, a dark silhouette until it is found. */
const itemIcon = (id, size, seen) => (seen ? itemIconSVG(id, size) : `<span class="ency-sil">${itemIconSVG(id, size)}</span>`);

// ---------------- Items ----------------

/** One row of the item list. An unfound item's name shows only when you are
 *  searching for it by name (you already know it). */
export function itemRowHTML(game, id, named = false) {
  const it = getItem(id), seen = !!game?.discovery?.items.has(id);
  const bag = game?.inventory?.count?.(id) || 0, bank = game?.bank?.count?.(id) || 0;
  const have = bag || bank ? ` · you have ${formatNumber(bag + bank)}` : '';
  return `<button type="button" class="cx-row ency-row${seen ? '' : ' unseen'}" data-item="${esc(id)}">${itemIcon(id, 36, seen)}` +
    `<span class="cx-row-main"><span class="cx-row-top"><b>${seen || named ? esc(it.name) : '???'}</b></span>` +
    `<span class="cx-row-sub">${esc(itemKind(id))}${have}</span></span>` +
    `<span class="cx-kc">${seen ? (it.value ? `${formatNumber(it.value)} gp` : '') : 'Not found'}</span></button>`;
}

/** The Items list: progress, shelves, search, a page of rows. */
export function itemsListHTML(game, st) {
  const ids = searchItems(game, st);
  const shown = ids.slice(0, Math.max(ITEM_PAGE, st.shown || ITEM_PAGE));
  const named = !!String(st.search || '').trim();
  let html = `<div class="cx-count">${formatNumber(ids.length)} item${ids.length === 1 ? '' : 's'}</div>`;
  if (!ids.length) return html + '<div class="modal-hint">No items match.</div>';
  html += `<div class="cx-list">${shown.map((id) => itemRowHTML(game, id, named)).join('')}</div>`;
  if (shown.length < ids.length) html += `<button type="button" class="cx-more" data-more="1">Show ${Math.min(ITEM_PAGE, ids.length - shown.length)} more (${formatNumber(ids.length - shown.length)} left)</button>`;
  return html;
}

/** The Items home: a found counter, search, found filter, shelves and the list. */
export function itemsHomeHTML(game, st) {
  const all = obtainableItems();
  const found = all.filter((id) => game?.discovery?.items.has(id)).length;
  const sel = (v, label) => `<option value="${v}"${st.disc === v ? ' selected' : ''}>${label}</option>`;
  return `<div class="cx-head">${barHTML(found, all.length)}</div>` +
    '<div class="cx-filters ency-filters">' +
    `<input type="search" class="bank-search cx-search ency-search" data-search="items" placeholder="Search items…" aria-label="Search items" value="${esc(st.search || '')}">` +
    `<select class="cx-select" data-disc="1" aria-label="Found">${sel('all', 'Found and not')}${sel('seen', 'Found')}${sel('unseen', 'Not found yet')}</select></div>` +
    `<div class="sgx-chips ency-chips">${ITEM_SHELVES.map((c) => `<button type="button" class="sgx-chip${st.cat === c.id ? ' on' : ''}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>` +
    `<div class="ency-results">${itemsListHTML(game, st)}</div>`;
}

/** One item's page: what it is and the nearest source (with Go), then the
 *  skill guide's sources and uses. */
export function itemEntryHTML(game, id, st = {}) {
  const it = getItem(id), seen = !!game?.discovery?.items.has(id);
  const src = nearestSource(game, id);
  const shops = shopsFor(id);
  const goText = src ? { node: 'Gather at', shop: 'Buy from', drop: 'Hunt' }[src.kind] : '';
  let html = `<div class="ency-item-top">${itemIcon(id, 64, seen)}<div class="ency-item-id"><div class="cx-entry-name">${esc(it.name)}</div>` +
    `<div class="cx-entry-lvl">${esc(itemKind(id))}</div>` +
    (seen ? `<div class="cx-examine">${esc(it.examine || '')}</div>` : '<div class="cx-entry-kc">Not found yet: get one to tick it off.</div>') +
    `<div class="cx-note">${it.value ? `Worth ${formatNumber(it.value)} coins` : 'No shop value'}` +
    (shops.length ? ` · sold at ${shops.slice(0, 2).map((s) => `${esc(s.name)} (${formatNumber(s.price)} gp)`).join(', ')}` : '') + '</div></div></div>';
  html += '<div class="cx-go-row ency-go-row">' + (src
    ? `<span class="cx-dist">Nearest: ${esc(goText)} ${esc(src.label)}, ${formatNumber(src.dist)} tiles away</span>` +
      `<button type="button" class="wm-go cx-map" data-mapxy="${src.x},${src.y}" data-label="${esc(src.label)}">Map</button>` +
      `<button type="button" class="wm-go" data-gosrc="${esc(id)}">Go</button>`
    : '<span class="cx-dist">No source you can use nearby yet.</span>') + '</div>';
  // The skill guide's page, minus its own heading (the top above replaces it).
  const page = itemPageHTML(game, id, st).replace(/^<div class="sgx-item-head">[\s\S]*?<\/div><\/div>/, '');
  return `<div class="cx-entry ency-entry">${html}${page}</div>`;
}

// ---------------- Search tab's discoveries ----------------

/** Every discovery category, grouped, with a Claim button on a finished one. */
export function discoveriesHTML(game) {
  const cats = discoveryCategories(game);
  const tot = discoveryTotals(game);
  const groups = [...new Set(cats.map((c) => c.group))];
  return `<section class="ency-disc"><h3 class="ency-h3">Your discoveries</h3>${barHTML(tot.seen, tot.total, 'Everything ')}` +
    groups.map((g) => `<h4 class="ency-h4">${esc(g)}</h4><div class="ency-cats">` + cats.filter((c) => c.group === g).map((c) =>
      `<div class="ency-cat${c.done ? ' done' : ''}"><span class="ency-cat-name">${c.icon} ${esc(c.name)}</span>` +
      `<span class="cx-bar"><i style="width:${pctOf(c.seen, c.total)}%"></i></span><b>${formatNumber(c.seen)}/${formatNumber(c.total)}</b>` +
      (c.done && !c.claimed ? `<button type="button" class="wm-go ency-claim" data-claim="${esc(c.id)}">Claim</button>`
        : c.claimed ? '<span class="ency-claimed">✓ Claimed</span>'
          : `<span class="ency-reward" title="The reward for finding them all">${formatNumber(c.reward.coins)} gp</span>`) +
      '</div>').join('') + '</div>').join('') +
    `<div class="cx-note">Finish a category for coins and ${'forager’s lamps'} (rub one for XP in a gathering skill).</div></section>`;
}

// ---------------- The window ----------------

/** The whole page for a view, switch on top. */
export function encyclopediaPageHTML(ui, view) {
  const game = ui.game, st = encyState(ui);
  let page = '';
  if (view === 'items') {
    const s = st.items;
    page = s.id ? `<button type="button" class="cx-back" data-back="items">&#8592; All items</button>${itemEntryHTML(game, s.id, s)}` : itemsHomeHTML(game, s);
  } else if (view === 'places') {
    const s = st.places;
    page = s.id ? `<button type="button" class="cx-back" data-back="places">&#8592; All places</button>${regionPageHTML(game, s.id)}` : regionListHTML(game);
  } else if (view === 'foryou') page = forYouHTML(game);
  else page = searchHTML(ui, st.search) + discoveriesHTML(game);
  return `<div class="ency-wrap cp-wrap-ency">${codexSwitchHTML(view)}${page}</div>`;
}

/** Draw a view into the modal body and wire it. `flip(view)` switches the
 *  window to another section (Monsters or the Compendium). */
export function renderEncyclopedia(ui, body, view, flip) {
  if (!body) return;
  const game = ui.game, st = encyState(ui);
  body.innerHTML = encyclopediaPageHTML(ui, view);
  const wrap = body.querySelector?.('.ency-wrap');
  if (!wrap) return;
  const redraw = (top = false) => { const sc = body.scrollTop; renderEncyclopedia(ui, body, view, flip); body.scrollTop = top ? 0 : sc; };
  wrap.addEventListener('click', (ev) => {
    const t = ev.target.closest?.('button, [data-view]');
    if (!t || t.closest('[data-ency]')) return;   // links are links.js's
    const d = t.dataset;
    const its = st.items;
    if (d.view) { if (d.view !== view) flip?.(d.view); return; }
    if (d.back === 'items') { its.id = null; redraw(); body.scrollTop = its.listScroll || 0; return; }
    if (d.back === 'places') { st.places.id = null; redraw(true); return; }
    if (d.item) { if (!its.id) its.listScroll = body.scrollTop; its.id = d.item; its.allDrops = its.allBoss = its.allThen = false; noteRecent(ui, 'item', d.item); if (view !== 'items') flip?.('items'); else redraw(true); return; }
    if (d.region) { st.places.id = d.region; noteRecent(ui, 'region', d.region); if (view !== 'places') flip?.('places'); else redraw(true); return; }
    if (d.more) { its.shown = (its.shown || ITEM_PAGE) + ITEM_PAGE; refreshList(); return; }
    if (d.cat) { its.cat = d.cat; its.shown = ITEM_PAGE; redraw(); return; }
    if (d.all) { its[d.all] = true; redraw(); return; }
    if (d.allthen) { its.allThen = true; redraw(); return; }
    if (d.seeall) {
      // The whole list in its own section, already searched.
      const q = st.search.query || '';
      if (d.seeall === 'items') { Object.assign(its, { search: q, cat: 'all', disc: 'all', shown: ITEM_PAGE, id: null }); }
      else if (d.seeall === 'monsters') { const c = ui._codex; if (c) Object.assign(c, { search: q, id: null, shown: 40 }); }
      else if (d.seeall === 'compendium') { const c = ui._compendium; if (c) Object.assign(c, { query: q, id: null }); }
      flip?.(d.seeall);
      return;
    }
    if (d.claim) { claimDiscovery(game, d.claim); redraw(); return; }
    if (d.gosrc) { ui.closeModal?.(); goToSource(game, d.gosrc); return; }
    if (d.go) { game.goToNearest?.(d.go.split(',')); return; }
    if (d.map) { const s = nearestObject(game, d.map.split(',')); if (s) ui.openWorldMap?.({ x: s.x, y: s.y, label: d.label || '' }); return; }
    if (d.mapxy) { const [x, y] = d.mapxy.split(',').map(Number); ui.openWorldMap?.({ x, y, label: d.label || '' }); return; }
    if (d.npc) {
      const s = nearestNpcSpawn(game, d.npc, d.region || null) || nearestNpcSpawn(game, d.npc);
      if (s) { ui.closeModal?.(); game.travelToTile({ x: s.x, y: s.y }); } else game.msg?.("I can't find one of those anywhere.", 'system');
      return;
    }
    if (d.goxy) { const [x, y] = d.goxy.split(',').map(Number); ui.closeModal?.(); game.travelToTile({ x, y }); return; }
    if (d.monster) { noteRecent(ui, 'monster', d.monster); openCodex(ui, d.monster); return; }
    if (d.article) { noteRecent(ui, 'article', d.article); openCompendium(ui, d.article); return; }
    if (d.skill) { openSkillGuide(ui, d.skill); }
  });
  // The search boxes redraw only their list, so they keep focus (and the phone keyboard).
  const refreshList = () => { const r = wrap.querySelector('.ency-results'); if (r) r.innerHTML = itemsListHTML(game, st.items); };
  wrap.querySelector('[data-search="items"]')?.addEventListener('input', (e) => { st.items.search = e.target.value; st.items.shown = ITEM_PAGE; refreshList(); });
  wrap.querySelector('[data-disc]')?.addEventListener('change', (e) => { st.items.disc = e.target.value; st.items.shown = ITEM_PAGE; refreshList(); });
  wrap.querySelector('[data-search="all"]')?.addEventListener('input', (e) => {
    st.search.query = e.target.value;
    const r = wrap.querySelector('.ency-search-results');
    if (r) r.innerHTML = searchResultsHTML(ui, st.search.query);
  });
}

/** Open any entry by kind: 'monster', 'item', 'region', 'skill' or 'article'. */
export function openEntry(ui, kind, id) {
  if (!ui || !id) return;
  const st = encyState(ui);
  if (kind === 'monster' && CODEX_IDS.includes(id)) { noteRecent(ui, 'monster', id); openCodex(ui, id); return; }
  if (kind === 'article') { noteRecent(ui, 'article', id); openCompendium(ui, id); return; }
  if (kind === 'skill') { openSkillGuide(ui, id); return; }
  if (kind === 'item' && ITEMS[id]) { st.items.id = id; st.items.allDrops = st.items.allBoss = st.items.allThen = false; noteRecent(ui, 'item', id); openCodex(ui, null, { view: 'items' }); return; }
  if (kind === 'region') { st.places.id = id; noteRecent(ui, 'region', id); openCodex(ui, null, { view: 'places' }); }
}

/** A Monster's name as the encyclopedia shows it ("???" until defeated). */
export const monsterLabel = (game, id) => (game?.kills?.[id] > 0 ? getNpc(id).name : '???');
