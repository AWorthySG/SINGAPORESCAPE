// Construction in the world: two lumber yards, where anyone can saw planks,
// fire bricks and build furniture (src/data/construction.js holds the
// recipes; home.js the home builds they go into). One is by the kampung
// allotment in Kampong Glam, for the first lesson (Trades of the Wild); the
// other by Kranji Village, near the kampong home and the Construction teleport.
//
// Like the kampong home, the yards are placed at run time on the first free
// patch of open ground near their anchors, so world.js and its seeded layout
// (and the world hash in tests/fasterstart.test.mjs) are left alone. The
// search is deterministic, so a yard stands in the same place every time the
// game boots, and it keeps clear of the home plot (which must stay free for
// the house's own furniture).
import { HOME_W, HOME_H } from './home.js';

// Beside Kampong Glam's work benches (by the kampung allotment), and west of
// Kranji Village's MRT; each yard stands wholly inside its region (`zone`), so
// the skill guide and the map can say where it is.
export const YARD_ANCHORS = [
  { name: 'Kampong Glam', zone: 'Kampong Glam', x: 58, y: 62 },
  { name: 'Kranji', zone: 'Kranji Farmlands', x: 440, y: 141, anvil: true },
];
// [objId, dx] along one row, with a free tile between each station.
export const YARD = [['sawmill', 0], ['kiln', 2], ['workbench', 4]];
const WITH_ANVIL = [...YARD, ['anvil', 6]];
const YARD_W = 5, YARD_H = 3;   // the row and a free row either side

/** The yard's top-left tile: the first patch with room for its stations around the
 *  anchor, inside its region, that doesn't touch the home plot (with a tile's
 *  margin), or null. */
export function findYard(world, home, anchor) {
  const width = anchor.anvil ? WITH_ANVIL.at(-1)[1] + 1 : YARD_W;
  const plot = home?.origin;
  const clearOfHome = (x0, y0) => !plot || x0 + width < plot.x - 1 || x0 > plot.x + HOME_W || y0 + YARD_H < plot.y - 1 || y0 > plot.y + HOME_H;
  const free = (x0, y0) => {
    if (!clearOfHome(x0, y0)) return false;
    for (let y = y0; y < y0 + YARD_H; y++) for (let x = x0; x < x0 + width; x++) {
      if (!world.inBounds(x, y) || world.isBlocked(x, y) || world.objectAt(x, y)) return false;
      if (anchor.zone && world.zoneAt?.(x, y)?.name !== anchor.zone) return false;
    }
    return true;
  };
  for (let r = 0; r <= 30; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (free(anchor.x + dx, anchor.y + dy)) return { x: anchor.x + dx, y: anchor.y + dy };
    }
  }
  return null;
}

/** Put up the lumber yards (once, as the game is made): returns [{ name, x, y }], their top-left tiles. */
export function placeLumberYards(game) {
  const w = game.world, out = [];
  if (!w?.addObject) return out;
  for (const a of YARD_ANCHORS) {
    const at = findYard(w, game.home, a);
    if (!at) continue;
    for (const [objId, dx] of a.anvil ? WITH_ANVIL : YARD) w.addObject(objId, at.x + dx, at.y + 1);
    if (a.anvil) w.addObject('sign', at.x + 6, at.y, { sign: 'Kranji lumber yard' });
    out.push({ name: a.name, ...at });
  }
  return out;
}
