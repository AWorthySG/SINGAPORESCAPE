import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getDialogue } from '../src/data/dialogue.js';
import { getShop } from '../src/data/shops.js';
import { TRANSIT_ROAD_STATION } from '../src/data/transport.js';
import { MRT_CLEAR } from '../src/data/world.js';
import { Game } from '../src/game/game.js';
import { regionInfo } from '../src/game/regioninfo.js';
import { saveGame } from '../src/game/save.js';
import { ATLAS_PLACES, atlasDestination } from '../src/ui/atlas.js';

const residents = ['transit_mapmaker', 'transit_hawker', 'transit_caretaker'];
const monsters = ['transit_puddle_wisp', 'transit_lantern_moth', 'transit_verge_boar'];

test('Transit Road is a safe MRT stop with a town square, its own encounters and save support', (t) => {
  const stored = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => stored.get(k) ?? null,
    setItem: (k, v) => stored.set(k, String(v)),
    removeItem: (k) => stored.delete(k),
  };
  t.after(() => { globalThis.localStorage = previousStorage; });

  const station = TRANSIT_ROAD_STATION;
  assert.equal(atlasDestination(ATLAS_PLACES.find((p) => p.id === station.id)).station, station);

  const game = new Game();
  game.start();
  assert.equal(game.currentZoneName, 'Kampong Glam');
  game.chooseClass('ranger');
  assert.ok(game.mrtFromMap(station.id));
  assert.equal(game.currentZoneName, station.name);
  assert.equal(game.world.objectAt(station.x, station.y)?.objId, 'mrt_station');

  const here = (x, y) => game.world.zoneAt(x, y)?.name === station.name;
  assert.ok(game.world.objects.some((o) => here(o.x, o.y) && o.objId === 'bank_booth'));
  assert.ok(game.world.towns.some(([x0, y0, x1, y1]) => station.x >= x0 && station.x <= x1 && station.y >= y0 && station.y <= y1));
  for (const npc of game.npcs) {
    if (!npc.attackable) continue;
    assert.ok(Math.max(Math.abs(npc.spawnX - station.x), Math.abs(npc.spawnY - station.y)) >= MRT_CLEAR,
      `${npc.name} is clear of the platform`);
  }

  const localNpcs = game.npcs.filter((n) => here(n.spawnX, n.spawnY));
  for (const id of residents) {
    const resident = localNpcs.find((n) => n.npcId === id);
    assert.ok(resident && !resident.attackable, `${id} is a friendly resident`);
    assert.ok(!game.world.isBlocked(resident.x, resident.y));
    if (resident.def.role === 'shop') assert.ok(getShop(resident.def.shop).stock.length > 0);
    else assert.ok(getDialogue(resident.def.dialogue).start.text);
  }
  for (const id of monsters) {
    const encounters = game.npcs.filter((n) => n.npcId === id);
    assert.ok(encounters.length > 0 && encounters.every((n) => n.attackable && here(n.spawnX, n.spawnY)),
      `${id} is a local combat encounter`);
  }

  const place = regionInfo(game, station.name);
  assert.deepEqual(place.monsters, monsters);
  assert.ok(place.shops.some((s) => s.npcId === 'transit_hawker'));
  assert.ok(place.stations.some((s) => s.id === station.id));

  assert.ok(saveGame(game));
  const resumed = new Game();
  resumed.start();
  assert.equal(resumed.jobClass, 'ranger');
  assert.equal(resumed.currentZoneName, station.name);
  assert.deepEqual(resumed.playerTile(), game.playerTile());
});
