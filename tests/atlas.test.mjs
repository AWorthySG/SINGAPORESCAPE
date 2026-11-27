import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATLAS_PLACES, atlasDestination, atlasPoint } from '../src/ui/atlas.js';
import { STATION_BY_ID } from '../src/data/transport.js';
import { buildWorld } from '../src/data/world.js';
import { World } from '../src/game/world.js';

test('the Singapore atlas is north-up and places its islands on the right sides of the mainland', () => {
  const named = (id) => atlasPoint(ATLAS_PLACES.find((place) => place.id === id));
  assert.ok(named('pulau_ubin').left > named('kampong_glam').left);
  assert.ok(named('tuas').left < named('bukit_timah').left);
  assert.ok(named('sungei_buloh').top < named('bukit_timah').top);
  assert.ok(named('sentosa').top > named('chinatown').top);
  assert.ok(named('southern_islands').top > named('sentosa').top);
  for (const place of ATLAS_PLACES) {
    const { left, top } = atlasPoint(place);
    assert.ok(left > 0 && left < 100 && top > 0 && top < 100, `${place.label} is inside the atlas`);
  }
});

test('every atlas destination points to its real playable station and arrival tile', () => {
  const world = new World();
  world.build(buildWorld());
  for (const place of ATLAS_PLACES) {
    const dest = atlasDestination(place);
    const station = STATION_BY_ID[place.id];
    assert.equal(dest.station, station);
    assert.deepEqual([dest.x, dest.y], [station.x, station.y]);
    assert.equal(dest.label, `${station.name} MRT`);
    assert.equal(world.isBlocked(dest.x, dest.y), false, `${place.label} has an open arrival tile`);
  }
});
