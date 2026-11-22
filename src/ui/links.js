// Links everywhere: the names of monsters, items, skills and regions in chat
// lines, quest text and encyclopedia pages become taps that open their entry.
//
// A link is any element with data-ency="kind:id" (kind: monster, item,
// region, skill or article). One click listener on the document handles them
// all (event delegation), in the capture phase so a link inside a tappable
// card (a quest row walks you somewhere when tapped) opens the entry instead.
// Links are role="button", so a phone sheet's drag never swallows the tap.
import { findLinks } from '../game/encyclopedia.js';
import { openEntry } from './encyclopediaui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const regionNames = (game) => (game?.world?.zones || []).filter((z) => !z.instance).map((z) => z.name);

/** A link's HTML: the text, tappable, opening `kind:id`. */
export const linkTag = (kind, id, text) => `<span class="ency-link" role="button" tabindex="0" data-ency="${esc(kind)}:${esc(id)}">${esc(text)}</span>`;

/** Plain text as HTML with every known name linked (and everything escaped). */
export function linkHTML(game, text) {
  if (!text) return '';
  return findLinks(text, regionNames(game)).map((r) => (r.link ? linkTag(r.link.kind, r.link.id, r.text) : esc(r.text))).join('');
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
