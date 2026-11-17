// Hero animation clips (src/render/heroanim.js): every life-skill action and
// every weapon type has a clip, clips are well formed, and drawing a hero in
// each of them (every class rig, and the single-picture fallback) never throws.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_WEAPON_TYPES } from '../src/data/items.js';
import { CLASSES } from '../src/data/classes.js';
import {
  HERO_CLIPS, HERO_CHANNELS, SKILL_ACTION_TYPES, WEAPON_CLIP, DUAL_CLIPS, actionClipId, actionPropId, weaponClipId,
  sampleHeroClip, heroAnimFrame, blendHeroFrame, CLIP_BLEND_MS,
} from '../src/render/heroanim.js';
import { drawPlayer } from '../src/render/sprites.js';
import { ITEMS } from '../src/data/items.js';
import { dualType } from '../src/game/equipment.js';

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
  for (const id of new Set([...Object.values(WEAPON_CLIP), ...Object.values(DUAL_CLIPS).flat(), 'punch'])) {
    for (const u of [0, 1]) {
      const f = sampleHeroClip(id, u).ch;
      for (const ch of HERO_CHANNELS) if (ch !== 'trail' && ch !== 'trail2') assert.ok(Math.abs(f[ch]) < 1e-9, `${id}/${ch} rests at ${u}`);
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

// ---------------- Dual wielding and two-handed grips ----------------
const peakAt = (id, ch) => {
  let best = 0, at = -1;
  for (let i = 0; i <= 200; i++) { const v = Math.abs(sampleHeroClip(id, i / 200).ch[ch]); if (v > best) { best = v; at = i / 200; } }
  return { best, at };
};

test('every dual-wield kind has two dual clips, played in turn', () => {
  const kinds = new Set(Object.keys(ITEMS).map(dualType).filter(Boolean));
  assert.deepEqual([...kinds].sort(), Object.keys(DUAL_CLIPS).sort(), 'each kind of weapon that pairs has its own clips');
  for (const kind of kinds) {
    const [a, b] = [weaponClipId(kind, true, 0), weaponClipId(kind, true, 1)];
    assert.ok(HERO_CLIPS[a] && HERO_CLIPS[b] && a !== b, `${kind}: two variants (${a}, ${b})`);
    assert.equal(weaponClipId(kind, true, 2), a, `${kind}: the variants alternate`);
    assert.notEqual(weaponClipId(kind, false), a, `${kind}: a single weapon strikes with one hand`);
  }
});

test('every dual clip strikes with both hands, the off hand landing second', () => {
  for (const [kind, ids] of Object.entries(DUAL_CLIPS)) {
    for (const id of ids) {
      // Guns fire in turn (release is the front gun, kick2 the back one); blades
      // swing the weapon arm (sword) and the back arm, each lunging out on its strike.
      const [main, off] = kind === 'pistol' ? ['release', 'kick2'] : ['strike', 'strike2'];
      assert.ok(peakAt(id, main).best > 0.9, `${id}: the main hand strikes`);
      assert.ok(peakAt(id, off).best > 0.9, `${id}: the off hand strikes`);
      if (kind !== 'pistol') {
        assert.ok(peakAt(id, 'back').best > 1.2, `${id}: the back arm swings through`);
        assert.ok(peakAt(id, 'reach2').best > 2, `${id}: the off hand lunges forward`);
        assert.ok(HERO_CLIPS[id].trail && HERO_CLIPS[id].trail2, `${id}: each blade leaves its swoosh`);
      }
    }
    // The first clip of each pair is main hand then off hand (the order the game deals the hits).
    const [main, off] = kind === 'pistol' ? ['release', 'kick2'] : ['strike', 'strike2'];
    assert.ok(peakAt(ids[0], off).at > peakAt(ids[0], main).at, `${ids[0]}: the off-hand blow lands second`);
  }
  // Claws are a pair too: the back paw has its own strike in the flurry.
  assert.ok(peakAt('flurry', 'strike2').best > 0.9 && peakAt('flurry', 'strike').best > 0.9);
});

test('a dual wielder alternates clips from one attack to the next', () => {
  let sk = -1;
  const game = {
    player: { swingProgress: () => sk, isMoving: false, animMove: 0, action: null },
    equipment: { get: (slot) => (slot === 'weapon' || slot === 'shield' ? 'iron_scimitar' : null), isDualWielding: () => true },
    jobClass: 'corsair',
  };
  const seen = [];
  let t = 1000;
  for (let swing = 0; swing < 4; swing++) {
    for (const k of [0, 0.3, 0.6, 0.9]) { sk = k; const f = heroAnimFrame(game, (t += 16)); if (k === 0.3) seen.push(f.id); }
    sk = -1; heroAnimFrame(game, (t += 16));
  }
  assert.deepEqual(seen, ['scim_dual', 'scim_x', 'scim_dual', 'scim_x']);
  const idle = heroAnimFrame(game, (t += 500));
  assert.equal(idle.offhand, 'iron_scimitar', 'the off-hand weapon is known between attacks too (drawn at rest)');
  assert.equal(idle.weapon, 'scimitar');
});

test('two-handed weapons are gripped by the back hand too', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    const fists = (jobClass, weapon, u) => {
      const ctx = stubCtx();
      let arcs = 0;
      ctx.arc = () => { arcs++; };
      const anim = sampleHeroClip(weaponClipId(weapon), u, { jobClass, weapon, low: true });   // no swooshes: count only fists
      drawPlayer(ctx, 50, 50, { time: 1000, entity: {}, jobClass, hasWeapon: true, weaponType: 'melee', swingK: u, anim,
        gait: { phase: 0, move: 0, run: false, turn: 0 }, facing: { dx: 1, dy: 0 } });
      return arcs;
    };
    for (const [jobClass, weapon] of [['samurai', 'katana'], ['juggernaut', 'warhammer'], ['gladiator', '2h_sword'], ['halberdier', 'halberd']]) {
      for (const u of [0, 0.5, 0.7]) assert.ok(fists(jobClass, weapon, u) > 0, `${jobClass}: both hands on the ${weapon} at ${u}`);
    }
    // A one-handed secondary weapon leaves the back hand free.
    assert.equal(fists('samurai', 'parang', 0.5), 0);
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('drawing every class in every attack clip, dual wielding or not, works', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    const ctx = stubCtx();
    const attacks = [...new Set([...Object.values(WEAPON_CLIP), ...Object.values(DUAL_CLIPS).flat(), 'punch'])];
    for (const { id: jobClass, weapon, style } of CLASSES) {
      for (const id of attacks) {
        for (const dual of [false, true]) {
          for (const u of [0, 0.25, 0.5, 0.62, 0.8, 1]) {
            for (const low of [false, true]) {
              const anim = sampleHeroClip(id, u, { kind: 'combat', jobClass, low, weapon, offhand: dual ? 'iron_dagger' : null });
              drawPlayer(ctx, 50, 50, { time: 1000, entity: {}, jobClass, hasWeapon: true, weaponType: style, swingK: u, anim, dualWield: dual,
                gait: { phase: 0.3, move: 0.5, run: false, turn: 0 }, facing: { dx: 1, dy: 0 } });
              assert.equal(ctx.depth, 0, `${jobClass}/${id}: save/restore balanced`);
              assert.equal(ctx.globalAlpha, 1, `${jobClass}/${id}: opacity restored`);
            }
          }
        }
      }
    }
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
