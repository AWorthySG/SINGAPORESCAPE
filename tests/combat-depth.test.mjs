import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CombatFx, FX_KIND } from '../src/render/combatfx.js';
import { drawBossMech, drawBossShockwave, drawBossTelegraph } from '../src/render/bossmechfx.js';
import { spellPose } from '../src/render/fxdepth.js';
import { LightPass } from '../src/render/lighting.js';
import { makeProjection, projectFlat } from '../src/render/projection.js';

test('a spell follows its painted flight and lights the floor directly below it', () => {
  const shot = { type: 'projectile', kind: 'bolt', el: 'fire', x: 20, y: 180, ex: 140, ey: 220,
    color: '#ffb140', life: 120, maxLife: 240 };
  assert.deepEqual(spellPose(shot, 0), { x: 20, y: 180, row: 192 });
  assert.deepEqual(spellPose(shot, 1), { x: 140, y: 220, row: 232 });
  assert.deepEqual(spellPose(shot, 0.5), { x: 80, y: 192, row: 212 });
  assert.equal(spellPose({ ...shot, el: 'radiance' }, 0.3).x, shot.ex);
  const blade = spellPose({ ...shot, el: 'judgement' }, 0);
  assert.equal(blade.x, shot.ex);
  assert.equal(blade.y, shot.ey - 78);

  const lp = new LightPass(), pj = makeProjection(1, 300, 400);
  const [light] = lp.gather({ world: { objects: [] }, effects: [shot] }, 0, 0, 300, 400, 2000, pj);
  const foot = projectFlat(pj, 80, 212);
  assert.equal(light.x, foot.x);
  assert.equal(light.y, foot.y);
  assert.ok(light.sq < 1);
});

test('a held impact illuminates the floor on its strike and ages only after release', () => {
  const fx = new CombatFx();
  fx.impact('blade', 60, 80, { melee: true });
  const glow = fx.slots.find(s => s.k === FX_KIND.GLOW);
  const lights = [];
  const collect = (...light) => { lights.push(light); return true; };
  fx.lights(collect);
  assert.equal(lights.length, 0);
  fx.armFresh(30);
  fx.update(20);
  fx.lights(collect);
  assert.equal(lights.length, 0);
  assert.equal(glow.life, glow.max);
  fx.update(17);
  fx.lights(collect);
  assert.equal(lights.length, 1);
  assert.deepEqual(lights[0].slice(0, 2), [60, 92]);
  assert.equal(glow.life, glow.max - 7);
});

function recorder() {
  const calls = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get: (target, key) => key in target ? target[key] : (...args) => calls.push([key, ...args]),
  });
  return { ctx, calls };
}

test('boss warnings retain their tile bounds and the blast leaves the safe circle clear', () => {
  const { ctx, calls } = recorder();
  const h = { cx: 4, cy: 5, r: 2, safe: { cx: 3, cy: 5, r: 1 }, start: 1000, dur: 1000 };
  drawBossTelegraph(ctx, h, 64, 64, 1500, true, true);
  assert.deepEqual(calls.filter(c => c[0] === 'strokeRect'), [
    ['strokeRect', 2, 34, 156, 156],
    ['strokeRect', 2, 34, 156, 156],
  ]);
  assert.ok(calls.some(c => c[0] === 'fillText' && c[1] === 'SAFE'));
  assert.equal(ctx.lineDashOffset, 0, 'the danger stripe is steady with Reduce Motion');
  calls.length = 0;
  drawBossShockwave(ctx, { x: 144, y: 176, r: 80, life: 150, maxLife: 380, safe: h.safe }, 64, 64, true);
  assert.ok(calls.some(c => c[0] === 'clip' && c[1] === 'evenodd'));
  assert.ok(calls.some(c => c[0] === 'ellipse'));
});

test('healing beams remain attached to both figures at different depths', () => {
  const { ctx, calls } = recorder();
  const healer = { renderCenter: () => ({ x: 140, y: 260 }) };
  healer.mechHealer = { alive: true, renderCenter: () => ({ x: 190, y: 90 }) };
  const pj = makeProjection(1, 330, 470);
  drawBossMech(ctx, healer, 140, 260, 1, 2000, 0, 0, pj, true, true);
  const p = projectFlat(pj, 140, 272), q = projectFlat(pj, 190, 102);
  assert.deepEqual(calls.find(c => c[0] === 'moveTo'), ['moveTo', p.x, p.y - 18 * p.s]);
  assert.deepEqual(calls.find(c => c[0] === 'quadraticCurveTo').slice(3), [q.x, q.y - 18 * q.s]);
});
