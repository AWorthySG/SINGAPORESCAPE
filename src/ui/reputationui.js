// The bits of UI for region reputation (src/game/reputation.js) and the
// consequences of your choices (src/game/consequences.js): a "Regions" view in
// the Journal tab (each region's badge, rank, progress, rewards and what your
// choices changed there, with a button to wear an earned title), and a small
// pill that shows your standing as you walk into a region. ui.js only calls
// installReputationUI; regionsPanelHTML returns a plain string so the tests
// can render it headlessly.
import { REP_REGIONS, repPoints, rankFor, repProgress, rankPerkText, repTitleText, setRepTitle } from '../game/reputation.js';
import { consequencesIn } from '../game/consequences.js';
import { badgeKey } from '../render/fxart.js';
import { uiIconHTML } from '../render/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const badgeSrc = (region) => `assets/fx/${badgeKey(region)}.webp`;

/** The Regions view (a string). */
export function regionsPanelHTML(game) {
  const visited = game.zonesVisited || new Set();
  const worn = game.rep?.title || null;
  let html = '<div class="rep-intro">Help a region’s people and they get to know you: quests, world events, bounties, '
    + 'Slayer work and clearing its monsters all count. Evil deeds there are remembered too.</div>';
  html += '<div class="rep-list">';
  const order = [...REP_REGIONS].sort((a, b) => (b === game.currentZoneName) - (a === game.currentZoneName));
  for (const region of order) {
    const pts = repPoints(game, region), r = rankFor(pts), prog = repProgress(pts);
    const seen = visited.has(region) || pts !== 0;
    const changes = consequencesIn(game, region);
    const here = region === game.currentZoneName;
    html += `<div class="rep-row rank-${r.id}${seen ? '' : ' dim'}${here ? ' here' : ''}" style="--rk:${r.colour}">`
      + (r.id === 'legend'   // a Legend's badge sits on a golden ribbon
        ? `<span class="rep-badge-wrap"><img class="rep-badge" src="${badgeSrc(region)}" alt="" loading="lazy">${uiIconHTML('legend-ribbon', 46, 'rep-ribbon')}</span>`
        : `<img class="rep-badge" src="${badgeSrc(region)}" alt="" loading="lazy">`)
      + '<div class="rep-main">'
      + `<div class="rep-top"><b>${esc(region)}</b><span class="rep-chip">${esc(r.name)}</span></div>`
      + (here ? '<div class="rep-here">You are here</div>' : '');
    if (!seen) html += '<div class="rep-next">Not visited yet.</div>';
    else {
      html += `<div class="rep-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog ? Math.round(prog.frac * 100) : 100}"><i style="width:${prog ? Math.round(prog.frac * 100) : 100}%"></i></div>`
        + `<div class="rep-next">${prog ? `${prog.need.toLocaleString()} more to ${esc(prog.next.name)}` : 'The highest standing there is.'} &middot; ${esc(rankPerkText(r))}</div>`;
    }
    if (changes.length) html += `<ul class="rep-changes">${changes.map((c) => `<li class="${c.mood < 0 || c.leaves || c.price?.buy > 1 ? 'bad' : 'good'}">${esc(c.text)}</li>`).join('')}</ul>`;
    if (r.title) {
      const on = worn === region;
      html += `<button type="button" class="rep-title-btn${on ? ' on' : ''}" data-region="${on ? '' : esc(region)}">${on ? 'Take off title' : `Wear title: ${esc(r.title)} ${esc(region)}`}</button>`;
    }
    html += '</div></div>';
  }
  html += '</div>';
  const t = repTitleText(game);
  if (t) html += `<div class="modal-hint">Wearing: ${esc(t)}.</div>`;
  return html;
}

/** Add the Regions view to the Journal tab, and the region pill. */
export function installReputationUI(ui, PANEL_TABS, SUBTAB_LABELS) {
  if (typeof document === 'undefined' || ui._repUI) return;
  ui._repUI = true;
  const game = ui.game;
  // The view sits beside Quests and Awards in the Journal tab.
  if (PANEL_TABS?.quests && !PANEL_TABS.quests.includes('regions')) PANEL_TABS.quests.push('regions');
  if (SUBTAB_LABELS) SUBTAB_LABELS.regions = 'Regions';
  const body = document.getElementById('panel-body');
  let view = document.querySelector('#panel-body .panel-view[data-view="regions"]');
  if (body && !view) {
    view = document.createElement('section');
    view.className = 'panel-view hidden';
    view.dataset.view = 'regions';
    view.innerHTML = '<div id="region-panel"></div>';
    body.appendChild(view);
  }
  const panel = document.getElementById('region-panel');
  const render = () => {
    if (!panel || view?.classList.contains('hidden')) return;   // only drawn while showing
    const sc = body?.scrollTop || 0;
    panel.innerHTML = regionsPanelHTML(game);
    panel.querySelectorAll('.rep-title-btn').forEach((b) => b.addEventListener('click', () => { setRepTitle(game, b.dataset.region || null); render(); }));
    if (body) body.scrollTop = sc;
  };
  // The panel's title and a fresh draw whenever the view is shown.
  const setTitle = ui._setPanelTitle.bind(ui);
  ui._setPanelTitle = (v) => {
    setTitle(v);
    if (v === 'regions') { const el = ui.el.panelTitle || ui.el.panelHead; if (el) el.textContent = 'Region Reputation'; }
  };
  const show = ui._showPanelView.bind(ui);
  ui._showPanelView = (v) => { show(v); if (v === 'regions') render(); };
  ui.bus.on('rep', () => ui._soon('rep', render, 400));

  // The pill: your standing, for a few seconds, as you walk into a region.
  const root = document.getElementById('game-root') || document.body;
  const pill = document.createElement('div');
  pill.id = 'rep-pill';
  pill.className = 'hidden';
  pill.setAttribute('aria-live', 'polite');
  root.appendChild(pill);
  let last = null, timer = null;
  const setRegion = ui.setRegion.bind(ui);
  ui.setRegion = (name, wild) => {
    setRegion(name, wild);
    if (name === last) return;
    const first = last === null;
    last = name;
    render();   // "You are here" moves with you
    if (first || !REP_REGIONS.includes(name)) return;   // not on the first frame, nor between regions
    const r = rankFor(repPoints(game, name));
    pill.style.setProperty('--rk', r.colour);
    pill.innerHTML = `<img src="${badgeSrc(name)}" alt=""><span><b>${esc(name)}</b> &middot; ${esc(r.name)}</span>`;
    pill.classList.remove('hidden', 'out');
    clearTimeout(timer);
    timer = setTimeout(() => { pill.classList.add('out'); timer = setTimeout(() => pill.classList.add('hidden'), 400); }, 3600);
  };
}
