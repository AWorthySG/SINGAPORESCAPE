// The Swordsman pilot uses separate painted limbs. Keep loading and animation
// here so the shared sprite library only needs one optional drawing hook.
export const HERO_RIG_PARTS = ['body', 'sword', 'back', 'left', 'right', 'strike'];
const images = new Map();
export const heroRigSrc = (part) => `assets/creatures/hero/rig/swordsman-${part}.webp`;

export function swordsmanPose(gait = {}, time = 0, swing = -1) {
  const move = Math.max(0, Math.min(1, gait.move || 0));
  const step = Math.sin((gait.phase || 0) * Math.PI) * move;
  const attacking = swing >= 0 && swing <= 1;
  const k = Math.max(0, Math.min(1, swing));
  // Ease through wind-up, contact and recovery without snapping at the ends.
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const wind = attacking ? smooth(k / 0.3) : 0;
  const hit = attacking ? smooth((k - 0.3) / 0.22) : 0;
  const recover = attacking ? smooth((k - 0.55) / 0.45) : 0;
  return {
    step,
    breathe: Math.sin(time * 0.0032) * 0.35 * (1 - move),
    sword: -wind * 0.55 + hit * 1.8 - recover * 1.25 + step * 0.12,
    back: -step * 0.28 - (wind - recover) * 0.15,
    strike: hit * (1 - recover),
  };
}

export function drawSwordsmanRig(ctx, opts = {}) {
  if (opts.jobClass !== 'swordsman' || typeof Image === 'undefined') return false;
  for (const part of HERO_RIG_PARTS) {
    if (!images.has(part)) {
      const img = new Image();
      img.src = heroRigSrc(part);
      images.set(part, img);
    }
  }
  // Never show a partially assembled character, including on a failed load.
  if (HERO_RIG_PARTS.some((part) => !images.get(part).complete || !images.get(part).naturalWidth)) return false;
  const pose = swordsmanPose(opts.gait, opts.time || 0, opts.swingK ?? -1);
  const draw = (part, x, y, w, h, angle = 0, px = 0, py = 0, opacity = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.globalAlpha *= opacity;
    ctx.drawImage(images.get(part), -px, -py, w, h);
    ctx.restore();
  };
  // Boots tuck behind the tunic; their planted edges stay on the ground.
  draw('left', -10 - pose.step * 1.5, 2 - Math.max(0, pose.step) * 3, 13, 13);
  draw('right', 1 + pose.step * 1.5, 2 - Math.max(0, -pose.step) * 3, 13, 13);
  draw('back', -12, -9 + pose.breathe, 12, 14, pose.back, 5, 3);
  draw('body', -21, -38 + pose.breathe, 42, 44);
  // Rotate around the shoulder, rather than rotating the whole portrait.
  draw('sword', 11, -10 + pose.breathe, 23, 42, pose.sword, 19, 37, 1 - pose.strike);
  draw('strike', 11, -10 + pose.breathe, 37, 13, (pose.sword - 1.25) * 0.3, 4, 5, pose.strike);
  return true;
}
