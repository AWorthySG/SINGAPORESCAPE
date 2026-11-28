import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOMS, PATTERNS } from '../src/data/islandlife.js';
import { TEXTILE_METHODS, TEXTILE_PROJECTS, TEXTILE_SWATCHES } from '../src/data/textiles.js';
import { xpForLevel } from '../src/data/xp.js';
import { Game } from '../src/game/game.js';
import { atIslandSite, displayHomeTextile, finishTextileProject, islandBook, islandPractised, islandSiteTile, makeIslandPattern, restoreIslandLife } from '../src/game/islandlife.js';
import { saveGame } from '../src/game/save.js';

function fresh() {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const game = new Game(); game.start(); game.chooseClass('rogue');
  return game;
}

function visit(game, site) {
  const { x, y } = islandSiteTile(game.world, site);
  game.player.x = game.player.tx = x;
  game.player.y = game.player.ty = y;
  game.updateRegion();
}

const stepsFor = (project) => project.steps.map((step) => step.method);

test('the market sampler checks the wax and dye steps, costs nothing and stays one-time after reload', () => {
  const game = fresh(), sampler = TEXTILE_PROJECTS[0];
  const coins = game.inventory.count('coins'), xp = game.skills.xp.textile_arts;
  assert.equal(atIslandSite(game, LOOMS[0]), false);
  assert.equal(finishTextileProject(game, sampler.id, stepsFor(sampler)), false);
  visit(game, LOOMS[0]);
  assert.equal(finishTextileProject(game, sampler.id, ['dip', 'dip']), false);
  assert.equal(game.skills.xp.textile_arts, xp);
  assert.equal(finishTextileProject(game, sampler.id, stepsFor(sampler)), true);
  assert.equal(game.inventory.count('coins'), coins);
  assert.ok(game.skills.xp.textile_arts > xp);
  assert.ok(islandPractised(game, 'textile_arts', 'project:' + sampler.id));
  assert.deepEqual(islandBook(game).patterns, [], 'the sampler does not unlock scarf orders');
  assert.equal(saveGame(game), true);
  const loaded = new Game(); loaded.start();
  visit(loaded, LOOMS[0]);
  assert.equal(finishTextileProject(loaded, sampler.id, stepsFor(sampler)), false);
  assert.deepEqual(islandBook(loaded).textiles.projects, [sampler.id]);
});

test('larger hangings require their level, materials and workshop, then give repeat XP and persist on display', () => {
  const game = fresh(), projects = TEXTILE_PROJECTS.filter((p) => !p.free);
  assert.deepEqual(projects.map((project) => project.level), [25, 50, 75, 99]);
  game.inventory.add('coins', 400);
  for (const project of projects) {
    const steps = stepsFor(project);
    assert.ok(steps.every((id) => TEXTILE_METHODS.some((method) => method.id === id)));
    for (const [dye, amount] of project.dyes) game.inventory.add(dye, 2 * amount);
    game.skills.xp.textile_arts = xpForLevel(project.level - 1);
    visit(game, LOOMS[1]);
    assert.equal(finishTextileProject(game, project.id, steps), false);
    game.skills.xp.textile_arts = xpForLevel(project.level);
    visit(game, LOOMS[0]);
    assert.equal(finishTextileProject(game, project.id, steps), false);
    visit(game, LOOMS[1]);
    const purse = game.inventory.count('coins'), xp = game.skills.xp.textile_arts;
    const supplies = project.dyes.map(([dye]) => game.inventory.count(dye));
    assert.equal(finishTextileProject(game, project.id, steps.slice(0, -1)), false);
    assert.equal(game.inventory.count('coins'), purse);
    assert.equal(finishTextileProject(game, project.id, steps), true);
    const trained = game.skills.xp.textile_arts;
    assert.ok(trained > xp);
    game.todayKey = () => '2026-11-28';
    assert.equal(finishTextileProject(game, project.id, steps), true, 'works again on the same day');
    assert.ok(game.skills.xp.textile_arts > trained);
    assert.equal(finishTextileProject(game, project.id, steps), false, 'does not work without more dye');
    assert.equal(game.inventory.count('coins'), purse - 2 * project.coins);
    project.dyes.forEach(([dye, amount], i) => assert.equal(game.inventory.count(dye), supplies[i] - 2 * amount));
  }
  const id = projects.at(-1).id;
  assert.equal(displayHomeTextile(game, id), false);
  game.home.owned = true;
  assert.equal(displayHomeTextile(game, 'missing'), false);
  assert.equal(displayHomeTextile(game, id), true);
  assert.equal(saveGame(game), true);
  const loaded = new Game(); loaded.start();
  assert.deepEqual(islandBook(loaded).textiles, { projects: projects.map((p) => p.id), display: id });
  assert.equal(displayHomeTextile(loaded, null), true);
  assert.equal(islandBook(loaded).textiles.display, null);
  assert.deepEqual(restoreIslandLife({ textiles: { projects: ['invalid', id, id], display: 'undone' } }).textiles, { projects: [id], display: null });
});

test('guided printing still wears the old scarf and leaves the original Chinatown reward and fee intact', () => {
  const game = fresh(), pattern = PATTERNS.find((p) => p.id === 'butterfly');
  assert.deepEqual(Object.keys(TEXTILE_SWATCHES), PATTERNS.map((p) => p.id));
  game.todayKey = () => '2026-11-28';
  game.skills.xp.textile_arts = xpForLevel(22);
  visit(game, LOOMS[1]);
  game.inventory.add(pattern.dye, 4);
  const coins = game.inventory.count('coins'), technique = TEXTILE_SWATCHES[pattern.id].method;
  assert.equal(makeIslandPattern(game, pattern.id, { technique: 'stamp' }), false);
  assert.equal(game.inventory.count(pattern.dye), 4);
  assert.equal(game.inventory.count('coins'), coins);
  assert.equal(makeIslandPattern(game, pattern.id, { technique }), true);
  assert.equal(islandBook(game).scarf, pattern.id);
  assert.equal(game.inventory.count('coins'), coins - 8);
  assert.equal(makeIslandPattern(game, pattern.id, { order: true, technique }), true);
  assert.equal(game.inventory.count(pattern.reward), 1);
  assert.equal(makeIslandPattern(game, pattern.id, { order: true, technique }), false);
  assert.equal(makeIslandPattern(game, pattern.id, { technique }), true, 'practice remains available after the order');
  assert.equal(game.inventory.count(pattern.reward), 1);
  assert.equal(game.inventory.count(pattern.dye), 0);
});
