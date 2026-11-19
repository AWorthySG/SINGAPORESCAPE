// Convenience pass: the "What next?" goals (src/game/whatnext.js and
// src/ui/whatnextui.js), what a level-up opened (levelnews.js), the bank's
// Deposit loot and keep list (bankkeep.js) and the "Wear it" note.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { clearSave, snapshot, saveGame, loadGame } from '../src/game/save.js';
import { whatNext, runGoal, packUpgrades, nextQuest, fightTarget, bestSource, nearUnlock, MAX_GOALS } from '../src/game/whatnext.js';
import { levelNews, levelNewsText, NEWS_NAMES } from '../src/game/levelnews.js';
import { depositLoot, staysInPack, toggleKeep, isKept, keepList, loadKeep, KEEP_MAX } from '../src/game/bankkeep.js';
import { whatNextHTML, whatNextTrackerRows, watchUpgrades, watchGoals } from '../src/ui/whatnextui.js';
import { xpForLevel } from '../src/data/xp.js';
import { getItem } from '../src/data/items.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(cls = 'rogue') {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.ui = new Proxy({}, { get: () => () => {} });
  if (cls) game.chooseClass(cls);
  game.goldenSkills = () => [];   // the in-game clock must not decide which goals show
  return game;
}
const setLevel = (game, skill, lvl) => { game.skills.xp[skill] = xpForLevel(lvl); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- What next? ----------------
test('what next: nothing before a class is picked, then up to three distinct goals', () => {
  const g = newGame(null);
  assert.deepEqual(whatNext(g), [], 'no goals on the class picker');
  g.chooseClass('rogue');
  const goals = whatNext(g);
  assert.ok(goals.length >= 2 && goals.length <= MAX_GOALS, `two or three goals (got ${goals.length})`);
  assert.equal(new Set(goals.map((x) => x.key)).size, goals.length, 'no goal twice');
  for (const x of goals) assert.ok(x.title && x.text && x.go, `${x.key} has a title, a line and a button`);
  assert.ok(goals.some((x) => x.kind === 'quest'), 'a fresh character is pointed at a quest');
});

test('what next: the quest goal is the active quest first, and its Go is the journal\'s', () => {
  const g = newGame();
  const first = nextQuest(g);
  assert.ok(first, 'a quest to start');
  // Make a later quest active: it now comes first.
  const ids = Object.keys(g.quests);
  const later = ids.find((id) => id !== first.id && g.questGuide(id).kind !== 'none' && !['redemption', 'corruption'].includes(id));
  g.quests[later] = { ...g.quests[later], state: 'active' };
  if (g.questGuide(later).kind !== 'none') assert.equal(nextQuest(g).id, later, 'the active quest leads');
  const goal = whatNext(g).find((x) => x.kind === 'quest');
  let went = null;
  g.questTravel = (id) => { went = id; return true; };
  assert.equal(runGoal(g, goal), true);
  assert.equal(went, goal.quest, 'Go runs the quest journal\'s own travel');
});

test('what next: the karma quests are never suggested', () => {
  const g = newGame();
  for (const id of Object.keys(g.quests)) if (id !== 'redemption' && id !== 'corruption') g.quests[id] = { ...g.quests[id], state: 'done' };
  const q = nextQuest(g);
  assert.ok(!q || (q.id !== 'redemption' && q.id !== 'corruption'), 'a moral choice is left to the player');
});

test('what next: a better piece in the pack comes first, and Equip puts it on', () => {
  const g = newGame();
  assert.equal(packUpgrades(g).length, 0, 'the starter kit is already worn');
  g.inventory.add('iron_dagger', 1);
  const goals = whatNext(g);
  assert.equal(goals[0].kind, 'gear', 'gear first: it is one tap');
  assert.match(goals[0].text, /Iron dagger/);
  assert.equal(runGoal(g, goals[0]), true);
  assert.equal(g.equipment.get('weapon'), 'iron_dagger');
  assert.ok(!whatNext(g).some((x) => x.kind === 'gear'), 'nothing left to wear');
  // Gear the class can't wear is never suggested.
  g.inventory.add('iron_sword', 1);
  assert.ok(!packUpgrades(g).some((s) => s.id === 'iron_sword'), 'a Rogue is not told to wear a sword');
});

test('what next: a gathering skill a level or two from new ground gets a goal, and Go starts on it', () => {
  const g = newGame();
  setLevel(g, 'woodcutting', 14);   // Oak trees open at 15
  for (const s of ['mining', 'fishing', 'hunter', 'thieving', 'agility']) setLevel(g, s, 1);
  const nu = nearUnlock(g, 'woodcutting');
  assert.equal(nu.src.name, 'Oak tree');
  assert.equal(nu.gap, 1);
  const goal = whatNext(g).find((x) => x.kind === 'skill');
  assert.ok(goal, 'a skill goal');
  assert.equal(goal.skill, 'woodcutting');
  assert.match(goal.text, /1 level to Oak tree/);
  const best = bestSource(g, 'woodcutting').src.level;
  assert.ok(best <= 14 && best > 1, `it sends you to the best tree you can chop now (level ${best})`);
  assert.equal(runGoal(g, goal), true);
  assert.ok(g.player.action || g.player.isMoving, 'you set off for the tree');
});

test('what next: golden hours pick the skill, and a skill without its tool is skipped', () => {
  const g = newGame();
  g.goldenSkills = () => ['mining'];
  let goal = whatNext(g).find((x) => x.kind === 'skill');
  assert.equal(goal?.skill, 'mining');
  assert.match(goal.text, /Golden hours/);
  // No pickaxe anywhere: no mining goal.
  g.inventory.slots = g.inventory.slots.map((s) => (s && getItem(s.id).tool === 'pickaxe' ? null : s));
  goal = whatNext(g).find((x) => x.kind === 'skill');
  assert.notEqual(goal?.skill, 'mining');
});

test('what next: the fight goal is a monster your level outside the Wilderness, and Go switches auto battle on', () => {
  const g = newGame();
  const n = fightTarget(g);
  assert.ok(n, 'a monster to fight');
  const cl = g.fightLevel();
  assert.ok(!n.def.boss && n.def.level >= cl - 8 && n.def.level <= cl + 3, `level ${n.def.level} suits combat level ${cl}`);
  assert.ok(!g.world.zoneAt(n.x, n.y)?.wilderness, 'never in the Wilderness');
  const goal = { kind: 'fight', npc: n };
  assert.equal(runGoal(g, goal), true);
  assert.equal(g.autoBattle, true, 'auto battle takes over');
});

test('what next: the journal card and the tracker row', () => {
  const g = newGame();
  const goals = whatNext(g);
  const html = whatNextHTML(g, goals);
  assert.match(html, /What next\?/);
  assert.equal((html.match(/class="q-go wn-go"/g) || []).length, goals.length, 'a button per goal');
  assert.equal(whatNextHTML(g, []), '', 'no card without goals');
  const ui = { game: g, el: {} };
  const rows = whatNextTrackerRows(ui);
  assert.equal(rows.length, 1);
  assert.match(rows[0], /trk-next/);
  // Cached between ticks: the same goal object until a few ticks pass.
  const goal = ui._wnTrack.goal;
  whatNextTrackerRows(ui);
  assert.equal(ui._wnTrack.goal, goal);
});

test('what next: the journal redraws only when the goals change', async () => {
  const g = newGame();
  let drawn = 0;
  const ui = { game: g, _wnGoals: whatNext(g), renderQuestPanel() { drawn++; this._wnGoals = whatNext(g); }, _soon: (k, fn) => fn() };
  watchGoals(ui);
  g.bus.emit('inventory');
  assert.equal(drawn, 0, 'same goals: no redraw');
  g.inventory.add('iron_dagger', 1);
  g.bus.emit('inventory');
  assert.equal(drawn, 1, 'a new goal: one redraw');
});

// ---------------- The "Wear it" note ----------------
test('wear it: loot that beats your gear gets one note, and its button wears it', async () => {
  const g = newGame();
  const pushed = [];
  const ui = { game: g, lane: { push: (n) => pushed.push(n) } };
  watchUpgrades(ui, { settleMs: 0, debounceMs: 0 });
  await wait(5);
  g.inventory.add('iron_dagger', 1);
  g.bus.emit('inventory');
  await wait(5);
  assert.equal(pushed.length, 1, 'one note');
  assert.match(pushed[0].html, /Iron dagger/);
  assert.match(pushed[0].html, /data-act="wearbest"/);
  g.bus.emit('inventory');
  await wait(5);
  assert.equal(pushed.length, 1, 'never twice for the same piece');
  ui.noticeAct('wearbest');
  assert.equal(g.equipment.get('weapon'), 'iron_dagger');
});

// ---------------- Level-up news ----------------
test('level news: a level names the trees, recipes and class gear it opened', () => {
  const g = newGame();
  const wc = levelNews(g, 'woodcutting', 14, 15);
  assert.deepEqual(wc.gather, ['Oak tree']);
  assert.equal(levelNewsText(levelNews(g, 'woodcutting', 15, 16)), '', 'nothing new at 16');
  const att = levelNews(g, 'attack', 1, 99);
  assert.ok(att.gear.length > 0, 'a Rogue gets daggers to wield');
  assert.ok(att.gear.every((n) => !/sword|mace|scimitar|staff|bow/i.test(n)), `only Rogue weapons: ${att.gear.slice(0, 6).join(', ')}`);
  const many = levelNewsText(levelNews(g, 'smithing', 1, 99));
  assert.match(many, /^Now open: /);
  assert.match(many, /and \d+ more\.$/, 'a long list is cut short');
  assert.equal(many.replace(/ and \d+ more\.$/, '').replace(/^Now open: /, '').split(', ').length, NEWS_NAMES);
});

// ---------------- Deposit loot ----------------
test('deposit loot: tools, coins and kept items stay; the rest is banked', () => {
  const g = newGame();
  g.inventory.add('logs', 5);
  g.inventory.add('bones', 2);
  g.inventory.add('kaya_toast', 1);
  const coins = g.inventory.count('coins');
  assert.equal(toggleKeep(g, 'kaya_toast'), true, 'kaya toast on the keep list');
  assert.equal(isKept(g, 'kaya_toast'), true);
  assert.ok(staysInPack(g, 'bronze_axe') && staysInPack(g, 'coins') && !staysInPack(g, 'logs'));
  depositLoot(g);
  assert.equal(g.inventory.count('logs'), 0);
  assert.equal(g.bank.count('logs'), 5);
  assert.equal(g.bank.count('bones'), 2);
  assert.equal(g.inventory.count('coins'), coins, 'coins stay');
  assert.ok(g.inventory.count('bronze_axe') && g.inventory.count('bronze_pickaxe'), 'tools stay');
  assert.ok(g.inventory.count('kaya_toast') >= 1, 'kept food stays');
  assert.equal(toggleKeep(g, 'kaya_toast'), false, 'and comes off the list again');
});

test('deposit loot: the keep list is saved, and older saves load with none', () => {
  const g = newGame();
  toggleKeep(g, 'chicken_rice');
  assert.deepEqual(snapshot(g).bankKeep, ['chicken_rice']);
  saveGame(g);
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.equal(isKept(g2, 'chicken_rice'), true);
  loadKeep(g2, undefined);
  assert.equal(keepList(g2).size, 0, 'an older save: an empty list');
  loadKeep(g2, ['chicken_rice', 'no_such_item', 7]);
  assert.deepEqual([...keepList(g2)], ['chicken_rice'], 'unknown ids are dropped');
  loadKeep(g2, Array.from({ length: KEEP_MAX + 20 }, () => 'logs'));
  assert.ok(keepList(g2).size <= KEEP_MAX);
});

// ---------------- Styles ----------------
test('qol.css is linked and well formed', () => {
  const css = readFileSync(new URL('../styles/qol.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const ch of css) { if (ch === '{') depth++; else if (ch === '}') { depth--; assert.ok(depth >= 0, 'an extra }'); } }
  assert.equal(depth, 0, 'every { is closed');
  assert.ok(!/@media\s*\(pointer:\s*coarse\)\s*\{/.test(css), 'no bare coarse-pointer block');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="styles\/qol\.css"/);
});
