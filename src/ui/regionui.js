// The Places section of the Codex window: every region of the island, and a
// page for each. The facts come from src/game/regioninfo.js.
import { getNpc } from '../data/npcs.js';
import { formatNumber } from '../core/utils.js';
import { regionList, regionInfo } from '../game/regioninfo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Every region: name, level band, visited or not. An unvisited one is "???". */
export function regionListHTML(game) {
  const list = regionList(game);
  const seen = list.filter((r) => r.visited).length;
  return `<div class="cx-head"><div class="cx-prog"><span class="cx-prog-label">Visited <b>${seen} / ${list.length}</b> · ${Math.floor((seen / (list.length || 1)) * 100)}%</span>` +
    `<span class="cx-bar"><i style="width:${Math.floor((seen / (list.length || 1)) * 100)}%"></i></span></div></div><div class="cx-list">` +
    list.map((r) => `<button type="button" class="cx-row ency-row${r.visited ? '' : ' unseen'}" data-region="${esc(r.name)}">` +
      `<span class="ency-reg-ic">${r.visited ? '🗺️' : '?'}</span><span class="cx-row-main"><span class="cx-row-top"><b>${r.visited ? esc(r.name) : '???'}</b></span>` +
      `<span class="cx-row-sub">${r.band ? `Monsters level ${esc(r.band)}` : 'Peaceful'} · ${esc(r.group)}</span></span>` +
      `<span class="cx-kc">${r.visited ? 'Visited' : 'Not visited'}</span></button>`).join('') + '</div>';
}

/** One region's page. */
export function regionPageHTML(game, name) {
  const r = regionInfo(game, name);
  if (!r) return '<div class="modal-hint">That place is missing.</div>';
  const mon = (id) => `<button type="button" class="cp-chip ency-chip" data-monster="${esc(id)}">${game?.kills?.[id] > 0 ? esc(getNpc(id).name) : '???'} <small>${formatNumber(getNpc(id).level)}</small></button>`;
  return `<div class="cx-entry ency-entry"><div class="cx-entry-name">${esc(r.name)}</div>` +
    `<div class="cx-entry-lvl">${r.band ? `Monsters level ${esc(r.band)}` : 'Peaceful'} · ${esc(r.group)}${r.visited ? '' : ' · not visited yet'}</div>` +
    (r.bosses.length ? `<div class="cx-sec"><h4>Bosses</h4><div class="cp-chips">${r.bosses.map(mon).join('')}</div></div>` : '') +
    (r.monsters.length ? `<div class="cx-sec"><h4>Creatures <small>(${formatNumber(r.monsters.length)})</small></h4><div class="cp-chips">${r.monsters.map(mon).join('')}</div></div>` : '') +
    '</div>';
}
