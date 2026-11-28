// Small painted accents at existing viewpoints. These belong to the view,
// so the placement seed, collision, and the objects you can use stay separate.
import { TILE } from '../config.js';
import { getObject } from '../data/objects.js';
import { TERRAIN } from '../data/world.js';
import { drawObjectSprite } from './sprites.js';

const VISTAS = [
  // Transit Road flats and the entrance to Rain-Tree Verge.
  ['tiled_planter', 447, 149, .84], ['bougainvillea_pot', 444, 154, .82],
  ['tiled_planter', 452, 154, .84], ['planter_box', 448, 157, .74],
  ['bush', 446, 159, .92], ['bush', 441, 160, .78],
  // Mandai's trail opens onto the station in a break in the canopy.
  ['fallen_log', 467, 223, 1.06], ['bush', 470, 222, 1.1],
  ['trail_marker', 471, 225, .84], ['bush', 476, 222, 1.1], ['flower', 476, 224, .86],
  // The bay promenade, below the wheel and the theatre.
  ['orchid_planter', 190, 166, .91], ['orchid_planter', 196, 166, .82],
  ['bollard_light', 191, 168, .86], ['bay_bench', 197, 168, .9], ['bollard_light', 201, 168, .86],
  // Kampong Glam's hall and the reservoir's walking route.
  ['tiled_planter', 59, 81, .85], ['tiled_planter', 64, 82, .85], ['bougainvillea_pot', 65, 79, .85],
  ['bay_bench', 37, 52, .9], ['bush', 36, 53, .77], ['fallen_log', 37, 57, .85],
  // Wetland and coast approaches.
  ['trail_marker', 36, 149, .84], ['fallen_log', 37, 146, .84], ['bush', 40, 153, .9],
  ['buoy_pile', 45, 97, .83], ['deck_chair', 52, 96, .84],
  ['kelong_net', 280, 52, .9], ['buoy_pile', 282, 52, .8], ['surf_rack', 284, 51, .85],
  ['fallen_log', 344, 153, .84], ['bush', 343, 154, .78], ['buoy_pile', 96, 236, .81],
];

const byWorld = new WeakMap();

function sceneryFor(world) {
  const cached = byWorld.get(world);
  if (cached && cached.terrain === world.terrain) return cached.scenery;
  const scenery = VISTAS.map(([objId, x, y, scale]) => ({
    ...(world.authoredTile?.({ x, y }) || { x, y }),
    objId, scale, def: getObject(objId),
  }));
  byWorld.set(world, { terrain: world.terrain, scenery });
  return scenery;
}

/** Resolve only in-view details. Leave travel lanes and occupied tiles clear. */
export function visibleDistrictScenery(world, x0, y0, x1, y1, out = []) {
  out.length = 0;
  if (!world.terrainAt) return out;
  for (const prop of sceneryFor(world)) {
    const { x, y } = prop;
    if (x < x0 || x > x1 || y < y0 || y > y1 || world.objectAt?.(x, y)) continue;
    const ground = world.terrainAt(x, y);
    if (ground === TERRAIN.PATH || ground === TERRAIN.WOOD || ground === TERRAIN.WATER) continue;
    out.push(prop);
  }
  return out;
}

export function drawDistrictScenery(ctx, prop, ox, oy, alpha) {
  const x = (prop.x + .5) * TILE - ox, y = (prop.y + .5) * TILE - oy;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(prop.scale, prop.scale);
  ctx.globalAlpha *= alpha;
  drawObjectSprite(ctx, prop, 0, 0);
  ctx.restore();
}
