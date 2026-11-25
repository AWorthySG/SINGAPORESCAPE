// A* pathfinding on a tile grid. 8-directional movement with no corner-cutting,
// uniform step cost (diagonal == orthogonal), Chebyshev heuristic.

// The open list: a binary min-heap on f, kept in typed arrays reused by every
// search (a new node object for every tile pushed was most of a search's
// garbage, and searches run hundreds of times a tick). It sifts exactly as the
// object heap it replaced did, so tiles with equal f come off in the same
// order and every path is the same.
let HX = new Int32Array(4096), HY = new Int32Array(4096), HF = new Float64Array(4096), HN = 0;
let popX = 0, popY = 0;
// (Each sift carries the moving tile in hand and shifts the others past it,
// writing it once where it stops: the same places a swap at every step ends
// with, for a third of the writes.)
function hpush(x, y, f) {
  if (HN === HX.length) {
    const n = HN * 2, nx = new Int32Array(n), ny = new Int32Array(n), nf = new Float64Array(n);
    nx.set(HX); ny.set(HY); nf.set(HF);
    HX = nx; HY = ny; HF = nf;
  }
  let i = HN++;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (HF[p] <= f) break;
    HX[i] = HX[p]; HY[i] = HY[p]; HF[i] = HF[p];
    i = p;
  }
  HX[i] = x; HY[i] = y; HF[i] = f;
}
/** Take the smallest off the heap into popX / popY. */
function hpop() {
  popX = HX[0]; popY = HY[0];
  HN--;
  if (HN > 0) {
    const x = HX[HN], y = HY[HN], f = HF[HN];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let s = i, sf = f;
      if (l < HN && HF[l] < sf) { s = l; sf = HF[l]; }
      if (r < HN && HF[r] < sf) s = r;
      if (s === i) break;
      HX[i] = HX[s]; HY[i] = HY[s]; HF[i] = HF[s];
      i = s;
    }
    HX[i] = x; HY[i] = y; HF[i] = f;
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
 * @param {Uint8Array|null} [cfg.grid] the same walls as isBlocked, one byte a
 *   tile (1 = blocked, row by row), when there is such a grid: searched directly
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
  // The world's own walls: the same search, reading the grid straight off.
  const grid = cfg.grid;
  if (grid && grid.length === width * height && isTile(start, width, height) && Number.isInteger(goal.x) && Number.isInteger(goal.y)) {
    return gridPath(grid, width, height, start, goal, reachAdjacent, maxNodes);
  }

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

const DXS = Int8Array.from(DIRS, (d) => d[0]), DYS = Int8Array.from(DIRS, (d) => d[1]), OFF = new Int32Array(8);
const isTile = (t, w, h) => Number.isInteger(t.x) && Number.isInteger(t.y) && t.x >= 0 && t.y >= 0 && t.x < w && t.y < h;

/** findPath over a grid of walls (1 = blocked). Searches exactly as findPath
 *  does, tile for tile (the same neighbours in the same order, the same
 *  costs, the same heap), so it finds the very same path; it only reads each
 *  wall from the grid instead of asking isBlocked up to sixteen times a tile.
 *  Off the map counts as a wall, as World.isBlocked has it. Every search a
 *  crowd makes (chases, wandering, auto battle's route checks, quest trips)
 *  comes through here: on a phone the longest took tens of milliseconds. */
function gridPath(grid, width, height, start, goal, reachAdjacent, maxNodes) {
  const gx = goal.x, gy = goal.y;
  const sc = Math.max(Math.abs(start.x - gx), Math.abs(start.y - gy));
  if (reachAdjacent ? sc <= 1 : sc === 0) return [];
  if (!reachAdjacent && (gx < 0 || gy < 0 || gx >= width || gy >= height || grid[gy * width + gx] === 1)) return [];

  const { cameX, cameY, g, seen, closed } = scratch(width * height);
  const gen = GEN;
  HN = 0;
  if (HX.length > 65536) { HX = new Int32Array(4096); HY = new Int32Array(4096); HF = new Float64Array(4096); }
  const W = width, H = height;
  const si = start.y * W + start.x;
  seen[si] = gen; g[si] = 0; cameX[si] = -1; cameY[si] = -1;
  hpush(start.x, start.y, sc);

  let processed = 0;
  // Each side's and corner's step: dx, dy and the index offset, in DIRS' order.
  const off = OFF; off[0] = 1; off[1] = -1; off[2] = W; off[3] = -W; off[4] = W + 1; off[5] = -W + 1; off[6] = W - 1; off[7] = -W - 1;
  while (HN) {
    if (++processed > maxNodes) break;
    hpop();
    const cx = popX, cy = popY;
    const ci = cy * W + cx;
    if (closed[ci] === gen) continue;
    closed[ci] = gen;
    const dx = cx > gx ? cx - gx : gx - cx, dy = cy > gy ? cy - gy : gy - cy;
    if (reachAdjacent ? (dx <= 1 && dy <= 1) : (dx === 0 && dy === 0)) return reconstruct(cameX, cameY, W, start, { x: cx, y: cy });

    // The open ways out, a bit each: the four sides, then a corner only when
    // both sides beside it are open too (no corner cutting).
    let open = 0;
    if (cx + 1 < W && grid[ci + 1] !== 1) open |= 1;
    if (cx > 0 && grid[ci - 1] !== 1) open |= 2;
    if (cy + 1 < H && grid[ci + W] !== 1) open |= 4;
    if (cy > 0 && grid[ci - W] !== 1) open |= 8;
    if ((open & 5) === 5 && grid[ci + W + 1] !== 1) open |= 16;
    if ((open & 9) === 9 && grid[ci - W + 1] !== 1) open |= 32;
    if ((open & 6) === 6 && grid[ci + W - 1] !== 1) open |= 64;
    if ((open & 10) === 10 && grid[ci - W - 1] !== 1) open |= 128;
    const gn = g[ci] + 1;
    for (let k = 0; k < 8; k++) {
      if (!(open & (1 << k))) continue;
      const ni = ci + off[k];
      // (Only a tile already reached can be closed, so most never read `closed`.)
      if (seen[ni] === gen && (closed[ni] === gen || gn >= g[ni])) continue;
      const nx = cx + DXS[k], ny = cy + DYS[k];
      seen[ni] = gen; g[ni] = gn;
      cameX[ni] = cx; cameY[ni] = cy;
      const ex = nx > gx ? nx - gx : gx - nx, ey = ny > gy ? ny - gy : gy - ny;
      hpush(nx, ny, gn + (ex > ey ? ex : ey));
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
