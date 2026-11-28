// Small touches baked into the terrain chunks where surfaces meet, and a few
// of each region's own (see terrainfx.js, which bakes them into each chunk
// just after the soft edges and kerbs, before the scattered ground details):
//
//  - the ground darkened along the foot of buildings and walls;
//  - worn earth in front of doors, stalls, counters and workbenches;
//  - little clumps of grass and flowers along the verges of roads;
//  - fallen leaves in the forests, pebbles and ripples on the beaches,
//    cracks in the town paving, moss where it's wet.
//
// It is all baked once per chunk, so it costs nothing per frame, and it is all
// placed by a hash of the tile's position (never Math.random), so the same
// world always bakes the same picture. touchPlan is plain data and runs
// headless; the tests check it directly. Everything is kept faint: it should
// read as the ground settling into place, not as more things to look at.

import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { tileHash, FOREST, BEACH, BLEAK, FRESH } from './terrainfx.js';

const T = TERRAIN;
const GRASSY = new Set([T.GRASS, T.DARKGRASS]);
// Regions that are wet underfoot all over (moss on the paving and the paths),
// beyond the moss that grows by any fresh water.
const WET = new Set(['Sungei Buloh Wetlands', 'MacRitchie Reservoir', 'Mandai Rainforest', 'Punggol Waterway']);

// Things you stand at to use: stalls, the bank, ranges, furnaces, anvils, benches, shrines...
const WORKED = new Set(['stall', 'bank', 'range', 'furnace', 'anvil', 'craft', 'fletch', 'herblore', 'shrine',
  'offering', 'rest', 'transport', 'gate', 'saw', 'kiln', 'build', 'homebench', 'hawkstall']);
// Walls darken the ground at their foot (landmarks always do).
const WALLS = new Set(['wall', 'fence']);

/** [width, height] (px) each touch is drawn at, its foot at the bottom centre. */
export const TOUCH_DETAILS = {
  clump: [12, 9], clump_bloom: [12, 10], leaves: [14, 8], pebbles: [11, 5], ripple: [16, 6], crack: [18, 12], moss: [14, 7],
};

const near = (world, x, y, r, t) => {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (world.terrainAt(x + dx, y + dy) === t && world.inBounds?.(x + dx, y + dy) !== false) return true;
  return false;
};

/**
 * Everything to bake for tiles [tx0, tx1) x [ty0, ty1), in world pixels:
 *  bases  [{ x0, x1, y, k, depth }] the ground darkened along each footing
 *  worn   [{ px, py, rx, ry, t }] worn earth, on ground type t
 *  bits   [{ id, px, py, flip, s }] small touches (TOUCH_DETAILS), by their foot
 * Bands from objects just over the chunk's edges are included, so a band that
 * crosses an edge is baked on both sides. Low graphics plants half
 * as many of the small touches.
 */
export function touchPlan(world, tx0, ty0, tx1, ty1, opts = {}) {
  const bases = [], worn = [], bits = [];
  const k = opts.low ? 0.5 : 1;
  // Bases and worn earth, from the objects on or just round the chunk (a
  // landmark stands on its front-left tile and spreads up to four tiles back
  // and right of it, so the search reaches that far).
  const objs = new Set();
  if (world.objectsIn) for (const o of world.objectsIn(tx0 - 4, ty0 - 2, tx1 + 1, ty1 + 4)) objs.add(o);
  else for (let y = ty0 - 2; y < ty1 + 4; y++) for (let x = tx0 - 4; x < tx1 + 1; x++) { const o = world.objectAt?.(x, y); if (o) objs.add(o); }
  const ground = (x, y) => { const g = world.terrainAt(x, y); return g === T.WATER || g === T.WOOD || world.objectAt?.(x, y) ? null : g; };
  const walls = [];
  for (const o of objs) {
    if (!o || !o.def) continue;
    const fp = o.def.footprint;
    if (fp) {
      // The foot of a landmark: its picture is a little wider than its footprint (sprites.js).
      const w = fp[0] * TILE, cx = o.x * TILE + w / 2;
      bases.push({ x0: cx - w * 0.52, x1: cx + w * 0.52, y: (o.y + 1) * TILE, k: 1, depth: 17 });
      if (o.objId === 'hawker_centre') {
        // In front of the middle of its front (either middle tile of an even width).
        const g = ground(o.x + Math.floor(fp[0] / 2), o.y + 1) ?? ground(o.x + Math.floor((fp[0] - 1) / 2), o.y + 1);
        if (g !== null) worn.push({ px: cx, py: (o.y + 1) * TILE + 8, rx: 10 + fp[0] * 2.5, ry: 6.5, t: g });
      }
    } else if (WALLS.has(o.objId)) {
      walls.push(o);
      // Moss at the foot of old walls where it's damp or wild.
      const z = world.zoneAt ? world.zoneAt(o.x, o.y) : null, zn = z ? z.name : '';
      if ((WET.has(zn) || FOREST.has(zn)) && tileHash(o.x, o.y, 1102) < 0.4 * k && ground(o.x, o.y + 1) !== null) {
        bits.push({ id: 'moss', px: o.x * TILE + 8 + tileHash(o.x, o.y, 1103) * 16, py: (o.y + 1) * TILE + 3, flip: tileHash(o.x, o.y, 1104) < 0.5, s: 0.9 });
      }
    } else if (WORKED.has(o.def.type)) {
      const g = ground(o.x, o.y + 1);
      if (g !== null) worn.push({ px: o.x * TILE + TILE / 2, py: (o.y + 1) * TILE + 9, rx: 11, ry: 6, t: g });
    }
  }
  // A run of wall along a row is one band, so its foot reads as one line rather than a row of scallops.
  walls.sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i < walls.length;) {
    let j = i;
    while (j + 1 < walls.length && walls[j + 1].y === walls[i].y && walls[j + 1].x === walls[j].x + 1) j++;
    bases.push({ x0: walls[i].x * TILE - 3, x1: (walls[j].x + 1) * TILE + 3, y: (walls[i].y + 1) * TILE - 1, k: 0.8, depth: 11 });
    i = j + 1;
  }
  // Small touches, tile by tile.
  for (let y = ty0; y < ty1; y++) {
    for (let x = tx0; x < tx1; x++) {
      const t = world.terrainAt(x, y);
      if (t === T.WATER || t === T.WOOD || world.objectAt?.(x, y)) continue;
      const h = (s) => tileHash(x, y, s);
      const put = (id, fx, fy, s = 1) => bits.push({ id, px: x * TILE + fx, py: y * TILE + fy, flip: h(1190) < 0.5, s: s * (0.85 + h(1191) * 0.3) });
      // Grass along a road's verge: a clump just off the road's edge, where the grass overhangs it.
      if (GRASSY.has(t) && h(1110) < 0.42 * k) {
        const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => world.terrainAt(x + dx, y + dy) === T.PATH);
        if (sides.length) {
          const [dx, dy] = sides[Math.floor(h(1111) * sides.length)];
          const along = 6 + h(1112) * (TILE - 12), off = 7 + h(1113) * 3;
          const fx = dx ? (dx > 0 ? TILE - off : off) : along, fy = dy ? (dy > 0 ? TILE - off + 4 : off + 5) : along + 4;
          put(h(1114) < 0.3 ? 'clump_bloom' : 'clump', fx, fy);
        }
      }
      const z = world.zoneAt ? world.zoneAt(x, y) : null, zn = z ? z.name : '';
      const fx = 6 + h(1120) * (TILE - 12), fy = 9 + h(1121) * (TILE - 13);
      if (FOREST.has(zn) && (GRASSY.has(t) || t === T.PATH)) {
        if (h(1130) < (t === T.PATH ? 0.14 : 0.1) * k) put('leaves', fx, fy);
      } else if (t === T.SAND && BEACH.has(zn)) {
        // Ripples on the wet sand by the water; pebbles washed up anywhere on the beach.
        if (h(1140) < 0.2 * k && near(world, x, y, 2, T.WATER)) put('ripple', fx, fy);
        else if (h(1141) < 0.07 * k) put('pebbles', fx, fy);
      } else if (t === T.STONE) {
        // Cracks in the paving (many more in the ruins and the wild places).
        if (h(1150) < (BLEAK.has(zn) ? 0.16 : 0.06) * k) put('crack', TILE / 2 + (h(1151) - 0.5) * 8, TILE / 2 + 6 + (h(1152) - 0.5) * 8);
      }
      // Moss on paving and paths where it's wet: a wet region, or beside fresh water.
      if ((t === T.STONE || t === T.PATH) && h(1160) < 0.12 * k && (WET.has(zn) || (FRESH.has(zn) && near(world, x, y, 2, T.WATER)))) put('moss', fx, fy);
    }
  }
  return { bases, worn, bits };
}

// ---------------- Drawing ----------------

const INK = 'rgba(34,48,74,0.62)';
// One touch, its foot at (0, 0), in the sticker style but quieter than the
// scattered details (thinner ink, softer colours): these sit in the ground.
function drawTouch(g, id) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  const blob = (fill, f, ink = 0.55) => { g.beginPath(); f(); g.fillStyle = fill; g.fill(); g.lineWidth = ink; g.strokeStyle = INK; g.stroke(); };
  switch (id) {
    case 'clump': case 'clump_bloom': {
      for (const [bx, hh, lean, c] of [[-4, 5.5, -2.2, '#7FC072'], [-1.2, 7.5, -0.8, '#9AD483'], [1.6, 8, 0.9, '#86C97A'], [4.2, 5.8, 2.3, '#A9DC8E']]) {
        blob(c, () => { g.moveTo(bx - 1.3, 0); g.quadraticCurveTo(bx + lean * 0.4, -hh * 0.6, bx + lean, -hh); g.quadraticCurveTo(bx + lean * 0.2 + 0.5, -hh * 0.5, bx + 1.3, 0); g.closePath(); });
      }
      if (id === 'clump_bloom') {
        for (const [px, py, c] of [[-2.6, -6.8, '#FFFFFF'], [2.4, -7.6, '#F7A8C0']]) {
          blob(c, () => g.arc(px, py, 1.5, 0, 6.3), 0.45);
          g.fillStyle = '#F5B82E'; g.beginPath(); g.arc(px, py, 0.6, 0, 6.3); g.fill();
        }
      }
      break;
    }
    case 'leaves': {
      // A little drift of fallen leaves, in autumn colours.
      for (const [px, py, a, c] of [[-4, -2.4, 0.5, '#E7A85E'], [1.5, -4.4, -0.6, '#D98A55'], [4.2, -1.8, 1.4, '#C9B25E'], [-0.8, -1.4, 2.6, '#E9C27A']]) {
        g.save(); g.translate(px, py); g.rotate(a);
        blob(c, () => { g.moveTo(-3, 0); g.quadraticCurveTo(0, -2.4, 3, 0); g.quadraticCurveTo(0, 2.4, -3, 0); }, 0.45);
        g.strokeStyle = 'rgba(34,48,74,0.3)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-2.4, 0); g.lineTo(2.4, 0); g.stroke();
        g.restore();
      }
      break;
    }
    case 'pebbles': {
      for (const [px, rw, rh, c] of [[-3.4, 2.2, 1.5, '#D8D2C8'], [0.6, 1.6, 1.1, '#C3BCB2'], [3.6, 1.9, 1.3, '#E6DED0']]) {
        blob(c, () => g.ellipse(px, -rh, rw, rh, 0, 0, 6.3), 0.45);
        g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(px - rw * 0.3, -rh * 1.35, rw * 0.35, rh * 0.3, 0, 0, 6.3); g.fill();
      }
      break;
    }
    case 'ripple': {
      // Ripple marks the tide leaves in the sand: two soft wavy lines, light over dark.
      for (const [dy, c, w] of [[-3.6, 'rgba(150,120,80,0.28)', 1.1], [-3, 'rgba(255,250,236,0.7)', 0.8], [-0.8, 'rgba(150,120,80,0.24)', 1], [-0.2, 'rgba(255,250,236,0.6)', 0.7]]) {
        g.strokeStyle = c; g.lineWidth = w; g.beginPath();
        for (let i = 0; i <= 8; i++) { const x = -7 + i * 1.75, y = dy + Math.sin(i * 1.3) * 0.7; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
      break;
    }
    case 'crack': {
      // A hairline crack across a paving slab, with a little branch off it.
      g.strokeStyle = 'rgba(34,48,74,0.34)'; g.lineWidth = 0.75;
      g.beginPath(); g.moveTo(-8, -9); g.lineTo(-4, -6.5); g.lineTo(-2.5, -3.5); g.lineTo(1.5, -2.6); g.lineTo(4, 0); g.lineTo(8, -0.6); g.stroke();
      g.beginPath(); g.moveTo(-2.5, -3.5); g.lineTo(-3.4, -0.6); g.lineTo(-5.6, 0.4); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(-7.6, -8.2); g.lineTo(-3.6, -5.7); g.lineTo(-2.1, -2.8); g.lineTo(1.8, -1.9); g.stroke();
      break;
    }
    case 'moss': {
      // A soft cushion of moss, darker underneath, with a few lighter tufts.
      g.fillStyle = 'rgba(78,128,74,0.55)'; g.beginPath(); g.ellipse(0, -2.6, 6.6, 2.8, 0, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(120,176,96,0.75)';
      for (const [px, py, r] of [[-3.2, -3.2, 2.1], [0.4, -3.9, 2.5], [3.6, -2.8, 1.9], [-0.8, -1.8, 1.6]]) { g.beginPath(); g.arc(px, py, r, 0, 6.3); g.fill(); }
      g.fillStyle = 'rgba(190,226,150,0.8)';
      for (const [px, py] of [[-3.4, -4.4], [0.9, -5.2], [3.4, -3.8]]) { g.beginPath(); g.arc(px, py, 0.7, 0, 6.3); g.fill(); }
      break;
    }
    default:
  }
}

const SCALE = 2;   // drawn at twice size and shrunk, for smooth edges (as terrainfx.js's details)

function canvas(w, h, factory) {
  try {
    const c = factory ? factory(w, h) : (typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null);
    if (!c) return null;
    c.width = w; c.height = h;
    const g = c.getContext && c.getContext('2d');
    return g ? { c, g } : null;
  } catch { return null; }
}

/** The baker's cached pictures: each touch (mirrored or not) and the worn-earth patch. */
export class GroundTouch {
  constructor(factory) {
    this.factory = factory;
    this._sprites = new Map();
    this._worn = null;
  }

  _sprite(id, flip) {
    const key = flip ? id + '|f' : id;
    let s = this._sprites.get(key);
    if (s !== undefined) return s;
    const [w, h] = TOUCH_DETAILS[id];
    const cv = canvas((w + 4) * SCALE, (h + 4) * SCALE, this.factory);
    s = null;
    if (cv) {
      cv.g.setTransform(flip ? -SCALE : SCALE, 0, 0, SCALE, (w / 2 + 2) * SCALE, (h + 2) * SCALE);
      drawTouch(cv.g, id);
      s = { c: cv.c, w: w + 4, h: h + 4, ax: w / 2 + 2, ay: h + 2 };
    }
    this._sprites.set(key, s);
    return s;
  }

  // Worn earth: a soft oval of bare ground with a few darker specks, faded at its edge.
  _wornPatch() {
    if (this._worn !== null) return this._worn;
    this._worn = false;
    const cv = canvas(64, 32, this.factory);
    if (cv && cv.g.createRadialGradient) {
      const g = cv.g;
      g.setTransform(1, 0, 0, 0.5, 0, 0);
      const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, 'rgba(176,138,96,0.9)'); rg.addColorStop(0.55, 'rgba(184,148,104,0.6)'); rg.addColorStop(1, 'rgba(190,156,112,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgba(120,90,60,0.35)';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(14 + tileHash(i, 7, 1180) * 36, 9 + tileHash(i, 7, 1181) * 14, 0.7 + tileHash(i, 7, 1182) * 0.6, 0, 6.3); g.fill(); }
      this._worn = cv.c;
    }
    return this._worn;
  }

  /** Bake the plan for tiles [tx0, tx1) x [ty0, ty1) into chunk `g` (whose top-left is tile (tx0, ty0)). */
  bake(g, world, tx0, ty0, tx1, ty1, opts = {}) {
    const ox = tx0 * TILE, oy = ty0 * TILE;
    const plan = touchPlan(world, tx0, ty0, tx1, ty1, opts);
    // The foot of buildings and walls: a band of shade just in front, fading out downwards and at its ends.
    if (plan.bases.length && g.createLinearGradient) {
      for (const b of plan.bases) {
        const x0 = b.x0 - ox, x1 = b.x1 - ox, y = b.y - oy, d = b.depth;
        const lg = g.createLinearGradient(0, y - 3, 0, y + d);
        lg.addColorStop(0, `rgba(34,48,74,${0.34 * b.k})`);
        lg.addColorStop(0.36, `rgba(34,48,74,${0.15 * b.k})`);
        lg.addColorStop(1, 'rgba(34,48,74,0)');
        g.fillStyle = lg;
        g.beginPath(); g.ellipse((x0 + x1) / 2, y - 3, (x1 - x0) / 2, d + 3, 0, 0, Math.PI); g.fill();
      }
    }
    const wp = this._wornPatch();
    if (wp) {
      for (const w of plan.worn) {
        // Bare earth shows most on grass; on roads and sand it is just scuffed darker; on paving, faintly.
        g.globalAlpha = GRASSY.has(w.t) ? 0.55 : w.t === T.STONE ? 0.2 : 0.3;
        g.drawImage(wp, w.px - ox - w.rx, w.py - oy - w.ry, w.rx * 2, w.ry * 2);
      }
      g.globalAlpha = 1;
    }
    for (const d of plan.bits) {
      const sp = this._sprite(d.id, d.flip);
      if (sp) g.drawImage(sp.c, d.px - ox - sp.ax * d.s, d.py - oy - sp.ay * d.s, sp.w * d.s, sp.h * d.s);
    }
    return plan;
  }
}
