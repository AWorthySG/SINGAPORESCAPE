import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/config.js';
import { OBJECTS } from '../src/data/objects.js';
import { drawMiningGround, drawMiningRock, rockImpactPoint, rockLayout } from '../src/render/miningRock.js';

function node(objId, x = 12, y = 9) {
  return { objId, def: OBJECTS[objId], x, y, depleted: false };
}

test('rock sizes vary by material within a tile and both states keep the same footing', () => {
  for (const [id, def] of Object.entries(OBJECTS)) {
    if (def.type !== 'rock') continue;
    const o = node(id);
    const live = rockLayout(o);
    const spent = rockLayout({ ...o, depleted: true, shakeT: 260 });
    assert.ok(Math.abs(live.dx) <= 1.1 && live.foot > 0 && live.foot < TILE / 2, id);
    assert.ok(live.height < 39, id);
    assert.equal(spent.dx, live.dx);
    assert.equal(spent.foot, live.foot);
    assert.ok(spent.width < live.width && spent.height < live.height / 2, id);
    assert.deepEqual(rockLayout({ ...o, shakeT: 280 }), live, 'the ground and UI never follow shake');
  }
  assert.ok(rockLayout(node('clay_rock')).height < rockLayout(node('skyglass_crystal')).height);
  assert.notEqual(rockLayout(node('iron_rock')).dx, rockLayout(node('iron_rock', 13, 9)).dx);
});

test('the impact point lies on the worked side of the same body on its final strike', () => {
  const o = node('copper_rock');
  const centre = rockImpactPoint(o);
  const side = rockImpactPoint(o, { x: centre.x - 32, y: centre.y + 10 });
  assert.ok(side.x < centre.x && side.y > centre.y);
  assert.ok(centre.x - side.x < rockLayout(o).width / 2);
  assert.deepEqual(rockImpactPoint({ ...o, depleted: true }), centre);
});

test('the rock alpha is cropped once and the ground contact and art land on the same row', () => {
  const image = { naturalWidth: 12, naturalHeight: 11 };
  const mask = new Uint8ClampedArray(image.naturalWidth * image.naturalHeight * 4);
  for (let y = 3; y < 7; y++) for (let x = 2; x < 11; x++) mask[(y * image.naturalWidth + x) * 4 + 3] = 255;
  let reads = 0;
  const originalDocument = globalThis.document;
  globalThis.document = { createElement() { return { getContext: () => ({
    drawImage() {}, getImageData() { reads++; return { data: mask }; },
  }) }; } };
  try {
    const o = node('iron_rock');
    const unfitted = rockLayout(o);
    const rock = rockLayout(o, image);
    const shifts = [], draws = [], ovals = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, fill() {}, beginPath() {},
      translate(x, y) { shifts.push([x, y]); }, drawImage(...args) { draws.push(args); },
      ellipse(...args) { ovals.push(args); } };
    drawMiningGround(ctx, 200, 120, rock);
    drawMiningRock(ctx, o, image, 200, 120);
    drawMiningRock(ctx, { ...o, shakeT: 280 }, image, 200, 120, true);
    assert.equal(reads, 1);
    assert.deepEqual(draws[0].slice(1, 5), [2, 3, 9, 4]);
    assert.equal(draws[0][6] + draws[0][8], 0, 'painted foot stands on anchor');
    assert.equal(rockLayout(o).height, draws[0][8], 'overlay and impact geometry use the fitted paint');
    assert.ok(rock.strikeY > unfitted.strikeY && rock.labelY > unfitted.labelY);
    assert.deepEqual(shifts[0], [200 + rock.dx, 120 + rock.foot]);
    assert.deepEqual(shifts[1], shifts[0], 'reduced motion keeps a struck rock on its footing');
    assert.deepEqual(ovals[0].slice(0, 2), [shifts[0][0], shifts[0][1] - 0.6]);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
