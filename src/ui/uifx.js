// Small interface effects shared by the windows: numbers that count up, a
// fading copy of a window as it closes, the accessibility settings applied to
// the page, and painted icons placed inline in a label. Everything here falls
// back to doing nothing (or setting the final text) when there is no DOM, as
// in the headless tests, or when the player has asked for less motion.


/** True when the browser or Settings > Reduce motion asks for stillness. */
export function motionReduced() {
  if (typeof document === 'undefined') return true;
  if (document.body?.classList.contains('reduce-motion')) return true;
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Put the accessibility settings on the page as classes the stylesheet reads.
 *  Returns a short signature so callers can skip work when nothing changed. */
export function applyAccessibility(game) {
  const sig = `${!!game?.colourBlind}|${!!game?.reduceMotion}`;
  const body = typeof document !== 'undefined' ? document.body : null;
  if (!body) return sig;
  body.classList.toggle('cb-safe', !!game?.colourBlind);
  body.classList.toggle('reduce-motion', !!game?.reduceMotion);
  return sig;
}

// The last number each counter showed, so a window that redraws (the shop
// after a sale) counts from where it was rather than from zero.
const shown = new Map();

/** Show `to` in `el`, counting up (or down) from the last value shown under
 *  `key`. `fmt` turns a number into text. The first time a key is seen the
 *  number simply appears, unless `from` is given. */
export function countUp(el, key, to, fmt = (n) => String(n), from) {
  if (!el) return;
  const start = from ?? (shown.has(key) ? shown.get(key) : to);
  shown.set(key, to);
  if (start === to || motionReduced() || typeof requestAnimationFrame !== 'function') { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const dur = Math.min(700, 250 + Math.abs(to - start) * 4);
  el.classList.add('counting');
  const step = (now) => {
    if (!el.isConnected && now - t0 > 50) return;   // the window was redrawn: the new one takes over
    // A frame's timestamp can be from before t0 (it is when the frame began,
    // and timeline throttling can hold it back): never ease below the start.
    const k = Math.max(0, Math.min(1, (now - t0) / dur));
    const eased = 1 - (1 - k) ** 3;
    el.textContent = fmt(Math.round(start + (to - start) * eased));
    if (k < 1) requestAnimationFrame(step);
    else el.classList.remove('counting');
  };
  el.textContent = fmt(start);
  requestAnimationFrame(step);
}

/** A window closing fades and sinks away. The real window hides at once (so
 *  nothing about opening the next one changes); a still copy of the dimmed
 *  backdrop and window plays the exit and removes itself. The copy sits just
 *  after the real one, so lookups by id still find the real window first. */
export function playCloseGhost(overlay) {
  if (!overlay || motionReduced() || !overlay.isConnected || typeof overlay.cloneNode !== 'function') return;
  if (overlay.classList.contains('hidden')) return;
  const ghost = overlay.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.className = 'modal-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  overlay.after(ghost);
  ghost.addEventListener('animationend', (e) => { if (e.target === ghost) ghost.remove(); });
  setTimeout(() => ghost.remove(), 400);   // in case the animation never runs
}

/** A painted or SVG icon set inline in a line of text (icons.js returns block
 *  images, so they sit in a small inline box that lines up with the words). */
export const inlineIcon = (html) => `<span class="ui-ic" aria-hidden="true">${html}</span>`;
