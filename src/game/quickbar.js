// The quick bar: a few one-tap favourites beside the HUD (bank, next quest
// step, auto battle, eat...), chosen by the player. Every action here only
// calls what the game already does from its own buttons (the journal's Go, the
// skill guide's Go, the auto switches, the F key's quick use), so nothing about
// how those work is repeated. src/ui/quickbar.js draws the bar and its edit
// window; this file has no DOM, so the tests can drive it headlessly.
//
// Saved as `game.quickbar`: an array of QB_SLOTS action keys (null for an
// empty slot). Older saves have none and get QB_DEFAULT.
import { POTIONS, CROP_BY_SEED, cropFor } from '../data/trades.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { SKILL_GUIDES } from './skillguide.js';
import { quickUse, quickUseChoice } from './quickuse.js';
import { nextQuest, bestSource, bestGatherPick, bestWorkable } from './whatnext.js';
import { nearOfferingShrine } from './salvage.js';
import { nextJob } from './autoprocess.js';

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

// Life skill shortcuts (the owner's ask): the Life skills button on the quick
// bar opens a grid of every life skill, and one tap goes and starts it: the
// best tree, rock, fishing spot or trail you can work (with auto gather on and
// kept to the best you can gather, moving up as you level), the nearest station making everything you
// can there (best first), a fire from your logs, the farm patch that needs
// you, the Slayer master for a task. Thieving and Agility walk to their best
// spot, like their Go.
export const LIFE_SHORTCUTS = ['woodcutting', 'mining', 'fishing', 'hunter', 'farming', 'cooking', 'smithing',
  'crafting', 'fletching', 'herblore', 'firemaking', 'thieving', 'agility', 'slayer'];
const GATHERING = new Set(['woodcutting', 'mining', 'fishing', 'hunter']);
// Each making skill's "Do all" (autoprocess.js nextJob) and where it is done,
// first choice first: ore goes to the furnace before bars go to the anvil.
const MAKING = {
  cooking: [['cook', ['range', 'fire']]],
  smithing: [['smelt', ['furnace']], ['smith', ['anvil']]],
  crafting: [['craft', ['crafting_table']]],
  fletching: [['fletching', ['fletching_bench']]],
  herblore: [['herblore', ['apothecary_table']]],
};
const NOTHING_TO_MAKE = {
  cooking: 'You have nothing you can cook: catch some fish or buy something raw first.',
  smithing: 'You have nothing to smelt or smith: mine some ore first (and carry a hammer for the anvil).',
  crafting: 'You have nothing you can craft yet: gather its materials (gems, bars, hides or clay) first.',
  fletching: 'You have nothing you can fletch: chop some logs first (and carry a knife).',
  herblore: 'You have nothing you can brew: farm or forage some herbs first.',
};

/** The making job a shortcut would start, and where: { kind, where } or null. */
function makingJob(game, skill) {
  for (const [kind, where] of MAKING[skill] || []) if (nextJob(game, kind)) return { kind, where };
  return null;
}

/** The farm patch that needs you: a crop ready to pick first, then an empty
 *  patch when you carry a seed you can plant; the nearest of them. */
function patchToTend(game) {
  const lvl = game.skills.level('farming'), p = game.playerTile();
  const seeds = game.inventory.slots.some((sl) => sl && CROP_BY_SEED[sl.id] && cropFor(CROP_BY_SEED[sl.id][0]).level <= lvl);
  let best = null, rank = 2, bd = Infinity;
  for (const o of game.world.objects) {
    if (o.def?.type !== 'farm') continue;
    const r = o.crop ? (o.growLeft > 0 ? 2 : 0) : seeds ? 1 : 2;
    const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
    if (r < rank || (r === rank && r < 2 && d < bd)) { best = o; rank = r; bd = d; }
  }
  return best ? { obj: best, ready: rank === 0 } : { seeds };
}

/** A shortcut's one-line note for the grid: what a tap would do now. */
export function lifeShortcutHint(game, skill) {
  if (GATHERING.has(skill)) {
    const pick = bestGatherPick(game, skill);
    return pick ? `${pick.src.name} (lvl ${pick.src.level})` : 'Nothing at your level yet';
  }
  if (skill === 'thieving' || skill === 'agility') {
    const src = bestSource(game, skill);
    return src ? `${src.src.name} (lvl ${src.src.level})` : 'Nothing at your level yet';
  }
  if (MAKING[skill]) return makingJob(game, skill) ? 'Make everything you can' : 'Nothing to make yet';
  if (skill === 'firemaking') return game.burnableLogs?.().length ? 'Light a fire from your logs' : 'No logs to burn';
  if (skill === 'farming') { const t = patchToTend(game); return t.obj ? (t.ready ? 'A crop is ready to pick' : 'Plant your seeds') : 'Nothing to plant or pick'; }
  if (skill === 'slayer') return 'Get a task from Rajan';
  return '';
}

/** Go and start a life skill (a tap in the Life skills grid). Returns true when
 *  something started: a walk, a fire, a batch made on the spot. */
export function startLifeSkill(game, skill, ui = game.ui) {
  if (!game.player.alive) return false;
  // Skilling, not fighting: auto battle would only pull you away again. So would
  // auto quest, off to its next step (it rode you straight back from the MRT ride
  // a shortcut had just taken).
  if (game.autoBattle) game.toggleAutoBattle(false);
  if (game.autoQuest) game.toggleAutoQuest(false, `you went to train ${skillName(skill)}.`);
  if (GATHERING.has(skill)) {
    // The best source you can get to without crossing a region too strong for
    // you or coming within reach of a monster that would set on you, riding the
    // MRT where that helps or is the only safe way (whatnext.js).
    const pick = bestGatherPick(game, skill);
    if (!pick) { game.msg(`There's nothing for ${skillName(skill)} I can take you to right now.`, 'system'); return false; }
    // Auto gather keeps you at it, always on the best the skill offers you (the
    // owner's ask): the highest-level source your level and tools allow, waiting
    // for its nodes to grow back rather than dropping to a lesser one, and moving
    // up when a level opens a better one close by (game.js autoGatherBest).
    if (!game.autoGather) game.toggleAutoGather(true);
    if (!game.goToObject(pick.obj, null, pick.trip)) return false;
    game.autoGatherBest = skill;
    if (game.player.action?.obj === pick.obj) game.player.action.best = true;   // the mode's own pick: one you choose yourself ends it...
    game._autoLife = { kind: 'gather', objId: pick.obj.objId };   // ...unless it's of this kind (game.js _tickContinuous)
    // Better ones your level allows stand where monsters that would set on you
    // roam, or past them: say so, or Mining 99 heading for a clay rock looks broken.
    const top = bestWorkable(game, skill);
    if (top && top.level > pick.src.level) game.msg(`That's the best you can get to safely: ${top.name} (${skillName(skill)} ${top.level}) lies among or past monsters that would set on you.`, 'system');
    return true;
  }
  if (MAKING[skill]) {
    const job = makingJob(game, skill);
    if (!job) { game.msg(NOTHING_TO_MAKE[skill], 'system'); return false; }
    return game.goToNearest(job.where, (obj) => game.startAll(job.kind, obj));
  }
  if (skill === 'firemaking') {
    // How many logs go on the fire is yours to choose (or all of them).
    if (ui?.askFireLogs && game.burnableLogs?.().length) { ui.askFireLogs(null); return true; }
    return !!game.startFiremaking();
  }
  if (skill === 'farming') {
    const t = patchToTend(game);
    if (!t.obj) {
      game.msg(t.seeds ? 'Every farm patch is busy growing: come back when a crop is ready.'
        : 'Nothing is ready to pick and you have no seeds to plant. The farmer at Kranji or in Kampong Glam sells them.', 'system');
      return false;
    }
    return game.goToObject(t.obj);
  }
  if (skill === 'slayer') {
    const npc = game.npcs.find((n) => n.npcId === 'slayer_master' && n.alive);
    if (!npc) { game.msg("I can't find the Slayer master anywhere.", 'system'); return false; }
    return game.goToNpc(npc);
  }
  return goSkill(game, skill);   // Thieving, Agility
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
  ['life', 'Life skills', { tab: 'skills' }, (ui) => ui.openLifeSkills?.()],   // (added by src/ui/quickbar.js)
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
  for (const s of LIFE_SHORTCUTS) A[`life:${s}`] = { label: `Start: ${skillName(s)}`, group: 'Life skills', icon: { skill: s }, run: (g, ui) => startLifeSkill(g, s, ui) };
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
