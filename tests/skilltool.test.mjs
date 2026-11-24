// The tool in the hero's hand while skilling is the one the game works with:
// the best usable axe, pickaxe, rod, harpoon or snare in the pack or wielded
// (src/game/tools.js), so an eternal pickaxe swings an eternal pickaxe. It is
// looked up again when the pack, the gear or a level changes mid-action, and
// a fishing rod is drawn from its own sticker (cut free of its painted float
// and hook) instead of a plain cane, falling back to the cane headless.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { TOOL_KINDS, toolIds } from '../src/data/tooltiers.js';
import {
  actionPropId, heroAnimFrame, sampleHeroClip, attachFishing, drawHeroArm, drawFishingGear, rodPicture,
} from '../src/render/heroanim.js';

function newGame() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];
  return g;
}
const setLevel = (g, skill, lvl) => { g.skills.xp[skill] = xpForLevel(lvl); };
function only(g, ...ids) {
  for (let k = 0; k < g.inventory.slots.length; k++) g.inventory.slots[k] = null;
  g.equipment.slots.weapon = null;
  for (const id of ids) g.inventory.add(id, 1);
}
// The action that works each kind of tool (a fishing spot's tool picks rod or harpoon).
const ACTION = {
  axe: { type: 'woodcut', obj: {} }, pickaxe: { type: 'mine', obj: {} }, snare: { type: 'hunt' },
  rod: { type: 'fish', obj: { def: { tool: 'rod' } } }, harpoon: { type: 'fish', obj: { def: { tool: 'harpoon' } } },
};

test('every tiered tool kind: the hero holds the best one their level allows, bronze to eternal', () => {
  const g = newGame();
  for (const K of TOOL_KINDS) {
    const [first, , , , , , , , , , , top] = toolIds(K.tag);
    only(g, first, top);
    setLevel(g, K.skill, 1);
    assert.equal(actionPropId(g, ACTION[K.tag]), first, `${K.tag}: the eternal one needs level 300`);
    setLevel(g, K.skill, 300);
    assert.equal(actionPropId(g, ACTION[K.tag]), top, `${K.tag}: the eternal one at 300`);
    // Whichever slot it is in: the pack, or wielded.
    only(g, first);
    g.equipment.slots.weapon = top;
    assert.equal(actionPropId(g, ACTION[K.tag]), top, `${K.tag}: wielded`);
  }
  // A mid tier beats a lower one, and a tool the level can't use yet is passed over.
  only(g, 'bronze_pickaxe', 'iron_pickaxe', 'rune_pickaxe');
  setLevel(g, 'mining', 50);
  assert.equal(actionPropId(g, ACTION.pickaxe), 'iron_pickaxe');
  // The one-of-a-kind tools are held too.
  only(g, 'hammer', 'knife', 'tinderbox', 'chisel', 'lobster_pot');
  assert.equal(actionPropId(g, { type: 'smith' }), 'hammer');
  assert.equal(actionPropId(g, { type: 'recipe', skill: 'fletching' }), 'knife');
  assert.equal(actionPropId(g, { type: 'firemake' }), 'tinderbox');
  assert.equal(actionPropId(g, { type: 'craft', recipe: { tool: 'chisel' } }), 'chisel');
  assert.equal(actionPropId(g, { type: 'fish', obj: { def: { tool: 'lobster_pot' } } }), 'lobster_pot');
});

test('mid-action, a better tool picked up or unlocked by a level-up goes into the hand', () => {
  const g = newGame();
  const p = g.player;
  heroAnimFrame(g, 0);   // starts listening to the game
  const rock = g.world.objects.find((o) => o.objId === 'copper_rock');
  only(g, 'bronze_pickaxe');
  setLevel(g, 'mining', 290);
  p.x = rock.x - 1; p.y = rock.y; p.stopNow(); p.fx = p.x; p.fy = p.y;
  p.setAction({ type: 'mine', obj: rock });
  assert.equal(heroAnimFrame(g, 1000).tool, 'bronze_pickaxe');
  // Picked up while mining: still too high a tier, so the bronze one stays.
  g.inventory.add('eternal_pickaxe', 1);
  assert.equal(heroAnimFrame(g, 1050).tool, 'bronze_pickaxe', 'Mining 290 cannot use the eternal pickaxe');
  // The level-up that unlocks it swaps it in on the next frame.
  g.skills.addXp('mining', xpForLevel(300) - g.skills.xp.mining);
  assert.ok(g.skills.level('mining') >= 300);
  assert.equal(heroAnimFrame(g, 1100).tool, 'eternal_pickaxe');
  // Wielding a tool counts too (the gear changes, the pack loses it).
  only(g, 'bronze_pickaxe');
  g.bus.emit('inventory');
  assert.equal(heroAnimFrame(g, 1150).tool, 'bronze_pickaxe');
  g.equipment.slots.weapon = 'jade_pickaxe';
  g.bus.emit('equipment');
  assert.equal(heroAnimFrame(g, 1200).tool, 'jade_pickaxe');
});

/** A drawing context that does nothing but count what it draws. */
function stubCtx() {
  const noop = () => {};
  const stack = [];
  const grad = { addColorStop() {} };
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, lineCap: '', lineJoin: '',
    save() { stack.push(ctx.globalAlpha); }, restore() { ctx.globalAlpha = stack.pop(); }, translate: noop, scale: noop, rotate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, rect: noop, clip: noop, quadraticCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, setLineDash: noop, createRadialGradient: () => grad, createLinearGradient: () => grad,
    drawn: [], drawImage(img) { if (!img) throw new Error('drawImage without an image'); ctx.drawn.push(img); },
    get depth() { return stack.length; },
  };
  return ctx;
}
const rodAnim = (tool, low = false, phase = 'wait') => attachFishing(sampleHeroClip('fish_rod_reel', 0.26, { tool, jobClass: 'rogue', low }),
  { tool: 'rod', phase, k: 0.3, t: 500, tx: 30, ty: 10, n: 0 });

test('headless (no DOM, no pictures) the rod falls back to the plain cane and nothing throws', () => {
  assert.equal(rodPicture('eternal_rod'), null);
  for (const low of [false, true]) {
    const ctx = stubCtx();
    const anim = rodAnim('eternal_rod', low);
    drawHeroArm(ctx, anim, 'back');
    drawHeroArm(ctx, anim, 'front');
    drawFishingGear(ctx, anim, 0, 0);
    assert.equal(ctx.depth, 0, 'save/restore balanced');
    assert.equal(ctx.drawn.length, 0, 'no pictures without a DOM');
  }
});

test('with pictures, the rod in hand is the rod in use, cut free of its float and hook, baked once', () => {
  const prevImage = globalThis.Image, prevDoc = globalThis.document;
  const baked = [];
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 160; this.naturalHeight = 160; } };
  globalThis.document = {
    createElement() {
      const cuts = [], from = [];
      const canvas = { width: 0, height: 0, cuts, from,
        getContext: () => ({ drawImage: (img) => from.push(img.src), clearRect: (x, y, w, h) => cuts.push([x, y, w, h]) }) };
      baked.push(canvas);
      return canvas;
    },
  };
  try {
    for (const id of ['jade_rod', 'fishing_rod']) {
      const pic = rodPicture(id);
      assert.ok(pic, `${id} is baked`);
      assert.deepEqual(pic.from, [`assets/icons/item-${id}.webp`], `${id}: its own sticker`);
      assert.ok(pic.cuts.length >= 1, `${id}: the float and hook are cut away`);
      for (const [x, y, w, h] of pic.cuts) assert.ok(x > pic.width / 2 && y > 0 && w > 0 && h > 0, `${id}: only the right-hand side is cut`);
      assert.equal(rodPicture(id), pic, `${id}: baked once, then reused`);
    }
    assert.equal(baked.length, 2);
    // Drawn in the hand while fishing: two pieces (the tip half bowing) or, in low graphics, one.
    for (const [low, n] of [[false, 2], [true, 1]]) {
      const ctx = stubCtx();
      const anim = rodAnim('jade_rod', low);
      drawHeroArm(ctx, anim, 'front');
      assert.equal(ctx.drawn.filter((d) => d === rodPicture('jade_rod')).length, n, `low ${low}: the rod sticker drawn`);
      drawFishingGear(ctx, anim, 0, 0);
      assert.equal(ctx.depth, 0);
    }
    // Held outside fishing (a clip playing out), the cut rod is shown as well.
    const ctx = stubCtx();
    drawHeroArm(ctx, sampleHeroClip('fish_rod', 0.5, { tool: 'jade_rod', jobClass: 'rogue' }), 'front');
    assert.ok(ctx.drawn.includes(rodPicture('jade_rod')));
  } finally {
    if (prevImage === undefined) delete globalThis.Image; else globalThis.Image = prevImage;
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
  }
});
