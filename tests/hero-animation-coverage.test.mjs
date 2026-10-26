import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../src/data/classes.js';
import { HERO_RIG_CLASSES, heroRigPose } from '../src/render/heroRig.js';
import { RANGED_HERO_CLASSES, rangedHeroPose } from '../src/render/rangedHeroRig.js';

test('every playable class has exactly one articulated animation rig', () => {
  const ids = [...HERO_RIG_CLASSES, ...RANGED_HERO_CLASSES];
  assert.equal(new Set(ids).size, ids.length, 'no competing class renderers');
  assert.deepEqual(ids.toSorted(), CLASSES.map((c) => c.id).toSorted());
});

test('all class attack poses move, stay finite, and meet idle at both ends', () => {
  const signatures = new Set();
  for (const { id } of CLASSES) {
    const pose = HERO_RIG_CLASSES.includes(id)
      ? (k) => heroRigPose(id, {}, 500, k, true)
      : (k) => rangedHeroPose(id, {}, 500, k);
    const idle = pose(-1);
    const sampled = Array.from({ length: 101 }, (_, i) => pose(i / 100));
    assert.ok(sampled.every((p) => Object.values(p).every(Number.isFinite)), id);
    assert.ok(sampled.some((p) => Object.keys(p).some((key) => Math.abs(p[key] - idle[key]) > 0.1)), `${id} attack moves`);
    for (const key of Object.keys(idle)) {
      assert.ok(Math.abs(pose(0)[key] - idle[key]) < 1e-12, `${id}/${key} starts at rest`);
      assert.ok(Math.abs(pose(1)[key] - idle[key]) < 1e-12, `${id}/${key} returns to rest`);
    }
    signatures.add(JSON.stringify(sampled));
  }
  assert.ok(signatures.size >= 12, 'weapon types have distinct choreography');
});

test('component files stay in lock-step with the playable class registries', async () => {
  const { readdir } = await import('node:fs/promises');
  const { HERO_RIG_PARTS } = await import('../src/render/heroRig.js');
  const { RANGED_HERO_PARTS } = await import('../src/render/rangedHeroRig.js');
  const actual = (await readdir(new URL('../assets/creatures/hero/rig/', import.meta.url))).filter((name) => name.endsWith('.webp'));
  const expected = [
    ...HERO_RIG_CLASSES.flatMap((id) => HERO_RIG_PARTS.map((part) => `${id}-${part}.webp`)),
    ...RANGED_HERO_CLASSES.flatMap((id) => RANGED_HERO_PARTS.map((part) => `${id}-${part}.webp`)),
  ];
  assert.deepEqual(actual.toSorted(), expected.toSorted());
});
