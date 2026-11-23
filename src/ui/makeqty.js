// How many to make at a station (the owner's ask: choosing a recipe always
// used every material in the pack). A row of chips in each station window,
// "1 · 5 · 10 · X · All", sets the amount; X asks for a number in the window
// itself, so a phone doesn't lose the recipe list behind a second window.
// The choice is one for every station and lasts the session (game.makeQty,
// read by Game.startCooking and the other start functions); it starts at All,
// so nothing changes for a player who never touches it. "Do all" always makes
// everything, whatever is picked here.
import { COOKING } from '../game/skilling.js';
import { formatNumber } from '../core/utils.js';

const PRESETS = [1, 5, 10];

/** The amount picked: a whole number, or Infinity for all. */
export const makeQtyOf = (game) => (game.makeQty > 0 ? game.makeQty : Infinity);

/** How many times the pack can make this now (kept materials can stretch it
 *  further). `kind` is the station's: cook (a raw food id), dish, smelt,
 *  smith, craft, or recipe (Fletching and Herblore, inputs as [id, n]). */
export function maxMakes(game, kind, r) {
  const has = (id) => game.inventory.count(id);
  if (kind === 'cook') return COOKING[r] ? has(r) : 0;
  if (kind === 'smith') return Math.floor(has(r.bar) / r.barCount);
  const ins = kind === 'recipe' ? r.inputs.map(([id, qty]) => ({ id, qty })) : r.inputs;
  return Math.min(...ins.map((i) => Math.floor(has(i.id) / i.qty)));
}

/** A recipe row's button: "Make 5", or "Make all (37)" when All is picked or
 *  the pack holds fewer than the amount (it then makes what it can). */
export function makeLabel(game, max) {
  const q = makeQtyOf(game);
  if (max <= 0) return 'None';
  return q < max ? `Make ${formatNumber(q)}` : `Make all (${formatNumber(max)})`;
}

/** The button as HTML, to sit at the right of a recipe row. */
export const makePill = (game, max) => `<span class="mq-go${max > 0 ? '' : ' none'}">${makeLabel(game, max)}</span>`;

/** The chip row for the top of a station window. `redraw` draws the window
 *  again so every row's button shows the new amount. */
export function makeQtyRow(game, redraw) {
  const wrap = document.createElement('div');
  wrap.className = 'mq-wrap';
  const row = document.createElement('div');
  row.className = 'sgx-chips mq-chips';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'How many to make');
  row.insertAdjacentHTML('beforeend', '<span class="mq-label">Make</span>');
  const q = makeQtyOf(game);
  const custom = q !== Infinity && !PRESETS.includes(q);
  const chip = (text, on, fn, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `sgx-chip mq-chip${on ? ' on' : ''}`;
    b.textContent = text;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (title) b.title = title;
    b.addEventListener('click', fn);
    row.appendChild(b);
    return b;
  };
  const set = (n) => { game.makeQty = n; redraw(); };
  for (const n of PRESETS) chip(String(n), q === n, () => set(n));
  chip(custom ? `X: ${formatNumber(q)}` : 'X', custom, () => ask(), 'Choose how many');
  chip('All', q === Infinity, () => set(Infinity), 'Everything your pack allows');
  wrap.appendChild(row);
  // X: a number box in the window (like the fire's "how many logs").
  const ask = () => {
    if (wrap.querySelector('.mq-ask')) { wrap.querySelector('input')?.focus(); return; }
    const box = document.createElement('form');
    box.className = 'mq-ask';
    box.innerHTML = '<label>How many? <input type="number" inputmode="numeric" min="1" step="1" enterkeyhint="done"></label>'
      + '<button type="submit" class="sgx-chip on mq-ok">OK</button>';
    const input = box.querySelector('input');
    input.value = custom ? String(q) : '';
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Math.floor(Number(input.value));
      if (n > 0) set(n); else input.focus();
    });
    wrap.appendChild(box);
    input.focus();
  };
  return wrap;
}
