// Making is instant, as smelting already was: choosing a recipe (or "Do all")
// at a range, anvil, crafting table or bench makes everything the pack allows
// in one go, with each item still its own roll and one summary line in chat.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { COOKING } from '../src/game/skilling.js';
import { DISHES } from '../src/data/cooking.js';
import { SMITH } from '../src/data/smithing.js';
import { CRAFT } from '../src/data/crafting.js';
import { FLETCH } from '../src/data/trades.js';
import { tradeRecipes } from '../src/game/autoprocess.js';
import { UNLOCKS } from '../src/data/unlocks.js';

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
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
function listen(g) {
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (m, c) => { said.push(m); return msg(m, c); };
  return said;
}
const station = (g, type) => g.world.objects.find((o) => o.def?.type === type);
/** XP one item of `amount` base XP is worth right now (XP rate, life boost, golden hours). */
function xpEach(g, skill, amount) {
  const xp0 = g.skills.xp[skill];
  g.skills.addXp(skill, amount);
  const got = g.skills.xp[skill] - xp0;
  g.skills.xp[skill] = xp0;
  return got;
}
// One tick: the player is already beside the station, so the whole batch lands in it.
const oneTick = (g) => g.update(600);

test('cooking is instant: one "cook" uses every raw fish at once, one summary line, XP for each', () => {
  const g = newGame();
  const range = station(g, 'range');
  standBy(g, range);
  setLevel(g, 'cooking', 40);   // level 40 is safe from a mid-batch level-up changing the XP each
  const said = listen(g);
  const N = 27, raw = 'raw_sardine', cook = COOKING[raw];
  g.inventory.add(raw, N);
  const per = xpEach(g, 'cooking', cook.xp), perPerfect = xpEach(g, 'cooking', Math.round(cook.xp * 1.5));
  const xp0 = g.skills.xp.cooking;
  g.startCooking(range, raw);
  oneTick(g);
  assert.equal(g.inventory.count(raw), 0, 'every raw sardine used in the one tick');
  assert.equal(g.inventory.count(cook.result), N, `${N} sardines cooked at once`);
  assert.equal(g.inventory.count('burnt_fish'), 0, 'food never burns (life skills never fail)');
  assert.equal(g.player.action, null, 'and the range is done');
  // Perfect cooks pay half again: XP lies between N plain cooks and N perfect ones.
  const got = g.skills.xp.cooking - xp0;
  assert.ok(got >= N * per - 1e-6 && got <= N * perPerfect + 1e-6, `${got} XP for ${N} cooks (${per} each, ${perPerfect} perfect)`);
  const lines = said.filter((m) => /^You cook /.test(m));
  assert.equal(lines.length, 1, `one summary line (${said.join(' | ')})`);
  assert.match(lines[0], /^You cook 27 grilled sardines( \(\d+ perfectly cooked\))?\. \+[\d,]+ Cooking XP\.$/);
  assert.ok(!said.some((m) => /^Perfectly cooked!/.test(m)), 'no line per perfect cook');
});

test('perfect cooks still happen in a batch, at about their 8% rate', () => {
  const g = newGame();
  const range = station(g, 'range');
  standBy(g, range);
  setLevel(g, 'cooking', 99);
  const said = listen(g);
  const N = 2000, cook = COOKING.raw_anchovy;
  g.inventory.add('raw_anchovy', N);
  g.startCooking(range, 'raw_anchovy');
  oneTick(g);
  assert.equal(g.inventory.count('anchovy'), N);
  const line = said.find((m) => /^You cook /.test(m));
  const perfect = Number(line.match(/\((\d+) perfectly cooked/)?.[1] || 0);
  // 2000 rolls at 8%: about 160, and far inside 100-230 on any seed.
  assert.ok(perfect > 100 && perfect < 230, `${perfect} perfect cooks of ${N}`);
  assert.ok(cook.xp > 0);
});

test('a dish batch: "prepare" makes every dish the ingredients allow in one tick', () => {
  const g = newGame();
  const range = station(g, 'range');
  standBy(g, range);
  const d = DISHES.find((x) => x.level <= 20) || DISHES[0];
  setLevel(g, 'cooking', Math.max(d.level, 40));
  const said = listen(g);
  for (const i of d.inputs) g.inventory.add(i.id, i.qty * 6);
  const per = xpEach(g, 'cooking', d.xp);
  const xp0 = g.skills.xp.cooking, had = g.inventory.count(d.result);
  g.startDish(range, d);
  oneTick(g);
  assert.equal(g.inventory.count(d.result) - had, 6, 'six dishes at once');
  for (const i of d.inputs) assert.equal(g.inventory.count(i.id), 0, `all the ${i.id} used`);
  assert.ok(Math.abs(g.skills.xp.cooking - xp0 - 6 * per) < 1e-6, 'XP for six dishes');
  assert.equal(said.filter((m) => /^You prepare /.test(m)).length, 1, 'one line');
});

test('smithing is instant: every bar hammered at once, flawless extras counted in the one line', () => {
  const g = newGame();
  const anvil = station(g, 'anvil');
  standBy(g, anvil);
  if (!g.hasTool('hammer')) g.inventory.add('hammer', 1);
  const r = SMITH.find((x) => x.result === 'bronze_dagger') || SMITH.find((x) => x.level === 1 && !x.upgrade);
  setLevel(g, 'smithing', 60);
  const said = listen(g);
  const N = 30;
  g.inventory.add(r.bar, r.barCount * N);
  const per = xpEach(g, 'smithing', r.xp);
  const xp0 = g.skills.xp.smithing, had = g.inventory.count(r.result);
  g.startSmith(r, anvil);
  oneTick(g);
  assert.equal(g.inventory.count(r.bar), 0, 'every bar used in the one tick');
  const made = g.inventory.count(r.result) - had;
  assert.ok(made >= N * (r.qty || 1), `${made} made from ${N} smiths (plus any flawless extras)`);
  assert.ok(Math.abs(g.skills.xp.smithing - xp0 - N * per) < 1e-6, 'XP for each smith (extras are free)');
  const lines = said.filter((m) => /^You smith /.test(m));
  assert.equal(lines.length, 1, `one summary line (${said.join(' | ')})`);
  const extra = Number(lines[0].match(/\((\d+) extra from flawless work/)?.[1] || 0);
  assert.equal(made, N * (r.qty || 1) + extra, 'the line counts the flawless extras');
  assert.ok(!said.some((m) => /^Flawless work/.test(m)), 'no line per extra');
});

test('crafting is instant: a whole batch at the table in one tick', () => {
  const g = newGame();
  const table = station(g, 'craft');
  standBy(g, table);
  const r = CRAFT.find((x) => !x.upgrade && x.level <= 10 && (!x.tool || g.hasTool(x.tool)));
  setLevel(g, 'crafting', 40);
  const said = listen(g);
  const N = 12;
  for (const i of r.inputs) g.inventory.add(i.id, i.qty * N);
  const per = xpEach(g, 'crafting', r.xp);
  const xp0 = g.skills.xp.crafting, had = g.inventory.count(r.result);
  g.startCraft(r, table);
  oneTick(g);
  for (const i of r.inputs) assert.equal(g.inventory.count(i.id), 0, `all the ${i.id} used`);
  assert.equal(g.inventory.count(r.result) - had, N * (r.qty || 1));
  assert.ok(Math.abs(g.skills.xp.crafting - xp0 - N * per) < 1e-6, 'XP for each craft');
  assert.equal(said.filter((m) => /^You craft /.test(m)).length, 1, `one line (${said.join(' | ')})`);
});

test('fletching and Herblore are instant at their benches', () => {
  for (const skill of ['fletching', 'herblore']) {
    const g = newGame();
    const bench = station(g, skill === 'fletching' ? 'fletch' : 'herblore');
    standBy(g, bench);
    const r = tradeRecipes(skill).find((x) => !x.upgrade && x.level <= 5);
    if (r.tool && !g.hasTool(r.tool)) g.inventory.add(r.tool, 1);
    setLevel(g, skill, 40);
    const said = listen(g);
    const N = 15;
    for (const [id, n] of r.inputs) g.inventory.add(id, n * N);
    const per = xpEach(g, skill, r.xp);
    const xp0 = g.skills.xp[skill], had = g.inventory.count(r.result);
    g.startRecipe(skill, r, bench);
    oneTick(g);
    for (const [id] of r.inputs) assert.equal(g.inventory.count(id), 0, `${skill}: all the ${id} used`);
    assert.equal(g.inventory.count(r.result) - had, N * (r.qty || 1), `${skill}: every ${r.result} made`);
    assert.ok(Math.abs(g.skills.xp[skill] - xp0 - N * per) < 1e-6, `${skill}: XP for each make`);
    const verb = skill === 'fletching' ? 'fletch' : 'brew';
    assert.equal(said.filter((m) => m.startsWith(`You ${verb} `)).length, 1, `${skill}: one line (${said.join(' | ')})`);
  }
});

test('"Cook all" runs every recipe in the same tick, one line each, and kept materials still help', () => {
  const g = newGame();
  UNLOCKS.on = true;   // Cooking 99's unlocks: ingredients kept now and then (seed.mjs turns them off)
  const range = station(g, 'range');
  standBy(g, range);
  setLevel(g, 'cooking', 99);
  const said = listen(g);
  g.inventory.add('raw_chicken', 5); g.inventory.add('raw_anchovy', 200); g.inventory.add('raw_trout', 3);
  assert.ok(g.startAll('cook', range));
  oneTick(g);
  assert.equal(g.inventory.count('raw_chicken') + g.inventory.count('raw_anchovy') + g.inventory.count('raw_trout'), 0, 'everything cooked at once');
  // A kept fish is cooked again, so there can be more out than went in.
  assert.ok(g.inventory.count('trout') >= 3 && g.inventory.count('cooked_chicken') >= 5);
  assert.ok(g.inventory.count('anchovy') > 200, `kept anchovies cooked again (${g.inventory.count('anchovy')})`);
  const lines = said.filter((m) => /^You cook /.test(m));
  assert.equal(lines.length, 3, `one line per kind (${said.join(' | ')})`);
  assert.ok(lines.some((m) => /materials kept \d+ times?/.test(m)), 'kept materials told in the summary');
  assert.ok(!said.includes('Skill unlock: you keep your materials.'), 'not a line each');
  assert.equal(g.player.action, null);
});

test('"Fletch all" still skips upgrade recipes, and a batch never makes past what the inputs allow', () => {
  const g = newGame();
  const bench = station(g, 'fletch');
  standBy(g, bench);
  if (!g.hasTool('knife')) g.inventory.add('knife', 1);
  setLevel(g, 'fletching', 40);
  const r = FLETCH.find((x) => !x.upgrade && x.level <= 5);
  for (const [id, n] of r.inputs) g.inventory.add(id, n * 4);
  const upgrades = FLETCH.filter((x) => x.upgrade).map((x) => x.result);
  const before = Object.fromEntries(upgrades.map((id) => [id, g.inventory.count(id)]));
  assert.ok(g.startAll('fletching', bench));
  oneTick(g);
  for (const id of upgrades) assert.equal(g.inventory.count(id), before[id], `${id} is only made by choice`);
  for (const [id] of r.inputs) assert.equal(g.inventory.count(id), 0);
  assert.equal(g.player.action, null);
});
