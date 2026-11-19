// The XP display, tucked under the minimap (it replaces the stack of floating
// pills that used to rise over the top of the screen):
//  - Combined (the default): one running "+1,240 XP" that counts up while you
//    keep gaining, with the small icons of the skills that gained; it fades
//    after XP_IDLE_MS without a gain.
//  - Per skill: one compact pill per skill, merging quick gains (the old
//    behaviour, smaller and out of the way).
//  - Off: nothing, bar the level-up toasts.
// Beside it, a progress ring round the icon of the skill trained last; hover
// it (desktop) or tap it (touch) for level, XP to next and a rolling XP/hour.
// Level-ups pulse that ring gold and post a short toast at the screen's edge;
// ui.js keeps its big centre banner for milestone levels only.
//
// The bookkeeping is in game/xptrack.js (tested headlessly). DOM work happens
// at most once a frame however many XP events a tick brings, and nothing runs
// per frame while idle.
import { XpTracker, XP_IDLE_MS, xpDisplayMode } from '../game/xptrack.js';
import { levelProgress, xpToNext, maxLevelFor, levelForXp } from '../data/xp.js';
import { SKILLS } from '../data/skills.js';
import { skillIconSVG } from '../render/icons.js';
import { hudNumber } from '../core/utils.js';
import { countUp } from './uifx.js';

const RING_C = 2 * Math.PI * 15;       // the ring's circumference (r = 15 in a 36 box)
const RING_LINGER_MS = 60 * 1000;      // the ring stays (dimmed) this long after the last gain
const PILL_MERGE_MS = 800;
const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
const fmtXp = (n) => (n < 1e6 ? Math.round(n).toLocaleString('en-GB') : hudNumber(n));

export class XpDisplay {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.track = new XpTracker();
    this.el = null;
    this._dirty = false;
    this._shown = 0;           // the total the counter last showed
    this._skillsSig = '';
    this._ringSkill = null;
    this._pills = {};
  }

  _now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  _root() {
    if (this.el || typeof document === 'undefined') return this.el;
    const host = document.getElementById('minimap-panel');
    if (!host) return null;
    const el = document.createElement('div');
    el.id = 'xp-hud';
    el.className = 'idle no-ring';
    el.innerHTML = '<div class="xph-row"><div class="xph-count"><span class="xph-skills"></span><span class="xph-amt"></span></div>'
      + '<button class="xph-ring" type="button" aria-label="Skill progress">'
      + `<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}"/></svg>`
      + '<span class="xph-ic"></span></button></div>'
      + '<div class="xph-tip hidden"></div><div class="xph-pills"></div>';
    host.appendChild(el);
    // A separate strip at the screen's right edge for level-up toasts (they
    // show whatever the XP display setting).
    const toasts = document.createElement('div');
    toasts.id = 'xp-toasts';
    (document.getElementById('game-root') || document.body).appendChild(toasts);
    this.toasts = toasts;
    const ring = el.querySelector('.xph-ring');
    const tip = el.querySelector('.xph-tip');
    const open = (on) => {
      this._tipOpen = on;
      tip.classList.toggle('hidden', !on);
      el.classList.toggle('tip-open', on);
      if (on) this._renderTip();
      clearTimeout(this._tipTimer);
    };
    // Desktop: hover shows it. Touch (and pen): a tap toggles it.
    ring.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(true); });
    ring.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') open(false); });
    ring.addEventListener('pointerdown', (e) => { this._tapType = e.pointerType; });
    ring.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._tapType === 'mouse') return;
      open(!this._tipOpen);
      if (this._tipOpen) this._tipTimer = setTimeout(() => open(false), 5000);   // touch: tap to show, it closes itself
    });
    this.parts = {
      amt: el.querySelector('.xph-amt'), skills: el.querySelector('.xph-skills'),
      ring, fg: el.querySelector('.xph-ring .fg'), ic: el.querySelector('.xph-ic'), tip,
      pills: el.querySelector('.xph-pills'),
    };
    this.el = el;
    return el;
  }

  /** The bus's 'xp' event: { skill, amount, total }. */
  onXp({ skill, amount }) {
    const now = this._now();
    const wasActive = this.track.active(now);
    this.track.add(skill, amount, now);
    const mode = xpDisplayMode(this.game);
    if (mode === 'off' || !this._root()) return;
    if (!wasActive) this._shown = 0;
    if (mode === 'skill') this._pill(skill, amount, now);
    this._dirty = true;
    this.ui._soon('xp-hud', () => this._flush());
  }

  /** Redraw after a burst of gains (once a frame at most). */
  _flush() {
    if (!this._dirty || !this.el) return;
    this._dirty = false;
    const now = this._now();
    const mode = xpDisplayMode(this.game);
    const el = this.el, P = this.parts, run = this.track.run;
    el.classList.toggle('per-skill', mode === 'skill');
    el.classList.remove('idle', 'no-ring', 'ring-only');
    if (mode === 'combined' && run) {
      const sig = run.skills.join(',');
      if (sig !== this._skillsSig) {
        this._skillsSig = sig;
        P.skills.innerHTML = run.skills.map((s) => skillIconSVG(s, 16)).join('');
      }
      const to = Math.round(run.total);
      countUp(P.amt, 'xp-hud', to, (n) => `+${fmtXp(n)} XP`, this._shown);
      this._shown = to;
    }
    this._renderRing();
    if (this._tipOpen) this._renderTip();
    clearTimeout(this._idleTimer);
    clearTimeout(this._ringTimer);
    this._idleTimer = setTimeout(() => { el.classList.add('ring-only'); this._skillsSig = ''; }, XP_IDLE_MS);
    this._ringTimer = setTimeout(() => { if (!this._tipOpen) el.classList.add('idle', 'no-ring'); }, RING_LINGER_MS);
  }

  _renderRing(force = false) {
    const skill = this.track.last;
    if (!skill || !this.parts) return;
    const P = this.parts;
    if (skill !== this._ringSkill || force) {
      this._ringSkill = skill;
      P.ic.innerHTML = skillIconSVG(skill, 18);
      P.ring.setAttribute('aria-label', `${skillName(skill)} progress`);
    }
    const xp = this.game.skills?.xp?.[skill] ?? 0;
    const k = levelProgress(xp, maxLevelFor(skill));
    P.fg.setAttribute('stroke-dashoffset', (RING_C * (1 - k)).toFixed(2));
  }

  _renderTip() {
    const skill = this.track.last;
    if (!skill || !this.parts) return;
    const xp = this.game.skills?.xp?.[skill] ?? 0;
    const cap = maxLevelFor(skill);
    const lvl = levelForXp(xp, cap);
    const left = xpToNext(xp, cap);
    const rate = this.track.ratePerHour(skill, this._now());
    this.parts.tip.innerHTML = `<b>${skillName(skill)}</b> level ${lvl}`
      + (lvl < cap ? `<br>${fmtXp(Math.ceil(left))} XP to ${lvl + 1}` : '<br>Maxed')
      + `<br>${rate ? hudNumber(rate) : '—'} XP/h`;
  }

  /** Per skill mode: one small pill per skill; quick gains merge into it. */
  _pill(skill, amount, now) {
    const live = this._pills[skill];
    if (live && now - live.t < PILL_MERGE_MS && live.div.isConnected) {
      const was = Math.round(live.total);
      live.total += amount; live.t = now;
      countUp(live.div.querySelector('.xp-amt'), `xph:${skill}`, Math.round(live.total), (n) => `+${fmtXp(n)}`, was);
      return;
    }
    const div = document.createElement('div');
    div.className = 'xph-pill';
    div.innerHTML = `<span class="xp-ic">${skillIconSVG(skill, 14)}</span><span class="xp-amt">+${fmtXp(amount)}</span>`;
    this.parts.pills.appendChild(div);
    this._pills[skill] = { div, total: amount, t: now };
    while (this.parts.pills.children.length > 4) this.parts.pills.firstElementChild.remove();
    setTimeout(() => div.remove(), 2300);
  }

  /** A level-up (gathered by ui.js, one call per skill): a gold pulse on the
   *  ring and a short toast at the screen's edge. */
  levelUp(skill, from, to) {
    if (!this._root()) return;
    const mode = xpDisplayMode(this.game);
    if (mode !== 'off') {
      this.track.last = skill;
      this._renderRing(true);
      const el = this.el;
      el.classList.remove('idle', 'no-ring');
      if (!this.track.active(this._now())) el.classList.add('ring-only');   // a running counter stays up
      const r = this.parts.ring;
      // Reduce motion and low graphics: the ring just glows gold, no pulse.
      const cls = this.game.reduceMotion || this.game.lowFx ? 'lvl-still' : 'lvl';
      r.classList.remove('lvl', 'lvl-still'); void r.offsetWidth; r.classList.add(cls);
      clearTimeout(this._lvlTimer);
      this._lvlTimer = setTimeout(() => r.classList.remove('lvl', 'lvl-still'), 1600);
      clearTimeout(this._ringTimer);
      this._ringTimer = setTimeout(() => { if (!this._tipOpen) el.classList.add('idle', 'no-ring'); }, RING_LINGER_MS);
    }
    const t = document.createElement('div');
    t.className = 'xph-toast';
    const n = to - from;
    t.innerHTML = `${skillIconSVG(skill, 18)}<span><b>${skillName(skill)} ${to}</b>${n > 1 ? ` <i>+${n}</i>` : ''}</span>`;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2600);
  }

  /** Settings changed the mode: tidy away what the new one doesn't show. */
  refresh() {
    if (!this.el) return;
    const mode = xpDisplayMode(this.game);
    this.el.classList.toggle('per-skill', mode === 'skill');
    if (mode === 'off') this.el.classList.add('idle', 'no-ring');
    if (mode !== 'skill') this.parts.pills.innerHTML = '';
  }
}
