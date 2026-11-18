// The Collection log (src/game/collection.js), pets (src/game/pets.js) and the
// Endless Gate's per-class bests and modifiers (src/game/waves.js). Headless,
// deterministic game scenarios.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { saveGame, clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { ALL_BOSS_IDS, getNpc } from '../src/data/npcs.js';
import { PAGES, PAGE_BY_ID, RARE_FINDS } from '../src/game/collection.js';
import { BOSS_PETS, SKILL_PETS, PET_BY_ID, LIFE_SKILL_IDS, bossPetChance, skillPetChance, rollPet, BOSS_PET_RATE, BOSS_PET_FLOOR, SKILL_PET_RATE } from '../src/game/pets.js';
import { GATE, NEXT_WAVE_TICKS, GATE_MODS, modEffects, waveBonus, wavePlan } from '../src/game/waves.js';
import { collectionPageHTML, petsHTML } from '../src/ui/collectionui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(storage = fakeStorage()) {
  globalThis.localStorage = storage;
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.ui = new Proxy({}, { get: () => () => {} });
  return game;
}
const step = (game, ticks) => { for (let i = 0; i < ticks; i++) game.update(600); };
function placeAt(game, x, y) {
  const p = game.player;
  p.stopNow(); p.clearAction();
  p.x = p.tx = x; p.y = p.ty = y; p.progress = 0; p.moving = false; p.path = [];
}
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// A tiny seeded generator for the rate checks (Math.random is seeded too, but
// this keeps millions of rolls independent of anything else the test does).
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

test('the log has a page for every boss and every other source, built from the loot tables', () => {
  for (const id of ALL_BOSS_IDS) {
    const d = getNpc(id);
    if (!d.attackable || !d.boss) continue;
    const p = PAGE_BY_ID[`boss:${id}`];
    assert.ok(p, `${id} has a page`);
    assert.ok(p.entries.some((e) => e.kind === 'pet' && e.id === BOSS_PETS[id].id), `${id}'s page lists its pet`);
    assert.ok(p.entries.filter((e) => e.kind === 'item').length >= 3, `${id}'s page lists its uniques`);
  }
  for (const id of ['champions', 'slayer', 'clue:easy', 'clue:medium', 'clue:hard', 'gate', 'finds', 'pets']) assert.ok(PAGE_BY_ID[id], `${id} page`);
  for (const p of PAGES) {
    assert.ok(p.title && p.entries.length, `${p.id} has a title and entries`);
    for (const e of p.entries) assert.ok(e.kind === 'pet' ? PET_BY_ID[e.id] : ITEMS[e.id], `${p.id}: ${e.id} is real`);
    assert.ok(!p.entries.some((e) => e.id === 'coins'), `${p.id}: coins aren't collectables`);
  }
  // Clue pages follow their reward tables; rare finds follow the skills' tables.
  assert.ok(PAGE_BY_ID['clue:hard'].entries.some((e) => e.id === 'dragon_scimitar'));
  assert.deepEqual(RARE_FINDS.mining, ['sapphire', 'emerald', 'ruby', 'diamond']);
  assert.ok(RARE_FINDS.woodcutting.includes('birds_nest'));
  // Every life skill has a pet, drawn with a real creature's art.
  assert.ok(LIFE_SKILL_IDS.includes('mining') && LIFE_SKILL_IDS.includes('fishing') && !LIFE_SKILL_IDS.includes('attack'));
  for (const sk of LIFE_SKILL_IDS) assert.ok(getNpc(SKILL_PETS[sk].npcId), `${sk} pet has a creature`);
});

test('a boss drop is ticked off on its page, with a count, when it really drops', () => {
  const g = newGame();
  const boss = new NPC('timah_drake', 60, 60, 0);
  assert.ok(PAGE_BY_ID['boss:timah_drake'].entries.some((e) => e.id === 'dragon_bones'));
  boss.def = { ...boss.def, dropTable: [{ id: 'dragon_bones', weight: 1 }] };
  g.rollDrops(boss);
  const n = g.collection.log['boss:timah_drake']?.dragon_bones || 0;
  assert.ok(n >= 10, `ten table rolls of dragon bones recorded (${n})`);
  assert.equal(g.collection.count('boss:timah_drake', { kind: 'item', id: 'dragon_bones' }), n);
  // Off-page loot and other sources' pages are left alone.
  assert.ok(!g.collection.log['boss:timah_drake'].upgrade_stone, 'stones are not this page\'s');
  assert.ok(!g.collection.log['boss:boar_king'], 'another boss\'s page is untouched');
  // Recording straight to a page only takes what's on it.
  assert.equal(g.collection.record('clue:easy', 'coins', 50), false);
  assert.equal(g.collection.record('clue:easy', 'sapphire', 1), true);
  assert.equal(g.collection.record('clue:easy', 'sapphire', 1), false, 'only the first is new');
  assert.equal(g.collection.log['clue:easy'].sapphire, 2);
});

test('casket loot, slayer rewards and life-skill rare finds land on their pages', () => {
  const g = newGame();
  // Caskets: every non-coin prize is logged on its tier's page.
  for (let i = 0; i < 12; i++) { g.inventory.add('reward_casket_easy', 1); g.openCasket(g.inventory.slots.findIndex((s) => s?.id === 'reward_casket_easy')); }
  const easy = g.collection.log['clue:easy'] || {};
  assert.ok(Object.keys(easy).length > 0, 'twelve easy caskets logged something');
  for (const id of Object.keys(easy)) assert.ok(PAGE_BY_ID['clue:easy'].entries.some((e) => e.id === id));
  // Slayer: a redeemed helmet.
  g.slayer.points = 999;
  g.buySlayerReward('slayer_helmet');
  assert.equal(g.collection.log.slayer?.slayer_helmet, 1);
  // Rare finds count only from the skill whose table they're on.
  g.collection.onGather('mine', 'ruby', 1);
  g.collection.onGather('woodcut', 'ruby', 1);
  assert.equal(g.collection.log.finds.ruby, 1);
  // ...through the real gathering step: a bird's nest falling while chopping.
  const tree = g.world.objects.find((o) => o.def.type === 'tree' && !o.depleted);
  const spot = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => ({ x: tree.x + dx, y: tree.y + dy })).find((t) => !g.world.isBlocked(t.x, t.y));
  placeAt(g, spot.x, spot.y);
  g._tickContinuous({ type: 'woodcut', obj: tree }, tree, () => { g.inventory.add('birds_nest', 1); return false; });
  assert.equal(g.collection.log.finds.birds_nest, 1);
});

test('completing a page grants its title, wearable over your name, and the Collector award', () => {
  const g = newGame();
  const page = PAGE_BY_ID['clue:medium'];
  for (const e of page.entries.slice(0, -1)) g.collection.record(page.id, e.id, 1);
  assert.ok(!g.collection.done.has(page.id), 'not complete with one to go');
  assert.equal(g.collection.titleText(), null);
  g.collection.record(page.id, page.entries[page.entries.length - 1].id, 1);
  assert.ok(g.collection.isComplete(page.id));
  assert.ok(g.collection.done.has(page.id), 'complete');
  assert.equal(g.collection.titleText(), page.title, 'the first title is worn straight away');
  g.checkAchievements(true);
  assert.ok(g.achievements.has('col_page'), 'Collector unlocked');
  assert.deepEqual(g.collection.titles().map((t) => t.id), [page.id]);
  assert.equal(g.collection.setTitle('clue:hard'), false, 'an unearned title can\'t be worn');
  assert.ok(g.collection.setTitle(null));
  assert.equal(g.collection.titleText(), null);
  // The page renders headless, collected entries named, the rest hidden.
  const html = collectionPageHTML(g, page.id);
  assert.match(html, /class="cl-cell got/);
  assert.match(html, new RegExp(page.title));
  const other = collectionPageHTML(g, 'clue:hard');
  assert.ok(!/cl-cell got/.test(other) && /\?\?\?/.test(other), 'an unseen page is all silhouettes');
});

test('pet odds: about 1 in 3,000 a boss kill (better with kills), 1 in SKILL_PET_RATE an action', () => {
  assert.equal(bossPetChance(0), 1 / BOSS_PET_RATE);
  assert.ok(bossPetChance(500) > bossPetChance(0), 'more kills, better odds');
  assert.equal(bossPetChance(1e6), 1 / BOSS_PET_FLOOR, 'never better than the floor');
  assert.equal(skillPetChance(), 1 / SKILL_PET_RATE);
  const r = lcg(12345), N = 3_000_000;
  let hits = 0;
  for (let i = 0; i < N; i++) if (rollPet(bossPetChance(0), r)) hits++;
  assert.ok(Math.abs(hits - N / BOSS_PET_RATE) < 0.1 * N / BOSS_PET_RATE, `boss: ${hits} in ${N}`);
  hits = 0;
  for (let i = 0; i < N; i++) if (rollPet(skillPetChance(), r)) hits++;
  assert.ok(Math.abs(hits - N / SKILL_PET_RATE) < 0.25 * N / SKILL_PET_RATE, `skill: ${hits} in ${N}`);
});

test('a lucky boss kill or life-skill action brings a pet, logged and following you', () => {
  const g = newGame();
  g.pets.rand = () => 1;   // never
  g.pets.onKill(new NPC('boar_king', 60, 60, 0));
  g.skills.addXp('mining', 50);
  assert.deepEqual(g.pets.owned, {});
  g.pets.rand = () => 0;   // always
  assert.ok(g.pets.onKill(new NPC('boar_king', 60, 60, 0)));
  assert.equal(g.pets.owned.pet_boar_king, 1);
  assert.equal(g.pets.active, 'pet_boar_king', 'it follows you at once');
  assert.ok(g.collection.has('pets', { kind: 'pet', id: 'pet_boar_king' }), 'in the Pets page');
  assert.ok(g.collection.has('boss:boar_king', { kind: 'pet', id: 'pet_boar_king' }), 'and on its boss\'s page');
  assert.ok(!g.pets.onKill(new NPC('goblin', 60, 60, 0)), 'ordinary monsters have no pet');
  g.skills.addXp('attack', 50);
  assert.ok(!g.pets.owned.pet_attack, 'combat skills have none');
  step(g, 1);   // one roll a tick: the unlucky mining XP above already rolled this tick
  g.skills.addXp('mining', 50);
  assert.equal(g.pets.owned.pet_mining, 1, 'a life skill\'s pet');
  assert.equal(g.pets.active, 'pet_boar_king', 'one follower at a time: the first stays');
  g.skills.addXp('mining', 50);   // same tick: no second roll
  assert.equal(g.pets.owned.pet_mining, 1);
  g.checkAchievements(true);
  assert.ok(g.achievements.has('pet_first'));
  assert.match(petsHTML(g), /Dismiss/);
});

test('the pet trails a step behind as you walk, and catches up after a teleport', () => {
  const g = newGame();
  g.pets.owned.pet_fishing = 1;
  const p = g.player;
  // Find a clear straight run of ground to walk along.
  let row = null;
  for (let y = 40; y < 90 && !row; y++) for (let x = 40; x < 90 && !row; x++) {
    let ok = true;
    for (let k = -1; k <= 10 && ok; k++) for (let dy = -1; dy <= 1; dy++) if (g.world.isBlocked(x + k, y + dy)) ok = false;
    if (ok) row = { x, y };
  }
  assert.ok(row, 'open ground');
  placeAt(g, row.x, row.y);
  assert.ok(g.pets.summon('pet_fishing'));
  const f = g.pets.follower;
  assert.ok(f && cheb(f, p) === 1 && !g.world.isBlocked(f.x, f.y), 'it appears beside you');
  for (let i = 1; i <= 8; i++) {
    placeAt(g, row.x + i, row.y);
    step(g, 1);
    const ff = g.pets.follower;
    assert.ok(cheb(ff, p) <= 1 && !(ff.x === p.x && ff.y === p.y), `step ${i}: right behind, never on top of you`);
  }
  assert.deepEqual({ x: g.pets.follower.x, y: g.pets.follower.y }, { x: row.x + 7, y: row.y }, 'in the tile you just left');
  // A long jump (the MRT, a teleport): it pops back beside you.
  placeAt(g, GATE.x - 1, GATE.y + 1);
  step(g, 1);
  assert.ok(cheb(g.pets.follower, p) <= 1, 'caught up');
  g.pets.dismiss();
  step(g, 1);
  assert.equal(g.pets.follower, null, 'dismissed');
  assert.equal(g.pets.summon('pet_mining'), false, 'only a pet you own');
});

test('the log, titles, pets and gate records save and load (and older saves start empty)', () => {
  const storage = fakeStorage();
  const g = newGame(storage);
  const page = PAGE_BY_ID['clue:easy'];
  for (const e of page.entries) g.collection.record(page.id, e.id, 2);
  g.pets.rand = () => 0;
  g.pets.onKill(new NPC('boar_king', 60, 60, 0));
  g.waves.bestByClass = { [g.jobClass]: 7, archer: 3 };
  g.waves.toggleMod('fasting');
  assert.notEqual(saveGame(g), false);
  const h = new Game();
  h.start();
  assert.equal(h.collection.log['clue:easy'].sapphire, 2);
  assert.ok(h.collection.done.has('clue:easy'));
  assert.equal(h.collection.titleText(), page.title);
  assert.equal(h.pets.owned.pet_boar_king, 1);
  assert.equal(h.pets.active, 'pet_boar_king');
  assert.equal(h.waves.classBest(g.jobClass), 7);
  assert.equal(h.waves.classBest('archer'), 3);
  assert.ok(h.waves.mods.has('fasting'));
  // An older save (none of these fields) loads with everything empty.
  const fresh = newGame();
  assert.deepEqual(fresh.collection.log, {});
  assert.deepEqual(fresh.pets.owned, {});
  assert.equal(fresh.waves.classBest(), 0);
  assert.equal(fresh.waves.mods.size, 0);
});

test('the gate keeps a best wave per class', () => {
  const g = newGame();
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  step(g, NEXT_WAVE_TICKS + 1);
  for (const n of g.npcs.filter((m) => m.wave && m.alive)) g.killNpc(n);
  step(g, NEXT_WAVE_TICKS + 3);
  assert.equal(g.waves.wave, 2);
  assert.equal(g.waves.classBest(), 2);
  assert.equal(g.waves.classBest('some_other_class'), 0, 'other classes keep their own');
  g.waves.leave();
});

test('gate modifiers stack their risk and reward', () => {
  const fx = modEffects(['swift', 'fasting', 'elite']);
  assert.deepEqual({ speed: fx.speed, loot: fx.loot, xp: fx.xp, rolls: fx.rolls, noFood: fx.noFood }, { speed: 1.5, loot: 2, xp: 1.75, rolls: 1, noFood: true });
  assert.equal(modEffects([]).xp, 1);

  const g = newGame();
  const xp0 = g.combatXpMult();
  for (const id of Object.keys(GATE_MODS)) assert.ok(g.waves.toggleMod(id));
  placeAt(g, GATE.x - 1, GATE.y + 1);
  g.waves.enter();
  assert.equal(g.waves.toggleMod('swift'), false, 'locked in once the run starts');
  // Fasting: no food, more XP.
  assert.ok(Math.abs(g.combatXpMult() / xp0 - 1.75) < 1e-9);
  g.inventory.add('trout', 3);
  g.player.hp = 5;
  g.eatItem(g.inventory.slots.findIndex((s) => s?.id === 'trout'));
  assert.equal(g.inventory.count('trout'), 3, 'the trout stays uneaten');
  assert.equal(g.player.hp, 5);
  g.player.hp = g.maxHp();
  // Swift and elite: quicker, tougher monsters.
  const plan = wavePlan(1, g.fightLevel());
  step(g, NEXT_WAVE_TICKS + 1);
  const mobs = g.npcs.filter((n) => n.wave && n.alive);
  assert.ok(mobs.length > 0);
  for (const n of mobs) {
    assert.ok(Math.abs(n.stepMul - 1.8 / 1.5) < 1e-9, 'moves 50% faster');
    const e = plan.find((x) => x.id === n.npcId && !x.champion);
    assert.equal(n.maxHp, Math.round(e.def.maxHp * 1.5), 'half as much life again');
  }
  // Clearing the wave: the bonus doubled, plus a cache prize, all logged.
  for (const n of mobs) n.def = { ...n.def, maxHit: 0 };
  const coins0 = g.inventory.count('coins');
  const L = g.waves.level;
  g.npcs = g.npcs.filter((n) => !n.wave);
  g.waves.mobs = []; g.waves.queue = [];
  g.waves._cleared();
  assert.equal(g.inventory.count('coins') - coins0, waveBonus(1, L)[0][1] * 2, 'Swift foes doubles the bonus');
  const gate = g.collection.log.gate || {};
  assert.equal(Object.values(gate).reduce((s, n) => s + n, 0) > 0, true, 'the extra reward roll is in the log');
  g.waves.leave();
  assert.equal(g.combatXpMult(), xp0, 'XP back to normal outside');
  g.eatItem(g.inventory.slots.findIndex((s) => s?.id === 'trout'));
  assert.equal(g.inventory.count('trout'), 2, 'and food works again');
});
