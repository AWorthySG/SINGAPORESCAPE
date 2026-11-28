import { TILE } from '../config.js';
import { TERRAIN } from '../data/world.js';
import { bakeBudget } from './governor.js';
import { foliageKind } from './foliage.js';

const WATER = TERRAIN.WATER, REACH = 4;
const WATER_PROPS = new Set(['lamp', 'heritage_lamp', 'lantern_post', 'wall', 'sign']);
const WATER_ROOMS = new Set(['bank', 'stall', 'transport']);

const bank = (world, x, y) => world.inBounds?.(x, y) !== false && world.terrainAt(x, y) !== WATER;

/** Each corner belongs to four tiles, so neighbours share the same depth at their edge. */
export function waterCorners(world, x, y) {
  const n = bank(world, x, y - 1), s = bank(world, x, y + 1);
  const w = bank(world, x - 1, y), e = bank(world, x + 1, y);
  return (n || w || bank(world, x - 1, y - 1) ? 1 : 0) |
    (n || e || bank(world, x + 1, y - 1) ? 2 : 0) |
    (s || w || bank(world, x - 1, y + 1) ? 4 : 0) |
    (s || e || bank(world, x + 1, y + 1) ? 8 : 0);
}

export function shallowFraction(bits, u, v) {
  const north = (bits & 1 ? 1 - u : 0) + (bits & 2 ? u : 0);
  const south = (bits & 4 ? 1 - u : 0) + (bits & 8 ? u : 0);
  return north * (1 - v) + south * v;
}

export function waterBelow(world, x, y, width = 1) {
  const cells = [];
  for (let dy = 0; dy <= REACH; dy++) {
    for (let dx = -1; dx <= width; dx++) {
      const wx = x + dx, wy = y + dy;
      if (world.inBounds?.(wx, wy) !== false && world.terrainAt(wx, wy) === WATER) cells.push([wx, wy]);
    }
  }
  return cells;
}

/** Build reflections into the receiving chunk, even if the object's base is in its neighbour. */
export function shoreReflections(world, x0, y0, x1, y1) {
  const entries = [];
  const casters = world.objectsIn?.(x0 - 5, y0 - REACH, x1, y1 - 1) ?? [];
  if (!world.objectsIn && world.objectAt) {
    for (let y = y0 - REACH; y < y1; y++) for (let x = x0 - 5; x <= x1; x++) {
      const object = world.objectAt(x, y);
      if (object) casters.push(object);
    }
  }
  for (const o of casters) {
    const width = o.def.footprint?.[0] || 1;
    if (!o.def.footprint && o.def.type !== 'tree' && !foliageKind(o) && !WATER_ROOMS.has(o.def.type) && !WATER_PROPS.has(o.objId)) continue;
    const tiles = waterBelow(world, o.x, o.y, width).filter(([x, y]) => x >= x0 && x < x1 && y >= y0 && y < y1);
    if (tiles.length) entries.push({ o, width, tiles });
  }
  return entries;
}

export class WaterDepth {
  constructor(makeCanvas) {
    this.makeCanvas = makeCanvas;
    this.beds = [];
    this.mirrors = new WeakMap();
  }

  // A tiny stamp is enough for each combination of deep and shallow corners.
  drawBed(ctx, world, x, y, sx, sy) {
    const bits = waterCorners(world, x, y);
    let bed = this.beds[bits];
    if (bed === undefined) {
      const cv = this.makeCanvas(TILE, TILE);
      bed = null;
      const ink = cv?.g.createImageData?.(TILE, TILE);
      if (ink?.data) {
        for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
          const f = shallowFraction(bits, px / (TILE - 1), py / (TILE - 1));
          const k = f * f * (3 - 2 * f), i = (py * TILE + px) * 4;
          // The baseline colour meets the feathered bank at its lip. The
          // pale band sits below it, so no straight stripe follows the tiles.
          const light = k > 0.34, shallows = (k - 0.34) / 0.66;
          ink.data[i] = light ? 168 : 26;
          ink.data[i + 1] = light ? 231 : 69;
          ink.data[i + 2] = light ? 193 : 116;
          ink.data[i + 3] = Math.round(light ? 124 * shallows * (1 - shallows) : 96 * (0.34 - k));
        }
        cv.g.putImageData(ink, 0, 0);
        bed = cv.c;
      }
      this.beds[bits] = bed;
    }
    if (bed) ctx.drawImage(bed, sx, sy);
  }

  // Flip the painted silhouette, tint it towards the water and fade the
  // far end. The finished picture needs only three blits while rippling.
  mirror(img) {
    let pic = this.mirrors.get(img);
    if (pic !== undefined) return pic;
    if (!bakeBudget.ok()) return null;
    pic = bakeBudget.run(() => {
      const scale = Math.min(1, 144 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const cv = this.makeCanvas(w, h);
      if (!cv?.g.createLinearGradient) return null;
      const { c, g } = cv;
      g.setTransform(1, 0, 0, -1, 0, h);
      g.drawImage(img, 0, 0, w, h);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(43,106,123,0.24)';
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-in';
      const fade = g.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, '#fff');
      fade.addColorStop(0.42, 'rgba(255,255,255,0.78)');
      fade.addColorStop(0.80, 'rgba(255,255,255,0.36)');
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = fade;
      g.fillRect(0, 0, w, h);
      return c;
    });
    this.mirrors.set(img, pic);
    return pic;
  }

  drawMirror(ctx, art, cx, fy, time, seed) {
    const img = this.mirror(art.img);
    if (!img) return;
    const w = art.w, h = art.h * 0.88;
    ctx.save();
    ctx.translate(cx, fy);
    if (art.flip) ctx.scale(-1, 1);
    if (!time) ctx.drawImage(img, -w / 2, 0, w, h);
    else for (let i = 0, top = 0; i < 3; i++) {
      const end = Math.round((i + 1) * img.height / 3);
      if (end === top) continue;
      const ripple = Math.sin(time * 0.0021 + i * 1.85 + seed) * (0.28 + i * 0.88);
      ctx.drawImage(img, 0, top, img.width, end - top, -w / 2 + ripple, h * top / img.height, w, h * (end - top) / img.height);
      top = end;
    }
    ctx.restore();
  }
}
