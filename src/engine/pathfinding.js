// A* pathfinding on a tile grid. 8-directional movement with no corner-cutting,
// uniform step cost (diagonal == orthogonal), Chebyshev heuristic.

// The open list: a binary min-heap on f, kept in typed arrays reused by every
// search (a new node object for every tile pushed was most of a search's
// garbage, and searches run hundreds of times a tick). It sifts exactly as the
// object heap it replaced did, so tiles with equal f come off in the same
// order and every path is the same.
let HX = new Int32Array(4096), HY = new Int32Array(4096), HF = new Float64Array(4096), HN = 0;
let popX = 0, popY = 0;
function hswap(a, b) {
  const x = HX[a], y = HY[a], f = HF[a];
  HX[a] = HX[b]; HY[a] = HY[b]; HF[a] = HF[b];
  HX[b] = x; HY[b] = y; HF[b] = f;
}
function hpush(x, y, f) {
  if (HN === HX.length) {
    const n = HN * 2, nx = new Int32Array(n), ny = new Int32Array(n), nf = new Float64Array(n);
    nx.set(HX); ny.set(HY); nf.set(HF);
    HX = nx; HY = ny; HF = nf;
  }
  let i = HN++;
  HX[i] = x; HY[i] = y; HF[i] = f;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (HF[p] <= HF[i]) break;
    hswap(p, i);
    i = p;
  }
}
/** Take the smallest off the heap into popX / popY. */
function hpop() {
  popX = HX[0]; popY = HY[0];
  HN--;
  if (HN > 0) {
    HX[0] = HX[HN]; HY[0] = HY[HN]; HF[0] = HF[HN];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let s = i;
      if (l < HN && HF[l] < HF[s]) s = l;
      if (r < HN && HF[r] < HF[s]) s = r;
      if (s === i) break;
      hswap(s, i);
      i = s;
    }
  }
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

// Search scratch space, reused by every call. Allocating (and filling) four
// map-sized arrays per search cost ~0.3ms even for a three-tile walk, and the
// game runs hundreds of searches a tick; instead each search gets a new
// generation number, and a tile's entries only count when its stamp matches.
let BUF = null, GEN = 0;
function scratch(n) {
  if (!BUF || BUF.size !== n) {
    BUF = { size: n, cameX: new Int32Array(n), cameY: new Int32Array(n), g: new Float64Array(n), seen: new Uint32Array(n), closed: new Uint32Array(n) };
    GEN = 0;
  }
  if (++GEN >= 0xfffffff0) { BUF.seen.fill(0); BUF.closed.fill(0); GEN = 1; }
  return BUF;
}

/**
 * @param {object} cfg
 * @param {number} cfg.width
 * @param {number} cfg.height
 * @param {(x:number,y:number)=>boolean} cfg.isBlocked
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} goal
 * @param {object} [opts]
 * @param {boolean} [opts.reachAdjacent] stop when adjacent to goal (for blocked targets)
 * @param {number} [opts.maxNodes]
 * @returns {{x:number,y:number}[]} steps after `start` ending at the reached tile ([] if none / already there)
 */
export function findPath(cfg, start, goal, opts = {}) {
  const { width, height, isBlocked } = cfg;
  const reachAdjacent = !!opts.reachAdjacent;
  const maxNodes = opts.maxNodes ?? 20000;

  const inB = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
  const idx = (x, y) => y * width + x;
  const cheb = (x, y) => Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y));
  const isGoal = reachAdjacent ? (x, y) => cheb(x, y) <= 1 : (x, y) => x === goal.x && y === goal.y;

  if (isGoal(start.x, start.y)) return [];
  if (!reachAdjacent && (!inB(goal.x, goal.y) || isBlocked(goal.x, goal.y))) return [];

  const { cameX, cameY, g, seen, closed } = scratch(width * height);
  const gen = GEN;
  const gOf = (i) => (seen[i] === gen ? g[i] : Infinity);
  HN = 0;   // (the open list, see hpush; one grown huge by a map-wide search is let go)
  if (HX.length > 65536) { HX = new Int32Array(4096); HY = new Int32Array(4096); HF = new Float64Array(4096); }

  const si = idx(start.x, start.y);
  seen[si] = gen; g[si] = 0; cameX[si] = -1; cameY[si] = -1;
  hpush(start.x, start.y, cheb(start.x, start.y));

  let processed = 0;
  while (HN) {
    if (++processed > maxNodes) break;
    hpop();
    const cx = popX, cy = popY;
    const ci = idx(cx, cy);
    if (closed[ci] === gen) continue;
    closed[ci] = gen;

    if (isGoal(cx, cy)) return reconstruct(cameX, cameY, width, start, { x: cx, y: cy });

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inB(nx, ny) || isBlocked(nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        // No corner cutting through blocked orthogonal neighbours.
        if (isBlocked(cx + dx, cy) || isBlocked(cx, cy + dy)) continue;
      }
      const ni = idx(nx, ny);
      if (closed[ni] === gen) continue;
      const tentative = g[ci] + 1;
      if (tentative < gOf(ni)) {
        seen[ni] = gen; g[ni] = tentative;
        cameX[ni] = cx; cameY[ni] = cy;
        hpush(nx, ny, tentative + cheb(nx, ny));
      }
    }
  }
  return [];
}

function reconstruct(cameX, cameY, width, start, end) {
  const path = [];
  let x = end.x, y = end.y;
  while (!(x === start.x && y === start.y)) {
    path.push({ x, y });
    const i = y * width + x;
    const px = cameX[i], py = cameY[i];
    if (px < 0) break;
    x = px; y = py;
  }
  path.reverse();
  return path;
}
