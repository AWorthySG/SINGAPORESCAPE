import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GEOGRAPHIC_PLACES } from '../src/data/geography.js';
import { STATION_BY_ID } from '../src/data/transport.js';
import { geographicTile, legacyTile } from '../src/data/worldlayout.js';
import { Game } from '../src/game/game.js';
import { buildWorld, TERRAIN } from '../src/data/world.js';
import { gatheringFits, gatheringSource } from '../src/data/gatheringLayout.js';
import { bestGatherPick, gatheringTrip, safeRouteCfg } from '../src/game/whatnext.js';
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

test('willows and mangroves grow in shallow water beside a walkable bank', () => {
  const { world } = boot();
  const trees = world.objects.filter((o) => o.waterRoots);
  const count = (name, id) => trees.filter((o) => o.objId === id && world.zoneAt(o.x, o.y)?.name === name).length;
  assert.ok(count('Sungei Buloh Wetlands', 'mangrove') >= 15);
  assert.ok(count('Punggol Waterway', 'willow') >= 5);
  assert.ok(count('MacRitchie Reservoir', 'willow') >= 2);
  const mainland = world._walkComponent(world.spawnPoint);
  for (const tree of trees) {
    const { x, y } = tree;
    assert.equal(world.terrainAt(x, y), TERRAIN.WATER);
    assert.equal(world.objectAt(x, y), tree);
    assert.ok(world.isBlocked(x, y), 'wading trees do not make water walkable');
    const bank = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    assert.ok(bank.some(([a, b]) => !world.isBlocked(a, b) && world._walkComponent({ x: a, y: b }) === mainland),
      `${tree.objId} at ${x}, ${y} has a dry approach connected to the mainland`);
  }
});

test('level-one woodcutting has safe trees a short walk from Kampong Glam', () => {
  const g = boot();
  g.inventory.add('bronze_axe', 1);
  const pick = bestGatherPick(g, 'woodcutting');
  assert.equal(pick?.obj.objId, 'tree');
  assert.equal(pick.trip.st, null);
  const { x, y } = g.playerTile();
  assert.ok(Math.max(Math.abs(x - pick.obj.x), Math.abs(y - pick.obj.y)) <= 13);
});

test('permanent life-skill nodes have suitable territory and a safe dry approach from transport', () => {
  const game = boot(), { world } = game;
  const { width, mapHeight: height } = world;
  const danger = new Uint8Array(width * height);
  for (const npc of game.npcs) {
    if (!npc.attackable || !npc.def.aggressive) continue;
    const r = npc.wander + Math.max(npc.def.aggroRange || 4, npc.def.boss ? 8 : 0) + 1;
    for (let y = Math.max(0, npc.spawnY - r); y <= Math.min(height - 1, npc.spawnY + r); y++) {
      danger.fill(1, y * width + Math.max(0, npc.spawnX - r), y * width + Math.min(width, npc.spawnX + r + 1));
    }
  }
  const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const origins = [world.spawnPoint, ...world.stations, ...world.ferryLinks.flatMap(({ from, to }) => [from, to])];
  const land = new Uint8Array(width * height), queue = [];
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = world.idx(x, y);
    if (land[i] || danger[i] || world.isBlocked(x, y) || world.zoneAt(x, y)?.wilderness) return;
    land[i] = 1;
    queue.push(i);
  };
  for (const p of origins) visit(p.x, p.y);
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], x = i % width, y = Math.floor(i / width);
    for (const [a, b] of sides) visit(x + a, y + b);
  }
  const nodes = world.objects.filter((o) => gatheringSource(o.def));
  assert.ok(nodes.length > 4000);
  for (const o of nodes) {
    const where = world.zoneAt(o.x, o.y), label = `${o.objId} at ${o.x}, ${o.y} in ${where?.name || 'Singapore'}`;
    assert.ok(gatheringFits(o.def, where), `${label} fits its territory`);
    assert.ok(!danger[world.idx(o.x, o.y)], `${label} is outside hostile reach`);
    assert.ok(sides.some(([a, b]) => land[world.idx(o.x + a, o.y + b)]), `${label} has a protected approach`);
  }
  assert.ok(nodes.filter((o) => o.objId === 'gem_rock').length > 10);
  assert.ok(nodes.every((o) => !['gem_rock', 'yew_tree'].includes(o.objId) || world.zoneAt(o.x, o.y)?.name !== 'The Celestial Peaks'));
  for (const o of buildWorld().objects.filter(({ objId }) => objId === 'farm_patch')) {
    const { x, y } = world.authoredTile(o);
    assert.equal(world.objectAt(x, y)?.objId, 'farm_patch', 'saved crops still resolve to the same authored patch');
  }
});

test('the gathering guide walks to starter ore and safely boards a ferry for an island node', () => {
  const game = boot();
  game.inventory.add('bronze_pickaxe', 1);
  assert.ok(game.goToNearest(['copper_rock']));
  const local = game.player.action;
  assert.equal(local?.type, 'mine');
  assert.ok(Math.hypot(local.obj.x - game.player.x, local.obj.y - game.player.y) <= 22);
  const cfg = safeRouteCfg(game);
  assert.ok(game.player.path.every(({ x, y }) => !cfg.isBlocked(x, y)));
  game.player.clearAction();

  const o = game.world.objects.find((n) => n.objId === 'copper_rock' && game.world.zoneAt(n.x, n.y)?.name === 'Pulau Ubin');
  assert.ok(o);
  const trip = gatheringTrip(game, o);
  assert.equal(trip?.ferry?.destination.placeId, 'pulau_ubin');
  assert.ok(game.goToObject(o));
  const landing = game.player.action?.obj;
  assert.equal(landing?.def.type, 'ferry');
  game._placePlayer(landing.x, landing.y);
  game.doTick();
  assert.equal(game.currentZoneName, 'Pulau Ubin');
  assert.equal(game.player.action?.obj, o);
});
