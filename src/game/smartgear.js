// Refine and enchant runs, and "Improve worn gear". Late in the game the gear
// windows meant a tap per refine try and a tap or two per enchant pick, again
// and again (about 25 taps to refine a weapon high, about 130 for every safe
// upgrade on everything worn). These run the very same attempts one after
// another, after one confirm in the window (src/ui/smartgearui.js):
//   Keep refining until…   one ★ after another up to a target, within the
//                          scroll and ward limits you set;
//   Keep enchanting until… picks (and, if you allow it, ward rerolls) until
//                          the piece has the lines you aim for;
//   Improve worn gear      every risk-free upgrade on everything worn: refine
//                          to ★9 (no try at ★9 or below can lose a level or
//                          break a piece), fill empty enchant lines, and feed
//                          materials up to Master (feedall.js).
// Nothing about the odds or costs changes: every attempt is Game.refineItem,
// pickEnchant, rerollEnchant or feedMastery, as a tap would make it. Only the
// pack is used, never the bank. The forecasts are seeded simulations of the
// same rules (refine.js, mastery.js), so the same settings always show the
// same numbers. No DOM, and no Math.random of their own.
import { getItem } from '../data/items.js';
import { EQUIP_SLOTS } from './equipment.js';
import { MAX_REFINE, SCROLL, refineCost, refineOdds, rollRefine, refineTag } from './refine.js';
import { MAX_ENCHANTS, ENCHANT_STEP, STONE, WARD, MASTERY_RANKS, rankFor, enchantPool, enchantValue, enchantCost, enchantLabel } from './mastery.js';
import { FEED_CAP, feedXp, materialKind } from './materials.js';
import { worthState, stateKeyFor, gainOf } from './statworth.js';
import { feedAllPlan, feedAll } from './feedall.js';
import { gearRating } from './gear.js';
import { mulberry32 } from './pets.js';

/** The highest ★ no try can lose a level or break a piece on the way to. */
export const SAFE_REFINE = 9;
/** No run goes past this many attempts (a guard: the limits stop it long before). */
const RUN_GUARD = 500;
// Each ★'s scroll cost and odds (refine.js), looked up rather than rebuilt for
// every try of the thousand simulated runs behind a forecast. (Every item pays
// the same, see refineCost.)
const COST = [0], ODDS = [null], PRICE = [0];
for (let n = 1; n <= MAX_REFINE; n++) {
  COST[n] = refineCost(null, n).scrolls;
  ODDS[n] = refineOdds(n);
  PRICE[n] = COST[n] / ODDS[n].success;
}

const num = (n) => Math.round(n).toLocaleString('en-US');
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const star = (lv) => refineTag(lv) || '★0';
const pieceName = (id, copy) => `${copy === 'off' ? 'off-hand ' : ''}${getItem(id).name.toLowerCase()}`;

/** { avg, p90, max } of a list of numbers (0s for an empty list). */
function spread(xs) {
  if (!xs.length) return { avg: 0, p90: 0, max: 0 };
  const s = xs.slice().sort((a, b) => a - b);
  return { avg: s.reduce((t, x) => t + x, 0) / s.length, p90: s[Math.max(0, Math.ceil(s.length * 0.9) - 1)], max: s[s.length - 1] };
}

/** Run `fn` with the run's own chatter held back: each try's chat line and
 *  sound would otherwise pour out (a refine run can be fifty tries), and every
 *  pack change would redraw the bag. Chat and sound events are dropped (the run
 *  posts one summary afterwards); everything else (equipment, banners) goes
 *  through as usual, and the pack tells its listeners once, at the end. */
export function quiet(game, fn) {
  const bus = game.bus;
  const own = Object.prototype.hasOwnProperty.call(bus, 'emit');
  const emit = bus.emit;
  bus.emit = function (ev, ...args) { if (ev === 'chat' || ev === 'sfx') return undefined; return emit.call(this, ev, ...args); };
  const held = game.inventory.hold?.() || false;
  try { return fn(); } finally {
    if (own) bus.emit = emit; else delete bus.emit;
    if (held) game.inventory.release();
  }
}

/** A run's one line in the chat, one sound, and an early save. */
function tell(game, text, good) {
  game.msg(text, good ? 'level' : 'system');
  game.bus.emit('sfx', good ? 'level' : 'hurt');
  game.saveSoon = true;
}

// ---------------- Why a run stopped (or can't start) ----------------
export const STOP_TEXT = {
  target: 'it reached its target',
  scrollcap: 'your scroll limit',
  scrolls: 'you ran out of refine scrolls',
  wardcap: 'your ward limit (the next try could need a ward)',
  downgrade: 'no ward left: the next try could cost a level',
  break: 'no ward left: the next try could break it',
  budget: 'your try limit',
  stones: 'you ran out of upgrade stones',
  coins: 'you ran out of coins',
  'no-safe-pick': 'nothing on offer fitted without weakening a line',
  error: 'it couldn\'t go on',
  guard: 'it couldn\'t go on',
};
// The same reasons when the run can't even start.
const START_TEXT = {
  scrollcap: 'Your scroll limit is below what the next ★ costs.',
  wardcap: 'The next try could need a ward: allow at least one, or stop below ★10.',
  downgrade: 'From ★10 a bad roll costs a level and you carry no ward. Tick \'Keep going…\' to risk it, or bring wards.',
  break: 'From ★13 a bad roll can break the piece, and you carry no ward.',
};

/** Words for a stop `reason` ('target', 'scrollcap', ...). `ctx`: { start: true }
 *  for why a run can't start, { level } to name the ★ reached. */
export function stopText(reason, ctx = {}) {
  if (ctx.start && START_TEXT[reason]) return START_TEXT[reason];
  if (reason === 'target' && ctx.level != null) return `it reached ${star(ctx.level)}`;
  return STOP_TEXT[reason] || STOP_TEXT.error;
}

// ---------------- Refine ----------------

/** Should a refine run stop before its next try, and why? null to go on, else
 *  'target' | 'scrollcap' | 'scrolls' | 'wardcap' | 'downgrade' | 'break'.
 *  `st`: { level, used, wardsUsed, packScrolls, packWards }; `o`: { target,
 *  maxScrolls, maxWards, allowDowngrade }. A ward in the pack is spent by
 *  refineItem on any bad roll, so with wards in the pack the run stops at its
 *  ward limit before a try that could need one; with none, it never risks a
 *  break, and risks a level only when allowed. */
export function refineStop(st, o) {
  if (st.level >= o.target || st.level >= MAX_REFINE) return 'target';
  const next = st.level + 1, cost = COST[next];
  if (st.used + cost > o.maxScrolls) return 'scrollcap';
  if (st.packScrolls < cost) return 'scrolls';
  const odds = ODDS[next];
  if (odds.downgrade + odds.broken > 0) {
    if (st.packWards > 0 && st.wardsUsed >= o.maxWards) return 'wardcap';
    if (st.packWards <= 0 && odds.broken > 0) return 'break';
    if (st.packWards <= 0 && !o.allowDowngrade) return 'downgrade';
  }
  return null;
}

/** What a refine run from `level` with settings `o` (plus o.packScrolls and
 *  o.packWards, what you carry) is likely to do, from `runs` seeded runs of the
 *  real odds: { startStop (why it can't start, or null), reach (the share that
 *  gets to the target), ends ({ ★: share }), scrolls and wards ({ avg, p90,
 *  max }), tries ({ avg }) }. The same settings always give the same answer. */
export function refineForecast(level, o, { runs = 1000, seed = 2026 } = {}) {
  const rand = mulberry32(seed);
  const start = { level, used: 0, wardsUsed: 0, packScrolls: o.packScrolls ?? Infinity, packWards: o.packWards ?? 0 };
  const ends = {}, scrolls = [], wards = [];
  let reach = 0, tries = 0;
  for (let k = 0; k < runs; k++) {
    const st = { ...start };
    for (let guard = 0; guard < RUN_GUARD && !refineStop(st, o); guard++) {
      const next = st.level + 1, cost = COST[next];
      st.used += cost; st.packScrolls -= cost; tries++;
      const out = rollRefine(next, rand());
      // A ward in the pack takes a downgrade or a break, as refineItem does.
      if ((out === 'downgrade' || out === 'broken') && st.packWards > 0) { st.packWards--; st.wardsUsed++; }
      else if (out === 'success') st.level = next;
      else if (out === 'downgrade') st.level--;
      else if (out === 'broken') { st.level = 0; break; }   // (refineStop never lets a run risk this)
    }
    ends[st.level] = (ends[st.level] || 0) + 1;
    if (st.level >= o.target) reach++;
    scrolls.push(st.used); wards.push(st.wardsUsed);
  }
  for (const lv of Object.keys(ends)) ends[lv] /= runs;
  return { startStop: refineStop(start, o), reach: reach / runs, ends, scrolls: spread(scrolls), wards: spread(wards), tries: { avg: tries / runs } };
}

/** Does the climb from `level` to `target` always work (★1–★5 never fail)? */
export const refineSure = (level, target) => target <= 5 || level >= target;

/** The settings a refine run starts with, or null at ★15: aim for ★9 below
 *  ★9, ★12 from there and ★15 from ★12, with room for nine runs in ten to get
 *  there (in fives of scrolls), within what you carry. */
export function refineDefaults(game, id, copy = 'main', { allowDowngrade = false } = {}) {
  const lv = game.equipment.refineLevel(id, copy);
  if (lv >= MAX_REFINE) return null;
  const target = lv < SAFE_REFINE ? SAFE_REFINE : lv < 12 ? 12 : MAX_REFINE;
  const scrolls = game.inventory.count(SCROLL), wards = game.inventory.count(WARD);
  const need = refineForecast(lv, { target, maxScrolls: Infinity, maxWards: Infinity, allowDowngrade, packScrolls: Infinity, packWards: wards });
  const nextCost = refineCost(id, lv + 1).scrolls;
  const maxScrolls = Math.min(scrolls, Math.max(nextCost, Math.ceil(need.scrolls.p90 / 5) * 5));
  const maxWards = target <= SAFE_REFINE ? 0 : Math.min(wards, need.wards.p90);
  return { target, maxScrolls, maxWards, allowDowngrade };
}

/** Refine `id` (`copy`) one try at a time, at the usual cost and odds
 *  (Game.refineItem), until refineStop says stop. `rand` gives each try's roll.
 *  Returns { id, copy, from, to, tries, scrolls, wards, outcomes, stop }. */
export function runRefine(game, id, o, { copy = 'main', rand = Math.random } = {}) {
  const eqp = game.equipment, inv = game.inventory;
  const from = eqp.refineLevel(id, copy);
  const res = { id, copy, from, to: from, tries: 0, scrolls: 0, wards: 0, outcomes: { success: 0, fail: 0, downgrade: 0, warded: 0, broken: 0 }, stop: null };
  quiet(game, () => {
    for (let guard = 0; guard < RUN_GUARD; guard++) {
      const st = { level: eqp.refineLevel(id, copy), used: res.scrolls, wardsUsed: res.wards, packScrolls: inv.count(SCROLL), packWards: inv.count(WARD) };
      const why = refineStop(st, o);
      if (why) { res.stop = why; return; }
      const out = game.refineItem(id, rand(), copy);
      if (out == null) { res.stop = 'error'; return; }
      res.tries++;
      res.scrolls += st.packScrolls - inv.count(SCROLL);
      res.wards += st.packWards - inv.count(WARD);
      res.outcomes[out] = (res.outcomes[out] || 0) + 1;
      if (out === 'broken') { res.stop = 'broken'; return; }   // (refineStop never lets a run risk this)
    }
    res.stop = 'guard';
  });
  res.to = eqp.refineLevel(id, copy);
  const used = `${plural(res.scrolls, 'scroll')}${res.wards ? `, ${plural(res.wards, 'ward')}` : ''}`;
  const name = pieceName(id, copy);
  const why = res.stop === 'target' ? '' : `: ${stopText(res.stop)}`;
  tell(game, res.tries === 0 ? `Keep refining: your ${name} wasn't tried${why}.`
    : res.to !== res.from ? `Keep refining: your ${name} went ${star(res.from)} → ${star(res.to)} in ${plural(res.tries, 'try', 'tries')} (${used})${why}.`
      : `Keep refining: your ${name} stayed ${star(res.to)} after ${plural(res.tries, 'try', 'tries')} (${used})${why}.`, res.to > res.from);
  return res;
}

// ---------------- Enchant ----------------

/** How much more damage a line on `id` gives you (in %), by statworth.js's
 *  expected-damage sums: 0 for lifesteal and boss damage (they deal no damage
 *  in general), for a stat your style doesn't use, and on a piece of another
 *  style. Remembered per stat and size while the run lasts. */
export function lineWorth(game, id) {
  const s = worthState(game), fits = game.equipment.styleFits(id), memo = {};
  return (line) => {
    const m = memo[line.stat] || (memo[line.stat] = {});
    let v = m[line.value];
    if (v === undefined) {
      const k = stateKeyFor(s, line.stat);
      v = m[line.value] = !fits || !k || line.stat === 'lifesteal' || line.stat === 'bossDmg' ? 0 : gainOf(s, k, line.value) * 100;
    }
    return v;
  };
}
// Lines worth the same go to the bigger one (by its stat's base step).
const tie = (l) => (l.value / (ENCHANT_STEP[l.stat] || 1)) * 1e-6;

/** The lines that would add the most damage on this piece (up to three
 *  stats, repeats allowed), picked one at a time, each on top of the last. A
 *  worn piece is weighed without its own lines, which the new ones replace. */
export function bestAim(game, id, copy = 'main') {
  const eqp = game.equipment;
  if (!eqp.styleFits(id)) return [];
  const s = { ...worthState(game) };
  // (Your totals are the main hand's blow: a dual wielder's off-hand piece isn't in them.)
  const worn = copy === 'main' && EQUIP_SLOTS.some((sl) => eqp.get(sl) === id && eqp.copyIn(sl) === 'main' && !(sl === 'shield' && eqp.isDualWielding()));
  if (worn) for (const l of eqp.enchantLines(id, copy)) { const k = stateKeyFor(s, l.stat); if (k) s[k] -= l.value; }
  const pool = enchantPool(id).filter((st) => st !== 'lifesteal' && st !== 'bossDmg');
  const aim = [];
  while (aim.length < MAX_ENCHANTS) {
    let best = null, gain = 0;
    for (const stat of pool) {
      const k = stateKeyFor(s, stat);
      const g = k ? gainOf(s, k, enchantValue(id, stat)) : 0;
      if (g > gain) { best = stat; gain = g; }
    }
    if (!best) break;
    aim.push(best);
    s[stateKeyFor(s, best)] += enchantValue(id, best);
  }
  return aim;
}

/** One step of an enchant run: which offer to take, and over which line.
 *  `aim`: the stats wanted (a multiset; null for "anything"). Returns
 *  { done } | { pick, replace, same?, fill?, sideways? } | { reroll } | { stop: 'no-safe-pick' }.
 *  It keeps every line it aims for (the piece's own lines of an aimed stat,
 *  the biggest first), never replaces one with another stat, and never
 *  replaces a line with a smaller one of its stat. */
export function enchantStep(lines, offers, aim, worth, canReroll) {
  // (Plain loops over three lines and three offers: a forecast takes thousands of steps.)
  const v = (l) => worth(l) + tie(l);
  const n = lines.length;
  // The aimed lines the piece already has, the biggest first; what's still missing.
  const missing = [];
  for (const st of aim) if (st) missing.push(st);
  let looked = 0, kept = 0;   // a bit per line
  for (let pass = 0; pass < n; pass++) {
    let big = -1;
    for (let i = 0; i < n; i++) if (!(looked & (1 << i)) && (big < 0 || lines[i].value > lines[big].value)) big = i;
    looked |= 1 << big;
    const at = missing.indexOf(lines[big].stat);
    if (at >= 0) { missing.splice(at, 1); kept |= 1 << big; }
  }
  const isKept = (i) => (kept & (1 << i)) !== 0;
  if (!missing.length) return { done: true };
  const full = n >= MAX_ENCHANTS;
  // The line to give up: one of a stat not aimed for first, then the least worth.
  let spare = -1;
  for (let i = 0; i < n; i++) {
    if (isKept(i)) continue;
    if (spare < 0) { spare = i; continue; }
    const a = aim.includes(lines[i].stat), b = aim.includes(lines[spare].stat);
    if ((!a && b) || (a === b && v(lines[i]) < v(lines[spare]))) spare = i;
  }
  // An offer of a line still missing: take it.
  let hit = -1, top = -1;
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i];
    if (top < 0 || v(o) > v(offers[top])) top = i;
    if (missing.includes(o.stat) && (hit < 0 || v(o) > v(offers[hit]))) hit = i;
  }
  if (hit >= 0) return { pick: hit, replace: full ? spare : null };
  // None: a ward brings three new ones (when allowed)...
  if (canReroll) return { reroll: true };
  // ...else a pick does: into an empty slot,
  if (!full) return top >= 0 ? { pick: top, replace: null, fill: true } : { stop: 'no-safe-pick' };
  // or the same line again, at least as big (nothing changes, new offers come), a spare one first,
  let sPick = -1, sLine = -1, sSpare = false;
  for (let i = 0; i < offers.length; i++) {
    for (let j = 0; j < n; j++) {
      if (offers[i].stat !== lines[j].stat || offers[i].value < lines[j].value) continue;
      const sp = !isKept(j);
      if (sPick < 0 || (sp && !sSpare) || (sp === sSpare && v(offers[i]) > v(offers[sPick]))) { sPick = i; sLine = j; sSpare = sp; }
    }
  }
  if (sPick >= 0) return { pick: sPick, replace: sLine, same: true };
  // or a line worth at least as much over the spare one.
  if (top >= 0 && spare >= 0 && v(offers[top]) >= v(lines[spare])) return { pick: top, replace: spare, sideways: true };
  return { stop: 'no-safe-pick' };
}

/** The most `picks` tries can cost on a piece with `lineCount` lines:
 *  { stones, coins }. Each pick on a piece that isn't full adds a line, and a
 *  full piece pays the third line's price, so this is the exact top. */
export function enchantMaxSpend(id, lineCount, picks) {
  let stones = 0;
  for (let k = 0; k < picks; k++) stones += enchantCost(id, lineCount + k).stones;
  return { stones, coins: picks * enchantCost(id, 0).coins };
}

/** How many tries (up to `cap`) the stones and coins in your pack can pay for. */
export function affordablePicks(game, id, copy = 'main', cap = 50) {
  const n = game.equipment.enchantLines(id, copy).length;
  const stones = game.inventory.count(STONE), coins = game.inventory.count('coins');
  let k = 0;
  while (k < cap) {
    const m = enchantMaxSpend(id, n, k + 1);
    if (m.stones > stones || m.coins > coins) break;
    k++;
  }
  return k;
}

/** What an enchant run is likely to do, from `runs` seeded runs: the first
 *  step with the offers on the table now, later ones with fresh offers, as
 *  picks bring them. { done (the share that gets every aimed line), picks
 *  ({ avg, p90 } of the runs that got there), stones ({ avg }), wards ({ avg }),
 *  stops ({ reason: share }) }. */
export function enchantForecast(id, lines, offers, aim, worth, { maxPicks = 50, maxWards = 0, packWards = 0, runs = 1000, seed = 2026 } = {}) {
  const rand = mulberry32(seed);
  // New offers as rollEnchantOffers draws them (three different stats, each
  // as likely), from lines made once: the simulated lines are never changed.
  const pool = enchantPool(id), lineOf = pool.map((stat) => ({ stat, value: enchantValue(id, stat) }));
  const left = pool.map((_, i) => i), fresh = [];
  const roll = () => {
    let len = pool.length;
    for (let i = 0; i < len; i++) left[i] = i;
    fresh.length = 0;
    while (fresh.length < 3 && len) {
      const j = Math.floor(rand() * len);
      fresh.push(lineOf[left[j]]);
      for (let i = j; i < len - 1; i++) left[i] = left[i + 1];
      len--;
    }
    return fresh;
  };
  const picksDone = [], stops = {};
  const stoneCost = [0, 1, 2, 3].map((n) => enchantCost(id, n).stones);   // a pick's stones by the lines already on
  let stones = 0, wards = 0;
  for (let k = 0; k < runs; k++) {
    const L = lines.slice();
    let O = offers, picks = 0, rerolls = 0, stop = 'guard';
    for (let guard = 0; guard < RUN_GUARD; guard++) {
      const d = enchantStep(L, O, aim, worth, rerolls < maxWards && rerolls < packWards);
      if (d.done) { stop = 'done'; break; }
      if (picks >= maxPicks) { stop = 'budget'; break; }
      if (d.stop) { stop = d.stop; break; }
      if (!d.reroll) {
        stones += stoneCost[Math.min(L.length, 3)]; picks++;
        if (L.length >= MAX_ENCHANTS) L[d.replace] = O[d.pick]; else L.push(O[d.pick]);
      } else rerolls++;
      O = roll();
    }
    stops[stop] = (stops[stop] || 0) + 1;
    wards += rerolls;
    if (stop === 'done') picksDone.push(picks);
  }
  for (const r of Object.keys(stops)) stops[r] /= runs;
  const p = spread(picksDone);
  return { done: picksDone.length / runs, picks: { avg: p.avg, p90: p.p90 }, stones: { avg: stones / runs }, wards: { avg: wards / runs }, stops };
}

/** "+7% physical damage bonus ×2 and +11% crit damage" for an aim on `id`. */
export function aimText(id, aim) {
  const n = {};
  for (const st of aim) if (st) n[st] = (n[st] || 0) + 1;
  const parts = Object.keys(n).map((st) => `${enchantLabel({ stat: st, value: enchantValue(id, st) })}${n[st] > 1 ? ` ×${n[st]}` : ''}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || '';
}

/** Enchant `id` (`copy`) until it has the aimed lines, at most `maxPicks`
 *  picks and `maxWards` ward rerolls, each one Game.pickEnchant or
 *  rerollEnchant at its usual cost, and never more than `maxStones` stones and
 *  `maxCoins` coins in all (what the confirm named). Returns { id, copy, from,
 *  to, picks, rerolls, same (picks that changed nothing), stones, coins, wards, stop }. */
export function runEnchant(game, id, { aim, maxPicks, maxWards = 0, maxStones = Infinity, maxCoins = Infinity }, { copy = 'main' } = {}) {
  const eqp = game.equipment, inv = game.inventory;
  const copyLines = () => eqp.enchantLines(id, copy).map((l) => ({ ...l }));
  const res = { id, copy, from: copyLines(), to: null, picks: 0, rerolls: 0, same: 0, stones: 0, coins: 0, wards: 0, stop: null };
  const worth = lineWorth(game, id);
  quiet(game, () => {
    for (let guard = 0; guard < RUN_GUARD; guard++) {
      const lines = eqp.enchantLines(id, copy);
      const d = enchantStep(lines, game.enchantOffers(id, copy), aim, worth, res.rerolls < maxWards && inv.count(WARD) > 0);
      if (d.done) { res.stop = 'done'; return; }
      if (res.picks >= maxPicks) { res.stop = 'budget'; return; }
      if (d.stop) { res.stop = d.stop; return; }
      if (d.reroll) {
        if (!game.rerollEnchant(id, copy)) { res.stop = 'error'; return; }
        res.rerolls++; res.wards++;
        continue;
      }
      const c = game.enchantCostFor(id, copy);
      // (A guard: from the lines the confirm was made on, maxPicks reaches these first.)
      if (res.stones + c.stones > maxStones || res.coins + c.coins > maxCoins) { res.stop = 'budget'; return; }
      if (inv.count(STONE) < c.stones) { res.stop = 'stones'; return; }
      if (inv.count('coins') < c.coins) { res.stop = 'coins'; return; }
      const old = d.replace != null ? lines[d.replace] : null, offer = game.enchantOffers(id, copy)[d.pick];
      if (!game.pickEnchant(id, d.pick, d.replace, copy)) { res.stop = 'error'; return; }
      res.picks++; res.stones += c.stones; res.coins += c.coins;
      if (old && old.stat === offer.stat && old.value === offer.value) res.same++;
    }
    res.stop = 'guard';
  });
  res.to = copyLines();
  const name = pieceName(id, copy);
  const spent = `${plural(res.picks, 'try', 'tries')}, ${num(res.stones)} stones, ${num(res.coins)} coins${res.wards ? `, ${plural(res.wards, 'ward')}` : ''}`;
  const has = res.to.length ? res.to.map(enchantLabel) : [];
  const list = has.length > 1 ? `${has.slice(0, -1).join(', ')} and ${has[has.length - 1]}` : has[0] || 'no lines';
  tell(game, res.stop === 'done'
    ? `Keep enchanting: your ${name} now has ${list} (${spent}).`
    : `Keep enchanting: your ${name} has ${list} (${spent}); it stopped: ${stopText(res.stop)}.`, res.stop === 'done');
  return res;
}

// ---------------- Improve worn gear ----------------

/** Every piece you wear with stats (tools aside), the weapon first, then the
 *  strongest: [{ id, slot, copy }], with a twin pair's off-hand copy (its own
 *  ★ and lines) right after the main one. */
export function wornPieces(game) {
  const eqp = game.equipment, seen = new Set(), out = [];
  for (const slot of EQUIP_SLOTS) {
    const id = eqp.get(slot);
    if (!id || seen.has(id)) continue;
    const it = getItem(id);
    if (!it.equip?.bonuses || it.tool) continue;
    seen.add(id);
    out.push({ id, slot, copy: 'main' });
  }
  out.sort((a, b) => (b.slot === 'weapon') - (a.slot === 'weapon') || gearRating(b.id) - gearRating(a.id));
  const res = [];
  for (const p of out) {
    res.push(p);
    if (eqp.twinWorn(p.id)) res.push({ id: p.id, slot: 'shield', copy: 'off' });
  }
  return res;
}

/** Scrolls a ★ is likely to take: its cost over its chance (1 for ★1–★5, 2.5 for ★6 ... 4 for ★9). */
export const refinePrice = (next) => PRICE[next];

/** Improve's refining, one run of it on `levels` (changed in place): the
 *  cheapest next ★ across the pieces first (so a short supply still lifts
 *  every piece), ties in the pieces' order, one try at a time, under a
 *  shared scroll cap. Returns the scrolls used. */
function improveRefineSim(levels, target, cap, pack, rand) {
  let used = 0;
  for (let guard = 0; guard < 20 * RUN_GUARD; guard++) {
    let pick = -1, best = Infinity;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] >= target) continue;
      const next = levels[i] + 1, cost = COST[next];
      if (used + cost > cap || used + cost > pack) continue;
      if (PRICE[next] < best) { best = PRICE[next]; pick = i; }
    }
    if (pick < 0) break;
    const next = levels[pick] + 1;
    used += COST[next];
    if (rand() < ODDS[next].success) levels[pick] = next;   // (below ★10 a try either works or fails: rollRefine)
  }
  return used;
}

/** What "Improve worn gear" would do. `refineTo` (1–9), `maxScrolls` (null: room
 *  for nine runs in ten to take every piece there, within what you carry), and
 *  which steps are on. Returns { pieces: [{ id, copy, slot, q, refine: { from,
 *  to, likely }, fill: { lines, stones, coins }, feedXp }], refine: { need:
 *  { avg, p90 }, max, likely, reachAll }, fill: { lines, pieces, stones, coins },
 *  feed (feedAllPlan), materials: [[matId, n]], refineTo, steps, count }. */
export function improvePlan(game, { refineTo = SAFE_REFINE, maxScrolls = null, refine = true, fill = true, feed = true } = {}) {
  const eqp = game.equipment, inv = game.inventory;
  const to = Math.max(1, Math.min(SAFE_REFINE, Math.round(refineTo) || SAFE_REFINE));
  const worn = wornPieces(game);
  const carried = inv.count(SCROLL);
  const from = worn.map((p) => eqp.refineLevel(p.id, p.copy));
  // Refining: what it takes to bring every piece to the target (as many
  // scrolls as it takes), then what the cap is likely to do.
  const RUNS = 500;
  let rand = mulberry32(2026);
  const needs = [];
  for (let k = 0; k < RUNS; k++) needs.push(improveRefineSim(from.slice(), to, Infinity, Infinity, rand));
  const need = spread(needs);
  const max = Math.max(0, Math.min(carried, maxScrolls != null ? Math.floor(maxScrolls) : Math.ceil(need.p90 / 5) * 5));
  rand = mulberry32(2027);
  const sums = from.map(() => 0);
  let usedSum = 0, all = 0;
  for (let k = 0; k < RUNS; k++) {
    const lv = from.slice();
    usedSum += improveRefineSim(lv, to, max, carried, rand);
    lv.forEach((l, i) => { sums[i] += l; });
    if (lv.every((l, i) => l >= Math.max(to, from[i]))) all++;
  }
  // Filling empty lines: exact, in the pieces' order, while the pack can pay.
  let stones = inv.count(STONE), coins = inv.count('coins');
  const fills = worn.map((p) => {
    let n = eqp.enchantLines(p.id, p.copy).length, lines = 0, st = 0, co = 0;
    while (n < MAX_ENCHANTS) {
      const c = enchantCost(p.id, n);
      if (c.stones > stones || c.coins > coins) break;
      stones -= c.stones; coins -= c.coins; st += c.stones; co += c.coins; n++; lines++;
    }
    return { lines, stones: st, coins: co };
  });
  // Feeding: the very plan "Feed materials to worn gear" uses (feedall.js).
  const feedPlan = feedAllPlan(game);
  const used = new Map();
  for (const f of feedPlan) used.set(f.matId, (used.get(f.matId) || 0) + f.n);
  const pieces = worn.map((p, i) => ({
    id: p.id, copy: p.copy, slot: p.slot, q: eqp.qualityIn(p.slot),
    refine: { from: from[i], to: Math.max(from[i], to), likely: sums[i] / RUNS },
    fill: fills[i],
    feedXp: p.copy === 'main' ? feedPlan.filter((f) => f.gearId === p.id).reduce((t, f) => t + f.xp, 0) : 0,
  }));
  const changes = (p) => (refine && p.refine.likely > p.refine.from + 1e-9) || (fill && p.fill.lines > 0) || (feed && p.feedXp > 0);
  return {
    pieces,
    refine: { need: { avg: need.avg, p90: need.p90 }, max, likely: usedSum / RUNS, reachAll: all === RUNS },
    fill: { lines: fills.reduce((t, f) => t + f.lines, 0), pieces: fills.filter((f) => f.lines).length, stones: fills.reduce((t, f) => t + f.stones, 0), coins: fills.reduce((t, f) => t + f.coins, 0) },
    feed: feedPlan, materials: [...used],
    refineTo: to, steps: { refine, fill, feed },
    count: pieces.filter(changes).length,
  };
}

/** Do what an improvePlan says, after the confirm: feed, then refine (one
 *  try at a time, the cheapest next ★ first, within the plan's scroll cap;
 *  at ★9 or below no try can go badly, so no ward is ever used), then fill
 *  each piece's empty lines with the best of its three offers for your damage.
 *  Returns { pieces: [{ id, copy, from, to, added, xp, rankFrom, rankTo }],
 *  used: { scrolls, stones, coins, materials } }. */
export function runImprove(game, plan, { rand = Math.random } = {}) {
  const eqp = game.equipment, inv = game.inventory;
  const before = plan.pieces.map((p) => ({ id: p.id, copy: p.copy, from: eqp.refineLevel(p.id, p.copy), lines: eqp.enchantLines(p.id, p.copy).length, xp: eqp.masteryXp(p.id) }));
  const s0 = inv.count(SCROLL), st0 = inv.count(STONE), c0 = inv.count('coins');
  const mats0 = plan.materials.map(([m]) => [m, inv.count(m)]);
  quiet(game, () => {
    if (plan.steps.feed && plan.feed.length) feedAll(game, plan.feed);
    if (plan.steps.refine) {
      let used = 0;
      for (let guard = 0; guard < 20 * RUN_GUARD; guard++) {
        const packScrolls = inv.count(SCROLL), packWards = inv.count(WARD);
        let pick = null, best = Infinity;
        for (const p of plan.pieces) {
          const level = eqp.refineLevel(p.id, p.copy);
          if (refineStop({ level, used: 0, wardsUsed: 0, packScrolls, packWards }, { target: plan.refineTo, maxScrolls: plan.refine.max - used, maxWards: 0, allowDowngrade: false })) continue;
          const price = refinePrice(level + 1);
          if (price < best) { best = price; pick = p; }
        }
        if (!pick) break;
        if (game.refineItem(pick.id, rand(), pick.copy) == null) break;
        used += packScrolls - inv.count(SCROLL);
      }
    }
    if (plan.steps.fill) {
      for (const p of plan.pieces) {
        if (!p.fill.lines) continue;
        const worth = lineWorth(game, p.id);
        for (let k = 0; k < p.fill.lines; k++) {
          if (eqp.enchantLines(p.id, p.copy).length >= MAX_ENCHANTS) break;
          let b = -1, bv = -Infinity;
          game.enchantOffers(p.id, p.copy).forEach((o, i) => { const v = worth(o) + tie(o); if (v > bv) { b = i; bv = v; } });
          if (b < 0 || !game.pickEnchant(p.id, b, null, p.copy)) break;
        }
      }
    }
  });
  const pieces = [];
  before.forEach((b) => {
    const to = eqp.refineLevel(b.id, b.copy), lines = eqp.enchantLines(b.id, b.copy);
    const xp = b.copy === 'main' ? eqp.masteryXp(b.id) - b.xp : 0;
    const added = lines.slice(b.lines).map((l) => ({ ...l }));
    if (to !== b.from || added.length || xp > 0) pieces.push({ id: b.id, copy: b.copy, from: b.from, to, added, xp, rankFrom: rankFor(b.xp), rankTo: rankFor(b.xp + xp) });
  });
  const used = { scrolls: s0 - inv.count(SCROLL), stones: st0 - inv.count(STONE), coins: c0 - inv.count('coins'), materials: mats0.reduce((t, [m, n]) => t + n - inv.count(m), 0) };
  for (const p of pieces) game.msg(`Improve: your ${pieceName(p.id, p.copy)} ${improveBits(p, { short: true }).join(', ')}.`, 'level');
  const spent = [used.scrolls ? plural(used.scrolls, 'refine scroll') : '', used.stones ? `${num(used.stones)} stones` : '', used.coins ? `${num(used.coins)} coins` : '', used.materials ? plural(used.materials, 'material') : ''].filter(Boolean);
  tell(game, pieces.length ? `Improve: ${plural(pieces.length, 'piece')} improved${spent.length ? `, using ${listText(spent)}` : ''}.` : 'Improve: nothing could be improved this time.', pieces.length > 0);
  return { pieces, used };
}

/** "a, b and c" */
export const listText = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');

/** What a runImprove piece got, as short phrases: ["★3 → ★9", "+2 lines", "Master"]
 *  (or, not short, each new line named: "+14% crit damage"). */
export function improveBits(p, { short = false } = {}) {
  const out = [];
  if (p.to !== p.from) out.push(`${star(p.from)} → ${star(p.to)}`);
  if (p.added.length) out.push(...(short ? [`+${p.added.length} line${p.added.length > 1 ? 's' : ''}`] : p.added.map(enchantLabel)));
  if (p.xp > 0) out.push(p.rankTo > p.rankFrom ? MASTERY_RANKS[p.rankTo].name : `+${num(p.xp)} mastery XP`);
  return out;
}

/** How many worn pieces have a safe step you can pay for now: a ★ below ★9
 *  (and the scrolls for it), an empty enchant line (and the stones and coins),
 *  or mastery below Master and a material in the pack that feeds it. */
export function improveCount(game) {
  const eqp = game.equipment, inv = game.inventory;
  const scrolls = inv.count(SCROLL);
  let mats = null, n = 0;
  for (const p of wornPieces(game)) {
    const lv = eqp.refineLevel(p.id, p.copy);
    if (lv < SAFE_REFINE && scrolls >= refineCost(p.id, lv + 1).scrolls) { n++; continue; }
    if (eqp.enchantLines(p.id, p.copy).length < MAX_ENCHANTS && game.canAffordEnchant(p.id, p.copy)) { n++; continue; }
    if (p.copy !== 'main' || eqp.masteryXp(p.id) >= FEED_CAP) continue;
    if (!mats) { mats = new Set(); for (const s of inv.slots) if (s && materialKind(s.id)) mats.add(s.id); }
    for (const m of mats) if (feedXp(p.id, m) > 0) { n++; break; }
  }
  return n;
}
