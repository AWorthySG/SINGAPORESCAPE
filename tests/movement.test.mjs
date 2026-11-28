// Movement & camera smoothness: verify time-based stepping (even diagonal speed,
// clean overshoot carry-over) and frame-rate-independent camera follow.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Character } from '../src/game/character.js';
import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
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
  assert.ok(Math.abs(c.walkPhase - 1.25) < 1e-6, 'feet are a quarter into the second step too');
  c.update(TICK_MS * 2);
  assert.equal(c.walkPhase, 2, 'standing still after arriving adds no extra stride');
});

test('a killed NPC falls from its interpolated position and respawns at home', () => {
  const n = new NPC('rat', 5, 5);
  n.setPath([{ x: 6, y: 5 }]);
  n.update(n.moveDuration * 0.6);
  const before = n.renderCenter();
  n.die();
  assert.deepEqual(n.tile(), { x: 5, y: 5 }, 'the simulation still uses the occupied tile');
  assert.deepEqual(n.renderCenter(), before, 'the fall starts mid-step');
  n.update(200);
  assert.deepEqual(n.renderCenter(), before, 'the fall keeps its ground anchor');
  n.respawn();
  assert.deepEqual(n.renderCenter(), { x: 5.5 * TILE, y: 5.5 * TILE });
});

test('the walking blend rises and settles equally at different frame rates', () => {
  const animate = (frames) => {
    const c = new Character(0, 0);
    c.setPath([{ x: 1, y: 0 }]);
    for (const dt of frames) c.update(dt);
    const starting = c.animMove;
    c.stopNow();
    for (const dt of frames) c.update(dt);
    return [starting, c.animMove];
  };
  const slow = animate([72]), smooth = animate([18, 18, 18, 18]);
  assert.ok(slow.every((weight, i) => Math.abs(weight - smooth[i]) < 1e-9));
});

test('an attack is aimed at the visible target between tile centres', () => {
  const attacker = new Character(0, 0);
  const target = new Character(0, 1);
  target.setPath([{ x: -1, y: 1 }]);
  target.update(TICK_MS * 0.75);
  Game.prototype._swingToward.call({}, attacker, target);
  assert.ok(Math.abs(attacker.lungeDX + 0.6) < 1e-9);
  assert.ok(Math.abs(attacker.lungeDY - 0.8) < 1e-9);
  assert.equal(attacker.faceX, -1, 'the sprite turns toward the visible target');
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

test('a new route that heads back the way we came turns round at once, with no snap', () => {
  const c = new Character(5, 5);
  c.setPath([{ x: 6, y: 5 }]);
  c.update(TICK_MS * 0.3);
  const before = c.renderCenter();
  c.setPath([{ x: 5, y: 5 }, { x: 4, y: 5 }]);   // re-planned from the tile ahead
  const after = c.renderCenter();
  assert.ok(Math.abs(after.x - before.x) < 1e-6, 'stays where it is on screen');
  assert.equal(c.tx, 5, 'now heading back west straight away');
  c.update(TICK_MS * 0.2);
  assert.ok(c.renderCenter().x < before.x, 'moving west, not finishing the eastward step first');
  assert.deepEqual(c.path, [{ x: 4, y: 5 }]);
});

test('camera zoom shows less of the world and maps the screen back to the right tile', () => {
  const cam = new Camera();
  cam.resize(1280, 720, 1.6);
  assert.equal(cam.viewW, 800);
  assert.equal(cam.viewH, 450);
  cam.follow(1000, 1000);
  // The centre of the screen is the camera's centre, at any zoom.
  const w = cam.screenToWorld(640, 360);
  assert.ok(Math.abs(w.x - 1000) < 1e-9 && Math.abs(w.y - 1000) < 1e-9);
  const s = cam.worldToScreen(1000 + 16, 1000);
  assert.ok(Math.abs(s.x - (640 + 16 * 1.6)) < 1e-9, 'world distances are scaled up on screen');
});

test('the page is put back (top, 100% zoom) once no text box is in use', async () => {
  const { guardPageShift } = await import('../src/engine/input.js');
  const L = {}; const on = (k) => (t, f) => { (L[k + t] ||= []).push(f); };
  let scrolled = 0, active = null;
  const vv = { scale: 1, offsetTop: 0, offsetLeft: 0, addEventListener: on('vv') };
  const meta = { c: 'width=device-width, maximum-scale=1.0', getAttribute() { return this.c; }, setAttribute(_, v) { this.c = v; } };
  const doc = { addEventListener: on('doc'), get activeElement() { return active; }, querySelector: () => meta, scrollingElement: null, documentElement: null, body: null, hidden: false };
  const win = { document: doc, scrollX: 0, scrollY: 0, visualViewport: vv, addEventListener: on('win'), scrollTo: () => { scrolled++; win.scrollY = 0; vv.offsetTop = 0; } };
  const reset = guardPageShift(win);
  // The keyboard left the page shifted: put back.
  vv.offsetTop = 40; reset();
  assert.equal(scrolled, 1); assert.equal(vv.offsetTop, 0);
  // While typing, it's left alone (the keyboard needs the room).
  active = { tagName: 'INPUT' }; win.scrollY = 50; reset();
  assert.equal(scrolled, 1);
  active = null; reset();
  assert.equal(scrolled, 2);
});
