import { poseBlender, swapOpacity } from './poseBlend.js';
import { drawHeroArm, drawGripHand, armInFront } from './heroanim.js';
import { drawAnimBody, drawSwingArm, drawEmptyArm, hasSwingArt, swingPhase, offArmInFront } from './heroAnimArt.js';
import { heroLit } from './herolight.js';

// Painted hero rigs use separate limbs. Keep loading and animation
// here so the shared sprite library only needs one optional drawing hook.
export const HERO_RIG_PARTS = ['body', 'sword', 'back', 'left', 'right', 'strike'];
export const HERO_RIG_CLASSES = ['swordsman', 'rogue', 'samurai', 'corsair', 'paladin', 'knight', 'berserker', 'juggernaut', 'gladiator', 'lancer', 'brawler', 'halberdier', 'dancer', 'merchant', 'ninja', 'monk'];
// Rigs cut from a sheet with every part where it sits on the assembled hero
// (the Monk's, art pack sheet H7a), so each part is drawn at its own measured
// place, at rest exactly as painted: the body and boots as [x, y, w, h] and each
// arm as [shoulder x, y, w, h, pivot x, y], turning about its shoulder (the
// pivot inside the picture). All in game units, feet on the ground at y = 15.
const PLACED = {
  // (Redrawn on sheet MK-a: a round bean with its arms on its sides, the
  // knuckled fist forward at the waist and the gloved palm out at the hip.)
  monk: { body: [-19, -38, 38.1, 46], left: [-17.5, 1.2, 12.6, 13.8], right: [4.4, 1.2, 13, 13.8],
    sword: [12.4, -10.8, 20.7, 15.3, 3.4, 4.8], back: [-10.1, -10.8, 23.7, 15, 19.6, 6.8], strike: [13.5, -12.2, 23.2, 10.4, 3.8, 4.3] },
};
// Heavier weapons commit later; spears extend forward and whips sweep wider.
const ATTACKS = {
  corsair: { wind: 0.2, hit: 0.43, angle: 0.35, swing: 1.4, reach: 3 },
  paladin: { wind: 0.35, hit: 0.57, angle: 0.65, swing: 1.4, reach: 2 },
  knight: { wind: 0.3, hit: 0.53, angle: 0.4, swing: 0.8, reach: 7 },
  berserker: { wind: 0.42, hit: 0.65, angle: 0.9, swing: 1.7, reach: 3 },
  juggernaut: { wind: 0.45, hit: 0.68, angle: 1, swing: 1.9, reach: 2 },
  gladiator: { wind: 0.38, hit: 0.6, angle: 0.8, swing: 1.5, reach: 4 },
  lancer: { wind: 0.25, hit: 0.48, angle: 0.3, swing: 0.6, reach: 9 },
  halberdier: { wind: 0.4, hit: 0.64, angle: 0.75, swing: 1.4, reach: 6 },
  dancer: { wind: 0.28, hit: 0.52, angle: 0.55, swing: 1.8, reach: 6 },
  merchant: { wind: 0.3, hit: 0.5, angle: 0.5, swing: 1.2, reach: 2 },
  ninja: { wind: 0.15, hit: 0.35, angle: 0.6, swing: 1.6, reach: 4 },
};
// Two-handed weapons each class is painted holding: on these the back hand
// leaves its side and grips the handle below the front hand. For each, where
// the painted hand holds the weapon and where its tip points, as fractions
// across the raised (sword) and extended (strike) drawings, and how far the
// back hand may slide down the handle toward the body (a halberd's long shaft).
const GRIP = {
  samurai: { weapon: 'katana', sword: [0.38, 0.68, 0.08, 0.03], strike: [0.33, 0.55, 0.98, 0.2], slide: 4 },
  juggernaut: { weapon: 'warhammer', sword: [0.3, 0.52, 0.15, 0.12], strike: [0.33, 0.45, 0.9, 0.45], slide: 6 },
  gladiator: { weapon: '2h_sword', sword: [0.55, 0.62, 0.05, 0.03], strike: [0.33, 0.55, 0.98, 0.4], slide: 5 },
  halberdier: { weapon: 'halberd', sword: [0.3, 0.62, 0.35, 0.02], strike: [0.3, 0.55, 0.98, 0.4], slide: 20 },
};
// Where the weapon arm's shoulder is (the painted attack arms hang from it),
// and the off hand's for the dual wielders' second set.
const SHOULDER = { rogue: [15, -8], brawler: [14, -9], monk: [12.4, -10.8] };
// (The Monk's palm strikes from its own back shoulder, so the thrust carries across the body.)
const OFF_SHOULDER = { corsair: [-9, -10], rogue: [-11, -9], monk: [-10.1, -10.8] };
const images = new Map();
// Limb angles and reach ease across a restarted swing (see poseBlend.js).
const blendRig = poseBlender();
const RIG_BLEND = ['sword', 'back', 'strike', 'reach', 'strike2', 'reach2'];
export const heroRigSrc = (part, classId = 'swordsman') => `assets/creatures/hero/rig/${classId}-${part}.webp`;

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
    strike2: 0,
    reach2: 0,
  };
}

// Rogue follows through with the off hand only when two daggers are equipped.
// These timings are visual; combat still owns damage and attack speed.
export function heroRigPose(classId, gait, time, swing = -1, dualWield = false) {
  const pose = swordsmanPose(gait, time, swing);
  if (classId === 'swordsman') return pose;
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const active = swing >= 0 && swing <= 1;
  const pulse = (a, b, c) => active ? smooth((swing - a) / (b - a)) * (1 - smooth((swing - b) / (c - b))) : 0;
  if (classId === 'rogue') {
    const slash = pulse(0, 0.28, 0.62);
    const offhand = dualWield ? pulse(0.32, 0.65, 1) : 0;
    pose.sword = slash * 1.2 + pose.step * 0.18;
    pose.back = -offhand * 2.35 - pose.step * 0.32;
    pose.strike = slash;
  } else if (classId === 'samurai') {
    const wind = pulse(0, 0.36, 0.6);
    const cut = pulse(0.32, 0.58, 1);
    pose.sword = -wind * 0.8 + cut * 1.5 + pose.step * 0.09;
    pose.back = -wind * 0.18 + cut * 0.45 - pose.step * 0.2;
    pose.strike = cut;
  } else if (classId === 'brawler' || classId === 'monk') {
    // A punch, then a cross (the Monk's: knuckles, then the gloved palm).
    const punch = pulse(0, 0.25, 0.55), cross = pulse(0.3, 0.65, 1);
    pose.sword = punch * 0.8 + pose.step * 0.2;
    pose.back = -cross * 1.3 - pose.step * 0.3;
    pose.strike = punch;
    pose.reach = punch * 5;
  } else if (classId === 'lancer') {
    // A spear only pierces: no swinging arc at all. The spear levels into the
    // thrust at once, draws back a touch, drives straight forward, then returns.
    // Levelled for the whole attack: in at once, out only at the very end.
    const ready = active ? smooth(swing / 0.1) * (1 - smooth((swing - 0.82) / 0.18)) : 0;
    const draw = pulse(0, 0.28, 0.46);        // a short draw-back...
    const thrust = pulse(0.3, 0.5, 1);        // ...then the jab and recovery
    pose.sword = pose.step * 0.05;            // the upright spear never rotates
    pose.back = -pose.step * 0.2 + thrust * 0.25;
    pose.strike = ready;
    pose.reach = -draw * 4 + thrust * 13;     // toward the spear's point
  } else if (ATTACKS[classId]) {
    const profile = ATTACKS[classId];
    const wind = pulse(0, profile.wind, profile.hit);
    const strike = pulse(profile.wind * 0.75, profile.hit, 1);
    pose.sword = -wind * profile.angle + strike * profile.swing + pose.step * 0.12;
    pose.back = -pose.step * 0.2 + strike * (classId === 'paladin' ? 0.1 : 0.35);
    pose.strike = strike;
    pose.reach = strike * profile.reach;
  }
  return pose;
}

/** The class at rest with an animation clip's channels added on top: arm
 *  swings and strike swaps, a crouch (the body sinks, the feet stay planted)
 *  and lifted feet. Clips start and end at rest, so this meets the old pose. */
export function rigAnimPose(classId, opts, ch) {
  const pose = heroRigPose(classId, opts.gait, opts.time || 0, -1, opts.dualWield);
  pose.sword += ch.sword || 0;
  pose.back += ch.back || 0;
  pose.strike = Math.max(0, Math.min(1, ch.strike || 0));
  pose.reach = ch.reach || 0;
  pose.strike2 = Math.max(0, Math.min(1, ch.strike2 || 0));
  pose.reach2 = ch.reach2 || 0;
  pose.breathe += ch.crouch || 0;
  pose.liftF = Math.max(0, ch.liftF || 0);
  pose.liftB = Math.max(0, ch.liftB || 0);
  // Feet stay planted through a lunge: the back foot holds its ground as the
  // body drives forward (so the front foot steps in), the front one as it is
  // kicked back.
  pose.plantB = Math.max(0, ch.bx || 0) * 0.6;
  pose.plantF = Math.min(0, ch.bx || 0) * 0.6;
  return pose;
}

export function drawHeroRig(ctx, opts = {}) {
  const classId = opts.jobClass;
  if (!HERO_RIG_CLASSES.includes(classId) || typeof Image === 'undefined') return false;
  const key = (part) => `${classId}-${part}`;
  for (const part of HERO_RIG_PARTS) {
    if (!images.has(key(part))) {
      const img = new Image();
      img.src = heroRigSrc(part, classId);
      images.set(key(part), img);
    }
  }
  // Never show a partially assembled character, including on a failed load.
  if (HERO_RIG_PARTS.some((part) => !images.get(key(part)).complete || !images.get(key(part)).naturalWidth)) return false;
  // An animation clip (heroanim.js) acts on top of the class's rest pose;
  // without one, the class's own attack pose plays as before.
  const anim = opts.anim;
  const pose = anim ? rigAnimPose(classId, opts, anim.ch)
    : blendRig(opts.entity, heroRigPose(classId, opts.gait, opts.time || 0, opts.swingK ?? -1, opts.dualWield), opts.time || 0, opts.swingK ?? -1, RIG_BLEND);
  let shown = swapOpacity(pose.strike);
  // The off hand's own extended drawing (dual wielding, the claws' second paw).
  let shown2 = swapOpacity(pose.strike2 || 0);
  // Life skills put the painted arms away for mitten arms holding a tool.
  const arms = anim ? 1 - Math.min(1, anim.ch.mix) : 1;
  const draw = (part, x, y, w, h, angle = 0, px = 0, py = 0, opacity = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.globalAlpha *= opacity;
    ctx.drawImage(heroLit(images.get(key(part))), -px, -py, w, h);   // with its rim light (herolight.js)
    ctx.restore();
  };
  // Parts that are often fully hidden are skipped outright.
  const drawIf = (part, x, y, w, h, angle, px, py, opacity) => { if (opacity > 0.001) draw(part, x, y, w, h, angle, px, py, opacity); };
  // Boots tuck behind the tunic; their planted edges stay on the ground.
  const rogue = classId === 'rogue', samurai = classId === 'samurai';
  const brawler = classId === 'brawler', dancer = classId === 'dancer';
  const placed = PLACED[classId];
  const shield = classId === 'paladin' || classId === 'knight';
  const polearm = classId === 'lancer' || classId === 'halberdier';
  const broad = classId === 'berserker' || classId === 'juggernaut' || classId === 'gladiator';
  // A Corsair with a scimitar in each hand carries the second in the back hand
  // (and a Ninja with a shuriken in each hand, its second star).
  const corsairPair = (classId === 'corsair' || classId === 'ninja') && !!opts.dualWield;
  // A two-handed weapon the class is painted with: the back hand grips it too.
  const grip = anim && GRIP[classId] && anim.weapon === GRIP[classId].weapon ? GRIP[classId] : null;
  const bootY = rogue ? -1 : 2, bootH = rogue ? 16 : 13;
  const [lx, ly, lw, lh] = placed ? placed.left : [-10, bootY, 13, bootH], [rx, ry, rw, rh] = placed ? placed.right : [1, bootY, 13, bootH];
  draw('left', lx - pose.step * 1.5 - (pose.plantB || 0), ly - Math.max(0, pose.step) * 3 - (pose.liftB || 0), lw, lh);
  draw('right', rx + pose.step * 1.5 - (pose.plantF || 0), ry - Math.max(0, -pose.step) * 3 - (pose.liftF || 0), rw, rh);
  const pilot = classId === 'swordsman';
  const slim = classId === 'ninja' || classId === 'merchant';
  // Where the weapon arm's two drawings sit (the generic rigs).
  const w = broad ? 29 : polearm ? 24 : dancer ? 26 : 23;
  const h = polearm ? 57 : broad ? 46 : dancer ? 44 : 42;
  const y = -10 + pose.breathe;
  const sa = pose.sword + (samurai ? 0.25 : 0), spx = pilot || samurai ? 19 : w * 0.83, spy = pilot || samurai ? 37 : h * 0.88;
  const reach = pose.reach || 0;
  const kw = dancer ? 52 : polearm ? 55 : broad ? 44 : 37, kh = dancer ? 19 : broad ? 16 : 13;
  const ka = polearm ? -0.08 : (pose.sword - 1.25) * 0.3;
  // On a two-handed grip the back arm runs behind the body to the handle,
  // so only its fist shows, on the grip below the front hand.
  // Painted attack arms (heroAnimArt.js): this moment's wind-up, mid-swing or
  // follow-through picture replaces the turning arm, for either hand.
  const combat = anim && anim.kind === 'combat';
  const mk = combat && !anim.trail ? 'flourish' : 'melee';
  // A two-handed grip keeps the turning arm, so the back hand stays on the handle.
  const frame = combat && !grip && opts.hasWeapon !== false && hasSwingArt(classId) ? swingPhase(anim.ch, 'main', mk) : null;
  // The Monk's back hand wears its glove only when monk gloves are worn (the
  // renderer says so; the title's and the reflection's heroes keep the glove).
  const monk = classId === 'monk';
  const bareBack = monk && opts.dualWield === false && opts.hasShield === false;
  let offFrame = combat && OFF_SHOULDER[classId] && (classId !== 'corsair' || corsairPair) && !bareBack && hasSwingArt(classId, 'off') ? swingPhase(anim.ch, 'off') : null;
  // The Monk's painted palm wind-up hides behind the body, so through the
  // coil its own rig arm draws the glove back beside the hip instead.
  if (monk && offFrame === 'wind') offFrame = null;
  // Either side of its painted pictures (a clip's arc) an arm rests in the
  // rig's own guard, never a half-faded extended drawing as it comes back.
  if (combat && !grip && anim.ch.paint) {
    if (hasSwingArt(classId)) shown = 0;
    if (hasSwingArt(classId, 'off') && OFF_SHOULDER[classId]) shown2 = 0;
  }
  const sh = SHOULDER[classId] || [11, -10], osh = OFF_SHOULDER[classId];
  const hand = grip ? gripPoint(grip, shown, [11, y, w, h, sa, spx, spy], [11 + reach, y, kw, kh, ka, 4, 5], -4, -9 + pose.breathe) : null;
  if (hand) drawGripHand(ctx, classId, 'arm', -4, -9 + pose.breathe, hand[0], hand[1], arms);
  const backFront = anim && armInFront(classId);
  if (anim && !backFront) drawHeroArm(ctx, anim, 'back', -11 + pose.breathe);
  // A painted off arm (the Corsair's second scimitar, the Rogue's second
  // dagger) stays behind the body, clear of the face, except while it cuts.
  // The Monk's gloved palm has no blade to keep clear of the face: it swings
  // across the front of the body and is driven out in front of it.
  const offFront = !!offFrame && (monk || offArmInFront(anim.ch));
  // It passes in front of the knuckled arm too, whose fist is pulled down to
  // the hip meanwhile (chambered) and comes back up only once the palm has
  // drawn back, so the glove never lands on the knuckles.
  const offLast = offFront && monk;
  const arc2 = monk && combat && !bareBack ? anim.ch.arc2 || 0 : 0;
  const chamber = arc2 > 1 ? (arc2 <= 3.2 ? smoothstep(arc2 - 1) : 1 - smoothstep((arc2 - 3.2) / 0.4)) : 0;
  // A bare back hand hangs out at the side, coils back and, on its cross,
  // punches forward over the body.
  const bareCross = bareBack && combat && (anim.ch.strike2 || 0) > 0.3;
  const bareArm = () => faded(ctx, arms, () => drawEmptyArm(ctx, classId, placed.back[0], placed.back[1] + pose.breathe, -1.15 - pose.back * 1.6 - pose.step * 0.3, 13));
  const offArm = () => drawSwingArm(ctx, classId, anim, 'off', 'melee', osh[0] + (pose.reach2 || 0) * 0.4, osh[1] + pose.breathe, arms);
  if (offFrame && !offFront) offArm();
  else if (offFrame) { /* drawn over the body, below */ }
  else if (dancer) draw('back', -17, -9 + pose.breathe, 19, 25, pose.back, 16, 7, arms);
  else if (corsairPair) {
    // The second scimitar is the weapon arm drawn again on the back shoulder,
    // half behind the body, its blade tipped back; it swings forward over the
    // shoulder as the back arm does, and lunges out past the body on its strike.
    drawIf('sword', -9, -10 + pose.breathe, 21, 38, -pose.back * 0.8 - 0.55, 21 * 0.83, 38 * 0.88, (1 - shown2) * arms);
    drawIf('strike', -7 + (pose.reach2 || 0), -12 + pose.breathe, 37, 13, (-pose.back - 1.5) * 0.25, 4, 5, shown2 * arms);
  }
  // A bare back hand out at the side (over the body on its cross, below).
  else if (bareBack) { if (!bareCross) bareArm(); }
  // A placed rig's back arm turns about its own shoulder, behind the body (the
  // Monk's glove, held out at the hip, coils back and down beside it).
  else if (placed) { const b = placed.back; draw('back', b[0], b[1] + pose.breathe, b[2], b[3], -pose.back, b[4], b[5], arms); }
  // The Ninja and Merchant are slimmer, so their back hand sits closer in, half behind the body.
  // On a two-handed grip the back hand is on the handle instead (drawn below).
  else if (!rogue && !brawler) draw('back', pilot ? -12 : slim ? -5 : -17, -9 + pose.breathe, shield ? 20 : pilot ? 12 : 15, shield ? 29 : pilot ? 14 : 18, pose.back, shield ? 17 : pilot || samurai ? 5 : 10, shield ? 8 : 3, grip ? 0 : arms);
  // The painted body can blink, flinch and cheer (heroAnimArt.js).
  const [bx, by, bw, bh] = placed ? placed.body : [-21, -38, 42, 44];
  if (!drawAnimBody(ctx, classId, opts, bx, by + pose.breathe, bw, bh)) draw('body', bx, by + pose.breathe, bw, bh);
  // The Rogue's and the Brawler's back hands hold their own dagger and claw,
  // in front of the tunic; on an off-hand strike that arm swaps for its
  // extended drawing, lunging forward across the body.
  if (bareCross) bareArm();
  if (offFront && !offLast) offArm();
  else if (rogue && !offFrame) {
    draw('back', -14, -9 + pose.breathe, 22, 18, pose.back, 18, 3, (1 - shown2) * arms);
    drawIf('strike', -6 + (pose.reach2 || 0), -8 + pose.breathe, 26, 10, (-pose.back - 1.7) * 0.2, 4, 4, shown2 * arms);
  }
  if (brawler) {
    draw('back', -14, -9 + pose.breathe, 17, 26, -pose.back - 0.5, 14, 23, (1 - shown2) * arms);
    drawIf('strike', -7 + (pose.reach2 || 0), -8 + pose.breathe, 27, 12, 0, 4, 4, shown2 * arms);
  }
  if (backFront) drawHeroArm(ctx, anim, 'back', -11 + pose.breathe);
  if (anim) drawHeroArm(ctx, anim, 'front', -11 + pose.breathe);
  if (arms <= 0.001) return true;
  // Rotate around the shoulder, rather than rotating the whole portrait.
  // Short daggers sit outside the hood; the katana keeps its longer reach.
  if (frame) drawSwingArm(ctx, classId, anim, 'main', mk, sh[0] + reach * 0.4, sh[1] + pose.breathe, arms);
  // With no weapon equipped the hand is empty: the painted bare arm, punching on a strike.
  else if (opts.hasWeapon === false && drawEmptyArm(ctx, classId, sh[0] - 3 + reach * 0.5, sh[1] - 1 + pose.breathe, 0.25 + pose.step * 0.3 + pose.strike * 1.3, 12)) { /* drawn */ }
  else if (rogue) {
    draw('sword', 15, -8 + pose.breathe, 17, 30, pose.sword + 0.7, 14, 27, (1 - shown) * arms);
    draw('strike', 15 + (pose.reach || 0), -8 + pose.breathe, 26, 10, (pose.sword - 1.2) * 0.3, 4, 4, shown * arms);
  } else if (brawler) {
    draw('sword', 14, -9 + pose.breathe, 17, 26, pose.sword + 0.5, 13, 23, (1 - shown) * arms);
    draw('strike', 14 + pose.reach, -9 + pose.breathe, 27, 12, 0, 4, 4, shown * arms);
  } else if (placed) {
    const a = placed.sword, k = placed.strike;
    draw('sword', a[0], a[1] + pose.breathe, a[2], a[3], pose.sword + chamber * 0.9, a[4], a[5], (1 - shown) * arms);
    draw('strike', k[0] + reach, k[1] + pose.breathe, k[2], k[3], (pose.sword - 0.8) * 0.3, k[4], k[5], shown * arms);
  } else {
    draw('sword', 11, y, w, h, sa, spx, spy, (1 - shown) * arms);
    draw('strike', 11 + reach, y, kw, kh, ka, 4, 5, shown * arms);
    if (hand) drawGripHand(ctx, classId, 'fist', 0, 0, hand[0], hand[1], arms);
  }
  if (offLast) offArm();
  return true;
}

/** fn() drawn at opacity a (on top of the canvas's own). */
function faded(ctx, a, fn) { ctx.save(); ctx.globalAlpha *= a; const r = fn(); ctx.restore(); return r; }
const smoothstep = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
/** Where a point (fx, fy across a picture) lands once the picture is drawn at
 *  x, y, w x h, turned by angle about its pivot px, py. */
function partPoint(fx, fy, [x, y, w, h, angle, px, py]) {
  const lx = fx * w - px, ly = fy * h - py, c = Math.cos(angle), s = Math.sin(angle);
  return [x + lx * c - ly * s, y + lx * s + ly * c];
}
/** The back hand on a two-handed grip: just below the front hand along the
 *  handle (between the raised and the extended drawing as they swap), slid
 *  down it toward the body when the front hand is out of an arm's reach. */
function gripPoint(g, shown, swordAt, strikeAt, sx, sy) {
  const mix = (a, b) => [a[0] + (b[0] - a[0]) * shown, a[1] + (b[1] - a[1]) * shown];
  const hand = mix(partPoint(g.sword[0], g.sword[1], swordAt), partPoint(g.strike[0], g.strike[1], strikeAt));
  const tip = mix(partPoint(g.sword[2], g.sword[3], swordAt), partPoint(g.strike[2], g.strike[3], strikeAt));
  let dx = hand[0] - tip[0], dy = hand[1] - tip[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const REACH = 17;   // the back arm's length, shoulder to fist
  let gx = hand[0] + dx * 3.5, gy = hand[1] + dy * 3.5;
  for (let s = 3.5; s < g.slide && Math.hypot(gx - sx, gy - sy) > REACH; s += 2) { gx = hand[0] + dx * s; gy = hand[1] + dy * s; }
  const d = Math.hypot(gx - sx, gy - sy);
  if (d > REACH) { gx = sx + (gx - sx) * REACH / d; gy = sy + (gy - sy) * REACH / d; }
  return [gx, gy];
}
