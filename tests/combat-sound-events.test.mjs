import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { NPCS } from '../src/data/npcs.js';
import { RACES } from '../src/data/races.js';
import { impactCue, impactProfile } from '../src/audio/impactProfile.js';
import { fakeStorage } from '../tools/balance/common.mjs';

function setup(jobClass) {
  globalThis.localStorage = fakeStorage();
  const game = new Game();
  game.start();
  game.chooseClass(jobClass);
  game.ui = new Proxy({}, { get: () => () => {} });
  const cues = [];
  game.bus.on('sfx', (cue) => cues.push(cue));
  return { game, cues };
}

function target(game, npcId) {
  const npc = new NPC(npcId, game.player.x + 1, game.player.y, 0, {});
  npc.hp = npc.maxHp = 1e6;
  return npc;
}

test('all monster races and the distinct shell, slime, and metal surfaces have impact profiles', () => {
  const profiles = new Set(Object.entries(NPCS).map(([id, def]) => impactProfile(def, id)));
  for (const profile of [...Object.keys(RACES), 'shell', 'slime', 'metal']) {
    assert.ok(profiles.has(profile), profile);
  }
  assert.equal(impactProfile(NPCS.giant_crab, 'giant_crab'), 'shell');
  assert.equal(impactProfile(NPCS.elder_rust_golem, 'elder_rust_golem'), 'metal');
  assert.equal(impactProfile(NPCS.stone_golem, 'stone_golem'), 'construct');
  assert.equal(impactCue(null, null), 'hit');
  assert.equal(impactCue(null, null, true), 'crit');
});

test('landed blows emit the target surface and keep it for critical hits', () => {
  const { game, cues } = setup('swordsman');
  const crab = target(game, 'giant_crab');
  const skeleton = target(game, 'skeleton');
  const slime = target(game, 'swamp_slime');
  game._applyPlayerHit(crab, 1);
  game._pendingCrit = 2;
  game._applyPlayerHit(skeleton, 1);
  game._applyPlayerHit(slime, 1);
  game._applyPlayerHit(crab, 0);
  assert.deepEqual(cues, ['hit:shell', 'crit:undead', 'hit:slime']);
});

test('ready, release, guard, heal, and monster windup have distinct event cues', () => {
  const { game, cues } = setup('swordsman');
  const crab = target(game, 'giant_crab');
  game.activateAbility('riposte');
  game.doPlayerAttack(crab);
  game.activateAbility('brace');
  game.player.hp = 1;
  game.activateAbility('second_wind');
  game.npcTelegraph(crab);
  assert.deepEqual(cues.filter((cue) => cue.startsWith('ability:')), [
    'ability:ready', 'ability:attack', 'ability:guard', 'ability:heal', 'ability:windup',
  ]);
  assert.ok(cues.some((cue) => cue === 'atk:sword'));
  assert.ok(cues.some((cue) => cue === 'hit:shell' || cue === 'crit:shell'));
});

test('casting emits both the equipped magic weapon and spell element', () => {
  const { game, cues } = setup('wizard');
  const foe = target(game, 'goblin');
  game.doPlayerAttack(foe);
  const projectile = game.effects.find(({ type }) => type === 'projectile');
  assert.ok(projectile?.el, 'the starter can cast a spell');
  assert.ok(cues.includes(`atk:staff:${projectile.el}`));
});
