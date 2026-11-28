import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawPlayer, PUPPET_HEROES, CLASS_HERO_ART } from '../src/render/sprites.js';
import { sampleHeroClip } from '../src/render/heroanim.js';

// The Ninja and Sniper have repainted full figures for both facings.
const REDRAWN = ['ninja', 'sniper'];

// Width, height and alpha flag are stored differently in lossy and lossless WebP.
function webpInfo(path) {
  const b = readFileSync(new URL('../' + path, import.meta.url));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  if (b.toString('ascii', 12, 16) === 'VP8L') {
    assert.equal(b[20], 0x2f, `${path}: lossless WebP signature`);
    const flags = b.readUInt32LE(21);
    return { alpha: !!(flags & (1 << 28)), w: 1 + (flags & 0x3fff), h: 1 + ((flags >>> 14) & 0x3fff) };
  }
  assert.equal(b.toString('ascii', 12, 16), 'VP8X', `${path}: extended WebP (needed for alpha)`);
  return { alpha: !!(b[20] & 0x10), w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
}

test('front, rear and work puppet artwork fits the in-world portrait frame', () => {
  for (const id of REDRAWN) {
    assert.ok(CLASS_HERO_ART.has(id), id);
    for (const file of [`${id}.webp`, `puppet/${id}-back.webp`, `puppet/${id}-work.webp`]) {
      const { alpha, w, h } = webpInfo(`assets/creatures/hero/${file}`);
      assert.ok(alpha, `${file}: has alpha`);
      assert.equal(h, 256, `${file}: 256 px tall`);
      assert.ok(w >= 200 && w <= 256 * 60 / 56, `${file}: width ${w}`);
    }
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
      for (const extra of [{}, { swingK: 0.5 }, { facing: { dx: 0, dy: -1 } }, { dualWield: true, swingK: 0.3 }]) {
        const srcs = drawn(id, style, extra);
        const file = extra.facing?.dy < 0 ? `puppet/${id}-back.webp` : `${id}.webp`;
        assert.ok(srcs.includes(`assets/creatures/hero/${file}`), `${id}: the matching view is drawn (${JSON.stringify(extra)})`);
        assert.ok(!srcs.some((s) => s.includes('/rig/') || s.includes('/anim/')), `${id}: no old rig or animation parts: ${srcs}`);
      }
      const entity = {}, facing = { dx: 0, dy: -1 };
      drawn(id, style, { entity, facing });  // already showing its rear view
      const anim = sampleHeroClip('woodcut', 0.5, { tool: 'bronze_axe', jobClass: id });
      const srcs = drawn(id, style, { entity, facing, anim, time: 1016 });
      assert.ok(srcs.includes(`assets/creatures/hero/puppet/${id}-work.webp`), `${id}: starts work with weapon stowed`);
      assert.ok(srcs.some((s) => s.includes('item-bronze_axe.webp')), `${id}: the working hand holds the axe`);
      assert.ok(!srcs.some((s) => s.endsWith(`/${id}.webp`) || s.endsWith(`/${id}-back.webp`)), `${id}: no armed portrait during work`);
    }
    // Classes with current art still assemble from their rig parts.
    assert.ok(drawn('swordsman', 'melee').some((s) => s.includes('/rig/')), 'swordsman still uses its rig');
    assert.ok(drawn('archer', 'ranged').some((s) => s.includes('/rig/')), 'archer still uses its rig');
    // The Pistoler's repainted layers still use the articulated rig.
    assert.ok(!PUPPET_HEROES.has('pistoler'));
    assert.ok(drawn('pistoler', 'ranged').some((s) => s.includes('/rig/pistoler-')), 'pistoler still uses its rig');
    const entity = {}, facing = { dx: 0, dy: -1 };
    assert.ok(drawn('swordsman', 'melee', { entity, facing }).some((s) => s.includes('_backbody')), 'the Swordsman has a rear view');
    const anim = sampleHeroClip('woodcut', 0.5, { tool: 'bronze_axe', jobClass: 'swordsman' });
    const working = drawn('swordsman', 'melee', { entity, facing, anim, time: 1016 });
    assert.ok(working.some((s) => s.includes('item-bronze_axe.webp')), 'a rear-facing rig can show its tool as work begins');
    assert.ok(working.every((s) => !s.includes('_backbody')), 'work switches out of the rear view');
  } finally { if (previous === undefined) delete globalThis.Image; else globalThis.Image = previous; }
});
