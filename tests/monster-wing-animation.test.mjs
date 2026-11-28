import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREATURE_RIGS } from '../src/render/creatureRigs.js';
import { drawRigParts } from '../src/render/sprites.js';

const fliers = {
  fruit_bat: 0.024,
  flying_fox: 0.022,
  hornbill: 0.014,
  vampire_bat: 0.026,
  forest_drake: 0.013,
};

test('flier wings rise and fall together about their painted shoulders', () => {
  for (const [id, speed] of Object.entries(fliers)) {
    const { wing_near: near, wing_far: far } = CREATURE_RIGS[id].parts;
    // The drake is in profile, with both wings extending to the left.
    const rotationSign = id === 'forest_drake' ? 1 : -1;
    for (const phase of [Math.PI / 2, Math.PI * 1.5]) {
      const time = phase / speed;
      assert.equal(Math.sign(near.swing(time, {}) * far.swing(time, {})), rotationSign, id);
    }
  }
});

test('rig drawing uses the folded far wing only near the bottom of its sweep', () => {
  for (const [id, speed] of Object.entries(fliers)) {
    const rig = CREATURE_RIGS[id];
    const drawn = [];
    const ctx = {
      save() {}, restore() {}, transform() {},
      drawImage(img) { drawn.push(img); },
    };
    const imgs = Object.fromEntries(rig.files.map((name) => [name, name]));
    for (const phase of [Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      drawn.length = 0;
      const time = (phase - 0.4) / speed;
      drawRigParts(ctx, rig, imgs, {}, time, 0, 0, 40, 40);
      const fold = phase === Math.PI * 1.5 && id !== 'vampire_bat';
      assert.equal(drawn.includes('wing_far_down'), fold, id);
      assert.equal(drawn.includes('wing_far'), !fold, id);
      assert.ok(drawn.includes('wing_near'), id);
    }
  }
});
