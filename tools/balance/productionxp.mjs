// Making XP against gathering XP: how much Smithing, Cooking, Crafting and
// Fletching an hour pays, beside the gathering skills (Mining, Woodcutting,
// Fishing at their best source), at a few levels.
//
//   node tools/balance/productionxp.mjs                     # levels 30, 99, 200, 500
//   node tools/balance/productionxp.mjs --levels 50,300 --sets 100 --seed 7
//   node tools/balance/productionxp.mjs --before             # as it was: no making multiple
//   node tools/balance/productionxp.mjs --fit                # suggest PRODUCTION_XP_MULT (skilling.js)
//
// Making is instant (autoprocess.js makeBatch: a station makes everything the
// pack holds in one tick), so an hour of making is set by the materials, not
// the station. "An hour" of a making skill here is what making the haul of an
// hour's gathering pays: the best recipe your level allows, made from the
// ores, logs, fish, catches and gems you could gather in that hour at their
// best sources (with the best tool you can use), its bars smelted first (their
// Smelting XP counts towards Smithing). Gathering an hour is the skill guide's
// own figure (xprate.js xpRate, checked against headless runs by
// tests/xprate.test.mjs), with whole trees, seams and schools, so the two
// columns are the same hour seen from each end: someone who cooks what they
// catch levels Cooking about as fast as Fishing when the ratio is near 1.
//
// "Best" is the recipe whose gathered materials pay the most of the skill an
// hour (a cheap one can beat the newest: barbed hooks, from one iron ore, pay
// more Smithing an hour than a rune platebody's 45 ores). Its XP is measured
// headlessly through the real station action (a real Game, the player beside
// a range, furnace, anvil, table or bench, one make's materials, one tick), so
// perfect cooks, the multiple and the life-skill rates are all in, and the
// unlocks' kept materials count at their average. The supply side leaves out
// lucky finds and counts a trophy fish as three (its XP), so it slightly
// overstates the haul: the making column is if anything generous.
//
// --fit runs it without the multiple at FIT_LEVELS and prints, for each making
// skill, the multiple that brings its best hour level with the gathering
// average there (skilling.js eases between them). Between those levels the
// best recipe can change, so the ratio wanders (about 0.6 to 1.8).
import { freshGame, parseArgs, printTable } from './common.mjs';
import { xpForLevel } from '../../src/data/xp.js';
import { ITEMS } from '../../src/data/items.js';
import { gatherSources } from '../../src/game/skillguide.js';
import { xpRate, actionXp } from '../../src/game/xprate.js';
import { unlockFx } from '../../src/game/skillunlocks.js';
import { TOOL_TIERS, TOOL_KIND, toolId } from '../../src/data/tooltiers.js';
import { COOKING, PRODUCTION_XP_MULT, makeXp } from '../../src/game/skilling.js';
import { DISHES } from '../../src/data/cooking.js';
import { SMELT, SMITH } from '../../src/data/smithing.js';
import { CRAFT } from '../../src/data/crafting.js';
import { FLETCH } from '../../src/data/trades.js';

const args = parseArgs();
const levels = String(args.levels || '30,99,200,500').split(',').map(Number);
const SETS = Number(args.sets) || 40;   // makes measured for each recipe
export const MAKE = ['smithing', 'cooking', 'crafting', 'fletching'];
export const GATHER = ['mining', 'woodcutting', 'fishing'];
const SUPPLY = ['mining', 'woodcutting', 'fishing', 'hunter'];

// Every making recipe in one shape, with how to start it at its station.
const RECIPES = [
  ...SMELT.map((r) => ({ skill: 'smithing', kind: 'smelt', ref: r, result: r.result, qty: 1, inputs: r.inputs, level: r.level, xp: r.xp, station: 'furnace', start: (g, o) => g.startSmelt(r, o) })),
  ...SMITH.map((r) => ({ skill: 'smithing', kind: 'smith', ref: r, result: r.result, qty: r.qty || 1, inputs: [{ id: r.bar, qty: r.barCount }], level: r.level, xp: r.xp, station: 'anvil', start: (g, o) => g.startSmith(r, o) })),
  ...Object.entries(COOKING).map(([raw, c]) => ({ skill: 'cooking', kind: 'cook', ref: c, result: c.result, qty: 1, inputs: [{ id: raw, qty: 1 }], level: c.level, xp: c.xp, station: 'range', start: (g, o) => g.startCooking(o, raw) })),
  ...DISHES.map((r) => ({ skill: 'cooking', kind: 'dish', ref: r, result: r.result, qty: 1, inputs: r.inputs, level: r.level, xp: r.xp, station: 'range', start: (g, o) => g.startDish(o, r) })),
  ...CRAFT.map((r) => ({ skill: 'crafting', kind: 'craft', ref: r, result: r.result, qty: r.qty || 1, inputs: r.inputs, level: r.level, xp: r.xp, station: 'crafting_table', start: (g, o) => g.startCraft(r, o) })),
  ...FLETCH.map((r) => ({ skill: 'fletching', kind: 'fletch', ref: r, result: r.result, qty: r.qty || 1, inputs: r.inputs.map(([id, qty]) => ({ id, qty })), level: r.level, xp: r.xp, station: 'fletching_bench', start: (g, o) => g.startRecipe('fletching', r, o) })),
];
// A perfect cook (resolveCook) pays half again, 8% of the time.
const PERFECT = 1 + 0.08 * 0.5;

/** A character at `lvl` in every life skill, carrying the best tool of each kind it can use. */
export function playerAt(lvl, seed) {
  const g = freshGame('corsair', seed);
  g.npcs = [];
  for (const s of [...MAKE, ...SUPPLY, 'herblore', 'firemaking']) g.skills.xp[s] = xpForLevel(lvl);
  clearBag(g);
  return g;
}
const bestTier = (lvl) => TOOL_TIERS.reduce((b, t, i) => (t.level <= lvl ? i : b), 0);
function clearBag(g) {
  for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s) g.inventory.removeAt(k, s.qty); }
  const lvl = g.skills.level('mining');
  for (const tag of Object.keys(TOOL_KIND)) g.inventory.add(toolId(tag, bestTier(lvl)), 1);
  // Untiered tools: a hammer, knife, chisel, tinderbox and each net or pot.
  const plain = new Set(Object.values(ITEMS).filter((it) => it.tool && !TOOL_KIND[it.tool]).map((it) => it.tool));
  for (const tag of plain) { const id = Object.keys(ITEMS).find((k) => ITEMS[k].tool === tag); if (id) g.inventory.add(id, 1); }
}

/** What an hour of gathering yields at your level: { perItem: Map(id -> items an hour at its best source),
 *  best: { skill -> { perHour, name } } } (the skill guide's XP an hour). */
export function gatherHour(g) {
  const perItem = new Map(), best = {};
  for (const s of gatherSources()) {
    if (!SUPPLY.includes(s.skill)) continue;
    const r = xpRate(g, s);
    if (!r) continue;
    if (!best[s.skill] || r.perHour > best[s.skill].perHour) best[s.skill] = { perHour: r.perHour, name: s.spot && s.spot !== s.name ? `${s.name} (${s.spot})` : s.name };
    // Pieces an hour: the hour's XP without its lucky finds, over one piece's XP.
    const pieces = r.perHour * (1 - (r.parts.finds || 0)) / actionXp(g, s);
    for (const give of s.gives) {
      if (give.rare) continue;
      const n = pieces * (give.chance ?? 1) * ((give.min || 1) + (give.max || give.min || 1)) / 2;
      if (n > (perItem.get(give.id) || 0)) perItem.set(give.id, n);
    }
  }
  return { perItem, best };
}

/** Hours of gathering behind one `id` (bars and other made inputs through their own
 *  recipe), with the making XP picked up on the way: { hours, chain: [recipe] }. */
function supplyOf(g, id, perItem, seen = new Set()) {
  if (perItem.has(id)) return { hours: 1 / perItem.get(id), chain: [] };
  if (seen.has(id)) return { hours: Infinity, chain: [] };
  seen.add(id);
  let best = { hours: Infinity, chain: [] };
  for (const r of RECIPES) {
    if (r.result !== id || g.skills.level(r.skill) < r.level || r.ref.upgrade) continue;
    const s = setOf(g, r, perItem, seen);
    const per = { hours: s.hours / r.qty, chain: [...s.chain.map((c) => ({ ...c, n: c.n / r.qty })), { r, n: 1 / r.qty }] };
    if (per.hours < best.hours) best = per;
  }
  seen.delete(id);
  return best;
}
/** One make of `r`: the hours behind its inputs and the recipes that made them. */
function setOf(g, r, perItem, seen = new Set()) {
  let hours = 0; const chain = [];
  for (const inp of r.inputs) {
    const s = supplyOf(g, inp.id, perItem, seen);
    hours += inp.qty * s.hours;
    for (const c of s.chain) chain.push({ ...c, n: c.n * inp.qty });
  }
  return { hours, chain };
}

/** XP one make of `r` pays now, worked out (the make's XP at your level, a cook's perfect share). */
const xpEstimate = (g, r) => g.skills.xpAtLevel(r.skill, makeXp(g, r.skill, r.xp)) * (r.kind === 'cook' ? PERFECT : 1);

/** The best making hour for `skill` at the player's level: the recipe whose
 *  gathered materials pay the most of `skill` an hour. */
export function bestMake(g, skill, perItem, { doAll = false } = {}) {
  let best = null;
  for (const r of RECIPES) {
    if (r.skill !== skill || g.skills.level(skill) < r.level || r.ref.upgrade) continue;
    const s = setOf(g, r, perItem);
    if (!(s.hours > 0 && Number.isFinite(s.hours))) continue;
    const xp = xpEstimate(g, r) + s.chain.reduce((a, c) => a + (c.r.skill === skill ? c.n * xpEstimate(g, c.r) : 0), 0);
    const perHour = xp / s.hours;
    const better = !best || (doAll ? r.level > best.r.level || (r.level === best.r.level && perHour > best.perHour) : perHour > best.perHour);
    if (better) best = { r, chain: s.chain, hours: s.hours, perHour };
  }
  return best;
}

const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}

/** XP of `r`'s skill one make's materials really pay at your level. Measured:
 *  `sets` times over, one make's materials in the pack, the real station
 *  action, one tick, and the XP each make paid (perfect cooks and all). Then
 *  times the makes a set lasts for on average, 1 / (1 - the unlocks' chance to
 *  keep the materials): measured instead, that chance made the figure jump by
 *  a third from run to run. The XP is taken back after each make, so the level
 *  (and so the multiple and the life-skill rate) stays put: a whole batch at
 *  once would level up part-way at these rates and measure the levels after.
 *  Golden hours and rested XP (Skills.timeMult) are left out, as the skill
 *  guide's gathering hour leaves them out: the game clock moves as it runs. */
export function measureMake(g, r, sets = SETS) {
  const obj = g.world.objects.find((o) => o.objId === r.station);
  const xp0 = g.skills.xp[r.skill];
  let got = 0, makes = 0;
  const timeMult = g.skills.timeMult;
  g.skills.timeMult = null;
  const off = g.bus.on('xp', (e) => { if (e.skill === r.skill) makes += e.count || 1; });
  try {
    for (let k = 0; k < sets; k++) {
      clearBag(g);
      for (const inp of r.inputs) g.inventory.add(inp.id, inp.qty);
      standBy(g, obj);
      g.player.clearAction();
      r.start(g, obj);
      for (let t = 0; t < 5 && g.player.action; t++) g.update(600);
      got += g.skills.xp[r.skill] - xp0;
      g.skills.xp[r.skill] = xp0;
    }
  } finally { off(); g.skills.timeMult = timeMult; }
  const save = Math.min(0.95, (unlockFx(g, r.skill).save || 0) + (obj.homeFx?.save || 0));
  return makes ? got / makes / (1 - save) : 0;
}

/** The table: each level's gathering hours, then each making skill's best hour against their average. */
export function survey(lvls = levels, { sets = SETS, seed = Number(args.seed) || 20261112 } = {}) {
  const rows = [];
  for (const L of lvls) {
    const g = playerAt(L, seed);
    const { perItem, best } = gatherHour(g);
    const avg = GATHER.reduce((a, s) => a + (best[s]?.perHour || 0), 0) / GATHER.length;
    for (const s of GATHER) rows.push({ level: L, skill: s, perHour: best[s]?.perHour || 0, ratio: (best[s]?.perHour || 0) / avg, how: best[s]?.name || '-' });
    for (const skill of MAKE) {
      const m = bestMake(g, skill, perItem);
      if (!m) { rows.push({ level: L, skill, perHour: 0, ratio: 0, how: 'nothing to make' }); continue; }
      // Measured: the recipe itself, and any of its own skill's steps before it (smelting the bars).
      let xp = measureMake(g, m.r, sets);
      for (const c of m.chain) if (c.r.skill === skill) xp += c.n * measureMake(g, c.r, sets);
      const perHour = xp / m.hours;
      rows.push({ level: L, skill, perHour, ratio: perHour / avg, how: `${ITEMS[m.r.result]?.name || m.r.result}${m.chain.some((c) => c.r.skill === skill) ? ' (and the steps before it)' : ''}` });
    }
    rows.push({ level: L, skill: 'gathering avg', perHour: avg, ratio: 1, how: GATHER.join(', ') });
  }
  return rows;
}

// The levels --fit lists a multiple at (between them skilling.js eases from one to the next).
export const FIT_LEVELS = [1, 10, 30, 60, 99, 150, 200, 300];
/** Two significant figures: a multiple people can read. */
const sig2 = (x) => { const p = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };

if (import.meta.url === `file://${process.argv[1]}`) {
  const before = args.before || args.fit;
  if (before) for (const k of Object.keys(PRODUCTION_XP_MULT)) PRODUCTION_XP_MULT[k] = [[1, 1]];
  const rows = survey(args.fit && !args.levels ? FIT_LEVELS : levels, { sets: Number(args.sets) || (args.fit ? 400 : SETS) });
  if (args.fit) {
    // The multiple that brings each skill's best hour level with the gathering average.
    console.log('export const PRODUCTION_XP_MULT = {');
    for (const skill of MAKE) console.log(`  ${skill}: [${rows.filter((r) => r.skill === skill).map((r) => `[${r.level}, ${+sig2(1 / r.ratio).toPrecision(2)}]`).join(', ')}],`);
    console.log('};');
  } else {
    console.log(`PRODUCTION_XP_MULT ${before ? '(off: as before)' : JSON.stringify(PRODUCTION_XP_MULT)}`);
    const k = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(0));
    printTable(rows, [
      { key: 'level', label: 'lvl', w: 4 },
      { key: 'skill', label: 'skill', w: 14, left: true },
      { key: 'perHour', label: 'xp/hr', w: 8, fmt: k },
      { key: 'ratio', label: 'vs avg', w: 7, fmt: (v) => v.toFixed(2) },
      { key: 'how', label: 'best source / recipe', w: 40, left: true },
    ]);
  }
}
