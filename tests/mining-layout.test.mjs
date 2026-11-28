import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/game/game.js';
import { SAVE_KEY } from '../src/config.js';
import { getObject } from '../src/data/objects.js';
import { buildWorld, TERRAIN } from '../src/data/world.js';
import { geographicTile } from '../src/data/worldlayout.js';
import { loadGame, snapshot } from '../src/game/save.js';
import { readResumeTask } from '../src/game/resumetask.js';

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const NO_ROCK = new Set([TERRAIN.WATER, TERRAIN.PATH, TERRAIN.WOOD]);
const point = ({ x, y }) => ({ x, y });
const key = ({ x, y }) => `${x},${y}`;
const within = (o, s) => o.x >= s.x0 && o.x <= s.x1 && o.y >= s.y0 && o.y <= s.y1;
const miningNodes = (w) => w.objects.filter((o) => o.def.type === 'rock');
const pair = () => [new Game(), new Game({ layout: 'singapore' })];

test('both layouts loosen every mining grid and preserve the original nodes and transport access', () => {
  const baseline = buildWorld();
  const original = new Map(baseline.objects.filter((o) => getObject(o.objId).type === 'rock').map((o) => [key(o), o.objId]));
  let authored;
  for (const { world: w } of pair()) {
    const rocks = miningNodes(w);
    assert.equal(rocks.length, 538);
    const starts = new Set([
      w.spawnPoint, ...w.stations, ...w.ferryLinks.flatMap(({ from, to }) => [from, to]),
    ].map((o) => w._walkComponent(o)));
    const npcTiles = new Set(w.npcSpawns.map(key));
    const mapped = new Map();
    for (const rock of rocks) {
      const before = w.legacyTile(rock.miningOrigin || rock);
      const after = w.legacyTile(rock);
      assert.equal(rock.objId, original.get(key(before)), key(before));
      assert.equal(mapped.has(key(before)), false, `duplicate origin ${key(before)}`);
      mapped.set(key(before), key(after));
      assert.equal(w.objectAt(rock.x, rock.y), rock, key(rock));
      assert.equal(npcTiles.has(key(rock)), false, key(rock));
      assert.equal(NO_ROCK.has(w.terrainAt(rock.x, rock.y)), false, key(rock));
      const stances = SIDES
        .map(([dx, dy]) => ({ x: rock.x + dx, y: rock.y + dy }))
        .filter(({ x, y }) => !w.isBlocked(x, y));
      assert.ok(stances.length >= 2, `cardinal stances at ${key(rock)}`);
      assert.ok(stances.some((p) => starts.has(w._walkComponent(p))), `approach to ${key(rock)}`);
      if (!rock.miningOrigin) continue;
      assert.ok(rock.def.level < 100, `${rock.objId} stays in its vein`);
      assert.equal(original.has(key(after)), false, `reused origin at ${key(after)}`);
      assert.equal(w.objectAt(rock.miningOrigin.x, rock.miningOrigin.y), null);
      assert.equal(w.miningNodeAtOrigin(rock.miningOrigin.x, rock.miningOrigin.y), rock);
      assert.equal(Math.max(Math.abs(before.x - after.x), Math.abs(before.y - after.y)), 1);
    }
    assert.equal(mapped.size, original.size);
    if (authored) assert.deepEqual(mapped, authored, 'the layouts map to identical mining tiles');
    else authored = mapped;

    const quarries = w.groves.filter((g) => g.kind === 'quarry');
    const hubs = w.resourceZones.filter((z) => z.skill === 'mining');
    for (const site of [...quarries, ...hubs]) {
      const nodes = rocks.filter((r) => within(r, site));
      assert.equal(nodes.length, site.count, site.id);
      assert.ok(nodes.filter((r) => r.miningOrigin).length >= site.count / 2, site.id);
    }
    for (const site of hubs) assert.equal(w.objectAt(site.cx, site.cy)?.sign, site.name);
    const graniteTile = w.authoredTile({ x: 80, y: 17 });
    assert.equal(w.objectAt(graniteTile.x, graniteTile.y)?.objId, 'granite_rock');
  }
});

test('old mining targets and standing positions resume in the revised mine', () => {
  const storage = globalThis.localStorage;
  let json;
  globalThis.localStorage = { getItem: (key) => key === SAVE_KEY ? json : null, setItem() {} };
  try {
    const [legacy, singapore] = pair();
    const { world: w } = legacy;
    const rock = miningNodes(w).find((o) => o.miningOrigin);
    const origin = rock.miningOrigin;
    const oldTarget = { kind: 'work', id: rock.objId, ...origin };
    json = JSON.stringify({ ...snapshot(legacy), player: { ...snapshot(legacy).player, ...point(rock) }, resumeTask: oldTarget });
    assert.equal(loadGame(legacy), true);
    assert.deepEqual(legacy.resumeTask, { ...oldTarget, ...point(rock) });
    assert.ok(Math.max(Math.abs(legacy.player.x - rock.x), Math.abs(legacy.player.y - rock.y)) === 1);
    assert.equal(w.isBlocked(legacy.player.x, legacy.player.y), false);
    const walk = readResumeTask(legacy, { kind: 'walk', ...point(rock) });
    assert.equal(walk.kind, 'walk');
    assert.ok(Math.max(Math.abs(walk.x - rock.x), Math.abs(walk.y - rock.y)) === 1);
    assert.equal(w.isBlocked(walk.x, walk.y), false);

    assert.equal(loadGame(singapore), true);
    const dest = geographicTile(rock.x, rock.y);
    assert.deepEqual(singapore.resumeTask, { ...oldTarget, ...dest });
    assert.ok(Math.max(Math.abs(singapore.player.x - dest.x), Math.abs(singapore.player.y - dest.y)) === 1);
    assert.equal(singapore.world.isBlocked(singapore.player.x, singapore.player.y), false);
  } finally {
    if (storage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = storage;
  }
});
