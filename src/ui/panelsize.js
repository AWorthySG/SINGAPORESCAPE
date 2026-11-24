// The side panel's size: how big its window is, so more fits in it without
// scrolling. On a screen with a mouse the panel's width and its body's height
// grow in steps, Normal / Large / Extra large / Full height (the whole free
// right-hand column), or freely by dragging a grip: its left edge for the
// width, its top edge for the height, its top-left corner for both. Only the
// box grows: the text, icons and bag cells keep their size and the views
// reflow (the bag gets more columns, lists show more rows), which is what the
// owner asked for. (#579 zoomed the whole panel instead, so the text grew too.)
// A bigger panel stops where it would run into the minimap, orbs and XP
// counter above it or the quick bar, HP bar and ability bar in the middle
// (panelFit); a small window shows less than chosen and the Settings chip says
// so. Touch screens keep their sheet, which already spans the screen; they get
// a "Bigger menu text" switch, off unless chosen. The choice is remembered on
// this device only; headless (the tests) there is no page.

/** Height meaning "all the free height" (any window is shorter). */
export const PANEL_FULL = 9999;

// w: the panel's width, h: its body's height, in px; 0 is Normal's own (the CSS).
export const PANEL_STEPS = [
  { name: 'Normal', w: 0, h: 0 },
  { name: 'Large', w: 400, h: 640 },
  { name: 'Extra large', w: 480, h: 760 },
  { name: 'Full height', w: 520, h: PANEL_FULL },
];
export const PANEL_MAX_W = 720;   // the widest a drag goes, even on a huge window
export const PANEL_MIN_H = 240;   // a dragged body never gets shorter than this
const KEY = 'ss_ui_panel';

// The room the panel works in (px; compact.css's panel-size block keeps the
// same numbers):
const MARGIN = 10;        // the panel's own gap from the window's right and bottom edges
const CENTRE_HALF = 152;  // half the quick bar, the widest thing in the bottom-centre column
const GAP = 12;           // kept between the panel and that column
const TOP_CLEAR = 272;    // the minimap, its orbs and caption, and the XP counter under them
const HEAD_H = 36;        // the panel's header and borders, above the body

/** The largest panel that fits a `vw` x `vh` window whose Normal width is
 *  `baseW`: `w` keeps it right of the bottom-centre column (quick bar, HP bar,
 *  ability bar), `h` (the body) keeps it under the minimap. Never narrower than
 *  Normal. Pure. */
export function panelFit(vw, vh, baseW = 320) {
  const w = Math.floor(Math.min(PANEL_MAX_W, vw / 2 - CENTRE_HALF - GAP - MARGIN));
  const h = Math.floor(vh - TOP_CLEAR - MARGIN - HEAD_H);
  return { w: Math.max(baseW, w), h: Math.max(0, h) };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** A saved width kept sane: 0 (Normal) or a px width. Pure. */
export function cleanW(w) {
  const n = num(w);
  return n > 0 ? Math.round(Math.min(Math.max(n, 160), PANEL_MAX_W)) : 0;
}
/** A saved body height kept sane: 0 (Normal), a px height or PANEL_FULL. Pure. */
export function cleanH(h) {
  const n = num(h);
  return n > 0 ? Math.round(Math.min(Math.max(n, PANEL_MIN_H), PANEL_FULL)) : 0;
}

/** What shows for the choice `size` ({ w, h }) when the window allows `fit`:
 *  { w, h, big, cut }. h 0 leaves Normal's height; `cut` says the window is
 *  too small for the choice (Full height is never cut: it is whatever is free). Pure. */
export function resolvePanelSize(size, fit, baseW = 320) {
  const w = size.w ? Math.min(Math.max(size.w, baseW), fit.w) : baseW;
  const h = size.h ? Math.min(Math.max(size.h, Math.min(PANEL_MIN_H, fit.h)), fit.h) : 0;
  const cut = (size.w > 0 && w < size.w) || (size.h > 0 && size.h < PANEL_FULL && h < size.h);
  return { w, h, big: w > baseW || h > 0, cut };
}

/** The step `size` is exactly, or -1 (a dragged size). Pure. */
export function stepIndex(size) {
  return PANEL_STEPS.findIndex((st) => st.w === size.w && st.h === size.h);
}

/** The largest step `size` is at least as big as, both ways (Normal at worst). Pure. */
function stepBelow(size) {
  let at = 0;
  PANEL_STEPS.forEach((st, i) => { if (size.w >= st.w && size.h >= st.h) at = i; });
  return at;
}

/** The step after (dir 1) or before (dir -1) `size`. Past Full height `wrap`
 *  goes back to Normal (the Settings chip), otherwise it stays. Pure. */
export function stepSize(size, dir, wrap = false) {
  const at = stepIndex(size), below = stepBelow(size);
  let i;
  if (dir > 0) i = below + 1;
  else i = at >= 0 ? at - 1 : below;
  if (i >= PANEL_STEPS.length) i = wrap ? 0 : PANEL_STEPS.length - 1;
  const st = PANEL_STEPS[Math.max(0, i)];
  return { w: st.w, h: st.h };
}

/** "Normal", "Large", ... or "Custom" for a dragged size. Pure. */
export function sizeName(size) {
  const i = stepIndex(size);
  return i >= 0 ? PANEL_STEPS[i].name : 'Custom';
}

/** An old zoom choice (#579 saved { s: 1 to 1.6 }) as the nearest window size. Pure. */
export function migrateZoom(s) {
  const n = num(s);
  const st = n < 1.1 ? PANEL_STEPS[0] : n < 1.375 ? PANEL_STEPS[1] : PANEL_STEPS[2];
  return { w: st.w, h: st.h };
}

/** The saved choice: { w, h, t: bigger menu text on touch screens }. */
export function loadPanelPrefs(store = globalThis.localStorage) {
  let p = null;
  try { p = JSON.parse(store?.getItem(KEY) || 'null'); } catch { p = null; }
  if (!p || typeof p !== 'object') return { w: 0, h: 0, t: false };
  const size = p.v === 2 ? { w: cleanW(p.w), h: cleanH(p.h) } : migrateZoom(p.s);
  return { ...size, t: !!p.t };
}

export function savePanelPrefs(prefs, store = globalThis.localStorage) {
  try { store?.setItem(KEY, JSON.stringify({ v: 2, w: prefs.w, h: prefs.h, t: prefs.t ? 1 : 0 })); } catch { /* storage blocked: it just isn't remembered */ }
}

/** Put a resolved size on the panel element: --ps-w (its width), --ps-h (its
 *  body's height), --ps-dw (the width added to Normal's, so the bag's cells
 *  keep Normal's size), .ps-big while it is above Normal and .ps-tall while
 *  its height is set (compact.css's rules only switch on then). */
export function applyPanelSize(panel, r, baseW = 320, bigText = false) {
  if (!panel) return;
  const st = panel.style;
  st?.setProperty?.('--ps-w', `${r.w}px`);
  st?.setProperty?.('--ps-dw', `${Math.max(0, r.w - baseW)}px`);
  if (r.h) st?.setProperty?.('--ps-h', `${r.h}px`);
  else st?.removeProperty?.('--ps-h');
  panel.classList?.toggle('ps-big', !!r.big);
  panel.classList?.toggle('ps-tall', r.h > 0);
  panel.classList?.toggle('menu-big', !!bigText);
}

/** The live sizer: the header's − / + buttons, the grips, the window's
 *  resizes. `onChange` (Settings' chip) hears every change. */
export class PanelSizer {
  constructor(panel, head) {
    this.panel = panel;
    this.prefs = loadPanelPrefs();
    this.onChange = null;
    if (!panel || typeof document === 'undefined') return;
    this._buildControls(head);
    this.apply();
    if (typeof window !== 'undefined') window.addEventListener('resize', () => this.apply());
  }

  /** The chosen size, { w, h } (what Settings names). */
  get chosen() { return { w: this.prefs.w, h: this.prefs.h }; }
  get bigText() { return this.prefs.t; }

  /** The panel's Normal width: --panel-w (320px on a desktop, less on narrow windows). */
  _baseW() {
    const v = typeof getComputedStyle === 'function' && typeof document !== 'undefined'
      ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) : NaN;
    return v > 0 ? v : 320;
  }

  /** The room this window has (headless: as if it were big). */
  fit() {
    if (typeof window === 'undefined') return { w: PANEL_MAX_W, h: PANEL_FULL };
    return panelFit(window.innerWidth, window.innerHeight, this._baseW());
  }

  /** What shows: the choice, or less where the window is too small for it. */
  get shown() { return resolvePanelSize(this.chosen, this.fit(), this._baseW()); }

  apply(live) {
    const r = live ?? this.shown;
    applyPanelSize(this.panel, r, this._baseW(), this.prefs.t);
    if (this._minus) {
      this._minus.disabled = !r.big;
      this._plus.disabled = !this._next(1);
    }
    this.onChange?.();
  }

  /** Choose a size (kept, then shown as far as the window allows). */
  set(size) {
    this.prefs.w = cleanW(size.w);
    this.prefs.h = cleanH(size.h);
    savePanelPrefs(this.prefs);
    this.apply();
  }

  /** The next step up or down that looks different here (on a small window
   *  Large and Extra large can both be cut to the same size), or null. */
  _next(dir) {
    const fit = this.fit(), baseW = this._baseW();
    const same = (a, b) => a.w === b.w && a.h === b.h;
    const now = resolvePanelSize(this.chosen, fit, baseW);
    let size = this.chosen;
    for (let i = 0; i < PANEL_STEPS.length; i++) {
      const next = stepSize(size, dir);
      if (same(next, size)) return null;
      if (!same(resolvePanelSize(next, fit, baseW), now)) return next;
      size = next;
    }
    return null;
  }

  /** One step up or down; `wrap` (Settings) goes from Full height back to Normal. */
  step(dir, wrap = false) {
    // The buttons skip steps that look the same here; Settings' chip goes
    // through the names in turn, and round.
    const next = wrap ? stepSize(this.chosen, dir, true) : this._next(dir);
    if (next) this.set(next);
  }

  setBigText(on) {
    this.prefs.t = !!on;
    savePanelPrefs(this.prefs);
    this.apply();
  }

  /** What Settings' chip says: the choice, and when the window is too small for it. */
  label() {
    const r = this.shown, name = sizeName(this.chosen);
    if (name === 'Custom') return `Custom (${r.w} wide${r.h ? `, ${r.h} tall` : ''})`;
    return r.cut ? `${name} (cut to fit this window)` : name;
  }

  _buildControls(head) {
    // − / + in the header, beside the fold button (mouse screens only: compact.css).
    if (head) {
      const box = document.createElement('span');
      box.className = 'ps-btns';
      const mk = (txt, title, dir) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ps-btn';
        b.innerHTML = txt;
        b.title = title;
        b.setAttribute('aria-label', title);
        b.addEventListener('click', (e) => { e.stopPropagation(); this.step(dir); });
        return box.appendChild(b);
      };
      this._minus = mk('&minus;', 'Smaller side panel window', -1);
      this._plus = mk('+', 'Bigger side panel window', 1);
      head.insertBefore(box, head.querySelector('#panel-collapse'));
    }
    // The grips: the left edge drags the width, the top edge the height, the
    // top-left corner both (the bottom-right corner stays put). A release near
    // a step settles on it; a double-click puts the panel back to Normal.
    for (const [cls, mode, title] of [
      ['ps-grip', 'w', 'Drag to make the side panel wider or narrower'],
      ['ps-grip-top', 'h', 'Drag to make the side panel taller or shorter'],
      ['ps-grip-corner', 'wh', 'Drag to resize the side panel'],
    ]) {
      const grip = document.createElement('div');
      grip.className = cls;
      grip.title = title;
      grip.setAttribute('aria-hidden', 'true');
      this.panel.appendChild(grip);
      this._wireGrip(grip, mode);
    }
  }

  _wireGrip(grip, mode) {
    let drag = null;
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const body = this.panel.querySelector('#panel-body');
      const w = this.panel.getBoundingClientRect().width, h = body?.getBoundingClientRect().height || 0;
      if (!w) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, w, h, fit: this.fit(), baseW: this._baseW(), now: null };
      grip.setPointerCapture?.(e.pointerId);
      this.panel.classList.add('ps-dragging', `ps-drag-${mode}`);
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      // The right and bottom edges stay put: left grows the width, up the height.
      const size = {
        w: mode.includes('w') ? Math.round(drag.w + (drag.x - e.clientX)) : this.prefs.w,
        h: mode.includes('h') ? Math.round(drag.h + (drag.y - e.clientY)) : this.prefs.h,
      };
      drag.now = size;
      this.apply(resolvePanelSize(size, drag.fit, drag.baseW));
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { now, fit, baseW } = drag;
      drag = null;
      this.panel.classList.remove('ps-dragging', `ps-drag-${mode}`);
      if (now) this.set(snapSize(now, fit, baseW));
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => this.set({ w: 0, h: 0 }));
  }
}

/** A dragged size tidied: back to Normal's width near it, onto a step's width
 *  or height near one, Full height at the top of the free room. Pure. */
export function snapSize(size, fit, baseW = 320, near = 14) {
  let w = size.w, h = size.h;
  if (w && w <= baseW + near) w = 0;
  for (const st of PANEL_STEPS) if (st.w && w && Math.abs(w - st.w) <= near) w = st.w;
  if (h && h >= fit.h - near) h = PANEL_FULL;
  else for (const st of PANEL_STEPS) if (st.h && st.h < PANEL_FULL && h && Math.abs(h - st.h) <= near) h = st.h;
  // A step's width and height together are that step (its name shows).
  const i = PANEL_STEPS.findIndex((st) => st.w === w && (st.h === h || (st.h === PANEL_FULL && h >= fit.h)));
  if (i > 0) return { w: PANEL_STEPS[i].w, h: PANEL_STEPS[i].h };
  return { w, h };
}
