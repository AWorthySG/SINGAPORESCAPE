// UI motion: the small, shared moves that make the windows and HUD feel
// finished. Every one is a visual extra laid over a state change that has
// already happened (a window is shut, a sheet folded, a node of a dialogue
// drawn), so nothing here ever delays input or what the game and the tests
// see. Only transform and opacity move (bar a dialogue's height, eased once per
// answer), each effect cleans up after itself, and none runs a timer while
// idle.
//
// Off when there is no page (the headless tests), when the browser or
// Settings > Reduce motion asks for stillness, and, for the costlier extras
// (the level-up burst, the sheet's slide away), in low graphics.
//
// The durations match the CSS motion tokens (--dur-1/2/3 in styles/compact.css).
import { motionReduced, copyCanvases } from './uifx.js';
import { skillIconSVG } from '../render/icons.js';

export const DUR = { fast: 120, med: 180, slow: 260 };
/** Curves as the CSS has them (--ease-std / --ease-pop / --ease-exit). */
export const EASE = {
  std: 'cubic-bezier(.2, .8, .3, 1)',
  pop: 'cubic-bezier(.2, .9, .3, 1.25)',
  exit: 'cubic-bezier(.4, 0, 1, 1)',
};
/** At most this many rows of a window rise in one after another. */
export const STAGGER_MAX = 10;
export const STAGGER_STEP_MS = 22;

const hasDom = () => typeof document !== 'undefined' && !!document.body;

/** True when the extras should stay still. `costly`: also in low graphics. */
export function motionOff(game, costly = false) {
  if (!hasDom() || motionReduced()) return true;
  return costly && !!game?.lowFx;
}

/** iPhones only show a button's pressed (:active) look when something on the
 *  page listens for touches; one passive listener on the page turns every
 *  press state in the stylesheets on (it never blocks a scroll). */
export function installPressStates() {
  if (!hasDom() || document._pressStates) return;
  document._pressStates = true;
  document.addEventListener('touchstart', () => {}, { passive: true });
}

/** Run `mutate` (which redraws `el`'s contents) and ease `el`'s height from
 *  its old size to the new one, so a bottom sheet or a window whose contents
 *  change (the next line of a dialogue) glides rather than jumping. The
 *  contents are already final; only the box's height moves, briefly. */
export function easeHeight(el, mutate, game) {
  if (motionOff(game) || !el?.getBoundingClientRect || typeof el.animate !== 'function') { mutate(); return; }
  // The window still sliding or popping open: let that play, just redraw.
  if (!el._easeAnim && el.getAnimations?.().some((a) => a.playState === 'running')) { mutate(); return; }
  const from = el.getBoundingClientRect().height;
  el._easeAnim?.cancel();
  mutate();
  const to = el.getBoundingClientRect().height;
  if (!from || !to || Math.abs(to - from) < 6) return;
  el._easeAnim = el.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${to}px`, overflow: 'hidden' }],
    { duration: DUR.med, easing: EASE.std });
  el._easeAnim.onfinish = el._easeAnim.oncancel = () => { el._easeAnim = null; };
}

/** Fade new contents in over a quick rise (a window opened from another one,
 *  so the shared window doesn't just snap from one page to the next). */
export function swapIn(el, game) {
  if (motionOff(game) || typeof el?.animate !== 'function') return;
  el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: DUR.med, easing: EASE.std });
}

/** The first rows of a window that has just opened rise in one after another.
 *  Only on opening: a redraw while it is open (a bank deposit) shows at once. */
export function staggerIn(container, game) {
  if (motionOff(game) || !container?.children) return;
  [...container.children].slice(0, STAGGER_MAX).forEach((row, i) => {
    if (typeof row.animate !== 'function') return;
    row.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: DUR.slow, delay: i * STAGGER_STEP_MS, easing: EASE.std, fill: 'backwards' });
  });
}

/** Restart a one-shot CSS animation class on `el` (a bag tab that just took
 *  loot, an XP counter that just went up). The class comes off when it ends. */
export function bump(el, cls = 'ui-bump', game) {
  if (motionOff(game) || !el?.classList) return;
  el.classList.remove(cls);
  void el.offsetWidth;   // so the same class starts its animation again
  el.classList.add(cls);
  if (!el._bumpEnd) {
    el._bumpEnd = (e) => { if (e.target === el && /^uiBump/.test(e.animationName || '')) el.classList.remove('ui-bump', 'ui-bump-big'); };
    el.addEventListener('animationend', el._bumpEnd);
  }
}

/** A copy of `el` left where it was, playing `cls` (an exit) and removing
 *  itself: the real element has already gone or changed. The copy keeps the
 *  ids inside it (so its own styles apply) but sits after the real element,
 *  so lookups by id still find the real one first; it takes no taps. */
export function exitGhost(el, cls, { game, costly = false, prune } = {}) {
  if (motionOff(game, costly) || !el?.isConnected || typeof el.cloneNode !== 'function') return null;
  const ghost = el.cloneNode(!prune);
  if (prune) for (const c of el.children) if (!prune(c)) ghost.appendChild(c.cloneNode(true));
  ghost.classList.add('ui-ghost', cls);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  el.after(ghost);
  const done = () => ghost.remove();
  ghost.addEventListener('animationend', (e) => { if (e.target === ghost) done(); });
  setTimeout(done, DUR.slow + 200);   // in case the animation never runs
  return ghost;
}

/** Phones: the side panel's sheet slides back down (or out to the right on
 *  a phone on its side) when folded, as the windows' sheets do, instead of
 *  vanishing. The panel is already folded; a copy of the open sheet (just the
 *  showing view, not the hidden ones) plays the exit. */
export function sheetCloseGhost(panel, game) {
  if (!panel || typeof matchMedia !== 'function') return null;
  if (!matchMedia('(pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px)').matches) return null;
  // Copy the panel as it was open: put its open classes back on the copy.
  const ghost = exitGhost(panel, 'sheet-ghost', { game, costly: true, prune: (c) => c.id === 'panel-body' });
  if (!ghost) return null;
  ghost.classList.remove('collapsed');
  const body = panel.querySelector?.('#panel-body');
  if (body) {
    const copy = body.cloneNode(false);
    for (const v of body.children) if (!v.classList?.contains('hidden')) { const c = v.cloneNode(true); copyCanvases(v, c); copy.appendChild(c); }
    // The body sits in its grid row; keep it in order among the copy's children.
    const at = [...panel.children].indexOf(body);
    ghost.insertBefore(copy, ghost.children[at] || null);
    copy.scrollTop = body.scrollTop;
  }
  // Let go part-way down a drag: it carries on from there (the slide's start
  // is the copy's own position).
  const d = panel._dragD || 0;
  if (d > 0) ghost.style.transform = matchMedia('(max-height: 500px)').matches ? `translateX(${d}px)` : `translateY(${d}px)`;
  return ghost;
}

// ---------------- Level-up celebration ----------------
let celebrateEl = null, celebrateTimer = 0;
const RAYS = 10;

/** A milestone level (every tenth, 99): a big gold badge at the top of the
 *  screen with a burst of rays and confetti, then it floats away. One element,
 *  reused; a second milestone while it shows replaces the words. It takes no
 *  taps and moves nothing else on screen. Off in reduced motion and low
 *  graphics (the lane's card and the XP ring's toast still say it). */
export function celebrateLevel({ skill, name, level, more = 0 }, game) {
  if (motionOff(game, true)) return null;
  const root = document.getElementById('game-root') || document.body;
  if (!celebrateEl || !celebrateEl.isConnected) {
    celebrateEl = document.createElement('div');
    celebrateEl.id = 'lvl-burst';
    celebrateEl.setAttribute('aria-hidden', 'true');   // the lane's card is the one read out
    root.appendChild(celebrateEl);
  }
  const el = celebrateEl;
  const rays = Array.from({ length: RAYS }, (_, i) => `<i style="--a:${(360 / RAYS) * i}deg;--d:${i % 2 ? 46 : 62}px"></i>`).join('');
  el.innerHTML = `<div class="lb-rays"></div><div class="lb-bits">${rays}</div>`
    + `<div class="lb-card"><span class="lb-ic">${skillIconSVG(skill, 34)}</span>`
    + `<span class="lb-words"><b class="lb-lvl">Level ${level}</b><span class="lb-name">${name}${more ? ` <i>+${more} more</i>` : ''}</span></span></div>`;
  el.classList.remove('show', 'out');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => {
    el.classList.add('out');
    celebrateTimer = setTimeout(() => el.classList.remove('show', 'out'), DUR.slow + 40);
  }, 1700);
  return el;
}
