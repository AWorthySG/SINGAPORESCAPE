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
import { firstJourneyGoal } from './firstjourney.js';
import { finishResumeTask, resumeTaskText } from './resumetask.js';
import { betterRoundsInPack } from './rounds.js';
import { getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { QUESTS } from '../data/quests.js';
import { canWear } from '../data/classes.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { meetsReq } from './gear.js';
import { wouldWear } from './bestpick.js';
import { gatherSources } from './skillguide.js';
import { zoneLevel } from '../data/world.js';
import { OBJECTS } from '../data/objects.js';

export const MAX_GOALS = 3;
// A gathering skill this close to its next new source gets a nudge.
export const NEAR_UNLOCK = 2;
// Gathering skills the card can walk you to (each has placed objects).
const GO_SKILLS = ['woodcutting', 'mining', 'fishing', 'hunter', 'diving', 'archaeology', 'thieving', 'agility'];
// The skill card's verb for each.
const VERB = { woodcutting: 'Chop', mining: 'Mine', hunter: 'Trap', thieving: 'Steal from', agility: 'Run' };
/** What to do there, e.g. "Chop Oak tree", "Catch Raw anchovy at an anchovy shoal". */
const doText = (src) => (src.spot ? `${src.skill === 'diving' ? 'Dive for' : src.skill === 'archaeology' ? 'Dig up' : 'Catch'} ${src.name} at ${/^[aeiou]/i.test(src.spot) ? 'an' : 'a'} ${src.spot.toLowerCase()}` : `${VERB[src.skill] || 'Work'} ${src.name}`);

const skillName = (s) => SKILL_BY_ID[s]?.name || s;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Whether the piece in pack slot `s` beats what you wear (and you can wear it now). */
function beatsWorn(game, s) {
  if (!s || !getItem(s.id).equip || getItem(s.id).tool) return false;
  if (game.jobClass && !canWear(game.jobClass, s.id)) return false;
  if (!meetsReq(s.id, game.skills).ok) return false;
  if (game._canEquipNow && !game._canEquipNow(s.id)) return false;
  // Equip best's own test (bestpick.js): it weighs a piece once its ★ and lines carry over.
  return wouldWear(game, s);
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
export function bestSource(game, skill, filter = null) {
  const lvl = game.skills.level(skill);
  const p = game.playerTile();
  // Each kind of tool is looked for once (a look goes through the whole pack,
  // hundreds of slots late in the game), not once per source that uses it.
  const tools = new Map();
  const hasTool = (t) => { if (!tools.has(t)) tools.set(t, game.hasTool(t)); return tools.get(t); };
  const ok = gatherSources().filter((s) => s.skill === skill && s.objIds?.length && s.level <= lvl && (!s.tool || hasTool(s.tool)));
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
// world events pick their regions), bar the region you are in already, and none
// within reach of a monster that would set on you (dangerGrid). Routes are
// checked tile by tile with all of that as walls (safeRouteCfg), and then walked
// that way: marking whole regions "reachable" would miss a route that clips a
// dangerous corner, or spots cut off inside a region (Changi's pomfret).
// The tap itself may go anywhere safe (riding the MRT where that helps, or is
// the only safe way); what the mode then does by itself stays close and on foot.
const AUTO_NEAR = 30;   // auto gather's own trips: no further than it ever walked by itself (or across your region)
const LEAVE = 16;       // standing in a monster's reach already, you may walk this far through it on the way out (safeRouteCfg)
const workable = (game, skill, lvl = game.skills.level(skill)) =>
  gatherSources().filter((s) => s.skill === skill && s.objIds?.length && s.level <= lvl && (!s.tool || game.hasTool(s.tool)))
    .sort((a, b) => b.level - a.level);
/** The best source of `skill` your level and tools allow, wherever it is (null for none). */
export const bestWorkable = (game, skill) => workable(game, skill)[0] || null;
/** The level of the best source you can work at `node` (0 for none): what it's worth to the mode. */
export function gatherLevel(game, skill, node) {
  return node ? workable(game, skill).find((s) => s.objIds.includes(node.objId))?.level || 0 : 0;
}
/** Whether a region is safe for you to gather in or walk through (above). */
function safeZones(game) {
  const p = game.playerTile(), W = game.world, here = W.zoneAt?.(p.x, p.y), fight = game.fightLevel?.() || 1;
  // The Singapore layout guards actual paths to its training grounds, so safe
  // walking there follows enemy reach even in a high-level district.
  if (W.layout === 'singapore') return (z) => z === here || (!z?.wilderness && !z?.instance);
  const seen = new Map();
  return (z) => {
    if (!z || z === here) return true;
    let ok = seen.get(z);
    if (ok === undefined) seen.set(z, (ok = !z.wilderness && !z.instance && zoneLevel(z) <= fight + 10));
    return ok;
  };
}
// A region's level says little about its monsters: Sentosa Beach and Bukit Timah
// count as level 0, yet the mode's move up to Sentosa's red snapper met a level
// 86 sand scorpion. And auto retaliate stays quiet while you work a life skill
// (the owner's ask), so any aggressive monster that would set on you (any not
// far too weak to bother with you, as npc.js decides) wears you down as you
// gather. The tiles within its reach (its wander round home, its aggro range,
// and one more for the tile you stand on beside a node) are danger. Kept until
// your fighting level or the monsters change; summed up from each reach's
// corners, the world's thousands of monsters cost a millisecond or two.
let threat = null;
/** How far round its home a monster's reach goes (above), or 0 for one that wouldn't set on you. */
function reachOf(n, fight) {
  const d = n.def;
  return !d?.attackable || !d.aggressive || (!d.ignoreLevelGate && fight > d.level * 2 + 1) ? 0 : (n.wander || 0) + (d.aggroRange || 4) + 1;
}
function dangerGrid(game) {
  const W = game.world, npcs = game.npcs || [], fight = game.fightLevel?.() || 1;
  if (threat?.game === game && threat.world === W && threat.npcs === npcs && threat.n === npcs.length && threat.fight === fight) return threat.grid;
  const w = W.width, h = W.height, row = w + 1, sum = new Int32Array(row * (h + 1));
  let far = 0;   // the widest reach (safeRouteCfg looks no further for the ones about you)
  for (const n of npcs) {
    const r = reachOf(n, fight);
    if (!r) continue;
    if (r > far) far = r;
    const x = Math.round(n.spawnX), y = Math.round(n.spawnY);
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
    if (!(x0 < x1 && y0 < y1)) continue;
    sum[y0 * row + x0]++; sum[y0 * row + x1]--; sum[y1 * row + x0]--; sum[y1 * row + x1]++;
  }
  const grid = new Uint8Array(w * h), col = new Int32Array(w);
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) { col[x] += sum[y * row + x]; run += col[x]; if (run > 0) grid[y * w + x] = 1; }
  }
  threat = { game, world: W, npcs, n: npcs.length, fight, grid, far };
  return grid;
}
/** Path-search settings for a trip that keeps out of danger: regions that aren't
 *  safe for you, and monsters' reach, are walls (Game.pathCfg takes these while
 *  such a trip starts). In a monster's reach already (or on its edge, beside a
 *  node), you may walk on through it, up to LEAVE tiles, but never nearer its
 *  home than you stand, nor into the reach of another: a pass through every reach
 *  close by walked a woodcutter past a fruit bat's roost, and over a goblin's home. */
export function safeRouteCfg(game) {
  const W = game.world, ok = safeZones(game), danger = dangerGrid(game), w = W.width, p = game.playerTile();
  const S = 2 * LEAVE + 1;
  let pass = null;   // the tiles within LEAVE of you that you may cross (only asked of where there's danger)
  if (danger[p.y * w + p.x] === 1) {
    const fight = game.fightLevel?.() || 1, near = [], far = LEAVE + threat.far + 1;   // every reach that comes within LEAVE of you
    for (const n of game.npcs || []) {
      if (Math.abs(n.spawnX - p.x) > far || Math.abs(n.spawnY - p.y) > far) continue;   // (the world's thousands, cheaply)
      const r = reachOf(n, fight), x = Math.round(n.spawnX), y = Math.round(n.spawnY), d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
      if (r && d <= LEAVE + r) near.push({ x, y, r, d });
    }
    pass = new Uint8Array(S * S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = p.x - LEAVE + i, y = p.y - LEAVE + j;
      pass[j * S + i] = near.every((m) => { const d = Math.max(Math.abs(x - m.x), Math.abs(y - m.y)); return d > m.r || (m.d <= m.r && d >= m.d); }) ? 1 : 0;
    }
  }
  const crossable = (x, y) => { const i = x - p.x + LEAVE, j = y - p.y + LEAVE; return i >= 0 && j >= 0 && i < S && j < S && pass[j * S + i] === 1; };
  return { width: W.width, height: W.height, isBlocked: (x, y) => W.isBlocked(x, y) || !ok(W.zoneAt(x, y))
    || (danger[y * w + x] === 1 && !(pass && crossable(x, y))) };
}
/** Whether a node stands somewhere safe for you to gather (above). */
function safeNodes(game) {
  const W = game.world, ok = safeZones(game), danger = dangerGrid(game), w = W.width;
  return (o) => ok(W.zoneAt?.(o.x, o.y)) && danger[o.y * w + o.x] !== 1;
}
/** The land you can walk on within cfg's walls, flooded from `from` (you) and
 *  labelled, other stretches of it only when first asked about (beside an MRT
 *  station): walk(t, node) says whether you can walk from tile t to stand beside
 *  node, steps(node) in how few steps you can from `from` (Infinity: you can't).
 *  Every node is then a look-up: a path search per node can't say "no way" until
 *  it has looked everywhere, and the tap and the mode ask of many. */
function safeLand(cfg, from, bufs) {
  const { width: w, height: h, isBlocked } = cfg, size = w * h;
  if (bufs?.label.length !== size) bufs = { label: new Int32Array(size), steps: new Int32Array(size), q: new Int32Array(size) };
  const { label, steps, q } = bufs;
  label.fill(0);
  let n = 0;
  const flood = (i0) => {
    let head = 0, tail = 0;
    label[i0] = ++n; steps[i0] = 0; q[tail++] = i0;
    while (head < tail) {
      const i = q[head++], x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * w + nx;
        if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h || label[j] || isBlocked(nx, ny)) continue;
        if (dx && dy && (isBlocked(x + dx, y) || isBlocked(x, y + dy))) continue;   // no cutting corners, as findPath
        label[j] = n; steps[j] = steps[i] + 1; q[tail++] = j;
      }
    }
  };
  const home = from.y * w + from.x;
  flood(home);   // from your own tile even if the walls cover it (a trap you stand on), as a path search does
  const beside = (node, L, best) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = node.x + dx, y = node.y + dy, j = y * w + x;
      if (x >= 0 && y >= 0 && x < w && y < h && label[j] === L && (best = Math.min(best, steps[j])) === 0) return 0;
    }
    return best;
  };
  return {
    bufs,
    walk(t, node) {
      if (!t) return false;
      if (dist(t, node) <= 1) return true;
      const i = t.y * w + t.x;
      if (!label[i]) { if (isBlocked(t.x, t.y)) return false; flood(i); }
      return beside(node, label[i], Infinity) < Infinity;
    },
    steps: (node) => (dist(from, node) <= 1 ? 0 : beside(node, label[home], Infinity)),
  };
}
// The Life skills grid asks for every gathering skill at once, and the mode asks
// on every idle tick: one flood serves them all while nothing has changed (the
// same tile, fighting level, objects and monsters), and its buffers are kept.
let land = null;
function safeLandNow(game) {
  const p = game.playerTile(), danger = dangerGrid(game), W = game.world;
  const key = `${p.x},${p.y}:${game.fightLevel?.()}:${W._objRev}`;
  if (land?.game === game && land.world === W && land.danger === danger && land.key === key) return land;
  const cfg = safeRouteCfg(game);
  land = { game, world: W, danger, key, cfg, ...safeLand(cfg, p, land?.game === game ? land.bufs : null) };
  return land;
}
// World-event nodes (a meteorite, a rare shoal, an ancient tree) and any node
// with a def of its own come and go: the mode never picks one (nor moves you off one).
export const specialNode = (o) => !!o.worldEvent || o.def !== OBJECTS[o.objId];
// The world's nodes by kind, made again whenever an object comes or goes: a
// source has a handful among the world's thousands of objects, and the grid's
// four hints look through dozens of sources.
let kinds = null;
function nodesOf(W, objIds) {
  if (kinds?.arr !== W.objects || kinds.n !== W.objects.length || kinds.rev !== W._objRev) {
    const map = new Map();
    for (const o of W.objects) { let a = map.get(o.objId); if (!a) map.set(o.objId, (a = [])); a.push(o); }
    kinds = { arr: W.objects, n: W.objects.length, rev: W._objRev, map };
  }
  return objIds.length === 1 ? kinds.map.get(objIds[0]) || [] : objIds.flatMap((id) => kinds.map.get(id) || []);
}
/** The highest-level source of `skill` you can work (at level `lvl`) that has a
 *  node somewhere safe for you, ready or not: what the mode is after. */
export function topGatherSource(game, skill, lvl) {
  const W = game.world, safe = safeNodes(game);
  for (const src of workable(game, skill, lvl)) {
    if (nodesOf(W, src.objIds).some((o) => !specialNode(o) && safe(o))) return src;
  }
  return null;
}
// The search behind both: sources best first; for each, its safe nodes (among
// `nodes`, if given) within `near` tiles or in your region, the nearest (by `cost`) first,
// until `reach` finds a way to one. With `wait`, a source whose nodes within
// `near` that you can get to are spent for now (they grow back in seconds) is
// waited for, rather than walked across the region for or dropped for a lesser one.
function bestGather(game, skill, { nodes = null, exclude = null, near = Infinity, wait = false, reach, cost = null }) {
  const p = game.playerTile(), W = game.world, here = W.zoneAt?.(p.x, p.y), safe = safeNodes(game);
  for (const src of workable(game, skill)) {
    const ids = new Set(src.objIds), ready = [];
    let spent = false;
    for (const o of nodes || nodesOf(W, src.objIds)) {
      if (!ids.has(o.objId) || specialNode(o)) continue;
      const d = dist(o, p);
      if ((d > near && W.zoneAt?.(o.x, o.y) !== here) || !safe(o)) continue;
      if (o === exclude || o.depleted) { if (wait && d <= near && !spent) spent = !!reach(o); continue; }
      const c = cost ? cost(o) : d;
      if (c < Infinity) ready.push({ o, d, c });
    }
    ready.sort((a, b) => a.c - b.c);
    for (const { o, d } of ready) {
      if (wait && spent && d > near) continue;
      const trip = reach(o);
      if (trip) return { obj: o, src, trip };
    }
    if (wait && spent) return { obj: null, src };
  }
  return null;
}
/** Where "the best you can" auto gather goes next by itself: the ready node of
 *  the best source with nodes close by (within AUTO_NEAR tiles, or in your region)
 *  that the fewest steps reach without crossing danger; null while that source's
 *  nodes close by are spent (wait for them to grow back), or when nothing is
 *  close. Never a long trip, never the MRT. */
export function bestGatherNode(game, skill, { exclude = null } = {}) {
  const { steps } = safeLandNow(game), W = game.world, p = game.playerTile(), here = W.zoneAt?.(p.x, p.y);
  // Only the objects close by are looked at (the world holds thousands).
  const nodes = new Set(W.objectsIn(p.x - AUTO_NEAR, p.y - AUTO_NEAR, p.x + AUTO_NEAR, p.y + AUTO_NEAR));
  if (here) for (const o of W.objectsIn(here.x0, here.y0, here.x1, here.y1)) nodes.add(o);
  if (exclude) nodes.add(exclude);
  const reach = (o) => steps(o) < Infinity;
  return bestGather(game, skill, { nodes, exclude, near: AUTO_NEAR, wait: true, reach, cost: steps })?.obj || null;
}
/** How the Life skills shortcut gets to `node` keeping out of danger, or null:
 *  { cfg, st } rides the MRT to station st first (null: walks all the way). The
 *  ride a Go would take comes first, then walking, then a ride to any station
 *  nearer the node than you that a safe walk goes on from (a region only the
 *  MRT reaches safely). `ride`: whether you may take the MRT at all. */
function safeTrip(game, node, cfg, walk, ride, at) {
  const from = (st) => { const p = at(st); return p && !cfg.isBlocked(p.x, p.y) && walk(p, node); };
  const hop = ride && game._mrtHopStation(node);
  if (hop && from(hop)) return { cfg, st: hop };
  if (walk(game.playerTile(), node)) return { cfg, st: null };
  const any = ride && game._mrtHopStation(node, from);
  return any ? { cfg, st: any } : null;
}

function ferryLegs(game, cfg, walk, ride, at) {
  const { world: W } = game, links = W.ferryLinks || [];
  if (!links.length) return [];
  const crossings = links.flatMap(({ from, to }) => [[from, to], [to, from]]);
  const queue = [{ tile: game.playerTile(), st: null, ferry: null }];
  if (ride) for (const st of W.stations) {
    const tile = at(st);
    if (tile && !cfg.isBlocked(tile.x, tile.y)) queue.push({ tile, st, ferry: null });
  }
  const firstLanding = queue.length, seen = new Set();
  for (const leg of queue) for (const [from, to] of crossings) {
    if (seen.has(to) || cfg.isBlocked(to.x, to.y) || !walk(leg.tile, from)) continue;
    const ferry = leg.ferry || W.objectAt(from.x, from.y);
    if (ferry?.def.type !== 'ferry') continue;
    seen.add(to);
    queue.push({ tile: to, st: leg.st, ferry });
  }
  return queue.slice(firstLanding);
}

function gatheringTrips(game) {
  const { cfg, walk } = safeLandNow(game), ride = !!game._mrtCanHop?.(), tiles = new Map();
  const at = (st) => { if (!tiles.has(st)) tiles.set(st, game._nearestFree(st.x, st.y)); return tiles.get(st); };
  let legs;
  return (o) => {
    const land = safeTrip(game, o, cfg, walk, ride, at);
    if (land) return land;
    legs ||= ferryLegs(game, cfg, walk, ride, at);
    const leg = legs.find(({ tile }) => walk(tile, o));
    return leg ? { cfg, st: leg.st, ferry: leg.ferry } : null;
  };
}

/** A safe trip to this exact node, including a crossing when needed. */
export function gatheringTrip(game, node) {
  return safeNodes(game)(node) ? gatheringTrips(game)(node) : null;
}

/** Guide Go offers the closest reachable source of the requested kind. */
export function gatheringPickFor(game, ids) {
  const p = game.playerTile(), safe = safeNodes(game), route = gatheringTrips(game);
  const candidates = nodesOf(game.world, [...new Set(ids)]).filter((o) => !o.depleted && !specialNode(o) && safe(o));
  candidates.sort((a, b) => dist(p, a) - dist(p, b));
  for (const obj of candidates) {
    const trip = route(obj);
    if (trip) return { obj, trip };
  }
  return null;
}
/** Whether the mode may go to `node` by itself: somewhere safe, and a safe walk away. */
export function safeToGather(game, node) {
  return !!node && safeNodes(game)(node) && safeLandNow(game).steps(node) < Infinity;
}
/** The first pick for a Life skills shortcut: the nearest ready node of the
 *  best source you can get to safely, anywhere, with that source and the trip
 *  there: { obj, src, trip } or null. A spent node beside you doesn't stop it. */
export function bestGatherPick(game, skill) {
  return bestGather(game, skill, { reach: gatheringTrips(game) });
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
  if (game.resumeTask) {
    const place = game.currentZoneName || game.world.zoneAt(game.player.x, game.player.y)?.name || 'Singapore';
    out.push({ key: 'resume', kind: 'resume', icon: '↪', title: 'Pick up where you left off', text: `${place} · ${resumeTaskText(game)}`, go: 'Resume' });
  }
  const up = packUpgrade(game);
  if (up) out.push({ key: `gear:${up.id}`, kind: 'gear', icon: '&#9650;', title: 'Wear your better gear', text: `${getItem(up.id).name} beats what you wear.`, go: 'Equip' });
  const journey = firstJourneyGoal(game);
  if (journey) out.push(journey);
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
  if (goal.kind === 'resume') return finishResumeTask(game, true);
  if (goal.kind === 'journey') {
    const j = game.firstJourney;
    if (j?.phase === 'bank') return game.goToNearest(['bank_booth']);
    if (j?.phase === 'field') {
      if (j.route === 'gather') return game.goToNearest(['tree']);
      const p = game.playerTile();
      let nearest = null;
      for (const n of game.npcs) {
        if (n.npcId !== 'rat' || !n.alive || n.champion || n.temporary || game.world.zoneAt(n.x, n.y)?.wilderness) continue;
        if (!nearest || dist(n, p) < dist(nearest, p)) nearest = n;
      }
      return nearest ? game.goToNpc(nearest) : false;
    }
    game.ui?.openFirstJourney?.();
    return true;
  }
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
