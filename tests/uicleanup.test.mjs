// A UI clean-up: a short hover line for monsters, tips that put themselves
// away, a capped objectives list, shop prices, "⇧1" key badges, the Skills
// tab's skills first, one Compendium button fewer, and the overhead labels
// (boss names and the target tag kept apart, your own name off in Smart mode,
// "weak!" once per foe). Headless: a stand-in DOM and canvas where needed.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave } from '../src/game/save.js';
import { Renderer } from '../src/render/renderer.js';
import { NoticeLane } from '../src/ui/noticelane.js';
import { TIP_MS } from '../src/ui/tips.js';
import { trackerHTML, TRACKER_ROWS, TRACKER_ROWS_PHONE, sellSideSmall } from '../src/ui/hudease.js';
import { slotKeyLabel } from '../src/ui/quickbar.js';
import { UI } from '../src/ui/ui.js';

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
/** A UI stand-in: the real methods, no-ops for everything else. */
function uiFor(g, el = {}, own = {}) {
  const t = { game: g, el, ...own };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : typeof UI.prototype[k] === 'function' ? UI.prototype[k].bind(o) : () => {}) });
}
// A 2D context that only notes the text it is asked to draw.
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

// ---------------- Hover text ----------------
test('a monster in reach reads "Attack <name> (Lv N)", and still keeps its own Attack on touch screens', () => {
  const g = newGame();
  const p = g.player;
  const foe = g.npcs.find((n) => n.alive && n.attackable && !n.def.boss && !n.def.fixed);
  foe.x = foe.tx = p.x + 1; foe.y = foe.ty = p.y; foe.target = null;
  g._near = null; g._around = null;
  const label = g._interactLabel({ kind: 'npc', ref: foe });
  assert.equal(label[0], 'Attack');
  assert.equal(label[1], `${foe.name} (Lv ${foe.def.level})`);
  assert.equal(label.length, 5, 'the fifth entry (keep the Interact button) is still there');
  assert.ok(!/weak|resists|beast|armour/i.test(label[1]), 'the details are on the target card');
});

// ---------------- Tips ----------------
test('a tip card puts itself away after about six seconds', () => {
  const g = newGame();
  const ui = { game: g, el: {} };
  g.tipsOn = true;
  UI.prototype.showTip.call(ui, 'move');
  assert.ok(ui.lane instanceof NoticeLane);
  const tip = ui.lane.queue.items.find((x) => x.kind === 'tip');
  assert.ok(tip, 'the tip is in the lane');
  assert.equal(tip.ttl, TIP_MS);
  assert.ok(TIP_MS > 0 && TIP_MS <= 6000, `${TIP_MS}ms`);
});

// ---------------- Objectives ----------------
test('the leading objective stays visible while details expand on demand', () => {
  const rows = [1, 2, 3, 4, 5].map((i) => `<div class="trk-row">Row ${i}</div>`);
  const short = trackerHTML(rows, false);
  assert.equal(TRACKER_ROWS, 3);
  assert.ok(short.includes('Row 3') && !short.includes('Row 4'), 'three rows');
  assert.match(short, /class="trk-more"[^>]*>\+2 more</);
  const all = trackerHTML(rows, false, { open: true });
  assert.ok(all.includes('Row 5') && all.includes('Show less'), 'a tap shows them all');
  const phone = trackerHTML(rows, false, { max: TRACKER_ROWS_PHONE });
  assert.ok(phone.includes('Row 2') && !phone.includes('Row 3') && phone.includes('+3 more'), 'two on a phone');
  const leading = trackerHTML(rows, false, { max: 1 });
  assert.ok(leading.includes('Row 1') && !leading.includes('Row 2'));
  assert.match(leading, /aria-expanded="false" aria-controls="tracked-objectives"[^>]*>\+4 more</);
  assert.match(all, /id="tracked-objectives" class="trk-rows" tabindex="0"/);
  assert.ok(!trackerHTML(rows.slice(0, 3), false).includes('trk-more'), 'nothing to fold at three');
  assert.ok(!trackerHTML(rows, true).includes('trk-more'), 'a folded tracker is one line');
});

// ---------------- Shop, quick bar ----------------
test('the shop stock widens while the sell side is small; quick-bar badges say Shift', () => {
  assert.equal(sellSideSmall(4, 40), true);
  assert.equal(sellSideSmall(30, 40), false);
  assert.equal(slotKeyLabel(0), '⇧1');
  assert.equal(slotKeyLabel(5), '⇧6');
  const src = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.match(src, /buyCell\.appendChild\(shopPriceEl\(price\)\)/, 'each item for sale shows its price');
});

// ---------------- Skills tab ----------------
test('the Skills tab lists the skills first, the perk links as one chip row under them', () => {
  const g = newGame();
  const made = (tag) => {
    const el = { tag, className: '', title: '', children: [], _html: '',
      appendChild(c) { this.children.push(c); return c; }, addEventListener() {}, closest: () => null,
      classList: { add() {}, toggle() {}, contains: () => false } };
    Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; if (v === '') this.children = []; } });
    Object.defineProperty(el, 'textContent', { get() { return this._html; }, set(v) { this._html = v; } });
    return el;
  };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = { createElement: made };
  try {
    const grid = made('div');
    const ui = uiFor(g, { skillsGrid: grid, skillsTotal: made('div') }, { _tip() {}, renderAlignment() {} });
    UI.prototype.renderSkills.call(ui);
    assert.equal(grid.children[0].className, 'skill-group', 'a group heading comes first');
    assert.ok(grid.children.some((c) => c.className === 'skill-cell'), 'the skills are there');
    const links = grid.children[grid.children.length - 1];
    assert.equal(links.className, 'skill-links', 'the links come last');
    assert.deepEqual(links.children.map((c) => c.innerHTML.replace(/<[^>]+>/g, '')), ['Passive perks', 'Life skill perks', 'Resources']);
  } finally { if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document; }
});

test('the Journal has no Compendium button of its own (the Codex and Settings keep theirs)', () => {
  const src = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /addCompendiumButton/);
  assert.match(src, /mk\('Compendium: how the game works'/, 'Settings still opens it');
  assert.match(src, /mk\('Postcard mode/, 'and postcard mode is in Settings too (its badge is off on touch screens)');
});

// ---------------- Overheads ----------------
test('your own name is off in Smart mode, on in All and in postcard mode', () => {
  const g = newGame();
  const { r, ctx, ox, oy } = rendererFor(g);
  const mine = () => ctx.texts.filter((t) => t.s === g.player.name).length;
  g.worldLabels = 'smart';
  r._drawOverheads(ox, oy, []);
  assert.equal(mine(), 0, 'Smart: no name over your head');
  g.photoMode = true;
  r._drawOverheads(ox, oy, []);
  assert.equal(mine(), 1, 'postcard mode shows it');
  g.photoMode = false;
  ctx.texts.length = 0;
  g.worldLabels = 'all';
  r._drawOverheads(ox, oy, []);
  assert.equal(mine(), 1, 'All shows it');
});

test('two champions side by side, and your target tag, are kept apart', () => {
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
  assert.equal(names.length, 2, 'both champions are named');
  assert.ok(Math.abs(names[0].y - names[1].y) >= 11, `on different lines: ${names[0].y} / ${names[1].y}`);
  assert.equal(r._nPlaced >= 3, true, 'the names and the target tag are all placed');
  // Drawing again places afresh (the list is reused, not grown).
  const n = r._nPlaced, len = r._placed.length;
  r._drawOverheads(ox, oy, []);
  assert.equal(r._nPlaced, n);
  assert.equal(r._placed.length, len, 'no new spots made on the next frame');
});

test('"weak!" shows on the first weak hit on a foe, not on every one', () => {
  const g = newGame();
  const p = g.player;
  const foe = new NPC('goblin', p.x + 2, p.y, 0, {});
  foe.hp = foe.maxHp = 1e6;
  g.npcs.push(foe);
  const { r, ctx, ox, oy } = rendererFor(g);
  g.addHitsplat(foe, 5, { weak: true, noMerge: true });
  g.addHitsplat(foe, 6, { weak: true, noMerge: true });
  g.addHitsplat(foe, 7, { weak: true, noMerge: true });
  r._drawOverheads(ox, oy, []);
  assert.equal(ctx.texts.filter((t) => t.s === 'weak!').length, 1, 'one tag for three weak hits');
  // A respawned foe is a new one: its first weak hit says so again.
  foe.die?.(g);
  foe.respawn();
  for (const e of g.effects) e.life = 0;
  g.effects.length = 0;
  ctx.texts.length = 0;
  g.addHitsplat(foe, 5, { weak: true, noMerge: true });
  r._drawOverheads(ox, oy, []);
  assert.equal(ctx.texts.filter((t) => t.s === 'weak!').length, 1);
});

test('the clean-up rules keep the Interact button on touch screens', () => {
  const css = readFileSync(new URL('../styles/compact.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'braces balanced');
  // Mouse screens only: on touch a monster beside you keeps its Attack there.
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*#interact-btn \{ display: none; \}/);
  assert.match(css, /#sidepanel:not\(\.collapsed\) #panel-body \{ height: min\(520px, calc\(100dvh - 420px\)\); \}/, 'a taller desktop panel');
});
