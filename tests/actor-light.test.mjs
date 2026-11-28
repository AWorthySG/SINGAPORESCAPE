import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actorLight, beginHeroLight, finishHeroLight, litActor } from '../src/render/actorlight.js';
import { bakeBudget } from '../src/render/governor.js';

test('character light follows the hour and softens under clouds', () => {
  assert.deepEqual([0.05, 0.32, 0.5, 0.69, 0.94].map(phase => actorLight(phase, 1)),
    ['night', 'dawn', 'day', 'dusk', 'night']);
  assert.equal(actorLight(0.5, 0.5), 'cloud');
  assert.equal(actorLight(0.05, 0.5), 'night');
});

test('character lighting preserves the sprite footprint and reuses bakes', () => {
  const art = { width: 48, height: 64 };
  assert.equal(litActor(art, 'dusk', 1), art, 'headless keeps the source picture');
  const created = [];
  const previous = globalThis.document;
  const clock = bakeBudget.clock;
  globalThis.document = {
    createElement() {
      const g = {
        calls: [],
        drawImage(...args) { this.calls.push(['picture', args]); },
        setTransform() {},
        clearRect(...args) { this.calls.push(['clear', args]); },
        createLinearGradient(...args) {
          this.calls.push(['gradient', args]);
          return { addColorStop() {} };
        },
        fillRect(...args) { this.calls.push([this.globalCompositeOperation, args]); },
      };
      const cv = { getContext: () => g };
      created.push(cv);
      return cv;
    },
  };
  try {
    bakeBudget.clock = () => 0;
    bakeBudget.frame();
    bakeBudget.spend(bakeBudget.ms);
    assert.equal(litActor(art, 'dusk', 1), art, 'lighting waits if the frame is busy');
    bakeBudget.frame();
    const right = litActor(art, 'dusk', 1);
    const left = litActor(art, 'dusk', -1);
    assert.deepEqual([right.width, right.height], [48, 64]);
    assert.equal(litActor(art, 'dusk', 1), right);
    assert.equal(litActor(art, 'dusk', -1), left);
    assert.equal(created.length, 2);
    const [, ray, mask] = right.getContext().calls;
    assert.deepEqual(mask, ['source-atop', [0, 0, 48, 64]]);
    assert.ok(left.getContext().calls[1][1][0] > ray[1][0], 'the mirrored picture has the key light on the opposite side');

    const blits = [];
    const screen = { drawImage: (...args) => blits.push(args) };
    assert.equal(beginHeroLight(null, screen), null);
    const layer = beginHeroLight('dawn', screen);
    layer.drawImage(art, 8, -22);
    finishHeroLight(screen, 'dawn', 1);
    const [clear, , , heroMask] = layer.calls;
    assert.deepEqual(heroMask, ['source-atop', clear[1]], 'the light reaches equipment outside the body');
    assert.equal(blits.length, 1);
    assert.deepEqual(blits[0].slice(1), clear[1]);
    assert.equal(layer.globalCompositeOperation, 'source-over');
    assert.equal(beginHeroLight('day', screen), layer, 'the player layer is reused every frame');
  } finally {
    bakeBudget.clock = clock;
    bakeBudget.frame();
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
