// Resource zones: named places packed with one life skill's nodes (a quarry,
// a timberland, a fishing pier, a hunting ground), laid out in world.js and
// kept on world.resourceZones. Each has a signpost in the middle and a label
// on the world map; walking in says what it holds and what level it wants.

import { SKILL_BY_ID } from '../data/skills.js';
import { nodeLevel } from './gathering.js';
import { OBJECTS } from '../data/objects.js';

const MARGIN = 2;   // tiles round a zone's nodes that still count as inside it

/** The resource zone at (x, y), or null. */
export function resourceZoneAt(world, x, y) {
  for (const z of world.resourceZones || []) {
    if (x >= z.x0 - MARGIN && x <= z.x1 + MARGIN && y >= z.y0 - MARGIN && y <= z.y1 + MARGIN) return z;
  }
  return null;
}

/** The nodes inside a zone: [{ objId, name, level, n }], lowest level first. */
export function zoneNodes(world, z) {
  const m = new Map();
  for (const o of world.objects) {
    if (o.def.skill !== z.skill || o.x < z.x0 || o.x > z.x1 || o.y < z.y0 || o.y > z.y1) continue;
    const e = m.get(o.objId) || { objId: o.objId, name: o.def.name, level: nodeLevel(o.def), n: 0 };
    e.n++; m.set(o.objId, e);
  }
  return [...m.values()].sort((a, b) => a.level - b.level);
}

/** One line about a zone: "Ubin Granite Quarry: 26 Mining spots, level 1-40". */
export function zoneSummary(world, z) {
  const nodes = zoneNodes(world, z);
  const n = nodes.reduce((s, e) => s + e.n, 0);
  const lo = nodes.length ? nodes[0].level : 1, hi = nodes.length ? nodes[nodes.length - 1].level : 1;
  return `${z.name}: ${n} ${SKILL_BY_ID[z.skill]?.name || z.skill} spots, level ${lo}${hi > lo ? `-${hi}` : ''}`;
}

/** The grove (groves.js: a patch thick with one kind of tree) at (x, y), or null. */
export function groveAt(world, x, y) {
  for (const g of world.groves || []) {
    if (x >= g.x0 - MARGIN && x <= g.x1 + MARGIN && y >= g.y0 - MARGIN && y <= g.y1 + MARGIN) return g;
  }
  return null;
}

/** One line about a grove: "Tekong Yew Grove: 16 yew trees, Woodcutting 60". */
export function groveSummary(g) {
  const def = OBJECTS[g.objId];
  return `${g.name}: ${g.count} ${(def?.name || g.objId).toLowerCase()}s, Woodcutting ${def?.level || 1}`;
}

/** Says hello when you walk into a zone or a grove (once each time you enter). */
export class ZoneWatch {
  constructor(game) {
    this.game = game;
    this.current = null;   // the zone you're in (id), or null
    game.bus.on('tick', () => this.tick());
  }
  tick() {
    const g = this.game, p = g.player;
    if (!p?.alive || !(g.world?.resourceZones?.length || g.world?.groves?.length)) return;
    const z = resourceZoneAt(g.world, p.x, p.y), gr = z ? null : groveAt(g.world, p.x, p.y);
    const id = z?.id || gr?.id || null;
    if (id === this.current) return;
    this.current = id;
    if (z) g.msg(`You enter ${zoneSummary(g.world, z)}.`, 'level');
    else if (gr) g.msg(`You enter ${groveSummary(gr)}.`, 'level');
  }
}
