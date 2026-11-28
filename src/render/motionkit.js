// World motion vocabulary: the easing curves and timing shares the game-world
// animation shares (monsters' blows, townsfolk at rest, falls), so a lunge, a
// flinch and a fall all move with one hand and land on the same beat. The
// windows and HUD have their own curves in src/ui/motion.js (as CSS
// cubic-beziers); these are their canvas counterparts. All of it is cheap,
// pure math with no allocation: the `out` objects are reused.

// ---------------- Curves (0..1 in, 0..1 out) ----------------
export const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
/** How far `k` is through the stretch from `a` to `b`, as 0..1. */
export const seg = (k, a, b) => clamp01((k - a) / (b - a));
/** Fast start, gentle stop: things settling into place. */
export const easeOut = (x) => 1 - (1 - x) * (1 - x);
/** Gentle start, fast finish: things gathering speed into a blow. */
export const easeIn = (x) => x * x;
/** Gentle at both ends: a return to rest. */
export const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) / 2);
/** Smooth at both ends, flat outside 0..1. */
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
/** Overshoots a little past 1 and settles back: a pop into place. */
export function easeOutBack(x, s = 1.7) {
  const u = clamp01(x) - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}
/** A damped spring's swing, `age` ms after a kick: starts at 1 and wobbles
 *  down to 0 (`tau` ms decay, `w` radians per ms). 0 before the kick. */
export const springOut = (age, tau, w) => (age >= 0 ? Math.exp(-age / tau) * Math.cos(age * w) : 0);
/** Up and back down over 0..1 (a hop, a bump). */
export const arc = (x) => (x > 0 && x < 1 ? Math.sin(x * Math.PI) : 0);

// ---------------- A monster's blow ----------------
// A monster's swing (attackK 0..1, about 240ms) in four beats: it gathers
// itself (wind), whips into the blow, holds the strike a moment so it reads,
// then settles back. Every pose of a blow (the whole-picture lunge, a rig's
// limbs and head, the body's slide toward its foe in character.js) peaks on
// STRIKE_AT, and the hero's flinch, number and sparks wait for that beat too.
export const WIND_END = 0.34;
export const STRIKE_AT = 0.44;
export const HOLD_END = 0.54;
const _ph = { wind: 0, hit: 0, settle: 0 };
/** The beats of a swing at `ak` (-1 when not attacking: null): `wind` 0..1
 *  as it gathers (and lets go as it strikes), `hit` 0..1 into the blow and
 *  back out as it settles, `settle` 0..1 a bump as it comes to rest. The
 *  object is shared: read it straight away. */
export function swingBeats(ak) {
  if (!(ak >= 0)) return null;
  const k = ak > 1 ? 1 : ak;
  if (k < WIND_END) { _ph.wind = easeOut(k / WIND_END); _ph.hit = 0; }
  else if (k < STRIKE_AT) { const s = (k - WIND_END) / (STRIKE_AT - WIND_END); _ph.wind = 1 - s; _ph.hit = easeIn(s); }
  else if (k < HOLD_END) { _ph.wind = 0; _ph.hit = 1; }
  else { _ph.wind = 0; _ph.hit = 1 - easeInOut((k - HOLD_END) / (1 - HOLD_END)); }
  _ph.settle = arc(seg(k, HOLD_END, 1));
  return _ph;
}
/** How long (ms) after a swing begins its blow lands. */
export const strikeLead = (swingDur) => Math.round((swingDur > 0 ? swingDur : 240) * STRIKE_AT);

// ---------------- Turning round ----------------
// A body turning to face the other way is drawn like a card spun about its
// edge (full width for longer, only a moment edge-on), and it hops a little as
// it turns, so the turn reads as a step round rather than a squeeze. `u` runs
// 1..0 through the turn (the time left, as a share), as the characters' turn
// timers do.
export const TURN_MIN_W = 0.12;
/** The drawn width (0..1) part-way through a turn; full width before and after. */
export const turnWidth = (u) => (u > 0 && u < 1 ? Math.max(TURN_MIN_W, Math.abs(Math.cos(Math.PI * u))) : 1);
/** How high (px) it is lifted part-way through a turn. */
export const turnHop = (u) => arc(u) * 1.6;

// A tile is one step. Squared half-waves lift and set down each boot gently,
// with the other boot resting on the ground throughout the step.
export function heroWalk(gait = {}, calm = false) {
  const move = clamp01(gait.move || 0);
  const wave = Math.sin((gait.phase || 0) * Math.PI);
  const lift = move * (calm ? 2.2 : 3.6);
  return {
    step: wave * move,
    liftB: Math.max(0, wave) ** 2 * lift,
    liftF: Math.min(0, wave) ** 2 * lift,
    rise: wave * wave * move * (calm ? 0.35 : 1),
  };
}

// Through a front/rear turn the painted sprite passes through its edge.
// Track the progress for the player so a reversal continues from the pose
// already on screen. Previews and reflections can read an immediate pose.
const heroTurns = new WeakMap();
const HERO_TURN_MS = 140;
export function heroView(entity, rear, now, calm = false) {
  const target = rear ? 1 : 0;
  if (!entity || !Number.isFinite(now)) return { rear, width: 1, rise: 0 };
  if (calm) {
    heroTurns.delete(entity);
    return { rear, width: 1, rise: 0 };
  }
  let state = heroTurns.get(entity);
  if (!state || now < state.start) {
    state = { from: target, to: target, start: now };
    heroTurns.set(entity, state);
  }
  const u = smooth((now - state.start) / HERO_TURN_MS);
  const view = state.from + (state.to - state.from) * u;
  if (state.to !== target) {
    state.from = view;
    state.to = target;
    state.start = now;
  }
  return { rear: view >= 0.5, width: 0.16 + 0.84 * Math.abs(Math.cos(view * Math.PI)), rise: turnHop(view) * 0.4 };
}

// ---------------- Standing about ----------------
// Townsfolk drawn as one picture (no idle parts) still breathe, and every
// nine to fourteen seconds (each on their own clock) glance the other way for
// a moment, turning round and back, so a street of them never stands frozen.
export const LOOK_MS = 1500;
const LOOK_TURN_MS = 150;   // as long as a character's own turn (TURN_MS)
const _look = { side: 1, turn: 0 };
/** Glancing about at time `t`: `side` -1 while looking the other way (else
 *  1) and `turn` (1..0, as above) while turning to it or back. Shared out
 *  object: read it straight away. */
export function lookAround(t, seed, out = _look) {
  const every = 9000 + (seed % 41) * 120;
  const u = (((t + seed * 97) % every) + every) % every;
  out.side = u < LOOK_MS ? -1 : 1;
  out.turn = u < LOOK_TURN_MS ? 1 - u / LOOK_TURN_MS : u >= LOOK_MS && u < LOOK_MS + LOOK_TURN_MS ? 1 - (u - LOOK_MS) / LOOK_TURN_MS : 0;
  return out;
}
/** A gentle breath (a share of height, about +-1.4%), on the creature's own tempo. */
export const breath = (t, seed, tempo = 1) => Math.sin(t * 0.0026 * tempo + seed * 0.37) * 0.014;
