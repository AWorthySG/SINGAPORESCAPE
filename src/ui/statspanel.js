import { fmtTime } from '../game/statsheet.js';
import { fmtWorth } from '../game/statworth.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const OVERVIEW_ROWS = [
  ['maxhit'], ['interval', 'Attack pace'], ['maxhp'], ['reduce', 'Damage reduction'],
];

const EFFECT_GROUPS = [
  ['consumable', 'Food & potions'], ['blessing', 'Blessings'], ['combat', 'Combat buffs'], ['slayer', 'Slayer'],
];

function overviewHTML(sheet) {
  const rows = new Map(sheet.sections.flatMap(({ rows }) => rows.map((row) => [row.id, row])));
  const metrics = OVERVIEW_ROWS.map(([id, label]) => {
    const row = rows.get(id);
    return row ? `<div class="st-metric" data-stat="${id}"><dt>${esc(label || row.label)}</dt><dd>${esc(row.text)}</dd></div>` : '';
  }).join('');
  return `<section class="st-overview" aria-label="Combat overview">
    <div class="st-overview-top"><h3>Combat overview</h3><span class="st-mode" title="Fighting style">${esc(sheet.modeName)}</span></div>
    <dl class="st-metrics">${metrics}</dl>
  </section>`;
}

function rowHTML(row, open) {
  const head = `<span class="st-label">${esc(row.label)}</span><span class="st-val">${esc(row.text)}</span>`;
  if (!row.parts.length && !row.note) return `<div class="st-row" data-row="${row.id}">${head}</div>`;
  const parts = row.parts.map(([label, value]) => `<div class="st-part"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
  const sources = row.parts.map(([label, value]) => `${label} ${value}`).join(' · ');
  const hint = [`${row.label} ${row.text}`, sources, row.note].filter(Boolean).join(' — ');
  return `<details class="st-row st-more" data-row="${row.id}" data-stats-disclosure="row:${row.id}" title="${esc(hint)}"${open.has(row.id) ? ' open' : ''}>
    <summary>${head}</summary>
    <div class="st-parts">${parts ? `<dl>${parts}</dl>` : ''}${row.note ? `<p class="st-note">${esc(row.note)}</p>` : ''}</div>
  </details>`;
}

function sectionHTML(id, title, content, { open = false, meta = '' } = {}) {
  return `<details class="st-sec" data-sec="${id}" data-stats-disclosure="section:${id}"${open ? ' open' : ''}>
    <summary><span>${esc(title)}</span>${meta ? `<span class="st-meta">${esc(meta)}</span>` : ''}</summary>
    <div class="st-content">${content}</div>
  </details>`;
}

/** The effect of +1 point on expected damage against the comparison target. */
export function worthBoxHTML(w) {
  const rows = w.rows.map((r) => `<div class="st-row st-w${r.key === w.best ? ' best' : ''}" data-worth="${r.key}">`
    + `<dt class="st-label">+1 ${esc(r.label)}${r.key === w.best ? ' <b class="st-best">Best</b>' : ''}</dt><dd class="st-val">${fmtWorth(r.worth)}</dd></div>`).join('');
  const tiers = w.tiers.map((t) => `<div class="st-part"><dt>${esc(t.tier)} (${Math.round(t.armour * 100)}%)</dt><dd>${fmtWorth(t.worth)}</dd></div>`).join('');
  return sectionHTML('worth', 'What 1 point is worth', `
    <p class="st-guide">Estimated damage gain for your current build.</p>
    <dl class="st-worth">${rows}</dl>
    <p class="st-note">${esc(w.why)}</p>
    <div class="st-parts"><p class="st-guide">Armour pierce against a boss your level (${Math.round(w.armour * 100)}% armour)</p><dl>${tiers}</dl></div>`);
}

function effectsHTML(effects) {
  const groups = EFFECT_GROUPS.map(([kind, title]) => {
    const rows = effects.filter((effect) => effect.kind === kind);
    if (!rows.length) return '';
    return `<section class="st-effect-group"><h4>${esc(title)}</h4><ul>${rows.map((effect) => `
      <li class="st-fx${effect.off ? ' off' : ''}">
        <div class="st-fx-top"><b>${esc(effect.name)}</b>${effect.left == null ? '' : `<span class="st-fx-time">${fmtTime(effect.left)}</span>`}</div>
        ${effect.detail ? `<p class="st-fx-detail">${esc(effect.detail)}</p>` : ''}
        ${effect.off ? `<p class="st-fx-off">Inactive · ${esc(effect.off)}</p>` : ''}
      </li>`).join('')}</ul></section>`;
  }).join('');
  const active = effects.filter((effect) => !effect.off).length;
  return sectionHTML('effects', 'Active effects', groups || '<p class="st-guide">No effects running.</p>', { meta: active ? `${active} running` : 'None' });
}

/** Stats and their sources stay in native disclosures for touch and keyboard. */
export function statsPanelHTML(sheet, open = new Set(), worth = null) {
  let html = overviewHTML(sheet);
  for (const section of sheet.sections) {
    if (!section.rows.length) continue;
    html += sectionHTML(section.id, section.title, section.rows.map((row) => rowHTML(row, open)).join(''), {
      open: section.rows.some((row) => open.has(row.id)),
    });
  }
  return html + effectsHTML(sheet.effects) + (worth ? worthBoxHTML(worth) : '');
}

export function refreshStatsPanel(el, sheet, worth, previous) {
  const html = statsPanelHTML(sheet, new Set(), worth);
  if (previous === html) return html;

  const selector = 'details[data-stats-disclosure]';
  const open = new Set([...el.querySelectorAll(`${selector}[open]`)].map((detail) => detail.dataset.statsDisclosure));
  const active = el.ownerDocument?.activeElement;
  const focused = active && el.contains(active) ? active.closest(selector) : null;
  const section = focused?.closest('[data-sec]')?.dataset.sec;
  const scroller = el.closest('#panel-body');
  const scroll = scroller?.scrollTop;
  el.innerHTML = html;

  // Timers can redraw the sheet while someone has a nested source open or focused.
  const details = [...el.querySelectorAll(selector)];
  for (const detail of details) detail.open = open.has(detail.dataset.statsDisclosure);
  if (focused) {
    const restored = details.find((detail) => detail.dataset.statsDisclosure === focused.dataset.statsDisclosure)
      || details.find((detail) => detail.dataset.sec === section);
    restored?.querySelector('summary')?.focus({ preventScroll: true });
  }
  if (Number.isFinite(scroll)) scroller.scrollTop = scroll;
  return html;
}
