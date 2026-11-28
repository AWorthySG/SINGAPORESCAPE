// Terrain polish baked into the renderer's terrain chunks (see renderer.js,
// _bakeChunk): soft blended edges between ground types, a scatter of small
// ground details, soft contact shadows under objects, and the water's extras
// (shoreline foam, lily pads and reeds, reflections).
//
// Everything that can be is baked once per chunk, so it costs nothing per
// frame. Only three things are drawn each frame, all of them cheap: the foam
// (two half-resolution layers per shore chunk, cross-faded), the lily pads and
// reeds (they sit on the animated water, which is drawn over the chunk), and
// the reflections (off in low graphics).
//
// Every choice is made from a hash of the tile's position, never Math.random,
// so the same world always bakes the same picture. The planning functions
// (blendPlan, blendMask, scatterPlan, waterDetailPlan, shadowPlan) are plain
// data and run headless; the tests check them directly.

import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { drawCreature, drawPlayer, worldArtBox } from './sprites.js';
import { paintHeritageTiles } from './heritagewalk.js';
import { paintDiveShoreTiles } from './diveart.js';
import { GroundTouch } from './groundtouch.js';
import { foliageKind } from './foliage.js';
import { shoreReflections, waterBelow, WaterDepth } from './waterdepth.js';

/** A stable 0..1 hash of a tile (and an optional salt). */
export function tileHash(x, y, s = 0) {
  let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------- Region ground ----------------
// Water and banks carry the local palette even at noon, when the screen's
// atmosphere is nearly clear. Washes tint the paper grain and painted ripples.
const T = TERRAIN;
const TRANSIT = 'Transit Road, Nee Soon Camp';
const COAST = { [T.WATER]: ['#168f9b', 0.33], [T.SAND]: ['#ffebbb', 0.27] };
const RESERVOIR = { [T.WATER]: ['#277577', 0.37], [T.SAND]: ['#aca67b', 0.34] };
const WETLAND = { [T.WATER]: ['#47635c', 0.52], [T.SAND]: ['#766451', 0.67] };
const FOREST_FLOOR = { [T.GRASS]: ['#4e9669', 0.20], [T.DARKGRASS]: ['#2f7459', 0.29] };
const HAUNTED = { [T.WATER]: ['#504574', 0.47], [T.GRASS]: ['#776c86', 0.28],
  [T.DARKGRASS]: ['#544666', 0.38], [T.SAND]: ['#b0959b', 0.38] };
const MOUNTAIN = { [T.WATER]: ['#6c8db5', 0.39], [T.GRASS]: ['#97b7b9', 0.31],
  [T.DARKGRASS]: ['#63858d', 0.31], [T.SAND]: ['#c9d5db', 0.38] };
const GROUND_WASHES = {
  [TRANSIT]: { [T.GRASS]: ['#607d61', 0.30], [T.DARKGRASS]: ['#385149', 0.44],
    [T.PATH]: ['#977a62', 0.26], [T.STONE]: ['#8c9697', 0.52] },
  'Kampong Glam': { [T.STONE]: ['#bd7854', 0.36], [T.PATH]: ['#b68668', 0.31] },
  Chinatown: { [T.STONE]: ['#b56f61', 0.27], [T.PATH]: ['#a8695d', 0.38] },
  'Marina Bay': { [T.WATER]: ['#346a9b', 0.31], [T.STONE]: ['#f1e9d9', 0.50], [T.PATH]: ['#e1d8c7', 0.44] },
  'Gardens by the Bay': { ...RESERVOIR, [T.STONE]: ['#c0d2b8', 0.34], [T.PATH]: ['#e2c8a8', 0.36] },
  'Bukit Timah': { ...FOREST_FLOOR, [T.PATH]: ['#b48b58', 0.34], [T.SAND]: ['#c7ae81', 0.32] },
  'Jurong Forest': { ...FOREST_FLOOR, ...RESERVOIR, [T.PATH]: ['#b1a16f', 0.30] },
  'Mandai Rainforest': { [T.GRASS]: ['#77724e', 0.40], [T.DARKGRASS]: ['#4f5140', 0.52],
    [T.PATH]: ['#9e7756', 0.46], ...RESERVOIR },
  'MacRitchie Reservoir': { ...FOREST_FLOOR, ...RESERVOIR, [T.PATH]: ['#7f8a6c', 0.31], [T.WOOD]: ['#886d54', 0.20] },
  'Sungei Buloh Wetlands': { ...FOREST_FLOOR, ...WETLAND, [T.DARKGRASS]: ['#566251', 0.35], [T.WOOD]: ['#796c58', 0.36] },
  'Punggol Waterway': { ...RESERVOIR, [T.STONE]: ['#acb7b4', 0.34], [T.PATH]: ['#b6a583', 0.35] },
  'Kranji Farmlands': { [T.GRASS]: ['#99a365', 0.22], [T.PATH]: ['#b48e65', 0.34], [T.STONE]: ['#b3a184', 0.23] },
  'Sentosa Beach': { [T.WATER]: ['#23acaf', 0.50], [T.SAND]: ['#ffedbf', 0.54] },
  'Southern Islands': { ...COAST, [T.SAND]: ['#e7d8ab', 0.37], [T.WOOD]: ['#9d7c61', 0.28] },
  'Changi Coast': { [T.WATER]: ['#357c94', 0.43], [T.SAND]: ['#b69e83', 0.45], [T.WOOD]: ['#807f75', 0.34] },
  'Pulau Ubin': { ...COAST, [T.SAND]: ['#b9ae91', 0.33], [T.PATH]: ['#a48c64', 0.34] },
  'Coney Island': { ...FOREST_FLOOR, ...COAST, [T.SAND]: ['#c6b995', 0.33] },
  'Tuas Docklands': { [T.WATER]: ['#456c87', 0.41], [T.SAND]: ['#bbb5ad', 0.38], [T.STONE]: ['#a3a6a6', 0.46] },
  'Temasek Ruins': { [T.PATH]: ['#a68e68', 0.35], [T.DARKGRASS]: ['#7b7860', 0.35] },
  'Tekong Badlands': { [T.SAND]: ['#9e8d75', 0.42], [T.DARKGRASS]: ['#615d50', 0.41], [T.PATH]: ['#947c66', 0.47] },
  'The Wilderness': { [T.GRASS]: ['#807c62', 0.32], [T.DARKGRASS]: ['#505243', 0.49] },
  'Pulau Hantu': { ...HAUNTED, [T.PATH]: ['#8b7383', 0.42] },
  'The Shadow Rift': { ...HAUNTED, [T.PATH]: ['#645472', 0.54] },
  'The Celestial Peaks': { ...MOUNTAIN, [T.PATH]: ['#a7b5b8', 0.43], [T.STONE]: ['#aabdc6', 0.24] },
};

function districtFade(z, x, y, span) {
  if (z.x0 === undefined) return 1;
  const edge = Math.min(x - z.x0, z.x1 - x, y - z.y0, z.y1 - y);
  const f = Math.max(0, Math.min(1, edge / span));
  return f * f * (3 - 2 * f);
}

// The two-lane strip across the top of the town is asphalt. Its southern
// footpaths keep the warmer earth of the verge around the rain trees.
const transitRoad = (z, t, y) => z.name === TRANSIT && t === T.PATH && y <= (z.y0 ?? y) + 5;

function commonGround(g, t, x, y, sx, sy, strength) {
  if (t !== T.GRASS && t !== T.DARKGRASS) return;
  // Broad clumps are sampled in world coordinates so they join across chunk
  // lines. Their slow colour changes keep the long mainland gaps readable.
  const h = 0.56 * Math.sin(x * 0.13 + Math.sin(y * 0.15)) + 0.44 * Math.sin(y * 0.16 - x * 0.068);
  g.fillStyle = h > 0 ? '#b2b478' : '#3b7061';
  g.globalAlpha = Math.abs(h) * 0.27 * strength;
  g.fillRect(sx, sy, TILE, TILE);
  g.globalAlpha = 1;
}

/** Paint the same wash on a tile and on that material's feathered edges.
 * Fade into the neighbouring palette across the region's last five tiles. */
export function paintGroundWash(g, world, t, x, y, sx, sy) {
  const zone = world.zoneAt?.(x, y);
  if (!zone) { commonGround(g, t, x, y, sx, sy, 1); return; }
  const asphalt = transitRoad(zone, t, y);
  const wash = asphalt ? ['#384757', 0.83] : GROUND_WASHES[zone.name]?.[t];
  const f = districtFade(zone, x, y, asphalt ? 3 : 5);
  if (f < 1 || !wash) commonGround(g, t, x, y, sx, sy, wash ? 1 - f : 1);
  if (!wash) return;
  if (!f) return;
  g.fillStyle = wash[0];
  g.globalAlpha = wash[1] * f;
  g.fillRect(sx, sy, TILE, TILE);
  g.globalAlpha = 1;
}

export function naturalStone(world, x, y) {
  return world.zoneAt?.(x, y)?.name === 'The Celestial Peaks';
}

// Motifs sit inside the material, underneath the scenery and particles. The
// palettes and brush shapes stay distinguishable in daylight and at dusk.
const PAVING = {
  [TRANSIT]: ['slabs', '#495b60', '#d4ddd8', 16, 16],
  'Kampong Glam': ['slabs', '#8d503e', '#ffd4a4', 16, 8],
  Chinatown: ['slabs', '#81514d', '#f3bc9a', 16, 8],
  'Marina Bay': ['slabs', '#8d9691', '#fff8e9', 32, 16],
  'Gardens by the Bay': ['slabs', '#778b77', '#e8efcc', 16, 16],
  'Punggol Waterway': ['slabs', '#718580', '#deebe1', 32, 16],
  'Tuas Docklands': ['slabs', '#627479', '#c5c9c3', 32, 32],
};
const ROOTS = {
  'Mandai Rainforest': ['roots', '#382e25', '#a58c60'],
  'Bukit Timah': ['roots', '#5d4d30', '#ba9663'],
  'Jurong Forest': ['roots', '#465238', '#c4aa7a'],
  'Coney Island': ['roots', '#524634', '#ab9062'],
};
const BEACHES = {
  'Sentosa Beach': ['ripple', '#c3a36d', '#fff4d2'],
  'Changi Coast': ['shingle', '#8d796c', '#ded4bb'],
  'Southern Islands': ['ripple', '#b6a17d', '#f9e9cc'],
  'Pulau Ubin': ['shingle', '#7f855f', '#dfd9b4'],
  'Coney Island': ['ripple', '#8f8064', '#e4d7b4'],
};
const SILT = ['silt', '#514436', '#bdad89'];
const ASPHALT = ['asphalt', '#253543', '#a6c5d3'];
const RESERVOIR_SHORE = ['silt', '#687457', '#c7c4a1'];
const GRAVEL = ['shingle', '#655947', '#cdc7af'];
const SCREE = ['shingle', '#647984', '#d2dde3'];
const FIELD = ['furrows', '#7c6a43', '#c8b681'];

/** A tile's stamped material, independent of canvas and lighting. */
export function districtGroundPlan(world, t, x, y) {
  if (t === T.WATER || t === T.WOOD) return null;
  const region = world.zoneAt?.(x, y);
  if (!region) return null;
  const zone = region.name, earth = t === T.GRASS || t === T.DARKGRASS;
  let material;
  if (transitRoad(region, t, y)) material = ASPHALT;
  else if (t === T.STONE) material = PAVING[zone] || (zone === 'The Celestial Peaks' ? SCREE : null);
  else if (t === T.SAND) {
    material = BEACHES[zone];
    if (zone === 'Sungei Buloh Wetlands') material = SILT;
    if (zone === 'MacRitchie Reservoir' || zone === 'Punggol Waterway') material = RESERVOIR_SHORE;
    if (zone === 'Bukit Timah' || zone === 'Tekong Badlands' || zone === 'Tuas Docklands') material = GRAVEL;
    if (zone === 'The Celestial Peaks') material = SCREE;
  } else if (earth) {
    material = ROOTS[zone];
    if (zone === 'Sungei Buloh Wetlands' && t === T.DARKGRASS) material = SILT;
    if (zone === 'Kranji Farmlands') material = FIELD;
    if (zone === 'Tekong Badlands' || zone === 'Temasek Ruins' || zone === 'The Wilderness') material = GRAVEL;
  } else if (t === T.PATH && zone === 'Mandai Rainforest') material = ROOTS[zone];
  if (!material) return null;
  const strength = districtFade(region, x, y, 3);
  if (!strength) return null;
  const [kind, ink, light, across, down] = material;
  return { kind, ink, light, across, down, strength };
}

function paintSlabs(g, y, sx, sy, p) {
  g.fillStyle = p.ink;
  g.globalAlpha = 0.23 * p.strength;
  // Offset successive courses like laid brick. World coordinates keep a
  // course lined up when it crosses a chunk or tile boundary.
  for (let row = 0; row < TILE; row += p.down) {
    const h = (y * TILE + row) / p.down;
    const offset = (h % 2) * p.across / 2;
    g.fillRect(sx, sy + row, TILE, 0.85);
    for (let col = offset; col < TILE; col += p.across) g.fillRect(sx + col, sy + row, 0.85, p.down);
  }
  g.fillStyle = p.light;
  g.globalAlpha = 0.27 * p.strength;
  for (let row = 1; row < TILE; row += p.down) g.fillRect(sx, sy + row, TILE, 0.7);
}

function paintAsphalt(g, world, x, y, sx, sy, p, low) {
  const path = (dx, dy) => world.terrainAt(x + dx, y + dy) === T.PATH;
  // The lane dashes are painted on the shared edge of the two road tiles,
  // and stop at a corner or gate instead of writing over it.
  if (x % 3 === 1 && path(1, 0) && path(-1, 0) && path(0, 1) && !path(0, -1)) {
    g.fillStyle = '#e0d5ac';
    g.globalAlpha = 0.61 * p.strength;
    g.fillRect(sx + 5, sy + TILE - 2, 22, 1.5);
  }
  if (tileHash(x, y, 812) > (low ? 0.17 : 0.39)) return;
  const cx = sx + 10 + tileHash(x, y, 813) * 12, cy = sy + 9 + tileHash(x, y, 814) * 13;
  const width = 5 + tileHash(x, y, 815) * 4;
  g.fillStyle = p.ink;
  g.globalAlpha = 0.42 * p.strength;
  g.beginPath(); g.moveTo(cx - width, cy + 1);
  g.quadraticCurveTo(cx - width / 2, cy - 5, cx + width / 2, cy - 3);
  g.quadraticCurveTo(cx + width + 3, cy - 0.5, cx + width - 2, cy + 2);
  g.quadraticCurveTo(cx + 1, cy + 6, cx - width, cy + 1); g.fill();
  const lamp = LAMPS.has(world.objectAt?.(x, y - 1)?.objId) || LAMPS.has(world.objectAt?.(x, y + 1)?.objId);
  g.strokeStyle = lamp ? '#e5ba7d' : p.light;
  g.lineWidth = 0.75;
  g.globalAlpha = (lamp ? 0.6 : 0.31) * p.strength;
  g.beginPath(); g.moveTo(cx - width * 0.58, cy); g.quadraticCurveTo(cx + 1, cy - 1.8, cx + width * 0.65, cy - 1.4); g.stroke();
}

function paintNaturalGround(g, x, y, sx, sy, p, low) {
  const h = tileHash(x, y, 803);
  if (h > (low ? 0.21 : 0.43)) return;
  const cx = sx + 10 + tileHash(x, y, 804) * 12, cy = sy + 11 + tileHash(x, y, 805) * 9;
  const flip = tileHash(x, y, 806) > 0.5 ? 1 : -1;
  g.fillStyle = p.ink; g.strokeStyle = p.ink;
  g.lineWidth = p.kind === 'silt' ? 2 : 1;
  g.globalAlpha = (p.kind === 'roots' ? 0.48 : 0.32) * p.strength;
  if (p.kind === 'roots') {
    g.beginPath(); g.moveTo(cx - 7 * flip, cy - 7);
    g.quadraticCurveTo(cx + 2 * flip, cy - 4, cx - flip, cy + 1);
    g.quadraticCurveTo(cx - 3 * flip, cy + 5, cx + 4 * flip, cy + 8);
    g.moveTo(cx - flip, cy + 1); g.quadraticCurveTo(cx + 4 * flip, cy + 4, cx + 8 * flip, cy + 3);
    g.moveTo(cx - flip, cy - 2); g.quadraticCurveTo(cx + 3 * flip, cy - 3, cx + 7 * flip, cy - 1); g.stroke();
    g.fillStyle = p.light;
    g.beginPath(); g.ellipse(cx - 4 * flip, cy + 6, 2.2, 0.95, 0.55 * flip, 0, Math.PI * 2); g.fill();
  } else if (p.kind === 'shingle') {
    g.beginPath();
    g.ellipse(cx - 3, cy, 2.3, 1.2, flip * 0.35, 0, Math.PI * 2);
    g.moveTo(cx + 7, cy + 4); g.ellipse(cx + 5, cy + 4, 1.6, 1.05, flip * 0.3, 0, Math.PI * 2); g.fill();
  } else {
    const slope = p.kind === 'furrows' ? 5 : flip * 1.5;
    for (let i = -1; i <= 1; i++) {
      const py = cy + i * 4;
      g.beginPath(); g.moveTo(cx - 9, py);
      g.quadraticCurveTo(cx - 2, py - 3, cx + 8, py - slope); g.stroke();
      g.strokeStyle = p.light;
      g.beginPath(); g.moveTo(cx - 6, py + 1);
      g.quadraticCurveTo(cx + 1, py - 1, cx + 7, py + 1 - slope); g.stroke();
      g.strokeStyle = p.ink;
    }
  }
}

function paintDistrictGround(g, world, x, y, sx, sy, low) {
  const p = districtGroundPlan(world, world.terrainAt(x, y), x, y);
  if (!p) return;
  if (p.kind === 'slabs') paintSlabs(g, y, sx, sy, p);
  else if (p.kind === 'asphalt') paintAsphalt(g, world, x, y, sx, sy, p, low);
  else paintNaturalGround(g, x, y, sx, sy, p, low);
  g.globalAlpha = 1;
}

// Marina's pale paving runs between the theatre and the railings. Author the
// centre line and widths in the same tiles as the harbour scenery.
const MARINA_PROMENADE = [[184, 168.8, 0], [186.5, 169.07, 0.96], [188.2, 169.07, 1.26],
  [191, 168.55, 1.28], [196, 168.4, 1.29], [199.9, 168.81, 1.32], [202.4, 169.14, 1.24],
  [205.8, 170.13, 1.18], [208.6, 170.67, 0.9], [210.5, 170.71, 0]];
const PROMENADE_JOINTS = { ink: '#857a68', light: '#fff9e9', across: 32, down: 16, strength: 0.85 };

export function marinaPromenadePlan(world, tx0, ty0, tx1, ty1) {
  const anchor = { x: 184, y: 168 };
  const at = world.authoredTile?.(anchor) || anchor;
  const dx = at.x - anchor.x, dy = at.y - anchor.y;
  const left = Math.max(tx0, 184 + dx), right = Math.min(tx1, 211 + dx);
  const top = Math.max(ty0, 166 + dy), bottom = Math.min(ty1, 173 + dy);
  if (left >= right || top >= bottom) return null;
  const points = MARINA_PROMENADE.map(([x, y, half]) => [x + dx, y + dy, half]);
  const tiles = [], paved = new Set();
  for (let x = left; x < right; x++) {
    const next = points.findIndex(([px]) => px >= x + 0.5);
    if (next < 1) continue;
    const [ax, ay, aw] = points[next - 1], [bx, by, bw] = points[next];
    const p = (x + 0.5 - ax) / (bx - ax);
    const cy = ay + p * (by - ay), half = aw + p * (bw - aw);
    for (let y = top; y < bottom; y++) {
      const t = world.terrainAt(x, y);
      const distance = Math.abs(y + 0.5 - cy);
      if (t === T.WATER || t === T.WOOD || distance > half + 0.84) continue;
      tiles.push({ x, y });
      if (distance < half * 0.82) paved.add(y * world.width + x);
    }
  }
  return tiles.length ? { points, tiles, paved } : null;
}

function paintMarinaPromenade(g, points, tiles, ox, oy) {
  const trace = (scale) => {
    g.beginPath();
    const [firstX, firstY] = points[0];
    g.moveTo(firstX * TILE - ox, firstY * TILE - oy);
    for (const [x, y, half] of points) g.lineTo(x * TILE - ox, (y - half * scale) * TILE - oy);
    for (let i = points.length - 1; i >= 0; i--) {
      const [x, y, half] = points[i];
      g.lineTo(x * TILE - ox, (y + half * scale) * TILE - oy);
    }
    g.closePath();
  };
  g.save();
  g.beginPath();
  for (const { x, y } of tiles) g.rect(x * TILE - ox, y * TILE - oy, TILE, TILE);
  g.clip();
  // A few narrow, translucent shoulders let the stone bed into the bank.
  const left = points[0][0], right = points.at(-1)[0];
  for (const [scale, colour, alpha] of [[1.09, '#a7987b', 0.34], [1, '#cdbd9f', 0.74], [0.90, '#e2d7bd', 0.92], [0.76, '#eae0cb', 0.58]]) {
    trace(scale);
    const fade = g.createLinearGradient(left * TILE - ox, 0, right * TILE - ox, 0);
    fade.addColorStop(0, colour + '00');
    fade.addColorStop(0.11, colour);
    fade.addColorStop(0.9, colour);
    fade.addColorStop(1, colour + '00');
    g.fillStyle = fade;
    g.globalAlpha = alpha;
    g.fill();
  }
  trace(0.90);
  g.clip();
  for (const { x, y } of tiles) {
    const sx = x * TILE - ox, sy = y * TILE - oy;
    const strength = Math.min(1, (x + 0.5 - left) / 3, (right - x + 0.5) / 3);
    g.fillStyle = '#937f69';
    g.globalAlpha = (0.045 + tileHash(x, y, 1194) * 0.07) * strength;
    g.fillRect(sx, sy, TILE, TILE);
    paintSlabs(g, y, sx, sy, { ...PROMENADE_JOINTS, strength: 0.85 * strength });
  }
  g.restore();
}

const BAY_LIGHTS = { observation_wheel: '#efbd74', spiky_dome_theatre: '#b9d9dd' };

/** Light from the skyline breaks into short strokes in the bay beyond its quay. */
export function marinaGlintPlan(world, tx0, ty0, tx1, ty1) {
  const out = [];
  for (const o of world.landmarks || []) {
    const colour = BAY_LIGHTS[o.objId];
    if (!colour || o.x < tx0 - 7 || o.x >= tx1 + 6 || o.y < ty0 - 23 || o.y >= ty1) continue;
    const cx = o.x + (o.def.footprint[0] - 1) / 2;
    let start = o.y + 3;
    while (start < o.y + 15 && world.terrainAt(Math.floor(cx), start) !== T.WATER) start++;
    if (start === o.y + 15) continue;
    for (let y = Math.max(ty0, start); y < Math.min(ty1, start + 8); y++) {
      for (let x = Math.max(tx0, Math.floor(cx - 4)); x < Math.min(tx1, Math.ceil(cx + 4)); x++) {
        const side = Math.abs(x - cx), depth = y - start;
        const h = tileHash(x, y, o.objId === 'observation_wheel' ? 1191 : 1192);
        if (h < 0.26 || world.terrainAt(x, y) !== T.WATER || world.objectAt?.(x, y)) continue;
        const a = (1 - depth / 9) * Math.max(0, 1 - side / (2.5 + depth * 0.22)) * (0.16 + h * 0.24);
        if (a < 0.06) continue;
        out.push({ colour, a, x: x * TILE + 4 + h * 8, y: y * TILE + 5 + tileHash(x, y, 1193) * 20, w: 6 + h * 10 });
      }
    }
  }
  return out;
}

// ---------------- Soft edges ----------------

// Which ground spills over which where two meet: a higher rank bleeds its
// texture a little way into a lower neighbour, along a wavy, dithered edge.
// Water is highest, so shores take a soft, uneven waterline. Town paving
// (stone) and bridges (wood) are built surfaces: paving gets a kerb instead
// (kerbPlan), and bridges keep their crisp edges. Exposed rock in the Peaks
// takes soft edges on all sides, where grass and scree spill over it.
export const BLEND_RANK = {
  [TERRAIN.GRASS]: 1, [TERRAIN.DARKGRASS]: 2, [TERRAIN.SAND]: 3, [TERRAIN.PATH]: 4, [TERRAIN.WATER]: 5,
};
// The one ground that does spill onto paving: a dirt road running in through a
// town's gate, so the gap in the kerb isn't a hard-cut rectangle.
const ONTO_STONE = new Set([TERRAIN.PATH]);
export const FEATHER = 14;    // how far (px) a neighbour's ground reaches into a tile
const WOBBLE = 4.5;           // how far (px) the edge wanders either way
const VARIANTS = 4;           // wobble patterns per edge shape, picked per tile
// Neighbours as bits: the four sides, then the four corners.
const NB = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

/**
 * How a tile blends with its neighbours: for each higher-ranked ground next
 * to it (lowest rank first, so water lands on top), which sides and corners it
 * touches and which wobble pattern to use. Empty for most tiles.
 */
export function blendPlan(world, x, y) {
  const t = world.terrainAt(x, y), stone = t === TERRAIN.STONE;
  const r = stone ? 0 : BLEND_RANK[t];
  if (r === undefined) return [];
  const paved = stone && !naturalStone(world, x, y);
  let found = null;
  for (let i = 0; i < 8; i++) {
    const nt = world.terrainAt(x + NB[i][0], y + NB[i][1]);
    if (paved ? ONTO_STONE.has(nt) : (BLEND_RANK[nt] || 0) > r) (found || (found = new Map())).set(nt, (found.get(nt) || 0) | (1 << i));
  }
  if (!found) return [];
  const out = [];
  for (const [t, bits] of found) {
    out.push({ t, bits: pruneCorners(bits), v: Math.floor(tileHash(x, y, 31 + t) * VARIANTS) });
  }
  return out.sort((a, b) => BLEND_RANK[a.t] - BLEND_RANK[b.t]);
}

// A corner only matters when neither side next to it already blends: then the
// neighbour's ground pokes in as a rounded quarter-circle.
function pruneCorners(b) {
  if (b & 0b11) b &= ~(1 << 4);          // NE: N or E
  if (b & 0b110) b &= ~(1 << 5);         // SE: E or S
  if (b & 0b1100) b &= ~(1 << 6);        // SW: S or W
  if (b & 0b1001) b &= ~(1 << 7);        // NW: W or N
  return b;
}

// The wander of an edge along its length: a few sine humps that are zero at
// both ends, so neighbouring tiles' edges always meet without a step.
function wobble(u, v, side) {
  let n = 0;
  for (let k = 1; k <= 3; k++) n += (tileHash(v, side, k) * 2 - 1) * (WOBBLE / k) * Math.sin(k * Math.PI * u / TILE);
  return n;
}
const ramp = (d) => { const a = Math.max(0, Math.min(1, 1 - d / FEATHER)); return a * a * (3 - 2 * a); };

/**
 * The blend mask for one edge shape: TILE x TILE coverage values (0..1) of the
 * neighbour's ground over this tile. Feathered from each touching side or
 * corner, wavy, with a light dither so it reads as painted rather than airbrushed.
 */
export function blendMask(bits, v) {
  const m = new Float32Array(TILE * TILE);
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const fx = px + 0.5, fy = py + 0.5;
      // Sides and corners combine as a soft union rather than the greater of
      // the two, so where two sides meet the ground's corner comes out rounded.
      let k = 1;
      if (bits & 1) k *= 1 - ramp(fy - wobble(fx, v, 0));
      if (bits & 2) k *= 1 - ramp(TILE - fx - wobble(fy, v, 1));
      if (bits & 4) k *= 1 - ramp(TILE - fy - wobble(fx, v, 2));
      if (bits & 8) k *= 1 - ramp(fx - wobble(fy, v, 3));
      if (bits & 16) k *= 1 - ramp(Math.hypot(TILE - fx, fy) - 2);
      if (bits & 32) k *= 1 - ramp(Math.hypot(TILE - fx, TILE - fy) - 2);
      if (bits & 64) k *= 1 - ramp(Math.hypot(fx, TILE - fy) - 2);
      if (bits & 128) k *= 1 - ramp(Math.hypot(fx, fy) - 2);
      let a = 1 - k;
      if (a > 0.02 && a < 0.98) a = Math.max(0, Math.min(1, a + (tileHash(px, py, 97 + v) - 0.5) * 0.16));
      m[py * TILE + px] = a;
    }
  }
  return m;
}

// Shoreline foam sits along the soft waterline (where the water's coverage is
// about half), in two frames a little apart that cross-fade, so it laps.
const FOAM_AT = [0.52, 0.74];
function foamAlpha(a, frame) {
  if (a <= 0.03) return 0;
  const d = (a - FOAM_AT[frame]) / 0.11;
  return Math.min(1, Math.exp(-d * d) * 1.1);
}

// Use the same curved edge as the terrain blend. The dry lip catches light
// just before the edge, with a soft bank shadow falling over the lower side.
const BANK_STRENGTH = { [TERRAIN.PATH]: 0.92, [TERRAIN.SAND]: 0.72, [TERRAIN.WATER]: 1 };
const SEAM_GRASS = new Set([TERRAIN.GRASS, TERRAIN.DARKGRASS]);
function ridge(a, centre, width) {
  const t = Math.max(0, 1 - Math.abs(a - centre) / width);
  return t * t * (3 - 2 * t);
}
export function bankRelief(a) {
  return 0.29 * ridge(a, 0.59, 0.36) - 0.24 * ridge(a, 0.23, 0.19);
}

// ---------------- Kerbs ----------------

// Where town paving meets grass or sand it gets a sticker-style kerb: a cream
// band along the paving's edge with a thin navy hairline on the outside, its
// outer corners rounded off, so a plaza reads as one die-cut shape rather than
// a block of square tiles. (Roads spill onto the paving instead: ONTO_STONE.)
const KERBED = new Set([TERRAIN.GRASS, TERRAIN.DARKGRASS, TERRAIN.SAND]);
export const KERB_R = 7;   // px: the radius of a rounded outer corner

/**
 * The kerbs of the paving tiles on or just round tiles [tx0, tx1) x [ty0, ty1)
 * (one tile of margin, so a kerb that crosses a chunk edge is drawn on both
 * sides): [{ x, y, sides, round, cave, out }]. `sides` are the kerbed sides
 * (N, E, S, W as bits 1, 2, 4, 8), `round` the outer corners where two kerbed
 * sides meet (NE, SE, SW, NW as 1, 2, 4, 8), `cave` the inner corners where
 * the ground beyond only touches diagonally, and `out` the ground beyond each
 * side (for filling a rounded corner).
 */
export function kerbPlan(world, tx0, ty0, tx1, ty1) {
  const out = [];
  const S = TERRAIN.STONE;
  for (let y = ty0 - 1; y < ty1 + 1; y++) {
    for (let x = tx0 - 1; x < tx1 + 1; x++) {
      if (world.terrainAt(x, y) !== S || naturalStone(world, x, y)) continue;
      let sides = 0, cave = 0;
      const beyond = [];
      for (let i = 0; i < 4; i++) {
        const t = world.terrainAt(x + NB[i][0], y + NB[i][1]);
        beyond.push(t);
        if (KERBED.has(t)) sides |= 1 << i;
      }
      // An inner corner: paving on both sides, kerbed ground only on the diagonal.
      for (let i = 0; i < 4; i++) {
        const a = i, b = (i + 1) % 4;   // N+E -> NE (NB[4]), E+S -> SE, S+W -> SW, W+N -> NW
        if (beyond[a] === S && beyond[b] === S && KERBED.has(world.terrainAt(x + NB[4 + i][0], y + NB[4 + i][1]))) cave |= 1 << i;
      }
      if (!sides && !cave) continue;
      // A corner rounds where two kerbs meet, and where a kerb ends at a road
      // coming in (a gatepost), so the kerb curls in rather than stopping dead.
      let round = 0;
      const P = TERRAIN.PATH;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4, ki = sides & (1 << i), kj = sides & (1 << j);
        if ((ki && kj) || (ki && beyond[j] === P) || (kj && beyond[i] === P)) round |= 1 << i;
      }
      out.push({ x, y, sides, round, cave, out: beyond });
    }
  }
  return out;
}

// [line width, inset from the tile's edge, colour] of the kerb's strokes: the
// cream band, the navy hairline on its outside, a faint lip of shade inside.
const KERB_STROKES = [[4.4, 3, 'rgba(255,248,234,0.97)'], [1.2, 0.65, 'rgba(61,54,66,0.58)'], [1.2, 5.8, 'rgba(120,90,60,0.21)']];
// The near-facing edge drops below the top, tapering into the side edges.
const KERB_FACE = [[9, 4, 'rgba(44,61,72,0.10)'], [5, 3.2, '#b3916e']];
const KERB_COLOURS = {
  [TRANSIT]: ['#c7cec9', '#465961', 'rgba(40,61,68,0.25)'],
  'Kampong Glam': ['#efd6aa', '#744a37', 'rgba(110,64,42,0.24)'],
  Chinatown: ['#e5c6a2', '#70453f', 'rgba(110,64,42,0.24)'],
  'Marina Bay': ['#fbf6e8', '#808f92', 'rgba(58,77,90,0.19)'],
};
// Corner i of the tile at (sx, sy) (NE, SE, SW, NW): its point, and which way is into the tile.
function corner(sx, sy, i) {
  const cx = i < 2 ? 1 : 0, cy = i === 1 || i === 2 ? 1 : 0;
  return [sx + cx * TILE, sy + cy * TILE, cx ? -1 : 1, cy ? -1 : 1];
}
// Trace a kerb's line `d` px in from the tile's kerbed sides: straight along
// each side, a quarter circle round each rounded corner.
function kerbPath(g, k, sx, sy, d, front = false) {
  const R = KERB_R, T = TILE;
  const r = (i) => k.round & (1 << i);
  const sides = front ? k.sides & 4 : k.sides;
  if (sides & 1) { g.moveTo(sx + (r(3) ? R : 0), sy + d); g.lineTo(sx + T - (r(0) ? R : 0), sy + d); }
  if (sides & 2) { g.moveTo(sx + T - d, sy + (r(0) ? R : 0)); g.lineTo(sx + T - d, sy + T - (r(1) ? R : 0)); }
  if (sides & 4) { g.moveTo(sx + (r(2) ? R : 0), sy + T - d); g.lineTo(sx + T - (r(1) ? R : 0), sy + T - d); }
  if (sides & 8) { g.moveTo(sx + d, sy + (r(3) ? R : 0)); g.lineTo(sx + d, sy + T - (r(2) ? R : 0)); }
  for (let i = 0; i < 4; i++) {
    if (!r(i) || (front && i !== 1 && i !== 2)) continue;
    const [px, py, dx, dy] = corner(sx, sy, i);
    const cx = px + dx * R, cy = py + dy * R;
    // From the north or south side round to the east or west one, the short way.
    const a0 = Math.atan2(-dy, 0), a1 = Math.atan2(0, -dx);
    let dl = a1 - a0;
    if (dl > Math.PI) dl -= 2 * Math.PI;
    if (dl <= -Math.PI) dl += 2 * Math.PI;
    g.moveTo(cx + Math.cos(a0) * (R - d), cy + Math.sin(a0) * (R - d));
    g.arc(cx, cy, R - d, a0, a0 + dl * (front ? 0.54 : 1), dl < 0);
  }
}

// ---------------- Ground details ----------------

// The small things scattered on the ground, drawn in the A-Worthy sticker
// style (soft shapes, navy ink edge). Each can be replaced by painted art:
// add assets/world/detail-<id>.webp and list the id in DETAIL_ART.
// [width, height] is the size it is drawn at, in px, with its foot at the bottom centre.
export const GROUND_DETAILS = {
  tuft: [11, 9], tuft_dark: [11, 9], flower_pink: [8, 8], flower_yellow: [8, 8], flower_white: [8, 8],
  flower_lilac: [8, 8], leaf_green: [8, 6], leaf_brown: [8, 6], pebble: [6, 4], stone: [9, 5],
  shell: [7, 6], shell_spiral: [6, 6], lily_pad: [13, 9], lily_flower: [13, 10], reed: [10, 17],
  // Town paving: Peranakan tiles laid in little rugs, drain grates, fallen
  // petals by the flowerbeds and the faint pool of shade in front of a lamp post.
  drain: [16, 9], petals: [12, 7], lamp_pool: [26, 12],
};
// The Peranakan tile rugs' colourways ([ground, motif]): rug_<colour>, each a
// 2 x 2 of tiles in a cream frame, two tiles across.
const RUGS = { bloom: ['#F9DCE3', '#E9809E'], sky: ['#DCEAF6', '#6FA9DA'], sun: ['#F8EBCB', '#E9AE34'], mint: ['#DDEFE2', '#5FB27A'] };
const RUG_IDS = Object.keys(RUGS).map((c) => `rug_${c}`);
for (const id of RUG_IDS) GROUND_DETAILS[id] = [60, 60];
/** Ground details that have painted art on disk (assets/world/detail-<id>.webp). */
export const DETAIL_ART = {};
export const groundDetailArt = () => new Set(Object.keys(DETAIL_ART).map((id) => `detail-${id}`));

export const FOREST = new Set(['Bukit Timah', 'Jurong Forest', 'Mandai Rainforest', 'Coney Island', 'Sungei Buloh Wetlands']);
export const BEACH = new Set(['Sentosa Beach', 'Southern Islands', 'Changi Coast', 'Pulau Ubin', 'Coney Island']);
const BLOOMS = new Set(['Kampong Glam', 'Gardens by the Bay', 'Kranji Farmlands', 'Chinatown', 'Marina Bay']);
export const BLEAK = new Set(['The Wilderness', 'The Shadow Rift', 'Tekong Badlands', 'Pulau Hantu', 'Temasek Ruins']);
// Fresh water, where lily pads and reeds grow (not the open sea).
export const FRESH = new Set(['MacRitchie Reservoir', 'Sungei Buloh Wetlands', 'Punggol Waterway', 'Kranji Farmlands',
  'Gardens by the Bay', 'Mandai Rainforest', 'Pulau Hantu', 'Jurong Forest', 'Bukit Timah']);

const FLOWERS = [['flower_pink', 1], ['flower_yellow', 1], ['flower_white', 1], ['flower_lilac', 0.6]];
/** What grows on a ground type in a region: [[detail, weight], ...] and a density (details per tile). */
export function detailTable(t, zone) {
  const T = TERRAIN;
  if (t === T.GRASS || t === T.DARKGRASS) {
    const dark = t === T.DARKGRASS;
    if (BLEAK.has(zone)) return { d: 0.32, w: [['tuft_dark', 4], ['leaf_brown', 3], ['pebble', 1.5]] };
    if (FOREST.has(zone)) return { d: 0.5, w: [[dark ? 'tuft_dark' : 'tuft', 5], ['leaf_brown', 3], ['leaf_green', 2.5], ...FLOWERS.map(([k, n]) => [k, n * 0.25])] };
    if (zone === 'The Celestial Peaks') return { d: 0.3, w: [['tuft', 3], ['pebble', 3], ['flower_white', 0.6]] };
    const bloom = BLOOMS.has(zone) ? 0.8 : 0.4;
    return { d: 0.38, w: [[dark ? 'tuft_dark' : 'tuft', 5], ['leaf_green', 1], ['pebble', 0.4], ...FLOWERS.map(([k, n]) => [k, n * bloom])] };
  }
  if (t === T.SAND) {
    if (zone === 'Changi Coast') return { d: 0.34, w: [['pebble', 4], ['stone', 2], ['shell', 1]] };
    if (zone === 'Sungei Buloh Wetlands' || zone === 'MacRitchie Reservoir') return { d: 0.22, w: [['leaf_brown', 3], ['pebble', 2]] };
    if (BEACH.has(zone)) return { d: 0.3, w: [['shell', 3], ['shell_spiral', 1.5], ['pebble', 2]] };
    return { d: 0.22, w: [['pebble', 3], ['shell', 0.6], ['stone', 0.8]] };
  }
  if (t === T.PATH) return { d: 0.3, w: [['stone', 2], ['pebble', 2.5]] };
  // Paving: the odd drain grate (ruins and wild places keep theirs plain).
  // Tile rugs, petals and lamp pools are placed by plazaDetail instead.
  if (t === T.STONE) {
    if (zone === 'The Celestial Peaks') return { d: 0.18, w: [['pebble', 3], ['stone', 1]] };
    return BLEAK.has(zone) ? null : { d: 0.03, w: [['drain', 1]] };
  }
  return null;
}
// Objects that drop petals on the paving round them, and lamps that leave a pool of shade.
const BEDS = new Set(['flower', 'bush', 'orchid_planter', 'bougainvillea_pot', 'planter_box']);
const LAMPS = new Set(['lamp', 'heritage_lamp', 'lantern_post']);
const RUG_TOWNS = new Set(['Kampong Glam', 'Chinatown', 'Kranji Farmlands']);
function pick(w, r) {
  let sum = 0;
  for (const [, n] of w) sum += n;
  let k = r * sum;
  for (const [id, n] of w) { k -= n; if (k <= 0) return id; }
  return w[w.length - 1][0];
}

/**
 * The ground details for tiles [tx0, tx1) x [ty0, ty1): [{ id, px, py, flip, s }]
 * in world pixels (foot point). Never on a tile with an object, on water or
 * bridges; town paving only gets its own flat details (plazaDetail); paths
 * only get stones along their verges, so the walking line down a road stays
 * clear. Low graphics plants half as many.
 */
export function scatterPlan(world, tx0, ty0, tx1, ty1, opts = {}) {
  const out = [];
  const T = TERRAIN;
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      const t = world.terrainAt(x, y);
      if (t === T.WATER || t === T.WOOD) continue;
      if (opts.paved?.has(y * world.width + x)) continue;
      if (world.objectAt(x, y)) continue;
      if (t === T.STONE && !naturalStone(world, x, y)) { plazaDetail(world, x, y, opts, out); continue; }
      // A road's verge is the side facing off the road; the middle stays clear.
      let vx = 0, vy = 0;
      if (t === T.PATH) {
        for (const [dx, dy] of NB.slice(0, 4)) if (world.terrainAt(x + dx, y + dy) !== T.PATH) { vx += dx; vy += dy; }
        if (!vx && !vy) continue;
      }
      const z = world.zoneAt ? world.zoneAt(x, y) : null;
      const tab = detailTable(t, z ? z.name : '');
      if (!tab) continue;
      const d = tab.d * (opts.low ? 0.5 : 1);
      for (let i = 0; i < 2; i++) {
        if (tileHash(x, y, 200 + i) >= d * (i ? 0.45 : 1)) continue;
        const id = pick(tab.w, tileHash(x, y, 300 + i));
        let fx = 5 + tileHash(x, y, 400 + i) * (TILE - 10), fy = 8 + tileHash(x, y, 500 + i) * (TILE - 12);
        if (t === T.PATH) {   // pushed out to the verge
          if (vx) fx = vx > 0 ? TILE - 4 - tileHash(x, y, 600) * 6 : 4 + tileHash(x, y, 600) * 6;
          if (vy) fy = vy > 0 ? TILE - 3 - tileHash(x, y, 601) * 5 : 6 + tileHash(x, y, 601) * 5;
        }
        out.push({ id, px: x * TILE + fx, py: y * TILE + fy, flip: tileHash(x, y, 700 + i) < 0.5, s: 0.85 + tileHash(x, y, 800 + i) * 0.3 });
      }
    }
  }
  return out;
}

// One paving tile's detail, if any: a pool of shade just in front of a lamp
// post, petals fallen beside a flowerbed, a Peranakan tile rug, or now and then
// a drain. Each lies flat within the paving (a rug starts on its top-left tile
// and covers four), never over a chunk's edge, so no chunk border cuts one.
const RUG = 8;   // the paving is split into RUG x RUG blocks (a chunk holds whole ones); some hold a rug
function plazaDetail(world, x, y, opts, out) {
  const T = TILE, k = opts.low ? 0.5 : 1;
  const obj = (dx, dy) => { const o = world.objectAt(x + dx, y + dy); return o && o.def ? o.objId : null; };
  if (LAMPS.has(obj(0, -1))) {
    out.push({ id: 'lamp_pool', px: x * T + T / 2, py: y * T + 13, flip: tileHash(x, y, 710) < 0.5, s: 0.95 });
    return;
  }
  if (tileHash(x, y, 210) < 0.42 * k) {
    let bed = false;
    for (let i = 0; i < 8 && !bed; i++) bed = BEDS.has(obj(NB[i][0], NB[i][1]));
    if (bed) {
      out.push({ id: 'petals', px: x * T + 9 + tileHash(x, y, 410) * 14, py: y * T + 12 + tileHash(x, y, 510) * 16,
        flip: tileHash(x, y, 711) < 0.5, s: 0.85 + tileHash(x, y, 811) * 0.3 });
      return;
    }
  }
  const z = world.zoneAt ? world.zoneAt(x, y) : null;
  const tab = detailTable(TERRAIN.STONE, z ? z.name : '');
  if (!tab) return;
  // A rug, a little way into its block (so two never touch), on clear paving only.
  const bx = Math.floor(x / RUG), by = Math.floor(y / RUG);
  if (RUG_TOWNS.has(z?.name) && tileHash(bx, by, 220) < 0.5 * k && x === bx * RUG + 1 + Math.floor(tileHash(bx, by, 221) * (RUG - 3))
    && y === by * RUG + 1 + Math.floor(tileHash(bx, by, 222) * (RUG - 3))) {
    let clear = true;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) if (world.terrainAt(x + dx, y + dy) !== TERRAIN.STONE || obj(dx, dy)) clear = false;
    if (clear) {
      out.push({ id: RUG_IDS[Math.floor(tileHash(bx, by, 223) * RUG_IDS.length)], px: x * T + T, py: y * T + 2 * T - 2, flip: false, s: 1 });
      return;
    }
  }
  if (tileHash(x, y, 200) >= tab.d * k) return;
  const id = pick(tab.w, tileHash(x, y, 300));
  out.push({ id, px: x * T + T / 2 + (tileHash(x, y, 400) - 0.5) * 8, py: y * T + T / 2 + 6, flip: false, s: 1 });
}

/** Is tile (x, y) water that is part of a lake, river or wetland (not the open sea)? */
function freshWater(world, x, y) {
  const z = world.zoneAt ? world.zoneAt(x, y) : null;
  return !!z && FRESH.has(z.name);
}

function shoreFoam(world, x, y) {
  const zone = world.zoneAt?.(x, y)?.name;
  if (zone === 'Sungei Buloh Wetlands') return 0.24;
  if (zone === 'Sentosa Beach') return 0.93;
  if (zone === 'Changi Coast') return 0.66;
  return FRESH.has(zone) ? 0.44 : 0.78;
}

/**
 * Lily pads and reeds for tiles [tx0, tx1) x [ty0, ty1): [{ id, px, py, flip, s, ph }].
 * Reeds stand in the shallows right at the bank; lily pads float a little way
 * out (within three tiles of land). Only in fresh water, never on a fishing spot.
 */
export function waterDetailPlan(world, tx0, ty0, tx1, ty1) {
  const out = [];
  const W = TERRAIN.WATER;
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      if (world.terrainAt(x, y) !== W || world.objectAt(x, y) || !freshWater(world, x, y)) continue;
      let bx = 0, by = 0;
      for (const [dx, dy] of NB.slice(0, 4)) if (world.terrainAt(x + dx, y + dy) !== W && world.inBounds?.(x + dx, y + dy) !== false) { bx += dx; by += dy; }
      const h = tileHash(x, y, 900);
      if ((bx || by) && h < 0.34) {
        // Reeds lean against the bank they grow from.
        const fx = TILE / 2 + bx * 9 + (tileHash(x, y, 901) - 0.5) * 10, fy = TILE / 2 + 6 + by * 7 + (tileHash(x, y, 902) - 0.5) * 6;
        out.push({ id: 'reed', px: x * TILE + fx, py: y * TILE + fy, flip: tileHash(x, y, 903) < 0.5, s: 0.85 + tileHash(x, y, 904) * 0.35, ph: h * 40 });
        continue;
      }
      if (h > 0.86 && world.zoneAt?.(x, y)?.name !== 'Sungei Buloh Wetlands') {
        let near = false;
        for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) if (world.terrainAt(x + dx, y + dy) !== W) { near = true; break; }
        if (!near) continue;
        out.push({ id: h > 0.965 ? 'lily_flower' : 'lily_pad', px: x * TILE + 7 + tileHash(x, y, 905) * 18, py: y * TILE + 10 + tileHash(x, y, 906) * 16,
          flip: tileHash(x, y, 907) < 0.5, s: 0.8 + tileHash(x, y, 908) * 0.45, ph: h * 40 });
      }
    }
  }
  return out;
}

// ---------------- Contact shadows and ambient occlusion ----------------

// Soft shadows under objects, by kind: [half-width, half-height, drop below
// the tile centre, strength]. Fires, farm patches and fishing spots get none
// (they flicker, grow or float).
const SHADOW = {
  tree: [24, 10, 14, 0.49], rock: [16, 6, 12, 0.32], bush: [15, 6, 12, 0.28], flower: [10, 4, 12, 0.24],
  palm: [17, 7, 14, 0.35], lamp: [7, 3, 13, 0.2], sign: [8, 3, 12, 0.18], fence: [18, 5, 12, 0.18],
  wall: [20, 7, 12, 0.34], ruin: [21, 8, 12, 0.34], building: [26, 9.5, 14, 0.36], small: [13, 5, 11, 0.2],
};
const NO_SHADOW = new Set(['fire', 'farm', 'fishing']);
// Objects that are walls or buildings darken the ground beside them a little.
const OCCLUDERS = new Set(['wall', 'building']);
function shadowKind(o) {
  const t = o.def.type;
  if (NO_SHADOW.has(t)) return null;
  if (t === 'tree' || t === 'rock') return t;
  if (t === 'scenery') return foliageKind(o) ?? (SHADOW[o.objId] ? o.objId : 'small');
  if (t === 'hunt') return 'small';
  return 'building';
}

/** Contact shadows for objects on or just around tiles [tx0, tx1) x [ty0, ty1): [{ kind, cx, cy, rx, ry, a, ao }]. */
export function shadowPlan(world, tx0, ty0, tx1, ty1) {
  const out = [];
  // One tile of margin, so a shadow that spills over a chunk edge is baked on both sides.
  for (let y = ty0 - 1; y < ty1 + 1; y++) {
    for (let x = tx0 - 1; x < tx1 + 1; x++) {
      const o = world.objectAt && world.inBounds?.(x, y) !== false ? world.objectAt(x, y) : null;
      if (!o || !o.def) continue;
      const kind = shadowKind(o);
      if (!kind) continue;
      const [rx, ry, dy, a] = SHADOW[kind];
      out.push({ kind, x, y, cx: x * TILE + TILE / 2, cy: y * TILE + TILE / 2 + dy, rx, ry, a, ao: OCCLUDERS.has(kind) });
    }
  }
  return out;
}

// ---------------- Canvas helpers ----------------

const INK = 'rgba(34,48,74,0.62)';
function makeCanvas(w, h, factory) {
  try {
    const c = factory ? factory(w, h) : (typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null);
    if (!c) return null;
    c.width = w; c.height = h;
    const g = c.getContext && c.getContext('2d');
    return g ? { c, g } : null;
  } catch { return null; }
}

// Draw one procedural ground detail with its foot at (0, 0), in the sticker style.
function drawDetail(g, id) {
  g.lineWidth = 0.8; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
  const blob = (fill, f) => { g.beginPath(); f(); g.fillStyle = fill; g.fill(); g.stroke(); };
  switch (id) {
    case 'tuft': case 'tuft_dark': {
      const [c1, c2] = id === 'tuft' ? ['#86C97A', '#B9E39A'] : ['#5E9F66', '#86BF7E'];
      for (const [bx, h, lean] of [[-3.2, 6, -2.4], [3.2, 6.4, 2.4], [-1, 8, -0.8], [1.4, 7.4, 1]]) {
        blob(bx < 0 ? c1 : c2, () => { g.moveTo(bx - 1.4, 0); g.quadraticCurveTo(bx + lean * 0.4, -h * 0.6, bx + lean, -h); g.quadraticCurveTo(bx + lean * 0.2 + 0.6, -h * 0.5, bx + 1.4, 0); g.closePath(); });
      }
      break;
    }
    case 'flower_pink': case 'flower_yellow': case 'flower_white': case 'flower_lilac': {
      const petal = { flower_pink: '#F7A8C0', flower_yellow: '#FFD45C', flower_white: '#FFFFFF', flower_lilac: '#C9B6F0' }[id];
      g.strokeStyle = 'rgba(70,140,80,0.9)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -3); g.stroke();
      g.strokeStyle = INK;
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; blob(petal, () => g.arc(Math.cos(a) * 1.7, -4.4 + Math.sin(a) * 1.7, 1.35, 0, 6.3)); }
      g.fillStyle = id === 'flower_yellow' ? '#F08A3C' : '#F5B82E'; g.beginPath(); g.arc(0, -4.4, 1, 0, 6.3); g.fill();
      break;
    }
    case 'leaf_green': case 'leaf_brown': {
      blob(id === 'leaf_green' ? '#9AD27A' : '#D9A066', () => { g.moveTo(-3.6, -1.6); g.quadraticCurveTo(0, -5, 3.6, -2.4); g.quadraticCurveTo(0, 0.8, -3.6, -1.6); });
      g.strokeStyle = 'rgba(34,48,74,0.35)'; g.beginPath(); g.moveTo(-3, -1.7); g.lineTo(3, -2.3); g.stroke();
      break;
    }
    case 'pebble': case 'stone': {
      const [w, h, c] = id === 'pebble' ? [2.6, 1.7, '#C9C3BA'] : [4, 2.2, '#DCCDB2'];
      blob(c, () => g.ellipse(0, -h, w, h, 0, 0, 6.3));
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-w * 0.3, -h * 1.35, w * 0.35, h * 0.3, 0, 0, 6.3); g.fill();
      break;
    }
    case 'shell': {
      g.strokeStyle = 'rgba(150,80,70,0.7)';
      blob('#FFC2AE', () => { g.moveTo(0, 0); g.arc(0, -0.6, 3.6, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); });
      g.strokeStyle = 'rgba(200,110,90,0.55)';
      for (const a of [-0.55, -0.2, 0.2, 0.55]) { g.beginPath(); g.moveTo(0, -0.3); g.lineTo(Math.sin(a) * 3, -1 - Math.cos(a) * 3); g.stroke(); }
      break;
    }
    case 'shell_spiral': {
      g.strokeStyle = 'rgba(150,100,60,0.7)';
      blob('#FFE6B8', () => g.arc(0, -2.6, 2.6, 0, 6.3));
      g.strokeStyle = 'rgba(190,120,70,0.7)'; g.beginPath();
      for (let i = 0; i <= 14; i++) { const a = i * 0.7, r = 2.3 - i * 0.15; g.lineTo(Math.cos(a) * r, -2.6 + Math.sin(a) * r); }
      g.stroke();
      break;
    }
    case 'lily_pad': case 'lily_flower': {
      blob('#7CC487', () => { g.moveTo(0, -4); g.arc(0, -4, 5.5, 0.35, Math.PI * 2 - 0.05); g.closePath(); });
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(0, -4, 3, 3.6, 4.6); g.stroke();
      g.strokeStyle = INK;
      if (id === 'lily_flower') {
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; blob(i % 2 ? '#FFD1E0' : '#F7A8C0', () => g.ellipse(-1 + Math.cos(a) * 1.6, -5 + Math.sin(a) * 1.3, 1.5, 1.1, a, 0, 6.3)); }
        g.fillStyle = '#FFD45C'; g.beginPath(); g.arc(-1, -5, 0.9, 0, 6.3); g.fill();
      }
      break;
    }
    case 'reed': {
      for (const [bx, h, lean] of [[-2.6, 12, -1.6], [0, 15, 0.4], [2.6, 11, 1.8]]) {
        g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.moveTo(bx, 0); g.quadraticCurveTo(bx + lean * 0.3, -h * 0.5, bx + lean, -h); g.stroke();
        g.strokeStyle = '#8FBF6A'; g.lineWidth = 1.1; g.stroke();
      }
      g.lineWidth = 0.8; g.strokeStyle = INK;
      blob('#B07A4E', () => g.ellipse(0.4, -12.5, 1.3, 2.6, 0.03, 0, 6.3));
      blob('#B07A4E', () => g.ellipse(2.2, -8.6, 1.1, 2.1, 0.12, 0, 6.3));
      blob('#9BCB78', () => { g.moveTo(-1, -1); g.quadraticCurveTo(-5, -4, -5.5, -7); g.quadraticCurveTo(-3, -4.5, 0.5, -1.5); g.closePath(); });
      break;
    }
    case 'drain': {
      // A little iron drain grate set into the paving.
      blob('#A9B0BE', () => g.roundRect ? g.roundRect(-7.5, -8.5, 15, 8, 1.8) : g.rect(-7.5, -8.5, 15, 8));
      g.fillStyle = 'rgba(34,48,74,0.6)';
      for (let i = 0; i < 5; i++) g.fillRect(-5.6 + i * 2.6, -7, 1.2, 4.8);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-6.4, -8, 12.8, 0.7);
      break;
    }
    case 'petals': {
      // Orchid petals fallen from the bed next door.
      g.lineWidth = 0.5; g.strokeStyle = 'rgba(150,70,100,0.55)';
      for (const [px, py, a, col] of [[-3.6, -2.4, 0.4, '#F7A8C0'], [1.2, -4.6, -0.7, '#FFD1E0'], [3.8, -1.8, 1.2, '#E58FB6'], [-0.6, -1.2, 2.2, '#FFFFFF']]) {
        blob(col, () => g.ellipse(px, py, 1.7, 1.05, a, 0, 6.3));
      }
      break;
    }
    case 'lamp_pool': {
      // The soft pool of shade a lamp post's head throws on the paving in front of it.
      if (!g.createRadialGradient) break;
      g.save(); g.scale(1, 0.42);
      const rg = g.createRadialGradient(0, -14, 0, 0, -14, 12);
      rg.addColorStop(0, 'rgba(120,80,60,0.20)'); rg.addColorStop(0.6, 'rgba(120,80,60,0.10)'); rg.addColorStop(1, 'rgba(120,80,60,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(0, -14, 12, 0, 6.3); g.fill();
      g.restore();
      break;
    }
    default: {
      if (!id.startsWith('rug_')) break;
      // A rug of four Peranakan tiles set into the paving, seen from above: a
      // cream frame with a navy hairline (the kerb's sticker edge again), a
      // quarter-circle at each tile's corners that meet as full circles where
      // tiles join, and a little flower in each tile.
      const [bg, pop] = RUGS[id.slice(4)];
      const c = -30, q = 12.75;
      const rr = (x, y, w, h, r) => { if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
      g.globalAlpha = 0.85;
      blob('#FFF6E6', () => rr(-29, c - 29, 58, 58, 4));
      g.fillStyle = bg; g.beginPath(); g.rect(-25.5, c - 25.5, 51, 51); g.fill();
      g.save(); g.beginPath(); g.rect(-25.5, c - 25.5, 51, 51); g.clip();
      g.fillStyle = pop; g.globalAlpha = 0.5;
      for (const sx of [-2, 0, 2]) for (const sy of [-2, 0, 2]) { g.beginPath(); g.arc(sx * q, c + sy * q, 5, 0, 6.3); g.fill(); }
      g.globalAlpha = 0.85;
      g.strokeStyle = 'rgba(34,48,74,0.2)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(0, c - 26); g.lineTo(0, c + 26); g.moveTo(-26, c); g.lineTo(26, c); g.stroke();
      g.lineWidth = 0.5; g.strokeStyle = 'rgba(34,48,74,0.4)';
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        // A rosette: eight round petals about a white heart with a gold eye.
        for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4; blob(pop, () => g.arc(sx * q + Math.cos(t) * 3.8, c + sy * q + Math.sin(t) * 3.8, 1.9, 0, 6.3)); }
        blob('#FFFFFF', () => g.arc(sx * q, c + sy * q, 2.2, 0, 6.3));
        g.fillStyle = '#F5B82E'; g.beginPath(); g.arc(sx * q, c + sy * q, 1, 0, 6.3); g.fill();
      }
      g.restore();
      g.lineWidth = 0.8; g.strokeStyle = 'rgba(34,48,74,0.4)'; g.beginPath(); g.rect(-25.5, c - 25.5, 51, 51); g.stroke();
      g.globalAlpha = 1;
    }
  }
}

// ---------------- The baker ----------------

const DETAIL_SCALE = 2;   // details are drawn at twice size and shrunk, for smooth edges

// Foam is tracked in blocks of FOAM_CELL x FOAM_CELL tiles, so the water layer
// copies the few blocks along a shore instead of the whole 1024px chunk.
export const FOAM_CELL = 4;

/** The foam blocks of a chunk (keys row * 1024 + col) as rectangles in chunk
 *  pixels [x, y, w, h], neighbouring blocks in a row merged into one. */
export function foamRects(cells, wTiles, hTiles) {
  const out = [];
  const cols = Math.ceil(wTiles / FOAM_CELL), rows = Math.ceil(hTiles / FOAM_CELL), C = FOAM_CELL * TILE;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!cells.has(r * 1024 + c)) continue;
      let e = c;
      while (e + 1 < cols && cells.has(r * 1024 + e + 1)) e++;
      out.push([c * C, r * C, Math.min((e + 1) * C, wTiles * TILE) - c * C, Math.min(C, hTiles * TILE - r * C)]);
      c = e;
    }
  }
  return out;
}

/** Grow `box` {x0, y0, x1, y1} to take in the rectangle (x, y, w, h). */
export function growBox(box, x, y, w, h) {
  if (x < box.x0) box.x0 = x;
  if (y < box.y0) box.y0 = y;
  if (x + w > box.x1) box.x1 = x + w;
  if (y + h > box.y1) box.y1 = y + h;
}

export class TerrainFx {
  /** `factory(w, h)` makes a canvas; by default document.createElement. */
  constructor(factory) {
    this.factory = factory;
    this.waterDepth = new WaterDepth((w, h) => makeCanvas(w, h, this.factory));
    this._reflectedArt = {};
    this._masks = new Map();      // blend, foam and relief masks by edge shape
    this._sprites = new Map();    // ground detail sprites by id
    this._scratch = null;         // one tile, for masking a neighbour's ground
    this._shadow = null;
    this._ao = null;
    this.artVersion = 0;          // bumps when painted detail art arrives (the terrain re-bakes)
    this._art = {};
    if (typeof Image !== 'undefined') {
      for (const id of Object.keys(DETAIL_ART)) {
        const img = new Image();
        img.onload = () => { this.artVersion++; };
        img.src = `assets/world/detail-${id}.webp`;
        this._art[id] = img;
      }
    }
  }

  /** Changes whenever the bake would come out differently (low graphics, new art). */
  signature(low) { return (low ? 'L' : 'H') + this.artVersion; }

  _mask(bits, v, kind) {
    const key = kind + bits + '|' + v;
    let m = this._masks.get(key);
    if (m !== undefined) return m;
    m = null;
    const cv = makeCanvas(TILE, TILE, this.factory);
    if (cv && cv.g.createImageData) {
      const a = blendMask(bits, v);
      const img = cv.g.createImageData(TILE, TILE);
      for (let i = 0; i < a.length; i++) {
        const k = kind === 'b' ? a[i] : kind === 'r' ? bankRelief(a[i]) : foamAlpha(a[i], kind === 'f0' ? 0 : 1);
        const j = i * 4, shade = kind === 'r' && k > 0;
        img.data[j] = shade ? 44 : 255;
        img.data[j + 1] = shade ? 66 : (k < 0 ? 244 : 255);
        img.data[j + 2] = shade ? 73 : (k < 0 ? 190 : 255);
        img.data[j + 3] = Math.round(Math.abs(k) * 255);
      }
      cv.g.putImageData(img, 0, 0);
      m = cv.c;
    }
    this._masks.set(key, m);
    return m;
  }

  // A drawn detail's sprite, mirrored or not (both are cached, so stamping needs no transform).
  _sprite(id, flip) {
    const key = flip ? id + '|f' : id;
    let s = this._sprites.get(key);
    if (s !== undefined) return s;
    const [w, h] = GROUND_DETAILS[id];
    const cv = makeCanvas((w + 4) * DETAIL_SCALE, (h + 4) * DETAIL_SCALE, this.factory);
    s = null;
    if (cv) {
      cv.g.setTransform(flip ? -DETAIL_SCALE : DETAIL_SCALE, 0, 0, DETAIL_SCALE, (w / 2 + 2) * DETAIL_SCALE, (h + 2) * DETAIL_SCALE);
      drawDetail(cv.g, id);
      s = { c: cv.c, w: w + 4, h: h + 4, ax: w / 2 + 2, ay: h + 2 };
    }
    this._sprites.set(key, s);
    return s;
  }

  /** Stamp one ground detail with its foot at (x, y): painted art if it has loaded, else the drawn one. */
  _stamp(g, d, x, y) {
    const art = this._art[d.id];
    if (art && art.complete && art.naturalWidth) {
      const [w, h] = GROUND_DETAILS[d.id];
      const s = d.s * Math.min(w / art.naturalWidth, h / art.naturalHeight) * 1.0;
      const dw = art.naturalWidth * s, dh = art.naturalHeight * s;
      if (d.flip) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(art, -dw / 2, -dh, dw, dh); g.restore(); }
      else g.drawImage(art, x - dw / 2, y - dh, dw, dh);
      return;
    }
    const sp = this._sprite(d.id, d.flip);
    if (sp) g.drawImage(sp.c, x - sp.ax * d.s, y - sp.ay * d.s, sp.w * d.s, sp.h * d.s);
  }

  /**
   * Draw the kerbs (kerbPlan) into chunk `g`: round off the outer corners with
   * the ground beyond, then lay a cream band along each kerbed side with a navy
   * hairline on its outside edge. Three strokes for the whole chunk.
   */
  _kerbs(g, world, tx0, ty0, tx1, ty1, fill) {
    const plan = kerbPlan(world, tx0, ty0, tx1, ty1);
    if (!plan.length) return;
    const ox = tx0 * TILE, oy = ty0 * TILE, R = KERB_R;
    const groups = new Map();
    for (const k of plan) {
      const colours = KERB_COLOURS[world.zoneAt?.(k.x, k.y)?.name];
      if (!groups.has(colours)) groups.set(colours, []);
      groups.get(colours).push(k);
      if (!k.round) continue;
      const sx = k.x * TILE - ox, sy = k.y * TILE - oy;
      for (let i = 0; i < 4; i++) {
        if (!(k.round & (1 << i))) continue;
        // Fill the square corner outside the rounding with the ground beyond it.
        const [px, py, dx, dy] = corner(sx, sy, i);
        const o = k.out[i] === TERRAIN.PATH || k.out[(i + 1) % 4] !== TERRAIN.PATH ? k.out[i] : k.out[(i + 1) % 4];
        g.fillStyle = fill(g, o);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + dx * R, py); g.arcTo(px, py, px, py + dy * R, R); g.closePath(); g.fill();
        g.save(); g.clip(); paintGroundWash(g, world, o, k.x, k.y, sx, sy); g.restore();
      }
    }
    g.lineCap = 'butt';
    for (const [w, drop, style] of KERB_FACE) {
      g.lineWidth = w; g.strokeStyle = style;
      g.beginPath();
      for (const k of plan) if (k.sides & 4) kerbPath(g, k, k.x * TILE - ox, k.y * TILE - oy + drop, 0.5, true);
      g.stroke();
    }
    // The lit top sits over the face. Draw one continuous band, ink line and
    // inset bevel per colourway so neighbouring sections meet cleanly.
    for (const [colours, tiles] of groups) {
      for (const [i, [w, inset, style]] of KERB_STROKES.entries()) {
        g.lineWidth = w; g.strokeStyle = colours?.[i] ?? style;
        g.beginPath();
        for (const k of tiles) if (k.sides) kerbPath(g, k, k.x * TILE - ox, k.y * TILE - oy, inset);
        g.stroke();
      }
      // Inner corners close the small gap between adjacent bands.
      for (const k of tiles) {
        if (!k.cave) continue;
        const sx = k.x * TILE - ox, sy = k.y * TILE - oy;
        for (let i = 0; i < 4; i++) {
          if (!(k.cave & (1 << i))) continue;
          const [px, py, dx, dy] = corner(sx, sy, i);
          g.fillStyle = colours?.[0] ?? KERB_STROKES[0][2];
          g.fillRect(dx > 0 ? px + 0.8 : px - 5.2, dy > 0 ? py + 0.8 : py - 5.2, 4.4, 4.4);
          g.lineWidth = KERB_STROKES[1][0]; g.strokeStyle = colours?.[1] ?? KERB_STROKES[1][2];
          g.beginPath(); g.moveTo(px + dx * 0.7, py); g.lineTo(px + dx * 0.7, py + dy * 0.7); g.lineTo(px, py + dy * 0.7); g.stroke();
        }
      }
    }
  }

  _shadowSprite() {
    if (this._shadow !== null) return this._shadow;
    const cv = makeCanvas(64, 32, this.factory);
    this._shadow = false;
    if (cv && cv.g.createRadialGradient) {
      cv.g.setTransform(1, 0, 0, 0.5, 0, 0);
      const r = cv.g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(34,48,74,1)'); r.addColorStop(0.45, 'rgba(34,48,74,0.7)'); r.addColorStop(1, 'rgba(34,48,74,0)');
      cv.g.fillStyle = r; cv.g.fillRect(0, 0, 64, 64);
      this._shadow = cv.c;
    }
    return this._shadow;
  }

  /**
   * Bake the polish into one chunk canvas `g`, whose top-left is tile (tx0, ty0).
   * `fill(g, t)` gives the fill style for ground type t: its texture as a
   * repeating pattern (anchored at the chunk's corner), or its plain colour. Returns the chunk's per-frame extras (foam layers, lily pads and
   * reeds, reflection spots), or null when there are none.
   */
  bake(g, world, tx0, ty0, tx1, ty1, fill, opts = {}) {
    const job = this.bakeSteps(g, world, tx0, ty0, tx1, ty1, fill, opts);
    let r;
    do r = job.next(); while (!r.done);
    return r.value;
  }

  /**
   * The same bake as a generator that pauses after each row of tiles, so the
   * renderer can spread a chunk's polish over a few frames (a few ms each)
   * instead of stalling one frame as a new chunk comes into view.
   */
  *bakeSteps(g, world, tx0, ty0, tx1, ty1, fill, opts = {}) {
    const ox = tx0 * TILE, oy = ty0 * TILE;
    let foam = null;
    const foamCells = new Set();   // FOAM_CELL-tile blocks that hold any foam (drawFoam copies only those)
    for (let y = ty0; y < ty1; y++) {
      for (let x = tx0; x < tx1; x++) paintDistrictGround(g, world, x, y, x * TILE - ox, y * TILE - oy, opts.low);
      yield;
    }
    const promenade = marinaPromenadePlan(world, tx0, ty0, tx1, ty1);
    // 1. Soft edges. A row of tiles at a time: the masks of every tile in the
    //    row that takes a given neighbouring ground are gathered into one strip,
    //    that ground is filled across the strip and cut to the masks, and the
    //    strip is laid over the row. A handful of draws per row, not per tile.
    const W = (tx1 - tx0) * TILE;
    const strip = this._strip && this._strip.c.width === W ? this._strip : (this._strip = makeCanvas(W, TILE, this.factory));
    const mrow = this._mrow && this._mrow.c.width === W ? this._mrow : (this._mrow = makeCanvas(W, TILE, this.factory));
    if (strip && mrow) {
      for (let y = ty0; y < ty1; y++) {
        const sy = y * TILE - oy;
        const row = [];
        for (let x = tx0; x < tx1; x++) for (const p of blendPlan(world, x, y)) row.push([x, p]);
        const paving = promenade?.tiles.filter((p) => p.y === y);
        if (!row.length && !paving?.length) continue;
        const layers = [...new Set(row.map(([, p]) => p.t))].sort((a, b) => BLEND_RANK[a] - BLEND_RANK[b]);
        for (const t of layers) {
          // The pavement sits over the land, with the feathered waterline
          // still above its edge. Keep the normal blends outside the paving.
          if (t === TERRAIN.WATER && paving?.length) paintMarinaPromenade(g, promenade.points, paving, ox, oy);
          // Only the stretch of the row between the first and last tile that takes this ground.
          let a = W, b = 0;
          for (const [x, p] of row) if (p.t === t) { a = Math.min(a, x * TILE - ox); b = Math.max(b, x * TILE - ox + TILE); }
          const sw = b - a;
          mrow.g.clearRect(a, 0, sw, TILE);
          for (const [x, p] of row) {
            if (p.t !== t) continue;
            const m = this._mask(p.bits, p.v, 'b');
            const sx = x * TILE - ox;
            if (m) mrow.g.drawImage(m, sx, 0);
            if (t === TERRAIN.WATER) {
              // Foam goes on its own half-resolution layers (it's soft anyway), two frames to cross-fade.
              if (!foam) {
                const FW = Math.ceil(W / 2), FH = Math.ceil((ty1 - ty0) * TILE / 2);
                foam = [makeCanvas(FW, FH, this.factory), opts.low ? null : makeCanvas(FW, FH, this.factory)];
              }
              const strength = shoreFoam(world, x, y);
              for (let f = 0; f < 2; f++) {
                const fm = foam[f] && this._mask(p.bits, p.v, 'f' + f);
                if (!fm) continue;
                foam[f].g.globalAlpha = strength;
                foam[f].g.drawImage(fm, sx / 2, sy / 2, TILE / 2, TILE / 2);
              }
              foamCells.add(Math.floor((y - ty0) / FOAM_CELL) * 1024 + Math.floor((x - tx0) / FOAM_CELL));
            }
          }
          const sg = strip.g;
          sg.globalCompositeOperation = 'source-over';
          sg.clearRect(a, 0, sw, TILE);
          // The ground is filled in chunk coordinates, so a texture lines up with the tiles it spills from.
          sg.fillStyle = fill(sg, t);
          sg.setTransform(1, 0, 0, 1, 0, -sy);
          sg.fillRect(a, sy, sw, TILE);
          for (const [x, p] of row) if (p.t === t) paintGroundWash(sg, world, t, x, y, x * TILE - ox, sy);
          sg.setTransform(1, 0, 0, 1, 0, 0);
          sg.globalCompositeOperation = 'destination-in';
          sg.drawImage(mrow.c, a, 0, sw, TILE, a, 0, sw, TILE);
          sg.globalCompositeOperation = 'source-over';
          // The bank relief goes onto the same strip, so it costs no extra copy.
          const sk = BANK_STRENGTH[t];
          if (sk) {
            sg.globalAlpha = sk;
            for (const [x, p] of row) {
              if (p.t !== t) continue;
              const base = world.terrainAt(x, y);
              if (!SEAM_GRASS.has(base) && !(base === TERRAIN.SAND && t === TERRAIN.WATER)) continue;
              const relief = this._mask(p.bits, p.v, 'r');
              if (relief) sg.drawImage(relief, x * TILE - ox, 0);
            }
            sg.globalAlpha = 1;
          }
          g.drawImage(strip.c, a, 0, sw, TILE, a, sy, sw, TILE);
        }
        if (layers.at(-1) !== TERRAIN.WATER && paving?.length) paintMarinaPromenade(g, promenade.points, paving, ox, oy);
        yield;
      }
    } else if (promenade) paintMarinaPromenade(g, promenade.points, promenade.tiles, ox, oy);
    // 1b. Kerbs round the town paving, over the soft edges.
    this._kerbs(g, world, tx0, ty0, tx1, ty1, fill);
    paintHeritageTiles(g, world, tx0, ty0, tx1, ty1);
    // 1c. Where surfaces meet (seams, the foot of walls, worn earth by doors,
    //     verges) and each region's small touches (groundtouch.js).
    (this._touch || (this._touch = new GroundTouch(this.factory))).bake(g, world, tx0, ty0, tx1, ty1, opts);
    yield;
    // 2. Small details on the ground.
    const scatter = promenade ? { ...opts, paved: promenade.paved } : opts;
    for (const d of scatterPlan(world, tx0, ty0, tx1, ty1, scatter)) this._stamp(g, d, d.px - ox, d.py - oy);
    for (const d of marinaGlintPlan(world, tx0, ty0, tx1, ty1)) {
      g.fillStyle = d.colour;
      g.globalAlpha = d.a;
      g.fillRect(d.x - ox, d.y - oy, d.w, 1.1);
    }
    g.globalAlpha = 1;
    paintDiveShoreTiles(g, world, tx0, ty0, tx1, ty1);
    yield;
    // 3. Contact shadows, and a little darkening of the ground beside walls and buildings.
    const sh = this._shadowSprite();
    const shadows = shadowPlan(world, tx0, ty0, tx1, ty1);
    const T = TERRAIN;
    for (const s of shadows) {
      if (s.ao) {
        // Ambient occlusion: the ground right round a wall sits in its shade.
        g.fillStyle = 'rgba(34,48,74,0.07)';
        const bx = s.x * TILE - ox, by = s.y * TILE - oy;
        g.beginPath(); g.ellipse(bx + TILE / 2, by + TILE * 0.62, TILE * 0.85, TILE * 0.55, 0, 0, 6.3); g.fill();
      }
      if (world.terrainAt(s.x, s.y) === T.WATER) continue;
      if (sh) {
        g.globalAlpha = s.a;
        g.drawImage(sh, s.cx - ox - s.rx, s.cy - oy - s.ry, s.rx * 2, s.ry * 2);
        g.globalAlpha = 1;
      } else {
        g.fillStyle = `rgba(34,48,74,${s.a * 0.6})`;
        g.beginPath(); g.ellipse(s.cx - ox, s.cy - oy, s.rx, s.ry, 0, 0, 6.3); g.fill();
      }
    }
    // 4. What's drawn each frame: lily pads and reeds, foam, and the spots
    //    where tall things stand over water (their reflections).
    const water = waterDetailPlan(world, tx0, ty0, tx1, ty1);
    const refl = opts.low ? [] : shoreReflections(world, tx0, ty0, tx1, ty1);
    const fm = foam && foam[0] ? { a: foam[0].c, b: foam[1] ? foam[1].c : null, rects: foamRects(foamCells, tx1 - tx0, ty1 - ty0) } : null;
    if (!fm && !water.length && !refl.length) return null;
    return { foam: fm, water, refl, x: ox, y: oy, w: (tx1 - tx0) * TILE, h: (ty1 - ty0) * TILE };
  }

  // ---------------- Per frame ----------------

  /**
   * Draw the water's per-frame extras for the visible chunks (each chunk
   * canvas carries its `fx` from bake()): the lapping foam, then lily pads and
   * reeds bobbing gently. Then reflections, unless graphics are low.
   * `foam` false leaves the foam out (the renderer's water layer carries it).
   */
  drawWater(ctx, chunks, ox, oy, vw, vh, timeMs, low, foam = true) {
    if (foam) this.drawFoam(ctx, chunks, ox, oy, vw, vh, timeMs, low);
    for (const ch of chunks) {
      const fx = ch && ch.fx;
      if (!fx || !fx.water.length) continue;
      for (const d of fx.water) {
        const x = d.px - ox, y = d.py - oy;
        if (x < -20 || y < -24 || x > vw + 20 || y > vh + 24) continue;
        const drift = low ? 0 : Math.sin(timeMs * 0.0018 + d.ph);
        if (d.id === 'reed' && drift) {
          ctx.save();
          ctx.translate(x, y);
          ctx.transform(1, 0, drift * 0.085, 1, 0, 0);
          this._stamp(ctx, d, 0, 0);
          ctx.restore();
        } else {
          this._stamp(ctx, d, x + drift * 0.7, y + drift * 0.44);
        }
      }
    }
  }

  /**
   * The lapping foam alone: the on-screen part of each chunk's two foam
   * layers, cross-fading. The renderer paints it into its animated water layer
   * (a few times a second) rather than over the whole screen every frame.
   * True if any was drawn.
   */
  drawFoam(ctx, chunks, ox, oy, vw, vh, timeMs, low, box = null) {
    const k = 0.5 + 0.5 * Math.sin(timeMs * 0.0016);
    let any = false;
    for (const ch of chunks) {
      const fx = ch && ch.fx;
      if (!fx || !fx.foam) continue;
      // Only the blocks of the chunk that hold foam (a shoreline is a thin line
      // through a mostly empty layer), or the whole chunk for an older bake.
      for (const r of fx.foam.rects || [[0, 0, fx.w, fx.h]]) {
        // Copy only the on-screen part of the half-resolution foam layers.
        const sx = Math.max(r[0], ox - fx.x), sy = Math.max(r[1], oy - fx.y);
        const sw = Math.min(r[0] + r[2], ox + vw - fx.x) - sx, sh = Math.min(r[1] + r[3], oy + vh - fx.y) - sy;
        if (sw <= 0 || sh <= 0) continue;
        any = true;
        const dx = fx.x + sx - ox, dy = fx.y + sy - oy;
        if (box) growBox(box, dx, dy, sw, sh);
        if (!fx.foam.b || low) { ctx.drawImage(fx.foam.a, sx / 2, sy / 2, sw / 2, sh / 2, dx, dy, sw, sh); continue; }
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(fx.foam.a, sx / 2, sy / 2, sw / 2, sh / 2, dx, dy, sw, sh);
        ctx.globalAlpha = k;
        ctx.drawImage(fx.foam.b, sx / 2, sy / 2, sw / 2, sh / 2, dx, dy, sw, sh);
        ctx.globalAlpha = 1;
      }
    }
    return any;
  }

  /**
   * Soft reflections in the water: tall objects and characters standing just
   * above it appear upside down below them, faded and gently rippling,
   * clipped to the water tiles. Skipped in low graphics.
   */
  drawReflections(ctx, game, chunks, ox, oy, vw, vh, timeMs, still = false) {
    if (game.lowFx || game.fxTrim || !ctx.clip) return;   // also left out while frames run slow (governor.js)
    const w = game.world;
    const surfaceTime = still ? 0 : timeMs;
    for (const ch of chunks) {
      const fx = ch && ch.fx;
      if (!fx || !fx.refl.length) continue;
      for (const r of fx.refl) {
        const { o, width, tiles } = r;
        if (o.depleted || w.objectAt(o.x, o.y) !== o) continue;
        const cx = (o.x + width / 2) * TILE - ox, cy = (o.y + 0.5) * TILE - oy;
        const margin = width * TILE * 0.7 + TILE;
        if (cx < -margin || cx > vw + margin || cy < -5 * TILE || cy > vh) continue;
        const art = worldArtBox(o, timeMs, this._reflectedArt);
        if (!art || art.h < 14) continue;
        ctx.save();
        this._clipWater(ctx, tiles, ox, oy);
        ctx.globalAlpha *= 0.52;
        this.waterDepth.drawMirror(ctx, art, cx, cy + art.foot, surfaceTime, o.x * 0.83 + o.y * 0.16);
        ctx.restore();
      }
    }
    // Characters: the hero and anyone nearby standing on the bank.
    const people = [];
    if (game.player && game.player.alive) people.push(game.player);
    const npcs = game.nearbyNpcs ? game.nearbyNpcs() : [];
    // (Those well off screen are ruled out by their tiles first: a busy region
    // has over a thousand nearby, and each turn of the loop below costs memory,
    // as does renderCenter. A body is drawn between its tile and the next, and
    // the margin is wider than the check below, so nothing in view is lost.)
    const m = 80 + TILE;
    for (const n of npcs) {
      if (!n.alive) continue;
      if (Math.max(n.x, n.tx) * TILE + TILE / 2 - ox < -m || Math.min(n.x, n.tx) * TILE + TILE / 2 - ox > vw + m
        || Math.max(n.y, n.ty) * TILE + TILE / 2 - oy < -m || Math.min(n.y, n.ty) * TILE + TILE / 2 - oy > vh + m) continue;
      people.push(n);
    }
    for (const p of people) {
      const c = p.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      if (cx < -40 || cx > vw + 40 || cy < -40 || cy > vh + 80) continue;
      const tiles = waterBelow(w, Math.round(c.x / TILE - 0.5), Math.round(c.y / TILE - 0.5));
      if (!tiles.length) continue;
      const sc = (p.def && p.def.scale) || 1;
      this._reflect(ctx, tiles, ox, oy, cx, cy + 12 * sc, surfaceTime, p.x, () => {
        if (p === game.player) {
          drawPlayer(ctx, cx, cy - 2, { time: timeMs, facing: p.facing, fx: p.faceX, entity: p, moving: p.isMoving, jobClass: game.jobClass,
            hasWeapon: !!game.equipment?.get('weapon'), weaponType: game.combatMode ? game.combatMode() : 'melee' });
        } else {
          drawCreature(ctx, p.artId || p.npcId, cx, cy - 2, { time: timeMs, facing: p.facing, fx: p.faceX, moving: p.isMoving,
            scale: sc, sprite: p.def.sprite, color: p.def.color, boss: p.def.boss, family: p.def.family, low: true });
        }
      });
    }
  }

  _clipWater(ctx, tiles, ox, oy) {
    ctx.beginPath();
    for (const [x, y] of tiles) ctx.rect(x * TILE - ox, y * TILE - oy, TILE, TILE);
    ctx.clip();
  }

  // Draw `draw()` flipped about the foot line `fy`, squashed, faded and
  // rippling in a few horizontal bands, clipped to the given water tiles.
  _reflect(ctx, tiles, ox, oy, cx, fy, timeMs, seed, draw) {
    ctx.save();
    this._clipWater(ctx, tiles, ox, oy);
    const alpha = ctx.globalAlpha, BANDS = timeMs ? 2 : 1, BH = 28;
    for (let b = 0; b < BANDS; b++) {
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - 90, fy + b * BH, 180, b === BANDS - 1 ? 200 : BH); ctx.clip();
      ctx.globalAlpha = alpha * (0.27 - b * 0.13);
      const sway = timeMs ? Math.sin(timeMs * 0.0024 + b * 1.7 + seed) * (0.6 + b * 1.1) : 0;
      ctx.translate(cx + sway, fy);
      ctx.scale(1, -0.72);
      ctx.translate(-cx, -fy);
      try { draw(); } catch { /* a reflection is never worth a broken frame */ }
      ctx.restore();
    }
    ctx.restore();
  }
}
