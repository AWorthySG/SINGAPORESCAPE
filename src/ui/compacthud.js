// The compact HUD: small bits of state that let styles/compact.css keep the
// screen clear without losing anything.
//  - The Auto button (every screen now, not just phones) names what is on:
//    "Auto", "Battle", "Battle + Quest", and "Grave" while a gravestone waits.
//  - The chat goes quiet a few seconds after its last non-combat line: on a
//    mouse it folds to one line showing that message; hover brings it back.
//  - The area name at the top centre shows on arrival, then gives way to the
//    minimap's own caption (it stays while the minimap is folded).
//  - The objectives doze on every screen: with nothing new on them for a while
//    they fold to a small "Objectives" chip; a new goal, a tap or (with a
//    mouse) hovering over the chip wakes them.
//  - #game-root.calm: out of combat, so an empty adrenaline bar can hide.
// The rules are pure functions below (tested headlessly); the class only
// toggles classes and text, once a tick, and does nothing headless.

export const CHAT_QUIET_MS = 9000;     // a chat with nothing new for this long folds to one line (mouse only)
export const REGION_SHOW_MS = 6000;    // the top-centre area name shows this long after you arrive
export const TRACKER_DOZE_MS = 15000;  // objectives with no news for this long fold to a chip

/** The Auto button's caption: what's switched on, or "Auto" when nothing is.
 *  A waiting gravestone is added, as its button lives in the folded card. */
export function autoLabel({ battle = false, gather = false, quest = false, grave = false } = {}) {
  const on = [battle && 'Battle', gather && 'Gather', quest && 'Quest'].filter(Boolean);
  let text = on.length === 0 ? 'Auto' : on.length === 3 ? 'Auto: all' : on.join(' + ');
  if (grave) text += ' · Grave';
  return text;
}

/** True when the chat should fold to its one-line peek. */
export function chatQuiet({ now, lastAt, hovered = false, focused = false }) {
  if (hovered || focused) return false;
  return now - (lastAt || 0) >= CHAT_QUIET_MS;
}

/** Whether the top-centre area name shows: just after it changed, or always
 *  while the minimap (whose caption names the area too) is folded. */
export function regionShown({ now, changedAt, minimapFolded = false }) {
  return minimapFolded || now - (changedAt ?? -Infinity) < REGION_SHOW_MS;
}

/** What counts as news on the tracker: its words without any numbers. Distances
 *  change with every step ("42m"), and counts like a kill streak or "3/11"
 *  with every kill, so only a new or different goal wakes it. */
export function trackerSig(text) {
  return String(text || '').replace(/[×x]?\d[\d.,:\/%+]*\s?(?:km|m|s)?/g, '').replace(/\s+/g, ' ').trim();
}

/** True when the tracker should fold to its chip. */
export function trackerDozing({ now, changedAt, wokeAt = -Infinity }) {
  return now - Math.max(changedAt ?? -Infinity, wokeAt) >= TRACKER_DOZE_MS;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class CompactHud {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this._chatAt = now();
    this._region = null;
    this._regionAt = -Infinity;
    this._label = '';
    this._trkSig = null;
    this._trkAt = now();
    this._trkWoke = -Infinity;
    this.game.bus.on('chat', (p) => this.onChat(p || {}));
    this.game.bus.on('tick', () => this.tick());
    for (const ev of ['autobattle', 'autogather', 'autoquest']) this.game.bus.on(ev, () => this.tick());
  }

  onChat({ text, cls }) {
    // Hits and misses stream all fight long; only other news wakes the chat.
    if (cls === 'combat') return;
    this._chatAt = now();
    if (text) this._peekText = text;
    // A kill brings a burst of lines (loot, XP, a level): the peek shows the
    // last of them and the HUD is checked once, at the end of the burst.
    const show = () => {
      const peek = this._peek();
      if (peek && this._peekText) { peek.textContent = this._peekText; peek.title = this._peekText; }
      this._peekText = '';
      this.tick();
    };
    if (this.ui._coalesce) this.ui._coalesce('chatpeek', show); else show();
  }

  _peek() {
    if (this._peekEl || typeof document === 'undefined') return this._peekEl;
    const head = document.getElementById('chat-head');
    if (!head) return null;
    const el = document.createElement('span');
    el.id = 'chat-peek';
    el.setAttribute('aria-hidden', 'true');   // the log itself is what screen readers read
    head.querySelector('#chat-title')?.after(el);
    this._peekEl = el;
    return el;
  }

  /** A tap on the dozing chip wakes the tracker (rather than folding it for good). */
  _wireTracker() {
    const el = document.getElementById('quest-tracker');
    el?.addEventListener('click', (e) => {
      if (!el.classList.contains('dozing')) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this._trkWoke = now();
      el.classList.remove('dozing');
    }, true);
    return el;
  }

  tick() {
    if (typeof document === 'undefined') return;
    const g = this.game, t = now();
    const root = this._root || (this._root = document.getElementById('game-root'));
    if (!root) return;
    // Out of a fight: an empty adrenaline bar has nothing to say.
    const fighting = typeof g._inCombat === 'function' ? g._inCombat() : !!g.cine?.inFight;
    root.classList.toggle('calm', !fighting);
    root.classList.toggle('adr-empty', !(g.adrenaline > 0));

    const btn = this._auto || (this._auto = document.getElementById('auto-menu-btn'));
    if (btn) {
      const label = autoLabel({ battle: !!g.autoBattle, gather: !!g.autoGather, quest: !!g.autoQuest, grave: !!g.play?.grave });
      if (label !== this._label) {
        this._label = label;
        btn.innerHTML = `<span class="am-dot" aria-hidden="true"></span><span class="am-text">${label}</span>`;
        btn.classList.toggle('grave', !!g.play?.grave);
      }
    }

    const chat = this._chat || (this._chat = document.getElementById('chatbox'));
    if (chat) {
      const quiet = chatQuiet({ now: t, lastAt: this._chatAt, hovered: chat.matches?.(':hover'), focused: chat.matches?.(':focus-within') });
      chat.classList.toggle('quiet', quiet);
      this._peek();
    }

    const trk = this._trk || (this._trk = this._wireTracker());
    if (trk) {
      const sig = trackerSig(trk.textContent);
      if (sig !== this._trkSig) { this._trkSig = sig; this._trkAt = t; }
      if (trk.matches?.(':hover')) this._trkWoke = t;   // a mouse resting on it keeps it open
      trk.classList.toggle('dozing', !trk.classList.contains('folded') && trackerDozing({ now: t, changedAt: this._trkAt, wokeAt: this._trkWoke }));
    }

    const region = this._regionEl || (this._regionEl = document.getElementById('region-label'));
    if (region) {
      const name = region.textContent;
      if (name !== this._region) { this._region = name; this._regionAt = t; }
      const folded = !!document.getElementById('minimap-panel')?.classList.contains('collapsed');
      region.classList.toggle('fresh', regionShown({ now: t, changedAt: this._regionAt, minimapFolded: folded }));
    }
  }
}
