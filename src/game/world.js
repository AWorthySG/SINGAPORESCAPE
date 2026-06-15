import { getObject } from '../data/objects.js';
import { TERRAIN } from '../data/world.js';
import { uid } from '../core/utils.js';
import { FIRE_LIFETIME_TICKS, GROUND_ITEM_LIFETIME_TICKS } from '../config.js';

// Runtime world state: terrain, object instances (with depletion/respawn),
// ground items and temporary fires. Collision is derived from terrain + blocking objects.
export class World {
  constructor(bus) {
    this.bus = bus;
  }

  build(data) {
    this.width = data.width;
    this.height = data.height;
    this.terrain = data.terrain;
    this.townName = data.townName;
    this.spawnPoint = data.spawnPoint;
    this.respawnPoint = data.respawnPoint;
    this.npcSpawns = data.npcSpawns;
    this.zones = data.zones || [];

    this.objects = [];
    this.objectByTile = new Map();
    this.groundItems = [];
    this.baseBlocked = new Uint8Array(this.width * this.height);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.terrain[this.idx(x, y)] === TERRAIN.WATER) this.baseBlocked[this.idx(x, y)] = 1;
      }
    }
    for (const o of data.objects) this.addObject(o.objId, o.x, o.y, o.sign ? { sign: o.sign } : {});
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
    this.objects.push(inst);
    this.objectByTile.set(this.idx(x, y), inst);
    if (def.blocking && this.inBounds(x, y)) this.baseBlocked[this.idx(x, y)] = 1;
    return inst;
  }

  removeObject(inst) {
    const i = this.objects.indexOf(inst);
    if (i !== -1) this.objects.splice(i, 1);
    if (this.objectByTile.get(this.idx(inst.x, inst.y)) === inst) {
      this.objectByTile.delete(this.idx(inst.x, inst.y));
    }
    // Recompute blocking for the tile (could still be water).
    if (this.inBounds(inst.x, inst.y)) {
      this.baseBlocked[this.idx(inst.x, inst.y)] =
        this.terrain[this.idx(inst.x, inst.y)] === TERRAIN.WATER ? 1 : 0;
    }
  }

  objectAt(x, y) {
    return this.objectByTile.get(this.idx(x, y)) || null;
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
