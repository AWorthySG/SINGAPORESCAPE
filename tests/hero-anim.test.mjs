// Hero animation clips (src/render/heroanim.js): every life-skill action and
// every weapon type has a clip, clips are well formed, and drawing a hero in
// each of them (every class rig, and the single-picture fallback) never throws.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_WEAPON_TYPES } from '../src/data/items.js';
import { CLASSES } from '../src/data/classes.js';
import {
  HERO_CLIPS, HERO_CHANNELS, SKILL_ACTION_TYPES, WEAPON_CLIP, actionClipId, actionPropId, weaponClipId,
  sampleHeroClip, heroAnimFrame, blendHeroFrame, CLIP_BLEND_MS,
} from '../src/render/heroanim.js';
import { drawPlayer } from '../src/render/sprites.js';

// One representative action of each kind (and each variant a clip depends on).
const ACTIONS = [
  { type: 'woodcut', obj: {} }, { type: 'mine', obj: {} },
  ...['net', 'rod', 'lobster_pot', 'harpoon'].map((tool) => ({ type: 'fish', obj: { def: { tool } } })),
  { type: 'cook', rawId: 'raw_barramundi' }, { type: 'cookdish' }, { type: 'smelt', recipe: { inputs: [{ id: 'copper_ore', qty: 1 }] } },
  { type: 'smith' }, { type: 'craft', recipe: { tool: 'chisel' } }, { type: 'hunt' },
  { type: 'recipe', skill: 'fletching', recipe: { inputs: [['logs', 1]] } }, { type: 'recipe', skill: 'herblore', recipe: { inputs: [['vial', 1]] } },
  { type: 'firemake' }, { type: 'farm', obj: {} }, { type: 'farm', seed: 'durian_seed', obj: {} }, { type: 'farm', obj: { crop: 'x', growLeft: 0 } },
  { type: 'thieve' }, { type: 'stall' },
  ...['agility_balance', 'agility_net', 'agility_rope', 'agility_ledge', 'agility_zip', 'agility_course'].map((objId) => ({ type: 'agility', obj: { objId } })),
  { type: 'pray' }, { type: 'rest' }, { type: 'bury' }, { type: 'offer' },
];

test('every life-skill action and variant maps to its own clip', () => {
  for (const type of SKILL_ACTION_TYPES) assert.ok(ACTIONS.some((a) => a.type === type), `${type} is exercised`);
  const ids = new Set();
  for (const a of ACTIONS) {
    const id = actionClipId(a);
    assert.ok(id && HERO_CLIPS[id], `${a.type} -> ${id}`);
    assert.ok(HERO_CLIPS[id].hands, `${id} is acted with tool-holding arms`);
    ids.add(id);
  }
  assert.ok(ids.size >= 25, `distinct clips for the variants (${ids.size})`);
  assert.equal(actionClipId({ type: 'walk' }), null, 'walking and talking are not life skills');
  assert.equal(actionClipId({ type: 'farm', obj: { crop: 'x', growLeft: 5 } }), null, 'looking at a growing crop needs no clip');
});

test('the hero holds the right tool for the job', () => {
  const game = { equipment: { get: () => null }, inventory: { slots: [] } };
  assert.equal(actionPropId(game, { type: 'woodcut' }), 'bronze_axe');
  assert.equal(actionPropId(game, { type: 'mine' }), 'bronze_pickaxe');
  assert.equal(actionPropId(game, { type: 'fish', obj: { def: { tool: 'harpoon' } } }), 'harpoon');
  assert.equal(actionPropId(game, { type: 'fish', obj: { def: { tool: 'rod' } } }), 'fishing_rod');
  assert.equal(actionPropId(game, { type: 'smith' }), 'hammer');
  assert.equal(actionPropId(game, { type: 'cook', rawId: 'raw_barramundi' }), 'raw_barramundi');
  assert.equal(actionPropId(game, { type: 'recipe', skill: 'fletching' }), 'knife');
  assert.equal(actionPropId(game, { type: 'smelt', recipe: { inputs: [{ id: 'copper_ore', qty: 1 }] } }), 'copper_ore');
  // The axe actually wielded wins over the default.
  const wielding = { equipment: { get: () => 'bronze_axe' }, inventory: { slots: [] } };
  assert.equal(actionPropId(wielding, { type: 'woodcut' }), 'bronze_axe');
});

test('every weapon type (main and secondary) has an attack clip', () => {
  for (const type of ALL_WEAPON_TYPES) {
    assert.ok(WEAPON_CLIP[type], `${type} has a clip`);
    assert.ok(HERO_CLIPS[weaponClipId(type)], `${type} clip exists`);
  }
  assert.equal(weaponClipId('dagger', true), 'stab_dual', 'dual daggers alternate hands');
  assert.equal(weaponClipId(null), 'punch', 'bare fists punch');
  const distinct = new Set(ALL_WEAPON_TYPES.map((t) => weaponClipId(t)));
  assert.ok(distinct.size >= 24, `weapon types have distinct choreography (${distinct.size})`);
});

test('clips stay finite; attacks start and end at rest; loops close', () => {
  for (const [id, clip] of Object.entries(HERO_CLIPS)) {
    for (let i = 0; i <= 50; i++) {
      const f = sampleHeroClip(id, i / 50);
      for (const ch of HERO_CHANNELS) assert.ok(Number.isFinite(f.ch[ch]), `${id}/${ch}`);
    }
    if (clip.loop) {
      const a = sampleHeroClip(id, 0).ch, b = sampleHeroClip(id, 1).ch;
      for (const ch of HERO_CHANNELS) assert.ok(Math.abs(a[ch] - b[ch]) < 1e-9, `${id}/${ch} loops without a jump`);
    }
  }
  for (const id of new Set([...Object.values(WEAPON_CLIP), 'stab_dual', 'punch'])) {
    for (const u of [0, 1]) {
      const f = sampleHeroClip(id, u).ch;
      for (const ch of HERO_CHANNELS) if (ch !== 'trail') assert.ok(Math.abs(f[ch]) < 1e-9, `${id}/${ch} rests at ${u}`);
    }
    const moves = Array.from({ length: 21 }, (_, i) => sampleHeroClip(id, i / 20).ch)
      .some((c) => HERO_CHANNELS.some((ch) => ch !== 'trail' && Math.abs(c[ch]) > 0.3));
    assert.ok(moves, `${id} actually moves`);
  }
});

test('the spear thrust only pierces (no arc) while the warhammer comes down hard', () => {
  let maxReach = 0, minReach = 0;
  for (let i = 0; i <= 50; i++) {
    const c = sampleHeroClip('thrust', i / 50).ch;
    assert.ok(Math.abs(c.sword) < 1e-9, 'the spear never rotates');
    maxReach = Math.max(maxReach, c.reach); minReach = Math.min(minReach, c.reach);
  }
  assert.ok(minReach < -1 && maxReach > 10, 'draws back, then drives forward');
  const hammer = (u) => sampleHeroClip('smash', u).ch;
  assert.ok(hammer(0.45).sword < -0.9 && hammer(0.68).sword > 1.8, 'a long lift, then the slam');
  assert.ok(hammer(0.7).squash > 0.08, 'the body squashes as it lands');
});

test('a life-skill strike lands on the game tick that pays out', async () => {
  const { Game } = await import('../src/game/game.js');
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  const p = g.player;
  const tree = g.world.objects.find((o) => o.def.type === 'tree');
  p.x = tree.x + 1; p.y = tree.y; p.stopNow();
  p.setAction({ type: 'woodcut', obj: tree });
  g.tickAcc = 0;   // the instant the tick resolves (and the logs arrive)
  const f = heroAnimFrame(g, 10000);
  assert.equal(f.id, 'woodcut');
  assert.equal(f.kind, 'skill');
  assert.equal(f.tool, 'bronze_axe');
  assert.ok(Math.abs(f.u - HERO_CLIPS.woodcut.beat) < 1e-9, 'the clip is at its beat on the tick');
  assert.equal(p.faceX, -1, 'the hero turns to face the tree on their left');
  // Walking away blends out over a short window rather than snapping.
  p.clearAction();
  p.setPath([{ x: p.x + 1, y: p.y }]); p.moving = true;
  heroAnimFrame(g, 10016);   // the blend starts from the pose on screen
  const mid = heroAnimFrame(g, 10016 + CLIP_BLEND_MS / 2);
  assert.ok(mid.ch.mix > 0.05 && mid.ch.mix < 0.95, 'tool arms fade out across the blend');
  assert.ok(heroAnimFrame(g, 10016 + CLIP_BLEND_MS * 2).ch.mix < 1e-9, 'and are gone after it');
});

test('a beat throws a few world particles, and none in low graphics', async () => {
  const { Game } = await import('../src/game/game.js');
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  heroAnimFrame(g, 0);   // starts listening
  const rock = g.world.objects.find((o) => o.def.type === 'rock');
  g.player.setAction({ type: 'mine', obj: rock });
  const n = g.particles.length;
  g.bus.emit('xp', { skill: 'mining', amount: 10 });
  assert.ok(g.particles.length > n, 'chips and sparks fly');
  g.lowFx = true;
  const m = g.particles.length;
  g.bus.emit('xp', { skill: 'mining', amount: 10 });
  assert.equal(g.particles.length, m, 'low graphics skips the extras');
});

test('restarting a swing blends from the pose on screen', () => {
  const st = { id: null, u: 0, t0: 0, from: null, out: null };
  blendHeroFrame(st, sampleHeroClip('smash', 0.6), 0);
  const restarted = blendHeroFrame(st, sampleHeroClip('smash', 0.02), 16);
  assert.ok(Math.abs(restarted.ch.sword - sampleHeroClip('smash', 0.6).ch.sword) < 0.5, 'no jump back to rest in one frame');
});

function stubCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  const stack = [];
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over', lineCap: '', lineJoin: '',
    save() { stack.push(ctx.globalAlpha); }, restore() { ctx.globalAlpha = stack.pop(); }, translate: noop, scale: noop, rotate: noop, setLineDash: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, rect: noop, quadraticCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, drawImage(img) { if (!img) throw new Error('drawImage without an image'); ctx.images++; },
    createRadialGradient: () => grad, createLinearGradient: () => grad, images: 0,
    get depth() { return stack.length; },
  };
  return ctx;
}

test('drawing every class in every clip works, rigs and pictures alike', () => {
  const previous = globalThis.Image;
  // Every picture "loads" at once, so the rigs, tools and portraits all draw.
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    const ctx = stubCtx();
    const clipIds = Object.keys(HERO_CLIPS);
    for (const { id: jobClass } of CLASSES) {
      for (const id of clipIds) {
        for (const u of [0, 0.3, 0.55, 0.72, 0.95]) {
          const anim = sampleHeroClip(id, u, { tool: HERO_CLIPS[id].hands ? 'bronze_axe' : null, jobClass });
          const before = ctx.images;
          drawPlayer(ctx, 50, 50, { time: 1000, entity: {}, jobClass, hasWeapon: true, weaponType: 'melee', swingK: anim.kind === 'combat' ? u : -1,
            anim, gait: { phase: 0.5, move: 0, run: false, turn: 0 }, facing: { dx: 1, dy: 0 } });
          assert.ok(ctx.images > before, `${jobClass}/${id} drew`);
          assert.equal(ctx.depth, 0, `${jobClass}/${id}: save/restore balanced`);
          assert.equal(ctx.globalAlpha, 1, `${jobClass}/${id}: opacity restored`);
        }
      }
    }
    // A class without a rig (single painted picture) bobs and holds its tool.
    for (const id of clipIds) {
      drawPlayer(ctx, 50, 50, { time: 0, entity: {}, jobClass: 'nobody', hasWeapon: true, weaponType: 'magic', anim: sampleHeroClip(id, 0.5, { tool: 'harpoon' }) });
      assert.equal(ctx.depth, 0);
    }
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
