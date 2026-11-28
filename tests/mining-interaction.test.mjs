import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { OBJECTS } from '../src/data/objects.js';
import { resolveMine } from '../src/game/skilling.js';
import { rockImpactPoint } from '../src/render/miningRock.js';

test('a depleted rock cannot hide a mineable rock from Interact', () => {
  const rock = { def: OBJECTS.copper_rock, x: 1, y: 0, depleted: true };
  const next = { def: OBJECTS.tin_rock, x: 2, y: 0 };
  const game = {
    player: { alive: true, facing: { dx: 1, dy: 0 } },
    world: { groundItems: [], objectsIn: () => [rock, next] },
    playerTile: () => ({ x: 0, y: 0 }),
    attackRange: () => 1,
    nearbyNpcs: () => [],
  };
  assert.equal(Game.prototype._findInteract.call(game).ref, next);
  rock.depleted = false;
  assert.equal(Game.prototype._findInteract.call(game).ref, rock);
});

test('mining debris starts at the rock face on the final swing', () => {
  const game = new Game();
  game.inventory.add('bronze_pickaxe', 1);
  const rock = game.world.objects.find((o) => o.objId === 'copper_rock');
  game.player.x = game.player.tx = rock.x - 1;
  game.player.y = game.player.ty = rock.y;
  rock.oresLeft = 1;
  const point = rockImpactPoint(rock, game.player.renderCenter());
  const debris = [];
  game.spawnPoof = (x, y, colour) => debris.push({ x, y, colour });
  assert.equal(resolveMine(game, { obj: rock }), false);
  assert.equal(rock.depleted, true);
  assert.equal(game.inventory.count('copper_ore'), 1);
  assert.deepEqual(debris.find(({ colour }) => colour === rock.def.ore), { ...point, colour: rock.def.ore });
});
