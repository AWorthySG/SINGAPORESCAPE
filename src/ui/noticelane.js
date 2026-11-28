// The notification lane: one place for every short note (banners, first-time
// tips, world events, rare drops), so they never stack over the middle of the
// screen. On a desktop it hangs under the region name at the top centre; on a
// phone it sits top-left under the objectives, beside the minimap. The queue
// itself is in notices.js; this draws it. Headless (the tests) it keeps the
// queue and draws nothing.
import { NoticeQueue } from './notices.js';
import { glyphArtHTML } from '../render/icons.js';
import { motionOff, bump } from './motion.js';

// Compact lane: one line on screen at a time. While others wait behind it the
// one showing moves on after LANE_CYCLE_MS, so they take turns; the "+N"
// button opens the waiting ones as a short list (tap one to put it away), and
// the list folds again by itself after LANE_LIST_MS.
export const LANE_SHOWN = 1;
export const LANE_CYCLE_MS = 2600;
export const LANE_LIST_MS = 8000;

/** How long a showing card stays up: its own time, but no more than the cycle
 *  while others wait (tips, which need reading, keep theirs). Pure, for the tests. */
export function laneTtl(item, waiting) {
  return waiting > 0 && item.kind !== 'tip' ? Math.min(item.ttl, LANE_CYCLE_MS) : item.ttl;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// A ResizeObserver reports a newly observed element once, at the browser's
// next rendering step: after style and layout, before paint, the one moment
// reading boxes costs nothing. Observing the root element (always laid out,
// never 0 x 0) afresh each time turns that into "call me after the next layout".
let layoutRO = null, layoutJobs = [], layoutRunning = false, layoutTimer = 0;
function runLayoutJobs() {
  layoutRO.disconnect();
  clearTimeout(layoutTimer);
  const jobs = layoutJobs;
  layoutJobs = [];
  layoutRunning = true;
  for (const f of jobs) { try { f(); } catch (err) { console.error('Error after layout:', err); } }
  layoutRunning = false;
  // Asked again meanwhile: wait for the next frame (observing inside the
  // observer's own callback would only be reported as a loop it can't finish).
  if (layoutJobs.length) requestAnimationFrame(armLayout);
}
function armLayout() {
  layoutRO.observe(document.documentElement);
  // A browser that never answered would leave the lane where it was for good:
  // after a second the jobs run anyway, as they used to (measuring there and then).
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => { if (layoutJobs.length && !layoutRunning) runLayoutJobs(); }, 1000);
  layoutTimer?.unref?.();   // (headless, the tests: never keeps Node waiting)
}
/** Run `fn` after the browser's next layout. False when there is no
 *  ResizeObserver (headless, very old browsers): the caller falls back. */
export function afterLayout(fn) {
  if (typeof ResizeObserver !== 'function' || typeof document === 'undefined' || !document.documentElement) return false;
  layoutRO ||= new ResizeObserver(runLayoutJobs);
  layoutJobs.push(fn);
  if (layoutJobs.length === 1 && !layoutRunning) armLayout();
  return true;
}

export class NoticeLane {
  constructor(ui) {
    this.ui = ui;
    this.queue = new NoticeQueue({ max: LANE_SHOWN });
    this.listOpen = false;
    this._listAt = 0;
    this.el = null;
    this._timer = 0;
    this._sig = '';
  }

  /** Show a note. `n`: { html, kind ('banner' | 'tip' | 'note'), tag, key, ttl, priority }. */
  push(n) {
    const item = this.queue.push(n, now());
    this.renderSoon();
    return item;
  }

  /** Draw on the next frame, once, however many notes came in this tick: each
   *  draw measures the page (place), and a tick that pushed several (a big
   *  batch opening unlocks, a boss kill) forced a layout for every one. */
  renderSoon() {
    if (typeof requestAnimationFrame !== 'function') { this.render(); return; }
    if (this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => { this._renderQueued = false; this.render(); });
  }

  has(kind) { return this.queue.has(kind); }
  dismiss(id) { if (this.queue.dismiss(id, now())) this.render(); }
  dismissTag(tag) { if (this.queue.dismissTag(tag, now())) this.render(); }
  dismissKind(kind) { if (this.queue.dismissKind(kind, now())) this.render(); }

  _root() {
    if (this.el || typeof document === 'undefined' || !document.body) return this.el;
    const el = document.createElement('div');
    el.id = 'notice-lane';
    el.setAttribute('aria-live', 'polite');
    // A tap on a card puts it away; the tip's own buttons do their own thing.
    el.addEventListener('click', (e) => {
      if (e.target.closest?.('.nl-more')) {   // "+N": open or fold the waiting list
        this.listOpen = !this.listOpen; this._listAt = now(); this._sig = ''; this.render();
        return;
      }
      const card = e.target.closest?.('.nl-card');
      if (!card) return;
      const act = e.target.closest?.('[data-act]')?.dataset.act;
      if (act === 'notips') this.ui.tipsOff?.();
      else if (act) this.ui.noticeAct?.(act);   // a note's own button ("Wear it": whatnextui.js)
      this.dismiss(Number(card.dataset.id));
    });
    (document.getElementById('game-root') || document.body).appendChild(el);
    this.el = el;
    return el;
  }

  render() {
    clearTimeout(this._timer);
    this._timer = 0;
    const t = now();
    this.queue.tick(t);
    const el = this._root();
    if (!el) return;
    const shown = this.queue.visible();
    const queued = this.queue.queued();
    const waiting = queued.length;
    for (const x of shown) x.ttl = laneTtl(x, waiting);   // take turns while others wait
    if (!waiting || t - this._listAt > LANE_LIST_MS) this.listOpen = false;
    const sig = shown.map((x) => `${x.id}:${x.count}:${x.html.length}`).join('|') + `#${queued.map((x) => x.id).join(',')}${this.listOpen ? '+' : ''}`;
    if (sig !== this._sig) {
      this._sig = sig;
      const was = new Map([...el.querySelectorAll(':scope > .nl-card:not(.nl-leaving)')].map((c) => [c.dataset.id, c]));
      el.innerHTML = shown.map((x) => cardHTML(x, waiting)).join('')
        + (this.listOpen ? `<div class="nl-list">${queued.map((x) => cardHTML(x, 0, true)).join('')}</div>` : '');
      this._settle(el, was);
    }
    el.classList.toggle('listing', this.listOpen);
    el.classList.toggle('empty', !shown.length);
    this.placeSoon();   // measured once the browser has laid out these changes (still before it paints)
    let next = this.queue.nextExpiry();
    if (this.listOpen) next = Math.min(next ?? Infinity, this._listAt + LANE_LIST_MS + 10);
    if (next === Infinity) next = null;
    if (next != null && typeof setTimeout === 'function') this._timer = setTimeout(() => this.render(), Math.max(50, next - t + 20));
  }

  /** After a redraw: a card that was already up stays still (only a new
   *  count gives a hop) rather than dropping in again, and one that went
   *  fades up and away where it stood while the next settles in. */
  _settle(el, was) {
    if (motionOff(this.ui?.game)) return;
    for (const c of el.querySelectorAll(':scope > .nl-card')) {
      const old = was.get(c.dataset.id);
      if (!old) continue;
      was.delete(c.dataset.id);
      c.classList.add('nl-kept');
      const n = c.querySelector('.nl-count');
      if (n && n.textContent !== old.querySelector('.nl-count')?.textContent) bump(n, 'ui-bump-big', this.ui?.game);
    }
    for (const old of was.values()) {
      old.classList.add('nl-leaving');
      old.setAttribute('aria-hidden', 'true');
      el.appendChild(old);
      const done = () => old.remove();
      old.addEventListener('animationend', done, { once: true });
      setTimeout(done, 400);
    }
  }

  /** Each tick: place() once the browser has laid the page out, not mid-tick.
   *  Measuring the strip straight after the frame's other DOM changes forced a
   *  layout of the whole page just for these few boxes (even at the start of
   *  the next frame: the HUD's queued redraws run first). A ResizeObserver
   *  answers after the browser's own layout, when reading them is nearly free,
   *  and before that frame is painted, so the lane still moves in time. */
  placeSoon() {
    if (this._placeQueued) return;
    if (afterLayout(() => { this._placeQueued = false; this.place(); })) { this._placeQueued = true; return; }
    if (typeof requestAnimationFrame !== 'function') { this.place(); return; }
    this._placeQueued = true;
    requestAnimationFrame(() => { this._placeQueued = false; this.place(); });
  }

  /** Keep the lane in its spot as the strip above it changes. */
  place() {
    const el = this.el;
    if (!el || !this.queue.items.length || typeof window === 'undefined') return;
    const at = placeLane(liveBoxes(), window.innerWidth, laneMode());
    const key = `${at.top}|${at.left}|${at.width}`;
    if (el._at === key) return;
    el._at = key;
    el.style.top = `${at.top}px`;
    el.style.left = `${at.left}px`;
    el.style.width = `${at.width}px`;
  }
}

const ACT_BUTTON = /<button[^>]*class="[^"]*\bnl-act\b[^"]*"[^>]*>[\s\S]*?<\/button>/g;

export function cardHTML(x, waiting = 0, mini = false) {
  const n = x.count > 1 ? `<span class="nl-count">&times;${x.count}</span>` : '';
  // The "+N" button rides on the showing card's line, so the lane stays one line tall.
  const more = waiting ? `<button type="button" class="nl-more" aria-label="${waiting} more notices">+${waiting}</button>` : '';
  if (mini) return `<div class="nl-card nl-mini nl-${x.kind}" data-id="${x.id}" role="status"><div class="nl-text">${x.html}</div>${n}</div>`;
  if (x.kind === 'tip') {
    return `<div class="nl-card nl-tip" data-id="${x.id}" role="status"><span class="nl-ic" aria-hidden="true">&#128161;</span>`
      + `<div class="nl-text">${x.html}</div>`
      + '<button type="button" class="nl-notips" data-act="notips">Don\'t show tips</button>'
      + `${more}<button type="button" class="nl-x close-x" aria-label="Dismiss">${glyphArtHTML('ui-close', '&#10005;', 26, 'x-art')}</button></div>`;
  }
  // A note's own button ("Wear it") sits outside the words, so it stays in
  // view when the words are cut to one line.
  const acts = [];
  const words = x.html.replace(ACT_BUTTON, (b) => { acts.push(b); return ''; });
  return `<div class="nl-card nl-${x.kind}" data-id="${x.id}" role="status"><div class="nl-text">${words}</div>${acts.join('')}${n}${more}</div>`;
}

/** Which layout the lane follows: 'phone' (narrow, upright), 'flat' (a phone
 *  on its side) or 'desk'. */
export function laneMode() {
  if (typeof window === 'undefined') return 'desk';
  const flat = typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (max-height: 500px) and (orientation: landscape)').matches;
  if (flat) return 'flat';
  if (window.innerWidth <= 600) return 'phone';
  return 'desk';
}

const IDS = ['region-label', 'quest-tracker', 'boss-bar', 'wave-hud', 'minimap-panel', 'minimap-dock',
  'hp-bar', 'sidepanel', 'quickbar', 'combat-resources', 'adrenaline', 'xp-hud'];

/** The on-screen boxes the lane steers round, by id (missing when hidden). */
function liveBoxes() {
  const out = {};
  for (const id of IDS) {
    const e = document.getElementById(id);
    if (!e || e.classList.contains('hidden') || e.classList.contains('idle')) continue;
    const r = e.getBoundingClientRect();
    if (r.width && r.height) out[id] = r;
  }
  return out;
}

/** Where the lane goes: { top, left, width } in px. Pure, for the tests.
 *  `b` maps element ids to their boxes ({ left, top, right, bottom, width, height }). */
export function placeLane(b, vw, mode) {
  const map = b['minimap-panel'], dock = b['minimap-dock'];
  const mm = map && dock ? {
    left: Math.min(map.left, dock.left),
    right: Math.max(map.right, dock.right),
    bottom: Math.max(map.bottom, dock.bottom),
  } : map || dock;
  const bag = b.sidepanel?.width < 100 ? b.sidepanel : null;
  const rightStrip = [bag, b.quickbar, b['combat-resources'], b.adrenaline, b['xp-hud'], b['region-label']];
  const below = (top, left, width) => {
    // The boss bar and the Endless Gate panel can share the column (and on a
    // phone your life bar tops it): go under them.
    for (const id of ['hp-bar', 'boss-bar', 'wave-hud', 'quest-tracker']) {
      const r = b[id];
      if (r && r.left < left + width && r.right > left && r.top < top + 40) top = Math.max(top, r.bottom + 6);
    }
    return top;
  };
  let top, left, width;
  if (mode === 'phone') {
    // Top-left, under the objectives (and the boss bar / gate panel above them),
    // as wide as the gap left of the minimap.
    left = b['quest-tracker']?.left ?? b['boss-bar']?.left ?? 6;
    width = (mm ? mm.left - 6 : vw - 6) - left;
    top = below(6, left, width);
    const clearRight = () => {
      for (const r of rightStrip) {
        if (r && r.left > vw * 0.44 && r.bottom > top && r.top < top + 145) {
          width = Math.min(width, r.left - 6 - left);
        }
      }
    };
    clearRight();
    if (width < 200) {
      // Borrow the space under a wider map footer while keeping the launcher
      // and quick items available. On the narrowest phones the lane can use
      // the original column when all the available space is to its left.
      const column = { left, top, width };
      left = 6; width = vw - 12;
      top = Math.max(top, mm ? mm.bottom + 6 : 0);
      clearRight();
      if (column.width >= width) ({ left, top, width } = column);
    }
  } else if (mode === 'flat') {
    // A phone on its side: right of the strip (objectives, boss bar, gate
    // panel), left of the Bag launcher and the minimap.
    let lo = 6, hi = vw - 6;
    top = Infinity;
    for (const id of ['quest-tracker', 'boss-bar', 'wave-hud']) {
      const r = b[id];
      if (r && r.left < vw / 2) { lo = Math.max(lo, r.right + 8); top = Math.min(top, r.top); }
    }
    if (mm && mm.left > vw / 2) hi = Math.min(hi, mm.left - 8);
    if (top === Infinity) top = 6;
    left = lo;
    width = Math.min(340, hi - lo);
    for (const r of rightStrip) {
      if (!r || r.right <= lo || r.left >= hi || r.bottom <= top || r.top >= top + 110) continue;
      if (r.left - 8 - lo >= 220) width = Math.min(width, r.left - 8 - lo);
      else top = Math.max(top, r.bottom + 6);
    }
    width = Math.max(120, width);
  } else {
    // Desktop and tablets: centred under the region name.
    width = Math.min(360, vw - 20);
    left = (vw - width) / 2;
    const rl = b['region-label'];
    // Keep the notice's entrance and exit motion clear of both caption lines.
    top = below(rl ? rl.bottom + 10 : 44, left, width);
    // A side panel made wider or taller (panelsize.js) can reach in under the
    // lane's right end: the lane stops short of it (a few cards run ~250px down).
    const panel = b.sidepanel;
    if (panel && panel.width >= 100 && panel.left < left + width + 8 && panel.top < top + 260) {
      width = Math.max(200, Math.min(width, panel.left - 8 - left));
    }
  }
  return { top: Math.round(top), left: Math.round(left), width: Math.round(width) };
}
