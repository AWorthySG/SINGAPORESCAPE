import { getObject } from '../data/objects.js';
import { TERRAIN } from '../data/world.js';
import { STATIONS } from '../data/transport.js';
import { GEOGRAPHIC_PLACE_BY_ID } from '../data/geography.js';
import { uid } from '../core/utils.js';
import { FIRE_LIFETIME_TICKS, GROUND_ITEM_LIFETIME_TICKS } from '../config.js';

const OBJ_CELL = 16;   // tiles per side of a spatial-index bucket

// Runtime world state: terrain, object instances (with depletion/respawn),
// ground items and temporary fires. Collision is derived from terrain + blocking objects.
export class World {
  constructor(bus) {
    this.bus = bus;
  }

  build(data, { forward, reverse } = {}) {
    this.layout = data.layout || 'legacy';
    this._forward = forward;
    this._reverse = reverse;
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
    const stations = forward ? STATIONS.map((station) => this.authoredTile({ ...station, access: GEOGRAPHIC_PLACE_BY_ID[station.id]?.access })) : STATIONS;
    this.stations = stations.filter((station) => !station.access);
    this._stationById = new Map(stations.map((station) => [station.id, station]));
    this.ferryLinks = data.ferryLinks || [];
    this._walkComponents = null;

    this.objects = [];
    this.objectByTile = new Map();
    this._miningOrigins = new Map();
    this.landmarks = [];   // the multi-tile set pieces, drawn by their own short list (renderer.js)
    this.groundItems = [];
    this.baseBlocked = new Uint8Array(this.width * this.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.terrain[this.idx(x, y)] === TERRAIN.WATER) this.baseBlocked[this.idx(x, y)] = 1;
      }
    }
    const islandStops = new Map(stations.filter((station) => station.access).map((station) => [this.idx(station.x, station.y), station]));
    for (const o of data.objects) {
      const extra = {};
      if (o.sign) extra.sign = o.sign;
      if (o.art) extra.art = o.art;
      if (o.displayName) extra.def = { ...getObject(o.objId), name: o.displayName };
      const island = o.objId === 'mrt_station' && islandStops.get(this.idx(o.x, o.y));
      if (island) this.addObject('sign', o.x, o.y, { sign: island.name });
      else {
        if (o.miningOrigin) extra.miningOrigin = o.miningOrigin;
        const obj = this.addObject(o.objId, o.x, o.y, extra);
        if (o.miningOrigin) this._miningOrigins.set(this.idx(o.miningOrigin.x, o.miningOrigin.y), obj);
      }
    }
    for (const { from, to } of this.ferryLinks) {
      this.addFerryLanding(from, to);
      this.addFerryLanding(to, from);
    }
  }

  authoredTile(tile) {
    const at = this._forward?.(tile.x, tile.y);
    return at ? { ...tile, ...at } : tile;
  }

  legacyTile(tile) {
    const at = this._reverse?.(tile.x, tile.y);
    return at ? { ...tile, ...at } : tile;
  }

  station(id) { return this._stationById.get(id); }

  addFerryLanding(from, to) {
    const def = { ...getObject('ferry_landing'), name: `Ferry to ${to.name}` };
    this.addObject('ferry_landing', from.x, from.y, { def, art: 'obj-sampan', destination: to });
  }

  /** First crossing for a trip between land areas. Cache connected walkable
   *  areas as they are used, since many trips share the same mainland. */
  ferryToward(from, to) {
    if (!this.ferryLinks.length) return null;
    const source = this._walkComponent(from);
    const target = this._walkComponent(to);
    if (!source || !target || source === target) return null;
    const queue = [{ component: source, landing: null }];
    const seen = new Set([source]);
    for (const step of queue) {
      for (const link of this.ferryLinks) {
        const a = this._walkComponent(link.from), b = this._walkComponent(link.to);
        const start = a === step.component ? link.from : b === step.component ? link.to : null;
        const next = a === step.component ? b : a;
        if (!start || !next || seen.has(next)) continue;
        const landing = step.landing || this.objectAt(start.x, start.y);
        if (next === target) return landing;
        seen.add(next);
        queue.push({ component: next, landing });
      }
    }
    return null;
  }

  _walkComponent(tile) {
    let { x, y } = tile;
    if (this.isBlocked(x, y)) {
      const near = [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]].find(([nx, ny]) => !this.isBlocked(nx, ny));
      if (!near) return 0;
      [x, y] = near;
    }
    const state = this._walkComponents ||= { ids: new Uint16Array(this.width * this.height), count: 0 };
    const start = this.idx(x, y);
    if (state.ids[start]) return state.ids[start];
    const id = ++state.count;
    const queue = [start];
    const width = this.width;
    state.ids[start] = id;
    while (queue.length) {
      const i = queue.pop();
      const col = i % width;
      const march = (next) => {
        if (state.ids[next] || this.baseBlocked[next]) return;
        state.ids[next] = id;
        queue.push(next);
      };
      if (col > 0) march(i - 1);
      if (col + 1 < width) march(i + 1);
      if (i >= width) march(i - width);
      if (i < state.ids.length - width) march(i + width);
    }
    return id;
  }

  idx(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && x < this.width && y >= 0 && y < this.height; }
  terrainAt(x, y) { return this.inBounds(x, y) ? this.terrain[this.idx(x, y)] : TERRAIN.WATER; }

  /** Region/zone descriptor for a tile (first matching rect wins). Asked
   *  hundreds of times a tick (and once per object by auto gather's search),
   *  so each tile's answer is kept: the zones never move, and a new list of
   *  them starts the record afresh. */
  zoneAt(x, y) {
    if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height && this.zones.length < 32000) {
      let c = this._zoneOf;
      if (!c || c.zones !== this.zones || c.len !== this.zones.length || c.w !== this.width || c.at.length !== this.width * this.height) {
        c = this._zoneOf = { zones: this.zones, len: this.zones.length, w: this.width, at: new Int16Array(this.width * this.height).fill(-2) };
      }
      const i = y * this.width + x;
      let k = c.at[i];
      if (k === -2) {   // not asked yet: the first zone that holds it, or -1 for none
        k = this.zones.findIndex((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);
        c.at[i] = k;
      }
      return k >= 0 ? this.zones[k] : null;
    }
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
    this._objRev = (this._objRev || 0) + 1;   // the object list changed (see emberSources)
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
      this._objRev = (this._objRev || 0) + 1;
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

  /** Resolve a saved work target on a rock's former tile. */
  miningNodeAtOrigin(x, y) {
    return this._miningOrigins.get(this.idx(x, y));
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

  /** The fires and furnaces (each gives off embers every tick), in `objects`
   *  order. Kept until an object is added or removed, instead of walking the
   *  thousands of objects every tick to find the handful. */
  emberSources() {
    const c = this._embers;
    if (c && c.rev === this._objRev && c.arr === this.objects && c.len === this.objects.length) return c.list;
    const list = this.objects.filter((o) => o.def.type === 'fire' || o.def.type === 'furnace');
    this._embers = { rev: this._objRev, arr: this.objects, len: this.objects.length, list };
    return list;
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

  /** The walls as a grid for path searches (findPath's cfg.grid, read straight
   *  off): baseBlocked, unless isBlocked has been swapped on this world (tests
   *  do), when a search must ask that instead. */
  wallGrid() { return this.isBlocked === World.prototype.isBlocked ? this.baseBlocked : null; }

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
