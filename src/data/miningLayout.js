import { LANDINGS, LOOMS, STAGES } from './islandlife.js';
import { getObject } from './objects.js';
import { TERRAIN } from './world.js';
import { PORTS } from './worldlayout.js';

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const OFFSETS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const NEARBY = [[0, 0], ...OFFSETS];
const within = (x, y, b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

// Use positions relative to each site so its pattern matches in both layouts.
function orderAt(x, y, salt) {
  let n = Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca6b) ^ salt;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return (n ^ (n >>> 15)) >>> 0;
}

/** Loosen the generated mining sites after the roads, structures and other
 * resources have their final positions. Work within their existing footprint. */
export function arrangeMining(data, authoredTile = (x, y) => ({ x, y })) {
  const { width, height, terrain } = data;
  const index = (x, y) => y * width + x;
  const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
  const tile = (x, y) => inBounds(x, y) ? terrain[index(x, y)] : TERRAIN.WATER;
  const reserved = new Uint8Array(terrain.length);
  const blocked = new Uint8Array(terrain.length);
  const rocks = new Map();
  const reserve = (x, y, wall = false) => {
    if (!inBounds(x, y)) return;
    reserved[index(x, y)] = 1;
    if (wall) blocked[index(x, y)] = 1;
  };
  for (const o of data.objects) {
    const def = getObject(o.objId);
    const [wide, deep] = def.footprint || [1, 1];
    for (let dy = 0; dy < deep; dy++) for (let dx = 0; dx < wide; dx++) {
      reserve(o.x + dx, o.y - dy, def.blocking || !!def.footprint);
    }
    if (def.type === 'rock') rocks.set(index(o.x, o.y), o);
  }
  for (const { x, y } of data.npcSpawns) reserve(x, y);
  for (const { x, y } of [data.spawnPoint, data.respawnPoint]) reserve(x, y);
  // Keep port sites available in both layouts for the same rock arrangement.
  // The geographic map can also choose nearby fallbacks for its actual ferries.
  for (const [, [x, y]] of Object.values(PORTS)) {
    const site = authoredTile(x, y);
    reserve(site.x, site.y);
  }
  for (const { x, y } of [...Object.values(LANDINGS), ...LOOMS, ...STAGES]) {
    const site = authoredTile(x, y);
    reserve(site.x, site.y);
  }
  for (const { from, to } of data.ferryLinks || []) {
    reserve(from.x, from.y);
    reserve(to.x, to.y);
  }

  const open = (x, y) => tile(x, y) !== TERRAIN.WATER && !blocked[index(x, y)];
  const sides = (x, y) => SIDES.filter(([dx, dy]) => open(x + dx, y + dy)).length;
  const zoneAt = (x, y) => data.zones.find((z) => within(x, y, z));

  // Before putting a rock on a walkable tile, require a short detour between
  // all of its formerly open neighbours. Any route through it can then still
  // pass by, including the route around the outside of the site.
  function canWalkAround(x, y, neighbours) {
    const [first] = neighbours;
    const queue = [first];
    const seen = new Set([index(...first)]);
    while (queue.length) {
      const [px, py] = queue.pop();
      for (const [dx, dy] of SIDES) {
        const nx = px + dx, ny = py + dy, k = index(nx, ny);
        if (Math.max(Math.abs(nx - x), Math.abs(ny - y)) > 3 || seen.has(k) || !open(nx, ny)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
      if (neighbours.every(([nx, ny]) => seen.has(index(nx, ny)))) return true;
    }
    return false;
  }

  function move(rock, x, y, bounds, sandOnly = false) {
    if (rock.miningOrigin || !within(x, y, bounds) || !inBounds(x, y)) return false;
    const dest = index(x, y), src = index(rock.x, rock.y);
    const ground = tile(x, y);
    if (reserved[dest] || blocked[dest] || ground === TERRAIN.WATER || (sandOnly && ground !== TERRAIN.SAND)
      || zoneAt(rock.x, rock.y) !== zoneAt(x, y)) return false;
    for (const [dx, dy] of NEARBY) {
      const t = tile(x + dx, y + dy);
      if (t === TERRAIN.PATH || t === TERRAIN.WOOD || t === TERRAIN.WATER) return false;
    }
    const neighbours = SIDES.map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => open(nx, ny));
    const otherRocks = SIDES.map(([dx, dy]) => rocks.get(index(x + dx, y + dy)))
      .filter((other) => other && other !== rock)
      .map((other) => [other, Math.min(2, sides(other.x, other.y))]);
    blocked[src] = 0;
    blocked[dest] = 1;
    if (sides(x, y) < 2 || !canWalkAround(x, y, neighbours)
      || otherRocks.some(([other, minimum]) => sides(other.x, other.y) < minimum)) {
      blocked[src] = 1;
      blocked[dest] = 0;
      return false;
    }
    // An original tile remains reserved for saves that still refer to it.
    reserved[dest] = 1;
    rocks.delete(src);
    rocks.set(dest, rock);
    rock.miningOrigin = { x: rock.x, y: rock.y };
    Object.assign(rock, { x, y });
    return true;
  }

  const sites = [
    ...data.groves.filter((s) => s.kind === 'quarry'),
    ...data.resourceZones.filter((s) => s.skill === 'mining'),
  ];
  for (const [i, site] of sites.entries()) {
    const nodes = [...rocks.values()].filter((r) => within(r.x, r.y, site) && (!site.objId || site.objId === r.objId))
      .map((r) => ({ rock: r, order: orderAt(r.x - site.x0, r.y - site.y0, i) }))
      .sort((a, b) => a.order - b.order);
    let remaining = Math.ceil(nodes.length * 0.58);
    for (const { rock, order } of nodes) {
      for (let j = 0; j < OFFSETS.length; j++) {
        const [dx, dy] = OFFSETS[(order + j * 3) % OFFSETS.length];
        if (move(rock, rock.x + dx, rock.y + dy, site)) { remaining--; break; }
      }
      if (!remaining) break;
    }
  }

  // The original Bukit Timah pit rolled several rocks with no comfortable
  // standing space. Open approaches without touching the path or dig site.
  const [lo, hi] = [authoredTile(66, 9), authoredTile(85, 24)];
  const pit = { x0: lo.x, y0: lo.y, x1: hi.x, y1: hi.y };
  for (const rock of [...rocks.values()]) {
    if (!within(rock.x, rock.y, pit)) continue;
    for (const [dx, dy] of SIDES) {
      if (sides(rock.x, rock.y) >= 2) break;
      const neighbour = rocks.get(index(rock.x + dx, rock.y + dy));
      if (!neighbour) continue;
      for (const [sx, sy] of OFFSETS) {
        const x = neighbour.x + sx, y = neighbour.y + sy;
        if (Math.abs(x - rock.x) + Math.abs(y - rock.y) > 1 && move(neighbour, x, y, pit, true)) break;
      }
    }
  }
  return data;
}
