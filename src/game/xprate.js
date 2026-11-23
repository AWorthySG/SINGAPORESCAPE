// XP an hour for the skill guide: beside each tree, rock, fishing spot, trap,
// stall, pocket and lone obstacle, about how much XP an hour of it pays the
// player as they are now (src/ui/skillguideui.js shows it as a badge beside
// "+N xp each").
// Worked out from the game's own rules rather than simulated, so it is cheap
// enough for every row of a long list:
//
//  - Gathering rolls once a tick, plus an extra roll whenever GATHER_SPEED's
//    share and the tool's add up to one (game.js _tickContinuous, tools.js
//    toolSpeed): GATHER_SPEED x (1 + speed%) rolls a tick with the best tool
//    of its kind you carry or wield (none: the plain tool, 0%), and the skill
//    unlocks' quick actions on top (skillunlocks.js). Life skills never fail,
//    so every roll pays its XP as Skills.addXp adds it (XP_RATE and the
//    life-skill boost at your level).
//  - Each skill's own pace, read from its resolver (skilling.js and Game):
//    a fishing spot never runs dry, and a big catch (two fish, both paid)
//    comes more often as your level rises. A tree or rock holds 10-20 and
//    runs dry; a double log or ore uses one more up without paying, so it
//    shortens the visit. Only the time at the node counts (not walking on or
//    waiting for regrowth), but the rolls left in the tick it runs dry in are
//    lost, which matters at high levels where a visit is a few ticks. A trap
//    runs dry at random and takes `respawn` ticks to reset: the traps of a
//    ground are worked in turn and waited on. A stall restocks after each
//    theft and a failed try stuns you. A pocket can be picked once a tick.
//  - No figure (null) where there's no honest one: an Agility course's lap
//    is mostly walking between its obstacles, which this can't know; Farming
//    grows on its own clock; and anything above your level.
//  - Left out, so they come on top: golden hours, rested XP, night bonuses,
//    trophy fish, schools of fish, whole trees and seams at once, gems, nests
//    and other lucky finds, gathering streaks, your level's bonus haul, bait.
//    (So is running out of Focus, which cuts automatic play to 70%: see
//    playbalance.js. A full bar lasts hours, so the badge doesn't mention it.)
//
// Kept out of game.js; tests/xprate.test.mjs checks it against headless runs.
import { XP_RATE, TICK_MS } from '../config.js';
import { OBJECTS } from '../data/objects.js';
import { ITEMS } from '../data/items.js';
import { GATHER_SPEED } from './game.js';
import { bestTool, toolBonus } from './tools.js';
import { yieldBonus, hunterXpMult } from './culling.js';
import { unlockFx } from './skillunlocks.js';
import { TREE_LOGS_MIN, TREE_LOGS_MAX, ROCK_ORES_MIN, ROCK_ORES_MAX } from './skilling.js';
import { TOOL_NAMES } from './skillguide.js';

export const TICKS_AN_HOUR = 3600000 / TICK_MS;
// A failed theft costs the try and the stun after it (Game.stealFromStall).
const CAUGHT_TICKS = 1 + 3;
// Traps of a kind this close together are one ground, worked in turn (the
// Hunter tests time a ground the same way).
const GROUND_TILES = 15;
const TINY = 1e-9, LONGEST = 100000;   // (a visit's chance of lasting on, and a bound on how far it's followed)

/** The XP one log, ore, fish, catch, theft or crossing pays you now, as
 *  Skills.addXp adds it (golden hours, rested XP and night bonuses aside). */
export function actionXp(game, s) {
  const lvl = game?.skills?.level?.(s.skill) || 1;
  let xp = s.xp || 0;
  if (s.key === 'pickpocket') xp = 8 + Math.min(lvl, 99);   // anyone's pocket pays more up to level 99 (Game.pickpocket)
  if (s.skill === 'agility' && game?.agilityXpScale) xp *= game.agilityXpScale(lvl);   // Game.resolveAgility scales obstacles itself
  if (s.skill === 'hunter') xp *= hunterXpMult(game);   // Stewardship and the mosquito-net cape (culling.js)
  return xp * XP_RATE * (game?.skills?.lifeXpMult ? game.skills.lifeXpMult(s.skill) : 1);
}

/** The tool a source is worked with: the best one of its kind you carry or
 *  wield, its extra share of a roll a tick and its double-yield bonus. */
function toolFor(game, tag) {
  const id = bestTool(game, tag);
  const tb = toolBonus(game, tag);   // untiered tools (net, lobster pot) and none at all: no bonus
  const name = id ? `your ${ITEMS[id].name.toLowerCase()}` : `${TOOL_NAMES[tag] || tag} (you don't carry one)`;
  return { id, speed: tb.speed, yield: tb.yield, extra: (GATHER_SPEED - 1) + GATHER_SPEED * tb.speed / 100,
    text: `with ${name}${tb.speed ? ` (+${tb.speed}% speed)` : ''}` };
}

// Rolls a visit has had by the end of each tick: one a tick, plus the extra
// share adding up as _tickContinuous adds it, from nothing for each new visit.
const CAPS = new Map();
function capsFor(extra) {
  let c = CAPS.get(extra);
  if (!c) { c = { at: [0], acc: 0 }; CAPS.set(extra, c); }
  return c;
}
function capAt(c, extra, k) {
  while (c.at.length <= k) {
    let n = c.at[c.at.length - 1] + 1;
    c.acc += extra;
    while (c.acc >= 1) { c.acc -= 1; n++; }
    c.at.push(n);
  }
  return c.at[k];
}

/** Rolls a tick while at a node that runs dry, given `S(n)`, the chance a
 *  visit lasts more than n rolls: E[rolls] / E[ticks]. A visit of R rolls
 *  takes as many ticks as it takes the rolls a tick to add up to R. */
function visitPace(S, extra) {
  const c = capsFor(extra);
  let rolls = 0, ticks = 0;
  for (let n = 0; n < LONGEST; n++) { const p = S(n); if (p < TINY) break; rolls += p; }
  for (let k = 0; k < LONGEST; k++) { const p = S(capAt(c, extra, k)); if (p < TINY) break; ticks += p; }
  return { rolls, ticks };
}

const PACE = new Map();
function cached(key, fn) {
  if (PACE.has(key)) return PACE.get(key);
  if (PACE.size > 500) PACE.clear();   // levels and tools change now and then: keep it small
  const v = fn();
  PACE.set(key, v);
  return v;
}

/** A tree or rock: lo..hi logs or ores, a double using two (chance `dbl`,
 *  while more than one is left), and an unlock that keeps it standing with a
 *  fresh lo..hi when it runs dry (chance `keep`). Returns S(n) for visitPace. */
function nodeSurvival(lo, hi, dbl, keep) {
  const fresh = new Float64Array(hi + 1);
  for (let n = lo; n <= hi; n++) fresh[n] = 1 / (hi - lo + 1);
  let left = fresh;
  const S = [1];
  while (S[S.length - 1] >= TINY && S.length < LONGEST) {
    const next = new Float64Array(hi + 1);
    let dry = 0;
    for (let l = 1; l <= hi; l++) {
      const m = left[l];
      if (!m) continue;
      if (l === 1) { dry += m; continue; }
      next[l - 1] += m * (1 - dbl);
      if (l > 2) next[l - 2] += m * dbl; else dry += m * dbl;
    }
    if (keep) for (let n = lo; n <= hi; n++) next[n] += dry * keep * fresh[n];
    left = next;
    let alive = 0;
    for (let l = 1; l <= hi; l++) alive += left[l];
    S.push(alive);
  }
  return (n) => (n < S.length ? S[n] : 0);
}

/** How many traps of this kind lie together where it is densest (one ground). */
const GROUNDS = new WeakMap();
function groundSize(game, objId) {
  let m = GROUNDS.get(game);
  if (!m) { m = new Map(); GROUNDS.set(game, m); }
  if (!m.has(objId)) {
    const all = (game.world?.objects || []).filter((o) => o.objId === objId);
    let best = 1;
    for (const o of all) best = Math.max(best, all.filter((p) => Math.max(Math.abs(p.x - o.x), Math.abs(p.y - o.y)) <= GROUND_TILES).length);
    m.set(objId, best);
  }
  return m.get(objId);
}

// What the figure leaves out, for the badge's hover text.
const onTop = (extras) => (extras.length ? `Golden hours, rested XP and lucky extras come on top: ${extras.join(', ')}.` : 'Golden hours and rested XP come on top.');

/** XP an hour at a skill-guide source (skillguide.js gatherSources) for the
 *  player as they are now, or null where there's no honest figure:
 *  { perHour, perTick (actions a tick), why (what it assumes, plain text) }. */
export function xpRate(game, s) {
  if (!s || !game?.skills) return null;
  const lvl = game.skills.level(s.skill);
  if (lvl < (s.level || 1)) return null;   // not yet: there's no "at your level" for it
  const id = s.objIds?.[0], def = id ? OBJECTS[id] : null;
  const fx = unlockFx(game, s.skill);
  const each = actionXp(game, s);
  const done = (perTick, xpEach, why) => ({ perHour: perTick * xpEach * TICKS_AN_HOUR, perTick, why });
  const quickly = (extra) => (fx.quick ? (1 + extra) * (1 + fx.quick) - 1 : extra);   // the unlocks' quick actions, as more of a roll a tick
  if (s.skill === 'fishing' && def) {
    const t = toolFor(game, s.tool || def.tool || 'net');
    // resolveFish: a big catch lands two fish and pays for both.
    const big = Math.min(1, 0.05 + lvl * 0.0015 + yieldBonus(game) + t.yield);
    const per = 1 + quickly(t.extra);
    return done(per, each * (1 + big), `${cap(t.text)}, at your level, while you fish: about ${fmt(per * TICKS_AN_HOUR)} casts an hour`
      + `${big > 0.005 ? `, ${Math.round(big * 100)}% of them big catches (two fish)` : ''}. ${onTop(['trophy fish', 'schools', 'streaks', 'bonus hauls', ...(def.night ? ['night bonuses'] : [])])}`);
  }
  if ((s.skill === 'woodcutting' || s.skill === 'mining') && def) {
    const t = toolFor(game, s.tool);
    const mine = s.skill === 'mining';
    // resolveWoodcut / resolveMine: a double log or ore uses one more up, for no more XP.
    const dbl = Math.min(1, 0.04 + lvl * 0.001 + yieldBonus(game) + t.yield);
    const extra = quickly(t.extra), keep = fx.keep || 0;
    let per = 1 + extra;
    if ((mine || def.depleteChance > 0) && keep < 1) {   // (a world event's ancient tree never falls)
      const [lo, hi] = mine ? [ROCK_ORES_MIN, ROCK_ORES_MAX] : [TREE_LOGS_MIN, TREE_LOGS_MAX];
      const v = cached(`node:${lo}:${hi}:${dbl}:${keep}:${extra}`, () => visitPace(nodeSurvival(lo, hi, dbl, keep), extra));
      per = v.rolls / v.ticks;
    }
    const what = mine ? ['mine', 'rock', 'grow back'] : ['chop', 'tree', 'regrow'];
    return done(per, each, `${cap(t.text)}, at your level, while you ${what[0]}: walking to the next ${what[1]} and waiting for one to ${what[2]} aren't counted. `
      + onTop([`whole ${mine ? 'seams' : 'trees'} at once`, mine ? 'gems' : 'nests', 'streaks', 'bonus hauls', ...(def.night ? ['night bonuses'] : [])]));
  }
  if (s.skill === 'hunter' && def?.depleteChance) {
    const t = toolFor(game, 'snare');
    const extra = quickly(t.extra);
    // resolveHunt: each catch may run the trap dry (unless an unlock keeps it
    // set), and a dry trap takes `respawn` ticks to reset.
    const end = def.depleteChance * (1 - (fx.keep || 0));
    // (Kept set for good, it would never run dry: no visits and no resets.)
    const v = end > 0 ? cached(`trap:${end}:${extra}`, () => visitPace((n) => (1 - end) ** n, extra)) : { rolls: 1 + extra, ticks: 1 };
    const n = groundSize(game, id), reset = end > 0 ? def.respawn || s.respawn || 0 : 0;
    // The ground's traps in turn: each pays a visit's catches once a reset (and
    // its visit), unless working the rest takes longer than that.
    const waits = n * v.ticks < reset + v.ticks;
    const per = v.rolls * Math.min(n / (reset + v.ticks), 1 / v.ticks);
    return done(per, each, `${cap(t.text)}, at your level, `
      + `${n > 1 ? `working the ${n} traps here in turn` : 'working this trap'}${waits ? ` and waiting for ${n > 1 ? 'them' : 'it'} to reset` : ''}${n > 1 ? ' (walking between them not counted)' : ''}. `
      + onTop(['bait', 'streaks', 'bonus hauls', ...(def.night ? ['night bonuses'] : [])]));
  }
  if (s.skill === 'thieving' && def?.type === 'stall') {
    // Game.stealFromStall: a theft empties the stall for `respawn` ticks (an
    // unlock may leave it stocked); a failed try stuns you, then you try again.
    const sure = Math.min(0.95, (def.sure || 0.5) + (lvl - (def.level || 1)) * 0.012);
    const keep = fx.keep || 0, restock = def.respawn || 5;
    const ticks = (1 - keep) * restock + keep + (1 - sure) / sure * CAUGHT_TICKS;
    return done(1 / ticks, each, `At your level: you get away with ${Math.round(sure * 100)}% of tries, the stall restocks ${fmtS(restock)} after each theft, and a failed try stuns you. ${onTop([])}`);
  }
  if (s.skill === 'thieving' && (s.npcId || s.key === 'pickpocket')) {
    return done(1, each, `At your level: one pick a tick, with auto gather on and your mark standing still (one that wanders off slows you). ${onTop([])}`);
  }
  if (s.skill === 'agility' && def && def.markChance === undefined) {
    // Game.resolveAgility: a lone obstacle (not part of a course) is crossed again every tick.
    return done(1, each, `At your level: crossed once a tick. ${onTop([])}`);
  }
  return null;
}

/** Just the number: XP an hour at a source, or null (see xpRate). */
export const xpPerHour = (game, s) => xpRate(game, s)?.perHour ?? null;

const cap = (t) => t[0].toUpperCase() + t.slice(1);
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const fmtS = (ticks) => `${Math.round(ticks * TICK_MS / 100) / 10}s`;
