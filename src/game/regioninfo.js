// Region facts for the encyclopedia's Places pages: each region's level band,
// what lives there, its resource zones, quest givers, shops, MRT stops and
// your reputation there. Read from the world as generated (codexHabitats, the
// placed objects and NPCs), so the pages always match the map. Kept free of
// the DOM (src/ui/regionui.js draws it, with a small map).
import { getNpc } from '../data/npcs.js';
import { STATIONS } from '../data/transport.js';
import { REGION_LINES, REGION_GIVERS } from '../data/regionQuests.js';
import { codexHabitats } from './codex.js';
import { zoneSummary } from './resourcezones.js';
import { repPoints, rankFor, repProgress, REP_REGIONS } from './reputation.js';

const GROUP = (z) => (z.settlement ? 'Towns' : z.far ? 'Far regions' : z.lo ? 'Open world' : 'The old island');

/** Every region in the world's order: [{ name, zone, band, group, visited, lo, hi }].
 *  The band is the middle 80% of its monsters' levels (a few strays wander far
 *  from the usual band). Worked out once per game: spawns never move. */
export function regionList(game) {
  if (!game?._regionList) {
    const hab = codexHabitats(game);
    const list = (game?.world?.zones || []).filter((z) => !z.instance).map((z) => {
      const lv = [];
      for (const [id, zs] of hab) if (zs.includes(z.name) && !getNpc(id).boss) lv.push(getNpc(id).level);
      lv.sort((a, b) => a - b);
      const lo = lv.length ? lv[Math.floor((lv.length - 1) * 0.1)] : 0, hi = lv.length ? lv[Math.ceil((lv.length - 1) * 0.9)] : 0;
      return { name: z.name, zone: z, group: GROUP(z), lo, hi, band: lv.length ? (lo === hi ? `${lo}` : `${lo}–${hi}`) : '' };
    });
    if (!game) return list.map((r) => ({ ...r, visited: false }));
    game._regionList = list;
  }
  return game._regionList.map((r) => ({ ...r, visited: !!game.zonesVisited?.has(r.name) }));
}

const inZone = (z, x, y) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;

/** One region's page facts, or null:
 *  { ...regionList row, monsters, bosses, zones: [{ id, name, skill, summary, x, y }],
 *    givers: [{ id, name, quest, level, done, x, y }], shops: [{ npcId, name, x, y }],
 *    stations: [{ id, name, x, y }], rep: { rank, points, next } | null, go: { x, y } }. */
export function regionInfo(game, name) {
  const r = regionList(game).find((x) => x.name === name);
  if (!r) return null;
  const z = r.zone, w = game.world;
  const hab = codexHabitats(game);
  const ids = [...hab].filter(([, zs]) => zs.includes(name)).map(([id]) => id).sort((a, b) => getNpc(a).level - getNpc(b).level);
  // The first matching rectangle wins (zoneAt), so a tile in an overlapping corner belongs to the earlier region.
  const here = (x, y) => w?.zoneAt?.(x, y)?.name === name;
  const zones = (w?.resourceZones || []).filter((rz) => here(rz.cx, rz.cy))
    .map((rz) => ({ id: rz.id, name: rz.name, skill: rz.skill, summary: zoneSummary(w, rz), x: rz.cx, y: rz.cy }));
  const givers = REGION_LINES.filter((l) => l.region === name && REGION_GIVERS[l.giver]).map((l) => {
    const g = REGION_GIVERS[l.giver];
    const npc = game._rqGivers?.[l.giver];
    const authored = { x: g.at[0], y: g.at[1] };
    const tile = npc ? { x: npc.spawnX ?? npc.x, y: npc.spawnY ?? npc.y } : (w?.authoredTile?.(authored) ?? authored);
    return { id: l.giver, name: g.name, quest: l.name, questId: l.id, level: l.level, done: game.quests?.[l.id]?.state === 'done', ...tile };
  });
  const shops = [], seenShop = new Set();
  for (const n of game.npcs || []) {
    if (n.temporary || n.wave || n.def?.role !== 'shop' || seenShop.has(n.npcId)) continue;
    const x = n.spawnX ?? n.x, y = n.spawnY ?? n.y;
    if (!here(x, y)) continue;
    seenShop.add(n.npcId);
    shops.push({ npcId: n.npcId, name: n.def.name, x, y });
  }
  const stations = (w?.stations ?? STATIONS).filter((s) => here(s.x, s.y)).map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y }));
  let rep = null;
  if (REP_REGIONS.includes(name)) {
    const pts = repPoints(game, name);
    rep = { rank: rankFor(pts), points: pts, next: repProgress(pts) };
  }
  // Go: to its MRT stop if it has one, else its quest giver, else where one of
  // its creatures lives (always somewhere you can stand), else its middle.
  const camp = (game.npcs || []).find((n) => !n.temporary && !n.wave && here(n.spawnX ?? n.x, n.spawnY ?? n.y));
  const go = stations[0] || givers[0] || (camp && { x: camp.spawnX ?? camp.x, y: camp.spawnY ?? camp.y })
    || { x: Math.round((z.x0 + z.x1) / 2), y: Math.round((z.y0 + z.y1) / 2) };
  return { ...r, monsters: ids.filter((id) => !getNpc(id).boss), bosses: ids.filter((id) => getNpc(id).boss),
    zones, givers, shops, stations, rep, go: { x: go.x, y: go.y }, inside: (x, y) => inZone(z, x, y) };
}
