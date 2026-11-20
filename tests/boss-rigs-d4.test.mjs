// Boss rigs cut from the Part D sheets, batches D4 onwards (RB31+): every layer the
// rig names ships, and each joint sits on its part. The opaque box of each layer is
// measured into tests/fixtures/boss-rig-bounds.json (webp can't be decoded here
// without a dependency); a hash of each file keeps that table honest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BOUNDS = JSON.parse(readFileSync(new URL('./fixtures/boss-rig-bounds.json', import.meta.url), 'utf8'));
const file = (id, n) => fileURLToPath(new URL(`../assets/creatures/bosses/rig/${id}_${n}.webp`, import.meta.url));

test('the newer boss rigs are registered and ship every layer', async () => {
  const { CREATURE_RIGS } = await import('../src/render/creatureRigs.js');
  const { NPCS } = await import('../src/data/npcs.js');
  assert.ok(Object.keys(BOUNDS).length >= 10);
  for (const [id, b] of Object.entries(BOUNDS)) {
    const rig = CREATURE_RIGS[id];
    assert.ok(rig, `${id} (${b.sheet}) is rigged`);
    assert.ok(NPCS[id]?.boss, `${id} is a real boss`);
    assert.ok(rig.order.includes('base') && rig.order.includes('head'), `${id} has a body and a head`);
    assert.deepEqual([...rig.files].sort(), Object.keys(b.parts).sort(), `${id} layers match the measured table`);
    for (const n of rig.files) assert.ok(existsSync(file(id, n)), `${id}_${n}.webp`);
    // An alternate picture only comes with the part it replaces.
    if (rig.files.includes('limb_strike')) assert.ok(rig.order.includes('limb'), `${id} strikes with a limb`);
    if (rig.files.includes('head_roar')) assert.equal(rig.parts.head.alt, 'head_roar', `${id} roars`);
  }
});

test('the newer boss rigs have each joint on its own part', async () => {
  const { CREATURE_RIGS } = await import('../src/render/creatureRigs.js');
  for (const [id, b] of Object.entries(BOUNDS)) {
    const rig = CREATURE_RIGS[id];
    for (const [n, m] of Object.entries(b.parts)) {
      const hash = createHash('sha256').update(readFileSync(file(id, n))).digest('hex').slice(0, 16);
      assert.equal(hash, m.sha256, `${id}_${n}.webp changed: re-measure tests/fixtures/boss-rig-bounds.json`);
      const piv = rig.parts[n]?.piv || rig.parts[n === 'head_roar' ? 'head' : 'limb']?.piv;
      assert.ok(piv, `${id} ${n} has a joint`);
      const [x0, y0, x1, y1] = m.box;
      assert.ok(piv[0] >= x0 && piv[0] <= x1 && piv[1] >= y0 && piv[1] <= y1, `${id} ${n} joint ${piv} lies on the part ${m.box}`);
    }
    // The resting and alternate pictures turn about the same joint, so swapping them never jumps.
    if (rig.parts.limb && rig.files.includes('limb_strike')) assert.ok(b.parts.limb_strike, `${id} limb_strike measured`);
    // The motion stays gentle: no part swings past about 40 degrees in any pose.
    for (const n of rig.order) {
      const p = rig.parts[n];
      for (const o of [{}, { moving: true }, { attackK: 0.3 }, { attackK: 0.5 }, { castK: 0.5 }]) {
        const a = p.swing ? p.swing(4321, o) : 0;
        assert.ok(Number.isFinite(a) && Math.abs(a) < 0.7, `${id} ${n} swings sensibly`);
      }
    }
  }
});
