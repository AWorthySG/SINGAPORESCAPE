// The Stats tab's markup, built from statSheet() (src/game/statsheet.js) as a
// plain string so it needs no DOM: ui.js puts it on the page, and the tests
// build it headlessly. Rows with a breakdown are <details>, so a tap opens the
// sources on phones; the same breakdown is in the row's title for mouse hover.
import { fmtTime } from '../game/statsheet.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** "Crit chance % 12%: Gear +5% + Prayer +5% ..." for hover. */
const hoverText = (r) => `${r.label} ${r.text}${r.parts.length ? ': ' + r.parts.map(([l, v]) => `${l} ${v}`).join(' + ') : ''}${r.note ? ` (${r.note})` : ''}`;

function rowHTML(r, open) {
  const head = `<span class="st-label">${esc(r.label)}</span><span class="st-val">${esc(r.text)}</span>`;
  if (!r.parts.length && !r.note) return `<div class="st-row" data-row="${r.id}">${head}</div>`;
  const parts = r.parts.map(([l, v]) => `<div class="st-part"><span>${esc(l)}</span><span>${esc(v)}</span></div>`).join('');
  return `<details class="st-row st-more" data-row="${r.id}" title="${esc(hoverText(r))}"${open.has(r.id) ? ' open' : ''}>`
    + `<summary>${head}</summary><div class="st-parts">${parts}${r.note ? `<div class="st-note">${esc(r.note)}</div>` : ''}</div></details>`;
}

/** The whole tab. `open` is the set of row ids whose breakdown is showing. */
export function statsPanelHTML(sheet, open = new Set()) {
  let html = `<div class="st-mode"><span>Fighting style: <b>${esc(sheet.modeName)}</b></span><span class="st-hint">Tap a stat for its sources</span></div>`;
  for (const sec of sheet.sections) {
    if (!sec.rows.length) continue;
    html += `<div class="st-sec" data-sec="${sec.id}"><div class="st-head">${esc(sec.title)}</div>${sec.rows.map((r) => rowHTML(r, open)).join('')}</div>`;
  }
  html += '<div class="st-sec" data-sec="effects"><div class="st-head">Active effects</div>';
  if (!sheet.effects.length) html += '<div class="st-empty">No potions, meals, buffs or prayers running.</div>';
  for (const e of sheet.effects) {
    html += `<div class="st-fx${e.off ? ' off' : ''}"><div class="st-fx-top"><b>${esc(e.name)}</b>`
      + `<span class="st-fx-time">${e.left != null ? fmtTime(e.left) : ''}</span></div>`
      + `<div class="st-fx-detail">${esc(e.detail)}${e.off ? ` <i>(${esc(e.off)})</i>` : ''}</div></div>`;
  }
  return html + '</div>';
}
