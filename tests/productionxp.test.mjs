// Making XP (the owner's ask: more XP in Smithing, Fletching, Cooking and
// Crafting): every make pays its recipe's listed XP times the skill's making
// multiple at your level (PRODUCTION_XP_MULT, makeXp in skilling.js), through
// every way of making it (one at a station, a whole batch, "Do all"), and what
// the skill guide and For you show is what lands. Quest rewards and other
// one-off grants of these skills stay as listed.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { XP_RATE, LIFE_XP_BOOST } from '../src/config.js';
import { COOKING, PRODUCTION_XP_MULT, makeXpMult, makeXp, resolveRecipe } from '../src/game/skilling.js';
import { SMELT, SMITH } from '../src/data/smithing.js';
import { CRAFT } from '../src/data/crafting.js';
import { FLETCH, POTIONS } from '../src/data/trades.js';
import { recipesFor } from '../src/game/skillguide.js';
import { realXp } from '../src/ui/skillguideui.js';
import { trainingFor, xpPerHour } from '../src/game/foryou.js';

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
// Level 99: a level is over a million XP wide there, so no batch here levels up
// part-way (the multiple eases with level, so a level-up would move it).
const LVL = 99;
const setLevel = (g, skill, lvl = LVL) => { g.skills.xp[skill] = xpForLevel(lvl); };
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
const station = (g, type) => g.world.objects.find((o) => o.def?.type === type);
function listen(g) {
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (m, c) => { said.push(m); return msg(m, c); };
  return said;
}
// One tick with Math.random pinned high: no perfect cook (8%) and no flawless extra, so each make pays exactly once.
function tick(g) { const r = Math.random; Math.random = () => 0.9; try { g.update(600); } finally { Math.random = r; } }
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

// One recipe of each making skill, worked at its own station: [skill, station type, recipe, start, inputs].
const CASES = [
  ['smithing', 'furnace', SMELT.find((r) => r.result === 'rune_bar'), (g, o, r) => g.startSmelt(r, o), (r) => r.inputs.map((i) => [i.id, i.qty])],
  ['smithing', 'anvil', SMITH.find((r) => r.result === 'rune_platebody'), (g, o, r) => g.startSmith(r, o), (r) => [[r.bar, r.barCount]]],
  ['cooking', 'range', { ...COOKING.raw_shark, raw: 'raw_shark' }, (g, o, r) => g.startCooking(o, r.raw), (r) => [[r.raw, 1]]],
  ['crafting', 'craft', CRAFT.find((r) => r.result === 'dragonhide_body'), (g, o, r) => g.startCraft(r, o), (r) => r.inputs.map((i) => [i.id, i.qty])],
  ['fletching', 'fletch', FLETCH.find((r) => r.result === 'magic_longbow'), (g, o, r) => g.startRecipe('fletching', r, o), (r) => r.inputs],
];

test('the making multiple: each skill is lifted at every level, exact at its listed levels, eased between, held past the last', () => {
  for (const skill of ['smithing', 'cooking', 'crafting', 'fletching']) {
    const t = PRODUCTION_XP_MULT[skill];
    assert.ok(t.length >= 2 && t.every(([l, m], i) => m > 1 && (i === 0 || l > t[i - 1][0])), `${skill}: a rising list of levels, every multiple above 1`);
    for (const [l, m] of t) near(makeXpMult(skill, l), m, `${skill} at ${l}`);
    for (let i = 1; i < t.length; i++) {
      const mid = Math.round(Math.sqrt(t[i - 1][0] * t[i][0]));   // between two listed levels: between their multiples
      const v = makeXpMult(skill, mid), lo = Math.min(t[i - 1][1], t[i][1]), hi = Math.max(t[i - 1][1], t[i][1]);
      assert.ok(v >= lo - 1e-9 && v <= hi + 1e-9, `${skill} at ${mid}: ${v} between ${lo} and ${hi}`);
    }
    const last = t[t.length - 1];
    near(makeXpMult(skill, 9999), last[1], `${skill} past level ${last[0]}`);
  }
  // Every other skill is as listed.
  for (const skill of ['herblore', 'firemaking', 'mining', 'woodcutting', 'fishing', 'attack']) assert.equal(makeXpMult(skill, 500), 1, skill);
});

test('each making skill earns its boosted XP for one make at its station, and the skill guide shows that figure', () => {
  for (const [skill, type, r, start, inputs] of CASES) {
    const g = newGame();
    const obj = station(g, type);
    standBy(g, obj);
    for (const t of ['hammer', 'knife', 'chisel']) if (!g.hasTool(t)) g.inventory.add(t, 1);
    setLevel(g, skill);
    for (const [id, n] of inputs(r)) g.inventory.add(id, n);
    const want = g.skills.xpAtLevel(skill, makeXp(g, skill, r.xp));
    const plain = g.skills.xpAtLevel(skill, r.xp);
    // The skill guide's "+N xp each" for this recipe (skillguideui.js realXp on the guide's row).
    const row = recipesFor(skill).find((x) => x.output?.id === (r.result || COOKING.raw_shark.result) && x.level === r.level);
    near(realXp(g, skill, row.xp), want, `${skill} ${row.output.id}: shown`);
    const xp0 = g.skills.xp[skill];
    start(g, obj, r);
    tick(g);
    near(g.skills.xp[skill] - xp0, want, `${skill} ${row.output.id}: gained`);
    assert.ok(want >= plain * makeXpMult(skill, LVL) * 0.999 && makeXpMult(skill, LVL) > 1.5, `${skill}: more than the listed XP (${want} vs ${plain})`);
  }
});

test('a whole batch and "Do all" pay the boosted XP for every make, and the chat line says it', () => {
  const N = 6;   // (rune platebodies at 13 times their XP: more would level up part-way)
  for (const [skill, type, r, start, inputs] of CASES) {
    for (const all of [false, true]) {
      const g = newGame();
      const obj = station(g, type);
      standBy(g, obj);
      for (const t of ['hammer', 'knife', 'chisel']) if (!g.hasTool(t)) g.inventory.add(t, 1);
      setLevel(g, skill);
      for (const [id, n] of inputs(r)) g.inventory.add(id, n * N);
      const said = listen(g);
      const per = g.skills.xpAtLevel(skill, makeXp(g, skill, r.xp));
      const xp0 = g.skills.xp[skill];
      if (all) g.startAll({ furnace: 'smelt', anvil: 'smith', range: 'cook', craft: 'craft', fletch: 'fletching' }[type], obj);
      else start(g, obj, r);
      tick(g);
      for (const [id] of inputs(r)) assert.equal(g.inventory.count(id), 0, `${skill} ${all ? 'do all' : 'batch'}: every ${id} used`);
      const got = g.skills.xp[skill] - xp0;
      near(got, N * per, `${skill} ${all ? 'do all' : 'batch'}: ${N} makes`);
      // The batch's line tells the XP gained (smelting's line names the bars only).
      if (type !== 'furnace') assert.ok(said.some((m) => m.includes(`+${Math.round(got).toLocaleString('en-GB')} `)), `${skill}: the line says +${Math.round(got)} (${said.join(' | ')})`);
    }
  }
});

test('For you\'s rough hour for a recipe uses the boosted XP; Herblore and quest rewards stay as listed', () => {
  const g = newGame();
  for (const skill of ['smithing', 'cooking', 'crafting', 'fletching']) setLevel(g, skill);
  for (const skill of ['smithing', 'cooking', 'crafting', 'fletching']) {
    const s = trainingFor(g, skill, 1)[0];
    assert.equal(s.xph, xpPerHour(g, skill, makeXp(g, skill, s.xp)), `${skill}: For you`);
  }
  // Herblore has no multiple: a brew pays its listed XP.
  setLevel(g, 'herblore');
  const [id, p] = Object.entries(POTIONS).find(([, x]) => x.level <= LVL);
  for (const [i, n] of p.inputs) g.inventory.add(i, n);
  let xp0 = g.skills.xp.herblore;
  resolveRecipe(g, { skill: 'herblore', recipe: { result: id, qty: 1, inputs: p.inputs, level: p.level, xp: p.xp } });
  near(g.skills.xp.herblore - xp0, p.xp * XP_RATE * LIFE_XP_BOOST, 'herblore: as listed');
  // Quest rewards: Island Provisions' 1500 Cooking and A Smith's Apprentice's 1500 Smithing, as listed.
  g.quests.island_provisions.state = 'active';
  g.inventory.add('salmon', 10);
  xp0 = g.skills.xp.cooking;
  g.turnInProvisions();
  assert.equal(g.quests.island_provisions.state, 'done');
  near(g.skills.xp.cooking - xp0, 1500 * XP_RATE * LIFE_XP_BOOST, 'Island Provisions: as listed');
  g.quests.smith_apprentice.state = 'active';
  g.inventory.add('steel_bar', 8);
  xp0 = g.skills.xp.smithing;
  g.turnInSmith();
  assert.equal(g.quests.smith_apprentice.state, 'done');
  near(g.skills.xp.smithing - xp0, 1500 * XP_RATE * LIFE_XP_BOOST, 'A Smith\'s Apprentice: as listed');
});
