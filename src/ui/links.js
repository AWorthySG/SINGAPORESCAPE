// Links everywhere: the names of monsters, items, skills and regions in chat
// lines, quest text and encyclopedia pages become taps that open their entry.
//
// A link is any element with data-ency="kind:id" (kind: monster, item,
// region, skill or article). One click listener on the document handles them
// all (event delegation), in the capture phase so a link inside a tappable
// card (a quest row walks you somewhere when tapped) opens the entry instead.
// Links are role="button", so a phone sheet's drag never swallows the tap.
import { findLinks, linkNames } from '../game/encyclopedia.js';
import { openEntry } from './encyclopediaui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// The regions' names, kept until the world's list of zones changes (every
// chat line asks, and the zones are laid out once, with the world).
let _regions = null;
const regionNames = (game) => {
  const zones = game?.world?.zones || [];
  if (!_regions || _regions.zones !== zones || _regions.len !== zones.length) {
    _regions = { zones, len: zones.length, names: zones.filter((z) => !z.instance).map((z) => z.name) };
  }
  return _regions.names;
};

// The HTML of lines linked lately: a fight repeats many of its lines (the same
// kill, the same quality drop), and the journal redraws the same quest text.
// Kept for the names they were linked with: a new set of names starts afresh.
const HTML_KEPT = 300;
let _html = new Map(), _htmlNames = null;

/** A link's HTML: the text, tappable, opening `kind:id`. */
export const linkTag = (kind, id, text) => `<span class="ency-link" role="button" tabindex="0" data-ency="${esc(kind)}:${esc(id)}">${esc(text)}</span>`;

/** Plain text as HTML with every known name linked (and everything escaped). */
export function linkHTML(game, text) {
  if (!text) return '';
  const regions = regionNames(game);
  const names = linkNames(regions);   // (the same names until a new region turns up)
  if (names !== _htmlNames) { _html = new Map(); _htmlNames = names; }
  const key = String(text);
  let html = _html.get(key);
  if (html === undefined) {
    html = findLinks(key, regions).map((r) => (r.link ? linkTag(r.link.kind, r.link.id, r.text) : esc(r.text))).join('');
    if (_html.size >= HTML_KEPT) _html.delete(_html.keys().next().value);   // the oldest goes
    _html.set(key, html);
  }
  return html;
}

/** Fill an element with linked text (the chat's lines). Falls back to plain text. */
export function setLinkedText(el, game, text) {
  if (!el) return;
  let html = '';
  try { html = linkHTML(game, text); } catch { html = ''; }
  if (html && html.includes('data-ency')) el.innerHTML = html;
  else el.textContent = text;
}

/** Listen for link taps anywhere on the page (once). Enter or Space on a
 *  focused link works too. */
export function installLinks(ui) {
  if (typeof document === 'undefined' || ui._linksWired) return;
  ui._linksWired = true;
  const open = (ev) => {
    const t = ev.target?.closest?.('[data-ency]');
    if (!t) return;
    const [kind, ...rest] = t.dataset.ency.split(':');
    ev.preventDefault();
    ev.stopPropagation();
    ui.hideContextMenu?.();
    openEntry(ui, kind, rest.join(':'));
  };
  document.addEventListener('click', open, true);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') open(ev); }, true);
}
