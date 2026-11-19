// Culling (src/game/culling.js, src/ui/cullingui.js): codex mastery per
// species, Pest Control contracts and their token shop, Stewardship while
// Neutral, and the Hunter trickle from culling harmless creatures.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave, saveGame, loadGame, snapshot } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { getNpc, ALL_MONSTER_IDS } from '../src/data/npcs.js';
import { getItem } from '../src/data/items.js';
import { raceOf } from '../src/data/races.js';
import { xpForLevel } from '../src/data/xp.js';
import { chebyshev } from '../src/core/utils.js';
import { findPath } from '../src/engine/pathfinding.js';
import { maxHitNow, damageMult, statSheet } from '../src/game/statsheet.js';
import { codexEntryHTML, codexRowHTML, codexProgressHTML } from '../src/ui/codexui.js';
import { contractsHTML, stewardHTML, stewardLineHTML, contractTrackerRows } from '../src/ui/cullingui.js';
import * as C from '../src/game/culling.js';
import { dayKey } from '../src/game/bounty.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(cls = 'swordsman') {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
const listen = (g) => { const said = []; g.bus.on('chat', (p) => said.push(p.text)); return said; };
/** A harmless creature right beside the player, with `hp` life. */
function harmless(g, id = 'rat', hp = 1) {
  const n = g.spawnNpc(id, g.player.x + 1, g.player.y, { wander: 0 });
  n.hp = n.maxHp = hp;
  return n;
}
// The real day: hunting a contract reads today's board (dayKey), so a fixed date
// here broke this file the day after it was written.
const TODAY = dayKey();
const TOMORROW = dayKey(new Date(Date.now() + 86400000));

// ---------------- Codex mastery ----------------
test('mastery tiers come at 20, 200 and 2,000 kills, and a quill adds to the count', () => {
  assert.deepEqual(C.MASTERY_TIERS.map((t) => t.kills), [20, 200, 2000]);
  assert.equal(C.tierFor(0), 0); assert.equal(C.tierFor(19), 0); assert.equal(C.tierFor(20), 1);
  assert.equal(C.tierFor(199), 1); assert.equal(C.tierFor(200), 2); assert.equal(C.tierFor(2000), 3);
  const game = { kills: { rat: 15 }, culling: { ...C.defaultCulling(), extra: { rat: 5 } } };
  const m = C.masteryOf(game, 'rat');
  assert.equal(m.count, 20); assert.equal(m.tier, 1);
  assert.equal(m.dmg, 0.02); assert.equal(m.loot, 0.05); assert.equal(m.race, 0); assert.equal(m.title, null);
  game.kills.rat = 2000;
  assert.equal(C.masteryOf(game, 'rat').title, 'Rat Catcher');
  assert.equal(C.titleFor('young_rat'), 'Rat Catcher', 'variants share their species title');
  assert.equal(C.titleFor('mud_crab'), 'Mud crab Netter');
});

test('race mastery comes from tier 2 and 3 species of that race, capped at +10%', () => {
  const reptiles = ALL_MONSTER_IDS.filter((id) => raceOf(getNpc(id), id) === 'reptile' && getNpc(id).attackable);
  assert.ok(reptiles.length > 12);
  const game = { kills: {}, culling: C.defaultCulling() };
  game.kills[reptiles[0]] = 199;
  assert.equal(C.raceMastery(game, 'reptile'), 0, 'tier 1 gives no race bonus');
  game.kills[reptiles[0]] = 200;
  assert.equal(C.raceMastery(game, 'reptile'), 0.01);
  game.kills[reptiles[1]] = 2000;
  assert.equal(C.raceMastery(game, 'reptile'), 0.03);
  assert.equal(C.raceMastery(game, 'beast'), 0, 'only its own race');
  for (const id of reptiles) game.kills[id] = 5000;
  assert.equal(C.raceMastery(game, 'reptile'), C.RACE_MASTERY_CAP, 'capped');
  const d = C.masteryDamage(game, { npcId: reptiles[2], def: getNpc(reptiles[2]) });
  assert.equal(d.species, 0.05); assert.equal(d.race, 0.10);
  assert.ok(Math.abs(d.mult - 1.05 * 1.10) < 1e-12);
});

test('the Stats tab includes codex mastery, and matches a real attack with it', () => {
  const g = newGame('swordsman');
  const npc = g.npcs.find((n) => n.alive && n.attackable && !n.ally && !n.def.boss && !n.champion);
  npc.hp = npc.maxHp = 1e9;
  const plain = maxHitNow(g, { npc }).max;
  // Tier 2 on this species, and two more of its race at tier 3 (+1% +2% +2% race).
  const race = raceOf(npc.def, npc.npcId);
  const kin = ALL_MONSTER_IDS.filter((id) => id !== npc.npcId && raceOf(getNpc(id), id) === race).slice(0, 2);
  g.kills[npc.npcId] = 250; for (const id of kin) g.kills[id] = 2500;
  const { m, parts } = damageMult(g, g.combatMode(), { npc });
  assert.ok(parts.some(([l, v]) => l === 'Codex mastery (species)' && v === '×1.04'), JSON.stringify(parts));
  assert.ok(parts.some(([l, v]) => l === 'Codex mastery (race)' && v === '×1.05'), JSON.stringify(parts));
  const want = maxHitNow(g, { npc });
  assert.ok(want.max > plain, `mastery raises the max hit (${plain} -> ${want.max})`);
  // A real attack with every roll at its top lands exactly the sheet's max hit.
  const pre = [];
  const crit = g._critHit;
  g._critHit = function (dmg, critCh) { pre.push(dmg); return crit.call(this, dmg, critCh); };
  const rnd = Math.random;
  Math.random = () => 0.9999999;
  try { g.doPlayerAttack(npc); } finally { Math.random = rnd; delete g._critHit; }
  assert.ok(pre.length >= 1, 'the attack landed');
  assert.equal(pre[0], want.max, 'real attack = Stats tab max hit');
  assert.ok(m > 1);
  // And the utility section lists mastery.
  const util = statSheet(g).sections.find((s) => s.id === 'utility').rows;
  assert.ok(util.some((r) => r.id === 'mastery' && r.text === '3 species'));
});

test('a kill that reaches a tier says so, and a mastered species sometimes drops a second helping', () => {
  const g = newGame();
  const said = listen(g);
  g.kills.rat = 19;
  g.killNpc(harmless(g));
  assert.equal(g.kills.rat, 20);
  assert.ok(said.some((s) => /Codex mastery: Bronze for Rat/.test(s)), said.join('\n'));
  // Loot bonus: over many kills at tier 2 (+10%), about one in ten rolls twice.
  g.kills.rat = 300;
  let rolls = 0;
  const roll = g.rollDrops.bind(g);
  g.rollDrops = (n, ...a) => { rolls++; return roll(n, ...a); };
  for (let i = 0; i < 400; i++) g.killNpc(harmless(g));
  assert.ok(rolls > 400 + 15 && rolls < 400 + 80, `${rolls - 400} extra loot rolls in 400 kills`);
});

test('a Codex quill makes the next kills count double towards mastery', () => {
  const g = newGame();
  g.inventory.add('codex_quill', 1);
  assert.ok(C.readQuill(g, g.inventory.slots.findIndex((s) => s?.id === 'codex_quill')));
  assert.equal(g.culling.quill, C.QUILL_KILLS);
  g.killNpc(harmless(g));
  assert.equal(g.kills.rat, 1);
  assert.equal(C.masteryCount(g, 'rat'), 2);
  assert.equal(g.culling.quill, C.QUILL_KILLS - 1);
});

test('tier-3 titles can be worn, and show over a Neutral hero', () => {
  const g = newGame();
  assert.equal(C.setTitle(g, 'rat'), false, 'not earned yet');
  g.kills.rat = 2000;
  assert.deepEqual(C.earnedTitles(g), [{ id: 'rat', title: 'Rat Catcher' }]);
  assert.ok(C.setTitle(g, 'rat'));
  assert.equal(g.alignmentStyle().label, 'the Rat Catcher');
  g.karma.good = 30;   // the Holy path's own title wins
  assert.equal(g.alignmentStyle().label, 'the Virtuous');
  g.karma.good = 0;
  C.setTitle(g, null);
  assert.equal(g.alignmentStyle().label, null);
});

// ---------------- Pest Control contracts ----------------
test('contracts are three harmless species near your level, seeded by the date, outside the Wilderness', () => {
  const g = newGame();
  const pool = C.contractPool(g);
  assert.ok(pool.length > 20);
  for (const m of pool) {
    assert.ok(!getNpc(m.id).aggressive && !getNpc(m.id).boss, `${m.id} is harmless`);
    assert.ok(!g.world.zones.find((z) => z.name === m.zone)?.wilderness, `${m.id} is outside the Wilderness`);
  }
  const a = C.makeContracts(TODAY, 20, pool), b = C.makeContracts(TODAY, 20, pool), c = C.makeContracts(TOMORROW, 20, pool);
  assert.deepEqual(a, b, 'the same day gives the same board');
  assert.notDeepEqual(a.map((x) => x.id), c.map((x) => x.id), 'another day, another board');
  assert.equal(new Set(a.map((x) => x.id)).size, 3, 'three different species');
  for (const k of a) {
    assert.ok(k.need >= 20 && k.need <= 40 && k.tokens >= 3 && k.coins > 0);
    assert.match(k.text, /^(Clear|Cull|Thin out) \d+ .+ in .+$/);
    const lvl = getNpc(k.id).level;
    assert.ok(lvl <= 20 + 5 + 30 && lvl >= 1, `${k.id} (level ${lvl}) near level 20`);
  }
  assert.equal(C.plural('Mosquito'), 'mosquitoes');
  assert.equal(C.plural('Sambar deer'), 'sambar deer');
  assert.equal(C.plural('Fruit bat'), 'fruit bats');
  assert.equal(C.plural('Praying mantis'), 'praying mantises');
  // A low-level character is never sent into a region far above it.
  for (const k of C.makeContracts(TODAY, 3, pool)) {
    const hi = g.world.zones.find((z) => z.name === k.zone)?.hi || 0;
    assert.ok(!hi || hi <= 3 + C.CONTRACT_SAFE_ABOVE, `${k.text}: region up to level ${hi}`);
  }
});

test('contract kills count, hand-in pays tokens and coins, and all three pay a bonus', () => {
  const g = newGame();
  assert.ok(C.ensureContracts(g, TODAY));
  assert.equal(C.ensureContracts(g, TODAY), false, 'one board a day');
  const list = C.activeContracts(g, TODAY);
  assert.equal(list.length, 3);
  // Make them quick to finish, and send auto battle after the first.
  for (const k of list) k.need = 3;
  g.rollDrops = () => {};   // (so the coins counted are the contract's alone)
  assert.ok(C.huntContract(g, list[0].id));
  assert.equal(g._questTarget, list[0].id);
  assert.equal(C.handInContracts(g).count, 0, 'nothing finished yet');
  const tokens0 = g.inventory.count('pest_token'), coins0 = g.inventory.count('coins');
  for (let i = 0; i < 3; i++) g.killNpc(harmless(g, list[0].id));
  assert.ok(list[0].done);
  assert.equal(g._questTarget, null, 'auto battle lets go of a finished contract');
  const r1 = C.handInContracts(g);
  assert.equal(r1.count, 1);
  assert.equal(g.inventory.count('pest_token'), tokens0 + list[0].tokens);
  assert.ok(g.inventory.count('coins') >= coins0 + list[0].coins, 'and its coins (achievements may add more)');
  for (const k of list.slice(1)) for (let i = 0; i < 3; i++) g.killNpc(harmless(g, k.id));
  const r2 = C.handInContracts(g);
  assert.equal(r2.tokens, list[1].tokens + list[2].tokens + C.FULL_BOARD_TOKENS, 'the full-board bonus');
  assert.equal(C.handInContracts(g).count, 0, 'paid once');
  // The tracker and the officer's window show them.
  assert.match(contractsHTML(g), /Paid/);
});

test('a finished contract left at midnight is paid out with the new board', () => {
  const g = newGame();
  C.ensureContracts(g, TODAY);
  const k = C.activeContracts(g, TODAY)[0];
  k.have = k.need; k.done = true;
  const t0 = g.inventory.count('pest_token');
  assert.ok(C.ensureContracts(g, TOMORROW));
  assert.equal(g.inventory.count('pest_token'), t0 + k.tokens);
  assert.ok(C.activeContracts(g, TOMORROW).every((x) => !x.done && x.have === 0));
});

test('the token shop sells the cape, bait, lamps, quills and food for tokens', () => {
  const g = newGame();
  for (const r of C.TOKEN_SHOP) assert.ok(getItem(r.id), r.id);
  assert.equal(C.buyTokenReward(g, 'mosquito_net_cape'), false, 'no tokens yet');
  g.inventory.add('pest_token', 40);
  assert.ok(C.buyTokenReward(g, 'mosquito_net_cape'));
  assert.equal(g.inventory.count('pest_token'), 10);
  const before = C.hunterXpMult(g);
  g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'mosquito_net_cape'));
  assert.equal(g.equipment.get('cape'), 'mosquito_net_cape');
  assert.ok(Math.abs(C.hunterXpMult(g) - before - C.NET_CAPE_HUNTER) < 1e-9, 'the cape adds Hunter XP');
  assert.ok(C.buyTokenReward(g, 'forager_lamp'));
  assert.ok(C.buyTokenReward(g, 'hunter_bait'));
  assert.equal(g.inventory.count('hunter_bait'), 10);
  // A lamp: XP in a gathering skill of your choice.
  const xp0 = g.skills.xp.mining;
  assert.ok(C.rubLamp(g, g.inventory.slots.findIndex((s) => s?.id === 'forager_lamp'), 'mining'));
  assert.ok(g.skills.xp.mining > xp0);
  assert.equal(g.inventory.count('forager_lamp'), 0);
  // Bait: one used per catch, with more XP.
  const hx = C.huntExtras(g);
  assert.equal(g.inventory.count('hunter_bait'), 9);
  assert.ok(hx.xpMult >= 1 + C.BAIT_XP + C.NET_CAPE_HUNTER - 1e-9);
});

// ---------------- Stewardship ----------------
test('Stewardship builds only while Neutral, from harmless kills only, and its perks rest otherwise', () => {
  const g = newGame();
  // (Harmless kills are karma-neutral on the owner's branch; here the karma
  // is held at Neutral so this test reads the same on either.)
  const hold = () => { g.karma.good = 0; g.karma.evil = 0; };
  hold();
  for (let i = 0; i < 5; i++) { g.killNpc(harmless(g)); hold(); }
  assert.equal(g.culling.steward, 5);
  const wolf = ALL_MONSTER_IDS.find((id) => getNpc(id).aggressive && !getNpc(id).boss && getNpc(id).attackable);
  g.killNpc(harmless(g, wolf)); hold();
  assert.equal(g.culling.steward, 5, 'an aggressive kill adds nothing');
  g.karma.good = 30;   // the Holy path
  g.killNpc(harmless(g));
  assert.equal(g.culling.steward, 5, 'nothing while Holy');
  g.karma.good = 0; g.karma.evil = 30;   // the Dark path
  g.killNpc(harmless(g));
  assert.equal(g.culling.steward, 5, 'nothing while Dark');
  // Rank 2's perks: on while Neutral, resting otherwise.
  g.culling.steward = 400;
  assert.equal(C.stewardship(g).active, false);
  assert.equal(C.foodMult(g), 1);
  hold();
  const s = C.stewardship(g);
  assert.ok(s.active && s.rank === 2 && s.food === 0.10 && s.yield === 0.04 && s.hunter === 0.10);
  // Food heals more.
  g.player.hp = 1;
  g.inventory.add('chicken_rice', 1);
  g.eatItem(g.inventory.slots.findIndex((x) => x?.id === 'chicken_rice'));
  assert.equal(g.player.hp, 1 + Math.round(getItem('chicken_rice').heal * 1.1));
  // Never a combat stat: the Stats tab's damage is the same either way.
  const npc = harmless(g, 'rat', 1e9);
  const m1 = damageMult(g, g.combatMode(), { npc }).m;
  g.culling.steward = 0;
  assert.equal(damageMult(g, g.combatMode(), { npc }).m, m1);
  g.culling.steward = 400;
  // Shown in the Stats tab and the alignment readout.
  assert.ok(statSheet(g).sections.find((x) => x.id === 'utility').rows.some((r) => r.id === 'steward' && /Warden/.test(r.text)));
  assert.match(stewardLineHTML(g), /Warden/);
  assert.match(stewardHTML(g), /Active/);
});

// ---------------- Hunter ----------------
test('harmless kills give a trickle of Hunter XP by level; fierce ones give none', () => {
  const g = newGame();
  const xp0 = g.skills.xp.hunter;
  g.killNpc(harmless(g, 'macaque'));   // level 8
  const gain = g.skills.xp.hunter - xp0;
  assert.ok(gain > 0, 'some Hunter XP');
  const wolf = ALL_MONSTER_IDS.find((id) => getNpc(id).aggressive && !getNpc(id).boss && getNpc(id).attackable);
  const x1 = g.skills.xp.hunter;
  g.killNpc(harmless(g, wolf));
  assert.equal(g.skills.xp.hunter, x1, 'none from an aggressive monster');
  // Hides and feathers now and then: over many bird kills, a few feathers.
  const f0 = g.inventory.count('feather');
  for (let i = 0; i < 300; i++) g.killNpc(harmless(g, 'kingfisher'));
  const got = g.inventory.count('feather') - f0;
  assert.ok(got > 0 && got < 300 * 3 * 0.15, `${got} feathers from 300 birds`);
});

test('culling Hunter XP an hour is a small fraction of working a trap', () => {
  // Culling: a generous hour (75 kills a minute, the fastest auto battle
  // manages) of level 30 harmless creatures, at the best Stewardship rank and
  // in the mosquito-net cape.
  const g = newGame();
  g.culling.steward = 99999; g.equipment.set('cape', 'mosquito_net_cape');
  const base = g.skills.xp.hunter;
  const perKill = Math.max(0.5, 30 * C.CULL_HUNTER_XP_PER_LEVEL) * C.hunterXpMult(g);
  g.skills.addXp('hunter', perKill);
  const cullHour = (g.skills.xp.hunter - base) * 75 * 60;
  // A trap: 5 minutes of auto gather at the lowest trap, from level 1.
  const h = newGame();
  h.npcs = [];
  if (!h.inventory.has('hunting_snare')) h.inventory.add('hunting_snare', 1);
  h.skills.xp.hunter = xpForLevel(1);
  const all = h.world.objects.filter((o) => o.objId === 'bird_snare');
  const start = all.reduce((a, b) => (all.filter((p) => chebyshev(p.x, p.y, b.x, b.y) <= 15).length > all.filter((p) => chebyshev(p.x, p.y, a.x, a.y) <= 15).length ? b : a));
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = start.x + dx, y = start.y + dy;
    if (!h.world.isBlocked(x, y) && !h.world.objectAt(x, y)) { h.player.x = h.player.tx = x; h.player.y = h.player.ty = y; break; }
  }
  h.toggleAutoGather(true); h.defaultObjectAction(start);
  const hb = h.skills.xp.hunter;
  let gain = 0;
  for (let i = 0; i < 500; i++) {
    h.update(600);
    gain += h.skills.xp.hunter - hb; h.skills.xp.hunter = hb;
    for (let k = 0; k < h.inventory.size; k++) { const s = h.inventory.slotAt(k); if (s && s.id !== 'hunting_snare') h.inventory.removeAt(k, s.qty); }
  }
  const trapHour = gain * 12;
  assert.ok(trapHour > 0);
  assert.ok(cullHour < trapHour * 0.25, `culling ${Math.round(cullHour)} vs trap ${Math.round(trapHour)} Hunter XP an hour`);
});

// ---------------- The officer, the windows, saves ----------------
test('Officer Aziz stands in Kampong Glam where you can walk to him, and the windows render', () => {
  const g = newGame();
  const o = g.npcs.find((n) => n.npcId === 'pest_officer');
  assert.ok(o, 'the officer is placed');
  assert.equal(g.world.zoneAt(o.x, o.y).name, 'Kampong Glam');
  assert.equal(o.def.role, 'dialogue');
  assert.ok(findPath(g.pathCfg(), { x: 56, y: 50 }, { x: o.x, y: o.y }, { reachAdjacent: true }).length > 0, 'reachable from the plaza');
  C.ensureContracts(g);
  assert.match(contractsHTML(g), /pc-hunt/);
  const rows = contractTrackerRows({ game: g, _trkPointer: () => '' });
  assert.equal(rows.length, 2, 'two open contracts in the tracker');
  // The codex shows mastery: a badge in the list and a section in the entry.
  g.kills.rat = 250;
  assert.match(codexRowHTML(g, 'rat'), /cx-tag mastery t2/);
  const entry = codexEntryHTML(g, 'rat');
  assert.match(entry, /Codex mastery/);
  assert.match(entry, /250 \/ 2,000 to the next tier/);
  g.kills.rat = 2000;
  assert.match(codexProgressHTML(g), /Rat Catcher/);
});

test('culling state survives a save, and an older save without it still loads', () => {
  const g = newGame();
  g.culling.steward = 321; g.culling.quill = 17; g.culling.extra = { rat: 4 };
  g.kills.rat = 2000; C.setTitle(g, 'rat');
  C.ensureContracts(g, TODAY);
  C.activeContracts(g, TODAY)[0].have = 7;
  assert.ok(saveGame(g));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.equal(g2.culling.steward, 321);
  assert.equal(g2.culling.quill, 17);
  assert.deepEqual(g2.culling.extra, { rat: 4 });
  assert.equal(g2.culling.title, 'rat');
  assert.equal(g2.culling.contracts.day, TODAY);
  assert.equal(g2.culling.contracts.list[0].have, 7);
  assert.equal(C.masteryCount(g2, 'rat'), 2004);
  // An older save: no culling field at all. Mastery still comes from its kills.
  const old = snapshot(g);
  delete old.culling;
  localStorage.setItem(SAVE_KEY, JSON.stringify(old));
  const g3 = new Game();
  assert.ok(loadGame(g3));
  assert.deepEqual(g3.culling, C.defaultCulling());
  assert.equal(C.masteryOf(g3, 'rat').tier, 3, 'mastery from the kills it already had');
  // Junk in the field is dropped, not trusted.
  const bad = snapshot(g);
  bad.culling = { steward: 'lots', title: 'not_a_monster', extra: { nope: 5 }, contracts: { day: 5, list: [null, { id: 'nope' }] } };
  localStorage.setItem(SAVE_KEY, JSON.stringify(bad));
  const g4 = new Game();
  assert.ok(loadGame(g4));
  assert.equal(g4.culling.steward, 0); assert.equal(g4.culling.title, null);
  assert.deepEqual(g4.culling.extra, {}); assert.deepEqual(g4.culling.contracts.list, []);
});
