// The command search box: / or Ctrl+K (or the quick bar's magnifier) opens it
// over the game; typing lists the best few matches with icons (the index and
// the matching are in game/cmdindex.js). Up / Down and Enter on a keyboard, a
// tap on a phone; a row's small second button is its other action (a skill's
// Go, a place's Map, a quest's Journal, an item's Codex page). Esc or a tap
// outside closes it.
import { searchCommands, itemVerb, CMD_LIMIT } from '../game/cmdindex.js';
import { QB_ACTIONS, runQuickAction, goSkill } from '../game/quickbar.js';
import { regionInfo } from '../game/regioninfo.js';
import { getItem } from '../data/items.js';
import { qbIconHTML, typing } from './quickbar.js';
import { openEntry } from './encyclopediaui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const QB_ON = (id, game) => (QB_ACTIONS[id]?.on ? QB_ACTIONS[id].on(game) : null);
const VERB = { equip: 'Equip', eat: 'Eat', drink: 'Drink', bank: 'Fetch', info: 'Codex' };

/** The row's small grey line: what it is and, for items, where they are. */
export function entrySub(game, e) {
  switch (e.kind) {
    case 'window': return 'Window';
    case 'action': { const on = game ? QB_ON(e.id, game) : null; return on === null ? 'Action' : `Action · ${on ? 'on' : 'off'}`; }
    case 'skill': return `Skill · level ${game?.skills?.level?.(e.id) ?? 1}`;
    case 'quest': { const st = game?.quests?.[e.id]?.state; return `Quest · ${st === 'done' ? 'done' : st === 'active' ? 'in progress' : 'not started'}`; }
    case 'place': return 'Place';
    case 'monster': return `${e.boss ? 'Boss' : 'Monster'} · level ${e.level}`;
    case 'item': return ['Item', e.bag && `bag ×${e.bag}`, e.worn && 'worn', e.bank && `bank ×${e.bank}`].filter(Boolean).join(' · ');
    default: return '';
  }
}

/** The buttons a result offers: [main, other?] labels. */
export function entryVerbs(game, e) {
  switch (e.kind) {
    case 'window': return ['Open'];
    case 'action': return ['Do it'];
    case 'skill': return e.go ? ['Guide', 'Go'] : ['Guide'];
    case 'quest': return game?.quests?.[e.id]?.state === 'done' ? ['Journal'] : ['Go', 'Journal'];
    case 'place': return ['Go', 'Map'];
    case 'monster': return ['Codex'];
    case 'item': { const v = VERB[itemVerb(game, e)]; return v === 'Codex' ? ['Codex'] : [v, 'Codex']; }
    default: return ['Open'];
  }
}

/** Do what a result says: its main action, or with `other` its second one. */
export function runEntry(ui, e, other = false) {
  const game = ui.game;
  const verb = entryVerbs(game, e)[other ? 1 : 0];
  if (!verb) return false;
  switch (e.kind) {
    case 'window': case 'action': return runQuickAction(game, e.id, ui);
    case 'skill': return verb === 'Go' ? goSkill(game, e.id) : ui.openSkillGuide(e.id);
    case 'quest': return verb === 'Go' ? game.questTravel(e.id) : ui.showPanelView('quests');
    case 'place': {
      const info = regionInfo(game, e.id);
      if (!info) return false;
      if (verb === 'Map') return ui.openWorldMap({ x: info.go.x, y: info.go.y, label: e.label });
      game.msg(`You set off for ${e.label}.`, 'system');
      return game.travelToTile(info.go);
    }
    case 'monster': return ui.openBestiary(e.id);
    case 'item': {
      if (verb === 'Codex') return openEntry(ui, 'item', e.id);
      if (verb === 'Fetch') { game.msg(`Your ${getItem(e.id).name.toLowerCase()} is in the bank: heading there.`, 'system'); return runQuickAction(game, 'bank', ui); }
      const i = game.inventory.slots.findIndex((s) => s?.id === e.id);
      if (i < 0) return false;
      if (verb === 'Equip') return game.equipItem(i);
      if (verb === 'Drink') return game.drinkPotion(i);
      return game.eatItem(i);
    }
    default: return false;
  }
}

export class CmdSearch {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = null;
    this.results = [];
    this.sel = 0;
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.isComposing || e.repeat || this.isOpen() || typing(e.target) || e.altKey || e.shiftKey || this.ui.modal?.locked || this.game.story?.scene || this.game.photoMode) return;
      if (document.getElementById('splash')?.classList.contains('hidden') === false) return;
      const k = (e.key || '').toLowerCase();
      if ((k === '/' && !e.ctrlKey && !e.metaKey) || (k === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault(); e.stopImmediatePropagation();
        this.open();
      }
    }, true);   // before the game's own keys (K is the town teleport)
  }

  isOpen() { return !!this.el && !this.el.classList.contains('hidden'); }

  _mount() {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.id = 'cmd-search';
    el.className = 'hidden';
    el.innerHTML = '<div class="cs-box" role="dialog" aria-modal="true" aria-label="Search" tabindex="-1">'
      + '<input type="search" class="cs-input" placeholder="Search windows, skills, places, quests, monsters, items…" autocomplete="off" spellcheck="false" aria-label="Search" />'
      + '<div class="cs-list" role="listbox"></div><div class="cs-hint">Enter: do it · Up/Down: choose · Esc: close</div></div>';
    const input = el.querySelector('.cs-input');
    input.addEventListener('input', () => { this.sel = 0; this.update(input.value); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') return;   // the shared dialog focus handling wraps the list
      e.stopPropagation();   // the game's keys stay quiet while typing here
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = this.results.length;
        if (n) { this.sel = (this.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; this.draw(); }
      } else if (e.key === 'Enter') { e.preventDefault(); this.pick(this.sel, e.shiftKey); }
    });
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.cs-box')) { this.close(); return; }   // a tap outside the box
      const row = e.target.closest('.cs-row');
      if (row) this.pick(Number(row.dataset.i), !!e.target.closest('.cs-alt'));
    });
    document.getElementById('game-root')?.appendChild(el);
    this.el = el;
    return el;
  }

  open(text = '') {
    if (typeof document === 'undefined') return;
    const el = this._mount();
    if (!this.isOpen()) this._opener = document.activeElement;
    this.ui.hideContextMenu?.();
    el.classList.remove('hidden');
    const input = el.querySelector('.cs-input');
    input.value = text;
    this.sel = 0;
    this.update(text);
    input.focus();
  }

  close() {
    if (!this.isOpen()) return;
    this.el.classList.add('hidden');
    const opener = this._opener;
    this._opener = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }

  update(text) {
    this.results = searchCommands(this.game, text, CMD_LIMIT);
    this.draw(text);
  }

  draw(text = this.el.querySelector('.cs-input').value) {
    const list = this.el.querySelector('.cs-list');
    if (!this.results.length) {
      list.innerHTML = `<div class="cs-empty">${text.trim() ? 'Nothing matches. Try fewer letters.' : 'Type a few letters: <b>bank</b>, <b>smlt</b>, <b>map</b>, a monster, a quest, an item…'}</div>`;
      return;
    }
    list.innerHTML = this.results.map((e, i) => {
      const [main, alt] = entryVerbs(this.game, e);
      return `<div class="cs-row${i === this.sel ? ' sel' : ''}" role="option" aria-selected="${i === this.sel}" data-i="${i}">`
        + `<span class="cs-ic">${qbIconHTML(e.icon, 26)}</span><span class="cs-text"><b>${esc(e.label)}</b><small>${esc(entrySub(this.game, e))}</small></span>`
        + `<button type="button" class="cs-main">${main}</button>${alt ? `<button type="button" class="cs-alt">${alt}</button>` : ''}</div>`;
    }).join('');
    list.querySelector('.cs-row.sel')?.scrollIntoView?.({ block: 'nearest' });
  }

  pick(i, other = false) {
    const e = this.results[i];
    if (!e) return;
    this.close();
    runEntry(this.ui, e, other);
  }
}
