// Movement & camera smoothness: verify time-based stepping (even diagonal speed,
// clean overshoot carry-over) and frame-rate-independent camera follow.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Character } from '../src/game/character.js';
import { Camera } from '../src/engine/camera.js';
import { TILE, TICK_MS } from '../src/config.js';

test('a straight walk step takes exactly one tick and lands on the tile', () => {
  const c = new Character(5, 5);
  c.setPath([{ x: 6, y: 5 }]); // one tile east
  assert.ok(c.moving);
  c.update(TICK_MS / 2);
  assert.equal(c.x, 5, 'still mid-step halfway through');
  assert.ok(Math.abs(c.progress - 0.5) < 1e-9, 'halfway by time');
  c.update(TICK_MS / 2);
  assert.equal(c.x, 6, 'arrived after a full tick');
  assert.ok(!c.moving, 'stopped at the end of the path');
});

test('diagonal steps take √2 longer so on-screen speed stays even', () => {
  const c = new Character(0, 0);
  c.setPath([{ x: 1, y: 1 }]); // one diagonal step
  assert.ok(Math.abs(c.moveDuration - TICK_MS * Math.SQRT2) < 1e-6, 'diagonal duration is √2 ticks');
  // After a normal tick it should be only ~71% of the way there (not arrived).
  c.update(TICK_MS);
  assert.equal(c.x, 0, 'not yet arrived after one straight tick of time');
  assert.ok(c.progress > 0.6 && c.progress < 0.78, 'progress reflects the longer diagonal');
  c.update(TICK_MS); // plenty more time
  assert.equal(c.x, 1); assert.equal(c.y, 1);
});

test('overshoot carries real time across mixed-length steps (no corner jitter)', () => {
  // East (straight) then north-east (diagonal). Feed time in one big chunk and
  // confirm the entity advances smoothly without losing or gaining time.
  const c = new Character(0, 0);
  c.setPath([{ x: 1, y: 0 }, { x: 2, y: 1 }]);
  // One straight tick + a quarter of a diagonal step's worth of time.
  c.update(TICK_MS + TICK_MS * Math.SQRT2 * 0.25);
  assert.equal(c.x, 1, 'finished the straight step');
  assert.ok(Math.abs(c.progress - 0.25) < 1e-6, 'exactly a quarter into the diagonal');
});

test('camera follow is frame-rate independent', () => {
  const a = new Camera(); a.resize(800, 600); a.follow(0, 0); // snap
  const b = new Camera(); b.resize(800, 600); b.follow(0, 0);
  a.cx = b.cx = 0; a.snapped = b.snapped = true;
  // One 32ms frame vs two 16ms frames should land in nearly the same place.
  a.follow(1000, 0, 0.22, null, 32);
  b.follow(1000, 0, 0.22, null, 16);
  b.follow(1000, 0, 0.22, null, 16);
  assert.ok(Math.abs(a.cx - b.cx) < 1.0, 'same convergence regardless of frame cadence');
});

test('camera converges toward its target over time', () => {
  const cam = new Camera(); cam.resize(800, 600);
  cam.follow(0, 0); // snap to origin
  for (let i = 0; i < 60; i++) cam.follow(500 * TILE, 0, 0.22, null, 16);
  assert.ok(Math.abs(cam.cx - 500 * TILE) < 1, 'camera reaches the target');
});
