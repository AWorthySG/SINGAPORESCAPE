import './seed.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MRT_FARE, STATIONS } from '../src/data/transport.js';
import { depositLoot } from '../src/game/bankkeep.js';
import { Game } from '../src/game/game.js';
import { LINE_BY_ID, regionAction } from '../src/game/regionquests.js';
import { CAST_TICKS } from '../src/game/teleports.js';

function gameWithSounds() {
  const game = new Game();
  game.start();
  const sounds = [];
  game.bus.on('sfx', (name) => {
    if (/^(interact|travel):/.test(name)) sounds.push(name);
  });
  return { game, sounds };
}

test('a bank arrival sounds exactly once and only after the player reaches it', () => {
  const { game, sounds } = gameWithSounds();
  const bank = game.world.objects.find((o) => o.def.type === 'bank');
  let opened = 0;
  game.ui = { openBank: () => { opened++; } };
  game.player.x = game.player.tx = bank.x - 3;
  game.player.y = game.player.ty = bank.y;
  game.player.setAction({ type: 'openbank', target: bank });
  game.resolvePlayerAction();
  assert.equal(opened, 0);
  assert.deepEqual(sounds, []);

  game.player.x = game.player.tx = bank.x - 1;
  game.defaultObjectAction(bank);
  game.resolvePlayerAction();
  game.resolvePlayerAction();
  game.bus.emit('inventory');
  game.bus.emit('bank');
  assert.equal(opened, 1);
  assert.deepEqual(sounds, ['interact:bank']);

  // A prop NPC that has nothing to say doesn't open a dialogue.
  game.ui.openDialogue = () => false;
  game.player.setAction({ type: 'talk', target: game.playerTile() });
  game.resolvePlayerAction();
  assert.deepEqual(sounds, ['interact:bank']);
});

test('shop, bank and equipment sounds follow completed transactions', () => {
  const { game, sounds } = gameWithSounds();
  const indexOf = (id) => game.inventory.slots.findIndex((slot) => slot?.id === id);
  game.inventory.remove('coins', Infinity);
  game.buyItem('general', 'bronze_dagger');
  game.sellItem('general', 'logs');
  game.deposit('logs', 1);
  game.withdraw('logs', 1);
  game.equipItem(-1);
  game.unequip('weapon');
  assert.deepEqual(sounds, []);

  game.inventory.add('coins', 1000);
  game.buyItem('general', 'bronze_dagger');
  game.equipItem(indexOf('bronze_dagger'));
  game.unequip('weapon');
  game.sellItem('general', 'bronze_dagger');
  game.buyItem('general', 'bronze_arrow', 10);
  game.deposit('bronze_arrow', 2);
  game.withdraw('bronze_arrow', 1);
  assert.equal(game.bank.count('bronze_arrow'), 1);

  game.inventory.add('logs', 2);
  depositLoot(game);
  assert.equal(game.bank.count('logs'), 2);
  game.depositAll();
  game.depositAll();
  assert.deepEqual(sounds, [
    'interact:buy', 'interact:equip', 'interact:unequip', 'interact:sell',
    'interact:buy', 'interact:deposit', 'interact:withdraw', 'interact:deposit', 'interact:deposit',
  ]);
});

test('offerings, potions and quest steps sound only when used successfully', () => {
  const { game, sounds } = gameWithSounds();
  const indexOf = (id) => game.inventory.slots.findIndex((slot) => slot?.id === id);
  game.buryAllBones();
  game.donateToShrine('logs');
  game.drinkPotion(-1);
  game.handleDialogueAction('questTurnIn');
  assert.deepEqual(sounds, []);

  game.inventory.add('bones', 2);
  game.inventory.add('big_bones', 2);
  assert.equal(game.buryAllBones(), 4);
  game.inventory.add('logs', 1);
  assert.ok(game.donateToShrine('logs') > 0);
  game.inventory.add('attack_potion', 1);
  game.drinkPotion(indexOf('attack_potion'));
  assert.ok(game.potions.attack_potion > 0);
  game.handleDialogueAction('questStart');
  game.handleDialogueAction('questStart');
  game.handleDialogueAction('questTurnIn');
  game.inventory.add('bones', 10);
  game.handleDialogueAction('questTurnIn');
  assert.equal(game.quests.bone_collector.state, 'done');
  assert.deepEqual(sounds, [
    'interact:bury', 'interact:offer', 'interact:potion', 'interact:quest', 'interact:quest',
  ]);
});

test('MRT, ferry and teleport phases have separate cues', () => {
  const { game, sounds } = gameWithSounds();
  const station = STATIONS[1];
  const ferry = Object.values(LINE_BY_ID).find((line) => line.unlock.type === 'ferry');
  game.inventory.remove('coins', Infinity);
  assert.equal(game.travelTo(station.id), false);
  assert.equal(game.teleports.start('grave'), false);
  assert.equal(regionAction(game, `rq:ferry:${ferry.id}`), false);
  assert.deepEqual(sounds, []);

  game.inventory.add('coins', MRT_FARE);
  assert.equal(game.travelTo(station.id), true);
  assert.equal(game.teleports.start('town'), true);
  assert.equal(game.teleports.start('town'), false);
  assert.equal(game.teleports.start('town'), true);
  for (let i = 0; i < CAST_TICKS; i++) game.teleports.tick();
  assert.ok(game.teleports.townWait() > 0);
  assert.equal(game.teleports.start('town'), false);
  game.quests[ferry.id].state = 'done';
  assert.equal(regionAction(game, `rq:ferry:${ferry.id}`), true);
  assert.deepEqual(sounds, [
    'travel:mrt', 'travel:cast', 'travel:fizzle', 'travel:cast', 'travel:teleport', 'travel:ferry',
  ]);
});
