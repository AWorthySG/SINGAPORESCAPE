// The Prayer panel as a Blessings loadout (game/blessings.js): the Faith bar
// and the Faith Burst button, the slot strip (tap a slot to take that blessing
// off), the loadout's combined bonus, and every blessing with its level (tap to
// equip or take off; a row says when it would stack or swap). Also the
// Faith orb on the minimap, which fires the Burst when the bar is full.
//
// The HTML comes from pure functions so tests can check it without a DOM. The
// strip and the list are only redrawn when the loadout or the level changes;
// Faith ticking up while you fight just moves the bar.
import { PRAYERS, PRAYER_BY_ID, BLESSING_SLOT_LADDER, blessingCost, burstPower, STACK_SHARE } from '../data/prayers.js';
import { prayerIconHTML, uiIconHTML } from '../render/icons.js';
import { faithFull, blessingAction, blessingBonus, slotsUsed } from '../game/blessings.js';

/** The Burst's hotkey (main.js); shown on the button and the orb. */
export const BURST_KEY = 'L';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FILTERS = { all: 'All', available: 'Available', equipped: 'Equipped', locked: 'Locked' };
const ACTION_LABELS = { add: 'Equip', stack: 'Stack', swap: 'Swap', remove: 'Equipped', locked: 'Locked', full: 'Slots full', too_big: 'Needs more slots' };
const canEquip = (kind) => kind === 'add' || kind === 'stack' || kind === 'swap';

/** "+25% Str +25% Def", "-30% damage taken". */
export function blessingEffect(p, expanded = false) {
  if (p.protect) return `-${Math.round(p.protect * 100)}% damage taken`;
  const labels = expanded
    ? { crit: 'critical chance', att: 'Attack', str: 'Strength', def: 'Defence', ranged: 'Ranged damage', magic: 'Magic damage' }
    : { crit: 'crit', att: 'Att', str: 'Str', def: 'Def', ranged: 'Rng', magic: 'Mag' };
  const allStyles = expanded && p.str && p.str === p.ranged && p.str === p.magic;
  const fields = Object.keys(labels).filter((k) => p[k] && (!allStyles || !['str', 'ranged', 'magic'].includes(k)));
  const effects = fields.map((k) => `+${Math.round(p[k] * 100)}% ${labels[k]}`);
  if (allStyles) effects.unshift(`+${Math.round(p.str * 100)}% damage in all styles`);
  return effects.join(expanded ? ' · ' : ' ');
}

/** The loadout's bonuses in all, stacking counted: "+98% Str +60% Def +25% crit". */
export function blessingTotals(game, expanded = false) {
  const b = blessingBonus(game.activePrayers);
  return [blessingEffect({ ...b, protect: 0 }, expanded), b.protect ? blessingEffect({ protect: b.protect }) : ''].filter(Boolean).join(expanded ? ' · ' : ' ');
}

/** What tapping a blessing row would do, in a few words ('' when nothing to say). */
export function blessingHint(game, id, a = blessingAction(game, id)) {
  const names = (ids) => ids.map((o) => PRAYER_BY_ID[o].name).join(', ');
  if (a.kind === 'stack') return `Stacks with ${names(a.with)}`;
  if (a.kind === 'swap') return `Swaps out ${names(a.out)}`;
  if (a.kind === 'full') return 'Slots full';
  if (a.kind === 'too_big') return `Needs ${blessingCost(PRAYER_BY_ID[id])} slots`;
  return '';
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
    html += `<button type="button" class="bl-slot filled" data-unequip="${p.id}" style="grid-column:span ${cost}" aria-label="Remove ${esc(p.name)}" title="${esc(blessingEffect(p, true))}">`
      + `<span class="bl-slot-ic">${prayerIconHTML(p.art || p.id, 24, '', p.tint)}</span><span class="bl-slot-name">${esc(p.name)}</span></button>`;
  }
  for (let i = used; i < open; i++) html += '<div class="bl-slot empty"><span>Empty</span></div>';
  const total = BLESSING_SLOT_LADDER[BLESSING_SLOT_LADDER.length - 1].slots;
  for (let i = Math.max(used, open); i < total; i++) {
    const rung = BLESSING_SLOT_LADDER.find((r) => r.slots > i);
    html += `<div class="bl-slot locked" title="Unlocks at Prayer level ${rung.level}"><span>Locked</span><small>Lvl ${rung.level}</small></div>`;
  }
  return `<div class="bl-slots" data-lvl="${lvl}" style="--bl-columns:${total}">${html}</div>`;
}

/** Available includes stacks and swaps, using the same eligibility as the equip action. */
export function blessingListHTML(game, filter = 'all') {
  const rows = PRAYERS.map((p) => ({ p, action: blessingAction(game, p.id) })).filter(({ action: { kind } }) => {
    if (filter === 'available') return canEquip(kind);
    if (filter === 'equipped') return kind === 'remove';
    if (filter === 'locked') return kind === 'locked';
    return true;
  });
  if (!rows.length) {
    const message = { available: 'No blessings fit this loadout. Remove one or view All.', equipped: 'No blessings equipped.', locked: 'All blessings unlocked.' };
    return `<p class="bl-empty-list">${message[filter]}</p>`;
  }
  return rows.map(({ p, action }) => {
    const { kind } = action, on = kind === 'remove', locked = kind === 'locked';
    const unavailable = !on && !canEquip(kind), cost = blessingCost(p);
    const hint = kind === 'stack' || kind === 'swap' ? blessingHint(game, p.id, action) : '';
    const cls = ['prayer-cell', on && 'active', locked && 'locked'].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" data-prayer="${p.id}" data-bl-action="${kind}" aria-pressed="${on}"${unavailable ? ' aria-disabled="true"' : ''}>`
      + `<span class="pr-ic">${prayerIconHTML(p.art || p.id, 26, '', p.tint)}</span><span class="pr-text">`
      + `<span class="pr-top"><b>${esc(p.name)}</b><span class="pr-lvl">${ACTION_LABELS[kind]}</span></span>`
      + `<span class="pr-effect">${esc(blessingEffect(p, true))}</span>`
      + `<span class="pr-detail">Prayer ${p.level} · ${cost} ${cost === 1 ? 'slot' : 'slots'}</span>`
      + (hint ? `<span class="pr-hint">${esc(hint)}</span>` : '') + '</span></button>';
  }).join('');
}

function loadoutHTML(game) {
  const open = game.blessingSlots(), used = slotsUsed(game.activePrayers);
  const total = blessingTotals(game, true);
  return `<div class="bl-slots-label"><h3 class="bl-heading" tabindex="-1">Equipped</h3><span><b>${used} / ${open}</b> slots</span></div>`
    + slotStripHTML(game) + (total ? `<div class="bl-total"><b>Combined effect</b><span>${esc(total)}</span></div>` : '');
}

function burstInfoHTML(level) {
  const power = burstPower(level);
  return `<div class="bl-burst-info" title="${esc(burstText(level))}">`
    + `<div><b>${Math.round(power.heal * 100)}%</b><span>Life restored</span></div>`
    + '<div><b>3s</b><span>All hits blocked</span></div>'
    + `<div><b>+${Math.round(power.zeal * 100)}%</b><span>Damage for 8s</span></div></div>`;
}

/** The Faith card stays mounted as charge arrives and the loadout changes. */
export function blessingsPanelHTML(game, filter = 'all') {
  return '<section class="bl-overview" aria-label="Faith">'
    + '<div class="bl-head"><div class="bl-faith" title="Faith fills as you fight, bury bones or pray at a Monument.">'
    + '<div class="bl-faith-value"><h3 class="bl-heading">Faith</h3><span class="bl-faith-text"></span></div>'
    + '<div class="bl-faith-bar" role="progressbar" aria-label="Faith charge" aria-valuemin="0" aria-valuemax="100"><i></i></div><span class="bl-faith-state"></span></div>'
    + `<button type="button" class="bl-burst" aria-keyshortcuts="${BURST_KEY}" title="Spend full Faith on a Faith Burst">${uiIconHTML('prayer-burst', 20, 'bl-burst-ic')}<span>Faith Burst</span><kbd>${BURST_KEY}</kbd></button></div>`
    + `<div class="bl-burst-details">${burstInfoHTML(game.skills.prayer)}</div></section>`
    + `<section class="bl-loadout" aria-label="Equipped blessings">${loadoutHTML(game)}</section>`
    + '<section class="bl-catalogue" aria-label="Blessing catalogue"><div class="bl-catalogue-head"><h3 class="bl-heading">Catalogue</h3>'
    + `<details class="bl-rules"><summary>Stacking</summary><p>Equipped blessings use no Faith. The strongest bonus of each type counts in full. Additional bonuses of that type count at ${Math.round(STACK_SHARE * 100)}%. A swap removes the listed blessing to make room.</p></details></div>`
    + `<div class="bl-filters" role="group" aria-label="Filter blessings">${Object.entries(FILTERS).map(([id, label]) =>
      `<button type="button" data-bl-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join('')}</div>`
    + `<div class="prayer-grid">${blessingListHTML(game, filter)}</div></section>`;
}

const sig = (game) => `${game.skills.prayer}|${[...game.activePrayers].join(',')}`;

/** Wire the panel once (clicks are delegated, so redraws need no rewiring). */
export function buildBlessingsPanel(ui) {
  const panel = ui.el.prayerPanel, game = ui.game;
  if (!panel) return;
  ui._blessSig = null;
  ui._blessParts = null;
  panel.addEventListener?.('click', (e) => {
    const t = e.target;
    const filter = t?.closest?.('[data-bl-filter]');
    if (filter) { ui._blessFilter = filter.dataset.blFilter; renderBlessingsPanel(ui); return; }
    if (t?.closest?.('.bl-burst')) { if (faithFull(game)) game.prayerBurst(); return; }
    const slot = t?.closest?.('[data-unequip]');
    if (slot) { game.toggleBlessing(slot.dataset.unequip); return; }
    const cell = t?.closest?.('.prayer-cell');
    if (cell && cell.getAttribute('aria-disabled') !== 'true') game.toggleBlessing(cell.dataset.prayer);
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

function panelParts(panel) {
  const part = (selector) => panel.querySelector?.(selector);
  return { panel, list: part('.prayer-grid'), loadout: part('.bl-loadout'), burstDetails: part('.bl-burst-details'),
    filters: [...(panel.querySelectorAll?.('[data-bl-filter]') ?? [])], meter: part('.bl-faith-bar'),
    fill: part('.bl-faith-bar i'), text: part('.bl-faith-text'), state: part('.bl-faith-state'), burst: part('.bl-burst') };
}

function restoreFocus(parts, previous) {
  const { prayer, unequip } = previous?.dataset ?? {};
  if (prayer) {
    const next = parts.list.querySelector(`[data-prayer="${prayer}"]`)
      ?? parts.list.querySelector('[data-prayer]:not([aria-disabled="true"])')
      ?? parts.filters.find((button) => button.getAttribute('aria-pressed') === 'true');
    next?.focus({ preventScroll: true });
  } else if (unequip) {
    const next = parts.loadout.querySelector(`[data-unequip="${unequip}"]`)
      ?? parts.loadout.querySelector('[data-unequip]') ?? parts.loadout.querySelector('.bl-heading');
    next?.focus({ preventScroll: true });
  }
}

function setText(node, text) { if (node && node.textContent !== text) node.textContent = text; }
function setAttr(node, name, value) { if (node?.getAttribute?.(name) !== value) node?.setAttribute?.(name, value); }

/** Faith events only patch the meter. Loadout and level events refresh their own regions. */
export function renderBlessingsPanel(ui) {
  const panel = ui.el.prayerPanel, game = ui.game;
  if (!panel) return;
  const signature = sig(game), filter = ui._blessFilter ?? 'all';
  const changed = ui._blessSig !== signature, filtered = ui._blessRenderedFilter !== filter;
  let parts = ui._blessParts;
  if (parts?.panel !== panel || ((changed || filtered) && !parts.list)) {
    panel.innerHTML = blessingsPanelHTML(game, filter);
    ui._blessParts = parts = panelParts(panel);
  } else if (changed || filtered) {
    const previous = panel.ownerDocument?.activeElement;
    if (changed && parts.loadout) parts.loadout.innerHTML = loadoutHTML(game);
    if (ui._blessLevel !== game.skills.prayer && parts.burstDetails) parts.burstDetails.innerHTML = burstInfoHTML(game.skills.prayer);
    parts.list.innerHTML = blessingListHTML(game, filter);
    for (const button of parts.filters) setAttr(button, 'aria-pressed', String(button.dataset.blFilter === filter));
    if (!previous?.isConnected) restoreFocus(parts, previous);
  }
  ui._blessSig = signature;
  ui._blessLevel = game.skills.prayer;
  ui._blessRenderedFilter = filter;
  const full = faithFull(game), active = !!game.burstActive?.(), cap = game.maxPrayer();
  const charge = full ? 100 : Math.floor(faithFrac(game) * 100);
  const width = `${charge}%`;
  if (parts.fill && parts.fill.style.width !== width) parts.fill.style.width = width;
  setText(parts.text, `${full ? cap : Math.floor(game.prayerPoints)} / ${cap}`);
  setText(parts.state, full ? 'Burst ready' : active ? 'Burst active' : 'Charging');
  setAttr(parts.meter, 'aria-valuenow', String(charge));
  setAttr(parts.burst, 'aria-disabled', String(!full));
  parts.burst?.classList.toggle('ready', full);
  parts.burst?.classList.toggle('active', active);
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
  orb.title = full ? `Faith full: click (or press ${BURST_KEY}) for a Faith Burst` : `Faith ${Math.floor(frac * 100)}%: it fills as you fight. Full, it powers a Faith Burst (${BURST_KEY})`;
}
