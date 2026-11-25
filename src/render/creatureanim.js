// Creature animation curves: the small pure helpers behind how monsters and
// townsfolk breathe, step, fidget, flash when struck, charge a heavy blow,
// fall and come back. Kept apart from sprites.js so they can be tested on their
// own; every one is cheap math with no allocation (the `out` objects are reused).

// ---------------- A rhythm of its own ----------------
// Each creature breathes, bobs and fidgets on its own phase and tempo, so a
// pack never moves in lock-step. The phase belongs to the creature itself
// (from where it lives), not to where it is on screen: tying it to the screen
// position made every idle body flicker while the camera panned, and a walking
// one hop at a different speed going left than going right.
let _made = 0;
/** A creature's own animation seed (0..1000), worked out once and kept on it.
 *  Without an entity (pets, previews), `fallback` stands in. */
export function animSeed(e, fallback = 0) {
  if (!e || typeof e !== 'object') return fallback;
  let s = e._animSeed;
  if (s === undefined) {
    const x = e.spawnX ?? e.x ?? 0, y = e.spawnY ?? e.y ?? 0;
    const h = Math.sin(x * 12.9898 + y * 78.233 + (_made++) * 0.6180339) * 43758.5453;
    s = (h - Math.floor(h)) * 1000;
    e._animSeed = s;
  }
  return s;
}
/** Its breathing tempo: within 15% either side of the usual. */
export const animTempo = (seed) => 0.85 + ((seed * 7.31) % 1) * 0.3;

// ---------------- Walking ----------------
/** How high the body is lifted part-way through a step (0 as a foot plants, 1
 *  mid-stride), from the creature's walk phase (one footstep per tile walked). */
export const stepLift = (walk) => Math.abs(Math.sin(walk * Math.PI));
/** The side-to-side rock of a step: one way on one foot, the other way on the next. */
export const stepRock = (walk) => Math.sin(walk * Math.PI);

// ---------------- Idle fidget ----------------
/** Now and then (every five to eight seconds, its own interval) a creature
 *  standing about gives a little hop: 0 most of the time, rising to 1 and
 *  back over FIDGET_MS. */
export const FIDGET_MS = 380;
export function fidget(t, seed) {
  const every = 5200 + (seed % 37) * 80;
  const u = ((t + seed * 53) % every) / FIDGET_MS;
  return u < 1 ? Math.sin(u * Math.PI) : 0;
}

// ---------------- Struck ----------------
/** The white flash over a struck body, from its hurt timer (200ms counting
 *  down): a crisp bright frame as the blow lands, then a quick fade, rather
 *  than a dim flash fading evenly. */
export const HURT_MS = 200;
export function hitFlash(hurt) {
  if (!(hurt > 0)) return 0;
  const age = HURT_MS - Math.min(HURT_MS, hurt);
  if (age < 45) return 0.82;
  const k = 1 - (age - 45) / (HURT_MS - 45);
  return 0.82 * k * k;
}
/** How hard a struck body still shudders (0..1): eases out rather than stopping dead. */
export function flinch(hurt) {
  if (!(hurt > 0)) return 0;
  const k = Math.min(1, hurt / HURT_MS);
  return k * k;
}

// ---------------- Charging a heavy blow ----------------
/** How long (ms) the creature has been charging its telegraphed blow, noted on
 *  it the first frame it is seen charging; -1 when it isn't. */
export function windupAge(n, now) {
  if (!(n.windup > 0)) { if (n._windAt !== -1) n._windAt = -1; return -1; }
  if (!(n._windAt >= 0)) n._windAt = now;
  return Math.max(0, now - n._windAt);
}
/** The red glow of a charging blow: it builds over the first half second and
 *  pulses slowly (a heartbeat, not a strobe). 0..about 0.34. */
export function telegraphGlow(age) {
  if (!(age >= 0)) return 0;
  const build = Math.min(1, age / 450);
  const e = 1 - (1 - build) * (1 - build);
  return (0.12 + 0.2 * e) * (0.72 + 0.28 * Math.sin(age * 0.014 - 1.2));
}
/** How much it trembles while charging (0..1): it starts still and shakes harder as the blow nears. */
export const telegraphShake = (age) => (age >= 0 ? Math.min(1, age / 700) : 0);
/** How far a charging creature has gathered itself (0..1): it sinks back
 *  into a crouch over the first 600ms of the charge, and when the blow is
 *  let go the crouch eases out over about 70ms (into the swing's own
 *  wind-up) instead of vanishing in one frame. Kept on the creature
 *  (`now` is the draw time); without one, the charge's own curve. */
export const CROUCH_MS = 600, UNCROUCH_MS = 70;
export function telegraphCrouch(n, charging, age, now) {
  const want = charging && age >= 0 ? 1 - (1 - Math.min(1, age / CROUCH_MS)) ** 2 : charging ? 1 : 0;
  if (!n || typeof n !== 'object') return want;
  const v = n._crV || 0;
  if (!(want > 0) && !(v > 0)) return 0;   // never charged: nothing kept on it
  const dt = n._crT >= 0 && now >= n._crT ? now - n._crT : 0;
  const out = want >= v ? want : want + (v - want) * Math.exp(-dt / UNCROUCH_MS);
  n._crV = out < 1e-3 ? 0 : out; n._crT = now;
  return n._crV;
}

// ---------------- Danger on the ground ----------------
/** The pulse (0..1) of a boss's marked ground `age` ms into its `dur` ms
 *  warning: a slow, smooth throb that quickens as the blow nears (1.4 beats
 *  a second rising to 4.2), rather than one fast flicker throughout. */
export function hazardPulse(age, dur) {
  if (!(age >= 0)) return 0;
  const d = Math.max(1, dur || 1), a = Math.min(age, d);
  const f0 = 1.4 / 1000, f1 = 4.2 / 1000;
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * (f0 * a + (f1 - f0) * a * a / (2 * d)));
}
/** A marked patch fades in over its first moments rather than appearing at once. */
export const hazardIn = (age) => (age > 0 ? Math.min(1, age / 160) : 0);

// ---------------- Coming back ----------------
/** A fresh respawn `k` (0..1) of the way in: it pops up out of the ground,
 *  overshooting a little and settling, as it fades in. Scale about the feet. */
export function spawnPose(k, out = {}) {
  k = Math.max(0, Math.min(1, k));
  const a = Math.min(1, k / 0.3);
  out.a = a * (2 - a);
  // An ease-out-back from 0.45 to full size.
  const c1 = 2.2, c3 = c1 + 1, u = k - 1;
  const s = 0.45 + 0.55 * (1 + c3 * u * u * u + c1 * u * u);
  // Tall and thin as it springs up, back to its own shape as it lands.
  const st = Math.sin(k * Math.PI) * 0.12;
  out.sx = s * (1 - st); out.sy = s * (1 + st);
  return out;
}

// ---------------- Falling ----------------
/** A felled creature `k` (0..1) of the way through its fall (420ms): a quick
 *  jolt upright as the blow lands, then it tips over faster and faster, bumps
 *  as it hits the ground and fades. `rot` is the share of a quarter turn,
 *  `sx`/`sy` a squash about the feet, `a` its opacity, and `slide` (0..1)
 *  how far it has been knocked back along the ground, easing to a stop as it
 *  lands (the renderer tips it and slides it away from the killing blow). */
export function deathPose(k, out = {}) {
  k = Math.max(0, Math.min(1, k));
  out.sx = 1; out.sy = 1;
  const s = Math.min(1, k / 0.62);
  out.slide = 1 - (1 - s) * (1 - s) * (1 - s);
  if (k < 0.14) {
    const j = Math.sin((k / 0.14) * Math.PI);
    out.rot = -0.05 * j; out.sx = 1 - 0.08 * j; out.sy = 1 + 0.1 * j;
  } else if (k < 0.6) {
    const f = (k - 0.14) / 0.46;
    out.rot = f * f;
  } else if (k < 0.8) {
    const b = Math.sin(((k - 0.6) / 0.2) * Math.PI);
    out.rot = 1 - 0.09 * b;
    out.sx = 1 + 0.06 * b; out.sy = 1 - 0.08 * b;   // flattened a touch as it thumps down
  } else out.rot = 1;
  const fade = Math.max(0, (k - 0.5) / 0.5);
  out.a = 1 - fade * fade;
  return out;
}
