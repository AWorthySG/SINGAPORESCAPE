import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game } from '../src/game/game.js';
import { TERRAIN } from '../src/data/world.js';
import { xpForLevel } from '../src/data/xp.js';
import { footFx } from '../src/game/footfx.js';
import { resolveFish, resolveHunt, resolveMine, resolveWoodcut } from '../src/game/skilling.js';
import { resolveDive } from '../src/game/diving.js';
import { resolveExcavate } from '../src/game/archaeology.js';
import { makeBatch } from '../src/game/autoprocess.js';
import { burnAll } from '../src/game/bonfire.js';

function setup() {
  const saved = new Map();
  globalThis.localStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, String(v)), removeItem: (k) => saved.delete(k) };
  const game = new Game();
  game.start();
  game.chooseClass('swordsman');
  game.ui = new Proxy({}, { get: () => () => {} });
  const sounds = [];
  game.bus.on('sfx', (sound) => sounds.push(sound));
  return { game, sounds };
}

function withRandom(value, run) {
  const original = Math.random;
  Math.random = () => value;
  try { return run(); } finally { Math.random = original; }
}

const find = (game, id) => game.world.objects.find((o) => o.objId === id);
const workSounds = (sounds) => sounds.filter((name) => /^(gather|make|interact):/.test(name));

test('successful gathers have one cue for each skill, including a trophy catch', () => {
  const { game, sounds } = setup();
  game.inventory.add('hunting_snare', 1);
  game.skills.xp.hunter = xpForLevel(50);
  const match = (predicate) => game.world.objects.find(predicate);
  const cases = [
    ['woodcutting', resolveWoodcut, find(game, 'tree')],
    ['mining', resolveMine, find(game, 'copper_rock')],
    ['fishing', resolveFish, find(game, 'fishing_spot')],
    ['hunter', resolveHunt, match((o) => o.def.type === 'hunt' && o.def.level <= 50)],
    ['diving', resolveDive, match((o) => o.def.type === 'dive' && o.def.catches[0].level === 1)],
    ['archaeology', resolveExcavate, match((o) => o.def.type === 'dig' && o.def.catches[0].level === 1)],
  ];
  for (const [skill, resolve, obj] of cases) {
    assert.ok(obj, `a ${skill} node exists`);
    sounds.length = 0;
    withRandom(0.99, () => resolve(game, { obj }));
    assert.deepEqual(workSounds(sounds), [`gather:${skill}`]);
  }
  sounds.length = 0;
  withRandom(0, () => resolveFish(game, { obj: find(game, 'fishing_spot') }));
  assert.deepEqual(workSounds(sounds), ['gather:fishing']);
  sounds.length = 0;
  resolveDive(game, { obj: cases[4][2], surface: 2 });
  resolveWoodcut(game, { obj: { ...cases[0][2], depleted: true } });
  assert.deepEqual(workSounds(sounds), [], 'surfacing and an empty tree stay quiet');
});

test('work sounds play once for a successful multi-item or multi-recipe batch', () => {
  const { game, sounds } = setup();
  for (const [type, skill, cue] of [
    ['cook', null, 'cooking'], ['cookdish', null, 'cooking'], ['craft', null, 'crafting'], ['smith', null, 'smithing'],
    ...['construction', 'fletching', 'herblore', 'archaeology', 'hawkering'].map((s) => ['recipe', s, s === 'hawkering' ? 'hawker' : s]),
  ]) {
    sounds.length = 0;
    const a = { type, skill, rawId: 'raw_anchovy', recipe: { result: 'anchovy' }, limit: 3 };
    makeBatch(game, a, () => { game.inventory.add('anchovy', 1); return true; });
    assert.deepEqual(workSounds(sounds), [`make:${cue}`]);
    sounds.length = 0;
    makeBatch(game, a, () => false);
    assert.deepEqual(workSounds(sounds), []);
  }

  game.inventory.clear();
  game.skills.xp.smithing = xpForLevel(40);
  for (const [id, qty] of [['copper_ore', 3], ['tin_ore', 3], ['iron_ore', 2], ['coal', 4]]) game.inventory.add(id, qty);
  const furnace = find(game, 'furnace');
  game.player.x = game.player.tx = furnace.x + 1;
  game.player.y = game.player.ty = furnace.y;
  assert.ok(game.startAll('smelt', furnace));
  game.resolvePlayerAction();
  assert.ok(game.inventory.count('steel_bar') >= 2 && game.inventory.count('bronze_bar') >= 3);
  assert.deepEqual(workSounds(sounds), ['make:smelting']);
});

test('planting, harvest, thieving and agility sound only on successful interactions', () => {
  const { game, sounds } = setup();
  const patch = find(game, 'farm_patch');
  assert.equal(game.plantSeed(patch, 'chilli_seed'), false);
  assert.deepEqual(workSounds(sounds), []);
  game.inventory.add('chilli_seed', 1);
  assert.equal(game.plantSeed(patch, 'chilli_seed'), true);
  game.tendPatch(patch);
  assert.deepEqual(workSounds(sounds), ['interact:plant'], 'checking a growing crop is silent');
  patch.growLeft = 0;
  assert.equal(game.harvestPatch(patch), true);
  game.pickpocket(game.npcs.find((n) => n.def.role && !n.def.thieving));
  const stall = game.world.objects.find((o) => o.def.type === 'stall');
  game.skills.xp.thieving = xpForLevel(Math.max(stall.def.level, 1));
  withRandom(0.99, () => game.stealFromStall(stall));
  withRandom(0, () => game.stealFromStall(stall));
  game.stealFromStall(stall, { stealing: true });
  const obstacle = find(game, 'agility_course');
  assert.ok(game.resolveAgility(obstacle));
  assert.deepEqual(workSounds(sounds), ['interact:plant', 'gather:farming', 'interact:thieve', 'interact:stall', 'interact:agility']);
});

test('a bonfire or hawker service has one cue for the work completed', () => {
  const { game, sounds } = setup();
  const p = game.player;
  while (game.world.objectAt(p.x, p.y)) p.x++;
  assert.equal(burnAll(game, ['logs']), 0);
  game.inventory.add('logs', 5);
  assert.equal(burnAll(game, ['logs']), 5);
  assert.deepEqual(workSounds(sounds), ['make:firemaking']);

  sounds.length = 0;
  const h = game.hawker;
  const order = { order: 'char_kway_teow', qty: 1, patience: 8, max: 8 };
  game.player.setAction({ type: 'hawk', obj: h.obj });
  h.queue = [{ ...order }, { ...order }];
  assert.equal(h.serve(0), false);
  game.inventory.add(order.order, 2);
  h.serve(0);
  h.serve(0, true);
  assert.equal(h.served, 2);
  assert.deepEqual(workSounds(sounds), ['make:hawker']);
});

test('footsteps read landed movement and terrain even in low graphics', () => {
  const sounds = [], state = {};
  const player = { alive: true, x: 0, y: 0, walkPhase: 0.6 };
  const surfaces = [TERRAIN.STONE, TERRAIN.GRASS, TERRAIN.PATH, TERRAIN.WOOD, TERRAIN.SAND, TERRAIN.WATER];
  const game = { lowFx: true, player, world: { terrainAt: (x) => surfaces[x] }, bus: { emit: (_, sound) => sounds.push(sound) } };
  footFx(game, state);
  player.x = 3;
  footFx(game, state);
  assert.deepEqual(sounds, [], 'idle and teleport frames do not move the stride');
  for (let i = 0; i < surfaces.length; i++) {
    player.x = i;
    player.walkPhase = i + 1 - 1e-12;
    footFx(game, state);
    footFx(game, state);
  }
  player.alive = false;
  player.walkPhase += 1;
  footFx(game, state);
  assert.deepEqual(sounds, ['stone', 'grass', 'path', 'wood', 'sand', 'water'].map((s) => `footstep:${s}`));
});
