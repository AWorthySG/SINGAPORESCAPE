// North-up district placement. Each parcel translates its seeded neighbourhood
// whole, so a local tile keeps its neighbours, objects and saved meaning.
import { findPath } from '../engine/pathfinding.js';
import { GEOGRAPHIC_PLACE_BY_ID } from './geography.js';
import { LANDINGS, LOOMS, STAGES } from './islandlife.js';
import { getObject } from './objects.js';
import { STATIONS } from './transport.js';
import { TERRAIN } from './world.js';

export const LEGACY_WIDTH = 540, LEGACY_HEIGHT = 380;
export const GEOGRAPHIC_WIDTH = 1032, GEOGRAPHIC_HEIGHT = 680;

// Bounds in the original terrain, then the new upper-left tile. The north
// coast runs from Sungei Buloh through Kranji to Punggol, with the central
// catchment below it and the inhabited islands out in the straits.
const DISTRICTS = {
  bukit_timah: [[0, 0, 94, 43], [245, 262]],
  macritchie: [[0, 44, 43, 82], [448, 249]],
  kampong_glam: [[44, 44, 72, 82], [485, 315]],
  chinatown: [[73, 44, 94, 82], [488, 379]],
  sentosa: [[0, 83, 94, 112], [390, 434]],
  wilderness: [[95, 0, 119, 112], [121, 450]],
  pulau_hantu: [[120, 0, 158, 112], [216, 480]],
  sungei_buloh: [[0, 113, 74, 203], [208, 42]],
  jurong: [[75, 113, 158, 203], [159, 236]],
  pulau_ubin: [[159, 0, 229, 99], [870, 58]],
  marina_bay: [[159, 100, 229, 203], [516, 355]],
  changi: [[230, 0, 299, 99], [881, 229]],
  pulau_tekong: [[230, 100, 299, 203], [947, 112]],
  gardens: [[300, 0, 399, 99], [597, 376]],
  coney: [[300, 100, 399, 203], [751, 94]],
  // Transit is a separate parcel cut from its former Kranji envelope.
  transit_road: [[431, 149, 458, 168], [469, 109]],
  punggol: [[400, 0, 539, 89], [600, 90]],
  kranji: [[400, 90, 539, 179], [298, 42]],
  mandai: [[400, 180, 539, 279], [374, 143]],
  kusu_island: [[18, 216, 66, 249], [619, 526]],
  pulau_semakau: [[37, 250, 78, 279], [302, 554]],
  southern_islands: [[67, 218, 126, 279], [551, 529]],
  lazarus_island: [[127, 204, 180, 245], [615, 482]],
  sisters_islands: [[127, 246, 188, 279], [481, 581]],
  southern_shore: [[181, 204, 199, 279], [676, 490]],
  southern_water: [[0, 204, 199, 279], [10, 570]],
  rift_outpost: [[200, 204, 399, 279], [725, 529]],
  tuas: [[0, 280, 179, 379], [10, 340]],
  temasek: [[180, 280, 359, 379], [303, 310]],
  celestial_peaks: [[360, 280, 539, 379], [14, 127]],
};

const ZONE_PARCELS = {
  'Pulau Hantu': 'pulau_hantu', 'The Wilderness': 'wilderness', 'Kampong Glam': 'kampong_glam',
  Chinatown: 'chinatown', 'MacRitchie Reservoir': 'macritchie', 'Sentosa Beach': 'sentosa', 'Bukit Timah': 'bukit_timah',
  'Sungei Buloh Wetlands': 'sungei_buloh', 'Jurong Forest': 'jurong', 'Pulau Ubin': 'pulau_ubin', 'Changi Coast': 'changi',
  'Marina Bay': 'marina_bay', 'Tekong Badlands': 'pulau_tekong', 'Gardens by the Bay': 'gardens', 'Coney Island': 'coney',
  'The Shadow Rift': 'rift_outpost', 'Punggol Waterway': 'punggol', 'Transit Road, Nee Soon Camp': 'transit_road',
  'Kranji Farmlands': 'kranji', 'Mandai Rainforest': 'mandai', 'Tuas Docklands': 'tuas',
  'Temasek Ruins': 'temasek', 'The Celestial Peaks': 'celestial_peaks',
};

let forward, inverse;
function tileIndex() {
  if (forward) return;
  forward = new Int32Array(LEGACY_WIDTH * LEGACY_HEIGHT).fill(-1);
  inverse = new Int32Array(GEOGRAPHIC_WIDTH * GEOGRAPHIC_HEIGHT).fill(-1);
  for (const [[x0, y0, x1, y1], [left, top]] of Object.values(DISTRICTS)) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const original = y * LEGACY_WIDTH + x;
      // Earlier parcels own the cut-outs in a larger district or the old sea.
      if (forward[original] !== -1) continue;
      const next = (top + y - y0) * GEOGRAPHIC_WIDTH + left + x - x0;
      if (inverse[next] !== -1) throw new Error(`Overlapping Singapore district at ${left + x - x0},${top + y - y0}`);
      forward[original] = next;
      inverse[next] = original;
    }
  }
  if (forward.includes(-1)) throw new Error('Singapore district placement leaves unmapped legacy tiles');
}

function mappedTile(x, y, mapping, inWidth, inHeight, outWidth) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= inWidth || y >= inHeight) return null;
  const left = Math.floor(x), top = Math.floor(y), i = mapping[top * inWidth + left];
  return i < 0 ? null : { x: i % outWidth + (x - left), y: Math.floor(i / outWidth) + (y - top) };
}

export function geographicTile(x, y) {
  tileIndex();
  return mappedTile(x, y, forward, LEGACY_WIDTH, LEGACY_HEIGHT, GEOGRAPHIC_WIDTH);
}

export function legacyTile(x, y) {
  tileIndex();
  return mappedTile(x, y, inverse, GEOGRAPHIC_WIDTH, GEOGRAPHIC_HEIGHT, LEGACY_WIDTH);
}

function movedPoint(p) { return { ...p, ...geographicTile(p.x, p.y) }; }

function movedRect(o, parcel) {
  const [[x0, y0], [left, top]] = parcel;
  const dx = left - x0, dy = top - y0;
  return { ...o, x0: o.x0 + dx, x1: o.x1 + dx, y0: o.y0 + dy, y1: o.y1 + dy };
}

function movedArea(o) {
  const { x, y } = geographicTile(o.cx, o.cy);
  const dx = x - o.cx, dy = y - o.cy;
  return { ...o, cx: x, cy: y, x0: o.x0 + dx, x1: o.x1 + dx, y0: o.y0 + dy, y1: o.y1 + dy };
}

// A simplified outline connects the playable mainland parcels. Ports and
// stretches of open water between the islands remain separate.
const MAINLAND = [
  [197, 75], [225, 38], [307, 33], [389, 38], [468, 56], [537, 78], [594, 82],
  [665, 72], [727, 82], [740, 166], [743, 208], [792, 212], [842, 219], [874, 225], [928, 228],
  [939, 280], [926, 330], [876, 348], [763, 358], [707, 389], [695, 469], [630, 477],
  [594, 466], [542, 458], [502, 449], [481, 421], [425, 414], [373, 393], [294, 380],
  [251, 394], [185, 438], [46, 441], [9, 420], [9, 365], [45, 338], [147, 322],
  [153, 281], [174, 226], [192, 184], [196, 136],
];

function fillMainland(terrain, mainland) {
  const W = GEOGRAPHIC_WIDTH;
  for (let y = 0; y < GEOGRAPHIC_HEIGHT; y++) {
    const cuts = [];
    for (let i = 0; i < MAINLAND.length; i++) {
      const [x1, y1] = MAINLAND[i], [x2, y2] = MAINLAND[(i + 1) % MAINLAND.length];
      if ((y1 > y) === (y2 > y)) continue;
      cuts.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length; i += 2) for (let x = Math.ceil(cuts[i]); x <= Math.floor(cuts[i + 1]); x++) {
      const at = y * W + x;
      mainland[at] = 1;
      terrain[at] = TERRAIN.GRASS;
    }
  }
}

const ANCHORS = {
  ...Object.fromEntries(STATIONS.map(({ id, x, y }) => [id, [x, y]])),
  pulau_hantu: [129, 52], kusu_island: [42, 236], lazarus_island: [150, 232], sisters_islands: [168, 258],
  pulau_semakau: [58, 260], southern_shore: [192, 239], pulau_tekong: [262, 150], wilderness: [103, 53],
};

// The bridges at Coney Island, the Sentosa causeway and the raised St John's
// path to Lazarus are the deliberate water crossings on the walking network.
const ROADS = [
  ['sungei_buloh', 'kranji'], ['sungei_buloh', 'jurong'], ['tuas', 'jurong'], ['jurong', 'bukit_timah'],
  ['kranji', 'mandai'], ['mandai', 'transit_road'], ['transit_road', 'punggol'], ['mandai', 'bukit_timah'],
  ['mandai', 'macritchie'], ['bukit_timah', 'macritchie'], ['macritchie', 'kampong_glam'],
  ['kampong_glam', 'chinatown'], ['kampong_glam', 'marina_bay'], ['chinatown', 'marina_bay'],
  ['macritchie', 'temasek'], ['temasek', 'kampong_glam'],
  ['marina_bay', 'gardens'], ['punggol', 'changi'], ['gardens', 'changi'],
];
const CAUSEWAYS = [
  ['punggol', 'coney', [[726, 145], [766, 176]]],
  ['chinatown', 'sentosa', [[493, 412], [481, 439]]],
  ['southern_islands', 'lazarus_island', [[610, 547], [621, 512]]],
  ['lazarus_island', 'southern_shore', [[664, 512], [687, 525]]],
];

// Some banks originally shared an approach at their old district boundary.
// Short boardwalks within each district give those pockets their own access.
const SHORE_PATHS = [
  [[858, 593], [858, 601]], [[755, 597], [755, 603]], // Shadow Rift pools
  [[918, 579], [924, 579]], [[758, 604], [762, 604]],
  [[939, 296], [945, 296]], [[943, 232], [949, 232]], // Changi's outer shore
  [[411, 46], [411, 42]], // Kranji marsh
  [[1005, 200], [1011, 200]], [[1008, 130], [1015, 130]], // Tekong channels
  [[811, 187], [811, 195]], // Coney Island beach
  [[246, 491], [254, 491]], [[246, 541], [254, 541]], // Pulau Hantu shore
  [[133, 553], [133, 561]], [[402, 455], [402, 463]], // Wilderness and Sentosa paths
  [[692, 555], [692, 563]], // Lazarus shore
];

const PORTS = {
  changi: ['Changi Point Ferry Terminal', [293, 47]],
  pulau_ubin: ['Pulau Ubin Jetty', [193, 53]],
  pulau_tekong: ['Pulau Tekong', [258, 150]],
  marina_bay: ['Marina South Pier', [192, 189]],
  southern_islands: ["St John's Island", [97, 242]],
  kusu_island: ['Kusu Island', [42, 236]],
  sisters_islands: ["Sisters' Islands", [169, 256]],
  pulau_hantu: ['Pulau Hantu', [126, 53]],
  pulau_semakau: ['Pulau Semakau', [57, 253]],
  kampong_glam: ['Kampong Glam', [65, 77]],
  wilderness: ['The Wilderness', [103, 53]],
  rift_outpost: ['Rift Outpost', [264, 221]],
  temasek: ['Temasek Camp', [261, 317]],
  celestial_peaks: ['The Celestial Peaks', [472, 319]],
};
const FERRIES = [
  ['changi-ubin', 'Pulau Ubin ferry', 'changi', 'pulau_ubin'],
  ['changi-tekong', 'Tekong game charter', 'changi', 'pulau_tekong'],
  ['marina-southern-islands', 'Southern Islands ferry', 'marina_bay', 'southern_islands'],
  ['stjohns-kusu', 'Kusu Island ferry', 'southern_islands', 'kusu_island'],
  ['stjohns-sisters', "Sisters’ Islands ferry", 'southern_islands', 'sisters_islands'],
  ['marina-hantu', 'Pulau Hantu boat charter', 'marina_bay', 'pulau_hantu'],
  ['hantu-semakau', 'Semakau game charter', 'pulau_hantu', 'pulau_semakau'],
  ['wilderness-crossing', 'Wilderness crossing', 'kampong_glam', 'wilderness'],
  ['rift-crossing', 'Shadow Rift crossing', 'marina_bay', 'rift_outpost'],
  ['peaks-crossing', 'Celestial Peaks crossing', 'temasek', 'celestial_peaks'],
];

const ARROWS = '→↘↓↙←↖↑↗';
const DIRECTIONS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const WAYFINDING = new Map([
  ['Bukit Timah ↑', [['bukit_timah', 'Bukit Timah']]],
  ['MacRitchie ←', [['macritchie', 'MacRitchie']]],
  ['Sentosa Beach ↓', [['sentosa', 'Sentosa Beach']]],
  ['⚠ Wilderness →', [['wilderness', '⚠ Wilderness']]],
  ['Sungei Buloh ←  Jurong →', [['sungei_buloh', 'Sungei Buloh'], ['jurong', 'Jurong']]],
  ['Southern Islands ↓', [['southern_islands', 'Southern Islands']]],
]);

function direction(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return DIRECTIONS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}

function signPost(original, moved, ferryLinks) {
  if (!original.sign) return moved;
  const local = WAYFINDING.get(original.sign);
  if (local) {
    const sign = local.map(([id, label]) => {
      const launch = ferryLinks.find((f) => f.to.placeId === id)?.from;
      return `${label}${launch ? ' ferry' : ''} (${direction(moved, launch || geographicTile(...ANCHORS[id]))})`;
    }).join(' · ');
    return { ...moved, sign };
  }
  const isTransit = original.sign.startsWith('Transit Road, Nee Soon Camp ·');
  if (!isTransit && !ARROWS.includes(original.sign[0])) return moved;
  const station = STATIONS.find((s) => Math.max(Math.abs(s.x - original.x), Math.abs(s.y - original.y)) <= 3);
  if (!station) return moved;
  const roads = [...ROADS, ...CAUSEWAYS].flatMap(([a, b]) => a === station.id ? [b] : b === station.id ? [a] : []);
  const names = roads.map((id) => `${GEOGRAPHIC_PLACE_BY_ID[id].label} (${direction(moved, geographicTile(...ANCHORS[id]))})`);
  for (const link of ferryLinks) {
    if (link.from.placeId === station.id) names.push(`Ferry to ${link.to.name} (${direction(moved, link.from)})`);
    if (link.to.placeId === station.id) names.push(`Ferry to ${link.from.name} (${direction(moved, link.to)})`);
  }
  if (isTransit) names.unshift(station.name);
  return names.length ? { ...moved, sign: names.join(' · ') } : moved;
}

function openPositions(objects, npcSpawns) {
  const W = GEOGRAPHIC_WIDTH, size = W * GEOGRAPHIC_HEIGHT;
  const blocked = new Uint8Array(size), reserved = new Uint8Array(size);
  for (const { objId, x, y } of objects) {
    const def = getObject(objId), [width, depth] = def.footprint || [1, 1];
    for (let dy = 0; dy < depth; dy++) for (let dx = 0; dx < width; dx++) {
      const i = (y - dy) * W + x + dx;
      reserved[i] = 1;
      if (def.blocking || def.footprint) blocked[i] = 1;
    }
  }
  for (const { x, y } of npcSpawns) reserved[y * W + x] = 1;
  return { blocked, reserved };
}

function makeNetwork(terrain, mainland, objects, npcSpawns) {
  const W = GEOGRAPHIC_WIDTH, H = GEOGRAPHIC_HEIGHT, T = TERRAIN;
  const { blocked, reserved } = openPositions(objects, npcSpawns);
  const idx = (x, y) => y * W + x;
  const tile = (p) => geographicTile(...p);
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const hasLand = (x, y) => !blocked[idx(x, y)] && terrain[idx(x, y)] !== T.WATER;
  const near = (p, accept, distance = 12) => {
    for (let r = 0; r <= distance; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && inBounds(x, y) && accept(x, y)) return { x, y };
    }
    return null;
  };
  const anchor = (id) => near(tile(ANCHORS[id]), hasLand);
  const path = (from, to, isBlocked, maxNodes = 32000) => findPath({ width: W, height: H, isBlocked }, from, to, { maxNodes });
  const paint = (x, y, bridge) => {
    const i = idx(x, y);
    if (!reserved[i] && terrain[i] !== T.STONE) terrain[i] = bridge || terrain[i] === T.WATER ? T.WOOD : T.PATH;
  };
  for (const [a, b] of ROADS) {
    const landOnly = (x, y) => !hasLand(x, y) || !mainland[idx(x, y)];
    const from = anchor(a), to = anchor(b);
    let steps = path(from, to, landOnly);
    if (!steps.length) steps = path(from, to, (x, y) => {
      const i = idx(x, y);
      return blocked[i] || !mainland[i] || (terrain[i] === T.WATER && reserved[i]);
    });
    if (!steps.length) throw new Error(`No mainland road between ${a} and ${b}`);
    // The districts' paved streets are preserved. New paths paint the land
    // between parcels and bridge only the water in the mainland envelope.
    for (const { x, y } of steps) {
      const i = idx(x, y);
      if (inverse[i] < 0 || terrain[i] === T.WATER) paint(x, y, false);
    }
  }
  const crossing = (from, to, [left, right], room) => {
    const x0 = Math.min(left[0], right[0]) - room, x1 = Math.max(left[0], right[0]) + room;
    const y0 = Math.min(left[1], right[1]) - room, y1 = Math.max(left[1], right[1]) + room;
    const cross = path(from, to, (x, y) => {
      const i = idx(x, y);
      return blocked[i] || (terrain[i] === T.WATER && (reserved[i] || x < x0 || x > x1 || y < y0 || y > y1));
    }, 100000);
    let previous = from;
    for (const { x, y } of cross) {
      if (terrain[idx(x, y)] === T.WATER) paint(x, y, true);
      if (x !== previous.x && y !== previous.y) {
        for (const [sx, sy] of [[x, previous.y], [previous.x, y]]) if (terrain[idx(sx, sy)] === T.WATER) paint(sx, sy, true);
      }
      previous = { x, y };
    }
    return cross.length > 0;
  };
  for (const [a, b, corridor] of CAUSEWAYS) {
    if (!crossing(anchor(a), anchor(b), corridor, 5)) throw new Error(`No causeway between ${a} and ${b}`);
  }
  for (const corridor of SHORE_PATHS) {
    const [[x1, y1], [x2, y2]] = corridor;
    if (!crossing({ x: x1, y: y1 }, { x: x2, y: y2 }, corridor, 2)) throw new Error(`No shore path to ${x2},${y2}`);
  }
  // The outermost Changi fishing tiles face out to sea, so the deck bends
  // around the shore and leaves the water under the fishing spots intact.
  paint(950, 232, true);
  for (let y = 232; y <= 288; y++) paint(951, y, true);

  // Sail-training docks, looms and stages are installed after World.build.
  // Keep boarding signs clear of those fixtures as well as the seeded props.
  for (const site of [...Object.values(LANDINGS), ...LOOMS, ...STAGES]) {
    const { x, y } = movedPoint(site);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) reserved[idx(x + dx, y + dy)] = 1;
  }
  const localPath = (from, to) => path(from, to, (x, y) => !hasLand(x, y));
  const endpoint = (placeId) => {
    const [name, focus] = PORTS[placeId];
    const from = anchor(placeId);
    const free = (x, y) => hasLand(x, y) && !reserved[idx(x, y)];
    let p = near(tile(focus), (x, y) => free(x, y) && ((from.x === x && from.y === y) || localPath(from, { x, y }).length));
    p ||= near(from, (x, y) => free(x, y) && ((from.x === x && from.y === y) || localPath(from, { x, y }).length));
    if (!p) throw new Error(`No open ferry landing at ${placeId}`);
    reserved[idx(p.x, p.y)] = 1;
    return { ...p, name, placeId };
  };
  return FERRIES.map(([id, name, from, to]) => ({ id, name, from: endpoint(from), to: endpoint(to) }));
}

export function geographicWorld(legacy) {
  tileIndex();
  const width = GEOGRAPHIC_WIDTH, height = GEOGRAPHIC_HEIGHT;
  const terrain = new Uint8Array(width * height).fill(TERRAIN.WATER);
  const mainland = new Uint8Array(terrain.length);
  fillMainland(terrain, mainland);
  for (let i = 0; i < forward.length; i++) terrain[forward[i]] = legacy.terrain[i];
  const objects = legacy.objects.map(movedPoint), npcSpawns = legacy.npcSpawns.map(movedPoint);
  const zones = legacy.zones.map((z) => {
    if (z.name === 'Southern Islands') return { ...z, x0: 297, y0: 485, x1: 696, y1: 615 };
    const moved = movedRect(z, DISTRICTS[ZONE_PARCELS[z.name]]);
    // The heritage walk and landmarks south of the plaza belong to Kampong Glam.
    if (z.name === 'Kampong Glam') moved.y1 = moved.y0 + 38;
    return moved;
  });
  const towns = legacy.towns.map(([x0, y0, x1, y1]) => {
    const a = geographicTile(x0, y0), b = geographicTile(x1, y1);
    return [a.x, a.y, b.x, b.y];
  });
  const ferryLinks = makeNetwork(terrain, mainland, objects, npcSpawns);
  return {
    ...legacy, layout: 'singapore', width, height, terrain, npcSpawns, zones, towns, ferryLinks,
    objects: objects.map((o, i) => signPost(legacy.objects[i], o, ferryLinks)),
    landmarks: legacy.landmarks.map(movedPoint),
    resourceZones: legacy.resourceZones.map(movedArea),
    groves: legacy.groves.map(movedArea),
    spawnPoint: movedPoint(legacy.spawnPoint), respawnPoint: movedPoint(legacy.respawnPoint),
  };
}
