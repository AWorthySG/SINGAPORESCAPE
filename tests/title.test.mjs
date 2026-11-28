// The title screen, loading bar and class-picker heroes (src/ui/title.js):
// the parts that run without a browser, plus the splash markup the Playwright
// scripts rely on (#splash-enter, the class names on the picker's cards).
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TITLE_SHOTS, SHOT_MS, CUT_MS, titleCameraAt, LoadTracker, trackImages, LOADING_TIPS, TIP_MS, tipAt,
  drawClassHero, swingActor, attackClipFor, previewAttackMs, titleSkylineSvg, TitleScreen,
} from '../src/ui/title.js';
import { CLASSES } from '../src/data/classes.js';
import { HERO_CLIPS } from '../src/render/heroanim.js';
import { Game } from '../src/game/game.js';
import { TILE } from '../src/config.js';

function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  let draws = 0;
  return {
    get draws() { return draws; },
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over',
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop, clip: noop, setTransform: noop, setLineDash: noop, transform: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, rect: noop, roundRect: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, fill: () => { draws++; }, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, strokeText: noop, drawImage: () => { draws++; }, measureText: () => ({ width: 10 }),
    createRadialGradient: () => grad, createLinearGradient: () => grad,
  };
}

test('the title camera tours each shot in turn, dipping to cream over every cut', () => {
  for (let i = 0; i < TITLE_SHOTS.length; i++) {
    const s = TITLE_SHOTS[i];
    const mid = titleCameraAt(i * SHOT_MS + SHOT_MS / 2);
    assert.equal(mid.shot, i);
    assert.equal(mid.name, s.name);
    assert.equal(mid.fade, 0, 'clear mid-shot');
    // Mid-shot, the camera is between the shot's two ends.
    const between = (v, a, b) => v >= Math.min(a, b) * TILE - 1e-6 && v <= Math.max(a, b) * TILE + 1e-6;
    assert.ok(between(mid.x, s.from[0], s.to[0]) && between(mid.y, s.from[1], s.to[1]), `${s.name} pans from its start to its end`);
    assert.ok(titleCameraAt(i * SHOT_MS + 1).fade > 0.95, 'each shot fades in from cream');
    assert.ok(titleCameraAt((i + 1) * SHOT_MS - 1).fade > 0.95, 'and out to cream at its cut');
    assert.ok(titleCameraAt(i * SHOT_MS + CUT_MS + 10).fade < 0.05);
  }
  // It loops, and the camera keeps moving through a shot.
  assert.deepEqual(titleCameraAt(SHOT_MS * TITLE_SHOTS.length + 1234), titleCameraAt(1234));
  assert.notEqual(titleCameraAt(3000).x, titleCameraAt(6000).x);
  // Reduced motion: one held view of the first shot, no cuts.
  const a = titleCameraAt(0, TITLE_SHOTS, true), b = titleCameraAt(50000, TITLE_SHOTS, true);
  assert.deepEqual(a, b);
  assert.equal(a.fade, 0);
  assert.equal(a.name, TITLE_SHOTS[0].name);
});

test('every title shot looks at the world: on the map and not out at sea', () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game();
  for (const s of TITLE_SHOTS) {
    for (const [x, y] of [s.from, s.to]) {
      assert.ok(x >= 0 && y >= 0 && x < g.world.width && y < g.world.height, `${s.name} is on the map`);
    }
    // At least some land in a few tiles of the centre (a beach shot may be half sea).
    const [cx, cy] = s.from.map(Math.round);
    let land = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) if (g.world.inBounds(cx + dx, cy + dy) && !g.world.isBlocked(cx + dx, cy + dy)) land++;
    assert.ok(land > 10, `${s.name} shows land`);
  }
});

test('the load counter settles every picture, failed or never started, so the bar always finishes', () => {
  const t = new LoadTracker();
  assert.deepEqual(t.status(), { loaded: 0, total: 0, ratio: 0, idle: true });
  const a = t.add({ complete: false }), b = t.add({ complete: false });
  t.job('fonts');
  let s = t.status();
  assert.equal(s.total, 3);
  assert.equal(s.loaded, 0);
  assert.equal(s.idle, false);
  a.complete = true;          // loaded
  b.complete = true;          // ...or failed: the browser marks it complete too
  assert.equal(t.status().ratio, 2 / 3);
  t.done('fonts');
  s = t.status();
  assert.equal(s.idle, true);
  assert.equal(s.ratio, 1);
});

test('while loading, every new Image is counted, and the real Image comes back after', () => {
  class FakeImage { constructor() { this.complete = false; } }
  const scope = { Image: FakeImage };
  const t = new LoadTracker();
  const restore = trackImages(t, scope);
  const img = new scope.Image();
  assert.ok(img instanceof FakeImage, 'still an Image');
  assert.ok(img instanceof scope.Image, 'instanceof the tracked constructor too');
  new scope.Image(32, 32);
  assert.equal(t.status().total, 2);
  restore();
  assert.equal(scope.Image, FakeImage);
  new scope.Image();
  assert.equal(t.status().total, 2, 'no longer counted');
  // No Image at all (as in these tests): nothing to do.
  assert.doesNotThrow(() => trackImages(t, {})());
});

test('loading tips rotate through the list', () => {
  assert.ok(LOADING_TIPS.length >= 6);
  assert.equal(tipAt(0), LOADING_TIPS[0]);
  assert.equal(tipAt(TIP_MS + 1), LOADING_TIPS[1]);
  assert.equal(tipAt(TIP_MS * LOADING_TIPS.length), LOADING_TIPS[0]);
  assert.equal(tipAt(0, 3), LOADING_TIPS[3]);
  for (const tip of LOADING_TIPS) assert.doesNotMatch(tip, /color|armor/i, 'British spelling');
});

test('every class hero draws on a stage, idling and through its whole attack preview', () => {
  for (const c of CLASSES) {
    const clip = attackClipFor(c.id);
    assert.ok(HERO_CLIPS[clip], `${c.id} has an attack clip (${clip})`);
    const ctx = makeCtx();
    const actor = { classId: c.id, fx: -1 };
    drawClassHero(ctx, actor, 30, 60, 1000);
    const ms = previewAttackMs(clip);
    swingActor(actor, 2000);
    for (const dt of [0, ms * 0.25, ms * 0.5, ms * 0.75, ms * 0.99]) drawClassHero(ctx, actor, 30, 60, 2000 + dt);
    assert.ok(actor.attackAt != null, 'still swinging just before the end');
    drawClassHero(ctx, actor, 30, 60, 2000 + ms + 1);
    assert.equal(actor.attackAt, null, `${c.id}'s swing ends and it goes back to idling`);
    assert.ok(ctx.draws > 0, `${c.id} drew something`);
  }
  // Unknown classes are ignored rather than throwing.
  assert.doesNotThrow(() => drawClassHero(makeCtx(), { classId: 'nobody' }, 0, 0, 0));
});

test('the title is headless-safe: no splash, no browser, nothing breaks', () => {
  const t = new TitleScreen(null);
  assert.equal(t.active, false);
  assert.doesNotThrow(() => t.frame(16));
  assert.doesNotThrow(() => t.exit());
  assert.match(titleSkylineSvg(), /^<svg [^>]*viewBox="0 0 1200 140"/);
});

test('the painted title waits for the opening view and skips the hero stage', (t) => {
  const previousDocument = globalThis.document;
  const bodyClasses = new Set();
  globalThis.document = { body: { classList: { add: (c) => bodyClasses.add(c), remove: (c) => bodyClasses.delete(c) } } };
  t.after(() => {
    if (previousDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
  });

  for (const pendingStyleChoice of [true, false]) {
    const classes = new Set(['loading', 'title-keyart-on']);
    const keyArt = { complete: true, naturalWidth: 1920, addEventListener() {} };
    const label = { textContent: 'Begin adventure' };
    const splash = {
      style: {},
      classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
      querySelector: (s) => ({ '.title-keyart': keyArt, '.splash-enter-label': label }[s]),
    };
    const title = new TitleScreen(splash, { still: true });
    const camera = { cx: 2750, cy: 1200, snapped: true };
    title.attach({ camera, pendingStyleChoice });
    const openingPicture = title.tracker.add({ complete: false });
    t.mock.method(title, '_startSkylineActors');

    assert.equal(label.textContent, pendingStyleChoice ? 'Begin adventure' : 'Continue adventure');
    for (let i = 0; i < 3; i++) title.frame(16);
    assert.equal(title.ready, false, 'a pending opening image keeps the title loading');
    assert.deepEqual([camera.cx, camera.cy], [2750, 1200], 'preload the player view instead of panning the title tour');

    openingPicture.complete = true;
    title.frame(16);
    assert.equal(title.ready, true, 'settled images take the player straight to the ready title');
    assert.equal(title._startSkylineActors.mock.callCount(), 0, 'the painted scene has no hero or petal stages');
    assert.ok(title.worldHidden, 'pause world rendering under the finished key art');

    let entered = false;
    title.exit(() => { entered = true; });
    assert.ok(entered && classes.has('hidden') && !title.worldHidden, 'reduced motion hands back the world immediately');
    assert.equal(camera.snapped, false);
  }
});

test('the painted title fades before resuming the renderer and opening the picker', (t) => {
  const previousDocument = globalThis.document;
  globalThis.document = { body: { classList: { add() {}, remove() {} } } };
  t.after(() => {
    if (previousDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
  });

  const classes = new Set(['ready', 'title-keyart-on']);
  const keyArt = { complete: true, naturalWidth: 1920, addEventListener() {} };
  const splash = Object.assign(new EventTarget(), {
    style: {},
    classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c) },
    querySelector: (s) => s === '.title-keyart' ? keyArt : null,
  });
  const title = new TitleScreen(splash, { still: false });
  title.warm();
  title.ready = true;
  const enter = t.mock.fn();
  title.exit(enter);
  assert.ok(classes.has('leaving') && !classes.has('hidden') && title.worldHidden);
  assert.equal(enter.mock.callCount(), 0);

  for (const propertyName of ['transform', 'opacity', 'opacity']) {
    splash.dispatchEvent(Object.assign(new Event('transitionend'), { propertyName }));
    assert.equal(enter.mock.callCount(), propertyName === 'opacity' ? 1 : 0);
  }
  assert.ok(classes.has('hidden') && !title.active && !title.worldHidden);
});

test('the splash keeps #splash-enter and the loading bar, and the picker keeps class names clickable', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const splash = html.slice(html.indexOf('<div id="splash"'), html.indexOf('<script type="module"'));
  assert.match(splash, /<button id="splash-enter">/);
  assert.match(splash, /class="splash-brand-primary">\s*<span class="splash-brand-mark">\s*<img src="assets\/logo\.svg"[^>]*>\s*<\/span>\s*<span>A-Worthy Education<\/span>/);
  assert.match(splash, /class="splash-brand-nib">\s*<img src="assets\/education-gold-nib\.webp"/);
  assert.match(splash, /class="splash-enter-label">Begin adventure</);
  assert.match(splash, /class="splash-scene">Transit Road, Nee Soon Camp</);
  assert.match(splash, /class="sl-status">Unfolding the map&hellip;</);
  assert.match(splash, /id="splash-loader" role="progressbar"[^>]*aria-valuenow="0"/);
  for (const cls of ['title-skyline', 'title-heroes', 'title-particles', 'title-fade', 'sl-fill', 'sl-tip']) assert.ok(splash.includes(`class="${cls}"`), cls);
  assert.match(html, /<link rel="stylesheet" href="styles\/title.css" \/>/);
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  const pick = ui.slice(ui.indexOf('  openStyleChoice() {'), ui.indexOf('  closeModal() {'));
  // The card shows the class's name in a <b> and choosing happens on clicking the card.
  assert.match(pick, /<b>\$\{c\.name\}<\/b>/);
  assert.match(pick, /div\.addEventListener\('click', \(\) => choose\(c, div\)\)/);
  // The spotlight (which also names a class) is added after the cards, so a
  // search for the name finds the card first.
  assert.ok(pick.indexOf('picker.appendChild(sec)') < pick.indexOf('this._classSpotlight(picker'), 'spotlight after the cards');
  const css = readFileSync(new URL('../styles/title.css', import.meta.url), 'utf8');
  assert.match(css, /\.class-spot \{\s*order: -1;/, 'but shown above them');
  assert.match(css, /#splash\.loading #splash-enter \{ display: none; \}/);
});

test('the splash shows the title once alongside the mascot', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const splash = html.slice(html.indexOf('<div id="splash"'), html.indexOf('<script type="module"'));
  // One mascot, inside the crest with the title (title.css sets it in the sunburst's disc).
  assert.equal((splash.match(/class="splash-mascot"/g) || []).length, 1);
  assert.match(splash, /<div class="splash-crest">\s*<img src="assets\/title\/mascot-sit\.webp" alt="" class="splash-mascot" \/>\s*<h1 class="splash-title">A-Worthy Adventure<\/h1>\s*<\/div>/);
  // The brand lockup stays in the corner rather than repeating under the title.
  assert.doesNotMatch(splash.slice(splash.indexOf('class="splash-inner"')), /splash-logo|logo\.svg/, 'no logo under the title');
  assert.ok(!/by <b>A/.test(splash), 'no "by A Worthy" line');
  assert.match(splash, /class="splash-sub">\s*<strong class="splash-tagline">Always an adventure with A-Worthy<\/strong>\s*Explore the A-Worthy World, any way you like\.\s*<\/p>/);
  const css = readFileSync(new URL('../styles/title.css', import.meta.url), 'utf8');
  assert.match(css, /#splash\.title-banner \.splash-crest \.splash-mascot \{[^}]*position: absolute;/);
  // Small screens: the mascot's round portrait fills the disc instead (MD-1).
  assert.match(css, /#splash\.title-banner \.splash-crest::after \{[^}]*var\(--title-medallion\)/);
  assert.match(css, /@media \(max-width: 480px\) \{[^@]*\.splash-crest::after \{ content: ""; \}[^@]*\.splash-mascot \{ display: none; \}/);
});

test('the class spotlight shows three chips for every class, the rest behind "+N more"', async () => {
  const { classPerks, classKeyPerks } = await import('../src/game/classperks.js');
  assert.equal(CLASSES.length, 24);
  for (const id of ['monk', 'priest', 'zealot']) assert.ok(CLASSES.some((c) => c.id === id), id);
  for (const c of CLASSES) {
    const { key, rest } = classKeyPerks(c.id);
    assert.deepEqual(key.map((p) => p.label).slice(0, 2), ['Speed', 'Reach'], c.id);
    assert.equal(key.length, 3, `${c.id} has three chips`);
    for (const p of key) assert.ok(typeof p.chip === 'string' && p.chip.length <= 24, `${c.id} ${p.label} chip "${p.chip}" is short`);
    assert.ok(rest.length > 0, `${c.id} has more behind the button`);
    // Every perk but the signature is a chip or behind the button, once.
    assert.deepEqual([...key.map((p) => p.label), ...rest.map((p) => p.label)].sort(), classPerks(c.id).slice(1).map((p) => p.label).sort(), c.id);
  }
  // The trait that sets a class apart comes third.
  assert.equal(classKeyPerks('rogue').key[2].label, 'Dual wield');
  assert.equal(classKeyPerks('gladiator').key[2].label, 'Cleave');
  assert.equal(classKeyPerks('gladiator').key[2].chip, '70% to 3 foes');
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  const spot = ui.slice(ui.indexOf('  _classSpotlight(parent'), ui.indexOf('  closeModal() {'));
  assert.match(spot, /classKeyPerks\(id\)/);
  assert.match(spot, /class="class-spot-more" type="button" aria-expanded="false"/);
});
