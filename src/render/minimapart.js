// The minimap's look: the ground in the colours of the painted ground
// textures (so it reads as the same pastel world, not a grey board), and
// what each creature shows as. Drawn by the UI's renderMinimap (ui.js); the
// terrain is painted once into a one-pixel-per-tile picture, so only these
// colour lookups and the dots are per-refresh work.
import { TERRAIN } from '../data/world.js';
import { questNpcIds } from './worldlabels.js';

// Each terrain's colour: the average of its painted ground texture
// (assets/world/ground-<name>.webp), dark grass a shade deeper as the
// renderer bakes it, so lawns, paths, plazas and water read as on screen.
export const MINIMAP_RGB = {
  [TERRAIN.GRASS]: [145, 195, 101],
  [TERRAIN.DARKGRASS]: [124, 176, 88],
  [TERRAIN.PATH]: [224, 179, 124],
  [TERRAIN.SAND]: [247, 218, 171],
  [TERRAIN.STONE]: [228, 207, 184],   // warmed like the town paving's tint (renderer.js)
  [TERRAIN.WOOD]: [187, 140, 95],
  [TERRAIN.WATER]: [90, 189, 230],
};
// Where one kind of ground meets another, the tile on the far side is shaded
// this much, a soft edge like the world's kerbs and shorelines.
const EDGE_SHADE = 0.86;

/** Fill `d` (RGBA, width x height) with the whole map's ground. */
export function paintMinimapTerrain(world, d) {
  const w = world.width, h = world.height, grass = MINIMAP_RGB[TERRAIN.GRASS];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = world.terrainAt(x, y);
    const col = MINIMAP_RGB[t] || grass;
    const edge = (y > 0 && world.terrainAt(x, y - 1) !== t) || (x > 0 && world.terrainAt(x - 1, y) !== t);
    const k = edge ? EDGE_SHADE : 1;
    const i = (y * w + x) * 4;
    d[i] = col[0] * k; d[i + 1] = col[1] * k; d[i + 2] = col[2] * k; d[i + 3] = 255;
  }
}

// Dot colours: two kinds for creatures, plus the quest marker drawn on top.
export const MINIMAP_DOT = { foe: '#E5484D', friend: '#FFF4D6', quest: '#FFD24A', ink: '#22304A' };

/** How a creature shows on the minimap: 'quest' (someone a quest in hand
 *  sends you to, or a moral choice waiting), 'foe' (anything you can fight)
 *  or 'friend' (townsfolk, shopkeepers, bankers...). */
export function minimapNpcKind(game, n) {
  if (n.attackable) return 'foe';
  if (game.moralPending?.(n) || questNpcIds(game).has(n.npcId)) return 'quest';
  return 'friend';
}

// ======================= The sticker map =======================
// The minimap and the world map are drawn as a hand-painted sticker map
// rather than one flat pixel per tile: rounded shapes, a navy ink coastline
// with a pale foam band inside it, cream roads with a darker hairline, a
// little paper grain, ripples on the water, and (on the minimap) tree blobs,
// pebbles and cream building blocks baked on top. The ground never changes,
// so it is painted once per chunk (minimap) or once in all (world map) and
// only copied afterwards: the per-refresh work stays a few drawImage calls.

const T = TERRAIN;
// The sticker map's palette: the painted ground's colours (MINIMAP_RGB) a
// touch lighter and creamier, so it reads as a printed map, not a screenshot.
export const ART_RGB = {
  [T.GRASS]: [150, 201, 104],
  [T.DARKGRASS]: [118, 176, 90],
  [T.PATH]: [246, 225, 182],
  [T.SAND]: [250, 226, 180],
  [T.STONE]: [240, 228, 208],
  [T.WOOD]: [206, 158, 108],
  [T.WATER]: [92, 186, 230],
};
// Each kind's edge where it meets the green (the hairline round a road or plaza).
const ART_EDGE = {
  [T.PATH]: [205, 156, 100],
  [T.SAND]: [222, 186, 132],
  [T.STONE]: [196, 174, 146],
  [T.WOOD]: [150, 104, 64],
};
export const ART_INK = [34, 48, 74];          // the navy ink line round every coast
const FOAM = [222, 244, 252], SHALLOW = [150, 214, 242], RIPPLE = [186, 230, 248];
const GREEN = (t) => t === T.GRASS || t === T.DARKGRASS;

/** A cheap, repeatable 0..1 hash of two integers (paper grain, ripples). */
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The ground kind under one pixel of a map painted `R` pixels per tile:
 *  the tile's own, except in a corner where both neighbours towards it are
 *  another kind, which is rounded off (so coasts and lawns curve). */
function artTerrainAt(world, gx, gy, R) {
  const tx = Math.floor(gx / R), ty = Math.floor(gy / R);
  const t = world.terrainAt(tx, ty);
  const fx = (gx - tx * R + 0.5) / R, fy = (gy - ty * R + 0.5) / R;
  const qx = fx < 0.5 ? -1 : 1, qy = fy < 0.5 ? -1 : 1;
  const a = world.terrainAt(tx + qx, ty);
  if (a === t || a !== world.terrainAt(tx, ty + qy)) return t;
  const cx = fx - 0.5, cy = fy - 0.5;
  return cx * cx + cy * cy > 0.25 ? a : t;   // outside the quarter circle: the neighbours' kind
}

/** Paint the sticker map's ground for tiles [x0, x0+tw) x [y0, y0+th) at `R`
 *  pixels per tile into `d` (RGBA, tw*R by th*R). Pure: no canvas needed. */
export function paintMinimapArt(world, d, x0, y0, tw, th, R) {
  const ink = Math.max(1, Math.round(R / 5)), foam = Math.max(1, Math.round(R * 0.3)), S = foam * 2;
  const M = S, pw = tw * R, ph = th * R, ew = pw + 2 * M, eh = ph + 2 * M;
  const gx0 = x0 * R - M, gy0 = y0 * R - M;
  // A tile whose neighbours are all its own kind is plain inside: its pixels
  // need no corner rounding or edge search (most of the map), only grain.
  const plain = new Uint8Array((tw + 2) * (th + 2));
  for (let ty = -1; ty <= th; ty++) for (let tx = -1; tx <= tw; tx++) {
    const X = x0 + tx, Y = y0 + ty, t = world.terrainAt(X, Y);
    let same = 1;
    for (let j = -1; j <= 1 && same; j++) for (let i = -1; i <= 1; i++) if (world.terrainAt(X + i, Y + j) !== t) { same = 0; break; }
    plain[(ty + 1) * (tw + 2) + tx + 1] = same;
  }
  const isPlain = (gx, gy) => {
    const tx = Math.floor(gx / R) - x0 + 1, ty = Math.floor(gy / R) - y0 + 1;
    return tx >= 0 && ty >= 0 && tx < tw + 2 && ty < th + 2 && plain[ty * (tw + 2) + tx] === 1;
  };
  // Each pixel's kind, with a margin so edges can look across a chunk's border.
  const E = new Uint8Array(ew * eh);
  for (let j = 0; j < eh; j++) for (let i = 0; i < ew; i++) {
    const gx = gx0 + i, gy = gy0 + j;
    E[j * ew + i] = isPlain(gx, gy) ? world.terrainAt(Math.floor(gx / R), Math.floor(gy / R)) : artTerrainAt(world, gx, gy, R);
  }
  const ns = Math.max(1, R >> 2);   // paper grain: blocks of this many pixels
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const ei = (y + M) * ew + x + M, t = E[ei], gx = gx0 + M + x, gy = gy0 + M + y;
    // How far (in pixels, up to S) to the nearest other kind, and which kind.
    let dist = 0, n = t;
    if (!isPlain(gx, gy)) {
      for (let k = 1; k <= S && !dist; k++) {
        const l = E[ei - k], r = E[ei + k], u = E[ei - k * ew], b = E[ei + k * ew];
        if (l !== t) { dist = k; n = l; } else if (r !== t) { dist = k; n = r; }
        else if (u !== t) { dist = k; n = u; } else if (b !== t) { dist = k; n = b; }
      }
    }
    let c = ART_RGB[t] || ART_RGB[T.GRASS], k = 1;
    const h = hash2(Math.floor(gx / ns), Math.floor(gy / ns));
    if (t === T.WATER) {
      if (dist && n !== T.WATER && dist <= foam) c = FOAM;
      else if (dist && n !== T.WATER) c = SHALLOW;
      else {
        // Little ripple dashes scattered over open water (too small to read on the world map).
        const cw = Math.max(3, Math.round(R * 1.5));
        if (R >= 4 && hash2(Math.floor(gx / cw), Math.floor(gy / R)) < 0.16 && gy % R === (R >> 1) && gx % cw < Math.max(1, Math.round(cw * 0.45))) c = RIPPLE;
      }
    } else if (dist && n === T.WATER && dist <= ink) c = ART_INK;
    else if (dist <= ink && dist && !GREEN(t) && GREEN(n) && ART_EDGE[t]) c = ART_EDGE[t];
    else {
      if (dist && dist <= ink && GREEN(t) && !GREEN(n) && n !== T.WATER) k = 0.9;   // a soft shade where the lawn meets a road
      // (A small map, the world map, keeps the grain faint and leaves out tufts.)
      k *= 1 + (h - 0.5) * (GREEN(t) ? 0.09 : 0.05) * (R >= 4 ? 1 : 0.4);
      if (GREEN(t) && R >= 4 && h > 0.965) c = t === T.GRASS ? [184, 222, 136] : [92, 150, 72];   // the odd tuft
      else if (t === T.WOOD && R >= 4 && gy % (R >> 1) === 0) k *= 0.86;           // planks
      else if (t === T.STONE && R >= 6 && (gx % R === 0 || gy % R === 0)) k *= 0.96;   // paving
    }
    const o = (y * pw + x) * 4;
    d[o] = c[0] * k; d[o + 1] = c[1] * k; d[o + 2] = c[2] * k; d[o + 3] = 255;
  }
}

// Building roofs: a pastel picked per building, like the painted shophouses.
const ROOFS = ['#F6A7A0', '#9ED9C4', '#C7B5F0', '#FFD98A', '#9CCBF2'];

/** Draw the static things over a painted patch of ground (`c` is its canvas
 *  context, tile (x0, y0) at its top-left, `R` pixels per tile): cream
 *  building blocks with a navy outline, tree blobs, pebbles, fishing ripples. */
export function drawMinimapDecor(c, world, x0, y0, tw, th, R) {
  if (!world.objectsIn) return;
  const lw = Math.max(0.75, R / 8);
  const objs = world.objectsIn(x0 - 12, y0 - 1, x0 + tw + 1, y0 + th + 12);
  // Buildings first (landmarks, stalls), then trees and rocks over the ground.
  for (const o of objs) {
    const def = o.def, fp = def.footprint;
    if (!fp && def.type !== 'stall' && def.type !== 'bank') continue;
    const [fw, fd] = fp || [1, 1];
    const x = (o.x - x0) * R + R * 0.08, y = (o.y - fd + 1 - y0) * R + R * 0.08, w = fw * R - R * 0.16, h = fd * R - R * 0.16;
    c.fillStyle = 'rgba(34,48,74,0.25)';
    c.fillRect(x + lw, y + lw * 1.6, w, h);
    c.fillStyle = '#FFF6E4';
    c.fillRect(x, y, w, h);
    c.fillStyle = ROOFS[(o.x * 7 + o.y * 3) % ROOFS.length];
    c.fillRect(x, y, w, Math.max(1, h * 0.42));
    if (R >= 4) { c.strokeStyle = '#22304A'; c.lineWidth = lw; c.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw); }
  }
  for (const o of objs) {
    const type = o.def.type;
    if (type !== 'tree' && type !== 'rock' && type !== 'fishing') continue;
    if (o.x < x0 - 1 || o.y < y0 - 1 || o.x > x0 + tw || o.y > y0 + th) continue;
    const cx = (o.x - x0 + 0.5) * R, cy = (o.y - y0 + 0.5) * R;
    if (type === 'tree') {
      const r = R * 0.68;
      c.fillStyle = 'rgba(34,48,74,0.22)';
      c.beginPath(); c.ellipse(cx + r * 0.15, cy + r * 0.55, r, r * 0.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3E8C47';
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      if (R >= 4) {
        c.strokeStyle = 'rgba(34,48,74,0.55)'; c.lineWidth = lw * 0.8; c.stroke();
        c.fillStyle = '#7CC46A';
        c.beginPath(); c.arc(cx - r * 0.3, cy - r * 0.3, r * 0.42, 0, Math.PI * 2); c.fill();
      }
    } else if (type === 'rock') {
      const r = R * 0.32;
      c.fillStyle = '#CFC7BC';
      c.beginPath(); c.ellipse(cx, cy, r * 1.15, r, 0, 0, Math.PI * 2); c.fill();
      if (R >= 4) { c.strokeStyle = 'rgba(34,48,74,0.6)'; c.lineWidth = lw * 0.8; c.stroke(); }
    } else if (R >= 4) {
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = lw;
      c.beginPath(); c.arc(cx, cy, R * 0.3, 0, Math.PI * 2); c.stroke();
    }
  }
}

/** A painted patch of the sticker map as a canvas, or null with no DOM (tests). */
export function bakeMinimapPatch(world, x0, y0, tw, th, R, decor = true) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = tw * R; cv.height = th * R;
  const c = cv.getContext('2d');
  if (!c) return null;
  const img = c.createImageData(cv.width, cv.height);
  paintMinimapArt(world, img.data, x0, y0, tw, th, R);
  c.putImageData(img, 0, 0);
  if (decor) drawMinimapDecor(c, world, x0, y0, tw, th, R);
  return cv;
}

// The minimap's ground is baked in square chunks as you walk into them, a
// few per refresh, and the most recent ones kept (a bounded cache).
export const MM_CHUNK = 16, MM_ART_PX = 8, MM_CHUNK_CAP = 96, MM_BAKES_PER_DRAW = 3;
export class MinimapChunks {
  constructor(world) { this.world = world; this.map = new Map(); }
  /** The chunk's canvas, baking it when the budget allows; null if not yet. */
  get(cx, cy, budget) {
    const key = cx * 4096 + cy;
    let cv = this.map.get(key);
    if (cv) { this.map.delete(key); this.map.set(key, cv); return cv; }   // most recently used last
    if (budget.n <= 0) return null;
    budget.n--;
    cv = bakeMinimapPatch(this.world, cx * MM_CHUNK, cy * MM_CHUNK, MM_CHUNK, MM_CHUNK, MM_ART_PX);
    if (!cv) return null;
    this.map.set(key, cv);
    if (this.map.size > MM_CHUNK_CAP) this.map.delete(this.map.keys().next().value);
    return cv;
  }
  /** Draw the ground round (px, py) into a W-wide box at `scale` px per tile.
   *  Returns false if any chunk is still waiting to be baked. */
  draw(ctx, px, py, W, H, scale) {
    const budget = { n: MM_BAKES_PER_DRAW };
    const left = px + 0.5 - W / 2 / scale, top = py + 0.5 - H / 2 / scale;
    const c0 = Math.floor(left / MM_CHUNK), c1 = Math.floor((left + W / scale) / MM_CHUNK);
    const r0 = Math.floor(top / MM_CHUNK), r1 = Math.floor((top + H / scale) / MM_CHUNK);
    const k = scale / MM_ART_PX, side = MM_CHUNK * scale;
    let whole = true;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const cv = this.get(cx, cy, budget);
      if (!cv) { whole = false; continue; }
      ctx.drawImage(cv, (cx * MM_CHUNK - left) * scale, (cy * MM_CHUNK - top) * scale, cv.width * k, side);
    }
    return whole;
  }
}

// ---------------- Landmark badges ----------------
// Small round sticker badges for the places you look for on a map: a navy
// ring, a pastel fill and a white glyph. Each is drawn once per size and
// pixel ratio and then copied.
export const BADGE = {
  bank: { fill: '#F5B82E' }, mrt: { fill: '#FFFFFF' }, shop: { fill: '#F28CB1' },
  smith: { fill: '#F39A4A' }, fish: { fill: '#5AB4E8' }, shrine: { fill: '#A98BE6' },
  boss: { fill: '#E5484D' }, gate: { fill: '#7E5BD6' },
};
/** Which badge (if any) a world object wears on the minimap. */
export function minimapObjectBadge(o) {
  const t = o.def.type;
  if (t === 'bank') return 'bank';
  if (t === 'transport') return 'mrt';
  if (t === 'anvil' || t === 'furnace' || t === 'range' || t === 'craft' || t === 'fletch' || t === 'herblore') return 'smith';
  if (t === 'shrine' || t === 'offering' || t === 'gate_shrine') return 'shrine';
  if (t === 'gate') return 'gate';
  if (t === 'stall') return 'shop';
  return null;
}
/** Which badge a creature wears instead of its dot: bosses and shopkeepers. */
export function minimapNpcBadge(n) {
  if (n.def?.boss && !n.temporary) return 'boss';
  if (!n.attackable && (n.def?.shop || n.def?.role === 'shop')) return 'shop';
  if (!n.attackable && n.def?.role === 'bank') return 'bank';
  return null;
}
// Badges a small (phone) minimap keeps; the rest would crowd it.
export const BADGE_ESSENTIAL = new Set(['bank', 'mrt', 'boss', 'shop']);

function glyph(c, kind, r) {
  c.fillStyle = '#fff'; c.strokeStyle = '#22304A';
  const s = r / 6;
  c.lineWidth = 1.1 * s; c.lineJoin = 'round'; c.lineCap = 'round';
  switch (kind) {
    case 'mrt':   // the red M, as on the world map
      c.strokeStyle = '#C0392B'; c.lineWidth = 1.7 * s;
      c.beginPath(); c.moveTo(-3 * s, 2.6 * s); c.lineTo(-3 * s, -2.6 * s); c.lineTo(0, 0.8 * s); c.lineTo(3 * s, -2.6 * s); c.lineTo(3 * s, 2.6 * s); c.stroke();
      break;
    case 'bank':   // a stack of coin
      c.beginPath(); c.ellipse(0, 1.2 * s, 3.2 * s, 1.5 * s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, -1 * s, 3.2 * s, 1.5 * s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      break;
    case 'shop': {   // a shopping bag
      c.beginPath(); c.rect(-2.8 * s, -1 * s, 5.6 * s, 4.2 * s); c.fill(); c.stroke();
      c.beginPath(); c.arc(0, -1 * s, 1.6 * s, Math.PI, 0); c.stroke();
      break;
    }
    case 'smith':   // a hammer
      c.save(); c.rotate(-Math.PI / 4);
      c.beginPath(); c.rect(-0.7 * s, -1 * s, 1.4 * s, 5 * s); c.fill(); c.stroke();
      c.beginPath(); c.rect(-3 * s, -3.4 * s, 6 * s, 2.6 * s); c.fill(); c.stroke();
      c.restore();
      break;
    case 'fish':
      c.beginPath(); c.ellipse(-0.6 * s, 0, 2.6 * s, 1.7 * s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(1.6 * s, 0); c.lineTo(3.4 * s, -1.6 * s); c.lineTo(3.4 * s, 1.6 * s); c.closePath(); c.fill(); c.stroke();
      break;
    case 'shrine': case 'gate': {   // a four-point sparkle
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, q = i % 2 ? 1.2 * s : 3.6 * s; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
      c.closePath(); c.fill(); c.stroke();
      break;
    }
    case 'boss':   // a crown
      c.beginPath(); c.moveTo(-3.2 * s, 2.4 * s); c.lineTo(-3.2 * s, -2.2 * s); c.lineTo(-1.3 * s, -0.4 * s); c.lineTo(0, -2.8 * s);
      c.lineTo(1.3 * s, -0.4 * s); c.lineTo(3.2 * s, -2.2 * s); c.lineTo(3.2 * s, 2.4 * s); c.closePath(); c.fill(); c.stroke();
      break;
  }
}

const badgeCache = new Map();
/** A badge's picture (radius `r` in map units, at pixel ratio `dpr`), or null headless. */
export function badgeSprite(kind, r, dpr = 1) {
  const key = `${kind}|${r}|${dpr}`;
  if (badgeCache.has(key)) return badgeCache.get(key);
  let cv = null;
  if (typeof document !== 'undefined' && BADGE[kind]) {
    const pad = 2, side = Math.ceil((r + pad) * 2 * dpr);
    cv = document.createElement('canvas'); cv.width = side; cv.height = side;
    const c = cv.getContext('2d');
    if (c) {
      c.scale(dpr, dpr); c.translate(r + pad, r + pad);
      c.fillStyle = 'rgba(34,48,74,0.3)';   // the sticker's drop shadow
      c.beginPath(); c.arc(0, 1.2, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#22304A';
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = BADGE[kind].fill;
      c.beginPath(); c.arc(0, 0, r - 1.2, 0, Math.PI * 2); c.fill();
      glyph(c, kind, r - 1.2);
    }
  }
  badgeCache.set(key, cv);
  return cv;
}

// ---------------- The ring ----------------
/** The minimap's sticker ring as a picture (size W, map radius `mr`): a white
 *  rim between navy lines, a soft inner shade, and a compass on the rim (a
 *  red N tab at the top, small ticks east, south and west). Null headless. */
export function minimapRing(W, mr, dpr = 1) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.ceil(W * dpr);
  const c = cv.getContext('2d');
  if (!c) return null;
  c.scale(dpr, dpr);
  const m = W / 2, outer = m - 1.2;
  // A soft shade just inside the rim, so the map sits under the ring.
  const g = c.createRadialGradient(m, m, mr * 0.72, m, m, mr);
  g.addColorStop(0, 'rgba(34,48,74,0)'); g.addColorStop(1, 'rgba(34,48,74,0.26)');
  c.fillStyle = g;
  c.beginPath(); c.arc(m, m, mr, 0, Math.PI * 2); c.fill();
  // White rim with navy lines either side.
  c.lineWidth = outer - mr; c.strokeStyle = '#FFFFFF';
  c.beginPath(); c.arc(m, m, (outer + mr) / 2, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#22304A';
  c.lineWidth = 2; c.beginPath(); c.arc(m, m, outer, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 1.4; c.beginPath(); c.arc(m, m, mr, 0, Math.PI * 2); c.stroke();
  // Compass ticks on the rim: east, south, west.
  const rim = (outer + mr) / 2;
  c.fillStyle = '#22304A';
  for (const a of [0, Math.PI / 2, Math.PI]) {
    c.save(); c.translate(m + Math.cos(a) * rim, m + Math.sin(a) * rim); c.rotate(a);
    c.beginPath(); c.moveTo(2.6, 0); c.lineTo(-1.6, -2); c.lineTo(-1.6, 2); c.closePath(); c.fill();
    c.restore();
  }
  // North: a red tab on the rim with a white N.
  const ny = m - rim;
  c.fillStyle = '#C0392B'; c.strokeStyle = '#22304A'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(m, ny - 8.5); c.lineTo(m + 7, ny - 1); c.lineTo(m + 5, ny + 6); c.lineTo(m - 5, ny + 6); c.lineTo(m - 7, ny - 1); c.closePath();
  c.fill(); c.stroke();
  c.fillStyle = '#FFFFFF';
  c.font = '900 9px Nunito, "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', m, ny + 0.8);
  return cv;
}

/** The point on a circle of radius `r` round the middle of a W x H map in
 *  the direction of (dx, dy): where a rim arrow for something off the map goes. */
export function rimPoint(W, H, dx, dy, r) {
  const a = Math.atan2(dy, dx);
  return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, a };
}
