// Hero animation clips (src/render/heroanim.js): every life-skill action and
// every weapon type has a clip, clips are well formed, and drawing a hero in
// each of them (every class rig, and the single-picture fallback) never throws.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_WEAPON_TYPES } from '../src/data/items.js';
import { CLASSES } from '../src/data/classes.js';
import { CONSTRUCT } from '../src/data/construction.js';
import { FLETCH } from '../src/data/trades.js';
import {
  HERO_CLIPS, HERO_CHANNELS, SKILL_ACTION_TYPES, WEAPON_CLIP, DUAL_CLIPS, actionClipId, actionPropId, weaponClipId,
  sampleHeroClip, heroAnimFrame, blendHeroFrame, CLIP_BLEND_MS, FISHING, attachFishing, drawFishingGear, blowMs, strikeClock,
  drawHeroArm, armInFront, propPoint,
} from '../src/render/heroanim.js';
import { OBJECTS } from '../src/data/objects.js';
import { EventBus } from '../src/core/events.js';
import { drawPlayer } from '../src/render/sprites.js';
import { ITEMS } from '../src/data/items.js';
import { dualType } from '../src/game/equipment.js';
import { COMBAT_BEAT_MS } from '../src/config.js';

// One representative action of each kind (and each variant a clip depends on).
const ACTIONS = [
  { type: 'woodcut', obj: {} }, { type: 'mine', obj: {} },
  ...['net', 'rod', 'lobster_pot', 'harpoon'].map((tool) => ({ type: 'fish', obj: { def: { tool } } })),
  { type: 'cook', rawId: 'raw_barramundi' }, { type: 'cookdish' }, { type: 'smelt', recipe: { inputs: [{ id: 'copper_ore', qty: 1 }] } },
  { type: 'smith' }, { type: 'craft', recipe: { tool: 'chisel' } }, { type: 'hunt' }, { type: 'dive' }, { type: 'excavate' },
  ...['arrow_shaft', 'bronze_arrow'].map((result) => ({ type: 'recipe', skill: 'fletching', recipe: FLETCH.find((r) => r.result === result) })),
  { type: 'recipe', skill: 'herblore', recipe: { inputs: [['vial', 1]] } },
  { type: 'recipe', skill: 'archaeology', recipe: { inputs: [['encrusted_relic', 1]] } },
  ...['plank', 'brick', 'wooden_stool'].map((result) => ({ type: 'recipe', skill: 'construction', recipe: CONSTRUCT.find((r) => r.result === result) })),
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
  const arrow = { type: 'recipe', skill: 'fletching', recipe: FLETCH.find((r) => r.result === 'bronze_arrow') };
  const shaft = { ...arrow, recipe: FLETCH.find((r) => r.result === 'arrow_shaft') };
  assert.equal(actionPropId(game, shaft), 'knife');
  assert.equal(actionClipId(shaft), 'fletch');
  assert.equal(actionPropId(game, arrow), 'arrow_shaft');
  assert.equal(actionClipId(arrow), 'craft');
  assert.equal(actionPropId(game, { type: 'smelt', recipe: { inputs: [{ id: 'copper_ore', qty: 1 }] } }), 'copper_ore');
  // The axe actually wielded wins over the default.
  const wielding = { equipment: { get: () => 'bronze_axe' }, inventory: { slots: [] } };
  assert.equal(actionPropId(wielding, { type: 'woodcut' }), 'bronze_axe');
});

test('a cooking flip turns once without spinning backward through the angle wrap', () => {
  let oldAngle = sampleHeroClip('cook', 0.7).ch.prop;
  let total = 0;
  for (let i = 701; i <= 950; i++) {
    const angle = sampleHeroClip('cook', i / 1000).ch.prop;
    const step = Math.atan2(Math.sin(angle - oldAngle), Math.cos(angle - oldAngle));
    assert.ok(step <= 1e-10 && step > -0.08, `smooth, one-way turn at ${i / 1000}`);
    total += step;
    oldAngle = angle;
  }
  assert.ok(Math.abs(total + 2 * Math.PI - 1.2) < 1e-9);
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
  assert.ok(hammer(0.42).sword < -0.9 && hammer(0.6).sword > 1.8, 'a long lift, held, then the slam');
  assert.ok(hammer(0.56).squash > 0.08, 'the body squashes as it lands');
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
  assert.equal(mid.tool, 'bronze_axe', 'the axe fades with the hands');
  const end = heroAnimFrame(g, 10016 + CLIP_BLEND_MS * 2);
  assert.ok(end.ch.mix < 1e-9, 'the arms are gone after it');
  assert.equal(end.tool, null);
});

function actingHero(action) {
  const player = { x: 10, y: 10, faceX: 1, isMoving: false, action, swingProgress: () => -1,
    noteFacing() { this.faceX = this.facing.dx; } };
  return { player, bus: new EventBus(), attackInterval: () => 1 };
}

test('gathering keeps the tool visible and a real attack still takes over immediately', () => {
  const game = actingHero({ type: 'woodcut', obj: { x: 11, y: 10 } });
  game.player.swingProgress = () => 0;
  assert.equal(heroAnimFrame(game, 1000).id, 'woodcut');
  const target = { alive: true };
  game.player.action = { type: 'attack', npc: target };
  game.player.target = target;
  assert.equal(heroAnimFrame(game, 1016).kind, 'combat');
});

test('instant work draws the reported prop and faces its target for one pose', () => {
  const game = actingHero(null);
  heroAnimFrame(game, 0);
  game.bus.emit('skillpose', { id: 'farm_plant', prop: 'durian_seed', target: { x: 9, y: 10 } });
  const pose = heroAnimFrame(game, 16);
  assert.equal(pose.id, 'farm_plant');
  assert.equal(pose.tool, 'durian_seed');
  assert.equal(game.player.faceX, -1);
  assert.equal(heroAnimFrame(game, 700).tool, null, 'the planted seed is left in the soil');
  assert.equal(heroAnimFrame(game, 1000).id, 'idle');
  assert.equal(sampleHeroClip('farm_harvest', 0.5, { tool: 'durian' }).tool, null);
  assert.equal(sampleHeroClip('farm_harvest', 0.8, { tool: 'durian' }).tool, 'durian');
  assert.equal(sampleHeroClip('offer', 0.8, { tool: 'bones' }).tool, null);
});

test('a tree that falls before the first work frame still shows the axe stroke', async () => {
  const { Game } = await import('../src/game/game.js');
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const game = new Game(); game.start();
  const tree = game.world.objects.find((obj) => obj.def.type === 'tree' && obj.def.level === 1 && obj.def.depleteChance > 0);
  const p = game.player;
  p.stopNow(); p.x = p.tx = tree.x + 1; p.y = p.ty = tree.y;
  tree.logsLeft = 1;
  heroAnimFrame(game, 0);
  game.bus.on('xp', () => game.bus.emit('levelup'));
  game.defaultObjectAction(tree);
  game.resolvePlayerAction();
  assert.equal(tree.depleted, true);
  assert.equal(p.action, null);
  assert.equal(heroAnimFrame(game, 16).tool, 'bronze_axe');
});

test('a completed batch can play even when its action was resolved between frames', () => {
  const game = actingHero(null);
  const action = { type: 'cook', rawId: 'raw_trout', obj: { x: 11, y: 10 } };
  heroAnimFrame(game, 0);
  game.bus.emit('skillpose', { action });
  const initial = heroAnimFrame(game, 16);
  assert.equal(initial.id, 'cook');
  assert.equal(initial.tool, 'raw_trout');
  assert.equal(initial.u, 0);
  assert.equal(heroAnimFrame(game, 620).id, 'idle');
});

test('construction shows the real material or tool at each station', () => {
  const obj = { x: 11, y: 10, def: { type: 'homebench' } };
  const recipe = (result) => CONSTRUCT.find((r) => r.result === result);
  const action = { type: 'recipe', skill: 'construction', recipe: recipe('plank'), obj };
  const game = actingHero(action);
  for (const [i, [result, clip, prop]] of [['plank', 'saw', 'logs'], ['wooden_stool', 'build', 'hammer'], ['brick', 'kiln', 'clay']].entries()) {
    action.recipe = recipe(result);
    const f = heroAnimFrame(game, 1000 + i * 600);
    assert.equal(f.id, clip);
    assert.equal(f.tool, prop);
  }
});

test('hawkering stays idle between sales and leaves the sold dish on the counter', () => {
  const obj = { x: 11, y: 10 }, game = actingHero({ type: 'hawk', obj });
  assert.equal(heroAnimFrame(game, 0).id, 'idle');
  game.bus.emit('skillpose', { id: 'serve', prop: 'chicken_rice', target: obj });
  const pose = heroAnimFrame(game, 16);
  assert.equal(pose.id, 'serve');
  assert.equal(pose.tool, 'chicken_rice');
  const handedOver = heroAnimFrame(game, 600);
  assert.equal(handedOver.id, 'serve');
  assert.equal(handedOver.tool, null);
  assert.equal(heroAnimFrame(game, 1000).id, 'idle');
});

test('stall thieving completes the reach once and waits while the stall restocks', () => {
  const obj = { x: 11, y: 10, depleted: false }, action = { type: 'stall', obj };
  const game = actingHero(action);
  assert.equal(heroAnimFrame(game, 0).id, 'stall');
  obj.depleted = true;
  game.bus.emit('skillpose', { action });
  assert.equal(heroAnimFrame(game, 16).id, 'stall');
  assert.equal(heroAnimFrame(game, 1000).id, 'idle');
  assert.equal(heroAnimFrame(game, 1400).id, 'idle');
  obj.depleted = false;
  assert.equal(heroAnimFrame(game, 1500).id, 'stall');
});

test('diving switches to breathing at the surface and returns to reef work', () => {
  const action = { type: 'dive', obj: { x: 11, y: 10 } };
  const game = actingHero(action);
  assert.equal(heroAnimFrame(game, 1000).id, 'dive');
  action.surface = 2;
  assert.equal(heroAnimFrame(game, 1600).id, 'dive_surface');
  action.surface = 0;
  assert.equal(heroAnimFrame(game, 2800).id, 'dive');
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
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, rect: noop, clip: noop, quadraticCurveTo: noop,
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
  assert.deepEqual(seen, ['scim_dual', 'scim_dual_b', 'scim_dual', 'scim_dual_b']);
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

// ---------------- Fishing: cast, wait, haul ----------------
test('every fishing spot\'s tool has its cast, wait and haul clips', () => {
  const tools = new Set(Object.values(OBJECTS).filter((o) => o.type === 'fishing').map((o) => o.tool || 'net'));
  for (const tool of tools) {
    const P = FISHING[tool];
    assert.ok(P, `${tool} is animated`);
    assert.equal(actionClipId({ type: 'fish', obj: { def: { tool } } }), P.wait, `${tool}: the action's clip is its wait`);
    for (const part of ['cast', 'wait', 'haul']) {
      if (part === 'cast' && P.cast === null) continue;   // the harpoon is simply raised and aimed
      const clip = HERO_CLIPS[P[part]];
      assert.ok(clip && clip.hands, `${tool}/${part}: ${P[part]}`);
      assert.equal(clip.loop, part === 'wait', `${tool}/${part}: only the wait loops`);
      assert.ok(typeof clip.dur === 'number' && clip.dur >= 500, `${tool}/${part}: long enough to read`);
    }
    // The parts join without a jump: the wait starts where the cast ends and the haul starts and ends.
    const a = (id, u) => sampleHeroClip(id, u).ch;
    for (const ch of ['hand', 'off', 'prop', 'lean', 'crouch']) {
      assert.ok(Math.abs(a(P.wait, 0)[ch] - a(P.haul, 0)[ch]) < 0.05, `${tool}/${ch}: wait -> haul`);
      const next = P.cast || P.wait;
      assert.ok(Math.abs(a(P.haul, 1)[ch] - a(next, 0)[ch]) < 0.05, `${tool}/${ch}: haul -> ${P.cast ? 'cast' : 'wait'}`);
      if (P.cast) assert.ok(Math.abs(a(P.cast, 1)[ch] - a(P.wait, 0)[ch]) < 0.05, `${tool}/${ch}: cast -> wait`);
    }
  }
  // The rod bows under the fish and strikes up.
  assert.ok(sampleHeroClip('fish_rod_reel', 0.26).ch.bend > 0.8, 'the rod bends on the strike');
});

test('fishing line, bobber, net, pot and harpoon draw for every part, headless or not', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    for (const withTransform of [false, true]) {
      const ctx = stubCtx();
      // A real canvas reports its transform, so the line meets the rod tip exactly.
      if (withTransform) ctx.getTransform = () => ({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 });
      for (const [tool, P] of Object.entries(FISHING)) {
        for (const phase of ['cast', 'wait', 'haul']) {
          const clipId = phase === 'cast' ? P.cast || P.wait : P[phase];
          for (let i = 0; i <= 20; i++) {
            for (const low of [false, true]) {
              for (const jobClass of ['swordsman', 'archer', 'nobody']) {
                const k = i / 20;
                const anim = attachFishing(sampleHeroClip(clipId, k, { tool: 'harpoon', jobClass, low }),
                  { tool, phase, k, t: i * 97, tx: -32, ty: 0, id: i % 2 ? 'raw_pike' : null, n: i });
                drawPlayer(ctx, 50, 50, { time: 1000, entity: {}, jobClass, hasWeapon: true, weaponType: 'melee', swingK: -1, anim,
                  gait: { phase: 0, move: 0, run: false, turn: 0 }, facing: { dx: -1, dy: 0 }, fx: -1 });
                drawFishingGear(ctx, anim, 50, 52);
                assert.equal(ctx.depth, 0, `${tool}/${phase}/${k}: save/restore balanced`);
                assert.equal(ctx.globalAlpha, 1, `${tool}/${phase}/${k}: opacity restored`);
                if (withTransform) assert.ok(anim.fish.hand && anim.fish.tip, `${jobClass}: the hand and tip are marked for the line`);
              }
            }
          }
        }
      }
      drawFishingGear(ctx, sampleHeroClip('idle', 0), 0, 0);   // not fishing: nothing to draw
    }
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('fishing tethers meet the same endpoint on either side of a cast transition', () => {
  const endpoint = (tool, k, hx = 30, hy = 52) => {
    const ctx = stubCtx(), ends = [];
    ctx.getTransform = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    ctx.quadraticCurveTo = (cx, cy, x, y) => ends.push([x, y]);
    const anim = attachFishing(sampleHeroClip(FISHING[tool].cast, k, { low: true }),
      { tool, phase: 'cast', k, tx: 32, ty: 0 });
    anim.fish.hand = [40, 46]; anim.fish.tip = [55, 30];
    drawFishingGear(ctx, anim, hx, hy, 30, 52);
    return ends[0];
  };
  for (const [tool, at] of [['rod', 0.47], ['net', 0.8], ['lobster_pot', 0.62]]) {
    const before = endpoint(tool, at - 1e-6), after = endpoint(tool, at);
    assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) < 0.01, `${tool} keeps its attachment`);
  }
  assert.deepEqual(endpoint('lobster_pot', 0.42), [55, 24], 'the pot leaves from its held centre');
  assert.deepEqual(endpoint('rod', 0.9), endpoint('rod', 0.9, 43, 60), 'the water stays put if the hero is knocked');
});

test('a fishing session waits for a real catch from its own spot', () => {
  const spot = { objId: 'rod_spot', x: 11, y: 10, def: { tool: 'rod' } };
  const game = actingHero({ type: 'fish', obj: spot });
  assert.equal(heroAnimFrame(game, 1000).fish.phase, 'cast');
  assert.equal(heroAnimFrame(game, 2000).fish.phase, 'wait');
  assert.equal(heroAnimFrame(game, 7000).fish.phase, 'wait', 'elapsed time alone does not fabricate a fish');
  game.bus.emit('fishcatch', { id: 'raw_pike', objId: 'other_spot' });
  assert.equal(heroAnimFrame(game, 7016).fish.phase, 'wait');
  game.bus.emit('fishcatch', { id: 'raw_trout', objId: 'rod_spot' });
  assert.equal(heroAnimFrame(game, 7032).fish.id, 'raw_trout');
});

test('a catch from the game starts the haul with that very fish, then the hero casts again', async () => {
  const { Game } = await import('../src/game/game.js');
  const { resolveFish } = await import('../src/game/skilling.js');
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  const p = g.player;
  const spot = g.world.objects.find((o) => o.objId === 'rod_spot');
  g.skills.addXp('fishing', 2e6);   // every fish here is in reach
  const caught = [];
  g.bus.on('fishcatch', (e) => caught.push(e.id));
  heroAnimFrame(g, 0);   // starts listening
  p.x = spot.x - 1; p.y = spot.y; p.stopNow(); p.fx = p.x; p.fy = p.y;
  const action = { type: 'fish', obj: spot };
  p.setAction(action);
  const T = 1000, castMs = HERO_CLIPS.fish_rod_cast.dur, waitMin = FISHING.rod.waitMin;
  let f = heroAnimFrame(g, T);
  assert.equal(f.id, 'fish_rod_cast'); assert.equal(f.fish.phase, 'cast'); assert.equal(f.fish.tool, 'rod');
  assert.ok(f.fish.tx > 0, 'the line goes out to the spot on the right');
  f = heroAnimFrame(g, T + castMs + 50);
  assert.equal(f.fish.phase, 'wait', 'the bobber settles after the cast');
  // A fish caught at once is too soon: the bobber is shown floating a while first.
  assert.ok(resolveFish(g, action));
  assert.equal(caught.length, 1, 'resolveFish reports the catch');
  f = heroAnimFrame(g, T + castMs + 100);
  assert.equal(f.fish.phase, 'wait');
  // The next catch, once the wait has shown, brings in the fish it reported.
  const t1 = T + castMs + waitMin + 50;
  heroAnimFrame(g, t1 - 10);
  assert.ok(resolveFish(g, action));
  f = heroAnimFrame(g, t1);
  assert.equal(f.fish.phase, 'haul'); assert.equal(f.id, 'fish_rod_reel');
  assert.equal(f.fish.id, caught[1], 'the fish on the line is the one caught');
  assert.ok(heroAnimFrame(g, t1 + 260).ch.bend > 0.5, 'the rod bows under it');
  f = heroAnimFrame(g, t1 + HERO_CLIPS.fish_rod_reel.dur + 20);
  assert.equal(f.fish.phase, 'cast', 'then casts again');
  assert.equal(f.fish.n, 1, 'a fresh cast lands somewhere new');
  // Stopping clears the session: the next trip starts with a cast.
  p.clearAction(); heroAnimFrame(g, t1 + 3000);
  p.setAction({ type: 'fish', obj: spot });
  assert.equal(heroAnimFrame(g, t1 + 3100).fish.phase, 'cast');
});

// ---------------- Attack timing: the clip fits the swing, the strike meets the hit ----------------
/** A headless game swinging this weapon type (dual wielding or not) every `iv` beats. */
function swingingGame(type, iv, dual = false) {
  const item = Object.keys(ITEMS).find((id) => ITEMS[id].equip?.weaponType === type);
  let sk = -1;
  const player = { isMoving: false, animMove: 0, action: null, swingDur: Math.max(120, Math.min(300, iv * COMBAT_BEAT_MS * 0.9)), swingProgress: () => sk };
  const game = { player, jobClass: 'swordsman', hitStop: 0, attackInterval: () => iv,
    equipment: { get: (slot) => (slot === 'weapon' || (dual && slot === 'shield') ? item : null), isDualWielding: () => dual } };
  return { game, swing: (k) => { sk = k; } };
}

test('every attack clip fits inside its weapon\'s swing interval, wind-up held and strike quick', () => {
  const ids = new Set([...Object.values(WEAPON_CLIP), ...Object.values(DUAL_CLIPS).flat()]);
  for (const id of ids) {
    const clip = HERO_CLIPS[id];
    assert.ok(clip.hits?.length, `${id}: says when its blows land`);
    for (const h of clip.hits) assert.ok(h > 0.25 && h < 0.8, `${id}: a blow lands after a wind-up and before the recovery (${h})`);
    // Fast weapons compress the clip into one combat beat; slow ones take
    // longer, but the clip always ends before the next attack can begin.
    for (const iv of [0.25, 0.34, 0.5, 1, 1.5, 2, 4.7]) {
      const { game } = swingingGame('sword', iv);
      const ms = blowMs(game, clip);
      if (clip.shot) assert.equal(ms, game.player.swingDur, `${id}: a shot keeps the game's swing time`);
      else {
        assert.ok(ms >= game.player.swingDur, `${id} @${iv}: never shorter than the game's swing`);
        assert.ok(ms <= Math.max(1, iv) * COMBAT_BEAT_MS, `${id} @${iv}: ends before the next attack (${ms}ms)`);
      }
    }
    // Melee blows: the painted arm holds its wind-up (arc 0.85..1) for a good
    // part of the clip, then the strike itself (arc 1 -> 3) is over in a flash.
    if (clip.shot || !clip.tracks.arc) continue;
    let held = 0, strike = 0;
    for (let i = 0; i < 400; i++) {
      const a = sampleHeroClip(id, i / 400).ch.arc;
      if (a >= 0.85 && a <= 1) held++;
      else if (a > 1 && a < 3) strike++;
    }
    assert.ok(held / 400 >= 0.15, `${id}: the wind-up is held (${held / 4}% of the clip)`);
    assert.ok(strike / 400 <= 0.12, `${id}: the strike is quick (${strike / 4}% of the clip)`);
  }
});

test('each blow strikes at the moment its hit feedback is shown, and a hit-stop freezes the strike', () => {
  for (const [type, dual] of [['sword', false], ['warhammer', false], ['spear', false], ['scimitar', true], ['dagger', true], ['claws', false]]) {
    for (const stop of [0, 70]) {
      const { game, swing } = swingingGame(type, 1, dual);
      const t0 = 5000;
      swing(0); heroAnimFrame(game, t0);
      const clock = strikeClock(game);
      assert.ok(clock, `${type}: a melee blow holds its hit feedback back`);
      const hits = clock.hitTimes, first = hits[0];
      // A crit's hit-stop is dealt with the damage, as the swing starts.
      game.hitStop = stop;
      const peaks = [];
      let was = 0, uAtHit = -1, uAfter = -1;
      for (let t = t0 + 2; t < t0 + 800; t += 2) {
        swing(t - t0 < game.player.swingDur ? (t - t0) / game.player.swingDur : -1);
        const f = heroAnimFrame(game, t);
        if (f.kind !== 'combat') break;
        game.hitStop = Math.max(0, game.hitStop - 2);
        if (f.ch.impact >= 0.99 && was < 0.99) peaks.push(t);
        was = f.ch.impact;
        if (uAtHit < 0 && t >= first) uAtHit = f.u;
        if (uAfter < 0 && t >= first + 40) uAfter = f.u;
      }
      // (hitTimes is the renderer's live clock: a hit-stop pushes the later blows back.)
      assert.equal(peaks.length, hits.length, `${type}: one strike frame per blow`);
      peaks.forEach((p, i) => assert.ok(Math.abs(p - hits[i]) <= 6, `${type} (hit-stop ${stop}): blow ${i + 1} strikes at ${p - t0}ms, its hit shows at ${hits[i] - t0}ms`));
      assert.equal(hits[0], first, `${type}: the first blow is never moved by the hit-stop`);
      // The hit-stop is played on the strike: the clip all but freezes there.
      const crawl = uAfter - uAtHit;
      if (stop) assert.ok(crawl < 0.04, `${type}: frozen on the strike for the hit-stop (${crawl.toFixed(3)})`);
      else assert.ok(crawl > 0.05, `${type}: without one it carries on through (${crawl.toFixed(3)})`);
    }
  }
});

test('the Lancer lowers the spear from its upright guard into the thrust, not in one frame', () => {
  assert.equal(weaponClipId('spear'), 'thrust');
  assert.equal(sampleHeroClip('thrust', 0.1).guardIn, true, 'the thrust starts from the guard');
  // The painted wind-up shows from arc 0.4: it takes a good part of the coil
  // (not a frame or two of a 270ms clip) to come down to its own aim at arc 1.
  let shown = -1, aimed = -1;
  for (let u = 0; u <= 0.4; u += 0.005) {
    const a = sampleHeroClip('thrust', u).ch.arc;
    if (shown < 0 && a > 0.4) shown = u;
    if (aimed < 0 && a >= 0.99) aimed = u;
  }
  assert.ok(aimed - shown >= 0.08, `lowered over ${(aimed - shown).toFixed(3)} of the clip`);
  assert.equal(sampleHeroClip('slash', 0.1).guardIn, false, 'other clips coil as before');
});

// A canvas stand-in that records each point an arm is drawn from: a mitten
// arm's stroke starts at the shoulder; a painted arm (and the tool) is drawn
// translated to it (when earlier tests left pictures loaded).
function strokeStarts() {
  const starts = [];
  const c = new Proxy({ globalAlpha: 1 }, {
    get: (t, k) => (k in t ? t[k] : k === 'moveTo' || k === 'translate' ? (x, y) => starts.push([x, y]) : () => {}),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return { c, starts };
}

test("the Brawler's life-skill arms hang from his gi's sleeve ends, the back one over the body", () => {
  // His gi is as pale as his arms: from the usual shoulders, inside the chest,
  // they vanished into it and left two empty sleeves (fishing, chopping...).
  for (const id of ['woodcut', 'fish_rod', 'mine']) {
    const anim = sampleHeroClip(id, 0.3, { kind: 'skill', tool: 'bronze_axe', jobClass: 'brawler' });
    const front = strokeStarts(), back = strokeStarts();
    drawHeroArm(front.c, anim, 'front', -11);
    drawHeroArm(back.c, anim, 'back', -11);
    assert.ok(front.starts.some(([x, y]) => x === 18.5 && y === -9), `${id}: front arm out at the sleeve (${JSON.stringify(front.starts)})`);
    assert.ok(!front.starts.some(([x]) => x === 8), `${id}: not from inside the chest`);
    assert.deepEqual(back.starts[0], [-8.4, -11.1], `${id}: back arm out at the other sleeve`);
  }
  assert.equal(armInFront('brawler'), true, 'his back arm is drawn over the body, as his rig arm is');
  // Classes with default shoulders draw the far arm behind the body.
  const anim = sampleHeroClip('woodcut', 0.3, { kind: 'skill', tool: 'bronze_axe', jobClass: 'paladin' });
  const paladin = strokeStarts();
  drawHeroArm(paladin.c, anim, 'front', -11);
  assert.ok(paladin.starts.some(([x, y]) => x === 8 && y === -11), JSON.stringify(paladin.starts));
  assert.equal(armInFront('paladin'), false);
});

test('the axe chops blade first and the pickaxe is held by its handle', () => {
  // The handle held out level toward the tree (angle 0) at the bite of a
  // downswing: the head moves down, so the blade must be on the lower side.
  // The sticker's blade edge is at its left (about 0.12, 0.45), its poll at
  // the head's upper right (about 0.55, 0.12).
  const blade = propPoint('bronze_axe', 0.12, 0.45, 0), poll = propPoint('bronze_axe', 0.55, 0.12, 0);
  assert.ok(blade[1] > 2 && poll[1] < -2, `blade at y ${blade[1].toFixed(1)}, poll at y ${poll[1].toFixed(1)}`);
  assert.ok(blade[0] > 10, 'the head is out at the end of the handle');
  // Both tools: the end of the handle is near the hand and the handle runs
  // along the arm's line to the head (not off to one side of the fist).
  for (const [id, end, mid] of [['bronze_axe', [0.88, 0.88], [0.62, 0.57]], ['bronze_pickaxe', [0.88, 0.88], [0.66, 0.6]]]) {
    const e = propPoint(id, ...end, 0), m = propPoint(id, ...mid, 0);
    assert.ok(Math.hypot(...e) < 6, `${id}: handle end ${e.map((v) => v.toFixed(1))} by the hand`);
    assert.ok(m[0] > 3 && Math.abs(m[1]) < 2, `${id}: handle ${m.map((v) => v.toFixed(1))} along the arm`);
  }
});
