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

/** A copied element's canvases come out blank (cloneNode copies no pixels):
 *  paint each copy from its original, so a closing window's map or hero
 *  stages fade out as they were rather than as empty cream. At most `max`. */
export function copyCanvases(from, to, max = 24) {
  if (!from?.querySelectorAll || !to?.querySelectorAll) return 0;
  const a = from.querySelectorAll('canvas'), b = to.querySelectorAll('canvas');
  let n = 0;
  for (let i = 0; i < a.length && i < b.length && n < max; i++) {
    const src = a[i], dst = b[i];
    if (!src.width || !src.height) continue;
    try {
      dst.width = src.width; dst.height = src.height;
      dst.getContext('2d')?.drawImage(src, 0, 0);
      n++;
    } catch { /* a canvas that can't be read: the copy stays blank */ }
  }
  return n;
}

/** A window closing fades and sinks away. The real window hides at once (so
 *  nothing about opening the next one changes); a still copy of the dimmed
 *  backdrop and window plays the exit and removes itself. The copy sits just
 *  after the real one, so lookups by id still find the real window first. */
export function playCloseGhost(overlay) {
  if (!overlay || motionReduced() || !overlay.isConnected || typeof overlay.cloneNode !== 'function') return;
  if (overlay.classList.contains('hidden')) return;
  const body = overlay.querySelector?.('#modal-body') || null;
  const show = (g) => {
    g.removeAttribute('id');
    g.className = 'modal-ghost';
    g.setAttribute('aria-hidden', 'true');
    g.inert = true;
    overlay.after(g);
    return g;
  };
  const cut = ghostCopy(overlay, body);
  let ghost = show(cut.copy);
  // The trimmed copy must look just like the whole one: if anything it kept
  // sits differently (a row laid out against the ones left out), copy it whole.
  if (cut.trimmed && !ghostMatches(body, ghost, cut.checks)) { ghost.remove(); ghost = show(ghostCopy(overlay, null).copy); }
  ghost.addEventListener('animationend', (e) => { if (e.target === ghost) ghost.remove(); });
  setTimeout(() => ghost.remove(), 400);   // in case the animation never runs
}

// A copy shows its scroller at the top (cloneNode keeps no scroll), and a long
// list's rows below that are never seen as it fades. Copying, styling, laying
// out and painting all of them (a full bank, a skill guide's every spot) made
// closing a big window cost more than opening it on a phone, so the copy
// leaves out the rows at the end of a list that would start below the
// window's bottom edge, going down into a list that runs past it. The boxes
// it goes into keep their height, so borders and backgrounds are unchanged.
const GHOST_DEPTH = 8;
const GHOST_CANVASES = 24;

/** The closing copy of `el` ({ copy, trimmed, checks }): deep, except that
 *  inside the scroller `body` the rows at the end that would sit out of sight
 *  are left out (none when `body` is null). Canvases keep their pictures
 *  (copyCanvases), the first GHOST_CANVASES of them. */
export function ghostCopy(el, body) {
  if (!body || typeof body.getBoundingClientRect !== 'function' || !el.contains?.(body)) {
    const all = el.cloneNode(true);
    copyCanvases(el, all);
    return { copy: all, trimmed: false, checks: [] };
  }
  // The copy's scroller is at its top: what lies below its bottom edge is out of sight.
  const bottom = body.getBoundingClientRect().bottom - (body.scrollTop || 0) + 1;
  const st = { bottom, scrolled: !!body.scrollTop, pairs: [], checks: [], trimmed: false };
  const copy = copyTowards(el, body, st);
  let n = 0;
  for (const [a, b] of st.pairs) if (n < GHOST_CANVASES) n += copyCanvases(a, b, GHOST_CANVASES - n);
  return { copy, trimmed: st.trimmed, checks: st.checks };
}

function copyTowards(el, body, st) {
  if (el === body) return copyAbove(el, st, GHOST_DEPTH);
  if (!el.contains(body)) { const c = el.cloneNode(true); st.pairs.push([wrap(el), wrap(c)]); return c; }
  const copy = el.cloneNode(false);
  for (const c of el.childNodes) copy.appendChild(c.nodeType === 1 ? copyTowards(c, body, st) : c.cloneNode(true));
  return copy;
}

/** `el` without its trailing children that start below the bottom edge, going
 *  down into the one that runs past it. */
function copyAbove(el, st, depth) {
  const kids = [...el.children];
  const below = kids.map((c) => {
    const r = c.getBoundingClientRect();
    // (Scrolled, a sticky row shows where it is stuck, not where the copy has it: kept.)
    return r.top >= st.bottom && (r.width || r.height) && !(st.scrolled && getComputedStyle(c).position === 'sticky') ? 1 : r.bottom > st.bottom ? 2 : 0;
  });
  let last = below.length - 1;   // the last child kept: only the ones after it go
  while (last >= 0 && below[last] === 1) last--;
  const copy = el.cloneNode(false);
  if (last < kids.length - 1) {
    st.trimmed = true;
    // As tall as before, its rows packed at the top as they were (a grid or a
    // wrapping row would otherwise share the room the left-out rows had).
    const cs = getComputedStyle(el);
    copy.style.setProperty('height', cs.height, 'important');
    if (cs.alignContent === 'normal' || cs.alignContent === 'stretch') copy.style.setProperty('align-content', 'start', 'important');
    if (last >= 0) st.checks.push([kids[last], copy, last]);
  }
  let i = -1;
  for (const c of el.childNodes) {
    if (c.nodeType !== 1) { copy.appendChild(c.cloneNode(true)); continue; }
    i++;
    if (i > last) {
      // One hidden stand-in for what was left out, so the rows kept match the
      // same rules as before (a :last-child or a "+" rule sees one after them).
      if (i === last + 1) { const s = c.cloneNode(false); s.style.setProperty('display', 'none', 'important'); copy.appendChild(s); }
      continue;
    }
    const deeper = below[i] === 2 && depth > 0 && !!c.firstElementChild && c.tagName !== 'CANVAS';
    const k = deeper ? copyAbove(c, st, depth - 1) : c.cloneNode(true);
    if (!deeper) st.pairs.push([wrap(c), wrap(k)]);
    copy.appendChild(k);
  }
  return copy;
}

/** A canvas itself, or an element's canvases, as copyCanvases takes them. */
function wrap(el) {
  return el.tagName === 'CANVAS' ? { querySelectorAll: () => [el] } : el;
}

/** Does the trimmed copy sit as the whole one would? The last row kept in
 *  each trimmed box is in the same place (allowing for the window's scroll),
 *  and the window scrolls as far: a blank block at the end of its scroller
 *  makes up for what was left out, so the scrollbar looks the same too. */
function ghostMatches(body, ghost, checks) {
  const gb = ghost.querySelector?.('#modal-body');
  if (!gb) return false;
  const missing = body.scrollHeight - gb.scrollHeight;
  if (missing > 0) {
    const pad = document.createElement('div');
    pad.style.height = `${missing}px`;
    gb.appendChild(pad);
  }
  const a0 = body.getBoundingClientRect(), b0 = gb.getBoundingClientRect(), sc = body.scrollTop || 0;
  for (const [orig, box, idx] of checks) {
    const twin = box.children[idx];
    if (!twin) return false;
    const a = orig.getBoundingClientRect(), b = twin.getBoundingClientRect();
    if (Math.abs((a.top - a0.top + sc) - (b.top - b0.top)) > 0.5 || Math.abs((a.left - a0.left) - (b.left - b0.left)) > 0.5
      || Math.abs(a.width - b.width) > 0.5 || Math.abs(a.height - b.height) > 0.5) return false;
  }
  return Math.abs(body.scrollHeight - gb.scrollHeight) <= 1;
}

/** A painted or SVG icon set inline in a line of text (icons.js returns block
 *  images, so they sit in a small inline box that lines up with the words). */
export const inlineIcon = (html) => `<span class="ui-ic" aria-hidden="true">${html}</span>`;
