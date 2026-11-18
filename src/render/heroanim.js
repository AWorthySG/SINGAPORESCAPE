// Hero animation clips: small keyframed motions for the painted heroes, one
// per life-skill action and one per weapon type, sampled each frame and
// blended so that switching between them (walk -> chop -> idle) never snaps.
//
// A clip is plain data:
//   { dur, loop, beat, hands, fx, trail, tracks: { channel: [[t, value, ease], ...] } }
// - t runs 0..1 through the clip; `ease` names the curve INTO that key
//   (io smooth, in, out, snap = a fast strike that brakes hard, back = overshoot,
//   lin). A channel left out stays 0.
// - `dur` is milliseconds per loop, or 'tick' for one game tick (0.6s): those
//   clips are timed off the game's own tick clock, so `beat` (the moment the
//   tool lands) falls on the tick that pays out the logs, ore or XP.
// - `hands`: the clip is acted with mitten arms holding a tool (life skills),
//   so the class's weapon arm is put away for it.
// - `fx`: the world reaction spawned on the beat (leaves, chips, splash...).
// - `trail`: the swoosh a weapon leaves on a fast swing (combat clips);
//   `trail2` is the off-hand weapon's, for the dual-wield clips.
//
// Channels. Whole body: bx, by (px; -y is up), lean (rad toward the target),
// squash (+ squashes down), crouch (px the body sinks over planted feet),
// liftF/liftB (px each foot lifts). Mitten arms (life skills): hand and off
// (arm angle from hanging straight down, + swinging forward, ~pi overhead),
// prop (the tool's wrist turn), bend (a fishing rod's bow under a fish's
// pull, 0..1; negative whips it back on the cast). Painted rig arms (combat, added to the class's
// rest pose): sword, back, strike, reach for the melee rigs, and strike2,
// reach2 for the off hand's own lunge (dual wielding, the claws' second paw);
// draw, release, charge, cast, kick2 for the bow, gun and staff rigs. trail
// and trail2 sweep 0..1; impact pulses 0..1 as a blow lands (the spark).
//
// To add a clip: write its tracks in CLIPS (or with one of the factories for
// a weapon family), then map an action in actionClipId or a weapon type in
// WEAPON_CLIP. tests/hero-anim.test.mjs checks every action and weapon type
// has a clip and that every clip draws.
import { TICK_MS, TILE } from '../config.js';
import { ITEMS } from '../data/items.js';
import { itemIconImage } from './icons.js';
import { drawEmptyArm, hasEmptyArm } from './heroAnimArt.js';

const EASE = {
  lin: (x) => x,
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) * (1 - x),
  io: (x) => x * x * (3 - 2 * x),
  snap: (x) => 1 - (1 - x) ** 4,
  back: (x) => { const c = 1.7, y = x - 1; return 1 + (c + 1) * y * y * y + c * y * y; },
};

export const HERO_CHANNELS = ['bx', 'by', 'lean', 'squash', 'crouch', 'liftF', 'liftB', 'hand', 'off', 'prop',
  'sword', 'back', 'strike', 'reach', 'strike2', 'reach2', 'draw', 'release', 'charge', 'cast', 'kick2', 'trail', 'trail2', 'impact', 'bend'];

/** Value of one channel's keys at time u (0..1). */
function sampleTrack(keys, u) {
  if (!keys || !keys.length) return 0;
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (u <= b[0]) {
      const a = keys[i - 1], span = b[0] - a[0];
      const x = span > 0 ? (u - a[0]) / span : 1;
      return a[1] + (b[1] - a[1]) * (EASE[b[2]] || EASE.io)(x);
    }
  }
  return keys[keys.length - 1][1];
}

// ---------------- Life-skill clips ----------------
// Mitten-arm angles: 0 hangs down, ~1.5 points at the target, ~3 is overhead.
// Looping clips end where they start; the strike is the 'snap' key at `beat`.
const skill = (beat, fx, tracks, more = {}) => ({ dur: 'tick', loop: true, beat, hands: true, fx, tracks, ...more });
/** A tool's impact spark: a pulse at each beat (strength 0..1), drawn at the tool's head. */
function sparkAt(...hits) {
  const keys = [[0, 0]];
  for (const [h, v = 1] of hits) keys.push([h - 0.012, 0, 'lin'], [h, v, 'snap'], [h + 0.05, v * 0.8], [h + 0.13, 0]);
  keys.push([1, 0]);
  return keys;
}
const CLIPS = {
  // An overhead axe chop into the trunk at chest height: a lift onto the
  // toes, a beat held at the top, the snap down, and a jolt back off the wood
  // as it bites (the spark marks the bite; the tree shakes on the tick).
  woodcut: skill(0.72, 'chips', {
    hand: [[0, 1.3], [0.48, 2.75], [0.62, 2.9, 'out'], [0.72, 1.4, 'snap'], [0.78, 1.62, 'out'], [0.88, 1.3], [1, 1.3]],
    prop: [[0, 0.2], [0.5, -0.5], [0.62, -0.6], [0.72, 0.35, 'snap'], [0.8, 0.1], [1, 0.2]],
    off: [[0, 1.0], [0.5, 2.2], [0.72, 1.2, 'snap'], [1, 1.0]],
    lean: [[0, 0.02], [0.55, -0.12], [0.62, -0.13], [0.72, 0.14, 'snap'], [0.8, 0.06], [1, 0.02]],
    bx: [[0, 0], [0.55, -1.4], [0.72, 1.6, 'snap'], [0.8, 0.6], [1, 0]],
    by: [[0, 0], [0.5, -1], [0.62, -1.2], [0.72, 0, 'in'], [1, 0]],
    squash: [[0, 0], [0.6, -0.05], [0.73, 0.08, 'snap'], [0.86, 0], [1, 0]],
    liftF: [[0, 0], [0.5, 2.5], [0.7, 0, 'in'], [1, 0]],
    impact: sparkAt([0.72]),
  }),
  // A pickaxe brought right over the head and down into the rock, the body
  // following it through; the pick rings off the stone with a jolt.
  mine: skill(0.72, 'sparks', {
    hand: [[0, 1.1], [0.5, 3.0], [0.62, 3.15, 'out'], [0.72, 1.05, 'snap'], [0.77, 1.3, 'out'], [0.86, 1.05], [1, 1.1]],
    prop: [[0, 0.3], [0.52, -0.3], [0.72, 0.5, 'snap'], [0.8, 0.3], [1, 0.3]],
    off: [[0, 0.7], [0.52, 2.4], [0.72, 0.8, 'snap'], [1, 0.7]],
    lean: [[0, 0.06], [0.55, -0.15], [0.62, -0.16], [0.72, 0.22, 'snap'], [0.8, 0.12], [1, 0.06]],
    crouch: [[0, 1], [0.55, -1.5], [0.62, -1.8], [0.74, 2.8, 'snap'], [0.85, 1.5], [1, 1]],
    squash: [[0, 0], [0.6, -0.05], [0.74, 0.1, 'snap'], [0.9, 0], [1, 0]],
    bx: [[0, 0], [0.62, -1], [0.72, 1.2, 'snap'], [0.78, 0.4], [1, 0]],
    liftF: [[0, 0], [0.5, 2], [0.7, 0, 'in'], [1, 0]],
    impact: sparkAt([0.72]),
  }),
  // Fishing is acted in three parts (see fishFrame): a cast, a wait at the
  // water, and a haul that brings the catch in when the game lands a fish.
  // Each wait pose is where its cast ends and its haul starts and ends, so the
  // parts join without a jump. The line, bobber, net, pot and harpoon in flight
  // are drawn by drawFishingGear, timed by the same 0..1 through each part.
  // Rod: the rod swung back over the shoulder, flicked forward to cast (the
  // bobber leaves the tip at 0.47 and lands at 0.8)...
  fish_rod_cast: skill(0.47, null, {
    hand: [[0, 1.35], [0.3, 2.65], [0.36, 2.7], [0.47, 1.55, 'snap'], [0.6, 1.45, 'out'], [1, 1.35]],
    prop: [[0, -0.75], [0.3, -1.45], [0.36, -1.5], [0.47, -0.35, 'snap'], [0.6, -0.5], [1, -0.75]],
    off: [[0, 1.1], [0.3, 1.6], [0.47, 1.0, 'snap'], [1, 1.1]],
    bend: [[0, 0], [0.36, -0.25], [0.47, 0.35, 'snap'], [0.6, -0.1], [0.75, 0], [1, 0]],
    lean: [[0, 0], [0.3, -0.12], [0.47, 0.12, 'snap'], [0.6, 0.08], [1, 0]],
    bx: [[0, 0], [0.3, -1.5], [0.47, 1.5, 'snap'], [1, 0]],
    squash: [[0, 0], [0.3, -0.03], [0.5, 0.05, 'snap'], [0.7, 0], [1, 0]],
    liftF: [[0, 0], [0.25, 2.5], [0.45, 0, 'in'], [1, 0]],
  }, { dur: 800, loop: false }),
  // ...the wait, rod held out with the tip twitching now and then...
  fish_rod: skill(0.33, null, {
    hand: [[0, 1.35], [0.3, 1.37], [0.33, 1.31, 'snap'], [0.4, 1.35], [0.7, 1.38], [1, 1.35]],
    prop: [[0, -0.75], [0.3, -0.75], [0.33, -0.68, 'snap'], [0.42, -0.75], [0.72, -0.72], [0.75, -0.78, 'snap'], [0.85, -0.75], [1, -0.75]],
    bend: [[0, 0], [0.3, 0], [0.33, 0.12, 'snap'], [0.45, 0], [1, 0]],
    off: [[0, 1.1], [1, 1.1]],
    squash: [[0, 0], [0.5, 0.015], [1, 0]],
  }, { dur: 1600 }),
  // ...and the bite: the rod is dragged down and bows (0.08), the hero
  // strikes, yanking it up (0.26), reels in, and the fish flips out (0.42-0.82).
  fish_rod_reel: skill(0.26, null, {
    hand: [[0, 1.35], [0.08, 1.15, 'snap'], [0.16, 1.2], [0.26, 2.05, 'snap'], [0.36, 1.85], [0.42, 1.95], [0.5, 1.8], [0.62, 1.9], [1, 1.35]],
    prop: [[0, -0.75], [0.08, -0.55, 'snap'], [0.26, -1.25, 'snap'], [0.62, -1.1], [1, -0.75]],
    bend: [[0, 0], [0.08, 0.8, 'snap'], [0.18, 0.7], [0.26, 1, 'snap'], [0.45, 0.8], [0.55, 0.15, 'out'], [0.7, 0], [1, 0]],
    off: [[0, 1.1], [0.08, 1.0], [0.26, 1.7, 'snap'], [0.36, 1.3], [0.42, 1.6], [0.5, 1.3], [0.62, 1.5], [1, 1.1]],
    lean: [[0, 0], [0.08, 0.14, 'snap'], [0.18, 0.1], [0.26, -0.16, 'snap'], [0.55, -0.1], [1, 0]],
    bx: [[0, 0], [0.08, 1.5, 'snap'], [0.26, -2, 'snap'], [0.55, -1], [1, 0]],
    crouch: [[0, 0], [0.08, 1.5], [0.26, -0.5, 'snap'], [0.6, 0], [1, 0]],
    liftF: [[0, 0], [0.22, 0], [0.3, 2, 'snap'], [0.45, 0], [1, 0]],
  }, { dur: 1000, loop: false }),
  // Net: swung back low and flung out (it leaves the hand at 0.5, opening in
  // the air, and lands spread on the water at 0.8)...
  fish_net_cast: skill(0.5, null, {
    hand: [[0, 1.4], [0.38, -0.5], [0.42, -0.55], [0.52, 2.1, 'snap'], [0.62, 1.9, 'out'], [1, 1.4]],
    off: [[0, 1.1], [0.38, 0.6], [0.52, 1.7, 'snap'], [1, 1.1]],
    lean: [[0, 0], [0.38, -0.14], [0.52, 0.16, 'snap'], [0.65, 0.08], [1, 0.02]],
    bx: [[0, 0], [0.38, -2], [0.52, 2, 'snap'], [1, 0]],
    crouch: [[0, 0], [0.38, 2], [0.52, -0.5, 'snap'], [1, 1]],
    liftB: [[0, 0], [0.45, 0], [0.55, 2.5, 'snap'], [0.7, 0], [1, 0]],
  }, { dur: 900, loop: false }),
  // ...the wait, holding the rope while it sinks...
  fish_net: skill(0.5, null, {
    hand: [[0, 1.4], [0.5, 1.48], [1, 1.4]], off: [[0, 1.1], [0.5, 1.05], [1, 1.1]],
    crouch: [[0, 1], [1, 1]], lean: [[0, 0.02], [1, 0.02]],
  }, { dur: 1400 }),
  // ...and the haul: hand over hand as it closes (to 0.45), then heaved out
  // and back into the hands (0.78), the fish flipping out of it.
  fish_net_haul: skill(0.48, null, {
    hand: [[0, 1.4], [0.12, 1.0, 'snap'], [0.2, 1.6], [0.3, 1.0, 'snap'], [0.38, 1.6], [0.48, 2.4, 'snap'], [0.62, 2.2], [0.8, 1.6], [1, 1.4]],
    off: [[0, 1.1], [0.12, 1.6], [0.2, 0.9, 'snap'], [0.3, 1.6], [0.38, 0.9, 'snap'], [0.48, 2.1, 'snap'], [0.8, 1.3], [1, 1.1]],
    lean: [[0, 0.02], [0.12, -0.1, 'snap'], [0.38, -0.08], [0.48, -0.16, 'snap'], [0.7, -0.05], [1, 0]],
    crouch: [[0, 1], [0.38, 2], [0.48, -1, 'snap'], [0.75, 0.5], [1, 0]],
    by: [[0, 0], [0.45, 0], [0.52, -1.5, 'out'], [0.65, 0, 'in'], [1, 0]],
  }, { dur: 1000, loop: false }),
  // Lobster pot: swung out on its rope (it leaves the hands at 0.42, hits the
  // water at 0.62) and let down...
  fish_cage_lower: skill(0.42, null, {
    hand: [[0, 1.3], [0.3, 1.4], [0.42, 1.9, 'snap'], [0.6, 1.3], [1, 1.05]],
    off: [[0, 1.2], [0.3, 1.3], [0.42, 1.7, 'snap'], [0.6, 1.0], [1, 0.9]],
    lean: [[0, 0], [0.3, -0.06], [0.42, 0.14, 'snap'], [1, 0.08]],
    bx: [[0, 0], [0.3, -1], [0.42, 1.5, 'snap'], [1, 0]],
    crouch: [[0, 0], [0.3, 1], [0.42, -0.5, 'snap'], [1, 2]],
  }, { dur: 1000, loop: false }),
  // ...the wait, crouched with the rope in hand...
  fish_cage: skill(0.5, null, {
    hand: [[0, 1.05], [0.5, 1.12], [1, 1.05]], off: [[0, 0.9], [0.5, 0.95], [1, 0.9]],
    crouch: [[0, 2], [1, 2]], lean: [[0, 0.08], [1, 0.08]],
  }, { dur: 1600 }),
  // ...and hauled up hand over hand (it breaks the surface by 0.5), heaved
  // out and back into the hands by 0.82.
  fish_cage_raise: skill(0.62, null, {
    hand: [[0, 1.05], [0.1, 1.9, 'snap'], [0.2, 1.0], [0.3, 1.9, 'snap'], [0.4, 1.0], [0.5, 1.9, 'snap'], [0.62, 2.3], [0.78, 1.5], [1, 1.3]],
    off: [[0, 0.9], [0.1, 1.0], [0.2, 1.9, 'snap'], [0.3, 1.0], [0.4, 1.9, 'snap'], [0.5, 1.1], [0.62, 2.1], [0.78, 1.4], [1, 1.2]],
    crouch: [[0, 2], [0.5, 1], [0.62, -1, 'snap'], [0.8, 0], [1, 0]],
    lean: [[0, 0.08], [0.5, -0.06], [0.62, -0.14, 'snap'], [1, 0]],
    by: [[0, 0], [0.58, 0], [0.65, -1.5, 'out'], [0.78, 0, 'in'], [1, 0]],
  }, { dur: 1000, loop: false }),
  // Harpoon: raised high and aimed down at the water, swaying with the swell...
  fish_harpoon: skill(0.5, null, {
    hand: [[0, 2.5], [0.5, 2.56], [1, 2.5]], prop: [[0, 1.45], [0.5, 1.4], [1, 1.45]],
    off: [[0, 1.6], [0.5, 1.55], [1, 1.6]],
    crouch: [[0, 1], [0.5, 1.4], [1, 1]], lean: [[0, -0.03], [1, -0.03]],
  }, { dur: 1500 }),
  // ...then drawn back and thrown (it leaves the hand at 0.3 and strikes at
  // 0.4), and pulled back in on its line with the catch (0.6-0.86).
  fish_harpoon_throw: skill(0.3, null, {
    hand: [[0, 2.5], [0.22, 2.95], [0.3, 1.5, 'snap'], [0.45, 1.35], [0.55, 1.4], [0.62, 0.8, 'snap'], [0.7, 1.3], [0.76, 0.8, 'snap'], [0.88, 2.3], [1, 2.5]],
    prop: [[0, 1.45], [0.22, 1.25], [0.3, 0.3, 'snap'], [0.85, 0.6], [0.9, 1.4], [1, 1.45]],
    off: [[0, 1.6], [0.22, 1.9], [0.3, 1.0, 'snap'], [0.55, 1.2], [0.62, 1.7, 'snap'], [0.7, 1.0], [0.76, 1.7, 'snap'], [0.88, 1.5], [1, 1.6]],
    lean: [[0, -0.03], [0.22, -0.15], [0.3, 0.2, 'snap'], [0.45, 0.12], [0.62, -0.1, 'snap'], [0.8, -0.08], [1, -0.03]],
    bx: [[0, 0], [0.22, -2], [0.3, 3, 'snap'], [0.45, 2], [0.62, -1], [1, 0]],
    crouch: [[0, 1], [0.22, 1.5], [0.3, -0.5, 'snap'], [0.5, 0.5], [1, 1]],
    liftF: [[0, 0], [0.2, 2.5], [0.3, 0, 'in'], [1, 0]],
    liftB: [[0, 0], [0.28, 0], [0.34, 2, 'snap'], [0.5, 0], [1, 0]],
  }, { dur: 1000, loop: false }),
  // Food held out over the flames, given a little shake, then tossed up and
  // flipped right over as it cooks (the turn wraps a full circle, so it lands
  // the right way up).
  cook: skill(0.7, 'puff', {
    hand: [[0, 1.4], [0.2, 1.45], [0.3, 1.35], [0.4, 1.45], [0.6, 1.25], [0.7, 1.75, 'snap'], [0.8, 1.55], [0.9, 1.4], [1, 1.4]],
    prop: [[0, 0], [0.2, 0.15], [0.3, -0.1], [0.4, 0.15], [0.6, 0.25], [0.7, -1.2, 'snap'], [0.82, -3.1, 'out'], [0.83, 3.18, 'lin'], [0.95, 0.05], [1, 0]],
    off: [[0, 0.8], [1, 0.8]],
    crouch: [[0, 2], [0.6, 2.5], [0.7, 1.2, 'snap'], [0.85, 2], [1, 2]],
    by: [[0, 0], [0.65, 0], [0.72, -1, 'out'], [0.85, 0, 'in'], [1, 0]],
    lean: [[0, 0.08], [1, 0.08]],
  }, { upright: true }),
  // A dish stirred round the pot.
  stir: skill(0.7, 'puff', {
    hand: [[0, 1.1], [0.25, 1.35], [0.5, 1.1], [0.75, 1.35], [1, 1.1]],
    bx: [[0, 0], [0.25, 0.8], [0.5, 0], [0.75, -0.8], [1, 0]],
    off: [[0, 1.0], [1, 1.0]],
    crouch: [[0, 1], [1, 1]],
    lean: [[0, 0.08], [1, 0.08]],
  }),
  // The smith's rhythm on the anvil: a light tap to set the piece, then the
  // heavy blow on the tick, each throwing sparks off the hot metal.
  smith: skill(0.72, 'anvil', {
    hand: [[0, 1.0], [0.18, 1.75], [0.3, 1.0, 'snap'], [0.35, 1.2, 'out'], [0.55, 2.6], [0.6, 2.65], [0.72, 0.95, 'snap'], [0.78, 1.2, 'out'], [1, 1.0]],
    prop: [[0, 0.2], [0.18, -0.1], [0.3, 0.3, 'snap'], [0.55, -0.45], [0.72, 0.4, 'snap'], [1, 0.2]],
    off: [[0, 1.2], [0.3, 1.15], [0.72, 1.1], [0.78, 1.25], [1, 1.2]],
    lean: [[0, 0.05], [0.3, 0.08, 'snap'], [0.55, -0.08], [0.72, 0.14, 'snap'], [1, 0.05]],
    by: [[0, 0], [0.55, -1], [0.72, 0, 'in'], [1, 0]],
    squash: [[0, 0], [0.31, 0.02, 'snap'], [0.4, 0], [0.74, 0.07, 'snap'], [0.88, 0], [1, 0]],
    impact: sparkAt([0.3, 0.5], [0.72]),
  }),
  // Ore pushed into the furnace mouth (smelting is one batch, so one push).
  smelt: skill(0.6, 'puff', {
    hand: [[0, 0.4], [0.4, 1.2], [0.6, 1.75, 'snap'], [1, 0.4]],
    off: [[0, 0.3], [0.4, 1.1], [0.6, 1.6, 'snap'], [1, 0.3]],
    lean: [[0, 0], [0.4, -0.05], [0.6, 0.16, 'snap'], [1, 0]],
    bx: [[0, 0], [0.6, 2, 'snap'], [1, 0]],
  }, { dur: 900, loop: false, upright: true }),
  // Chisel taps at a gem held in the other hand.
  craft: skill(0.7, 'glint', {
    hand: [[0, 1.15], [0.55, 1.45], [0.7, 1.0, 'snap'], [1, 1.15]],
    prop: [[0, 0.1], [0.7, 0.3, 'snap'], [1, 0.1]],
    off: [[0, 1.3], [0.7, 1.25], [0.76, 1.35, 'out'], [1, 1.3]],
    crouch: [[0, 1], [1, 1]],
    lean: [[0, 0.1], [0.55, 0.06], [0.7, 0.14, 'snap'], [1, 0.1]],
    impact: sparkAt([0.7, 0.6]),
  }),
  // A knife drawn along the stave, shavings curling off.
  fletch: skill(0.7, 'shavings', {
    hand: [[0, 1.5], [0.5, 1.65], [0.7, 0.95, 'snap'], [1, 1.5]],
    prop: [[0, 0.4], [0.7, 0.9, 'snap'], [1, 0.4]],
    off: [[0, 1.2], [1, 1.2]],
    crouch: [[0, 1], [1, 1]],
    lean: [[0, 0.06], [1, 0.06]],
  }),
  // Crouched low over the logs, striking the tinderbox twice (a spark each
  // time; the second catches), then leaning in to blow the flame up.
  firemake: skill(0.7, 'embers', {
    hand: [[0, 0.9], [0.18, 1.3], [0.28, 0.6, 'snap'], [0.4, 1.1], [0.58, 1.3], [0.7, 0.55, 'snap'], [0.85, 0.8], [1, 0.9]],
    prop: [[0, 0], [0.28, 0.3, 'snap'], [0.4, 0], [0.7, 0.35, 'snap'], [1, 0]],
    off: [[0, 0.7], [0.28, 0.85], [0.4, 0.7], [0.7, 0.9], [1, 0.7]],
    crouch: [[0, 5], [0.7, 5], [0.82, 6], [1, 5]],
    lean: [[0, 0.15], [0.7, 0.15], [0.82, 0.26], [0.92, 0.22], [1, 0.15]],
    squash: [[0, 0], [0.75, 0], [0.82, -0.05], [0.92, 0.03], [1, 0]],
    impact: sparkAt([0.28, 0.6], [0.7]),
  }, { upright: true }),
  // Herbs ground round the mortar, then a tip of the vial.
  herb: skill(0.7, 'leafbits', {
    hand: [[0, 1.1], [0.2, 1.35], [0.4, 1.1], [0.55, 1.35], [0.7, 1.7, 'snap'], [1, 1.1]],
    bx: [[0, 0], [0.2, 0.8], [0.4, 0], [0.55, 0.8], [0.7, 0], [1, 0]],
    prop: [[0, 0], [0.55, 0], [0.7, 0.9, 'snap'], [1, 0]],
    off: [[0, 1.0], [1, 1.0]],
    crouch: [[0, 1], [1, 1]],
  }, { upright: true }),
  // Crouched by a trap, edging in on tiptoe, a hand lifted for quiet, then
  // reaching in to check the snare.
  hunt: skill(0.7, 'grass', {
    hand: [[0, 0.6], [0.5, 1.1], [0.7, 0.4, 'snap'], [1, 0.6]],
    off: [[0, 0.5], [0.3, 1.6], [0.55, 1.5], [0.7, 0.6], [1, 0.5]],
    crouch: [[0, 5], [0.3, 4], [0.55, 4.5], [0.7, 6, 'snap'], [1, 5]],
    lean: [[0, 0.15], [0.3, 0.08], [0.55, 0.1], [0.7, 0.22, 'snap'], [1, 0.15]],
    bx: [[0, 0], [0.3, -0.8], [0.55, -0.6], [0.7, 1.2, 'snap'], [1, 0]],
    liftF: [[0, 0], [0.15, 1.5], [0.3, 0], [1, 0]], liftB: [[0, 0], [0.35, 0], [0.45, 1.5], [0.55, 0], [1, 0]],
  }, { upright: true }),
  // A quick dart of the hand at the stall, then tucked away.
  stall: skill(0.7, 'coin', {
    hand: [[0, 0.5], [0.55, 1.2], [0.7, 2.0, 'snap'], [0.85, 0.4, 'snap'], [1, 0.5]],
    off: [[0, 0.3], [1, 0.3]],
    lean: [[0, 0.02], [0.7, 0.1, 'snap'], [1, 0.02]],
    liftB: [[0, 0], [0.6, 2], [0.8, 0], [1, 0]],
  }),
  // Pickpocketing: a sly lean in, a dart of the hand, straight back out.
  pickpocket: skill(0.45, 'coin', {
    hand: [[0, 0.3], [0.3, 0.6], [0.45, 1.6, 'snap'], [0.65, 0.2, 'snap'], [1, 0.3]],
    off: [[0, 0.2], [1, 0.2]],
    crouch: [[0, 0], [0.3, 2], [0.8, 2], [1, 0]],
    lean: [[0, 0], [0.3, 0.12], [0.8, 0.12], [1, 0]],
    bx: [[0, 0], [0.45, 2.5, 'snap'], [0.7, 0], [1, 0]],
  }, { dur: 800, loop: false }),
  // Farming: dig a hole, plant a seed in it, or pull the crop up.
  // (Digging is two scoops, hands taking turns, the soil flung back.)
  farm_dig: skill(0.6, 'clods', {
    hand: [[0, 0.4], [0.25, 1.3], [0.38, 0.2, 'snap'], [0.48, 1.2], [0.6, 0.1, 'snap'], [0.72, -0.4, 'out'], [1, 0.4]],
    off: [[0, 0.3], [0.25, 0.4], [0.32, 1.3], [0.45, 0.2, 'snap'], [0.6, 1.0], [1, 0.3]],
    crouch: [[0, 0], [0.2, 5], [0.38, 6, 'snap'], [0.48, 5], [0.6, 6, 'snap'], [0.85, 5], [1, 0]],
    lean: [[0, 0], [0.2, 0.15], [0.38, 0.22, 'snap'], [0.48, 0.15], [0.6, 0.22, 'snap'], [0.85, 0.15], [1, 0]],
  }, { dur: 900, loop: false }),
  farm_plant: skill(0.6, 'clods', {
    hand: [[0, 0.5], [0.4, 1.0], [0.6, 0.2, 'snap'], [1, 0.5]],
    off: [[0, 0.3], [1, 0.3]],
    crouch: [[0, 0], [0.25, 6], [0.85, 6], [1, 0]],
    lean: [[0, 0], [0.25, 0.18], [0.85, 0.18], [1, 0]],
  }, { dur: 900, loop: false, upright: true }),
  // (Harvesting: two tugs on the stalk, then it gives and is lifted high.)
  farm_harvest: skill(0.7, 'leafbits', {
    hand: [[0, 0.3], [0.3, 0.2], [0.4, 0.55, 'snap'], [0.48, 0.2], [0.56, 0.6, 'snap'], [0.62, 0.2], [0.7, 2.4, 'snap'], [1, 1.2]],
    off: [[0, 0.3], [0.3, 0.25], [0.4, 0.5, 'snap'], [0.48, 0.25], [0.56, 0.55, 'snap'], [0.62, 0.25], [0.7, 2.0, 'snap'], [1, 1.0]],
    crouch: [[0, 0], [0.3, 5], [0.4, 4, 'snap'], [0.48, 5.5], [0.56, 4, 'snap'], [0.62, 6], [0.7, 1, 'snap'], [1, 0]],
    lean: [[0, 0], [0.3, 0.16], [0.4, 0.05, 'snap'], [0.48, 0.16], [0.56, 0.04, 'snap'], [0.62, 0.18], [0.7, -0.15, 'snap'], [1, 0]],
    by: [[0, 0], [0.66, 0], [0.74, -2, 'out'], [0.86, 0, 'in'], [1, 0]],
  }, { dur: 900, loop: false }),
  // Agility, by kind of obstacle.
  agility_balance: skill(0.5, null, {
    // Arms out wide, see-sawing against the wobble.
    hand: [[0, 1.7], [0.25, 1.95], [0.5, 1.5], [0.75, 1.85], [1, 1.7]], off: [[0, -1.5], [0.25, -1.25], [0.5, -1.75], [0.75, -1.35], [1, -1.5]],
    lean: [[0, 0.1], [0.5, -0.1], [1, 0.1]],
    liftF: [[0, 0], [0.25, 2], [0.5, 0], [1, 0]], liftB: [[0, 0], [0.5, 0], [0.75, 2], [1, 0]],
  }, { dur: 1200 }),
  agility_climb: skill(0.5, null, {
    hand: [[0, 2.9], [0.5, 2.3], [1, 2.9]], off: [[0, 2.3], [0.5, 2.9], [1, 2.3]],
    by: [[0, 0], [0.25, -2], [0.5, 0], [0.75, -2], [1, 0]],
    liftF: [[0, 3], [0.5, 0], [1, 3]], liftB: [[0, 0], [0.5, 3], [1, 0]],
  }, { dur: 900 }),
  agility_rope: skill(0.5, null, {
    hand: [[0, 3.0], [1, 3.0]], off: [[0, 2.8], [1, 2.8]],
    lean: [[0, 0.25], [0.5, -0.25], [1, 0.25]], bx: [[0, 3], [0.5, -3], [1, 3]], by: [[0, -3], [0.5, -4], [1, -3]],
    liftF: [[0, 3], [1, 3]], liftB: [[0, 3], [1, 3]],
  }, { dur: 1200 }),
  agility_ledge: skill(0.5, null, {
    hand: [[0, 1.9], [1, 1.9]], off: [[0, 1.9], [1, 1.9]],
    lean: [[0, -0.05], [1, -0.05]], bx: [[0, 0], [0.5, 1.5], [1, 0]],
    liftF: [[0, 0], [0.25, 2], [0.5, 0], [1, 0]], liftB: [[0, 0], [0.5, 0], [0.75, 2], [1, 0]],
  }, { dur: 1000 }),
  agility_zip: skill(0.5, null, {
    hand: [[0, 3.1], [1, 3.1]], off: [[0, 3.0], [1, 3.0]],
    lean: [[0, 0.12], [1, 0.12]], by: [[0, -3], [0.5, -4], [1, -3]],
    liftF: [[0, 4], [1, 4]], liftB: [[0, 3], [1, 3]],
  }, { dur: 800 }),
  agility_jump: skill(0.55, null, {
    hand: [[0, 0.5], [0.4, 0.2], [0.6, 2.6, 'snap'], [0.9, 0.6], [1, 0.5]],
    off: [[0, 0.4], [0.4, 0.1], [0.6, 2.4, 'snap'], [0.9, 0.5], [1, 0.4]],
    // A deep crouch, a spring off both feet, feet tucked at the top of the
    // arc, and a squash on landing.
    crouch: [[0, 0], [0.4, 5], [0.55, -2, 'snap'], [0.86, -1], [0.9, 3, 'snap'], [1, 0]],
    by: [[0, 0], [0.55, 0], [0.71, -11, 'out'], [0.88, 0, 'in'], [1, 0]],
    squash: [[0, 0], [0.4, 0.08], [0.55, -0.1, 'snap'], [0.7, 0], [0.9, 0.12, 'snap'], [1, 0]],
    lean: [[0, 0], [0.4, 0.12], [0.55, -0.05], [0.72, 0.08], [0.9, 0.12], [1, 0]],
    liftF: [[0, 0], [0.55, 1], [0.68, 5], [0.85, 0], [1, 0]], liftB: [[0, 0], [0.55, 1], [0.68, 5], [0.85, 0], [1, 0]],
  }, { dur: 1200 }),
  // Kneeling at the monument (or the statue) with hands together.
  pray: skill(0.5, 'holy', {
    hand: [[0, 0.3], [0.25, 1.3], [0.85, 1.3], [1, 0.3]], off: [[0, 0.3], [0.25, 1.25], [0.85, 1.25], [1, 0.3]],
    crouch: [[0, 0], [0.25, 6], [0.85, 6], [1, 0]],
    lean: [[0, 0], [0.25, 0.14], [0.85, 0.14], [1, 0]],
  }, { dur: 1400, loop: false }),
  // Bones laid in the ground, or raised up as an offering.
  bury: skill(0.6, 'clods', {
    hand: [[0, 0.4], [0.35, 1.0], [0.6, 0.3, 'snap'], [1, 0.4]], off: [[0, 0.3], [0.35, 0.8], [1, 0.3]],
    crouch: [[0, 0], [0.35, 5], [0.8, 5], [1, 0]],
    lean: [[0, 0], [0.35, 0.16], [0.8, 0.16], [1, 0]],
  }, { dur: 900, loop: false, upright: true }),
  offer: skill(0.55, 'holy', {
    hand: [[0, 0.4], [0.5, 2.4], [0.65, 2.2], [1, 0.4]], off: [[0, 0.3], [0.5, 2.3], [0.65, 2.1], [1, 0.3]],
    by: [[0, 0], [0.5, -1.5], [1, 0]],
    lean: [[0, 0], [0.5, -0.08], [1, 0]],
  }, { dur: 1100, loop: false, upright: true }),
  // Standing still: a slow, small sway on top of the rig's own breathing.
  idle: { dur: 3200, loop: true, tracks: {
    squash: [[0, 0], [0.5, 0.015], [1, 0]],
    sword: [[0, 0], [0.5, 0.05], [1, 0]], back: [[0, 0], [0.5, -0.06], [1, 0]],
    lean: [[0, 0], [0.5, -0.012], [1, 0]],
  } },
  walk: { dur: 1000, loop: true, tracks: {} },
  // Level up: a hop with the weapon held high.
  cheer: { dur: 1000, loop: false, tracks: {
    crouch: [[0, 0], [0.15, 3], [0.3, -1, 'snap'], [0.7, 0], [1, 0]],
    by: [[0, 0], [0.3, 0], [0.45, -7, 'out'], [0.62, 0, 'in'], [1, 0]],
    squash: [[0, 0], [0.15, 0.06], [0.3, -0.06], [0.6, 0], [0.66, 0.08, 'snap'], [0.8, 0], [1, 0]],
    sword: [[0, 0], [0.3, -1.0, 'snap'], [0.8, -1.0], [1, 0]],
    back: [[0, 0], [0.3, -1.2, 'snap'], [0.8, -1.2], [1, 0]],
    charge: [[0, 0], [0.3, 1, 'snap'], [0.8, 1], [1, 0]],
    lean: [[0, 0], [0.45, -0.08], [1, 0]],
  } },
};

// ---------------- Combat clips, one per weapon family ----------------
// Each runs over one attack (the swing progress 0..1; a swing lasts 120-300ms),
// starts and ends at the class's rest pose, and acts out anticipation (a coil
// back), the strike (a 'snap' key), a short impact hold (a frame or two with
// the weapon parked where it lands, so the blow reads; the game's own hit-stop
// freezes the whole swing on a crit on top of this), follow-through and a
// settle back to rest. Factories keep families consistent; their numbers are
// the knobs: weight shows as a longer wind-up, a later strike and a longer hold.
const T = (keys) => keys;
/** A pulse 0 -> 1 -> 0 landing at `at` (the impact spark, a muzzle flash). */
const pulse = (at, hold = 0.06, fade = 0.1) => [[0, 0], [at - 0.015, 0, 'lin'], [at, 1, 'snap'], [at + hold, 1], [at + hold + fade, 0], [1, 0]];
/** A swung blade or axe: coil back to w, cut through by h, hold, follow through. */
function swingClip({ w, h, wind, swing, reach = 3, lunge = 6, hop = 3, arc, back = 0.35, hold = 0.06, over = 0.12 }) {
  const f = Math.min(0.9, h + hold + 0.14);   // the follow-through peak
  return { trail: arc, tracks: {
    sword: T([[0, 0], [w * 0.4, -wind * 0.3, 'out'], [w, -wind], [h, swing, 'snap'], [h + hold, swing * 0.98, 'lin'], [f, swing * (1 + over), 'out'], [1, 0]]),
    back: T([[0, 0], [w, -0.2], [h, back, 'snap'], [f, back * 0.8], [1, 0]]),
    strike: T([[0, 0], [h - 0.07, 0, 'lin'], [h - 0.02, 1], [f, 1], [Math.min(0.97, f + 0.08), 0], [1, 0]]),
    reach: T([[0, 0], [w, -1.5], [h, reach, 'snap'], [h + hold, reach], [f, reach * 0.7], [1, 0]]),
    bx: T([[0, 0], [w, -3], [h, lunge, 'snap'], [h + hold, lunge], [1, 0]]),
    by: T([[0, 0], [h - 0.08, 0], [h, -hop, 'out'], [Math.min(0.97, h + 0.14), 0, 'in'], [1, 0]]),
    crouch: T([[0, 0], [w, 1.5], [h, -0.5, 'snap'], [f, 0.5], [1, 0]]),
    lean: T([[0, 0], [w, -0.18], [h, 0.22, 'snap'], [h + hold, 0.22], [1, 0]]),
    squash: T([[0, 0], [w, 0.07], [h, -0.08, 'snap'], [Math.min(0.97, h + 0.25), 0], [1, 0]]),
    liftB: T([[0, 0], [w, 0], [h, 2, 'snap'], [f, 0], [1, 0]]),
    impact: T(pulse(h, hold)),
    trail: T([[0, 0], [h - 0.12, 0, 'lin'], [Math.min(0.97, h + 0.12), 1, 'out'], [1, 1]]),
  } };
}
/** A heavy overhead blow: a slow lift onto the toes, a hop, and a slam that
 *  squashes the body on landing, parks the head in the ground and kicks up dust. */
function smashClip({ w, h, wind, swing, reach = 2, hold = 0.08 }) {
  return { trail: { kind: 'arc', cx: 10, cy: -14, r: 27, a0: -2.7, a1: 0.9 }, dust: true, tracks: {
    sword: T([[0, 0], [w * 0.5, -wind * 0.6, 'io'], [w, -wind], [w + 0.05, -wind - 0.1, 'out'], [h, swing, 'snap'], [h + hold, swing * 1.02, 'lin'], [h + hold + 0.08, swing * 0.92], [1, 0]]),
    back: T([[0, 0], [w, -0.3], [h, 0.35, 'snap'], [1, 0]]),
    strike: T([[0, 0], [h - 0.06, 0, 'lin'], [h - 0.01, 1], [h + hold + 0.1, 1], [0.92, 0], [1, 0]]),
    reach: T([[0, 0], [h, reach, 'snap'], [h + hold, reach], [0.9, 0], [1, 0]]),
    by: T([[0, 0], [w, -4, 'out'], [h, 0, 'in'], [1, 0]]),
    crouch: T([[0, 0], [w * 0.5, 1], [w, -1.5], [h, 3, 'snap'], [h + hold + 0.1, 2.5], [1, 0]]),
    squash: T([[0, 0], [w * 0.4, 0.05], [w, -0.06], [h + 0.02, 0.14, 'snap'], [h + hold + 0.1, 0.02], [1, 0]]),
    lean: T([[0, 0], [w, -0.22], [h, 0.26, 'snap'], [h + hold, 0.26], [1, 0]]),
    bx: T([[0, 0], [w, -2], [h, 5, 'snap'], [h + hold, 5], [1, 0]]),
    liftF: T([[0, 0], [w, 2], [h, 0, 'in'], [1, 0]]),
    impact: T(pulse(h, hold, 0.14)),
    trail: T([[0, 0], [h - 0.1, 0, 'lin'], [h + 0.06, 1, 'out'], [1, 1]]),
  } };
}
/** A straight jab: draw back, drive the point out along the ground, no arc at all. */
function thrustClip({ draw = 0.28, hit = 0.48, reach = 13, pull = 4, hold = 0.07 }) {
  return { trail: { kind: 'line', x0: 16, x1: 56, y: -10 }, tracks: {
    strike: T([[0, 0], [0.1, 1], [0.82, 1], [1, 0]]),
    reach: T([[0, 0], [draw, -pull], [hit, reach, 'snap'], [hit + hold, reach], [hit + hold + 0.12, reach * 0.8], [1, 0]]),
    back: T([[0, 0], [draw, -0.15], [hit, 0.3, 'snap'], [1, 0]]),
    bx: T([[0, 0], [draw, -2.5], [hit, 7, 'snap'], [hit + hold, 7], [1, 0]]),
    lean: T([[0, 0], [draw, -0.1], [hit, 0.14, 'snap'], [hit + hold, 0.14], [1, 0]]),
    crouch: T([[0, 0], [draw, 1.5], [hit, 1, 'snap'], [1, 0]]),
    squash: T([[0, 0], [draw, 0.05], [hit, -0.06, 'snap'], [0.8, 0], [1, 0]]),
    liftB: T([[0, 0], [draw, 0], [hit, 2.5, 'snap'], [hit + 0.2, 0], [1, 0]]),
    impact: T(pulse(hit, hold)),
    trail: T([[0, 0], [hit - 0.1, 0, 'lin'], [hit + 0.14, 1, 'out'], [1, 1]]),
  } };
}
/** A bow: the back hand draws to full and holds the aim, looses with a snap,
 *  and the body is kicked back. */
function bowClip({ full, loose }) {
  return { tracks: {
    draw: T([[0, 0], [full * 0.25, 0.15, 'in'], [full, 1, 'out'], [loose - 0.01, 1], [loose + 0.04, 0, 'snap'], [1, 0]]),
    release: T([[0, 0], [loose - 0.01, 0, 'lin'], [loose + 0.04, 1, 'snap'], [loose + 0.3, 0], [1, 0]]),
    lean: T([[0, 0], [full, -0.08], [loose + 0.04, -0.18, 'snap'], [1, 0]]),
    bx: T([[0, 0], [full, -1], [loose, -1], [loose + 0.04, -3.5, 'snap'], [1, 0]]),
    crouch: T([[0, 0], [full, 1], [loose, 1], [loose + 0.1, 0], [1, 0]]),
    squash: T([[0, 0], [full, 0.03], [loose + 0.04, -0.05, 'snap'], [0.85, 0], [1, 0]]),
  } };
}
/** A thrown star or ring: wind back, whip the arm through, let go, follow through. */
function throwClip({ w = 0.3, h = 0.45, wide = false }) {
  return { trail: { kind: 'line', x0: 18, x1: 46, y: -14 }, tracks: {
    sword: T([[0, 0], [w, wide ? -1.2 : -1.0], [h, 1.2, 'snap'], [h + 0.05, 1.25], [1, 0]]),
    back: T([[0, 0], [w, 0.5], [h, wide ? -0.7 : -0.4, 'snap'], [1, 0]]),
    strike: T([[0, 0], [h - 0.07, 0, 'lin'], [h - 0.02, 1], [h + 0.15, 1], [h + 0.3, 0], [1, 0]]),
    reach: T([[0, 0], [w, -1], [h, 5, 'snap'], [h + 0.05, 5], [h + 0.35, 0], [1, 0]]),
    draw: T([[0, 0], [w, 1], [h, 0, 'snap'], [1, 0]]),
    release: T([[0, 0], [h - 0.04, 0, 'lin'], [h, 1, 'snap'], [h + 0.4, 0], [1, 0]]),
    lean: T([[0, 0], [w, -0.16], [h, 0.2, 'snap'], [h + 0.05, 0.2], [1, 0]]),
    bx: T([[0, 0], [w, -2.5], [h, 3.5, 'snap'], [1, 0]]),
    crouch: T([[0, 0], [w, 1], [h, -0.5, 'snap'], [1, 0]]),
    liftF: T([[0, 0], [w, 2.5], [h, 0, 'in'], [1, 0]]),
    liftB: T([[0, 0], [h, 0], [h + 0.06, 2, 'snap'], [h + 0.25, 0], [1, 0]]),
    trail: T([[0, 0], [h - 0.06, 0, 'lin'], [h + 0.12, 1, 'out'], [1, 1]]),
  } };
}
/** A spell: gather (charge, rising a little), fling (cast), settle. */
function castClip({ gather, fling, rise = 8, settle = 1 }) {
  return { tracks: {
    charge: T([[0, 0], [gather, 1], [fling + 0.02, 1], [Math.min(0.98, fling + 0.25), 0], [1, 0]]),
    cast: T([[0, 0], [gather, 0, 'lin'], [fling, 1, 'back'], [Math.min(0.99, fling + 0.25 * settle), 0], [1, 0]]),
    by: T([[0, 0], [gather, -rise, 'out'], [fling, -rise], [1, 0, 'in']]),
    bx: T([[0, 0], [gather, -1], [fling, 5, 'snap'], [1, 0]]),
    lean: T([[0, 0], [gather, -0.06], [fling, 0.16, 'snap'], [1, 0]]),
    squash: T([[0, 0], [gather, -0.05], [fling, -0.08, 'snap'], [0.9, 0], [1, 0]]),
    sword: T([[0, 0], [gather, -0.35], [fling, 0.6, 'snap'], [1, 0]]),
    strike: T([[0, 0], [fling - 0.06, 0, 'lin'], [fling, 1], [fling + 0.12, 1], [Math.min(0.98, fling + 0.3), 0], [1, 0]]),
  } };
}
const SLASH_ARC = { kind: 'arc', cx: 12, cy: -16, r: 27, a0: -2.2, a1: 1.0 };
Object.assign(CLIPS, {
  slash: swingClip({ w: 0.28, h: 0.48, wind: 0.65, swing: 1.75, arc: SLASH_ARC }),
  slash_quick: swingClip({ w: 0.2, h: 0.38, wind: 0.4, swing: 1.45, lunge: 4, hop: 2, hold: 0.05, arc: SLASH_ARC }),
  chop: swingClip({ w: 0.3, h: 0.5, wind: 0.8, swing: 1.6, reach: 2, arc: { kind: 'arc', cx: 12, cy: -16, r: 24, a0: -2.5, a1: 0.8 } }),
  // The katana's draw-cut: a low, still coil, then one long horizontal cut and a lunge.
  iai: swingClip({ w: 0.4, h: 0.56, wind: 0.95, swing: 1.5, lunge: 10, hop: 1, hold: 0.08, over: 0.18, arc: { kind: 'arc', cx: 10, cy: -14, r: 30, a0: -1.6, a1: 1.3 } }),
  stab: swingClip({ w: 0.14, h: 0.28, wind: 0.3, swing: 1.2, reach: 5, lunge: 5, hop: 1, hold: 0.05, over: 0.05, arc: { kind: 'line', x0: 16, x1: 42, y: -12 } }),
  hook: swingClip({ w: 0.15, h: 0.32, wind: 0.5, swing: 1.35, reach: 3, lunge: 4, hop: 1, arc: { kind: 'arc', cx: 24, cy: -10, r: 15, a0: -2.0, a1: 0.8 } }),
  smash_light: smashClip({ w: 0.35, h: 0.56, wind: 0.7, swing: 1.45, hold: 0.06 }),
  smash: smashClip({ w: 0.48, h: 0.68, wind: 1.05, swing: 1.95, hold: 0.1 }),
  smash_axe: smashClip({ w: 0.42, h: 0.64, wind: 0.95, swing: 1.75, reach: 3 }),
  sweep: swingClip({ w: 0.38, h: 0.6, wind: 0.85, swing: 2.0, reach: 4, lunge: 7, hop: 2, back: 0.5, hold: 0.08, over: 0.1, arc: { kind: 'arc', cx: 4, cy: -10, r: 33, a0: -1.9, a1: 1.6 } }),
  thrust: thrustClip({}),
  // The halberd: a heavy two-handed chop that reaches out over the foe.
  reach_chop: swingClip({ w: 0.42, h: 0.64, wind: 0.8, swing: 1.45, reach: 8, lunge: 6, back: 0.5, hold: 0.08, arc: { kind: 'arc', cx: 14, cy: -18, r: 36, a0: -2.3, a1: 0.7 } }),
  reach_thrust: swingClip({ w: 0.3, h: 0.52, wind: 0.45, swing: 0.8, reach: 9, lunge: 7, hop: 1, over: 0, arc: { kind: 'line', x0: 18, x1: 56, y: -10 } }),
  staff_spin: swingClip({ w: 0.25, h: 0.55, wind: 0.85, swing: 2.4, reach: 4, lunge: 5, arc: { kind: 'arc', cx: 8, cy: -14, r: 24, a0: -3.0, a1: 1.5 } }),
  // The whip: a wide wind-up, then a lash that cracks far out in front.
  lash: swingClip({ w: 0.27, h: 0.52, wind: 0.75, swing: 1.8, reach: 8, lunge: 4, hop: 2, hold: 0.07, arc: { kind: 'arc', cx: 14, cy: -12, r: 40, a0: -1.7, a1: 0.9 } }),
  // The fan: a light flick of the wrist, quick and wide.
  fan_sweep: swingClip({ w: 0.2, h: 0.4, wind: 0.5, swing: 1.6, reach: 4, lunge: 4, hop: 2, hold: 0.04, over: 0.2, arc: { kind: 'arc', cx: 8, cy: -14, r: 26, a0: -2.6, a1: 1.2 } }),
  throw: throwClip({}),
  throw_wide: throwClip({ w: 0.32, h: 0.5, wide: true }),
  bow_quick: bowClip({ full: 0.4, loose: 0.46 }),
  bow: bowClip({ full: 0.5, loose: 0.58 }),
  cast: castClip({ gather: 0.6, fling: 0.74 }),
  flick: castClip({ gather: 0.3, fling: 0.42, rise: 3, settle: 1.4 }),
  orb: castClip({ gather: 0.55, fling: 0.68, rise: 10 }),
});

// ---------------- Dual wielding: both hands strike ----------------
// The main hand acts on sword/strike/reach, the off hand on back (the back
// arm's swing; negative is forward), strike2 (its extended drawing) and reach2.
// The game deals a dual-wield attack as a main-hand hit plus an off-hand hit
// together, so each clip lands both blows within the one swing, the off hand's
// second; every dual weapon kind has two clips, played in turn.
/** One hand's blow: coil at c, land at h, hold, recover by r. */
function blow(c, h, r, { wind = 0.5, swing = 1.4, reach = 5, hold = 0.06 } = {}) {
  return {
    at: h,
    rot: [[c, -wind], [h, swing, 'snap'], [h + hold, swing * 0.97, 'lin'], [r, 0]],
    swap: [[h - 0.06, 0, 'lin'], [h - 0.015, 1], [h + hold + 0.06, 1], [r - 0.03, 0]],
    reach: [[c, -2], [h, reach, 'snap'], [h + hold, reach * 0.95], [r, 0]],
  };
}
/** A dual-wield clip from its main-hand and off-hand blows (each null, one or
 *  two) plus whole-body tracks. Off-hand angles are mirrored (negative is forward). */
function dualClip(main, off, body, trails) {
  const join = (list, key, sign = 1) => T([[0, 0], ...list.flatMap((b) => b[key].map(([t, v, e]) => [t, v * sign, e])), [1, 0]]);
  return { ...trails, tracks: {
    sword: join(main, 'rot'), strike: join(main, 'swap'), reach: join(main, 'reach'),
    back: join(off, 'rot', -1.35), strike2: join(off, 'swap'), reach2: join(off, 'reach'),
    trail: trailAt(main[0].at), trail2: trailAt(off[0].at),
    ...body,
  } };
}
/** The body's lunge for a run of blows landing at the given times. */
function lunges(hits, { push = 4, lean = 0.14, hop = 0 } = {}) {
  const bx = [[0, 0]], ln = [[0, 0]], sq = [[0, 0]], by = [[0, 0]];
  for (const h of hits) {
    bx.push([h - 0.1, -1.5], [h, push, 'snap'], [h + 0.06, push]);
    ln.push([h - 0.1, -0.08], [h, lean, 'snap'], [h + 0.06, lean]);
    sq.push([h - 0.1, 0.05], [h, -0.06, 'snap']);
    if (hop) by.push([h - 0.06, 0], [h, -hop, 'out'], [h + 0.08, 0, 'in']);
  }
  for (const k of [bx, ln, sq, by]) k.push([1, 0]);
  return { bx: T(bx), lean: T(ln), squash: T(sq), by: T(by) };
}
const trailAt = (h, hold = 0.06) => T([[0, 0], [h - 0.1, 0, 'lin'], [h + hold + 0.06, 1, 'out'], [1, 1]]);
const impacts = (...hits) => T([[0, 0], ...hits.flatMap((h) => [[h - 0.015, 0, 'lin'], [h, 1, 'snap'], [h + 0.05, 1], [h + 0.12, 0]]), [1, 0]]);
Object.assign(CLIPS, {
  // Daggers, A: quick alternating stabs, the main hand then the off hand.
  stab_dual: dualClip([blow(0.1, 0.22, 0.42, { wind: 0.4, swing: 1.25, reach: 6 })], [blow(0.42, 0.56, 0.8, { wind: 0.3, swing: 1.45, reach: 6 })],
    { ...lunges([0.22, 0.56]), impact: impacts(0.22, 0.56) },
    { trail: { kind: 'line', x0: 16, x1: 44, y: -12 }, trail2: { kind: 'line', x0: 12, x1: 40, y: -6 } }),
  // Daggers, B: both blades raised crossed, then a cross-cut through the foe.
  cross_dual: dualClip([blow(0.3, 0.46, 0.78, { wind: 0.9, swing: 1.6, reach: 5, hold: 0.08 })], [blow(0.3, 0.48, 0.8, { wind: 0.9, swing: 1.6, reach: 4, hold: 0.08 })],
    { ...lunges([0.47], { push: 6, lean: 0.2, hop: 3 }), crouch: T([[0, 0], [0.3, 2], [0.47, -0.5, 'snap'], [1, 0]]), impact: impacts(0.47) },
    { trail: { kind: 'seg', x0: 14, y0: -32, x1: 42, y1: -2 }, trail2: { kind: 'seg', x0: 14, y0: -2, x1: 42, y1: -32 } }),
  // Scimitars, A: a two-blade flurry, a main-hand slash then an off-hand backslash.
  scim_dual: dualClip([blow(0.12, 0.28, 0.5, { wind: 0.55, swing: 1.6, reach: 3 })], [blow(0.46, 0.62, 0.86, { wind: 0.4, swing: 1.6, reach: 5 })],
    { ...lunges([0.28, 0.62], { push: 5, lean: 0.17, hop: 2 }), impact: impacts(0.28, 0.62) },
    { trail: SLASH_ARC, trail2: { kind: 'arc', cx: 8, cy: -12, r: 24, a0: 1.3, a1: -1.4 } }),
  // Scimitars, B: both blades swept wide, then crossed in an X slash.
  scim_x: dualClip([blow(0.32, 0.5, 0.82, { wind: 1.0, swing: 1.75, reach: 4, hold: 0.08 })], [blow(0.32, 0.5, 0.84, { wind: 0.9, swing: 1.75, reach: 5, hold: 0.08 })],
    { ...lunges([0.5], { push: 7, lean: 0.22, hop: 3 }), crouch: T([[0, 0], [0.32, 2.5], [0.5, -0.5, 'snap'], [1, 0]]), impact: impacts(0.5) },
    { trail: { kind: 'seg', x0: 12, y0: -36, x1: 46, y1: 0 }, trail2: { kind: 'seg', x0: 12, y0: 0, x1: 46, y1: -36 } }),
  // Kerambits, A: hooked rips, raised high and torn down, one hand then the other.
  rip_dual: dualClip([blow(0.1, 0.24, 0.46, { wind: 0.8, swing: 1.55, reach: 3 })], [blow(0.42, 0.58, 0.84, { wind: 0.6, swing: 1.7, reach: 4 })],
    { ...lunges([0.24, 0.58], { push: 4, lean: 0.18 }), crouch: T([[0, 0], [0.1, 2], [0.58, 2], [1, 0]]), impact: impacts(0.24, 0.58) },
    { trail: { kind: 'arc', cx: 26, cy: -10, r: 14, a0: -2.0, a1: 0.9 }, trail2: { kind: 'arc', cx: 22, cy: -8, r: 13, a0: -2.2, a1: 1.1 } }),
  // Kerambits, B: the off hand hooks in first, then the main hand rips through with a hop.
  rip_dual_b: dualClip([blow(0.42, 0.6, 0.86, { wind: 0.9, swing: 1.7, reach: 5, hold: 0.07 })], [blow(0.08, 0.24, 0.48, { wind: 0.5, swing: 1.5, reach: 3 })],
    { ...lunges([0.24, 0.6], { push: 5, lean: 0.18, hop: 2 }), crouch: T([[0, 0], [0.08, 2], [0.45, 2.5], [0.6, -0.5, 'snap'], [1, 0]]), impact: impacts(0.24, 0.6) },
    { trail: { kind: 'arc', cx: 26, cy: -12, r: 16, a0: -2.0, a1: 1.0 }, trail2: { kind: 'arc', cx: 22, cy: -8, r: 13, a0: -2.2, a1: 1.1 } }),
});
// Clips that don't fit a family are written out in full.
Object.assign(CLIPS, {
  // Claws: a three-hit flurry, a paw on each hand taking turns (front, back, front).
  flurry: { trail: { kind: 'claw', x: 30, y: -14 }, trail2: { kind: 'claw', x: 26, y: -6 }, tracks: {
    strike: T([[0, 0], [0.08, 0, 'lin'], [0.13, 1, 'snap'], [0.24, 1], [0.3, 0], [0.56, 0, 'lin'], [0.62, 1, 'snap'], [0.76, 1], [0.84, 0], [1, 0]]),
    reach: T([[0, 0], [0.06, -1.5], [0.14, 6, 'snap'], [0.22, 5], [0.32, 0], [0.54, -1.5], [0.63, 7, 'snap'], [0.72, 6.5], [0.86, 0], [1, 0]]),
    sword: T([[0, 0], [0.06, -0.3], [0.14, 0.6, 'snap'], [0.3, 0], [0.54, -0.4], [0.63, 0.7, 'snap'], [0.86, 0], [1, 0]]),
    back: T([[0, 0], [0.26, 0.4], [0.38, -1.3, 'snap'], [0.46, -1.25], [0.56, 0], [1, 0]]),
    strike2: T([[0, 0], [0.32, 0, 'lin'], [0.37, 1, 'snap'], [0.48, 1], [0.54, 0], [1, 0]]),
    reach2: T([[0, 0], [0.28, -1.5], [0.38, 6, 'snap'], [0.46, 5], [0.56, 0], [1, 0]]),
    bx: T([[0, 0], [0.14, 2.5, 'snap'], [0.3, 1.5], [0.38, 4, 'snap'], [0.54, 3], [0.63, 7, 'snap'], [0.72, 7], [1, 0]]),
    lean: T([[0, 0], [0.14, 0.1, 'snap'], [0.26, -0.02], [0.38, 0.12, 'snap'], [0.52, 0], [0.63, 0.18, 'snap'], [0.72, 0.18], [1, 0]]),
    crouch: T([[0, 0], [0.1, 1.5], [0.6, 2], [0.63, 0, 'snap'], [1, 0]]),
    impact: impacts(0.14, 0.38, 0.63),
    trail: T([[0, 0], [0.06, 0, 'lin'], [0.22, 1, 'out'], [0.54, 1], [0.55, 0, 'lin'], [0.72, 1, 'out'], [1, 1]]),
    trail2: trailAt(0.38, 0.04),
  } },
  // The Merchant's cane: a flourish while the off hand flips a coin at the foe.
  coin_toss: { tracks: {
    sword: T([[0, 0], [0.3, -0.45], [0.5, 0.65, 'snap'], [0.56, 0.65], [1, 0]]),
    back: T([[0, 0], [0.3, 0.4], [0.48, -1.9, 'snap'], [0.54, -1.85], [0.72, -0.4], [1, 0]]),
    by: T([[0, 0], [0.4, 0], [0.5, -2, 'out'], [0.65, 0, 'in'], [1, 0]]),
    lean: T([[0, 0], [0.3, -0.1], [0.5, 0.12, 'snap'], [1, 0]]),
    squash: T([[0, 0], [0.3, 0.05], [0.5, -0.05], [0.8, 0], [1, 0]]),
    liftF: T([[0, 0], [0.3, 2], [0.48, 0, 'in'], [1, 0]]),
  } },
  // Two pistols, A: the front gun swings up level and fires, then the back gun,
  // each with its own kick, flash and a step back.
  pistols: { tracks: {
    draw: T([[0, 0], [0.12, 1, 'out'], [0.78, 1], [1, 0]]),
    release: T([[0, 0], [0.17, 0, 'lin'], [0.2, 1, 'snap'], [0.26, 1], [0.42, 0], [1, 0]]),
    kick2: T([[0, 0], [0.5, 0, 'lin'], [0.53, 1, 'snap'], [0.59, 1], [0.75, 0], [1, 0]]),
    bx: T([[0, 0], [0.2, 0], [0.24, -2.5, 'snap'], [0.4, -0.5], [0.53, -0.5], [0.57, -3, 'snap'], [0.75, 0], [1, 0]]),
    lean: T([[0, 0], [0.12, 0.04], [0.24, -0.1, 'snap'], [0.4, 0], [0.57, -0.1, 'snap'], [0.75, 0], [1, 0]]),
    squash: T([[0, 0], [0.2, 0], [0.24, 0.04, 'snap'], [0.4, 0], [0.57, 0.04, 'snap'], [0.75, 0], [1, 0]]),
  } },
  // Two pistols, B: the back gun opens up first, then the front gun snaps up for the second shot.
  pistols_b: { tracks: {
    draw: T([[0, 0], [0.3, 0.2], [0.44, 1, 'out'], [0.8, 1], [1, 0]]),
    kick2: T([[0, 0], [0.15, 0, 'lin'], [0.18, 1, 'snap'], [0.24, 1], [0.4, 0], [1, 0]]),
    release: T([[0, 0], [0.5, 0, 'lin'], [0.53, 1, 'snap'], [0.59, 1], [0.75, 0], [1, 0]]),
    bx: T([[0, 0], [0.18, 0], [0.22, -2.5, 'snap'], [0.4, 0], [0.53, 0], [0.57, -3, 'snap'], [0.75, 0], [1, 0]]),
    lean: T([[0, 0], [0.22, -0.1, 'snap'], [0.4, 0.04], [0.57, -0.12, 'snap'], [0.75, 0], [1, 0]]),
    squash: T([[0, 0], [0.18, 0], [0.22, 0.04, 'snap'], [0.4, 0], [0.57, 0.04, 'snap'], [0.75, 0], [1, 0]]),
  } },
  // One pistol: up level, one shot, a bigger kick.
  pistol_one: { tracks: {
    draw: T([[0, 0], [0.18, 1, 'out'], [0.7, 1], [1, 0]]),
    release: T([[0, 0], [0.27, 0, 'lin'], [0.3, 1, 'snap'], [0.36, 1], [0.55, 0], [1, 0]]),
    bx: T([[0, 0], [0.3, 0], [0.34, -3.5, 'snap'], [0.6, 0], [1, 0]]),
    lean: T([[0, 0], [0.18, 0.04], [0.34, -0.14, 'snap'], [0.6, 0], [1, 0]]),
    squash: T([[0, 0], [0.3, 0], [0.34, 0.05, 'snap'], [0.6, 0], [1, 0]]),
  } },
  // The rifle: crouch and brace, a long still aim, one heavy kick that rocks the body.
  rifle: { tracks: {
    draw: T([[0, 0], [0.45, 1, 'out'], [0.62, 1], [0.66, 0.7, 'snap'], [0.85, 1], [1, 0]]),
    release: T([[0, 0], [0.62, 0, 'lin'], [0.65, 1, 'snap'], [0.72, 1], [1, 0]]),
    crouch: T([[0, 0], [0.4, 2.5], [0.62, 2.5], [0.66, 1], [1, 0]]),
    bx: T([[0, 0], [0.62, 0], [0.66, -6, 'snap'], [0.8, -4], [1, 0]]),
    lean: T([[0, 0], [0.5, -0.04], [0.62, -0.04], [0.66, -0.26, 'snap'], [1, 0]]),
    squash: T([[0, 0], [0.4, 0.03], [0.66, 0.07, 'snap'], [0.85, 0], [1, 0]]),
    liftF: T([[0, 0], [0.62, 0], [0.66, 2.5, 'snap'], [0.85, 0], [1, 0]]),
  } },
  // The crossbow: crank it quickly, settle the aim, then loose with a sharp kick.
  crossbow: { tracks: {
    draw: T([[0, 0], [0.18, 1], [0.6, 1], [0.63, 0, 'snap'], [1, 0]]),
    release: T([[0, 0], [0.6, 0, 'lin'], [0.64, 1, 'snap'], [0.95, 0], [1, 0]]),
    crouch: T([[0, 0], [0.18, -1], [0.3, 1], [0.6, 1], [0.7, 0], [1, 0]]),
    bx: T([[0, 0], [0.6, 0], [0.65, -4.5, 'snap'], [1, 0]]),
    lean: T([[0, 0], [0.18, 0.06], [0.6, 0], [0.65, -0.22, 'snap'], [1, 0]]),
  } },
  // Bare fists: a jab, then a cross from the other hand.
  punch: { trail: { kind: 'line', x0: 16, x1: 34, y: -12 }, tracks: {
    strike: T([[0, 0], [0.2, 0, 'lin'], [0.25, 1, 'snap'], [0.36, 1], [0.48, 0], [1, 0]]),
    reach: T([[0, 0], [0.1, -1.5], [0.25, 5, 'snap'], [0.32, 5], [0.48, 0], [1, 0]]),
    back: T([[0, 0], [0.4, 0.3], [0.6, -1.3, 'snap'], [0.66, -1.25], [0.85, 0], [1, 0]]),
    bx: T([[0, 0], [0.1, -1], [0.25, 3, 'snap'], [0.45, 0], [0.6, 2.5, 'snap'], [1, 0]]),
    lean: T([[0, 0], [0.1, -0.05], [0.25, 0.1, 'snap'], [0.45, 0], [0.6, 0.1, 'snap'], [1, 0]]),
    impact: impacts(0.25, 0.6),
    trail: T([[0, 0], [0.15, 0, 'lin'], [0.3, 1, 'out'], [1, 1]]),
  } },
});
for (const c of Object.values(CLIPS)) { c.dur ??= 0; c.loop ??= false; c.beat ??= 0; }
export const HERO_CLIPS = CLIPS;

// Weapon type -> clip. Every weapon type in items.js (main and secondary) is
// covered; a missing or unknown type throws a punch.
export const WEAPON_CLIP = {
  dagger: 'stab', sword: 'slash', scimitar: 'slash_quick', parang: 'chop', katana: 'iai', kerambit: 'hook',
  mace: 'smash_light', warhammer: 'smash', battleaxe: 'smash_axe', '2h_sword': 'sweep',
  spear: 'thrust', halberd: 'reach_chop', longsword: 'reach_thrust', toya: 'staff_spin',
  claws: 'flurry', whip: 'lash', fan: 'fan_sweep', cane: 'coin_toss', shuriken: 'throw', chakram: 'throw_wide',
  shortbow: 'bow_quick', longbow: 'bow', crossbow: 'crossbow', pistol: 'pistol_one', rifle: 'rifle',
  staff: 'cast', wand: 'flick', orb: 'orb',
};
// Dual-wield kinds (equipment.js dualType) -> their two clips, played in turn.
export const DUAL_CLIPS = {
  dagger: ['stab_dual', 'cross_dual'], scimitar: ['scim_dual', 'scim_x'],
  kerambit: ['rip_dual', 'rip_dual_b'], pistol: ['pistols', 'pistols_b'],
};
/** The clip for an attack with this weapon type; `variant` counts attacks, so
 *  dual wielders alternate between their two clips. */
export function weaponClipId(type, dualWield = false, variant = 0) {
  const pair = dualWield && DUAL_CLIPS[type];
  if (pair) return pair[variant % pair.length];
  return WEAPON_CLIP[type] || 'punch';
}

// ---------------- Life-skill actions -> clips ----------------
const FISH_CLIP = { net: 'fish_net', rod: 'fish_rod', lobster_pot: 'fish_cage', harpoon: 'fish_harpoon' };
// Each fishing tool's three parts (see fishFrame): the cast (none for the
// harpoon, which is simply raised and aimed), the wait, and the haul played
// when the game lands a fish; waitMin is the least time the wait is shown.
export const FISHING = {
  rod: { cast: 'fish_rod_cast', wait: 'fish_rod', haul: 'fish_rod_reel', waitMin: 700 },
  net: { cast: 'fish_net_cast', wait: 'fish_net', haul: 'fish_net_haul', waitMin: 600 },
  lobster_pot: { cast: 'fish_cage_lower', wait: 'fish_cage', haul: 'fish_cage_raise', waitMin: 600 },
  harpoon: { cast: null, wait: 'fish_harpoon', haul: 'fish_harpoon_throw', waitMin: 500 },
};
// With no catch reported (the bus missing), the haul plays after this anyway.
const FISH_WAIT_MAX = 2600;
const AGILITY_CLIP = { agility_balance: 'agility_balance', agility_net: 'agility_climb', agility_rope: 'agility_rope', agility_ledge: 'agility_ledge', agility_zip: 'agility_zip' };
// Every player action that is a life skill (the rest: walking, talking, shops).
export const SKILL_ACTION_TYPES = ['woodcut', 'mine', 'fish', 'cook', 'cookdish', 'smelt', 'smith', 'craft', 'hunt',
  'recipe', 'firemake', 'farm', 'thieve', 'stall', 'agility', 'pray', 'rest', 'bury', 'offer'];
/** The clip for a player action, or null for anything that isn't a life skill. */
export function actionClipId(a) {
  if (!a) return null;
  switch (a.type) {
    case 'woodcut': return 'woodcut';
    case 'mine': return 'mine';
    case 'fish': return FISH_CLIP[a.obj?.def?.tool] || 'fish_net';
    case 'cook': return 'cook';
    case 'cookdish': return 'stir';
    case 'smelt': return 'smelt';
    case 'smith': return 'smith';
    case 'craft': return 'craft';
    case 'hunt': return 'hunt';
    case 'recipe': return a.skill === 'herblore' ? 'herb' : 'fletch';
    case 'firemake': return 'firemake';
    case 'farm': {
      const o = a.obj;
      if (o?.crop) return o.growLeft > 0 ? null : 'farm_harvest';   // just looking at a growing crop
      return a.seed || !o ? 'farm_plant' : 'farm_dig';
    }
    case 'thieve': return 'pickpocket';
    case 'stall': return 'stall';
    case 'agility': return AGILITY_CLIP[a.obj?.objId] || 'agility_jump';
    case 'pray': case 'rest': return 'pray';
    case 'bury': return 'bury';
    case 'offer': return 'offer';
    default: return null;
  }
}
// Actions the game resolves on arrival in one go; their clip plays once after.
const ARRIVAL = new Set(['farm', 'thieve', 'pray', 'rest', 'bury', 'offer']);

/** The item drawn in the hero's hand for an action: their own tool where one
 *  is needed (the one wielded, else the one in the pack), else what they work. */
function itemWithTool(game, tag) {
  const w = game?.equipment?.get?.('weapon');
  if (w && ITEMS[w]?.tool === tag) return w;
  const slot = game?.inventory?.slots?.find((s) => s && ITEMS[s.id]?.tool === tag);
  if (slot) return slot.id;
  return Object.keys(ITEMS).find((id) => ITEMS[id].tool === tag) || null;
}
export function actionPropId(game, a) {
  if (!a) return null;
  const first = (r) => (Array.isArray(r?.inputs?.[0]) ? r.inputs[0][0] : r?.inputs?.[0]?.id) || null;
  switch (a.type) {
    case 'woodcut': return itemWithTool(game, 'axe');
    case 'mine': return itemWithTool(game, 'pickaxe');
    case 'fish': return itemWithTool(game, a.obj?.def?.tool || 'net');
    case 'cook': return a.rawId || null;
    case 'cookdish': return 'pot';
    case 'smelt': return first(a.recipe);
    case 'smith': return itemWithTool(game, 'hammer');
    case 'craft': return a.recipe?.tool ? itemWithTool(game, a.recipe.tool) : first(a.recipe);
    case 'hunt': return itemWithTool(game, 'snare');
    case 'recipe': return a.skill === 'herblore' ? first(a.recipe) : itemWithTool(game, 'knife');
    case 'firemake': return itemWithTool(game, 'tinderbox');
    case 'farm': return a.seed || null;
    case 'bury': case 'offer': return 'bones';
    default: return null;
  }
}

// ---------------- Sampling ----------------
/** Sample a clip at u (0..1) into a fresh animation frame: { id, kind, ch, ... }. */
export function sampleHeroClip(id, u, info = {}) {
  const clip = CLIPS[id] || CLIPS.idle;
  const ch = {};
  for (const name of HERO_CHANNELS) ch[name] = sampleTrack(clip.tracks[name], u);
  ch.mix = clip.hands ? 1 : 0;
  return { id, u, kind: info.kind || (clip.hands ? 'skill' : 'combat'), ch, tool: info.tool || null,
    upright: !!clip.upright, trail: clip.trail || null, trail2: clip.trail2 || null, dust: !!clip.dust,
    jobClass: info.jobClass, low: !!info.low, weapon: info.weapon || null, offhand: info.offhand || null };
}

// ---------------- Per-hero state and blending ----------------
// Changing clip eases from the pose last drawn to the new one over
// CLIP_BLEND_MS, so walking -> chopping -> idle never snaps. Attacks last only
// 120-300ms, so they blend in far quicker, or the wind-up would be lost.
export const CLIP_BLEND_MS = 160;
const COMBAT_BLEND_MS = 50;
const _states = new WeakMap();
const _watched = new WeakSet();
function stateOf(p) {
  let st = _states.get(p);
  if (!st) {
    st = { id: null, u: 0, t0: 0, from: null, out: null, one: null, pending: null, prevAction: null, prevClip: null, prevAt: false, prop: null, propFor: null,
      swings: 0, lastSk: -1, fish: null, caught: null };
    _states.set(p, st);
  }
  return st;
}

/** Blend a sampled frame against the hero's last one (mutates and returns it). */
export function blendHeroFrame(st, frame, now) {
  const restart = frame.id === st.id && !CLIPS[frame.id]?.loop && frame.u < st.u - 0.05;
  if (frame.id !== st.id || restart) {
    st.from = st.out ? { ...st.out } : null;
    st.t0 = now; st.id = frame.id;
  }
  st.u = frame.u;
  const ms = frame.kind === 'combat' ? COMBAT_BLEND_MS : CLIP_BLEND_MS;
  const k = st.from ? Math.min(1, Math.max(0, (now - st.t0) / ms)) : 1;
  if (k < 1) {
    const w = EASE.io(k), ch = frame.ch, f = st.from;
    for (const name in ch) ch[name] = f[name] + (ch[name] - f[name]) * w;
  } else st.from = null;
  st.out = frame.ch;
  return frame;
}

/** Is the hero standing at their work (adjacent to it, or on the fire's tile)? */
function atWork(p, a) {
  if (p.isMoving) return false;
  if (a.type === 'firemake') return a.tile && p.x === a.tile.x && p.y === a.tile.y;
  const o = a.obj;
  return !!o && Math.max(Math.abs(p.x - o.x), Math.abs(p.y - o.y)) <= 1;
}

/** Listen once per game for the beats the clips react to. */
function watch(game) {
  if (_watched.has(game) || !game.bus?.on) return;
  _watched.add(game);
  game.bus.on('levelup', () => { stateOf(game.player).pending = { id: 'cheer', at: 0 }; });
  // A boss falling earns the same cheer (and the painted victory face).
  game.bus.on('sfx', (e) => { if (e === 'bossdie') stateOf(game.player).pending = { id: 'cheer', at: 0 }; });
  game.bus.on('xp', (e) => {
    const p = game.player, st = stateOf(p);
    // Bones buried (or offered) from the pack: there's no action to follow, so
    // the clip starts part-way in (already stooping) and lands just after.
    if (e?.skill === 'prayer' && !p.action) st.pending = { id: 'bury', at: 0.35, prop: 'bones' };
    // Fishing draws its own splashes, timed to the line (drawFishingGear).
    if (e?.skill !== 'fishing') beatFx(game, e?.skill, p.action || st.prevAction);
  });
  // A fish landed (skilling.js resolveFish): the next haul brings this one in.
  game.bus.on('fishcatch', (e) => { stateOf(game.player).caught = { id: e?.id || null }; });
}

/** This frame's animation for the player: which clip, how far through, blended. */
export function heroAnimFrame(game, now) {
  const p = game?.player;
  if (!p) return null;
  watch(game);
  const st = stateOf(p);
  const a = p.action;
  const low = !!game.lowFx;
  const jobClass = game.jobClass;
  // An action that just resolved on arrival (or a gathering one that just
  // finished) plays its clip out from the beat, instead of cutting to idle.
  if (st.prevAction && st.prevAction !== a && !p.isMoving) {
    const id = st.prevClip;
    if (id && (ARRIVAL.has(st.prevAction.type) || st.prevAt)) {
      const clip = CLIPS[id];
      const arrival = ARRIVAL.has(st.prevAction.type);
      st.one = { id, start: now - (arrival ? 0 : clip.beat * dur(clip)), prop: st.prop };
    }
  }
  if (st.pending) {
    const clip = CLIPS[st.pending.id];
    st.one = { id: st.pending.id, start: now - st.pending.at * dur(clip), prop: st.pending.prop || null };
    st.pending = null;
  }
  // Remember what the action was (and whether the hero had got to it).
  if (a !== st.prevAction) { st.prevAction = a; st.prevClip = actionClipId(a); st.prevAt = false; st.fish = null; }
  if (a && a !== st.propFor) { st.propFor = a; st.prop = actionPropId(game, a); }
  const sk = p.swingProgress ? p.swingProgress() : -1;
  // What's in each hand: the rigs draw the off-hand weapon and a second hand
  // on two-handed grips from these, whatever the clip.
  const w = game.equipment?.get?.('weapon');
  const type = w ? ITEMS[w]?.equip?.weaponType || null : null;
  const dual = !!game.equipment?.isDualWielding?.();
  const held = { jobClass, low, weapon: type, offhand: dual ? game.equipment.get('shield') : null };
  // Count attacks (a new swing starts over from 0), so dual wielders alternate clips.
  if (sk >= 0 && (st.lastSk < 0 || sk < st.lastSk - 0.05)) st.swings++;
  st.lastSk = sk;
  let frame;
  if (sk >= 0) {
    frame = sampleHeroClip(weaponClipId(type, dual, st.swings - 1), sk, { kind: 'combat', ...held });
    st.one = null;
  } else if (a && st.prevClip && atWork(p, a) && !ARRIVAL.has(a.type)) {
    st.prevAt = true;
    faceWork(p, a);
    if (a.type === 'fish' && FISHING[a.obj?.def?.tool || 'net']) frame = fishFrame(p, st, a, now, held);
    else {
      const clip = CLIPS[st.prevClip];
      const u = clip.dur === 'tick' ? ((game.tickAcc || 0) / TICK_MS + clip.beat) % 1 : (now % clip.dur) / clip.dur;
      frame = sampleHeroClip(st.prevClip, u, { kind: 'skill', tool: st.prop, ...held });
    }
    st.one = null;
  } else if (st.one && !p.isMoving && now - st.one.start < dur(CLIPS[st.one.id])) {
    const clip = CLIPS[st.one.id];
    frame = sampleHeroClip(st.one.id, (now - st.one.start) / dur(clip), { kind: clip.hands ? 'skill' : 'pose', tool: st.one.prop, ...held });
  } else {
    st.one = null;
    const still = !p.isMoving && !(p.animMove > 0.05);
    frame = sampleHeroClip(still ? 'idle' : 'walk', still ? (now % CLIPS.idle.dur) / CLIPS.idle.dur : 0, { kind: 'pose', ...held });
  }
  return blendHeroFrame(st, frame, now);
}
const dur = (clip) => (clip.dur === 'tick' ? TICK_MS : clip.dur || 1000);

/** Fishing at a spot: cast, wait, then haul in each fish the game lands.
 *  The game lands a fish every tick, far quicker than a cast and a reel can
 *  be shown, so the wait lasts at least waitMin and the first catch after
 *  that starts the haul, with that catch's own fish on the line; the catches
 *  in between still pop up over the hero as usual. */
function fishFrame(p, st, a, now, held) {
  const tool = a.obj?.def?.tool || 'net', P = FISHING[tool];
  let f = st.fish;
  if (!f || f.obj !== a.obj) { f = st.fish = { obj: a.obj, phase: P.cast ? 'cast' : 'wait', t0: now, id: null, n: 0 }; st.caught = null; }
  for (let i = 0; i < 4; i++) {
    const el = now - f.t0;
    if (f.phase === 'cast' && el >= dur(CLIPS[P.cast])) { f.phase = 'wait'; f.t0 += dur(CLIPS[P.cast]); st.caught = null; }
    else if (f.phase === 'haul' && el >= dur(CLIPS[P.haul])) {
      f.phase = P.cast ? 'cast' : 'wait'; f.t0 += dur(CLIPS[P.haul]); f.n++; f.id = null; st.caught = null;
    } else if (f.phase === 'wait' && el < P.waitMin) { st.caught = null; break; }   // too soon: let it bob a while
    else if (f.phase === 'wait' && (st.caught || el >= FISH_WAIT_MAX)) { f.phase = 'haul'; f.t0 = now; f.id = st.caught?.id || null; st.caught = null; }
    else break;
  }
  const id = f.phase === 'cast' ? P.cast : f.phase === 'haul' ? P.haul : P.wait;
  const clip = CLIPS[id], el = Math.max(0, now - f.t0);
  const u = clip.loop ? (el % dur(clip)) / dur(clip) : Math.min(1, el / dur(clip));
  const frame = sampleHeroClip(id, u, { kind: 'skill', tool: st.prop, ...held });
  const o = a.obj, pc = p.renderCenter ? p.renderCenter() : { x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 };
  return attachFishing(frame, { tool, phase: f.phase, k: u, t: now, n: f.n, id: f.id, face: p.faceX || 1,
    tx: o.x * TILE + TILE / 2 - pc.x, ty: o.y * TILE + TILE / 2 - pc.y, oy: o.y });
}

/** Give an animation frame its fishing gear: which tool, which part (cast,
 *  wait, haul) and how far through it (k), the water spot (tx, ty, px from
 *  the hero's centre), the fish being landed, and a little scatter so each
 *  cast lands somewhere new. The hand and rod tip are filled in as it draws. */
export function attachFishing(anim, o) {
  const n = o.n || 0;
  anim.fish = { tool: o.tool, phase: o.phase, k: o.k, t: o.t || 0, id: o.id || null, n,
    face: o.face || (o.tx < 0 ? -1 : 1), tx: o.tx, ty: o.ty, oy: o.oy ?? null,
    jx: ((n * 37) % 9 - 4) * 0.8, jy: ((n * 53) % 7 - 3) * 0.5, hand: null, tip: null };
  return anim;
}

/** Turn to face the thing being worked (left/right only), with the usual turn. */
function faceWork(p, a) {
  const o = a.obj;
  if (!o || o.x === p.x || !p.noteFacing) return;
  const dx = Math.sign(o.x - p.x);
  if (dx === p.faceX) return;
  p.facing = { dx, dy: 0 };
  p.noteFacing();
}

// ---------------- World reactions on the beat ----------------
// A few cheap particles from the game's own particle list (which already
// thins them out in low graphics); in low graphics these extras are skipped.
const FX = {
  woodcutting: 'chips', mining: 'sparks', fishing: 'splash', cooking: 'puff', smithing: 'anvil', crafting: 'glint',
  fletching: 'shavings', firemaking: 'embers', farming: 'clods', herblore: 'leafbits', hunter: 'grass', thieving: 'coin', prayer: 'holy',
};
function beatFx(game, skillId, a) {
  if (game.lowFx || !game._pushParticle) return;
  const kind = FX[skillId];
  if (!kind) return;
  const o = a?.obj, p = game.player;
  const pc = p.renderCenter ? p.renderCenter() : { x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 };
  // The spot struck: between the hero and the object, a little up off the ground.
  const x = o ? (o.x * TILE + TILE / 2) * 0.6 + pc.x * 0.4 : pc.x + (p.faceX || 1) * 10;
  const y = o ? (o.y * TILE + TILE / 2) * 0.6 + pc.y * 0.4 - 4 : pc.y + 8;
  spawnBeatFx(game, kind, x, y);
}
const R = Math.random;
export function spawnBeatFx(game, kind, x, y) {
  const push = (n, f) => { for (let i = 0; i < n; i++) game._pushParticle(f(i)); };
  const spray = (n, cols, { up = 0.1, spread = 0.07, g = 0.0005, life = 420, size = 1.6, add = false, dy = 0 } = {}) =>
    push(n, (i) => ({ x: x + (R() - 0.5) * 6, y: y + dy + (R() - 0.5) * 4, vx: (R() - 0.5) * spread * 2, vy: -up * (0.5 + R() * 0.7),
      g, life: life * (0.7 + R() * 0.5), maxLife: life, size: size * (0.7 + R() * 0.6), color: cols[i % cols.length], add }));
  switch (kind) {
    case 'chips':   // wood chips fly, a leaf or two drifts down from the canopy
      spray(4, ['#caa15a', '#8a5a2b', '#e8c98a'], { up: 0.12, spread: 0.08 });
      push(2, () => ({ x: x + (R() - 0.5) * 20, y: y - 26 - R() * 8, vx: 0, vy: 0.02, g: 0, sway: R() * 6, life: 1200, maxLife: 1200,
        size: 2.2, color: R() < 0.5 ? '#5fae4a' : '#8fcf5a', shape: 'leaf', rot: R() * 6, spin: (R() - 0.5) * 0.006 }));
      break;
    case 'sparks': spray(3, ['#ffe9a8', '#ffb347'], { up: 0.13, spread: 0.1, add: true, life: 300, size: 1.3 }); spray(3, ['#9a9a9a', '#6f6f6f'], { up: 0.1 }); break;
    case 'anvil': spray(6, ['#fff1b0', '#ffb347', '#ff7a3a'], { up: 0.14, spread: 0.11, add: true, life: 320, size: 1.2 }); break;
    case 'splash': spray(6, ['#bfe3ff', '#ffffff', '#7fc8ff'], { up: 0.12, spread: 0.06, g: 0.0006, life: 450, size: 1.7 }); break;
    case 'puff': spray(3, ['rgba(230,230,230,0.8)', 'rgba(200,200,200,0.7)'], { up: 0.04, spread: 0.02, g: -0.00002, life: 700, size: 3, dy: -6 }); spray(2, ['#ffb347'], { up: 0.08, add: true, life: 300, size: 1.2 }); break;
    case 'embers': spray(5, ['#ffd27a', '#ff8a3a'], { up: 0.08, spread: 0.04, g: -0.00004, add: true, life: 600, size: 1.3 }); break;
    case 'clods': spray(5, ['#8a5a2b', '#6b4423', '#a87a4a'], { up: 0.1, spread: 0.06, dy: 6 }); break;
    case 'leafbits': spray(4, ['#7ad08a', '#4f9a4a', '#b8e07a'], { up: 0.08, spread: 0.05, life: 500, size: 1.4 }); break;
    case 'shavings': spray(4, ['#e8c98a', '#caa15a'], { up: 0.07, spread: 0.05, life: 450, size: 1.3 }); break;
    case 'glint': spray(3, ['#ffffff', '#9adcff'], { up: 0.05, spread: 0.04, add: true, life: 400, size: 1.5 }); break;
    case 'grass': spray(4, ['#6fbf4a', '#4f9a3a'], { up: 0.07, spread: 0.05, dy: 6, life: 400 }); break;
    case 'coin': spray(2, ['#ffe24a', '#f5b82e'], { up: 0.1, spread: 0.03, add: true, life: 400, size: 1.6 }); break;
    case 'holy': spray(4, ['#cfeaff', '#ffffff'], { up: 0.05, spread: 0.03, g: -0.00002, add: true, life: 700, size: 1.6, dy: -8 }); break;
    default: break;
  }
}

// ---------------- Drawing the mitten arms and the held tool ----------------
const INK = '#22304A', MITTEN = '#FFF1DC';
// Each class's sleeve colour, so the life-skill arms match the painted body.
const SLEEVE = {
  swordsman: '#b8c4d0', rogue: '#2f4a4a', samurai: '#c0392b', corsair: '#3a3340', paladin: '#e8dfc8', knight: '#aab6c2',
  berserker: '#e9d6b0', juggernaut: '#6f7884', gladiator: '#c08a3a', lancer: '#2f5fb3', brawler: '#f2efe6', halberdier: '#c7cfd8',
  dancer: '#f4a7c4', merchant: '#7a2f4a', ninja: '#2b3a5a', archer: '#4f7a3a', ranger: '#4f7a3a', wizard: '#4b2a7a',
  sorcerer: '#5b3a8c', pistoler: '#2f5a5a', sniper: '#2f5a5a',
};
// Where the hand grips each tool's sticker (0..1 across the picture), which
// way its head points from there, and how big it is drawn.
const PROPS = {
  bronze_axe: { grip: [0.74, 0.86], tip: [0.3, 0.2], size: 24 },
  bronze_pickaxe: { grip: [0.22, 0.85], tip: [0.62, 0.3], size: 25 },
  small_net: { grip: [0.85, 0.85], tip: [0.3, 0.25], size: 24 },
  fishing_rod: { grip: [0.14, 0.85], tip: [0.9, 0.12], size: 30 },
  harpoon: { grip: [0.18, 0.85], tip: [0.85, 0.12], size: 28 },
  hammer: { grip: [0.78, 0.86], tip: [0.3, 0.25], size: 18 },
  chisel: { grip: [0.8, 0.15], tip: [0.15, 0.85], size: 14 },
  knife: { grip: [0.78, 0.78], tip: [0.2, 0.22], size: 14 },
};
const HELD = { grip: [0.5, 0.62], tip: [0.5, 0.1], size: 16 };   // anything else: held up in the fist

/** Draw the tool in hand. The hand is at the origin; `dir` is the arm's direction. */
function drawProp(c, id, dir, wrist, upright) {
  const img = id ? itemIconImage(id) : null;
  if (!img || !img.complete || !img.naturalWidth) return;
  const P = PROPS[id] || HELD;
  const iconAng = Math.atan2(P.tip[1] - P.grip[1], P.tip[0] - P.grip[0]);
  const want = (upright || !PROPS[id] ? -Math.PI / 2 : dir) + wrist;
  c.save();
  c.rotate(want - iconAng);
  c.drawImage(img, -P.grip[0] * P.size, -P.grip[1] * P.size, P.size, P.size);
  c.restore();
}

/** One stubby mitten arm from a shoulder, at angle phi (0 down, + forward).
 *  With `anim` (the front arm), fishing gear replaces the tool, and a tool's
 *  impact spark is drawn at its head. */
function mittenArm(c, sx, sy, phi, sleeve, tool, wrist, upright, anim = null, jobClass = null) {
  // The class's painted empty-hand arm when it has one, the tool in its fist.
  // The tool goes first, so the fist closes over its handle as the mitten does.
  if (jobClass && hasEmptyArm(jobClass)) {
    const len = anim ? 10 : 9;
    toolInHand(c, anim, tool, sx + Math.sin(phi) * len, sy + Math.cos(phi) * len, phi, wrist, upright);
    drawEmptyArm(c, jobClass, sx, sy, phi, len);
    return;
  }
  const L = 8.5;
  const hx = sx + Math.sin(phi) * L, hy = sy + Math.cos(phi) * L;
  c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = 7.4;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
  c.strokeStyle = sleeve; c.lineWidth = 5;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
  toolInHand(c, anim, tool, hx, hy, phi, wrist, upright);
  c.fillStyle = MITTEN; c.strokeStyle = INK; c.lineWidth = 1.1;
  c.beginPath(); c.arc(hx, hy, 3.1, 0, Math.PI * 2); c.fill(); c.stroke();
}

/** The tool in the front hand at (hx, hy): fishing gear while fishing, else
 *  the tool's sticker, with its impact spark on a struck beat. */
function toolInHand(c, anim, tool, hx, hy, phi, wrist, upright) {
  const dir = Math.atan2(Math.cos(phi), Math.sin(phi));
  if (anim?.fish) { heldGear(c, anim, hx, hy, dir + wrist); return; }
  if (!tool) return;
  c.save(); c.translate(hx, hy);
  drawProp(c, tool, dir, wrist, upright);
  c.restore();
  const k = anim?.ch?.impact;
  if (k > 0.05 && !anim.low) {
    // The head is where the sticker's tip lies from the grip, along the turn drawProp gave it.
    const P = PROPS[tool] || HELD;
    const want = (upright || !PROPS[tool] ? -Math.PI / 2 : dir) + wrist;
    const reach = Math.hypot(P.tip[0] - P.grip[0], P.tip[1] - P.grip[1]) * P.size * 0.85;
    star(c, hx + Math.cos(want) * reach, hy + Math.sin(want) * reach, 1.5 + k * 4, k);
  }
}

/** A little four-point spark (an impact), ink-edged so it reads on any ground. */
function star(c, x, y, r, k) {
  c.fillStyle = `rgba(255,240,180,${Math.min(1, k).toFixed(3)})`; c.strokeStyle = `rgba(34,48,74,${(0.8 * Math.min(1, k)).toFixed(3)})`; c.lineWidth = 0.9;
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill(); c.stroke();
}

/** The life-skill arms for a painted rig: the back one before the body, the
 *  front one (with the tool) after it. `y` is the shoulder height. */
export function drawHeroArm(c, anim, side, y = -11) {
  const ch = anim.ch, a = ch.mix;
  if (!(a > 0.01)) return;
  const sleeve = SLEEVE[anim.jobClass] || '#C0392B';
  const prev = c.globalAlpha;
  c.globalAlpha = prev * Math.min(1, a);
  if (side === 'back') mittenArm(c, -7, y, ch.off, sleeve, null, 0, false, null, anim.jobClass);
  else mittenArm(c, 8, y, ch.hand, sleeve, anim.tool, ch.prop, anim.upright, anim, anim.jobClass);
  c.globalAlpha = prev;
}

/** The back arm reaching across the chest to a two-handed grip (a katana's
 *  hilt, a hammer's haft, a gun's stock): the sleeve from shoulder (sx, sy) to
 *  the hand at (hx, hy), drawn before the weapon arm, then the fist, drawn
 *  after it so it sits on the handle. `part` is 'arm' or 'fist'. */
export function drawGripHand(c, jobClass, part, sx, sy, hx, hy, alpha = 1) {
  if (!(alpha > 0.01)) return;
  const prev = c.globalAlpha;
  c.globalAlpha = prev * alpha;
  c.lineCap = 'round';
  if (part === 'arm') {
    c.strokeStyle = INK; c.lineWidth = 6.4;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
    c.strokeStyle = SLEEVE[jobClass] || '#C0392B'; c.lineWidth = 4.2;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
  } else {
    c.fillStyle = MITTEN; c.strokeStyle = INK; c.lineWidth = 0.8;
    c.beginPath(); c.arc(hx, hy, 2.5, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.globalAlpha = prev;
}

/** Single-picture heroes have their arms painted on, so only a fist and the
 *  tool are added, at the picture's front side. */
export function drawPictureTool(c, anim) {
  const ch = anim.ch;
  if (!(ch.mix > 0.01) || (!anim.tool && !anim.fish)) return;
  const prev = c.globalAlpha;
  c.globalAlpha = prev * Math.min(1, ch.mix);
  const phi = ch.hand, hx = 10 + Math.sin(phi) * 6, hy = -6 + Math.cos(phi) * 6;
  toolInHand(c, anim, anim.tool, hx, hy, phi, ch.prop, anim.upright);
  c.fillStyle = MITTEN; c.strokeStyle = INK; c.lineWidth = 1.1;
  c.beginPath(); c.arc(hx, hy, 3.1, 0, Math.PI * 2); c.fill(); c.stroke();
  c.globalAlpha = prev;
}

/** A weapon's swoosh on a fast swing: an ink-edged white crescent (or streak)
 *  that sweeps with the blow and fades, the off hand's too when dual wielding,
 *  and a small spark where the blow lands. A few strokes at most; none in low graphics. */
export function drawWeaponTrail(c, anim) {
  if (!anim || anim.low) return;
  const ch = anim.ch || {};
  const hit = trail(c, anim.trail, ch.trail, anim.dust);
  trail(c, anim.trail2, ch.trail2, false);
  // The impact spark: a little four-point star at the end of the main swoosh.
  const k = ch.impact;
  if (hit && k > 0.05) {
    const r = 2 + k * 5;
    c.save();
    c.fillStyle = `rgba(255,240,180,${Math.min(1, k).toFixed(3)})`; c.strokeStyle = `rgba(34,48,74,${(0.85 * Math.min(1, k)).toFixed(3)})`; c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r; c.lineTo(hit[0] + Math.cos(a) * rr, hit[1] + Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
}
/** One swoosh at t (0..1 through it). Returns where its blow lands, for the spark. */
function trail(c, tr, t, dust) {
  if (!tr) return null;
  // An arc's blow lands three-quarters of the way round (its tail is the follow-through).
  const ha = tr.a0 + (tr.a1 - tr.a0) * 0.75;
  const end = tr.kind === 'arc' ? [tr.cx + Math.cos(ha) * tr.r, tr.cy + Math.sin(ha) * tr.r]
    : tr.kind === 'line' ? [tr.x1, tr.y] : tr.kind === 'seg' ? [(tr.x0 + tr.x1) / 2, (tr.y0 + tr.y1) / 2] : [tr.x, tr.y];
  if (!(t > 0.02 && t < 0.98)) return end;
  const fade = Math.sin(t * Math.PI);
  c.save(); c.lineCap = 'round';
  const stroke = (col, w) => { c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  const ink = `rgba(34,48,74,${(0.8 * fade).toFixed(3)})`, white = `rgba(255,255,255,${fade.toFixed(3)})`;
  if (tr.kind === 'arc') {
    // Either way round: the head runs from a0 to a1 and the tail follows it.
    const dir = tr.a1 >= tr.a0 ? 1 : -1;
    const head = tr.a0 + (tr.a1 - tr.a0) * t, tail = head - dir * Math.min(1.3, Math.abs(head - tr.a0));
    const lo = Math.min(head, tail), hi = Math.max(head, tail);
    c.beginPath(); c.arc(tr.cx, tr.cy, tr.r, lo, hi);
    stroke(ink, 7); stroke(white, 4.5);
    // (Only once the swoosh is long enough: a reversed arc would draw the whole circle.)
    if (hi - lo > 0.35) {
      c.beginPath(); c.arc(tr.cx, tr.cy, tr.r + 4, dir > 0 ? lo + 0.3 : lo, dir > 0 ? hi : hi - 0.3);
      stroke(`rgba(245,184,46,${fade.toFixed(3)})`, 2);
    }
    if (dust && t > 0.5) {   // heavy blows kick up dust where they land
      const d = (t - 0.5) * 2;
      c.fillStyle = `rgba(214,196,160,${(0.6 * (1 - d)).toFixed(3)})`;
      c.beginPath(); c.ellipse(34, 10, 6 + d * 10, 2 + d * 3, 0, 0, Math.PI * 2); c.fill();
    }
  } else if (tr.kind === 'line') {
    const x1 = tr.x0 + (tr.x1 - tr.x0) * t, x0 = Math.max(tr.x0, x1 - 22);
    c.beginPath(); c.moveTo(x0, tr.y); c.lineTo(x1, tr.y);
    stroke(ink, 5); stroke(white, 2.6);
  } else if (tr.kind === 'seg') {
    // A straight diagonal cut (two of them cross in an X).
    const k1 = t, k0 = Math.max(0, t - 0.6);
    c.beginPath();
    c.moveTo(tr.x0 + (tr.x1 - tr.x0) * k0, tr.y0 + (tr.y1 - tr.y0) * k0);
    c.lineTo(tr.x0 + (tr.x1 - tr.x0) * k1, tr.y0 + (tr.y1 - tr.y0) * k1);
    stroke(ink, 6); stroke(white, 3.4);
  } else if (tr.kind === 'claw') {
    c.beginPath();
    for (let i = 0; i < 3; i++) { const o = (i - 1) * 5; c.moveTo(tr.x - 8 + o, tr.y - 9 + o * 0.3); c.lineTo(tr.x + 6 + o, tr.y + 8 + o * 0.3); }
    stroke(ink, 3.6); stroke(white, 1.8);
  }
  c.restore();
  return end;
}

// ---------------- Fishing gear ----------------
// The rod, net, pot and harpoon in the hand are drawn with the arm (heldGear);
// everything out at the water (line, bobber, the net in flight, the pot on its
// rope, the thrown harpoon, the fish flipping in) by drawFishingGear, which the
// renderer calls after the hero so it sits over the spot. The two meet at the
// hand and rod tip: heldGear notes where they landed on the canvas, and
// drawFishingGear maps them back. A dozen strokes a frame at most; low
// graphics drops the ripples, splashes, bubbles and sparkles.
const ROPE = '#a8743a', LINE = 'rgba(250,248,235,0.95)', LINE_INK = 'rgba(34,48,74,0.5)';

/** Where (x, y) in the current drawing space lands on the canvas, or null
 *  where the context can't say (the headless tests' stand-in). */
function devicePoint(c, x, y) {
  if (!c.getTransform) return null;
  const m = c.getTransform();
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}
/** The reverse: a canvas point in the current drawing space. */
function toLocal(c, p) {
  if (!p || !c.getTransform) return null;
  const m = c.getTransform(), det = m.a * m.d - m.b * m.c;
  if (!det) return null;
  const x = p[0] - m.e, y = p[1] - m.f;
  return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det];
}
const lerp2 = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
/** A point thrown from a to b, s of the way, rising h px at the middle. */
const arc2 = (a, b, s, h) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s - Math.sin(Math.PI * s) * h];

// Is the gear in the hand (rather than out on the water) at this point?
const netInHand = (f) => (f.phase === 'cast' && f.k < 0.5) || (f.phase === 'haul' && f.k > 0.78);
const potInHand = (f) => (f.phase === 'cast' && f.k < 0.42) || (f.phase === 'haul' && f.k > 0.82);
const harpoonInHand = (f) => !(f.phase === 'haul' && f.k >= 0.3 && f.k < 0.86);

/** The gear in the front hand (at hx, hy, pointing along ang). */
function heldGear(c, anim, hx, hy, ang) {
  const f = anim.fish;
  f.hand = devicePoint(c, hx, hy);
  f.tip = f.hand;
  if (f.tool === 'rod') {
    const tip = drawRod(c, hx, hy, ang, anim.ch.bend);
    f.tip = devicePoint(c, tip[0], tip[1]);
  } else if (f.tool === 'net') {
    if (netInHand(f)) drawNetBundle(c, hx, hy + 3);
  } else if (f.tool === 'lobster_pot') {
    if (potInHand(f)) drawIcon(c, anim.tool || 'lobster_pot', hx + 1, hy + 6, 15);
  } else if (harpoonInHand(f)) {
    c.save(); c.translate(hx, hy);
    drawProp(c, anim.tool || 'harpoon', ang, 0, false);
    c.restore();
  }
}

/** A fishing rod drawn as a springy cane, so it can bow under a fish: cork
 *  grip, reel and a tapering pole. Returns its tip. */
function drawRod(c, hx, hy, ang, bend = 0) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const bx = hx - ca * 6, by = hy - sa * 6, L = 32;
  const b = Math.max(-0.4, Math.min(1.2, bend)) * 0.45, reach = L - Math.abs(b) * 3;
  const tx = bx + Math.cos(ang + b) * reach, ty = by + Math.sin(ang + b) * reach;
  const qx = bx + ca * L * 0.55, qy = by + sa * L * 0.55;
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(qx, qy, tx, ty);
  c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke();
  c.strokeStyle = '#d39a4c'; c.lineWidth = 1.2; c.stroke();
  c.beginPath(); c.moveTo(bx, by); c.lineTo(hx + ca * 2, hy + sa * 2);
  c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
  c.strokeStyle = '#7a4a22'; c.lineWidth = 2.4; c.stroke();
  // The reel hangs under the rod just ahead of the hand.
  c.fillStyle = '#cdd3dc'; c.strokeStyle = INK; c.lineWidth = 0.9;
  c.beginPath(); c.arc(hx + ca * 3 - sa * 3, hy + sa * 3 + ca * 3, 2, 0, Math.PI * 2); c.fill(); c.stroke();
  return [tx, ty];
}

/** The cast net gathered up in the hand, weights dangling. */
function drawNetBundle(c, x, y) {
  c.fillStyle = 'rgba(240,240,228,0.9)'; c.strokeStyle = INK; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x - 2, y - 3); c.quadraticCurveTo(x - 6, y + 5, x, y + 8); c.quadraticCurveTo(x + 6, y + 5, x + 2, y - 3); c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(34,48,74,0.45)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(x - 3, y + 1); c.lineTo(x + 3, y + 5); c.moveTo(x + 3, y + 1); c.lineTo(x - 3, y + 5); c.stroke();
  c.fillStyle = INK;
  for (const dx of [-3, 0, 3]) { c.beginPath(); c.arc(x + dx, y + 8.5, 0.9, 0, Math.PI * 2); c.fill(); }
}

/** An item's sticker centred at (x, y), size px, turned by rot. */
function drawIcon(c, id, x, y, size, rot = 0) {
  const img = id ? itemIconImage(id) : null;
  if (!img || !img.complete || !img.naturalWidth) return false;
  if (rot) { c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(img, -size / 2, -size / 2, size, size); c.restore(); }
  else c.drawImage(img, x - size / 2, y - size / 2, size, size);
  return true;
}

/** Fishing line (or rope) from a to b, sagging by sag px at the middle. */
function line(c, a, b, sag, rope = false) {
  c.beginPath(); c.moveTo(a[0], a[1]);
  c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag, b[0], b[1]);
  c.strokeStyle = rope ? INK : LINE_INK; c.lineWidth = rope ? 2.2 : 1.7; c.stroke();
  c.strokeStyle = rope ? ROPE : LINE; c.lineWidth = rope ? 1.1 : 0.8; c.stroke();
}
/** A ring spreading on the water, s 0..1 through it. */
function ripple(c, x, y, s, size = 1) {
  if (!(s > 0 && s < 1)) return;
  const rx = (3 + s * 11) * size;
  c.strokeStyle = `rgba(255,255,255,${(0.85 * (1 - s)).toFixed(3)})`; c.lineWidth = 1.1;
  c.beginPath(); c.ellipse(x, y, rx, rx * 0.38, 0, 0, Math.PI * 2); c.stroke();
}
/** Drops thrown up from the water and falling back, s 0..1. */
function splash(c, x, y, s, n = 5) {
  if (!(s > 0 && s < 1)) return;
  c.fillStyle = `rgba(228,245,255,${(1 - s * 0.8).toFixed(3)})`; c.strokeStyle = `rgba(34,48,74,${(0.5 * (1 - s)).toFixed(3)})`; c.lineWidth = 0.6;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5, d = 3 + s * 9, r = 1.3 * (1 - s * 0.5);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 1.3 + s * s * 16;
    c.moveTo(px + r, py); c.arc(px, py, r, 0, Math.PI * 2);
  }
  c.fill(); c.stroke();
}
/** A few bubbles rising and popping over something under the water. */
function bubbles(c, x, y, t) {
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 0.7;
  c.beginPath();
  for (let i = 0; i < 3; i++) {
    const s = (t * 0.0011 + i * 0.37) % 1, bx = x + (i - 1) * 5 + Math.sin(t * 0.005 + i) * 1, by = y - s * 6, r = 0.7 + s * 0.7;
    c.moveTo(bx + r, by); c.arc(bx, by, r, 0, Math.PI * 2);
  }
  c.stroke();
}
/** Water dripping off something just lifted out. */
function drips(c, x, y, t) {
  c.fillStyle = 'rgba(200,232,255,0.9)';
  c.beginPath();
  for (let i = 0; i < 3; i++) { const s = (t * 0.003 + i * 0.33) % 1; c.moveTo(x + (i - 1) * 4 + 0.8, y + s * 7); c.arc(x + (i - 1) * 4, y + s * 7, 0.8, 0, Math.PI * 2); }
  c.fill();
}
/** The red-and-white float, dip 0..1 pulling it under. */
function bobber(c, x, y, dip = 0) {
  const r = 2.3;
  y += dip * 2.5;
  c.strokeStyle = INK; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x, y - r - 1.8); c.stroke();
  c.fillStyle = '#e8473b';
  c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.fill();
  if (dip < 0.5) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, r, 0, Math.PI); c.fill(); }
  c.beginPath(); c.arc(x, y, r, dip < 0.5 ? 0 : Math.PI, Math.PI * 2); c.stroke();
}
/** A spread (or flying, opening) cast net seen from above at an angle. */
function drawNet(c, x, y, rx, ry, alpha, low) {
  c.save(); c.globalAlpha *= alpha;
  c.fillStyle = 'rgba(235,242,236,0.25)'; c.strokeStyle = INK; c.lineWidth = 1.1;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(250,250,240,0.9)'; c.lineWidth = 0.6;
  c.beginPath();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * rx, y + Math.sin(a) * ry); }
  c.moveTo(x + rx * 0.55, y); c.ellipse(x, y, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
  c.stroke();
  if (!low) {
    c.fillStyle = INK; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry; c.moveTo(px + 0.9, py); c.arc(px, py, 0.9, 0, Math.PI * 2); }
    c.fill();
  }
  c.restore();
}
/** The net drawn shut round the catch, hauled out like a sack. */
function drawBag(c, x, y) {
  c.fillStyle = 'rgba(235,242,236,0.55)'; c.strokeStyle = INK; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x, y - 6); c.quadraticCurveTo(x - 8, y + 2, x, y + 6); c.quadraticCurveTo(x + 8, y + 2, x, y - 6); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(34,48,74,0.4)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(x - 4, y - 1); c.lineTo(x + 3, y + 4); c.moveTo(x + 4, y - 1); c.lineTo(x - 3, y + 4); c.stroke();
}
/** The pot let down d px under the surface at (x, y): only what's above the water shows. */
function sunkPot(c, id, x, y, d) {
  c.save();
  c.beginPath(); c.rect(x - 14, y - 30, 28, 33); c.clip();
  drawIcon(c, id, x, y - 3 + d, 15);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
  c.beginPath(); c.ellipse(x, y + 3, 8, 2, 0, 0, Math.PI * 2); c.stroke();
}
/** The harpoon in flight (or stuck in the water), its point at (x, y), aimed along ang. */
function flyingHarpoon(c, id, x, y, ang) {
  const img = itemIconImage(id);
  if (img && img.complete && img.naturalWidth) {
    const P = PROPS.harpoon, size = 26;
    c.save(); c.translate(x, y);
    c.rotate(ang - Math.atan2(P.tip[1] - P.grip[1], P.tip[0] - P.grip[0]));
    c.drawImage(img, -P.tip[0] * size, -P.tip[1] * size, size, size);
    c.restore();
    return;
  }
  c.strokeStyle = INK; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(ang) * 18, y - Math.sin(ang) * 18); c.stroke();
}
/** The caught fish (its own sticker, else a little silver fish) flipping
 *  from the water at a into the hero at b, s 0..1. Returns where it is. */
function fishFlip(c, id, a, b, s, face, low) {
  const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - 40, u = 1 - s;
  const x = u * u * a[0] + 2 * u * s * mx + s * s * b[0], y = u * u * a[1] + 2 * u * s * my + s * s * b[1];
  const sc = s > 0.8 ? 1 - (s - 0.8) * 3 : 1;
  c.save(); c.translate(x, y);
  c.rotate(low ? 0 : -face * s * Math.PI * 2.5);
  c.scale(sc, sc);
  if (!drawIcon(c, id, 0, 0, 16)) {
    c.fillStyle = '#bcd6e8'; c.strokeStyle = INK; c.lineWidth = 0.9;
    c.beginPath(); c.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2); c.moveTo(-4, 0); c.lineTo(-8, -3); c.lineTo(-8, 3); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
  return [x, y];
}

/** Everything out at the water for a fishing hero: call after the hero (so
 *  heldGear has marked the hand and rod tip), with the hero's centre (hx, hy)
 *  in the same drawing space. Driven by anim.fish (see fishFrame). */
export function drawFishingGear(c, anim, hx, hy) {
  const f = anim?.fish;
  if (!f) return;
  const low = !!anim.low, k = f.k, t = f.t, face = f.face;
  const hand = toLocal(c, f.hand) || [hx + face * 10, hy - 6];
  const tip = toLocal(c, f.tip) || (f.tool === 'rod' ? [hx + face * 20, hy - 26] : hand);
  // The line lands a little beyond the middle of the spot (so it reads clear of
  // the spot's own painted ripples); the net and pot nearer the bank.
  const W = [hx + f.tx + f.jx + face * (f.tool === 'rod' ? 7 : 2), hy + f.ty + f.jy + 2];
  const chest = [hx, hy - 6];
  const fx = !low;   // the water's extras: ripples, splashes, bubbles, sparkles
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  const sparkle = (s) => { if (fx && s > 0 && s < 1) star(c, chest[0], chest[1] - 8, 1.5 + 4 * (1 - s), 1 - s); };
  if (f.tool === 'rod') {
    if (f.phase === 'cast') {
      if (k < 0.47) { const B = [tip[0], tip[1] + 6]; line(c, tip, B, 0); bobber(c, B[0], B[1]); }
      else if (k < 0.8) { const s = (k - 0.47) / 0.33, B = arc2(tip, W, s, 18); line(c, tip, B, 3 * (1 - s)); bobber(c, B[0], B[1]); }
      else {
        const s = (k - 0.8) / 0.2;
        if (fx) { ripple(c, W[0], W[1], s); splash(c, W[0], W[1], s); }
        line(c, tip, W, 7 * s); bobber(c, W[0], W[1] + Math.sin(s * Math.PI) * 1.5);
      }
    } else if (f.phase === 'wait') {
      const B = [W[0], W[1] + Math.sin(t * 0.006) * 0.8];
      if (fx) { ripple(c, W[0], W[1], (t % 1500) / 1500, 0.8); ripple(c, W[0], W[1], ((t + 750) % 1500) / 1500, 0.8); }
      line(c, tip, B, 7 + Math.sin(t * 0.0021) * 2); bobber(c, B[0], B[1]);
    } else {
      const out = lerp2(W, hand, 0.2);
      if (fx && k < 0.3) { splash(c, W[0], W[1], k / 0.3); ripple(c, W[0], W[1], k / 0.3, 1.3); }
      if (k < 0.08) { const s = k / 0.08; line(c, tip, [W[0], W[1] + s * 2], 7 * (1 - s)); bobber(c, W[0], W[1], s); }
      else if (k < 0.42) {
        // Hooked: the fish fights under the surface, the line taut and dragged in.
        const s = (k - 0.08) / 0.34, P = lerp2(W, out, s);
        P[0] += Math.sin(t * 0.05) * 1.5;
        c.fillStyle = 'rgba(20,40,60,0.35)'; c.beginPath(); c.ellipse(P[0], P[1] + 1, 5, 2, Math.sin(t * 0.05) * 0.3, 0, Math.PI * 2); c.fill();
        if (fx) ripple(c, P[0], P[1], (t % 400) / 400, 0.7);
        line(c, tip, P, 0);
      } else if (k < 0.82) {
        const s = (k - 0.42) / 0.4;
        if (fx) splash(c, out[0], out[1], s * 2);
        line(c, tip, fishFlip(c, f.id, out, chest, s, face, low), 0);
      } else {
        const s = (k - 0.82) / 0.18, B = [tip[0], tip[1] + 6 * s];
        line(c, tip, B, 0); bobber(c, B[0], B[1]); sparkle(s);
      }
    }
  } else if (f.tool === 'net') {
    const rim = [W[0] - face * 11, W[1]], out = lerp2(W, hand, 0.25);
    if (f.phase === 'cast') {
      if (k >= 0.5 && k < 0.8) {
        // Flung out, the net spins open in the air and flattens as it lands.
        const s = (k - 0.5) / 0.3, C = arc2(hand, W, s, 16), r = 3 + 10 * EASE.out(s);
        line(c, hand, C, 2, true); drawNet(c, C[0], C[1], r, r * (0.85 - 0.45 * s), 1, low);
      } else if (k >= 0.8) {
        const s = (k - 0.8) / 0.2;
        if (fx) { ripple(c, W[0], W[1], s, 1.4); splash(c, W[0], W[1], s, 7); }
        line(c, hand, rim, 5 * s, true); drawNet(c, W[0], W[1], 13, 5, 1 - 0.35 * s, low);
      }
    } else if (f.phase === 'wait') {
      drawNet(c, W[0], W[1], 13 + Math.sin(t * 0.004) * 0.6, 5, 0.65, low);
      if (fx) bubbles(c, W[0], W[1], t);
      line(c, hand, rim, 5 + Math.sin(t * 0.002) * 1.5, true);
    } else {
      if (k < 0.45) {
        // Drawn in hand over hand, the net closing round the catch.
        const s = k / 0.45, C = lerp2(W, out, s);
        if (fx) splash(c, W[0], W[1], s * 2);
        drawNet(c, C[0], C[1], 13 - 8 * s, 5 - s, 0.65 + 0.35 * s, low); line(c, hand, [C[0] - face * (13 - 8 * s), C[1]], 0, true);
      } else if (k < 0.78) {
        const s = (k - 0.45) / 0.33, C = arc2(out, hand, s, 14);
        line(c, hand, [C[0], C[1] - 6], 0, true); drawBag(c, C[0], C[1]);
        if (fx) drips(c, C[0], C[1] + 5, t);
      }
      if (k >= 0.5 && k < 0.85) fishFlip(c, f.id, out, chest, (k - 0.5) / 0.35, face, low);
      sparkle((k - 0.85) / 0.15);
    }
  } else if (f.tool === 'lobster_pot') {
    const pot = anim.tool || 'lobster_pot', out = lerp2(W, hand, 0.2);
    if (f.phase === 'cast') {
      if (k >= 0.42 && k < 0.62) { const s = (k - 0.42) / 0.2, C = arc2(hand, W, s, 12); line(c, hand, [C[0], C[1] - 6], 2, true); drawIcon(c, pot, C[0], C[1], 15); }
      else if (k >= 0.62) {
        // Let down on its rope, sinking out of sight.
        const s = (k - 0.62) / 0.38, d = s * 14;
        if (fx) { ripple(c, W[0], W[1] + 3, s, 1.2); splash(c, W[0], W[1], s * 1.4); }
        line(c, hand, [W[0], W[1] - 6 + d], 3, true); sunkPot(c, pot, W[0], W[1], d);
      }
    } else if (f.phase === 'wait') {
      if (fx) { ripple(c, W[0], W[1] + 3, (t % 1600) / 1600); bubbles(c, W[0], W[1] + 2, t); }
      line(c, hand, [W[0], W[1] + 2], 5 + Math.sin(t * 0.002) * 1.5, true);
      // A cork float marks where the pot lies.
      c.fillStyle = '#f08a3a'; c.strokeStyle = INK; c.lineWidth = 0.8;
      c.beginPath(); c.ellipse(W[0], W[1] + 1 + Math.sin(t * 0.005) * 0.7, 2.2, 1.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    } else {
      if (k < 0.5) {
        const s = k / 0.5, d = 14 * (1 - s);
        if (fx) ripple(c, W[0], W[1] + 3, (t % 500) / 500);
        line(c, hand, [W[0], W[1] - 6 + d], 0, true); sunkPot(c, pot, W[0], W[1], d);
        if (fx && s > 0.6) drips(c, W[0], W[1] - 2, t);
      } else if (k < 0.82) {
        const s = (k - 0.5) / 0.32, C = arc2(W, hand, s, 10);
        line(c, hand, [C[0], C[1] - 6], 0, true); drawIcon(c, pot, C[0], C[1], 15);
        if (fx) drips(c, C[0], C[1] + 6, t);
      }
      if (k >= 0.6 && k < 0.9) fishFlip(c, f.id, out, chest, (k - 0.6) / 0.3, face, low);
      sparkle((k - 0.9) / 0.1);
    }
  } else {
    // The harpoon: a fish's shadow circles below while the hero takes aim.
    const id = anim.tool || 'harpoon', aim = Math.atan2(W[1] - hand[1], W[0] - hand[0]);
    if (f.phase !== 'haul' || k < 0.4) {
      const a = t * 0.003, sx = W[0] + Math.cos(a) * 5, sy = W[1] + Math.sin(a) * 2;
      c.fillStyle = 'rgba(20,40,60,0.3)'; c.beginPath(); c.ellipse(sx, sy, 5, 1.8, Math.cos(a) * 0.3, 0, Math.PI * 2); c.fill();
    }
    if (f.phase === 'haul') {
      if (k >= 0.3 && k < 0.4) {
        const s = (k - 0.3) / 0.1, P = arc2(hand, W, s, 6);
        line(c, hand, P, 2, true); flyingHarpoon(c, id, P[0], P[1], aim + (s - 0.5) * 0.5 * face);
      } else if (k >= 0.4 && k < 0.62) {
        // Struck home: it stands quivering in the water.
        const s = (k - 0.4) / 0.22;
        if (fx) { ripple(c, W[0], W[1], s, 1.2); splash(c, W[0], W[1], s * 1.4, 6); }
        line(c, hand, W, 1, true);
        c.save(); c.beginPath(); c.rect(W[0] - 30, W[1] - 40, 60, 41); c.clip();
        flyingHarpoon(c, id, W[0], W[1] + 4, aim + Math.sin(t * 0.08) * 0.08 * (1 - s));
        c.restore();
      } else if (k >= 0.62 && k < 0.86) {
        const s = (k - 0.62) / 0.24, P = arc2(W, hand, s, 8);
        line(c, hand, P, 3 * (1 - s), true); flyingHarpoon(c, id, P[0], P[1], aim);
      }
      if (k >= 0.62 && k < 0.9) fishFlip(c, f.id, W, chest, (k - 0.62) / 0.28, face, low);
      sparkle((k - 0.9) / 0.1);
    }
  }
  c.restore();
}
