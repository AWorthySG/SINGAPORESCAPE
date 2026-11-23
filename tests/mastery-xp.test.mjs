// Gear mastery as XP (mastery.js): the XP curve, kill XP by level, feeding and
// sacrifice, the two world-boss ranks above Ascended (only world bosses reach
// them: not Endless Gate bosses, materials or sacrifice), turning an old
// save's points into XP, and the words the Gear Mastery window uses.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { NPC } from '../src/game/npc.js';
import { Equipment } from '../src/game/equipment.js';
import { getNpc, ALL_BOSS_IDS } from '../src/data/npcs.js';
import { ITEMS } from '../src/data/items.js';
import {
  MASTERY_RANKS, MAX_RANK, BATTLE_CAP_RANK, BATTLE_CAP, OLD_RANK_POINTS, KILL_MULT,
  rankFor, rankProgress, killMastery, isWorldBoss, pointsToXp, masteryBonuses,
} from '../src/game/mastery.js';
import { FEED_CAP, feedXp, materialFeedXp, materialPoints, materialKind } from '../src/game/materials.js';
import { sacrificeGear, sacrificeXp, gearWorth } from '../src/game/salvage.js';
import { waveBossDef } from '../src/game/waves.js';
import { UI } from '../src/ui/ui.js';

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
const chat = (g) => { const out = []; g.bus.on('chat', (m) => out.push(m.text)); return out; };
const boss = ALL_BOSS_IDS.find((id) => !getNpc(id).fixed && getNpc(id).attackable);

test('the XP curve: 2,500 x r x 2^(r-1) up to Ascended (ten times the old points), then two world-boss ranks', () => {
  assert.deepEqual(MASTERY_RANKS.map((r) => r.name),
    ['Novice', 'Adept', 'Skilled', 'Expert', 'Master', 'Grandmaster', 'Ascended', 'Exalted', 'Transcendent']);
  assert.deepEqual(MASTERY_RANKS.map((r) => r.xp), [0, 2500, 10000, 30000, 80000, 200000, 480000, 720000, 1200000]);
  for (let r = 1; r <= BATTLE_CAP_RANK; r++) assert.equal(MASTERY_RANKS[r].xp, 2500 * r * 2 ** (r - 1));
  for (let r = 1; r < BATTLE_CAP_RANK; r++) assert.equal(MASTERY_RANKS[r].xp, OLD_RANK_POINTS[r] * 10, 'ten times the old points');
  // Each rank takes more XP than the one before, and adds a bigger step of stats.
  for (let r = 1; r <= MAX_RANK; r++) {
    assert.ok(MASTERY_RANKS[r].xp > MASTERY_RANKS[r - 1].xp);
    assert.ok(MASTERY_RANKS[r].gain > MASTERY_RANKS[r - 1].gain);
    if (r >= 2) assert.ok(MASTERY_RANKS[r].gain - MASTERY_RANKS[r - 1].gain >= MASTERY_RANKS[r - 1].gain - MASTERY_RANKS[r - 2].gain, `rank ${r} steps up at least as much`);
  }
  assert.deepEqual(MASTERY_RANKS.filter((r) => r.worldBoss).map((r) => r.name), ['Exalted', 'Transcendent']);
  assert.equal(BATTLE_CAP, MASTERY_RANKS[6].xp);
  assert.equal(rankFor(2499), 0); assert.equal(rankFor(2500), 1); assert.equal(rankFor(5e6), MAX_RANK);
  assert.deepEqual(rankProgress(20000), { rank: 2, next: 3, need: 10000, frac: 0.5, into: 10000, span: 20000, worldBoss: false });
  assert.equal(rankProgress(500000).worldBoss, true);
  assert.equal(rankProgress(5e6).next, null);
  // The new ranks are real bonuses: Transcendent beats Ascended on every stat.
  const base = { attack: 100, strength: 80 };
  assert.ok(masteryBonuses(base, 8).attack > masteryBonuses(base, 7).attack && masteryBonuses(base, 7).attack > masteryBonuses(base, 6).attack);
});

test('kill XP grows with the monster\'s level; champions and bosses are worth more', () => {
  const kill = (level, extra = {}) => killMastery({ def: { level, ...extra.def }, ...extra.npc });
  assert.equal(kill(1), 10);
  assert.ok(kill(100) > kill(1) && kill(1000) > kill(100) && kill(5000) > kill(1000), 'not flat per kill');
  // In step with the level: a stronger monster counts for more (the owner's ask).
  assert.equal(kill(100), 20); assert.equal(kill(300), 40); assert.equal(kill(1000), 110);
  assert.ok(kill(1000) >= kill(1) * 10, 'a level 1,000 monster trains gear ten times a level 1 one');
  assert.equal(kill(1, { npc: { champion: true } }), 10 * KILL_MULT.champion);
  assert.equal(kill(300, { def: { boss: true } }), Math.round(10 * (1 + 299 / 100) * KILL_MULT.worldBoss));
  assert.equal(kill(300, { def: { boss: true }, npc: { wave: true } }), Math.round(10 * (1 + 299 / 100) * KILL_MULT.boss), 'an Endless Gate boss');
  // A boss grown to your level counts at that level.
  assert.equal(killMastery({ def: { boss: true, level: 50, scaledTo: 300 } }), kill(300, { def: { boss: true } }));
});

test('world bosses: bosses on the map and the roaming World Boss, never Endless Gate bosses, adds or allies', () => {
  const g = newGame();
  const onMap = g.npcs.find((n) => n.def.boss && !n.def.fixed);
  assert.ok(onMap && isWorldBoss(onMap), 'a boss placed on the map');
  const wave = new NPC(boss, 0, 0, 0);
  wave.def = waveBossDef(boss, 10, 100); wave.wave = true; wave.temporary = true;
  assert.equal(isWorldBoss(wave), false, 'an Endless Gate boss (waves.js)');
  const add = new NPC(boss, 0, 0, 0); add.temporary = true;
  assert.equal(isWorldBoss(add), false, 'anything summoned for a moment');
  const ally = new NPC(boss, 0, 0, 0); ally.ally = true;
  assert.equal(isWorldBoss(ally), false);
  assert.equal(isWorldBoss(new NPC(boss, 0, 0, 0)), true);
  assert.equal(isWorldBoss({ def: { level: 50 } }), false, 'not a boss at all');
  const roaming = g.spawnWorldBoss();
  if (roaming) assert.ok(isWorldBoss(roaming), 'the roaming World Boss');
});

test('past Ascended only world bosses count: not kills, Endless Gate bosses, materials or sacrifice', () => {
  const g = newGame();
  const said = chat(g);
  const w = g.equipment.get('weapon');
  g.equipment.setMastery(w, BATTLE_CAP - 5);
  // An ordinary kill tops it up to Ascended exactly, and no further.
  g._gainMastery({ def: { level: 300 } });
  assert.equal(g.equipment.masteryXp(w), BATTLE_CAP);
  assert.equal(g.equipment.masteryRank(w), BATTLE_CAP_RANK);
  for (let i = 0; i < 20; i++) g._gainMastery({ champion: true, def: { level: 300 } });
  assert.equal(g.equipment.masteryXp(w), BATTLE_CAP, 'champions add nothing past Ascended');
  // An Endless Gate boss, with the very def waves.js gives it: nothing.
  const gate = new NPC(boss, 0, 0, 0);
  gate.def = waveBossDef(boss, 20, 300); gate.wave = true; gate.temporary = true;
  g._gainMastery(gate);
  assert.equal(g.equipment.masteryXp(w), BATTLE_CAP, 'an Endless Gate boss adds nothing past Ascended');
  // Materials and sacrifice stop at Master, far below.
  g.inventory.add('rune_bar', 5);
  assert.equal(g.feedMastery(w, 'rune_bar', 5), 0);
  g.inventory.add('rune_sword', 5);
  assert.equal(sacrificeGear(g, w, 'rune_sword', 5), 0);
  assert.equal(g.equipment.masteryXp(w), BATTLE_CAP);
  // A world boss does count, all the way to Transcendent.
  const wb = new NPC(boss, 0, 0, 0);
  assert.ok(isWorldBoss(wb));
  const each = killMastery(wb);
  g._gainMastery(wb);
  assert.equal(g.equipment.masteryXp(w), BATTLE_CAP + each);
  let n = 1;
  while (g.equipment.masteryRank(w) < MAX_RANK && n < 5000) { g._gainMastery(wb); n++; }
  assert.equal(g.equipment.masteryRank(w), MAX_RANK);
  assert.ok(said.some((t) => /Sword mastery reached Exalted!/.test(t)) && said.some((t) => /reached Transcendent!/.test(t)), said.join('\n'));
  // And after that the XP stops at the top.
  g._gainMastery(wb);
  assert.equal(g.equipment.masteryXp(w), MASTERY_RANKS[MAX_RANK].xp);
});

test('a world boss slain through killNpc trains worn gear past Ascended; an Endless Gate boss does not', () => {
  const g = newGame();
  g.msg = () => {};
  const w = g.equipment.get('weapon');
  g.equipment.setMastery(w, BATTLE_CAP);
  const gate = g.spawnNpc(boss, g.player.x + 2, g.player.y, { temporary: true, wander: 0 });
  gate.def = waveBossDef(boss, 10, 100); gate.wave = true;
  gate.hp = 0; gate.alive = false;
  g.killNpc(gate);
  assert.equal(g.equipment.masteryXp(w), BATTLE_CAP);
  const wb = g.spawnNpc(boss, g.player.x + 2, g.player.y, { wander: 0 });
  wb.hp = 0; wb.alive = false;
  g.killNpc(wb);
  assert.equal(g.equipment.masteryXp(w), BATTLE_CAP + killMastery(wb));
  assert.equal(g.equipment.masteryRank(w), BATTLE_CAP_RANK, 'one boss is a start, not a rank');
});

test('feeding: never less than the old points gave, at least 3x for fine materials, stops at Master', () => {
  for (const id of Object.keys(ITEMS)) {
    if (!materialKind(id)) continue;
    const p = materialPoints(id), old = Math.min(p, Math.round(2 * Math.sqrt(p))) * 10;
    assert.ok(materialFeedXp(id) >= old, `${id}: ${materialFeedXp(id)} XP, ${old} before`);
    if (p >= 300) assert.ok(materialFeedXp(id) >= old * 3, `${id}: the old taper is gone for fine materials`);
  }
  const g = newGame();
  const w = g.equipment.get('weapon');
  g.inventory.add('rune_bar', 200);
  const per = feedXp(w, 'rune_bar');
  assert.equal(g.feedMastery(w, 'rune_bar', 10), 10 * per);
  assert.equal(g.equipment.masteryXp(w), 10 * per);
  g.feedMastery(w, 'rune_bar', Infinity);
  assert.equal(g.equipment.masteryRank(w), 4, 'Master');
  assert.ok(g.equipment.masteryXp(w) < FEED_CAP + per, 'only what it took');
  assert.ok(g.inventory.count('rune_bar') > 100, `${200 - g.inventory.count('rune_bar')} rune bars to Master`);
});

test('sacrifice gives the stated multiple of the old value, and stops at Master', () => {
  const g = newGame();
  const w = g.equipment.get('weapon');
  g.inventory.add('rune_sword', 400);
  const old = Math.round(2 * 1.5 * gearWorth('rune_sword')) * 10;   // the old points (worth x3) for a plain rune sword, at 10 XP a point
  const got = sacrificeGear(g, w, 'rune_sword', 1);
  assert.equal(got, sacrificeXp(w, 'rune_sword'));
  assert.ok(got / old >= 3.5 && got / old <= 4.5, `${got} XP, ${old} before`);
  sacrificeGear(g, w, 'rune_sword', 400);
  assert.equal(g.equipment.masteryRank(w), 4, 'Master');
  const used = 400 - g.inventory.count('rune_sword') + 1;
  assert.ok(used >= 200 && used <= 320, `${used} rune swords to Master (1,334 before)`);
  assert.equal(sacrificeGear(g, w, 'rune_sword', 1), 0, 'no further');
});

test('an old save\'s points become XP: the same rank and the same share of the way to the next, once', () => {
  for (let pts = 0; pts <= 60000; pts += 37) {
    const oldRank = OLD_RANK_POINTS.reduce((r, p, i) => (pts >= p ? i : r), 0);
    const xp = pointsToXp(pts);
    assert.equal(rankFor(xp), oldRank, `${pts} points`);
    if (oldRank < OLD_RANK_POINTS.length - 1) {
      const was = (pts - OLD_RANK_POINTS[oldRank]) / (OLD_RANK_POINTS[oldRank + 1] - OLD_RANK_POINTS[oldRank]);
      assert.ok(Math.abs(rankProgress(xp).frac - was) < 0.001, `${pts} points: progress kept`);
    } else assert.equal(xp, BATTLE_CAP, 'old Ascended is Ascended, with the world-boss ranks still to earn');
  }
  // Through Equipment.load: a save without _masteryXp is converted, one with it is not.
  const e = new Equipment();
  e.load({ weapon: 'rune_sword', _mastery: { 'weapon:sword': 4200, 'body:plate': 60000, 'ring:any': 100 } });
  assert.equal(e.masteryXp('rune_sword'), 42000);
  assert.equal(e.masteryRank('rune_sword'), 3, 'Expert, as before');
  assert.equal(e.masteryRank('rune_platebody'), 6, 'Ascended, as before');
  assert.equal(e.masteryXp('gold_ring'), 1000);
  const data = e.serialize();
  assert.equal(data._masteryXp, 1);
  const e2 = new Equipment();
  e2.load(data);
  assert.deepEqual(e2.mastery, e.mastery, 'loaded again, nothing is converted twice');
  // A save from before mastery (upgrade levels) comes straight to XP.
  const e3 = new Equipment();
  e3.load({ weapon: 'rune_sword', _upgrades: { rune_sword: 15 } });
  assert.equal(e3.masteryXp('rune_sword'), MASTERY_RANKS[e3.masteryRank('rune_sword')].xp);
  assert.ok(e3.masteryRank('rune_sword') >= 4 && e3.masteryRank('rune_sword') <= BATTLE_CAP_RANK);
});

test('the Gear Mastery window shows "X / Y XP to <next rank>", and the world-boss ranks say how they are earned', () => {
  const g = newGame();
  const w = g.equipment.get('weapon');
  g.equipment.setMastery(w, 42000);
  // A stand-in DOM: elements keep their HTML and children.
  const el = () => ({ innerHTML: '', className: '', dataset: {}, children: [], style: {}, appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, insertAdjacentHTML(_, h) { this.innerHTML += h; }, querySelectorAll: () => [], querySelector: () => null });
  const had = globalThis.document;
  globalThis.document = { createElement: el };
  try {
    const body = el();
    const ui = Object.create(UI.prototype);
    Object.assign(ui, { game: g, el: {}, openModal(title, render) { this.title = title; render(body); } });
    ui.openMastery();
    const html = (n) => n.innerHTML + n.children.map(html).join('');
    const all = html(body);
    assert.equal(ui.title, 'Gear Mastery');
    assert.match(all, /Sword: Expert/);
    assert.match(all, /12,000 \/ 50,000 XP to Master/);
    assert.match(all, /<b>Exalted<\/b>.*world bosses/);
    g.equipment.setMastery(w, BATTLE_CAP + 1000);
    const body2 = el();
    Object.assign(ui, { openModal(title, render) { render(body2); } });
    ui.openMastery();
    assert.match(html(body2), /1,000 \/ 240,000 XP to Exalted \(unlocked by defeating world bosses\)/);
  } finally { globalThis.document = had; }
});
