// A school of fish at a fishing spot (src/game/fishschool.js): a dark swirl on
// the water with little fish silhouettes circling in it and a ring of ripples,
// drawn over the spot's own sprite (its pool picture would hide it). Plain
// canvas shapes, a dozen or so, and only for the one or two schools in view. Low graphics draws a still marker:
// the dark patch and three fish, no ripples.
import { TILE } from '../config.js';

const FISH = 9;          // silhouettes in the swirl
const FISH_LOW = 3;

/** One fish, nose along `ang`, `s` long. */
function fish(ctx, x, y, ang, s) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.lineTo(-s * 0.75, -s * 0.22); ctx.lineTo(-s * 0.75, s * 0.22); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/**
 * Draw `school` ({ from, until }) centred on (cx, cy) in screen pixels.
 * `tick` includes the current tick's progress, so it fades in and out smoothly.
 */
export function drawFishSchool(ctx, cx, cy, timeMs, school, tick, low = false) {
  const left = school.until - tick, age = tick - school.from;
  const fade = Math.max(0, Math.min(1, age / 3, left / 3));   // ~2s fade at each end
  if (!fade) return;
  const k = fade * fade * (3 - 2 * fade);
  const R = TILE * 1.15;
  ctx.save();
  ctx.globalAlpha = 0.6 * k;
  ctx.fillStyle = '#0b2740';
  ctx.beginPath(); ctx.ellipse(cx, cy + 4, R, R * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.9 * k;
  ctx.fillStyle = '#10263c';
  const n = low ? FISH_LOW : FISH, spin = low ? 0 : timeMs * 0.0016;
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2, rr = R * (0.45 + 0.35 * ((i * 7) % 3) / 2);
    const x = cx + Math.cos(a) * rr, y = cy + 4 + Math.sin(a) * rr * 0.5;
    // Nose along the circle (the swirl turns clockwise on screen).
    fish(ctx, x, y, Math.atan2(Math.cos(a) * 0.5, -Math.sin(a)), 12);
  }
  if (!low) {
    // A silver flash now and then as a fish turns.
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const f = ((timeMs / 900) + i / 3) % 1, a = spin * 1.3 + i * 2.1;
      ctx.globalAlpha = (1 - f) * 0.9 * k;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 0.55, cy + 4 + Math.sin(a) * R * 0.28, 1.5 + f * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    // Two rings of ripples spreading out and fading.
    ctx.strokeStyle = '#d8f1ff'; ctx.lineWidth = 1.5;
    for (let j = 0; j < 2; j++) {
      const f = ((timeMs / 1400) + j / 2) % 1;
      ctx.globalAlpha = (1 - f) * 0.6 * k;
      ctx.beginPath(); ctx.ellipse(cx, cy + 4, R * (0.6 + f * 0.7), R * (0.3 + f * 0.35), 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}
