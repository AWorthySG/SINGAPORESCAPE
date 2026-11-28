import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREATURE_RIGS } from '../src/render/creatureRigs.js';
import { STRIKE_AT, travelPhase, turnFacing } from '../src/render/motionkit.js';
import { creatureFloats, creaturePuppetKind } from '../src/render/sprites.js';

test('tails and fins keep the same phase as a creature starts or stops moving', () => {
  const rigs = ['wild_boar', 'king_cobra', 'reef_shark', 'pink_dolphin'];
  for (const id of rigs) {
    const rig = CREATURE_RIGS[id];
    const before = { walk: 35.41, move: 0.299 };
    const after = { ...before, move: 0.301, moving: true };
    const time = 456789;
    for (const name of ['tail', 'arm_near', 'arm_far']) {
      const part = rig.parts[name];
      if (!part) continue;
      assert.equal(part.swing(time, before), part.swing(time, after), `${id} ${name} at the same point on its path`);
    }
    if (rig.body) assert.ok(Math.abs(rig.body(time, before).lean - rig.body(time, after).lean) < 0.001);
  }
  const idle = travelPhase(10000, 3, 0.005, 0.012);
  assert.ok(travelPhase(10000, 4, 0.005, 0.012) > idle, 'distance adds to the idle phase');
});

test('a claw closes on contact and stays closed through recovery', () => {
  const { claw } = CREATURE_RIGS.giant_crab.parts;
  assert.equal(claw.alt, 'claw_open');
  assert.equal(claw.swap({ attackK: 0.18 }), true);
  for (const attackK of [STRIKE_AT, 0.72, 0.96, -1]) assert.equal(claw.swap({ attackK }), false);
});

test('the legs settle with the walk weight when a path ends', () => {
  const { front_near } = CREATURE_RIGS.wild_boar.parts;
  const pose = { walk: 1.21, move: 0.4 };
  assert.equal(front_near.swing(1789, { ...pose, moving: true }), front_near.swing(1789, { ...pose, moving: false }));
});

test('a turning body and its ground shadow still face the old way until edge-on', () => {
  for (const face of [-1, 1]) {
    assert.equal(turnFacing(face, 1), -face);
    assert.ok(Math.abs(turnFacing(face, 0.5)) < 0.15);
    assert.equal(Math.sign(turnFacing(face, 0.75)), -face);
    assert.equal(Math.sign(turnFacing(face, 0.25)), face);
    assert.equal(turnFacing(face, 0), face);
  }
});

test('ground insects step, and gliding and shelled bodies keep a single silhouette', () => {
  for (const [family, plan] of Object.entries({ weaver_ant: 'scuttle', kopitiam_cockroach: 'legs', paddy_locust: 'legs' })) {
    assert.equal(creatureFloats('insect', family), false);
    assert.equal(creaturePuppetKind('insect', family), plan);
  }
  assert.equal(creatureFloats('insect', 'wild_hornet'), true);
  assert.equal(creaturePuppetKind('insect', 'wild_hornet'), 'wings');
  assert.equal(creatureFloats('bat', 'colugo'), true);
  assert.equal(creaturePuppetKind('bat', 'colugo'), null);
  assert.equal(creaturePuppetKind('crab', 'giant_clam'), null);
});
