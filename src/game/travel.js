import { findTravelRoute } from '../engine/pathfinding.js';
import { MRT_FARE } from '../data/transport.js';

export function hasMrtFareAndClearance(game) {
  return game.player.alive && game.inventory.count('coins') >= MRT_FARE
    && !game.npcs.some((n) => n.alive && n.target === game.player);
}

export function legalMrtDeparture(world, x, y) {
  const zone = world.zoneAt(x, y);
  return !zone?.wilderness && !zone?.instance;
}

/** Build the network from the current map. Transit uses its real arrival
 *  tiles, including the dry fallback if an entrance has become blocked. */
export function planTravel(game, goals, { range = 0, cfg = game.pathCfg() } = {}) {
  if (!goals.length) return null;
  const { world } = game;
  const arrivalAt = ({ x, y }) => game._nearestFree(x, y);
  const stations = hasMrtFareAndClearance(game)
    ? world.stations.map((station) => ({ station, arrival: arrivalAt(station) }))
    : [];
  const ferries = [];
  for (const { from, to } of world.ferryLinks || []) for (const side of [from, to]) {
    const landing = world.objectAt(side.x, side.y);
    if (landing?.def.type === 'ferry' && landing.destination) {
      ferries.push({ landing, arrival: arrivalAt(landing.destination) });
    }
  }
  const canBoardMrtAt = (x, y) => legalMrtDeparture(world, x, y);
  return findTravelRoute(cfg, game.playerTile(), goals, { range, stations, ferries, canBoardMrtAt });
}
