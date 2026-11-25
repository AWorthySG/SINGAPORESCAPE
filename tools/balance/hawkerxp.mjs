// Hawkering XP and coins an hour against the other skills (hawkerstall.js).
//
//   node tools/balance/hawkerxp.mjs                 # levels 30, 99, 200, 500
//   node tools/balance/hawkerxp.mjs --levels 50,300
//   node tools/balance/hawkerxp.mjs --fit           # suggest HAWKER_XP_MULT
//
// An hour of Hawkering is an hour at the stall with auto-serve on, carrying
// plenty of the best dish your level lets customers order: measured headlessly
// through the real stall (a real Game, rented, open, customers arriving and
// being served) for RUN ticks, so the service speed, the counters and the
// unlocks' quick serves are all in. It is set against the gathering average
// (Mining, Woodcutting and Fishing at their best, as productionxp.mjs measures
// it), which the making skills are fitted to as well: Hawkering at about 1 is
// at parity with Smithing, Crafting, Fletching and Construction.
//
// Coins an hour are what that hour takes in (prices and tips), beside Thieving's
// best source at the same level and what the fish of an hour's fishing fetch,
// cooked and sold at half their value (a shop's usual price).
import { parseArgs, printTable } from './common.mjs';
import { playerAt, gatherHour, GATHER } from './productionxp.mjs';
import { xpForLevel } from '../../src/data/xp.js';
import { ORDERS } from '../../src/data/hawkering.js';
import { HAWKER_XP_MULT } from '../../src/game/hawkerstall.js';
import { gatherSources } from '../../src/game/skillguide.js';
import { xpRate, actionXp } from '../../src/game/xprate.js';
import { ITEMS } from '../../src/data/items.js';
import { COOKING } from '../../src/game/skilling.js';

const args = parseArgs();
const levels = String(args.levels || '30,99,200,500').split(',').map(Number);
export const RUN = 3000;   // ticks measured (30 minutes of play)
export const FIT_LEVELS = [1, 10, 30, 60, 99, 150, 200, 300];

/** The best order a Hawkering level allows. */
export const bestOrder = (lvl) => ORDERS.filter((o) => o.level <= lvl).pop();

/** An hour at the stall at the player's Hawkering level, measured: { xp, coins, serves, order }.
 *  (Golden hours and rested XP left out, as the gathering hour leaves them out.) */
export function stallHour(g, ticks = RUN) {
  const h = g.hawker, o = bestOrder(g.skills.level('hawkering'));
  h.rented = true;
  g.bank.deposit(o.id, 100000);
  g.player.x = g.player.tx = h.obj.x; g.player.y = g.player.ty = h.obj.y + 1;
  g.npcs = [];
  if (!g.autoGather) g.toggleAutoGather(true);
  const timeMult = g.skills.timeMult;
  g.skills.timeMult = null;
  const lvl = g.skills.level('hawkering');
  const c0 = g.inventory.count('coins') + g.bank.count('coins'), s0 = h.served;
  try {
    h.open();
    for (let t = 0; t < ticks; t++) {
      g.update(600);
      // Hold the level (and so the multiple) where it is: an hour at these rates would level up part-way.
      if (g.skills.level('hawkering') !== lvl) g.skills.xp.hawkering = xpForLevel(lvl);
    }
  } finally { g.skills.timeMult = timeMult; }
  const scale = 6000 / ticks;
  // XP: counted by the serves (each pays the same at a held level), as the level was held.
  const each = g.skills.xpAtLevel('hawkering', h.xpFor(o.id));
  return { xp: (h.served - s0) * each * scale, coins: (g.inventory.count('coins') + g.bank.count('coins') - c0) * scale, serves: (h.served - s0) * scale, order: o.id };
}

/** Thieving's best coins an hour at a level (coins plus loot at item value). */
export function thievingCoins(g) {
  let best = 0;
  for (const s of gatherSources()) {
    if (s.skill !== 'thieving') continue;
    const r = xpRate(g, s);
    if (!r) continue;
    const per = s.gives.reduce((a, gv) => a + (gv.chance ?? 1) * ((gv.min || 1) + (gv.max || gv.min || 1)) / 2 * (gv.id === 'coins' ? 1 : (ITEMS[gv.id]?.value || 0)), 0);
    best = Math.max(best, r.perHour / actionXp(g, s) * per);
  }
  return best;
}

/** What an hour's fishing fetches: the best catch, cooked, sold at half its value. */
export function fishCoins(perItem) {
  let best = 0;
  for (const [id, n] of perItem) if (COOKING[id]) best = Math.max(best, n * ITEMS[COOKING[id].result].value * 0.5);
  return best;
}

export function survey(lvls = levels, seed = 20261112) {
  const rows = [];
  for (const L of lvls) {
    const g = playerAt(L, seed);
    for (const s of ['hawkering', 'thieving']) g.skills.xp[s] = xpForLevel(L);
    const { perItem, best } = gatherHour(g);
    const avg = GATHER.reduce((a, s) => a + (best[s]?.perHour || 0), 0) / GATHER.length;
    const hour = stallHour(g);
    rows.push({ level: L, order: ITEMS[hour.order].name, xp: hour.xp, ratio: hour.xp / avg, serves: hour.serves, coins: hour.coins, thieving: thievingCoins(g), fish: fishCoins(perItem) });
  }
  return rows;
}

const sig2 = (x) => { const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };
if (import.meta.url === `file://${process.argv[1]}`) {
  if (args.fit) {
    for (const r of HAWKER_XP_MULT) r[1] = 1;
    const rows = survey(args.levels ? levels : FIT_LEVELS);
    console.log(`export const HAWKER_XP_MULT = [${rows.map((r) => `[${r.level}, ${+sig2(1 / r.ratio).toPrecision(2)}]`).join(', ')}];`);
  } else {
    const k = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(0));
    printTable(survey(), [
      { key: 'level', label: 'lvl', w: 4 },
      { key: 'order', label: 'order', w: 18, left: true },
      { key: 'xp', label: 'xp/hr', w: 8, fmt: k },
      { key: 'ratio', label: 'vs gather', w: 9, fmt: (v) => v.toFixed(2) },
      { key: 'serves', label: 'serves', w: 7, fmt: k },
      { key: 'coins', label: 'coins/hr', w: 9, fmt: k },
      { key: 'thieving', label: 'thieving', w: 9, fmt: k },
      { key: 'fish', label: 'fish sold', w: 9, fmt: k },
    ]);
  }
}
