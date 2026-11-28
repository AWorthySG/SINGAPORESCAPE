// Gameplay shortcuts and the in-game reference share the same bindings.
import { handsOn } from '../game/playbalance.js';
import { quickUse } from '../game/quickuse.js';
import { runQuickAction } from '../game/quickbar.js';
import { slotOfKey, typing } from './quickbar.js';
import { closeTopWindow, keepTabInDialog } from './windowease.js';

import { ABILITY_KEYS, EQUIP_BEST_SHORTCUT, KEYBOARD_GROUPS, PANEL_SHORTCUTS } from '../data/keyboard.js';

const panelKeys = Object.fromEntries(Object.entries(PANEL_SHORTCUTS).map(([view, key]) => [key, view]));
const bank = (g, ui) => runQuickAction(g, 'bank', ui);
const quest = (g, ui) => runQuickAction(g, 'quest', ui);
const actions = {
  g: (g) => g.attackNearest(),
  tab: (g) => g.nextTarget(),
  f: (g) => quickUse(g),
  q: (g) => g.toggleSpec(),
  l: (g) => g.prayerBurst(),
  e: (g) => g.interact(),
  p: (g) => g.pickpocketNearest(),
  h: (g) => { if (g.jobClass === 'merchant') g.hireMercenary(); },
  t: (g) => g.toggleAutoBattle(),
  y: (g) => g.toggleAutoGather(),
  u: (g) => g.toggleAutoQuest(),
  'shift+g': (_g, ui) => ui.openLifeSkills(),
  'shift+q': quest, j: quest,
  'shift+e': bank, n: bank,
  [EQUIP_BEST_SHORTCUT.toLowerCase()]: (g) => g.equipBest(),
  k: (g) => g.teleports?.start('town'),
  r: (g) => g.teleports?.start('grave'),
  m: (_g, ui) => ui.openWorldMap(),
  i: (_g, ui) => ui.toggleMenu(),
  '?': (_g, ui) => openKeyboardControls(ui),
};
const actionByKey = new Map(Object.entries(actions));
const activePlay = new Set([...ABILITY_KEYS, 'f', 'g', 'q', 'l', 'e', 'p']);

export function keyboardBlocked(ui, game) {
  const menu = ui?.el?.contextMenu;
  return !!(ui?.modal || ui?._cardOpen || ui?.cmdSearch?.isOpen?.() || game.story?.scene ||
    (menu && !menu.classList.contains('hidden')));
}

/** Handles one discrete command. Text entry, browser shortcuts and foreground
 *  windows keep their own keys. Held movement is handled by MovePad. */
export function handleGameShortcut(e, game, ui) {
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key === 'Tab') {
    if (ui.cmdSearch?.isOpen?.()) return keepTabInDialog(e, ui.cmdSearch.el?.querySelector('.cs-box'));
    if (ui.modal) {
      const menu = ui.el?.contextMenu;
      if (ui._cardOpen || (menu && !menu.classList.contains('hidden'))) return false;
      return keepTabInDialog(e, ui.el?.modalWindow);
    }
  }
  if (e.repeat) return false;
  if (e.key === 'Escape') {
    if (!closeTopWindow(ui)) return false;
    e.preventDefault();
    return true;
  }
  if (typing(e.target) || keyboardBlocked(ui, game) || game.photoMode) return false;

  const slot = slotOfKey(e);
  if (slot >= 0) {
    e.preventDefault();
    ui.quickBar.tap(slot);
    return true;
  }

  const key = e.key.toLowerCase();
  const control = e.target?.closest?.('button, a, summary, [role="button"], [role="tab"], [tabindex]');
  if ((key === 'tab' && (e.shiftKey || control || e.target?.closest?.('#sidepanel, #chatbox, #ability-bar'))) ||
      (key === ' ' && (e.shiftKey || control))) return false;

  const shortcut = key === ' ' ? 'e' : e.shiftKey && key !== '?' ? `shift+${key}` : key;
  const view = panelKeys[shortcut];
  const run = actionByKey.get(shortcut);
  if (!view && !run && !ABILITY_KEYS.includes(shortcut)) return false;

  e.preventDefault();
  if (activePlay.has(shortcut)) handsOn(game);
  if (view) ui.showPanelView(view);
  else if (run) run(game, ui);
  else game.activateAbilityKey(shortcut);
  return true;
}

export function openKeyboardControls(ui) {
  ui.openModal('Keyboard controls', (body) => {
    body.innerHTML = '<div class="keyboard-guide">' + KEYBOARD_GROUPS.map(([heading, rows]) =>
      `<section><h3>${heading}</h3><dl>${rows.map(([label, ...keys]) =>
        `<div><dt>${label}</dt><dd>${keys.map((key) => `<kbd>${key}</kbd>`).join('')}</dd></div>`
      ).join('')}</dl></section>`
    ).join('') + '</div>';
  });
}
