// The motion pass: the shared curves and beats (motionkit.js), and what they
// drive. Curves must be continuous (no pose jumps between frames), blows must
// land on one beat, a foe's blow on the hero must show as it lands while the
// damage is still dealt on the game's own beat, and the calm and low-graphics
// paths must run headless.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp01, seg, easeOut, easeIn, easeInOut, smooth, easeOutBack, springOut, arc,
  swingBeats, strikeLead, WIND_END, STRIKE_AT, HOLD_END,
  turnWidth, turnHop, TURN_MIN_W, lookAround, LOOK_MS, breath, heroWalk, heroView,
} from '../src/render/motionkit.js';
import { deathPose, telegraphCrouch, CROUCH_MS, fidget, fidgetLand, FIDGET_MS, LAND_MS } from '../src/render/creatureanim.js';
import { Character } from '../src/game/character.js';
import { Game } from '../src/game/game.js';
import { Renderer } from '../src/render/renderer.js';
import { drawCreature } from '../src/render/sprites.js';
import { NPCS } from '../src/data/npcs.js';

/** The biggest change in `f` between neighbouring samples of 0..1. */
function worstStep(f, n = 2000) {
  let worst = 0, prev = f(0);
  for (let i = 1; i <= n; i++) { const v = f(i / n); worst = Math.max(worst, Math.abs(v - prev)); prev = v; }
  return worst;
}

test('the curves start at 0, end at 1 and never jump', () => {
  for (const [name, f] of Object.entries({ easeOut, easeIn, easeInOut, smooth, easeOutBack })) {
    assert.ok(Math.abs(f(0)) < 1e-9, `${name} starts at 0`);
    assert.ok(Math.abs(f(1) - 1) < 1e-9, `${name} ends at 1`);
    assert.ok(worstStep(f) < 0.01, `${name} is continuous`);
  }
  assert.ok(Math.max(...[0.6, 0.7, 0.8, 0.9].map((x) => easeOutBack(x))) > 1, 'easeOutBack overshoots before settling');
  assert.equal(clamp01(-2), 0); assert.equal(clamp01(3), 1); assert.equal(seg(5, 0, 10), 0.5);
  assert.equal(arc(0), 0); assert.equal(arc(1), 0); assert.ok(Math.abs(arc(0.5) - 1) < 1e-9);
  assert.equal(springOut(-5, 50, 0.04), 0, 'no wobble before the kick');
  assert.equal(springOut(0, 50, 0.04), 1);
  assert.ok(Math.abs(springOut(600, 50, 0.04)) < 0.001, 'the wobble dies away');
});

test('a monster blow gathers, strikes on STRIKE_AT, holds, and settles without a jump', () => {
  assert.equal(swingBeats(-1), null, 'not attacking: no beats');
  assert.ok(WIND_END < STRIKE_AT && STRIKE_AT < HOLD_END && HOLD_END < 1);
  const at = (k) => { const b = swingBeats(k); return { wind: b.wind, hit: b.hit, settle: b.settle }; };
  assert.deepEqual(at(0), { wind: 0, hit: 0, settle: 0 }, 'starts at rest');
  assert.equal(at(WIND_END).wind, 1, 'fully gathered as the strike begins');
  assert.equal(at(STRIKE_AT).hit, 1, 'the blow lands on the beat');
  assert.equal(at((STRIKE_AT + HOLD_END) / 2).hit, 1, 'and is held a moment so it reads');
  const end = at(1);
  assert.ok(end.wind === 0 && end.hit < 1e-9 && end.settle < 1e-9, 'back at rest');
  for (const f of ['wind', 'hit', 'settle']) assert.ok(worstStep((k) => at(k)[f]) < 0.02, `${f} never jumps`);
  // The strike accelerates into the blow (fastest just as it lands).
  const v0 = at(WIND_END + 0.01).hit - at(WIND_END).hit, v1 = at(STRIKE_AT).hit - at(STRIKE_AT - 0.01).hit;
  assert.ok(v1 > v0 * 3, 'whips into the blow');
  assert.equal(strikeLead(240), Math.round(240 * STRIKE_AT));
  assert.equal(strikeLead(undefined), Math.round(240 * STRIKE_AT), 'a default swing');
});

test('turning round: full width outside the turn, a card-flip squeeze inside, a little hop', () => {
  assert.equal(turnWidth(0), 1); assert.equal(turnWidth(1), 1);
  assert.ok(turnWidth(0.5) >= TURN_MIN_W && turnWidth(0.5) < 0.2, 'only a moment edge-on');
  assert.ok(worstStep(turnWidth, 200) < 0.05, 'the squeeze is smooth');
  assert.equal(turnHop(0), 0); assert.equal(turnHop(1), 0);
  assert.ok(turnHop(0.5) > 1, 'hops as it turns');
});

test('hero walking lifts one foot at a time and settles as movement fades', () => {
  const left = heroWalk({ phase: 0.5, move: 1 });
  const right = heroWalk({ phase: 1.5, move: 1 });
  assert.ok(left.liftB > 3 && right.liftF > 3);
  assert.equal(left.liftF + right.liftB, 0);
  assert.ok(heroWalk({ phase: 0.5, move: 1 }, true).liftB < left.liftB);
  const still = heroWalk({ phase: 0.5, move: 0 });
  assert.equal(still.rise + still.liftB + still.liftF, 0);
});

test('a hero turns at the narrow midpoint and can reverse without jumping', () => {
  const player = {};
  assert.deepEqual(heroView(player, false, 0), { rear: false, width: 1, rise: 0 });
  assert.equal(heroView(player, true, 10).rear, false);
  const edge = heroView(player, true, 80);
  assert.equal(edge.rear, true);
  assert.ok(edge.width < 0.2);
  assert.deepEqual(heroView(player, false, 80), edge);
  assert.deepEqual(heroView(player, false, 220), { rear: false, width: 1, rise: 0 });
  assert.deepEqual(heroView(player, true, 230, true), { rear: true, width: 1, rise: 0 });
});

test('townsfolk glance about now and then, each on their own clock, turning smoothly', () => {
  const seed = 321.5;
  let away = 0, n = 0, lastTurn = 0, worst = 0;
  for (let t = 0; t < 40000; t += 16, n++) {
    const lk = lookAround(t, seed);
    if (lk.side < 0) away++;
    worst = Math.max(worst, Math.abs(lk.turn - lastTurn) > 0.5 ? 0 : Math.abs(lk.turn - lastTurn));
    lastTurn = lk.turn;
    assert.ok(lk.turn >= 0 && lk.turn <= 1);
  }
  const share = away / n;
  assert.ok(share > 0.08 && share < 0.2, `looks away a small share of the time (${share.toFixed(2)})`);
  assert.ok(worst < 0.15, 'the turn counts down smoothly');
  // Two neighbours don't glance at once.
  const when = (sd) => { for (let t = 0; t < 30000; t += 50) if (lookAround(t, sd).side < 0) return t; return -1; };
  assert.notEqual(when(12.3), when(612.9));
  assert.ok(LOOK_MS > 500);
  assert.ok(Math.abs(breath(1000, seed)) <= 0.0141, 'a gentle breath');
});

test('an idle hop lands with a squash straight after it, never during it', () => {
  const seed = 77.7;
  let hopEnd = -1, landSeen = false;
  for (let t = 0; t < 12000; t += 4) {
    const h = fidget(t, seed), l = fidgetLand(t, seed);
    assert.ok(!(h > 0 && l > 0), 'one or the other');
    if (h > 0) hopEnd = t;
    if (l > 0) { landSeen = true; assert.ok(t - hopEnd <= LAND_MS + 8, 'right after the hop'); }
  }
  assert.ok(landSeen && FIDGET_MS > 0);
  assert.ok(worstStep((u) => fidgetLand(u * 12000, seed), 3000) < 0.2, 'the squash eases in and out');
});

test('a felled monster skids back as it falls and thumps down, with no jumps', () => {
  const pose = (k) => ({ ...deathPose(k, {}) });
  assert.equal(pose(0).slide, 0, 'starts where it stood');
  assert.equal(pose(1).slide, 1, 'ends knocked back');
  for (let k = 0.05; k <= 1; k += 0.05) assert.ok(pose(k).slide >= pose(k - 0.05).slide, 'never slides back toward the hero');
  for (const f of ['slide', 'rot', 'sx', 'sy', 'a']) assert.ok(worstStep((k) => pose(k)[f], 1000) < 0.06, `${f} is continuous`);
  assert.ok(pose(0.7).sy < 1, 'flattened a touch as it lands');
});

test('a charging monster crouches as it gathers and eases out as it lets go', () => {
  const n = {};
  assert.equal(telegraphCrouch(n, false, -1, 0), 0);
  assert.ok(!('_crV' in n), 'nothing kept on a creature that never charged');
  let t = 1000, prev = 0, worst = 0;
  for (let age = 0; age <= CROUCH_MS + 200; age += 16, t += 16) {
    const v = telegraphCrouch(n, true, age, t);
    assert.ok(v >= prev - 1e-9, 'builds');
    prev = v;
  }
  assert.ok(prev > 0.99, 'fully gathered');
  // Let go: it eases out over a few frames, never in one.
  for (let i = 0; i < 40; i++, t += 16) {
    const v = telegraphCrouch(n, false, -1, t);
    worst = Math.max(worst, prev - v); prev = v;
  }
  assert.ok(worst < 0.25, `lets go smoothly (biggest drop ${worst.toFixed(2)})`);
  assert.equal(prev, 0, 'and comes to rest');
  assert.equal(telegraphCrouch(null, true, CROUCH_MS, 0), 1, 'without a creature: the charge curve');
});

test('a whole-picture monster leans back to gather and lunges hardest on the beat', () => {
  // Where the body is drawn, from the first path's transform (as animation-smoothing does).
  const frame = (k) => {
    let first = null, m = [1, 0, 0, 1, 0, 0];
    const noop = () => {}, grad = { addColorStop() {} };
    const ctx = {
      save() {}, restore() {}, setTransform() {}, transform: noop,
      translate(x, y) { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
      scale(x, y) { m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; },
      rotate(r) { const cs = Math.cos(r), sn = Math.sin(r), [a, b, c, d] = m; m = [a * cs + c * sn, b * cs + d * sn, -a * sn + c * cs, -b * sn + d * cs, m[4], m[5]]; },
      beginPath() { if (!first) first = m.slice(); },
      clip: noop, setLineDash: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, rect: noop, roundRect: noop,
      quadraticCurveTo: noop, bezierCurveTo: noop, fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
      fillText: noop, strokeText: noop, drawImage: noop, measureText: () => ({ width: 10 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
    };
    const d = NPCS.monitor_lizard;
    drawCreature(ctx, 'monitor_lizard', 100, 100, { time: 5000, fx: 1, sprite: d.sprite, family: d.family, color: d.color, attackK: k, calm: true });
    return first;
  };
  const x = (k) => frame(k)[4];
  assert.ok(x(WIND_END) < x(0), 'leans back to gather');
  assert.ok(x(STRIKE_AT) > x(0) + 3, 'lunges forward on the beat');
  assert.ok(x(STRIKE_AT) >= x(0.9), 'and settles back');
});

function headlessGame() {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game();
  g.start();
  g.camera.resize(800, 600);
  g.camera.follow(g.player.x * 32, g.player.y * 32);
  return g;
}
function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  return {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop, clip: noop, setTransform: noop, setLineDash: noop, transform: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, rect: noop, roundRect: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop, drawImage: noop,
    measureText: () => ({ width: 10 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
  };
}

test('a foe\'s blow is dealt on its beat but the hero flinches as the swing lands', () => {
  const g = headlessGame(), p = g.player;
  const foe = g.npcs.find((n) => n.attackable && !n.def.boss);
  foe.x = foe.tx = p.x + 1; foe.y = foe.ty = p.y; foe.target = p;
  p.autoRetaliate = false;
  const hp0 = p.hp;
  let tries = 0;
  do { p.hp = hp0; g.resolveNpcAttack(foe); } while (p.hp === hp0 && ++tries < 200);
  assert.ok(p.hp < hp0, 'the damage is dealt at once (gameplay timing unchanged)');
  assert.equal(p.strikeWait, strikeLead(foe.swingDur), 'the look waits for the strike');
  assert.equal(p.hurt, 200);
  // While the swing is on its way: no flinch, no knockback, the flash unaged.
  p.update(40);
  assert.equal(p.hurt, 200, 'the flash waits unaged');
  assert.deepEqual(p.renderOffset(), { x: 0, y: 0 }, 'no knockback yet');
  for (let el = 40; el < strikeLead(foe.swingDur) + 16; el += 16) p.update(16);
  assert.equal(p.strikeWait, 0);
  assert.ok(p.hurt > 150 && p.hurt <= 200, 'the flash plays from the strike');
  p.update(16);
  const off = p.renderOffset();
  assert.ok(Math.hypot(off.x, off.y) > 0.5, 'knocked back as it lands');
});

test('a jolt from a foe\'s blow on you waits for the blow too', () => {
  const g = headlessGame();
  g.screenShake = true; g.reduceMotion = false;
  g.player.strikeWait = 100;
  g.addShake(4, 200);
  assert.equal(g.shakeT, 0, 'held while the swing is on its way');
  g.player.update(120);
  g.update(16);
  assert.ok(g.shakeT > 0, 'shakes as it lands');
});

test('the renderer holds the hero\'s number, bar and flash for the strike, in low graphics and calm too', () => {
  for (const mode of [{}, { lowFx: true }, { reduceMotion: true }]) {
    const g = headlessGame();
    Object.assign(g, mode);
    const r = new Renderer(g, {}, makeCtx());
    r.render(1000);
    const p = g.player;
    p.strikeWait = 100; p.strikeFresh = true;
    g.addHitsplat(p, 3);
    const e = g.effects[g.effects.length - 1];
    assert.doesNotThrow(() => r.render(1016));
    assert.ok(e._showAt > 1016, 'the number waits for the strike');
    assert.equal(p.strikeFresh, false, 'the renderer took the wait');
    // A dying monster and a resting townsperson draw in every mode.
    const foe = g.npcs.find((n) => n.attackable);
    foe.x = foe.tx = p.x + 1; foe.y = foe.ty = p.y; foe.knockDX = 1; foe.die();
    const town = g.npcs.find((n) => !n.attackable);
    if (town) { town.x = town.tx = p.x - 1; town.y = town.ty = p.y; }
    assert.doesNotThrow(() => { r.render(1100); r.render(1300); });
  }
});

test('a hero turning round, and townsfolk at rest, draw without throwing in every path', () => {
  const ent = new Character(3, 3);
  const opts = (o) => ({ time: 4321, entity: ent, fx: -1, ...o });
  const ctx = makeCtx();
  for (const o of [{}, { turn: 0.5 }, { low: true }, { calm: true }, { moving: true, move: 1 }]) {
    assert.doesNotThrow(() => drawCreature(ctx, 'rq_madam_tan', 50, 50, opts(o)));
    assert.doesNotThrow(() => drawCreature(ctx, 'monitor_lizard', 50, 50, opts({ ...o, sprite: NPCS.monitor_lizard.sprite, family: 'monitor_lizard', windup: true, windAge: 300 })));
  }
});
