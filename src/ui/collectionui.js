// The Collection log window (see game/collection.js and game/pets.js): pick a
// page (a boss, champions, Slayer, a clue tier, the Endless Gate, rare finds,
// pets) and see every unique it can give, unseen ones as dark silhouettes and
// collected ones in colour with how many you've had. Below the page: the title
// picker and your pets, to choose which one follows you or send it home.
// Opened from a button on the Awards tab; ui.js only adds that button.
// The page builders return plain strings so the tests can render them headless.

import { getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { itemIconSVG } from '../render/icons.js';
import { portraitFor } from '../render/sprites.js';
import { PAGES, PAGE_BY_ID } from '../game/collection.js';
import { PET_BY_ID } from '../game/pets.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b ? Math.floor((a / b) * 100) : 0);

/** A pet's picture: its creature's painted art, or a paw when there is none. */
function petArt(id, size = 40) {
  const P = PET_BY_ID[id];
  let src = null;
  try { src = P && portraitFor(P.npcId, getNpc(P.npcId))?.src; } catch { src = null; }
  return src ? `<img class="cl-pet-img" width="${size}" height="${size}" src="${esc(src)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="cl-pet-paw" style="font-size:${Math.round(size * 0.6)}px">🐾</span>`;
}

/** One page: its name, progress, the title it earns, and the grid of entries. */
export function collectionPageHTML(game, pageId) {
  const c = game.collection, p = PAGE_BY_ID[pageId] || PAGES[0];
  const { got, total } = c.progress(p.id);
  const cells = p.entries.map((e) => {
    const have = c.has(p.id, e), n = c.count(p.id, e);
    const name = e.kind === 'pet' ? PET_BY_ID[e.id]?.name : getItem(e.id).name;
    const pic = e.kind === 'pet' ? petArt(e.id, 34) : itemIconSVG(e.id, 34);
    return `<div class="cl-cell${have ? ' got' : ''}${e.kind === 'pet' ? ' pet' : ''}" title="${have ? esc(name) : 'Not yet found'}">`
      + `<span class="cl-pic">${pic}</span><span class="cl-name">${have ? esc(name) : '???'}</span>`
      + (have ? `<span class="cl-n">x${n.toLocaleString('en-GB')}</span>` : '') + '</div>';
  }).join('');
  const done = c.done.has(p.id);
  return `<div class="cl-page-head"><b>${esc(p.name)}</b> <span class="cl-count">${got} / ${total}</span>`
    + `<span class="cl-bar"><i style="width:${pct(got, total)}%"></i></span>`
    + `<span class="cl-reward${done ? ' done' : ''}">${done ? 'Complete' : 'Complete it for'}: title « ${esc(p.title)} »</span></div>`
    + `<div class="cl-grid">${cells}</div>`;
}

/** Your pets, with Follow / Dismiss. */
export function petsHTML(game) {
  const pets = game.pets, ids = Object.keys(pets.owned);
  if (!ids.length) return '<div class="cl-empty">No pets yet. Every boss and every life skill has a very rare pet to find.</div>';
  return ids.map((id) => {
    const P = PET_BY_ID[id], on = pets.active === id;
    return `<div class="cl-pet${on ? ' on' : ''}"><span class="cl-pic">${petArt(id, 40)}</span>`
      + `<span class="cl-pet-txt"><b>${esc(P.name)}</b><small>${esc(P.source)}${pets.owned[id] > 1 ? ` · found ${pets.owned[id]} times` : ''}</small></span>`
      + `<button class="cl-pet-btn" data-pet="${esc(id)}">${on ? 'Dismiss' : 'Follow'}</button></div>`;
  }).join('');
}

/** The Collection log window. */
export function openCollection(ui, pageId = null) {
  const g = ui.game;
  if (pageId) ui._clPage = pageId;
  ui.openModal('Collection log', (body) => {
    const c = g.collection, t = c.totals(), page = PAGE_BY_ID[ui._clPage] ? ui._clPage : PAGES[0].id;
    const groups = [...new Set(PAGES.map((p) => p.group))];
    const opts = groups.map((gr) => `<optgroup label="${esc(gr)}">${PAGES.filter((p) => p.group === gr).map((p) => {
      const r = c.progress(p.id);
      return `<option value="${esc(p.id)}"${p.id === page ? ' selected' : ''}>${c.done.has(p.id) ? '✓ ' : ''}${esc(p.name)} (${r.got}/${r.total})</option>`;
    }).join('')}</optgroup>`).join('');
    const titles = c.titles();
    body.innerHTML = `<div class="cl-head">Collected <b>${t.got} / ${t.total}</b> · pages complete <b>${c.pagesDone()} / ${PAGES.length}</b>`
      + `<span class="cl-bar"><i style="width:${pct(t.got, t.total)}%"></i></span></div>`
      + `<label class="cl-pick">Page <select class="cl-page-sel">${opts}</select></label>`
      + `<div class="cl-page">${collectionPageHTML(g, page)}</div>`
      + (titles.length ? `<label class="cl-pick">Title <select class="cl-title-sel"><option value="">None</option>${titles.map((x) => `<option value="${esc(x.id)}"${c.title === x.id ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select></label>` : '')
      + `<div class="skill-group">Pets <small>${Object.keys(g.pets.owned).length} found</small></div><div class="cl-pets">${petsHTML(g)}</div>`;
    body.querySelector('.cl-page-sel').addEventListener('change', (e) => { ui._clPage = e.target.value; openCollection(ui); });
    body.querySelector('.cl-title-sel')?.addEventListener('change', (e) => { c.setTitle(e.target.value || null); });
    for (const b of body.querySelectorAll('.cl-pet-btn')) {
      b.addEventListener('click', () => {
        const id = b.dataset.pet;
        if (g.pets.active === id) g.pets.dismiss(); else g.pets.summon(id);
        openCollection(ui);
      });
    }
  });
  if (ui.modal) ui.modal.kind = 'collection';
}

/** The "Open Collection log" button on the Awards tab. */
export function addCollectionButton(ui, panel) {
  if (typeof document === 'undefined' || !panel) return;
  // Keep its count fresh as things are collected (the tab redraws when it's due).
  if (!ui._clBus) { ui._clBus = true; ui.game.bus.on('collection', () => ui._soon?.('achievements', () => ui.renderAchievementPanel())); }
  const t = ui.game.collection.totals();
  const btn = document.createElement('button');
  btn.className = 'bestiary-open collection-open';
  btn.textContent = `Open Collection log (${t.got}/${t.total})`;
  btn.addEventListener('click', () => openCollection(ui));
  panel.insertBefore(btn, panel.firstChild?.nextSibling || null);
}
