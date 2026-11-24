// Creature animation polish (src/render/creatureanim.js): each creature's own
// rhythm (not tied to where it is on screen), steps in time with its feet, the
// odd idle fidget, a crisp hit flash, a charge glow that builds, the respawn
// pop, the fall, and the quickening throb of marked ground. All headless.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { Renderer } from '../src/render/renderer.js';
import { drawCreature } from '../src/render/sprites.js';
import {
  animSeed, animTempo, stepLift, stepRock, fidget, FIDGET_MS, hitFlash, flinch, HURT_MS,
  windupAge, telegraphGlow, telegraphShake, spawnPose, deathPose, hazardPulse, hazardIn,
} from '../src/render/creatureanim.js';

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
function stubCtx() {
  const noop = () => {}, grad = { addColorStop: noop };
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
    globalCompositeOperation: 'source-over', measureText: () => ({ width: 10 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
  };
  for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'setTransform', 'setLineDash', 'transform', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'fillRect', 'strokeRect',
    'clearRect', 'fillText', 'strokeText', 'drawImage']) ctx[k] = noop;
  return ctx;
}

// ---------------- Its own rhythm ----------------
test('each creature keeps one animation seed of its own, wherever it is drawn', () => {
  const a = { spawnX: 10, spawnY: 20 }, b = { spawnX: 11, spawnY: 20 };
  const sa = animSeed(a, 100);
  assert.ok(sa >= 0 && sa < 1000);
  assert.equal(animSeed(a, 400), sa, 'the screen position (the fallback) no longer moves it');
  assert.equal(animSeed(a, -73.5), sa);
  assert.notEqual(animSeed(b), sa, 'neighbours get different rhythms');
  assert.equal(animSeed(null, 42), 42, 'with no creature (a preview), the fallback stands in');
  // A pack of twenty: their tempos spread out rather than all matching.
  const tempos = Array.from({ length: 20 }, (_, i) => animTempo(animSeed({ spawnX: i, spawnY: 3 })));
  for (const t of tempos) assert.ok(t >= 0.85 && t <= 1.15, `tempo ${t}`);
  assert.ok(Math.max(...tempos) - Math.min(...tempos) > 0.1, 'tempos vary across a pack');
});

test('a walker lifts mid-stride and plants on each tile, rocking one way then the other', () => {
  for (const w of [0, 1, 2, 7]) assert.ok(stepLift(w) < 1e-9, `planted at ${w}`);
  for (const w of [0.5, 1.5, 3.5]) assert.ok(Math.abs(stepLift(w) - 1) < 1e-9, `mid-stride at ${w}`);
  assert.ok(stepRock(0.5) > 0 && stepRock(1.5) < 0, 'rocks to alternate sides on alternate steps');
  // Smooth in the walk phase: at 60fps and one tile per 600ms, a frame moves it by at most ~0.09.
  let worst = 0;
  for (let i = 1; i < 200; i++) worst = Math.max(worst, Math.abs(stepLift(i * 0.0278) - stepLift((i - 1) * 0.0278)));
  assert.ok(worst < 0.1, `no jumps between frames (${worst})`);
});

test('idle fidgets come now and then, on each creature\'s own clock', () => {
  const seeds = [12.5, 301.2, 777.7];
  for (const s of seeds) {
    let on = 0, max = 0;
    for (let t = 0; t < 60000; t += 10) { const f = fidget(t, s); if (f > 0) on++; max = Math.max(max, f); }
    assert.ok(max <= 1 && max > 0.95, 'rises to a full little hop');
    assert.ok(on / 6000 < 0.1, `mostly still (${(on / 60).toFixed(1)}% of the time)`);
  }
  // Two creatures don't hop at the same moments.
  let both = 0, either = 0;
  for (let t = 0; t < 60000; t += 10) { const a = fidget(t, seeds[0]) > 0, b = fidget(t, seeds[1]) > 0; if (a && b) both++; if (a || b) either++; }
  assert.ok(both < either * 0.3, 'out of step with each other');
  assert.ok(FIDGET_MS < 500, 'a fidget is brief');
});

// ---------------- Struck ----------------
test('the hit flash is a crisp bright frame that fades fast, and the shudder eases out', () => {
  assert.equal(hitFlash(0), 0); assert.equal(hitFlash(undefined), 0);
  assert.ok(hitFlash(HURT_MS) > 0.7, 'bright as the blow lands');
  let last = Infinity;
  for (let h = HURT_MS; h > 0; h -= 5) { const f = hitFlash(h); assert.ok(f <= last + 1e-9, 'never brightens again'); last = f; }
  assert.ok(hitFlash(10) < 0.02, 'all but gone by the end');
  assert.ok(hitFlash(HURT_MS / 2) < 0.5 * hitFlash(HURT_MS), 'half way through, well under half as bright');
  assert.equal(flinch(0), 0);
  assert.equal(flinch(HURT_MS), 1);
  assert.ok(flinch(HURT_MS / 2) < 0.5, 'eases out rather than stopping dead');
});

// ---------------- Charging a heavy blow ----------------
test('a charging blow\'s glow builds and throbs slowly, with no strobing', () => {
  const n = { windup: 0 };
  assert.equal(windupAge(n, 1000), -1);
  n.windup = 1;
  assert.equal(windupAge(n, 1000), 0, 'noted the first frame it is seen charging');
  assert.equal(windupAge(n, 1300), 300);
  n.windup = 0;
  assert.equal(windupAge(n, 1400), -1);
  n.windup = 1;
  assert.equal(windupAge(n, 2000), 0, 'a fresh charge starts again from nothing');
  assert.equal(telegraphGlow(-1), 0);
  let worst = 0, early = 0, late = 0;
  for (let a = 0; a < 1500; a += 16) {
    const g = telegraphGlow(a), g2 = telegraphGlow(a + 16);
    assert.ok(g >= 0 && g <= 0.35, `glow ${g}`);
    worst = Math.max(worst, Math.abs(g2 - g));
    if (a < 150) early = Math.max(early, g); else if (a > 600) late = Math.max(late, g);
  }
  assert.ok(worst < 0.03, `smooth from frame to frame (${worst.toFixed(3)})`);
  assert.ok(late > early + 0.08, 'stronger once the blow is close');
  assert.equal(telegraphShake(-1), 0);
  assert.ok(telegraphShake(0) < telegraphShake(400) && telegraphShake(2000) === 1, 'trembles harder as it nears');
});

// ---------------- Coming back and falling ----------------
test('a respawn pops up out of the ground, overshoots a little and settles', () => {
  const out = {};
  const s0 = spawnPose(0, out);
  assert.equal(s0, out, 'reuses the object it is given');
  assert.equal(s0.a, 0); assert.ok(s0.sx < 0.5 && s0.sy < 0.5, 'starts small');
  const s1 = spawnPose(1);
  assert.equal(s1.a, 1); assert.ok(Math.abs(s1.sx - 1) < 1e-9 && Math.abs(s1.sy - 1) < 1e-9, 'ends at its own size');
  let peak = 0, lastA = 0;
  for (let k = 0; k <= 1; k += 0.02) {
    const p = spawnPose(k); peak = Math.max(peak, (p.sx + p.sy) / 2);
    assert.ok(p.a >= lastA - 1e-9, 'only ever fades in'); lastA = p.a;
  }
  assert.ok(peak > 1.02 && peak < 1.15, `a small overshoot (${peak.toFixed(3)})`);
});

test('a felled creature jolts, tips over faster and faster, bumps the ground and fades', () => {
  const p0 = deathPose(0);
  assert.ok(Math.abs(p0.rot) < 1e-9); assert.equal(p0.a, 1);
  const jolt = deathPose(0.07);
  assert.ok(jolt.sy > 1.05 && jolt.sx < 1, 'a jolt upright as the blow lands');
  const r = (k) => deathPose(k).rot;
  assert.ok(r(0.3) - r(0.2) < r(0.55) - r(0.45), 'tips faster as it goes');
  assert.ok(r(0.7) < 0.95 && r(0.9) === 1, 'bounces once on landing, then lies still');
  assert.equal(deathPose(1).a, 0, 'gone at the end');
  let last = 1;
  for (let k = 0; k <= 1; k += 0.05) { const a = deathPose(k).a; assert.ok(a <= last + 1e-9); last = a; }
});

test('marked ground throbs smoothly and quickens as the blow nears', () => {
  const dur = 1800;
  assert.equal(hazardPulse(0, dur), 0, 'starts calm');
  assert.equal(hazardPulse(-5, dur), 0);
  const peaks = (from, to) => {
    let n = 0;
    for (let a = from + 10; a < to - 10; a += 10) { const p = hazardPulse(a, dur); if (p > hazardPulse(a - 10, dur) && p >= hazardPulse(a + 10, dur)) n++; }
    return n;
  };
  assert.ok(peaks(dur / 2, dur) > peaks(0, dur / 2), 'more beats in the second half');
  let worst = 0;
  for (let a = 0; a < dur; a += 16) worst = Math.max(worst, Math.abs(hazardPulse(a + 16, dur) - hazardPulse(a, dur)));
  assert.ok(worst < 0.25, `no flicker between frames (${worst.toFixed(3)})`);
  assert.equal(hazardIn(0), 0); assert.equal(hazardIn(500), 1);
});

// ---------------- Headless drawing ----------------
test('creatures draw headless with every new option, in full and low graphics', () => {
  const ctx = stubCtx();
  const ent = { spawnX: 3, spawnY: 4 };
  for (const low of [false, true]) {
    for (const o of [
      { walk: 0.3, move: 1, moving: true }, { hurt: 150, calm: true }, { windup: true, windAge: 300 },
      { windup: true }, { attackK: 0.5 }, { time: 123456 },
    ]) {
      assert.doesNotThrow(() => drawCreature(ctx, 'goblin', 50, 50, { time: 1000, entity: ent, sprite: 'humanoid', color: '#5a5', family: 'goblin', low, ...o }));
      assert.doesNotThrow(() => drawCreature(ctx, 'banker', 50, 50, { time: 1000, entity: ent, low, ...o }));
    }
  }
});

test('the renderer draws spawning, dying and charging monsters without touching the game', () => {
  const g = freshGame();
  const ctx = stubCtx();
  g.camera.resize(800, 600);
  g.camera.follow(g.player.x * 32, g.player.y * 32);
  const r = new Renderer(g, {}, ctx);
  const foes = g.nearbyNpcs().filter((n) => n.attackable && n.alive).slice(0, 3);
  assert.ok(foes.length >= 2, 'monsters nearby');
  // Bring them into view next to the player, one respawning, one falling, one charging.
  foes.forEach((n, i) => { n.x = n.tx = g.player.x + 1 + i; n.y = n.ty = g.player.y; });
  foes[0].spawnT = 300;
  foes[1].alive = false; foes[1].deathT = 200;
  if (foes[2]) foes[2].windup = 1;
  const tick = g.tickCount, before = foes.map((n) => [n.hp, n.spawnT, n.deathT, n.x, n.y]);
  const live = () => g.cfx?.live ?? 0;
  const fx0 = live();
  for (let lowFx of [false, true]) { g.lowFx = lowFx; r.render(5000); r.render(5016); }
  assert.equal(g.tickCount, tick, 'drawing never runs the game tick');
  assert.deepEqual(foes.map((n) => [n.hp, n.spawnT, n.deathT, n.x, n.y]), before, 'nor changes a monster');
  if (g.cfx) assert.ok(live() > fx0, 'a respawn kicks up a puff of dust');
  const fx1 = live();
  r.render(5100);
  assert.ok(!g.cfx || live() <= fx1, 'only once per respawn');
  if (foes[2]) assert.equal(foes[2]._windAt, 5000, 'the charge is timed from the first frame it was seen');
});
