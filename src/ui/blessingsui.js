// The Prayer panel as a Blessings loadout (game/blessings.js): the Faith bar
// and the Prayer Burst button, the slot strip (tap a slot to take that blessing
// off), and every blessing with its level (tap to equip or take off). Also the
// Faith orb on the minimap, which fires the Burst when the bar is full.
//
// The HTML comes from pure functions so tests can check it without a DOM. The
// strip and the list are only redrawn when the loadout or the level changes;
// Faith ticking up while you fight just moves the bar.
import { PRAYERS, PRAYER_BY_ID, BLESSING_SLOT_LADDER, blessingCost, burstPower } from '../data/prayers.js';
import { prayerIconHTML, uiIconHTML } from '../render/icons.js';
import { faithFull } from '../game/blessings.js';

/** The Burst's hotkey (main.js); shown on the button and the orb. */
export const BURST_KEY = 'L';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "+25% Str +25% Def", "-30% damage taken". */
export function blessingEffect(p) {
  if (p.protect) return `-${Math.round(p.protect * 100)}% damage taken`;
  const labels = { crit: 'crit', att: 'Att', str: 'Str', def: 'Def', ranged: 'Rng', magic: 'Mag' };
  return Object.keys(labels).filter((k) => p[k]).map((k) => `+${Math.round(p[k] * 100)}% ${labels[k]}`).join(' ');
}

/** The Burst in a line, at a Prayer level. */
export function burstText(level) {
  const pw = burstPower(level);
  return `Heal ${Math.round(pw.heal * 100)}% life, stop every blow for 3s, +${Math.round(pw.zeal * 100)}% damage for 8s`;
}

/** Faith as a fraction of the cap (0..1). */
export const faithFrac = (game) => { const m = game.maxPrayer(); return m ? Math.max(0, Math.min(1, game.prayerPoints / m)) : 0; };

/** The slot strip: equipped blessings (a two-slot one is twice as wide), then
 *  empty slots, then the slots still to unlock with their Prayer level. */
export function slotStripHTML(game) {
  const lvl = game.skills.prayer, open = game.blessingSlots();
  let used = 0, html = '';
  for (const id of game.activePrayers) {
    const p = PRAYER_BY_ID[id];
    if (!p) continue;
    const cost = blessingCost(p);
    used += cost;
    html += `<button type="button" class="bl-slot filled" data-unequip="${p.id}" style="flex-grow:${cost}" title="${esc(p.name)}: ${esc(blessingEffect(p))}. Tap to take off.">`
      + `<span class="bl-slot-ic">${prayerIconHTML(p.art || p.id, 26, '', p.tint)}</span><span class="bl-slot-name">${esc(p.name)}</span></button>`;
  }
  for (let i = used; i < open; i++) html += '<div class="bl-slot empty" title="An empty blessing slot: tap a blessing below to put it here.">Empty</div>';
  const total = BLESSING_SLOT_LADDER[BLESSING_SLOT_LADDER.length - 1].slots;
  for (let i = Math.max(used, open); i < total; i++) {
    const rung = BLESSING_SLOT_LADDER.find((r) => r.slots > i);
    html += `<div class="bl-slot locked" title="Unlocks at Prayer level ${rung.level}">Lvl ${rung.level}</div>`;
  }
  return `<div class="bl-slots" data-lvl="${lvl}">${html}</div>`;
}

/** One row per blessing, as before (the .prayer-cell look and tap size). */
export function blessingListHTML(game) {
  const lvl = game.skills.prayer;
  return PRAYERS.map((p) => {
    const on = game.activePrayers.has(p.id), locked = lvl < p.level, cost = blessingCost(p);
    const cls = ['prayer-cell', on && 'active', locked && 'locked'].filter(Boolean).join(' ');
    return `<div class="${cls}" data-prayer="${p.id}" role="button" tabindex="0" aria-pressed="${on}">`
      + `<span class="pr-ic">${prayerIconHTML(p.art || p.id, 30, '', p.tint)}</span><span class="pr-text">`
      + `<span class="pr-top"><b>${esc(p.name)}</b><span class="pr-lvl">Lvl ${p.level}</span></span>`
      + `<span class="pr-effect">${esc(blessingEffect(p))}${cost > 1 ? ` · ${cost} slots` : ''}</span></span>`
      + `<span class="pr-bar"><i style="width:${Math.round(Math.min(1, lvl / p.level) * 100)}%"></i></span></div>`;
  }).join('');
}

/** The whole panel (the Faith bar's numbers are filled in by renderBlessingsPanel). */
export function blessingsPanelHTML(game) {
  const open = game.blessingSlots(), used = [...game.activePrayers].reduce((n, id) => n + blessingCost(PRAYER_BY_ID[id]), 0);
  return '<div class="bl-head">'
    + '<div class="bl-faith" title="Faith fills as you fight (hits landed and taken, kills), from bones and at a Monument."><div class="bl-faith-bar"><i></i></div><span class="bl-faith-text"></span></div>'
    + `<button type="button" class="bl-burst" title="Prayer Burst (${BURST_KEY}): spend a full bar of Faith">${uiIconHTML('prayer-burst', 24, 'bl-burst-ic')}Burst <kbd>${BURST_KEY}</kbd></button>`
    + '</div>'
    + `<div class="bl-burst-info">${esc(burstText(game.skills.prayer))}</div>`
    + `<div class="bl-slots-label">Blessings <b>${used} / ${open}</b> slots · always on, no drain</div>`
    + slotStripHTML(game)
    + `<div class="prayer-grid">${blessingListHTML(game)}</div>`;
}

const sig = (game) => `${game.skills.prayer}|${[...game.activePrayers].join(',')}`;

/** Wire the panel once (clicks are delegated, so redraws need no rewiring). */
export function buildBlessingsPanel(ui) {
  const panel = ui.el.prayerPanel, game = ui.game;
  if (!panel) return;
  ui._blessSig = null;
  panel.addEventListener?.('click', (e) => {
    const t = e.target;
    if (t?.closest?.('.bl-burst')) { game.prayerBurst(); return; }
    const slot = t?.closest?.('[data-unequip]');
    if (slot) { game.toggleBlessing(slot.dataset.unequip); return; }
    const cell = t?.closest?.('.prayer-cell');
    if (cell) game.toggleBlessing(cell.dataset.prayer);
  });
  panel.addEventListener?.('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const cell = e.target?.closest?.('.prayer-cell');
    if (cell) { e.preventDefault(); game.toggleBlessing(cell.dataset.prayer); }
  });
  const orb = ui.el.prayerOrb;
  if (orb) {
    orb.addEventListener?.('click', () => game.prayerBurst());
    if (typeof document !== 'undefined' && !orb.querySelector?.('.orb-key')) {
      const k = document.createElement('kbd');
      k.className = 'orb-key'; k.textContent = BURST_KEY;
      orb.appendChild(k);
      orb.insertAdjacentHTML?.('beforeend', uiIconHTML('prayer-burst', 16, 'orb-burst'));   // the Burst's badge
    }
  }
  renderBlessingsPanel(ui);
}

/** Redraw: the list and strip when the loadout or level changed, the Faith bar always. */
export function renderBlessingsPanel(ui) {
  const panel = ui.el.prayerPanel, game = ui.game;
  if (!panel) return;
  const s = sig(game);
  if (ui._blessSig !== s) { ui._blessSig = s; panel.innerHTML = blessingsPanelHTML(game); }
  const frac = faithFrac(game), full = faithFull(game);
  const bar = panel.querySelector?.('.bl-faith-bar i');
  if (bar) bar.style.width = `${Math.round(frac * 100)}%`;
  const txt = panel.querySelector?.('.bl-faith-text');
  if (txt) txt.textContent = `Faith ${Math.floor(game.prayerPoints)} / ${game.maxPrayer()}${full ? ' · ready!' : ''}`;
  const btn = panel.querySelector?.('.bl-burst');
  if (btn) { btn.classList.toggle('ready', full); btn.setAttribute?.('aria-disabled', String(!full)); }
}

/** The Faith orb: the bar as a percentage, glowing when a Burst is ready. */
export function renderFaithOrb(ui) {
  const game = ui.game, orb = ui.el.prayerOrb;
  const frac = faithFrac(game), full = faithFull(game);
  if (ui.el.prayerOrbVal) ui.el.prayerOrbVal.textContent = Math.floor(frac * 100);
  if (!orb) return;
  orb.style.setProperty('--fill', frac.toFixed(3));
  orb.classList.toggle('ready', full);
  orb.classList.toggle('active', !!game.burstActive?.());
  orb.title = full ? `Faith full: click (or press ${BURST_KEY}) for a Prayer Burst` : `Faith ${Math.floor(frac * 100)}%: it fills as you fight. Full, it powers a Prayer Burst (${BURST_KEY})`;
}
