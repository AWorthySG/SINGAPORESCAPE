import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { HERO_RIG_PARTS, HERO_RIG_CLASSES, heroRigSrc, swordsmanPose, heroRigPose, drawHeroRig } from '../src/render/heroRig.js';
import { sampleHeroClip } from '../src/render/heroanim.js';
import { ANIM_ART, drawHeroBack } from '../src/render/heroAnimArt.js';

test('Swordsman rig artwork is complete', () => {
  for (const part of HERO_RIG_PARTS) assert.ok(existsSync(new URL('../' + heroRigSrc(part), import.meta.url)), part);
});

test('Swordsman feet alternate, settle at rest and share the running gait', () => {
  assert.equal(swordsmanPose({ move: 0, phase: 0.5 }).step, 0);
  assert.equal(swordsmanPose({ move: 1, phase: 0.5 }).step, 1);
  assert.equal(swordsmanPose({ move: 1, phase: 1.5, run: true }).step, -1);
  assert.notEqual(swordsmanPose({}, 300).breathe, swordsmanPose({}, 900).breathe);
});

test('Swordsman strike winds up, reaches forward and recovers to idle', () => {
  const idle = swordsmanPose({}, 0);
  assert.ok(swordsmanPose({}, 0, 0.3).sword < idle.sword);
  assert.ok(swordsmanPose({}, 0, 0.55).sword > idle.sword);
  assert.equal(swordsmanPose({}, 0, 0.55).strike, 1);
  assert.deepEqual(swordsmanPose({}, 0, 0), idle);
  assert.deepEqual(swordsmanPose({}, 0, 1), idle);
});

test('rig falls back headlessly and waits for every part before drawing', () => {
  assert.equal(drawHeroRig({}, { jobClass: 'swordsman' }), false);
  const previous = globalThis.Image;
  const loaded = [];
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; loaded.push(this); } };
  // The painted animation art (heroAnimArt.js) loads alongside; count only the rig's parts.
  const rigParts = () => loaded.filter((img) => !String(img.src).includes('/anim/'));
  try {
    const drawn = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, drawImage(img) { drawn.push(img); } };
    assert.equal(drawHeroRig(ctx, { jobClass: 'ranger' }), false);
    assert.equal(drawHeroRig(ctx, { jobClass: 'swordsman' }), false);
    assert.equal(loaded.length, 6);
    for (const img of loaded.slice(1)) { img.complete = true; img.naturalWidth = 100; }
    assert.equal(drawHeroRig(ctx, { jobClass: 'swordsman' }), false);
    loaded[0].complete = true; loaded[0].naturalWidth = 100;
    for (const swingK of [-1, 0, 0.3, 0.55, 1]) {
      assert.equal(drawHeroRig(ctx, { jobClass: 'swordsman', swingK }), true);
    }
    assert.equal(drawn.length, 30);
    assert.equal(rigParts().length, 6, 'images are reused across frames');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('all registered hero rigs have complete, separate component sets', () => {
  for (const classId of HERO_RIG_CLASSES) {
    for (const part of HERO_RIG_PARTS) {
      assert.ok(existsSync(new URL('../' + heroRigSrc(part, classId), import.meta.url)), `${classId}/${part}`);
    }
  }
});

test('Rogue off-hand attack follows the main hand only when dual wielding', () => {
  const early = heroRigPose('rogue', {}, 0, 0.28, true);
  const late = heroRigPose('rogue', {}, 0, 0.65, true);
  assert.ok(early.sword > late.sword, 'main hand attacks first');
  assert.ok(late.back < early.back, 'off hand follows');
  assert.equal(Math.abs(heroRigPose('rogue', {}, 0, 0.65, false).back), 0, 'single dagger has no second strike');
});

test('Samurai has a deeper katana wind-up and settles without a pose jump', () => {
  assert.ok(heroRigPose('samurai', {}, 0, 0.3).sword < swordsmanPose({}, 0, 0.3).sword);
  for (const classId of HERO_RIG_CLASSES) {
    const idle = heroRigPose(classId, { move: 0.5, phase: 0.5 }, 800);
    for (const swing of [0, 1]) {
      const pose = heroRigPose(classId, { move: 0.5, phase: 0.5 }, 800, swing, true);
      for (const key of Object.keys(idle)) assert.ok(Math.abs(pose[key] - idle[key]) < 1e-12, `${classId}/${key} at ${swing}`);
    }
  }
});

test('Rogue and Samurai caches are isolated and preserve canvas opacity', () => {
  const previous = globalThis.Image;
  const loaded = [];
  globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; loaded.push(this); } };
  // The painted animation art (heroAnimArt.js) loads alongside; count only the rig's parts.
  const rigParts = () => loaded.filter((img) => !String(img.src).includes('/anim/'));
  try {
    const drawn = [], stack = [];
    const ctx = {
      globalAlpha: 0.65,
      save() { stack.push(this.globalAlpha); }, restore() { this.globalAlpha = stack.pop(); },
      translate() {}, rotate() {}, drawImage(img) { drawn.push(img.src); },
    };
    assert.equal(drawHeroRig(ctx, { jobClass: 'rogue' }), false);
    for (const img of loaded) { img.complete = true; img.naturalWidth = 100; }
    assert.equal(drawHeroRig(ctx, { jobClass: 'rogue', swingK: 0.28, dualWield: true }), true);
    assert.equal(ctx.globalAlpha, 0.65);
    assert.ok(drawn.every((src) => src.includes('/rogue-')));
    assert.equal(drawHeroRig(ctx, { jobClass: 'samurai' }), false);
    assert.equal(rigParts().length, 12, 'each class loads six distinct parts');
    const samurai = rigParts().slice(6);
    for (const img of samurai) { img.complete = true; img.naturalWidth = 100; }
    samurai[2].naturalWidth = 0; // A completed request can still be a broken image.
    assert.equal(drawHeroRig(ctx, { jobClass: 'samurai' }), false);
    samurai[2].naturalWidth = 100;
    drawn.length = 0;
    assert.equal(drawHeroRig(ctx, { jobClass: 'samurai', swingK: 0.58 }), true);
    assert.ok(drawn.every((src) => src.includes('/samurai-')));
    assert.equal(ctx.globalAlpha, 0.65);
    assert.equal(stack.length, 0, 'transforms and opacity are balanced');
    assert.equal(drawHeroRig(ctx, { jobClass: 'rogue' }), true);
    assert.equal(rigParts().length, 12, 'returning to an already loaded class reuses images');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

// The Monk wears its open palm glove only when equipped. The opposite fist
// chambers during the palm strike, and the rear view keeps its close stance.
test('the Monk: bare hands without gloves, the palm over a chambered fist, feet apart from behind', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    let drawn = [], turn = 0;
    const stack = [];
    const ctx = {
      globalAlpha: 1, lineCap: '', strokeStyle: '', fillStyle: '', lineWidth: 1,
      save() { stack.push([this.globalAlpha, turn]); }, restore() { [this.globalAlpha, turn] = stack.pop(); },
      translate() {}, rotate(a) { turn += a; }, scale() {}, beginPath() {}, arc() {}, stroke() {}, fill() {}, lineTo() {}, closePath() {},
      drawImage(img, x) { drawn.push({ name: String(img.src).split('/').pop().replace('.webp', ''), turn, x }); },
    };
    const held = { kind: 'combat', jobClass: 'monk', weapon: 'knuckles', offhand: 'bronze_monk_gloves' };
    const draw = (opts) => { drawn = []; assert.equal(drawHeroRig(ctx, { jobClass: 'monk', hasWeapon: true, ...opts }), true); return drawn.map((d) => d.name); };
    // Gloves on (and the title's heroes, which say nothing of a shield): the glove arm.
    assert.ok(draw({ dualWield: true }).includes('monk-back'));
    assert.ok(draw({}).includes('monk-back'));
    // Neither weapon nor gloves: two empty hands, no glove.
    const bare = draw({ hasWeapon: false, dualWield: false, hasShield: false });
    assert.ok(!bare.includes('monk-back') && !bare.includes('monk-sword'), bare.join());
    assert.equal(bare.filter((n) => n === 'monk_hand').length, 2);
    // Through the coil the rig's own glove arm draws back to the hip (the painted
    // wind-up would hide behind the body).
    const coil = draw({ dualWield: true, anim: sampleHeroClip('fist_dual', 0.3, held) });
    assert.ok(coil.includes('monk-back') && !coil.includes('monk_offwind'), coil.join());
    // The palm strike: drawn after the knuckled arm, whose fist has turned down to the hip.
    const rest = draw({ dualWield: true, anim: sampleHeroClip('fist_dual', 0.02, held) });
    const restTurn = drawn.find((d) => d.name === 'monk-sword').turn;
    const palm = draw({ dualWield: true, anim: sampleHeroClip('fist_dual', 0.72, held) });
    assert.ok(rest.includes('monk-sword'));
    assert.ok(palm.indexOf('monk_offfollow') > palm.indexOf('monk-sword'), palm.join());
    assert.ok(drawn.find((d) => d.name === 'monk-sword').turn - restTurn > 0.8, 'the fist is chambered');
    assert.equal(stack.length, 0, 'transforms and opacity are balanced');
    // The front and rear sandals are centred under the robe.
    drawn = [];
    assert.equal(drawHeroBack(ctx, { jobClass: 'monk', facing: { dx: 0, dy: -1 } }), true);
    const feet = drawn.filter((d) => /backfoot/.test(d.name)).map((d) => d.x);
    assert.deepEqual(feet, [-11.3, 1.7]);
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('Swordsman raises the sword beside its face and keeps both arms on their shoulders', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    const draws = [], stack = [];
    let x = 0, y = 0, angle = 0;
    const ctx = {
      globalAlpha: 1,
      save() { stack.push([this.globalAlpha, x, y, angle]); },
      restore() { [this.globalAlpha, x, y, angle] = stack.pop(); },
      translate(dx, dy) { x += dx; y += dy; }, rotate(turn) { angle += turn; }, scale() {},
      drawImage(img, dx, dy, w, h) { if (this.globalAlpha > 0.01) draws.push({ src: img.src, x, y, angle, dx, dy, w, h, alpha: this.globalAlpha }); },
    };
    const render = (opts) => {
      draws.length = 0;
      const draw = opts.backView ? drawHeroBack : drawHeroRig;
      assert.equal(draw(ctx, { jobClass: 'swordsman', hasWeapon: true, ...opts }), true);
      return draws.map(({ src }) => src);
    };
    const part = (name) => draws.find(({ src }) => src.endsWith(`/${name}.webp`));
    const pixel = (d, fx, fy) => {
      const dx = d.dx + fx * d.w, dy = d.dy + fy * d.h;
      return [d.x + dx * Math.cos(d.angle) - dy * Math.sin(d.angle), d.y + dx * Math.sin(d.angle) + dy * Math.cos(d.angle)];
    };
    const back = heroRigSrc('back');
    const preview = render({});
    assert.ok(preview.indexOf(back) > preview.indexOf(heroRigSrc('body')), 'the buckler sits in front of the coat');
    const sword = part('swordsman-sword');
    const [tipX, tipY] = pixel(sword, 25 / 124, 5 / 220);
    const [gripX, gripY] = pixel(sword, 45 / 124, 136 / 220);
    assert.ok(gripX > 8 && gripY < sword.y - 8, 'the bent arm raises its grip clear of the cheek');
    assert.ok(tipX > gripX + 12 && tipY < gripY - 7, 'the blade angles up and outward');
    assert.ok(render({ hasShield: true }).includes(back));
    const shieldless = render({ hasShield: false });
    assert.ok(!shieldless.includes(back) && shieldless.some((src) => src.endsWith('swordsman_hand.webp')));
    for (const [u, phase] of [[0.3, 'wind'], [0.417, 'mid'], [0.68, 'follow']]) {
      const anim = sampleHeroClip('slash', u, { jobClass: 'swordsman', weapon: 'sword', low: true });
      render({ anim });
      assert.equal(part(`swordsman_${phase}`)?.x, sword.x, `${phase} stays on the guard's shoulder`);
    }
    const work = sampleHeroClip('woodcut', 0.25, { jobClass: 'swordsman' });
    work.ch.mix = 0.25;
    render({ anim: work, hasShield: true, hasWeapon: false });
    const hands = draws.filter((d) => d.src.endsWith('/swordsman_hand.webp') && d.x === sword.x);
    assert.deepEqual(hands.map((d) => d.alpha), [0.25, 0.75], 'the work and bare poses blend on the same shoulder');
    render({ backView: true, hasShield: true });
    const rearSword = part('swordsman_backarm');
    assert.ok(rearSword.x < 0 && part('swordsman_backbuckler').x > 0, 'sword and shield use opposite rear shoulders');
    render({ backView: true, hasShield: false, hasWeapon: false });
    assert.equal(part('swordsman_backarm'), undefined);
    assert.equal(part('swordsman_backbuckler'), undefined);
    assert.equal(part('swordsman_hand').x, rearSword.x, 'the rear bare hand uses the sword arm socket');
    assert.ok(part('swordsman_backother').x > 0);
    assert.equal(stack.length, 0);
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('hero rigs follow equipped off-hand daggers and shields', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    const drawn = [], opacity = [];
    const ctx = {
      globalAlpha: 1,
      save() { opacity.push(this.globalAlpha); }, restore() { this.globalAlpha = opacity.pop(); },
      translate() {}, rotate() {}, scale() {},
      drawImage(img) { if (this.globalAlpha > 0.01) drawn.push(img.src); },
    };
    const paint = (jobClass, opts, rear = false) => {
      drawn.length = 0;
      assert.ok((rear ? drawHeroBack : drawHeroRig)(ctx, { jobClass, hasWeapon: true, backView: rear, ...opts }));
      return drawn.map((src) => src.split('/').pop());
    };
    const single = paint('rogue', { offhandWeapon: false, dualWield: false });
    assert.ok(single.includes('rogue_hand.webp') && !single.includes('rogue-back.webp'));
    assert.ok(paint('rogue', { offhandWeapon: true, dualWield: true }).includes('rogue-back.webp'));
    const punch = sampleHeroClip('punch', 0.68, { jobClass: 'rogue', kind: 'combat' });
    const offOnly = paint('rogue', { hasWeapon: false, offhandWeapon: true, dualWield: false, anim: punch });
    assert.ok(offOnly.includes('rogue-back.webp') && offOnly.includes('rogue_hand.webp'), 'a sole off-hand dagger stays in guard');
    assert.ok(offOnly.every((src) => !/^rogue_off|^rogue-strike/.test(src)), 'an unarmed clip cannot draw an off-hand stab');
    const attack = sampleHeroClip('stab_dual', 0.72, { jobClass: 'rogue', kind: 'combat', weapon: 'dagger', low: true });
    assert.ok(paint('rogue', { offhandWeapon: true, dualWield: true, anim: attack }).some((src) => src.startsWith('rogue_off')));
    for (const jobClass of ['paladin', 'knight']) {
      assert.ok(paint(jobClass, { hasShield: true }).includes(`${jobClass}-back.webp`));
      const empty = paint(jobClass, { hasShield: false });
      assert.ok(empty.includes(`${jobClass}_hand.webp`) && !empty.includes(`${jobClass}-back.webp`));
    }
    assert.ok(paint('knight', { hasShield: true }, true).includes('knight_backother.webp'));
    const emptyRear = paint('knight', { hasShield: false }, true);
    assert.ok(emptyRear.includes('knight_hand.webp') && !emptyRear.includes('knight_backother.webp'));
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('Corsair rests its scimitars on separate shoulders and follows through with the second cut', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    const guards = [], stack = [];
    let mirror = 1, x = 0;
    const ctx = {
      globalAlpha: 1,
      save() { stack.push([this.globalAlpha, mirror, x]); },
      restore() { [this.globalAlpha, mirror, x] = stack.pop(); },
      translate(dx) { x += dx; }, rotate() {}, scale(sx) { mirror *= Math.sign(sx); },
      drawImage(img) {
        if (this.globalAlpha > 0.01 && img.src === heroRigSrc('strike', 'corsair')) guards.push({ x, mirror });
      },
    };
    assert.equal(drawHeroRig(ctx, { jobClass: 'corsair', hasWeapon: true, dualWield: true }), true);
    assert.equal(guards.length, 2);
    assert.ok(guards[0].x < 0 && guards[1].x > 0);
    assert.deepEqual(guards.map((guard) => guard.mirror), [-1, 1], 'the far sword faces outwards in guard');
    guards.length = 0;
    drawHeroRig(ctx, { jobClass: 'corsair', hasWeapon: true, dualWield: false });
    assert.equal(guards.length, 1);
    assert.ok(heroRigPose('corsair', {}, 0, 0.68, true).strike2 > 0.9);
    assert.equal(heroRigPose('corsair', {}, 0, 0.68, false).strike2, 0);
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});

test('Knight keeps the guard out of the face and the blade on the same shoulder through a thrust', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    const seen = [], stack = [];
    let sx = 0, sy = 0, angle = 0;
    const ctx = {
      globalAlpha: 1,
      save() { stack.push([this.globalAlpha, sx, sy, angle]); },
      restore() { [this.globalAlpha, sx, sy, angle] = stack.pop(); },
      translate(x, y) { sx += x; sy += y; }, rotate(a) { angle += a; }, scale() {},
      drawImage(img, x, y, w, h) {
        if (this.globalAlpha > 0.01) seen.push({ name: img.src.split('/').pop(), x, y, w, h, sx, sy, angle });
      },
    };
    const opts = { jobClass: 'knight', hasWeapon: true, hasShield: true };
    const paint = (at = {}) => {
      seen.length = 0;
      assert.ok((at.backView ? drawHeroBack : drawHeroRig)(ctx, { ...opts, ...at }));
      return seen.map((part) => part.name);
    };
    const worldPoint = (pic, px, py) => {
      const x = pic.x + px, y = pic.y + py, c = Math.cos(pic.angle), s = Math.sin(pic.angle);
      return [pic.sx + c * x - s * y, pic.sy + s * x + c * y];
    };
    const guard = paint();
    const sword = seen.find(({ name }) => name === 'knight-sword.webp');
    const [tipX, tipY] = worldPoint(sword, sword.w * 6 / 224, sword.h * 6 / 240);
    assert.ok(tipX > 30 && tipY < -28, 'the raised blade is to the right of the face');
    const torso = guard.findIndex((name) => /^knight[-_](?:body|blink)\.webp$/.test(name));
    assert.ok(torso >= 0 && torso < guard.indexOf('knight-back.webp'), 'the shield rests in front of the torso');
    for (const k of [0.17, 0.45, 0.51, 0.65]) {
      const anim = sampleHeroClip('reach_thrust', k, { ...opts, kind: 'combat', weapon: 'longsword', low: true });
      paint({ anim });
      const arm = seen.find(({ name }) => /^knight_(?:wind|mid|follow)\.webp$/.test(name));
      assert.ok(arm, `painted arm at ${k}`);
      const [, , px, py] = ANIM_ART.knight.swing[arm.name.slice(7, -5)];
      const [x] = worldPoint(arm, px, py);
      assert.ok(Math.abs(x - sword.sx) < 1e-9, `arm stays on the guard shoulder at ${k}`);
    }
    const bare = paint({ backView: true, hasWeapon: false, hasShield: false });
    assert.equal(bare.filter((name) => name === 'knight_hand.webp').length, 2);
    assert.ok(!bare.some((name) => /^knight_back(?:arm|strike|other)\.webp$/.test(name)), 'an unequipped rear view has no blade or shield');
    assert.equal(stack.length, 0);
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
