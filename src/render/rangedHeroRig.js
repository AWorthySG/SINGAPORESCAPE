import { poseBlender, swapOpacity } from './poseBlend.js';
import { drawHeroArm, drawGripHand, HERO_CLIPS } from './heroanim.js';
import { drawAnimBody, drawSwingArm, drawEmptyArm, hasSwingArt, swingPhase } from './heroAnimArt.js';
import { heroLit } from './herolight.js';
import { drawCenserSwing, censerBackTurn } from './censerSwing.js';
import { heroWalk } from './motionkit.js';

// Ranged and magic limbs are separate from the melee pilot so each batch can
// be reviewed independently. All parts must load before replacing a portrait.
// The Sniper borrows the Pistoler's parts until its own art arrives (same file names, sniper-*).
export const RANGED_HERO_CLASSES = ['ranger', 'archer', 'sorcerer', 'wizard', 'pistoler', 'sniper', 'priest', 'zealot'];
export const RANGED_HERO_PARTS = ['body', 'weapon', 'back', 'left', 'right', 'action'];
export const rangedHeroSrc = (classId, part) => `assets/creatures/hero/rig/${classId}-${part}.webp`;
// The weapon arm's shoulder, where the painted attack arms (heroAnimArt.js) hang.
const SHOULDER = { archer: [4, -11], ranger: [4, -11], pistoler: [10, -10], sniper: [6, -10], wizard: [9, -11], sorcerer: [9, -11], priest: [13, -8.1], zealot: [14.7, -7.1] };
// Rigs cut from a sheet with every part where it sits on the assembled hero (the
// Priest's H8a and the Zealot's H9a), drawn at their measured places: the body and
// boots as [x, y, w, h], each arm as [shoulder x, y, w, h, pivot x, y], turning
// about its shoulder (the pivot inside the picture). Game units, ground at y = 15.
const PLACED = {
  priest: { body: [-20.8, -38, 41.7, 49.4], left: [-15.2, 3.4, 11.6, 11.6], right: [5.3, 3.6, 12.3, 11.4],
    weapon: [13, -8.1, 18.4, 20.5, 3.1, 13.9], back: [-9.4, -8, 14.9, 15.7, 11.7, 2.9], action: [13.3, -10.2, 24.3, 20.3, 4.1, 11.3] },
  zealot: { body: [-18, -38, 35.9, 47.7], left: [-15.9, 2.6, 12, 12.4], right: [4, 4.1, 13, 10.9],
    weapon: [14.7, -7.1, 20.8, 23.8, 3.2, 5.4], back: [-9.9, -8.6, 12.4, 16.7, 9, 3.2], action: [14.4, -1.5, 25.6, 9.9, 4.1, 5.4] },
};
const images = new Map();
// Draw, release and cast ease across a restarted shot (see poseBlend.js).
const blendRanged = poseBlender();
const RANGED_BLEND = ['draw', 'release', 'charge', 'cast'];
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function rangedHeroPose(classId, gait = {}, time = 0, swing = -1, calm = false) {
  const move = Math.max(0, Math.min(1, gait.move || 0));
  const { step, liftB, liftF, rise } = heroWalk(gait, calm);
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
  } else if (active && (classId === 'sorcerer' || classId === 'wizard' || PLACED[classId])) {
    charge = smooth(swing / 0.6) * (1 - smooth((swing - 0.72) / 0.28));
    cast = smooth((swing - 0.6) / 0.14) * (1 - smooth((swing - 0.74) / 0.26));
  }
  return { step, liftB, liftF, breathe: Math.sin(time * 0.0032) * (calm ? 0.12 : 0.35) * (1 - move) - rise, draw, release, charge, cast };
}

/** The class at rest with an animation clip's channels added (heroanim.js):
 *  draw, release, charge and cast, the second pistol's kick, a crouch and
 *  lifted feet. Clips start and end at rest, so this meets the old pose. */
export function rangedAnimPose(classId, opts, ch) {
  const pose = rangedHeroPose(classId, opts.gait, opts.time || 0, -1, opts.anim?.calm || opts.calm);
  const unit = (v) => Math.max(0, Math.min(1, v || 0));
  pose.draw = unit(ch.draw); pose.release = unit(ch.release);
  pose.charge = unit(ch.charge); pose.cast = unit(ch.cast);
  pose.kick2 = unit(ch.kick2);
  // Once the painted attack arm has handed back to the rig (arc, heroAnimArt.js)
  // the bow, rifle or staff is at rest, not left mid-aim (a rifle swung down).
  // The Pistoler's back gun is still the rig's, so it keeps its aim and kick.
  if (ch.paint && classId !== 'pistoler' && hasSwingArt(classId)) pose.draw = pose.release = pose.charge = pose.cast = 0;
  pose.breathe += ch.crouch || 0;
  pose.liftF += Math.max(0, ch.liftF || 0);
  pose.liftB += Math.max(0, ch.liftB || 0);
  // Feet stay planted as the body is kicked back (see heroRig.js rigAnimPose).
  pose.plantB = Math.max(0, ch.bx || 0) * (1 - Math.min(1, pose.liftB / 3));
  pose.plantF = Math.min(0, ch.bx || 0) * (1 - Math.min(1, pose.liftF / 3));
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
    : blendRanged(opts.entity, rangedHeroPose(classId, opts.gait, opts.time || 0, opts.swingK ?? -1, opts.calm), opts.time || 0, opts.swingK ?? -1, RANGED_BLEND);
  // Life skills put the bow, guns or staff away for mitten arms holding a tool.
  const arms = anim ? 1 - Math.min(1, anim.ch.mix) : 1;
  const draw = (part, x, y, w, h, angle = 0, px = 0, py = 0, opacity = 1, scaleX = 1) => {
    if (opacity <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha *= opacity;
    if (scaleX !== 1) ctx.scale(scaleX, 1);
    ctx.drawImage(heroLit(image(part)), -px, -py, w, h);   // with its rim light (herolight.js)
    ctx.restore();
  };
  const placed = PLACED[classId];
  const bow = classId === 'ranger' || classId === 'archer';
  const guns = classId === 'pistoler';
  const bootY = guns ? -4 : -1;
  const [lx, ly, lw, lh] = placed ? placed.left : [-10, bootY, 13, 15 - bootY];
  const [rx, ry, rw, rh] = placed ? placed.right : [1, bootY, 13, 15 - bootY];
  draw('left', lx - pose.step * 1.5 - (pose.plantB || 0), ly - pose.liftB, lw, lh);
  draw('right', rx + pose.step * 1.5 - (pose.plantF || 0), ry - pose.liftF, rw, rh);
  if (anim) drawHeroArm(ctx, anim, 'back', -11 + pose.breathe);
  // With one pistol the off hand rests at the hip, clear of its firing arm.
  if (guns && (opts.dualWield === false || opts.hasWeapon === false) && arms > 0.001) {
    ctx.save(); ctx.globalAlpha *= arms;
    drawEmptyArm(ctx, classId, -7, -10 + pose.breathe, -0.52 + pose.step * 0.25, 9);
    ctx.restore();
  }
  // The rifle is held in both hands, so the Sniper's back hand steadies it (below).
  const rifle = classId === 'sniper' && anim?.weapon === 'rifle';
  // The Zealot's censer swings on its own chain through an attack (censerSwing.js).
  const censer = classId === 'zealot' && anim?.id === 'censer';
  if (placed) { const b = placed.back; draw('back', b[0], b[1] + pose.breathe, b[2], b[3], -pose.step * 0.2 - pose.charge * 0.35 + (censer ? censerBackTurn(anim.u, anim.calm) : 0), b[4], b[5], arms); }
  else if (!bow && !guns && !rifle) draw('back', -15, -10 + pose.breathe, 16, 12, -pose.step * 0.2 - pose.charge * 0.35, 12, 3, arms);
  // The painted body can blink, flinch and cheer (heroAnimArt.js).
  const [bx, by, bw, bh] = placed ? placed.body : [-21, -38, 42, 44];
  if (!drawAnimBody(ctx, classId, opts, bx, by + pose.breathe, bw, bh)) draw('body', bx, by + pose.breathe, bw, bh);
  if (anim) drawHeroArm(ctx, anim, 'front', -11 + pose.breathe);
  if (arms <= 0.001) return true;
  if (arms < 1) { ctx.save(); ctx.globalAlpha *= arms; }
  // An attack plays the painted wind-up, mid and follow-through arms in place
  // of the bow, the front pistol, the rifle or the staff.
  const kind = bow ? 'bow' : guns || classId === 'sniper' ? 'gun' : 'staff';
  const painted = anim?.kind === 'combat' && hasSwingArt(classId);
  const frame = painted ? swingPhase(anim.ch, 'main', kind) : null;
  const sh = SHOULDER[classId];
  if (censer && drawCenserSwing(ctx, image('weapon'), anim, placed.weapon[0], placed.weapon[1] + pose.breathe, placed.weapon[2], opts)) { /* drawn */ }
  else if (frame && !guns) drawSwingArm(ctx, classId, anim, 'main', kind, sh[0], sh[1] + pose.breathe);
  // With no weapon equipped the hand is empty: the painted bare arm.
  else if (opts.hasWeapon === false && drawEmptyArm(ctx, classId, 8, -12 + pose.breathe, 0.25 + pose.step * 0.3, 12)) { /* drawn */ }
  else if (guns) {
    const y = -12 + pose.breathe;
    if (opts.dualWield === true) {
      // The far pistol rests to the side. It turns through edge-on at the
      // shoulder, levels for its own shot, then settles back out of the face.
      const hit = HERO_CLIPS[anim?.id]?.hits?.[1];
      const aim = Number.isFinite(hit)
        ? smooth((anim.u - hit + 0.2) / 0.2) * (1 - smooth((anim.u - hit - 0.08) / 0.2))
        : anim ? 0 : Math.max(pose.draw, pose.release);
      const kick = anim ? pose.kick2 : pose.release;
      const x = -7 + aim * 6 - kick * 2;
      const by = y + 5 - aim * 2;
      const angle = 0.26 * (1 - aim) - kick * 0.3 + pose.step * 0.07;
      draw('back', x, by, 24, 12, angle, 2, 6, 1, aim * 2 - 1);
      if (kick > 0 && aim > 0.75) {
        const mx = x + Math.cos(angle) * 20.5 + Math.sin(angle) * 3;
        const my = by + Math.sin(angle) * 20.5 - Math.cos(angle) * 3;
        draw('action', mx, my, 13, 9, angle, 2, 4, kick);
      }
    }
    if (frame) drawSwingArm(ctx, classId, anim, 'main', kind, sh[0], sh[1] + pose.breathe);
    else {
      draw('weapon', 9.5 - pose.release * 1.5, y + 3.7, 14, 23, 0.24 + pose.draw - pose.release * 0.35 + pose.step * 0.09, 3, 21);
      draw('action', 27, y - 6, 16, 10, 0, 2, 5, pose.release);
    }
  } else if (bow) {
    const shortbow = classId === 'archer';
    // Guard also raises the bow in the gaps before and after a painted shot,
    // meeting the shoulder height at which those pictures hand off.
    const arc = painted && anim.ch.paint ? anim.ch.arc || 0 : 0;
    const handoff = Math.min(arc, 4 - arc) / 0.4;
    const raised = smooth(Math.max(handoff, pose.draw, pose.release * 0.8));
    const y = -11 + pose.breathe + (1 - raised) * 4.3;
    const angle = (0.37 + pose.step * 0.13) * (1 - raised);
    draw('weapon', 14, y, shortbow ? 21 : 22, shortbow ? 40 : 46, angle, 1.5, shortbow ? 23 : 25);
    // Both string ends and the nocked arrow turn with the bow. Only show the
    // arrow as it is drawn, leaving the idle silhouette clear of the face.
    const nock = (shortbow ? 9 : 10) - pose.draw * 9;
    ctx.save(); ctx.strokeStyle = '#f4e5bc'; ctx.lineWidth = 0.7;
    ctx.translate(14, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(shortbow ? 8 : 10, shortbow ? -21 : -23); ctx.lineTo(nock, 0); ctx.lineTo(10, shortbow ? 17 : 22); ctx.stroke();
    if (pose.draw > 0.04 && pose.release < 0.05) {
      ctx.strokeStyle = '#815b36'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nock - 3, 0); ctx.lineTo(nock + 25, 0); ctx.stroke();
      ctx.fillStyle = '#d8e1e6'; ctx.beginPath();
      ctx.moveTo(nock + 28, 0); ctx.lineTo(nock + 23, -2); ctx.lineTo(nock + 23, 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // The other hand hangs by the hip, then opens out towards the string.
    const drawn = swapOpacity(pose.draw);
    draw('back', -10, y, 15 + raised * 19, 11, (1 - raised) * (1.38 + pose.step * 0.18), 0, 5, 1 - drawn);
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
  } else if (placed) {
    // The orb is raised on the palm, the censer hangs from its chain: each is
    // lifted through the charge and swapped for the outstretched cast.
    const angle = -pose.charge * 0.35 + pose.step * 0.1;
    const cast = swapOpacity(pose.cast);
    const a = placed.weapon, k = placed.action;
    draw('weapon', a[0], a[1] + pose.breathe, a[2], a[3], angle, a[4], a[5], 1 - cast);
    draw('action', k[0], k[1] + pose.breathe, k[2], k[3], (1 - pose.cast) * 0.3, k[4], k[5], cast);
  } else {
    const angle = -pose.charge * 0.2 + pose.cast * 1.1 + pose.step * 0.12;
    const cast = swapOpacity(pose.cast);
    const staff = classId === 'wizard';   // the long staff's drawings are sized their own way
    draw('weapon', 14, -10 + pose.breathe, 20, staff ? 54 : 39, angle + (staff ? 0.56 : 0.3), staff ? 18 : 5, staff ? 45 : 33, 1 - cast);
    draw('action', 14, -10 + pose.breathe, staff ? 48 : 35, staff ? 16 : 13, (angle - 1.1) * 0.3, 4, 5, cast);
  }
  if (arms < 1) ctx.restore();
  return true;
}
