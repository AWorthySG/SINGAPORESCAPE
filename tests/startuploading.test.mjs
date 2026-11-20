// What the title screen waits for, and what loads later (src/ui/title.js,
// src/render/heroAnimArt.js). Its own file, so the stub Image below is in place
// before any picture is asked for: every picture records its source, and
// "arrives" when the test says so.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const asked = [];
globalThis.Image = class { constructor() { this.complete = false; this.naturalWidth = 0; asked.push(this); } };
const arrive = () => { for (const i of asked) { i.complete = true; i.naturalWidth = 64; } };
const srcs = (from = 0) => asked.slice(from).map((i) => i.src);
const { heroIdleArt, warmHero, heroReady, drawClassHero, swingActor, TitleScreen } = await import('../src/ui/title.js');
const { drawAnimBody, heroAnimFiles, animArtSrc, swingArtReady } = await import('../src/render/heroAnimArt.js');
const { CLASSES } = await import('../src/data/classes.js');

const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });

test('a class hero waits for its idle pictures, asked for together; swings and back views are not among them', () => {
  for (const c of CLASSES) {
    const art = heroIdleArt(c.id);
    assert.ok(art.length >= 1, `${c.id} has idle pictures`);
    for (const f of art) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} exists`);
    assert.ok(!art.some((f) => /_(wind|mid|follow|offwind|offmid|offfollow|back\w+|hand|hurt|victory)\.webp$/.test(f)), `${c.id}: idle only`);
  }
  const n = asked.length;
  warmHero('swordsman');
  assert.deepEqual(srcs(n), heroIdleArt('swordsman'), 'all at once, not a layer per round trip');
  assert.equal(heroReady('swordsman'), false);
  assert.equal(drawClassHero(ctx, { classId: 'swordsman' }, 0, 0, 0), false, 'nothing drawn until it is whole');
  arrive();
  assert.equal(heroReady('swordsman'), true);
  assert.equal(drawClassHero(ctx, { classId: 'swordsman' }, 0, 0, 0), true);
});

test('a stage hero asks only for its idle faces; the hero in the world asks for everything', () => {
  let n = asked.length;
  drawAnimBody(ctx, 'samurai', { time: 0 }, 0, 0, 40, 40);
  assert.deepEqual(srcs(n).sort(), [animArtSrc('samurai_blink'), animArtSrc('samurai_body')]);
  n = asked.length;
  drawAnimBody(ctx, 'knight', { time: 0, entity: {} }, 0, 0, 40, 40);
  const all = heroAnimFiles().filter((f) => f.startsWith('knight_')).map(animArtSrc);
  assert.deepEqual(srcs(n).sort(), all.sort(), 'the player\'s own hero: swings, back view and hand too');
});

test('a preview swing waits for its painted arms, then plays', () => {
  arrive();
  warmHero('lancer'); arrive();
  const actor = { classId: 'lancer' };
  const n = asked.length;
  swingActor(actor, 1000);
  assert.equal(actor.attackAt, undefined, 'not yet: the arms are only now asked for');
  assert.ok(srcs(n).some((s) => /lancer_mid\.webp$/.test(s)));
  drawClassHero(ctx, actor, 0, 0, 1100);
  assert.equal(actor.attackAt, undefined);
  arrive();
  assert.equal(swingArtReady('lancer'), true);
  drawClassHero(ctx, actor, 0, 0, 1200);
  assert.equal(actor.attackAt, 1200, 'the swing starts once they are in');
  // An arm that never arrives doesn't stop the swing for long.
  const b = { classId: 'brawler' };
  warmHero('brawler'); arrive();
  swingActor(b, 0);
  drawClassHero(ctx, b, 0, 0, 2000);
  assert.equal(b.attackAt, 2000);
});

test('jobs for after loading wait for the bar, and run at once without a title', () => {
  const ran = [];
  new TitleScreen(null).later(() => ran.push('headless'));
  assert.deepEqual(ran, ['headless']);
  const t = new TitleScreen(null);
  t.active = true;   // as if a splash were loading
  t.later(() => ran.push('after'));
  assert.deepEqual(ran, ['headless'], 'held while loading');
  t.el = {}; t.splash = { classList: { add() {}, remove() {} } };
  t._becomeReady();
  assert.deepEqual(ran, ['headless', 'after']);
});
