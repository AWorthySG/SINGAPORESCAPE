// Where Archaeology's dig sites go, and the museum (world.js calls placeDigSites
// once, after the groves and quarries). One site of DIG_SITE_SIZE dig spots per
// kind, close together on open ground in its region that you can walk to from
// Kampong Glam, each with a free tile beside it to stand on; then the museum
// curator and a restoration bench in Chinatown. Its own random stream, and only
// free tiles are taken, so nothing placed before moves.
import { OBJECTS } from './objects.js';
import { DIG_SITES, DIG_SITE_SIZE } from './archaeology.js';

// Where the museum stands: the curator by Chinatown's south side, the bench beside them.
export const MUSEUM_AT = { x: 84, y: 64 };

/**
 * ctx: world.js's { T, width, height, get, inB, isFree, placeObj, placeNpc, inTown, inNewTown, objects, npcSpawns, start, rand }.
 */
export function placeDigSites({ T, width: W, height: H, get, inB, isFree, placeObj, placeNpc, inTown, inNewTown, objects, npcSpawns, start, rand }) {
  const blocked = new Uint8Array(W * H), reach = new Uint8Array(W * H);
  const mark = () => { blocked.fill(0); for (const o of objects) if (OBJECTS[o.objId]?.blocking && inB(o.x, o.y)) blocked[o.y * W + o.x] = 1; };
  mark();
  const q = [start.y * W + start.x];
  reach[q[0]] = 1;
  while (q.length) {
    const k = q.pop(), x = k % W, y = (k - x) / W;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (reach[nk] || blocked[nk] || get(nx, ny) === T.WATER) continue;
      reach[nk] = 1; q.push(nk);
    }
  }
  const npcAt = new Set(npcSpawns.map((s) => s.y * W + s.x));
  const GROUND = [T.GRASS, T.DARKGRASS, T.SAND, T.STONE];
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const walk = (x, y) => inB(x, y) && reach[y * W + x] === 1 && isFree(x, y) && !npcAt.has(y * W + x);
  const open = (x, y) => walk(x, y) && GROUND.includes(get(x, y)) && !inTown(x, y) && !inNewTown(x, y)
    && N4.filter(([dx, dy]) => walk(x + dx, y + dy)).length >= 2;
  for (const s of DIG_SITES) {
    const [x0, y0, x1, y1] = s.rect, all = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (open(x, y)) all.push([x, y]);
    for (let tries = 0; tries < 300 && all.length; tries++) {
      const [cx, cy] = all[Math.floor(rand() * all.length)];
      const near = all.filter(([x, y]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 4);
      if (near.length < DIG_SITE_SIZE * 3) continue;   // too cramped: look elsewhere
      let placed = 0;
      while (placed < DIG_SITE_SIZE && near.length) {
        const [x, y] = near.splice(Math.floor(rand() * near.length), 1)[0];
        if (open(x, y) && placeObj(s.id, x, y)) placed++;
      }
      break;
    }
  }
  // The museum: the curator on the nearest free tile to MUSEUM_AT, the bench beside them.
  let best = null;
  for (let r = 0; r < 8 && !best; r++) {
    for (let y = MUSEUM_AT.y - r; y <= MUSEUM_AT.y + r && !best; y++) for (let x = MUSEUM_AT.x - r; x <= MUSEUM_AT.x + r && !best; x++) {
      if (!walk(x, y) || get(x, y) === T.WATER) continue;
      const bench = N4.map(([dx, dy]) => [x + dx, y + dy]).find(([bx, by]) => walk(bx, by) && get(bx, by) !== T.WATER
        && N4.filter(([dx, dy]) => walk(bx + dx, by + dy) && (bx + dx !== x || by + dy !== y)).length >= 2);
      if (bench) best = { x, y, bench };
    }
  }
  if (best) {
    placeNpc('museum_curator', best.x, best.y, 0);
    placeObj('restoration_bench', best.bench[0], best.bench[1]);
  }
}
