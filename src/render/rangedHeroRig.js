import { poseBlender, swapOpacity } from './poseBlend.js';
import { drawHeroArm, drawGripHand } from './heroanim.js';
import { drawAnimBody, drawSwingArm, drawEmptyArm, hasSwingArt, swingPhase } from './heroAnimArt.js';

// Ranged and magic limbs are separate from the melee pilot so each batch can
// be reviewed independently. All parts must load before replacing a portrait.
// The Sniper borrows the Pistoler's parts until its own art arrives (same file names, sniper-*).
export const RANGED_HERO_CLASSES = ['ranger', 'archer', 'sorcerer', 'wizard', 'pistoler', 'sniper'];
export const RANGED_HERO_PARTS = ['body', 'weapon', 'back', 'left', 'right', 'action'];
export const rangedHeroSrc = (classId, part) => `assets/creatures/hero/rig/${classId}-${part}.webp`;
// The weapon arm's shoulder, where the painted attack arms (heroAnimArt.js) hang.
const SHOULDER = { archer: [4, -11], ranger: [4, -11], pistoler: [10, -10], sniper: [6, -10], wizard: [9, -11], sorcerer: [9, -11] };
const images = new Map();
// Draw, release and cast ease across a restarted shot (see poseBlend.js).
const blendRanged = poseBlender();
const RANGED_BLEND = ['draw', 'release', 'charge', 'cast'];
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function rangedHeroPose(classId, gait = {}, time = 0, swing = -1) {
  const move = Math.max(0, Math.min(1, gait.move || 0));
  const step = Math.sin((gait.phase || 0) * Math.PI) * move;
  const active = swing >= 0 && swing <= 1;
  let draw = 0, release = 0, charge = 0, cast = 0;
  if (active && classId === 'pistoler') {
    // A quick snap of the arm: barely any draw, a sharp recoil.
    draw = smooth(swing / 0.2) * (1 - smooth((swing - 0.22) / 0.1));
    release = smooth((swing - 0.22) / 0.06) * (1 - smooth((swing - 0.3) / 0.5));
  } else if (active && classId === 'sniper') {
    // A long, still aim, then one heavy kick of recoil.
    draw = smooth(swing / 0.6) * (1 - smooth((swing - 0.62) / 0.08));
    release = smooth((swing - 0.62) / 0.05) * (1 - smooth((swing - 0.67) / 0.33));
  } else if (active && (classId === 'ranger' || classId === 'archer')) {
    draw = smooth(swing / 0.48) * (1 - smooth((swing - 0.5) / 0.14));
    release = smooth((swing - 0.5) / 0.08) * (1 - smooth((swing - 0.58) / 0.27));
  } else if (active && (classId === 'sorcerer' || classId === 'wizard')) {
    charge = smooth(swing / 0.6) * (1 - smooth((swing - 0.72) / 0.28));
    cast = smooth((swing - 0.6) / 0.14) * (1 - smooth((swing - 0.74) / 0.26));
  }
  return { step, breathe: Math.sin(time * 0.0032) * 0.35 * (1 - move), draw, release, charge, cast };
}

/** The class at rest with an animation clip's channels added (heroanim.js):
 *  draw, release, charge and cast, the second pistol's kick, a crouch and
 *  lifted feet. Clips start and end at rest, so this meets the old pose. */
export function rangedAnimPose(classId, opts, ch) {
  const pose = rangedHeroPose(classId, opts.gait, opts.time || 0, -1);
  const unit = (v) => Math.max(0, Math.min(1, v || 0));
  pose.draw = unit(ch.draw); pose.release = unit(ch.release);
  pose.charge = unit(ch.charge); pose.cast = unit(ch.cast);
  pose.kick2 = unit(ch.kick2);
  // Once the painted attack arm has handed back to the rig (arc, heroAnimArt.js)
  // the bow, rifle or staff is at rest, not left mid-aim (a rifle swung down).
  // The Pistoler's back gun is still the rig's, so it keeps its aim and kick.
  if (ch.paint && classId !== 'pistoler' && hasSwingArt(classId)) pose.draw = pose.release = pose.charge = pose.cast = 0;
  pose.breathe += ch.crouch || 0;
  pose.liftF = Math.max(0, ch.liftF || 0);
  pose.liftB = Math.max(0, ch.liftB || 0);
  // Feet stay planted as the body is kicked back (see heroRig.js rigAnimPose).
  pose.plantB = Math.max(0, ch.bx || 0) * 0.6;
  pose.plantF = Math.min(0, ch.bx || 0) * 0.6;
  return pose;
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
  const anim = opts.anim;
  const pose = anim ? rangedAnimPose(classId, opts, anim.ch)
    : blendRanged(opts.entity, rangedHeroPose(classId, opts.gait, opts.time || 0, opts.swingK ?? -1), opts.time || 0, opts.swingK ?? -1, RANGED_BLEND);
  // Life skills put the bow, guns or staff away for mitten arms holding a tool.
  const arms = anim ? 1 - Math.min(1, anim.ch.mix) : 1;
  const draw = (part, x, y, w, h, angle = 0, px = 0, py = 0, opacity = 1) => {
    if (opacity <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha *= opacity;
    ctx.drawImage(image(part), -px, -py, w, h);
    ctx.restore();
  };
  draw('left', -10 - pose.step * 1.5 - (pose.plantB || 0), -1 - Math.max(0, pose.step) * 3 - (pose.liftB || 0), 13, 16);
  draw('right', 1 + pose.step * 1.5 - (pose.plantF || 0), -1 - Math.max(0, -pose.step) * 3 - (pose.liftF || 0), 13, 16);
  const bow = classId === 'ranger' || classId === 'archer';
  const guns = classId === 'pistoler';
  if (anim) drawHeroArm(ctx, anim, 'back', -11 + pose.breathe);
  // The rifle is held in both hands, so the Sniper's back hand steadies it (below).
  const rifle = classId === 'sniper' && anim?.weapon === 'rifle';
  if (!bow && !guns && !rifle) draw('back', -15, -10 + pose.breathe, 16, 12, -pose.step * 0.2 - pose.charge * 0.35, 12, 3, arms);
  // The painted body can blink, flinch and cheer (heroAnimArt.js).
  if (!drawAnimBody(ctx, classId, opts, -21, -38 + pose.breathe, 42, 44)) draw('body', -21, -38 + pose.breathe, 42, 44);
  if (anim) drawHeroArm(ctx, anim, 'front', -11 + pose.breathe);
  if (arms <= 0.001) return true;
  if (arms < 1) { ctx.save(); ctx.globalAlpha *= arms; }
  // An attack plays the painted wind-up, mid and follow-through arms in place
  // of the bow, the front pistol, the rifle or the staff.
  const kind = bow ? 'bow' : guns || classId === 'sniper' ? 'gun' : 'staff';
  const frame = anim && anim.kind === 'combat' && hasSwingArt(classId) ? swingPhase(anim.ch, 'main', kind) : null;
  const sh = SHOULDER[classId];
  if (frame && !guns) drawSwingArm(ctx, classId, anim, 'main', kind, sh[0], sh[1] + pose.breathe);
  // With no weapon equipped the hand is empty: the painted bare arm.
  else if (opts.hasWeapon === false && drawEmptyArm(ctx, classId, 8, -12 + pose.breathe, 0.25 + pose.step * 0.3, 12)) { /* drawn */ }
  else if (guns) {
    // Two pistols: the back hand aims level from the shoulder and kicks up on
    // each shot; the front hand swings its pistol from upright to level, and a
    // muzzle flash blooms at the front barrel on release.
    const y = -12 + pose.breathe;
    // With an animation clip the two hands take turns (kick2 is the back one's
    // shot): the back gun sits a little lower, so each muzzle and its flash
    // reads on its own, and each gun jerks up and back on its own shot.
    const backKick = anim ? pose.kick2 : pose.release;
    const by = y + 3;
    draw('back', -7 - backKick * 2, by, 31, 13, -backKick * 0.3 + pose.step * 0.05, 2, 6);
    if (backKick > 0) draw('action', 24 - backKick * 2, by - 7 - backKick * 2, 14, 9, -backKick * 0.3, 2, 4, anim ? backKick : 0);
    if (frame) drawSwingArm(ctx, classId, anim, 'main', kind, sh[0], sh[1] + pose.breathe);
    else {
      draw('weapon', 14 - pose.release * 1.5, y + 2, 14, 23, pose.draw * 1.25 - pose.release * 0.35, 3, 21);
      draw('action', 27, y - 6, 16, 10, 0, 2, 5, pose.release);
    }
  } else if (bow) {
    const y = -11 + pose.breathe;
    const shortbow = classId === 'archer';
    draw('weapon', 14, y, shortbow ? 21 : 22, shortbow ? 40 : 46, 0, 1.5, shortbow ? 23 : 25);
    // The string follows the drawing hand, rather than stretching a painted
    // bowstring. The arrow here is a nocked visual; combat owns projectiles.
    const nock = (shortbow ? 23 : 24) - pose.draw * 9;
    ctx.save(); ctx.strokeStyle = '#f4e5bc'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(shortbow ? 22 : 24, y - (shortbow ? 21 : 23)); ctx.lineTo(nock, y); ctx.lineTo(24, y + (shortbow ? 17 : 22)); ctx.stroke();
    if (pose.release < 0.05) {
      ctx.strokeStyle = '#815b36'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nock - 3, y); ctx.lineTo(nock + 25, y); ctx.stroke();
      ctx.fillStyle = '#d8e1e6'; ctx.beginPath();
      ctx.moveTo(nock + 28, y); ctx.lineTo(nock + 23, y - 2); ctx.lineTo(nock + 23, y + 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // The relaxed hand and the drawing hand swap rather than overlap.
    const drawn = swapOpacity(pose.draw);
    draw('back', -10, y, 34, 11, 0, 0, 5, 1 - drawn);
    draw('action', -10, y, 29, 16, 0, 0, 3, drawn);
  } else if (classId === 'sniper') {
    // The long gun levels into a still aim, kicks up on the shot and flashes at
    // the muzzle (the staff branch below never moved it: draw and release
    // aren't charge and cast).
    const y = -10 + pose.breathe;
    const angle = 0.3 + pose.draw * 1.0 - pose.release * 0.35 + pose.step * 0.12;
    // The back hand reaches across to the fore-end, under the barrel.
    const c = Math.cos(angle), s = Math.sin(angle), fx = 0.55 * 20 - 5, fy = 0.74 * 39 - 33;
    const hx = 14 + fx * c - fy * s, hy = y + fx * s + fy * c + 1.5;
    if (rifle) drawGripHand(ctx, classId, 'arm', -4, y - 2, hx, hy);
    draw('weapon', 14, y, 20, 39, angle, 5, 33);
    if (rifle) drawGripHand(ctx, classId, 'fist', 0, 0, hx, hy);
    draw('action', 30, y - 9, 16, 10, 0, 2, 5, pose.release);
  } else {
    const angle = -pose.charge * 0.2 + pose.cast * 1.1 + pose.step * 0.12;
    const cast = swapOpacity(pose.cast);
    draw('weapon', 14, -10 + pose.breathe, 20, classId === 'wizard' ? 54 : 39, angle + 0.3, classId === 'wizard' ? 18 : 5, classId === 'wizard' ? 45 : 33, 1 - cast);
    draw('action', 14, -10 + pose.breathe, classId === 'wizard' ? 48 : 35, classId === 'wizard' ? 16 : 13, (angle - 1.1) * 0.3, 4, 5, cast);
  }
  if (arms < 1) ctx.restore();
  return true;
}
