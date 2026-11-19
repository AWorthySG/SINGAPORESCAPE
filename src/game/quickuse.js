// The quick-use slot (beside the Attack button on touch screens, F on a
// keyboard): which food or healing potion one tap uses. It picks the one that
// best fills the life you're missing (the smallest heal that covers it, or the
// biggest when none does), so a nibble isn't wasted on a big wound and a feast
// isn't wasted on a scratch. Buff potions are left for you to choose by hand.
import { getItem } from '../data/items.js';
import { POTIONS } from '../data/trades.js';
import * as Culling from './culling.js';

/** How much one of `id` would heal you now (0 when it doesn't heal). */
export function healOf(game, id) {
  const item = getItem(id);
  const max = game.maxHp();
  const pot = POTIONS[id];
  if (pot) return pot.fx.heal ? Math.round(max * pot.fx.heal) : 0;
  if (!item?.heal) return 0;
  return Math.round((item.healPct ? Math.max(item.heal, Math.round(max * item.healPct)) : item.heal) * Culling.foodMult(game));
}

/** What a tap would use: { index, id, count, heal, drink } or null when you
 *  carry nothing that heals. */
export function quickUseChoice(game) {
  const missing = Math.max(0, game.maxHp() - game.player.hp);
  const seen = new Map();   // id -> { index of its first slot, count }
  game.inventory.slots.forEach((s, i) => {
    if (!s) return;
    const e = seen.get(s.id);
    if (e) e.count += s.qty || 1;
    else seen.set(s.id, { index: i, count: s.qty || 1 });
  });
  let best = null;
  for (const [id, e] of seen) {
    const heal = healOf(game, id);
    if (heal <= 0) continue;
    const c = { index: e.index, id, count: e.count, heal, drink: !!POTIONS[id] };
    if (!best) { best = c; continue; }
    const covers = c.heal >= missing, bestCovers = best.heal >= missing;
    // Covering the wound beats falling short; among those that cover it the
    // smallest wins, among those that don't the biggest. Food before potions on a tie.
    const better = covers !== bestCovers ? covers
      : covers ? (c.heal < best.heal || (c.heal === best.heal && best.drink && !c.drink))
        : (c.heal > best.heal || (c.heal === best.heal && best.drink && !c.drink));
    if (better) best = c;
  }
  return best;
}

/** Eat or drink the quick-use choice. Returns what was used, or null. */
export function quickUse(game) {
  const c = quickUseChoice(game);
  if (!c) { game.msg('You have no food to eat.'); return null; }
  if (c.drink) game.drinkPotion(c.index); else game.eatItem(c.index);
  return c;
}
