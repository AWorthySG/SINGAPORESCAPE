// Late-game lag from repeated work and garbage: the quick-use choice scanning a
// bag of hundreds of pieces of gear on every change, a full save written on
// nearly every tick of a big fight, a fresh buffer of random noise made for
// every hit sound, and every frame working out where each of the thousand-odd
// nearby monsters is drawn just to find most are off screen. Each now does
// less work with exactly the same result.
import { seedRandom } from './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { ITEMS } from '../src/data/items.js';
import { POTIONS } from '../src/data/trades.js';
import { quickUseChoice, healOf } from '../src/game/quickuse.js';
import { EventBus } from '../src/core/events.js';
import { Sfx } from '../src/audio/sfx.js';
import { NPC } from '../src/game/npc.js';
import { Character } from '../src/game/character.js';
import { Renderer } from '../src/render/renderer.js';
import { TerrainFx } from '../src/render/terrainfx.js';

function fakeStorage(onSet) {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); onSet?.(k); }, removeItem: (k) => m.delete(k) };
}
function newGame(onSet) {
  globalThis.localStorage = fakeStorage(onSet);
  clearSave();
  const g = new Game();
  g.start();
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
const step = (g, n) => { for (let i = 0; i < n; i++) g.update(600); };

// The quick-use choice as it was worked out before (every kind of item tallied).
function choiceBefore(game) {
  const max = game.maxHp();
  const missing = Math.max(0, max - game.player.hp);
  const seen = new Map();
  game.inventory.slots.forEach((s, i) => {
    if (!s) return;
    const e = seen.get(s.id);
    if (e) e.count += s.qty || 1;
    else seen.set(s.id, { index: i, count: s.qty || 1 });
  });
  let best = null;
  for (const [id, e] of seen) {
    const heal = healOf(game, id, max);
    if (heal <= 0) continue;
    const c = { index: e.index, id, count: e.count, heal, drink: !!POTIONS[id] };
    if (!best) { best = c; continue; }
    const covers = c.heal >= missing, bestCovers = best.heal >= missing;
    const better = covers !== bestCovers ? covers
      : covers ? (c.heal < best.heal || (c.heal === best.heal && best.drink && !c.drink))
        : (c.heal > best.heal || (c.heal === best.heal && best.drink && !c.drink));
    if (better) best = c;
  }
  return best;
}

test('the quick-use choice from a bag of hundreds of pieces of gear is the same as before', () => {
  seedRandom(7);
  const g = newGame();
  const gear = Object.keys(ITEMS).filter((id) => ITEMS[id].equip && !ITEMS[id].tool);
  const food = Object.keys(ITEMS).filter((id) => ITEMS[id].heal);
  const pots = Object.keys(POTIONS);   // healing and buff potions alike
  const other = ['coins', 'bones', 'logs', 'copper_ore'].filter((id) => ITEMS[id]);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  for (let round = 0; round < 60; round++) {
    // A long-played bag: gear in its own slots, food and potions scattered
    // through it (some kinds in several slots), materials, and gaps.
    const slots = [];
    for (let i = 0; i < 700; i++) {
      const r = Math.random();
      if (r < 0.75) slots.push({ id: pick(gear), qty: 1 });
      else if (r < 0.82) slots.push({ id: pick(food), qty: 1 + Math.floor(Math.random() * 5) });
      else if (r < 0.86) slots.push({ id: pick(pots), qty: 1 + Math.floor(Math.random() * 3) });
      else if (r < 0.93) slots.push({ id: pick(other), qty: 1 + Math.floor(Math.random() * 50) });
      else slots.push(null);
    }
    if (round % 10 === 0) for (let i = 0; i < slots.length; i++) if (slots[i] && (ITEMS[slots[i].id].heal || POTIONS[slots[i].id]?.fx.heal)) slots[i] = null;   // nothing that heals
    g.inventory.slots = slots;
    const max = g.maxHp();
    for (const hp of [1, Math.floor(max / 3), max - 7, max]) {
      g.player.hp = hp;
      assert.deepEqual(quickUseChoice(g), choiceBefore(g), `round ${round}, life ${hp}/${max}`);
    }
  }
});

test('key-moment saves are spaced a few ticks apart in a busy fight, and the last one is never lost', () => {
  const saves = [];
  let g = null;
  g = newGame((k) => { if (k === SAVE_KEY) saves.push(g.tickCount); });
  g.chooseClass('rogue');   // a permanent choice: saved on the next tick
  step(g, 1);
  assert.deepEqual(saves, [g.tickCount], 'the first key moment saves straight away');
  // A big fight: the Collection log and loot banners ask for a save every tick.
  for (let i = 0; i < 20; i++) { g.saveSoon = true; step(g, 1); }
  for (let i = 1; i < saves.length; i++) assert.ok(saves[i] - saves[i - 1] >= 5, `saves ${saves[i - 1]} and ${saves[i]} are spaced`);
  assert.ok(saves.length >= 4, `still saved every few ticks (${saves.length} saves in 21 ticks)`);
  // Whatever was asked for last still reaches the save within the gap.
  g.player.name = 'Ah Seng';
  g.saveSoon = true;
  step(g, 5);
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).player.name, 'Ah Seng');
  // After a quiet spell, a key moment saves on the very next tick again.
  while (g.tickCount - saves[saves.length - 1] < 5) step(g, 1);
  g.saveSoon = true;
  step(g, 1);
  assert.equal(saves[saves.length - 1], g.tickCount);
});

/** A stand-in AudioContext that records what the sound effects build. */
function fakeAudio(sampleRate = 1000) {
  const made = { buffers: [], sources: [] };
  const param = () => {
    const ev = [];
    return { ev, value: 1, setValueAtTime: (v, t) => ev.push(['set', v, t]), linearRampToValueAtTime: (v, t) => ev.push(['lin', v, t]), exponentialRampToValueAtTime: (v, t) => ev.push(['exp', v, t]) };
  };
  const node = (extra) => { const n = { connect: (to) => { n.to = to; }, ...extra }; return n; };
  const ctx = {
    currentTime: 2, sampleRate,
    createBuffer: (ch, n, sr) => { const d = new Float32Array(n); const b = { length: n, sampleRate: sr, getChannelData: () => d }; made.buffers.push(b); return b; },
    createBufferSource: () => { const s = node({ start: (...a) => { s.started = a; } }); made.sources.push(s); return s; },
    createGain: () => node({ gain: param() }),
    createOscillator: () => node({ type: '', frequency: param(), start() {}, stop() {} }),
  };
  return { ctx, made };
}

test('noise bursts share one pre-made buffer and still fade from their volume to silence', () => {
  const sfx = new Sfx(new EventBus());
  const { ctx, made } = fakeAudio(1000);
  sfx.ctx = ctx; sfx.master = { connect() {} }; sfx.muted = false;
  sfx.play('hit');    // a 0.045s burst at 0.2
  sfx.play('die');    // 0.08s at 0.24
  sfx.play('roar');   // 0.5s at 0.3
  assert.equal(made.buffers.length, 1, 'one buffer of noise for every burst');
  const buf = made.buffers[0], d = buf.getChannelData(0);
  assert.equal(buf.length, 1000, 'one second of it');
  assert.ok(d.every((x) => x >= -1 && x <= 1) && d.some((x) => x > 0.5) && d.some((x) => x < -0.5), 'white noise');
  const bursts = made.sources.filter((s) => s.buffer === buf);
  assert.equal(bursts.length, 3);
  for (const [s, [dur, vol]] of bursts.map((s, i) => [s, [[0.045, 0.2], [0.08, 0.24], [0.5, 0.3]][i]])) {
    const [when, offset, len] = s.started;
    assert.equal(when, 2);
    assert.ok(Math.abs(len - dur) < 1e-9, `plays ${dur}s of it`);
    assert.ok(offset >= 0 && offset + len <= 1 + 1e-9, 'from somewhere inside the buffer');
    // The old buffers had (1 - i/n) baked in: the same straight fade, on the gain.
    assert.deepEqual(s.to.gain.ev, [['set', vol, 2], ['lin', 0, 2 + dur]]);
  }
  // A burst longer than the buffer gets a buffer long enough for it.
  sfx._noise(1.5, 0.2);
  assert.equal(made.buffers.length, 2);
  assert.ok(made.buffers[1].length >= 1500);
});

// A 2D context that draws nothing.
function quietCtx() {
  const noop = () => {}, grad = { addColorStop: noop };
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '',
    measureText: () => ({ width: 10 }), createRadialGradient: () => grad, createLinearGradient: () => grad,
  };
  for (const k of ['save', 'restore', 'translate', 'scale', 'rotate', 'clip', 'setTransform', 'setLineDash', 'transform', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'fillRect', 'strokeRect',
    'clearRect', 'strokeText', 'drawImage', 'fillText']) ctx[k] = noop;
  return ctx;
}

test('a frame only works out where the nearby monsters that could be on screen are drawn', () => {
  const g = newGame();
  g.chooseStartingStyle('melee');
  g.worldLabels = 'off';
  g.camera.resize(800, 600);
  g.camera.follow(g.player.x * 32 + 16, g.player.y * 32 + 16);
  const ox = g.camera.originX, oy = g.camera.originY;
  // Monsters across the view and well beyond it, some of them mid-step across an edge.
  const asked = new Set();
  g.npcs = [];
  for (let dy = -16; dy <= 16; dy += 2) for (let dx = -22; dx <= 22; dx += 2) {
    const n = new NPC('goblin', g.player.x + dx, g.player.y + dy, 0, {});
    if ((dx + dy) % 4 === 0) { n.tx = n.x + (dx < 0 ? 1 : -1); n.ty = n.y + (dy < 0 ? 1 : -1); n.moving = true; n.progress = 0.85; }   // stepping inwards
    const rc = n.renderCenter.bind(n);
    n.renderCenter = () => { asked.add(n); return rc(); };
    g.npcs.push(n);
  }
  // Every monster an on-screen check could pass is still looked at; returns how many far-off ones weren't.
  const check = (draw, pad, padBelow) => {
    asked.clear();
    draw();
    let skipped = 0;
    for (const n of g.npcs) {
      const c = Character.prototype.renderCenter.call(n), cx = c.x - ox, cy = c.y - oy;
      const could = !(cx < -pad || cy < -pad || cx > 800 + pad || cy > 600 + padBelow);
      if (could) assert.ok(asked.has(n), `a monster that could show (at ${cx}, ${cy}) is still looked at`);
      else if (!asked.has(n)) skipped++;
    }
    return skipped;
  };
  // The monsters themselves (a scale-1 monster shows within 48 of the view).
  g.fxTrim = true;   // (reflections are checked on their own below)
  const r = new Renderer(g, {}, quietCtx());
  const skipped = check(() => r.render(1000), 48, 48);
  assert.ok(skipped > 150, `far-off monsters are passed over without working out where they are (${skipped} of ${g.npcs.length})`);
  // Their reflections in the water (anyone within 40 of the view, 80 below it).
  g.fxTrim = false;
  const skippedRefl = check(() => new TerrainFx().drawReflections(quietCtx(), g, [], ox, oy, 800, 600, 1000), 40, 80);
  assert.ok(skippedRefl > 150, `reflections pass over the far-off ones too (${skippedRefl})`);
});
