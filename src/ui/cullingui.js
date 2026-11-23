// The windows and bits of HUD for culling (src/game/culling.js): Officer Aziz's
// contracts window, the Pest Control token shop, contract rows for the
// objectives tracker, the Stewardship line under the alignment readout, and
// the inventory options for a forager's lamp and a Codex quill. ui.js only
// calls in here; the page-building functions return plain strings so the
// tests can render them without a DOM.
import { getItem } from '../data/items.js';
import { itemIconSVG } from '../render/icons.js';
import {
  activeContracts, ensureContracts, handInContracts, huntContract, buyTokenReward, stewardship,
  TOKEN_SHOP, FULL_BOARD_TOKENS, STEWARD_RANKS, LAMP_SKILLS, lampXp, rubLamp, readQuill, plural,
} from '../game/culling.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v) => Number(v || 0).toLocaleString('en-GB');
const pctOf = (a, b) => (b ? Math.max(0, Math.min(100, Math.floor((a / b) * 100))) : 0);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Today's contracts as HTML: each with its progress, reward and, while it's
 *  open, a Hunt button (data-hunt) that sends auto battle after it. */
export function contractsHTML(game) {
  const list = activeContracts(game);
  if (!list.length) return '<div class="modal-hint">No contracts today.</div>';
  return '<div class="pc-list">' + list.map((c) => {
    const state = c.claimed ? 'claimed' : c.done ? 'done' : '';
    const status = c.claimed ? 'Paid' : c.done ? 'Done: hand it in!' : `${n(c.have)} / ${n(c.need)}`;
    return `<div class="pc-row ${state}"><div class="pc-top"><b>${esc(c.text)}</b><span class="pc-status">${status}</span></div>` +
      `<span class="pc-bar"><i style="width:${pctOf(c.have, c.need)}%"></i></span>` +
      `<div class="pc-foot"><span class="pc-reward">${itemIconSVG('pest_token', 16)} ${c.tokens} tokens · ${n(c.coins)} coins</span>` +
      (!c.done ? `<button type="button" class="wm-go pc-hunt" data-hunt="${esc(c.id)}" title="Auto battle goes after them, wherever they live">Hunt</button>` : '') +
      '</div></div>';
  }).join('') + '</div>';
}

/** Stewardship spelled out: rank, points to the next, the perks and whether they're on. */
export function stewardHTML(game) {
  const s = stewardship(game);
  const perks = s.rank ? `+${Math.round(s.perkYield * 100)}% double gathering yield, +${Math.round(s.perkFood * 100)}% food healing, +${Math.round(s.perkHunter * 100)}% Hunter XP` : 'none yet';
  const next = s.next ? `${n(s.points)} / ${n(s.next)} to ${esc(s.nextName)}` : `${n(s.points)} (highest rank)`;
  return `<div class="pc-steward${s.active ? ' active' : ''}"><b>Stewardship:</b> ${s.rank ? `${esc(s.name)} (rank ${s.rank})` : 'no rank yet'} · ${next}` +
    `<span class="pc-bar"><i style="width:${s.next ? pctOf(s.points, s.next) : 100}%"></i></span>` +
    `<div class="pc-perks">Perks: ${perks}. ${s.active ? '<b>Active</b> while you stay Neutral.' : s.rank ? 'Resting: they only work while you are Neutral.' : ''}</div>` +
    '<div class="pc-perks">While Neutral, every harmless creature you cull adds a point. Gentle perks only: nothing for combat.</div></div>';
}

/** The one-line Stewardship note under the alignment readout. */
export function stewardLineHTML(game) {
  const s = stewardship(game);
  if (!s.points) return '<div class="align-steward">Stay Neutral and cull harmless creatures to build Stewardship.</div>';
  return `<div class="align-steward${s.active ? ' active' : ''}">Stewardship: <b>${s.rank ? esc(s.name) : 'no rank yet'}</b> (${n(s.points)}${s.next ? ` / ${n(s.next)}` : ''})` +
    (s.rank ? ` · ${s.active ? `+${Math.round(s.perkYield * 100)}% yield, +${Math.round(s.perkFood * 100)}% food, +${Math.round(s.perkHunter * 100)}% Hunter XP` : 'perks rest while you aren\'t Neutral'}` : '') + '</div>';
}

/** Rows for the objectives tracker: today's open contracts (up to two), and
 *  one asking you to hand in what's finished. `ui` gives the pointer arrow. */
export function contractTrackerRows(ui) {
  const g = ui.game, rows = [];
  const list = activeContracts(g);
  for (const c of list.filter((x) => !x.done).slice(0, 2)) {
    rows.push(`<div class="trk-row"><span class="trk-ic trk-pest" title="Pest Control contract">&#10047;</span>${esc(cap(plural(c.name)))} <span class="trk-prog">${n(c.have)}/${n(c.need)}</span>${ui._trkPointer ? ui._trkPointer((m) => m.npcId === c.id, `id:${c.id}`) : ''}</div>`);
  }
  const ready = list.filter((x) => x.done && !x.claimed).length;
  if (ready) rows.push(`<div class="trk-row"><span class="trk-ic trk-pest">&#10047;</span>Hand in ${ready} contract${ready > 1 ? 's' : ''} to Officer Aziz</div>`);
  return rows;
}

/** Officer Aziz: today's contracts, hand-in, the token shop and Stewardship. */
export function openPestOfficer(ui, npc = null) {
  const g = ui.game;
  ensureContracts(g);
  const render = (body) => {
    const list = activeContracts(g);
    const ready = list.filter((c) => c.done && !c.claimed).length;
    body.innerHTML = `<div class="dialogue"><div class="speaker">${esc(npc?.name || 'Pest Control Officer Aziz')}</div>` +
      'Rats in the drains, mosquitoes by the reservoir, crabs all over the beach. Clear some for me, lah! ' +
      `Three contracts a day; finish all three for ${FULL_BOARD_TOKENS} bonus tokens.</div>` +
      contractsHTML(g) +
      `<div class="modal-hint">You have <b>${n(g.inventory.count('pest_token'))}</b> Pest Control tokens.</div>` + stewardHTML(g);
    body.querySelectorAll('.pc-hunt').forEach((b) => b.addEventListener('click', () => { if (huntContract(g, b.dataset.hunt)) ui.closeModal(); }));
    const opts = document.createElement('div');
    opts.className = 'dialogue-options';
    const mk = (label, fn) => { const d = document.createElement('div'); d.className = 'dialogue-option'; d.textContent = label; d.addEventListener('click', fn); opts.appendChild(d); };
    if (ready) mk(`Hand in ${ready} finished contract${ready > 1 ? 's' : ''}`, () => { handInContracts(g); render(body); });
    mk('Pest Control token shop', () => openTokenShop(ui));
    mk('Goodbye', () => ui.closeModal());
    body.appendChild(opts);
  };
  ui.openModal('Pest Control', render);
  ui.modal.kind = 'pest';
}

/** The token shop: click a reward to buy it. */
export function openTokenShop(ui) {
  const g = ui.game;
  const render = (body) => {
    const have = g.inventory.count('pest_token');
    body.innerHTML = `<div class="modal-hint">Pest Control tokens: <b>${n(have)}</b>. Earned from Officer Aziz's daily contracts.</div>`;
    const grid = document.createElement('div');
    grid.className = 'item-grid shop pc-shop';
    for (const r of TOKEN_SHOP) {
      const it = getItem(r.id);
      const cell = ui._cell(r.id, r.qty, {
        tooltip: `<b>${esc(it.name)}</b>${r.qty > 1 ? ` × ${r.qty}` : ''}<br><span style="opacity:.8">${esc(it.examine || '')}</span><br>Cost: ${r.cost} token${r.cost > 1 ? 's' : ''}`,
        onClick: () => { buyTokenReward(g, r.id); render(body); },
      });
      const tag = document.createElement('span');
      tag.className = 'slayer-cost' + (have < r.cost ? ' short' : '');
      tag.textContent = `${r.cost}t`;
      cell.appendChild(tag);
      grid.appendChild(cell);
    }
    body.appendChild(grid);
    const names = document.createElement('div');
    names.className = 'pc-shop-list';
    names.innerHTML = TOKEN_SHOP.map((r) => `<div>${itemIconSVG(r.id, 18)} <b>${esc(getItem(r.id).name)}</b>${r.qty > 1 ? ` × ${r.qty}` : ''} <span>${r.cost} token${r.cost > 1 ? 's' : ''}</span></div>`).join('');
    body.appendChild(names);
    const back = document.createElement('div');
    back.className = 'dialogue-options';
    const b = document.createElement('div'); b.className = 'dialogue-option'; b.textContent = 'Back';
    b.addEventListener('click', () => openPestOfficer(ui));
    back.appendChild(b);
    body.appendChild(back);
  };
  ui.openModal('Pest Control Tokens', render);
  ui.modal.kind = 'pestShop';
}

/** Inventory options for culling's own items (ui.js _invOptions). */
export function cullingInvOptions(ui, s, i) {
  const g = ui.game, item = getItem(s.id);
  if (s.id === 'forager_lamp') {
    // What it's worth at your level (the life-skill boost too); golden hours and the like come on top.
    return LAMP_SKILLS.map((sk) => ({ label: `Rub: ${cap(sk)}`, target: `${n(Math.round(g.skills.xpAtLevel(sk, lampXp(g, sk))))} XP`, fn: () => rubLamp(g, i, sk) }));
  }
  if (s.id === 'codex_quill') return [{ label: 'Read', target: item.name, fn: () => readQuill(g, i) }];
  return [];
}
