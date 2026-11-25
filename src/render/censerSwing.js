// The Zealot's censer swing: through an attack the censer hangs on its own
// chain and swings like a weight on a string, rather than jumping between
// three painted arms.
// - The arm and the censer are cut from the Zealot's resting weapon picture
//   (rig/zealot-weapon.webp: the sleeve and fist, and the censer below them);
//   the chain between them is drawn, gold links on navy ink.
// - The arm follows a few keys (drops back for the wind-up, whips forward and
//   up, settles); the chain's angle chases a target on a damped spring, so the
//   censer lags behind the fist on the way in, swings through, overshoots and
//   rocks back to rest. Both are worked out once into a table, so each frame
//   only looks up its moment of the clip (u) and nothing is allocated.
// - The spell is flung as the censer swings out in front (the clip's `hits`):
//   the bolt waits in the censer until then and leaves from it (censerBolt,
//   called by the renderer's projectile pass). It still lands exactly when the
//   game says, so damage timing is untouched.
// - A flame glow in the spell's colour flares on the release; a little
//   incense smoke and a few embers trail the censer through the swing. Low
//   graphics keeps only the glow; Reduce motion damps the wobble and drops the
//   flicker. No religious symbols: flame, smoke and sparks only.
// Clip progress u runs 0..1 over the game's swing time (heroanim.js 'censer').
import { HERO_CLIPS } from './heroanim.js';
import { heroLit } from './herolight.js';
import { classSpell } from '../data/magic.js';

const TAU = Math.PI * 2;
const INK = '#22304A';
// The resting weapon picture (125 x 143 px), drawn at S units a pixel. These
// are its landmarks in picture pixels: the shoulder the arm turns about, the
// ring under the fist where the chain hangs, the top of the censer's knob
// (where the chain meets it) and the middle of the censer's fire.
const PIC_W = 125, PIC_H = 143;
const PIV = [19.2, 32.4], RING = [78, 36], KNOB = [77, 64], FIRE = [79, 113];
// The pieces cut from it: the sleeve and fist (two boxes, keeping the chain
// below the ring out), the knob and the censer's body (two circles, keeping
// the painted smoke wisp out).
const ARM_BOXES = [[0, 0, 92, 38], [0, 0, 68, 70]];
const CENSER_RINGS = [[78, 74, 11], [79, 113, 35]];

/** When the spell leaves the censer (0..1 through the clip). */
export const CENSER_RELEASE = HERO_CLIPS.censer.hits[0];

// ---------------- The swing, worked out once ----------------
const ease = { io: (x) => x * x * (3 - 2 * x), in: (x) => x * x, out: (x) => 1 - (1 - x) * (1 - x), lin: (x) => x };
function keyed(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (u <= b[0]) { const a = keys[i - 1]; return a[1] + (b[1] - a[1]) * ease[b[2] || 'io']((u - a[0]) / (b[0] - a[0])); }
  }
  return keys[keys.length - 1][1];
}
// The arm's turn about the shoulder (rad, + down): it drops and draws back
// with the censer, whips forward and up on the throw, carries on a little
// past (the follow-through), then settles.
const ARM_KEYS = [[0, 0], [0.34, 0.85, 'io'], [0.48, -0.45, 'io'], [0.58, -0.62, 'out'], [0.82, -0.05, 'io'], [1, 0, 'io']];
// Where the chain is pulled to (rad from hanging straight down, + out in
// front): back behind the fist for the wind-up, then flung out in front.
const AIM_KEYS = [[0, 0], [0.3, -0.9, 'io'], [0.36, -0.95, 'lin'], [0.44, 1.65, 'in'], [0.55, 1.7, 'lin'], [0.72, 0, 'io'], [1, 0]];
// The spring on the chain: stiffness (per ms, at the clip's usual length) and
// damping. Reduce motion damps it hard: no wobble as it settles.
const SPRING = { w: 0.1, z: 0.42 }, SPRING_CALM = { w: 0.1, z: 0.85 };
// The chain pays out through the fingers as the censer is thrown (a wider,
// more readable arc) and is drawn back in as it settles: its length x this.
const REACH_KEYS = [[0, 1], [0.3, 1, 'io'], [0.47, 1.7, 'out'], [0.6, 1.65, 'lin'], [0.86, 1, 'io'], [1, 1]];
const NOMINAL_MS = 270, STEPS = 540;   // a sample every half millisecond
const _tables = {};
function table(calm) {
  const k = calm ? 'calm' : 'full';
  if (_tables[k]) return _tables[k];
  const { w, z } = calm ? SPRING_CALM : SPRING;
  const arm = new Float32Array(STEPS + 1), chain = new Float32Array(STEPS + 1), reach = new Float32Array(STEPS + 1);
  // (A fixed step: the same few sub-steps between every pair of samples.)
  const dt = NOMINAL_MS / STEPS / 2;
  let th = 0, v = 0;
  for (let i = 0; i <= STEPS; i++) {
    for (let j = 0; i && j < 2; j++) {
      const ms = ((i - 1) * 2 + j) * dt;
      const a = w * w * (keyed(AIM_KEYS, ms / NOMINAL_MS) - th) - 2 * z * w * v;
      v += a * dt; th += v * dt;
    }
    const u = i / STEPS;
    // The last stretch eases whatever swing is left to rest, so the clip ends
    // exactly on the resting picture (no jump as it hands back).
    const rest = u > 0.86 ? ease.io((u - 0.86) / 0.14) : 0;
    chain[i] = th * (1 - rest);
    arm[i] = keyed(ARM_KEYS, u);
    reach[i] = keyed(REACH_KEYS, u);
  }
  return (_tables[k] = { arm, chain, reach });
}
const _pose = { arm: 0, chain: 0, reach: 1 };
/** The arm's turn, the chain's angle and how far it has paid out at clip
 *  progress u (pure: the same u, the same pose). `out` is filled and returned. */
export function censerPose(u, calm = false, out = _pose) {
  const t = table(calm), x = Math.max(0, Math.min(1, u)) * STEPS, i = Math.min(STEPS - 1, Math.floor(x)), f = x - i;
  out.arm = t.arm[i] + (t.arm[i + 1] - t.arm[i]) * f;
  out.chain = t.chain[i] + (t.chain[i + 1] - t.chain[i]) * f;
  out.reach = t.reach[i] + (t.reach[i + 1] - t.reach[i]) * f;
  return out;
}
/** The back arm's turn (rad) against the swing: it pulls back as the censer is thrown. */
export function censerBackTurn(u, calm = false) {
  return -censerPose(u, calm, _back).arm * 0.3;
}
const _back = { arm: 0, chain: 0, reach: 1 };

// Picture pixels -> units, the fist's ring and the censer's fire about the
// shoulder and the chain's end.
let S = 0, RING_R = 0, RING_A = 0, LINK = 0, FIRE_DX = 0, FIRE_DY = 0;
function measure(w) {
  if (S === w / PIC_W) return;
  S = w / PIC_W;
  RING_R = Math.hypot(RING[0] - PIV[0], RING[1] - PIV[1]) * S;
  RING_A = Math.atan2(RING[1] - PIV[1], RING[0] - PIV[0]);
  LINK = (KNOB[1] - RING[1]) * S;
  FIRE_DX = (FIRE[0] - KNOB[0]) * S; FIRE_DY = (FIRE[1] - KNOB[1]) * S;
}
const _pts = { fx: 0, fy: 0, ax: 0, ay: 0, cx: 0, cy: 0 };
/** Where the fist's ring (f), the chain's end (a) and the censer's fire (c)
 *  are at clip progress u, in the rig's units from the shoulder (sx, sy). */
export function censerPoints(u, sx, sy, w, calm = false, out = _pts) {
  measure(w);
  const p = censerPose(u, calm, _p2);
  const ang = RING_A + p.arm;
  out.fx = sx + Math.cos(ang) * RING_R; out.fy = sy + Math.sin(ang) * RING_R;
  const s = Math.sin(p.chain), c = Math.cos(p.chain);
  out.ax = out.fx + s * LINK * p.reach; out.ay = out.fy + c * LINK * p.reach;
  // The censer hangs along the chain: its fire is turned with it.
  out.cx = out.ax + FIRE_DX * c + FIRE_DY * s; out.cy = out.ay - FIRE_DX * s + FIRE_DY * c;
  return out;
}
const _p2 = { arm: 0, chain: 0, reach: 1 };

// ---------------- Colours by the spell's element ----------------
// [glow, core, smoke, ember]: Holy Fire white-gold, Wrath red-gold, Ash
// grey-orange, Blood deep red. Anything else burns plain gold. (Blood's halo
// is painted rather than added: added light can only brighten, and a deep
// red brightened turns pink.)
const LOOK = {
  holyfire: ['#ffd25a', '#fff6d8', '#efe4d4', '#ffd870'],
  wrath: ['#ff5a2a', '#ffd08a', '#c4a49c', '#ff9040'],
  ash: ['#ff8a3a', '#ffc890', '#958a84', '#ff9a40'],
  bloodprice: ['#b0102a', '#ff6070', '#7a4a52', '#ff3048'],
};
const PLAIN = ['#ffb040', '#fff0c0', '#e6dccc', '#ffd070'];
let _spellKey = null, _spellEl = null;
function elementOf(opts) {
  const key = `${opts.jobClass}|${opts.entity?.spell}`;
  if (key !== _spellKey) { _spellKey = key; _spellEl = classSpell(opts.jobClass, opts.entity?.spell)?.element || null; }
  return _spellEl;
}

// ---------------- The bolt's hand-off (read by censerBolt) ----------------
// Each swing drawn bumps `swing`; `rel` is where the censer let go, in canvas
// pixels, once it has (null before). `at` is when the swing was last drawn.
const SHOT = { swing: 0, u: 1, at: -1e9, rel: false, rx: 0, ry: 0 };
const _rp = { fx: 0, fy: 0, ax: 0, ay: 0, cx: 0, cy: 0 };

/** Draw the censer swing for this attack frame: the arm from the shoulder
 *  (sx, sy), the chain, the censer, its glow, smoke and embers. `img` is the
 *  resting weapon picture and `w` its width in units. False (nothing drawn)
 *  until the picture has loaded. */
export function drawCenserSwing(ctx, img, anim, sx, sy, w, opts = {}) {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const u = Math.max(0, Math.min(1, anim.u || 0));
  const low = !!anim.low, calm = !!anim.calm;
  const time = opts.time || 0;
  // A new swing (the clip started over, or none drawn for a while).
  if (u < SHOT.u - 0.05 || time - SHOT.at > 150) { SHOT.swing++; SHOT.rel = false; }
  SHOT.u = u; SHOT.at = time;
  const pic = heroLit(img);
  const p = censerPoints(u, sx, sy, w, calm, _pts);
  // (Kept now: the trail's look-ups below reuse the scratch pose.)
  const { arm, chain } = censerPose(u, calm, _p2);
  const look = LOOK[elementOf(opts)] || PLAIN;
  // How fast the censer is travelling (units per clip), for the smoke and embers.
  const prev = censerPoints(Math.max(0, u - 0.02), sx, sy, w, calm, _rp);
  const speed = Math.hypot(p.cx - prev.cx, p.cy - prev.cy) / 0.02;
  const fx = p.fx, fy = p.fy, ax = p.ax, ay = p.ay, cx = p.cx, cy = p.cy;
  const alpha = ctx.globalAlpha;
  // Incense smoke, behind the censer: puffs left along its path, rising and
  // spreading as they age (none in low graphics).
  if (!low) {
    ctx.fillStyle = look[2];
    for (let i = 1; i <= 5; i++) {
      const age = i * 0.045, q = censerPoints(Math.max(0, u - age), sx, sy, w, calm, _rp);
      const r = 1.8 + age * 16, k = 1 - i / 6;
      ctx.globalAlpha = alpha * 0.22 * k;
      ctx.beginPath(); ctx.arc(q.cx + age * 6, q.cy - 2.5 - age * 22, r, 0, TAU); ctx.fill();
    }
    // A smear where the censer has just swept, through the fast part of the swing.
    const sm = Math.min(1, Math.max(0, (speed - 25) / 45));
    if (sm > 0.02) {
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha * 0.35 * sm; ctx.strokeStyle = look[0]; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let i = 1; i <= 3; i++) { const q = censerPoints(Math.max(0, u - i * 0.02), sx, sy, w, calm, _rp); ctx.lineTo(q.cx, q.cy); }
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
  }
  // The flame's glow, a halo behind the censer: soft through the swing,
  // flaring as the spell is flung (it flickers, except with Reduce motion).
  const rel = CENSER_RELEASE;
  const flare = u < rel - 0.06 ? 0 : u < rel ? ease.in((u - rel + 0.06) / 0.06) : Math.max(0, 1 - (u - rel) / 0.22);
  const edge = Math.min(1, u / 0.12, (1 - u) / 0.12);
  const flick = calm || low ? 1 : 0.85 + 0.15 * Math.sin(time * 0.031) * Math.sin(time * 0.017 + 1);
  const f = (calm ? 0.6 : 1) * flare;
  ctx.globalCompositeOperation = look === LOOK.bloodprice ? 'source-over' : 'lighter';
  ctx.fillStyle = look[0];
  ctx.globalAlpha = alpha * (0.16 * edge + 0.36 * f) * flick;
  ctx.beginPath(); ctx.arc(cx, cy, 4 + 4 * f, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  // The chain: gold links on navy ink, alternately face-on and edge-on, more
  // of them as it pays out.
  const cang = Math.atan2(ay - fy, ax - fx), clen = Math.hypot(ax - fx, ay - fy);
  const links = Math.max(4, Math.round(clen / 1.25));
  ctx.lineWidth = 0.4; ctx.strokeStyle = INK;
  for (let i = 0; i < links; i++) {
    const k = (i + 0.5) / links, lx = fx + (ax - fx) * k, ly = fy + (ay - fy) * k;
    ctx.fillStyle = i % 2 ? '#d99a2b' : '#f3c04a';
    ctx.beginPath(); ctx.ellipse(lx, ly, clen / links * 0.6, i % 2 ? 0.32 : 0.62, cang, 0, TAU); ctx.fill(); ctx.stroke();
  }
  // The censer, hanging along the chain from its knob.
  ctx.save();
  ctx.translate(ax, ay); ctx.rotate(-chain); ctx.scale(S, S); ctx.translate(-KNOB[0], -KNOB[1]);
  ctx.beginPath();
  for (const [x, y, r] of CENSER_RINGS) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  ctx.clip();
  ctx.drawImage(pic, 0, 0, PIC_W, PIC_H);
  ctx.restore();
  // The sleeve and fist over the chain's top, turned about the shoulder.
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(arm); ctx.scale(S, S); ctx.translate(-PIV[0], -PIV[1]);
  ctx.beginPath();
  for (const [x, y, bw, bh] of ARM_BOXES) ctx.rect(x, y, bw, bh);
  ctx.clip();
  ctx.drawImage(pic, 0, 0, PIC_W, PIC_H);
  ctx.restore();
  // ...and the flame inside it, brightest as the spell is flung.
  ctx.globalCompositeOperation = 'lighter';
  if (!low) {
    ctx.fillStyle = look[1];
    ctx.globalAlpha = alpha * (0.25 * edge + 0.45 * f) * flick;
    ctx.beginPath(); ctx.arc(cx, cy, 1.6 + 1.6 * f, 0, TAU); ctx.fill();
    // Embers thrown off the censer as it whips round, falling as they fade.
    const em = Math.min(1, Math.max(0, (speed - 30) / 40));
    if (em > 0.02) {
      ctx.fillStyle = look[3];
      for (let i = 0; i < 4; i++) {
        const age = 0.02 + i * 0.03, q = censerPoints(Math.max(0, u - age), sx, sy, w, calm, _rp);
        const h = Math.sin(SHOT.swing * 12.9898 + i * 78.233) * 43758.5453, rnd = h - Math.floor(h);
        ctx.globalAlpha = alpha * em * (1 - i / 4);
        ctx.beginPath(); ctx.arc(q.cx + (rnd - 0.5) * 8 * (1 + age * 10), q.cy + (rnd - 0.3) * 4 + age * age * 120, 0.7, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  // Where the censer is on the canvas as the spell is flung (the bolt starts
  // there): worked out at exactly the release, the first frame past it.
  if (!SHOT.rel && u >= rel && ctx.getTransform) {
    const q = censerPoints(rel, sx, sy, w, calm, _rp), m = ctx.getTransform();
    SHOT.rx = m.a * q.cx + m.c * q.cy + m.e; SHOT.ry = m.b * q.cx + m.d * q.cy + m.f;
    SHOT.rel = true;
  }
  return true;
}

// A scratch copy of a bolt, flying from the censer (reused: nothing per frame).
const _bolt = { e: {}, t: 0 };
/** A Zealot's bolt, seen by the renderer's projectile pass (`t` 0..1 through
 *  its flight, `now` the frame's time): null when it isn't one thrown from a
 *  censer swing (drawn as it is), { t: -1 } while it waits in the censer, else
 *  { e, t }: the bolt starting from where the censer let it go, its flight
 *  squeezed into the time left, so it still lands when the game says. */
export function censerBolt(e, t, game, now, ox, oy) {
  if (e.kind !== 'bolt' || game?.jobClass !== 'zealot') return null;
  // First seen: thrown from the swing being drawn right now, or not ours.
  if (e._cz === undefined) e._cz = now - SHOT.at < 120 && !SHOT.rel ? SHOT.swing : 0;
  if (!e._cz) return null;
  if (e._czT === undefined) {
    // Still in the censer (a late frame lets it go anyway, so it always shows).
    if (e._cz === SHOT.swing && !SHOT.rel && t < 0.7 && now - SHOT.at < 120) { _bolt.t = -1; return _bolt; }
    const k = game.camera ? game.camera.dpr * game.camera.zoom : 1;
    const from = e._cz === SHOT.swing && SHOT.rel && k > 0;
    e._czT = Math.min(0.9, t);
    e._czX = from ? SHOT.rx / k + ox : e.x; e._czY = from ? SHOT.ry / k + oy : e.y;
    if (from && game.camera.tilt > 0) {   // the depth view: back through its projection (projection.js)
      const w = game.camera.screenToWorld(SHOT.rx / game.camera.dpr, SHOT.ry / game.camera.dpr);
      e._czX = w.x; e._czY = w.y;
    }
  }
  const b = Object.assign(_bolt.e, e);
  b.x = e._czX; b.y = e._czY;
  _bolt.t = Math.max(0, Math.min(1, (t - e._czT) / (1 - e._czT)));
  return _bolt;
}
