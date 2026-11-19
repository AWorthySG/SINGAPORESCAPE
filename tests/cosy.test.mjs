// Cosy Singapore visuals: the golden-hour grade and lantern bloom
// (cosylight.js), the arrival and photo postcards (postcard.js, photomode.js),
// the title's sunset skyline (cosytitle.js) and the page's sharing tags.
// Everything that paints runs here against a recording context, and does
// nothing (rather than throwing) with no DOM.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { goldenHour, cosyGrade, bloomStrength, CosyLight, MAX_BLOOMS } from '../src/render/cosylight.js';
import {
  paintArrivalCard, paintStamp, paintPostmark, composePostcard, RegionPostcards, arrivalSize, photoPostcardSize, fitFont, stampHue,
} from '../src/render/postcard.js';
import { REGION_POSTCARDS, postcardLine, SITE_URL, TAGLINE } from '../src/data/postcards.js';
import { REGION_BADGES, DARK_REGIONS } from '../src/render/fxart.js';
import { postcardFileName, shareText, postmarkDate, buildPostcard } from '../src/ui/photomode.js';
import { cosySkylineSvg, fireflyHtml, dressTitle, COSY_VIEW } from '../src/ui/cosytitle.js';
import { Game } from '../src/game/game.js';
import { Renderer } from '../src/render/renderer.js';

// A 2D context that records its calls (name and arguments) and the
// composite modes it was set to.
function recordingCtx() {
  const calls = [], ops = [];
  const grad = { addColorStop() {} };
  const t = { calls, ops, font: '10px sans-serif', globalAlpha: 1 };
  return new Proxy(t, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'getTransform') return undefined;
      // Text is 0.55em a letter wide, so fitting text to a box really shrinks the font.
      if (k === 'measureText') return (s) => ({ width: String(s).length * (parseFloat(/(\d+(?:\.\d+)?)px/.exec(o.font)?.[1]) || 10) * 0.55 });
      return (...a) => { calls.push([k, ...a]); };
    },
    set(o, k, v) { if (k === 'globalCompositeOperation') ops.push(v); o[k] = v; return true; },
  });
}
const texts = (ctx) => ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
const count = (ctx, name) => ctx.calls.filter((c) => c[0] === name).length;

// A stand-in DOM whose canvases record what is painted on them.
function withFakeDom(fn) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = { createElement: () => { const g = recordingCtx(); return { width: 0, height: 0, getContext: () => g }; } };
  try { return fn(); } finally { if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document; }
}

const freshGame = () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const g = new Game(); g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.camera.resize(800, 600);
  return g;
};

// ---------------- Golden hour and lantern glow ----------------
test('golden hour peaks with the sun on the horizon and is gone at noon and midnight', () => {
  assert.ok(goldenHour(0.74) > 0.9, 'dusk is golden');
  assert.ok(goldenHour(0.255) > 0.6, 'dawn is golden too');
  assert.ok(goldenHour(0.74) > goldenHour(0.255), 'dusk glows more than dawn');
  for (const p of [0, 0.5, 0.95]) assert.ok(goldenHour(p) < 0.02, `no golden hour at ${p}`);
  // Any phase, even out of range, gives a value in 0..1.
  for (let p = -1; p <= 2; p += 0.05) { const k = goldenHour(p); assert.ok(k >= 0 && k <= 1); }
});

test('the dusk grade is warm (gold toward the sun, plum away) and the sun sets in the west', () => {
  const dusk = cosyGrade(0.74);
  assert.ok(dusk.a > 0.4, 'laid on firmly at dusk');
  assert.ok(dusk.sun[0] > dusk.sun[2] + 100, 'the sunny side is gold');
  assert.ok(dusk.far[0] > dusk.far[1], 'the far side is a warm plum, not grey');
  assert.equal(dusk.fromLeft, true);
  const dawn = cosyGrade(0.25);
  assert.equal(dawn.fromLeft, false, 'the dawn sun is in the east');
  assert.ok(dawn.sun[0] > dawn.sun[2]);
  assert.equal(cosyGrade(0.5).a < 0.01, true, 'nothing at noon');
});

test('lanterns bloom from dusk and fully at night, never by day', () => {
  assert.equal(bloomStrength(0), 0);
  assert.equal(bloomStrength(0.3), 0);
  assert.ok(bloomStrength(0.6) > 0 && bloomStrength(0.6) < 1);
  assert.equal(bloomStrength(1), 1);
});

test('the cosy light does nothing headless, and paints a soft-light grade and blooms with a canvas', () => {
  const headless = new CosyLight();
  assert.equal(headless.draw(recordingCtx(), { dayPhase: () => 0.74 }, null, 0.5, 0, 0, 800, 600, 0), false);
  withFakeDom(() => {
    const cl = new CosyLight();
    // Dusk: the grade and the sun's glow.
    const ctx = recordingCtx();
    assert.equal(cl.draw(ctx, { dayPhase: () => 0.74 }, null, 0.47, 0, 0, 800, 600, 0), true);
    assert.ok(ctx.ops.includes('soft-light'), 'the grade is a soft light');
    assert.ok(count(ctx, 'drawImage') >= 2, 'grade and sun drawn');
    assert.equal(count(ctx, 'save'), count(ctx, 'restore'));
    // Midnight: no grade, but the warm lights bloom (magic ones keep their own glow).
    const lamps = Array.from({ length: 40 }, (_, i) => ({ x: i * 10, y: 50, r: 96, k: 1, rgb: [255, 214, 140] }));
    const lights = { _lights: [...lamps, { x: 0, y: 0, r: 70, k: 1, rgb: [150, 230, 255] }], count: 41, gather() { return this._lights; } };
    const night = recordingCtx();
    cl.draw(night, { dayPhase: () => 0 }, lights, 1, 0, 0, 800, 600, 0);
    assert.ok(!night.ops.includes('soft-light'));
    assert.ok(night.ops.includes('lighter'));
    assert.equal(cl.blooms, MAX_BLOOMS, 'capped');
    // Noon: nothing at all.
    const noon = recordingCtx();
    cl.draw(noon, { dayPhase: () => 0.5 }, lights, 0, 0, 0, 800, 600, 0);
    assert.equal(count(noon, 'drawImage'), 0);
    assert.equal(cl.blooms, 0);
  });
});

test('the renderer carries the cosy light and postcards, and a headless frame at dusk still renders', () => {
  const g = freshGame();
  const r = new Renderer(g, { width: 800, height: 600 }, recordingCtx());
  assert.ok(r.cosy instanceof CosyLight);
  assert.ok(r.postcards instanceof RegionPostcards);
  g.playMs = 600000 * 0.74;
  g.cine.enterRegion('Chinatown', { sub: 'Monsters level 5+' });
  assert.doesNotThrow(() => r.render(1000));
  const src = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  // Low graphics never reaches the cosy pass (it rides the light pass's else).
  assert.match(src, /if \(game\.lowFx \|\| !this\.lights\.ok[^\n]*\n\s*else this\.cosy\.draw\(/);
});

// ---------------- Postcards ----------------
test('every region has a postcard line, and anywhere else gets a friendly default', () => {
  for (const r of REGION_BADGES) {
    assert.ok(REGION_POSTCARDS[r], `${r} has a line`);
    assert.ok(REGION_POSTCARDS[r].length <= 70, `${r}'s line fits a postcard`);
  }
  assert.match(postcardLine('Nowhere'), /Wish you were here/);
  assert.equal(SITE_URL, 'adventure.a-worthy.com');
  assert.ok(/cosy/i.test(TAGLINE));
  for (const r of REGION_BADGES) assert.match(stampHue(r), /^#[0-9A-F]{6}$/i, `${r} has a stamp colour`);
});

test('fitFont shrinks long text to fit and always sets a font', () => {
  const g = recordingCtx();
  const s = fitFont(g, 'Sungei Buloh Wetlands', 100, 40);
  assert.ok(s < 40, 'shrunk');
  assert.ok(g.measureText('Sungei Buloh Wetlands').width <= 100 || s === 6);
  const tiny = fitFont(g, 'x', 1000, 4);
  assert.equal(tiny, 6, 'never below 6px, and the font is still set');
  assert.match(g.font, /6px/);
});

test('the arrival card says where you are, with its note, a stamp and a postmark', () => {
  const g = recordingCtx();
  paintArrivalCard(g, 330, 119, { name: 'Pulau Ubin', sub: 'Monsters level 20+', line: postcardLine('Pulau Ubin'), badge: null });
  const t = texts(g);
  assert.ok(t.includes('GREETINGS FROM'));
  assert.ok(t.includes('Pulau Ubin'));
  assert.ok(t.includes(postcardLine('Pulau Ubin')));
  assert.ok(t.includes('Monsters level 20+'));
  assert.ok(t.some((s) => /¢/.test(s)), 'the stamp has a value');
  // With its badge loaded, the stamp shows it.
  const badge = { width: 64, height: 64 };
  const s = recordingCtx();
  paintStamp(s, 0, 0, 60, 72, { badge });
  assert.ok(s.calls.some((c) => c[0] === 'drawImage' && c[1] === badge));
  const pm = recordingCtx();
  paintPostmark(pm, 50, 50, 20, { place: 'S’PORE', date: '19 NOV 2026' });
  assert.ok(texts(pm).includes('19 NOV 2026'));
  assert.equal(count(pm, 'save'), count(pm, 'restore'));
});

test('arrival cards fit the screen, and stay out of the grim lands and headless runs', () => {
  for (const vw of [300, 420, 800, 1600]) {
    const { w, h } = arrivalSize(vw);
    assert.ok(w <= Math.max(300, vw), `fits a ${vw} view`);
    assert.ok(h > 60 && h < w / 2);
  }
  const rp = new RegionPostcards();
  assert.equal(rp.draw(recordingCtx(), { name: 'Chinatown', sub: '', t: 0 }, 800, 600, 1), false, 'no DOM: the plaque takes over');
  withFakeDom(() => {
    const live = new RegionPostcards();
    const ctx = recordingCtx();
    assert.equal(live.draw(ctx, { name: 'Chinatown', sub: '', t: 0 }, 800, 600, 1), true);
    assert.equal(count(ctx, 'drawImage'), 1, 'one baked card a frame');
    assert.equal(live.draw(recordingCtx(), { name: 'Chinatown', sub: '', t: 900 }, 800, 600, 1), true);
    assert.equal(live._cache.size, 1, 'baked once');
    for (const dark of DARK_REGIONS) assert.equal(live.draw(recordingCtx(), { name: dark, sub: '', t: 0 }, 800, 600, 1), false, `${dark} keeps its dark plaque`);
  });
});

test('the photo postcard frames the view with the region, the game and where to play', () => {
  for (const [vw, vh] of [[1366, 820], [390, 844]]) {
    const { w, h } = photoPostcardSize(vw, vh);
    assert.equal(w >= h, vw >= vh, 'wide screens get a wide card, phones a tall one');
    const g = recordingCtx();
    const photo = { width: vw, height: vh };
    const logo = { width: 300, height: 260 };
    const win = composePostcard(g, w, h, { photo, region: 'Chinatown', logo, date: '19 NOV 2026', name: 'Ah Boy' });
    assert.ok(win.x > 0 && win.y > 0 && win.x + win.w < w && win.y + win.h < h, 'the photo sits inside the card');
    const t = texts(g);
    assert.ok(t.includes('Greetings from'));
    assert.ok(t.includes('Chinatown'));
    assert.ok(t.includes('A-Worthy Adventure'));
    assert.ok(t.includes(TAGLINE));
    assert.ok(t.some((s) => s.includes(SITE_URL)), 'the website is on every postcard');
    assert.ok(t.some((s) => s.includes(postcardLine('Chinatown'))));
    assert.ok(t.some((s) => s.includes('Ah Boy')));
    assert.ok(g.calls.some((c) => c[0] === 'drawImage' && c[1] === photo), 'the snapshot is on it');
    assert.ok(g.calls.some((c) => c[0] === 'drawImage' && c[1] === logo), 'and the mascot');
    assert.equal(count(g, 'save'), count(g, 'restore'));
  }
  // No photo (or no logo) still makes a card.
  assert.doesNotThrow(() => composePostcard(recordingCtx(), 1600, 1100, {}));
});

test('postcard mode builds a card from the game, names the file and words the share', () => {
  const g = freshGame();
  g.currentZoneName = 'Kampong Glam';
  const made = [];
  const cv = buildPostcard(g, { width: 800, height: 600 }, (w, h) => { const c = { width: w, height: h, g: recordingCtx(), getContext() { return this.g; } }; made.push(c); return c; }, { vw: 1366, vh: 820, date: '1 JAN 2027' });
  assert.equal(made.length, 1);
  assert.equal(cv.width, 1600);
  assert.ok(texts(cv.g).includes('Kampong Glam'));
  assert.ok(texts(cv.g).some((s) => s.includes('1 JAN 2027')));
  assert.equal(buildPostcard(g, null, () => ({})), null, 'no 2D context: no card');
  assert.equal(postcardFileName('Sungei Buloh Wetlands'), 'a-worthy-postcard-sungei-buloh-wetlands.png');
  assert.equal(postcardFileName(), 'a-worthy-postcard-singapore.png');
  assert.match(shareText('Pulau Ubin'), /^Greetings from Pulau Ubin! .*https:\/\/adventure\.a-worthy\.com$/);
  assert.equal(postmarkDate(new Date(2026, 10, 19)), '19 NOV 2026');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /import\('\.\/ui\/photomode\.js'\)\.then\(\(m\) => m\.initPhotoMode\(game, canvas\)\)/);
});

// ---------------- The title ----------------
test('the cosy skyline is one tidy SVG with the old neighbourhood and its moving bits', () => {
  const svg = cosySkylineSvg();
  assert.match(svg, new RegExp(`^<svg viewBox="0 0 ${COSY_VIEW.w} ${COSY_VIEW.h}"`));
  assert.ok(svg.endsWith('</svg>'));
  for (const bit of ['ct-lantern', 'ct-steam', 'ct-bulb', 'ct-cloth', 'ct-palm', 'KOPITIAM']) assert.ok(svg.includes(bit), bit);
  // The city stands hazy behind (the old skyline, nested).
  assert.match(svg, /<svg x="0" y="36" width="1200" height="140" opacity="\.55" viewBox="0 0 1200 140"/);
  const opens = (svg.match(/<g[ >]/g) || []).length, closes = (svg.match(/<\/g>/g) || []).length;
  assert.equal(opens, closes, 'groups balanced');
  assert.equal((svg.match(/<svg/g) || []).length, (svg.match(/<\/svg>/g) || []).length);
  assert.doesNotMatch(svg, /rx="[\d.]+ [\d.]/, 'rx takes one length');
  assert.doesNotMatch(svg, /NaN|undefined/);
});

test('fireflies come out as asked, and dressing the title is safe without a page', () => {
  let n = 0;
  const html = fireflyHtml(9, () => ((n++ * 37) % 100) / 100);
  assert.equal((html.match(/class="ct-fly"/g) || []).length, 9);
  assert.doesNotThrow(() => dressTitle(null));
  const title = readFileSync(new URL('../src/ui/title.js', import.meta.url), 'utf8');
  assert.match(title, /: cosySkylineSvg\(\);\n\s*dressTitle\(this\.splash/);
});

test('the page shares well: description, Open Graph and Twitter cards, theme colour, and the cosy styles', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const meta = (attr, name) => new RegExp(`<meta ${attr}="${name}" content="([^"]+)"`).exec(html)?.[1];
  assert.ok(meta('name', 'description')?.length > 60);
  for (const p of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:site_name']) assert.ok(meta('property', p), p);
  for (const n of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) assert.ok(meta('name', n), n);
  assert.ok(meta('name', 'theme-color'));
  const img = meta('property', 'og:image');
  assert.match(img, /^https:\/\/adventure\.a-worthy\.com\//, 'an absolute link (crawlers need one)');
  assert.ok(existsSync(new URL(`../${img.replace('https://adventure.a-worthy.com/', '')}`, import.meta.url)), 'the shared image is in the repo');
  assert.match(html, /rel="icon"/);
  assert.match(html, /<link rel="stylesheet" href="styles\/cosy.css" \/>/);
  assert.ok(html.indexOf('styles/cosy.css') > html.indexOf('styles/title.css'), 'after title.css, which it builds on');
  assert.match(html, /class="splash-lah"[^>]*>Steady lah, adventurer!</);
  const css = readFileSync(new URL('../styles/cosy.css', import.meta.url), 'utf8');
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((noComments.match(/\{/g) || []).length, (noComments.match(/\}/g) || []).length, 'braces balanced');
  assert.doesNotMatch(noComments, /@media \(pointer: coarse\)\s*\{/);
  // Reduced motion stills the title's moving parts.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
