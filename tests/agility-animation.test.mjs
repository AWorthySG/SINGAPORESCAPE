import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICK_MS } from '../src/config.js';
import { OBJECTS } from '../src/data/objects.js';
import { xpForLevel } from '../src/data/xp.js';
import { Game } from '../src/game/game.js';
import { HERO_CLIPS, actionClipId, heroAnimFrame, sampleHeroClip } from '../src/render/heroanim.js';

const courseStarts = ['agility_course', 'agility_balance', 'supertree_skyway_stairs', 'container_yard_run_stack',
  'canopy_course_rope_bridge', 'cloud_steps_ledge', 'wraith_run_gravestones', 'rift_leap_chasm'];
const obstacles = Object.keys(OBJECTS).filter((id) => OBJECTS[id].type === 'agility');

function newGame(level) {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.npcs = [];
  game.skills.xp.agility = xpForLevel(level);
  return game;
}

function standBy(game, obj) {
  const p = game.player;
  p.stopNow();
  p.clearAction();
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = obj.x + dx, y = obj.y + dy;
    if (game.world.isBlocked(x, y) || game.world.objectAt(x, y)) continue;
    p.x = p.tx = x;
    p.y = p.ty = y;
    return;
  }
  assert.fail(`No path beside ${obj.objId}`);
}

test('all Agility obstacles select an explicit one-shot pose that fits the tick', () => {
  assert.equal(obstacles.length, 33);
  const clips = new Set();
  for (const objId of obstacles) {
    const def = OBJECTS[objId];
    assert.ok(def.agilityMotion, `${objId} is classified`);
    const id = actionClipId({ type: 'agility', obj: { objId } });
    const clip = HERO_CLIPS[id];
    assert.ok(clip?.hands && !clip.loop && clip.dur < TICK_MS, `${objId} has a crossing pose`);
    clips.add(id);
  }
  assert.equal(clips.size, 10);
  const pose = (objId, u) => sampleHeroClip(actionClipId({ type: 'agility', obj: { objId } }), u).ch;
  assert.ok(pose('container_yard_run_chute', 0.5).lean < -0.25);
  assert.ok(pose('canopy_course_log_slide', 0.5).crouch >= 8);
  assert.ok(pose('rift_leap_portal_dive', 0.63).lean > 0.65);
  assert.ok(pose('cloud_steps_stepping_stones', 0.3).by < -5);
  assert.ok(pose('cloud_steps_stepping_stones', 0.68).by < -5);
});

test('interacting with each course animates every crossing and leaves the next walk running', () => {
  const game = newGame(400);
  let now = 1000, events = [];
  const all = new Set();
  game.bus.on('skillpose', (e) => { if (e.agility) events.push(e); });
  for (const id of courseStarts) {
    const obj = game.world.objects.find((o) => o.objId === id);
    const expected = new Set((obj.def.markChance === undefined ? [obj] : game._agilityCourse(obj)).map((o) => o.objId));
    standBy(game, obj);
    events = [];
    game.tickAcc = 0;
    assert.ok(game.defaultObjectAction(obj), id);
    assert.ok(!heroAnimFrame(game, (now += TICK_MS)).id.startsWith('agility_'), 'No crossing before the award tick');
    const shown = new Set();
    let departure = false;
    for (let i = 0; i < 1200 && shown.size < expected.size; i++) {
      game.update(30);
      const frame = heroAnimFrame(game, (now += 30));
      const crossing = events.at(-1);
      if (!crossing || frame.id !== crossing.id) continue;
      assert.equal(frame.kind, 'skill');
      if (game.player.isMoving && game.player.action?.type === 'agility') departure = true;
      if (frame.u >= 0.4) shown.add(crossing.target.objId);
    }
    assert.deepEqual(shown, expected, `${id} showed all its crossings`);
    assert.equal(events.length, expected.size, `${id} played once per successful crossing`);
    if (expected.size > 1) assert.ok(departure, `${id} shows the crossing while already heading to the next obstacle`);
    shown.forEach((key) => all.add(key));
  }
  assert.deepEqual(all, new Set(obstacles));
});

test('a denied obstacle plays no crossing and walking away cancels an active pose', () => {
  const game = newGame(1);
  const chute = game.world.objects.find((o) => o.objId === 'container_yard_run_chute');
  standBy(game, chute);
  game.defaultObjectAction(chute);
  let now = 1000;
  assert.equal(heroAnimFrame(game, now).id, 'idle');
  game.update(TICK_MS);
  assert.equal(heroAnimFrame(game, (now += TICK_MS)).id, 'idle');
  game.skills.xp.agility = xpForLevel(130);
  game.defaultObjectAction(chute);
  game.update(TICK_MS);
  assert.equal(heroAnimFrame(game, (now += TICK_MS)).id, 'agility_slide');
  assert.ok(game.player.isMoving, 'The course started the next step');
  game.player.clearAction();   // manual walking cancels the Agility route
  assert.equal(heroAnimFrame(game, (now += 16)).id, 'walk');
});
