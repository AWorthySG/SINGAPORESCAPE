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
// Every picture size is in game units. An arm is [w, h, px, py], with optional
// blade tip [tx, ty] after the shoulder pivot. A back-view part is [x, y, w, h]
// from the hero's feet. For a pivoted rear sword, `weaponShoulder` locates the
// joint and `arm` / `strike` give [w, h, px, py, angle]. The rear off arm uses
// [shoulder x, y, w, h, then its image shoulder and fist]; a hand is
// [w, h, shoulder x, y, fist x, y]. A class may say where its back view's
// feet stand (`backFeet`: [left x, right x, width]); otherwise they sit where
// most heroes' do.
// Without Image (headless tests) nothing loads and every helper returns
// false or null, so the rigs draw exactly as before; a set is only used once
// all of its pictures have loaded, never half assembled. Each is drawn with
// its rim light (herolight.js).

import { clamp, lerp } from '../core/utils.js';
import { classAccent } from '../data/classColours.js';
import { heroLit } from './herolight.js';
import { heroWalk } from './motionkit.js';

// Centres of the Brawler's visible sleeve openings in the side-on torso.
// Guard, strike and work arms all turn around these same joints.
export const BRAWLER_SHOULDERS = { front: [18.5, -9], back: [-8.4, -11.1] };

export const ANIM_ART = {
  swordsman: {
    faces: ['body', 'hurt', 'blink', 'victory'],
    swing: { wind: [24.7, 31.5, 8.3, 27.6, 23.5, 1], mid: [33.7, 24.7, 4.4, 5.1, 32.5, 23.4], follow: [41, 24.3, 4.8, 5.7, 40, 22] },
    back: {
      body: [-17.5, -33.4, 34.7, 37.3],
      other: [11.8, -11.2, 16.5, 15.2, 11.4, 3.9, 4.2, 11.6],
      buckler: [11.8, -11.2, 20, 18.7, 15.5, 3.4, 7.8, 12.7],
      weaponShoulder: [-5.6, -12],
      arm: [28.3, 38.3, 6.7, 31.5, -1.03],
      strike: [41.2, 23.2, 7.5, 17.5, 0],
    },
    hand: [11, 12, 8.7, 1.6, 1.9, 10.3],
  },
  rogue: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [19.8, 24, 9, 21.3], mid: [28, 13.7, 3.1, 4.5], follow: [27.5, 19.8, 3.5, 4.1] }, off: { wind: [22.3, 22.5, 3.2, 16.7], mid: [27.3, 13.7, 2.8, 5.4], follow: [26.3, 14.3, 3, 4.3] }, back: { body: [-16.7, -34.8, 34, 38.2], other: [11.3, -17.2, 18.7, 18.5, 2.8, 2.7, 15.4, 15.2], arm: [-15.1, -37.9, 26, 24.8], strike: [-14.6, -20.8, 24, 21.3] }, hand: [10.7, 12.2, 1.9, 1.6, 8.9, 10.1] },
  samurai: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [20.8, 35.3, 15.3, 31.6], mid: [37, 25.7, 4.3, 6.9], follow: [43.7, 20.8, 4.8, 6.9] }, back: { body: [-12.9, -34.6, 27.5, 39.7], other: [-3.2, -1.5, 14.5, 11.8, 1.7, 3.4, 12.8, 7.5], arm: [0.6, -27.1, 21.2, 29.3], strike: [1.4, -6.8, 32.5, 13.8] }, hand: [11.5, 11.2, 1.6, 1.8, 9.7, 9.3] },
  corsair: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [25.8, 35.5, 20.3, 31.7], mid: [36.3, 27.5, 2.6, 19.8], follow: [43.5, 19.8, 3.7, 4.8] }, off: { wind: [26.5, 33.5, 5.1, 29.7], mid: [34.8, 25.3, 4.2, 20.5], follow: [42.2, 14, 4.4, 5.2] }, back: { body: [-14.9, -37.8, 29.8, 43.7], other: [-4.6, -10.6, 19.8, 14.2, 1.9, 4.3, 17.3, 9.4], arm: [-0.4, -36.9, 21.3, 29.8], strike: [1.2, -21.6, 29.8, 16.8] }, hand: [11.2, 11.2, 9.6, 1.6, 1.8, 9.3] },
  paladin: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [35.7, 29.3, 32.2, 26.1], mid: [35.3, 23.2, 2.7, 6.7], follow: [41.3, 24, 4.7, 5.5] }, back: { body: [-16.3, -37.8, 32.5, 43.7], other: [-8, -24.4, 15.2, 18.2, 11, 2.1, 3, 15.5], arm: [-9.3, -28.6, 23.8, 34.2], strike: [-23.8, -30.6, 35.8, 20.3] }, hand: [10.5, 11.8, 8.8, 1.5, 1.9, 10.1] },
  knight: {
    faces: ['body', 'hurt', 'blink', 'victory'],
    swing: { wind: [24.7, 28.3, 8.34, 21.31, 1.17, 1], mid: [38.5, 23.3, 5.83, 4.33, 36.5, 20.5], follow: [42.3, 22.2, 5.83, 5, 40.3, 18.9] },
    back: { body: [-13.8, -37.8, 27.7, 43.7], other: [-5.8, -11.9, 19.2, 22.2, 13.9, 4.17, 13.36, 12.86],
      arm: [3.6, -36.8, 19.3, 33], strike: [3.67, -19.8, 34.8, 17.3], joint: [9.6, -11.8] },
    hand: [11.5, 11.8, 2.1, 1.8, 9.3, 10.1],
  },
  berserker: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [44.5, 44.3, 20.9, 41], mid: [53.2, 30.3, 4.2, 23.9], follow: [52.7, 31.3, 4.2, 7.4] }, back: { body: [-19.1, -37.8, 38.2, 43.7], other: [-6.2, -31.9, 20.3, 23, 16.8, 2.9, 4, 19.4], arm: [-21.4, -36.7, 41, 44], strike: [-0.4, -43, 44.7, 33.7] }, hand: [10.8, 11.8, 2, 1.5, 8.9, 10] },
  juggernaut: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [37, 41.5, 16.4, 37.2], mid: [48.3, 30.3, 3.5, 8.2], follow: [53.2, 29.2, 4.1, 8.1] }, back: { body: [-15.5, -37.8, 31, 43.7], other: [-2.4, -11.9, 17.5, 27.7, 11.8, 2.6, 4.5, 24.5], arm: [-21, -34, 39.2, 28.3], strike: [-1.2, -18.1, 35.8, 31.2] }, hand: [11.5, 12.3, 2.8, 1.8, 9.3, 10.6] },
  gladiator: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [27, 42, 11, 37.5], mid: [47.3, 28.2, 5.6, 6.3], follow: [49.3, 26.7, 5.7, 6] }, back: { body: [-16.3, -37.8, 32.5, 43.7], other: [-5.4, -9.1, 24.2, 18.2, 2.1, 6.3, 21.3, 9.2], arm: [1.1, -38.3, 32.2, 34], strike: [0.7, -17.2, 45.7, 15.7] }, hand: [11.5, 11.7, 2.1, 1.8, 9.7, 9.8] },
  lancer: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [55, 46.7, 7.7, 36.9], mid: [57.2, 41.8, 7.3, 7.5], follow: [66.2, 30.5, 6.7, 12] }, back: { body: [-16.7, -37.8, 33.3, 43.7], other: [-0.6, 0.9, 20.2, 20, 4.6, 3.2, 16.5, 16.7], arm: [-4.1, -31.6, 43.2, 38.5], strike: [-5.5, -9.9, 59.8, 18.3] }, hand: [11.5, 11.2, 1.8, 1.6, 9.5, 9.4] },
  brawler: {
    faces: ['body', 'hurt', 'blink', 'victory'],
    swing: { wind: [17.8, 21.5, 2, 15.9], mid: [22.7, 20, 2.1, 14.5], follow: [29.5, 21.2, 2.1, 15.5] },
    back: { body: [-24.1, -37.8, 48.2, 43.7], joint: [-20.8, -10.5], other: [7.7, -11, 14.5, 15.5, 6.3, 4.9, 11.9, 13.2],
      arm: [-17, -17.3, 20.4, 23.8], strike: [-5.9, -5.5, 27.1, 20.5] },
    hand: [11.5, 11.3, 1.4, 3.3, 9.5, 9.5],
  },
  halberdier: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [36.3, 40.8, 9.4, 28.2], mid: [58, 33.2, 6.4, 7.9], follow: [64.3, 33, 7.1, 8.3] }, back: { body: [-15.6, -37.8, 31.2, 43.7], other: [-6.5, -8.7, 15.3, 15.7, 3, 2.6, 12.7, 12.9], arm: [1, -41.6, 22.2, 48.3], strike: [-0.2, -17.5, 40, 26.7] }, hand: [11.7, 11.8, 2.2, 1.8, 9.5, 10.1] },
  dancer: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [32.2, 42.5, 12.1, 36], mid: [40.7, 34.8, 7.4, 25.9], follow: [62.7, 33.3, 8.8, 22.9] }, back: { body: [-20, -37.8, 40, 43.7], other: [-13.8, -26.6, 22.7, 14.3, 2.2, 3.5, 19.8, 4.5], arm: [-25.5, -33.2, 47.5, 39.2], strike: [-30.6, -33.9, 49.2, 18.7] }, hand: [11, 10.8, 9.6, 1.5, 1.7, 9.2] },
  merchant: { faces: ['hurt', 'blink', 'victory'], swing: { wind: [24.7, 26.8, 3.8, 22.9], mid: [35.3, 20.8, 3.7, 4.7], follow: [44.2, 13.2, 4.3, 4.8] }, back: { body: [-11.3, -37.6, 22.5, 43.2], other: [4.8, 3.9, 14.7, 23.7, 11.2, 2.3, 4.4, 20.8], arm: [-8.1, -19.3, 19.3, 26.2], strike: [-8.6, -0.1, 26.8, 25] }, hand: [6.7, 13.8, 2.4, 1.2, 1.7, 12.2] },
  ninja: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [22, 33.8, 5.2, 30.4], mid: [34.8, 26.5, 4.4, 5], follow: [39.7, 28, 4.9, 5.2] }, back: { body: [-14.2, -37.6, 28.3, 43.2], other: [2.2, 2.2, 13.7, 18.3, 2.7, 1.9, 9.5, 15.9], arm: [-16.9, -19.1, 18.5, 24.2], strike: [-5.3, -11.2, 29, 18.7] }, hand: [11.2, 12.8, 3.6, 1.4, 9, 11] },
  archer: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [25.3, 42.2, 3, 24.7], mid: [35.8, 42.3, 4.3, 24.9], follow: [33.8, 40.5, 4, 24.1] }, back: { body: [-13.5, -37.8, 26.8, 43.7], other: [3.8, -9.6, 16.5, 13, 1.9, 4.2, 14.3, 9.7], arm: [-10.7, -36.9, 17.3, 30.7], strike: [-15, -31.8, 23.5, 25] }, hand: [12, 10.5, 1.6, 1.9, 10.3, 8.6] },
  ranger: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [24.7, 43.8, 3, 24.5], mid: [31.5, 43.5, 3.9, 24.3], follow: [30.7, 43.8, 3.7, 24.5] }, back: { body: [-13.4, -33.8, 25.7, 38], other: [-6.9, -7.3, 15.7, 9.2, 1.3, 4.9, 14, 4.4], arm: [-0.5, -42.2, 14.7, 39.5], strike: [-11.6, -42.2, 29.7, 39.5] }, hand: [12, 10.8, 1.5, 1.9, 10.3, 8.5] },
  wizard: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [34.7, 37, 4.9, 30.1], mid: [46.2, 29.7, 5.2, 21.6], follow: [56.8, 26.5, 4.1, 18.4] }, back: { body: [-14.3, -37.8, 28.7, 43.7], other: [5, -5.5, 15.2, 15.3, 12.8, 2.2, 2.7, 12], arm: [-8.3, -31.8, 21.5, 32.3], strike: [-31.8, -23.2, 31, 22.2] }, hand: [11, 11.7, 1.7, 1.6, 9.1, 9.8] },
  sorcerer: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [28, 31, 4.5, 26.7], mid: [36.3, 25.3, 4.2, 19.6], follow: [41.5, 19.3, 4.4, 13.1] }, back: { body: [-16.8, -36.6, 33.3, 39.8], other: [-13.9, -35.2, 22, 19.2, 2.3, 3.3, 17.7, 12.2], arm: [0.5, -39.8, 22.2, 40.7], strike: [-18, -43.4, 36, 30.7] }, hand: [11.7, 11.8, 1.7, 1.7, 8.9, 10] },
  pistoler: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [19.3, 19.8, 2.9, 16.9], mid: [24.5, 12.5, 2.5, 9.2], follow: [24.5, 17, 2.8, 13.8] }, back: { body: [-11.7, -37.6, 23.2, 43.2], arm: [-8.3, -25.9, 25, 31.2], strike: [-35.3, -11.9, 35.3, 18.5] }, hand: [10.3, 12.5, 2, 1.5, 7.9, 10.8] },
  sniper: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [31.5, 26.7, 3.8, 21.8], mid: [34.8, 14.3, 4.1, 9.1], follow: [36.5, 24.5, 4.3, 19] }, back: { body: [-11.9, -37.6, 23.7, 43.2], other: [-3.3, -10.5, 18.3, 14.3, 1.7, 4.1, 16, 7.7], arm: [-29.5, -21.2, 36.7, 18], strike: [-37, -21.2, 45, 18] }, hand: [10.8, 12.3, 1.9, 1.6, 8.3, 10.6] },
  // The Monk (redrawn, sheets MK-b and MK-c), Priest and Zealot (art pack 2-New-Classes, sheets H8b and H9b).
  monk: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [14.2, 13.9, 4, 3.2], mid: [17.9, 11.6, 2.9, 4.4], follow: [23.3, 13.9, 3.9, 4.6] }, off: { wind: [18.5, 17, 3.9, 3.6], mid: [22.4, 15.7, 3.7, 8], follow: [31, 13, 5.2, 7.4] }, back: { body: [-13.3, -37.7, 34.4, 45.4], other: [-7.3, -11.2, 13.3, 14.8, 10.5, 3.1, 3.56, 11.52], arm: [7.1, -14.5, 14.8, 10.5], strike: [6.1, -17.5, 19.6, 10.1] }, backFeet: [-11.3, 1.7, 10], hand: [19, 14.6, 3.7, 3.6, 15.7, 8.7] },
  priest: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [18.6, 24.5, 3.2, 17.3], mid: [19.7, 21.2, 3.3, 13], follow: [22.7, 19.7, 3.8, 10] }, back: { body: [-19.2, -39.7, 38.4, 49.9], other: [-9.4, -8, 15.7, 17.7, 12.2, 3.3, 3.7, 12.4], arm: [10.5, -26.7, 16.1, 18.1], strike: [10.7, -25.1, 19.9, 17.8] }, hand: [18, 16, 3.1, 6.8, 14.8, 3] },
  zealot: { faces: ['body', 'hurt', 'blink', 'victory'], swing: { wind: [19.6, 16.9, 3.2, 10.2], mid: [21.4, 18.3, 3.5, 6], follow: [24.2, 10.5, 4, 5.9] }, back: { body: [-16.9, -41.4, 33.9, 51.4], other: [-9.9, -8.6, 14.4, 18.4, 10.8, 3.6, 3.5, 14.8], arm: [11.5, -22, 20.8, 22.8], strike: [11.4, -14.9, 22.6, 9] }, hand: [17.1, 15.3, 3.4, 10.5, 14.1, 4.2] },
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
      if (a.back.buckler) out.push(`${cls}_backbuckler`);
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
// The first time a class is drawn in the world (the player's hero), all of its
// pictures start loading at once, so the first swing, blink or walk up the
// screen is ready when it comes. Heroes on the title and the class picker's
// stages only need their faces to idle; their swings load when first asked
// for (swingArtReady), so a new player isn't kept waiting on every class's.
const _warm = new Set();
export function warmHeroAnim(classId) {
  if (_warm.has(classId)) return;
  _warm.add(classId);
  const pre = `${classId}_`;
  for (const name of heroAnimFiles()) if (name.startsWith(pre)) image(name);
}
const warm = warmHeroAnim;
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
// The faces an idling hero shows. The hurt and victory faces come only with a
// hit or a cheer: until they have loaded, the neutral face stands in.
export const IDLE_FACES = ['body', 'blink'];
const _faces = {};   // each class's idle faces, kept once all are in (drawn every frame)
/** Draw the class's painted body for this moment in place of the rig body
 *  (drawn at x, y, w, h). False when the class has no faces, or they aren't loaded. */
export function drawAnimBody(ctx, classId, opts, x, y, w, h) {
  const a = ANIM_ART[classId];
  if (!a || !a.faces) return false;
  if (opts.entity) warm(classId);   // a hero out in the world: everything it may do next
  if (!(_faces[classId] || (_faces[classId] = set(a.faces.filter((f) => IDLE_FACES.includes(f)).map((f) => `${classId}_${f}`))))) return false;
  const face = faceState(opts);
  // The Merchant has no neutral picture of its own: its rig body stands in.
  if (!a.faces.includes(face)) return false;
  let pic = image(`${classId}_${face}`);
  if (!loaded(pic)) {
    if (!a.faces.includes('body')) return false;
    pic = image(`${classId}_body`);
  }
  ctx.drawImage(heroLit(pic), x - w * FACE_PAD, y - h * FACE_PAD, w * (1 + 2 * FACE_PAD), h * (1 + 2 * FACE_PAD));
  return true;
}

// ---------------- Attack arms: wind-up, mid-swing, follow-through ----------------
/** Which painted arm an attack clip's channels call for, or null at rest.
 *  `hand` is 'main' or 'off'; `kind` the rig's weapon family. */
export function swingPhase(ch, hand = 'main', kind = 'melee') {
  if (!ch) return null;
  // Clips with a picture walk (arc, heroanim.js) say outright which picture
  // shows: rest, then wind-up, mid-swing and follow-through, then rest again.
  if (ch.paint) {
    const a = hand === 'off' ? ch.arc2 : ch.arc;
    if (!(a > ARC_REST && a < ARC_GUARD)) return null;
    return a < 1.5 ? 'wind' : a < 2.5 ? 'mid' : 'follow';
  }
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
// The picture walk (arc) has the rig's own resting arm before ARC_REST and
// from ARC_GUARD on: close enough to rest to swap without a jump.
const ARC_REST = 0.4, ARC_GUARD = 3.6;
const ARC_JOIN = 0.22;
const PHASES = ['wind', 'mid', 'follow'];
// Where each painted arm points: from the shoulder to its measured weapon tip
// (or the farthest corner when unmeasured), as an angle and a length,
// unwrapped so wind-up -> mid -> follow-through runs one way round.
// (Worked out once per arm and kept, like the loaded pictures in armPics:
// these are looked up every frame of a swing, so nothing is built per frame.)
const _geo = {}, _pics = {};
function armGeo(classId, hand) {
  const c = _geo[classId] || (_geo[classId] = {});
  let g = c[hand];
  if (g) return g;
  const frames = hand === 'off' ? ANIM_ART[classId].off : ANIM_ART[classId].swing;
  g = { dir: [0, 0, 0], len: [0, 0, 0], sense: 1 };
  PHASES.forEach((k, i) => {
    const [w, h, px, py, tx, ty] = frames[k];
    if (tx != null && ty != null) {
      g.dir[i] = Math.atan2(ty - py, tx - px);
      g.len[i] = Math.hypot(tx - px, ty - py);
    } else {
      let best = -1;
      for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
        const d = Math.hypot(x - px, y - py);
        if (d > best) { best = d; g.dir[i] = Math.atan2(y - py, x - px); }
      }
      g.len[i] = best;
    }
    if (i) g.dir[i] = g.dir[i - 1] + wrap(g.dir[i] - g.dir[i - 1]);
  });
  // Which way round the swing travels (+1 forward and down, the usual).
  g.sense = Math.sign(g.dir[2] - g.dir[0]) || 1;
  c[hand] = g;
  return g;
}
/** The class's three attack pictures for one hand, or null until all have loaded. */
function armPics(classId, hand) {
  const c = _pics[classId] || (_pics[classId] = {});
  if (c[hand]) return c[hand];
  const pre = hand === 'off' ? 'off' : '';
  return (c[hand] = set(PHASES.map((k) => `${classId}_${pre}${k}`)));
}
const wrap = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
// Per class, a turn (rad) added to a picture to keep the blade clear of the face.
// The wind-ups are painted raised over the head, so they are tipped forward too:
// the guard and fist sit above the hat or hood rather than over the eyes.
const CLEAR = { corsair: { wind: 0.5, mid: 0.35 }, rogue: { wind: 0.55, mid: 0.15 } };
// (The Monk's palm, fingers up, dips a little below the cheek as it crosses the chest.)
const CLEAR_OFF = { corsair: { mid: 0.2 }, monk: { mid: -0.2 } };
/** The direction the weapon points at picture-walk position a (1..3). */
function arcDir(g, a) {
  const k = Math.max(1, Math.min(3, a)) - 1, i = Math.min(1, Math.floor(k));
  return g.dir[i] + (g.dir[i + 1] - g.dir[i]) * (k - i);
}
/** How far (rad) the shown picture is turned about the shoulder at picture-walk
 *  position a: toward the next picture as the weapon travels its arc, coiled
 *  less on the way in, turned back up toward guard on the way out. */
function armTurn(g, a, phase) {
  const i = PHASES.indexOf(phase);
  let t;
  if (a < 1) t = (1 - a) * 0.75;
  else if (a <= 3) t = Math.max(-0.8, Math.min(0.8, (arcDir(g, a) - g.dir[i]) * 0.85 * g.sense));
  else t = -(a - 3) * 1.1;
  return t * g.sense;
}
// Held weapons rest upright in the rigs' guard (the blade, cane or staff
// raised): pointing about this way from the shoulder.
const GUARD_DIR = -1.45;
/** On the way back from the follow-through (a 3 -> ARC_GUARD), the turn that
 *  brings the weapon up to point where the rig's guard holds it, so the swap
 *  back to the rig doesn't jump. Not for bows and guns (aimed level at rest). */
function guardTurn(g, a, direction) {
  if (a <= 3 || (direction == null && g.sense < 0)) return 0;
  const k = Math.min(1, (a - 3) / (ARC_GUARD - 3));
  const turn = direction == null ? -Math.max(0.66, Math.min(2, g.dir[2] - GUARD_DIR)) : wrap(direction - g.dir[2]);
  return k * k * (3 - 2 * k) * turn;
}
/** The way in for a clip that asks for it (guardIn, the Lancer's thrust): the
 *  wind-up picture starts turned to point where the rig's guard holds the
 *  weapon and comes down into its own aim by a 1, so the swap from the rig's
 *  upright spear doesn't jump. */
function guardInTurn(g, a, direction) {
  const k = Math.max(0, Math.min(1, (1 - a) / (1 - ARC_REST)));
  const turn = direction == null ? GUARD_DIR - g.dir[0] : wrap(direction - g.dir[0]);
  return k * k * (3 - 2 * k) * turn;
}
// The tip smear's colours: steel for blades, warm for heavy heads, a glow for
// magic, pink silk for the Dancer's whip and fan, gold for the cane.
const SMEAR_TINT = { warhammer: '#fff1d6', mace: '#fff1d6', battleaxe: '#fff1d6', staff: '#d9c4ff', wand: '#d9c4ff', orb: '#d9c4ff',
  whip: '#ffd0e6', fan: '#ffd0e6', cane: '#ffe9a8', claws: '#ffffff' };
const SMEAR_INK = '#22304A', SMEAR_STEEL = '#eef5fb';
/** Draw this attack's painted arm with its shoulder at (sx, sy), turned about
 *  the shoulder along the weapon's arc (see armTurn), with the tip's smear
 *  behind it through a strike and the spark or muzzle flash at the tip.
 *  `anim` is the clip frame (heroanim.js). False when there is no frame for
 *  this moment (rest) or the set hasn't loaded. */
export function drawSwingArm(ctx, classId, anim, hand, kind, sx, sy, alpha = 1, guardDirection) {
  const a = ANIM_ART[classId];
  const frames = a && (hand === 'off' ? a.off : a.swing);
  if (!frames) return false;
  const ch = anim.ch;
  const phase = swingPhase(ch, hand, kind);
  if (!phase) return false;
  const pics = armPics(classId, hand);
  if (!pics) return false;
  const [w, h, px, py] = frames[phase];
  const i = PHASES.indexOf(phase);
  const off = hand === 'off';
  const arc = off ? ch.arc2 : ch.arc;
  const g = armGeo(classId, hand);
  let turn = 0, scale = 1;
  if (arc > 0) {
    const aimed = kind === 'bow' || kind === 'gun';
    const clear = (off ? CLEAR_OFF : CLEAR)[classId];
    if (arc > 3 && !aimed) turn = guardTurn(g, arc, guardDirection);
    else if (arc < 1 && (anim.guardIn || guardDirection != null)) turn = guardInTurn(g, arc, guardDirection);
    else turn = armTurn(g, arc, phase) * (anim.tween ?? 1);
    turn += (clear?.[phase] || 0) * g.sense;
    // Near a picture change, both drawings meet along the same arc from the
    // same shoulder. Keep a single painted silhouette throughout the cut.
    const before = arc < 2 ? 0 : 1;
    const join = Math.abs(arc - (before + 1.5)) / ARC_JOIN;
    if (join < 1) {
      const align = 1 - join * join * (3 - 2 * join);
      const fraction = arc - before - 1;
      const clearance = lerp(clear?.[PHASES[before]] || 0, clear?.[PHASES[before + 1]] || 0, fraction) * g.sense;
      const angle = arcDir(g, arc) + clearance;
      turn += wrap(angle - g.dir[i] - turn) * align;
      if (!aimed) {
        const length = lerp(g.len[before], g.len[before + 1], fraction);
        scale += clamp(length / g.len[i] - 1, -0.10, 0.10) * align;
      }
    }
    turn += ((off ? ch.whip2 : ch.whip) || 0) * g.sense;
  }
  const tipDirection = g.dir[i] + turn, tipLength = g.len[i] * scale;
  if (alpha < 1) { ctx.save(); ctx.globalAlpha *= alpha; }
  const low = !!anim.low;
  const accent = classAccent(classId);
  // The smear: a fading crescent the tip has just swept, a few strokes.
  const sm = (off ? ch.smear2 : ch.smear) || 0;
  if (!low && sm > 0.03 && arc >= 1) {
    // (The off hand's is shorter: it sweeps up past the face.)
    const head = tipDirection, tail = arcDir(g, Math.min(arc, 3) - (off ? 0.9 : 1.6));
    if (Math.abs(head - tail) > 0.15) {
      const R = tipLength * 0.88, lo = Math.min(head, tail), hi = Math.max(head, tail);
      const prev = ctx.globalAlpha;
      ctx.lineCap = 'round';
      ctx.globalAlpha = prev * sm * 0.55;
      ctx.strokeStyle = SMEAR_INK; ctx.lineWidth = 6.5;
      ctx.beginPath(); ctx.arc(sx, sy, R - 2.5, lo, hi); ctx.stroke();
      ctx.globalAlpha = prev * sm * 0.9;
      ctx.strokeStyle = accent?.colour || SMEAR_TINT[anim.weapon] || SMEAR_STEEL; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(sx, sy, R - 2.5, lo, hi); ctx.stroke();
      // A thin highlight at the leading edge: the fastest part of the swing.
      const n0 = g.sense > 0 ? Math.max(lo, hi - 0.6) : lo, n1 = g.sense > 0 ? hi : Math.min(hi, lo + 0.6);
      ctx.globalAlpha = prev * sm;
      ctx.strokeStyle = accent?.light || '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, R, n0, n1); ctx.stroke();
      ctx.globalAlpha = prev;
      anim[off ? 'smeared2' : 'smeared'] = true;
    }
  }
  if (turn || scale !== 1) {
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(turn);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.drawImage(heroLit(pics[i]), -px, -py, w, h);
    ctx.restore();
  } else ctx.drawImage(heroLit(pics[i]), sx - px, sy - py, w, h);
  // The spark where the blow lands, or a gun's muzzle flash, at the tip.
  const fl = ch.flash || 0, k = Math.max(phase === 'follow' ? ch.impact || 0 : 0, fl);
  if (!low && k > 0.05 && phase !== 'wind') {
    const d = tipDirection, r = tipLength * 0.92;
    drawHeroStrikeSpark(ctx, sx + Math.cos(d) * r, sy + Math.sin(d) * r, 2 + k * (fl > 0.05 ? 6 : 5), k, fl > 0.05, accent);
    anim.sparked = true;
  }
  if (alpha < 1) ctx.restore();
  return true;
}
/** Four-point impact spark with a bright centre. A muzzle flash keeps its gold centre. */
export function drawHeroStrikeSpark(ctx, x, y, r, k, fire, accent) {
  ctx.save();
  ctx.globalAlpha *= Math.min(1, k);
  ctx.fillStyle = fire ? '#ffd24a' : '#fff0b4'; ctx.strokeStyle = SMEAR_INK; ctx.lineWidth = accent ? 2.1 : 0.9;
  ctx.beginPath();
  for (let j = 0; j < 8; j++) { const t = j * Math.PI / 4, rr = j % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (accent) {
    ctx.strokeStyle = accent.colour; ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  ctx.restore();
}
/** The painted off arm is behind the body (its blade clear of the face) except
 *  through its follow-through, when it has come round in front (and goes back
 *  behind before it turns up to guard, past the face). */
export function offArmInFront(ch) {
  return ch.arc2 > 2.5 && ch.arc2 < 3.12;
}
/** Ask for a class's attack pictures (both hands, where it has an off hand's):
 *  true once they are all in, or when it has none (or there is no browser). */
export function swingArtReady(classId) {
  const a = ANIM_ART[classId];
  if (!a || typeof Image === 'undefined') return true;
  return (!a.swing || !!armPics(classId, 'main')) && (!a.off || !!armPics(classId, 'off'));
}
/** Does this class have painted attack arms ready (for the off hand too)? */
export function hasSwingArt(classId, hand = 'main') {
  const a = ANIM_ART[classId];
  if (!a || !(hand === 'off' ? a.off : a.swing)) return false;
  return !!armPics(classId, hand);
}

// ---------------- Back view ----------------
// Where most heroes' back-view feet stand: [left x, right x, width].
const BACK_FEET = [-10, 1, 12];
const _backs = new Map();

function backPics(classId) {
  const b = ANIM_ART[classId]?.back;
  if (!b) return null;
  const cached = _backs.get(classId);
  if (cached) return cached;
  const names = ['backbody', 'backarm', 'backstrike', 'backfootl', 'backfootr', ...(b.other ? ['backother'] : [])];
  const pics = set(names.map((n) => `${classId}_${n}`));
  if (pics) _backs.set(classId, pics);
  return pics;
}

export function heroBackReady(classId) { return !!backPics(classId); }

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
  // Life skills turn to their work with tool arms, which have no back view.
  const ch = opts.anim?.ch;
  if (!(opts.backView ?? (facingAway(opts) && (ch?.mix || 0) <= 0.01))) return false;
  const pics = backPics(classId);
  if (!pics) return false;
  const a = ANIM_ART[classId], b = a.back;
  const [body, arm, strike, footL, footR, other] = pics;
  const calm = opts.calm || opts.anim?.calm;
  const move = clamp(opts.gait?.move || 0, 0, 1);
  const { step, liftB, liftF, rise } = heroWalk(opts.gait, calm);
  const breathe = Math.sin((opts.time || 0) * 0.0032) * (calm ? 0.12 : 0.35) * (1 - move) + (ch?.crouch || 0) - rise;
  // Feet where the front view has them, the soles showing as each lifts
  // (a wide stance, the Monk's, says where: [left x, right x, width]).
  const [flx, frx, fw] = a.backFeet || BACK_FEET;
  const foot = (img, x, lift) => {
    const w = fw, h = w * img.naturalHeight / img.naturalWidth;
    ctx.drawImage(heroLit(img), x, 15 - h - lift, w, h);
  };
  foot(footL, flx - step * 1.5, liftB + (ch?.liftB || 0));
  foot(footR, frx + step * 1.5, liftF + (ch?.liftF || 0));

  // The two rear arm paintings do not all share one shoulder pivot. Keep
  // their original attachment to the torso and turn that whole assembly over
  // the planted feet as it winds up and recoils.
  const turn = clamp((ch?.sword || 0) * 0.065 - (ch?.back || 0) * 0.035
    + ((ch?.draw || 0) - (ch?.release || 0)) * 0.07, -0.17, 0.17);
  ctx.save();
  if (turn) {
    const x = b.body[0] + b.body[2] / 2, y = b.body[1] + b.body[3];
    ctx.translate(x, y); ctx.rotate(turn); ctx.translate(-x, -y);
  }
  const put = (img, r, dy = 0) => ctx.drawImage(heroLit(img), r[0], r[1] + breathe + dy, r[2], r[3]);
  put(body, b.body);
  const buckler = b.buckler && opts.hasShield !== false ? image(`${classId}_backbuckler`) : null;
  const held = loaded(buckler) ? buckler : other;
  if (classId === 'knight' && opts.hasShield === false) {
    const [sx, sy] = b.other;
    drawEmptyArm(ctx, classId, sx, sy + breathe, -0.65 + step * 0.25, 10);
  } else if (held) {
    // The off arm hangs from its shoulder, a little out from the body, and swings as the hero walks.
    const [sx, sy, w, h, px, py, fx, fy] = held === buckler ? b.buckler : b.other;
    const natural = Math.atan2(fy - py, fx - px);
    const want = Math.PI / 2 + (sx < b.body[0] + b.body[2] / 2 ? 0.2 : -0.2) + step * 0.25;
    ctx.save(); ctx.translate(sx, sy + breathe); ctx.rotate(want - natural);
    ctx.drawImage(heroLit(held), -px, -py, w, h);
    ctx.restore();
  }
  const hit = ch ? (ch.strike > 0.5 || ch.release > 0.05 || ch.cast > 0.2 || ch.strike2 > 0.5) : (opts.swingK ?? -1) >= 0.4;
  if (b.weaponShoulder) {
    // Both painted sword arms and the empty hand meet the same rear shoulder.
    const [sx, sy] = b.weaponShoulder;
    if (opts.hasWeapon === false) drawEmptyArm(ctx, classId, sx, sy + breathe, -0.38 - step * 0.25, 10);
    else {
      const [w, h, px, py, guard] = hit ? b.strike : b.arm;
      ctx.save(); ctx.translate(sx, sy + breathe); ctx.rotate(guard + step * 0.07);
      ctx.drawImage(heroLit(hit ? strike : arm), -px, -py, w, h);
      ctx.restore();
    }
  } else if (classId === 'brawler') {
    const [sx, sy] = b.joint;
    if (opts.hasWeapon === false) drawEmptyArm(ctx, classId, sx, sy + breathe, -0.6 - step * 0.2 - (hit ? 0.7 : 0), hit ? 12 : 9);
    else {
      // The claw cuts were painted in opposite directions. Match their inner
      // cuffs at the same shoulder before letting the planted body turn.
      ctx.save(); ctx.translate(sx, sy + breathe); ctx.rotate(step * 0.12);
      if (hit) ctx.scale(-1, 1);
      ctx.drawImage(heroLit(hit ? strike : arm), ...(hit ? b.strike : b.arm));
      ctx.restore();
    }
  } else if (classId === 'knight' && opts.hasWeapon === false) {
    const [sx, sy] = b.joint;
    drawEmptyArm(ctx, classId, sx, sy + breathe, 0.35 - step * 0.25 + (ch?.strike || 0) * 0.8, 10);
  } else put(hit ? strike : arm, hit ? b.strike : b.arm, step * 0.6);
  ctx.restore();
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
  ctx.drawImage(heroLit(img), -ax, -ay, w, h);
  ctx.restore();
  return [sx + Math.sin(phi) * len, sy + Math.cos(phi) * len];
}
export function hasEmptyArm(classId) {
  const a = ANIM_ART[classId];
  return !!(a && a.hand && loaded(image(`${classId}_hand`)));
}
