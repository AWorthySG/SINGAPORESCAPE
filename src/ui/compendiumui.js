// The Compendium pages of the Codex window: a searchable encyclopedia of how
// the game works (the articles live in src/data/compendium.js). codexui.js
// owns the window and its Monsters | Compendium switch; this file turns the
// articles into HTML and wires the search box and the links.
//
// Every page is built as one HTML string inside a fresh wrapper element, with
// a single click listener on that wrapper, so redrawing never stacks listeners
// on the shared modal body, and the page builders can run in the tests
// without a DOM.
import { REGION_LINES } from '../data/regionQuests.js';
import { tabIconSVG, playIconHTML } from '../render/icons.js';
import { findLinks } from '../game/encyclopedia.js';
import {
  CHAPTERS, ARTICLE_BY_ID, CHAPTER_BY_ID, articleBlocks, relatedOf, searchArticles,
} from '../data/compendium.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The state the Compendium opens with (remembered on the UI between openings). */
export function defaultCompendiumState() {
  return { query: '', id: null, homeScroll: 0 };
}

// Region names for the links in plain text (the region quest lines cover every
// region with people in it; the two wild ones have none).
const REGION_NAMES = [...REGION_LINES.map((l) => l.region), 'The Wilderness', 'Pulau Hantu'];
/** Plain words with the names of monsters, items, skills and regions linked
 *  to their encyclopedia entries (links.js opens them). */
function linkWords(text) {
  try {
    return findLinks(text, REGION_NAMES).map((r) => (r.link ? `<span class="ency-link" role="button" tabindex="0" data-ency="${r.link.kind}:${esc(r.link.id)}">${esc(r.text)}</span>` : esc(r.text))).join('');
  } catch { return esc(text); }
}

/** Marked-up text as HTML: **bold**, *italic*, and [[id]] / [[id|words]] links.
 *  Names in the plain words between the markup link to their entries. */
export function markupHTML(text) {
  return String(text ?? '').split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => (i % 2 ? esc(part) : linkWords(part))).join('')
    .replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => {
      const a = ARTICLE_BY_ID[id];
      return `<button type="button" class="cp-link" data-article="${id}">${label || esc(a?.title || id)}</button>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>');
}

/** One block of an article's body. */
export function blockHTML(b) {
  if (typeof b === 'string') return `<p>${markupHTML(b)}</p>`;
  if (b.list) return `<ul class="cp-ul">${b.list.map((x) => `<li>${markupHTML(x)}</li>`).join('')}</ul>`;
  if (b.tip) return `<div class="cp-tip">${markupHTML(b.tip)}</div>`;
  if (b.keys) {
    return '<div class="cp-table-wrap"><table class="cp-table cp-keys"><tbody>' +
      b.keys.map(([k, what]) => `<tr><th>${k.split(' or ').map((x) => `<kbd>${esc(x)}</kbd>`).join(' or ')}</th><td>${markupHTML(what)}</td></tr>`).join('') +
      '</tbody></table></div>';
  }
  if (b.table) {
    const { head = [], rows = [] } = b.table;
    return '<div class="cp-table-wrap"><table class="cp-table">' +
      (head.length ? `<thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : '') +
      `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return '';
}

// The Codex window's sections, in the switch's order (the encyclopedia's own
// sections are drawn by encyclopediaui.js).
export const CODEX_VIEWS = [
  ['monsters', '🐾 Monsters'], ['items', '🎒 Items'], ['places', '🗺️ Places'],
  ['compendium', '📖 Compendium'], ['foryou', '✨ For you'], ['search', '🔎 Search'],
];
// Sections with painted art wear it in place of their emoji (the side
// panel's tab pictures: the fighters, the bag, the journal, the trophy).
export const CODEX_VIEW_ART = { monsters: 'combat', items: 'inventory', compendium: 'quests', foryou: 'achievements' };
// ...and Places and Search wear their own round badges (assets/icons/ui-*.webp).
export const CODEX_VIEW_ICON = { places: 'ui-places', search: 'ui-search' };
/** A section's label for the switch: its painted icon and name, or the emoji one. */
export function codexViewLabel(id, label) {
  const art = CODEX_VIEW_ART[id], icon = CODEX_VIEW_ICON[id];
  return art ? `${tabIconSVG(art, 18)}${label.replace(/^\S+\s/, '')}`
    : icon ? `${playIconHTML(icon, 18)}${label.replace(/^\S+\s/, '')}` : label;
}

/** The section switch at the top of the Codex window. */
export function codexSwitchHTML(view = 'monsters') {
  const tab = (id, label) => `<button type="button" role="tab" class="cx-view${view === id ? ' active' : ''}" data-view="${id}" aria-selected="${view === id}">${codexViewLabel(id, label)}</button>`;
  return `<div class="cx-switch" role="tablist" aria-label="Codex section">${CODEX_VIEWS.map(([id, label]) => tab(id, label)).join('')}</div>`;
}

const rowHTML = (a, sub = a.summary) => `<button type="button" class="cp-row" data-article="${a.id}"><b>${esc(a.title)}</b><span>${esc(sub)}</span></button>`;

/** The home page's list: every chapter and its articles, or the search results. */
export function compendiumResultsHTML(query = '') {
  if (String(query).trim()) {
    const hits = searchArticles(query);
    if (!hits.length) return '<div class="modal-hint">No articles match. Try another word.</div>';
    return `<div class="cx-count">${hits.length} article${hits.length === 1 ? '' : 's'}</div><div class="cp-list">` +
      hits.map((h) => rowHTML(h.article, h.inTitle ? h.article.summary : h.snippet || h.article.summary)).join('') + '</div>';
  }
  return CHAPTERS.map((ch) => `<section class="cp-ch"><h3>${ch.icon} ${esc(ch.title)}</h3><div class="cp-list">` +
    ch.articles.map((a) => rowHTML(a)).join('') + '</div></section>').join('');
}

/** The home page: the search box over the chapters. */
export function compendiumHomeHTML(st = defaultCompendiumState()) {
  return '<div class="cp-intro">How A-Worthy Adventure works, chapter by chapter. Search, or tap an article.</div>' +
    `<input type="search" class="bank-search cx-search cp-search" placeholder="Search the Compendium…" aria-label="Search the Compendium" value="${esc(st.query || '')}">` +
    `<div class="cp-results">${compendiumResultsHTML(st.query)}</div>`;
}

/** One article: its chapter, title, summary, body, related links and the
 *  articles either side of it in its chapter. */
export function compendiumArticleHTML(id) {
  const a = ARTICLE_BY_ID[id];
  if (!a) return '<div class="modal-hint">That article is missing.</div>';
  const ch = CHAPTER_BY_ID[a.chapter];
  const i = ch.articles.findIndex((x) => x.id === id);
  const prev = ch.articles[i - 1], next = ch.articles[i + 1];
  const related = relatedOf(a).map((r) => ARTICLE_BY_ID[r]).filter(Boolean);
  return `<article class="cp-article"><div class="cp-crumb">${ch.icon} ${esc(ch.title)}</div>` +
    `<h3 class="cp-title">${esc(a.title)}</h3><p class="cp-summary">${esc(a.summary)}</p>` +
    articleBlocks(a).map(blockHTML).join('') +
    (related.length ? `<div class="cp-see"><h4>Related</h4><div class="cp-chips">${related.map((r) => `<button type="button" class="cp-chip" data-article="${r.id}">${esc(r.title)}</button>`).join('')}</div></div>` : '') +
    `<div class="cp-nav">${prev ? `<button type="button" class="cp-step" data-article="${prev.id}">&#8592; ${esc(prev.title)}</button>` : '<span></span>'}` +
    `${next ? `<button type="button" class="cp-step next" data-article="${next.id}">${esc(next.title)} &#8594;</button>` : '<span></span>'}</div></article>`;
}

/** A whole Compendium page (home or an article), with the switch on top. */
export function compendiumPageHTML(st = defaultCompendiumState()) {
  const page = st.id && ARTICLE_BY_ID[st.id]
    ? `<button type="button" class="cx-back cp-back" data-home="1">&#8592; All chapters</button>${compendiumArticleHTML(st.id)}`
    : compendiumHomeHTML(st);
  return `<div class="cp-wrap">${codexSwitchHTML('compendium')}${page}</div>`;
}

/** Draw the Compendium into the modal body. `onSwitch(view)` flips the window
 *  back to the Monster Codex. Safe without a DOM (it only writes the HTML). */
export function renderCompendium(body, st, onSwitch) {
  if (!body) return;
  body.innerHTML = compendiumPageHTML(st);
  const wrap = body.querySelector?.('.cp-wrap');
  if (!wrap) return;
  const go = (id) => {
    if (!st.id) st.homeScroll = body.scrollTop;
    st.id = id;
    renderCompendium(body, st, onSwitch);
    body.scrollTop = id ? 0 : st.homeScroll || 0;
  };
  wrap.addEventListener('click', (ev) => {
    const t = ev.target.closest?.('[data-article], [data-home], [data-view]');
    if (!t) return;
    if (t.dataset.view) { if (t.dataset.view !== 'compendium') onSwitch?.(t.dataset.view); return; }
    go(t.dataset.home ? null : t.dataset.article);
  });
  const search = wrap.querySelector('.cp-search');
  const results = wrap.querySelector('.cp-results');
  search?.addEventListener('input', () => {
    st.query = search.value;
    if (results) results.innerHTML = compendiumResultsHTML(st.query);
  });
}
