// "Feed materials to worn gear" in one go (the owner's ask: the gear screens
// were troublesome, a window and a tap per material per piece). Plans what
// your pack's materials would add to each piece you wear, up to Master (the
// cap materials can reach), then feeds it with Game.feedMastery, the same as
// feeding by hand. Kept out of game.js and ui.js; the Gear Mastery window
// shows the plan and asks before anything is used up.

import { EQUIP_SLOTS } from './equipment.js';
import { feedXp, FEED_CAP } from './materials.js';

/**
 * What feeding everything would do: [{ gearId, matId, n, xp }], one entry per
 * material per worn piece, best materials first, stopping at the cap. Each
 * material is shared out in the order of the slots, and never counted twice.
 */
export function feedAllPlan(game) {
  const left = new Map();
  for (const s of game.inventory.slots) if (s) left.set(s.id, (left.get(s.id) || 0) + s.qty);
  const worn = [...new Set(EQUIP_SLOTS.map((s) => game.equipment.get(s)).filter(Boolean))];
  const plan = [];
  for (const gearId of worn) {
    let pts = game.equipment.masteryXp(gearId);
    if (pts >= FEED_CAP) continue;
    const opts = [...left.keys()].map((id) => ({ id, per: feedXp(gearId, id) })).filter((o) => o.per > 0).sort((a, b) => b.per - a.per);
    for (const o of opts) {
      if (pts >= FEED_CAP) break;
      const n = Math.min(left.get(o.id), Math.ceil((FEED_CAP - pts) / o.per));
      if (n <= 0) continue;
      plan.push({ gearId, matId: o.id, n, xp: n * o.per });
      left.set(o.id, left.get(o.id) - n);
      pts += n * o.per;
    }
  }
  return plan;
}

/** Feed the plan. Returns the total mastery XP added. */
export function feedAll(game, plan = feedAllPlan(game)) {
  let xp = 0;
  for (const p of plan) xp += game.feedMastery(p.gearId, p.matId, p.n);
  return xp;
}
