// Region facts for the encyclopedia's Places pages: each region's level band
// and what lives there. Read from the world as generated (codexHabitats), so
// the pages always match the map. Kept free of the DOM (src/ui/regionui.js draws it).
import { getNpc } from '../data/npcs.js';
import { codexHabitats } from './codex.js';

const GROUP = (z) => (z.far ? 'Far regions' : z.lo ? 'Open world' : 'The old island');

/** Every region in the world's order: [{ name, zone, band, group, visited, lo, hi }].
 *  The band is the middle 80% of its monsters' levels (a few strays wander far
 *  from the usual band). Worked out once per game: spawns never move. */
export function regionList(game) {
  if (game?._regionList) return game._regionList.map((r) => ({ ...r, visited: !!game.zonesVisited?.has(r.name) }));
  const hab = codexHabitats(game);
  const list = (game?.world?.zones || []).filter((z) => !z.instance).map((z) => {
    const lv = [];
    for (const [id, zs] of hab) if (zs.includes(z.name) && !getNpc(id).boss) lv.push(getNpc(id).level);
    lv.sort((a, b) => a - b);
    const lo = lv.length ? lv[Math.floor((lv.length - 1) * 0.1)] : 0, hi = lv.length ? lv[Math.ceil((lv.length - 1) * 0.9)] : 0;
    return { name: z.name, zone: z, group: GROUP(z), lo, hi, band: lv.length ? `${lo}–${hi}` : '' };
  });
  if (game) game._regionList = list;
  return regionList(game || { _regionList: list });
}

/** One region's page facts, or null. */
export function regionInfo(game, name) {
  const r = regionList(game).find((x) => x.name === name);
  if (!r) return null;
  const hab = codexHabitats(game);
  const ids = [...hab].filter(([, zs]) => zs.includes(name)).map(([id]) => id).sort((a, b) => getNpc(a).level - getNpc(b).level);
  return { ...r, monsters: ids.filter((id) => !getNpc(id).boss), bosses: ids.filter((id) => getNpc(id).boss) };
}
