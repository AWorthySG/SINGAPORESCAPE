// The quick bar on screen: a magnifier (command search), the player's
// favourite actions (one tap each; Shift+1 to Shift+6 on a keyboard, since 1-5
// already pick the panel tabs) and a small pencil that opens the edit window.
// On a desktop it is a row above the action bar; on a phone a column under the
// Bag button (styles/qol.css). The actions themselves live in game/quickbar.js.
// Beside the search, the Life skills button opens a grid of every life skill:
// one tap goes and starts it (game/quickbar.js startLifeSkill).
import { QB_ACTIONS, QB_SLOTS, QB_DEFAULT, quickbarOf, setQuickSlot, runQuickAction, LIFE_SHORTCUTS, lifeShortcutHint, startLifeSkill } from '../game/quickbar.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { quickUseChoice } from '../game/quickuse.js';
import { openCompendium } from './codexui.js';
import { itemIconSVG, skillIconSVG, tabIconSVG, uiIconHTML, playIconHTML } from '../render/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** An action's icon ({ tab | play | ui | skill | item: id }), from the existing art. */
export function qbIconHTML(icon, size = 26) {
  if (!icon) return '';
  if (icon.item) return itemIconSVG(icon.item, size);
  if (icon.skill) return skillIconSVG(icon.skill, size);
  if (icon.tab) return tabIconSVG(icon.tab, size);
  if (icon.ui) return uiIconHTML(icon.ui, size);
  if (icon.play) return playIconHTML(icon.play, size);
  return '';
}

/** The slot keys: Shift and the digit (the plain digits pick the panel tabs). */
export const slotOfKey = (e) => {
  if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return -1;
  const m = /^Digit([1-9])$/.exec(e.code || '');
  const i = m ? Number(m[1]) - 1 : -1;
  return i < QB_SLOTS ? i : -1;
};

/** True when a key press belongs to a text box, not the game. */
export const typing = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export class QuickBar {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = null;
    this._sig = '';
    // The Compendium opener the bar's action calls (ui.js has none of its own).
    ui.openCompendium ??= (article = null) => openCompendium(ui, article);
    ui.openLifeSkills ??= () => this.openLife();
    quickbarOf(this.game);
    for (const ev of ['quickbar', 'autobattle', 'autogather', 'autoquest']) this.game.bus.on(ev, () => this.render());
    // The bag changes many times a tick in a fight (every drop picked up): the
    // Eat slot, which scans the whole bag, is worked out once per burst.
    this.game.bus.on('inventory', () => (ui._coalesce ? ui._coalesce('quickbar', () => this.render()) : this.render()));
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', (e) => this.onKey(e));
    this.render();
  }

  onKey(e) {
    if (typing(e.target) || document.getElementById('splash')?.classList.contains('hidden') === false) return;
    const i = slotOfKey(e);
    if (i >= 0 && quickbarOf(this.game)[i]) { e.preventDefault(); this.tap(i); }
  }

  tap(i) {
    const key = quickbarOf(this.game)[i];
    if (key) runQuickAction(this.game, key, this.ui);
  }

  _mount() {
    if (this.el || typeof document === 'undefined') return this.el;
    const root = document.getElementById('game-root');
    if (!root) return null;
    const el = document.createElement('div');
    el.id = 'quickbar';
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', 'Quick bar');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'qb-search') this.ui.cmdSearch?.open();
      else if (b.id === 'qb-life') { el.classList.remove('open'); this.openLife(); }
      else if (b.classList.contains('qb-more')) el.classList.toggle('open');
      else if (b.classList.contains('qb-edit')) { el.classList.remove('open'); this.openEdit(); }
      else if (b.dataset.slot) { this.tap(Number(b.dataset.slot)); el.classList.remove('open'); }
    });
    root.appendChild(el);
    this.el = el;
    return el;
  }

  render() {
    const el = this._mount();
    if (!el) return;
    const g = this.game, bar = quickbarOf(g);
    // The Eat slot shows the food a tap would use, when you carry any.
    const food = bar.includes('eat') ? quickUseChoice(g)?.id || '' : '';
    const sig = bar.join(',') + '|' + bar.map((k) => (QB_ACTIONS[k]?.on?.(g) ? 1 : 0)).join('') + '|' + food;
    if (sig === this._sig) return;
    this._sig = sig;
    let html = `<button type="button" id="qb-search" class="qb-btn" title="Search windows, skills, places, quests, monsters and items (/ or Ctrl+K)" aria-label="Search">${playIconHTML('ui-search', 24)}</button>`;
    html += `<button type="button" id="qb-life" class="qb-btn" title="Life skills: go and start any of them in one tap" aria-label="Life skills">${tabIconSVG('skills', 24)}</button>`;
    // Phones fold the favourites behind this (styles/qol.css): a 2 x 3 block of
    // buttons sat beside your hero in the middle of the screen. A dot shows while
    // one of them (auto battle, say) is on.
    const anyOn = bar.some((k) => QB_ACTIONS[k]?.on?.(g));
    html += `<button type="button" class="qb-btn qb-more${anyOn ? ' has-on' : ''}" title="Your quick actions" aria-label="Quick actions">&#8943;</button>`;
    bar.forEach((key, i) => {
      const a = QB_ACTIONS[key];
      if (!a) return;
      const on = a.on ? a.on(g) : null;
      const icon = key === 'eat' && food ? { item: food } : a.icon;
      html += `<button type="button" class="qb-btn qb-slot${on ? ' on' : ''}" data-slot="${i}" data-action="${esc(key)}"`
        + `${on !== null ? ` aria-pressed="${on}"` : ''} title="${esc(a.label)}${on !== null ? (on ? ' (on)' : ' (off)') : ''} (Shift+${i + 1})" aria-label="${esc(a.label)}">`
        + `${qbIconHTML(icon)}<kbd class="qb-key" aria-hidden="true">${i + 1}</kbd></button>`;
    });
    html += '<button type="button" class="qb-btn qb-edit" title="Choose the quick bar\'s actions" aria-label="Edit quick bar">&#9998;</button>';
    el.innerHTML = html;
  }

  /** The Life skills grid: every life skill, with what a tap would do now. */
  openLife() {
    const g = this.game;
    const draw = (body) => {
      body.innerHTML = '<div class="modal-hint">One tap walks you to the best spot for your level and starts: gathering carries on by itself (auto gather), and a station makes everything you can.</div>'
        + '<div class="life-grid">' + LIFE_SHORTCUTS.map((s) => `<button type="button" class="life-btn" data-life="${esc(s)}">`
          + `<span class="life-ic">${skillIconSVG(s, 30)}</span><span class="life-txt"><b>${esc(SKILL_BY_ID[s]?.name || s)} <small>${g.skills.level(s)}</small></b>`
          + `<small>${esc(lifeShortcutHint(g, s))}</small></span></button>`).join('') + '</div>';
      body.querySelectorAll('.life-btn').forEach((b) => b.addEventListener('click', () => {
        this.ui.closeModal?.();   // first: lighting a fire asks how many logs in a window of its own
        startLifeSkill(g, b.dataset.life, this.ui);
      }));
    };
    this.ui.openModal('Life skills', draw);
  }

  /** The edit window: a picker per slot, grouped like the actions. */
  openEdit() {
    const g = this.game;
    const groups = {};
    for (const [key, a] of Object.entries(QB_ACTIONS)) (groups[a.group] ||= []).push([key, a.label]);
    const options = (cur) => '<option value="">(empty)</option>' + Object.entries(groups).map(([name, list]) => `<optgroup label="${esc(name)}">`
      + list.map(([k, label]) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(label)}</option>`).join('') + '</optgroup>').join('');
    const draw = (body) => {
      const bar = quickbarOf(g);
      body.innerHTML = '<div class="modal-hint">Pick what each slot does. One tap runs it; on a keyboard, Shift and the slot\'s number. Empty slots are hidden.</div>'
        + '<div class="qb-edit-list">' + bar.map((key, i) => `<label class="qb-edit-row"><span class="qb-edit-ic">${qbIconHTML(QB_ACTIONS[key]?.icon, 28)}</span>`
          + `<b>${i + 1}</b><select class="bank-search" data-slot="${i}" aria-label="Slot ${i + 1}">${options(key)}</select></label>`).join('') + '</div>'
        + '<div class="dialogue-options"><button type="button" class="dialogue-option qb-reset">Back to the defaults</button></div>';
      body.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { setQuickSlot(g, Number(s.dataset.slot), s.value || null); draw(body); }));
      body.querySelector('.qb-reset').addEventListener('click', () => { QB_DEFAULT.forEach((k, i) => setQuickSlot(g, i, k)); draw(body); });
    };
    this.ui.openModal('Quick bar', draw);
  }
}
