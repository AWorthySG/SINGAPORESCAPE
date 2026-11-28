// The living world: NPC routines on the game clock, people who stop for you,
// townsfolk who remember your deeds, choices that change the world, and
// region reputation (src/game/npclife.js, memory.js, consequences.js,
// reputation.js, src/ui/reputationui.js).
import { questChoice } from '../src/data/questChoices.js';
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame, loadGame } from '../src/game/save.js';
import { DAY_CYCLE_MS } from '../src/config.js';
import { SHOPS } from '../src/data/shops.js';
import { getItem } from '../src/data/items.js';
import { CONSEQUENCES, RESIDENTS } from '../src/data/consequences.js';
import { MORAL_BY_ID } from '../src/data/moralEvents.js';
import { QUESTS } from '../src/data/quests.js';
import { ROUTINES, CHAT_EXCHANGES } from '../src/data/npcchatter.js';
import { slotAt, routineTarget, HOLD_TICKS } from '../src/game/npclife.js';
import { memoryLines, tauntFor, personalise, FRESH_MS } from '../src/game/memory.js';
import { worldMood, consequencePriceMult } from '../src/game/consequences.js';
import { moodFor } from '../src/render/ambience.js';
import {
  REP_REGIONS, REP_RANKS, REP_GAIN, addRep, rankFor, repRank, repPriceMult, repTitles, setRepTitle, repTitleText,
} from '../src/game/reputation.js';
import { regionsPanelHTML } from '../src/ui/reputationui.js';
import { PET_BY_ID } from '../src/game/pets.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
/** Set the in-game clock to an hour (0-24). */
function setHour(g, h) {
  const day = Math.floor(g.playMs / DAY_CYCLE_MS);
  g.playMs = day * DAY_CYCLE_MS + (h / 24) * DAY_CYCLE_MS;
}
/** Run world ticks with the frames between them (so people actually walk). */
function run(g, ticks) {
  for (let i = 0; i < ticks; i++) {
    g.doTick();
    for (let f = 0; f < 6; f++) for (const n of g.npcs) n.update(100);
  }
}
/** Stand the player on a free tile beside (x, y). */
function standNear(g, x, y) {
  const t = g._nearestFree(x + 2, y) || { x: x + 2, y };
  const p = g.player;
  p.stopNow(); p.clearAction();
  p.x = p.tx = t.x; p.y = p.ty = t.y;
  g.updateRegion();
}

test('every routine has people at their post (or pottering) at 7am, the hour a session opens', () => {
  for (const [kind, slots] of Object.entries(ROUTINES)) {
    assert.ok(['post', 'wander'].includes(slotAt(kind, 7)), `${kind} at 7am`);
    // The slots cover the whole day with no gaps.
    for (let h = 0; h < 24; h += 0.5) assert.ok(slots.some((s) => (s.from <= s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to)), `${kind} covers ${h}h`);
  }
  assert.equal(slotAt('stall', 12), 'post');
  assert.equal(slotAt('stall', 23), 'home');
  assert.equal(slotAt('stall', 3), 'home');
  assert.equal(slotAt('stall', 17), 'chat');
  assert.equal(slotAt('night', 23), 'a', 'the stargazer is out at night');
  assert.equal(slotAt('early', 5), 'a', 'the early riser is out before dawn');
});

test('a stall keeper minds her stall by day and walks home at night, then back', () => {
  const g = newGame();
  const z = g.npcs.find((n) => n.npcId === 'rq_zainab');
  standNear(g, z.x, z.y);
  g.doTick();
  assert.ok(z.life, 'Mak Cik Zainab keeps a routine');
  const post = { ...z.life.post };
  assert.deepEqual({ x: z.x, y: z.y }, post, 'at her stall in the morning');
  setHour(g, 23);
  const home = routineTarget(g, z);
  assert.ok(home && (home.x !== post.x || home.y !== post.y), 'home is somewhere else');
  assert.equal(g.world.zoneAt(home.x, home.y)?.name, 'Kampong Glam', 'home is in her own region');
  run(g, 30);
  assert.deepEqual({ x: z.x, y: z.y }, home, 'she walked home at night');
  setHour(g, 12);
  run(g, 30);
  assert.deepEqual({ x: z.x, y: z.y }, post, 'and back to the stall by noon');
});

test('neighbours meet for a chat, face each other and trade lines', () => {
  const g = newGame();
  g.doTick();
  const pair = g._life.pairs.find((p) => p.a.life.zone === 'Kampong Glam');
  assert.ok(pair, 'two Kampong Glam neighbours are paired');
  standNear(g, pair.a.life.post.x, pair.a.life.post.y);
  setHour(g, 16.5);
  const lines = new Set(CHAT_EXCHANGES.flat());
  const said = new Set();
  for (let i = 0; i < 80; i++) { run(g, 1); for (const n of [pair.a, pair.b]) if (n.chatTimer > 0 && lines.has(n.chatText)) said.add(n); }
  assert.equal(said.size, 2, 'both of them speak');
  const [sa, sb] = pair.spots;
  assert.deepEqual({ x: pair.a.x, y: pair.a.y }, sa);
  assert.deepEqual({ x: pair.b.x, y: pair.b.y }, sb);
  assert.deepEqual(pair.a.facing, { dx: Math.sign(pair.b.x - pair.a.x), dy: Math.sign(pair.b.y - pair.a.y) }, 'they face each other');
});

test('someone you click stops, turns to you, and waits; then carries on', () => {
  const g = newGame();
  const z = g.npcs.find((n) => n.npcId === 'rq_zainab');
  standNear(g, z.x, z.y);
  g.doTick();
  setHour(g, 23);
  run(g, 2);   // she sets off home
  assert.ok(z.isMoving || z.path.length, 'walking home');
  g.defaultNpcAction(z);
  const action = g.player.action;
  assert.equal(action?.type, 'talk');
  run(g, 3);
  const stopped = { x: z.x, y: z.y };
  assert.ok(!z.isMoving && !z.path.length, 'she stopped');
  assert.ok(Math.abs(action.target.x - stopped.x) <= 0 && Math.abs(action.target.y - stopped.y) <= 0, 'you walk to where she stands');
  const p = g.player;
  assert.deepEqual(z.facing, { dx: Math.sign(p.x - z.x), dy: Math.sign(p.y - z.y) }, 'she turned to you');
  // While you talk (a dialogue box open beside her) she stays put.
  g.ui = new Proxy({ modal: { kind: 'dialogue' } }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  p.clearAction();
  run(g, HOLD_TICKS + 10);
  assert.deepEqual({ x: z.x, y: z.y }, stopped, 'she waits while you talk');
  // Done talking: she goes on home.
  g.ui = new Proxy({ modal: null }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  run(g, HOLD_TICKS + 40);
  assert.deepEqual({ x: z.x, y: z.y }, routineTarget(g, z), 'then she carries on home');
});

test('shopkeepers and the banker never wander off; a moving shop resident still opens the shop', () => {
  const g = newGame();
  g.doTick();
  for (const n of g._life.list) assert.ok(n.def.role !== 'bank', `${n.name} is not a banker`);
  assert.ok(!g._life.list.some((n) => n.npcId === 'shopkeeper' || n.npcId === 'banker' || n.npcId === 'hawker'));
  const kim = g.npcs.find((n) => n.npcId === 'life_auntie_kim');
  assert.ok(kim, 'Auntie Kim keeps her laksa stall in Marina Bay');
  standNear(g, kim.x, kim.y);
  g.defaultNpcAction(kim);
  assert.equal(g.player.action?.type, 'openshop');
  assert.equal(g.player.action.shop, 'life_laksa_stall');
});

test('townsfolk remember a boss you beat, your pet and your name; bosses taunt you', () => {
  const g = newGame();
  const boss = g.npcs.find((n) => n.npcId === 'goblin_warchief');
  boss.hp = 0;
  g.killNpc(boss);
  assert.equal(g.deeds.boss?.name, 'Goblin Warchief');
  const region = 'Kampong Glam';
  const lines = memoryLines(g, region).map((l) => l.text);
  assert.ok(lines.some((t) => t.includes('Goblin Warchief')), 'they talk about the boss');
  assert.ok(lines.some((t) => t.includes(g.player.name)), 'and use your name');
  // News goes stale after a couple of in-game days.
  g.playMs += FRESH_MS + 1000;
  assert.ok(!memoryLines(g, region).some((l) => l.text.includes('Goblin Warchief')), 'old news is dropped');
  // A pet following you.
  const pet = Object.values(PET_BY_ID)[0];
  g.pets.owned[pet.id] = 1;
  g.pets.active = pet.id;
  assert.ok(memoryLines(g, region).some((l) => l.text.includes(pet.name)), 'they notice your pet');
  // A boss's taunt.
  const b2 = g.npcs.find((n) => n.npcId === 'boar_king');
  const t = tauntFor(g, b2);
  assert.ok(typeof t === 'string' && t.length > 3 && !t.includes('{'), 'a filled-in taunt');
  // Taunts fire once when a boss turns on you.
  standNear(g, b2.x, b2.y);
  b2.target = g.player;
  g.doTick();
  assert.ok(b2._taunted && b2.chatText, 'the boss taunts you as the fight starts');
});

test('passers-by make remarks now and then, rate-limited', () => {
  const g = newGame();
  g.doTick();
  const said = [];
  for (let i = 0; i < 200; i++) {
    g.doTick();
    for (const n of g.nearbyNpcs()) if (n._remarkAt === g.tickCount) said.push(n.chatText);
  }
  assert.ok(said.length >= 2, 'someone remarks');
  assert.ok(said.length <= 200 / 20 + 1, 'at most one remark every 20 ticks');
  assert.ok(said.every((t) => t && !t.includes('{')), 'every remark is filled in');
});

test('a conversation starts with a greeting that knows you; a Friend hears the news', () => {
  const g = newGame();
  const z = g.npcs.find((n) => n.npcId === 'rq_zainab');
  const base = { start: { speaker: 'Mak Cik Zainab', text: 'Hello.', options: [{ label: 'Goodbye.', next: 'end' }] } };
  const t1 = personalise(g, z, base);
  assert.ok(t1.start.text.endsWith('Hello.') && t1.start.text.length > 'Hello.'.length, 'a greeting first');
  assert.equal(base.start.text, 'Hello.', 'the original tree is untouched');
  assert.ok(!t1.start.options.some((o) => o.next === 'lifeNews'), 'no news for a Stranger');
  z.def = { ...z.def, dialogue: 'region' };
  addRep(g, 'Kampong Glam', 400);
  const t2 = personalise(g, z, base);
  assert.ok(t2.start.options.some((o) => o.next === 'lifeNews'), 'a Friend can ask for the news');
  assert.ok(t2.lifeNews.text.length > 10);
  // A resident with no dialogue of their own still chats.
  g.moralChoose('beaten_bandit', 'good');
  run(g, 5);
  const huat = g.npcs.find((n) => n.npcId === 'life_ah_huat');
  huat.life.lines = ['Hi {name}!'];
  assert.equal(personalise(g, huat, null).start.text, `Hi ${g.player.name}!`);
});

test('moral choices change prices, bring residents, and shade a region', () => {
  const g = newGame();
  g.doTick();
  const base = g.priceFactor('hawker').buy;
  g.moralChoose('hawker_change', 'good');
  run(g, 5);
  assert.ok(Math.abs(g.priceFactor('hawker').buy / base - 0.9) < 1e-9, 'the hawker gives 10% off');
  assert.equal(consequencePriceMult(g, 'general'), 1, 'other shops are unchanged');
  // The spared bandit opens a kaya toast stall.
  g.moralChoose('beaten_bandit', 'good');
  run(g, 5);
  const huat = g.npcs.find((n) => n.npcId === 'life_ah_huat');
  assert.ok(huat, 'Ah Huat has set up his stall');
  assert.equal(g.world.zoneAt(huat.x, huat.y)?.name, 'Bukit Timah');
  assert.equal(huat.def.role, 'shop');
  assert.equal(huat.artId, 'life_ah_huat', 'drawn by his own townsfolk picture, not the sellsword he borrows');
  const kim = g.npcs.find((n) => n.npcId === 'life_auntie_kim');
  assert.equal(kim?.artId, 'life_auntie_kim', 'Auntie Kim has her own picture too');
  assert.ok(SHOPS[huat.def.shop].stock.every((s) => getItem(s.id)), 'his stall sells real food');
  // Salting the laksa drives Auntie Kim away.
  assert.ok(g.npcs.some((n) => n.npcId === 'life_auntie_kim'));
  g.moralChoose('rival_stall', 'evil');
  run(g, 5);
  assert.ok(!g.npcs.some((n) => n.npcId === 'life_auntie_kim'), 'she packed up and left');
  // An emptied temple box leaves Pulau Ubin gloomier; it's subtle.
  const before = moodFor('Pulau Ubin');
  g.moralChoose('temple_box', 'evil');
  const after = worldMood(g, 'Pulau Ubin');
  assert.ok(after[3] > before[3] && after[3] - before[3] <= 0.06, 'a touch gloomier');
  assert.ok(after[0] + after[1] + after[2] < before[0] + before[1] + before[2], 'and darker');
  assert.equal(worldMood(g, 'Chinatown'), moodFor('Chinatown'), 'elsewhere is unchanged');
  // A finished region line lights Chinatown's lanterns.
  g.quests.rq_chinatown.state = 'done';
  const lit = worldMood(g, 'Chinatown');
  assert.ok(lit !== moodFor('Chinatown'));
});

test('consequences survive a save and reload, without being announced again', () => {
  const g = newGame();
  g.moralChoose('beaten_bandit', 'good');
  g.moralChoose('rival_stall', 'evil');
  g.moralChoose('hawker_change', 'evil');
  run(g, 5);
  saveGame(g);
  const h = new Game();
  h.start();
  h.ui = new Proxy({}, { get: () => () => {} });
  const said = [];
  h.msg = (t) => said.push(t);
  run(h, 6);
  assert.ok(h.npcs.some((n) => n.npcId === 'life_ah_huat'), 'Ah Huat is still at his stall');
  assert.ok(!h.npcs.some((n) => n.npcId === 'life_auntie_kim'), 'Auntie Kim is still gone');
  assert.ok(consequencePriceMult(h, 'hawker') > 1, 'the hawker still charges you more');
  assert.ok(!said.some((t) => CONSEQUENCES.some((c) => c.announce === t)), 'nothing is announced twice');
});

test('every consequence points at a real moral event, quest, shop and resident', () => {
  const questIds = new Set(QUESTS.map((q) => q.id));
  assert.ok(CONSEQUENCES.length >= 10);
  const sources = new Set(CONSEQUENCES.map((c) => c.when.moral || c.when.quest || c.when.choice));
  assert.ok(sources.size >= 6 && sources.size <= 12, '6-12 choices and quest lines matter');
  for (const c of CONSEQUENCES) {
    if (c.when.moral) assert.ok(MORAL_BY_ID[c.when.moral] && ['good', 'evil'].includes(c.when.side), c.id);
    else if (c.when.choice) assert.ok(questChoice(c.when.choice)?.[c.when.side], c.id);
    else assert.ok(questIds.has(c.when.quest), c.id);
    assert.ok(REP_REGIONS.includes(c.region), `${c.id} region`);
    if (c.price) assert.ok(SHOPS[c.price.shop], `${c.id} shop`);
    for (const id of [c.npc, c.leaves].flat().filter(Boolean)) assert.ok(RESIDENTS[id], `${c.id} resident ${id}`);
    assert.ok(c.text && c.announce, c.id);
  }
});

test('region reputation: ranks, gains and losses, discounts and titles', () => {
  const g = newGame();
  g.doTick();
  assert.deepEqual([...REP_REGIONS].sort(), g.world.zones.filter((z) => !z.instance).map((z) => z.name).sort());
  assert.equal(repRank(g, 'Chinatown').id, 'stranger');
  assert.deepEqual(REP_RANKS.slice(1).map((r) => r.name), ['Stranger', 'Known', 'Friend', 'Hero', 'Legend']);
  assert.equal(rankFor(-1).id, 'distrusted');
  // Killing a region's monsters raises it a little.
  const rat = g.npcs.find((n) => n.npcId === 'chicken' && g.world.zoneAt(n.spawnX, n.spawnY)?.name === 'Kampong Glam');
  rat.hp = 0;
  g.killNpc(rat);
  assert.equal(g.rep.points['Kampong Glam'], REP_GAIN.kill);
  // A region quest line raises it a lot.
  g.quests.rq_chinatown.state = 'done';
  run(g, 5);
  assert.equal(g.rep.points.Chinatown, REP_GAIN.regionQuest);
  assert.equal(repRank(g, 'Chinatown').id, 'known');
  assert.equal(g.deeds.quest?.name, QUESTS.find((q) => q.id === 'rq_chinatown').name, 'and townsfolk hear of it');
  // An evil choice there lowers it.
  g.moralChoose('hawker_change', 'evil');
  run(g, 5);
  assert.equal(g.rep.points.Chinatown, REP_GAIN.regionQuest + REP_GAIN.evilChoice);
  // Friend and up: shops there are cheaper.
  addRep(g, 'Kampong Glam', 800);
  assert.equal(repRank(g, 'Kampong Glam').id, 'hero');
  assert.ok(Math.abs(repPriceMult(g, 'Kampong Glam') - 0.9) < 1e-9);
  standNear(g, 63, 59);
  assert.equal(g.currentZoneName, 'Kampong Glam');
  const plain = g.karmaFactor().buy * (1 - g.learning.perks().shop);
  assert.ok(Math.abs(g.priceFactor('general').buy - plain * 0.9) < 1e-9, '10% off at the General Store');
  // Hero: a title to wear, shown over your head while Neutral.
  assert.deepEqual(repTitles(g).map((t) => t.title), ['Hero of Kampong Glam']);
  assert.ok(!setRepTitle(g, 'Chinatown'), 'no title where you are not a Hero');
  assert.ok(setRepTitle(g, 'Kampong Glam'));
  assert.equal(repTitleText(g), 'Hero of Kampong Glam');
  g.karma = { good: 0, evil: 0 };
  assert.equal(g.alignmentStyle().label, 'Hero of Kampong Glam');
  // Legend at the top; the meter is capped and floored.
  addRep(g, 'Kampong Glam', 1e6);
  assert.equal(repRank(g, 'Kampong Glam').id, 'legend');
  addRep(g, 'Pulau Hantu', -1e6);
  assert.equal(repRank(g, 'Pulau Hantu').id, 'distrusted');
  assert.ok(repPriceMult(g, 'Pulau Hantu') > 1, 'the Distrusted pay more');
});

test('a world event won and a bounty finished raise the region; a boss kill too', () => {
  const g = newGame();
  g.doTick();
  const we = g.worldEvents;
  we.active = { name: 'Test Invasion', place: 'Arab Street', region: 'Kampong Glam' };
  run(g, 5);
  we.active = null; we.done = (we.done || 0) + 1;
  run(g, 5);
  assert.equal(g.rep.points['Kampong Glam'], REP_GAIN.worldEvent);
  assert.equal(g.deeds.event?.name, 'Arab Street');
  const boss = g.npcs.find((n) => n.npcId === 'boar_king');
  const region = g.world.zoneAt(boss.spawnX, boss.spawnY).name;
  const before = g.rep.points[region] || 0;
  boss.hp = 0;
  g.killNpc(boss);
  assert.equal(g.rep.points[region], before + REP_GAIN.boss);
});

test('reputation, title and deeds round-trip through a save; old saves get credit once', () => {
  const g = newGame();
  g.doTick();
  addRep(g, 'Chinatown', 900);
  setRepTitle(g, 'Chinatown');
  const boss = g.npcs.find((n) => n.npcId === 'goblin_warchief');
  boss.hp = 0;
  g.killNpc(boss);
  saveGame(g);
  const h = new Game();
  h.start();
  assert.equal(h.rep.points.Chinatown, 900);
  assert.equal(h.rep.title, 'Chinatown');
  assert.equal(h.deeds.boss?.name, 'Goblin Warchief');
  // A save from before reputation existed: credit for finished region lines, once.
  const old = new Game();
  old.start();
  old.rep = { points: {}, title: null, seeded: false };
  old.quests.rq_kampong_glam.state = 'done';
  old._life = null;
  old.ui = new Proxy({}, { get: () => () => {} });
  run(old, 6);
  assert.equal(old.rep.points['Kampong Glam'], REP_GAIN.regionQuest, 'credited once');
  run(old, 10);
  assert.equal(old.rep.points['Kampong Glam'], REP_GAIN.regionQuest, 'and not again');
});

test('the Regions journal view renders headlessly', () => {
  const g = newGame();
  g.doTick();
  addRep(g, 'Kampong Glam', 750);
  g.moralChoose('hawker_change', 'good');
  run(g, 5);
  const html = regionsPanelHTML(g);
  for (const r of REP_REGIONS) assert.ok(html.includes(r.replace(/&/g, '&amp;')), r);
  assert.ok(html.includes('Hero') && html.includes('rep-title-btn'), 'a Hero can wear a title');
  assert.ok(html.includes('10% off her food'), 'what your choices changed is listed');
  assert.ok(html.includes('assets/fx/badge-kampong_glam.webp'), 'with the region badge');
});
