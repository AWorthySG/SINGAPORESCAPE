// Windows that remember where you were, and close without hunting for the ✕.
//
// Every big window (bank, shops, shrine, Codex, guides, gear windows...) is the
// one shared modal in ui.js (openModal / closeModal), so this works in one place:
//
// - WindowMemory: each window's scroll position (in memory, per window title)
//   and the side panel's scroll per view; and the light choices worth keeping
//   across a reload (the bank search, the Codex section and filters, the
//   encyclopedia's filters, the map markers, the shrine and salvage filters,
//   the Gear Guide's slot, the Perks tab, the side panel's tab). Those go in
//   the save as `game.uiMemory`, which is optional: older saves have none.
//   The windows keep their own state objects on the UI (ui._codex and so on);
//   this only copies them into the save and back.
// - Tapping the dim space outside a window closes it (Settings can turn that
//   off). The same press then works the game: over the world (or the
//   joystick) it takes the joystick, which floats to the finger, so dragging
//   walks off at once, and it reaches the game as a tap. A window never has to
//   be closed first to move. Windows that must be answered (dialogue, choices,
//   confirmations, a half-typed amount) stay open; so does one tapped on a
//   HUD control showing through the backdrop.
// - Esc closes the top-most thing only: a menu, then a touch card, then the window.
// - On touch screens, a swipe down on the window's title closes it. (Phones
//   in the sheet layout already have this in ui.js _initSheets; this covers
//   tablets and the rest.)
import { defaultCodexState } from './codexui.js';
import { defaultCompendiumState } from './compendiumui.js';
import { encyState } from './encyclopediaui.js';
import { PANEL_TABS } from './ui.js';

/** A tap this soon after a window opened is the end of the tap that opened it. */
export const OPEN_GRACE_MS = 350;
/** How far a swipe down the title must travel to close the window. */
export const SWIPE_CLOSE_PX = 60;

// Windows that wait for an answer: an outside tap leaves them open (Esc and ✕ still work).
const MUST_ANSWER = new Set(['dialogue', 'classpick', 'saveImport', 'saveReplaced', 'study', 'hawker', 'waveGate', 'gateFallen']);

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** The plain values of `src` under `keys` (short strings, numbers, booleans,
 *  null): a save's copy is checked the same way before it is used. */
function pick(src, keys) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (const k of keys) {
    const v = src[k];
    if (v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 80)) out[k] = v;
  }
  return out;
}
const CODEX_KEYS = ['view', 'search', 'region', 'race', 'type', 'disc', 'sort', 'minLevel', 'maxLevel'];
const ENCY_ITEM_KEYS = ['search', 'cat', 'disc'];
const SALVAGE_KEYS = ['offClass', 'belowTier', 'below'];

// Each remembered window: how to copy its choices out of the UI, and back in.
const HOLDERS = {
  bank: {
    get: (ui) => (ui._bankSearch ? { search: ui._bankSearch } : null),
    set: (ui, v) => { if (typeof v.search === 'string') ui._bankSearch = v.search.slice(0, 80); },
  },
  codex: {
    get: (ui) => (ui._codex ? pick(ui._codex, CODEX_KEYS) : null),
    set: (ui, v) => { Object.assign(ui._codex || (ui._codex = defaultCodexState()), pick(v, CODEX_KEYS)); },
  },
  compendium: {
    get: (ui) => (ui._compendium?.query ? pick(ui._compendium, ['query']) : null),
    set: (ui, v) => { Object.assign(ui._compendium || (ui._compendium = defaultCompendiumState()), pick(v, ['query'])); },
  },
  ency: {
    get: (ui) => (ui._ency ? { items: pick(ui._ency.items, ENCY_ITEM_KEYS), search: pick(ui._ency.search, ['query']) } : null),
    set: (ui, v) => { const s = encyState(ui); Object.assign(s.items, pick(v.items, ENCY_ITEM_KEYS)); Object.assign(s.search, pick(v.search, ['query'])); },
  },
  map: {
    get: (ui) => (ui._mapFilters ? [...ui._mapFilters] : null),
    set: (ui, v) => { if (Array.isArray(v)) ui._mapFilters = new Set(v.filter((x) => typeof x === 'string')); },
  },
  salvage: {
    get: (ui) => (ui._salvageFilters ? pick(ui._salvageFilters, SALVAGE_KEYS) : null),
    // Only a whole set of filters (salvageui.js makes the defaults when there is none).
    set: (ui, v) => { const f = pick(v, SALVAGE_KEYS); if (Object.keys(f).length === SALVAGE_KEYS.length) ui._salvageFilters = f; },
  },
  shrineGoods: {
    get: (ui) => (ui._shrineGoodsFilter ? pick(ui._shrineGoodsFilter, ['keep']) : null),
    set: (ui, v) => { if (typeof v.keep === 'number') ui._shrineGoodsFilter = { keep: v.keep }; },
  },
  gearGuide: {
    get: (ui) => (ui._gearGuide ? pick(ui._gearGuide, ['slot', 'style']) : null),
    set: (ui, v) => { ui._gearGuide = pick(v, ['slot', 'style']); },
  },
  perks: {
    get: (ui) => (ui._perksTab ? { tab: ui._perksTab } : null),
    set: (ui, v) => { if (typeof v.tab === 'string') ui._perksTab = v.tab; },
  },
};

/** The light, saveable part of the windows' memory, as a plain object. */
export function snapshotUiMemory(ui, panelTab = null) {
  const win = {};
  for (const [k, h] of Object.entries(HOLDERS)) {
    const v = h.get(ui);
    if (v) win[k] = v;
  }
  const out = { win };
  if (panelTab) out.panelTab = panelTab;
  return out;
}

/** Put a save's window memory back on the UI. Anything odd in it is skipped. */
export function applyUiMemory(ui, mem) {
  if (!mem || typeof mem !== 'object') return;
  const win = mem.win && typeof mem.win === 'object' ? mem.win : {};
  for (const [k, h] of Object.entries(HOLDERS)) {
    if (win[k] && typeof win[k] === 'object') { try { h.set(ui, win[k]); } catch { /* skip a bad entry */ } }
  }
}

export class WindowMemory {
  constructor(ui) {
    this.ui = ui;
    this.scroll = new Map();        // window title -> scrollTop (this session only)
    this.panelScroll = new Map();   // side panel view -> scrollTop
    this.panelTab = null;
    this.panelView = null;
    this.openedAt = -1e9;
    this._applied = undefined;      // the game.uiMemory last put back on the UI
    ui.bus?.on?.('tick', () => this.recall());
  }

  /** A save loads after the UI is built: put its memory back once it's there
   *  (an identity check, so it's cheap to call every tick). */
  recall() {
    const g = this.ui.game;
    const m = g?.uiMemory;
    if (m === this._applied) return;
    this._applied = m;
    applyUiMemory(this.ui, m);
    if (m && PANEL_TABS[m.panelTab] && m.panelTab !== this.panelTab) this._showPanelTab(m.panelTab);
  }

  /** Copy the current choices into game.uiMemory, ready for the next save. */
  store() {
    const g = this.ui.game;
    if (!g) return;
    this.recall();   // never overwrite a save's memory before it's been read
    g.uiMemory = snapshotUiMemory(this.ui, this.panelTab);
    this._applied = g.uiMemory;
  }

  /** The open window is about to go (closed, or replaced by another): note its scroll. */
  leave() {
    const { modal, el } = this.ui;
    if (modal && el?.modalBody) this.scroll.set(modal.title, el.modalBody.scrollTop || 0);
  }

  /** A window has just been drawn: back to where it was last time. */
  enter() {
    const { modal, el } = this.ui;
    this.openedAt = now();
    const top = modal && this.scroll.get(modal.title);
    if (top && el?.modalBody) el.modalBody.scrollTop = top;
  }

  closed() { this.store(); }

  /** The side panel switched view: keep each view's own scroll, and its tab. */
  panelShown(tab, view) {
    const body = typeof document !== 'undefined' ? document.getElementById('panel-body') : null;
    if (body && this.panelView !== view) {
      if (this.panelView) this.panelScroll.set(this.panelView, body.scrollTop || 0);
      body.scrollTop = this.panelScroll.get(view) || 0;
    }
    this.panelView = view;
    if (this.panelTab !== tab) { this.panelTab = tab; this.store(); }
  }

  /** Light a tab and show its last view, without unfolding a folded panel. */
  _showPanelTab(tab) {
    const ui = this.ui;
    if (typeof document === 'undefined' || typeof ui._showPanelView !== 'function') return;
    document.querySelectorAll('#panel-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === tab));
    const views = PANEL_TABS[tab];
    ui._showPanelView(views.includes(ui._subView?.[tab]) ? ui._subView[tab] : views[0]);
  }
}

/** Whether a tap outside the open window may close it: not one waiting for an
 *  answer, a confirmation on show, or while something is being typed in it. */
export function tapCloses(ui) {
  const m = ui.modal;
  if (!m || m.locked || m.noTapClose || MUST_ANSWER.has(m.kind)) return false;
  const body = ui.el?.modalBody;
  if (body?.querySelector?.('.salvage-confirm, .dialogue-options')) return false;
  return true;
}

/** What a tap on the dim space around the window does:
 *  'none' (leave it), 'blur' (put away the keyboard first), 'close',
 *  'walk' (close, and the press goes on to the game world and the joystick) or
 *  'steer' (close, and the press goes on to the joystick under it).
 *  `under`: 'world' (the game canvas), 'stick' (the joystick), 'hud' (any
 *  other HUD control) or 'empty'. */
export function outsideTapAction(ui, under, t = now()) {
  if (!ui.modal || ui.game?.tapClose === false) return 'none';
  if (t - (ui.winMem?.openedAt ?? -1e9) < OPEN_GRACE_MS) return 'none';
  if (!tapCloses(ui)) return 'none';
  // A half-typed amount or search: the first tap just puts the keyboard away.
  const a = typeof document !== 'undefined' ? document.activeElement : null;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && ui.el?.modalBody?.contains?.(a)) return 'blur';
  if (under === 'hud') return 'none';
  return under === 'world' ? 'walk' : under === 'stick' ? 'steer' : 'close';
}

/** Esc: close the top-most thing, and only that. Returns what it closed. */
export function closeTopWindow(ui) {
  if (ui.cmdSearch?.isOpen?.()) { ui.cmdSearch.close(); return 'search'; }   // the search box sits above everything (cmdsearch.js)
  const menu = ui.el?.contextMenu;
  if (menu && !menu.classList.contains('hidden')) { ui.hideContextMenu(); return 'menu'; }
  if (ui._cardOpen) { ui.closeTouchCard(); return 'card'; }
  if (ui.modal && !ui.modal.locked) { ui.closeModal(); return 'window'; }
  return null;
}

/** Whether a finger's drag on the title is a swipe down to close. */
export function swipeCloses(dx, dy) {
  return dy >= SWIPE_CLOSE_PX && dy > Math.abs(dx) * 1.5;
}

/** Settings > "Tap outside a window to close it": flip it; returns the button's label. */
export function toggleTapClose(game) {
  game.tapClose = game.tapClose === false;
  game.saveSoon = true;
  return tapCloseLabel(game);
}
export function tapCloseLabel(game) {
  return `Tap outside a window to close it: ${game.tapClose === false ? 'Off' : 'On'}`;
}

/** Wire the outside tap and the title swipe (the browser only). */
export function initWindowEase(ui) {
  if (typeof document === 'undefined') return;
  const overlay = ui.el.modalOverlay;
  if (overlay) {
    // What lies under the dim backdrop at a point: the game, the joystick,
    // another HUD control, or nothing. Anything else over the game there (a
    // button, a notice, the story scene's stage) counts as HUD: left alone.
    const below = (x, y) => (document.elementsFromPoint?.(x, y) || []).find((el) => !overlay.contains(el));
    const under = (el) => {
      if (!el || el === document.body || el === document.documentElement || el.id === 'game-root') return 'empty';
      if (el.id === 'game-canvas') return 'world';
      return el.closest?.('#joystick') ? 'stick' : 'hud';
    };
    // pointerdown, not click: the window goes before the finger lifts, and the
    // browser's follow-up mouse events land on the hidden backdrop, not the game.
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target !== overlay || e.button > 0) return;
      const el = below(e.clientX, e.clientY);
      const act = outsideTapAction(ui, under(el));
      if (act === 'blur') { document.activeElement?.blur?.(); return; }
      if (act === 'none') return;
      ui.closeModal();
      if (ui.modal) return;
      if (act === 'walk') ui.onWorldTap?.(e.clientX, e.clientY);
      // The same finger takes the stick (movepad.js listens for its pointerdown;
      // the stick floats to wherever it lands). Not where it's hidden (a mouse).
      const stick = document.getElementById('joystick');
      if (act !== 'close' && stick?.getClientRects().length && typeof PointerEvent === 'function') {
        e.preventDefault();
        stick.dispatchEvent(new PointerEvent('pointerdown', {
          pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary,
          clientX: e.clientX, clientY: e.clientY, button: 0, buttons: 1, bubbles: true, cancelable: true,
        }));
      }
    });
  }
  // Swipe down on the title (touch only; the phone sheet layout has its own).
  const title = ui.el.modalTitle, win = document.getElementById('modal-window');
  if (!title || !win) return;
  const sheet = typeof matchMedia === 'function'
    ? matchMedia('(pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px)') : { matches: false };
  let start = null;
  title.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || sheet.matches || !ui.modal) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    title.setPointerCapture?.(e.pointerId);
  });
  title.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    win.style.transform = `translateY(${Math.max(0, e.clientY - start.y)}px)`;
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    win.style.transform = '';
    if (e.type === 'pointerup' && swipeCloses(dx, dy)) ui.closeModal();
  };
  title.addEventListener('pointerup', end);
  title.addEventListener('pointercancel', end);
}
