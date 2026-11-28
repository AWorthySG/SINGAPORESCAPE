import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Weather, weatherAt } from '../src/render/weather.js';
import { petDrawable } from '../src/render/petsprite.js';

test('weather flashes and follower bobs respect the game and browser motion settings', (t) => {
  const savedMedia = globalThis.matchMedia;
  const savedImage = globalThis.Image;
  const preference = { matches: false };
  globalThis.matchMedia = (query) => query === '(prefers-reduced-motion: reduce)' ? preference : { matches: false };
  globalThis.Image = class {
    complete = true;
    naturalWidth = 256;
  };
  t.after(() => {
    globalThis.matchMedia = savedMedia;
    globalThis.Image = savedImage;
  });

  const weather = new Weather();
  const game = {
    currentZoneName: 'Kampong Glam',
    playMs: 2652060,   // a deterministic lightning pulse
    dayPhase: () => 0.5,
    pets: { follower: { id: 'pet_mining', x: 2, y: 2 } },
  };
  let height;
  const noop = () => {};
  const ctx = {
    save: noop, restore: noop, beginPath: noop, ellipse: noop, fill: noop, drawImage: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
    translate: (_, y) => { height = y; },
  };
  const petHeight = (now) => {
    petDrawable(game, ctx, 0, 0, 320, 240, now).draw();
    return height;
  };

  assert.ok(weatherAt(game.playMs).flash > 0);
  assert.ok(weather.update(game, 16).flashWash[3] > 0, 'the normal mode still shows lightning');
  assert.notEqual(petHeight(0), petHeight(200), 'a normal parked pet still bobs');

  for (const [gamePref, osPref] of [[true, false], [false, true]]) {
    game.reduceMotion = gamePref;
    preference.matches = osPref;
    const sky = weather.update(game, 16);
    assert.equal(sky.flash, 0);
    assert.equal(sky.flashWash[3], 0);
    assert.ok(sky.rain > 0, 'the rain still reads as a storm');
    assert.equal(petHeight(400), petHeight(600), 'the stationary pet holds its height');
  }
});
