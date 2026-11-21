// Auto quest gathers everything a quest step needs before processing it, and
// processes it all before handing in: no rock -> furnace -> rock trips per bar.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function freshGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.ui = new Proxy({}, { get: () => () => {} });
  game.player.hp = game.player.maxHp = 5000;   // a stray monster can't end the run early
  return game;
}

/** Run auto quest on `id` until it is handed in, logging every visit: each
 *  stretch of an action type (mine, smelt, fish, cook...) and every hand-in
 *  talk with how many of `item` you held. */
function runAutoQuest(game, id, item, ticks = 4000 * 8) {
  const q = game.quests[id];
  const visits = [];        // [type, ...] one entry per unbroken stretch of that action
  const handIns = [];       // how many `item` you held at each talk with the quest giver
  const talk = game._autoQuestTalk.bind(game);
  game._autoQuestTalk = (qid, npc) => { if (qid === id) handIns.push(game.inventory.count(item)); return talk(qid, npc); };
  game.autoQuestId = id;
  game.toggleAutoQuest(true);
  let prev = null;
  for (let i = 0; i < ticks && q.state !== 'done' && game.autoQuest; i++) {
    game.update(250);
    const t = game.player.action?.type || null;
    if (t && t !== prev && t !== 'questtalk') visits.push(t);
    prev = t;
  }
  return { q, visits, handIns };
}

test('Smith\'s Apprentice guide: gathers ore for every bar still owed before the furnace', () => {
  const game = freshGame();
  game.quests.smith_apprentice.state = 'active';
  for (const id of ['iron_ore', 'coal', 'steel_bar']) game.inventory.remove(id, game.inventory.count(id));
  const g = () => game.questGuide('smith_apprentice');
  // A new player can't make steel yet: the guide says what to train first.
  assert.equal(g().kind, 'none');
  assert.match(g().text, /^Reach Smithing 30/);
  game.skills.xp.smithing = xpForLevel(30);
  assert.match(g().text, /^Reach Mining 15 to mine iron/);
  game.skills.xp.mining = xpForLevel(60);
  assert.equal(g().objId, 'iron_rock');
  assert.equal(g().text, 'Mine iron ore (0/8)');
  // One ore and two coal used to send you to the furnace for a single bar.
  game.inventory.add('iron_ore', 1); game.inventory.add('coal', 2);
  assert.equal(g().objId, 'iron_rock', 'one bar\'s worth is not enough: keep mining');
  game.inventory.add('iron_ore', 7);
  assert.equal(g().objId, 'coal_rock');
  assert.equal(g().text, 'Mine coal for the steel (2/16)');
  game.inventory.add('coal', 14);
  assert.equal(g().objId, 'furnace');
  assert.equal(g().text, 'Smelt 8 steel bars at the furnace');
  // Bars already made count: only the rest are owed.
  game.inventory.remove('iron_ore', 8); game.inventory.remove('coal', 16);
  game.inventory.add('steel_bar', 5);
  assert.equal(g().text, 'Mine iron ore (0/3)');
  game.inventory.add('iron_ore', 3); game.inventory.add('coal', 6);
  assert.equal(g().text, 'Smelt 3 steel bars at the furnace');
  game.inventory.add('steel_bar', 3);
  assert.equal(g().npcId, 'guide', 'all 8: hand in');
});

test('auto quest mines all the ore, smelts all 8 steel bars in one furnace visit, then hands in once', () => {
  const game = freshGame();
  game.skills.xp.mining = xpForLevel(60);
  game.skills.xp.smithing = xpForLevel(60);
  game.quests.smith_apprentice.state = 'active';
  for (const id of ['iron_ore', 'coal', 'steel_bar', 'iron_bar']) game.inventory.remove(id, game.inventory.count(id));
  const { q, visits, handIns } = runAutoQuest(game, 'smith_apprentice', 'steel_bar');
  assert.equal(q.state, 'done', `handed in (auto quest ${game.autoQuest ? 'on' : 'off'})`);
  assert.equal(visits.filter((t) => t === 'smelt').length, 1, `one furnace visit (${visits.join(', ')})`);
  const smelt = visits.indexOf('smelt');
  assert.ok(visits.slice(0, smelt).includes('mine'), 'mined first');
  assert.ok(!visits.slice(smelt + 1).includes('mine'), 'no mining after the furnace');
  assert.equal(handIns.length, 1, 'the guide was visited once');
  assert.ok(handIns[0] >= 8, `holding all 8 bars (${handIns[0]})`);
  assert.equal(game.inventory.count('iron_bar'), 0, 'no ore wasted on iron bars');
});

test('auto quest smelts only the steel it was sent for: a spare iron ore stays ore', () => {
  const game = freshGame();
  game.skills.xp.mining = xpForLevel(60);
  game.skills.xp.smithing = xpForLevel(60);
  game.quests.smith_apprentice.state = 'active';
  for (const id of ['iron_ore', 'coal', 'steel_bar', 'iron_bar']) game.inventory.remove(id, game.inventory.count(id));
  // A lucky swing left one ore over: "Do all" at the furnace would make it an iron bar.
  game.inventory.add('iron_ore', 9); game.inventory.add('coal', 16);
  assert.equal(game.questGuide('smith_apprentice').make, 'steel_bar');
  const { q } = runAutoQuest(game, 'smith_apprentice', 'steel_bar');
  assert.equal(q.state, 'done');
  assert.equal(game.inventory.count('iron_bar'), 0, 'no iron bar');
  assert.equal(game.inventory.count('iron_ore'), 1, 'the spare ore is kept');
});

test('auto quest catches all the salmon before cooking them in one go, then hands in once', () => {
  const game = freshGame();
  game.skills.xp.fishing = xpForLevel(60);
  game.skills.xp.cooking = xpForLevel(70);   // past salmon's burn level: every one cooks
  game.quests.island_provisions.state = 'active';
  for (const id of ['raw_salmon', 'salmon']) game.inventory.remove(id, game.inventory.count(id));
  const g = game.questGuide('island_provisions');
  assert.equal(g.objId, 'salmon_spot', 'salmon are netted at a salmon run');
  assert.equal(g.text, 'Net salmon (0/10)');
  game.inventory.add('raw_salmon', 4);
  assert.equal(game.questGuide('island_provisions').objId, 'salmon_spot', 'four is not ten: keep fishing');
  game.inventory.remove('raw_salmon', 4);
  const { q, visits, handIns } = runAutoQuest(game, 'island_provisions', 'salmon');
  assert.equal(q.state, 'done', `handed in (auto quest ${game.autoQuest ? 'on' : 'off'})`);
  assert.equal(visits.filter((t) => t === 'cook').length, 1, `one trip to the range (${visits.join(', ')})`);
  assert.ok(!visits.slice(visits.indexOf('cook') + 1).includes('fish'), 'no fishing after cooking');
  assert.equal(handIns.length, 1, 'the guide was visited once');
  assert.ok(handIns[0] >= 10, `holding all 10 salmon (${handIns[0]})`);   // (a big catch can land one extra)
});

test('Island Provisions below Fishing 30 says so, and auto quest leaves it for later', () => {
  const game = freshGame();
  game.quests.island_provisions.state = 'active';
  assert.equal(game.questGuide('island_provisions').text, 'Reach Fishing 30 to catch salmon');
  assert.notEqual(game.autoQuestPick(), 'island_provisions');
  game.inventory.add('raw_salmon', 10);
  assert.equal(game.questGuide('island_provisions').objId, 'range', 'salmon already caught can still be cooked');
});
