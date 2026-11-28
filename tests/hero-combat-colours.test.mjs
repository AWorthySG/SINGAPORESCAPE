import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classAccent } from '../src/data/classColours.js';
import { drawHeroStrikeSpark, drawSwingArm } from '../src/render/heroAnimArt.js';
import { drawWeaponTrail, sampleHeroClip } from '../src/render/heroanim.js';
import { drawPlayer } from '../src/render/sprites.js';

function context() {
  const strokes = [], fills = [], stops = [];
  const no = () => {};
  return {
    strokes, fills, stops, globalAlpha: 1,
    save: no, restore: no, translate: no, rotate: no, scale: no, setLineDash: no,
    beginPath: no, closePath: no, moveTo: no, lineTo: no, arc: no, ellipse: no, drawImage: no,
    createRadialGradient: () => ({ addColorStop(at, paint) { stops.push(paint); } }),
    stroke() { strokes.push(this.strokeStyle); }, fill() { fills.push(this.fillStyle); },
  };
}

const hasTint = (ctx, classId) => {
  const { rgb, colour } = classAccent(classId);
  return ctx.strokes.some((paint) => paint === colour || paint.startsWith(`rgba(${rgb},`));
};

function withArt(run) {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.naturalWidth = this.naturalHeight = 120; this.complete = true; } };
  try { run(); }
  finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
}

test('weapon trails keep a bright core, use the class edge and respect low graphics', () => {
  const trail = { kind: 'line', x0: 19, x1: 46, y: -8 };
  const anim = { kind: 'combat', ch: { trail: 0.5, impact: 1 }, trail };
  const legacy = context();
  drawWeaponTrail(legacy, anim);
  assert.ok(legacy.strokes.includes('rgba(255,255,255,1.000)'));
  assert.ok(!hasTint(legacy, 'lancer'));
  const lancer = context();
  drawWeaponTrail(lancer, { ...anim, jobClass: 'lancer' });
  assert.ok(hasTint(lancer, 'lancer'));
  assert.ok(lancer.strokes.includes('rgba(255,255,255,1.000)'));
  const low = context();
  drawWeaponTrail(low, { ...anim, jobClass: 'lancer', low: true });
  assert.deepEqual(low.strokes, []);
});

test('painted strikes use a class tint while muzzle sparks keep their gold fill', () => withArt(() => {
  const swordsman = context();
  assert.ok(drawSwingArm(swordsman, 'swordsman', { ch: { paint: 1, arc: 2.75, smear: 0.8, impact: 1 }, weapon: 'sword' }, 'main', 'melee', 9, -12));
  assert.ok(swordsman.strokes.includes(classAccent('swordsman').colour));
  assert.ok(swordsman.strokes.includes(classAccent('swordsman').light));
  const muzzle = context();
  drawHeroStrikeSpark(muzzle, 12, 3, 5, 0.8, true, classAccent('pistoler'));
  assert.ok(hasTint(muzzle, 'pistoler'));
  assert.ok(muzzle.fills.includes('#ffd24a'));
}));

test('a class preview can show ranged and magic effects using only its clip clock', () => withArt(() => {
  const draw = (jobClass, weaponType, clip, u, effects = {}) => {
    const ctx = context();
    const anim = sampleHeroClip(clip, u, { jobClass, kind: 'combat', ...effects });
    drawPlayer(ctx, 0, 0, { jobClass, anim, hasWeapon: true, weaponType });
    return ctx;
  };
  assert.ok(hasTint(draw('archer', 'ranged', 'bow_quick', 0.3), 'archer'), 'draw-in');
  assert.ok(hasTint(draw('archer', 'ranged', 'bow_quick', 0.5), 'archer'), 'release');
  assert.ok(!hasTint(draw('archer', 'ranged', 'bow_quick', 0.3, { calm: true }), 'archer'));
  assert.ok(!hasTint(draw('archer', 'ranged', 'bow_quick', 0.5, { low: true }), 'archer'));
  const priest = draw('priest', 'magic', 'orb', 0.54);
  assert.ok(hasTint(priest, 'priest'));
  assert.ok(priest.stops.some((paint) => paint.startsWith('rgba(255,255,255,')), 'the cast keeps its light core');
}));
