import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { chooseFirstDestination, chooseFirstJourney, firstJourneyGoal, skipFirstJourney } from '../src/game/firstjourney.js';
import { captureResumeTask, finishResumeTask } from '../src/game/resumetask.js';
import { saveGame, snapshot } from '../src/game/save.js';
import { regionAction, regionDialogue } from '../src/game/regionquests.js';
import { regionTone } from '../src/game/consequences.js';
import { makePracticeDrill, practiceHit, practiceResponse, knownBossMove } from '../src/game/bosspractice.js';
import { drawLayeredObject, isDepthShop } from '../src/render/streetdepth.js';

function fresh() {
  const data = new Map();
  globalThis.localStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const game = new Game();
  game.start();
  game.chooseClass('rogue');
  return game;
}

test('opening journey tracks gathering, a bank deposit and arrival exactly once across a reload', () => {
  const game = fresh();
  assert.match(firstJourneyGoal(game).text, /Choose combat or gathering/);
  assert.equal(chooseFirstJourney(game, 'gather'), true);
  game.skills.addXp('woodcutting', 10);
  assert.equal(game.firstJourney.phase, 'bank');
  game.deposit('coins', 1);
  assert.equal(game.firstJourney.phase, 'explore');
  assert.equal(saveGame(game), true);
  const resumed = new Game();
  resumed.start();
  assert.equal(resumed.firstJourney.phase, 'explore');
  resumed.travelToTile = () => true;
  assert.equal(chooseFirstDestination(resumed, 'Chinatown'), true);
  const before = resumed.inventory.count('coins');
  const region = resumed.world.zones.find((z) => z.name === 'Chinatown');
  resumed.player.x = region.x0 + 1;
  resumed.player.y = region.y0 + 1;
  resumed.updateRegion();
  resumed.updateRegion();
  assert.equal(resumed.firstJourney.phase, 'done');
  assert.equal(resumed.inventory.count('coins'), before + 250);
  assert.equal(firstJourneyGoal(resumed), null);
});

test('the combat route counts an actual rat defeat and the journey can be skipped', () => {
  const game = fresh();
  assert.equal(chooseFirstJourney(game, 'combat'), true);
  const rat = game.npcs.find((n) => n.npcId === 'rat' && !n.champion);
  rat.hp = 0;
  game.killNpc(rat);
  assert.equal(game.firstJourney.phase, 'bank');
  skipFirstJourney(game);
  game.deposit('coins', 1);
  assert.equal(game.firstJourney.phase, 'skipped');
  assert.equal(firstJourneyGoal(game), null);
});

test('gathering destination resumes after reload and dismissal removes the checkpoint', () => {
  const game = fresh();
  const tree = game.world.objects.find((o) => o.objId === 'tree');
  game.player.action = { type: 'woodcut', obj: tree };
  const expected = { kind: 'work', x: tree.x, y: tree.y, id: 'tree' };
  assert.deepEqual(captureResumeTask(game), expected);
  saveGame(game);
  const loaded = new Game();
  loaded.start();
  assert.deepEqual(loaded.resumeTask, expected);
  let target;
  loaded.goToObject = (o) => { target = o; return true; };
  assert.equal(finishResumeTask(loaded, true), true);
  assert.equal(target.objId, 'tree');
  loaded.resumeTask = expected;
  assert.equal(finishResumeTask(loaded, false), false);
  assert.equal(snapshot(loaded).resumeTask, undefined);
});

test('Construction is an explicit quest hand-in and only consumes the chosen materials', () => {
  const game = fresh();
  const id = 'rq_kampong_glam';
  game.quests[id] = { state: 'active', step: 1, n: 0 };
  const npc = game.npcs.find((n) => n.npcId === 'rq_zainab');
  const action = `rq:alternative:${id}`;
  assert.equal(regionAction(game, action), false);
  game.inventory.add('plank', 3);
  game.inventory.add('logs', 5);
  assert.ok(regionDialogue(game, npc).start.options.some((o) => o.action === action));
  assert.equal(regionAction(game, action), true);
  assert.equal(regionAction(game, action), false);
  assert.equal(game.quests[id].step, 2);
  assert.equal(game.inventory.count('plank'), 0);
  assert.equal(game.inventory.count('logs'), 5);
});

test('a quest choice changes the local mood derived from existing save fields', () => {
  const game = fresh();
  game.quests.rq_chinatown.state = 'done';
  assert.equal(regionTone(game, 'Chinatown'), 1);
  game.story.picks.rq_chinatown = 'good';
  assert.equal(regionTone(game, 'Chinatown'), 2);
  game.story.picks.rq_chinatown = 'evil';
  assert.equal(regionTone(game, 'Chinatown'), -1);
});

test('boss drills use actual attack geometry and a defeat reports the fatal pattern', () => {
  const game = fresh();
  const line = makePracticeDrill(game, 'line');
  assert.ok(practiceHit(line, { x: 5, y: 5 }));
  assert.equal(practiceHit(line, { x: 5, y: 6 }), false);
  assert.equal(practiceResponse(knownBossMove('boar_king')), 'strike');
  let lesson;
  game.bus.on('bosslesson', (next) => { lesson = next; });
  game.playerDeath({ boss: 'boar_king', pattern: 'line' });
  assert.equal(lesson.name, 'line ground attack');
  assert.match(lesson.tip, /sideways/);
});

test('Kampong Glam shophouses use the depth treatment and the lower layer stays opaque', () => {
  const game = fresh();
  assert.deepEqual(game.world.landmarks.filter(isDepthShop).map((o) => o.objId), ['shophouse_row_mint', 'shophouse_row_peach']);
  const slices = [];
  const ctx = { globalAlpha: 1, save() {}, restore() { this.globalAlpha = 1; }, drawImage(...args) { slices.push([this.globalAlpha, ...args.slice(1)]); } };
  drawLayeredObject(ctx, { naturalWidth: 200, naturalHeight: 100 }, 0, 0, 100, 50, .4, .2);
  assert.deepEqual(slices, [[.4, 0, 0, 200, 80, 0, 0, 100, 40], [1, 0, 80, 200, 20, 0, 40, 100, 10]]);
});
