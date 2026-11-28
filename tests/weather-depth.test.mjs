import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER_SLOT_MS, Weather, slotWeather, weatherAt } from '../src/render/weather.js';
import { TERRAIN } from '../src/data/world.js';

test('the forecast joins dry, rainy and stormy slots without a visible step', () => {
  const seen = new Set();
  for (let i = 1; i < 1000; i++) {
    const old = slotWeather(i - 1), next = slotWeather(i);
    seen.add([old, next].join(':'));
    const seam = i * WEATHER_SLOT_MS;
    const a = weatherAt(seam - 16), b = weatherAt(seam + 16);
    assert.ok(Math.abs(a.rain - b.rain) < 0.00001, `rain at seam ${i}`);
    assert.ok(Math.abs(a.storm - b.storm) < 0.00001, `storm at seam ${i}`);
    assert.ok(Math.abs(a.flash - b.flash) < 0.01, `lightning at seam ${i}`);
  }
  assert.ok(seen.has('1:2') && seen.has('2:1') && seen.has('0:2'));
});

const pathWorld = { world: { width: 100, height: 100, terrainAt: () => TERRAIN.PATH } };

function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (o, k) => k in o ? o[k] : (...args) => calls.push([k, ...args]),
  });
  return { ctx, calls };
}

test('rain splash marks stay on the ground as the camera pans', () => {
  const w = new Weather(), { ctx, calls } = recorder();
  const splash = { x: 94, y: 125, life: 40 };
  w._splashes.push(splash);
  w.drawGround(ctx, pathWorld, 12, 17, 400, 400, 600, 16, false);
  assert.deepEqual(calls.find(c => c[0] === 'ellipse').slice(1, 3), [82, 108]);
  calls.length = 0;
  w.drawGround(ctx, pathWorld, 45, 77, 400, 400, 616, 16, false);
  assert.deepEqual(calls.find(c => c[0] === 'ellipse').slice(1, 3), [49, 48]);
  assert.deepEqual([splash.x, splash.y], [94, 125]);
});

test('Reduce Motion holds the rain and fog in place, and roofed rooms clear both', () => {
  const w = new Weather(), { ctx, calls } = recorder();
  const g = { currentZoneName: 'Kampong Glam', playMs: 2652060, reduceMotion: true };
  w.update(g, 16);
  assert.ok(w.state.rain > 0 && w.state.calm);
  w._mistImg = { width: 192, height: 72 };
  w.drawAir(ctx, 0, 0, 1000, 650, 2000, 16, false);
  const before = calls.filter(c => c[0] === 'moveTo' || c[0] === 'drawImage');
  assert.ok(before.some(c => c[0] === 'moveTo') && before.some(c => c[0] === 'drawImage'));
  calls.length = 0;
  w.drawAir(ctx, 0, 0, 1000, 650, 5000, 16, false);
  assert.deepEqual(calls.filter(c => c[0] === 'moveTo' || c[0] === 'drawImage'), before);
  w.wet = 1;
  g.currentZoneName = 'The Endless Gate';
  w.update(g, 16);
  calls.length = 0;
  w.drawGround(ctx, pathWorld, 0, 0, 400, 400, 5016, 16, false);
  w.drawAir(ctx, 0, 0, 1000, 650, 5016, 16, false);
  assert.equal(w.wet, 0);
  assert.deepEqual(calls, []);
});
