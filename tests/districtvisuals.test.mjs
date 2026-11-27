import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DISTRICT_VISUALS, districtVisual } from '../src/data/districtVisuals.js';
import { UI } from '../src/ui/ui.js';
import { drawDangerMark, drawSafeZone } from '../src/render/bossmechfx.js';

test('every mapped district has its own palette and an existing landmark image', () => {
  const world = readFileSync(new URL('../src/data/world.js', import.meta.url), 'utf8');
  const names = [...world.matchAll(/\{ name: '([^']+)', x0: /g)].map(([, name]) => name);
  assert.deepEqual(Object.keys(DISTRICT_VISUALS).sort(), names.sort());
  const papers = new Set();
  for (const name of names) {
    const [ink, paper, feature, art] = districtVisual(name);
    assert.match(ink, /^#[0-9A-F]{6}$/i);
    assert.ok(feature && existsSync(new URL(`../assets/world/${art}`, import.meta.url)), name);
    papers.add(paper);
  }
  assert.equal(papers.size, names.length);
});

test('arrival card displays a landmark, and unthemed areas clear the old palette', () => {
  const label = () => {
    const props = new Map();
    const flags = new Map();
    return { props, flags, style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) },
      classList: { toggle: (k, v) => flags.set(k, v) } };
  };
  const ui = { el: { region: label(), minimapRegion: label() } };
  const show = (name, level) => UI.prototype.setRegion.call(ui, name, level);
  show('Kampong Glam');
  assert.match(ui.el.region.innerHTML, /obj-golden_dome_hall\.webp/);
  assert.match(ui.el.region.innerHTML, /Golden-domed hall/);
  assert.equal(ui.el.minimapRegion.props.get('--district-paper'), districtVisual('Kampong Glam')[1]);
  show('The Wilderness', 3);
  assert.equal(ui.el.region.flags.get('wild'), true);
  assert.match(ui.el.region.innerHTML, /Lvl 3/);
  show('An unthemed instance');
  assert.equal(ui.el.region.props.size, 0);
  assert.equal(ui.el.minimapRegion.props.size, 0);
  assert.equal(ui.el.region.flags.get('wild'), false);
});

test('danger is a triangle while safety is a labelled circle', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]) });
  drawDangerMark(ctx, 10, 20);
  assert.deepEqual(calls.filter(([op]) => op === 'moveTo' || op === 'lineTo'), [
    ['moveTo', 10, 10], ['lineTo', 20, 27], ['lineTo', 0, 27],
  ]);
  assert.ok(calls.some(([op, text]) => op === 'fillText' && text === '!'));
  calls.length = 0;
  drawSafeZone(ctx, { safe: { cx: 4, cy: 4, r: 1 } }, 0, 0, 100, 32);
  assert.ok(calls.some(([op]) => op === 'arc'));
  assert.ok(calls.some(([op, text]) => op === 'fillText' && text === 'SAFE'));
});
