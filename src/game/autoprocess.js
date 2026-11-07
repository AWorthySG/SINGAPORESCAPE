// "Do all" at a crafting station: work through every recipe you can make there,
// best (highest level) first, one after another, until nothing is left you can
// make. Smelt all your ore, cook all your fish, fletch all your logs, brew all
// your herbs, smith all your bars, craft all your gems and clay.
import { COOKING } from './skilling.js';
import { DISHES } from '../data/cooking.js';
import { SMELT, SMITH } from '../data/smithing.js';
import { CRAFT } from '../data/crafting.js';
import { POTIONS, FLETCH } from '../data/trades.js';

/** The station kinds a "Do all" can run at. */
export const AUTO_KINDS = ['cook', 'smelt', 'smith', 'craft', 'fletching', 'herblore'];

const has = (game, id, n) => game.inventory.has(id, n);
const best = (list) => list.sort((a, b) => b.level - a.level)[0] || null;
const key = (job) => `${job.type}:${job.rawId || job.recipe?.result || ''}`;

/** Fletching or Herblore recipes in one shape ({ result, qty, inputs: [[id, n]], level, xp, tool }). */
export function tradeRecipes(skill) {
  return skill === 'herblore'
    ? Object.entries(POTIONS).map(([id, p]) => ({ result: id, qty: 1, inputs: p.inputs, level: p.level, xp: p.xp }))
    : FLETCH;
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
    const r = best(SMITH.filter((x) => lvl('smithing') >= x.level && has(game, x.bar, x.barCount) && !skip.has(`smith:${x.result}`)));
    job = r && { type: 'smith', recipe: r };
  } else if (kind === 'craft') {
    const r = best(CRAFT.filter((x) => (!x.tool || game.hasTool(x.tool)) && lvl('crafting') >= x.level && x.inputs.every((i) => has(game, i.id, i.qty)) && !skip.has(`craft:${x.result}`)));
    job = r && { type: 'craft', recipe: r };
  } else if (kind === 'fletching' || kind === 'herblore') {
    const r = best(tradeRecipes(kind).filter((x) => (!x.tool || game.hasTool(x.tool)) && lvl(kind) >= x.level
      && x.inputs.every(([id, n]) => has(game, id, n)) && !skip.has(`recipe:${x.result}`)));
    job = r && { type: 'recipe', skill: kind, recipe: r };
  }
  return ok(job) ? job : null;
}

export const jobKey = key;
