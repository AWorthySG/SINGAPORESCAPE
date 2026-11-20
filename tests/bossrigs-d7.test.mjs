// Boss rigs D7 (RB61-RB66): the six bosses cut from the last parts sheets. The
// lock-step tests in render.test.mjs check every layer ships; these check the
// layers share one canvas and every joint sits on the part that turns about it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Each layer's canvas size, and the part's painted bounds on it (x0, y0, x1, y1 as
// fractions), measured when the layers were baked. Re-measure if the art is re-cut.
const D7 = {
  singa_of_temasek: { size: [388, 344], box: { tail: [0.015, 0.538, 0.178, 0.927], limb2: [0.121, 0.727, 0.374, 0.988], base: [0.116, 0.590, 0.701, 0.988], limb: [0.477, 0.302, 0.786, 0.919], head: [0.093, 0.017, 0.735, 0.802], head_roar: [0.090, 0.017, 0.735, 0.799], limb_strike: [0.436, 0.436, 0.985, 0.936] } },
  spirit_of_badang: { size: [265, 344], box: { limb2: [0.558, 0.343, 0.970, 0.651], base: [0.019, 0.462, 0.913, 0.988], tail: [0.158, 0.654, 0.694, 0.962], limb: [0.026, 0.015, 0.977, 0.689], head: [0.332, 0.305, 0.740, 0.564], head_roar: [0.336, 0.308, 0.732, 0.587] } },
  jade_moon_hare: { size: [336, 344], box: { base: [0.018, 0.453, 0.762, 0.974], limb2: [0.125, 0.727, 0.405, 0.907], limb: [0.506, 0.462, 0.979, 0.988], head: [0.083, 0.017, 0.815, 0.672], head_roar: [0.083, 0.017, 0.815, 0.672], limb_strike: [0.464, 0.544, 0.982, 0.988] } },
  celestial_garuda: { size: [400, 317], box: { tail: [0.105, 0.621, 0.453, 0.959], limb2: [0.583, 0.107, 0.985, 0.773], limb: [0.018, 0.091, 0.527, 0.946], base: [0.360, 0.543, 0.805, 0.987], head: [0.225, 0.019, 0.795, 0.741], head_roar: [0.225, 0.019, 0.797, 0.738] } },
  fenghuang: { size: [367, 344], box: { tail: [0.016, 0.555, 0.458, 0.980], limb2: [0.548, 0.259, 0.984, 0.733], base: [0.381, 0.424, 0.850, 0.988], limb: [0.101, 0.102, 0.608, 0.674], head: [0.316, 0.017, 0.823, 0.576], head_roar: [0.316, 0.017, 0.828, 0.576], limb_strike: [0.063, 0.250, 0.559, 0.608] } },
  jade_dragon: { size: [400, 328], box: { limb2: [0.140, 0.732, 0.372, 0.988], base: [0.015, 0.107, 0.830, 0.957], limb: [0.743, 0.756, 0.900, 0.948], head: [0.135, 0.018, 0.985, 0.689], head_roar: [0.138, 0.021, 0.980, 0.774], limb_strike: [0.752, 0.777, 0.940, 0.936] } },
};

// A .webp with transparency starts with a VP8X chunk holding the canvas size.
function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 12, 16), 'VP8X', `${file} carries its alpha in a VP8X file`);
  return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
}

test('the D7 bosses are rigged, with every layer on one shared canvas', async () => {
  const { rigIds, rigParts, rigKind } = await import('../src/render/sprites.js');
  const { NPCS } = await import('../src/data/npcs.js');
  for (const [id, d] of Object.entries(D7)) {
    assert.ok(rigIds().includes(id), `${id} is rigged`);
    assert.equal(rigKind(id), 'boss');
    assert.ok(NPCS[id]?.boss, `${id} is a real boss`);
    assert.deepEqual([...rigParts(id)].sort(), Object.keys(d.box).sort(), `${id} ships the parts it was cut into`);
    for (const n of rigParts(id)) {
      const f = new URL(`../assets/creatures/bosses/rig/${id}_${n}.webp`, import.meta.url);
      assert.ok(existsSync(f), `${id}_${n}.webp`);
      assert.deepEqual(webpSize(f), d.size, `${id}_${n} shares the rig's canvas`);
    }
  }
});

test('every D7 joint falls inside the part that turns about it', async () => {
  const { rigParts, rigPivot } = await import('../src/render/sprites.js');
  const M = 0.02;   // an edge pixel's worth of slack
  for (const [id, d] of Object.entries(D7)) {
    for (const n of rigParts(id)) {
      const p = rigPivot(id, n), b = d.box[n];
      assert.ok(p, `${id} ${n} has a joint`);
      assert.ok(p[0] >= b[0] - M && p[0] <= b[2] + M && p[1] >= b[1] - M && p[1] <= b[3] + M,
        `${id} ${n} joint ${p} inside its part ${b}`);
    }
  }
});

test('a heavy boss part moves by its own smaller amount', async () => {
  const { bossRig } = await import('../src/render/creatureRigs.js');
  const d = { fit: 1, order: ['limb'], piv: { limb: [0.5, 0.5] } };
  const full = bossRig('x', d), half = bossRig('x', { ...d, amp: { limb: 0.5 } });
  for (const o of [{ attackK: 0.2 }, { attackK: 0.5 }, { castK: 0.5 }, {}]) {
    const a = full.parts.limb.swing(1234, o), b = half.parts.limb.swing(1234, o);
    assert.ok(Math.abs(b - a * 0.5) < 1e-9, `half the swing for ${JSON.stringify(o)}`);
  }
});
