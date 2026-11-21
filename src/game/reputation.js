// Region reputation: every region of the island keeps a meter of how well its
// people know you, from Stranger up to Legend. Quests, world events, bounties,
// Slayer work and clearing the region's monsters raise it (kills only a
// little); evil choices made there lower it, as far as Distrusted.
//
// Ranks bring rewards in that region: a shop discount (Friend and up), a title
// to wear (Hero and Legend), the region's badge in the journal, and the quest
// givers' extra lines (Known: they greet you as a regular; Friend: they share
// the local news). State is game.rep: { points: { region: n }, title, seeded }.
// It is saved as an optional field (save.js), so older saves simply start at
// Stranger everywhere and get credit for what they had already done.
import { REGION_LINES } from '../data/regionQuests.js';
import { MORAL_BY_ID } from '../data/moralEvents.js';

// The regions, in the journal's order (the region quest lines run outwards from Kampong Glam).
import { aOrAn } from '../core/utils.js';
export const REP_REGIONS = REGION_LINES.map((l) => l.region);
const REGION_SET = new Set(REP_REGIONS);

// `min` points to reach each rank. Distrusted is anything below zero.
export const REP_RANKS = [
  { id: 'distrusted', name: 'Distrusted', min: -Infinity, discount: -0.1, colour: '#9a5ad8' },
  { id: 'stranger', name: 'Stranger', min: 0, discount: 0, colour: '#8a8f98' },
  { id: 'known', name: 'Known', min: 100, discount: 0, colour: '#3a9e8f' },
  { id: 'friend', name: 'Friend', min: 300, discount: 0.05, colour: '#3a7bd5' },
  { id: 'hero', name: 'Hero', min: 700, discount: 0.1, colour: '#d08a00', title: 'Hero of' },
  { id: 'legend', name: 'Legend', min: 1500, discount: 0.15, colour: '#d6336c', title: 'Legend of' },
];
const RANK_INDEX = Object.fromEntries(REP_RANKS.map((r, i) => [r.id, i]));
export const REP_FLOOR = -300;
export const REP_CAP = 3000;

// What each deed is worth. Kills are a sliver so a long grind still moves the
// meter, but quests and events are what make you a local name.
export const REP_GAIN = {
  kill: 0.25, slayerKill: 0.5, champion: 8, boss: 15,
  regionQuest: 250, quest: 60, worldEvent: 90, bounty: 30,
  goodChoice: 50, evilChoice: -120,
};

export const freshRep = () => ({ points: {}, title: null, seeded: false });

/** The rank for a points total. */
export function rankFor(points) {
  let r = REP_RANKS[0];
  for (const k of REP_RANKS) if (points >= k.min) r = k;
  return r;
}
export const repPoints = (game, region) => game.rep?.points?.[region] || 0;
export const repRank = (game, region) => rankFor(repPoints(game, region));
/** True if your rank in the region is at least `id` (e.g. 'friend'). */
export const repAtLeast = (game, region, id) => RANK_INDEX[repRank(game, region).id] >= RANK_INDEX[id];

/** The next rank up and how far along you are (0..1), or null at Legend. */
export function repProgress(points) {
  const r = rankFor(points), i = REP_RANKS.indexOf(r), next = REP_RANKS[i + 1];
  if (!next) return null;
  const lo = Number.isFinite(r.min) ? r.min : REP_FLOOR;
  return { next, frac: Math.max(0, Math.min(1, (points - lo) / (next.min - lo))), need: Math.ceil(next.min - points) };
}

/** Add (or take away) reputation in a region; says so when the rank changes.
 *  `quiet` skips the messages (credit for an old save's past deeds). */
export function addRep(game, region, amount, why = '', quiet = false) {
  if (!REGION_SET.has(region) || !amount) return 0;
  const rep = (game.rep ||= freshRep());
  const before = rep.points[region] || 0;
  const after = Math.max(REP_FLOOR, Math.min(REP_CAP, before + amount));
  rep.points[region] = Math.round(after * 100) / 100;
  const r0 = rankFor(before), r1 = rankFor(after);
  if (r0 !== r1 && !quiet) {
    const up = RANK_INDEX[r1.id] > RANK_INDEX[r0.id];
    if (up) {
      game.msg?.(`${region} reputation: you are now ${aOrAn(r1.name)} here${why ? ` (${why})` : ''}. ${rankPerkText(r1)}`, 'level');
      game.banner?.(`<span class="big">${r1.name} of ${region}</span>${rankPerkText(r1)}`);
      game.bus?.emit('sfx', 'achievement');
    } else game.msg?.(`${region} reputation falls to ${r1.name}${why ? ` (${why})` : ''}.`, 'system');
    game.saveSoon = true;
  }
  game.bus?.emit('rep');   // the journal redraws a few times a second at most
  return after - before;
}

/** What a rank gives, in a sentence. */
export function rankPerkText(r) {
  switch (r.id) {
    case 'distrusted': return 'Shops here charge you 10% more.';
    case 'stranger': return 'Nobody here knows you yet.';
    case 'known': return 'Quest givers here greet you as a regular.';
    case 'friend': return 'Shops here give you 5% off, and locals share the news.';
    case 'hero': return 'Shops here give you 10% off, and you can wear the title "Hero".';
    case 'legend': return 'Shops here give you 15% off, the region’s badge is yours, and you can wear the title "Legend".';
  }
  return '';
}

/** Price multiplier from your standing where you are shopping (1 = none). */
export function repPriceMult(game, region) {
  if (!REGION_SET.has(region)) return 1;
  return 1 - repRank(game, region).discount;
}

/** The region a monster belongs to: where it spawned. */
export function regionOfNpc(game, npc) {
  const z = game.world?.zoneAt?.(npc.spawnX ?? npc.x, npc.spawnY ?? npc.y);
  return z && !z.instance ? z.name : null;
}

// ---------------- Titles ----------------
/** Titles you have earned: one per region where you are a Hero or Legend. */
export function repTitles(game) {
  const out = [];
  for (const region of REP_REGIONS) {
    const r = repRank(game, region);
    if (r.title) out.push({ region, title: `${r.title} ${region}` });
  }
  return out;
}
/** Wear a region title (by region name), or none (null). */
export function setRepTitle(game, region) {
  const rep = (game.rep ||= freshRep());
  if (!region) { rep.title = null; game.bus?.emit('rep'); game.bus?.emit('karma'); return true; }
  if (!repRank(game, region).title) return false;
  rep.title = region;
  game.msg?.(`You are now known as the ${repTitleText(game)}.`, 'system');
  game.bus?.emit('rep'); game.bus?.emit('karma');
  return true;
}
/** The region title you wear, as text (or null). */
export function repTitleText(game) {
  const region = game.rep?.title;
  if (!region) return null;
  const r = repRank(game, region);
  return r.title ? `${r.title} ${region}` : null;
}

// ---------------- Deeds ----------------
/** A monster died to you: a sliver of reputation where it lives (more for a
 *  champion, a boss, or a Slayer task). */
export function repOnKill(game, npc, onTask) {
  const region = regionOfNpc(game, npc);
  if (!region) return;
  const d = npc.def || {};
  const amount = d.boss ? REP_GAIN.boss : npc.champion ? REP_GAIN.champion : onTask ? REP_GAIN.slayerKill : REP_GAIN.kill;
  addRep(game, region, amount, d.boss ? `you beat ${d.name}` : npc.champion ? `you beat the ${d.name}` : '');
}

/** A moral choice was made: good raises the region's opinion, evil lowers it. */
export function repOnMoral(game, id, side, quiet = false) {
  const ev = MORAL_BY_ID[id];
  if (!ev) return;
  addRep(game, ev.zone, side === 'good' ? REP_GAIN.goodChoice : REP_GAIN.evilChoice, side === 'good' ? 'a good deed' : 'an evil deed', quiet);
}

/** Credit an old save once for what it had already done (quietly). */
export function seedRep(game) {
  const rep = (game.rep ||= freshRep());
  if (rep.seeded) return;
  rep.seeded = true;
  for (const l of REGION_LINES) if (game.quests?.[l.id]?.state === 'done') addRep(game, l.region, REP_GAIN.regionQuest, '', true);
  for (const [id, side] of Object.entries(game.moral?.choices || {})) repOnMoral(game, id, side, true);
}

// ---------------- Save ----------------
export function serializeRep(game) {
  const r = game.rep || freshRep();
  return { points: { ...r.points }, title: r.title || null, seeded: !!r.seeded };
}
export function loadRep(d) {
  const rep = freshRep();
  if (!d || typeof d !== 'object') return rep;
  if (d.points && typeof d.points === 'object') {
    for (const [k, v] of Object.entries(d.points)) if (REGION_SET.has(k) && typeof v === 'number' && Number.isFinite(v)) rep.points[k] = Math.max(REP_FLOOR, Math.min(REP_CAP, v));
  }
  if (typeof d.title === 'string' && REGION_SET.has(d.title)) rep.title = d.title;
  rep.seeded = d.seeded === true;
  return rep;
}
