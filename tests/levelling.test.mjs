// Life-skill levelling: XP past 99, Agility laps and Marks of grace, Thieving,
// tiers that must out-earn the ones below them, and feeding gear mastery.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { OBJECTS } from '../src/data/objects.js';
import { xpForLevel, pastCapXpMult } from '../src/data/xp.js';
import { XP_RATE } from '../src/config.js';
import { chebyshev } from '../src/core/utils.js';
import { feedPoints, FEED_CAP } from '../src/game/materials.js';

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
  g.npcs = [];   // nothing to interrupt the work
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
function standBy(g, obj) {
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
const gained = (g, skill, fn) => { const x0 = g.skills.xp[skill]; fn(); return g.skills.xp[skill] - x0; };

test('life skills earn 1 + (L-99)/150 more XP past 99; combat skills, Prayer, Slayer and Agility do not', () => {
  const g = newGame();
  assert.equal(pastCapXpMult(50), 1);
  assert.equal(pastCapXpMult(99), 1);
  assert.equal(pastCapXpMult(249), 2);
  for (const s of ['mining', 'woodcutting', 'fishing', 'cooking', 'smithing', 'crafting', 'firemaking', 'fletching',
    'herblore', 'hunter', 'farming', 'thieving']) {
    setLevel(g, s, 50);
    assert.equal(gained(g, s, () => g.skills.addXp(s, 10)), 10 * XP_RATE, `${s} at 50`);
    setLevel(g, s, 249);
    assert.equal(gained(g, s, () => g.skills.addXp(s, 10)), 10 * XP_RATE * 2, `${s} at 249`);
  }
  for (const s of ['attack', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer', 'slayer', 'agility']) {
    setLevel(g, s, 249);
    assert.equal(gained(g, s, () => g.skills.addXp(s, 10)), 10 * XP_RATE, `${s} keeps its pace`);
  }
  // So a level past 99 takes about as long as 98->99 at the same activity.
  const lvlCost = (L) => xpForLevel(L + 1) - xpForLevel(L);
  const at99 = lvlCost(98), at1000 = lvlCost(1000) / pastCapXpMult(1000);
  assert.ok(Math.abs(at1000 / at99 - 1) < 0.02, `level 1000 costs ${at1000} in level-99 XP vs ${at99}`);
});

test('agility: a course obstacle waits for the rest of the lap, and a full lap pays a bonus and a mark', () => {
  const g = newGame();
  setLevel(g, 'agility', 50);
  const find = (id) => g.world.objects.find((o) => o.objId === id);
  const beam = find('agility_balance');
  assert.ok(gained(g, 'agility', () => g.resolveAgility(beam)) > 0, 'the first crossing pays');
  assert.equal(gained(g, 'agility', () => g.resolveAgility(beam)), 0, 'not again until the lap is done');
  for (const id of ['agility_net', 'agility_rope', 'agility_ledge']) g.resolveAgility(find(id));
  g.inventory.remove('mark_of_grace', g.inventory.count('mark_of_grace'));
  const scale = g.agilityXpScale(g.skills.level('agility'));
  const zip = gained(g, 'agility', () => g.resolveAgility(find('agility_zip')));
  assert.ok(Math.abs(zip - 60 * scale * XP_RATE - Math.round(60 * 0.6 * scale) * XP_RATE) < 1, 'the zip-line plus the lap bonus');
  assert.ok(g.inventory.has('mark_of_grace'), 'a full lap always finds a mark');
  assert.ok(gained(g, 'agility', () => g.resolveAgility(beam)) > 0, 'a new lap: the beam pays again');
  // Below the zip-line's level the lap is just the obstacles you can use, with no bonus.
  const low = newGame();
  setLevel(low, 'agility', 1);
  const lb = low.world.objects.find((o) => o.objId === 'agility_balance');
  for (let i = 0; i < 20; i++) low.resolveAgility(lb);
  assert.ok(low.inventory.count('mark_of_grace') < 5, 'no guaranteed mark for a one-obstacle "lap"');
});

test('agility: a lap run in the world walks from obstacle to obstacle, and 9999 is no longer hours away', () => {
  const g = newGame();
  setLevel(g, 'agility', 99);
  g.toggleAutoGather(true);
  const beam = g.world.objects.find((o) => o.objId === 'agility_balance');
  standBy(g, beam);
  g.defaultObjectAction(beam);
  const base = g.skills.xp.agility;
  let gain = 0;
  const T = 600;
  for (let i = 0; i < T; i++) { g.update(600); gain += g.skills.xp.agility - base; g.skills.xp.agility = base; g.runEnergy = 100; }
  const marks = g.inventory.count('mark_of_grace');
  assert.ok(marks >= 10, `laps keep going with auto gather on (${marks} marks)`);
  const perHour = gain * 6000 / T + marks * g.markOfGraceXp() * XP_RATE * 6000 / T;
  // From 99 every level takes about the same time, so 99 -> 9999 is ~9900 level-99 levels.
  const hours = 9900 * (xpForLevel(99) - xpForLevel(98)) / perHour;
  assert.ok(hours > 30, `Agility 99 -> 9999 takes ${hours.toFixed(1)} h (it was ~15 h)`);
});

test('thieving: pickpocket XP stops growing past 99; stalls out-earn pickpocketing at their levels', () => {
  const g = newGame();
  const npc = { def: { role: 'townsfolk' }, name: 'Uncle' };
  for (const [lvl, base] of [[50, 58], [99, 107], [1000, 107]]) {
    setLevel(g, 'thieving', lvl);
    assert.ok(Math.abs(gained(g, 'thieving', () => g.pickpocket(npc)) - base * XP_RATE * pastCapXpMult(lvl)) < 0.01, `level ${lvl}`);
  }
  // A stall restocks every few ticks and can fail; even so, ten levels past
  // its unlock it pays more a tick than a pocket picked every tick.
  for (const id of ['stall_food', 'stall_market', 'stall_gem']) {
    const t = newGame(), L = OBJECTS[id].level + 10;
    setLevel(t, 'thieving', L);
    const stall = t.world.objects.find((o) => o.objId === id);
    standBy(t, stall);
    const base = t.skills.xp.thieving, T = 600;
    let gain = 0;
    for (let i = 0; i < T; i++) {
      t.player.hp = 1e6;
      if (!t.player.action && !t.player.isMoving && !t.playerStun) t.defaultObjectAction(stall);   // caught: try again
      t.update(600);
      gain += t.skills.xp.thieving - base; t.skills.xp.thieving = base;
    }
    const perTick = gain / T / XP_RATE;
    assert.ok(perTick > 8 + L, `${id}: ${perTick.toFixed(1)} xp a tick vs ${8 + L} pickpocketing`);
  }
});

test('thieving: a stall keeps you stealing as it restocks', () => {
  const g = newGame();
  setLevel(g, 'thieving', 99);
  g.player.hp = 1e6;
  const stall = g.world.objects.find((o) => o.objId === 'stall_food');
  standBy(g, stall);
  g.defaultObjectAction(stall);
  const x0 = g.skills.xp.thieving;
  for (let i = 0; i < 60; i++) { g.player.hp = 1e6; g.update(600); }
  const steals = (g.skills.xp.thieving - x0) / (OBJECTS.stall_food.xp * XP_RATE);
  assert.ok(steals >= 5, `one click, ${steals} steals`);
});

// Mean XP a cast at a fishing spot at a level (catch rolls are weighted).
function castXp(spot, lvl) {
  const el = OBJECTS[spot].catches.filter((c) => lvl >= c.level);
  return el.reduce((a, c) => a + c.weight * c.xp, 0) / el.reduce((a, c) => a + c.weight, 0);
}

test('fishing: the cage and harpoon spots beat the coastal rod spot, and sharks and manta rays pay', () => {
  for (let L = 40; L <= 99; L++) {
    assert.ok(castXp('fishing_cage', L) > castXp('sea_rod_spot', L), `cage at ${L}`);
    assert.ok(castXp('harpoon_spot', L) > castXp('sea_rod_spot', L), `harpoon at ${L}`);
  }
  assert.ok(castXp('harpoon_spot', 35) > castXp('sea_rod_spot', 35), 'harpoon from its unlock');
  assert.ok(castXp('harpoon_spot', 76) > castXp('harpoon_spot', 75), 'sharks raise it');
  assert.ok(castXp('harpoon_spot', 84) > castXp('harpoon_spot', 83), 'manta rays raise it');
  assert.ok(castXp('harpoon_spot', 76) > castXp('fishing_cage', 76), 'top of the ladder by 76');
});

// XP an hour from auto gather at the densest cluster of `id`, XP pinned at `lvl`.
function gatherRate(skill, id, lvl, ticks) {
  const g = newGame();
  for (const t of ['bronze_pickaxe', 'hunting_snare']) if (!g.inventory.has(t)) g.inventory.add(t, 1);
  setLevel(g, skill, lvl);
  const all = g.world.objects.filter((o) => o.objId === id);
  const near = (o) => all.filter((p) => chebyshev(p.x, p.y, o.x, o.y) <= 15).length;
  const start = all.reduce((a, b) => (near(b) > near(a) ? b : a));
  standBy(g, start);
  g.toggleAutoGather(true);
  g.defaultObjectAction(start);
  const base = g.skills.xp[skill];
  let gain = 0;
  for (let i = 0; i < ticks; i++) {
    g.update(600);
    gain += g.skills.xp[skill] - base; g.skills.xp[skill] = base;
    // An endless bag: keep only one of anything gathered.
    for (const sl of g.inventory.slots) if (sl && sl.qty > 20 && sl.id !== 'coins') g.inventory.remove(sl.id, sl.qty - 1);
  }
  return gain * 6000 / ticks;
}

test('mining: granite < mithril < adamantite < runite < obsidian, an hour at level 99/100', () => {
  const ladder = [['granite_rock', 99], ['mithril_rock', 99], ['adamantite_rock', 99], ['runite_rock', 99], ['obsidian_vein', 100]];
  let prev = 0;
  for (const [id, lvl] of ladder) {
    const r = gatherRate('mining', id, lvl, 600) / pastCapXpMult(lvl);
    assert.ok(r > prev * 1.02, `${id}: ${Math.round(r)} xp/h vs ${Math.round(prev)} below it`);
    prev = r;
  }
});

test('hunter: crocodile < hornbill < qilin an hour', () => {
  let prev = 0;
  for (const id of ['crocodile_trap', 'hornbill_nest', 'qilin_trail']) {
    const r = gatherRate('hunter', id, 200, 3000);
    assert.ok(r > prev * 1.05, `${id}: ${Math.round(r)} xp/h vs ${Math.round(prev)} below it`);
    prev = r;
  }
});

test('feeding mastery has diminishing returns on value: endgame bars no longer reach Master in a handful', () => {
  assert.equal(feedPoints('rune_scimitar', 'eternal_bar'), 113);
  assert.ok(FEED_CAP / feedPoints('rune_scimitar', 'eternal_bar') > 50, 'Master takes dozens of eternal bars, not three');
  assert.ok(feedPoints('rune_scimitar', 'rune_bar') > feedPoints('rune_scimitar', 'adamant_bar'), 'a better bar is still worth more');
  assert.ok(feedPoints('rune_scimitar', 'eternal_bar') > feedPoints('rune_scimitar', 'rune_bar'));
});
