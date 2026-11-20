// The sticker card UI kit (the block at the end of styles/main.css), the
// title's parallax city layers (src/ui/title.js) and the painted icons on the
// Codex switch. No browser here: the CSS is checked as text and the layer
// builders as strings.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TITLE_LAYERS, TITLE_ART_SLOTS, titleLayerHTML, parallaxShift, PARALLAX_PX, cloudSvg, titleCloudsLayer,
} from '../src/ui/title.js';
import { cosySkylineSvg } from '../src/ui/cosytitle.js';
import { codexSwitchHTML, CODEX_VIEWS, CODEX_VIEW_ART } from '../src/ui/compendiumui.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('every stylesheet the kit touches keeps its braces balanced and no bare touch block', () => {
  for (const f of ['styles/main.css', 'styles/title.css', 'styles/cosy.css', 'styles/compact.css']) {
    const css = strip(read(f));
    assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, `${f}: braces balanced`);
  }
  const main = strip(read('styles/main.css'));
  const kit = main.slice(main.lastIndexOf('#sidepanel, #chatbox, #modal-window, #context-menu'));
  assert.doesNotMatch(kit, /@media \(pointer: coarse\)\s*\{/, 'the kit adds no bare touch block');
});

test('the kit is built on one set of tokens', () => {
  const css = read('styles/main.css');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  for (const t of ['--paper', '--paper-warm', '--paper-deep', '--paper-grain', '--rim', '--r-window', '--r-panel', '--r-card', '--r-slot', '--r-chip',
    '--shadow-float', '--shadow-float-sm', '--shadow-btn', '--shadow-btn-down', '--gloss', '--btn-gloss', '--font-display', '--fw-display', '--ease-pop']) {
    assert.match(root, new RegExp(`${t}:`), `${t} defined`);
  }
  // The paper grain is inline (no image request).
  assert.match(root, /--paper-grain: url\("data:image\/svg\+xml,/);
  const kit = css.slice(css.indexOf('Sticker card UI kit\n'));
  for (const t of ['var(--paper-grain)', 'var(--shadow-float)', 'var(--gloss)', 'var(--btn-gloss)', 'var(--font-display)']) assert.ok(kit.includes(t), `kit uses ${t}`);
});

test('windows pop only on mouse screens and only without reduced motion; phones keep their sheets', () => {
  const css = strip(read('styles/main.css'));
  const kit = css.slice(css.lastIndexOf('#sidepanel, #chatbox, #modal-window, #context-menu'));
  assert.match(kit, /@media \(prefers-reduced-motion: no-preference\) and \(pointer: fine\) \{\s*#modal-window \{ animation: kitPop/);
  // kitPop is never given to the modal outside that block.
  const outside = kit.replace(/@media \(prefers-reduced-motion: no-preference\)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.doesNotMatch(outside, /animation: kit/);
});

test('the title city is one function per layer, each with a painted art slot', () => {
  assert.deepEqual(TITLE_LAYERS.map((l) => l.id), ['sunset', 'clouds', 'far', 'mid']);
  for (const l of TITLE_LAYERS) {
    assert.ok(TITLE_ART_SLOTS[l.slot], `${l.id}: slot ${l.slot} is described for the art brief`);
    assert.equal(typeof l.draw, 'function');
    const html = titleLayerHTML(l);   // no painted file yet: the placeholder
    assert.equal(html, l.draw());
    assert.doesNotMatch(html, /NaN|undefined/);
    assert.equal((html.match(/<svg/g) || []).length, (html.match(/<\/svg>/g) || []).length, `${l.id}: svgs closed`);
    assert.equal((html.match(/<g[ >]/g) || []).length, (html.match(/<\/g>/g) || []).length, `${l.id}: groups balanced`);
  }
  // Back layers sway less than near ones; the sky holds still.
  const depths = TITLE_LAYERS.map((l) => l.depth);
  assert.deepEqual([...depths].sort((a, b) => a - b), depths);
  assert.equal(parallaxShift(0, 1), 0);
  assert.equal(Math.abs(parallaxShift(1, 1)), PARALLAX_PX);
  assert.ok(Math.abs(parallaxShift(0.25, 1)) < Math.abs(parallaxShift(0.55, 1)));
  assert.equal(parallaxShift(0.5, -1), -parallaxShift(0.5, 1));
  // The far city has its landmarks.
  const far = TITLE_LAYERS.find((l) => l.id === 'far').draw();
  for (const bit of ['tflyer', 'tlight']) assert.ok(far.includes(bit), bit);
  assert.match(TITLE_LAYERS.find((l) => l.id === 'mid').draw(), /BLK \d+/);
});

test('clouds are the same every time and drift at their own pace', () => {
  assert.equal(cloudSvg(200, 3), cloudSvg(200, 3));
  const html = titleCloudsLayer(4);
  assert.equal((html.match(/class="tcl"/g) || []).length, 4);
  assert.equal(html, titleCloudsLayer(4));
  assert.equal(new Set(html.match(/animation-duration:\d+s/g)).size, 4);
});

test('the near neighbourhood leaves the city out when the layers draw it', () => {
  assert.equal((cosySkylineSvg().match(/<svg/g) || []).length, 2, 'alone, it nests the city');
  const near = cosySkylineSvg({ city: false });
  assert.equal((near.match(/<svg/g) || []).length, 1);
  assert.ok(!near.includes('ctHaze"/>') || !near.includes('fill="url(#ctHaze)"'));
  assert.ok(near.includes('KOPITIAM'));
});

test('the Codex switch wears painted icons where they exist, emoji elsewhere', () => {
  const html = codexSwitchHTML('items');
  for (const [id, art] of Object.entries(CODEX_VIEW_ART)) {
    const btn = html.slice(html.indexOf(`data-view="${id}"`), html.indexOf('</button>', html.indexOf(`data-view="${id}"`)));
    assert.ok(btn.includes(`assets/icons/tab-${art}.webp`), `${id} has its picture`);
    assert.doesNotMatch(btn, /[\u{1F300}-\u{1FAFF}✨]/u, `${id} lost its emoji`);
  }
  for (const [id, label] of CODEX_VIEWS) assert.ok(html.includes(label.replace(/^\S+\s/, '')), `${id} keeps its name`);
  assert.match(html, /data-view="items" aria-selected="true"/);
});
