// Command search (game/cmdindex.js, ui/cmdsearch.js): fuzzy matching and
// ranking, the lazily built index, and what each kind of result does.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { matchScore, searchCommands, staticEntries, placeEntries, itemEntries, itemVerb } from '../src/game/cmdindex.js';
import { runEntry, entryVerbs, entrySub, CmdSearch } from '../src/ui/cmdsearch.js';
import { closeTopWindow } from '../src/ui/windowease.js';

const top = (g, q) => searchCommands(g, q)[0];

test('matching: whole, start, word start, inside, then letters in order', () => {
  assert.equal(matchScore('bank', 'bank'), 1000);
  assert.ok(matchScore('bank', 'Bank of Singapore') > matchScore('bank', 'Nearest bank'), 'a start beats a later word');
  assert.ok(matchScore('bank', 'Nearest bank') > matchScore('ank', 'Nearest bank'), 'a word start beats the middle of a word');
  assert.ok(matchScore('smlt', 'smelting') > 0, 'letters in order');
  assert.equal(matchScore('smlt', 'melts'), 0, 'not starting a word: no match');
  assert.equal(matchScore('zzz', 'Smithing'), 0);
  assert.ok(matchScore('toman tyrant', 'Toman, the Snakehead Tyrant') > 0, 'every word has to match, in any order');
  assert.equal(matchScore('toman kraken', 'Toman, the Snakehead Tyrant'), 0);
  assert.equal(matchScore('', 'anything'), 0);
});

test('ranking: "smlt" finds Smithing (smelting), "toman" the Toman Tyrant, "bank" the bank', () => {
  const g = new Game();
  assert.deepEqual([top(g, 'smlt').kind, top(g, 'smlt').id], ['skill', 'smithing']);
  const toman = searchCommands(g, 'toman');
  assert.equal(toman[0].id, 'toman_tyrant', 'the boss first');
  assert.ok(toman.slice(1).every((e) => /toman/i.test(e.label)));
  assert.equal(top(g, 'toman tyrant').id, 'toman_tyrant');
  assert.equal(top(g, 'bank').id, 'bank');
  assert.equal(top(g, 'map').id, 'win:map');
  assert.equal(top(g, 'ench').id, 'win:mastery', 'enchanting lives in Gear Mastery');
  assert.equal(top(g, 'refine').id, 'win:mastery', 'so does refining');
  assert.equal(top(g, 'improve').id, 'win:improve', 'every safe upgrade on worn gear');
  assert.equal(top(g, 'bless').id, 'win:prayer');
  assert.equal(top(g, 'chinat').kind, 'place');
  assert.equal(top(g, 'mini').id, 'mining');
  assert.equal(top(g, 'eat').id, 'eat');
  assert.equal(top(g, 'home').id, 'home');
  assert.ok(searchCommands(g, 'e').length <= 8, 'only the best few');
  assert.deepEqual(searchCommands(g, '   '), []);
});

test('the index is built once, places once per world, items afresh each time', () => {
  const g = new Game();
  assert.equal(staticEntries(), staticEntries(), 'the fixed part is cached');
  assert.equal(placeEntries(g), placeEntries(g), 'places are cached on the game');
  assert.ok(placeEntries(g).some((p) => p.label === 'Kampong Glam'));
  assert.equal(itemEntries(g).some((e) => e.id === 'steel_dagger'), false);
  g.inventory.add('steel_dagger', 1);
  g.bank.deposit('steel_dagger', 2);
  const e = itemEntries(g).find((x) => x.id === 'steel_dagger');
  assert.deepEqual([e.bag, e.bank], [1, 2], 'where it is: bag and bank');
  assert.equal(top(g, 'steel dag').id, 'steel_dagger');
  assert.match(entrySub(g, e), /bag ×1 · bank ×2/);
});

test('each kind of result does what its button says', () => {
  const g = new Game();
  const calls = [];
  const spy = (name) => (...a) => { calls.push([name, ...a]); return true; };
  Object.assign(g, { questTravel: spy('questTravel'), travelToTile: spy('travelToTile'), goToNearest: spy('goToNearest'),
    goToObject: spy('goToObject'), toggleAutoBattle: spy('toggleAutoBattle'), equipItem: spy('equipItem'),
    eatItem: spy('eatItem'), drinkPotion: spy('drinkPotion') });
  const ui = { game: g, openSkillGuide: spy('openSkillGuide'), showPanelView: spy('showPanelView'), openWorldMap: spy('openWorldMap'),
    openBestiary: spy('openBestiary'), openMastery: spy('openMastery') };
  const last = () => calls.at(-1);
  const pick = (q, kind) => searchCommands(g, q).find((e) => e.kind === kind);

  runEntry(ui, pick('mastery', 'window')); assert.equal(last()[0], 'openMastery');
  runEntry(ui, pick('auto battle', 'action')); assert.equal(last()[0], 'toggleAutoBattle');
  const sk = pick('smith', 'skill');
  assert.deepEqual(entryVerbs(g, sk), ['Guide', 'Go']);
  runEntry(ui, sk); assert.deepEqual(last(), ['openSkillGuide', 'smithing']);
  runEntry(ui, sk, true); assert.deepEqual(last(), ['goToNearest', ['furnace', 'anvil']], 'Go: the skill guide\'s Go');
  const q = pick('last kampong', 'quest');
  runEntry(ui, q); assert.deepEqual(last(), ['questTravel', q.id]);
  runEntry(ui, q, true); assert.deepEqual(last(), ['showPanelView', 'quests']);
  const place = pick('kampong glam', 'place');
  runEntry(ui, place); assert.equal(last()[0], 'travelToTile');
  runEntry(ui, place, true); assert.equal(last()[0], 'openWorldMap');
  assert.equal(last()[1].label, 'Kampong Glam');
  runEntry(ui, pick('toman', 'monster')); assert.deepEqual(last(), ['openBestiary', 'toman_tyrant']);

  // Items: equip, eat or drink from the bag; fetch from the bank; else the Codex page.
  g.inventory.add('steel_dagger', 1);
  g.inventory.add('cooked_chicken', 1);
  g.inventory.add('attack_potion', 1);
  g.bank.deposit('ruby', 1);
  const it = (q) => pick(q, 'item');
  assert.equal(itemVerb(g, it('steel dagger')), 'equip');
  runEntry(ui, it('steel dagger')); assert.equal(last()[0], 'equipItem');
  runEntry(ui, it('chicken')); assert.equal(last()[0], 'eatItem');
  runEntry(ui, it('attack potion')); assert.equal(last()[0], 'drinkPotion');
  assert.equal(itemVerb(g, it('ruby')), 'bank');
  runEntry(ui, it('ruby')); assert.deepEqual(last(), ['goToNearest', ['bank_booth']], 'heads to the bank');
});

test('headless: the search box does nothing without a DOM; Esc closes it before any window', () => {
  const g = new Game();
  const cs = new CmdSearch({ game: g });
  assert.equal(cs.isOpen(), false);
  assert.doesNotThrow(() => cs.open('bank'));
  // Esc's chain (windowease.js): the open search box goes first, then the window under it.
  let open = true, closedWindow = false;
  const ui = { cmdSearch: { isOpen: () => open, close: () => { open = false; } }, modal: { title: 'Bank' }, closeModal: () => { closedWindow = true; } };
  assert.equal(closeTopWindow(ui), 'search');
  assert.equal(closedWindow, false, 'the window under it stays open');
  assert.equal(closeTopWindow(ui), 'window');
});
