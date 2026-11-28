// "Do all" at a crafting station: work through every recipe you can make there,
// best (highest level) first, one after another, until nothing is left you can
// make. Smelt all your ore, cook all your fish, fletch all your logs, brew all
// your herbs, smith all your bars, craft all your gems and clay, and saw,
// fire and build all your Construction materials (one kind of station each).
import { COOKING } from './skilling.js';
import { DISHES } from '../data/cooking.js';
import { SMELT, SMITH } from '../data/smithing.js';
import { CRAFT } from '../data/crafting.js';
import { POTIONS, FLETCH } from '../data/trades.js';
import { CONSTRUCT, CON_STATIONS, conRecipes } from '../data/construction.js';
import { SIGNATURE } from '../data/hawkering.js';
import { restoreRecipes } from '../data/archaeology.js';
import { getItem } from '../data/items.js';
import { flushUnlockNews } from './skillunlocks.js';

/** The station kinds a "Do all" can run at. */
export const AUTO_KINDS = ['cook', 'smelt', 'smith', 'craft', 'fletching', 'herblore', 'hawkering', 'archaeology', ...CON_STATIONS];
// Construction's kinds are its station types (construction.js): a sawmill, a kiln, a workbench and the home workbench.
const CON_KINDS = new Set(CON_STATIONS);

const has = (game, id, n) => game.inventory.has(id, n);
const best = (list) => list.sort((a, b) => b.level - a.level)[0] || null;
const key = (job) => `${job.type}:${job.rawId || job.recipe?.result || ''}`;

/** Fletching, Herblore, Construction, Hawkering (the stall's wok) or Archaeology's restoring recipes in one shape ({ result, qty, inputs: [[id, n]], level, xp, tool }). */
const RESTORE = restoreRecipes();
export function tradeRecipes(skill) {
  if (skill === 'construction') return CONSTRUCT;
  if (skill === 'hawkering') return SIGNATURE;
  return skill === 'herblore'
    ? Object.entries(POTIONS).map(([id, p]) => ({ result: id, qty: 1, inputs: p.inputs, level: p.level, xp: p.xp }))
    : skill === 'archaeology' ? RESTORE : FLETCH;
}

/** The next job for a "Do all" at this kind of station, skipping jobs in `skip`
 *  (ones that already stopped this run), or null when there's nothing left. */
export function nextJob(game, kind, skip = new Set()) {
  const lvl = (s) => game.skills.level(s);
  const ok = (job) => job && !skip.has(key(job));
  let job = null;
  if (kind === 'cook') {
    const raws = Object.keys(COOKING).filter((id) => has(game, id, 1) && lvl('cooking') >= COOKING[id].level && !skip.has(`cook:${id}`));
    raws.sort((a, b) => COOKING[b].level - COOKING[a].level);
    if (raws.length) return { type: 'cook', rawId: raws[0] };
    const d = best(DISHES.filter((r) => lvl('cooking') >= r.level && r.inputs.every((i) => has(game, i.id, i.qty)) && !skip.has(`cookdish:${r.result}`)));
    job = d && { type: 'cookdish', recipe: d };
  } else if (kind === 'smelt') {
    const r = best(SMELT.filter((x) => lvl('smithing') >= x.level && x.inputs.every((i) => has(game, i.id, i.qty)) && !skip.has(`smelt:${x.result}`)));
    job = r && { type: 'smelt', recipe: r };
  } else if (kind === 'smith') {
    if (!game.hasTool('hammer')) return null;
    // Upgrade stones, scrolls and wards are only made by choice (`upgrade`), never by "Do all".
    const r = best(SMITH.filter((x) => !x.upgrade && lvl('smithing') >= x.level && has(game, x.bar, x.barCount) && !skip.has(`smith:${x.result}`)));
    job = r && { type: 'smith', recipe: r };
  } else if (kind === 'craft') {
    const r = best(CRAFT.filter((x) => !x.upgrade && (!x.tool || game.hasTool(x.tool)) && lvl('crafting') >= x.level && x.inputs.every((i) => has(game, i.id, i.qty)) && !skip.has(`craft:${x.result}`)));
    job = r && { type: 'craft', recipe: r };
  } else if (kind === 'fletching' || kind === 'herblore' || kind === 'hawkering' || kind === 'archaeology') {
    const r = best(tradeRecipes(kind).filter((x) => !x.upgrade && (!x.tool || game.hasTool(x.tool)) && lvl(kind) >= x.level
      && x.inputs.every(([id, n]) => has(game, id, n)) && !skip.has(`recipe:${x.result}`)));
    job = r && { type: 'recipe', skill: kind, recipe: r };
  } else if (CON_KINDS.has(kind)) {
    // A workbench builds furniture; the home workbench saws planks too:
    // furniture first, as the best (highest level) make, then planks.
    const r = best(conRecipes(kind).filter((x) => (!x.tool || game.hasTool(x.tool)) && lvl('construction') >= x.level
      && x.inputs.every(([id, n]) => has(game, id, n)) && !skip.has(`recipe:${x.result}`)));
    job = r && { type: 'recipe', skill: 'construction', recipe: r };
  }
  return ok(job) ? job : null;
}

export const jobKey = key;

// ---------------- Instant batches ----------------
// Making at a station is instant (the owner's call, as smelting already was):
// choosing a recipe makes the amount picked in the station window (all the
// pack allows unless you chose 1, 5, 10 or X), and "Do all" makes everything.
// Each item is still its own roll through the resolver and the skill's unlocks
// (perfect cooks, flawless extras, kept materials, level-ups part-way through),
// so the odds and the XP are what one-at-a-time making gave; only the waiting
// and the chat line per item are gone.

const VERB = { cook: 'cook', cookdish: 'prepare', smith: 'smith', craft: 'craft', fletching: 'fletch', herblore: 'brew', construction: 'make', hawkering: 'cook', archaeology: 'restore' };
const BONUS = { cook: 'perfectly cooked', smith: 'extra from flawless work' };
const plural = (name, n) => (n === 1 || name.endsWith('s') ? name : `${name}s`);

/** How many makes an action may run: its `limit` (the amount chosen in the
 *  station window, ui/makeqty.js), or all the pack allows. The guard keeps a
 *  bug from looping for ever. */
export const makeCap = (a) => Math.min(a.limit > 0 ? a.limit : Infinity, 100000);

/** What a make action trains and produces: { skill, result }. */
function makeInfo(a) {
  if (a.type === 'cook') return { skill: 'cooking', result: COOKING[a.rawId]?.result };
  if (a.type === 'recipe') return { skill: a.skill, result: a.recipe?.result };
  return { skill: a.type === 'craft' ? 'crafting' : a.type === 'smith' ? 'smithing' : 'cooking', result: a.recipe?.result };
}

/** Make one recipe as many times as the pack allows, all at once, and say what
 *  came out in one line. `once` makes a single item (the resolver wrapped in the
 *  skill's unlocks) and returns whether another can follow. Returns the count made. */
function batchOne(game, a, once) {
  const { skill, result } = makeInfo(a);
  const xp0 = game.skills.xp[skill] || 0, have0 = result ? game.inventory.count(result) : 0;
  const t = a.tally = { burnt: 0, bonus: 0, kept: 0 };
  // At most `a.limit` makes when the station window's amount is 1, 5, 10 or X
  // (makeCap); each call of `once` works one lot of inputs, so a fish that
  // burns still counts as one of them (five raw fish off the pile, as asked).
  const cap = makeCap(a);
  try {
    for (let n = 0; n < cap && once(); n++) { /* keep making */ }
  } finally { a.tally = null; }
  const made = result ? game.inventory.count(result) - have0 : 0;
  const xp = Math.round((game.skills.xp[skill] || 0) - xp0);
  if (made <= 0 && !t.burnt) return 0;
  const name = getItem(result).name.toLowerCase();
  const kind = a.type === 'recipe' ? a.skill : a.type;
  const notes = [];
  if (t.bonus) notes.push(`${t.bonus} ${BONUS[kind] || 'extra'}`);
  if (t.burnt) notes.push(`${t.burnt} burnt`);
  if (t.kept) notes.push(`materials kept ${t.kept} time${t.kept === 1 ? '' : 's'}`);
  const sname = skill[0].toUpperCase() + skill.slice(1);
  game.msg(`You ${VERB[kind] || 'make'} ${made} ${plural(name, made)}${notes.length ? ` (${notes.join(', ')})` : ''}.`
    + (xp > 0 ? ` +${xp.toLocaleString('en-GB')} ${sname} XP.` : ''));
  return made;
}

/** Run a whole instant batch (`fn`) with its news held: the bag's 'inventory'
 *  and each skill's 'xp' are told once at the end, not once per item (5,000 raw
 *  fish made the bag grid, quick-use slot and XP drop redraw 5,000 times in one
 *  tick, a freeze of seconds). A pet roll still counts every item made (pets.js).
 *  Nested batches (smeltBatch inside "Smelt all") leave it to the outer one. */
export function batched(game, fn) {
  const pets = game.pets?.hold(), xp = game.skills.hold?.(), inv = game.inventory.hold?.();
  // Level-up news gathered too: each skill's unlocks in one line and banner, and
  // only the last of its life-skill perk notes (each one supersedes the one before).
  const news = game._batchNews ? null : (game._batchNews = { unlocks: {}, notes: new Map() });
  try { return fn(); } finally {
    // The bag first, then the XP (which the pets count), then the pet rolls.
    if (inv) game.inventory.release();
    if (xp) game.skills.release();
    if (pets) game.pets.release();
    if (news) {
      game._batchNews = null;
      for (const [text, cls] of news.notes.values()) game.msg(text, cls);
      flushUnlockNews(game, news.unlocks);
    }
  }
}

/** The instant make at a station (cook, cookdish, smith, craft, recipe): this
 *  recipe's whole batch, and with "Do all" every recipe after it, in the same
 *  moment. `once(a)` makes one item of whatever `a` now is (a "Do all" can move
 *  from cooking fish to a dish). One sound and one sparkle for the lot.
 *  Returns false (the station is done). */
export function makeBatch(game, a, once) {
  let any = 0;
  let worked;
  const make = () => {
    const made = batchOne(game, a, () => once(a));
    if (made && !worked) worked = { type: a.type, skill: a.skill, recipe: a.recipe, rawId: a.rawId, obj: a.obj };
    any += made;
  };
  batched(game, () => {
    make();
    while (a.all) {
      (a.done ||= new Set()).add(key(a));
      const nxt = nextJob(game, a.all, a.done);
      if (!nxt || nxt.type === 'smelt') break;
      Object.assign(a, { rawId: undefined, recipe: undefined, skill: undefined }, nxt);
      make();
    }
  });
  if (any > 0) {
    const { skill } = makeInfo(a);
    game.bus.emit('sfx', `make:${skill === 'hawkering' ? 'hawker' : skill}`);
    game.spawnSparkle?.(game.player, '#ffd24a', 10);
    game.bus.emit('skillpose', { action: worked, target: worked.obj });
  }
  return false;
}
