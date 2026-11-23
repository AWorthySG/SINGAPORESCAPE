// The Life skills shortcuts (game/quickbar.js startLifeSkill, ui/quickbar.js
// openLife): a grid of every life skill on the quick bar, where one tap goes to
// the best spot for your level and starts the skill.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { QB_ACTIONS, LIFE_SHORTCUTS, startLifeSkill, lifeShortcutHint, runQuickAction } from '../src/game/quickbar.js';
import { QuickBar } from '../src/ui/quickbar.js';
import { LIFE_PERK_SKILLS } from '../src/game/lifeperks.js';

const quietUi = () => new Proxy({}, { get: () => () => {} });
function fresh() {
  const g = new Game();
  g.ui = quietUi();
  g.said = [];
  const msg = g.msg.bind(g);
  g.msg = (t, c) => { g.said.push(t); return msg(t, c); };
  return g;
}
/** Play on until the player has nothing left to do (or `ticks` run out). */
function settle(g, ticks = 400) {
  for (let i = 0; i < ticks && (g.player.action || g.player.isMoving); i++) g.update(600);
}

test('every life skill has a shortcut, in the grid, on the quick bar and in the search', () => {
  for (const s of [...LIFE_PERK_SKILLS, 'agility', 'slayer']) assert.ok(LIFE_SHORTCUTS.includes(s), s);
  for (const s of LIFE_SHORTCUTS) {
    assert.equal(QB_ACTIONS[`life:${s}`]?.group, 'Life skills', s);
    assert.deepEqual(QB_ACTIONS[`life:${s}`].icon, { skill: s });
  }
  assert.equal(QB_ACTIONS['win:life']?.label, 'Life skills', 'the grid itself can sit in a slot');
  let opened = 0;
  runQuickAction(new Game(), 'win:life', { openLifeSkills: () => opened++ });
  assert.equal(opened, 1);
});

test('gathering: walks to the best node you can work and starts on it, with auto gather on', () => {
  const g = fresh();
  assert.equal(startLifeSkill(g, 'woodcutting'), false, 'no axe: nothing to go to');
  assert.match(g.said.at(-1), /nothing for Woodcutting/);
  g.inventory.add('bronze_axe', 1);
  g.toggleAutoBattle(true);
  assert.ok(startLifeSkill(g, 'woodcutting'));
  assert.equal(g.autoBattle, false, 'skilling, not fighting');
  assert.equal(g.autoGather, true, 'it carries on when the tree runs dry');
  assert.equal(g.player.action?.type, 'woodcut');
  assert.equal(g.player.action.obj.objId, 'tree', 'the tree a new character can chop');
  assert.match(lifeShortcutHint(g, 'woodcutting'), /\(lvl 1\)/);
  // Ticked kinds of your own for auto gather are left alone (and it isn't switched on for you).
  const h = fresh();
  h.inventory.add('bronze_pickaxe', 1);
  h.gatherPicks.add('tree');
  assert.ok(startLifeSkill(h, 'mining'));
  assert.equal(h.autoGather, false);
  assert.equal(h.player.action?.type, 'mine');
});

test('making: walks to the nearest station and makes everything you can there', () => {
  const g = fresh();
  assert.equal(lifeShortcutHint(g, 'cooking'), 'Nothing to make yet');
  assert.equal(startLifeSkill(g, 'cooking'), false);
  assert.match(g.said.at(-1), /nothing you can cook/);
  g.inventory.add('raw_chicken', 3);
  assert.equal(lifeShortcutHint(g, 'cooking'), 'Make everything you can');
  assert.ok(startLifeSkill(g, 'cooking'));
  assert.equal(g.player.action?.all, 'cook', 'a "Cook all"');
  assert.ok(['range', 'fire'].includes(g.player.action.obj.def.type));
  settle(g);
  assert.equal(g.inventory.count('raw_chicken'), 0, 'all three cooked (or burnt) once there');
  // Smithing: ore goes to the furnace first; bars, with a hammer, to the anvil.
  const s = fresh();
  s.inventory.add('copper_ore', 1); s.inventory.add('tin_ore', 1);
  assert.ok(startLifeSkill(s, 'smithing'));
  assert.deepEqual([s.player.action?.all, s.player.action.obj.def.type], ['smelt', 'furnace']);
  const t = fresh();
  t.inventory.add('hammer', 1); t.inventory.add('bronze_bar', 5);
  assert.ok(startLifeSkill(t, 'smithing'));
  assert.deepEqual([t.player.action?.all, t.player.action.obj.def.type], ['smith', 'anvil']);
  const n = fresh();
  assert.equal(startLifeSkill(n, 'fletching'), false);
  assert.match(n.said.at(-1), /nothing you can fletch/);
});

test('firemaking: asks how many logs go on the fire, or lights them all with no window to ask in', () => {
  const g = fresh();
  assert.equal(lifeShortcutHint(g, 'firemaking'), 'No logs to burn');
  g.inventory.add('tinderbox', 1); g.inventory.add('logs', 3);
  assert.equal(lifeShortcutHint(g, 'firemaking'), 'Light a fire from your logs');
  let asked = 0;
  assert.ok(startLifeSkill(g, 'firemaking', { askFireLogs: () => asked++ }));
  assert.equal(asked, 1, 'the fire window: how many logs, or all of them');
  assert.ok(startLifeSkill(g, 'firemaking', null));
  assert.equal(g.player.action?.type, 'firemake');
  settle(g, 20);
  assert.equal(g.inventory.count('logs'), 0, 'all three on one fire');
});

test('farming: the patch that needs you, a ready crop before an empty patch', () => {
  const g = fresh();
  assert.equal(startLifeSkill(g, 'farming'), false, 'no seeds and nothing ready');
  g.inventory.add('chilli_seed', 2);
  assert.equal(lifeShortcutHint(g, 'farming'), 'Plant your seeds');
  assert.ok(startLifeSkill(g, 'farming'));
  assert.equal(g.player.action?.type, 'farm');
  // A crop ready to pick wins, even a patch further away.
  const p = g.playerTile();
  const patches = g.world.objects.filter((o) => o.def?.type === 'farm').sort((a, b) => ((b.x - p.x) ** 2 + (b.y - p.y) ** 2) - ((a.x - p.x) ** 2 + (a.y - p.y) ** 2));
  const far = patches[0];
  far.crop = 'chilli'; far.growLeft = 0;
  assert.equal(lifeShortcutHint(g, 'farming'), 'A crop is ready to pick');
  assert.ok(startLifeSkill(g, 'farming'));
  assert.equal(g.player.action.obj, far);
});

test('slayer, thieving and agility: off to Rajan for a task, or the best spot', () => {
  const g = fresh();
  assert.ok(startLifeSkill(g, 'slayer'));
  assert.equal(g.player.action?.type, 'talk');
  assert.equal(g.player.action.npc.npcId, 'slayer_master');
  const h = fresh();
  assert.ok(startLifeSkill(h, 'agility'));
  assert.ok(h.player.action || h.player.isMoving, 'on the way to a course');
});

test('the Life skills button opens the grid: every skill, its level and what a tap does', () => {
  const g = fresh();
  let title = '', body = null;
  const ui = { game: g, openModal: (t, draw) => { title = t; body = { innerHTML: '', querySelectorAll: () => [] }; draw(body); }, closeModal() {} };
  const bar = new QuickBar(ui);
  assert.equal(typeof ui.openLifeSkills, 'function');
  ui.openLifeSkills();
  assert.equal(title, 'Life skills');
  for (const s of LIFE_SHORTCUTS) assert.ok(body.innerHTML.includes(`data-life="${s}"`), s);
  assert.ok(body.innerHTML.includes('Nothing to make yet'));
  assert.ok(bar);
});
