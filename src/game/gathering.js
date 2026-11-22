// Gathering extras: three small things that make an hour at the trees, rocks,
// fishing spots and traps feel like it is going somewhere.
//
//  - Streaks: every successful gather in the same skill adds to a streak, and
//    each STREAK_STEP in a row adds STREAK_XP_STEP to that skill's XP (up to
//    STREAK_TIERS steps, +10%) and makes lucky finds a little likelier. Change
//    skill, or go STREAK_GAP_TICKS without a catch, and it starts again.
//  - Lucky finds: any gather can turn up a little cache (1 in LUCKY_RATE, better
//    on a streak): coins, the skill's own rare find (a bird's nest, a gem, a
//    pearl, a bundle of feathers) and a burst of XP, with a sparkle and a banner.
//  - Skilling contracts: three a day from Cikgu Surya in Kampong Glam, each
//    "gather N times at one kind of node" picked from the best nodes you can
//    use in three of the four gathering skills. Each pays coins and XP the
//    moment it's done, and clearing all three builds a daily streak that pays
//    more, like the combat bounties (bounty.js).
//
// Kept out of game.js: the game calls `onGather` once per gathering tick (with
// the bag counted before the action) and the bus 'tick' ends stale streaks.
// Rolls use their own generator, so they never shift Math.random (the seeded
// test suite depends on its sequence). Contracts are saved; streaks are not.

import { OBJECTS } from '../data/objects.js';
import { getItem } from '../data/items.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { GEM_TABLE } from './skilling.js';
import { mulberry32 } from './pets.js';
import { seeded, prevDayKey } from './bounty.js';
import { ZoneWatch } from './resourcezones.js';

// A switch for the test suite (tests/seed.mjs turns it off, so tests that pin
// exact XP or bag contents aren't moved by a streak or a lucky find).
export const GATHER_FUN = { on: true };

export const STREAK_STEP = 25;          // gathers in a row for each step
export const STREAK_TIERS = 5;          // at most five steps...
export const STREAK_XP_STEP = 0.02;     // ...of +2% XP each (+10% in all)
export const STREAK_GAP_TICKS = 50;     // 30s without a catch ends it (time to walk to the next tree)
export const LUCKY_RATE = 300;          // 1 in this many gathers is a lucky find...
export const LUCKY_STREAK_BONUS = 0.2;  // ...+20% likelier per streak step
export const CONTRACT_COUNT = 3;
export const CONTRACT_STREAK_STEP = 0.1;   // each full day in a row: +10% contract pay, up to +100%

// Which skill each gathering action trains.
export const GATHER_SKILL = { woodcut: 'woodcutting', mine: 'mining', fish: 'fishing', hunt: 'hunter' };
export const CONTRACT_SKILLS = ['woodcutting', 'mining', 'fishing', 'hunter'];
const VERB = { woodcutting: 'Chop', mining: 'Mine', fishing: 'Fish', hunter: 'Check' };
const skillName = (id) => SKILL_BY_ID[id]?.name || id;

/** A node's entry level (a fishing spot's lowest catch). */
export function nodeLevel(def) {
  if (def.catches) return Math.min(...def.catches.map((c) => c.level || 1));
  return def.level || 1;
}
/** Roughly what one gather at a node is worth in XP at `lvl` (fishing: the
 *  average of the catches you can land). */
export function nodeXp(def, lvl = 1) {
  if (def.catches) {
    const ok = def.catches.filter((c) => (c.level || 1) <= lvl);
    const list = ok.length ? ok : def.catches;
    return list.reduce((s, c) => s + (c.xp || 0), 0) / list.length;
  }
  return def.xp || 0;
}

/** XP multiplier for `skill` on a streak of `count`. */
export const streakTier = (count) => Math.min(STREAK_TIERS, Math.floor(Math.max(0, count) / STREAK_STEP));
export const streakXpMult = (count) => 1 + streakTier(count) * STREAK_XP_STEP;
export const luckyChance = (count) => (1 / LUCKY_RATE) * (1 + streakTier(count) * LUCKY_STREAK_BONUS);
export const contractStreakMult = (streak) => 1 + Math.min(10, Math.max(0, streak)) * CONTRACT_STREAK_STEP;

/** Today's three contracts for a player with `levels` ({ skill: level }) in a
 *  world holding the node kinds `present` (a Set of object ids). The same day
 *  and levels always give the same board. */
export function makeContracts(day, levels, present) {
  const lv = (s) => levels[s] || 1;
  const rnd = seeded(`${day}:skills:${CONTRACT_SKILLS.map((s) => Math.floor(lv(s) / 10)).join('.')}`);
  const skills = CONTRACT_SKILLS.slice();
  // Shuffle, then take three skills.
  for (let i = skills.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [skills[i], skills[j]] = [skills[j], skills[i]]; }
  const out = [];
  for (const skill of skills) {
    if (out.length >= CONTRACT_COUNT) break;
    const nodes = Object.entries(OBJECTS)
      .filter(([id, d]) => d.skill === skill && ['tree', 'rock', 'fishing', 'hunt'].includes(d.type) && present.has(id) && nodeLevel(d) <= lv(skill))
      .sort((a, b) => nodeLevel(b[1]) - nodeLevel(a[1]));
    if (!nodes.length) continue;
    const [objId, def] = nodes[Math.floor(rnd() * Math.min(3, nodes.length))];
    const need = 25 + Math.floor(rnd() * 26);
    const level = nodeLevel(def);
    out.push({
      skill, objId, name: def.name, need, have: 0, done: false,
      coins: Math.round(150 + level * need * 2.5),
      xp: Math.round(need * nodeXp(def, lv(skill)) * 0.6),
    });
  }
  return out;
}

export class Gathering {
  constructor(game) {
    this.game = game;
    this.streak = null;   // { skill, count, tick } (not saved)
    this.contracts = { day: null, list: [], streak: 0, lastFull: null };   // saved
    this.rand = mulberry32((Date.now() ^ 0x5bd1e995) >>> 0);
    this.zones = new ZoneWatch(game);   // resource zones' arrival notices (resourcezones.js)
    game.bus.on('tick', () => this.tick());
  }

  // ---------------- Streaks ----------------
  /** The XP multiplier gathering lends `skill` right now (through Skills.timeMult). */
  xpMult(skill) {
    const s = this.streak;
    return GATHER_FUN.on && s && s.skill === skill ? streakXpMult(s.count) : 1;
  }

  tick() {
    const s = this.streak;
    if (s && (this.game.tickCount || 0) - s.tick > STREAK_GAP_TICKS) this.endStreak();
  }

  endStreak() {
    const s = this.streak;
    this.streak = null;
    if (s && s.count >= STREAK_STEP) this.game.msg(`Your ${skillName(s.skill)} streak of ${s.count} ends.`, 'system');
    this.game.bus.emit('gatherstreak');
  }

  // ---------------- The gathering hook ----------------
  /** One gathering tick at `obj` just ran (`before` = the bag counted first).
   *  Returns whether anything was gathered. */
  onGather(action, obj, before) {
    const skill = GATHER_SKILL[action?.type];
    if (!skill || !obj?.def || !before) return false;
    const g = this.game;
    let got = false;
    // The bag counted in one pass: a late game's holds hundreds of slots, and
    // counting each slot's item afresh walked the whole bag once per slot.
    const now = new Map();
    for (const sl of g.inventory.slots) if (sl) now.set(sl.id, (now.get(sl.id) || 0) + sl.qty);
    for (const sl of g.inventory.slots) if (sl && sl.id !== 'coins') {
      if (sl.qty > 0 && now.get(sl.id) > (before.get(sl.id) || 0)) { got = true; break; }
    }
    if (!got || !GATHER_FUN.on) return got;
    const t = g.tickCount || 0;
    // The streak.
    if (!this.streak || this.streak.skill !== skill) {
      if (this.streak) this.endStreak();
      this.streak = { skill, count: 0, tick: t };
    }
    const s = this.streak;
    const tier0 = streakTier(s.count);
    s.count++; s.tick = t;
    const tier = streakTier(s.count);
    if (tier > tier0) {
      g.msg(`${skillName(skill)} streak ${s.count}! +${Math.round(tier * STREAK_XP_STEP * 100)}% ${skillName(skill)} XP while you keep it going${tier >= STREAK_TIERS ? ' (the most it gives)' : ''}.`, 'level');
      g.addHitsplat?.(g.player, 0, { text: `Streak ${s.count}!` });
      g.spawnSparkle?.(g.player, '#9be37a', 10);
      g.bus.emit('gatherstreak');
    }
    // A lucky find.
    if (this.rand() < luckyChance(s.count)) this.luckyFind(skill, obj);
    // Today's contracts.
    this.progressContracts(skill, obj);
    return true;
  }

  _count(id) { let n = 0; for (const sl of this.game.inventory.slots) if (sl && sl.id === id) n += sl.qty; return n; }

  /** A little cache: coins, the skill's rare find and a burst of XP. */
  luckyFind(skill, obj) {
    const g = this.game, def = obj.def, lvl = nodeLevel(def);
    const coins = Math.round((25 + lvl * 5) * (1 + this.rand()));
    let item = null, qty = 1;
    if (skill === 'woodcutting') item = 'birds_nest';
    else if (skill === 'mining') {
      let r = this.rand() * GEM_TABLE.reduce((s, e) => s + e.weight, 0);
      item = GEM_TABLE.find((e) => (r -= e.weight) < 0)?.id || GEM_TABLE[0].id;
    } else if (skill === 'fishing') item = 'pearl';
    else if (skill === 'hunter') { item = 'feather'; qty = 10 + Math.floor(this.rand() * 21); }
    const xp = Math.round(nodeXp(def, g.skills.level(skill)) * 5);
    g.inventory.add('coins', coins);
    if (item) g.inventory.add(item, qty);
    if (xp > 0) g.skills.addXp(skill, xp);
    const what = `${coins} coins${item ? `, ${qty > 1 ? qty + ' x ' : ''}${getItem(item).name}` : ''} and ${xp} bonus ${skillName(skill)} XP`;
    g.msg(`Lucky find! Tucked away by the ${def.name.toLowerCase()} you find ${what}.`, 'level');
    g.banner?.(`<span class="big">Lucky find!</span>${what}`);
    g.spawnSparkle?.(g.player, '#ffd24a', 18);
    g.bus.emit('sfx', 'dropepic');
    this.finds = (this.finds || 0) + 1;
    return { coins, item, qty, xp };
  }

  // ---------------- Daily contracts ----------------
  /** Make today's board if the day has turned. */
  ensureContracts() {
    const g = this.game, c = this.contracts, day = g.todayKey();
    if (c.day === day && c.list.length) return c.list;
    const levels = {};
    for (const s of CONTRACT_SKILLS) levels[s] = g.skills.level(s);
    const present = new Set(g.world.objects.map((o) => o.objId));
    c.day = day;
    c.list = makeContracts(day, levels, present);
    g.bus.emit('skillcontracts');
    return c.list;
  }

  progressContracts(skill, obj) {
    const c = this.contracts;
    this.ensureContracts();   // a new day: a fresh board, already counting
    for (const k of c.list) {
      if (k.done || k.skill !== skill || k.objId !== obj.objId) continue;
      k.have = Math.min(k.need, k.have + 1);
      if (k.have >= k.need) this.completeContract(k);
      else if (k.have % 10 === 0) this.game.msg(`Contract: ${k.have}/${k.need} at ${k.name.toLowerCase()}s.`, 'system');
      this.game.bus.emit('skillcontracts');
    }
  }

  completeContract(k) {
    const g = this.game, c = this.contracts;
    k.done = true;
    const mult = contractStreakMult(c.streak);
    const coins = Math.round(k.coins * mult);
    g.inventory.add('coins', coins);
    g.skills.addXp(k.skill, k.xp);
    g.msg(`Skilling contract done: ${k.need} at ${k.name.toLowerCase()}s! +${coins} coins and ${k.xp} ${skillName(k.skill)} XP.`, 'level');
    g.banner?.(`<span class="big">Contract complete!</span>+${coins} coins · +${k.xp} ${skillName(k.skill)} XP`);
    g.spawnSparkle?.(g.player, '#ffd24a', 14);
    if (c.list.length && c.list.every((x) => x.done)) {
      // A full board: a bonus, and a streak if yesterday's was full too.
      c.streak = c.lastFull === prevDayKey(c.day) ? c.streak + 1 : 1;
      c.lastFull = c.day;
      const bonus = 300 + 100 * Math.min(10, c.streak);
      g.inventory.add('coins', bonus);
      g.msg(`All of today's skilling contracts are done: +${bonus} coins bonus. Contract streak: ${c.streak} day${c.streak === 1 ? '' : 's'} (+${Math.round((contractStreakMult(c.streak) - 1) * 100)}% pay tomorrow).`, 'level');
    }
    g.saveSoon = true;
  }

  /** A line for a contract: "Chop 40 at Oak trees". */
  static contractText(k) { return `${VERB[k.skill] || 'Gather'} ${k.need} at ${k.name.toLowerCase()}s`; }

  serialize() { return { contracts: this.contracts }; }
  /** Restore from a save (older saves: no contracts yet). Anything odd is dropped. */
  load(d) {
    this.contracts = { day: null, list: [], streak: 0, lastFull: null };
    const c = d?.contracts;
    if (!c || typeof c !== 'object') return;
    if (typeof c.day === 'string') this.contracts.day = c.day;
    if (typeof c.streak === 'number' && c.streak > 0) this.contracts.streak = Math.floor(c.streak);
    if (typeof c.lastFull === 'string') this.contracts.lastFull = c.lastFull;
    if (Array.isArray(c.list)) {
      this.contracts.list = c.list.filter((k) => k && OBJECTS[k.objId] && CONTRACT_SKILLS.includes(k.skill) && k.need > 0)
        .map((k) => ({ skill: k.skill, objId: k.objId, name: OBJECTS[k.objId].name, need: Math.floor(k.need),
          have: Math.max(0, Math.min(Math.floor(Number(k.have) || 0), Math.floor(k.need))), done: !!k.done,
          coins: Math.max(0, Math.floor(Number(k.coins) || 0)), xp: Math.max(0, Math.floor(Number(k.xp) || 0)) }));
    }
  }
}
