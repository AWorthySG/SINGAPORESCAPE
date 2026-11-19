// The notification lane: one place for every short note (banners, first-time
// tips, world events, rare drops), so they never stack over the middle of the
// screen. On a desktop it hangs under the region name at the top centre; on a
// phone it sits top-left under the objectives, beside the minimap. The queue
// itself is in notices.js; this draws it. Headless (the tests) it keeps the
// queue and draws nothing.
import { NoticeQueue } from './notices.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class NoticeLane {
  constructor(ui) {
    this.ui = ui;
    this.queue = new NoticeQueue();
    this.el = null;
    this._timer = 0;
    this._sig = '';
  }

  /** Show a note. `n`: { html, kind ('banner' | 'tip' | 'note'), tag, key, ttl, priority }. */
  push(n) {
    const item = this.queue.push(n, now());
    this.render();
    return item;
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
      const card = e.target.closest?.('.nl-card');
      if (!card) return;
      const act = e.target.closest?.('[data-act]')?.dataset.act;
      if (act === 'notips') this.ui.tipsOff?.();
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
    const waiting = this.queue.queued().length;
    const sig = shown.map((x) => `${x.id}:${x.count}:${x.html.length}`).join('|') + `#${waiting}`;
    if (sig !== this._sig) {
      this._sig = sig;
      el.innerHTML = shown.map((x) => cardHTML(x)).join('')
        + (waiting ? `<div class="nl-more">+${waiting} more</div>` : '');
    }
    el.classList.toggle('empty', !shown.length);
    this.place();
    const next = this.queue.nextExpiry();
    if (next != null && typeof setTimeout === 'function') this._timer = setTimeout(() => this.render(), Math.max(50, next - t + 20));
  }

  /** Keep the lane in its spot as the strip above it changes (called each tick). */
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

function cardHTML(x) {
  const n = x.count > 1 ? `<span class="nl-count">&times;${x.count}</span>` : '';
  if (x.kind === 'tip') {
    return `<div class="nl-card nl-tip" data-id="${x.id}" role="status"><span class="nl-ic" aria-hidden="true">&#128161;</span>`
      + `<div class="nl-text">${x.html}</div>`
      + '<button type="button" class="nl-notips" data-act="notips">Don\'t show tips</button>'
      + '<button type="button" class="nl-x" aria-label="Dismiss">&#10005;</button></div>';
  }
  return `<div class="nl-card nl-${x.kind}" data-id="${x.id}" role="status"><div class="nl-text">${x.html}</div>${n}</div>`;
}

/** Which layout the lane follows: 'phone' (narrow, upright), 'flat' (a phone
 *  on its side) or 'desk'. */
export function laneMode() {
  if (typeof window === 'undefined') return 'desk';
  if (window.innerWidth <= 600) return 'phone';
  const flat = typeof matchMedia === 'function' && matchMedia('(pointer: coarse) and (max-height: 500px)').matches;
  return flat ? 'flat' : 'desk';
}

const IDS = ['region-label', 'quest-tracker', 'boss-bar', 'wave-hud', 'minimap-panel', 'hp-orb', 'spec-orb', 'prayer-orb', 'sidepanel'];

/** The on-screen boxes the lane steers round, by id (missing when hidden). */
function liveBoxes() {
  const out = {};
  for (const id of IDS) {
    const e = document.getElementById(id);
    if (!e || e.classList.contains('hidden') || !e.offsetParent) continue;
    const r = e.getBoundingClientRect();
    if (r.width && r.height) out[id] = r;
  }
  out.caps = [...document.querySelectorAll('#minimap-panel .orb-cap')].map((e) => e.getBoundingClientRect()).filter((r) => r.width);
  return out;
}

/** Where the lane goes: { top, left, width } in px. Pure, for the tests.
 *  `b` maps element ids to their boxes ({ left, top, right, bottom, width, height }). */
export function placeLane(b, vw, mode) {
  const below = (top, left, width) => {
    // The boss bar and the Endless Gate panel can share the column: go under them.
    for (const id of ['boss-bar', 'wave-hud', 'quest-tracker']) {
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
    const mm = b['minimap-panel'];
    width = (mm ? mm.left - 6 : vw - 6) - left;
    top = below(6, left, width);
    if (width < 200) {
      // A very narrow screen: a strip right across, under the minimap and its orbs.
      left = 6; width = vw - 12;
      top = Math.max(top, mm ? mm.bottom + 6 : 0, b['hp-orb'] ? b['hp-orb'].bottom + 14 : 0);
      const dock = b.sidepanel;
      if (dock && dock.width < 100 && dock.bottom > top && dock.left > left) width = Math.min(width, dock.left - 6 - left);
    }
  } else if (mode === 'flat') {
    // A phone on its side: right of the strip (objectives, boss bar, gate
    // panel), left of the Bag launcher, the orbs and the minimap.
    let lo = 6, hi = vw - 6;
    top = Infinity;
    for (const id of ['quest-tracker', 'boss-bar', 'wave-hud']) {
      const r = b[id];
      if (r && r.left < vw / 2) { lo = Math.max(lo, r.right + 8); top = Math.min(top, r.top); }
    }
    for (const r of [b['minimap-panel'], b['spec-orb'], b['prayer-orb'], b['hp-orb'], ...(b.caps || [])]) {
      if (r && r.left > vw / 2) hi = Math.min(hi, r.left - 8);
    }
    if (top === Infinity) top = 6;
    left = lo;
    width = Math.min(340, hi - lo);
    const bag = b.sidepanel;
    if (bag && bag.width < 100 && bag.right > lo && bag.left < hi) {
      if (bag.left - 8 - lo >= 220) width = Math.min(width, bag.left - 8 - lo);
      else top = Math.max(top, bag.bottom + 6);
    }
    width = Math.max(120, width);
  } else {
    // Desktop and tablets: centred under the region name.
    width = Math.min(360, vw - 20);
    left = (vw - width) / 2;
    const rl = b['region-label'];
    top = below(rl ? rl.bottom + 6 : 44, left, width);
  }
  return { top: Math.round(top), left: Math.round(left), width: Math.round(width) };
}
