// Crowd logic: the speed-ups for big fights must change nothing a player can
// see. The grid path search finds exactly the paths the plain search did (over
// random worlds, the real map and every option), auto battle's pick weighs
// each monster's fight once yet picks the same, and only monsters close
// enough to care ask your fight level.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPath } from '../src/engine/pathfinding.js';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { chebyshev } from '../src/core/utils.js';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }

// The search as it was before the grid path (origin/main d12ce6c), kept here
// as the reference: a plain binary heap of objects, isBlocked asked each time.
function refPath(cfg, start, goal, opts = {}) {
  const { width, height, isBlocked } = cfg;
  const reachAdjacent = !!opts.reachAdjacent, maxNodes = opts.maxNodes ?? 20000;
  const inB = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
  const cheb = (x, y) => Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y));
  const isGoal = reachAdjacent ? (x, y) => cheb(x, y) <= 1 : (x, y) => x === goal.x && y === goal.y;
  if (isGoal(start.x, start.y)) return [];
  if (!reachAdjacent && (!inB(goal.x, goal.y) || isBlocked(goal.x, goal.y))) return [];
  const heap = [];
  const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last; let i = 0;
      for (;;) { const l = i * 2 + 1, r = l + 1; let s = i; if (l < heap.length && heap[l].f < heap[s].f) s = l; if (r < heap.length && heap[r].f < heap[s].f) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; }
    }
    return top;
  };
  const g = new Map(), came = new Map(), closed = new Set(), key = (x, y) => y * width + x;
  g.set(key(start.x, start.y), 0);
  push({ x: start.x, y: start.y, f: cheb(start.x, start.y) });
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let processed = 0;
  while (heap.length) {
    if (++processed > maxNodes) break;
    const { x: cx, y: cy } = pop(), ci = key(cx, cy);
    if (closed.has(ci)) continue;
    closed.add(ci);
    if (isGoal(cx, cy)) {
      const path = []; let x = cx, y = cy;
      while (!(x === start.x && y === start.y)) { path.push({ x, y }); const c = came.get(key(x, y)); if (!c) break; x = c.x; y = c.y; }
      return path.reverse();
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(nx, ny) || isBlocked(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (isBlocked(cx + dx, cy) || isBlocked(cx, cy + dy))) continue;
      const ni = key(nx, ny);
      if (closed.has(ni)) continue;
      const t = g.get(ci) + 1;
      if (t < (g.has(ni) ? g.get(ni) : Infinity)) { g.set(ni, t); came.set(ni, { x: cx, y: cy }); push({ x: nx, y: ny, f: t + cheb(nx, ny) }); }
    }
  }
  return [];
}

function rng(seed) { let a = seed >>> 0; return () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; }; }

test('the grid path search finds exactly the paths the plain search does, over random worlds', () => {
  for (const seed of [1, 7, 42, 2026]) {
    const r = rng(seed);
    for (let w = 0; w < 60; w++) {
      const W = 2 + Math.floor(r() * 50), H = 2 + Math.floor(r() * 50), dens = r() * 0.55;
      const grid = new Uint8Array(W * H);
      for (let i = 0; i < grid.length; i++) grid[i] = r() < dens ? 1 : 0;
      const isBlocked = (x, y) => x < 0 || y < 0 || x >= W || y >= H || grid[y * W + x] === 1;
      for (let k = 0; k < 25; k++) {
        const s = { x: Math.floor(r() * W), y: Math.floor(r() * H) };
        const t = { x: Math.floor(r() * (W + 4)) - 2, y: Math.floor(r() * (H + 4)) - 2 };   // sometimes off the map
        const o = { reachAdjacent: r() < 0.5, maxNodes: [3, 40, 400, 20000][Math.floor(r() * 4)] };
        const want = refPath({ width: W, height: H, isBlocked }, s, t, o);
        assert.deepEqual(findPath({ width: W, height: H, isBlocked, grid }, s, t, o), want, `grid seed ${seed} world ${w} query ${k}`);
        assert.deepEqual(findPath({ width: W, height: H, isBlocked }, s, t, o), want, `plain seed ${seed} world ${w} query ${k}`);
      }
    }
  }
});

test('on the real map, every kind of search the game makes comes out the same', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  const W = g.world, cfg = g.pathCfg();
  assert.equal(cfg.grid, W.baseBlocked, 'the game\'s searches read the world\'s walls directly');
  const plain = { width: W.width, height: W.height, isBlocked: (x, y) => W.isBlocked(x, y) };
  const r = rng(99);
  for (let k = 0; k < 250; k++) {
    const s = { x: Math.floor(r() * W.width), y: Math.floor(r() * W.height) };
    const reach = r() < 0.15 ? 150 : 25;
    const t = { x: s.x + Math.floor((r() - 0.5) * 2 * reach), y: s.y + Math.floor((r() - 0.5) * 2 * reach) };
    const o = { reachAdjacent: r() < 0.5, maxNodes: [600, 2000, 8000, 150000][Math.floor(r() * 4)] };
    assert.deepEqual(findPath(cfg, s, t, o), refPath(plain, s, t, o), `query ${k}`);
  }
});

test('a world whose isBlocked has been swapped is searched through isBlocked', () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start();
  const p = g.player.tile();
  g.world.isBlocked = () => false;   // as some tests do
  assert.equal(g.pathCfg().grid, null);
  const far = { x: p.x + 30, y: p.y };
  assert.equal(findPath(g.pathCfg(), p, far).length, 30, 'straight over anything');
});

function crowd() {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  for (const k of ['attack', 'strength', 'defence', 'hitpoints']) g.skills.xp[k] = 2e6;
  const p = g.player;
  const mobs = g.npcs.filter((n) => n.alive && n.attackable && !n.def.boss && !n.champion && !n.ally).slice(0, 12);
  mobs.forEach((n, i) => { n.x = n.tx = p.x + 2 + (i % 4); n.y = n.ty = p.y - 1 + Math.floor(i / 4); n.target = null; });
  for (const n of g.npcs) if (!mobs.includes(n) && chebyshev(n.x, n.y, p.x, p.y) < 30) n.alive = false;
  // Four champions and four monsters already on you: every champion weighed
  // asks every attacker's fight-time estimate too.
  for (const c of mobs.slice(0, 4)) { c.makeChampion(); c.hp = 1; }
  for (const a of mobs.slice(4, 8)) a.target = p;
  return { g, mobs };
}

test('auto battle weighs each monster once per pick, and picks the same', () => {
  const { g } = crowd();
  let n = 0;
  const now = g._fightTimesNow;
  g._fightTimesNow = function (x) { n++; return now.call(this, x); };
  const plain = g._pickTargetNow();   // no memory: every estimate worked out afresh
  const asked = n; n = 0;
  const picked = g._autoPickTarget();
  assert.ok(plain, 'something to fight');
  assert.equal(picked, plain, 'the very same pick');
  assert.ok(asked > n, `fewer estimates (${asked} before, ${n} now)`);
  assert.equal(g._ftMemo, null, 'nothing kept once the pick is made');
  // Outside a pick the estimate is fresh each time (a hit since may have changed it).
  const c = g.npcs.find((x) => x.champion && x.alive);
  const t1 = g._autoFightTimes(c); c.hp = c.maxHp;
  assert.ok(g._autoFightTimes(c).myTime > t1.myTime);
});

test('an aggressive monster only asks your fight level when close enough to care', () => {
  const { g, mobs } = crowd();
  const p = g.player;
  let asked = 0;
  const fl = g.fightLevel;
  g.fightLevel = function () { asked++; return fl.call(this); };
  g._aggroAttackers = 0;
  const far = mobs[11];
  far.def = { ...far.def, aggressive: true, aggroRange: 3, level: 1 }; far.target = null; far.wander = 30;
  far.x = far.tx = p.x + 20; far.y = far.ty = p.y;
  far._combatAI(g);
  assert.equal(asked, 0, 'out of reach: not asked');
  far.x = far.tx = p.x + 2;
  far._combatAI(g);
  assert.equal(asked, 1, 'in reach: asked');
  assert.equal(far.target, null, 'and still too weak to take you on');
  far.def = { ...far.def, level: 999999 };
  far._combatAI(g);
  assert.equal(far.target, p, 'one strong enough comes for you');
});
