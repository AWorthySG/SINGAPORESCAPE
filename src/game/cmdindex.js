// Command search: one box (/ or Ctrl+K, or the magnifier on the quick bar)
// that finds windows, quick-bar actions, skills, places, quests, monsters and
// the items in your bag, bank and gear by a few typed letters ("smlt" finds
// Smithing's smelting, "toman" the Toman Tyrant). This file is the index and
// the matching, with no DOM; src/ui/cmdsearch.js draws the box and runs a pick.
//
// Cheap by design: the fixed parts (actions, skills, quests, monsters) are
// built once, on the first search; places once per world; only the items
// (which change as you play) are gathered afresh on each search, from the
// ~30 bag slots, the bank and what you wear.
import { SKILLS } from '../data/skills.js';
import { QUESTS } from '../data/quests.js';
import { getNpc } from '../data/npcs.js';
import { getItem, ITEMS } from '../data/items.js';
import { POTIONS } from '../data/trades.js';
import { EQUIP_SLOTS } from './equipment.js';
import { CODEX_IDS } from './codex.js';
import { QB_ACTIONS, GO_SKILLS } from './quickbar.js';

export const CMD_LIMIT = 8;

// Other words a player might type for a skill (what you do with it, where).
const SKILL_WORDS = {
  smithing: 'smelt smelting bars furnace anvil forge', mining: 'ore rocks pickaxe', woodcutting: 'chop trees logs axe',
  fishing: 'fish net rod', cooking: 'cook range food', firemaking: 'fire logs tinderbox', crafting: 'jewellery gems leather',
  fletching: 'bows arrows', herblore: 'potions brew herbs', farming: 'seeds crops patch', hunter: 'traps snare',
  thieving: 'steal pickpocket stalls', agility: 'course marks', prayer: 'blessings bones faith altar', slayer: 'tasks',
  attack: 'melee', magic: 'spells', ranged: 'bow gun', hitpoints: 'hp life',
};
// And for the windows and actions.
const ACTION_WORDS = {
  bank: 'deposit withdraw loot', home: 'town kampong teleport recall', grave: 'death gravestone', quest: 'go journal next step',
  battle: 'fight combat auto', gather: 'skilling auto', autoquest: 'auto quests', eat: 'food heal', potion: 'drink brew buff',
  equip: 'wear upgrade', 'win:bag': 'inventory pack', 'win:gear': 'equipment worn', 'win:prayer': 'blessings faith',
  'win:journal': 'quests', 'win:awards': 'achievements', 'win:map': 'travel mrt', 'win:codex': 'bestiary monsters',
  'win:compendium': 'guide help how', 'win:mastery': 'enchant refine upgrade dismantle', 'win:shrine': 'offer offering points blessings',
  'win:improve': 'all worn gear safe stars lines feed boost',
  'win:settings': 'options sound graphics',
};

/** Lower case, letters and digits only, single spaces. */
export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** How well one query matches a text: 0 for no match, higher is better.
 *  Whole text, then its start, then a word's start, then anywhere, then the
 *  letters in order (a subsequence, "smlt" in "smelting"), the tighter the better.
 *  Every word of the query has to match. */
export function matchScore(query, text) {
  const q = norm(query), t = norm(text);
  if (!q || !t) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 900 - Math.min(80, t.length - q.length);
  const words = q.split(' ');
  let total = 0;
  for (const w of words) {
    const s = wordScore(w, t);
    if (!s) return 0;
    total += s;
  }
  return Math.round(total / words.length) - Math.min(40, t.length / 4);
}

function wordScore(w, t) {
  const at = t.indexOf(w);
  if (at === 0 || (at > 0 && t[at - 1] === ' ')) return 800;
  if (at > 0) return 600;
  // The letters in order, starting at the start of a word ("smlt" in
  // "smelting"): the tightest run wins, and later letters that start words help.
  let best = 0;
  for (let k = 0; k < t.length; k++) {
    if (t[k] !== w[0] || (k > 0 && t[k - 1] !== ' ')) continue;
    let i = k + 1, gaps = 0, last = k, starts = 1, ok = true;
    for (const c of w.slice(1)) {
      const j = t.indexOf(c, i);
      if (j < 0) { ok = false; break; }
      gaps += j - last - 1;
      if (t[j - 1] === ' ') starts++;
      last = j; i = j + 1;
    }
    if (!ok || gaps > w.length * 3) continue;   // scattered letters across a long name aren't a match
    best = Math.max(best, 450 - gaps * 25 + starts * 20);
  }
  return best > 0 ? Math.max(50, best) : 0;
}

// A little nudge so commands come before things when the match is as good.
const KIND_BONUS = { action: 30, window: 30, skill: 25, quest: 10, place: 10, monster: 0, item: 5 };

let STATIC = null;
/** The fixed part of the index (built on the first search). */
export function staticEntries() {
  if (STATIC) return STATIC;
  const out = [];
  for (const [key, a] of Object.entries(QB_ACTIONS)) {
    if (key.startsWith('go:')) continue;   // a skill's own entry carries its Go
    out.push({ kind: key.startsWith('win:') ? 'window' : 'action', id: key, label: a.label, words: ACTION_WORDS[key] || '', icon: a.icon });
  }
  for (const s of SKILLS) {
    if (s.hidden) continue;
    out.push({ kind: 'skill', id: s.id, label: s.name, words: SKILL_WORDS[s.id] || '', icon: { skill: s.id }, go: GO_SKILLS.includes(s.id) });
  }
  for (const q of QUESTS) out.push({ kind: 'quest', id: q.id, label: q.name, words: 'quest', icon: { tab: 'quests' } });
  for (const id of CODEX_IDS) {
    const d = getNpc(id);
    out.push({ kind: 'monster', id, label: d.name, words: d.boss ? 'boss' : '', icon: { skill: 'slayer' }, boss: !!d.boss, level: d.level || 1 });
  }
  STATIC = out;
  return out;
}

/** The places: every region of this world (once per world). */
export function placeEntries(game) {
  if (game._cmdPlaces?.world === game.world) return game._cmdPlaces.list;
  const list = (game.world?.zones || []).filter((z) => !z.instance && z.name)
    .map((z) => ({ kind: 'place', id: z.name, label: z.name, words: 'region place travel', icon: { play: 'ui-places' } }));
  game._cmdPlaces = { world: game.world, list };
  return list;
}

/** The items you have, with where they are: bag slots first, then worn, then the bank. */
export function itemEntries(game) {
  const by = new Map();
  const note = (id, where, n = 1, index = null) => {
    if (!id || !ITEMS[id]) return;
    let e = by.get(id);
    if (!e) by.set(id, e = { kind: 'item', id, label: getItem(id).name, words: '', icon: { item: id }, bag: 0, bank: 0, worn: false, index: null });
    if (where === 'bag') { e.bag += n; if (e.index === null) e.index = index; } else if (where === 'bank') e.bank += n; else e.worn = true;
  };
  game.inventory?.slots?.forEach((s, i) => s && note(s.id, 'bag', s.qty || 1, i));
  for (const slot of EQUIP_SLOTS) note(game.equipment?.get?.(slot), 'worn');
  for (const e of game.bank?.items || []) note(e.id, 'bank', e.qty);
  return [...by.values()];
}

/** What a picked item would do first: 'equip', 'eat', 'drink', 'bank' (fetch it) or 'info'. */
export function itemVerb(game, e) {
  if (e.bag > 0) {
    const it = getItem(e.id);
    if (POTIONS[e.id]) return 'drink';
    if (it.heal) return 'eat';
    if (it.equip) return 'equip';
    return 'info';
  }
  return e.bank > 0 ? 'bank' : 'info';
}

/** Search everything: the best `limit` entries, best first, each with its score. */
export function searchCommands(game, query, limit = CMD_LIMIT) {
  if (!norm(query)) return [];
  const all = [...staticEntries(), ...placeEntries(game), ...itemEntries(game)];
  const hits = [];
  for (const e of all) {
    const s = Math.max(matchScore(query, e.label), e.words ? Math.round(matchScore(query, e.words) * 0.85) : 0);
    if (s > 0) hits.push({ ...e, score: s + (KIND_BONUS[e.kind] || 0) + (e.boss ? 15 : 0) });   // bosses are what people look up
  }
  hits.sort((a, b) => b.score - a.score || a.label.length - b.label.length || a.label.localeCompare(b.label));
  return hits.slice(0, limit);
}
