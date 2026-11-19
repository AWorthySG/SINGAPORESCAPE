// The Search section of the Codex window: your recent pages (kept in this
// browser only: a per-viewer convenience, never in the save).
import { getItem, ITEMS } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { ARTICLE_BY_ID } from '../data/compendium.js';

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

/** The Search page's top: the recent pages. */
export function searchHTML(ui) {
  const rec = recentPages(ui);
  return rec.length ? `<section class="ency-recent"><h3 class="ency-h3">Recent pages</h3><div class="cp-chips">${rec.map((r) => entryChip(ui.game, r.kind, r.id)).join('')}</div></section>` : '';
}
export const searchResultsHTML = () => '';
