// The one notification lane's queue: banners (golden hours, rare drops, world
// events, quests), first-time tips and other short notes all wait here and are
// shown a couple at a time in one place (noticelane.js draws them). No DOM and
// no timers: the caller passes the time in, so the tests can drive it.

export const MAX_VISIBLE = 2;     // cards on screen at once
export const MAX_QUEUED = 6;      // waiting behind them; older low-priority ones drop off
export const DEFAULT_TTL = 4000;  // ms a card stays up
const NO_TAGS = /<[^>]*>/g;

/** The key two notices are "the same" by: the given key, else the words. */
export const noticeKey = (n) => n.key || `${n.kind || 'note'}:${String(n.html || '').replace(NO_TAGS, ' ').replace(/\s+/g, ' ').trim()}`;

export class NoticeQueue {
  constructor({ max = MAX_VISIBLE, maxQueued = MAX_QUEUED } = {}) {
    this.max = max;
    this.maxQueued = maxQueued;
    this.items = [];   // { id, key, html, kind, tag, ttl, priority, count, shownAt (null while queued) }
    this._id = 0;
  }

  /** Add a notice (or bump the matching one: "×2", and it stays up longer).
   *  Returns the notice. */
  push(n, now = 0) {
    const key = noticeKey(n);
    const same = this.items.find((x) => x.key === key);
    if (same) {
      same.count++;
      same.html = n.html ?? same.html;
      if (same.shownAt != null) same.shownAt = now;   // seen again: the clock restarts
      return same;
    }
    const item = {
      id: ++this._id, key, html: n.html || '', kind: n.kind || 'note', tag: n.tag ?? null,
      ttl: n.ttl ?? DEFAULT_TTL, priority: n.priority || 0, count: 1, shownAt: null,
    };
    this.items.push(item);
    this._trim();
    this._promote(now);
    return item;
  }

  visible() { return this.items.filter((x) => x.shownAt != null); }
  queued() { return this.items.filter((x) => x.shownAt == null); }
  has(kind) { return this.items.some((x) => x.kind === kind); }

  /** Drop the cards whose time is up and bring the next ones in. True when
   *  anything changed. */
  tick(now) {
    const before = this.items.length;
    this.items = this.items.filter((x) => x.shownAt == null || now - x.shownAt < x.ttl);
    return this._promote(now) || this.items.length !== before;
  }

  /** When the next showing card runs out (or null when none is up). */
  nextExpiry() {
    let t = null;
    for (const x of this.visible()) { const e = x.shownAt + x.ttl; if (t == null || e < t) t = e; }
    return t;
  }

  dismiss(id, now = 0) { return this._remove((x) => x.id === id, now); }
  /** Take down everything one source put up (leaving the Endless Gate clears
   *  its wave banners, never anyone else's). */
  dismissTag(tag, now = 0) { return tag != null && this._remove((x) => x.tag === tag, now); }
  dismissKind(kind, now = 0) { return this._remove((x) => x.kind === kind, now); }

  _remove(pred, now) {
    const before = this.items.length;
    this.items = this.items.filter((x) => !pred(x));
    if (this.items.length === before) return false;
    this._promote(now);
    return true;
  }

  // Waiting cards come in by priority, then in order of arrival.
  _promote(now) {
    let changed = false;
    while (this.visible().length < this.max) {
      const next = this.queued().sort((a, b) => b.priority - a.priority || a.id - b.id)[0];
      if (!next) break;
      next.shownAt = now;
      changed = true;
    }
    return changed;
  }

  // A long backlog (a boss kill's drops, achievements and level-ups at once)
  // would keep the lane busy for a minute: the oldest, least important waiting
  // cards give way.
  _trim() {
    let waiting = this.queued();
    while (waiting.length > this.maxQueued) {
      const drop = waiting.slice().sort((a, b) => a.priority - b.priority || a.id - b.id)[0];
      this.items = this.items.filter((x) => x !== drop);
      waiting = this.queued();
    }
  }
}
