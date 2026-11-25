// Playfield declutter: which world labels show (Smart / All / Off), the short
// overhead tag on your target, merged tiny hitsplats, and first-time tips that
// show once per save with an off switch. All headless.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, clearSave, snapshot } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { NPC } from '../src/game/npc.js';
import { Renderer } from '../src/render/renderer.js';
import {
  labelMode, nextLabelMode, objectLabelVisible, npcNameVisible, isLabelledObject,
  targetTag, foeDetails, NEAR_LABEL_TILES, NEAR_LABEL_MAX, NEAR_LABEL_MS, objectLabelAlpha,
} from '../src/render/worldlabels.js';
import { TIPS, nextTip, markTipSeen, markAllTipsSeen } from '../src/ui/tips.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const freshGame = () => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
};

/** Stand the player on a free tile with labelled nodes close by. */
function standByNodes(g, type) {
  for (const o of g.world.objects) {
    if (!isLabelledObject(o) || o.def.type !== type) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      const x = o.x + dx, y = o.y + dy;
      if (g.world.inBounds(x, y) && !g.world.isBlocked(x, y)) {
        g.player.x = g.player.tx = x; g.player.y = g.player.ty = y;
        g._nearLabels = null;
        return o;
      }
    }
  }
  throw new Error(`no free tile by a ${type}`);
}

// ---------------- World labels ----------------
test('world labels: Smart shows only the hovered, worked and nearest workable nodes', () => {
  const g = freshGame();
  assert.equal(labelMode(g), 'smart', 'Smart by default');
  const tree = standByNodes(g, 'tree');
  const p = g.player;
  const far = g.world.objects.find((o) => isLabelledObject(o) && Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y)) > 20);
  assert.ok(far, 'a node far away');
  assert.equal(objectLabelVisible(g, far), false, 'a far node has no label');
  // Hovered (or the Interact focus on a phone) and worked nodes are labelled.
  g.hover = { obj: far };
  assert.equal(objectLabelVisible(g, far), true, 'the hovered node shows its name');
  g.hover = null;
  p.action = { type: 'woodcut', obj: far };
  assert.equal(objectLabelVisible(g, far), true, 'the node you are working shows its name');
  p.action = null;
  // Nearby nodes: only with a tool for them, and only the nearest few.
  const hasAxe = g.hasTool('axe');
  const lvlOk = !tree.def.level || g.skills.level(tree.def.skill) >= tree.def.level;
  g.tickCount++;
  assert.equal(objectLabelVisible(g, tree), hasAxe && lvlOk, 'a nearby tree is labelled only if you can chop it');
  const shown = g.world.objects.filter((o) => objectLabelVisible(g, o));
  assert.ok(shown.length <= NEAR_LABEL_MAX, `at most ${NEAR_LABEL_MAX} nearby labels (got ${shown.length})`);
  for (const o of shown) assert.ok(Math.max(Math.abs(o.x - p.x), Math.abs(o.y - p.y)) <= NEAR_LABEL_TILES);
  // No tools at all: no nearby labels, but hover still works.
  g.hasTool = () => false; g.tickCount++;
  assert.equal(g.world.objects.filter((o) => objectLabelVisible(g, o)).length, 0, 'nothing to chop with: no labels');
});

test('world labels: Smart shows a nearby node only briefly, then again when you come back', () => {
  const g = freshGame();
  const tree = standByNodes(g, 'tree');
  g.hasTool = () => true;
  g.skills.level = () => 99;
  g.tickCount++;
  assert.equal(objectLabelVisible(g, tree), true, 'labelled as you reach it');
  g.playMs += NEAR_LABEL_MS - 200;
  assert.ok(objectLabelAlpha(g, tree) > 0 && objectLabelAlpha(g, tree) < 1, 'fading near the end');
  g.playMs += 400;
  assert.equal(objectLabelVisible(g, tree), false, 'gone after a few seconds');
  g.hover = { obj: tree };
  assert.equal(objectLabelAlpha(g, tree), 1, 'hovering still shows it');
  g.hover = null;
  // Walk away and back: it shows again.
  const p = g.player, hx = p.x, hy = p.y;
  p.x = p.tx = hx + 40; g.tickCount++;
  assert.equal(objectLabelVisible(g, tree), false);
  p.x = p.tx = hx; p.y = p.ty = hy; g.tickCount++;
  assert.equal(objectLabelVisible(g, tree), true, 'shown again on return');
});

test('world labels: All shows every node and creature name, Off shows none', () => {
  const g = freshGame();
  const labelled = g.world.objects.filter(isLabelledObject);
  assert.ok(labelled.length > 50);
  g.worldLabels = 'all';
  assert.ok(labelled.every((o) => objectLabelVisible(g, o)), 'All labels every node');
  const npcs = g.npcs.filter((n) => n.alive);
  assert.ok(npcs.every((n) => npcNameVisible(g, n)), 'All names every creature');
  g.worldLabels = 'off';
  const boss = g.npcs.find((n) => n.def.boss);
  g.hover = { obj: labelled[0], npc: boss };
  assert.ok(labelled.every((o) => !objectLabelVisible(g, o)), 'Off: no node labels, even hovered');
  assert.ok(npcs.every((n) => !npcNameVisible(g, n)), 'Off: no names, even bosses');
  // The Settings button cycles Smart -> All -> Off -> Smart.
  assert.deepEqual(['smart', 'all', 'off'].map(nextLabelMode), ['all', 'off', 'smart']);
  g.worldLabels = 'nonsense';
  assert.equal(labelMode(g), 'smart', 'an unknown value falls back to Smart');
});

test('world labels: Smart names only your target, attackers, bosses, champions, quest NPCs and the hovered one', () => {
  const g = freshGame();
  const p = g.player;
  const plain = new NPC('goblin', p.x + 3, p.y, 0, {});
  const other = new NPC('goblin', p.x + 4, p.y, 0, {});
  g.npcs.push(plain, other);
  assert.equal(npcNameVisible(g, plain), false, 'an ordinary monster has no name tag');
  p.target = plain;
  assert.equal(npcNameVisible(g, plain), true, 'your target is named');
  p.target = null;
  other.target = p;
  assert.equal(npcNameVisible(g, other), true, 'something attacking you is named');
  other.target = null;
  g.hover = { npc: plain };
  assert.equal(npcNameVisible(g, plain), true, 'the hovered creature is named');
  g.hover = null;
  plain.champion = true;
  assert.equal(npcNameVisible(g, plain), true, 'champions are named');
  plain.champion = false;
  const boss = g.npcs.find((n) => n.def.boss && n.alive);
  assert.equal(npcNameVisible(g, boss), true, 'bosses are named');
  // A townsperson only when a quest in progress sends you to them.
  const folk = g.npcs.filter((n) => n.alive && !n.attackable && !n.def.boss);
  const guideNpc = folk.find((n) => n.npcId === 'guide');
  assert.ok(guideNpc, 'the Kampong Guide is in town');
  g.quests.bone_collector.state = 'notStarted'; g._questNpcLabels = null;
  for (const id of Object.keys(g.quests)) if (g.quests[id].state === 'active') g.quests[id].state = 'notStarted';
  g.tickCount++;
  assert.equal(npcNameVisible(g, guideNpc), false, 'no quest under way: no name');
  // Start a quest whose guide points at a townsperson, and that person is named.
  let named = null;
  for (const id of Object.keys(g.quests)) {
    g.quests[id].state = 'active';
    if (g.quests[id].stage == null) g.quests[id].stage = 1;
    let gd = null;
    try { gd = g.questGuide(id); } catch { gd = null; }
    if (gd?.kind === 'npc') { named = g.npcs.find((n) => n.npcId === gd.npcId && !n.attackable); if (named) break; }
    g.quests[id].state = 'notStarted';
  }
  assert.ok(named, 'some active quest sends you to a townsperson');
  g.tickCount++;
  assert.equal(npcNameVisible(g, named), true, 'the quest NPC is named');
  assert.ok(folk.filter((n) => npcNameVisible(g, n)).length < folk.length / 2, 'most townsfolk stay unnamed');
});

test('the world labels setting is saved and loaded (older saves: Smart)', () => {
  const g = freshGame();
  g.worldLabels = 'off';
  saveGame(g);
  const again = new Game(); again.start();
  assert.equal(again.worldLabels, 'off', 'kept across a reload');
  again.worldLabels = 'all'; saveGame(again);
  const third = new Game(); third.start();
  assert.equal(third.worldLabels, 'all');
  // A save from before the setting: Smart.
  const data = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete data.settings.worldLabels; delete data.settings.tips; delete data.settings.tipsSeen;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const old = new Game(); old.start();
  assert.equal(old.worldLabels, 'smart');
  assert.equal(old.tipsOn, true, 'tips on for an older save');
  assert.equal(old.tipsFromDevice, true, 'its device-wide seen tips get carried over once');
});

test('the renderer draws every label mode without throwing', () => {
  const g = freshGame();
  const noop = () => {}, grad = { addColorStop: noop };
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
    measureText: () => ({ width: 10 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
  };
  for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'setTransform', 'setLineDash', 'transform', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'fillRect', 'strokeRect',
    'clearRect', 'fillText', 'strokeText', 'drawImage']) ctx[k] = noop;
  g.camera.resize(800, 600);
  g.camera.follow(g.player.x * 32, g.player.y * 32);
  const r = new Renderer(g, {}, ctx);
  const foe = g.npcs.find((n) => n.attackable && n.alive);
  g.player.target = foe; foe.combatLatch = 5;
  for (const mode of ['smart', 'all', 'off']) { g.worldLabels = mode; r.render(1000); }
});

// ---------------- Overhead tag ----------------
test('the overhead tag on your target is short; the details live in foeDetails', () => {
  const g = freshGame();
  const foe = new NPC('goblin', g.player.x + 2, g.player.y, 0, {});
  g.npcs.push(foe);
  const tag = targetTag(g, foe);
  assert.ok([...tag].length <= 4, `short tag: "${tag}"`);
  assert.ok(!/weak|armour|poison/.test(tag), 'no words in the tag');
  foe.wounds = { poison: [1, 2, 3, 4, 5], bleed: [1] };
  const wounded = targetTag(g, foe);
  assert.ok(wounded.includes('☠5'), `one status with its count: "${wounded}"`);
  assert.ok(!wounded.includes('🩸'), 'only the biggest wound is shown');
  assert.ok([...wounded].length <= 7, `still short: "${wounded}"`);
  const long = foeDetails(g, foe);
  for (const bit of ['weak:', 'armour:', 'poisoned ×5', 'bleeding ×1']) assert.ok(long.includes(bit), `details include ${bit}`);
});

// ---------------- Hitsplats ----------------
test('tiny hits from one source merge over a longer window; crits keep their own number', () => {
  const g = freshGame();
  const foe = new NPC('goblin', g.player.x + 2, g.player.y, 0, {});
  foe.hp = foe.maxHp = 1000;
  g.npcs.push(foe);
  g.effects = [];
  const mine = () => g.effects.filter((e) => e.type === 'hitsplat' && e.entity === foe);
  g.addHitsplat(foe, 2, { tint: '#6cc24a' });
  mine()[0].life -= 400;   // 400ms later: past the normal 200ms window
  g.addHitsplat(foe, 3, { tint: '#6cc24a' });
  assert.equal(mine().length, 1, 'tiny ticks from one source share a number');
  assert.equal(mine()[0].dmg, 5);
  g.addHitsplat(foe, 2, { tint: '#d23a3a' });
  assert.equal(mine().length, 2, 'a different source gets its own number');
  // A big hit 400ms after another doesn't merge (only tiny ones do).
  g.effects = []; foe._lastSplat = null;
  g.addHitsplat(foe, 300);
  mine()[0].life -= 400;
  g.addHitsplat(foe, 300);
  assert.equal(mine().length, 2, 'big hits apart in time keep their own numbers');
  // Crits never fold into a plain number.
  g.addHitsplat(foe, 2, { crit: true });
  g.addHitsplat(foe, 2, { critX: 2 });
  assert.equal(mine().length, 4, 'crits stand apart');
  // Fan slots alternate rows so neighbours don't overlap.
  const rows = mine().map((e) => e.row);
  for (let i = 1; i < rows.length; i++) assert.notEqual(rows[i], rows[i - 1], 'back-to-back numbers sit on different rows');
});

// ---------------- Tips ----------------
test('each tip shows once per save, and Tips: Off stops them', () => {
  const g = freshGame();
  g.tickCount = 10;
  g.cine.title = null;   // the arrival title card has had its turn (tips wait for it: see below)
  assert.equal(g.tipsOn, true, 'on by default');
  const first = nextTip(g);
  assert.equal(first, 'move', 'the first tip is how to move');
  markTipSeen(g, first);
  assert.notEqual(nextTip(g), 'move', 'never the same tip twice');
  // Seen tips are saved with the character.
  saveGame(g);
  const again = new Game(); again.start();
  assert.ok(again.tipsSeen.has('move'), 'seen tips survive a reload');
  assert.equal(again.tipsFromDevice, false);
  again.tickCount = 10;
  assert.notEqual(nextTip(again), 'move');
  // The off switch.
  again.tipsOn = false;
  again.hazards.push({});   // even the urgent dodge tip
  assert.equal(nextTip(again), null, 'no tips while off');
  again.hazards.length = 0;
  saveGame(again);
  const third = new Game(); third.start();
  assert.equal(third.tipsOn, false, 'Tips: Off is saved');
  // Every tip seen: nothing left to show.
  third.tipsOn = true; markAllTipsSeen(third); third.tickCount = 500;
  assert.equal(nextTip(third), null);
  assert.equal(snapshot(third).settings.tipsSeen.length, Object.keys(TIPS).length);
  // A new character starts with every tip unseen.
  const fresh = freshGame();
  assert.equal(fresh.tipsSeen.size, 0);
});

test('a tip waits while a region title card or a boss entrance is up (only the boss-marker tip cuts in)', () => {
  const g = freshGame();
  g.tickCount = 10;
  g.cine.title = { name: 'Kampong Glam', sub: '', t: 0 };
  assert.equal(nextTip(g), null, 'the move tip waits for the title card');
  g.hazards.push({ x: 0, y: 0 });
  assert.equal(nextTip(g), 'dodge', 'the boss marker tip is urgent');
  g.hazards.length = 0;
  g.cine.title = null; g.cine.intro = { name: 'Boss', level: 1, t: 0 };
  assert.equal(nextTip(g), null, 'and for a boss entrance banner');
  g.cine.intro = null;
  assert.equal(nextTip(g), 'move', 'then it shows');
});
