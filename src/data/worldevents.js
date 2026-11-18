// Roaming world events and weekly region challenges: the data side (names,
// timings and reward tables). The rules live in src/game/worldevents.js.
//
// Every 20-30 minutes of play an event starts somewhere in the world, runs for
// a few minutes and then packs itself away again. Each kind has its own goal
// and its own reward table; rewards grow with your level (the fight level for
// the fighting kinds, the skill's level for the gathering kinds) and shrink if
// you only took a small part.

/** Ticks (0.6s) between events: 20-30 real minutes, and the first one a little
 *  sooner (8-12 minutes in) so a new session sees one. */
export const EVENT_GAP = [2000, 3000];
export const FIRST_GAP = [800, 1200];
/** When the time comes but no event can start (you're dead, in the Endless
 *  Gate, nowhere fits), try again this many ticks later. */
export const RETRY_TICKS = 100;
/** Share of events that pick this week's featured region, so its "finish an
 *  event there" task can always be done. */
export const FEATURED_BIAS = 0.35;

/** The kinds of event. `secs` is how long it runs, `skill` the skill that sets
 *  the reward level ('combat' = your fight level), `colour` its marker. */
export const EVENT_KINDS = {
  invasion: {
    name: 'Monster invasion', icon: '⚔', colour: '#ff5a5a', secs: 360, skill: 'combat',
    blurb: (e) => `Monsters are storming ${e.place}! Defeat ${e.need} of them to drive them off.`,
  },
  shoal: {
    name: 'Rare fish shoal', icon: '🐟', colour: '#5ad1ff', secs: 240, skill: 'fishing',
    blurb: (e) => `A rare shoal is running off ${e.place}: double Fishing XP and bonus fish while it lasts.`,
  },
  meteor: {
    name: 'Meteor strike', icon: '☄', colour: '#ffb347', secs: 240, skill: 'mining',
    blurb: (e) => `A meteor has crashed down in ${e.place}! Mine it before it cools: rich ore and bonus XP.`,
  },
  escort: {
    name: 'Lost merchant', icon: '👪', colour: '#ffd24a', secs: 420, skill: 'combat',
    blurb: (e) => `A lost merchant in ${e.place} needs an escort. Stay close and fight off the bandit beasts.`,
  },
  // Two of our own.
  rampage: {
    name: 'Rampaging champion', icon: '💢', colour: '#ff7ad9', secs: 300, skill: 'combat',
    blurb: (e) => `A champion ${e.foe} is rampaging through ${e.place}. Bring it down!`,
  },
  grove: {
    name: 'Ancient tree', icon: '🌳', colour: '#7ad97a', secs: 240, skill: 'woodcutting',
    blurb: (e) => `An ancient tree has sprung up in ${e.place}: its wood gives double Woodcutting XP.`,
  },
};
export const EVENT_IDS = Object.keys(EVENT_KINDS);

// Sizes and limits.
export const INVASION_ALIVE = 6;        // invaders out at once (phones)
export const ESCORT_AMBUSHES = 3;       // ambushes along the merchant's road
export const ESCORT_MERCHANT_HP = 60;
export const METEOR_CHARGES = 30;       // swings before a meteor crumbles away
export const GROVE_CHARGES = 40;        // logs before the ancient tree is spent
export const GATHER_GOAL = 15;          // gathers at a skilling event for the full reward
export const GATHER_MIN = 3;            // ...and the fewest that earn anything
export const BONUS_CATCH = 0.25;        // chance of a bonus fish/ore/log at an event node
export const SKILL_XP_MULT = 2;         // event nodes pay double XP

/** The gem that suits a level: sapphires early on, diamonds late. */
export const gemFor = (L) => (L < 30 ? 'sapphire' : L < 70 ? 'emerald' : L < 120 ? 'ruby' : 'diamond');

/** An event's reward for a player of level L who did `share` (0-1) of it:
 *  coins growing with the level, a gem, and for the fighting kinds enhancement
 *  stones (and a refine scroll from level 40). Returns [[itemId, qty], ...]. */
export function eventReward(kind, L, share = 1) {
  const s = Math.max(0, Math.min(1, share));
  if (s <= 0) return [];
  const lvl = Math.max(1, Math.round(L));
  const fight = EVENT_KINDS[kind]?.skill === 'combat';
  const out = [['coins', Math.round((80 + 9 * lvl) * (fight ? 1.2 : 1) * (0.4 + 0.6 * s))]];
  if (s >= 0.5) out.push([gemFor(lvl), 1]);
  if (fight) {
    out.push(['upgrade_stone', Math.max(1, Math.round((1 + Math.floor(lvl / 60)) * s))]);
    if (lvl >= 40 && s >= 0.75) out.push(['refine_scroll', 1]);
  }
  return out;
}

/** Bonus XP on finishing an event (in the event's skill, or your combat style). */
export const eventXp = (L, share = 1) => Math.round(Math.max(1, L) * 12 * Math.max(0, Math.min(1, share)));

// ---------------- Weekly region challenges ----------------
/** Three tasks in the week's featured region. */
export const WEEKLY_TASKS = [
  { id: 'kills', need: 200, text: (r) => `Defeat 200 creatures in ${r}` },
  { id: 'gathers', need: 50, text: (r) => `Gather 50 resources in ${r}` },
  { id: 'events', need: 1, text: (r) => `Finish a world event in ${r}` },
];
/** The crate for finishing all three: a reward casket by level, coins,
 *  enhancement stones and a refine scroll. */
export function weeklyCrate(L) {
  const lvl = Math.max(1, Math.round(L));
  const casket = lvl < 40 ? 'reward_casket_easy' : lvl < 100 ? 'reward_casket_medium' : 'reward_casket_hard';
  return [[casket, 1], ['coins', 500 + 30 * lvl], ['upgrade_stone', 3 + Math.floor(lvl / 50)], ['refine_scroll', 1]];
}

/** ISO-8601 week key for a local date, e.g. "2026-W47" (weeks start Monday). */
export function isoWeekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);   // the Thursday of this week decides the year
  const y0 = Date.UTC(t.getUTCFullYear(), 0, 1);
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
