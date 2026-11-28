import './seed.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { TERRAIN } from '../src/data/world.js';
import { Game } from '../src/game/game.js';
import { visibleDistrictScenery } from '../src/render/districtscenery.js';

const viewpoints = [
  { x: 447, y: 154, art: 'tiled_planter' }, // Transit Road
  { x: 469, y: 223, art: 'fallen_log' }, // Mandai
  { x: 192, y: 167, art: 'orchid_planter' }, // Marina Bay
  { x: 62, y: 81, art: 'tiled_planter' }, // Kampong Glam
  { x: 37, y: 54, art: 'bay_bench' }, // MacRitchie
  { x: 39, y: 149, art: 'trail_marker' }, // Sungei Buloh
  { x: 49, y: 96, art: 'buoy_pile' }, // Sentosa
];

test('painted accents follow the relocated viewpoints and stay off travel lanes', () => {
  const { world } = new Game({ layout: 'singapore' });
  const props = [];
  for (const { x, y, art } of viewpoints) {
    const at = world.authoredTile({ x, y });
    assert.equal(visibleDistrictScenery(world, at.x - 6, at.y - 6, at.x + 6, at.y + 6, props), props);
    assert.ok(props.some((p) => p.objId === art), art);
    for (const prop of props) {
      assert.equal(prop.def.verb, undefined, prop.objId);
      assert.equal(world.objectAt(prop.x, prop.y), null);
      assert.ok(!world.isBlocked(prop.x, prop.y));
      assert.ok(![TERRAIN.PATH, TERRAIN.WOOD, TERRAIN.WATER].includes(world.terrainAt(prop.x, prop.y)));
    }
  }
});
