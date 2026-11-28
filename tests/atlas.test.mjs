import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ATLAS_INSETS, ATLAS_PLACES, atlasDestination, atlasPoint } from '../src/ui/atlas.js';
import { GEOGRAPHIC_PLACES, GEOGRAPHIC_PLACE_BY_ID } from '../src/data/geography.js';
import { buildWorld } from '../src/data/world.js';
import { World } from '../src/game/world.js';

test('the Singapore atlas is north-up and places its islands on the right sides of the mainland', () => {
  const named = (id) => atlasPoint(ATLAS_PLACES.find((place) => place.id === id));
  assert.ok(named('pulau_ubin').left > named('kampong_glam').left);
  assert.ok(named('tuas').left < named('bukit_timah').left);
  assert.ok(named('sungei_buloh').top < named('bukit_timah').top);
  assert.ok(named('sentosa').top > named('chinatown').top);
  assert.ok(named('southern_islands').top > named('sentosa').top);
  assert.ok(named('transit_road').top < named('kampong_glam').top);
  assert.ok(named('transit_road').left < named('punggol').left);
  assert.deepEqual(ATLAS_PLACES, GEOGRAPHIC_PLACES.filter((place) => place.kind !== 'fictional'));
  for (const place of ATLAS_PLACES) {
    const { left, top } = atlasPoint(place);
    assert.ok(left > 0 && left < 100 && top > 0 && top < 100, `${place.label} is inside the atlas`);
  }
});

test('the painted atlas relief retains the base map size and the landmark insets use existing art', () => {
  const relief = readFileSync(new URL('../assets/maps/singapore-atlas-relief.webp', import.meta.url));
  assert.equal(relief.toString('ascii', 12, 16), 'VP8X');
  assert.ok(relief[20] & 0x10, 'the relief layer has transparency');
  assert.deepEqual([relief.readUIntLE(24, 3) + 1, relief.readUIntLE(27, 3) + 1], [1200, 800]);
  for (const [id, { art, caption }] of Object.entries(ATLAS_INSETS)) {
    assert.ok(ATLAS_PLACES.some((p) => p.id === id), `${id} has a geographic pin`);
    assert.ok(existsSync(new URL(`../assets/${art}`, import.meta.url)), art);
    assert.ok(caption);
  }
});

test('the atlas resolves station destinations through the runtime terrain and keeps walking destinations', () => {
  const world = new World();
  world.build(buildWorld(), { forward: (x, y) => ({ x: x + 1, y: y + 2 }) });
  const town = GEOGRAPHIC_PLACE_BY_ID.transit_road;
  const station = world.station(town.stationId);
  assert.deepEqual(atlasDestination(town, world), { x: station.x, y: station.y, label: `${station.name} MRT`, station });
  const wilderness = GEOGRAPHIC_PLACE_BY_ID.wilderness;
  const arrival = world.authoredTile(wilderness.landing);
  assert.deepEqual(atlasDestination(wilderness, world), { ...arrival, label: wilderness.label });
});

test('ferry destinations show the arrival pier and boarding point instead of an MRT button', () => {
  const ubin = GEOGRAPHIC_PLACE_BY_ID.pulau_ubin;
  const link = {
    id: 'changi-ubin',
    from: { x: 250, y: 60, name: 'Changi Point Ferry Terminal', placeId: 'changi' },
    to: { x: 240, y: 42, name: 'Pulau Ubin', placeId: ubin.id },
  };
  const world = { zones: [], station: () => ({ x: 5, y: 8 }), ferryLinks: [link] };
  assert.deepEqual(atlasDestination(ubin, world), { x: 240, y: 42, label: 'Pulau Ubin', ferry: link });
});
