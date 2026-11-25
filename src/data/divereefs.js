// Where Diving's reefs go (world.js calls placeDiveSpots once, after the
// groves and quarries). One reef of DIVE_REEF_SIZE spots per kind, on shore
// water in its region: water with open land beside it that you can walk to
// from Kampong Glam, so every spot can be dived from the shore. Its own random
// stream, and only water tiles are taken, so nothing placed before moves.
import { OBJECTS } from './objects.js';
import { DIVE_SPOTS, DIVE_REEF_SIZE } from './diving.js';

/**
 * ctx: world.js's { T, width, height, get, inB, isFree, placeObj, inTown, objects, start, rand }.
 */
export function placeDiveSpots({ T, width: W, height: H, get, inB, isFree, placeObj, inTown, objects, start, rand }) {
  // The land you can walk to from the start (water and blocking objects are walls).
  const blocked = new Uint8Array(W * H), reach = new Uint8Array(W * H);
  for (const o of objects) if (OBJECTS[o.objId]?.blocking && inB(o.x, o.y)) blocked[o.y * W + o.x] = 1;
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
  const stations = objects.filter((o) => o.objId === 'mrt_station');
  const byStation = (x, y) => stations.some((o) => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) < 8);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const stand = (x, y) => inB(x, y) && reach[y * W + x] === 1 && isFree(x, y) && !inTown(x, y);
  const shore = (x, y) => inB(x, y) && get(x, y) === T.WATER && isFree(x, y) && !byStation(x, y)
    && N4.some(([dx, dy]) => stand(x + dx, y + dy));
  for (const s of DIVE_SPOTS) {
    const [x0, y0, x1, y1] = s.rect, all = [];
    for (let y = y0 + 2; y <= y1 - 2; y++) for (let x = x0 + 2; x <= x1 - 2; x++) if (shore(x, y)) all.push([x, y]);
    for (let tries = 0; tries < 200 && all.length; tries++) {
      const [cx, cy] = all[Math.floor(rand() * all.length)];
      const near = all.filter(([x, y]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 6);
      if (near.length < DIVE_REEF_SIZE * 2) continue;   // too short a shore: look elsewhere
      let placed = 0;
      while (placed < DIVE_REEF_SIZE && near.length) {
        const [x, y] = near.splice(Math.floor(rand() * near.length), 1)[0];
        if (shore(x, y) && placeObj(s.id, x, y)) placed++;
      }
      break;
    }
  }
}
