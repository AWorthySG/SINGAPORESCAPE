// Overheads, round two: names as cached sticker pills (bounded cache, kept
// apart as before), hit numbers drawn under the names and kept off the middle
// column over a head, at most three numbers per foe, and the minimap in the
// painted ground's colours with two kinds of creature dot and quest markers.
// Headless: a stand-in canvas that notes the words it is asked to draw.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave } from '../src/game/save.js';
import { Renderer, splatSide, SPLAT_SIDE } from '../src/render/renderer.js';
import { namePill, clearNamePillCache, pillRes, pillCacheSize, PILL_CAP, PILL_ROW, PILL_STYLES } from '../src/render/namepill.js';
import { MINIMAP_RGB, paintMinimapTerrain, minimapNpcKind } from '../src/render/minimapart.js';
import { TERRAIN } from '../src/data/world.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
function textCtx() {
  const noop = () => {}, grad = { addColorStop: noop };
  const texts = [];
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '',
    measureText: (s) => ({ width: String(s).length * 6 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
    fillText: (s, x, y) => texts.push({ s: String(s), x, y }), texts,
  };
  for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'setLineDash', 'transform', 'beginPath', 'closePath', 'drawImage',
    'strokeText', 'clearRect', 'setTransform', 'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo',
    'fill', 'stroke', 'fillRect', 'strokeRect']) ctx[k] = noop;
  return ctx;
}
function rendererFor(g) {
  g.camera.resize(800, 600);
  g.camera.follow(g.player.x * 32 + 16, g.player.y * 32 + 16);
  const ctx = textCtx();
  return { r: new Renderer(g, {}, ctx), ctx, ox: g.camera.originX, oy: g.camera.originY };
}

// ---------------- Name pills ----------------
test('name pills are cached by words, style and scale, and the cache stays bounded', () => {
  const ctx = textCtx();
  const a = namePill(ctx, 'Goblin', 'even', 2);
  assert.equal(namePill(ctx, 'Goblin', 'even', 2), a, 'the same pill comes back from the cache');
  assert.notEqual(namePill(ctx, 'Goblin', 'danger', 2), a, 'another style is another pill');
  assert.notEqual(namePill(ctx, 'Goblin', 'even', 3), a, 'and another scale too');
  assert.ok(a.w > 6 * 'Goblin'.length, 'the card is wider than its words');
  clearNamePillCache();
  assert.notEqual(namePill(ctx, 'Goblin', 'even', 2), a, 'a font refresh rebuilds cached labels');
  for (let i = 0; i < PILL_CAP * 2; i++) namePill(ctx, `Villager ${i}`, 'town', 1);
  assert.ok(pillCacheSize() <= PILL_CAP, `at most ${PILL_CAP} kept: ${pillCacheSize()}`);
  for (const k of ['town', 'own', 'easy', 'even', 'danger', 'champion', 'boss']) assert.ok(PILL_STYLES[k], k);
  // A slow zoom repaints a pill only at half steps.
  assert.equal(pillRes({ dpr: 2, zoom: 1.04 }), 2.5);
  assert.equal(pillRes({ dpr: 2, zoom: 1.2 }), 2.5);
  assert.equal(pillRes({ dpr: 1, zoom: 1 }), 1);
  assert.equal(pillRes({ dpr: 3, zoom: 2 }), 4, 'capped');
});

test('monsters wear their name on a pill and two champions still step apart', () => {
  const g = newGame();
  const p = g.player;
  const a = new NPC('goblin', p.x + 3, p.y, 0, {});
  const b = new NPC('goblin', p.x + 3, p.y, 0, {});
  for (const n of [a, b]) { n.champion = true; n.hp = n.maxHp = 1e6; }
  g.npcs.push(a, b);
  g._near = null; g._around = null;
  p.target = a;
  const { r, ctx, ox, oy } = rendererFor(g);
  r._drawOverheads(ox, oy, []);
  const names = ctx.texts.filter((t) => t.s === `★ ${a.name}`);
  assert.equal(names.length, 2);
  assert.ok(Math.abs(names[0].y - names[1].y) >= PILL_ROW, `a pill's height apart: ${names[0].y} / ${names[1].y}`);
});

// ---------------- Hit numbers ----------------
test('hit numbers draw before the names, so a name is never covered', () => {
  const g = newGame();
  const p = g.player;
  const foe = new NPC('goblin', p.x + 2, p.y, 0, {});
  foe.champion = true; foe.hp = foe.maxHp = 1e6;
  g.npcs.push(foe);
  g._near = null; g._around = null;
  p.target = foe;
  const { r, ctx, ox, oy } = rendererFor(g);
  g.addHitsplat(foe, 123, { noMerge: true });
  r._drawOverheads(ox, oy, []);
  const num = ctx.texts.findIndex((t) => t.s === '123');
  const name = ctx.texts.findIndex((t) => t.s === `★ ${foe.name}`);
  assert.ok(num >= 0 && name >= 0, 'both drawn');
  assert.ok(num < name, 'the number first, the name over it');
});

test('hit numbers keep to either side of the middle column over a head', () => {
  for (const fan of [-1.6, -0.8, 0, 0.8, 1.6]) for (const row of [0, 1]) {
    const s = splatSide({ fan, row });
    assert.ok(Math.abs(s) >= SPLAT_SIDE, `fan ${fan} row ${row}: ${s}`);
    if (fan) assert.equal(Math.sign(s), Math.sign(fan), 'the same side it hops to');
  }
  assert.notEqual(splatSide({ fan: 0, row: 0 }), splatSide({ fan: 0, row: 1 }), 'the middle slot alternates sides by row');
});

test('a foe shows at most three numbers at once; further plain hits add into the newest', () => {
  const g = newGame();
  const foe = new NPC('goblin', g.player.x + 2, g.player.y, 0, {});
  foe.hp = foe.maxHp = 1e6;
  g.npcs.push(foe);
  g.effects = [];
  const live = () => g.effects.filter((e) => e.type === 'hitsplat' && e.entity === foe && e.life > 120);
  let dealt = 0;
  for (let i = 0; i < 12; i++) {
    for (const e of live()) e.life -= 250;   // apart in time: past the quick-merge window
    const d = 200 + i;
    dealt += d;
    g.addHitsplat(foe, d);
  }
  assert.ok(live().length <= 3, `${live().length} numbers`);
  const shown = g.effects.filter((e) => e.type === 'hitsplat' && e.entity === foe).reduce((s, e) => s + e.dmg, 0);
  assert.equal(shown, dealt, 'no damage goes missing from the numbers');
  // Words and crits still show on their own.
  g.addHitsplat(foe, 0, { text: 'Dodged!' });
  g.addHitsplat(foe, 50, { critX: 2 });
  assert.ok(g.effects.some((e) => e.text === 'Dodged!'));
  assert.ok(g.effects.some((e) => e.entity === foe && e.critX === 2 && e.dmg === 50));
});

// ---------------- Minimap ----------------
test('the minimap paints every ground kind in its painted colour, with soft edges', () => {
  for (const t of Object.values(TERRAIN)) assert.ok(Array.isArray(MINIMAP_RGB[t]), `terrain ${t} has a colour`);
  const tiles = [[TERRAIN.GRASS, TERRAIN.GRASS], [TERRAIN.GRASS, TERRAIN.WATER]];
  const world = { width: 2, height: 2, terrainAt: (x, y) => tiles[y][x] };
  const d = new Uint8ClampedArray(2 * 2 * 4);
  paintMinimapTerrain(world, d);
  assert.deepEqual([...d.slice(0, 3)], MINIMAP_RGB[TERRAIN.GRASS], 'plain grass');
  const water = d.slice(12, 15), want = MINIMAP_RGB[TERRAIN.WATER];
  assert.ok(water[2] < want[2] && water[2] > want[2] * 0.7, 'water meeting grass is shaded a little');
  assert.ok(MINIMAP_RGB[TERRAIN.STONE][0] > 200, 'town paving is light, not the old grey');
});

test('minimap dots: foes, everyone else, and quest people as markers', () => {
  const g = newGame();
  const foe = g.npcs.find((n) => n.alive && n.attackable);
  const folk = g.npcs.filter((n) => n.alive && !n.attackable);
  assert.equal(minimapNpcKind(g, foe), 'foe');
  const kinds = new Set(folk.map((n) => minimapNpcKind(g, n)));
  for (const k of kinds) assert.ok(k === 'friend' || k === 'quest', k);
  assert.ok(kinds.has('friend'));
  // Start a quest whose next step is talking to someone: they show as a marker.
  const guide = g.npcs.find((n) => n.npcId === 'guide');
  if (guide) {
    g._questNpcLabels = { tick: g.tickCount, ids: new Set(['guide']) };
    assert.equal(minimapNpcKind(g, guide), 'quest');
  }
});
