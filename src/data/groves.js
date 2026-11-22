// Groves: patches of woodland where one kind of tree grows thick, so a
// woodcutter who finds one can fell tree after tree without walking far. Each
// region gets one or two, of a tree that suits its level band, from the plain
// oaks of Pulau Ubin to the keramat trees of the Celestial Peaks.
//
// world.js calls placeGroves() last of all (after the landmarks and the border
// fence), so nothing placed before moves and its random streams are untouched.
// Like the landmarks there is no dice: each grove takes the open patch nearest
// its region's heart (or the spot its plan names) that keeps every rule below,
// so the layout is the same on every load.
//
// The rules keep the world as walkable as it was:
//   - a grove's whole patch, with a one-tile ring round its trees, is grass
//     inside its own region that you can already walk to from Kampong Glam,
//     with nothing you use (another tree, a rock, a stall) in it or beside it;
//     scenery (a bush, a fence post) may stand between its trees, but no tree
//     goes where something stands or spawns;
//   - its trees stand on every other tile both ways, and the open tiles left
//     in the patch must all still join up inside it: then whatever walked
//     across the patch before can still walk round the trees, and every tree
//     has open ground beside it to chop from;
//   - it keeps off the roads (and two tiles back from them), clear of the MRT
//     stations, the resource zones, the skilling grounds, the landmarks and the towns.
import { OBJECTS } from './objects.js';
import { SKILLING_GROUND } from './bestiaryPlace.js';
import { STATION_GAP } from './landmarks.js';

// Each grove: its name, its tree, its region, and `n`, how many trees along a
// side (n x n trees in a patch 2n + 1 tiles across, ring included). `at` (a
// tile) is where to look first; without it, the middle of the region.
export const GROVE_PLAN = [
  { id: 'ubin_oak_grove', name: 'Ubin Oak Grove', tree: 'oak', region: 'Pulau Ubin', n: 5 },
  { id: 'changi_angsana_grove', name: 'Changi Angsana Grove', tree: 'angsana', region: 'Changi Coast', n: 5 },
  { id: 'kranji_bamboo_stand', name: 'Kranji Bamboo Stand', tree: 'bamboo', region: 'Kranji Farmlands', n: 5 },
  { id: 'punggol_willow_bank', name: 'Punggol Willow Bank', tree: 'willow', region: 'Punggol Waterway', n: 5 },
  { id: 'jurong_teak_plantation', name: 'Jurong Teak Plantation', tree: 'teak', region: 'Jurong Forest', n: 5, at: [100, 180] },
  { id: 'buloh_mangrove_thicket', name: 'Buloh Mangrove Thicket', tree: 'mangrove', region: 'Sungei Buloh Wetlands', n: 4 },
  { id: 'marina_rain_tree_grove', name: 'Marina Rain Tree Grove', tree: 'rain_tree', region: 'Marina Bay', n: 5 },
  { id: 'jurong_mahogany_grove', name: 'Jurong Mahogany Grove', tree: 'mahogany', region: 'Jurong Forest', n: 4, at: [140, 130] },
  { id: 'tekong_yew_grove', name: 'Tekong Yew Grove', tree: 'yew_tree', region: 'Tekong Badlands', n: 4 },
  { id: 'gardens_tembusu_stand', name: 'Gardens Tembusu Stand', tree: 'tembusu', region: 'Gardens by the Bay', n: 5 },
  { id: 'coney_magic_wood', name: 'Coney Magic Wood', tree: 'magic_tree', region: 'Coney Island', n: 4 },
  { id: 'southern_seraya_stand', name: 'Southern Seraya Stand', tree: 'seraya_tree', region: 'Southern Islands', n: 4 },
  { id: 'mandai_meranti_grove', name: 'Mandai Meranti Grove', tree: 'meranti_tree', region: 'Mandai Rainforest', n: 4, at: [440, 200] },
  { id: 'mandai_chengal_grove', name: 'Mandai Chengal Grove', tree: 'chengal_tree', region: 'Mandai Rainforest', n: 4, at: [500, 260] },
  { id: 'rift_starfall_grove', name: 'Rift Starfall Grove', tree: 'starfall_banyan', region: 'The Shadow Rift', n: 4 },
  { id: 'temasek_kapok_grove', name: 'Temasek Kapok Grove', tree: 'moonlit_kapok', region: 'Temasek Ruins', n: 4 },
  { id: 'peaks_keramat_grove', name: 'Peaks Keramat Grove', tree: 'keramat_tree', region: 'The Celestial Peaks', n: 4 },
];

// Quarries: the same for Mining (the owner's ask: rocks were few and far
// between, so mining around level 70 ran about 40% slower than woodcutting).
// Each is a patch thick with one kind of rock, in a region where that rock
// already belongs, placed by placeGroves after the groves, the same way. (The
// endgame rocks, obsidian to eternal, already stand in one cluster each.)
export const QUARRY_PLAN = [
  { id: 'ubin_copper_quarry', name: 'Ubin Copper Quarry', rock: 'copper_rock', region: 'Pulau Ubin', n: 4 },
  { id: 'ubin_tin_quarry', name: 'Ubin Tin Quarry', rock: 'tin_rock', region: 'Pulau Ubin', n: 4 },
  { id: 'jurong_iron_quarry', name: 'Jurong Iron Quarry', rock: 'iron_rock', region: 'Jurong Forest', n: 4 },
  { id: 'timah_silver_quarry', name: 'Bukit Timah Silver Quarry', rock: 'silver_rock', region: 'Bukit Timah', n: 4 },
  { id: 'ubin_coal_quarry', name: 'Ubin Coal Quarry', rock: 'coal_rock', region: 'Pulau Ubin', n: 5 },
  { id: 'tuas_gold_quarry', name: 'Tuas Gold Quarry', rock: 'gold_rock', region: 'Tuas Docklands', n: 4 },
  { id: 'wilderness_mithril_quarry', name: 'Wilderness Mithril Quarry', rock: 'mithril_rock', region: 'The Wilderness', n: 4 },
  { id: 'tuas_adamant_quarry', name: 'Tuas Adamant Quarry', rock: 'adamantite_rock', region: 'Tuas Docklands', n: 5 },
  { id: 'peaks_runite_quarry', name: 'Peaks Runite Quarry', rock: 'runite_rock', region: 'The Celestial Peaks', n: 4 },
];

const GAP = 4;   // open tiles kept between one grove and the next

/**
 * Place every grove in `plan` (GROVE_PLAN, or QUARRY_PLAN for rocks: an
 * entry names its `tree` or its `rock`). `ctx` is world.js's own state:
 * { T, width, height, get, inB, placeObj, objects, npcSpawns, zones, resourceZones,
 *   stations, landmarks, towns, start }.
 * Returns the groves placed: { id, name, objId, region, cx, cy, x0, y0, x1, y1, count }
 * (x0..y1 bound its trees).
 */
export function placeGroves(ctx, plan_ = GROVE_PLAN, kind = 'grove') {
  const { T, width: MW, height: MH, get, inB, placeObj, objects, npcSpawns, zones, resourceZones, stations, landmarks, towns, start } = ctx;
  const K = (x, y) => y * MW + x;
  const zoneAt = (x, y) => zones.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)?.name;
  // `bad`: tiles no part of a grove may cover. `taken`: tiles a tree can't
  // stand on (something stands there already, or something spawns there).
  // `blocked`: tiles you can't walk on for something standing there.
  const bad = new Uint8Array(MW * MH), taken = new Uint8Array(MW * MH), blocked = new Uint8Array(MW * MH);
  const mark = (x0, y0, x1, y1) => {
    for (let y = Math.max(0, y0); y <= Math.min(MH - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(MW - 1, x1); x++) bad[K(x, y)] = 1;
  };
  for (const o of objects) {
    if (!inB(o.x, o.y)) continue;
    const def = OBJECTS[o.objId];
    taken[K(o.x, o.y)] = 1;
    if (def?.blocking) blocked[K(o.x, o.y)] = 1;
    // Scenery (fences, bushes, ruins) may stand between a grove's trees; nothing
    // you use may (another tree would spoil the one kind), nor beside them.
    if (def?.verb) mark(o.x - 1, o.y - 1, o.x + 1, o.y + 1);
    if (SKILLING_GROUND.test(o.objId)) mark(o.x - 2, o.y - 2, o.x + 2, o.y + 2);
  }
  for (const s of npcSpawns) if (inB(s.x, s.y)) taken[K(s.x, s.y)] = 1;
  for (const s of stations) mark(s.x - STATION_GAP, s.y - STATION_GAP, s.x + STATION_GAP, s.y + STATION_GAP);
  for (const z of resourceZones) mark(z.x0 - 3, z.y0 - 3, z.x1 + 3, z.y1 + 3);
  for (const l of landmarks) {
    const [w, d] = OBJECTS[l.objId].footprint || [1, 1];
    mark(l.x - 2, l.y - d - 1, l.x + w + 1, l.y + 2);   // the footprint, its kept ring and a tile more
    for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) if (inB(l.x + dx, l.y - dy)) blocked[K(l.x + dx, l.y - dy)] = 1;
  }
  for (const [a, b, c, d] of towns) mark(a - 2, b - 2, c + 2, d + 2);
  mark(0, 0, MW - 1, 2); mark(0, MH - 3, MW - 1, MH - 1); mark(0, 0, 2, MH - 1); mark(MW - 3, 0, MW - 1, MH - 1);   // the border fence

  // Every tile you can walk to from the start (before any grove).
  const reach = new Uint8Array(MW * MH);
  {
    const queue = new Int32Array(MW * MH);
    let head = 0, tail = 0;
    queue[tail++] = K(start.x, start.y); reach[K(start.x, start.y)] = 1;
    while (head < tail) {
      const k = queue[head++], x = k % MW, y = (k - x) / MW;
      for (let i = 0; i < 4; i++) {
        const nx = x + (i === 0 ? 1 : i === 1 ? -1 : 0), ny = y + (i === 2 ? 1 : i === 3 ? -1 : 0), nk = K(nx, ny);
        if (!inB(nx, ny) || reach[nk] || blocked[nk] || get(nx, ny) === T.WATER) continue;
        reach[nk] = 1; queue[tail++] = nk;
      }
    }
  }
  // Open grass you can already walk to, off the roads (and two tiles back from them).
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = get(x, y);
    if (t === T.PATH || t === T.WOOD) mark(x - 2, y - 2, x + 2, y + 2);
    else if ((t !== T.GRASS && t !== T.DARKGRASS) || !reach[K(x, y)]) bad[K(x, y)] = 1;
  }
  // A running total of bad tiles, so a whole patch is checked in one look.
  let sum;
  const tally = () => {
    sum = new Int32Array((MW + 1) * (MH + 1));
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      sum[(y + 1) * (MW + 1) + x + 1] = bad[K(x, y)] + sum[y * (MW + 1) + x + 1] + sum[(y + 1) * (MW + 1) + x] - sum[y * (MW + 1) + x];
    }
  };
  const badIn = (x0, y0, x1, y1) => sum[(y1 + 1) * (MW + 1) + x1 + 1] - sum[y0 * (MW + 1) + x1 + 1] - sum[(y1 + 1) * (MW + 1) + x0] + sum[y0 * (MW + 1) + x0];
  tally();

  const placed = [];
  for (const plan of plan_) {
    const z = zones.find((r) => r.name === plan.region);
    const objId = plan.tree || plan.rock;
    if (!z || !OBJECTS[objId]) continue;
    const h = plan.n;   // the patch runs h tiles each way from its middle
    const [hx, hy] = plan.at || [Math.round((z.x0 + z.x1) / 2), Math.round((z.y0 + z.y1) / 2)];
    const trees = (cx, cy) => {
      const out = [];
      for (let dy = -(h - 1); dy <= h - 1; dy += 2) for (let dx = -(h - 1); dx <= h - 1; dx += 2) out.push(K(cx + dx, cy + dy));
      return out;
    };
    // Middles that keep the whole patch inside the region on open ground, nearest the heart first.
    const spots = [];
    for (let cy = z.y0 + h; cy <= z.y1 - h; cy++) for (let cx = z.x0 + h; cx <= z.x1 - h; cx++) {
      if (badIn(cx - h, cy - h, cx + h, cy + h)) continue;
      // (Region rectangles can overlap; the first that matches owns a tile.)
      if (zoneAt(cx - h, cy - h) !== plan.region || zoneAt(cx + h, cy + h) !== plan.region
        || zoneAt(cx - h, cy + h) !== plan.region || zoneAt(cx + h, cy - h) !== plan.region) continue;
      if (trees(cx, cy).some((k) => taken[k])) continue;
      spots.push([Math.hypot(cx - hx, cy - hy), cx, cy]);
    }
    spots.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    // The first that cuts nothing off: with its trees standing, the open tiles
    // left in the patch must still all join up inside it. Then any way across it
    // (in and out by the open ring round it) can still be walked, so nothing
    // anywhere is cut off, and every tree has open ground beside it to chop from.
    const joinedUp = (cx, cy, ks) => {
      const x0 = cx - h, y0 = cy - h, S = 2 * h + 1, tree = new Set(ks);
      const open = (x, y) => x >= x0 && x < x0 + S && y >= y0 && y < y0 + S && !blocked[K(x, y)] && !tree.has(K(x, y));
      let total = 0, first = null;
      for (let y = y0; y < y0 + S; y++) for (let x = x0; x < x0 + S; x++) if (open(x, y)) { total++; first ||= [x, y]; }
      if (!first) return false;
      const seen = new Set([K(...first)]), q = [first];
      while (q.length) {
        const [x, y] = q.pop();
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!open(nx, ny) || seen.has(K(nx, ny))) continue;
          seen.add(K(nx, ny)); q.push([nx, ny]);
        }
      }
      return seen.size === total && ks.every((k) => [1, -1, MW, -MW].some((d) => seen.has(k + d)));
    };
    for (const [, cx, cy] of spots) {
      const ks = trees(cx, cy);
      if (!joinedUp(cx, cy, ks)) continue;
      for (const k of ks) blocked[k] = 1;
      let count = 0;
      for (const k of ks) if (placeObj(objId, k % MW, Math.floor(k / MW))) count++;
      placed.push({ id: plan.id, name: plan.name, objId, kind, region: plan.region, cx, cy,
        x0: cx - (h - 1), y0: cy - (h - 1), x1: cx + (h - 1), y1: cy + (h - 1), count });
      mark(cx - h - GAP, cy - h - GAP, cx + h + GAP, cy + h + GAP);
      tally();
      break;
    }
  }
  return placed;
}
