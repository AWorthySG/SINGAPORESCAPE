import { getObject } from '../data/objects.js';
import { TERRAIN } from '../data/world.js';
import { uid } from '../core/utils.js';
import { FIRE_LIFETIME_TICKS, GROUND_ITEM_LIFETIME_TICKS } from '../config.js';

const OBJ_CELL = 16;   // tiles per side of a spatial-index bucket

// Runtime world state: terrain, object instances (with depletion/respawn),
// ground items and temporary fires. Collision is derived from terrain + blocking objects.
export class World {
  constructor(bus) {
    this.bus = bus;
  }

  build(data) {
    this.width = data.width;
    this.height = data.height;
    this.mapHeight = data.mapHeight || data.height;   // the country, without the sea the Endless Gate floats in
    this.terrain = data.terrain;
    this.townName = data.townName;
    this.spawnPoint = data.spawnPoint;
    this.respawnPoint = data.respawnPoint;
    this.npcSpawns = data.npcSpawns;
    this.zones = data.zones || [];
    this.towns = data.towns || [];   // [x0, y0, x1, y1] of each outer town
    this.resourceZones = data.resourceZones || [];   // { id, name, skill, cx, cy, x0..y1 } (world.js, resourcezones.js)
    this.groves = data.groves || [];   // patches thick with one kind of tree, { id, name, objId, region, cx, cy, x0..y1, count } (groves.js)

    this.objects = [];
    this.objectByTile = new Map();
    this.landmarks = [];   // the multi-tile set pieces, drawn by their own short list (renderer.js)
    this.groundItems = [];
    this.baseBlocked = new Uint8Array(this.width * this.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.terrain[this.idx(x, y)] === TERRAIN.WATER) this.baseBlocked[this.idx(x, y)] = 1;
      }
    }
    for (const o of data.objects) this.addObject(o.objId, o.x, o.y, o.sign ? (o.art ? { sign: o.sign, art: o.art } : { sign: o.sign }) : {});
  }

  idx(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && x < this.width && y >= 0 && y < this.height; }
  terrainAt(x, y) { return this.inBounds(x, y) ? this.terrain[this.idx(x, y)] : TERRAIN.WATER; }

  /** Region/zone descriptor for a tile (first matching rect wins). */
  zoneAt(x, y) {
    for (const z of this.zones) {
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
    }
    return null;
  }

  addObject(objId, x, y, extra = {}) {
    const def = getObject(objId);
    const inst = { uid: uid(), objId, def, x, y, depleted: false, respawnTimer: 0, ...extra };
    if (def.type === 'fire') inst.lifetime = FIRE_LIFETIME_TICKS;
    const ix = this._oix && this._oix.arr === this.objects && this._oix.len === this.objects.length ? this._oix : null;
    this.objects.push(inst);
    if (ix) { ix.len++; ix.rank.set(inst, ix.next++); this._cellOf(ix.cells, ix.cols, ix.rows, inst).push(inst); }
    this.objectByTile.set(this.idx(x, y), inst);
    if (def.blocking && this.inBounds(x, y)) this.baseBlocked[this.idx(x, y)] = 1;
    // A landmark covers its whole footprint (it stands on its front-left tile):
    // every tile of it blocks, and finds it.
    if (def.footprint) {
      for (const [tx, ty] of this.footprint(inst)) {
        if (!this.inBounds(tx, ty)) continue;
        this.objectByTile.set(this.idx(tx, ty), inst);
        this.baseBlocked[this.idx(tx, ty)] = 1;
      }
      this.landmarks.push(inst);
    }
    return inst;
  }

  removeObject(inst) {
    const ix = this._oix && this._oix.arr === this.objects && this._oix.len === this.objects.length ? this._oix : null;
    const i = this.objects.indexOf(inst);
    if (i !== -1) {
      this.objects.splice(i, 1);
      if (ix) { ix.len--; const c = this._cellOf(ix.cells, ix.cols, ix.rows, inst), j = c.indexOf(inst); if (j !== -1) c.splice(j, 1); ix.rank.delete(inst); }
    }
    for (const [x, y] of inst.def.footprint ? this.footprint(inst) : [[inst.x, inst.y]]) {
      if (this.objectByTile.get(this.idx(x, y)) === inst) this.objectByTile.delete(this.idx(x, y));
      // Recompute blocking for the tile (could still be water).
      if (this.inBounds(x, y)) this.baseBlocked[this.idx(x, y)] = this.terrain[this.idx(x, y)] === TERRAIN.WATER ? 1 : 0;
    }
    if (inst.def.footprint) this.landmarks = this.landmarks.filter((o) => o !== inst);
  }

  /** The tiles a landmark covers: [wide, deep] tiles from its front-left tile, going back (north). */
  footprint(o) {
    const [w, d] = o.def.footprint || [1, 1], out = [];
    for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) out.push([o.x + dx, o.y - dy]);
    return out;
  }

  objectAt(x, y) {
    return this.objectByTile.get(this.idx(x, y)) || null;
  }

  // ---------------- Spatial index ----------------
  // The world holds thousands of objects; per-frame work (what's in view, what
  // you can reach) asks for the few in a small box through a grid of
  // OBJ_CELL-tile buckets. It is (re)made from `objects` whenever that list is
  // replaced or changed behind addObject/removeObject's back.
  _objIndex() {
    const ix = this._oix;
    if (ix && ix.arr === this.objects && ix.len === this.objects.length) return ix;
    const cols = Math.ceil((this.width || 1) / OBJ_CELL), rows = Math.ceil((this.height || 1) / OBJ_CELL);
    const cells = new Map(), rank = new Map();
    this.objects.forEach((o, i) => { rank.set(o, i); this._cellOf(cells, cols, rows, o).push(o); });
    return (this._oix = { arr: this.objects, len: this.objects.length, cols, rows, cells, rank, next: this.objects.length });
  }

  _cellOf(cells, cols, rows, o) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(o.x / OBJ_CELL))), cy = Math.min(rows - 1, Math.max(0, Math.floor(o.y / OBJ_CELL)));
    const k = cy * cols + cx;
    let c = cells.get(k);
    if (!c) cells.set(k, (c = []));
    return c;
  }

  /** The objects standing in tiles x0..x1, y0..y1 (inclusive), in the same
   *  order as `objects` (so depth ties draw as before). Fills and returns `out`. */
  objectsIn(x0, y0, x1, y1, out = []) {
    out.length = 0;
    const ix = this._objIndex();
    // (Anything off the map's edge sits in its edge cells, hence the clamping.)
    const cl = (v, n) => Math.min(n - 1, Math.max(0, Math.floor(v / OBJ_CELL)));
    const c0x = cl(x0, ix.cols), c1x = cl(x1, ix.cols), c0y = cl(y0, ix.rows), c1y = cl(y1, ix.rows);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const c = ix.cells.get(cy * ix.cols + cx);
        if (c) for (const o of c) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push(o);
      }
    }
    if (out.length > 1) out.sort((a, b) => ix.rank.get(a) - ix.rank.get(b));
    return out;
  }

  /** Set a harvest judder on an object (trees and rocks as they're worked);
   *  the frame update runs it down (tickShakes) without visiting every object. */
  shake(o, ms) {
    o.shakeT = ms;
    (this._shaking ||= new Set()).add(o);
  }

  tickShakes(dt) {
    if (!this._shaking) return;
    for (const o of this._shaking) {
      if (o.shakeT > 0) o.shakeT = Math.max(0, o.shakeT - dt);
      if (!(o.shakeT > 0)) this._shaking.delete(o);
    }
  }

  isBlocked(x, y) {
    if (!this.inBounds(x, y)) return true;
    return this.baseBlocked[this.idx(x, y)] === 1;
  }

  // ---------------- Ground items ----------------
  addGroundItem(id, qty, x, y) {
    const gi = { uid: uid(), id, qty, x, y, timer: GROUND_ITEM_LIFETIME_TICKS };
    this.groundItems.push(gi);
    this.bus?.emit('grounditems');
    return gi;
  }

  removeGroundItem(gi) {
    const i = this.groundItems.indexOf(gi);
    if (i !== -1) { this.groundItems.splice(i, 1); this.bus?.emit('grounditems'); }
  }

  groundItemsAt(x, y) {
    return this.groundItems.filter((g) => g.x === x && g.y === y);
  }

  topGroundItemAt(x, y) {
    // Most recently dropped item shows on top.
    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const g = this.groundItems[i];
      if (g.x === x && g.y === y) return g;
    }
    return null;
  }

  // ---------------- Fires ----------------
  lightFire(x, y) {
    if (this.objectAt(x, y)) return null; // tile occupied
    return this.addObject('fire', x, y);
  }

  // ---------------- Per-tick upkeep ----------------
  tick() {
    let groundChanged = false;
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (o.depleted && o.respawnTimer > 0 && --o.respawnTimer <= 0) {
        o.depleted = false;
      }
      if (o.def.type === 'fire' && o.lifetime !== undefined) {
        if (--o.lifetime <= 0) this.removeObject(o);
      }
    }
    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      if (--this.groundItems[i].timer <= 0) { this.groundItems.splice(i, 1); groundChanged = true; }
    }
    if (groundChanged) this.bus?.emit('grounditems');
  }
}
