import { creatureFloats, drawShadow } from './sprites.js';

// Shadows that follow the sun. game.dayPhase() runs 0..1 from midnight, with
// sunrise near 0.25, noon at 0.5 and sunset near 0.75. Through the day each
// character's shadow is cast away from the sun: long and leaning west in the
// morning, short at noon, long and leaning east by evening. After dark only a
// soft, faint contact shadow is left under the moon. Each shadow is the same
// cached soft blob (sprites.js drawShadow) stretched and placed, so it costs a
// couple of drawImage calls, and low graphics keeps the plain one.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/**
 * The sun's effect on shadows at a day phase, written into `out` (reused each frame):
 *  day     0 at night .. 1 in daylight
 *  stretch how much longer than the plain shadow the cast one is (1 at noon)
 *  dx, dy  which way it leans (unit-ish: -1 west in the morning, +1 east at dusk)
 *  alpha   how dark the cast shadow is (fainter at night)
 */
export function sunShadow(phase, out = {}) {
  const a = (phase - 0.25) * 2 * Math.PI;   // 0 at sunrise, pi/2 at noon, pi at sunset
  const elev = Math.sin(a);
  const day = smooth(-0.06, 0.16, elev);
  const low = 1 - clamp01(elev);            // 1 with the sun on the horizon
  out.day = day;
  out.stretch = 1 + day * 2.1 * low * low;
  out.dx = -Math.cos(a) * day;             // cast away from the sun as it crosses the sky
  out.dy = -0.28 * day;                    // ...and a little up the screen (the sun sits to the south)
  out.alpha = 0.5 + 0.45 * day;            // faint under the moon
  return out;
}

/** A footfall squash, 0..1: peaks as a foot lands (walkPhase counts tiles walked, one step a tile). */
export function footfall(walkPhase, moving) {
  if (!moving) return 0;
  const s = 1 - Math.abs(Math.sin(walkPhase * Math.PI));
  return s * s * s * s;
}

/**
 * A character's ground shadow at feet (cx, cy), base size rx by ry, for the sun
 * in `sun` (from sunShadow). `squash` (0..1) widens and flattens it for a
 * footfall or landing; `lift` (px off the ground) shrinks and fades it.
 * With `sun.low` set (low graphics) it is the plain shadow.
 */
export function drawSunShadow(ctx, cx, cy, rx, ry, sun, squash = 0, lift = 0) {
  if (squash) { rx *= 1 + 0.14 * squash; ry *= 1 - 0.1 * squash; }
  if (lift > 0) { const k = Math.max(0.45, 1 - lift / 24); rx *= k; ry *= k; }
  if (!sun || sun.low) { drawShadow(ctx, cx, cy, rx, ry); return; }
  const a0 = ctx.globalAlpha;
  // The contact shadow right under the feet: always there, softer at night.
  ctx.globalAlpha = a0 * (0.55 + 0.45 * sun.alpha);
  drawShadow(ctx, cx, cy, rx * 0.86, ry * 0.9);
  // The cast shadow: stretched along the sun's line and slid that way.
  if (sun.day > 0.02) {
    const ext = sun.stretch - 1, srx = rx * (0.9 + ext * 0.85), sry = ry * (1 + ext * 0.12);
    ctx.globalAlpha = a0 * Math.min(1, sun.alpha * (0.7 + 0.35 * sun.day)) * (lift > 0 ? Math.max(0.4, 1 - lift / 20) : 1);
    drawShadow(ctx, cx + sun.dx * (srx - rx * 0.6), cy + sun.dy * ry * (1 + ext), srx, sry);
  }
  ctx.globalAlpha = a0;
}

const WIDE_CREATURES = new Set(['crab', 'reptile', 'scorpion', 'serpent', 'spider', 'turtle']);

// The contact patch stays under the footprint. A hovering creature throws a
// softer, separated shadow, while a broad body needs a wider patch of shade.
export function drawCreatureContact(ctx, cx, cy, sc, def, sun, squash, spawn, contactOnly) {
  const floats = creatureFloats(def.sprite, def.family), wide = WIDE_CREATURES.has(def.sprite);
  const rx = wide ? 13 : def.boss ? 12.5 : 10;
  const ry = wide ? 3.8 : def.boss ? 5.5 : 4.5;
  const a0 = ctx.globalAlpha;
  const light = contactOnly ? 0.55 + 0.45 * sun.alpha : 1;
  ctx.globalAlpha = a0 * light * (floats ? 0.6 : 1) * (spawn?.a ?? 1);
  drawSunShadow(ctx, cx, cy, rx * sc * (spawn?.sx ?? 1), ry * sc, contactOnly ? null : sun, squash, floats ? 4 : 0);
  ctx.globalAlpha = a0;
}
