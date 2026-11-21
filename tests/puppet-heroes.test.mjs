import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawPlayer, PUPPET_HEROES, CLASS_HERO_ART } from '../src/render/sprites.js';
import { sampleHeroClip } from '../src/render/heroanim.js';

// The Ninja and Sniper have redrawn portraits; until their redesigned
// rig sheets arrive they are drawn in the world from that one picture.
const REDRAWN = ['ninja', 'sniper'];

// Width, height and alpha flag from a WebP's extended (VP8X) header.
function webpInfo(path) {
  const b = readFileSync(new URL('../' + path, import.meta.url));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 12, 16), 'VP8X', `${path}: extended WebP (needed for alpha)`);
  return { alpha: !!(b[20] & 0x10), w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
}

test('the redrawn portraits are 256 px tall with transparency, like the others', () => {
  for (const id of REDRAWN) {
    assert.ok(CLASS_HERO_ART.has(id), id);
    const { alpha, w, h } = webpInfo(`assets/creatures/hero/${id}.webp`);
    assert.ok(alpha, `${id}: has alpha`);
    assert.equal(h, 256, `${id}: 256 px tall`);
    // Wide enough for the arms, but the in-world fit (60x56) stays height-bound.
    assert.ok(w >= 200 && w <= 256 * 60 / 56, `${id}: width ${w}`);
  }
});

test('the redrawn classes draw as the portrait puppet; the others keep their rigs', () => {
  const previous = globalThis.Image;
  globalThis.Image = class { constructor() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; } };
  try {
    const drawn = (jobClass, weaponType, extra = {}) => {
      const srcs = [];
      const noop = () => {};
      const grad = { addColorStop: noop };
      const ctx = new Proxy({ globalAlpha: 1, globalCompositeOperation: 'source-over', drawImage(img) { srcs.push(String(img.src)); },
        createRadialGradient: () => grad, createLinearGradient: () => grad }, { get: (o, k) => (k in o ? o[k] : noop) });
      drawPlayer(ctx, 50, 50, { time: 1000, entity: {}, jobClass, hasWeapon: true, weaponType, facing: { dx: 1, dy: 0 },
        gait: { phase: 0.5, move: 1, run: false, turn: 0 }, ...extra });
      return srcs;
    };
    assert.equal(PUPPET_HEROES.size, REDRAWN.length);
    for (const id of REDRAWN) {
      assert.ok(PUPPET_HEROES.has(id), id);
      const style = id === 'ninja' ? 'melee' : 'ranged';
      for (const extra of [{}, { swingK: 0.5 }, { facing: { dx: 0, dy: -1 } }, { dualWield: true, swingK: 0.3 },
        { anim: sampleHeroClip('chop', 0.5, { tool: 'bronze_axe', jobClass: id }) }]) {
        const srcs = drawn(id, style, extra);
        assert.ok(srcs.includes(`assets/creatures/hero/${id}.webp`), `${id}: the new portrait is drawn (${JSON.stringify(extra)})`);
        assert.ok(!srcs.some((s) => s.includes('/rig/') || s.includes('/anim/')), `${id}: no old rig or animation parts: ${srcs}`);
      }
    }
    // Classes with current art still assemble from their rig parts.
    assert.ok(drawn('swordsman', 'melee').some((s) => s.includes('/rig/')), 'swordsman still uses its rig');
    assert.ok(drawn('archer', 'ranged').some((s) => s.includes('/rig/')), 'archer still uses its rig');
    // The Pistoler keeps its existing portrait and rig (the owner chose not to swap it).
    assert.ok(!PUPPET_HEROES.has('pistoler'));
    assert.ok(drawn('pistoler', 'ranged').some((s) => s.includes('/rig/pistoler-')), 'pistoler still uses its rig');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
