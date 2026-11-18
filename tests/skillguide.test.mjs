// The skill guides and the Resources index (src/game/skillguide.js,
// src/ui/skillguideui.js). The guides are built from the game data, and these
// tests keep them complete: every recipe under its skill, every recipe output
// and every node's catch in the Resources index, and every recipe input showing
// that recipe in its "Used in" list. A new tree, recipe or crop that the guide
// failed to pick up would fail here.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { SMELT, SMITH } from '../src/data/smithing.js';
import { DISHES } from '../src/data/cooking.js';
import { CRAFT } from '../src/data/crafting.js';
import { CROPS, POTIONS, FLETCH, HUNT, HIDE_CRAFT } from '../src/data/trades.js';
import { NPCS } from '../src/data/npcs.js';
import { COOKING } from '../src/game/skilling.js';
import {
  GUIDE_SKILLS, GATHER_SKILLS, MAKE_SKILLS, COMBAT_SKILLS, SKILL_GUIDES, allRecipes, recipesFor, gatherSources, guideEntries,
  resourceIndex, searchResources, itemEntry, itemSources, recipesUsing, canMake, objectRegions, regionsOf, trainingSpots, bestSpotsFor,
} from '../src/game/skillguide.js';
import { skillListHTML, combatGuideHTML, resourcesListHTML, itemPageHTML, PAGE } from '../src/ui/skillguideui.js';
import { SKILLS } from '../src/data/skills.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  game.ui = new Proxy({}, { get: () => () => {} });
  return game;
}

const indexIds = () => new Set(resourceIndex().map((e) => e.id));
const has = (skill, pred) => recipesFor(skill).some(pred);
const sameInputs = (a, b) => a.length === b.length && a.every((x, i) => x.id === b[i].id && x.qty === b[i].qty);

test('every skill on the Skills tab has a guide', () => {
  for (const s of SKILLS.filter((x) => !x.hidden)) assert.ok(SKILL_GUIDES[s.id], `${s.id} has a guide`);
  assert.deepEqual([...GATHER_SKILLS, ...MAKE_SKILLS, ...COMBAT_SKILLS].sort(), [...GUIDE_SKILLS].sort());
});

test('every recipe in the game appears under its skill, with its level and inputs', () => {
  for (const s of SMELT) assert.ok(has('smithing', (r) => r.kind === 'smelt' && r.output.id === s.result && r.level === s.level && sameInputs(r.inputs, s.inputs)), `smelt ${s.result}`);
  for (const s of SMITH) assert.ok(has('smithing', (r) => r.kind === 'smith' && r.output.id === s.result && r.level === s.level && r.inputs[0].id === s.bar && r.inputs[0].qty === s.barCount), `smith ${s.result}`);
  for (const [raw, c] of Object.entries(COOKING)) assert.ok(has('cooking', (r) => r.output.id === c.result && r.inputs[0].id === raw && r.level === c.level), `cook ${raw}`);
  for (const d of DISHES) assert.ok(has('cooking', (r) => r.kind === 'dish' && r.output.id === d.result && sameInputs(r.inputs, d.inputs)), `dish ${d.result}`);
  for (const c of [...CRAFT, ...HIDE_CRAFT]) assert.ok(has('crafting', (r) => r.output.id === c.result && r.level === c.level && sameInputs(r.inputs, c.inputs)), `craft ${c.result}`);
  for (const f of FLETCH) assert.ok(has('fletching', (r) => r.output.id === f.result && r.level === f.level && sameInputs(r.inputs, f.inputs.map(([id, qty]) => ({ id, qty })))), `fletch ${f.result} at ${f.level}`);
  for (const [id, p] of Object.entries(POTIONS)) assert.ok(has('herblore', (r) => r.output.id === id && r.level === p.level), `brew ${id}`);
  for (const c of CROPS) assert.ok(has('farming', (r) => r.output.id === c[0] && r.inputs[0].id === `${c[0]}_seed` && r.level === c[2]), `crop ${c[0]}`);
  for (const [id, it] of Object.entries(ITEMS)) if (it.tags?.includes('log')) assert.ok(has('firemaking', (r) => r.inputs[0].id === id && r.level === (it.firemaking || 1)), `burn ${id}`);
  // Crafting's hide recipes are listed once, not twice.
  for (const h of HIDE_CRAFT) assert.equal(recipesFor('crafting').filter((r) => r.output.id === h.result && r.level === h.level).length, 1, `${h.result} once`);
});

test('every gathering node, catch, trap, stall, obstacle and mark is in its guide', () => {
  const src = gatherSources();
  for (const [id, d] of Object.entries(OBJECTS)) {
    if (d.type === 'tree' || d.type === 'rock' || d.type === 'stall' || d.type === 'hunt' || (d.type === 'agility' && d.skill === 'agility')) {
      assert.ok(src.some((s) => s.objIds?.includes(id) && s.level === (d.level || 1)), `${id} is a source`);
    }
    if (d.type === 'fishing') for (const c of d.catches) assert.ok(src.some((s) => s.objIds?.includes(id) && s.gives[0].id === c.id && s.level === c.level), `${id}: ${c.id}`);
  }
  for (const id of Object.keys(HUNT)) assert.ok(guideEntries('hunter').some((e) => e.objIds?.includes(id)));
  for (const [id, n] of Object.entries(NPCS)) if (n.thieving) assert.ok(src.some((s) => s.npcId === id && s.level === n.thieving.level), `pickpocket ${id}`);
  // Every source names a real item for everything it gives, with a sensible chance.
  for (const s of src) for (const g of s.gives) {
    assert.ok(ITEMS[g.id], `${s.key} gives a real item (${g.id})`);
    assert.ok(g.chance > 0 && g.chance <= 1, `${s.key}: ${g.id} chance`);
  }
});

test('completeness: every recipe output and every node\'s catch is in the Resources index', () => {
  const idx = indexIds();
  for (const r of allRecipes()) {
    if (r.output) assert.ok(idx.has(r.output.id), `${r.output.id} (made by ${r.skill}) is in the index`);
    for (const i of r.inputs) assert.ok(idx.has(i.id), `${i.id} (an input to ${r.output?.id || r.skill}) is in the index`);
  }
  for (const s of gatherSources()) for (const g of s.gives) if (g.id !== 'coins') assert.ok(idx.has(g.id), `${g.id} (from ${s.name}) is in the index`);
  for (const e of resourceIndex()) assert.ok(ITEMS[e.id], `${e.id} is a real item`);
});

test('completeness: every recipe input lists that recipe under "Used in", and every output lists it under "Made"', () => {
  for (const r of allRecipes()) {
    for (const i of r.inputs) assert.ok(recipesUsing(i.id).includes(r), `${i.id} is used in ${r.output?.id || r.kind}`);
    if (r.output) assert.ok(itemSources(r.output.id).some((s) => s.kind === 'recipe' && s.recipe === r), `${r.output.id} shows how it is made`);
  }
});

test('an item entry: sources, uses one step further, and the "nothing" note', () => {
  const ore = itemEntry('runite_ore');
  assert.ok(ore.sources.some((s) => s.kind === 'node' && s.source.objIds.includes('runite_rock')), 'runite ore is mined');
  assert.ok(ore.sources.some((s) => s.kind === 'drop'), 'and dropped by monsters');
  assert.ok(ore.recipes.some((r) => r.output.id === 'rune_bar'), 'it smelts into a rune bar');
  const chain = ore.then.find((t) => t.via === 'rune_bar');
  assert.ok(chain && chain.makes.includes('rune_platebody') && chain.makes.includes('rune_scimitar'), 'and the bar makes rune gear');
  assert.equal(ore.noUse, false);
  // Bars, seeds, logs and gems all say what they go into.
  assert.ok(itemEntry('coal').recipes.length >= 10, 'coal goes into most bars');
  assert.ok(itemEntry('chilli_seed').recipes.some((r) => r.kind === 'farm'));
  assert.ok(itemEntry('logs').recipes.some((r) => r.kind === 'burn') && itemEntry('logs').recipes.some((r) => r.kind === 'fletch'));
  assert.ok(itemEntry('fine_ash').recipes.some((r) => r.kind === 'brew'), 'ash goes into the endgame brews');
  assert.ok(itemEntry('sapphire').sources.some((s) => s.kind === 'node' && s.source.objIds.includes('gem_rock')));
  assert.ok(itemEntry('feather').sources.some((s) => s.kind === 'shop'), 'feathers can be bought');
  // Non-recipe uses: enchanting, spells, eating.
  assert.ok(itemEntry('upgrade_stone').other.some((o) => o.kind === 'enchant'));
  assert.ok(itemEntry('air_rune').other.some((o) => o.kind === 'spell'));
  assert.ok(itemEntry('shark').other.some((o) => o.kind === 'eat'));
  // Something nobody wants says so.
  const junk = Object.keys(ITEMS).find((id) => itemEntry(id).noUse);
  assert.ok(junk, 'some item has no use');
  const g = newGame();
  assert.match(itemPageHTML(g, junk), /Used in: nothing \(sell it or offer it at the shrine\)/);
});

test('the Resources index searches by name and shelf', () => {
  assert.ok(resourceIndex().length > 300, 'hundreds of resources');
  assert.ok(searchResources('runite').some((e) => e.id === 'runite_ore'));
  assert.ok(searchResources('', 'bar').every((e) => e.id.endsWith('_bar')));
  assert.ok(searchResources('', 'log').some((e) => e.id === 'oak_logs'));
  assert.equal(searchResources('zzzz-no-such').length, 0);
});

test('where things are: regions read from the placed world objects', () => {
  const g = newGame();
  const map = objectRegions(g);
  for (const s of gatherSources()) if (s.objIds) assert.ok(regionsOf(g, s.objIds).length, `${s.key} stands somewhere`);
  assert.ok(map.get('furnace').includes('Kampong Glam'), 'a furnace in town');
  const spots = trainingSpots(g);
  assert.ok(spots.length > 5 && spots.every((s) => s.ids.length && s.p25 <= s.p75));
  assert.ok(bestSpotsFor(g, 30).length > 0, 'somewhere to fight at 30');
});

test('can you make it: level, and inputs in the bag or the bank', () => {
  const g = newGame();
  const bronze = recipesFor('smithing').find((r) => r.output.id === 'bronze_bar');
  for (const id of ['copper_ore', 'tin_ore']) g.inventory.remove(id, g.inventory.count(id));
  assert.equal(canMake(g, bronze).ok, false);
  g.inventory.add('copper_ore', 2); g.inventory.add('tin_ore', 2);
  const c = canMake(g, bronze);
  assert.ok(c.ok && c.levelOk && c.times === 2, 'two bars from the bag');
  g.inventory.remove('tin_ore', 2); g.bank.deposit('tin_ore', 3);
  const b = canMake(g, bronze);
  assert.ok(!b.ok && b.okWithBank && b.inputs.find((i) => i.id === 'tin_ore').bank === 3, 'the bank counts separately');
  const rune = recipesFor('smithing').find((r) => r.output.id === 'rune_bar');
  assert.equal(canMake(g, rune).levelOk, false, 'rune bars need level 85');
});

test('the guide pages render for every skill, a page at a time', () => {
  const g = newGame();
  for (const s of GUIDE_SKILLS) {
    if (COMBAT_SKILLS.includes(s)) {
      const h = combatGuideHTML(g, s);
      assert.ok(h.includes('Best places') || h.includes('Every region'), `${s} shows where to train`);
      continue;
    }
    const all = skillListHTML(g, s, { filter: 'all', search: '', shown: PAGE });
    assert.ok(all.total > 0, `${s} lists something`);
    if (all.total > PAGE) assert.match(all.html, /Show more/, `${s} pages its list`);
    assert.equal((all.html.match(/class="sg-row/g) || []).length, Math.min(PAGE, all.total), `${s} draws one page`);
  }
  assert.match(combatGuideHTML(g, 'attack'), /Passive perks/);
  assert.match(combatGuideHTML(g, 'ranged'), /Gear your level unlocks/);
  const mine = skillListHTML(g, 'mining', { filter: 'all', search: 'runite', shown: PAGE });
  assert.equal(mine.total, 1);
  assert.match(mine.html, /Runite rock/);
  assert.match(mine.html, /data-go="runite_rock"/);
  const smith = skillListHTML(g, 'smithing', { filter: 'kind:smelt', search: '', shown: PAGE });
  assert.ok(smith.total === SMELT.length && /Bronze bar/.test(smith.html));
  assert.ok(resourcesListHTML(g, { search: 'ore', cat: 'all', shown: PAGE }).total > 5);
  assert.match(itemPageHTML(g, 'runite_ore'), /Runite bar then makes/);
});

test('the old flat list still sorts by level and points at real objects', () => {
  for (const s of GUIDE_SKILLS) {
    const e = guideEntries(s);
    assert.ok(e.length > 0, s);
    for (let i = 1; i < e.length; i++) assert.ok(e[i].level >= e[i - 1].level, `${s} sorted`);
    for (const x of e) for (const id of x.objIds || []) assert.ok(OBJECTS[id], `${s}: ${id}`);
  }
});

test('Untick all: clears every auto gather pick, says so, and the save still loads', async () => {
  const { saveGame, loadGame } = await import('../src/game/save.js');
  const { gatherPicksHTML } = await import('../src/ui/skillguideui.js');
  const g = newGame();
  assert.equal(gatherPicksHTML(g), '', 'no bar while nothing is ticked');
  g.toggleGatherPick(['runite_rock']); g.toggleGatherPick(['adamantite_rock']); g.toggleGatherPick(['magic_tree']);
  assert.equal(g.gatherPicks.size, 3);
  assert.match(gatherPicksHTML(g), /3 picked \(Runite rock, Adamantite rock, Magic tree\)[\s\S]*Untick all \(3\)/);
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (t, k) => { said.push(t); return msg(t, k); };
  assert.equal(g.clearGatherPicks(), 3);
  assert.equal(g.gatherPicks.size, 0);
  assert.ok(g.saveSoon);
  assert.ok(said.some((t) => /Cleared your auto gather picks/.test(t)));
  assert.equal(gatherPicksHTML(g), '');
  // A round trip: the empty list saves and loads, and a fresh tick still survives one.
  saveGame(g);
  const g2 = new Game(); g2.start(); assert.ok(loadGame(g2), 'loads');
  assert.equal(g2.gatherPicks.size, 0);
  g2.toggleGatherPick(['copper_rock']);
  saveGame(g2);
  const g3 = new Game(); g3.start(); assert.ok(loadGame(g3));
  assert.deepEqual([...g3.gatherPicks], ['copper_rock']);
});
