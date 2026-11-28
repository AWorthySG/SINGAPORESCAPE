import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANIM_ART, drawHeroBack, drawSwingArm, heroBackReady } from '../src/render/heroAnimArt.js';
import { heroWalk } from '../src/render/motionkit.js';

function withPictures(run) {
  const previous = globalThis.Image;
  const images = new Map();
  globalThis.Image = class {
    constructor() { this.naturalWidth = 100; this.naturalHeight = 100; }
    set src(src) {
      this.path = src;
      this.complete = !src.endsWith('/zealot_backstrike.webp');
      images.set(src, this);
    }
    get src() { return this.path; }
  };
  try { run(images); }
  finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
}

function recordArt() {
  const draws = [], stack = [];
  let angle = 0, scale = 1, x = 0, y = 0;
  return {
    globalAlpha: 1, draws,
    save() { stack.push([angle, scale, x, y, this.globalAlpha]); },
    restore() { [angle, scale, x, y, this.globalAlpha] = stack.pop(); },
    rotate(turn) { angle += turn; },
    scale(k) { scale *= k; },
    translate(dx, dy) {
      x += scale * (Math.cos(angle) * dx - Math.sin(angle) * dy);
      y += scale * (Math.sin(angle) * dx + Math.cos(angle) * dy);
    },
    drawImage(img, dx, dy, w, h) { draws.push({ src: img.src, dx, dy, w, h, x, y, angle, scale, alpha: this.globalAlpha }); },
  };
}

function direction(draw) {
  const corners = [[draw.dx, draw.dy], [draw.dx + draw.w, draw.dy], [draw.dx, draw.dy + draw.h], [draw.dx + draw.w, draw.dy + draw.h]];
  const length = ([x, y]) => Math.hypot(x, y);
  const tip = corners.reduce((a, b) => length(a) >= length(b) ? a : b);
  return { angle: draw.angle + Math.atan2(tip[1], tip[0]), reach: draw.scale * length(tip) };
}

test('painted arm cuts stay on the shoulder and keep a shared swing direction with one image', () => withPictures(() => {
  const shoulder = [9, -12];
  for (const [id, art] of Object.entries(ANIM_ART)) for (const hand of art.off ? ['main', 'off'] : ['main']) {
    const kind = ['archer', 'ranger'].includes(id) ? 'bow' : ['pistoler', 'sniper'].includes(id) ? 'gun' : 'melee';
    const tween = kind === 'melee' ? 1 : 0.2;
    const artAt = (arc) => {
      const ctx = recordArt();
      const anim = { low: true, tween, ch: { paint: 1, [hand === 'main' ? 'arc' : 'arc2']: arc } };
      assert.ok(drawSwingArm(ctx, id, anim, hand, kind, ...shoulder));
      assert.equal(ctx.draws.length, 1, `${id} keeps a single painted silhouette`);
      const [draw] = ctx.draws;
      assert.equal(draw.alpha, 1);
      if (draw.angle || draw.scale !== 1) assert.deepEqual([draw.x, draw.y], shoulder);
      assert.ok(draw.scale >= 0.90 && draw.scale <= 1.10, `${id} stays close to painted size`);
      return draw;
    };
    for (const cut of [1.5, 2.5]) {
      const before = artAt(cut - 0.001), after = artAt(cut + 0.001);
      assert.notEqual(before.src, after.src);
      const a = direction(before), b = direction(after);
      assert.ok(Math.cos(a.angle - b.angle) > 0.9999, `${id} ${hand} smoothly crosses the ${cut} cut`);
      if (id === 'swordsman') assert.ok(Math.abs(a.reach - b.reach) < 0.2, 'the blade keeps a continuous reach');
    }
  }
}));

test('rear readiness waits for every part and the view selector can override heading', () => withPictures((images) => {
  assert.equal(heroBackReady('missing'), false);
  assert.equal(heroBackReady('zealot'), false);
  images.get('assets/creatures/hero/anim/zealot_backstrike.webp').complete = true;
  assert.equal(heroBackReady('zealot'), true);
  const opts = { jobClass: 'zealot', facing: { dx: 1, dy: 0 }, anim: { ch: { mix: 1 } } };
  assert.equal(drawHeroBack(recordArt(), opts), false);
  assert.equal(drawHeroBack(recordArt(), { ...opts, backView: true }), true);
  assert.equal(drawHeroBack(recordArt(), { jobClass: 'zealot', facing: { dx: 0, dy: -1 }, backView: false }), false);
}));

test('rear swings turn the painted torso and weapon together over grounded feet', () => withPictures(() => {
  const frame = (ch) => {
    const ctx = recordArt();
    drawHeroBack(ctx, { jobClass: 'swordsman', backView: true, anim: { ch } });
    return ctx.draws;
  };
  const rest = frame({}), wind = frame({ sword: -0.8 }), release = frame({ sword: 1.6, strike: 1 });
  assert.deepEqual(wind.slice(0, 2), rest.slice(0, 2));
  assert.deepEqual(release.slice(0, 2), rest.slice(0, 2));
  assert.ok(wind[2].angle < 0 && release[2].angle > 0);
  assert.ok(wind.at(-1).src.endsWith('_backarm.webp'));
  assert.ok(release.at(-1).src.endsWith('_backstrike.webp'));
  for (const draws of [wind, release]) {
    const { x, y, angle } = draws[2];
    assert.deepEqual([draws.at(-1).x, draws.at(-1).y, draws.at(-1).angle], [x, y, angle]);
  }
}));

test('the rear view uses the shared walk cycle and adds any clip lifts', () => withPictures(() => {
  const gait = { phase: 0.5, move: 1 };
  for (const calm of [false, true]) {
    const ctx = recordArt();
    const ch = { liftF: 2, liftB: 1, crouch: 0.8 };
    drawHeroBack(ctx, { jobClass: 'swordsman', backView: true, gait, calm, anim: { ch } });
    const { liftB, liftF, rise } = heroWalk(gait, calm);
    assert.equal(15 - ctx.draws[0].h - ctx.draws[0].dy, liftB + ch.liftB);
    assert.equal(15 - ctx.draws[1].h - ctx.draws[1].dy, liftF + ch.liftF);
    assert.equal(ctx.draws[2].dy, ANIM_ART.swordsman.back.body[1] + (ch.crouch - rise));
  }
}));

test('the Swordsman carries a buckler in the rear view while a shield is equipped', () => withPictures(() => {
  for (const hasShield of [true, false]) {
    const ctx = recordArt();
    assert.ok(drawHeroBack(ctx, { jobClass: 'swordsman', backView: true, hasShield }));
    assert.ok(ctx.draws.some(({ src }) => src.endsWith(hasShield ? '_backbuckler.webp' : '_backother.webp')));
  }
}));
