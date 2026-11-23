// The Monster Codex window: browse every monster and boss, filter and sort
// them, and open an entry for the full story (art, stats, matchups, where it
// lives, drops, a boss's signature move). The facts come from src/game/codex.js;
// this file only turns them into HTML and wires the controls. ui.js just opens
// it: from the Bestiary button, by right-clicking a monster in the world, and
// by tapping the portrait on the battle bar.
//
// The list is drawn a page at a time ("Show more"), never all ~600 rows at
// once, so it stays quick on phones. The page-building functions return plain
// strings, so the tests can render them without a DOM.
import { getNpc } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { RACES, raceOf } from '../data/races.js';
import { formatNumber } from '../core/utils.js';
import { itemIconSVG, playIconHTML, mechIcon } from '../render/icons.js';
import { portraitFor } from '../render/sprites.js';
import {
  CODEX_IDS, TYPE_FILTERS, SORTS, codexList, codexEntry, codexProgress, codexRegions, codexHabitats,
  isDiscovered, killsOf, championCapable, chanceText, nearestSpawn,
} from '../game/codex.js';
import { masteryProgress, masterySummary, earnedTitles, setTitle, MASTERY_TIERS, RACE_MASTERY_CAP, raceMastery } from '../game/culling.js';
import { codexSwitchHTML, renderCompendium, defaultCompendiumState } from './compendiumui.js';
import { renderEncyclopedia, ENCY_VIEWS } from './encyclopediaui.js';
import { creatureFlavour } from '../data/flavour.js';

export const PAGE_SIZE = 40;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Stats in full ("2,700,000"), as the battle bar shows them, not shortened to "2.7M".
const full = (n) => Number(n || 0).toLocaleString('en-GB');
const pct = (a, b) => (b ? Math.floor((a / b) * 100) : 0);

/** The filters the window opens with (remembered on the UI between openings). */
export function defaultCodexState() {
  return { search: '', region: 'all', race: 'all', type: 'all', disc: 'all', sort: 'level', minLevel: null, maxLevel: null, shown: PAGE_SIZE, id: null };
}

/** The creature's painted art (the same file the world draws), or null. */
function artSrc(id) {
  try { return portraitFor(id, getNpc(id))?.src || null; } catch { return null; }
}

/** A picture of the creature; an undiscovered one is a dark silhouette. Falls
 *  back to its race's emoji when there's no art. */
function artHTML(id, cls, seen) {
  const src = artSrc(id);
  const d = getNpc(id);
  if (!src) return `<span class="${cls} cx-noart">${seen ? RACES[codexRaceId(id)]?.icon || '?' : '?'}</span>`;
  // A borrowed picture wears its recolouring (not on a silhouette, which has its own filter).
  let tint = null;
  try { tint = seen ? portraitFor(id, d)?.tint : null; } catch { tint = null; }
  return `<img class="${cls}${seen ? '' : ' cx-silhouette'}" src="${esc(src)}"${tint ? ` style="filter:${esc(tint)}"` : ''} alt="${seen ? esc(d.name) : 'Unknown creature'}" loading="lazy" decoding="async" />`;
}
const codexRaceId = (id) => raceOf(getNpc(id), id);
const CODEX_SET = new Set(CODEX_IDS);

/** A progress bar: "12 / 593". */
function barHTML(seen, total, label = '') {
  return `<div class="cx-prog"><span class="cx-prog-label">${label}<b>${formatNumber(seen)} / ${formatNumber(total)}</b> · ${pct(seen, total)}%</span>` +
    `<span class="cx-bar"><i style="width:${pct(seen, total)}%"></i></span></div>`;
}

/** The completion counter at the top of the list, with every region's own. */
export function codexProgressHTML(game) {
  const p = codexProgress(game);
  const regions = p.regions.map((r) => `<div class="cx-reg${r.seen === r.total ? ' done' : ''}"><span>${esc(r.name)}</span>` +
    `<span class="cx-bar"><i style="width:${pct(r.seen, r.total)}%"></i></span><b>${r.seen}/${r.total}</b></div>`).join('');
  return `<div class="cx-head">${barHTML(p.seen, p.total, 'Discovered ')}` +
    `<details class="cx-regions"><summary>By region</summary><div class="cx-reg-grid">${regions}</div></details>${masteryHeadHTML(game)}</div>`;
}

// Roman numerals for the mastery badge, coloured bronze, silver and gold.
const TIER_MARK = ['', 'I', 'II', 'III'];
const tierBadge = (t) => (t ? `<span class="cx-tag mastery t${t}" title="${MASTERY_TIERS[t - 1].name} codex mastery">${TIER_MARK[t]}</span>` : '');

/** Codex mastery at a glance (culling.js), and the titles you've earned with
 *  a button each to wear one (shown over your head while you are Neutral). */
function masteryHeadHTML(game) {
  const [t1, t2, t3] = masterySummary(game);
  const titles = earnedTitles(game), worn = game?.culling?.title;
  const list = titles.map((t) => `<button type="button" class="cx-title-btn${worn === t.id ? ' worn' : ''}" data-title="${esc(t.id)}">${esc(t.title)}${worn === t.id ? ' (worn)' : ''}</button>`).join('');
  return `<div class="cx-mastery-sum">Mastery: ${tierBadge(1)} ${t1} · ${tierBadge(2)} ${t2} · ${tierBadge(3)} ${t3}` +
    (titles.length ? `<details class="cx-titles"><summary>Titles (${titles.length})</summary><div>${list}` +
      (worn ? '<button type="button" class="cx-title-btn" data-title="">Wear none</button>' : '') + '</div></details>' : '') + '</div>';
}

/** One row of the list. */
export function codexRowHTML(game, id) {
  const d = getNpc(id), seen = isDiscovered(game, id), k = killsOf(game, id);
  const zones = codexHabitats(game).get(id) || [];
  const where = zones.length > 2 ? `${esc(zones[0])} +${zones.length - 1} more` : zones.map(esc).join(', ');
  const tags = (d.boss ? '<span class="cx-tag boss">Boss</span>' : '') +
    (seen && championCapable(d) ? '<span class="cx-tag champ" title="Can turn up as a champion">★</span>' : '') +
    (seen ? tierBadge(masteryProgress(game, id).tier) : '');
  return `<button type="button" class="cx-row${seen ? '' : ' unseen'}${d.boss ? ' is-boss' : ''}" data-id="${esc(id)}">` +
    artHTML(id, 'cx-thumb', seen) +
    `<span class="cx-row-main"><span class="cx-row-top"><b>${seen ? esc(d.name) : '???'}</b>${tags}</span>` +
    `<span class="cx-row-sub">Lvl ${formatNumber(d.level)} · ${where || 'Unknown'}</span></span>` +
    `<span class="cx-kc">${seen ? `${formatNumber(k)} kill${k === 1 ? '' : 's'}` : 'Undiscovered'}</span></button>`;
}

/** The list page: a count, the first `st.shown` matches, and Show more. */
export function codexListHTML(game, st) {
  const ids = codexList(game, st);
  const shown = ids.slice(0, Math.max(PAGE_SIZE, st.shown || PAGE_SIZE));
  let html = `<div class="cx-count">${ids.length === CODEX_IDS.length ? `All ${formatNumber(ids.length)} creatures` : `${formatNumber(ids.length)} of ${formatNumber(CODEX_IDS.length)} creatures`}</div>`;
  if (!ids.length) return html + '<div class="modal-hint">No creatures match these filters.</div>';
  html += `<div class="cx-list">${shown.map((id) => codexRowHTML(game, id)).join('')}</div>`;
  if (shown.length < ids.length) html += `<button type="button" class="cx-more">Show ${Math.min(PAGE_SIZE, ids.length - shown.length)} more (${formatNumber(ids.length - shown.length)} left)</button>`;
  return html;
}

const stat = (label, value, hint = '') => `<div class="cx-stat"${hint ? ` title="${esc(hint)}"` : ''}><span>${label}</span><b>${value}</b></div>`;

/** The entry page for one creature. Undiscovered: a silhouette, its level and
 *  where it lives, and a hint to defeat one. */
export function codexEntryHTML(game, id) {
  const e = codexEntry(game, id);
  const where = e.zones.length ? e.zones.map((z) => `<span class="cx-zone" role="button" tabindex="0" data-ency="region:${esc(z)}">${esc(z)}</span>`).join('') : '<span class="cx-zone">Unknown</span>';
  const head = `<div class="cx-entry-top">${artHTML(id, 'cx-art', e.discovered)}<div class="cx-entry-id">` +
    `<div class="cx-entry-name">${e.discovered ? esc(e.name) : '???'}${e.boss ? ' <span class="cx-tag boss">Boss</span>' : ''}</div>` +
    `<div class="cx-entry-lvl">Level ${formatNumber(e.level)}` +
    (e.discovered ? ` · <span title="${esc(e.race.desc)}">${e.race.icon} ${esc(e.race.name)}</span>` : '') + '</div>' +
    (e.discovered && e.examine ? `<div class="cx-examine">${esc(e.examine)}</div>` : '') +
    `<div class="cx-entry-kc">${e.discovered ? `You've defeated ${formatNumber(e.kills)}.` : 'Not yet discovered.'}</div>` +
    '</div></div>';
  const whereHTML = `<div class="cx-sec"><h4>Where it lives</h4><div class="cx-zones">${where}</div><div class="cx-go-row"></div></div>`;
  // A boss's mechanic (bossMechanics.js): shown from the start, so you can learn it before the fight.
  const m = e.mechanic;
  const mechHTML = m ? `<div class="cx-sec cx-mech"><h4>Mechanic: ${playIconHTML(mechIcon(m.type), 20)} ${esc(m.kind)}</h4><div class="cx-ability"><b>${esc(m.name)}:</b> ${esc(m.how)}</div></div>` : '';
  const at = e.armourType;   // a boss's armour type and how to beat it
  const typeHTML = at ? `<div class="cx-sec cx-armour-type"><h4>Armour type: ${esc(at.icon)} ${esc(at.name)}</h4><p>${esc(at.hint)}</p></div>` : '';
  // A real animal's "Did you know?" (flavour.js), shown from the start.
  const dyk = creatureFlavour(getNpc(id), id);
  const dykHTML = dyk ? `<div class="cx-sec ency-dyk"><h4>Did you know?</h4><p>${esc(dyk)}</p></div>` : '';
  if (!e.discovered) {
    return head + dykHTML + whereHTML + typeHTML + mechHTML + '<div class="cx-sec cx-locked">Defeat one to reveal its stats, matchups and drops.</div>';
  }
  const scaleNote = e.numberScale > 1 ? `<div class="cx-note">Numbers ×1/${e.numberScale} scale: its life, and every hit you land on it, are shown ${e.numberScale} times smaller.</div>` : '';
  const stats = '<div class="cx-sec"><h4>Stats</h4><div class="cx-stats">' +
    stat('Life', full(e.life)) +
    stat('Attack', full(e.attack)) +
    stat('Defence', full(e.defence)) +
    stat('Max hit', full(e.maxHit), 'The most one of its ordinary hits can take from you') +
    stat('Armour', `${esc(e.armour.tier)} (${e.armour.pct}%)`, 'The share of each hit its armour stops (half as much when you hit its weakness)') +
    stat('Aggressive', e.aggressive ? 'Yes' : 'No', e.aggressive ? 'Attacks you on sight' : 'Only fights back') +
    '</div>' + scaleNote +
    (e.championLife ? `<div class="cx-note">★ Can turn up as a champion: ${full(e.championLife)} life, harder hits and much better loot.</div>` : '') + '</div>';
  const els = (e.elements || []).filter((x) => x.list.length).map((x) => `<span class="cx-weapon cx-el-${x.m}" title="Spells of this element do ×${x.mult} damage">${x.m === 'strong' ? 'weak to' : 'resists'} ${x.list.map(esc).join(', ')}</span>`).join('');
  const strong = `<div class="cx-sec"><h4>Strong against it</h4><div class="cx-weapons">${e.strongWeapons.map((w) => `<span class="cx-weapon">${esc(w)}</span>`).join('') || '<i>No weapon type in particular.</i>'}</div>` +
    (els ? `<div class="cx-weapons cx-elements">${els}</div>` : '') + '</div>';
  let boss = '';
  if (e.signature) {
    const mine = e.signature.classId === game?.jobClass;
    boss += `<div class="cx-sec cx-sig${mine ? ' mine' : ''}"><h4>Signature weapon</h4>${itemIconSVG(e.signature.item, 28)}` +
      `<span><b>${esc(getItem(e.signature.item).name)}</b> for ${esc(e.signature.className)}${mine ? ' (your class!)' : ''} · drops 1 kill in ${Math.round(1 / e.signature.chance)}</span></div>`;
  }
  for (const a of e.ascended || []) {
    // Its extra weapons: ascended ones (stronger than eternal), and the late classes' plain ones (bossWeapons.js LATE_SIGS).
    const mine = a.classId === game?.jobClass, asc = getItem(a.item).signature?.ascended;
    boss += `<div class="cx-sec cx-sig${mine ? ' mine' : ''}"><h4>${asc ? 'Ascended signature weapon' : 'Signature weapon'}</h4>${itemIconSVG(a.item, 28)}` +
      `<span><b>${esc(getItem(a.item).name)}</b> for ${esc(a.className)}${mine ? ' (your class!)' : ''}${asc ? ', stronger than eternal' : ''} · drops 1 kill in ${Math.round(1 / a.chance)}</span></div>`;
  }
  if (e.ability) {
    boss += `<div class="cx-sec"><h4>Signature move</h4><div class="cx-ability"><b>${esc(e.ability.name)}:</b> ${esc(e.ability.desc)}</div>` +
      (e.ability.hazards.length ? `<div class="cx-hazards">Ground attacks: ${e.ability.hazards.map((h) => `<span class="cx-hazard" title="${esc(h.desc)}"><b>${esc(h.name)}</b> ${esc(h.desc)}</span>`).join('')}</div>` : '') +
      '</div>';
  }
  boss += typeHTML + mechHTML;
  const drops = e.drops.map((dr) => {
    const it = getItem(dr.id);
    const qty = dr.max > 1 ? (dr.min === dr.max ? `${formatNumber(dr.min)} × ` : `${formatNumber(dr.min)}–${formatNumber(dr.max)} × `) : '';
    return `<div class="cx-drop" title="${esc(it.name)}" role="button" tabindex="0" data-ency="item:${esc(dr.id)}">${itemIconSVG(dr.id, 24)}<span class="cx-drop-name">${qty}${esc(it.name)}</span><span class="cx-drop-chance${dr.always ? ' always' : ''}">${chanceText(dr.chance)}</span></div>`;
  }).join('');
  const dropsHTML = `<div class="cx-sec"><h4>Drops <small>(rough chances per kill${e.boss ? '; bosses roll ten times' : ''})</small></h4><div class="cx-drops">${drops || '<i>No notable drops.</i>'}</div></div>`;
  return head + dykHTML + masteryHTML(game, id, e) + stats + strong + boss + whereHTML + dropsHTML;
}

/** The entry's mastery section: its tier, progress to the next, and what each tier gives. */
function masteryHTML(game, id, e) {
  const m = masteryProgress(game, id);
  const race = raceMastery(game, e.race.id);
  const tiers = MASTERY_TIERS.map((t) => `<li class="${m.tier >= t.tier ? 'got' : ''}">${tierBadge(t.tier)} <b>${t.name}</b> at ${formatNumber(t.kills)}: ` +
    `+${Math.round(t.dmg * 100)}% damage, +${Math.round(t.loot * 100)}% loot` + (t.race ? `, +${Math.round(t.race * 100)}% vs all ${esc(e.race.name)}` : '') +
    (t.tier === 3 ? ', and a title' : '') + '</li>').join('');
  return `<div class="cx-sec cx-mastery"><h4>Codex mastery ${tierBadge(m.tier)}</h4>` +
    `<div class="cx-prog"><span class="cx-prog-label">${m.tier ? `<b>${m.name}</b>` : 'No tier yet'} · ` +
    (m.next ? `${formatNumber(m.count)} / ${formatNumber(m.next)} to the next tier` : `${formatNumber(m.count)} kills · mastered`) +
    `</span><span class="cx-bar"><i style="width:${m.pct}%"></i></span></div>` +
    `<ul class="cx-tiers">${tiers}</ul>` +
    (m.title ? `<div class="cx-note">Title earned: <b>${esc(m.title)}</b> (wear it from the list's Titles).</div>` : '') +
    (race ? `<div class="cx-note">All your ${esc(e.race.name)} mastery together: +${Math.round(race * 100)}% damage to every ${esc(e.race.name)} creature (at most +${Math.round(RACE_MASTERY_CAP * 100)}%).</div>` : '') +
    '</div>';
}

// The window's title for each section.
const VIEW_TITLE = { monsters: 'Monster Codex', compendium: 'Compendium', items: 'Item Encyclopedia', places: 'Places', foryou: 'For you', search: 'Search the Codex' };

/** Open the codex; with an id, straight to that creature's entry. The window
 *  has two sections, switched at its top: the Monsters list and the
 *  Compendium (compendiumui.js). `view: 'compendium'` opens on the latter, at
 *  `article` if one is named. */
export function openCodex(ui, id = null, { view, article } = {}) {
  const game = ui.game;
  const st = ui._codex || (ui._codex = defaultCodexState());
  const cst = ui._compendium || (ui._compendium = defaultCompendiumState());
  st.id = id && CODEX_SET.has(id) ? id : null;
  // No section asked for: the one it was left on (remembered: windowease.js).
  st.view = st.id ? 'monsters' : view || st.view || 'monsters';
  if (article !== undefined) cst.id = article;
  let listEl = null;

  const drawList = () => {
    if (!listEl) return;
    listEl.innerHTML = codexListHTML(game, st);
    listEl.querySelector('.cx-more')?.addEventListener('click', () => {
      // Keep the scroll where it is and just add the next page underneath.
      st.shown = (st.shown || PAGE_SIZE) + PAGE_SIZE; drawList();
    });
  };

  const control = (tag, cls, attrs = {}) => {
    const el = document.createElement(tag);
    el.className = cls;
    Object.assign(el, attrs);
    return el;
  };
  const select = (key, options, label) => {
    const s = control('select', 'cx-select', { title: label });
    s.setAttribute('aria-label', label);
    s.innerHTML = options.map((o) => `<option value="${esc(o.id)}"${String(st[key]) === String(o.id) ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
    s.addEventListener('change', () => { st[key] = s.value; st.shown = PAGE_SIZE; drawList(); });
    return s;
  };

  const renderList = (body) => {
    body.innerHTML = codexProgressHTML(game);
    body.querySelectorAll('.cx-title-btn').forEach((b) => b.addEventListener('click', () => { setTitle(game, b.dataset.title || null); render(body); }));
    const bar = control('div', 'cx-filters');
    const search = control('input', 'bank-search cx-search', { placeholder: 'Search creatures…', value: st.search || '', type: 'search' });
    search.addEventListener('input', () => { st.search = search.value; st.shown = PAGE_SIZE; drawList(); });
    bar.appendChild(search);
    bar.appendChild(select('region', [{ id: 'all', name: 'All regions' }, ...codexRegions(game).map((n) => ({ id: n, name: n }))], 'Region'));
    bar.appendChild(select('race', [{ id: 'all', name: 'All races' }, ...Object.entries(RACES).map(([rid, r]) => ({ id: rid, name: `${r.icon} ${r.name}` }))], 'Race'));
    bar.appendChild(select('type', TYPE_FILTERS, 'Type'));
    bar.appendChild(select('disc', [{ id: 'all', name: 'Seen and unseen' }, { id: 'seen', name: 'Discovered' }, { id: 'unseen', name: 'Undiscovered' }], 'Discovered'));
    bar.appendChild(select('sort', SORTS.map((s) => ({ id: s.id, name: `Sort: ${s.name}` })), 'Sort'));
    const lv = control('span', 'cx-levels');
    lv.innerHTML = '<span>Lvl</span>';
    for (const key of ['minLevel', 'maxLevel']) {
      const inp = control('input', 'bank-search cx-lvl', { type: 'number', min: 1, inputMode: 'numeric', placeholder: key === 'minLevel' ? 'min' : 'max', value: st[key] ?? '' });
      inp.setAttribute('aria-label', key === 'minLevel' ? 'Lowest level' : 'Highest level');
      inp.addEventListener('input', () => { const v = parseInt(inp.value, 10); st[key] = Number.isFinite(v) ? v : null; st.shown = PAGE_SIZE; drawList(); });
      lv.appendChild(inp);
      if (key === 'minLevel') lv.insertAdjacentHTML('beforeend', '<span>–</span>');
    }
    bar.appendChild(lv);
    const reset = control('button', 'cx-reset', { type: 'button', textContent: 'Clear' });
    reset.addEventListener('click', () => { const keep = st.sort; Object.assign(st, defaultCodexState(), { sort: keep }); render(body); });
    bar.appendChild(reset);
    body.appendChild(bar);
    listEl = control('div', 'cx-results');
    // One listener for every row (rows come and go as the filters change).
    listEl.addEventListener('click', (ev) => {
      const row = ev.target.closest?.('.cx-row');
      if (row) { st.id = row.dataset.id; st.listScroll = body.scrollTop; render(body); body.scrollTop = 0; }
    });
    body.appendChild(listEl);
    drawList();
  };

  const renderEntry = (body) => {
    const id = st.id;
    body.innerHTML = '';
    const back = control('button', 'cx-back', { type: 'button', innerHTML: '&#8592; All creatures' });
    back.addEventListener('click', () => { st.id = null; render(body); body.scrollTop = st.listScroll || 0; });
    body.appendChild(back);
    const page = control('div', 'cx-entry');
    page.innerHTML = codexEntryHTML(game, id);
    body.appendChild(page);
    // Go / Show on map: to the nearest place it lives (works before you've
    // met one too, so the codex can send you hunting).
    const row = page.querySelector('.cx-go-row');
    const spot = nearestSpawn(game, id);
    if (row && spot) {
      const label = isDiscovered(game, id) ? getNpc(id).name : 'An undiscovered creature';
      row.insertAdjacentHTML('beforeend', `<span class="cx-dist">Nearest: ${formatNumber(spot.dist)} tiles away</span>`);
      const go = control('button', 'wm-go', { type: 'button', textContent: 'Go', title: 'Travel to the nearest one (by MRT and on foot)' });
      go.addEventListener('click', () => { ui.closeModal(); game.travelToTile({ x: spot.x, y: spot.y }); });
      const map = control('button', 'wm-go cx-map', { type: 'button', textContent: 'Show on map' });
      map.addEventListener('click', () => ui.openWorldMap({ x: spot.x, y: spot.y, label }));
      row.appendChild(map);
      row.appendChild(go);
    }
  };

  // The Monsters | Compendium switch over the list (an entry has its Back button instead).
  const flip = (body, v) => { st.view = v; render(body); body.scrollTop = 0; };
  const render = (body) => {
    const title = VIEW_TITLE[st.view] || 'Monster Codex';
    if (ui.modal) ui.modal.title = title;
    if (ui.el?.modalTitle) ui.el.modalTitle.textContent = title;
    if (st.view === 'compendium') { renderCompendium(body, cst, (v) => flip(body, v)); return; }
    if (ENCY_VIEWS.includes(st.view)) { renderEncyclopedia(ui, body, st.view, (v) => flip(body, v)); return; }
    if (st.id) { renderEntry(body); return; }
    renderList(body);
    body.insertAdjacentHTML('afterbegin', codexSwitchHTML('monsters'));
    body.querySelector('.cx-switch')?.addEventListener('click', (ev) => {
      const v = ev.target.closest?.('[data-view]')?.dataset.view;
      if (v && v !== 'monsters') flip(body, v);
    });
  };
  ui.openModal(VIEW_TITLE[st.view] || 'Monster Codex', render);
  if (ui.modal) ui.modal.kind = 'codex';
}

/** Open the Codex window on the Compendium: its contents, or one article. */
export function openCompendium(ui, article = null) {
  openCodex(ui, null, { view: 'compendium', article });
}

/** The monster drawn under a point on the game screen (CSS pixels), if any:
 *  its sticker stands on its tile and reaches up about a tile, more for big ones. */
export function monsterAtScreen(game, sx, sy, tile = 32) {
  const cam = game?.camera;
  if (!cam?.screenToWorld) return null;
  const w = cam.screenToWorld(sx, sy);
  let best = null, bd = Infinity;
  for (const n of game.npcs) {
    if (!n.alive || !n.def?.attackable || !CODEX_SET.has(n.npcId)) continue;
    const k = n.moving ? n.progress || 0 : 0;
    const fx = n.x + ((n.tx ?? n.x) - n.x) * k, fy = n.y + ((n.ty ?? n.y) - n.y) * k;
    const size = Math.max(1, n.def.scale || 1);
    const cx = (fx + 0.5) * tile, cy = (fy + 0.5) * tile - tile * 0.35 * size;
    const d = Math.hypot(w.x - cx, (w.y - cy) * 0.8);
    if (d < tile * 0.75 * size && d < bd) { bd = d; best = n; }
  }
  return best;
}
