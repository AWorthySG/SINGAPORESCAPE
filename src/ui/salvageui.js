// The sacrifice and dismantle windows (rules in src/game/salvage.js). Kept out
// of ui.js, which only opens them: from a piece's row in the Gear Mastery
// window, from the pack's item menu (or a touch card), and from the
// "Dismantle spare gear" button at the top of Gear Mastery. The Offering
// Shrine's "Offer gear" section is drawn here too (shrineGearSection).
//
// Nothing is used up without a second tap: every action first shows what it
// will give (and any warning) in a box inside the window, with Confirm and
// Cancel buttons. (window.confirm is blocked in some of the places the game
// runs, so the confirmation lives in the page.)
import { getItem } from '../data/items.js';
import { formatNumber } from '../core/utils.js';
import { itemIconSVG } from '../render/icons.js';
import { MASTERY_RANKS, rankProgress, masteryTypeName } from '../game/mastery.js';
import { masteryProgressText } from './ranksui.js';
import { FEED_CAP, FEED_CAP_RANK } from '../game/materials.js';
import { QUALITY } from '../game/loot.js';
import { EQUIP_SLOTS } from '../game/equipment.js';
import {
  QUALITY_KEYS, isSalvageable, sameKind, sacrificeXpIn, sacrificeOptions, previewSacrifice, sacrificeGear, salvageWarning,
  packQualities, dismantleYield, dismantleGear, bulkPicks, dismantleAll, previewSacrificeAll, sacrificeAll, yieldText,
  shrineGearOptions, previewOffer, offerGear, previewOfferAll, offerAll,
} from '../game/salvage.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const name = (id) => esc(getItem(id).name);
const qLabel = (q) => (q === 'plain' ? 'plain' : QUALITY[q].label);

/** "2 plain, 1 Epic" */
function qualityText(qs) {
  const n = {};
  for (const q of qs) n[q] = (n[q] || 0) + 1;
  return ['plain', ...QUALITY_KEYS].filter((q) => n[q]).map((q) => `${n[q]} ${qLabel(q)}`).join(', ');
}

/** An average amount as words: "about 3 upgrade stones" or "a 12% chance of an upgrade stone". */
function avgText(v, one, many) {
  if (v <= 0) return '';
  if (v >= 0.995) return `about ${formatNumber(Math.round(v * 10) / 10)} ${Math.round(v * 10) === 10 ? one : many}`;
  return `${Math.max(1, Math.round(v * 100))}% chance of ${/^[aeiou]/i.test(one) ? 'an' : 'a'} ${one}`;
}
function expectText(y) {
  return [avgText(y.stones, 'upgrade stone', 'upgrade stones'), avgText(y.scrolls, 'refine scroll', 'refine scrolls'),
    avgText(y.ward, 'upgrade ward', 'upgrade wards')].filter(Boolean).join(', ');
}
/** What dismantling these copies is expected to give, summed. */
function expectFor(id, qs) {
  const t = { stones: 0, scrolls: 0, ward: 0 };
  for (const q of qs) { const y = dismantleYield(id, q); t.stones += y.stones; t.scrolls += y.scrolls; t.ward += y.ward; }
  return t;
}

export function button(html, fn, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'gear-tab ' + cls;
  b.innerHTML = html;
  b.addEventListener('click', fn);
  return b;
}

/** Redraw a window in place after a tap, keeping its scroll position. Every
 *  tap rebuilds the window's contents, and a rebuilt list used to snap back
 *  to the top, so on a phone the row just tapped (and the next one) vanished
 *  from under the finger. A folded "How it works" note that was open stays
 *  open, so the buttons below it don't jump either. */
export function redraw(body, render) {
  const at = body.scrollTop || 0;
  const open = [...(body.querySelectorAll?.('details') || [])].map((d) => d.open);
  render(body);
  if (open.some(Boolean)) [...body.querySelectorAll('details')].forEach((d, i) => { if (open[i]) d.open = true; });
  if (at) body.scrollTop = at;
}

/** The in-page confirmation (or the result of the last action), shown near the
 *  top of the window. It sticks to the window's top or bottom edge as you
 *  scroll (styles: .salvage-confirm), so Confirm and Cancel are always in reach
 *  without moving the list. `st.pending`: { html, warn, go: () => resultHtml, label }. */
export function confirmBox(body, st, rerender) {
  if (st.result) {
    const r = document.createElement('div');
    r.className = 'salvage-result';
    r.innerHTML = `<span>${st.result}</span>`;
    r.appendChild(button('OK', () => { st.result = null; rerender(); }, 'small'));
    body.appendChild(r);
  }
  if (!st.pending) return;
  const p = st.pending;
  const box = document.createElement('div');
  box.className = 'salvage-confirm' + (p.warn ? ' warn' : '');
  box.innerHTML = `<div class="salvage-what">${p.html}</div>` + (p.warn ? `<div class="salvage-warn">Careful: ${esc(p.warn)}.</div>` : '');
  const row = document.createElement('div');
  row.className = 'salvage-actions';
  row.appendChild(button(p.label || 'Confirm', () => { st.pending = null; st.result = p.go(); rerender(); }, 'salvage-go'));
  row.appendChild(button('Cancel', () => { st.pending = null; rerender(); }, 'salvage-cancel'));
  box.appendChild(row);
  body.appendChild(box);
}

/** The bulk filters (remembered while the game runs). */
function filterBox(ui, onChange) {
  const f = ui._salvageFilters || (ui._salvageFilters = { offClass: false, belowTier: true, below: 'epic' });
  const box = document.createElement('div');
  box.className = 'salvage-filters';
  const check = (key, label) => {
    const l = document.createElement('label');
    l.innerHTML = `<input type="checkbox"${f[key] ? ' checked' : ''}> ${label}`;
    l.querySelector('input').addEventListener('change', (e) => { f[key] = e.target.checked; onChange(); });
    return l;
  };
  box.appendChild(check('offClass', 'Not for my class'));
  box.appendChild(check('belowTier', 'Below my worn tier'));
  const l = document.createElement('label');
  l.innerHTML = 'Quality below <select>' + [['fine', 'Fine (plain only)'], ['superior', 'Superior'], ['epic', 'Epic'], ['legendary', 'Legendary'], ['mythic', 'Mythic'], ['any', 'any']]
    .map(([v, t]) => `<option value="${v}"${f.below === v ? ' selected' : ''}>${t}</option>`).join('') + '</select>';
  l.querySelector('select').addEventListener('change', (e) => { f.below = e.target.value; onChange(); });
  box.appendChild(l);
  const hint = document.createElement('div');
  hint.className = 'modal-hint';
  hint.textContent = 'With neither box ticked, any spare gear counts. Gear better than what you wear, boss uniques and signature weapons are never included.';
  box.appendChild(hint);
  return { box, f };
}

/** "Skilled, 2,000 / 20,000 XP to Expert", or with a gain the change it would
 *  make: "Skilled 12,000 XP → Expert 34,000 XP". */
function masteryLine(g, id, gain = 0) {
  const pts = g.equipment.masteryXp(id), after = pts + gain;
  const r0 = MASTERY_RANKS[rankProgress(pts).rank].name, r1 = MASTERY_RANKS[rankProgress(after).rank].name;
  return gain ? `${r0} ${formatNumber(pts)} XP → ${r1 !== r0 ? `<b>${r1}</b> ` : ''}${formatNumber(after)} XP` : `${r0}, ${masteryProgressText(pts)}`;
}

// ---------------- Sacrifice ----------------

/** Sacrifice spare gear to the mastery of `targetId`'s gear type (gear of
 *  that type only). `src`: an item to offer straight away. */
export function openSacrifice(ui, targetId, { src = null } = {}) {
  const g = ui.game;
  const type = esc(masteryTypeName(targetId));
  const st = { pending: null, result: null };
  const ask = (srcId, qty) => {
    // A piece can't be fed its own last copy (unless that copy is being worn).
    if (srcId === targetId && !EQUIP_SLOTS.some((s) => g.equipment.get(s) === targetId)) qty = Math.min(qty, g.inventory.count(srcId) - 1);
    const pv = previewSacrifice(g, targetId, srcId, qty);
    if (!pv.n) { st.result = 'Nothing to sacrifice: the piece is already at Master, or you have none of that to spare.'; return; }
    st.pending = {
      html: `Sacrifice ${pv.n} x <b>${name(srcId)}</b> (${qualityText(pv.copies)}) to your <b>${type} mastery</b>: <b>+${formatNumber(pv.points)} mastery XP</b> (${masteryLine(g, targetId, pv.points)}).`,
      warn: salvageWarning(g, srcId, pv.copies[pv.copies.length - 1]),
      label: 'Sacrifice',
      go: () => { const pts = sacrificeGear(g, targetId, srcId, qty); return pts ? `Sacrificed ${pv.n} x ${name(srcId)}: <b>+${formatNumber(pts)} mastery XP</b>.` : 'Nothing was sacrificed.'; },
    };
  };
  if (src) ask(src, 1);
  const render = (body) => {
    const pts = g.equipment.masteryXp(targetId), capped = pts >= FEED_CAP;
    body.innerHTML = `<div class="gear-intro"><p><b>${type} mastery</b>: ${masteryLine(g, targetId)}. Sacrifice spare ${type.toLowerCase()} gear from your pack to add mastery: only gear of the same type counts. `
      + 'Higher level, better ranked, better quality and refined pieces give more, boss uniques a great deal, and each rank your mastery has reached adds a tenth more. '
      + `Like materials, sacrifice takes gear up to <b>${MASTERY_RANKS[FEED_CAP_RANK].name}</b>; after that only battle trains it. Plain copies go before quality ones.</p></div>`;
    confirmBox(body, st, () => redraw(body, render));
    const list = document.createElement('div');
    list.className = 'gear-list feed-list salvage-list';
    const opts = sacrificeOptions(g, targetId).filter((o) => o.id !== targetId || o.count > 1 || EQUIP_SLOTS.some((s) => g.equipment.get(s) === targetId));
    if (capped) list.innerHTML = `<div class="modal-hint">Already ${MASTERY_RANKS[rankProgress(pts).rank].name}: fight with it to go further.</div>`;
    else if (!opts.length) list.innerHTML = `<div class="modal-hint">You carry no spare ${type.toLowerCase()} gear. (Gear you wear, and gear in the bank, can't be sacrificed.)</div>`;
    else for (const o of opts) {
      const row = document.createElement('div');
      row.className = 'gear-row feed-row salvage-row';
      row.innerHTML = `<span class="gear-ic">${itemIconSVG(o.id, 28)}</span>`
        + `<div class="gear-info"><div class="gear-name"><b>${name(o.id)}</b><span class="gear-tag">x${formatNumber(o.count)}</span>${o.warn ? '<span class="gear-tag lock">!</span>' : ''}</div>`
        + `<div class="gear-stats">+${formatNumber(o.points)} mastery XP for the next (${formatNumber(o.total)} for all) · ${qualityText(o.qualities)}</div></div>`;
      const btns = document.createElement('div');
      btns.className = 'qty-btns';
      btns.appendChild(button('1', () => { ask(o.id, 1); redraw(body, render); }, 'small'));
      if (o.count > 1) btns.appendChild(button('All', () => { ask(o.id, o.count); redraw(body, render); }, 'small'));
      row.appendChild(btns);
      list.appendChild(row);
    }
    body.appendChild(list);
    if (!capped) {
      body.insertAdjacentHTML('beforeend', '<div class="ench-head salvage-head">Sacrifice all…</div>');
      const { box, f } = filterBox(ui, () => redraw(body, render));
      body.appendChild(box);
      const pv = previewSacrificeAll(g, targetId, f);
      const go = button(pv.pieces ? `Sacrifice ${formatNumber(pv.pieces)} piece${pv.pieces > 1 ? 's' : ''}: +${formatNumber(pv.points)} mastery XP` : 'No spare gear matches', () => {
        st.pending = {
          html: `Sacrifice <b>${formatNumber(pv.pieces)} pieces</b> of spare ${type.toLowerCase()} gear to your <b>${type} mastery</b>: <b>+${formatNumber(pv.points)} mastery XP</b> (${masteryLine(g, targetId, pv.points)}).`,
          warn: f.below === 'any' || f.below === 'mythic' || f.below === 'legendary' ? 'this includes Epic copies or better' : '',
          label: 'Sacrifice all',
          go: () => { const r = sacrificeAll(g, targetId, f); return `Sacrificed <b>${formatNumber(r.pieces)}</b> pieces: <b>+${formatNumber(r.points)} mastery XP</b>. Your ${type} mastery is now ${masteryLine(g, targetId)}.`; },
        };
        redraw(body, render);
      }, 'salvage-bulk');
      go.disabled = !pv.pieces;
      body.appendChild(go);
    }
    body.appendChild(button('Back', () => ui.openMastery(targetId), 'ench-cancel feed-back'));
  };
  ui.openModal(`Sacrifice to ${masteryTypeName(targetId)} mastery`, render);
  ui.modal.kind = 'salvage';
}

/** From the pack: choose which piece of the same gear type to sacrifice `srcId` to (what you wear first). */
export function openSacrificeFrom(ui, srcId) {
  const g = ui.game;
  const render = (body) => {
    const qs = packQualities(g, srcId);
    body.innerHTML = `<div class="gear-intro"><p>Sacrifice your <b>${name(srcId)}</b> (${qs.length ? qualityText(qs) : 'none in your pack'}) to ${esc(masteryTypeName(srcId))} mastery? Only gear of the same type can take it. It gives the mastery shown, up to ${MASTERY_RANKS[FEED_CAP_RANK].name}.</p></div>`;
    const worn = [...new Set(EQUIP_SLOTS.map((s) => g.equipment.get(s)).filter((id) => id && isSalvageable(id) && sameKind(id, srcId)))];
    const carried = [...new Set(g.inventory.slots.filter((s) => s && isSalvageable(s.id) && sameKind(s.id, srcId) && !worn.includes(s.id) && (s.id !== srcId || g.inventory.count(srcId) > 1)).map((s) => s.id))];
    const list = document.createElement('div');
    list.className = 'gear-list feed-list salvage-list';
    if (!qs.length) list.innerHTML = '<div class="modal-hint">You can\'t sacrifice gear you are wearing: take it off first.</div>';
    else if (!worn.length && !carried.length) list.innerHTML = `<div class="modal-hint">Wear or carry another piece of ${esc(masteryTypeName(srcId).toLowerCase())} gear to sacrifice this to.</div>`;
    else for (const id of [...worn, ...carried]) {
      const capped = g.equipment.masteryXp(id) >= FEED_CAP;
      const row = document.createElement('div');
      row.className = 'gear-row feed-row salvage-row';
      row.innerHTML = `<span class="gear-ic">${itemIconSVG(id, 28)}</span>`
        + `<div class="gear-info"><div class="gear-name"><b>${name(id)}</b>${worn.includes(id) ? '<span class="gear-tag worn">Wearing</span>' : ''}</div>`
        + `<div class="gear-stats">${masteryLine(g, id)} · ${capped ? `${MASTERY_RANKS[FEED_CAP_RANK].name} reached` : `+${formatNumber(sacrificeXpIn(g, id, srcId, qs[0]))} mastery XP`}</div></div>`;
      const b = button('Choose', () => openSacrifice(ui, id, { src: srcId }), 'small');
      b.disabled = capped;
      row.appendChild(b);
      list.appendChild(row);
    }
    body.appendChild(list);
    body.appendChild(button('Back', () => ui.closeModal(), 'ench-cancel feed-back'));
  };
  ui.openModal(`Sacrifice ${getItem(srcId).name}`, render);
  ui.modal.kind = 'salvage';
}

// ---------------- Dismantle ----------------

/** Break spare gear down into upgrade stones, refine scrolls and wards. `focus`:
 *  an item to offer straight away (from the pack's menu). */
export function openDismantle(ui, focus = null) {
  const g = ui.game;
  const st = { pending: null, result: null };
  const ask = (id, qty) => {
    const qs = packQualities(g, id).slice(0, qty);
    if (!qs.length) { st.result = 'You can\'t dismantle gear you are wearing: take it off first.'; return; }
    st.pending = {
      html: `Dismantle ${qs.length} x <b>${name(id)}</b> (${qualityText(qs)}): ${expectText(expectFor(id, qs)) || 'very little'}.`,
      warn: salvageWarning(g, id, qs[qs.length - 1]),
      label: 'Dismantle',
      go: () => { const r = dismantleGear(g, id, qty); return r.n ? `Dismantled ${r.n} x ${name(id)}: <b>${yieldText(r)}</b>.` : 'Nothing was dismantled.'; },
    };
  };
  if (focus) ask(focus, 1);
  const render = (body) => {
    body.innerHTML = '<div class="gear-intro"><p>Break spare gear down for <b>upgrade stones</b> (for enchanting), now and then a <b>refine scroll</b>, '
      + 'and from Legendary and Mythic pieces and boss uniques a chance of an <b>upgrade ward</b>. Higher level, better ranked and better quality gear gives more. '
      + `Plain copies go before quality ones. You have ${formatNumber(g.inventory.count('upgrade_stone'))} stones, ${formatNumber(g.inventory.count('refine_scroll'))} scrolls and ${formatNumber(g.inventory.count('upgrade_ward'))} wards.</p></div>`;
    confirmBox(body, st, () => redraw(body, render));
    const ids = [...new Set(g.inventory.slots.filter((s) => s && isSalvageable(s.id)).map((s) => s.id))];
    const list = document.createElement('div');
    list.className = 'gear-list feed-list salvage-list';
    if (!ids.length) list.innerHTML = '<div class="modal-hint">You carry no spare gear. (Gear you wear, and gear in the bank, can\'t be dismantled.)</div>';
    for (const id of ids) {
      const qs = packQualities(g, id), warn = salvageWarning(g, id, qs[qs.length - 1]);
      const row = document.createElement('div');
      row.className = 'gear-row feed-row salvage-row' + (id === focus ? ' is-worn' : '');
      row.innerHTML = `<span class="gear-ic">${itemIconSVG(id, 28)}</span>`
        + `<div class="gear-info"><div class="gear-name"><b>${name(id)}</b><span class="gear-tag">x${formatNumber(qs.length)}</span>${warn ? '<span class="gear-tag lock">!</span>' : ''}</div>`
        + `<div class="gear-stats">Next: ${expectText(dismantleYield(id, qs[0]))} · ${qualityText(qs)}</div></div>`;
      const btns = document.createElement('div');
      btns.className = 'qty-btns';
      btns.appendChild(button('1', () => { ask(id, 1); redraw(body, render); }, 'small'));
      if (qs.length > 1) btns.appendChild(button('All', () => { ask(id, qs.length); redraw(body, render); }, 'small'));
      row.appendChild(btns);
      list.appendChild(row);
    }
    body.appendChild(list);
    body.insertAdjacentHTML('beforeend', '<div class="ench-head salvage-head">Dismantle all…</div>');
    const { box, f } = filterBox(ui, () => redraw(body, render));
    body.appendChild(box);
    const picks = bulkPicks(g, f);
    const n = picks.reduce((t, p) => t + p.qualities.length, 0);
    const exp = { stones: 0, scrolls: 0, ward: 0 };
    for (const p of picks) { const y = expectFor(p.id, p.qualities); exp.stones += y.stones; exp.scrolls += y.scrolls; exp.ward += y.ward; }
    const go = button(n ? `Dismantle ${formatNumber(n)} piece${n > 1 ? 's' : ''}` : 'No spare gear matches', () => {
      st.pending = {
        html: `Dismantle <b>${formatNumber(n)} pieces</b> (${picks.length} kind${picks.length > 1 ? 's' : ''}): ${expectText(exp) || 'very little'}.`,
        warn: f.below === 'any' || f.below === 'mythic' || f.below === 'legendary' ? 'this includes Epic copies or better' : '',
        label: 'Dismantle all',
        go: () => { const r = dismantleAll(g, f); return `Dismantled <b>${formatNumber(r.pieces)}</b> pieces: <b>${yieldText(r)}</b>.`; },
      };
      redraw(body, render);
    }, 'salvage-bulk');
    go.disabled = !n;
    body.appendChild(go);
    body.appendChild(button('Back', () => ui.openMastery(), 'ench-cancel feed-back'));
  };
  ui.openModal('Dismantle gear', render);
  ui.modal.kind = 'salvage';
}

// ---------------- Offering gear at the shrine ----------------
// The "Offer gear" part of the Offering Shrine window (ui.openOfferingShrine
// draws the rest). `st` is the window's { pending, result }, kept while it is open.

/** Ask (in the window) to offer up to `qty` copies of `id` at the shrine. */
export function askOffer(ui, st, id, qty) {
  const g = ui.game;
  const pv = previewOffer(g, id, qty);
  if (!pv.n) { st.result = 'You can\'t offer gear you are wearing: take it off first.'; return; }
  st.pending = {
    html: `Offer ${pv.n} x <b>${name(id)}</b> (${qualityText(pv.copies)}) at the shrine: <b>+${formatNumber(pv.points)} shrine points</b>.`,
    warn: salvageWarning(g, id, pv.copies[pv.copies.length - 1]),
    label: 'Offer',
    go: () => { const pts = offerGear(g, id, qty); return pts ? `Offered ${pv.n} x ${name(id)}: <b>+${formatNumber(pts)} shrine points</b>.` : 'Nothing was offered.'; },
  };
}

/** Draw the gear list, its confirmation and "Offer all spare gear…" into `body`. */
export function shrineGearSection(ui, body, st, rerender) {
  const g = ui.game;
  body.insertAdjacentHTML('beforeend', '<div class="ench-head shrine-head">Offer gear</div>'
    + `<div class="modal-hint">Spare gear of any class or slot, from your pack: higher level, better ranked and better quality pieces give more, boss uniques a great deal, and everything more as your combat level (${g.skills.combatLevel()}) grows. Plain copies go before quality ones.</div>`);
  confirmBox(body, st, rerender);
  const list = document.createElement('div');
  list.className = 'gear-list feed-list salvage-list';
  const opts = shrineGearOptions(g);
  if (!opts.length) list.innerHTML = '<div class="modal-hint">You carry no spare gear. (Gear you wear, and gear in the bank, can\'t be offered.)</div>';
  for (const o of opts) {
    const row = document.createElement('div');
    row.className = 'gear-row feed-row salvage-row';
    row.innerHTML = `<span class="gear-ic">${itemIconSVG(o.id, 28)}</span>`
      + `<div class="gear-info"><div class="gear-name"><b>${name(o.id)}</b><span class="gear-tag">x${formatNumber(o.count)}</span>${o.warn ? '<span class="gear-tag lock">!</span>' : ''}</div>`
      + `<div class="gear-stats">${formatNumber(o.points)} point${o.points > 1 ? 's' : ''} for the next (${formatNumber(o.total)} for all) · ${qualityText(o.qualities)}</div></div>`;
    const btns = document.createElement('div');
    btns.className = 'qty-btns';
    btns.appendChild(button('1', () => { askOffer(ui, st, o.id, 1); rerender(); }, 'small'));
    if (o.count > 1) btns.appendChild(button('All', () => { askOffer(ui, st, o.id, o.count); rerender(); }, 'small'));
    row.appendChild(btns);
    list.appendChild(row);
  }
  body.appendChild(list);
  body.insertAdjacentHTML('beforeend', '<div class="ench-head salvage-head">Offer all spare gear…</div>');
  const { box, f } = filterBox(ui, rerender);
  body.appendChild(box);
  const pv = previewOfferAll(g, f);
  const go = button(pv.pieces ? `Offer ${formatNumber(pv.pieces)} piece${pv.pieces > 1 ? 's' : ''}: +${formatNumber(pv.points)} points` : 'No spare gear matches', () => {
    st.pending = {
      html: `Offer <b>${formatNumber(pv.pieces)} piece${pv.pieces > 1 ? 's' : ''}</b> of spare gear at the shrine: <b>+${formatNumber(pv.points)} shrine points</b>.`,
      warn: f.below === 'any' || f.below === 'mythic' || f.below === 'legendary' ? 'this includes Epic copies or better' : '',
      label: 'Offer all',
      go: () => { const r = offerAll(g, f); return `Offered <b>${formatNumber(r.pieces)}</b> pieces: <b>+${formatNumber(r.points)} shrine points</b>.`; },
    };
    rerender();
  }, 'salvage-bulk');
  go.disabled = !pv.pieces;
  body.appendChild(go);
}
