import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MRT_FARE } from '../src/data/transport.js';
import { findPath, findTravelRoute } from '../src/engine/pathfinding.js';
import { Game } from '../src/game/game.js';
import { planTravel } from '../src/game/travel.js';

const tile = (x, y) => ({ x, y });
const ride = (id, x, y) => ({ station: { id }, arrival: tile(x, y) });

test('a farther MRT station can have the shortest approach around a wall', () => {
  const cfg = { width: 14, height: 9, isBlocked: (x, y) => x === 8 && y !== 0 };
  const start = tile(3, 7), goal = tile(11, 7);
  const near = ride('near', 7, 7), across = ride('across', 11, 1);
  const route = findTravelRoute(cfg, start, [goal], { stations: [near, across] });
  assert.equal(route.st, across.station);
  assert.equal(route.distance, 6);
  assert.equal(route.path.length, 6);
  assert.deepEqual(route.path.at(-1), goal);
  assert.ok(findPath(cfg, near.arrival, goal).length > route.distance);
});

test('equal walking distances keep the fare, and unreachable goals produce no trip', () => {
  const cfg = { width: 9, height: 5, isBlocked: (x) => x === 6 || x === 8 };
  const start = tile(1, 1), goal = tile(5, 2), sameWalk = ride('same', 1, 3);
  const route = findTravelRoute(cfg, start, [goal], { stations: [sameWalk] });
  assert.equal(route.distance, 4.414214);
  assert.equal(route.st, undefined);
  assert.equal(findTravelRoute(cfg, start, [tile(7, 2)], { stations: [sameWalk] }), null);
  assert.equal(findTravelRoute(cfg, start, [tile(7, 2), goal]).goal, goal);
});

test('ferry routes count the walks on either side and compare multi-leg routes', () => {
  const cfg = { width: 27, height: 5, isBlocked: (x) => x === 8 || x === 17 };
  const start = tile(1, 2), goal = tile(24, 2);
  const direct = { landing: tile(7, 2), arrival: tile(21, 2) };
  const first = { landing: tile(2, 2), arrival: tile(10, 2) };
  const second = { landing: tile(12, 2), arrival: tile(23, 2) };
  const ferries = [direct, first, second];
  const route = findTravelRoute(cfg, start, [goal], { ferries });
  assert.equal(route.distance, 4);
  assert.equal(route.ferry, first.landing);
  assert.equal(route.st, undefined);
  assert.deepEqual(route.path, []);
  const onward = findTravelRoute(cfg, first.arrival, [goal], { ferries });
  assert.equal(onward.ferry, second.landing);
  assert.equal(onward.path.length, 1);
  const mrt = ride('to-pier', 10, 2);
  const shorter = findTravelRoute(cfg, start, [goal], { ferries, stations: [mrt] });
  assert.equal(shorter.st, mrt.station, 'the MRT replaces the first ferry');
  assert.equal(shorter.ferry, second.landing);
  assert.equal(shorter.distance, 3);
});

test('walking out of a restricted area can make an MRT leg available', () => {
  const cfg = { width: 17, height: 5, isBlocked: () => false };
  const station = ride('far', 15, 2);
  const route = findTravelRoute(cfg, tile(1, 2), [tile(16, 2)],
    { stations: [station], canBoardMrtAt: (x) => x >= 4 });
  assert.equal(route.st, station.station);
  assert.deepEqual(route.boarding, tile(4, 2));
  assert.equal(route.distance, 4);
  assert.deepEqual(route.path, [tile(2, 2), tile(3, 2), tile(4, 2)]);
});

test('the map takes an affordable MRT saving and falls back to the shortest legal walk', () => {
  const game = new Game({ layout: 'singapore' }), { world } = game;
  game.npcs = [];
  const start = game._nearestFree(world.station('kampong_glam').x, world.station('kampong_glam').y);
  const stop = world.station('chinatown'), destination = game._nearestFree(stop.x, stop.y);
  game._placePlayer(start.x, start.y);
  game.inventory.remove('coins', game.inventory.count('coins'));
  const walking = findTravelRoute(game.pathCfg(), start, [destination]);
  assert.ok(walking.path.length > 0);
  const withoutFare = planTravel(game, [destination]);
  assert.equal(withoutFare.distance, walking.distance);
  assert.equal(withoutFare.ferry, undefined, 'a round trip through a ferry would add distance');
  assert.ok(game.travelToTile(destination));
  assert.deepEqual(game.player.path, withoutFare.path);
  game._placePlayer(start.x, start.y);
  game.inventory.add('coins', MRT_FARE);
  assert.equal(planTravel(game, [destination]).st?.id, stop.id);
  assert.ok(game.travelToTile(destination));
  assert.deepEqual(game.playerTile(), destination);

  game._placePlayer(start.x, start.y);
  game.inventory.add('coins', MRT_FARE);
  game.npcs = [{ alive: true, target: game.player }];
  assert.equal(planTravel(game, [destination]).st, undefined);
  assert.ok(game.travelToTile(destination));
  assert.deepEqual(game.player.path, withoutFare.path);

  // Crossing out of the Wilderness enables the onward fare. Walk through
  // the ferry arrival action, which replans the rest of the trip ashore.
  game.npcs = [];
  const crossing = world.ferryLinks.find(({ id }) => id === 'wilderness-crossing');
  const wild = [crossing.from, crossing.to].find((p) => p.placeId === 'wilderness');
  const port = world.objectAt(wild.x, wild.y);
  const beforeBoarding = game._nearestFree(wild.x + 3, wild.y);
  game._placePlayer(beforeBoarding.x, beforeBoarding.y);
  assert.equal(game._mrtCanHop(), false);
  assert.ok(game.travelToTile(destination));
  assert.equal(game.player.action?.obj, port);
  game._placePlayer(wild.x, wild.y);
  game.resolvePlayerAction();
  assert.deepEqual(game.playerTile(), destination);
});
