// Painted animation parts for the hero rigs (assets/creatures/hero/anim/),
// cut from the designer's animation pack and laid over the rigs' own limbs:
// - faces: the rig body redrawn neutral, hurt (a flinch), blinking and in
//   victory (a level-up or a boss kill). Each is on the rig body's own
//   canvas grown by FACE_PAD on every side, so it drops straight in.
// - swing / off: three painted weapon arms per attack, wind-up, mid-swing and
//   follow-through, played in place of the rotated single arm; `off` is the
//   off hand's set for dual wielders (the Corsair's second scimitar, the
//   Rogue's second dagger).
// - back: the hero seen from behind, for walking up the screen.
// - hand: an empty-hand arm, for life skills (it holds the tool) and for a
//   hero with no weapon equipped.
// Every picture size is in game units. An arm is [w, h, px, py]: its size and
// the shoulder (the pivot) inside it; a back-view part is [x, y, w, h] from
// the hero's feet (the off arm, which hangs from its shoulder, is [shoulder
// x, y, w, h, then the shoulder and the fist in the picture]); a hand is
// [w, h, shoulder x, y, fist x, y].
// Without Image (headless tests) nothing loads and every helper returns
// false or null, so the rigs draw exactly as before; a set is only used once
// all of its pictures have loaded, never half assembled.

export const ANIM_ART = {
  swordsman: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [24.7, 31.5, 8.3, 27.6], mid: [33.7, 24.7, 4.4, 5.1], follow: [41, 24.3, 4.8, 5.7] }, back: { body: [-17.5, -33.4, 34.7, 37.3], other: [1.9, -4.3, 21.2, 19.5, 18, 3.8, 3.3, 16], arm: [-7.3, -37.9, 28.3, 38.3], strike: [-6.8, -22.1, 41.2, 23.2] }, hand: [11, 12, 8.7, 1.6, 1.9, 10.3] },
  rogue: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [19.8, 24, 9, 21.3], mid: [28, 13.7, 3.1, 4.5], follow: [27.5, 19.8, 3.5, 4.1] }, off: { wind: [22.3, 22.5, 3.2, 16.7], mid: [27.3, 13.7, 2.8, 5.4], follow: [26.3, 14.3, 3, 4.3] }, back: { body: [-16.7, -34.8, 34, 38.2], other: [11.3, -17.2, 18.7, 18.5, 2.8, 2.7, 15.4, 15.2], arm: [-15.1, -37.9, 26, 24.8], strike: [-14.6, -20.8, 24, 21.3] }, hand: [10.7, 12.2, 1.9, 1.6, 8.9, 10.1] },
  samurai: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [20.8, 35.3, 15.3, 31.6], mid: [37, 25.7, 4.3, 6.9], follow: [43.7, 20.8, 4.8, 6.9] }, back: { body: [-12.9, -34.6, 27.5, 39.7], other: [-3.2, -1.5, 14.5, 11.8, 1.7, 3.4, 12.8, 7.5], arm: [0.6, -27.1, 21.2, 29.3], strike: [1.4, -6.8, 32.5, 13.8] }, hand: [11.5, 11.2, 1.6, 1.8, 9.7, 9.3] },
  corsair: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [25.8, 35.5, 20.3, 31.7], mid: [36.3, 27.5, 2.6, 19.8], follow: [43.5, 19.8, 3.7, 4.8] }, off: { wind: [26.5, 33.5, 5.1, 29.7], mid: [34.8, 25.3, 4.2, 20.5], follow: [42.2, 14, 4.4, 5.2] }, back: { body: [-14.9, -37.8, 29.8, 43.7], other: [-4.6, -10.6, 19.8, 14.2, 1.9, 4.3, 17.3, 9.4], arm: [-0.4, -36.9, 21.3, 29.8], strike: [1.2, -21.6, 29.8, 16.8] }, hand: [11.2, 11.2, 9.6, 1.6, 1.8, 9.3] },
  paladin: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [35.7, 29.3, 32.2, 26.1], mid: [35.3, 23.2, 2.7, 6.7], follow: [41.3, 24, 4.7, 5.5] }, back: { body: [-16.3, -37.8, 32.5, 43.7], other: [-8, -24.4, 15.2, 18.2, 11, 2.1, 3, 15.5], arm: [-9.3, -28.6, 23.8, 34.2], strike: [-23.8, -30.6, 35.8, 20.3] }, hand: [10.5, 11.8, 8.8, 1.5, 1.9, 10.1] },
  knight: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [24.7, 28.3, 21.3, 19.5], mid: [38.5, 23.3, 4.6, 5.7], follow: [42.3, 22.2, 4.9, 6.1] }, back: { body: [-13.8, -37.8, 27.7, 43.7], other: [-5.6, -4.2, 19.2, 22.2, 15.4, 2.6, 6.5, 18.8], arm: [1.6, -33.4, 19.3, 33], strike: [1.8, -14.8, 34.8, 17.3] }, hand: [11.5, 11.8, 2.1, 1.8, 9.3, 10.1] },
  berserker: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [44.5, 44.3, 20.9, 41], mid: [53.2, 30.3, 4.2, 23.9], follow: [52.7, 31.3, 4.2, 7.4] }, back: { body: [-19.1, -37.8, 38.2, 43.7], other: [-6.2, -31.9, 20.3, 23, 16.8, 2.9, 4, 19.4], arm: [-21.4, -36.7, 41, 44], strike: [-0.4, -43, 44.7, 33.7] }, hand: [10.8, 11.8, 2, 1.5, 8.9, 10] },
  juggernaut: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [37, 41.5, 16.4, 37.2], mid: [48.3, 30.3, 3.5, 8.2], follow: [53.2, 29.2, 4.1, 8.1] }, back: { body: [-15.5, -37.8, 31, 43.7], other: [17, -20.8, 17.5, 27.7, 11.8, 2.6, 4.5, 24.5], arm: [-21, -34, 39.2, 28.3], strike: [-44.7, -46.7, 35.8, 31.2] }, hand: [11.5, 12.3, 2.8, 1.8, 9.3, 10.6] },
  gladiator: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [27, 42, 11, 37.5], mid: [47.3, 28.2, 5.6, 6.3], follow: [49.3, 26.7, 5.7, 6] }, back: { body: [-16.3, -37.8, 32.5, 43.7], other: [-5.4, -9.1, 24.2, 18.2, 2.1, 6.3, 21.3, 9.2], arm: [1.1, -38.3, 32.2, 34], strike: [0.7, -17.2, 45.7, 15.7] }, hand: [11.5, 11.7, 2.1, 1.8, 9.7, 9.8] },
  lancer: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [55, 46.7, 7.7, 36.9], mid: [57.2, 41.8, 7.3, 7.5], follow: [66.2, 30.5, 6.7, 12] }, back: { body: [-16.7, -37.8, 33.3, 43.7], other: [-0.6, 0.9, 20.2, 20, 4.6, 3.2, 16.5, 16.7], arm: [-4.1, -31.6, 43.2, 38.5], strike: [-5.5, -9.9, 59.8, 18.3] }, hand: [11.5, 11.2, 1.8, 1.6, 9.5, 9.4] },
  brawler: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [17.8, 21.5, 3.2, 18.8], mid: [22.7, 20, 2.8, 16.6], follow: [29.5, 21.2, 3.4, 17.2] }, back: { body: [-24.1, -37.8, 48.2, 43.7], other: [-0.5, -3.8, 27.8, 29.8, 5.3, 4.7, 22.8, 25.3], arm: [-18.2, -37, 31.8, 37.2], strike: [-5, -12.3, 43.7, 33] }, hand: [11.5, 11.3, 1.9, 1.5, 9.5, 9.5] },
  halberdier: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [36.3, 40.8, 9.4, 28.2], mid: [58, 33.2, 6.4, 7.9], follow: [64.3, 33, 7.1, 8.3] }, back: { body: [-15.6, -37.8, 31.2, 43.7], other: [-16.1, -35.8, 15.3, 15.7, 3, 2.6, 12.7, 12.9], arm: [1, -41.6, 22.2, 48.3], strike: [11.8, -58.9, 40, 26.7] }, hand: [11.7, 11.8, 2.2, 1.8, 9.5, 10.1] },
  dancer: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [32.2, 42.5, 12.1, 36], mid: [40.7, 34.8, 7.4, 25.9], follow: [62.7, 33.3, 8.8, 22.9] }, back: { body: [-20, -37.8, 40, 43.7], other: [-13.8, -26.6, 22.7, 14.3, 2.2, 3.5, 19.8, 4.5], arm: [-25.5, -33.2, 47.5, 39.2], strike: [-30.6, -33.9, 49.2, 18.7] }, hand: [11, 10.8, 9.6, 1.5, 1.7, 9.2] },
  merchant: { faces: ['hurt', 'blink', 'victory'], swing: { wind: [24.7, 26.8, 3.8, 22.9], mid: [35.3, 20.8, 3.7, 4.7], follow: [44.2, 13.2, 4.3, 4.8] }, back: { body: [-11.3, -37.6, 22.5, 43.2], other: [4.8, 3.9, 14.7, 23.7, 11.2, 2.3, 4.4, 20.8], arm: [-8.1, -19.3, 19.3, 26.2], strike: [-8.6, -0.1, 26.8, 25] }, hand: [6.7, 13.8, 2.4, 1.2, 1.7, 12.2] },
  ninja: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [22, 33.8, 5.2, 30.4], mid: [34.8, 26.5, 4.4, 5], follow: [39.7, 28, 4.9, 5.2] }, back: { body: [-14.2, -37.6, 28.3, 43.2], other: [2.2, 2.2, 13.7, 18.3, 2.7, 1.9, 9.5, 15.9], arm: [-16.9, -19.1, 18.5, 24.2], strike: [-5.3, -11.2, 29, 18.7] }, hand: [11.2, 12.8, 3.6, 1.4, 9, 11] },
  archer: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [25.3, 42.2, 3, 24.7], mid: [35.8, 42.3, 4.3, 24.9], follow: [33.8, 40.5, 4, 24.1] }, back: { body: [-13.5, -37.8, 26.8, 43.7], other: [3.8, -9.6, 16.5, 13, 1.9, 4.2, 14.3, 9.7], arm: [-10.7, -36.9, 17.3, 30.7], strike: [-15, -31.8, 23.5, 25] }, hand: [12, 10.5, 1.6, 1.9, 10.3, 8.6] },
  ranger: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [24.7, 43.8, 3, 24.5], mid: [31.5, 43.5, 3.9, 24.3], follow: [30.7, 43.8, 3.7, 24.5] }, back: { body: [-13.4, -33.8, 25.7, 38], other: [-6.9, -7.3, 15.7, 9.2, 1.3, 4.9, 14, 4.4], arm: [-0.5, -42.2, 14.7, 39.5], strike: [-11.6, -42.2, 29.7, 39.5] }, hand: [12, 10.8, 1.5, 1.9, 10.3, 8.5] },
  wizard: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [34.7, 37, 4.9, 30.1], mid: [46.2, 29.7, 5.2, 21.6], follow: [56.8, 26.5, 4.1, 18.4] }, back: { body: [-14.3, -37.8, 28.7, 43.7], other: [5, -5.5, 15.2, 15.3, 12.8, 2.2, 2.7, 12], arm: [-8.3, -31.8, 21.5, 32.3], strike: [-31.8, -23.2, 31, 22.2] }, hand: [11, 11.7, 1.7, 1.6, 9.1, 9.8] },
  sorcerer: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [28, 31, 4.5, 26.7], mid: [36.3, 25.3, 4.2, 19.6], follow: [41.5, 19.3, 4.4, 13.1] }, back: { body: [-16.8, -36.6, 33.3, 39.8], other: [-13.9, -35.2, 22, 19.2, 2.3, 3.3, 17.7, 12.2], arm: [0.5, -39.8, 22.2, 40.7], strike: [-18, -43.4, 36, 30.7] }, hand: [11.7, 11.8, 1.7, 1.7, 8.9, 10] },
  pistoler: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [19.3, 19.8, 2.9, 16.9], mid: [24.5, 12.5, 2.5, 9.2], follow: [24.5, 17, 2.8, 13.8] }, back: { body: [-11.7, -37.6, 23.2, 43.2], arm: [-8.3, -25.9, 25, 31.2], strike: [-35.3, -11.9, 35.3, 18.5] }, hand: [10.3, 12.5, 2, 1.5, 7.9, 10.8] },
  sniper: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [31.5, 26.7, 3.8, 21.8], mid: [34.8, 14.3, 4.1, 9.1], follow: [36.5, 24.5, 4.3, 19] }, back: { body: [-11.9, -37.6, 23.7, 43.2], other: [-3.3, -10.5, 18.3, 14.3, 1.7, 4.1, 16, 7.7], arm: [-29.5, -21.2, 36.7, 18], strike: [-37, -21.2, 45, 18] }, hand: [10.8, 12.3, 1.9, 1.6, 8.3, 10.6] },
};

export const FACE_PAD = 0.1;
export const animArtSrc = (name) => `assets/creatures/hero/anim/${name}.webp`;

/** Every picture this registry draws (the lock-step test checks the files). */
export function heroAnimFiles() {
  const out = [];
  for (const [cls, a] of Object.entries(ANIM_ART)) {
    for (const f of a.faces || []) out.push(`${cls}_${f}`);
    if (a.swing) for (const k of ['wind', 'mid', 'follow']) out.push(`${cls}_${k}`);
    if (a.off) for (const k of ['wind', 'mid', 'follow']) out.push(`${cls}_off${k}`);
    if (a.back) {
      out.push(`${cls}_backbody`, `${cls}_backarm`, `${cls}_backstrike`, `${cls}_backfootl`, `${cls}_backfootr`);
      if (a.back.other) out.push(`${cls}_backother`);
    }
    if (a.hand) out.push(`${cls}_hand`);
  }
  return out;
}

const _img = new Map();
function image(name) {
  let img = _img.get(name);
  if (img === undefined) {
    if (typeof Image === 'undefined') { _img.set(name, null); return null; }
    img = new Image();
    img.src = animArtSrc(name);
    _img.set(name, img);
  }
  return img;
}
const loaded = (img) => !!img && img.complete && img.naturalWidth > 0;
// The first time a class is drawn, all of its pictures start loading at
// once, so the first swing, blink or walk up the screen is ready when it comes.
const _warm = new Set();
function warm(classId) {
  if (_warm.has(classId)) return;
  _warm.add(classId);
  const pre = `${classId}_`;
  for (const name of heroAnimFiles()) if (name.startsWith(pre)) image(name);
}
/** The named pictures, or null until every one of them has loaded. */
function set(names) {
  let ok = true;
  const out = names.map((n) => { const i = image(n); if (!loaded(i)) ok = false; return i; });
  return ok ? out : null;
}

// ---------------- Faces: neutral, hurt, blink, victory ----------------
const BLINK_EVERY = 3400, BLINK_MS = 130;
/** Which body picture shows now: hurt while the hit flash lasts, victory
 *  through the cheer clip, a blink for a moment every few seconds. */
export function faceState(opts = {}) {
  if (opts.hurt > 0) return 'hurt';
  if (opts.anim?.id === 'cheer') return 'victory';
  const t = opts.time || 0;
  if (!opts.anim?.low && t % BLINK_EVERY < BLINK_MS) return 'blink';
  return 'body';
}
/** Draw the class's painted body for this moment in place of the rig body
 *  (drawn at x, y, w, h). False when the class has no faces, or they aren't loaded. */
export function drawAnimBody(ctx, classId, opts, x, y, w, h) {
  const a = ANIM_ART[classId];
  if (!a || !a.faces) return false;
  warm(classId);
  const pics = set(a.faces.map((f) => `${classId}_${f}`));
  if (!pics) return false;
  let i = a.faces.indexOf(faceState(opts));
  // The Merchant has no neutral picture of its own: its rig body stands in.
  if (i < 0) return false;
  ctx.drawImage(pics[i], x - w * FACE_PAD, y - h * FACE_PAD, w * (1 + 2 * FACE_PAD), h * (1 + 2 * FACE_PAD));
  return true;
}

// ---------------- Attack arms: wind-up, mid-swing, follow-through ----------------
/** Which painted arm an attack clip's channels call for, or null at rest.
 *  `hand` is 'main' or 'off'; `kind` the rig's weapon family. */
export function swingPhase(ch, hand = 'main', kind = 'melee') {
  if (!ch) return null;
  if (kind === 'bow') {
    if (ch.release > 0.05) return 'follow';
    if (ch.draw > 0.05) return ch.draw < 0.55 ? 'wind' : 'mid';
    return null;
  }
  if (kind === 'staff') {
    if (ch.cast > 0.2) return 'follow';
    if (ch.charge > 0.08) return ch.charge < 0.6 ? 'wind' : 'mid';
    return null;
  }
  if (kind === 'gun') {
    // The rifle rises, holds its aim, then fires (the firing picture carries
    // the flash); a pistol rises, levels and kicks.
    if (ch.release > 0.05) return 'follow';
    if (ch.draw > 0.1) return ch.draw < 0.85 ? 'wind' : 'mid';
    return null;
  }
  // A flourish with no swoosh (the Merchant's cane) goes by the arm's turn alone.
  if (kind === 'flourish') return -ch.sword > 0.12 ? 'wind' : ch.sword > 0.4 ? 'follow' : ch.sword > 0.1 ? 'mid' : null;
  const strike = hand === 'off' ? ch.strike2 : ch.strike;
  const trail = hand === 'off' ? ch.trail2 : ch.trail;
  const coil = hand === 'off' ? ch.back : -ch.sword;
  // A thrust holds its extended drawing the whole way, so its reach tells
  // the draw-back from the jab.
  const reach = hand === 'off' ? ch.reach2 : ch.reach;
  if (strike > 0.5) return trail > 0.02 || reach >= 6 ? 'follow' : reach < -0.5 ? 'wind' : 'mid';
  if (trail > 0.02 && trail < 0.98) return 'mid';
  if (coil > 0.12) return 'wind';
  return null;
}
/** Draw this attack's painted arm with its shoulder at (sx, sy). False when
 *  there is no frame for this moment (rest) or the set hasn't loaded. */
export function drawSwingArm(ctx, classId, ch, hand, kind, sx, sy, alpha = 1) {
  const a = ANIM_ART[classId];
  const frames = a && (hand === 'off' ? a.off : a.swing);
  if (!frames) return false;
  const phase = swingPhase(ch, hand, kind);
  if (!phase) return false;
  const pre = hand === 'off' ? 'off' : '';
  const pics = set(['wind', 'mid', 'follow'].map((k) => `${classId}_${pre}${k}`));
  if (!pics) return false;
  const [w, h, px, py] = frames[phase];
  if (alpha < 1) { ctx.save(); ctx.globalAlpha *= alpha; }
  ctx.drawImage(pics[['wind', 'mid', 'follow'].indexOf(phase)], sx - px, sy - py, w, h);
  if (alpha < 1) ctx.restore();
  return true;
}
/** Does this class have painted attack arms ready (for the off hand too)? */
export function hasSwingArt(classId, hand = 'main') {
  const a = ANIM_ART[classId];
  if (!a || !(hand === 'off' ? a.off : a.swing)) return false;
  const pre = hand === 'off' ? 'off' : '';
  return !!set(['wind', 'mid', 'follow'].map((k) => `${classId}_${pre}${k}`));
}

// ---------------- Back view ----------------
/** Is the hero facing up the screen (away from the camera)? */
export function facingAway(opts = {}) {
  const f = opts.facing;
  return !!f && f.dy < 0 && !f.dx;
}
/** The hero from behind: feet stepping in turn, the body, the off arm and the
 *  weapon arm, which swaps for its striking picture through an attack.
 *  False when the class has no back view or it hasn't loaded. */
export function drawHeroBack(ctx, opts = {}) {
  const classId = opts.jobClass;
  const a = ANIM_ART[classId];
  if (!a || !a.back || !facingAway(opts)) return false;
  const anim = opts.anim;
  // Life skills turn to their work with tool arms, which have no back view.
  if (anim && anim.ch.mix > 0.01) return false;
  const b = a.back;
  const names = ['backbody', 'backarm', 'backstrike', 'backfootl', 'backfootr', ...(b.other ? ['backother'] : [])];
  const pics = set(names.map((n) => `${classId}_${n}`));
  if (!pics) return false;
  const [body, arm, strike, footL, footR, other] = pics;
  const g = opts.gait || {};
  const move = Math.max(0, Math.min(1, g.move || 0));
  const step = Math.sin((g.phase || 0) * Math.PI) * move;
  const ch = anim?.ch;
  const breathe = Math.sin((opts.time || 0) * 0.0032) * 0.35 * (1 - move) + (ch?.crouch || 0);
  // Feet where the front view has them, the soles showing as each lifts.
  const foot = (img, x, lift) => {
    const w = 12, h = w * img.naturalHeight / img.naturalWidth;
    ctx.drawImage(img, x, 15 - h - lift, w, h);
  };
  foot(footL, -10 - step * 1.5, Math.max(0, step) * 3 + (ch?.liftB || 0));
  foot(footR, 1 + step * 1.5, Math.max(0, -step) * 3 + (ch?.liftF || 0));
  const put = (img, r, dy = 0) => ctx.drawImage(img, r[0], r[1] + breathe + dy, r[2], r[3]);
  put(body, b.body);
  if (other) {
    // The off arm hangs from its shoulder, a little out from the body, and swings as the hero walks.
    const [sx, sy, w, h, px, py, fx, fy] = b.other;
    const natural = Math.atan2(fy - py, fx - px);
    const want = Math.PI / 2 + (sx < b.body[0] + b.body[2] / 2 ? 0.2 : -0.2) + step * 0.25;
    ctx.save(); ctx.translate(sx, sy + breathe); ctx.rotate(want - natural);
    ctx.drawImage(other, -px, -py, w, h);
    ctx.restore();
  }
  const hit = ch ? (ch.strike > 0.5 || ch.release > 0.05 || ch.cast > 0.2 || ch.strike2 > 0.5) : (opts.swingK ?? -1) >= 0.4;
  put(hit ? strike : arm, hit ? b.strike : b.arm, step * 0.6);
  return true;
}

// ---------------- Empty-hand arms ----------------
/** Draw the class's painted empty-hand arm from the shoulder (sx, sy), turned
 *  to angle phi (0 hanging down, + swinging forward), `len` units from
 *  shoulder to fist. Returns the fist's position, or null when the class has
 *  no hand picture (or it hasn't loaded yet). */
export function drawEmptyArm(ctx, classId, sx, sy, phi, len = 10) {
  const a = ANIM_ART[classId];
  if (!a || !a.hand) return null;
  const img = image(`${classId}_hand`);
  if (!loaded(img)) return null;
  const [w, h, ax, ay, fx, fy] = a.hand;
  const natural = Math.atan2(fy - ay, fx - ax);          // shoulder to fist in the picture
  const want = Math.atan2(Math.cos(phi), Math.sin(phi)); // down is +y
  const k = len / (Math.hypot(fx - ax, fy - ay) || 1);
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(want - natural); ctx.scale(k, k);
  ctx.drawImage(img, -ax, -ay, w, h);
  ctx.restore();
  return [sx + Math.sin(phi) * len, sy + Math.cos(phi) * len];
}
export function hasEmptyArm(classId) {
  const a = ANIM_ART[classId];
  return !!(a && a.hand && loaded(image(`${classId}_hand`)));
}
