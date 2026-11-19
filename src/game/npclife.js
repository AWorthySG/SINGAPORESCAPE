// Living NPCs: townsfolk and the region quest givers keep simple daily
// routines on the in-game clock (src/data/npcchatter.js ROUTINES): a stall
// keeper minds the stall by day and walks home at night, others run errands
// between two or three spots, villagers potter about and meet a neighbour for
// a chat (the pair face each other and trade speech bubbles). Someone you
// click stops and turns to you until you've finished with them, so a routine
// never gets in the way of a shop, a bank or a quest.
//
// This module also notices the deeds that raise region reputation (quests,
// world events, moral choices) and keeps the consequences of your choices in
// the world. game.js calls in from three short hooks: tickLife each tick,
// lifeOnKill when you kill something, and holdNpc when you click a person.
//
// Cheap by design: only NPCs inside the usual update box (46 tiles) are
// looked at, a path is planned only when someone sets off for a new spot
// (short trips, a capped search), and spots are worked out the first time
// they are needed. No Math.random: the seeded tests' rolls are untouched.
import { findPath } from '../engine/pathfinding.js';
import { chebyshev } from '../core/utils.js';
import { DAY_CYCLE_MS } from '../config.js';
import { QUESTS } from '../data/quests.js';
import { REGION_LINES } from '../data/regionQuests.js';
import { RESIDENTS } from '../data/consequences.js';
import { ROUTINES, GIVER_ROUTINE, CHAT_EXCHANGES, SLEEP_LINE } from '../data/npcchatter.js';
import { addRep, repOnKill, repOnMoral, seedRep, REP_GAIN } from './reputation.js';
import { noteDeed, tickMemory, hash01, fillLine } from './memory.js';
import { syncConsequences } from './consequences.js';

const UPDATE_BOX = 46;           // the same box doTick ticks NPCs in
export const HOLD_TICKS = 20;    // a clicked NPC waits ~12s for you to arrive
const CHAT_EVERY = 4;            // ticks between lines in a conversation
const CHAT_HEAR = 16;            // conversations only run where you can see them
const POLL_EVERY = 5;            // ticks between deed checks
const PATH_NODES = 1500;
const QUEST_REGION = Object.fromEntries(REGION_LINES.map((l) => [l.id, l.region]));
// The eight directions, for picking spots around someone's post.
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const SPOT_DIST = { home: 5, a: 4, b: 4, stroll: 5 };
const SPOT_TURN = { home: 0, a: 2, b: 5, stroll: 3 };   // each spot heads off a different way

const idHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; };

/** Where a routine wants someone at an hour (0-24): 'post', 'home', 'chat'... */
export function slotAt(kind, hour) {
  const slots = ROUTINES[kind] || ROUTINES.stall;
  const h = ((hour % 24) + 24) % 24;
  for (const s of slots) {
    if (s.from <= s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to) return s.at;
  }
  return 'post';
}

// ---------------- Setup ----------------
/** Give an NPC a routine (a no-op if it has one). */
export function addRoutine(game, n, kind) {
  if (!ROUTINES[kind]) return;
  n.life = { ...(n.life || {}), kind, post: { x: n.spawnX ?? n.x, y: n.spawnY ?? n.y },
    zone: game.world.zoneAt(n.x, n.y)?.name || null, spots: {}, baseWander: kind === 'villager' ? Math.max(2, n.wander || 3) : 0,
    cd: 0, seed: idHash(n.npcId + n.x + ',' + n.y) };
  if (!game._life.list.includes(n)) game._life.list.push(n);
}

function setup(game) {
  const L = game._life = {
    list: [], pairs: [], held: new Set(), first: true,
    done: new Set(), moral: {}, weDone: 0, we: null, bounties: new WeakSet(),
  };
  // Residents and the consequences already in force, quietly.
  game._lifeSeen = new Set();
  syncConsequences(game, true);
  // Routines: the region quest givers, the villagers the world placed, and residents.
  for (const n of game.npcs) {
    if (n.attackable || n.temporary || n.ally || n.worldEvent || n.def.moral) continue;
    if (n.def.dialogue === 'region') addRoutine(game, n, GIVER_ROUTINE[n.npcId] || 'stall');
    else if (n.npcId === 'villager' && !n._spawnOpts) addRoutine(game, n, 'villager');
    else if (n.life?.resident) addRoutine(game, n, RESIDENTS[n.life.resident]?.routine || 'stall');
  }
  pairUp(game);
  // What has already happened doesn't count as news (an old save gets its
  // reputation credit once, from seedRep).
  for (const q of QUESTS) if (game.quests?.[q.id]?.state === 'done') L.done.add(q.id);
  L.moral = { ...(game.moral?.choices || {}) };
  L.weDone = game.worldEvents?.done || 0;
  for (const b of game.bounties?.list || []) if (b.done) L.bounties.add(b);
  seedRep(game);
  return L;
}

// Neighbours who share a chat slot pair up, nearest first (posts within 12
// tiles, in the same region). The meeting spot is found the first time they meet.
function pairUp(game) {
  const L = game._life;
  const free = L.list.filter((n) => ROUTINES[n.life.kind].some((s) => s.at === 'chat'));
  const used = new Set();
  for (const a of free) {
    if (used.has(a)) continue;
    let best = null, bd = 13;
    for (const b of free) {
      if (b === a || used.has(b) || b.life.zone !== a.life.zone) continue;
      const d = chebyshev(a.life.post.x, a.life.post.y, b.life.post.x, b.life.post.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) continue;
    used.add(a); used.add(best);
    const pair = { a, b: best, i: L.pairs.length, turn: 0, line: -1, spots: null };
    a.life.pair = pair; best.life.pair = pair;
    L.pairs.push(pair);
  }
}

const open = (game, x, y, zone) => {
  const w = game.world;
  return w.inBounds(x, y) && !w.isBlocked(x, y) && !w.objectAt(x, y) && (!zone || w.zoneAt(x, y)?.name === zone);
};
// A path from `from` to `to` no longer than `max` steps, or null.
function reach(game, from, to, max) {
  if (from.x === to.x && from.y === to.y) return [];
  const p = findPath(game.pathCfg(), from, to, { maxNodes: 800 });
  return p.length && p.length <= max ? p : null;
}

/** A routine's spot (worked out once, then remembered), or the post if none fits. */
export function spotFor(game, n, at) {
  const life = n.life, post = life.post;
  if (at === 'post' || !SPOT_DIST[at]) return post;
  if (life.spots[at] !== undefined) return life.spots[at] || post;
  const dist = SPOT_DIST[at];
  let found = null;
  for (let k = 0; k < 8 && !found; k++) {
    const [dx, dy] = DIRS[(life.seed + SPOT_TURN[at] + k) % 8];
    for (const r of [dist, dist - 1, dist + 1, dist - 2]) {
      const x = post.x + dx * r, y = post.y + dy * r;
      if (open(game, x, y, life.zone) && reach(game, post, { x, y }, r * 2 + 6)) { found = { x, y }; break; }
    }
  }
  life.spots[at] = found;
  return found || post;
}

// The pair's two meeting tiles, side by side near the middle of their posts.
function meetingSpots(game, pair) {
  if (pair.spots !== null) return pair.spots;
  const A = pair.a.life.post, B = pair.b.life.post, zone = pair.a.life.zone;
  const mx = Math.round((A.x + B.x) / 2), my = Math.round((A.y + B.y) / 2);
  pair.spots = false;
  for (let r = 0; r <= 3 && !pair.spots; r++) {
    for (let dy = -r; dy <= r && !pair.spots; dy++) for (let dx = -r; dx <= r && !pair.spots; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = mx + dx, y = my + dy;
      if (!open(game, x, y, zone)) continue;
      for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x2 = x + ex, y2 = y + ey;
        if (!open(game, x2, y2, zone)) continue;
        if (reach(game, A, { x, y }, 30) && reach(game, B, { x: x2, y: y2 }, 30)) { pair.spots = [{ x, y }, { x: x2, y: y2 }]; break; }
      }
    }
  }
  return pair.spots;
}

// ---------------- Where someone should be ----------------
/** The tile a routine NPC is heading for at this hour (null: let them wander). */
export function routineTarget(game, n, hour = game.gameHour()) {
  const life = n.life;
  let at = slotAt(life.kind, hour);
  if (at === 'chat') {
    const pair = life.pair, other = pair && (pair.a === n ? pair.b : pair.a);
    const spots = other && slotAt(other.life.kind, hour) === 'chat' && game.npcs.includes(other) && meetingSpots(game, pair);
    if (spots) return spots[pair.a === n ? 0 : 1];
    at = life.kind === 'villager' ? 'wander' : 'post';
  }
  if (at === 'wander') return null;
  return spotFor(game, n, at);
}

function face(n, x, y) {
  const dx = Math.sign(x - n.x), dy = Math.sign(y - n.y);
  if (!dx && !dy) return;
  n.facing = { dx, dy };
  n.noteFacing?.();
}

function stepRoutine(game, n, hour) {
  const life = n.life;
  const to = routineTarget(game, n, hour);
  if (!to) { n.wander = life.baseWander; return; }   // pottering about as usual
  n.wander = 0;
  if (n.x === to.x && n.y === to.y) {
    if (n.isMoving) return;
    const at = slotAt(life.kind, hour);
    // Asleep at home after dark: now and then a snore, if you're close.
    if (at === 'home' && (hour >= 22 || hour < 5) && !n.chatTimer && (game.tickCount + life.seed) % 40 === 0) {
      const p = game.player;
      if (chebyshev(n.x, n.y, p.x, p.y) <= 8) { n.chatText = SLEEP_LINE; n.chatTimer = 3; }
    }
    return;
  }
  if (n.isMoving) return;
  if (life.cd > 0) { life.cd--; return; }
  const path = findPath(game.pathCfg(), n.stepTile(), to, { maxNodes: PATH_NODES });
  if (path.length) { n.setPath(path); life.cd = 2; } else life.cd = 30;   // unreachable for now: try again later
}

// Two neighbours at their meeting tiles take turns to talk.
function stepChat(game, pair, hour) {
  const { a, b } = pair;
  const spots = pair.spots;
  if (!spots || a.isMoving || b.isMoving || a._holdUntil > game.tickCount || b._holdUntil > game.tickCount) return;
  if (a.x !== spots[0].x || a.y !== spots[0].y || b.x !== spots[1].x || b.y !== spots[1].y) return;
  if (slotAt(a.life.kind, hour) !== 'chat' || slotAt(b.life.kind, hour) !== 'chat') return;
  face(a, b.x, b.y); face(b, a.x, a.y);
  const p = game.player;
  if (chebyshev(a.x, a.y, p.x, p.y) > CHAT_HEAR || (game.tickCount + pair.i) % CHAT_EVERY) return;
  const day = Math.floor((game.playMs || 0) / DAY_CYCLE_MS) * 24 + Math.floor(hour / 2);
  if (pair.line < 0 || pair.day !== day) {
    pair.day = day;
    pair.line = Math.floor(hash01(day * 97 + pair.i * 13 + a.life.seed) * CHAT_EXCHANGES.length);
    pair.turn = 0;
  }
  const lines = CHAT_EXCHANGES[pair.line];
  if (pair.turn >= lines.length + 2) { if (pair.turn++ > lines.length + 10) pair.turn = 0; return; }   // a pause, then they go again
  if (pair.turn < lines.length) {
    const who = pair.turn % 2 ? b : a;
    who.chatText = fillLine(lines[pair.turn], game);
    who.chatTimer = 3;
  }
  pair.turn++;
}

// ---------------- Holding still for you ----------------
/**
 * You clicked a person: they stop and turn to you, and wait while you walk
 * over and talk (or trade). Returns the tile they'll be standing on (the one
 * they're stepping onto, if mid-step), for your walk to aim at.
 */
export function holdNpc(game, npc) {
  if (!npc || npc.attackable) return npc ? { x: npc.x, y: npc.y } : null;
  npc._holdUntil = (game.tickCount || 0) + HOLD_TICKS;
  (game._life?.held || (game._heldEarly ||= new Set())).add(npc);
  npc.stop();
  if (npc._heldWander === undefined) npc._heldWander = npc.wander;
  npc.wander = 0;
  return npc.isMoving ? { x: npc.tx, y: npc.ty } : { x: npc.x, y: npc.y };
}

function stepHeld(game, L) {
  const p = game.player, a = p.action, modal = !!game.ui?.modal;
  for (const n of L.held) {
    const near = chebyshev(n.x, n.y, p.x, p.y);
    const wanted = a && (a.npc === n || (a.target && a.target.x === n.x && a.target.y === n.y));
    if (wanted || (modal && near <= 2)) n._holdUntil = Math.max(n._holdUntil || 0, game.tickCount + 2);
    if (game.tickCount > (n._holdUntil || 0) || !game.npcs.includes(n)) {
      L.held.delete(n);
      if (n._heldWander !== undefined) { n.wander = n._heldWander; n._heldWander = undefined; }
      continue;
    }
    n.stop();
    n.wander = 0;
    if (!n.isMoving && near <= 6) face(n, p.x, p.y);
  }
}

// ---------------- Deeds: reputation and the deed memory ----------------
function pollDeeds(game, L) {
  for (const q of QUESTS) {
    if (L.done.has(q.id) || game.quests?.[q.id]?.state !== 'done') continue;
    L.done.add(q.id);
    const region = QUEST_REGION[q.id] || game.currentZoneName;
    addRep(game, region, QUEST_REGION[q.id] ? REP_GAIN.regionQuest : REP_GAIN.quest, `you finished ${q.name}`);
    noteDeed(game, 'quest', q.name);
  }
  for (const [id, side] of Object.entries(game.moral?.choices || {})) {
    if (L.moral[id]) continue;
    L.moral[id] = side;
    repOnMoral(game, id, side);
  }
  const we = game.worldEvents;
  if (we) {
    if (we.active) L.we = { name: we.active.name, place: we.active.place, region: we.active.region };
    if ((we.done || 0) > L.weDone) {
      L.weDone = we.done;
      if (L.we) { addRep(game, L.we.region, REP_GAIN.worldEvent, `you saw off ${L.we.name}`); noteDeed(game, 'event', L.we.place || L.we.name); }
    }
    if (!we.active) L.we = null;
  }
  syncConsequences(game, false, (n) => addRoutine(game, n, RESIDENTS[n.life.resident]?.routine || 'stall'));
}

/** A monster died to you (from Game.killNpc). */
export function lifeOnKill(game, npc, onTask) {
  repOnKill(game, npc, onTask);
  if (npc.def.boss) noteDeed(game, 'boss', npc.def.name);
  else if (npc.champion) noteDeed(game, 'champion', npc.def.name);
  // A bounty this kill just finished: a little standing where the bounty's monster lives.
  const L = game._life;
  if (!L) return;
  for (const b of game.bounties?.list || []) {
    if (!b.done || L.bounties.has(b) || b.id !== npc.npcId) continue;
    L.bounties.add(b);
    addRep(game, game.world.zoneAt(npc.spawnX, npc.spawnY)?.name, REP_GAIN.bounty, 'a bounty');
  }
}

// ---------------- The tick ----------------
/** Once a game tick (from doTick). */
export function tickLife(game) {
  const L = game._life || setup(game);
  if (game._heldEarly) { for (const n of game._heldEarly) L.held.add(n); game._heldEarly = null; }
  const p = game.player, hour = game.gameHour();
  stepHeld(game, L);
  for (const n of L.list) {
    if (Math.abs(n.x - p.x) > UPDATE_BOX || Math.abs(n.y - p.y) > UPDATE_BOX || L.held.has(n)) continue;
    stepRoutine(game, n, hour);
  }
  for (const pair of L.pairs) {
    if (Math.abs(pair.a.x - p.x) <= CHAT_HEAR && Math.abs(pair.a.y - p.y) <= CHAT_HEAR) stepChat(game, pair, hour);
  }
  if (game.tickCount % POLL_EVERY === 0) pollDeeds(game, L);
  tickMemory(game);
}

/** After a load: forget the old snapshot, so what the save had already done isn't news. */
export function resetLife(game) {
  game._life = null;
}
