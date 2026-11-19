// What a level-up just opened: the chat line "Congratulations, you just
// advanced a Woodcutting level!" used to stop there, so new trees, recipes and
// gear slipped by unnoticed. levelNews lists them (a gathering source you can
// now work, a recipe you can now make, gear for your class you can now wear),
// and ui.js adds the short list to the level-up line and, on a milestone, to
// the banner. Pure: no DOM, so the tests read it headlessly.
import { ITEMS } from '../data/items.js';
import { canWear, canWield } from '../data/classes.js';
import { gatherSources, allRecipes, recipeLabel } from './skillguide.js';

// How many names the chat line spells out before "and N more".
export const NEWS_NAMES = 4;

let _gear = null;
/** Every wearable piece with its skill requirements: [{ id, name, req }] (cached). */
function gearReqs() {
  if (_gear) return _gear;
  _gear = Object.entries(ITEMS).filter(([, it]) => it.equip && !it.tool && it.equip.req && Object.keys(it.equip.req).length)
    .map(([id, it]) => ({ id, name: it.name, req: it.equip.req, type: it.equip.weaponType || null }));
  return _gear;
}

/** What opened when `skill` went from level `from` to `to` (from < lvl <= to):
 *  { gather: [name], make: [name], gear: [name] }. Gear counts only pieces your
 *  class can wear, and only once every other skill it asks for is met too. */
export function levelNews(game, skill, from, to) {
  const opened = (lvl) => lvl > from && lvl <= to;
  const gather = [...new Set(gatherSources().filter((s) => s.skill === skill && opened(s.level)).map((s) => s.name))];
  const make = [...new Set(allRecipes().filter((r) => r.skill === skill && opened(r.level) && r.kind !== 'bury').map(recipeLabel))];
  const gear = [];
  for (const g of gearReqs()) {
    const need = g.req[skill];
    if (!need || !opened(need)) continue;
    // Only what your class can put on: its armour family and its weapon types.
    if (game?.jobClass && (!canWear(game.jobClass, g.id) || !canWield(game.jobClass, g.type))) continue;
    const others = Object.entries(g.req).every(([s, l]) => s === skill || (game?.skills?.level?.(s) || 1) >= l);
    if (others) gear.push(g.name);
  }
  return { gather, make, gear: [...new Set(gear)] };
}

/** The news as one short phrase, or '' when nothing opened:
 *  "Now open: Oak tree, Bronze bar and 3 more." */
export function levelNewsText(news, max = NEWS_NAMES) {
  const all = [...news.gather, ...news.make, ...news.gear];
  if (!all.length) return '';
  const shown = all.slice(0, max);
  const more = all.length - shown.length;
  return `Now open: ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}.`;
}
