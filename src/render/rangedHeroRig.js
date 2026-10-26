// Ranged and magic limbs are separate from the melee pilot so each batch can
// be reviewed independently. All parts must load before replacing a portrait.
export const RANGED_HERO_CLASSES = ['ranger', 'sorcerer'];
export const RANGED_HERO_PARTS = ['body', 'weapon', 'back', 'left', 'right', 'action'];
export const rangedHeroSrc = (classId, part) => `assets/creatures/hero/rig/${classId}-${part}.webp`;
const images = new Map();
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function rangedHeroPose(classId, gait = {}, time = 0, swing = -1) {
  const move = Math.max(0, Math.min(1, gait.move || 0));
  const step = Math.sin((gait.phase || 0) * Math.PI) * move;
  const active = swing >= 0 && swing <= 1;
  let draw = 0, release = 0, charge = 0, cast = 0;
  if (active && classId === 'ranger') {
    draw = smooth(swing / 0.48) * (1 - smooth((swing - 0.5) / 0.14));
    release = smooth((swing - 0.5) / 0.08) * (1 - smooth((swing - 0.58) / 0.27));
  } else if (active && classId === 'sorcerer') {
    charge = smooth(swing / 0.6) * (1 - smooth((swing - 0.72) / 0.28));
    cast = smooth((swing - 0.6) / 0.14) * (1 - smooth((swing - 0.74) / 0.26));
  }
  return { step, breathe: Math.sin(time * 0.0032) * 0.35 * (1 - move), draw, release, charge, cast };
}

export function drawRangedHeroRig(ctx, opts = {}) {
  const classId = opts.jobClass;
  if (!RANGED_HERO_CLASSES.includes(classId) || typeof Image === 'undefined') return false;
  for (const part of RANGED_HERO_PARTS) {
    const key = `${classId}-${part}`;
    if (!images.has(key)) {
      const img = new Image();
      img.src = rangedHeroSrc(classId, part);
      images.set(key, img);
    }
  }
  const image = (part) => images.get(`${classId}-${part}`);
  if (RANGED_HERO_PARTS.some((part) => !image(part).complete || !image(part).naturalWidth)) return false;
  const pose = rangedHeroPose(classId, opts.gait, opts.time || 0, opts.swingK ?? -1);
  const draw = (part, x, y, w, h, angle = 0, px = 0, py = 0, opacity = 1) => {
    if (opacity <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha *= opacity;
    ctx.drawImage(image(part), -px, -py, w, h);
    ctx.restore();
  };
  draw('left', -10 - pose.step * 1.5, -1 - Math.max(0, pose.step) * 3, 13, 16);
  draw('right', 1 + pose.step * 1.5, -1 - Math.max(0, -pose.step) * 3, 13, 16);
  if (classId === 'sorcerer') draw('back', -15, -10 + pose.breathe, 16, 12, -pose.step * 0.2 - pose.charge * 0.35, 12, 3);
  draw('body', -21, -38 + pose.breathe, 42, 44);
  if (classId === 'ranger') {
    const y = -11 + pose.breathe;
    draw('weapon', 14, y, 22, 46, 0, 1.5, 25);
    // The string follows the drawing hand, rather than stretching a painted
    // bowstring. The arrow here is a nocked visual; combat owns projectiles.
    const nock = 24 - pose.draw * 9;
    ctx.save(); ctx.strokeStyle = '#f4e5bc'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(24, y - 23); ctx.lineTo(nock, y); ctx.lineTo(24, y + 22); ctx.stroke();
    if (pose.release < 0.05) {
      ctx.strokeStyle = '#815b36'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nock - 3, y); ctx.lineTo(nock + 25, y); ctx.stroke();
      ctx.fillStyle = '#d8e1e6'; ctx.beginPath();
      ctx.moveTo(nock + 28, y); ctx.lineTo(nock + 23, y - 2); ctx.lineTo(nock + 23, y + 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    draw('back', -10, y, 34, 11, 0, 0, 5, 1 - pose.draw);
    draw('action', -10, y, 29, 16, 0, 0, 3, pose.draw);
  } else {
    const angle = -pose.charge * 0.2 + pose.cast * 1.1 + pose.step * 0.12;
    draw('weapon', 14, -10 + pose.breathe, 20, 39, angle + 0.3, 5, 33, 1 - pose.cast);
    draw('action', 14, -10 + pose.breathe, 35, 13, (angle - 1.1) * 0.3, 4, 5, pose.cast);
  }
  return true;
}
