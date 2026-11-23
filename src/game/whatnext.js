// "What next?": two or three concrete goals picked from where you are now, each
// with a Go that starts on it. New players often stand in Kampong Glam not
// knowing what to do; older ones forget which quest step was next. The card
// sits at the top of the Quest Journal, and its first goal is a tappable row in
// the Objectives tracker (src/ui/whatnextui.js draws both).
//
// Goals, in order (at most three):
//  - gear: a piece in your pack beats what you wear -> Equip best;
//  - quest: the next step of the quest you're on (else the next one to start)
//    -> the journal's own Go (game.questTravel);
//  - skill: a life skill in its golden hours (or one a level or two from new
//    ground) -> walk to the best spot you can work and start;
//  - fight: monsters your level, outside the Wilderness -> walk there and
//    switch auto battle on.
// No DOM and no Math.random, so the tests can drive it.
import { betterRoundsInPack } from './rounds.js';
import { getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { QUESTS } from '../data/quests.js';
import { canWear } from '../data/classes.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { compareGear, isUpgrade, meetsReq } from './gear.js';
import { gatherSources } from './skillguide.js';
import { zoneLevel } from '../data/world.js';
import { OBJECTS } from '../data/objects.js';
import { findPath } from '../engine/pathfinding.js';

export const MAX_GOALS = 3;
// A gathering skill this close to its next new source gets a nudge.
export const NEAR_UNLOCK = 2;
// Gathering skills the card can walk you to (each has placed objects).
const GO_SKILLS = ['woodcutting', 'mining', 'fishing', 'hunter', 'thieving', 'agility'];
// The skill card's verb for each.
const VERB = { woodcutting: 'Chop', mining: 'Mine', hunter: 'Trap', thieving: 'Steal from', agility: 'Run' };
/** What to do there, e.g. "Chop Oak tree", "Catch Raw anchovy at an anchovy shoal". */
const doText = (src) => (src.spot ? `Catch ${src.name} at ${/^[aeiou]/i.test(src.spot) ? 'an' : 'a'} ${src.spot.toLowerCase()}` : `${VERB[src.skill] || 'Work'} ${src.name}`);

const skillName = (s) => SKILL_BY_ID[s]?.name || s;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Whether the piece in pack slot `s` beats what you wear (and you can wear it now). */
function beatsWorn(game, s) {
  if (!s || !getItem(s.id).equip || getItem(s.id).tool) return false;
  if (game.jobClass && !canWear(game.jobClass, s.id)) return false;
  if (!meetsReq(s.id, game.skills).ok) return false;
  if (game._canEquipNow && !game._canEquipNow(s.id)) return false;
  return isUpgrade(compareGear(s.id, game.equipment, null, s.q || null, game.combatMode?.()));
}

/** The pieces in the pack that beat what you wear (and that you can wear now). */
export function packUpgrades(game) {
  const out = [];
  for (const s of game.inventory.slots) if (beatsWorn(game, s)) out.push(s);
  // Rounds that beat the loaded ones, while a gun is in hand (Equip best loads them).
  const r = betterRoundsInPack(game);
  if (r) out.push(r);
  return out;
}
/** The first of them, or null. It stops at the first rather than weighing
 *  every piece in a late-game pack of hundreds (the tracker asks every few ticks). */
export function packUpgrade(game) {
  for (const s of game.inventory.slots) if (beatsWorn(game, s)) return s;
  return betterRoundsInPack(game) || null;
}
/** The first of packUpgrades(game) that `want` takes, or null; the pieces
 *  `want` turns down (say, ones already mentioned) are never weighed at all. */
export function firstPackUpgrade(game, want) {
  for (const s of game.inventory.slots) if (s && want(s) && beatsWorn(game, s)) return s;
  const r = betterRoundsInPack(game);
  return r && want(r) ? r : null;
}

/** The quest to work on next: the first active one with a step to go to,
 *  else the first one you can start. { id, name, text } or null. */
export function nextQuest(game) {
  let start = null;
  for (const d of QUESTS) {
    const st = game.quests[d.id]?.state;
    if (st === 'done') continue;
    const g = game.questGuide(d.id);
    if (g.kind === 'none') continue;
    if (st === 'active') return { id: d.id, name: d.name, text: g.text };
    // The karma quests are a moral choice: never suggested, only taken up by hand.
    if (!start && d.id !== 'redemption' && d.id !== 'corruption') start = { id: d.id, name: d.name, text: g.text };
  }
  return start;
}

/** The best source of `skill` you can work now (your level, and a tool you
 *  carry or wear), with the nearest placed object of it: { src, obj } or null. */
export function bestSource(game, skill) {
  const lvl = game.skills.level(skill);
  const p = game.playerTile();
  const ok = gatherSources().filter((s) => s.skill === skill && s.objIds?.length && s.level <= lvl && (!s.tool || game.hasTool(s.tool)));
  for (const src of ok.slice().sort((a, b) => b.level - a.level)) {
    const ids = new Set(src.objIds);
    let obj = null;
    for (const o of game.world.objects) if (ids.has(o.objId) && !o.depleted && (!obj || dist(o, p) < dist(obj, p))) obj = o;
    if (obj) return { src, obj };
  }
  return null;
}

// Auto gather's "the best you can" mode (the Life skills shortcuts, the owner's
// ask): it keeps to the highest-level source of a skill your level and tools
// allow, never a lesser rock or tree that happens to be nearer. It keeps you out
// of danger, there and on the way: no trip into or through the Wilderness or a
// region whose monsters are more than 10 levels above your fighting level (as
// world events pick their regions), bar the region you are in already. Routes
// are checked tile by tile with those regions as walls (safeRouteCfg), and then
// walked that way: marking whole regions "reachable" would miss a route that
// clips a dangerous corner, or spots cut off inside a region (Changi's pomfret).
// The tap itself may go anywhere safe (riding the MRT where that helps, or is
// the only safe way); what the mode then does by itself stays close and on foot.
const AUTO_NEAR = 30;      // auto gather's own trips: no further than it ever walked by itself (or across your region)
const WALK_NODES = 6000;   // ...each checked with the search a walk makes (Game.beginAction)
const AUTO_TRIES = 3;      // ...for the nearest few ready nodes at most
const workable = (game, skill, lvl = game.skills.level(skill)) =>
  gatherSources().filter((s) => s.skill === skill && s.objIds?.length && s.level <= lvl && (!s.tool || game.hasTool(s.tool)))
    .sort((a, b) => b.level - a.level);
/** Whether a region is safe for you to gather in or walk through (above). */
function safeZones(game) {
  const p = game.playerTile(), here = game.world.zoneAt?.(p.x, p.y), fight = game.fightLevel?.() || 1;
  const seen = new Map();
  return (z) => {
    if (!z || z === here) return true;
    let ok = seen.get(z);
    if (ok === undefined) seen.set(z, (ok = !z.wilderness && !z.instance && zoneLevel(z) <= fight + 10));
    return ok;
  };
}
/** Path-search settings for a trip that keeps out of danger: regions that aren't
 *  safe for you are walls (Game.pathCfg takes these while such a trip starts). */
export function safeRouteCfg(game) {
  const W = game.world, ok = safeZones(game);
  return { width: W.width, height: W.height, isBlocked: (x, y) => W.isBlocked(x, y) || !ok(W.zoneAt(x, y)) };
}
/** walk(t, node): whether you can walk from tile t to stand beside node within
 *  cfg's walls. Each stretch of land is flooded once, when first asked about,
 *  and labelled, so every node after that is a look-up: a path search per node
 *  can't say "no way" until it has looked everywhere, and the tap asks of many. */
function safeLand(cfg) {
  const { width: w, height: h, isBlocked } = cfg;
  let label = null, q = null, n = 0;
  const flood = (i0) => {
    let head = 0, tail = 0;
    label[i0] = ++n; q[tail++] = i0;
    while (head < tail) {
      const i = q[head++], x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * w + nx;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h || label[j] || isBlocked(nx, ny)) continue;
        if (dx && dy && (isBlocked(x + dx, y) || isBlocked(x, y + dy))) continue;   // no cutting corners, as findPath
        label[j] = n; q[tail++] = j;
      }
    }
  };
  return (t, node) => {
    if (!t) return false;
    if (dist(t, node) <= 1) return true;
    label ||= new Int32Array(w * h); q ||= new Int32Array(w * h);
    const i = t.y * w + t.x;
    if (!label[i]) { if (isBlocked(t.x, t.y)) return false; flood(i); }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = node.x + dx, y = node.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h && label[y * w + x] === label[i]) return true;
    }
    return false;
  };
}
// World-event nodes (a meteorite, a rare shoal, an ancient tree) and any node
// with a def of its own come and go: the mode never picks one (nor moves you off one).
export const specialNode = (o) => !!o.worldEvent || o.def !== OBJECTS[o.objId];
/** The highest-level source of `skill` you can work (at level `lvl`) that has a
 *  node somewhere safe for you, ready or not: what the mode is after. */
export function topGatherSource(game, skill, lvl) {
  const W = game.world, ok = safeZones(game);
  for (const src of workable(game, skill, lvl)) {
    const ids = new Set(src.objIds);
    if (W.objects.some((o) => ids.has(o.objId) && !specialNode(o) && ok(W.zoneAt?.(o.x, o.y)))) return src;
  }
  return null;
}
/** The region of the nearest node of `src` that is safe for you, for a chat line ('' for none). */
export function sourceRegion(game, src) {
  const p = game.playerTile(), W = game.world, ok = safeZones(game), ids = new Set(src.objIds);
  let best = null;
  for (const o of W.objects) if (ids.has(o.objId) && !specialNode(o) && ok(W.zoneAt?.(o.x, o.y)) && (!best || dist(o, p) < dist(best, p))) best = o;
  return (best && W.zoneAt?.(best.x, best.y)?.name) || '';
}
// The search behind both: sources best first; for each, its safe nodes within
// `near` tiles or in your region, nearest first, until `reach` finds a way to
// one (`tries` of them at most). With `wait`, a source whose nodes within `near`
// are spent for now (they grow back in seconds) is waited for, rather than
// walked across the region for or dropped for a lesser one.
function bestGather(game, skill, { exclude = null, near = Infinity, wait = false, tries = Infinity, reach }) {
  const p = game.playerTile(), W = game.world, ok = safeZones(game), here = W.zoneAt?.(p.x, p.y);
  for (const src of workable(game, skill)) {
    const ids = new Set(src.objIds), ready = [];
    let spent = false;
    for (const o of W.objects) {
      if (!ids.has(o.objId) || specialNode(o)) continue;
      const z = W.zoneAt?.(o.x, o.y), d = dist(o, p);
      if (!ok(z) || (d > near && z !== here)) continue;
      if (o === exclude || o.depleted) { if (d <= near) spent = true; } else ready.push({ o, d });
    }
    ready.sort((a, b) => a.d - b.d);
    for (const { o, d } of ready) {
      if (wait && spent && d > near) break;
      if (tries-- <= 0) return null;
      const trip = reach(o);
      if (trip) return { obj: o, src, trip };
    }
    if (wait && spent) return { obj: null, src };
  }
  return null;
}
/** Where "the best you can" auto gather goes next by itself: the nearest ready
 *  node of the best source with nodes close by (within AUTO_NEAR tiles, or in your
 *  region) that a short walk reaches without crossing danger; null while that
 *  source's nodes close by are spent (wait for them to grow back), or when nothing
 *  is close. Never a long trip, never the MRT. */
export function bestGatherNode(game, skill, { exclude = null } = {}) {
  const cfg = safeRouteCfg(game), p = game.playerTile();
  const reach = (o) => dist(o, p) <= 1 || findPath(cfg, p, o, { reachAdjacent: true, maxNodes: WALK_NODES }).length > 0;
  return bestGather(game, skill, { exclude, near: AUTO_NEAR, wait: true, tries: AUTO_TRIES, reach })?.obj || null;
}
/** How the Life skills shortcut gets to `node` keeping out of danger, or null:
 *  { cfg, st } rides the MRT to station st first (null: walks all the way). The
 *  ride a Go would take comes first, then walking, then any ride that lands
 *  nearer (a region only the MRT reaches safely). */
function safeTrip(game, node, cfg, walk) {
  const hop = game._mrtHopStation?.(node);
  if (hop && walk(game._nearestFree(hop.x, hop.y), node)) return { cfg, st: hop };
  if (walk(game.playerTile(), node)) return { cfg, st: null };
  const any = !hop && game._mrtHopStation?.(node, true);
  return any && walk(game._nearestFree(any.x, any.y), node) ? { cfg, st: any } : null;
}
// The Life skills grid asks for every gathering skill at once: one flood serves
// them all while nothing has changed (the same tick, tile, fighting level and objects).
let land = null;
function safeLandNow(game) {
  const p = game.playerTile(), key = `${game.tickCount}:${p.x},${p.y}:${game.fightLevel?.()}:${game.world._objRev}`;
  if (land?.game !== game || land.key !== key) { const cfg = safeRouteCfg(game); land = { game, key, cfg, walk: safeLand(cfg) }; }
  return land;
}
/** The first pick for a Life skills shortcut: the nearest ready node of the
 *  best source you can get to safely, anywhere, with that source and the trip
 *  there: { obj, src, trip } or null. A spent node beside you doesn't stop it. */
export function bestGatherPick(game, skill) {
  const { cfg, walk } = safeLandNow(game);
  return bestGather(game, skill, { reach: (o) => safeTrip(game, o, cfg, walk) });
}

/** The next new source a skill opens, if it is within NEAR_UNLOCK levels: { src, gap } or null. */
export function nearUnlock(game, skill) {
  const lvl = game.skills.level(skill);
  const next = gatherSources().find((s) => s.skill === skill && s.objIds?.length && s.level > lvl);
  return next && next.level - lvl <= NEAR_UNLOCK ? { src: next, gap: next.level - lvl } : null;
}

/** Monsters to fight at your level: the nearest one a little under to a little
 *  over it that auto battle would take on, outside the Wilderness. */
export function fightTarget(game) {
  const cl = game.fightLevel();
  const p = game.playerTile();
  const lo = Math.max(1, cl - 8), hi = cl + 3;
  let best = null;
  for (const n of game.npcs) {
    // The level band first: the cheapest test, and most of the world's ten thousand fail it.
    const l = n.def.level || 1;
    if (l < lo || l > hi) continue;
    if (!n.alive || !n.attackable || n.temporary || n.def.boss || n.def.fixed || n.champion) continue;
    if (game.world.zoneAt(n.x, n.y)?.wilderness) continue;
    // Prefer the strongest of the band (better XP), then the nearest.
    if (!best || l > best.l + 2 || (Math.abs(l - best.l) <= 2 && dist(n, p) < dist(best.n, p))) best = { n, l };
  }
  return best ? best.n : null;
}

/** Up to MAX_GOALS goals: [{ key, kind, icon, title, text, go }]. */
export function whatNext(game) {
  const out = [];
  if (!game?.player || !game.jobClass) return out;   // nothing to suggest before a class is picked
  const up = packUpgrade(game);
  if (up) out.push({ key: `gear:${up.id}`, kind: 'gear', icon: '&#9650;', title: 'Wear your better gear', text: `${getItem(up.id).name} beats what you wear.`, go: 'Equip' });
  const q = nextQuest(game);
  if (q) out.push({ key: `quest:${q.id}`, kind: 'quest', quest: q.id, icon: '!', title: q.name, text: q.text, go: 'Go' });
  // A life skill: one in its golden hours first, else one about to open new ground.
  const golden = (game.goldenSkills?.() || []).filter((s) => GO_SKILLS.includes(s));
  let sk = null;
  for (const s of golden) { const b = bestSource(game, s); if (b) { sk = { skill: s, ...b, why: `Golden hours: +50% XP` }; break; } }
  if (!sk) {
    for (const s of GO_SKILLS) {
      const nu = nearUnlock(game, s);
      const b = nu && bestSource(game, s);
      if (b) { sk = { skill: s, ...b, why: `${nu.gap} level${nu.gap === 1 ? '' : 's'} to ${nu.src.name}` }; break; }
    }
  }
  if (sk) out.push({ key: `skill:${sk.skill}`, kind: 'skill', skill: sk.skill, obj: sk.obj, icon: '&#10022;', title: `Train ${skillName(sk.skill)}`, text: `${doText(sk.src)}. ${sk.why}.`, go: 'Go' });
  const mob = fightTarget(game);
  if (mob) out.push({ key: `fight:${mob.npcId}`, kind: 'fight', npc: mob, icon: '&#9876;', title: 'Train combat', text: `Fight monsters your level, like the ${getNpc(mob.npcId).name} (level ${mob.def.level || 1}). Auto battle takes over.`, go: 'Go' });
  return out.slice(0, MAX_GOALS);
}

/** Start on a goal (the card's Go). Returns true when something started. */
export function runGoal(game, goal) {
  if (!goal || !game.player.alive) return false;
  if (goal.kind === 'gear') {
    const n = game.equipBest();
    if (!n) game.msg('Nothing in your pack beats what you wear right now.', 'system');
    return n > 0;
  }
  if (goal.kind === 'quest') return game.questTravel(goal.quest) !== false;
  if (goal.kind === 'skill') {
    // The spot may have run dry since the card was drawn: pick again if so.
    const o = goal.obj && !goal.obj.depleted ? goal.obj : bestSource(game, goal.skill)?.obj;
    if (!o) { game.msg(`There's nothing for ${skillName(goal.skill)} I can take you to right now.`, 'system'); return false; }
    return game.goToObject(o);   // MRT hop, the long walk and the first swing (game.js)
  }
  if (goal.kind === 'fight') {
    const n = goal.npc?.alive ? goal.npc : fightTarget(game);
    if (!n) { game.msg('No monsters your level are about right now.', 'system'); return false; }
    if (dist(n, game.playerTile()) <= 12) game.attackNpc(n);
    else game.travelToTile({ x: n.x, y: n.y });   // auto battle picks a fight on arrival
    if (!game.autoBattle) game.toggleAutoBattle(true);
    return true;
  }
  return false;
}
