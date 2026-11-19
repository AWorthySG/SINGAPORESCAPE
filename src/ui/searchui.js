// The Search section of the Codex window: one box over monsters, items,
// places and the Compendium, and your recent pages (kept in this browser
// only: a per-viewer convenience, never in the save).
import { getItem, ITEMS } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { ARTICLE_BY_ID } from '../data/compendium.js';
import { searchAll } from '../game/encyclopedia.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const RECENT_MAX = 8;
const RECENT_KEY = 'aw-ency-recent';

/** The recent pages, newest first: [{ kind, id }]. Read from this browser once. */
export function recentPages(ui) {
  if (!ui._encyRecent) {
    let list = [];
    try { list = JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) || '[]'); } catch { list = []; }
    ui._encyRecent = Array.isArray(list) ? list.filter((r) => r && typeof r.kind === 'string' && typeof r.id === 'string').slice(0, RECENT_MAX) : [];
  }
  return ui._encyRecent;
}

/** Note a page you opened (moves it to the front). */
export function noteRecent(ui, kind, id) {
  if (!ui || !id) return;
  const list = recentPages(ui).filter((r) => !(r.kind === kind && r.id === id));
  list.unshift({ kind, id });
  ui._encyRecent = list.slice(0, RECENT_MAX);
  try { globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(ui._encyRecent)); } catch { /* private mode: keep it for this visit */ }
}

/** A chip that opens an entry, by kind (the attribute the window's click handler reads). */
export function entryChip(game, kind, id) {
  const ATTR = { item: 'data-item', region: 'data-region', monster: 'data-monster', article: 'data-article' };
  let label = id;
  if (kind === 'item') label = ITEMS[id] ? getItem(id).name : id;
  else if (kind === 'monster') label = game?.kills?.[id] > 0 ? getNpc(id).name : '???';
  else if (kind === 'article') label = ARTICLE_BY_ID[id]?.title || id;
  const icon = { item: '🎒', region: '🗺️', monster: '🐾', article: '📖' }[kind] || '•';
  return `<button type="button" class="cp-chip ency-chip" ${ATTR[kind] || 'data-x'}="${esc(id)}">${icon} ${esc(label)}</button>`;
}

// How many of each kind the results show before "See all".
export const SEARCH_SHOW = 6;
const GROUPS = [
  { key: 'monsters', title: '🐾 Monsters', attr: 'data-monster', all: 'monsters' },
  { key: 'items', title: '🎒 Items', attr: 'data-item', all: 'items' },
  { key: 'regions', title: '🗺️ Places', attr: 'data-region', all: null },
  { key: 'articles', title: '📖 Compendium', attr: 'data-article', all: 'compendium' },
];

/** The results of one search over monsters, items, places and the Compendium. */
export function searchResultsHTML(ui, query) {
  if (!String(query || '').trim()) return '';
  const r = searchAll(ui.game, query);
  const total = GROUPS.reduce((n, g) => n + r[g.key].length, 0);
  if (!total) return '<div class="modal-hint">Nothing matches. Try another word.</div>';
  return GROUPS.filter((g) => r[g.key].length).map((g) => {
    const list = r[g.key];
    return `<section class="ency-hits"><h4 class="ency-h4">${g.title} <small>(${list.length.toLocaleString('en-GB')})</small></h4><div class="cp-list">` +
      list.slice(0, SEARCH_SHOW).map((e) => `<button type="button" class="cp-row" ${g.attr}="${esc(e.id)}"><b>${esc(e.title)}</b><span>${esc(e.sub)}</span></button>`).join('') + '</div>' +
      (list.length > SEARCH_SHOW && g.all ? `<button type="button" class="cx-more" data-seeall="${g.all}">See all ${list.length.toLocaleString('en-GB')}</button>` : '') + '</section>';
  }).join('');
}

/** The Search page's top: one box over everything, its results, and the recent pages. */
export function searchHTML(ui, st = {}) {
  const rec = recentPages(ui);
  return '<div class="cp-intro">Search monsters, items, places and the Compendium at once.</div>' +
    `<input type="search" class="bank-search cx-search cp-search ency-all-search" data-search="all" placeholder="Search everything…" aria-label="Search everything" value="${esc(st.query || '')}">` +
    `<div class="ency-search-results">${searchResultsHTML(ui, st.query)}</div>` +
    (rec.length ? `<section class="ency-recent"><h3 class="ency-h3">Recent pages</h3><div class="cp-chips">${rec.map((r) => entryChip(ui.game, r.kind, r.id)).join('')}</div></section>` : '');
}
