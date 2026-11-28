import { getObject } from './objects.js';
import { NPCS } from './npcs.js';
import { findPath } from '../engine/pathfinding.js';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SOURCES = new Set(['tree', 'rock', 'fishing', 'hunt', 'dive', 'dig']);
const FACILITIES = new Set(['farm', 'agility', 'stall', 'range', 'furnace', 'anvil', 'craft', 'fletch', 'herblore', 'restore']);

export function gatheringSource(def) {
  return SOURCES.has(def?.type) || FACILITIES.has(def?.type);
}

// Skill and combat levels are separate. The combat floors below are authored
// tiers, before the bestiary stretches them into displayed monster levels.
export function gatheringFits(def, zone) {
  if (zone?.wilderness || zone?.instance) return false;
  if (!SOURCES.has(def.type)) return true;   // workshops, plots and courses have guarded grounds
  const lv = def.catches?.[0]?.level ?? def.level ?? 1;
  const lo = zone?.lo || 0;
  if (lo >= 290) return lv >= 100;
  if (lo >= 150) return lv >= 75;
  if (lo >= 60) return lv >= 40;
  if (lo >= 40) return lv >= 20;
  return true;
}

export function spawnReach(spawn) {
  const d = NPCS[spawn.npcId];
  if (!d?.attackable || !(spawn.opts?.aggressive ?? d.aggressive)) return 0;
  return (spawn.wander || d.wander || 0) + Math.max(d.aggroRange || 4, d.boss ? 8 : 0) + 1;
}

function addSquare(sum, w, h, x, y, r) {
  const row = w + 1;
  const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
  sum[y0 * row + x0]++; sum[y0 * row + x1]--;
  sum[y1 * row + x0]--; sum[y1 * row + x1]++;
}

function spawnDanger(w, h, spawns) {
  const row = w + 1, sum = new Int32Array(row * (h + 1)), cols = new Int32Array(row);
  for (const s of spawns) {
    const r = spawnReach(s);
    if (r) addSquare(sum, w, h, s.x, s.y, r);
  }
  const danger = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let line = 0;
    for (let x = 0; x < w; x++) {
      cols[x] += sum[y * row + x];
      line += cols[x];
      danger[y * w + x] = line > 0;
    }
  }
  return danger;
}

function reachableFrom(w, h, origins, canWalk) {
  const seen = new Uint16Array(w * h), queue = new Int32Array(w * h);
  let read = 0, write = 0, group = 0;
  const visit = (i) => { if (!seen[i] && canWalk(i)) { seen[i] = group; queue[write++] = i; } };
  for (const { x, y } of origins) {
    const first = y * w + x;
    if (seen[first] || !canWalk(first)) continue;
    group++;
    visit(first);
    while (read < write) {
      const i = queue[read++], x = i % w;
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (i >= w) visit(i - w);
      if (i < (h - 1) * w) visit(i + w);
    }
  }
  return seen;
}

function protectedIntegral(tiles, w, h) {
  const row = w + 1, total = new Int32Array(row * (h + 1));
  for (let y = 0; y < h; y++) {
    let line = 0;
    for (let x = 0; x < w; x++) {
      line += tiles[y * w + x];
      total[(y + 1) * row + x + 1] = total[y * row + x + 1] + line;
    }
  }
  return (x, y, r) => {
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
    return total[y1 * row + x1] - total[y1 * row + x0] - total[y0 * row + x1] + total[y0 * row + x0] > 0;
  };
}

function assignEncounters(spawns, canSpawn, protectedTiles, zoneAt, occupied, w) {
  for (const s of spawns) {
    const reach = spawnReach(s);
    if (!reach || !protectedTiles(s.x, s.y, reach)) continue;
    const zone = zoneAt(s.x, s.y);
    let dest = null;
    if (!NPCS[s.npcId].fixed) {
      for (let r = 1; r <= 48 && !dest; r++) {
        for (let dy = -r; dy <= r && !dest; dy++) for (let dx = -r; dx <= r && !dest; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = s.x + dx, y = s.y + dy;
          if (canSpawn(x, y) && !occupied.has(y * w + x) && zoneAt(x, y) === zone && !protectedTiles(x, y, reach)) dest = { x, y };
        }
      }
    }
    if (dest) {
      occupied.add(dest.y * w + dest.x);
      Object.assign(s, dest);
    } else {
      // Some story encounters must stay at an authored tile. At a worksite
      // they remain available to fight when approached by choice.
      s.opts = { ...s.opts, aggressive: false };
    }
  }
}

function trainingZones(zones, w, h) {
  const byTile = new Int16Array(w * h).fill(-1);
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    for (let y = z.y0; y <= z.y1; y++) byTile.fill(i, y * w + z.x0, y * w + z.x1 + 1);
  }
  return byTile;
}

const inArea = (o, a) => o.x >= a.x0 && o.x <= a.x1 && o.y >= a.y0 && o.y <= a.y1;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const CELL = 16;

function worksiteGroups(objects, workAreas, zoneAt, terrain, idx, water) {
  const groups = new Map();
  for (const o of objects) {
    const d = getObject(o.objId);
    if (!gatheringSource(d) || !gatheringFits(d, zoneAt(o.x, o.y))) continue;
    const area = workAreas.find((a) => (a.objId ? a.objId === o.objId : a.skill === d.skill) && inArea(o, a));
    const wetTree = d.waterRoots && terrain[idx(o.x, o.y)] === water;
    // Keep farms and courses together. A strip of shoreline with wet-rooted
    // trees or a single dive or dig site has a shared approach as well.
    const anchored = FACILITIES.has(d.type) || d.type === 'dive' || d.type === 'dig';
    if (!area && !wetTree && !anchored) continue;
    const k = area?.id || `${d.type}:${o.x / CELL | 0}:${o.y / CELL | 0}`;
    const group = groups.get(k) || [];
    group.push(o);
    groups.set(k, group);
  }
  return groups;
}

function guardWorksites(groups, stations, landings, cfg, land) {
  const { width: w, height: h } = cfg;
  const origins = [...stations, ...landings];
  const guard = new Uint8Array(w * h);
  const paint = (x0, y0, x1, y1) => {
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
      guard.fill(1, y * w + Math.max(0, x0), y * w + Math.min(w, x1 + 1));
    }
  };
  for (const { x, y } of origins) paint(x, y, x, y);
  const areaAt = (x, y) => x >= 0 && x < w && y >= 0 && y < h ? land[y * w + x] : 0;
  const connect = (to, near, starts, reachAdjacent, maxNodes) => {
    const areas = new Set();
    const r = reachAdjacent ? 1 : 0;
    for (let y = to.y - r; y <= to.y + r; y++) for (let x = to.x - r; x <= to.x + r; x++) {
      const id = areaAt(x, y);
      if (id) areas.add(id);
    }
    const available = starts.filter((p) => areas.has(areaAt(p.x, p.y)));
    for (const from of available.toSorted((a, b) => distance(a, near) - distance(b, near))) {
      if (Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) <= (reachAdjacent ? 1 : 0)) return true;
      const path = findPath(cfg, from, to, { reachAdjacent, maxNodes });
      if (!path.length) continue;
      // Cover the shoulders of diagonal steps too, so a straight walk round
      // a corner remains possible with the monsters outside the route.
      for (const { x, y } of path) paint(x - 1, y - 1, x + 1, y + 1);
      return true;
    }
    return false;
  };
  for (const landing of landings) {
    if (!connect(landing, landing, stations, false, 4800)) {
      connect(landing, landing, landings.filter((p) => p !== landing), false, 4800);
    }
  }
  for (const group of groups.values()) {
    const x0 = Math.min(...group.map((o) => o.x)), x1 = Math.max(...group.map((o) => o.x));
    const y0 = Math.min(...group.map((o) => o.y)), y1 = Math.max(...group.map((o) => o.y));
    paint(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    // Connect the worksite to the nearest station or landing on its own land.
    const center = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    connect(group[0], center, origins, true, 4800);
  }
  return guard;
}

function placementPools(w, h, terrain, T, zoneIds, reach, menace, reserved, guard, sea) {
  const cellCount = Math.ceil(w / CELL), cells = [new Map(), new Map(), new Map(), new Map()];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, t = terrain[i];
    if (menace[i] || reserved[i] || guard[i]) continue;
    const wet = t === T.WATER;
    if (!wet && (t === T.PATH || t === T.WOOD || !reach[i])) continue;
    if (!SIDES.some(([a, b]) => reach[(y + b) * w + x + a])) continue;
    const k = (y / CELL | 0) * cellCount + (x / CELL | 0);
    const col = wet ? (sea[i] ? 3 : 2) : t === T.STONE || t === T.SAND ? 1 : 0, byCell = cells[col];
    // Some cells straddle a district boundary. Keep their tiles by level band.
    const tag = k * 64 + zoneIds[i] + 1;
    let c = byCell.get(tag);
    if (!c) byCell.set(tag, (c = { zone: zoneIds[i], x: (x / CELL | 0) * CELL + CELL / 2, y: (y / CELL | 0) * CELL + CELL / 2, tiles: [] }));
    c.tiles.push({ x, y });
  }
  return cells.map((m) => [...m.values()]);
}

function findGround(o, def, desired, pools, zones, canUse, fromZone) {
  // Rock outcrops prefer stony ground and trees prefer soil. A different
  // material in the same district is preferable to moving across the island.
  let dest = null, bestScore = Infinity;
  for (const layer of [desired, desired < 2 ? 1 - desired : 5 - desired]) {
    for (const cell of pools[layer]) {
      if (!cell.tiles.length || !gatheringFits(def, zones[cell.zone])) continue;
      const surcharge = (layer === desired ? 0 : desired >= 2 ? 55 : 18) + (zones[cell.zone] === fromZone ? 0 : 12);
      if (Math.max(0, distance(o, cell) - CELL) + surcharge >= bestScore) continue;
      for (const p of cell.tiles) {
        const score = distance(o, p) + surcharge;
        if (score < bestScore && canUse(p)) { bestScore = score; dest = p; }
      }
    }
  }
  return dest;
}

// Blocking one tile must leave its banks and tracks joined. Its four exits
// must be linked by the eight tiles around it so earlier trips stay usable.
function keepsLane(x, y, w, walk) {
  const i = y * w + x;
  const ring = [i - w, i - w + 1, i + 1, i + w + 1, i + w, i + w - 1, i - 1, i - w - 1];
  const gap = ring.findIndex((p) => !walk(p));
  if (gap < 0) return true;
  let groups = 0, connects = false;
  for (let j = 1; j <= ring.length; j++) {
    const k = (gap + j) % ring.length;
    if (!walk(ring[k])) connects = false;
    else if (!(k % 2) && !connects) { groups++; connects = true; }
  }
  return groups <= 1;
}

/** Put permanent gathering in terrain it fits, with a dry approach outside
 *  attack reach. The seeded geography and world rules supply the terrain and
 *  encounters so this can run after the bridges and ferry landings are final. */
export function arrangeGathering({ terrain, w, h, T, objects, zones, groves, resourceZones, spawns, origins, landings, positions }) {
  const { blocked, reserved } = positions;
  const idx = (x, y) => y * w + x, zoneIds = trainingZones(zones, w, h);
  const zoneAt = (x, y) => zones[zoneIds[idx(x, y)]];
  const inBounds = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1;
  const canWalk = (i) => !blocked[i] && terrain[i] !== T.WATER && !zones[zoneIds[i]]?.wilderness;
  const cfg = { width: w, height: h, isBlocked: (x, y) => !canWalk(idx(x, y)) };
  const groups = worksiteGroups(objects, [...groves, ...resourceZones], zoneAt, terrain, idx, T.WATER);
  const open = (p) => canWalk(idx(p.x, p.y));
  const stations = origins.filter(open), docks = landings.filter(open);
  const land = reachableFrom(w, h, [...stations, ...docks], canWalk);
  const guard = guardWorksites(groups, stations, docks, cfg, land);
  const occupied = new Set(spawns.map((s) => idx(s.x, s.y)));
  const spawnable = (x, y) => inBounds(x, y) && !reserved[idx(x, y)] && terrain[idx(x, y)] !== T.WATER;
  assignEncounters(spawns, spawnable, protectedIntegral(guard, w, h), zoneAt, occupied, w);

  const menace = spawnDanger(w, h, spawns);
  const walk = (i) => canWalk(i) && !menace[i];
  const reach = reachableFrom(w, h, [...stations, ...docks], walk);
  const edge = Array.from({ length: w }, (_, x) => ({ x, y: 0 }));
  const sea = reachableFrom(w, h, edge, (i) => terrain[i] === T.WATER);
  const pools = placementPools(w, h, terrain, T, zoneIds, reach, menace, reserved, guard, sea);
  const stand = new Uint8Array(w * h);
  const standingTiles = (x, y) => SIDES.map(([a, b]) => idx(x + a, y + b)).filter((i) => reach[i] && walk(i));
  const roomNeeded = (d) => d.type === 'rock' ? 2 : 1;
  const keep = new Set();
  for (const o of objects) {
    const d = getObject(o.objId);
    if (!gatheringSource(d) || menace[idx(o.x, o.y)] || !gatheringFits(d, zoneAt(o.x, o.y))) continue;
    const steps = standingTiles(o.x, o.y), room = roomNeeded(d);
    if (steps.length < room) continue;
    for (let n = 0; n < room; n++) stand[steps[n]] = 1;
    keep.add(o);
  }

  const scenery = [], spawn = origins[0];
  for (const o of objects) {
    const d = getObject(o.objId);
    if (!gatheringSource(d) || keep.has(o)) continue;
    const fromZone = zoneAt(o.x, o.y), i = idx(o.x, o.y);
    const wet = terrain[i] === T.WATER;
    const lv = d.catches?.[0]?.level ?? d.level ?? 1;
    const canUse = (p) => {
      const at = idx(p.x, p.y);
      if (reserved[at] || occupied.has(at) || standingTiles(p.x, p.y).length < roomNeeded(d)) return false;
      if (lv > 25 && distance(spawn, p) < 30) return false;
      return wet || !d.blocking || (!stand[at] && keepsLane(p.x, p.y, w, walk));
    };
    const desired = wet ? (sea[i] ? 3 : 2) : d.type === 'rock' ? 1 : 0;
    const dest = findGround(o, d, desired, pools, zones, canUse, fromZone);
    if (!dest) continue;
    if (d.type === 'tree' && !wet) scenery.push({ objId: 'forest_tree', x: o.x, y: o.y, art: `tree-${o.objId}` });
    else blocked[i] = 0;
    const at = idx(dest.x, dest.y);
    // Keep the source tile reserved through this pass. A moved node may have
    // a sign, landmark or earlier route check tied to the ground beside it.
    reserved[at] = 1;
    if (d.blocking) blocked[at] = 1;
    const steps = standingTiles(dest.x, dest.y);
    for (let n = 0; n < roomNeeded(d); n++) stand[steps[n]] = 1;
    o.gatheringOrigin ||= { x: o.x, y: o.y };
    Object.assign(o, dest);
  }
  objects.push(...scenery);
}
