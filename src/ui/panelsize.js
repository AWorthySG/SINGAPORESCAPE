// The side panel's size, for easier reading and clicking. On a screen with a
// mouse the whole panel (its width, the bag's cells, the text and icons) grows
// in three steps, Normal / Large / Extra large, or freely by dragging the grip
// on its left edge up to 1.6x. It uses CSS zoom on #sidepanel (compact.css), so
// every view inside scales together and clicks, hovers and tooltips still land
// where they look. Touch screens never get the zoom (iPhone Safari hit-tests a
// zoomed panel a few pixels off, which is why the old Text size setting went):
// their sheet has a "Larger text in menus" switch instead, done with plain CSS.
// A bigger panel stops where it would run into the minimap above it or the
// quick bar and action buttons in the middle (panelScaleCap). The choice is
// remembered on this device only; headless (the tests) there is no page.

export const PANEL_STEPS = [
  { name: 'Normal', s: 1 },
  { name: 'Large', s: 1.25 },
  { name: 'Extra large', s: 1.5 },
];
export const PANEL_MAX = 1.6;
const KEY = 'ss_ui_panel';

// The room the panel works in (px, unscaled; compact.css's panel-size block
// keeps the same numbers):
const MARGIN = 10;        // the panel's own gap from the window's right edge
const CENTRE_HALF = 152;  // half the quick bar, the widest thing in the bottom-centre column
const GAP = 12;           // kept between the panel and that column
const TOP_CLEAR = 272;    // the minimap, its orbs and caption, and the XP counter under them
const RAIL_H = 316;       // the header plus the five 52px tabs, at Normal

/** The largest scale the panel fits at in a `vw` x `vh` window, whose Normal
 *  width is `baseW`: left of it the bottom-centre column (quick bar, HP bar,
 *  ability bar), above it the minimap. Never below 1 (Normal always shows). Pure. */
export function panelScaleCap(vw, vh, baseW = 320) {
  const byW = (vw / 2 - CENTRE_HALF - GAP - MARGIN) / baseW;
  const byH = (vh - TOP_CLEAR - MARGIN) / RAIL_H;
  const cap = Math.min(PANEL_MAX, byW, byH);
  return Math.round(Math.max(1, cap) * 100) / 100;
}

/** `s` kept between Normal and `cap` (and a sane number). Pure. */
export function clampScale(s, cap = PANEL_MAX) {
  const n = Number(s);
  if (!Number.isFinite(n)) return 1;
  return Math.round(Math.min(Math.max(n, 1), Math.max(1, cap)) * 100) / 100;
}

/** A drag that ends close to a step lands on it. Pure. */
export function snapScale(s) {
  for (const st of PANEL_STEPS) if (Math.abs(st.s - s) <= 0.05) return st.s;
  return Math.round(s * 100) / 100;
}

/** The step after (dir 1) or before (dir -1) `s`; past Extra large, `wrap`
 *  goes back to Normal (the Settings chip), otherwise on to the largest. Pure. */
export function stepScale(s, dir, wrap = false) {
  const list = PANEL_STEPS.map((st) => st.s);
  if (dir > 0) {
    const up = list.find((v) => v > s + 0.001);
    return up ?? (wrap ? list[0] : PANEL_MAX);
  }
  const down = [...list].reverse().find((v) => v < s - 0.001);
  return down ?? list[0];
}

/** "Normal", "Large", "Extra large", or "140%" between steps. Pure. */
export function scaleName(s) {
  const st = PANEL_STEPS.find((x) => Math.abs(x.s - s) < 0.005);
  return st ? st.name : `${Math.round(s * 100)}%`;
}

/** The saved choice: { s: scale, t: larger text on touch screens }. */
export function loadPanelPrefs(store = globalThis.localStorage) {
  let p = null;
  try { p = JSON.parse(store?.getItem(KEY) || 'null'); } catch { p = null; }
  return { s: clampScale(p?.s ?? 1), t: !!p?.t };
}

export function savePanelPrefs(prefs, store = globalThis.localStorage) {
  try { store?.setItem(KEY, JSON.stringify({ s: prefs.s, t: prefs.t ? 1 : 0 })); } catch { /* storage blocked: it just isn't remembered */ }
}

/** Put a scale on the panel element: the --ps variable compact.css zooms by,
 *  and .ps-big while it is above Normal (the rules only switch on then). */
export function applyPanelScale(panel, s, bigText = false) {
  if (!panel) return;
  panel.style?.setProperty?.('--ps', String(s));
  panel.classList?.toggle('ps-big', s > 1.001);
  panel.classList?.toggle('menu-big', !!bigText);
}

/** The live sizer: the header's A− / A+ buttons, the grip, the window's
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

  /** The chosen scale (what Settings names). */
  get chosen() { return this.prefs.s; }
  get bigText() { return this.prefs.t; }

  /** The panel's Normal width: --panel-w (320px on a desktop, less on narrow windows). */
  _baseW() {
    const v = typeof getComputedStyle === 'function' ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) : NaN;
    return v > 0 ? v : 320;
  }

  cap() {
    if (typeof window === 'undefined') return PANEL_MAX;
    return panelScaleCap(window.innerWidth, window.innerHeight, this._baseW());
  }

  /** The scale in use: the choice, or less where the window is too small for it. */
  get scale() { return clampScale(this.prefs.s, this.cap()); }

  apply(live) {
    const s = live ?? this.scale;
    applyPanelScale(this.panel, s, this.prefs.t);
    if (this._minus) {
      this._minus.disabled = s <= 1;
      this._plus.disabled = s >= this.cap() - 0.001;
    }
    this.onChange?.();
  }

  /** Choose a scale (kept, then shown as far as the window allows). */
  set(s) {
    this.prefs.s = clampScale(s);
    savePanelPrefs(this.prefs);
    this.apply();
  }

  /** One step up or down; `wrap` (Settings) goes from Extra large back to Normal. */
  step(dir, wrap = false) {
    // The buttons step from what shows (a capped Extra large steps down to
    // Large); Settings' chip from what was chosen, so it can go round.
    const from = wrap ? this.prefs.s : this.scale;
    this.set(stepScale(from, dir, wrap));
  }

  setBigText(on) {
    this.prefs.t = !!on;
    savePanelPrefs(this.prefs);
    this.apply();
  }

  /** What Settings' chip says: the choice, and what fits when the window is too small for it. */
  label() {
    const s = this.scale;
    const name = scaleName(this.prefs.s);
    return s < this.prefs.s - 0.001 ? `${name} (fits ${Math.round(s * 100)}%)` : name;
  }

  _buildControls(head) {
    // A− / A+ in the header, beside the fold button (mouse screens only: compact.css).
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
      this._minus = mk('A&minus;', 'Smaller side panel', -1);
      this._plus = mk('A+', 'Bigger side panel', 1);
      head.insertBefore(box, head.querySelector('#panel-collapse'));
    }
    // The grip on the left edge: drag it out to widen the panel (the right
    // edge stays put); a release near a step settles on it.
    const grip = document.createElement('div');
    grip.className = 'ps-grip';
    grip.title = 'Drag to resize the side panel';
    grip.setAttribute('aria-hidden', 'true');
    this.panel.appendChild(grip);
    let drag = null;
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const w = this.panel.getBoundingClientRect().width;
      if (!w) return;
      drag = { id: e.pointerId, x: e.clientX, w, s: this.scale, cap: this.cap(), now: this.scale };
      grip.setPointerCapture?.(e.pointerId);
      this.panel.classList.add('ps-dragging');
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      // The panel's on-screen width grows with the scale, so the new width
      // over the old one is the new scale over the old one.
      const w = drag.w + (drag.x - e.clientX);
      drag.now = clampScale(drag.s * (w / drag.w), drag.cap);
      this.apply(drag.now);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const s = snapScale(drag.now);
      drag = null;
      this.panel.classList.remove('ps-dragging');
      this.set(s);
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    // A double-click puts it back to Normal.
    grip.addEventListener('dblclick', () => this.set(1));
  }
}
