import { clamp01, easeOut, smooth } from './motionkit.js';

const TAU = Math.PI * 2;
const INK = '#22304a';
const MOTE = '#fff6d9';

export const fxProgress = (effect) => clamp01(1 - effect.life / effect.maxLife);
export const fxFade = (phase) => 1 - smooth(phase);
const PLAIN_SHOTS = new Set(['arrow', 'bullet', 'coin', 'shuriken']);
export const isSpellShot = (shot) => !PLAIN_SHOTS.has(shot.kind);

// The spell's painted position and its position along the floor. The light
// pass and the projectile renderer share this path so the light follows the
// beam's head, a falling blade or a bolt even when the camera tilts.
const STRAIGHT = new Set(['grace', 'holyfire', 'wrath', 'ash', 'bloodprice']);
export function spellPose(shot, t, out = {}) {
  let u = t, lift = 0;
  if (shot.el === 'radiance') u = easeOut(clamp01(t / 0.3));
  else if (shot.el === 'judgement') {
    u = 1;
    lift = 78 * (1 - clamp01(t / 0.65) ** 2);
  } else if (shot.el === 'sanctuary') u = 1;
  else if (!STRAIGHT.has(shot.el)) lift = 8 * Math.sin(t * Math.PI);
  out.x = shot.x + (shot.ex - shot.x) * u;
  const y = shot.y + (shot.ey - shot.y) * u;
  out.y = y - lift + (shot.el === 'sanctuary' ? 9 : 0);
  out.row = y + 12;
  return out;
}

// Bake soft halos once per colour. The same paint can lie flat or wrap an
// airborne effect, drawn at the requested size without a blur each frame.
const halos = new Map();
function halo(colour) {
  if (halos.has(colour)) return halos.get(colour);
  if (typeof document === 'undefined') return null;
  const cv = document.createElement?.('canvas');
  if (!cv) return null;
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const ray = g?.createRadialGradient?.(32, 32, 0, 32, 32, 32);
  if (!ray?.addColorStop) return null;
  g.fillStyle = colour;
  g.fillRect(0, 0, 64, 64);
  ray.addColorStop(0, '#fff');
  ray.addColorStop(0.34, 'rgba(255,255,255,0.53)');
  ray.addColorStop(0.7, 'rgba(255,255,255,0.13)');
  ray.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = ray; g.fillRect(0, 0, 64, 64);
  if (halos.size >= 48) halos.delete(halos.keys().next().value);
  halos.set(colour, cv);
  return cv;
}

export function fxGlow(ctx, x, y, rx, ry, colour, alpha, blend = 'lighter') {
  if (!(alpha > 0 && rx > 0 && ry > 0)) return;
  const img = halo(colour);
  if (!img) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = blend;
  ctx.drawImage(img, x - rx, y - ry, rx * 2, ry * 2);
  ctx.restore();
}

export function fxRing(ctx, x, y, rx, ry, colour, width, alpha, detail) {
  if (!(alpha > 0 && rx > 0 && ry > 0)) return;
  ctx.save();
  const a = ctx.globalAlpha * alpha;
  ctx.globalCompositeOperation = 'source-over';
  if (detail) {
    // A soft lower edge gives the thin band thickness against bright ground.
    ctx.globalAlpha = a * 0.48; ctx.strokeStyle = INK; ctx.lineWidth = width + 1.4;
    ctx.beginPath(); ctx.ellipse(x, y + width * 0.55, rx, ry, 0, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = a; ctx.strokeStyle = colour; ctx.lineWidth = width;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
  if (detail) {
    ctx.globalAlpha = a * 0.78; ctx.strokeStyle = MOTE; ctx.lineWidth = width * 0.38;
    ctx.beginPath(); ctx.ellipse(x, y - width * 0.28, rx, ry, 0, Math.PI + 0.2, TAU - 0.2); ctx.stroke();
  }
  ctx.restore();
}

// An impact loses most of its speed early. A faint wake lags behind its rim.
export function fxWave(ctx, x, y, span, aspect, colour, phase, detail) {
  const t = easeOut(phase), fade = fxFade(phase);
  const r = span * (0.18 + 0.95 * t);
  if (detail) {
    const wake = span * (0.12 + 0.76 * easeOut(Math.max(0, phase - 0.14)));
    fxGlow(ctx, x, y, r, r * aspect, colour, 0.36 * fade, 'source-over');
    fxRing(ctx, x, y, wake, wake * aspect, colour, 1.6, fade * 0.42, false);
  }
  fxRing(ctx, x, y, r, r * aspect, colour, 1.3 + 3.9 * fade, fade * 0.86, detail);
}

export function fxOrb(ctx, x, y, r, colour, detail) {
  ctx.save();
  if (detail) fxGlow(ctx, x, y, r * 2.9, r * 2.7, colour, 0.64);
  const g = detail && ctx.createRadialGradient?.(x - r * 0.34, y - r * 0.4, 0, x, y, r * 1.1);
  if (g?.addColorStop) {
    g.addColorStop(0, '#fffdf3');
    g.addColorStop(0.36, colour);
    g.addColorStop(0.94, INK);
  }
  ctx.fillStyle = g?.addColorStop ? g : colour;
  ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = MOTE;
  ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.33, r * 0.24, 0, TAU); ctx.fill();
  ctx.restore();
}

const _tail = {};
export function drawSpellBolt(ctx, shot, pose, phase, ox, oy, detail) {
  const col = shot.color || '#c890f0', k = shot.crit ? 1.5 : 1;
  const x = pose.x - ox, y = pose.y - oy;
  ctx.save();
  if (detail && phase > 0) {
    const tail = spellPose(shot, Math.max(0, phase - 0.25), _tail);
    const tx = tail.x - ox, ty = tail.y - oy, dx = x - tx, dy = y - ty;
    const d = Math.hypot(dx, dy) || 1, w = 3.5 * k;
    const nx = -dy / d, ny = dx / d;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * 0.62;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + dx * 0.56 + nx * w * 0.7, ty + dy * 0.56 + ny * w * 0.7, x + nx * w, y + ny * w);
    ctx.lineTo(x - nx * w, y - ny * w);
    ctx.quadraticCurveTo(tx + dx * 0.62 - nx * w * 0.4, ty + dy * 0.62 - ny * w * 0.4, tx, ty);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = alpha;
  }
  fxOrb(ctx, x, y, 3.9 * k, col, detail);
  ctx.restore();
}
