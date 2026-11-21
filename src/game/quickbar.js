// The quick bar: a few one-tap favourites beside the HUD (bank, next quest
// step, auto battle, eat...), chosen by the player. Every action here only
// calls what the game already does from its own buttons (the journal's Go, the
// skill guide's Go, the auto switches, the F key's quick use), so nothing about
// how those work is repeated. src/ui/quickbar.js draws the bar and its edit
// window; this file has no DOM, so the tests can drive it headlessly.
//
// Saved as `game.quickbar`: an array of QB_SLOTS action keys (null for an
// empty slot). Older saves have none and get QB_DEFAULT.
import { POTIONS } from '../data/trades.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { SKILL_GUIDES } from './skillguide.js';
import { quickUse, quickUseChoice } from './quickuse.js';
import { nextQuest, bestSource } from './whatnext.js';
import { nearOfferingShrine } from './salvage.js';

export const QB_SLOTS = 6;
export const QB_DEFAULT = ['bank', 'quest', 'battle', 'eat', null, null];

const skillName = (s) => SKILL_BY_ID[s]?.name || s;
// Skills whose spots the bar can walk you to: the gathering ones (their best
// source you can work, as the skill guide and "What next?" pick it) and the
// making ones with a workstation (the guide's "where").
export const GO_SKILLS = ['woodcutting', 'mining', 'fishing', 'hunter', 'thieving', 'agility',
  ...Object.keys(SKILL_GUIDES).filter((s) => SKILL_GUIDES[s].where?.length)];

/** The buff potion worth drinking now: one you carry whose kind (attack,
 *  strength...) isn't already running, strongest first; or, failing that, a
 *  healing potion when you're hurt. { index, id } or null. */
export function bestPotion(game) {
  const active = new Set(Object.keys(game.potions || {}).map((id) => POTIONS[id]?.group).filter(Boolean));
  let best = null;
  game.inventory.slots.forEach((s, i) => {
    const pot = s && POTIONS[s.id];
    if (!pot?.group || !pot.ms || active.has(pot.group)) return;   // skill brews (no ms) are left for gathering
    if (!best || pot.level > POTIONS[best.id].level) best = { index: i, id: s.id };
  });
  if (best) return best;
  const heal = quickUseChoice(game);
  return heal?.drink && game.player.hp < game.maxHp() ? { index: heal.index, id: heal.id } : null;
}

/** Drink bestPotion(). Returns the potion's id, or null. */
export function drinkBestPotion(game) {
  const p = bestPotion(game);
  if (!p) { game.msg('You have no potion worth drinking right now.', 'system'); return null; }
  game.drinkPotion(p.index);
  return p.id;
}

/** "Go" to a skill's spot, like the skill guide's own Go. */
export function goSkill(game, skill) {
  const where = SKILL_GUIDES[skill]?.where;
  if (where?.length) return game.goToNearest(where);
  const src = bestSource(game, skill);
  if (!src) { game.msg(`There's nothing for ${skillName(skill)} I can take you to right now.`, 'system'); return false; }
  return game.goToObject(src.obj);
}

/** The journal's Go on the next quest step (the same quest "What next?" picks). */
export function nextQuestStep(game) {
  const q = nextQuest(game);
  if (!q) { game.msg('No quest needs you right now.', 'system'); return false; }
  return game.questTravel(q.id);
}

// Windows a slot can open: [key, label, icon, open(ui)]. Panel views go
// through ui.showPanelView, so they light their tab like a tap on it would.
const view = (v) => (ui) => ui.showPanelView(v);
const WINDOWS = [
  ['bag', 'Bag', { tab: 'inventory' }, view('inventory')],
  ['gear', 'Gear', { tab: 'equipment' }, view('equipment')],
  ['skills', 'Skills', { tab: 'skills' }, view('skills')],
  ['combat', 'Combat', { tab: 'combat' }, view('combat')],
  ['prayer', 'Prayer & blessings', { tab: 'prayer' }, view('prayer')],
  ['journal', 'Quest journal', { tab: 'quests' }, view('quests')],
  ['awards', 'Awards', { tab: 'achievements' }, view('achievements')],
  ['settings', 'Settings', { tab: 'settings' }, view('settings')],
  ['map', 'World map', { play: 'ui-places' }, (ui) => ui.openWorldMap()],
  ['codex', 'Monster Codex', { skill: 'slayer' }, (ui) => ui.openBestiary()],
  ['compendium', 'Compendium', { play: 'ui-report' }, (ui) => ui.openCompendium?.()],   // (added by src/ui/quickbar.js)
  ['mastery', 'Gear Mastery', { play: 'ui-mastery' }, (ui) => ui.openMastery()],
  // The shrine window works only beside an Offering Shrine: away from one, walk there.
  ['shrine', 'Offering Shrine', { ui: 'blessing-slot' }, (ui, g) => (nearOfferingShrine(g) ? ui.openOfferingShrine() : g.goToNearest(['offering_shrine']))],
];

/** Every action a slot can hold: key -> { label, group, icon, run(game, ui), on?(game) }.
 *  icon: { tab | play | ui | skill | item: id } (src/ui/quickbar.js draws it). */
export const QB_ACTIONS = (() => {
  const A = {
    bank: { label: 'Nearest bank', group: 'Travel', icon: { item: 'coins' }, run: (g) => g.goToNearest(['bank_booth']) },
    home: { label: 'Teleport home', group: 'Travel', icon: { ui: 'teleport-town' }, run: (g) => g.teleports?.start('town') },
    grave: { label: 'Teleport to grave', group: 'Travel', icon: { ui: 'teleport-grave' }, run: (g) => g.teleports?.start('grave') },
    quest: { label: 'Next quest step', group: 'Play', icon: { tab: 'quests' }, run: (g) => nextQuestStep(g) },
    battle: { label: 'Auto battle', group: 'Play', icon: { skill: 'attack' }, run: (g) => g.toggleAutoBattle(), on: (g) => !!g.autoBattle },
    gather: { label: 'Auto gather', group: 'Play', icon: { skill: 'woodcutting' }, run: (g) => g.toggleAutoGather(), on: (g) => !!g.autoGather },
    autoquest: { label: 'Auto quest', group: 'Play', icon: { tab: 'achievements' }, run: (g) => g.toggleAutoQuest(), on: (g) => !!g.autoQuest },
    eat: { label: 'Eat best food', group: 'Play', icon: { item: 'cooked_chicken' }, run: (g) => quickUse(g) },
    potion: { label: 'Drink best potion', group: 'Play', icon: { item: 'attack_potion' }, run: (g) => drinkBestPotion(g) },
    equip: { label: 'Equip best gear', group: 'Play', icon: { tab: 'equipment' },
      run: (g) => { const n = g.equipBest(); if (!n) g.msg('Nothing in your pack beats what you wear right now.', 'system'); return n; } },
  };
  for (const [key, label, icon, open] of WINDOWS) A[`win:${key}`] = { label, group: 'Windows', icon, run: (g, ui) => ui && open(ui, g) };
  for (const s of GO_SKILLS) A[`go:${s}`] = { label: `Go: ${skillName(s)}`, group: 'Skilling spots', icon: { skill: s }, run: (g) => goSkill(g, s) };
  return A;
})();

/** A saved bar, cleaned: always QB_SLOTS long, unknown actions dropped.
 *  Anything that isn't an array (an older save) gives the defaults. */
export function loadQuickbar(raw) {
  if (!Array.isArray(raw)) return QB_DEFAULT.slice();
  return Array.from({ length: QB_SLOTS }, (_, i) => (typeof raw[i] === 'string' && QB_ACTIONS[raw[i]] ? raw[i] : null));
}

/** The bar on this game: a loaded one is cleaned the first time it is asked
 *  for (save.js only copies the strings), and a new game gets the defaults. */
export function quickbarOf(game) {
  if (!game.quickbar || game._qbClean !== game.quickbar) game._qbClean = game.quickbar = loadQuickbar(game.quickbar);
  return game.quickbar;
}

/** Put an action (or null) in a slot. */
export function setQuickSlot(game, i, key) {
  const bar = quickbarOf(game);
  if (i < 0 || i >= QB_SLOTS) return;
  bar[i] = key && QB_ACTIONS[key] ? key : null;
  game.bus?.emit('quickbar');
}

/** Run an action by key (a slot's tap, its hotkey, or a command search result). */
export function runQuickAction(game, key, ui = game.ui) {
  const a = QB_ACTIONS[key];
  if (!a) return false;
  const r = a.run(game, ui);
  game.bus?.emit('quickbar');
  return r;
}
