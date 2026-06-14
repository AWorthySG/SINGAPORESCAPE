// A* pathfinding on a tile grid. 8-directional movement with no corner-cutting,
// uniform step cost (diagonal == orthogonal), Chebyshev heuristic.

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(node) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < a.length && a[l].f < a[s].f) s = l;
        if (r < a.length && a[r].f < a[s].f) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

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

  const cameX = new Int32Array(width * height).fill(-1);
  const cameY = new Int32Array(width * height).fill(-1);
  const gScore = new Float64Array(width * height).fill(Infinity);
  const closed = new Uint8Array(width * height);
  const open = new MinHeap();

  gScore[idx(start.x, start.y)] = 0;
  open.push({ x: start.x, y: start.y, f: cheb(start.x, start.y) });

  let processed = 0;
  while (open.size) {
    if (++processed > maxNodes) break;
    const cur = open.pop();
    const ci = idx(cur.x, cur.y);
    if (closed[ci]) continue;
    closed[ci] = 1;

    if (isGoal(cur.x, cur.y)) return reconstruct(cameX, cameY, width, start, cur);

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inB(nx, ny) || isBlocked(nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        // No corner cutting through blocked orthogonal neighbours.
        if (isBlocked(cur.x + dx, cur.y) || isBlocked(cur.x, cur.y + dy)) continue;
      }
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const tentative = gScore[ci] + 1;
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative;
        cameX[ni] = cur.x; cameY[ni] = cur.y;
        open.push({ x: nx, y: ny, f: tentative + cheb(nx, ny) });
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
