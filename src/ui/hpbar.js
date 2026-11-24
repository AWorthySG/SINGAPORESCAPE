// Your life on the HUD as a clear horizontal bar with the number
// ("1,234 / 2,000"): bottom centre over the quick bar on a desktop, top-left
// above the info strip on a phone (styles/compact.css places it). It wears the
// overhead bar's colours (green, amber, red; blue and orange with colour-blind
// colours on), pulses when low, and a pale trail shows the chunk just lost.
// ui.js renderHp calls renderHpBar; headless (the tests) there is no element.
import { formatNumber } from '../core/utils.js';
import { hpBand } from '../render/playerhp.js';

const BANDS = ['', 'mid', 'low'];

/** "1,234 / 2,000" */
export const hpText = (hp, max) => `${formatNumber(Math.max(0, Math.round(hp)))} / ${formatNumber(Math.round(max))}`;

/** The bar's element, made the first time (null without a page). */
function barEl(ui) {
  if (ui._hpBar !== undefined) return ui._hpBar;
  if (typeof document === 'undefined') return (ui._hpBar = null);
  const root = document.getElementById('game-root');
  if (!root) return (ui._hpBar = null);
  const el = document.createElement('div');
  el.id = 'hp-bar';
  el.setAttribute('role', 'meter');
  el.setAttribute('aria-label', 'Hitpoints');
  el.setAttribute('aria-valuemin', '0');
  el.title = 'Hitpoints';
  el.innerHTML = '<span class="hpb-track"><i class="hpb-trail"></i><i class="hpb-fill"></i></span>'
    + '<span class="hpb-ic" aria-hidden="true">&#9829;&#xFE0E;</span><b class="hpb-num"></b><b class="hpb-ward" title="Grace ward: soaks the blows you take"></b>';
  root.appendChild(el);
  ui._hpBar = el;
  ui._hpBarParts = { fill: el.querySelector('.hpb-fill'), trail: el.querySelector('.hpb-trail'), num: el.querySelector('.hpb-num'), ward: el.querySelector('.hpb-ward') };
  return el;
}

/** Draw the HUD bar for `hp` of `max` (only what changed is written), and a
 *  Priest's Grace ward (`ward` life it will soak) as "+N" beside the number. */
export function renderHpBar(ui, hp, max, alive = true, ward = 0) {
  const el = barEl(ui);
  if (!el) return;
  const frac = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 1;
  const key = `${hp}|${max}|${alive}|${ward}`;
  if (key === ui._hpBarKey) return;
  ui._hpBarKey = key;
  const { fill, trail, num } = ui._hpBarParts;
  const w = `${(frac * 100).toFixed(1)}%`;
  // The trail eases down after the fill (its CSS transition), so a loss
  // shows; a heal moves both at once.
  el.classList.toggle('heal', frac >= (ui._hpBarFrac ?? 1));
  ui._hpBarFrac = frac;
  fill.style.width = w;
  trail.style.width = w;
  num.textContent = hpText(hp, max);
  const wd = ui._hpBarParts.ward;
  wd.textContent = ward > 0 ? `+${formatNumber(Math.round(ward))}` : '';
  el.classList.toggle('warded', ward > 0);
  el.setAttribute('aria-valuemax', String(Math.round(max)));
  el.setAttribute('aria-valuenow', String(Math.max(0, Math.round(hp))));
  const band = BANDS[hpBand(frac)];
  el.classList.toggle('mid', band === 'mid');
  el.classList.toggle('low', band === 'low' && alive);
}
