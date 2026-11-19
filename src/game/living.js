// The living world's saved state in one place for save.js: region reputation
// (reputation.js) and the deeds townsfolk remember (memory.js). Both are
// optional on load, so older saves start at Stranger with nothing to gossip
// about (and get reputation credit for what they had already done).
import { serializeRep, loadRep } from './reputation.js';
import { serializeDeeds, loadDeeds } from './memory.js';
import { resetLife } from './npclife.js';

export function serializeLiving(game) {
  return { rep: serializeRep(game), deeds: serializeDeeds(game) };
}

export function loadLiving(game, d) {
  const x = d && typeof d === 'object' ? d : {};
  game.rep = loadRep(x.rep);
  game.deeds = loadDeeds(x.deeds);
  resetLife(game);   // the next tick takes a fresh look at what this save has done
}
