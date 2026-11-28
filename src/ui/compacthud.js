// Small readouts that change with play: the Auto modes, the folded log's
// latest loot, the arrival caption, and whether an empty adrenaline bar can
// hide. The full log only opens when asked. Background chat is still recorded
// there, but it never opens the log or replaces the loot preview.

export const LOOT_PEEK_MS = 6000;
export const REGION_SHOW_MS = 6000;    // the top-centre area name shows this long after you arrive

/** The Auto button's caption: what's switched on, or "Auto" when nothing is.
 *  A waiting gravestone is added, as its button lives in the folded card. */
export function autoLabel({ battle = false, gather = false, quest = false, grave = false } = {}) {
  const on = [battle && 'Battle', gather && 'Gather', quest && 'Quest'].filter(Boolean);
  let text = on.length === 0 ? 'Auto' : on.length === 1 ? `Auto ${on[0]}` : on.length === 3 ? 'Auto: all' : on.join(' + ');
  if (grave) text += ' · Grave';
  return text;
}

/** A short excerpt of the game's pickup and named drop messages. */
export function lootExcerpt(text, cls) {
  if (cls === 'combat' || typeof text !== 'string') return '';
  const small = text.match(/^You (?:loot: |pick up )(.+)\.$/);
  if (small) return `Loot · ${small[1]}`;
  return /^(?:A rare drop!|Signature drop!|Tool drop!|Boss trophy!) /.test(text) ? text : '';
}

/** Whether the top-centre area name shows: just after it changed, or always
 *  while the minimap (whose caption names the area too) is folded. */
export function regionShown({ now, changedAt, minimapFolded = false }) {
  return minimapFolded || now - (changedAt ?? -Infinity) < REGION_SHOW_MS;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class CompactHud {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this._lootAt = -Infinity;
    this._lootText = '';
    this._region = null;
    this._regionAt = -Infinity;
    this._label = '';
    this.game.bus.on('chat', (p) => this.onChat(p || {}));
    this.game.bus.on('tick', () => this.tick());
    for (const ev of ['autobattle', 'autogather', 'autoquest']) this.game.bus.on(ev, () => this.tick());
  }

  onChat({ text, cls }) {
    const loot = lootExcerpt(text, cls);
    if (!loot) return;
    this._lootAt = now();
    this._lootText = loot;
    if (this.ui._coalesce) this.ui._coalesce('lootpeek', () => this.tick()); else this.tick();
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
      const { autoBattle: battle, autoGather: gather, autoQuest: quest } = g;
      const grave = !!g.play?.grave;
      const label = autoLabel({ battle, gather, quest, grave });
      if (label !== this._label) {
        this._label = label;
        btn.innerHTML = `<span class="am-dot" aria-hidden="true"></span><span class="am-text">${label}</span>`;
        btn.title = `Auto modes · Battle ${battle ? 'on' : 'off'} · Gather ${gather ? 'on' : 'off'} · Quest ${quest ? 'on' : 'off'}${grave ? ' · Gravestone waiting' : ''}`;
        btn.setAttribute('aria-label', `${label} — automation controls`);
        btn.classList.toggle('running', !!(battle || gather || quest));
        btn.classList.toggle('grave', grave);
      }
    }

    const chat = this._chat || (this._chat = document.getElementById('chatbox'));
    if (chat) {
      const peek = this._peek();
      const loot = t - this._lootAt < LOOT_PEEK_MS ? this._lootText : '';
      if (peek && peek.textContent !== loot) { peek.textContent = loot; peek.title = loot; }
    }

    const region = this._regionEl || (this._regionEl = document.getElementById('region-label'));
    if (region) {
      const name = region.textContent;
      // The arrival timer shouldn't run out while the title is still showing.
      if (name !== this._region || document.body?.classList.contains('title-on')) {
        this._region = name;
        this._regionAt = t;
      }
      const folded = !!document.getElementById('minimap-panel')?.classList.contains('collapsed');
      region.classList.toggle('fresh', regionShown({ now: t, changedAt: this._regionAt, minimapFolded: folded }));
    }
  }
}
