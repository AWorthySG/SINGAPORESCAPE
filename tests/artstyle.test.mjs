// House style, as implemented: the A-Worthy sticker look has one dark, the navy
// ink #22304A (rgb 34,48,74). Outlines, text strokes, shadows and shading in
// drawn art, SVG fallbacks and the stylesheets use it (or a thinned-out rgba of
// it), never black or brown. These checks keep new code from drifting back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { drawShadow, SHADOW_RGB } from '../src/render/sprites.js';

const NAVY = [34, 48, 74];
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** [r, g, b, a] from '#rgb', '#rrggbb' or 'rgba(r,g,b,a)'; null for anything else (variables, gradients...). */
function parse(c) {
  c = c.trim();
  let m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)).concat(1);
  m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return null;
}
/** A dark ink colour that isn't the navy family: near-black, charcoal or a dull
 *  dark brown. (Deep, saturated material colours, such as a dark red wound or a
 *  wood-brown log, are paint, not ink, and are left alone.) */
function offInk(c) {
  const v = parse(c);
  if (!v) return false;
  const [r, g, b, a] = v;
  if (a === 0) return false;                      // a transparent gradient stop
  if (Math.max(r, g, b) > 90) return false;       // not a dark: a colour, fine
  if (b - r >= 20 && b >= g) return false;        // navy-family darks are blue-led
  return Math.max(r, g, b) - Math.min(r, g, b) <= 30;
}

test('ground shadows are the navy ink thinned out, not black', () => {
  assert.equal(SHADOW_RGB, NAVY.join(','));
  const stops = [];
  const grad = { addColorStop: (k, c) => stops.push(c) };
  const noop = () => {};
  const ctx = { createRadialGradient: () => grad, beginPath: noop, ellipse: noop, fill: noop, set fillStyle(v) {} };
  drawShadow(ctx, 0, 0, 10, 4);   // headless: draws directly rather than from the cached bitmap
  assert.ok(stops.length >= 2);
  for (const c of stops) assert.ok(c.startsWith(`rgba(${NAVY.join(',')},`), `shadow stop ${c}`);
});

test('drawn art outlines and text strokes use the navy ink, not black or brown', () => {
  const dir = new URL('../src/render/', import.meta.url);
  const bad = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    // strokeStyle = '...', and sprites.js's line(ctx, '...') outline helper
    const re = /(?:strokeStyle\s*=\s*|line\(\s*\w+\s*,\s*)(['"`])([^'"`$]+)\1/g;
    for (const m of src.matchAll(re)) if (offInk(m[2])) bad.push(`${f}: ${m[2]}`);
  }
  assert.deepEqual(bad, [], `off-palette outline colours:\n${bad.join('\n')}`);
});

test('SVG fallback icons outline and shade in navy', () => {
  const src = read('src/render/icons.js');
  assert.match(src, /const OL = '#22304A'/);
  const bad = [...src.matchAll(/(?:stroke|fill)="([^"$]+)"/g)].map((m) => m[1]).filter((c) => /^rgba\(0,\s*0,\s*0/.test(c) && parse(c)[3] > 0);
  assert.deepEqual(bad, [], 'black shading in SVG icons');
});

test('the stylesheets cast navy shadows, not black ones', () => {
  const dir = new URL('../styles/', import.meta.url);
  const bad = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.css'))) {
    const css = readFileSync(new URL(f, dir), 'utf8');
    for (const m of css.matchAll(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/g)) if (+m[1] > 0) bad.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('canvas text is set in the one typeface (Nunito)', () => {
  const dir = new URL('../src/render/', import.meta.url);
  const bad = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/\.font\s*=\s*(['"])([^'"]+)\1/g)) if (!/Nunito/.test(m[2])) bad.push(`${f}: ${m[2]}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});
