// Landmarks and set dressing: the painted set pieces that make each region
// recognisable at a glance (shophouse rows, the hawker centre, Supertrees, the
// kelong, the lighthouse...) and the small props round them (kopitiam tables,
// beach umbrellas, oil drums, prayer flags...). Purely scenery: they block the
// tiles they stand on and do nothing else.
//
// world.js calls placeLandmarks() last, after every other object, spawn and
// resource zone, so nothing placed before moves. There is no dice: each piece
// takes the nearest spot to its region's heart that keeps every rule below, so
// the layout is the same on every load.
//
// The rules keep the world as walkable as it was:
//   - a landmark's footprint (objects.js `footprint`: [wide, deep] tiles, standing
//     on its front-left tile) is open land off the roads, with a ring of open,
//     walkable tiles all round it that nothing else may later take. With that
//     ring, blocking the footprint can never cut one place off from another;
//   - a prop on land only goes where the walkable tiles round it stay joined up
//     (so it can't plug a gap), and never beside anything you use (a tree, rock,
//     stall, bank or station) or where a monster or townsperson stands;
//   - shore props sit on land beside the water; water props (the sampan, the
//     kelong) stand in the water itself, which was never walkable anyway;
//   - nothing goes within a few tiles of an MRT station, inside a resource
//     zone, or by a skilling ground players stand at for hours.
import { OBJECTS } from './objects.js';
import { SKILLING_GROUND } from './bestiaryPlace.js';

export const STATION_GAP = 4;   // tiles kept clear round every MRT station

// Each region's set pieces, placed near its heart (`at`, a tile) in order.
// `lm`: landmarks (an id, or [id, where]); `props`: [id, how many, where]. Where is 'land' (the
// default), 'sand', 'shore' (land beside the water), 'water', or 'eaves' (hung off a shophouse row).
export const LANDMARK_PLAN = [
  { region: 'Kampong Glam', at: [58, 70], reach: 16, outskirts: true, keepOut: [46, 46, 70, 64],   // out of the south gate, not on the plaza
    lm: ['shophouse_row_mint', 'shophouse_row_peach', 'hdb_block', 'golden_dome_hall', 'dragon_playground'],
    props: [['kopitiam_table', 2], ['kopitiam_stool', 2], ['hawker_stall_noodle', 1], ['hawker_stall_drinks', 1], ['void_deck_bench', 1],
      ['heritage_lamp', 2], ['signboard', 1], ['trishaw', 1], ['bougainvillea_pot', 2], ['letterbox_bank', 1], ['laundry_pole', 1], ['five_foot_lantern', 2, 'eaves']] },
  { region: 'Chinatown', at: [85, 56], reach: 14,
    lm: ['chinese_temple', 'shophouse_row_butter', 'shophouse_row_lilac', 'wet_market'],
    props: [['hawker_stall_fruit', 1], ['dragon_jar', 1], ['incense_urn', 1], ['roadside_shrine', 1], ['stone_lion', 2], ['lantern_post', 2],
      ['fish_stall', 1], ['rice_sacks', 1], ['dried_goods', 1], ['laundry_pole', 1], ['five_foot_lantern', 2, 'eaves']] },
  { region: 'Marina Bay', at: [192, 138], reach: 16,
    lm: ['hawker_centre'],
    props: [['hawker_stall_satay', 1], ['push_cart', 1], ['planter_box', 2], ['kopitiam_table', 1], ['kopitiam_stool', 1]] },
  // ...and the bay itself, the lake south of the station, with its promenade.
  { region: 'Marina Bay', at: [195, 166], reach: 18,
    lm: [['lionfish_fountain', 'shore'], 'spiky_dome_theatre', 'observation_wheel'],
    props: [['promenade_rail', 3, 'shore'], ['promenade_rail_corner', 1, 'shore'], ['bay_bench', 2, 'shore'], ['bollard_light', 2, 'shore'],
      ['fountain_small', 1]] },
  { region: 'Gardens by the Bay', at: [344, 40], reach: 22,
    lm: ['supertree_tall', 'supertree_short', 'supertree_tall', 'supertree_short', 'flower_dome'],
    props: [['orchid_planter', 3], ['topiary', 3], ['bay_bench', 1]] },
  { region: 'Changi Coast', at: [290, 40], reach: 20,
    lm: [['kelong', 'water']],
    props: [['sampan', 2, 'water'], ['kelong_stilts', 2, 'water'], ['kelong_net', 2, 'shore'], ['buoy_pile', 1, 'shore'], ['crab_trap', 2, 'shore']] },
  { region: 'Sentosa Beach', at: [60, 95], reach: 34,
    lm: [['lifeguard_tower', 'sand']],
    props: [['beach_umbrella_red', 2, 'sand'], ['beach_umbrella_teal', 2, 'sand'], ['deck_chair', 3, 'sand'], ['leaning_palm', 2, 'sand'], ['surf_rack', 1, 'sand']] },
  { region: 'Southern Islands', at: [98, 238], reach: 30,
    lm: ['lighthouse'] },
  { region: 'Southern Islands', at: [40, 236], reach: 24,
    lm: ['kusu_turtle_temple'] },
  { region: 'Pulau Ubin', at: [190, 44], reach: 18,
    lm: ['stilt_house'],
    props: [['rattan_chair', 1], ['bicycle', 1], ['durian_cart', 1], ['fish_rack', 1, 'shore'], ['laundry_pole', 1]] },
  { region: 'MacRitchie Reservoir', at: [36, 52], reach: 18,
    props: [['boardwalk', 2, 'water'], ['boardwalk_corner', 1, 'water']] },
  { region: 'MacRitchie Reservoir', at: [26, 74], reach: 18,
    lm: ['treetop_bridge'] },
  { region: 'Tuas Docklands', at: [99, 320], reach: 30,
    lm: ['gantry_crane'],
    props: [['oil_drums', 3], ['mooring_bollard', 2, 'shore']] },
  { region: 'Temasek Ruins', at: [265, 318], reach: 24,
    lm: ['temasek_gate'],
    props: [['broken_pillar', 3], ['lion_stone', 2]] },
  { region: 'Kranji Farmlands', at: [451, 132], reach: 20,
    lm: ['kranji_farmhouse'],
    props: [['vegetable_crates', 2], ['hay_bale', 3], ['water_trough', 1]] },
  { region: 'Punggol Waterway', at: [441, 64], reach: 24,
    lm: [['punggol_footbridge', 'shore']] },
  { region: 'The Celestial Peaks', at: [474, 320], reach: 24,
    lm: ['celestial_pavilion'],
    props: [['prayer_flags', 3], ['cloud_lantern', 2]] },
  { region: 'The Shadow Rift', at: [264, 222], reach: 24,
    lm: ['rift_obelisk'],
    props: [['rift_crystal', 3], ['void_brazier', 2]] },
  { region: 'Bukit Timah', at: [58, 30], reach: 20, props: [['trail_signpost', 2], ['trail_marker', 3]] },
  { region: 'Sungei Buloh Wetlands', at: [40, 148], reach: 24, props: [['fallen_log', 3], ['bird_hide', 1, 'shore']] },
  { region: 'Pulau Hantu', at: [130, 53], reach: 18, props: [['ghost_lantern', 3], ['offering_table', 1]] },
  { region: 'Tekong Badlands', at: [262, 140], reach: 24, props: [['sandbag_wall', 3], ['rusty_tank', 2]] },
];

/** The tiles a landmark standing at (x, y) covers: x..x+w-1 across, y-d+1..y deep. */
export function footprintTiles(objId, x, y) {
  const [w, d] = OBJECTS[objId].footprint || [1, 1];
  const out = [];
  for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) out.push([x + dx, y - dy]);
  return out;
}

/**
 * Place every piece in LANDMARK_PLAN. `ctx` is world.js's own state:
 * { T (the terrain codes), width, height, get, inB, occupied, key, objects, npcSpawns, zones, resourceZones, stations }.
 * Returns the landmarks placed, as { objId, x, y, region }.
 */
export function placeLandmarks(ctx) {
  const { T, get, inB, occupied, key, objects, npcSpawns, zones, resourceZones, stations } = ctx;
  const zoneAt = (x, y) => zones.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)?.name;
  const LAND = [T.GRASS, T.DARKGRASS, T.SAND, T.STONE];
  // Its own grids over the map, for speed: what stands on each tile (every tile
  // in `occupied` holds an object, so this knows them all; world.js's `occupied`
  // is kept up to date too), the walkable rings kept round each landmark and
  // prop, the tiles beside a monster or townsperson's spawn, and how near a
  // skilling ground each tile is (2: within one tile, 1: within two; 3 marks
  // the ground kept clear round the stations and in the resource zones).
  const { width: MW, height: MH } = ctx, K = (x, y) => y * MW + x;
  const tileObj = new Int32Array(MW * MH), reserved = new Uint8Array(MW * MH), bySpawn = new Uint8Array(MW * MH), byGround = new Uint8Array(MW * MH);
  const stamp = (grid, x, y, r, v) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inB(x + dx, y + dy) && grid[K(x + dx, y + dy)] < v) grid[K(x + dx, y + dy)] = v;
  };
  objects.forEach((o, i) => { if (inB(o.x, o.y)) tileObj[K(o.x, o.y)] = i + 1; });
  for (const s of npcSpawns) stamp(bySpawn, s.x, s.y, 1, 1);
  for (const o of objects) if (SKILLING_GROUND.test(o.objId)) { stamp(byGround, o.x, o.y, 2, 1); stamp(byGround, o.x, o.y, 1, 2); }
  for (const s of stations) stamp(byGround, s.x, s.y, STATION_GAP - 1, 3);
  for (const z of resourceZones) for (let y = z.y0 - 2; y <= z.y1 + 2; y++) for (let x = z.x0 - 2; x <= z.x1 + 2; x++) if (inB(x, y)) byGround[K(x, y)] = 3;
  const placed = [];
  const W = (x, y) => get(x, y) === T.WATER;
  const objAt = (x, y) => (inB(x, y) && tileObj[K(x, y)] ? objects[tileObj[K(x, y)] - 1] : undefined);
  // Open to walk on: in bounds, not water, and nothing blocking stands there.
  const walkable = (x, y) => inB(x, y) && !W(x, y) && !(objAt(x, y) && OBJECTS[objAt(x, y).objId].blocking);
  const nearSpawn = (x, y) => inB(x, y) && bySpawn[K(x, y)] === 1;
  // Clear of the stations, the resource zones, and (`gap` tiles: 2 or 3) the skilling grounds.
  const clearOf = (x, y, gap) => byGround[K(x, y)] < 4 - gap;
  const take = (objId, x, y, tiles) => {
    const o = { objId, x, y };
    objects.push(o);
    for (const [tx, ty] of tiles) { occupied.add(key(tx, ty)); tileObj[K(tx, ty)] = objects.length; }
    return o;
  };
  const free = (x, y) => inB(x, y) && !tileObj[K(x, y)] && !reserved[K(x, y)];
  // A water tile with land beside it (or a land tile with water beside it).
  const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const bySide = (x, y, water) => n4.some(([dx, dy]) => inB(x + dx, y + dy) && W(x + dx, y + dy) === water);

  // The tiles all round a w x d block standing on (ax, ay), in order round it
  // (each is beside the next), with whether each touches a side of the block
  // (the corners only touch diagonally).
  const ringRound = (ax, ay, w, d) => {
    const r = [], top = ay - d, bot = ay + 1, lft = ax - 1, rgt = ax + w;
    for (let x = lft; x <= rgt; x++) r.push([x, top, x > lft && x < rgt]);
    for (let y = top + 1; y < bot; y++) r.push([rgt, y, true]);
    for (let x = rgt; x >= lft; x--) r.push([x, bot, x > lft && x < rgt]);
    for (let y = bot - 1; y > top; y--) r.push([lft, y, true]);
    return r;
  };
  // Blocking a block can't cut anything off if the walkable tiles touching its
  // sides all lie in one unbroken run round it: whatever walked past it before
  // can walk round it now. (A full walkable ring is the simplest case.)
  const oneRun = (ring) => {
    const open = ring.map(([x, y]) => walkable(x, y)), n = ring.length;
    if (!ring.some(([, , side], i) => side && open[i])) return false;
    if (open.every(Boolean)) return true;
    let runs = 0;
    for (let i = 0; i < n; i++) {
      if (!open[i] || open[(i + n - 1) % n]) continue;   // not the start of a run
      let side = false;
      for (let j = i; j < i + n && open[j % n]; j++) if (ring[j % n][2]) side = true;
      if (side) runs++;
    }
    return runs === 1;
  };

  const landmarkFits = (objId, ax, ay, where) => {
    const [w, d] = OBJECTS[objId].footprint;
    const tiles = footprintTiles(objId, ax, ay);
    const wet = where === 'water';
    for (const [x, y] of tiles) {
      if (!free(x, y) || (!wet && nearSpawn(x, y)) || !clearOf(x, y, 3)) return null;
      const t = get(x, y);
      if (wet ? t !== T.WATER : !LAND.includes(t) || (where === 'sand' && t !== T.SAND)) return null;
    }
    const ring = ringRound(ax, ay, w, d);
    // (Kept a tile back from the roads, so a road never runs hard against a wall.)
    if (ring.some(([x, y]) => !inB(x, y) || reserved[K(x, y)] || get(x, y) === T.PATH || get(x, y) === T.WOOD)) return null;
    if (wet) {
      // The kelong stands just off a shore you can see it from; it changes no one's way.
      if (ring.filter(([x, y]) => !W(x, y)).length < 2 || ring.some(([x, y]) => objAt(x, y) && !W(x, y))) return null;
      return { tiles, ring };
    }
    // On land the ring is open ground (by the water for a shore piece, which may
    // have the water along one side), with nothing you use standing in it.
    if (ring.some(([x, y]) => (!walkable(x, y) && !(where === 'shore' && W(x, y))) || OBJECTS[objAt(x, y)?.objId]?.verb)) return null;
    if (where === 'shore' && (!ring.some(([x, y]) => W(x, y)) || !oneRun(ring))) return null;
    return { tiles, ring: ring.filter(([x, y]) => !W(x, y)) };
  };

  // A prop on land keeps the walkable tiles round it joined up (the same rule,
  // for a one-tile block), and nothing you use stands beside it.
  const ring8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const propFits = (objId, x, y, where) => {
    if (!free(x, y) || !clearOf(x, y, 2)) return false;
    const t = get(x, y);
    if (where === 'water') return t === T.WATER && bySide(x, y, false);   // (nobody stands in the water)
    if (nearSpawn(x, y)) return false;
    if (!LAND.includes(t) || (where === 'sand' && t !== T.SAND) || (where === 'shore' && !bySide(x, y, true))) return false;
    for (const [dx, dy] of ring8) {
      const o = objAt(x + dx, y + dy), g = get(x + dx, y + dy);
      if ((o && OBJECTS[o.objId].verb) || g === T.PATH || g === T.WOOD) return false;   // (and a tile back from the roads)
    }
    return oneRun(ringRound(x, y, 1, 1));
  };

  for (const plan of LANDMARK_PLAN) {
    const [hx, hy] = plan.at, R = plan.reach;
    // Spots round the region's heart, nearest first (ties broken by a fixed hash,
    // so props don't line up), each packed as distance and tile into one number.
    const keys = [];
    for (let y = hy - R; y <= hy + R; y++) for (let x = hx - R; x <= hx + R; x++) {
      // Inside its own region (a town's outskirts may spill just past it).
      if (!inB(x, y) || (!plan.outskirts && zoneAt(x, y) !== plan.region)) continue;
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      keys.push(Math.round((Math.hypot(x - hx, y - hy) + (h % 1000) / 1000 * 2.5) * 1000) * MW * MH + K(x, y));
    }
    const spots = Float64Array.from(keys).sort().map((k) => k % (MW * MH));
    const at = (k) => [k % MW, Math.floor(k / MW)];
    for (const entry of plan.lm || []) {
      const [objId, where = 'land'] = Array.isArray(entry) ? entry : [entry];
      const [w, d] = OBJECTS[objId].footprint;
      for (const k of spots) {
        const [x, y] = at(k);
        if (!free(x, y) || (where !== 'water' && nearSpawn(x, y))) continue;   // (a quick look at the middle first)
        // (x, y) is the footprint's middle; it stands on its front-left tile.
        const ax = x - Math.floor((w - 1) / 2), ay = y + Math.floor(d / 2);
        if (plan.keepOut && ax + w > plan.keepOut[0] - 1 && ax <= plan.keepOut[2] + 1 && ay >= plan.keepOut[1] - 1 && ay - d < plan.keepOut[3] + 1) continue;
        const fit = landmarkFits(objId, ax, ay, where);
        if (!fit) continue;
        take(objId, ax, ay, fit.tiles);
        for (const [rx, ry] of fit.ring) reserved[K(rx, ry)] = 1;
        placed.push({ objId, x: ax, y: ay, region: plan.region });
        break;
      }
    }
    // Once a spot won't take a prop it never will (things are only ever added),
    // so each kind of spot is searched from where the last prop left off.
    const from = {};
    for (const [objId, n, where = 'land'] of plan.props || []) {
      let left = n;
      if (where === 'eaves') {
        // Hung off the right-hand wall of this region's shophouse rows, over the
        // walkway beside them (it doesn't block, so the ring stays open).
        for (const p of placed) {
          if (!left || p.region !== plan.region || !/^shophouse_row_/.test(p.objId)) continue;
          const x = p.x + OBJECTS[p.objId].footprint[0], y = p.y;
          if (!inB(x, y) || objAt(x, y) || !walkable(x, y) || nearSpawn(x, y)) continue;
          take(objId, x, y, [[x, y]]);
          left--;
        }
        continue;
      }
      let i = from[where] || 0;
      for (; left && i < spots.length; i++) {
        const [x, y] = at(spots[i]);
        if (!propFits(objId, x, y, where)) continue;
        take(objId, x, y, [[x, y]]);
        // Keep the tiles round a prop free of other props, so they never wall each other in.
        for (const [dx, dy] of ring8) if (inB(x + dx, y + dy)) reserved[K(x + dx, y + dy)] = 1;
        left--;
      }
      from[where] = i;
    }
  }
  return placed;
}
