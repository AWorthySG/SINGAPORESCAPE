// Boss rigs cut from the Part D parts sheets: every layer ships, and every joint
// sits on the part it turns (and on the body or head it hangs from), so no limb swings
// about a point in thin air. Node can't decode WebP without a dependency, so each
// layer's opaque box is measured once into tests/fixtures/boss-rig-bounds.json;
// the recorded byte size keeps that table in step with the files on disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BOUNDS = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/boss-rig-bounds.json', import.meta.url)), 'utf8'));
// The Part D batches (sheets RB01 onwards), one list per batch.
const BATCHES = {
  D1: ['goblin_warchief', 'toman_tyrant', 'ubin_quarry_python', 'ubin_stone_frog', 'kopitiam_roach_queen',
    'bakau_mud_lobster', 'strangler_fig_mother', 'kranji_bullfrog_emperor', 'sand_scorpion_king', 'sea_eagle_sovereign'],
  D2: ['slag_titan', 'chilli_crab', 'lion_of_light', 'hantu_tinggi', 'kelong_king_crab',
    'spider_queen', 'kranji_buffalo_king', 'bandit_kingpin', 'hungry_ghost_king', 'arowana_emperor'],
};
const inside = ([x, y], [x0, y0, x1, y1], m = 0.01) => x >= x0 - m && x <= x1 + m && y >= y0 - m && y <= y1 + m;

test('the Part D bosses are rigged, batch by batch', async () => {
  const { rigIds, rigKind } = await import('../src/render/sprites.js');
  for (const [batch, ids] of Object.entries(BATCHES)) {
    for (const id of ids) {
      assert.ok(rigIds().includes(id), `${batch}: ${id} has a rig`);
      assert.equal(rigKind(id), 'boss');
      assert.ok(BOUNDS[id], `${batch}: ${id} has measured layer bounds`);
    }
  }
});

test('Part D boss rig layers match their measured bounds', async () => {
  const { CREATURE_RIGS } = await import('../src/render/creatureRigs.js');
  for (const [id, parts] of Object.entries(BOUNDS)) {
    const rig = CREATURE_RIGS[id];
    assert.ok(rig, `${id} is in the rig table`);
    assert.deepEqual([...rig.files].sort(), Object.keys(parts).sort(), `${id} ships exactly the layers it declares`);
    for (const [part, b] of Object.entries(parts)) {
      const file = fileURLToPath(new URL(`../assets/creatures/bosses/rig/${id}_${part}.webp`, import.meta.url));
      assert.equal(statSync(file).size, b.bytes, `${id}_${part}.webp changed: re-measure its bounds`);
    }
  }
});

test('Part D boss rig joints lie on their parts and on the body', async () => {
  const { CREATURE_RIGS } = await import('../src/render/creatureRigs.js');
  for (const [id, parts] of Object.entries(BOUNDS)) {
    const rig = CREATURE_RIGS[id];
    assert.ok(rig.order.includes('base') && rig.order.includes('head'), `${id} has a body and a head`);
    for (const n of rig.order) {
      const piv = rig.parts[n].piv;
      assert.ok(inside(piv, parts[n].box), `${id} ${n} joint ${piv} inside the part`);
      // A swinging part turns where it meets the body or the head (antennae), while a crown just pulses where it sits.
      if (rig.parts[n].swing && n !== 'base' && n !== 'head') assert.ok(inside(piv, parts.base.box, 0.03) || inside(piv, parts.head.box), `${id} ${n} joint on the body`);
      if (n === 'head') assert.ok(inside(piv, parts.base.box, 0.03), `${id} head turns on the body`);
      // The alternate picture (roaring head, striking limb) shares its part's joint.
      if (rig.parts[n].alt) assert.ok(inside(piv, parts[rig.parts[n].alt].box), `${id} ${rig.parts[n].alt} shares the ${n} joint`);
    }
  }
});
