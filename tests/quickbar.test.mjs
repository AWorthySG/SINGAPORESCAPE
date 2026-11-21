// The quick bar (game/quickbar.js, ui/quickbar.js): its default slots, saving
// and loading (older saves have none), what each action calls, the Shift+digit
// keys, and where it sits on a phone.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { saveGame, loadGame, suppressSaves } from '../src/game/save.js';
import { QB_ACTIONS, QB_DEFAULT, QB_SLOTS, quickbarOf, setQuickSlot, loadQuickbar, runQuickAction, bestPotion } from '../src/game/quickbar.js';
import { QuickBar, slotOfKey } from '../src/ui/quickbar.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const quietUi = () => new Proxy({}, { get: () => () => {} });

test('a new game starts with Bank, Next quest, Auto battle and Eat', () => {
  const g = new Game();
  assert.deepEqual(quickbarOf(g), ['bank', 'quest', 'battle', 'eat', null, null]);
  assert.equal(QB_DEFAULT.length, QB_SLOTS);
  // Every default is a real action, with an icon from the existing art.
  for (const k of QB_DEFAULT.filter(Boolean)) assert.ok(QB_ACTIONS[k]?.icon, k);
});

test('the bar saves and loads; an older save without it gets the defaults', () => {
  globalThis.localStorage = fakeStorage();
  suppressSaves(false);
  const g = new Game();
  setQuickSlot(g, 0, 'win:map');
  setQuickSlot(g, 4, 'go:mining');
  setQuickSlot(g, 5, 'not-an-action');   // unknown keys are refused
  assert.ok(saveGame(g));
  const g2 = new Game();
  assert.ok(loadGame(g2));
  assert.deepEqual(quickbarOf(g2), ['win:map', 'quest', 'battle', 'eat', 'go:mining', null]);

  // An older save: no quickbar field at all.
  const g3 = new Game();
  g3.quickbar = undefined;
  assert.ok(saveGame(g3));
  const g4 = new Game();
  assert.ok(loadGame(g4));
  assert.deepEqual(quickbarOf(g4), QB_DEFAULT);
  // Junk in a save is cleaned, never trusted.
  assert.deepEqual(loadQuickbar(['eat', 42, 'nope']), ['eat', null, null, null, null, null]);
  assert.deepEqual(loadQuickbar('eat'), QB_DEFAULT);
});

test('each action calls the game method its own button uses', () => {
  const g = new Game();
  const calls = [];
  const spy = (name, ret = true) => (...a) => { calls.push([name, ...a]); return ret; };
  Object.assign(g, {
    goToNearest: spy('goToNearest'), goToObject: spy('goToObject'), questTravel: spy('questTravel'),
    toggleAutoBattle: spy('toggleAutoBattle'), toggleAutoGather: spy('toggleAutoGather'), toggleAutoQuest: spy('toggleAutoQuest'),
    equipBest: spy('equipBest', 1), eatItem: spy('eatItem'), drinkPotion: spy('drinkPotion'),
  });
  g.teleports = { start: spy('teleport') };
  const ui = { showPanelView: spy('showPanelView'), openWorldMap: spy('openWorldMap'), openBestiary: spy('openBestiary'),
    openMastery: spy('openMastery'), openOfferingShrine: spy('openOfferingShrine'), openCompendium: spy('openCompendium') };
  const last = () => calls.at(-1);

  runQuickAction(g, 'bank', ui); assert.deepEqual(last(), ['goToNearest', ['bank_booth']]);
  runQuickAction(g, 'home', ui); assert.deepEqual(last(), ['teleport', 'town']);
  runQuickAction(g, 'grave', ui); assert.deepEqual(last(), ['teleport', 'grave']);
  runQuickAction(g, 'quest', ui); assert.equal(last()[0], 'questTravel', 'the journal\'s Go on the next quest');
  runQuickAction(g, 'battle', ui); assert.equal(last()[0], 'toggleAutoBattle');
  runQuickAction(g, 'gather', ui); assert.equal(last()[0], 'toggleAutoGather');
  runQuickAction(g, 'autoquest', ui); assert.equal(last()[0], 'toggleAutoQuest');
  runQuickAction(g, 'equip', ui); assert.equal(last()[0], 'equipBest');

  // Eat: the quick-use pick (the F key's), so food that fits the wound.
  g.inventory.add('cooked_chicken', 2);
  g.player.hp = 1;
  runQuickAction(g, 'eat', ui); assert.equal(last()[0], 'eatItem');
  // Potions: the strongest buff not already running, then healing when hurt.
  g.inventory.add('attack_potion', 1);
  g.inventory.add('strength_potion', 1);
  assert.equal(bestPotion(g).id, 'strength_potion');
  g.potions.strength_potion = 60000;
  assert.equal(bestPotion(g).id, 'attack_potion', 'a buff already running is skipped');
  runQuickAction(g, 'potion', ui); assert.equal(last()[0], 'drinkPotion');

  // Windows: panel views light their tab; the rest open their own window.
  runQuickAction(g, 'win:skills', ui); assert.deepEqual(last(), ['showPanelView', 'skills']);
  runQuickAction(g, 'win:prayer', ui); assert.deepEqual(last(), ['showPanelView', 'prayer']);
  runQuickAction(g, 'win:map', ui); assert.equal(last()[0], 'openWorldMap');
  runQuickAction(g, 'win:codex', ui); assert.equal(last()[0], 'openBestiary');
  runQuickAction(g, 'win:mastery', ui); assert.equal(last()[0], 'openMastery');
  runQuickAction(g, 'win:compendium', ui); assert.equal(last()[0], 'openCompendium');
  runQuickAction(g, 'win:shrine', ui); assert.deepEqual(last(), ['goToNearest', ['offering_shrine']], 'away from the shrine: walk there');

  // Skilling spots: the skill guide's Go (a workstation, or the best source you can work).
  runQuickAction(g, 'go:smithing', ui); assert.deepEqual(last(), ['goToNearest', ['furnace', 'anvil']]);
  g.inventory.add('bronze_axe', 1);
  runQuickAction(g, 'go:woodcutting', ui); assert.equal(last()[0], 'goToObject');
  assert.equal(last()[1].objId, 'tree', 'the plain tree a new character can chop');

  assert.equal(runQuickAction(g, 'nope', ui), false);
});

test('the real actions work end to end on a headless game', () => {
  const g = new Game();
  g.ui = quietUi();
  runQuickAction(g, 'battle');
  assert.equal(g.autoBattle, true);
  runQuickAction(g, 'battle');
  assert.equal(g.autoBattle, false);
  g.inventory.add('cooked_chicken', 1);
  g.player.hp = 1;
  runQuickAction(g, 'eat');
  assert.ok(g.player.hp > 1, 'ate');
  assert.ok(runQuickAction(g, 'bank'), 'heads for a bank');
  assert.ok(g.player.isMoving || g.player.action, 'on the way');
});

test('Shift+1 to Shift+6 pick the slots (plain 1-5 still pick the panel tabs)', () => {
  assert.equal(slotOfKey({ code: 'Digit1', shiftKey: true }), 0);
  assert.equal(slotOfKey({ code: 'Digit6', shiftKey: true }), 5);
  assert.equal(slotOfKey({ code: 'Digit7', shiftKey: true }), -1, 'only as many keys as slots');
  assert.equal(slotOfKey({ code: 'Digit1', shiftKey: false }), -1, 'a plain 1 is the Bag tab');
  assert.equal(slotOfKey({ code: 'Digit1', shiftKey: true, ctrlKey: true }), -1);
  // The plain digits are the tab keys in main.js: the bar must not take them.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const map = \{ '1': 'inventory', '2': 'skills', '3': 'combat', '4': 'quests', '5': 'settings' \}/);
});

test('headless: the bar subscribes to its events and draws nothing without a DOM', () => {
  const on = {};
  const game = new Game();
  game.bus = { on: (ev, fn) => { (on[ev] ||= []).push(fn); }, emit() {} };
  const ui = { game };
  const bar = new QuickBar(ui);
  for (const ev of ['quickbar', 'autobattle', 'autogather', 'autoquest', 'inventory']) assert.ok(on[ev]?.length, `listens for ${ev}`);
  assert.doesNotThrow(() => on.quickbar[0]());
  assert.equal(typeof ui.openCompendium, 'function', 'gives the UI a Compendium opener');
  assert.ok(bar);
});

test('phone layout: a column under the Bag button that stops short of Interact; desktop: above the action bar', () => {
  const css = readFileSync(new URL('../styles/qol.css', import.meta.url), 'utf8');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const ch of bare) { if (ch === '{') depth++; else if (ch === '}') { depth--; assert.ok(depth >= 0); } }
  assert.equal(depth, 0, 'every { is closed');
  assert.ok(!/@media \(pointer: coarse\) \{/.test(css), 'no bare touch block');
  const desk = /#quickbar \{([^}]*)\}/.exec(css)[1];
  // Desktop: centred, above the action bar (its top sits ~120px up with the adrenaline bar showing).
  assert.match(desk, /left: 50%/);
  assert.ok(Number(/bottom: (\d+)px/.exec(desk)[1]) >= 125, 'clear of the action bar');
  const at = css.indexOf('@media (pointer: coarse) and (max-width: 540px), (pointer: coarse) and (max-height: 500px) {', css.indexOf('Quick bar'));
  assert.ok(at > 0, 'a phone block');
  const phone = css.slice(at);
  const rule = /#quickbar \{([^}]*)\}/.exec(phone)[1];
  // On a 390x844 phone (measured with Playwright): the folded Bag button ends
  // at y=254, Interact starts at y=583 (261px from the bottom), the minimap
  // and HP orb end by y=184, and the screen's right edge is x=390.
  const top = Number(/top: (\d+)px/.exec(rule)[1]);
  assert.ok(top >= 254 + 6, 'starts under the Bag button');
  const reserve = Number(/max-height: calc\(100dvh - \d+px - (\d+)px\)/.exec(rule)[1]);
  assert.ok(reserve >= 261, 'wraps to a second column before reaching Interact, Attack or the joystick');
  assert.match(rule, /flex-direction: column/);
  assert.match(rule, /flex-wrap: wrap-reverse/, 'a second column grows leftwards, away from the edge');
  const btn = Number(/#quickbar \.qb-btn \{ width: (\d+)px/.exec(phone)[1]);
  assert.ok(btn >= 44, 'finger-sized');
  // The default bar (search, four slots, the pencil) is one column on an 844px
  // phone; a full one wraps into a second column rather than run on down.
  assert.ok(5 * (btn + 6) + 32 <= 844 - top - reserve, 'the default bar is one column');
  assert.ok(8 * (btn + 6) + 32 > 844 - top - reserve, 'a full bar wraps');
  // The chat, the Auto button and the joystick are on the left and bottom: the bar is right-aligned.
  assert.match(rule, /right: calc\(13px/);
  assert.match(rule, /left: auto/);
});
