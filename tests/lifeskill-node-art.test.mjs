import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIG_SITES } from '../src/data/archaeology.js';
import { TEACHING_DIG_ART } from '../src/data/digsites.js';
import { DIVE_SPOTS } from '../src/data/diving.js';
import { OBJECTS } from '../src/data/objects.js';
import { DIG_SITE_BOX, drawDigGround, drawDigSite } from '../src/render/digart.js';
import { DIVE_BED_BOX, drawDiveBed, drawDiveMarker } from '../src/render/diveart.js';
import { drawObjectSprite, worldArtBox } from '../src/render/sprites.js';

function canvas() {
  const operations = [], stack = [];
  const ctx = {
    globalAlpha: 1,
    save() { stack.push([this.globalAlpha, this.fillStyle, this.strokeStyle]); },
    restore() { [this.globalAlpha, this.fillStyle, this.strokeStyle] = stack.pop(); },
    drawImage(img, ...args) { operations.push(['image', img, this.globalAlpha, ...args]); },
    ellipse(...args) { operations.push(['ellipse', ...args]); },
    fillRect(...args) { operations.push(['fillRect', this.fillStyle, ...args]); },
    beginPath() {}, closePath() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, strokeRect() {}, rect() {},
  };
  return { ctx, operations };
}
const obj = (id) => ({ objId: id, def: OBJECTS[id], x: 12, y: 20 });

const buoy = (operations) => operations.find((entry) => entry[0] === 'ellipse' && entry[3] === 4.7);

test('painted reefs stay on the seabed underneath the separate red and cream buoy', () => {
  const reef = obj('coral_garden');
  const { ctx, operations } = canvas();
  const art = { naturalWidth: 120, naturalHeight: 60 };
  drawDiveBed(ctx, reef, 100, 80, art);
  const [layer, image, alpha, x, y, w, h] = operations[0];
  assert.deepEqual([layer, image], ['image', art]);
  assert.ok(alpha < 1 && alpha > 0.75);
  assert.equal(x + w / 2, 100);
  assert.equal(y + h, 80 + DIVE_BED_BOX[2]);
  assert.equal(ctx.globalAlpha, 1, 'the float does not inherit the underwater alpha');
  assert.equal(operations.length, 1, 'no ground shadow or animated geometry on the paint');

  const moving = (time, reduced) => {
    operations.length = 0;
    drawDiveMarker(ctx, reef, 100, 80, time, reduced);
    return operations.slice();
  };
  const first = moving(0, false), second = moving(500, false);
  assert.equal(buoy(first)[1], 112, 'right of the reef');
  assert.notEqual(buoy(first)[2], buoy(second)[2], 'only the float bobs');
  const flag = first.find((op) => op[0] === 'fillRect' && op[1] === '#c8594c');
  assert.ok(flag, 'red flag');
  assert.equal(flag[2], buoy(first)[1], 'the flag flies outward from the buoy over open water');
  assert.ok(first.some((op) => op[0] === 'fillRect' && op[1] === '#fff2d6'), 'cream float band');
  assert.deepEqual(moving(0, true), moving(500, true), 'flag and ripple are static on reduced motion and low graphics');
});

test('a painted trench stays on its shallow work footprint and shares the front anchor', () => {
  const { ctx, operations } = canvas();
  const art = { naturalWidth: 180, naturalHeight: 120 };
  drawDigGround(ctx, 100, 80, true);
  drawDigSite(ctx, obj('kampong_ruins'), 100, 80, art);
  const [, , , x, y, width, height] = operations.at(-1);
  assert.deepEqual([width, height], [36, 24]);
  assert.equal(x + width / 2, 100);
  assert.equal(y + height, 80 + DIG_SITE_BOX[2]);
  assert.ok(Math.abs(operations[0][2] - (y + height)) < 2, 'the contact shadow sits under the front of the earth');
  assert.ok(Math.abs(operations[1][2] - (y + height)) < 1, 'the selection curve shares the front anchor');
});

test('repainted skill art has an exact versioned URL, including the separate teaching trench and bench', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { complete = true; naturalWidth = 120; naturalHeight = 60; };
  try {
    for (const { id } of [...DIVE_SPOTS, ...DIG_SITES, { id: 'restoration_bench' }]) {
      assert.equal(worldArtBox(obj(id)).img.src, `assets/world/obj-${id}.webp?v=2`);
    }
    const teaching = { ...obj('kampong_ruins'), art: TEACHING_DIG_ART };
    const { ctx, operations } = canvas();
    drawObjectSprite(ctx, teaching, 100, 80);
    assert.equal(operations[0][1].src, `assets/world/${TEACHING_DIG_ART}.webp?v=2`);
    assert.equal(worldArtBox(teaching).foot, DIG_SITE_BOX[2]);
  } finally {
    if (previous === undefined) delete globalThis.Image;
    else globalThis.Image = previous;
  }
});
