import { findTravelRoute } from '../engine/pathfinding.js';

/** Build the network from the current map. Transit uses its real arrival
 *  tiles, including the dry fallback if an entrance has become blocked. */
export function planTravel(game, goals, { range = 0, cfg = game.pathCfg() } = {}) {
  if (!goals.length) return null;
  const { world } = game;
  const arrivalAt = ({ x, y }) => game._nearestFree(x, y);
  const stations = game._mrtCanHop()
    ? world.stations.map((station) => ({ station, arrival: arrivalAt(station) }))
    : [];
  const ferries = [];
  for (const { from, to } of world.ferryLinks || []) for (const side of [from, to]) {
    const landing = world.objectAt(side.x, side.y);
    if (landing?.def.type === 'ferry' && landing.destination) {
      ferries.push({ landing, arrival: arrivalAt(landing.destination) });
    }
  }
  return findTravelRoute(cfg, game.playerTile(), goals, { range, stations, ferries });
}
