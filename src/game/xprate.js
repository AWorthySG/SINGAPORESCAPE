// XP an hour: beside each tree, rock, fishing spot, trap, stall, pocket and
// lone obstacle, about how much XP an hour of it pays the player as they are
// now, with auto gather working it (src/ui/skillguideui.js shows it as a badge
// beside "+N xp each"; src/game/foryou.js picks training spots by it).
// Worked out from the game's own rules rather than by running the game, so it
// is cheap enough for every row of a long list. Its numbers come from where
// each rule lives (the chances in skilling.js, jackpot.js, fishschool.js,
// levelhaul.js, gathering.js, Game's thieving), so a change there moves the
// figure too.
//
//  - Gathering rolls once a tick, plus an extra roll whenever GATHER_SPEED's
//    share and the tool's add up to one (game.js _tickContinuous, tools.js
//    toolSpeed), with the best tool of its kind you carry or wield (none: the
//    plain tool, 0%), and the skill unlocks' quick actions on top. Life skills
//    never fail, so every roll pays, as Skills.addXp adds it (XP_RATE and the
//    life-skill boost at your level).
//  - What a roll pays: its XP, a big catch or trophy fish, a gem, and now and
//    then the whole tree, seam, school or flock at once (jackpot.js: ten times
//    what is left in the tree or rock, or 10-140 fish or catches), which is
//    most of an hour.
//    Each tick of gathering adds a chance of your level's bonus haul
//    (levelhaul.js) and of a lucky find, and a gathering streak adds up to 10%
//    to all of it (gathering.js).
//  - Fishing: a spot never runs dry, and every few minutes a school passes
//    (fishschool.js): counted are the ones that come to your kind of spot
//    where its spots lie best for it, auto gather following them.
//  - Trees, rocks and traps run dry. A visit lasts until the stock runs out (a
//    double uses one more up for no more XP, a whole tree or seam takes the
//    rest, an unlock may keep it standing) and the rolls left in the tick it
//    ran dry in are lost. Then auto gather walks to the nearest ready one of
//    the kind, or waits for one to grow back or reset: followed visit by visit
//    over the kind's densest ground (the most within GROUND_TILES).
//  - Stalls restock after each theft and a failed try stuns you; a pocket can
//    be picked once a tick; a lone obstacle is crossed every tick.
//  - No figure (null) where there's no honest one: an Agility course's lap is
//    mostly walking between its obstacles, which this can't know; Farming
//    grows on its own clock; and anything above your level.
//  - Left out, so they come on top: golden hours, rested XP, night bonuses,
//    bait, daily contracts, world events, and the odd pearl or purse while
//    fishing. (So is running out of Focus, which cuts automatic play to 70%:
//    see playbalance.js. A full bar lasts hours, so the badge doesn't say.)
//
// Kept out of game.js; tests/xprate.test.mjs checks it against headless runs.
import { XP_RATE, TICK_MS } from '../config.js';
import { OBJECTS } from '../data/objects.js';
import { ITEMS } from '../data/items.js';
import { GATHER_SPEED, pickpocketXp, stallChance, STALL_STUN_TICKS } from './game.js';
import { bestTool, toolBonus } from './tools.js';
import { hunterXpMult } from './culling.js';
import { unlockFx } from './skillunlocks.js';
import { TREE_LOGS_MIN, TREE_LOGS_MAX, ROCK_ORES_MIN, ROCK_ORES_MAX, doubleChance, gemChance, GEM_XP, trophyChance, TROPHY_XP_MULT, bigCatchChance } from './skilling.js';
import { NODE_JACKPOT, jackpotChance, jackpotBase, SEAM_MULT, HUNT_STOCK } from './jackpot.js';
import { FISH_SCHOOL, WILD_STOCK, SCHOOL_GAP, SCHOOL_HAUL, SCHOOL_NEAR, SCHOOL_AUTO, SCHOOL_SAME_KIND, passingSchoolSize } from './fishschool.js';
import { LEVEL_HAUL, levelHaulPct } from './levelhaul.js';
import { GATHER_FUN, STREAK_GAP_TICKS, streakXpMult, luckyChance, LUCKY_XP_MULT, nodeXp } from './gathering.js';
import { TOOL_NAMES } from './skillguide.js';
import { diveBreath } from './diving.js';
import { SURFACE_TICKS, diveUptime } from '../data/diving.js';

export const TICKS_AN_HOUR = 3600000 / TICK_MS;
// A failed theft costs the try and the stun after it (Game.stealFromStall).
const CAUGHT_TICKS = 1 + STALL_STUN_TICKS;
// Nodes of a kind this close together are one ground, worked in turn (the
// Hunter tests time a ground the same way).
const GROUND_TILES = 15;
const TINY = 1e-9, LONGEST = 100000;   // (a visit's chance of lasting on, and a bound on how far it's followed)
const KEEP_MOST = 0.9;   // (an unlock that kept a node standing for good would never end a visit: followed this far)
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** The XP one log, ore, fish, catch, theft or crossing pays you now, as
 *  Skills.addXp adds it (golden hours, rested XP and night bonuses aside). */
export function actionXp(game, s) {
  return listedXp(game, s) * rateOf(game, s.skill);
}
/** ...the same before the XP rate and the life-skill boost. */
function listedXp(game, s) {
  const lvl = game?.skills?.level?.(s.skill) || 1;
  let xp = s.xp || 0;
  if (s.key === 'pickpocket') xp = pickpocketXp(lvl);   // anyone's pocket pays more up to level 99 (Game.pickpocket)
  if (s.skill === 'agility' && game?.agilityXpScale) xp *= game.agilityXpScale(lvl);   // Game.resolveAgility scales obstacles itself
  if (s.skill === 'hunter') xp *= hunterXpMult(game);   // Stewardship and the mosquito-net cape (culling.js)
  return xp;
}
const rateOf = (game, skill) => XP_RATE * (game?.skills?.lifeXpMult ? game.skills.lifeXpMult(skill) : 1);

/** The tool a source is worked with: the best one of its kind you carry or
 *  wield, its extra share of a roll a tick and its tier's bonuses. */
function toolFor(game, tag) {
  const id = bestTool(game, tag);
  const tb = toolBonus(game, tag);   // untiered tools (net, lobster pot) and none at all: no bonus
  const name = id ? `your ${ITEMS[id].name.toLowerCase()}` : `${TOOL_NAMES[tag] || tag} (you don't carry one)`;
  return { id, speed: tb.speed, yield: tb.yield, find: tb.find, extra: (GATHER_SPEED - 1) + GATHER_SPEED * tb.speed / 100,
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

/** Rolls and ticks a visit to a node that runs dry takes on average, given
 *  `S(n)`, the chance a visit lasts more than n rolls. A visit of R rolls
 *  takes as many ticks as it takes the rolls a tick to add up to R. */
function visitPace(S, extra) {
  const c = capsFor(extra);
  let rolls = 0, ticks = 0;
  for (let n = 0; n < LONGEST; n++) { const p = S(n); if (p < TINY) break; rolls += p; }
  for (let k = 0; k < LONGEST; k++) { const p = S(capAt(c, extra, k)); if (p < TINY) break; ticks += p; }
  return { rolls, ticks };
}

const PACE = new Map();
/** How many paces are remembered (the tests check a second pass adds none). */
export const xpRatePaces = () => PACE.size;
function cached(key, fn) {
  if (PACE.has(key)) return PACE.get(key);
  if (PACE.size > 500) PACE.clear();   // levels and tools change now and then: keep it small
  const v = fn();
  PACE.set(key, v);
  return v;
}

/** A visit to a tree or rock, from a fresh lo..hi logs or ores until it runs
 *  dry (resolveWoodcut / resolveMine). Each swing takes one; a double (chance
 *  `dbl`, while more than one is left) one more for no more XP; then, with
 *  more than one still left, the whole tree or seam (chance `jp`, jackpot.js)
 *  takes the rest after this swing's, SEAM_MULT times over with XP for each,
 *  and uses it up. An unlock keeps it standing with a fresh lo..hi when it
 *  runs dry (chance `keep`). Returns S(n) for visitPace and `whole`, the
 *  pieces whole trees or seams pay in a visit. */
function nodeVisit(lo, hi, dbl, jp, keep) {
  const fresh = 1 / (hi - lo + 1);
  let left = new Float64Array(hi + 1);
  for (let n = lo; n <= hi; n++) left[n] = fresh;
  const S = [1];
  let whole = 0;
  while (S[S.length - 1] >= TINY && S.length < LONGEST) {
    const next = new Float64Array(hi + 1);
    let dry = 0;
    for (let l = 1; l <= hi; l++) {
      const m = left[l];
      if (!m) continue;
      if (l === 1) { dry += m; continue; }
      const one = m * (1 - dbl), two = m * dbl;   // no double: l left before the whole one; a double: l - 1
      whole += one * jp * SEAM_MULT * (l - 1); dry += one * jp; next[l - 1] += one * (1 - jp);
      if (l > 2) { whole += two * jp * SEAM_MULT * (l - 2); dry += two * jp; next[l - 2] += two * (1 - jp); } else dry += two;
    }
    if (keep) for (let n = lo; n <= hi; n++) next[n] += dry * keep * fresh;
    left = next;
    let alive = 0;
    for (let l = 1; l <= hi; l++) alive += left[l];
    S.push(alive);
  }
  return { S: (n) => (n < S.length ? S[n] : 0), whole };
}

/** The densest ground of a kind of node: the most of them within GROUND_TILES
 *  of one, and that one (where a round starts). World events' nodes come and
 *  go, so they're left out. */
const GROUNDS = new WeakMap();
function groundOf(game, objId) {
  let m = GROUNDS.get(game);
  if (!m) { m = new Map(); GROUNDS.set(game, m); }
  if (!m.has(objId)) {
    const all = (game.world?.objects || []).filter((o) => o.objId === objId && !o.worldEvent).sort((a, b) => a.x - b.x);
    let best = all.slice(0, 1), start = all[0];
    for (let i = 0, lo = 0; i < all.length; i++) {   // (sorted by x: only a strip either side can be near)
      const o = all[i], near = [];
      while (all[lo].x < o.x - GROUND_TILES) lo++;
      for (let j = lo; j < all.length && all[j].x <= o.x + GROUND_TILES; j++) if (cheb(all[j], o) <= GROUND_TILES) near.push(all[j]);
      if (near.length > best.length) { best = near; start = o; }
    }
    // (A kind only a world event places: worked as a lone one.)
    m.set(objId, best.length ? { n: best.length, nodes: best.map((o) => ({ x: o.x, y: o.y })), start: best.indexOf(start) } : { n: 1, nodes: [{ x: 0, y: 0 }], start: 0 });
  }
  return m.get(objId);
}

/** Auto gather's round of a ground (Game._nextGatherNode): work a node for
 *  `visit` ticks, after which it takes `regrow` ticks to come back; walk on to
 *  the nearest one that's ready from where you stand, or wait for the first to
 *  come back. Followed for a few hundred visits with a visit's average length,
 *  which is cheap for a ground of a few dozen. You stand beside each node on
 *  the side you came from and run to the next (Agility quickens it; a diagonal
 *  step takes √2 as long), and auto gather works it from the first tick after
 *  you arrive, so a walk shorter than a tick costs nothing. Returns visits a
 *  tick, ticks walked and waited a visit, and the run of gathering ticks
 *  between gaps long enough to end a streak (Infinity: none are). */
const ROUNDS = new WeakMap();
const ROUND_VISITS = 400, ROUND_SETTLE = 100;   // (visits followed, and the first ones left out while it settles)
function groundPace(game, objId, gr, visit, regrow) {
  const step = TICK_MS * (game.playerStepMul?.() ?? 0.7) * ((game.canRun?.() ?? true) ? (game.player?.runMul ?? 0.5) : 1);
  let m = ROUNDS.get(game);
  if (!m) { m = new Map(); ROUNDS.set(game, m); }
  const key = `${objId}:${visit.toFixed(2)}:${regrow}:${step.toFixed(1)}`;
  if (m.has(key)) return m.get(key);
  if (m.size > 500) m.clear();
  const ready = gr.nodes.map(() => 0), nodes = gr.nodes;
  let at = Math.max(0, gr.start), me = { x: nodes[at].x + 1, y: nodes[at].y };
  let t = 0, t0 = 0, walked = 0, waited = 0, gaps = 0, lastWork = 0;
  const nearest = (now) => {
    let nb = -1;
    for (let i = 0; i < nodes.length; i++) if (i !== at && ready[i] <= now && (nb < 0 || cheb(nodes[i], me) < cheb(nodes[nb], me))) nb = i;
    return nb;
  };
  for (let k = 0; k < ROUND_VISITS; k++) {
    if (k === ROUND_SETTLE) { t0 = t; walked = 0; waited = 0; gaps = 0; }
    ready[at] = t + visit + regrow; t += visit; lastWork = t;
    let nb = nearest(t);
    if (nb < 0) {   // none ready: wait for the first back (this one, on a ground of one)
      const back = Math.min(...ready);
      waited += back - t; t = back;
      nb = ready.indexOf(back);
      const near = nearest(t);
      if (near >= 0) nb = near;
    }
    if (nb !== at) {
      const to = { x: nodes[nb].x + Math.sign(me.x - nodes[nb].x), y: nodes[nb].y + Math.sign(me.y - nodes[nb].y) };
      const dx = Math.abs(to.x - me.x), dy = Math.abs(to.y - me.y), diag = Math.min(dx, dy);
      const w = Math.max(1, Math.ceil(((Math.max(dx, dy) - diag) + diag * Math.SQRT2) * step / TICK_MS)) - 1;
      walked += w; t += w; me = to;
    }
    at = nb;
    if (t - lastWork > STREAK_GAP_TICKS) gaps++;
  }
  const visits = ROUND_VISITS - ROUND_SETTLE, span = t - t0;
  const r = { perTick: visits / span, walk: walked / visits, wait: waited / visits, run: gaps ? visits * visit / gaps : Infinity };
  m.set(key, r);
  return r;
}

/** A gathering streak's XP multiplier on average over the gathering ticks, and
 *  a lucky find's chance a tick, when the streak starts again every `run` of
 *  them (gathering.js: a tick's XP counts the streak so far, then it grows). */
function streakOf(run) {
  if (!GATHER_FUN.on) return { mult: 1, lucky: 0 };
  if (!Number.isFinite(run)) return { mult: streakXpMult(Infinity), lucky: luckyChance(Infinity) };
  const k = Math.max(1, Math.round(run));
  let mult = 0, lucky = 0;
  for (let c = 0; c < k; c++) { mult += streakXpMult(c); lucky += luckyChance(c + 1); }
  return { mult: mult / k, lucky: lucky / k };
}

/** The world's fishing spots, once a game: where each is and the lowest level that can fish it. */
const SPOTS = new WeakMap();
function fishSpots(game) {
  let list = SPOTS.get(game);
  if (!list) {
    list = (game.world?.objects || []).filter((o) => o.def?.type === 'fishing' && o.def.catches && !o.worldEvent)
      .map((o) => ({ o, objId: o.objId, x: o.x, y: o.y, lvl: Math.min(...o.def.catches.map((c) => c.level || 1)) }));
    SPOTS.set(game, list);
  }
  return list;
}

/** The share of passing schools that come to a spot of this kind you'd be
 *  fishing, where its spots lie best for it (fishschool.js spawn): a school
 *  picks a spot near you that your level can fish, mostly one of your kind
 *  while you fish, and auto gather follows one that lands close by. */
const SHARES = new WeakMap();
function schoolShare(game, objId, lvl) {
  const ok = fishSpots(game).filter((p) => p.lvl <= lvl);
  const key = `${objId}:${ok.length}`;   // (only a new kind of spot opening up changes it)
  let m = SHARES.get(game);
  if (!m) { m = new Map(); SHARES.set(game, m); }
  if (!m.has(key)) {
    let best = 0;
    for (const s of ok) {
      if (s.objId !== objId) continue;
      const near = ok.filter((p) => cheb(p, s) <= SCHOOL_NEAR);
      const same = near.filter((p) => p.objId === objId).length;
      const follow = near.filter((p) => p.objId === objId && cheb(p, s) <= SCHOOL_AUTO).length;
      best = Math.max(best, SCHOOL_SAME_KIND * follow / same + (1 - SCHOOL_SAME_KIND) * follow / near.length);
    }
    m.set(key, best);
  }
  return m.get(key);
}
/** A passing school's size for you on average (its roll grown by your level and tool). */
function schoolSize(lvl, tb) {
  let sum = 0;
  for (let r = SCHOOL_HAUL[0]; r <= SCHOOL_HAUL[1]; r++) sum += passingSchoolSize(r, lvl, tb);
  return sum / (SCHOOL_HAUL[1] - SCHOOL_HAUL[0] + 1);
}

/** XP an hour at a skill-guide source (skillguide.js gatherSources) for the
 *  player as they are now, or null where there's no honest figure:
 *  { perHour, why (what it counts, plain text), parts ({ name: share of the hour }) }. */
export function xpRate(game, s) {
  if (!s || !game?.skills) return null;
  const lvl = game.skills.level(s.skill);
  if (lvl < (s.level || 1)) return null;   // not yet: there's no "at your level" for it
  const id = s.objIds?.[0], def = id ? OBJECTS[id] : null;
  const fx = unlockFx(game, s.skill);
  const rate = rateOf(game, s.skill), x = listedXp(game, s);
  const quickly = (extra) => (fx.quick ? (1 + extra) * (1 + fx.quick) - 1 : extra);   // the unlocks' quick actions, as more of a roll a tick
  const haul = LEVEL_HAUL.on ? levelHaulPct(lvl) / 100 : 0;   // a tick's chance of the bonus haul (its XP as listed: s.xp)
  const findXp = Math.round(nodeXp(def || {}, lvl) * LUCKY_XP_MULT);

  // A gathering hour from its pieces, each in XP a tick before the rates: what
  // the rolls pay, whole trees, seams or schools, passing schools, then each
  // gathering tick's bonus haul and lucky find (and Mining's gems), all lifted
  // by the streak. `run`: gathering ticks before a gap ends the streak.
  const gathered = ({ rolls, whole = 0, schools = 0, gems = 0, gatherTicks, run = Infinity, also = [] }, text) => {
    const st = streakOf(run);
    const p = { rolls, whole, schools, haul: gatherTicks * haul * s.xp, finds: gatherTicks * st.lucky * findXp + gems };
    const raw = Object.values(p).reduce((a, b) => a + b, 0);
    const parts = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, raw ? v / raw : 0]));
    const counted = [whole && `whole ${s.skill === 'fishing' ? 'schools' : s.skill === 'mining' ? 'seams' : s.skill === 'hunter' ? 'flocks' : s.skill === 'diving' ? 'reef beds' : s.skill === 'archaeology' ? 'rich layers' : 'trees'} at once (${pct(parts.whole)} of it)`,
      schools && `passing schools (${pct(parts.schools)})`, ...also, haul && 'your level\'s bonus haul', gems && 'gems', st.lucky && 'lucky finds',
      st.mult > 1 && `a gathering streak (+${Math.round((st.mult - 1) * 100)}%)`].filter(Boolean);
    return { perHour: raw * st.mult * rate * TICKS_AN_HOUR, parts,
      why: `${cap(text)}.${counted.length ? ` Counted: ${list(counted)}.` : ''} ${onTop(s, def)}` };
  };
  // Trees, rocks and traps: a visit's rolls and ticks, then auto gather's round of the ground.
  const worked = (t, v, regrow, gems, what) => {
    const gr = groundOf(game, id);
    const g = groundPace(game, id, gr, v.ticks, regrow);
    const r = gathered({ rolls: g.perTick * v.rolls * x, whole: g.perTick * (v.whole || 0) * x, gems: g.perTick * v.rolls * gems, gatherTicks: g.perTick * v.ticks, run: g.run,
      also: gr.n > 1 ? [`the walk between the ${gr.n} that lie closest together`, `waiting for them to ${what}`] : [`waiting for it to ${what}`] },
    `${t.text}, at your level, with auto gather working only this kind`);
    return { ...r, pace: { n: gr.n, visit: v.ticks, walk: g.walk, wait: g.wait, regrow, perTick: g.perTick } };   // (the tests time these)
  };

  if (s.skill === 'fishing' && def) {
    const t = toolFor(game, s.tool || def.tool || 'net');
    // resolveFish: a trophy pays its fish three times over; else a big catch
    // lands two, both paid. Either way the catch may net a whole school.
    const trophy = Math.min(1, trophyChance(t)), big = Math.min(1, bigCatchChance(game, lvl, t));
    const per = 1 + quickly(t.extra);
    const wild = NODE_JACKPOT.on ? jackpotChance(t.find, lvl) * SEAM_MULT * (WILD_STOCK[0] + WILD_STOCK[1]) / 2 : 0;
    const passing = FISH_SCHOOL.on ? schoolShare(game, id, lvl) * schoolSize(lvl, t) / ((SCHOOL_GAP[0] + SCHOOL_GAP[1]) / 2) : 0;
    return gathered({ rolls: per * x * (trophy * TROPHY_XP_MULT + (1 - trophy) * (1 + big)), whole: per * x * wild, schools: passing * x, gatherTicks: 1 },
      `${t.text}, at your level: about ${fmt(per * TICKS_AN_HOUR)} casts an hour${big >= 0.995 ? ', every one a big catch (two fish)' : big > 0.005 ? `, ${Math.round(big * 100)}% of them big catches (two fish)` : ''}`);
  }
  if (s.skill === 'diving' && def) {
    // resolveDive: a find a roll while you're under (a better piece of gear's
    // second one pays no XP), none while you're up for air; now and then the
    // whole reef bed at once (as Hunter's whole flock: 10-140 finds, each paid).
    const t = toolFor(game, 'divegear');
    const breath = diveBreath(game), up = diveUptime(breath);
    const per = (1 + quickly(t.extra)) * up;
    const reef = NODE_JACKPOT.on ? jackpotBase(lvl) * SEAM_MULT * (HUNT_STOCK[0] + HUNT_STOCK[1]) / 2 : 0;
    return gathered({ rolls: per * x, whole: per * x * reef, gatherTicks: up },
      `${t.id ? t.text : 'free-diving (no dive gear)'}, at your level: dives of ${breath} ticks with ${SURFACE_TICKS} up for air between, about ${fmt(per * TICKS_AN_HOUR)} finds an hour`);
  }
  if (s.skill === 'archaeology' && def) {
    // resolveExcavate: a find every roll (a better trowel's second one pays no
    // XP), and now and then a whole rich layer at once (10-140 finds, each paid).
    // The relics are XP later, at the bench: not counted here.
    const t = toolFor(game, 'trowel');
    const per = 1 + quickly(t.extra);
    const layer = NODE_JACKPOT.on ? jackpotBase(lvl) * SEAM_MULT * (HUNT_STOCK[0] + HUNT_STOCK[1]) / 2 : 0;
    return gathered({ rolls: per * x, whole: per * x * layer, gatherTicks: 1 },
      `${t.id ? t.text : 'digging with your hands (no trowel)'}, at your level: about ${fmt(per * TICKS_AN_HOUR)} digs an hour`);
  }
  if ((s.skill === 'woodcutting' || s.skill === 'mining') && def) {
    const t = toolFor(game, s.tool);
    const mine = s.skill === 'mining';
    const dbl = Math.min(1, doubleChance(game, lvl, t));
    const jp = NODE_JACKPOT.on ? jackpotChance(t.find, lvl) : 0;
    const extra = quickly(t.extra), keep = Math.min(fx.keep || 0, KEEP_MOST);
    if (!mine && !(def.depleteChance > 0)) {   // a world event's ancient tree never falls (and never comes down whole)
      const per = 1 + extra;
      return gathered({ rolls: per * x, gatherTicks: 1 }, `${t.text}, at your level, at a tree that never falls`);
    }
    const [lo, hi] = mine ? [ROCK_ORES_MIN, ROCK_ORES_MAX] : [TREE_LOGS_MIN, TREE_LOGS_MAX];
    const v = cached(`node:${lo}:${hi}:${dbl}:${jp}:${keep}:${extra}`, () => { const nv = nodeVisit(lo, hi, dbl, jp, keep); return { ...visitPace(nv.S, extra), whole: nv.whole }; });
    const gem = mine && !def.gemRock ? Math.min(1, gemChance(lvl, t)) * GEM_XP : 0;   // a lucky gem's XP a swing, on average (resolveMine)
    return worked(t, v, def.respawn || s.respawn || 0, gem, mine ? 'grow back' : 'regrow');
  }
  if (s.skill === 'hunter' && def?.depleteChance) {
    const t = toolFor(game, 'snare');
    const extra = quickly(t.extra);
    // A catch's whole flock (jackpot.js huntJackpot): about 1 in 20, 10-140
    // catches at its XP each, and the trap stays set (so the visits are as before).
    const flock = NODE_JACKPOT.on ? jackpotBase(lvl) * SEAM_MULT * (HUNT_STOCK[0] + HUNT_STOCK[1]) / 2 : 0;
    // resolveHunt: each catch may run the trap dry (unless an unlock keeps it
    // set), and a dry trap takes `respawn` ticks to reset. Kept set for good,
    // it would never run dry: no visits and no resets.
    const end = def.depleteChance * (1 - Math.min(fx.keep || 0, 1));
    if (!(end > 0)) { const per = 1 + extra; return gathered({ rolls: per * x, whole: per * x * flock, gatherTicks: 1 }, `${t.text}, at your level, at a trap that stays set`); }
    const v = cached(`trap:${end}:${extra}`, () => visitPace((n) => (1 - end) ** n, extra));
    return worked(t, { ...v, whole: v.rolls * flock }, def.respawn || s.respawn || 0, 0, 'reset');
  }
  const done = (perTick, why) => ({ perHour: perTick * x * rate * TICKS_AN_HOUR, why, parts: { rolls: 1 } });
  if (s.skill === 'thieving' && def?.type === 'stall') {
    // Game.stealFromStall: a theft empties the stall for `respawn` ticks (an
    // unlock may leave it stocked); a failed try stuns you, then you try again.
    const sure = stallChance(def, lvl);
    const keep = fx.keep || 0, restock = def.respawn || 5;
    const ticks = (1 - keep) * restock + keep + (1 - sure) / sure * CAUGHT_TICKS;
    return done(1 / ticks, `At your level: you get away with ${Math.round(sure * 100)}% of tries, the stall restocks ${fmtS(restock)} after each theft, and a failed try stuns you. ${onTop(s, def)}`);
  }
  if (s.skill === 'thieving' && (s.npcId || s.key === 'pickpocket')) {
    return done(1, `At your level: one pick a tick, with auto gather on and your mark standing still (one that wanders off slows you). ${onTop(s, def)}`);
  }
  if (s.skill === 'agility' && def && def.markChance === undefined) {
    // Game.resolveAgility: a lone obstacle (not part of a course) is crossed again every tick.
    return done(1, `At your level: crossed once a tick. ${onTop(s, def)}`);
  }
  return null;
}

// What the figure leaves out, for its hover text.
const onTop = (s, def) => `Golden hours and rested XP come on top${GATHERING.has(s.skill)
  ? `, as do ${list([def?.night && 'night bonuses', (s.skill === 'fishing' || s.skill === 'hunter') && 'bait', 'daily contracts'].filter(Boolean))}` : ''}.`;
const GATHERING = new Set(['woodcutting', 'mining', 'fishing', 'hunter', 'diving', 'archaeology']);

const cap = (t) => t[0].toUpperCase() + t.slice(1);
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');
const pct = (f) => (f >= 0.995 ? 'nearly all' : f < 0.01 ? 'under 1%' : `about ${Math.round(f * 100)}%`);
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const fmtS = (ticks) => `${Math.round(ticks * TICK_MS / 100) / 10}s`;
