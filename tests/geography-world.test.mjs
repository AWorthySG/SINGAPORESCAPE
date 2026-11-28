import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GEOGRAPHIC_PLACES } from '../src/data/geography.js';
import { STATION_BY_ID } from '../src/data/transport.js';
import { geographicTile, legacyTile } from '../src/data/worldlayout.js';
import { Game } from '../src/game/game.js';
import { atlasDestination } from '../src/ui/atlas.js';

const point = ({ x, y }) => ({ x, y });
const places = Object.fromEntries(GEOGRAPHIC_PLACES.map((p) => [p.id, p]));
const boot = () => {
  const game = new Game({ layout: 'singapore' });
  game.start();
  game.chooseClass('ranger');
  return game;
};

test('the playable map arranges the districts and islands north-up, with a matching atlas', () => {
  const { world } = boot();
  const actual = {};
  for (const place of GEOGRAPHIC_PLACES) {
    const original = place.landing || STATION_BY_ID[place.stationId];
    const tile = actual[place.id] = world.authoredTile(original);
    assert.deepEqual(legacyTile(tile.x, tile.y), point(original), `${place.label} moves reversibly`);
    assert.equal(world.zoneAt(tile.x, tile.y)?.name, place.zone);
    assert.ok(atlasDestination(place, world), `${place.label} is a playable destination`);
  }

  const east = (a, b) => assert.ok(actual[a].x > actual[b].x, `${places[a].label} is east of ${places[b].label}`);
  const north = (a, b) => assert.ok(actual[a].y < actual[b].y, `${places[a].label} is north of ${places[b].label}`);
  east('kranji', 'sungei_buloh'); east('mandai', 'kranji'); east('transit_road', 'mandai');
  east('punggol', 'transit_road'); east('coney', 'punggol'); east('pulau_ubin', 'coney'); east('pulau_tekong', 'pulau_ubin');
  north('punggol', 'coney'); north('pulau_ubin', 'coney');
  east('jurong', 'tuas'); east('bukit_timah', 'jurong'); east('macritchie', 'bukit_timah');
  east('macritchie', 'mandai'); east('macritchie', 'transit_road'); east('chinatown', 'transit_road');
  north('kampong_glam', 'chinatown'); east('kampong_glam', 'chinatown');
  east('kampong_glam', 'temasek'); north('kampong_glam', 'temasek'); north('temasek', 'chinatown');
  east('marina_bay', 'chinatown'); east('gardens', 'marina_bay'); north('marina_bay', 'gardens');
  north('chinatown', 'sentosa'); north('sentosa', 'southern_islands');
  east('kusu_island', 'southern_islands'); east('southern_islands', 'sisters_islands');
  north('kusu_island', 'southern_islands'); north('lazarus_island', 'southern_islands');
  east('southern_islands', 'pulau_semakau'); north('pulau_ubin', 'changi');
  north('sungei_buloh', 'jurong'); north('punggol', 'marina_bay');
});

test('the geographic world offers MRT, bridge and ferry routes through the game', () => {
  const game = boot();
  const { world } = game;
  const marine = world.ferryLinks.find((link) => link.id === 'changi-ubin');
  assert.ok(marine);
  assert.ok(world.stations.every((station) => !['pulau_ubin', 'southern_islands', 'coney'].includes(station.id)));
  const transit = world.station('transit_road');
  assert.deepEqual(point(transit), geographicTile(448, 152));
  assert.equal(game.mrtFromMap('transit_road'), true);
  assert.equal(game.currentZoneName, transit.name);
  assert.deepEqual(point(game.player), point(transit));
  assert.ok(game.npcs.some((npc) => npc.npcId === 'transit_mapmaker' && world.zoneAt(npc.x, npc.y)?.name === transit.name));
  assert.ok(game.npcs.some((npc) => npc.npcId === 'transit_lantern_moth' && world.zoneAt(npc.x, npc.y)?.name === transit.name));

  const mainland = world.station('changi');
  const coney = world.station('coney');
  assert.equal(world._walkComponent(mainland), world._walkComponent(coney), 'Coney has a walkable connection');
  assert.notEqual(world._walkComponent(marine.from), world._walkComponent(marine.to), 'Ubin sits across water');
  assert.equal(world.ferryToward(mainland, marine.to)?.objId, 'ferry_landing');
  assert.equal(atlasDestination(places.pulau_ubin, world).ferry, marine);

  game._placePlayer(marine.from.x, marine.from.y);
  assert.ok(game.travelToTile(marine.to));
  assert.deepEqual(point(game.player), point(marine.to));
  assert.equal(game.currentZoneName, 'Pulau Ubin');
  const landing = world.objectAt(marine.to.x, marine.to.y);
  assert.ok(game.defaultObjectAction(landing), 'the player can board the return ferry using the world action');
  assert.deepEqual(point(game.player), point(marine.from));
});
