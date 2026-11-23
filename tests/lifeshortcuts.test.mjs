// The Life skills shortcuts (game/quickbar.js startLifeSkill, ui/quickbar.js
// openLife): a grid of every life skill on the quick bar, where one tap goes to
// the best spot for your level and starts the skill.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { QB_ACTIONS, LIFE_SHORTCUTS, startLifeSkill, lifeShortcutHint, runQuickAction } from '../src/game/quickbar.js';
import { bestGatherNode, bestGatherPick, topGatherSource } from '../src/game/whatnext.js';
import { zoneLevel } from '../src/data/world.js';
import { xpForLevel } from '../src/data/xp.js';
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
  assert.equal(g.autoGatherBest, 'woodcutting', 'and keeps to the best you can gather');
  assert.equal(g.autoGatherStatus(), 'Best Woodcutting: Tree');
  // Even with kinds of your own ticked for auto gather, the shortcut keeps to the best.
  const h = fresh();
  h.inventory.add('bronze_pickaxe', 1);
  h.gatherPicks.add('tree');
  assert.ok(startLifeSkill(h, 'mining'));
  assert.deepEqual([h.autoGather, h.autoGatherBest, h.player.action?.type], [true, 'mining', 'mine']);
});

test('the best you can: auto gather never drops to a lesser node, waits for the best to grow back, and goes further for it', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  g.skills.xp.woodcutting = xpForLevel(8);   // bamboo (8) is the best, ordinary trees (1) all round
  assert.ok(startLifeSkill(g, 'woodcutting'));
  assert.equal(g.player.action.obj.objId, 'bamboo');
  const p = g.playerTile(), d = (o) => Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y));
  const bamboo = g.world.objects.filter((o) => o.objId === 'bamboo');
  // Every bamboo nearby cut down: wait for it to grow back, never an ordinary tree beside you.
  for (const o of bamboo) if (d(o) <= 30) o.depleted = true;
  assert.ok(g.world.objects.some((o) => o.objId === 'tree' && !o.depleted && d(o) <= 30), 'ordinary trees stand nearby');
  assert.equal(g._nextGatherNode('bamboo'), null, 'it waits for the bamboo');
  // With none of the best near you at all, the nearest ready one anywhere (a longer trip).
  const far = bestGatherNode(g, 'woodcutting', { near: 0 });
  assert.equal(far.objId, 'bamboo');
  assert.ok(!far.depleted && d(far) > 30, `the nearest standing bamboo, further off (${d(far)} tiles)`);
  // Without the mode, auto gather took the nearest tree of any kind you could cut (as before).
  g.autoGatherBest = null;
  assert.notEqual(g._nextGatherNode('bamboo'), null);
});

test('the best you can: a level that opens a better source moves you up to it', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  g.skills.xp.woodcutting = xpForLevel(8) - 1;   // level 7: ordinary trees are the best
  assert.ok(startLifeSkill(g, 'woodcutting'));
  assert.equal(g.player.action.obj.objId, 'tree');
  // Chop until a level opens something better (bamboo at 8, oak at 15...): auto gather moves up to it.
  let moved = null;
  for (let i = 0; i < 300 && !moved; i++) {
    g.update(600);
    const o = g.player.action?.obj;
    if (o && o.objId !== 'tree') moved = o;
  }
  assert.ok(g.skills.level('woodcutting') >= 8, 'levelled up');
  assert.ok(moved, 'and moved up from the ordinary trees');
  assert.equal(moved.objId, topGatherSource(g, 'woodcutting').objIds[0], 'to the best your level allows');
  assert.ok(g.said.some((m) => /^Auto gather moves up to the /.test(m)));
});

test('the best you can never takes you into the Wilderness or a region far above your fighting level', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  g.skills.xp.woodcutting = xpForLevel(99);
  const fight = g.fightLevel();
  const safe = (o) => { const z = g.world.zoneAt(o.x, o.y); return !z || (!z.wilderness && zoneLevel(z) <= fight + 10); };
  const pick = bestGatherPick(g, 'woodcutting');
  assert.ok(pick && safe(pick.obj), `${pick?.obj.objId} at ${pick?.obj.x},${pick?.obj.y} is safe for a fighting level ${fight}`);
  // The very best trees stand somewhere unsafe for a new fighter: they are passed over.
  const top = topGatherSource(g, 'woodcutting');
  const unsafeTop = g.world.objects.filter((o) => top.objIds.includes(o.objId)).every((o) => !safe(o));
  if (unsafeTop) assert.notEqual(pick.src, top, 'not the best trees, out in danger');
  assert.ok(safe(bestGatherNode(g, 'woodcutting', { near: 0 })));
});

test('the best you can ends when you choose for yourself', () => {
  const g = fresh();
  g.inventory.add('bronze_axe', 1);
  startLifeSkill(g, 'woodcutting');
  g.toggleGatherPick(['oak']);
  assert.equal(g.autoGatherBest, null, 'ticking your own kinds');
  startLifeSkill(g, 'woodcutting');
  g.toggleAutoGather(false);
  assert.equal(g.autoGatherBest, null, 'switching auto gather off');
  g.inventory.add('bronze_pickaxe', 1);
  startLifeSkill(g, 'woodcutting');
  g._addAutoGatherKind(g.world.objects.find((o) => o.objId === 'copper_rock'));
  assert.equal(g.autoGatherBest, null, 'gathering another skill');
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
