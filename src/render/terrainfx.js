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
import { drawObjectSprite, drawCreature, drawPlayer } from './sprites.js';

/** A stable 0..1 hash of a tile (and an optional salt). */
export function tileHash(x, y, s = 0) {
  let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------- Soft edges ----------------

// Which ground spills over which where two meet: a higher rank bleeds its
// texture a little way into a lower neighbour, along a wavy, dithered edge.
// Water is highest, so shores take a soft, uneven waterline. Town paving
// (stone) and bridges (wood) are built surfaces and keep their crisp edges.
export const BLEND_RANK = {
  [TERRAIN.GRASS]: 1, [TERRAIN.DARKGRASS]: 2, [TERRAIN.SAND]: 3, [TERRAIN.PATH]: 4, [TERRAIN.WATER]: 5,
};
export const FEATHER = 13;    // how far (px) a neighbour's ground reaches into a tile
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
  const r = BLEND_RANK[world.terrainAt(x, y)];
  if (!r) return [];
  let found = null;
  for (let i = 0; i < 8; i++) {
    const nt = world.terrainAt(x + NB[i][0], y + NB[i][1]);
    if ((BLEND_RANK[nt] || 0) > r) (found || (found = new Map())).set(nt, (found.get(nt) || 0) | (1 << i));
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
      let a = 0;
      if (bits & 1) a = Math.max(a, ramp(fy - wobble(fx, v, 0)));
      if (bits & 2) a = Math.max(a, ramp(TILE - fx - wobble(fy, v, 1)));
      if (bits & 4) a = Math.max(a, ramp(TILE - fy - wobble(fx, v, 2)));
      if (bits & 8) a = Math.max(a, ramp(fx - wobble(fy, v, 3)));
      if (bits & 16) a = Math.max(a, ramp(Math.hypot(TILE - fx, fy) - 2));
      if (bits & 32) a = Math.max(a, ramp(Math.hypot(TILE - fx, TILE - fy) - 2));
      if (bits & 64) a = Math.max(a, ramp(Math.hypot(fx, TILE - fy) - 2));
      if (bits & 128) a = Math.max(a, ramp(Math.hypot(fx, fy) - 2));
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

// ---------------- Ground details ----------------

// The small things scattered on the ground, drawn in the A-Worthy sticker
// style (soft shapes, navy ink edge). Each can be replaced by painted art:
// add assets/world/detail-<id>.webp and list the id in DETAIL_ART.
// [width, height] is the size it is drawn at, in px, with its foot at the bottom centre.
export const GROUND_DETAILS = {
  tuft: [11, 9], tuft_dark: [11, 9], flower_pink: [8, 8], flower_yellow: [8, 8], flower_white: [8, 8],
  flower_lilac: [8, 8], leaf_green: [8, 6], leaf_brown: [8, 6], pebble: [6, 4], stone: [9, 5],
  shell: [7, 6], shell_spiral: [6, 6], lily_pad: [13, 9], lily_flower: [13, 10], reed: [10, 17],
};
/** Ground details that have painted art on disk (assets/world/detail-<id>.webp). */
export const DETAIL_ART = {};
export const groundDetailArt = () => new Set(Object.keys(DETAIL_ART).map((id) => `detail-${id}`));

const FOREST = new Set(['Bukit Timah', 'Jurong Forest', 'Mandai Rainforest', 'Coney Island', 'Sungei Buloh Wetlands']);
const BEACH = new Set(['Sentosa Beach', 'Southern Islands', 'Changi Coast', 'Pulau Ubin', 'Coney Island']);
const BLOOMS = new Set(['Kampong Glam', 'Gardens by the Bay', 'Kranji Farmlands', 'Chinatown', 'Marina Bay']);
const BLEAK = new Set(['The Wilderness', 'The Shadow Rift', 'Tekong Badlands', 'Pulau Hantu', 'Temasek Ruins']);
// Fresh water, where lily pads and reeds grow (not the open sea).
const FRESH = new Set(['MacRitchie Reservoir', 'Sungei Buloh Wetlands', 'Punggol Waterway', 'Kranji Farmlands',
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
    if (BEACH.has(zone)) return { d: 0.3, w: [['shell', 3], ['shell_spiral', 1.5], ['pebble', 2]] };
    return { d: 0.22, w: [['pebble', 3], ['shell', 0.6], ['stone', 0.8]] };
  }
  if (t === T.PATH) return { d: 0.3, w: [['stone', 2], ['pebble', 2.5]] };
  return null;
}
function pick(w, r) {
  let sum = 0;
  for (const [, n] of w) sum += n;
  let k = r * sum;
  for (const [id, n] of w) { k -= n; if (k <= 0) return id; }
  return w[w.length - 1][0];
}

/**
 * The ground details for tiles [tx0, tx1) x [ty0, ty1): [{ id, px, py, flip, s }]
 * in world pixels (foot point). Never on a tile with an object, on water, on
 * town paving or bridges; paths only get stones along their verges, so the
 * walking line down a road stays clear. Low graphics plants half as many.
 */
export function scatterPlan(world, tx0, ty0, tx1, ty1, opts = {}) {
  const out = [];
  const T = TERRAIN;
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      const t = world.terrainAt(x, y);
      if (t === T.WATER || t === T.STONE || t === T.WOOD) continue;
      if (world.objectAt(x, y)) continue;
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

/** Is tile (x, y) water that is part of a lake, river or wetland (not the open sea)? */
function freshWater(world, x, y) {
  const z = world.zoneAt ? world.zoneAt(x, y) : null;
  return !!z && FRESH.has(z.name);
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
      if (h > 0.86) {
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
  tree: [21, 8, 14, 0.4], rock: [16, 6, 12, 0.32], bush: [13, 5, 11, 0.22], flower: [8, 3.2, 10, 0.16],
  palm: [14, 5.5, 13, 0.26], lamp: [7, 3, 13, 0.2], sign: [8, 3, 12, 0.18], fence: [18, 5, 12, 0.18],
  wall: [20, 7, 12, 0.34], ruin: [21, 8, 12, 0.34], building: [26, 9.5, 14, 0.36], small: [13, 5, 11, 0.2],
};
const NO_SHADOW = new Set(['fire', 'farm', 'fishing']);
// Objects that are walls or buildings darken the ground beside them a little.
const OCCLUDERS = new Set(['wall', 'ruin', 'building']);
function shadowKind(o) {
  const t = o.def.type;
  if (NO_SHADOW.has(t)) return null;
  if (t === 'tree' || t === 'rock') return t;
  if (t === 'scenery') return SHADOW[o.objId] ? o.objId : 'small';
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
    default:
  }
}

// ---------------- The baker ----------------

const DETAIL_SCALE = 2;   // details are drawn at twice size and shrunk, for smooth edges

export class TerrainFx {
  /** `factory(w, h)` makes a canvas; by default document.createElement. */
  constructor(factory) {
    this.factory = factory;
    this._masks = new Map();      // blend / foam masks by edge shape
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
        const k = kind === 'b' ? a[i] : foamAlpha(a[i], kind === 'f0' ? 0 : 1);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
        img.data[i * 4 + 3] = Math.round(k * 255);
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
        if (!row.length) continue;
        const layers = [...new Set(row.map(([, p]) => p.t))].sort((a, b) => BLEND_RANK[a] - BLEND_RANK[b]);
        for (const t of layers) {
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
              for (let f = 0; f < 2; f++) {
                const fm = foam[f] && this._mask(p.bits, p.v, 'f' + f);
                if (fm) foam[f].g.drawImage(fm, sx / 2, sy / 2, TILE / 2, TILE / 2);
              }
            }
          }
          const sg = strip.g;
          sg.globalCompositeOperation = 'source-over';
          sg.clearRect(a, 0, sw, TILE);
          // The ground is filled in chunk coordinates, so a texture lines up with the tiles it spills from.
          sg.fillStyle = fill(sg, t);
          sg.setTransform(1, 0, 0, 1, 0, -sy);
          sg.fillRect(a, sy, sw, TILE);
          sg.setTransform(1, 0, 0, 1, 0, 0);
          sg.globalCompositeOperation = 'destination-in';
          sg.drawImage(mrow.c, a, 0, sw, TILE, a, 0, sw, TILE);
          sg.globalCompositeOperation = 'source-over';
          g.drawImage(strip.c, a, 0, sw, TILE, a, sy, sw, TILE);
        }
        yield;
      }
    }
    // 2. Small details on the ground.
    for (const d of scatterPlan(world, tx0, ty0, tx1, ty1, opts)) this._stamp(g, d, d.px - ox, d.py - oy);
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
    const refl = [];
    for (const s of shadows) {
      if (s.x < tx0 || s.x >= tx1 || s.y < ty0 || s.y >= ty1) continue;
      if (!REFLECTS.has(s.kind)) continue;
      const tiles = waterBelow(world, s.x, s.y);
      if (tiles.length) refl.push({ o: world.objectAt(s.x, s.y), tiles });
    }
    const fm = foam && foam[0] ? { a: foam[0].c, b: foam[1] ? foam[1].c : null } : null;
    if (!fm && !water.length && !refl.length) return null;
    return { foam: fm, water, refl, x: ox, y: oy, w: (tx1 - tx0) * TILE, h: (ty1 - ty0) * TILE };
  }

  // ---------------- Per frame ----------------

  /**
   * Draw the water's per-frame extras for the visible chunks (each chunk
   * canvas carries its `fx` from bake()): the lapping foam, then lily pads and
   * reeds bobbing gently. Then reflections, unless graphics are low.
   */
  drawWater(ctx, chunks, ox, oy, vw, vh, timeMs, low) {
    const k = 0.5 + 0.5 * Math.sin(timeMs * 0.0016);
    for (const ch of chunks) {
      const fx = ch && ch.fx;
      if (!fx || !fx.foam) continue;
      // Copy only the on-screen part of the half-resolution foam layers.
      const sx = Math.max(0, ox - fx.x), sy = Math.max(0, oy - fx.y);
      const sw = Math.min(fx.w, ox + vw - fx.x) - sx, sh = Math.min(fx.h, oy + vh - fx.y) - sy;
      if (sw <= 0 || sh <= 0) continue;
      if (!fx.foam.b || low) { ctx.drawImage(fx.foam.a, sx / 2, sy / 2, sw / 2, sh / 2, fx.x + sx - ox, fx.y + sy - oy, sw, sh); continue; }
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(fx.foam.a, sx / 2, sy / 2, sw / 2, sh / 2, fx.x + sx - ox, fx.y + sy - oy, sw, sh);
      ctx.globalAlpha = k;
      ctx.drawImage(fx.foam.b, sx / 2, sy / 2, sw / 2, sh / 2, fx.x + sx - ox, fx.y + sy - oy, sw, sh);
      ctx.globalAlpha = 1;
    }
    for (const ch of chunks) {
      const fx = ch && ch.fx;
      if (!fx || !fx.water.length) continue;
      for (const d of fx.water) {
        const x = d.px - ox, y = d.py - oy;
        if (x < -20 || y < -24 || x > vw + 20 || y > vh + 24) continue;
        const bob = low ? 0 : Math.sin(timeMs * 0.0018 + d.ph) * 0.7;
        this._stamp(ctx, d, x, y + bob);
      }
    }
  }

  /**
   * Soft reflections in the water: tall objects and characters standing just
   * above it appear upside down below them, faded and gently rippling,
   * clipped to the water tiles. Skipped in low graphics.
   */
  drawReflections(ctx, game, chunks, ox, oy, vw, vh, timeMs) {
    if (game.lowFx || !ctx.clip) return;
    const w = game.world;
    for (const ch of chunks) {
      const fx = ch && ch.fx;
      if (!fx || !fx.refl.length) continue;
      for (const r of fx.refl) {
        const o = r.o;
        if (!o || w.objectAt(o.x, o.y) !== o) continue;
        const cx = o.x * TILE + TILE / 2 - ox, cy = o.y * TILE + TILE / 2 - oy;
        if (cx < -80 || cx > vw + 80 || cy < -40 || cy > vh + 120) continue;
        this._reflect(ctx, r.tiles, ox, oy, cx, cy + 14, timeMs, o.x, () => drawObjectSprite(ctx, o, cx, cy, timeMs));
      }
    }
    // Characters: the hero and anyone nearby standing on the bank.
    const people = [];
    if (game.player && game.player.alive) people.push(game.player);
    const npcs = game.nearbyNpcs ? game.nearbyNpcs() : [];
    for (const n of npcs) if (n.alive) people.push(n);
    for (const p of people) {
      const c = p.renderCenter();
      const cx = c.x - ox, cy = c.y - oy;
      if (cx < -40 || cx > vw + 40 || cy < -40 || cy > vh + 80) continue;
      const tiles = waterBelow(w, Math.round(c.x / TILE - 0.5), Math.round(c.y / TILE - 0.5));
      if (!tiles.length) continue;
      const sc = (p.def && p.def.scale) || 1;
      this._reflect(ctx, tiles, ox, oy, cx, cy + 12 * sc, timeMs, p.x, () => {
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

  // Draw `draw()` flipped about the foot line `fy`, squashed, faded and
  // rippling in a few horizontal bands, clipped to the given water tiles.
  _reflect(ctx, tiles, ox, oy, cx, fy, timeMs, seed, draw) {
    ctx.save();
    ctx.beginPath();
    for (const [x, y] of tiles) ctx.rect(x * TILE - ox, y * TILE - oy, TILE, TILE);
    ctx.clip();
    ctx.globalAlpha = 0.26;
    const BANDS = 3, BH = 26;
    for (let b = 0; b < BANDS; b++) {
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - 90, fy + b * BH, 180, b === BANDS - 1 ? 200 : BH); ctx.clip();
      const sway = Math.sin(timeMs * 0.0024 + b * 1.7 + seed) * (1 + b * 0.8);
      ctx.translate(cx + sway, fy);
      ctx.scale(1, -0.72);
      ctx.translate(-cx, -fy);
      try { draw(); } catch { /* a reflection is never worth a broken frame */ }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// Kinds of object tall enough to cast a reflection.
const REFLECTS = new Set(['tree', 'palm', 'lamp', 'wall', 'ruin', 'building', 'sign', 'bush']);
// The water tiles a reflection of something standing on (x, y) can fall on.
function waterBelow(world, x, y) {
  const out = [];
  for (let dy = 1; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) if (world.terrainAt(x + dx, y + dy) === TERRAIN.WATER && world.inBounds?.(x + dx, y + dy) !== false) out.push([x + dx, y + dy]);
  return out;
}
