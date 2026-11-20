// Small, pure helpers that make the HUD easier to read and use: the Interact
// button's short caption, the foldable Objectives tracker, the phone sheet's
// half / full snap, and the quick-use slot's button. ui.js calls in here.
import { quickUseChoice, quickUse } from '../game/quickuse.js';
import { itemIconSVG } from '../render/icons.js';
import { shortNumber } from '../core/utils.js';
import { getItem } from '../data/items.js';

// ---------------- Interact caption ----------------
// "Chop down Oak tree" is too long for a thumb-sized button: verbs lose their
// trailing words and names their titles, so it reads "Chop Oak", "Talk to Aziz".
const SHORT_VERBS = {
  'Chop down': 'Chop', 'Trade with': 'Trade', 'Steal-from': 'Steal', 'Cook on': 'Cook', 'Brew at': 'Brew',
  'Craft at': 'Craft', 'Fletch at': 'Fletch', 'Smelt at': 'Smelt', 'Smith at': 'Smith', 'Offer at': 'Offer',
  'Pray at': 'Pray', 'Rest at': 'Rest', 'Train at': 'Train', 'Balance on': 'Balance', 'Edge across': 'Edge',
  'Hop across': 'Hop', 'Swing on': 'Swing', 'Slide down': 'Slide', 'Dive into': 'Dive', 'Leave by': 'Leave',
};
const NAME_MAX = 11;

/** A short name: an object's own short label, else the name; a long
 *  townsperson's name drops its title ("Pest Control Officer Aziz" -> "Aziz"). */
export function shortName(name, target) {
  const label = target?.kind === 'obj' && target.ref?.def?.label;
  if (label) return label;
  const s = String(name || '');
  if (s.length <= NAME_MAX || target?.kind !== 'npc') return s;
  return s.split(/\s+/).pop();
}

/** [verb, noun] for the Interact button from the game's label
 *  ([verb, name, skill, tooLow]) and what it points at. */
export function interactCaption(label, target) {
  if (!label) return ['Interact', ''];
  const verb = SHORT_VERBS[label[0]] || label[0];
  // A too-low gathering spot: the name gives way to what you need.
  const need = label[3] ? String(label[1]).match(/needs (.+)\)$/) : null;
  if (need) return ['Needs', need[1]];
  return [verb, shortName(String(label[1]).replace(/ \(.*\)$/, ''), target)];
}

// ---------------- Objectives tracker fold ----------------
export const TRACKER_KEY = 'ss_ui_tracker';

export function loadTrackerFolded() {
  try { return localStorage.getItem(TRACKER_KEY) === '1'; } catch { return false; }
}
export function saveTrackerFolded(folded) {
  try { localStorage.setItem(TRACKER_KEY, folded ? '1' : '0'); } catch { /* private window: just this visit */ }
}

/** The tracker's markup: a tappable header, then the rows unless folded
 *  ("★ 2 objectives" on one line). `rows` are the row HTML strings; the XP
 *  multiplier row (.trk-xp) is not counted as an objective. */
export function trackerHTML(rows, folded) {
  if (!rows.length) return '';
  const n = rows.filter((r) => !r.includes('trk-xp')).length;
  const head = `<button type="button" class="trk-title trk-fold" aria-expanded="${folded ? 'false' : 'true'}" title="${folded ? 'Show' : 'Hide'} objectives">`
    + (folded ? `&#9733; ${n || rows.length} objective${(n || rows.length) === 1 ? '' : 's'}` : 'Objectives')
    + `<span class="trk-chev" aria-hidden="true">${folded ? '&#9656;' : '&#9662;'}</span></button>`;
  return folded ? head : head + rows.join('');
}

// ---------------- Phone sheet snap ----------------
/** Where a dragged phone sheet settles. `full`: it was at full height; `dy`:
 *  how far the finger moved (down is positive); `h`: the sheet's height.
 *  Returns 'full', 'half', 'close' or null (stay as it was). */
export function sheetSnap({ full, dy, h }) {
  if (dy <= -40) return 'full';
  if (full) {
    if (dy > Math.max(160, h * 0.55)) return 'close';
    return dy >= 40 ? 'half' : null;
  }
  return dy > 70 ? 'close' : null;
}

// ---------------- Quick-use slot ----------------
/** The quick-use button beside the Attack button (touch screens; F on a
 *  keyboard): the food or potion a tap uses, with how many you carry. */
export class QuickSlot {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = null;
    this._sig = null;
    // A burst of bag or life changes redraws it once a frame (ui._soon), not once each.
    this.game.bus.on('tick', () => this.render());
    for (const ev of ['hp', 'inventory']) this.game.bus.on(ev, () => (ui._soon ? ui._soon('quickslot', () => this.render()) : this.render()));
  }

  _button() {
    if (this.el || typeof document === 'undefined') return this.el;
    const atk = document.getElementById('attack-btn');
    if (!atk) return null;
    const b = document.createElement('button');
    b.id = 'quick-slot';
    b.type = 'button';
    b.className = 'hidden';
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); quickUse(this.game); this.render(); });
    atk.after(b);
    this.el = b;
    return b;
  }

  render() {
    const b = this._button();
    if (!b) return;
    const c = quickUseChoice(this.game);
    const sig = c ? `${c.id}|${c.count}` : '';
    if (sig === this._sig) return;
    this._sig = sig;
    b.classList.toggle('hidden', !c);
    if (!c) return;
    b.innerHTML = `${itemIconSVG(c.id, 30)}<span class="qs-n">${shortNumber(c.count)}</span>`;
    const what = `${c.drink ? 'Drink' : 'Eat'} ${getItem(c.id).name.toLowerCase()}`;
    b.title = `${what} (F)`;
    b.setAttribute('aria-label', what);
  }
}
