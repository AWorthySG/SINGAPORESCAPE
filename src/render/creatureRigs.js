// Moving parts for monsters, bosses and townsfolk, cut from the A-Worthy
// animation-parts sheets. Each creature's layers share one canvas
// (assets/creatures/{species,bosses}/rig/<id>_<part>.webp, or
// assets/creatures/townsfolk/idle/<id>_<part>.webp), lined up against the
// sheet's assembled picture, so drawing them all unrotated rebuilds it.
// `piv` is each part's joint as a fraction of that canvas. The tables below
// are measured from the sheets; the motions are shared by body plan.
import { TICK_MS } from '../config.js';
import { HOLD_END, STRIKE_AT, WIND_END, swingBeats, travelPhase } from './motionkit.js';

const ease = (x) => 1 - (1 - x) * (1 - x);
// Wind-up, strike, hold and recovery of an attack swing (attackK runs 0..1),
// on the shared beat (motionkit.js) so every limb lands with the body's lunge.
const atkPhase = swingBeats;
const walking = (o) => o.move ?? (o.moving ? 1 : 0);
const cast = (o) => (o.castK > 0 ? Math.sin(o.castK * Math.PI) : 0);
// Snarling, roaring or angry faces show while a blow lands or a signature move plays.
const fierce = (o) => { const a = atkPhase(o.attackK ?? -1); return (a && (a.hit > 0.15 || a.wind > 0.6)) || o.castK > 0; };
// How far through its stride a walker is, in radians. It follows the ground
// covered (o.walk counts tiles walked, as for the hero), not the clock, so the
// legs never pace on the spot or slide along: `spd` is the swing's speed at an
// ordinary walk (radians per ms), so a tile walked is TICK_MS of it. Standing
// still it holds, and the eased walk weight brings the legs back to rest.
// Without a walk phase (a preview), the clock stands in.
export const gaitPhase = (t, o, spd) => (typeof o.walk === 'number' ? o.walk * spd * TICK_MS : t * spd);
// A limb swinging with the walk (opposite pairs on opposite beats), barely stirring at rest.
export const stride = (pair, amp, spd = 0.022) => (t, o) => {
  const m = walking(o);
  return Math.sin(gaitPhase(t, o, spd) + (pair ? Math.PI : 0)) * amp * m + Math.sin(t * 0.003 + pair) * 0.03 * (1 - m);
};
const sway = (amp, spd, ph = 0) => (t, o) => Math.sin(travelPhase(t, o.walk, spd, spd * 1.8) + ph) * amp;
// The striking limb: drawn back on the wind-up, thrown forward on the blow.
const strike = (back, fwd, idle = 0.04, ph = 0) => (t, o) => {
  const a = atkPhase(o.attackK ?? -1);
  return a ? -back * a.wind + fwd * a.hit : Math.sin(t * 0.0032 + ph) * idle;
};
const wingBeat = (t, speed, phase = 0) => Math.sin(t * (speed || 0.02) + phase);

const BOSS_STRIKE_RECOVERY = 0.9;
const joinedStrike = (attackK) => attackK >= WIND_END && attackK < BOSS_STRIKE_RECOVERY;
function bossStrikeLimb(o, t, strikeJoin = 0) {
  const attackK = o.attackK ?? -1;
  return strikeJoin ? joinedStrike(attackK) : (atkPhase(attackK)?.hit ?? 0) > 0.3;
}

function bossLimbSwing(t, o, strikeJoin = 0) {
  const attackK = o.attackK ?? -1;
  const a = atkPhase(attackK);
  const angle = a ? -0.32 * a.wind + 0.3 * a.hit : Math.sin(t * 0.0032) * 0.05;
  // A few alternate limbs are already drawn well into the strike. Line them
  // up at the swaps, then ease out the correction by the time the blow lands.
  let join = 0;
  if (strikeJoin && joinedStrike(attackK)) {
    const k = attackK < STRIKE_AT
      ? (STRIKE_AT - attackK) / (STRIKE_AT - WIND_END)
      : Math.max(0, (attackK - HOLD_END) / (BOSS_STRIKE_RECOVERY - HOLD_END));
    join = strikeJoin * k * k * (3 - 2 * k);
  }
  return angle + join - cast(o) * 0.3;
}

// Motions by body plan: part name -> { swing, swap (alternate picture), grow }.
const PLANS = {
  // Four-legged walkers: diagonal pairs step together; the head nods, then snaps forward to bite.
  quad: {
    back_far: { swing: stride(1, 0.38) }, front_far: { swing: stride(0, 0.38) },
    back_near: { swing: stride(0, 0.38) }, front_near: { swing: stride(1, 0.38) },
    tail: { swing: sway(0.14, 0.006) },
    head: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1), m = walking(o); return a ? 0.1 * a.wind - 0.14 * a.hit : Math.sin(gaitPhase(t, o, 0.022)) * 0.045 * m + Math.sin(t * 0.004) * 0.03 * (1 - m); }, swap: ['head_open', fierce] },
  },
  // Spiders, scorpions and crabs: the leg rows scuttle, the near claw opens on the wind-up and snaps shut.
  crawl: {
    legs_far: { swing: stride(1, 0.1, 0.045) }, legs_near: { swing: stride(0, 0.1, 0.045) },
    claw_far: { swing: strike(0.12, 0.1, 0.05, 2) },
    claw: { swing: strike(0.35, 0.22, 0.05), swap: ['claw_open', (o) => { const a = atkPhase(o.attackK ?? -1); return !!a && a.wind > 0 && a.hit < 0.4; }] },
    tail: { swing: strike(0.22, 0.32, 0.06, 1) },
  },
  // Upright fighters: legs march, arms swing against them, the weapon arm winds back and cuts.
  biped: {
    leg_far: { swing: stride(1, 0.32, 0.02) }, leg_near: { swing: stride(0, 0.32, 0.02) },
    arm_far: { swing: (t, o) => stride(0, 0.16, 0.02)(t, o) + cast(o) * -0.3 },
    arm_near: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return a ? -0.4 * a.wind + 0.35 * a.hit : stride(1, 0.14, 0.02)(t, o) - cast(o) * 0.3; } },
    head: { swing: (t, o) => Math.sin(t * 0.0035) * 0.04 - cast(o) * 0.06, swap: ['head_attack', fierce] },
    cape: { swing: sway(0.1, 0.005, 1) },
    tail: { swing: sway(0.14, 0.006, 2) },
  },
  // Ghosts, jellyfish: trailing parts ripple, arms drift and reach out to strike, the face turns angry.
  float: {
    lower: { swing: sway(0.1, 0.0045) },
    arm_far: { swing: strike(0.15, 0.2, 0.12, 1.5) },
    arm_near: { swing: (t, o) => strike(0.45, 0.5, 0.14)(t, o) - cast(o) * 0.4 },
    face: { swap: ['face_attack', fierce] },
  },
  // Fliers: the wings beat about the shoulder (fast for insects and bats); the
  // dangling feet swing with the distance flown, and drift on the clock while it hovers.
  flier: {
    // The folded far wings keep their shoulder joins. The near-wing drafts
    // either separate from the body or jump too far when the pose changes.
    wing_far: { swing: (t, o, speed) => wingBeat(t, speed, 0.4) * 0.38, swap: ['wing_far_down', (o, t, speed) => wingBeat(t, speed, 0.4) < -0.8] },
    wing_near: { swing: (t, o, speed) => wingBeat(t, speed) * 0.45 },
    feet: { swing: (t, o) => { const m = walking(o); return Math.sin(gaitPhase(t, o, 0.0072)) * 0.08 * m + Math.sin(t * 0.004) * 0.08 * (1 - m); } },
  },
  // Bosses: idle sway, a lunge with the main limb, and a roar with the crown or gem flaring on a signature move.
  boss: {
    tail: { swing: sway(0.12, 0.0045) },
    limb2: { swing: (t, o) => Math.sin(t * 0.003 + 2) * 0.05 - cast(o) * 0.22 },
    limb: { swing: bossLimbSwing, swap: ['limb_strike', bossStrikeLimb] },
    head: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return (a ? -0.06 * a.wind + 0.08 * a.hit : Math.sin(t * 0.0021) * 0.035) - cast(o) * 0.08; }, swap: ['head_roar', fierce] },
    gem: { grow: (t, o) => 1 + Math.sin(t * 0.004) * 0.04 + cast(o) * 0.3 },
  },
  // --- Part E plans: snakes, swimmers and the pitcher plant ---
  // Snakes: the head sways, rears back on the wind-up and strikes with its fangs out; the tail tip flicks
  // (and rattles as it coils to strike). The coils themselves move with the whole body (BODY below).
  slither: {
    tail: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return Math.sin(travelPhase(t, o.walk, 0.005, 0.012) + 1.2) * 0.16 + (a ? Math.sin(t * 0.05) * 0.1 * a.wind : 0); } },
    head: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return a ? -0.28 * a.wind + 0.3 * a.hit : Math.sin(t * 0.0032) * 0.05 + Math.sin(t * 0.0011) * 0.03; }, swap: ['head_attack', fierce] },
  },
  // Sharks and dolphins: the tail fin sweeps (faster when swimming), the fins paddle, the head nods and opens its jaws to bite.
  swim: {
    tail: { swing: (t, o) => Math.sin(travelPhase(t, o.walk, 0.006, 0.016)) * 0.2 },
    arm_far: { swing: (t, o) => Math.sin(travelPhase(t, o.walk, 0.005, 0.012) + 2.2) * 0.16 },
    arm_near: { swing: (t, o) => Math.sin(travelPhase(t, o.walk, 0.005, 0.012) + 0.6) * 0.2 },
    head: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return a ? 0.08 * a.wind - 0.14 * a.hit : Math.sin(t * 0.003) * 0.035; }, swap: ['head_attack', fierce] },
  },
  // The pitcher plant: the leaves wave, the trap head bobs, rears back on the wind-up, then snaps forward wide open.
  plant: {
    arm_far: { swing: (t, o) => sway(0.1, 0.0035, 2)(t, o) - 0.18 * (atkPhase(o.attackK ?? -1)?.wind || 0) },
    arm_near: { swing: (t, o) => sway(0.12, 0.004, 0.5)(t, o) + 0.22 * (atkPhase(o.attackK ?? -1)?.wind || 0) },
    head: {
      swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return a ? -0.32 * a.wind + 0.36 * a.hit : Math.sin(t * 0.0028) * 0.06; },
      grow: (t, o) => 1 + 0.12 * (atkPhase(o.attackK ?? -1)?.hit || 0),   // the lunge: the trap swells towards its target
      swap: ['head_attack', fierce],
    },
  },
};
// Whole-body motion for the Part E plans, applied to every layer at once so the joints never open:
// `lean` skews the picture about the ground line (positive tips it forward), `dy` lifts it, `sx`/`sy` squash it.
const BODY = {
  // The coils sway side to side and breathe in and out; on the wind-up the snake draws back and gathers, then throws itself forward.
  slither: (t, o) => {
    const a = atkPhase(o.attackK ?? -1), m = walking(o), w = a ? a.wind : 0, h = a ? a.hit : 0;
    const coil = Math.sin(travelPhase(t, o.walk, 0.0035, 0.009));
    return { lean: coil * (0.035 + 0.03 * m) - 0.08 * w + 0.1 * h, dy: 0, sx: 1 + coil * 0.02 + 0.03 * w, sy: 1 - coil * 0.02 - 0.05 * w + 0.03 * h };
  },
  // Swimmers bob up and down and pitch gently; they pull back before a bite.
  swim: (t, o) => {
    const a = atkPhase(o.attackK ?? -1), w = a ? a.wind : 0, h = a ? a.hit : 0;
    return { lean: Math.sin(t * 0.0035 + 1) * 0.025 - 0.05 * w + 0.06 * h, dy: Math.sin(t * 0.0035) * 1.1, sx: 1, sy: 1 };
  },
  // The plant's stem sways in the breeze and leans back to gather for a snap.
  plant: (t, o) => {
    const a = atkPhase(o.attackK ?? -1), w = a ? a.wind : 0, h = a ? a.hit : 0;
    return { lean: Math.sin(t * 0.0025) * 0.04 + Math.sin(t * 0.0061 + 1) * 0.012 - 0.07 * w + 0.09 * h, dy: 0, sx: 1, sy: 1 - 0.04 * w + 0.03 * h };
  },
};
// How fast each flier's wings beat.
const FLAP = { mosquito: 0.06, fruit_bat: 0.024, forest_drake: 0.013, flying_fox: 0.022, hornbill: 0.014, vampire_bat: 0.026, kingfisher: 0.005 };

// --- measured from the sheets (tools: cut, fit against the assembled picture, bake) ---
const RIG_DATA = {
  imp: { plan: 'biped', kind: 'species', fit: 0.793,
    order: ['tail', 'cape', 'arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.5334, 0.5476], head: [0.5456, 0.5207], cape: [0.4594, 0.4612], arm_near: [0.541, 0.5501], leg_near: [0.3784, 0.6442], leg_far: [0.5272, 0.6715], arm_far: [0.5072, 0.5161], tail: [0.5615, 0.4552], head_attack: [0.5456, 0.5207] } },
  chicken: { plan: 'biped', kind: 'species', fit: 0.949,
    order: ['cape', 'arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.5698, 0.613], head: [0.6166, 0.557], arm_far: [0.5491, 0.5997], leg_near: [0.4416, 0.7369], leg_far: [0.7512, 0.7326], cape: [0.4489, 0.6064], arm_near: [0.3629, 0.4681], head_attack: [0.6166, 0.557] } },
  wild_boar: { plan: 'quad', kind: 'species', fit: 0.802,
    order: ['tail', 'back_far', 'front_far', 'back_near', 'front_near', 'body', 'head'],
    piv: { body: [0.518, 0.5219], head: [0.5447, 0.4975], front_far: [0.7316, 0.632], front_near: [0.2744, 0.6498], back_far: [0.5603, 0.6377], tail: [0.2111, 0.5511], back_near: [0.4117, 0.6995], head_open: [0.5447, 0.4975] } },
  komodo_dragon: { plan: 'quad', kind: 'species', fit: 0.638,
    order: ['tail', 'back_far', 'front_far', 'back_near', 'front_near', 'body', 'head'],
    piv: { body: [0.3851, 0.6171], head: [0.4479, 0.626], front_far: [0.7091, 0.6647], front_near: [0.5596, 0.6179], back_near: [0.343, 0.5238], tail: [0.3639, 0.5243], back_far: [0.892, 0.4754], head_open: [0.4479, 0.626] } },
  saltwater_crocodile: { plan: 'quad', kind: 'species', fit: 0.681,
    order: ['tail', 'back_far', 'front_far', 'back_near', 'front_near', 'body', 'head'],
    piv: { body: [0.4063, 0.6002], head: [0.427, 0.5869], front_far: [0.7288, 0.7131], front_near: [0.5233, 0.6177], back_far: [0.4579, 0.1825], back_near: [0.2935, 0.7271], tail: [0.4018, 0.5795], head_open: [0.427, 0.5869] } },
  macaque: { plan: 'quad', kind: 'species', fit: 0.818,
    order: ['tail', 'back_far', 'front_far', 'back_near', 'front_near', 'body', 'head'],
    piv: { body: [0.5129, 0.7398], head: [0.5831, 0.6643], tail: [0.2683, 0.8505], front_far: [0.7109, 0.5002], back_far: [0.2993, 0.428], back_near: [0.1783, 0.6925], front_near: [0.6384, 0.2745], head_open: [0.5831, 0.6643] } },
  pangolin: { plan: 'quad', kind: 'species', fit: 0.738,
    order: ['tail', 'back_far', 'front_far', 'back_near', 'front_near', 'body', 'head'],
    piv: { body: [0.4041, 0.5062], head: [0.5229, 0.5566], front_far: [0.7431, 0.6768], back_far: [0.3052, 0.7248], tail: [0.343, 0.5126], front_near: [0.5714, 0.6768], back_near: [0.8, 0.4303], head_open: [0.5229, 0.5566] } },
  sand_scorpion: { plan: 'crawl', kind: 'species', fit: 0.915,
    order: ['legs_far', 'claw_far', 'tail', 'legs_near', 'body', 'claw'],
    piv: { body: [0.4275, 0.618], tail: [0.32, 0.5662], claw: [0.5621, 0.7833], legs_near: [0.1386, 0.7083], claw_far: [0.6132, 0.5565], legs_far: [0.8181, 0.3897], claw_open: [0.5621, 0.7833] } },
  giant_crab: { plan: 'crawl', kind: 'species', fit: 0.767,
    order: ['legs_far', 'claw_far', 'tail', 'legs_near', 'body', 'claw'],
    piv: { body: [0.4425, 0.4843], tail: [0.6255, 0.6084], legs_near: [0.1269, 0.673], claw: [0.5199, 0.3882], legs_far: [0.4844, 0.7023], claw_far: [0.7324, 0.7427], claw_open: [0.5199, 0.3882] } },
  wraith: { plan: 'float', kind: 'species', fit: 0.809,
    order: ['arm_far', 'lower', 'body', 'face'],
    piv: { body: [0.5547, 0.4092], face: [0.6441, 0.3365], lower: [0.481, 0.5795], arm_far: [0.3855, 0.4728], face_attack: [0.6441, 0.3365] } },
  hantu_raya: { plan: 'float', kind: 'species', fit: 0.982,
    order: ['arm_far', 'lower', 'body', 'arm_near'],
    piv: { body: [0.5906, 0.3262], lower: [0.6475, 0.4888], arm_near: [0.7931, 0.5639], arm_far: [0.7941, 0.5781] } },
  penanggal: { plan: 'float', kind: 'species', fit: 0.929,
    order: ['arm_far', 'lower', 'body', 'face', 'arm_near'],
    piv: { body: [0.6442, 0.3921], face: [0.8362, 0.4884], lower: [0.6844, 0.6295], arm_near: [0.5795, 0.7428], arm_far: [0.6081, 0.5959], face_attack: [0.8362, 0.4884] } },
  box_jellyfish: { plan: 'float', kind: 'species', fit: 0.891,
    order: ['arm_far', 'lower', 'body', 'arm_near'],
    piv: { body: [0.4871, 0.3194], lower: [0.4942, 0.3488], arm_near: [0.101, 0.4984], arm_far: [0.1969, 0.8006] } },
  stone_golem: { plan: 'biped', kind: 'species', fit: 0.700,
    order: ['cape', 'arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.5154, 0.468], head: [0.5505, 0.4156], arm_near: [0.4372, 0.4184], arm_far: [0.6792, 0.4539], leg_far: [0.6059, 0.6858], leg_near: [0.3658, 0.6533], cape: [0.5684, 0.4155], head_attack: [0.5505, 0.4156] } },
  cursed_pirate: { plan: 'biped', kind: 'species', fit: 0.939,
    order: ['cape', 'arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.4314, 0.6421], head: [0.5164, 0.4666], arm_near: [0.4476, 0.6254], leg_far: [0.5533, 0.7624], leg_near: [0.3221, 0.7541], arm_far: [0.3625, 0.5703], cape: [0.1419, 0.4697], head_attack: [0.5164, 0.4666] } },
  goblin: { plan: 'biped', kind: 'species', fit: 0.864,
    order: ['leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.4593, 0.6298], head: [0.5152, 0.511], arm_near: [0.4124, 0.6046], leg_near: [0.3049, 0.6159], leg_far: [0.7874, 0.493], head_attack: [0.5152, 0.511] } },
  bandit: { plan: 'biped', kind: 'species', fit: 0.877,
    order: ['cape', 'arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.5278, 0.6927], head: [0.544, 0.6388], arm_near: [0.5893, 0.6615], cape: [0.46, 0.6135], leg_far: [0.6441, 0.7147], leg_near: [0.4423, 0.7317], arm_far: [0.4942, 0.5349], head_attack: [0.544, 0.6388] } },
  forest_drake: { plan: 'flier', kind: 'species', fit: 0.804,
    order: ['wing_far', 'feet', 'body', 'wing_near'],
    piv: { body: [0.5883, 0.5464], wing_near: [0.4809, 0.4341], feet: [0.561, 0.7266], wing_far: [0.5485, 0.5459], wing_near_down: [0.4809, 0.4341], wing_far_down: [0.5485, 0.5459] } },
  // On these fliers the wings extend to opposite sides of their joints, so
  // matching vertical strokes need opposite directions of rotation.
  fruit_bat: { plan: 'flier', kind: 'species', fit: 0.643, amp: { wing_far: -1 },
    order: ['wing_far', 'body', 'wing_near'],
    piv: { body: [0.5363, 0.5953], wing_near: [0.4649, 0.557], wing_far: [0.6935, 0.3986], wing_near_down: [0.4649, 0.557], wing_far_down: [0.6935, 0.3986] } },
  // Species rigs E1 (RS01–RS10)
  reticulated_python: { plan: 'slither', kind: 'species', fit: 1.016,
    order: ['tail', 'body', 'head'],
    piv: { body: [0.4788, 0.9815], head: [0.5273, 0.6062], tail: [0.4303, 0.6585], head_attack: [0.5273, 0.6062] } },
  reef_shark: { plan: 'swim', kind: 'species', fit: 1.016,
    order: ['arm_far', 'tail', 'body', 'head', 'arm_near'],
    piv: { body: [0.5182, 0.8923], head: [0.6, 0.7169], tail: [0.2333, 0.8123], arm_near: [0.4515, 0.84], arm_far: [0.6364, 0.8769], head_attack: [0.6, 0.7169] } },
  tarantula: { plan: 'crawl', kind: 'species', fit: 1.016,
    order: ['legs_far', 'claw_far', 'legs_near', 'body', 'claw'],
    piv: { body: [0.4636, 0.7846], claw: [0.4182, 0.7169], claw_far: [0.4394, 0.7569], legs_near: [0.4788, 0.7262], legs_far: [0.4303, 0.6031], claw_open: [0.4182, 0.7169] } },
  sea_snake: { plan: 'slither', kind: 'species', fit: 1.016,
    order: ['tail', 'body', 'head'],
    piv: { body: [0.5061, 0.9846], head: [0.3818, 0.3877], tail: [0.2303, 0.88], head_attack: [0.3818, 0.3877] } },
  jungle_spider: { plan: 'crawl', kind: 'species', fit: 1.016,
    order: ['legs_far', 'claw_far', 'legs_near', 'body', 'claw'],
    piv: { body: [0.497, 0.7815], claw: [0.4424, 0.7262], claw_far: [0.7758, 0.5477], legs_near: [0.5091, 0.7292], legs_far: [0.397, 0.5354], claw_open: [0.4424, 0.7262] } },
  rust_golem: { plan: 'biped', kind: 'species', fit: 1.016,
    order: ['cape', 'arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.5364, 0.7754], head: [0.6, 0.4123], arm_near: [0.403, 0.4338], arm_far: [0.6333, 0.5723], leg_near: [0.4091, 0.6954], leg_far: [0.597, 0.7169], cape: [0.5061, 0.52], head_attack: [0.6, 0.4123] } },
  pocong: { plan: 'float', kind: 'species', fit: 1.016,
    order: ['lower', 'body', 'face'],
    piv: { body: [0.497, 0.8554], face: [0.6576, 0.459], lower: [0.4182, 0.8277], face_attack: [0.6576, 0.459] } },
  skeleton: { plan: 'biped', kind: 'species', fit: 1.016,
    order: ['arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.5727, 0.8], head: [0.4879, 0.4892], arm_near: [0.4333, 0.5292], arm_far: [0.6455, 0.6062], leg_near: [0.4879, 0.7262], leg_far: [0.6364, 0.7415], head_attack: [0.4879, 0.4892] } },
  outlaw: { plan: 'biped', kind: 'species', fit: 1.016,
    order: ['cape', 'arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.4212, 0.8123], head: [0.503, 0.4585], arm_near: [0.4939, 0.5169], arm_far: [0.4606, 0.5138], leg_near: [0.4152, 0.7138], leg_far: [0.5727, 0.7077], cape: [0.3545, 0.6185], head_attack: [0.503, 0.4585] } },
  wild_dog: { plan: 'quad', kind: 'species', fit: 1.016,
    order: ['tail', 'back_far', 'front_far', 'back_near', 'front_near', 'body', 'head'],
    piv: { body: [0.4545, 0.8862], head: [0.597, 0.6123], front_near: [0.5364, 0.7815], front_far: [0.6455, 0.8062], back_near: [0.2939, 0.7446], back_far: [0.2515, 0.8615], tail: [0.2697, 0.6246], head_open: [0.597, 0.6123] } },
  // Species rigs E2 (RS11–RS20)
  jungle_wraith: { plan: 'float', kind: 'species', fit: 1.016,
    order: ['arm_far', 'lower', 'body', 'face', 'arm_near'],
    piv: { body: [0.6121, 0.8308], face: [0.8213, 0.4617], arm_near: [0.7091, 0.6185], arm_far: [0.5667, 0.76], lower: [0.6, 0.72], face_attack: [0.8213, 0.4617] } },
  smuggler: { plan: 'biped', kind: 'species', fit: 1.016,
    order: ['cape', 'arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.5424, 0.8923], head: [0.6273, 0.4092], arm_near: [0.6364, 0.5662], arm_far: [0.6879, 0.5385], leg_near: [0.6636, 0.7908], leg_far: [0.397, 0.8123], cape: [0.4818, 0.7169], head_attack: [0.6273, 0.4092] } },
  pink_dolphin: { plan: 'swim', kind: 'species', fit: 1.016,
    order: ['arm_far', 'tail', 'body', 'head', 'arm_near'],
    piv: { body: [0.497, 0.6308], head: [0.5576, 0.4554], tail: [0.2636, 0.7446], arm_near: [0.5576, 0.5662], arm_far: [0.4758, 0.28], head_attack: [0.5576, 0.4554] } },
  hornbill: { plan: 'flier', kind: 'species', fit: 1.016, amp: { wing_far: -1 },
    order: ['wing_far', 'feet', 'body', 'wing_near'],
    piv: { body: [0.5182, 0.7877], wing_near: [0.3909, 0.6769], wing_far: [0.5091, 0.7415], feet: [0.5424, 0.7108], wing_near_down: [0.3909, 0.6769], wing_far_down: [0.5091, 0.7415] } },
  dock_rat: { plan: 'quad', kind: 'species', fit: 1.016,
    order: ['back_far', 'front_far', 'back_near', 'front_near', 'body', 'tail', 'head'],
    piv: { body: [0.4818, 0.9723], head: [0.5424, 0.4738], front_near: [0.3879, 0.6092], front_far: [0.4515, 0.5077], back_near: [0.4606, 0.6185], back_far: [0.5667, 0.9046], tail: [0.2939, 0.88], head_open: [0.5424, 0.4738] } },
  horseshoe_crab: { plan: 'crawl', kind: 'species', fit: 1.016,
    order: ['legs_far', 'tail', 'legs_near', 'body'],
    piv: { body: [0.503, 0.9108], legs_near: [0.5455, 0.8708], legs_far: [0.3273, 0.8677], tail: [0.1848, 0.5138] } },
  drowned_sailor: { plan: 'biped', kind: 'species', fit: 1.016,
    order: ['arm_far', 'leg_far', 'leg_near', 'body', 'head', 'arm_near'],
    piv: { body: [0.4848, 0.8862], head: [0.4485, 0.4185], arm_near: [0.3667, 0.5754], arm_far: [0.5273, 0.5692], leg_near: [0.3939, 0.7569], leg_far: [0.5, 0.7631], head_attack: [0.4485, 0.4185] } },
  flying_fox: { plan: 'flier', kind: 'species', fit: 1.016, amp: { wing_far: -1 },
    order: ['wing_far', 'feet', 'body', 'wing_near'],
    piv: { body: [0.5576, 0.8123], wing_near: [0.4273, 0.6369], wing_far: [0.6667, 0.6554], feet: [0.4212, 0.8092], wing_near_down: [0.4273, 0.6369], wing_far_down: [0.6667, 0.6554] } },
  king_cobra: { plan: 'slither', kind: 'species', fit: 1.016,
    order: ['body', 'head'],
    piv: { body: [0.4727, 0.9785], head: [0.503, 0.7138], head_attack: [0.503, 0.7138] } },
  boar_king: { plan: 'boss', fit: 0.798,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4627, 0.6163], head: [0.5063, 0.5555], gem: [0.6067, 0.1696], tail: [0.1836, 0.6144], limb2: [0.665, 0.7578], limb: [0.7695, 0.56], head_roar: [0.5063, 0.5555], limb_strike: [0.7695, 0.56] } },
  ancient_tembusu: { plan: 'boss', fit: 0.816,
    order: ['limb2', 'base', 'limb', 'head'],
    piv: { base: [0.4738, 0.8043], head: [0.4825, 0.6434], limb2: [0.676, 0.8556], limb: [0.3442, 0.3346], head_roar: [0.4825, 0.6434], limb_strike: [0.3442, 0.3346] } },
  bedok_bandit_lord: { plan: 'boss', fit: 0.853,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.5627, 0.6818], head: [0.575, 0.4866], limb2: [0.5709, 0.6429], limb: [0.4208, 0.6227], tail: [0.5522, 0.6313], head_roar: [0.575, 0.4866], limb_strike: [0.4208, 0.6227] } },
  buaya_putih: { plan: 'boss', fit: 0.822,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.4344, 0.7434], head: [0.5082, 0.6458], tail: [0.3116, 0.6827], limb2: [0.5426, 0.8098], limb: [0.4626, 0.7676], head_roar: [0.5082, 0.6458], limb_strike: [0.4626, 0.7676] } },
  durian_behemoth: { plan: 'boss', fit: 0.829,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.6053, 0.6242], head: [0.6637, 0.5065], limb: [0.4948, 0.6566], limb2: [0.8011, 0.6432], tail: [0.5738, 0.538], head_roar: [0.6637, 0.5065], limb_strike: [0.4948, 0.6566] } },
  nian_beast: { plan: 'boss', fit: 0.773,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.3695, 0.7383], head: [0.3865, 0.6396], tail: [0.22, 0.6312], limb2: [0.4743, 0.7315], limb: [0.4949, 0.6896], head_roar: [0.3865, 0.6396], limb_strike: [0.4949, 0.6896] } },
  macaque_alpha: { plan: 'boss', fit: 0.823,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.4945, 0.6394], head: [0.5552, 0.4041], tail: [0.2473, 0.6791], limb2: [0.223, 0.193], limb: [0.5016, 0.6188], head_roar: [0.5552, 0.4041], limb_strike: [0.5016, 0.6188] } },
  reservoir_serpent: { plan: 'boss', fit: 0.908,
    order: ['tail', 'limb2', 'base', 'head', 'gem'],
    piv: { base: [0.5147, 0.7546], head: [0.5297, 0.7115], gem: [0.2463, 0.6001], limb2: [0.4395, 0.735], tail: [0.457, 0.2675], head_roar: [0.5297, 0.7115] } },
  merlion: { plan: 'boss', fit: 0.841,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.359, 0.6786], head: [0.3502, 0.6033], limb: [0.6772, 0.4303], tail: [0.3788, 0.6611], gem: [0.5704, 0.113], limb2: [0.5494, 0.6091], head_roar: [0.3502, 0.6033], limb_strike: [0.6772, 0.4303] } },
  night_safari_tiger: { plan: 'boss', fit: 0.826,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.5677, 0.7304], head: [0.5726, 0.5554], tail: [0.2763, 0.8098], limb2: [0.5102, 0.4989], limb: [0.534, 0.6616], head_roar: [0.5726, 0.5554], limb_strike: [0.534, 0.6616] } },
  // Boss rigs D1 (RB01–RB10), cut from the Part D parts sheets and registered to each sheet's assembled picture.
  goblin_warchief: { plan: 'boss', fit: 0.936, strikeJoin: -0.75,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4739, 0.7226], head: [0.5365, 0.5056], limb: [0.4974, 0.6635], limb2: [0.3872, 0.7871], gem: [0.5867, 0.2542], head_roar: [0.5365, 0.5056], limb_strike: [0.4974, 0.6635] } },
  toman_tyrant: { plan: 'boss', fit: 0.791,
    order: ['limb2', 'base', 'tail', 'limb', 'head', 'gem'],
    piv: { base: [0.5171, 0.5556], head: [0.4719, 0.3872], limb: [0.4827, 0.5123], limb2: [0.188, 0.526], tail: [0.724, 0.8482], gem: [0.7374, 0.1295], head_roar: [0.4719, 0.3872], limb_strike: [0.4827, 0.5123] } },
  ubin_quarry_python: { plan: 'boss', fit: 0.781,
    order: ['tail', 'limb2', 'base', 'head'],
    piv: { base: [0.4708, 0.7431], head: [0.3772, 0.5648], limb2: [0.7274, 0.692], tail: [0.2405, 0.4377], head_roar: [0.3772, 0.5648] } },
  ubin_stone_frog: { plan: 'boss', fit: 0.812,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.51, 0.6873], head: [0.49, 0.62], limb: [0.5323, 0.6589], limb2: [0.3018, 0.6888], gem: [0.4868, 0.1582], head_roar: [0.49, 0.62], limb_strike: [0.5323, 0.6589] } },
  kopitiam_roach_queen: { plan: 'boss', fit: 0.816,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.5475, 0.6787], head: [0.5293, 0.4774], limb: [0.3831, 0.7949], limb2: [0.5018, 0.4498], tail: [0.597, 0.2408], gem: [0.619, 0.2421], head_roar: [0.5293, 0.4774], limb_strike: [0.3831, 0.7949] } },
  bakau_mud_lobster: { plan: 'boss', fit: 0.786,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.5001, 0.6584], head: [0.5177, 0.4543], limb: [0.6347, 0.5889], limb2: [0.65, 0.5987], tail: [0.3756, 0.3961], head_roar: [0.5177, 0.4543], limb_strike: [0.6347, 0.5889] } },
  // The far vine is fitted behind the right shoulder, with its joint inside the trunk.
  strangler_fig_mother: { plan: 'boss', fit: 0.802,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.5071, 0.7322], head: [0.4953, 0.5214], limb: [0.314, 0.587], limb2: [0.6745, 0.5525], gem: [0.5928, 0.5517], head_roar: [0.4953, 0.5214], limb_strike: [0.314, 0.587] } },
  kranji_bullfrog_emperor: { plan: 'boss', fit: 0.758,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4694, 0.5943], head: [0.5627, 0.6267], limb: [0.4005, 0.6641], limb2: [0.5227, 0.49], gem: [0.643, 0.1589], head_roar: [0.5627, 0.6267], limb_strike: [0.4005, 0.6641] } },
  sand_scorpion_king: { plan: 'boss', fit: 0.856,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.3978, 0.6382], head: [0.3989, 0.5954], limb: [0.3367, 0.7513], limb2: [0.7048, 0.6036], tail: [0.3212, 0.6772], gem: [0.5793, 0.3967], head_roar: [0.3989, 0.5954], limb_strike: [0.3367, 0.7513] } },
  sea_eagle_sovereign: { plan: 'boss', fit: 0.792,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.5061, 0.6866], head: [0.6452, 0.5165], limb: [0.3744, 0.6534], limb2: [0.6413, 0.6213], tail: [0.4762, 0.6672], head_roar: [0.6452, 0.5165], limb_strike: [0.3744, 0.6534] } },
  // Boss rigs D2 (RB11–RB20), cut from the Part D parts sheets and registered to each sheet's assembled picture.
  slag_titan: { plan: 'boss', fit: 0.847,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.467, 0.6668], head: [0.5325, 0.469], limb: [0.7246, 0.4752], limb2: [0.2647, 0.4598], tail: [0.4989, 0.3744], gem: [0.4613, 0.5326], head_roar: [0.5325, 0.469], limb_strike: [0.7246, 0.4752] } },
  chilli_crab: { plan: 'boss', fit: 0.754,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4545, 0.5705], head: [0.7097, 0.4759], limb: [0.3181, 0.6862], limb2: [0.6998, 0.6633], gem: [0.4887, 0.1793], head_roar: [0.7097, 0.4759], limb_strike: [0.3181, 0.6862] } },
  // The painted guardian's paws stay planted while its head, tail and halo move.
  lion_of_light: { plan: 'boss', fit: 1, amp: { tail: 0.5 },
    order: ['tail', 'base', 'head', 'gem'],
    piv: { base: [0.5162, 0.8359], head: [0.5576, 0.7711], tail: [0.23, 0.8661], gem: [0.5313, 0.2463], head_roar: [0.5576, 0.7711] } },
  hantu_tinggi: { plan: 'boss', fit: 0.861,
    order: ['tail', 'base', 'head', 'limb2', 'limb'],
    piv: { base: [0.5151, 0.5698], head: [0.5, 0.7], limb: [0.3759, 0.4957], limb2: [0.7925, 0.5272], tail: [0.8448, 0.8745], head_roar: [0.5, 0.7], limb_strike: [0.3759, 0.4957] } },
  kelong_king_crab: { plan: 'boss', fit: 0.693,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4782, 0.6489], head: [0.3652, 0.5898], limb: [0.17, 0.5668], limb2: [0.7836, 0.5754], gem: [0.4913, 0.2932], head_roar: [0.3652, 0.5898], limb_strike: [0.17, 0.5668] } },
  spider_queen: { plan: 'boss', fit: 0.678,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.5354, 0.4497], head: [0.6315, 0.5841], limb: [0.3265, 0.5353], limb2: [0.6251, 0.6011], gem: [0.7655, 0.2702], head_roar: [0.6315, 0.5841], limb_strike: [0.3265, 0.5353] } },
  kranji_buffalo_king: { plan: 'boss', fit: 0.771,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4331, 0.6589], head: [0.4233, 0.4282], limb: [0.6877, 0.6637], limb2: [0.4991, 0.6227], tail: [0.0991, 0.6049], gem: [0.7048, 0.1895], head_roar: [0.4233, 0.4282], limb_strike: [0.6877, 0.6637] } },
  bandit_kingpin: { plan: 'boss', fit: 0.866,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4877, 0.6496], head: [0.6468, 0.4142], limb: [0.27, 0.38], limb2: [0.6741, 0.6407], tail: [0.7371, 0.7376], gem: [0.6274, 0.0837], head_roar: [0.6468, 0.4142], limb_strike: [0.27, 0.38] } },
  hungry_ghost_king: { plan: 'boss', fit: 0.910,
    order: ['base', 'head', 'tail', 'limb2', 'limb', 'gem'],
    piv: { base: [0.4844, 0.5985], head: [0.3551, 0.6066], limb: [0.3043, 0.627], limb2: [0.8464, 0.646], tail: [0.7996, 0.5665], gem: [0.4931, 0.1573], head_roar: [0.3551, 0.6066], limb_strike: [0.3043, 0.627] } },
  arowana_emperor: { plan: 'boss', fit: 0.765,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4786, 0.6281], head: [0.379, 0.5497], limb: [0.4703, 0.6445], limb2: [0.4791, 0.4116], tail: [0.2566, 0.6999], gem: [0.608, 0.2293], head_roar: [0.379, 0.5497], limb_strike: [0.4703, 0.6445] } },
  // Boss rigs D3 (RB21–RB30), cut from the Part D parts sheets and registered to each sheet's assembled picture.
  bone_colossus: { plan: 'boss', fit: 0.897, strikeJoin: 0.375,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.5458, 0.6481], head: [0.5996, 0.2597], limb: [0.3491, 0.7037], limb2: [0.6998, 0.5132], gem: [0.6676, 0.0939], head_roar: [0.5996, 0.2597], limb_strike: [0.3491, 0.7037] } },
  mangrove_hydra: { plan: 'boss', fit: 0.825,
    order: ['limb2', 'base', 'limb', 'head'],
    piv: { base: [0.4885, 0.7399], head: [0.4676, 0.5685], limb: [0.4279, 0.6575], limb2: [0.5967, 0.6838], head_roar: [0.4676, 0.5685], limb_strike: [0.4279, 0.6575] } },
  toyol_kingpin: { plan: 'boss', fit: 0.800,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.5441, 0.7592], head: [0.6619, 0.5117], limb: [0.7694, 0.6328], limb2: [0.4536, 0.5732], gem: [0.6115, 0.6024], head_roar: [0.6619, 0.5117], limb_strike: [0.7694, 0.6328] } },
  timah_drake: { plan: 'boss', fit: 0.778,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.577, 0.6607], head: [0.6924, 0.4713], limb: [0.6435, 0.6363], limb2: [0.7827, 0.5128], tail: [0.3398, 0.7461], head_roar: [0.6924, 0.4713], limb_strike: [0.6435, 0.6363] } },
  atlas_moth_empress: { plan: 'boss', fit: 0.750,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.5709, 0.66], head: [0.5582, 0.4725], limb: [0.4169, 0.7748], limb2: [0.7376, 0.6066], gem: [0.617, 0.1779], head_roar: [0.5582, 0.4725], limb_strike: [0.4169, 0.7748] } },
  molten_golem: { plan: 'boss', fit: 0.764,
    order: ['limb2', 'base', 'limb', 'head'],
    piv: { base: [0.5362, 0.7316], head: [0.7953, 0.4908], limb: [0.3583, 0.6598], limb2: [0.7182, 0.6055], head_roar: [0.7953, 0.4908], limb_strike: [0.3583, 0.6598] } },
  tualang_treant: { plan: 'boss', fit: 0.841,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4243, 0.725], head: [0.3797, 0.6384], limb: [0.4981, 0.6298], limb2: [0.2645, 0.767], gem: [0.4958, 0.1046], head_roar: [0.3797, 0.6384], limb_strike: [0.4981, 0.6298] } },
  sentosa_kraken: { plan: 'boss', fit: 0.833,
    order: ['limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.48, 0.6052], head: [0.4107, 0.6201], limb: [0.3093, 0.8287], limb2: [0.2656, 0.6708], gem: [0.5177, 0.1627], head_roar: [0.4107, 0.6201], limb_strike: [0.3093, 0.8287] } },
  punggol_lantern_spirit: { plan: 'boss', fit: 0.702,
    order: ['tail', 'limb2', 'base', 'limb', 'head', 'gem'],
    piv: { base: [0.4355, 0.6295], head: [0.3192, 0.509], limb: [0.7562, 0.6931], limb2: [0.3257, 0.4992], tail: [0.2052, 0.698], gem: [0.5559, 0.3102], head_roar: [0.3192, 0.509], limb_strike: [0.7562, 0.6931] } },
  wilderness_warlord: { plan: 'boss', fit: 0.847,
    order: ['tail', 'limb2', 'base', 'limb', 'head'],
    piv: { base: [0.4864, 0.5894], head: [0.6082, 0.3715], limb: [0.4422, 0.5166], limb2: [0.3097, 0.5802], tail: [0.6145, 0.632], head_roar: [0.6082, 0.3715], limb_strike: [0.4422, 0.5166] } },
  // Species rigs E3 (RS21–RS30)
  sea_turtle: { plan: 'quad', kind: 'species', fit: 0.726,
    order: ['front_far', 'back_near', 'body', 'front_near', 'head'],
    piv: { front_far: [0.7243, 0.5011], back_near: [0.2173, 0.5829], front_near: [0.4859, 0.6056], body: [0.4299, 0.4447], head: [0.6443, 0.413], head_open: [0.6443, 0.413] } },
  vampire_bat: { plan: 'flier', kind: 'species', fit: 0.496, amp: { wing_near: -1 },
    order: ['wing_far', 'feet', 'body', 'wing_near'],
    piv: { wing_far: [0.412, 0.6111], feet: [0.4419, 0.7116], body: [0.5342, 0.5364], wing_near: [0.6314, 0.538] } },
  kingfisher: { plan: 'flier', kind: 'species', fit: 0.907,
    order: ['feet', 'body', 'wing_near'],
    piv: { feet: [0.4542, 0.8393], body: [0.5103, 0.4564], wing_near: [0.3955, 0.5657] } },
  carnivorous_plant: { plan: 'plant', kind: 'species', fit: 0.876,
    order: ['arm_far', 'body', 'head', 'arm_near'],
    piv: { arm_far: [0.5312, 0.2332], body: [0.4549, 0.7088], head: [0.5466, 0.3273], arm_near: [0.3701, 0.5745], head_attack: [0.5466, 0.3273] } },
  banded_leaf_monkey: { plan: 'quad', kind: 'species', fit: 0.856,
    order: ['tail', 'front_far', 'body', 'back_near', 'front_near', 'head'],
    piv: { tail: [0.2395, 0.811], front_far: [0.5888, 0.7881], back_near: [0.3607, 0.7582], front_near: [0.5478, 0.7834], body: [0.4857, 0.7281], head: [0.5523, 0.5462], head_open: [0.5523, 0.5462] } },
  bunian: { plan: 'float', kind: 'species', fit: 0.888,
    order: ['arm_far', 'lower', 'body', 'face', 'arm_near'],
    piv: { arm_far: [0.7182, 0.5557], lower: [0.4193, 0.63], body: [0.5508, 0.4306], face: [0.7702, 0.377], arm_near: [0.6062, 0.6287], face_attack: [0.7702, 0.377] } },
  clouded_leopard: { plan: 'quad', kind: 'species', fit: 0.775,
    order: ['tail', 'back_far', 'front_far', 'back_near', 'front_near', 'body', 'head'],
    piv: { tail: [0.179, 0.574], back_far: [0.1779, 0.8126], front_far: [0.6376, 0.7626], back_near: [0.2214, 0.705], front_near: [0.5273, 0.7279], body: [0.4206, 0.6598], head: [0.5846, 0.5185], head_open: [0.5846, 0.5185] } },
  sambar_deer: { plan: 'quad', kind: 'species', fit: 0.926,
    order: ['tail', 'back_far', 'front_far', 'back_near', 'front_near', 'body', 'head'],
    piv: { tail: [0.1595, 0.6177], back_far: [0.3333, 0.8734], front_far: [0.6358, 0.8439], back_near: [0.2631, 0.6886], front_near: [0.5298, 0.7951], body: [0.4597, 0.6951], head: [0.5907, 0.5639], head_open: [0.5907, 0.5639] } },
  // CRR-1 and CRR-2: parts of the CR-1 mud crab and kelong crab, drawn in place on
  // the sheet, so they stack straight onto the assembled picture (no fitting). The
  // mud crab's small claw is in front of its shell, as the drawing has it. Their
  // assembled crabs are drawn more compact than the stills (narrower for their
  // height), so `fit` matches the still's area rather than its height.
  mud_crab: { plan: 'crawl', kind: 'species', fit: 0.780,
    order: ['legs_far', 'legs_near', 'body', 'claw_far', 'claw'],
    piv: { legs_far: [0.2198, 0.6976], claw_far: [0.3539, 0.7354], legs_near: [0.6483, 0.7362], body: [0.4522, 0.5623], claw: [0.7258, 0.5239], claw_open: [0.7258, 0.5239] } },
  kelong_crab: { plan: 'crawl', kind: 'species', fit: 0.703,
    order: ['legs_far', 'claw_far', 'legs_near', 'body', 'claw'],
    piv: { legs_far: [0.2073, 0.6242], claw_far: [0.7314, 0.5595], legs_near: [0.5943, 0.6513], body: [0.4503, 0.3935], claw: [0.384, 0.6591], claw_open: [0.384, 0.6591] } },
};
const TOWN_DATA = {
  farmer: { W: 229, H: 300, ref: [9, 9, 218, 296], piv: { body: [0.4694, 0.506], arm: [0.5775, 0.6075], body_blink: [0.4694, 0.506], arm_wave: [0.6228, 0.552] } },
  fletcher: { W: 234, H: 300, ref: [13, 9, 225, 296], piv: { body: [0.5326, 0.5199], arm: [0.3256, 0.5755], body_blink: [0.5326, 0.5199], arm_wave: [0.3592, 0.5372] } },
  // The repainted starter residents share a 256px canvas and a common foot line.
  guide: { W: 256, H: 256, ref: [42, 12, 214, 249], piv: { body: [0.5, 0.5], arm: [0.6731, 0.6717] } },
  hawker: { W: 256, H: 256, ref: [29, 12, 226, 249], piv: { body: [0.5, 0.5], arm: [0.3259, 0.631], arm_wave: [0.3259, 0.631] } },
  light_priestess: { W: 220, H: 300, ref: [9, 9, 211, 296], piv: { body: [0.4939, 0.5131], body_blink: [0.4939, 0.5131] } },
  mage: { W: 213, H: 300, ref: [9, 9, 205, 296], piv: { body: [0.4674, 0.5329], arm: [0.6373, 0.6696], body_blink: [0.4674, 0.5329], arm_wave: [0.6175, 0.5624] } },
  mercenary_bruiser: { W: 197, H: 300, ref: [13, 9, 188, 296], piv: { body: [0.4724, 0.5113], arm: [0.1756, 0.48], body_blink: [0.4724, 0.5113], arm_wave: [0.1919, 0.4807] } },
  mercenary_duellist: { W: 300, H: 299, ref: [9, 9, 291, 296], piv: { body: [0.3705, 0.5385], body_blink: [0.3705, 0.5385] } },
  mercenary_sellsword: { W: 224, H: 300, ref: [9, 9, 215, 296], piv: { body: [0.4059, 0.5115], arm: [0.5433, 0.5477], body_blink: [0.4059, 0.5115], arm_wave: [0.4939, 0.5129] } },
  mercenary_spear_guard: { W: 173, H: 300, ref: [9, 9, 164, 296], piv: { body: [0.4299, 0.5417], body_blink: [0.4299, 0.5417] } },
  shadow_broker: { W: 223, H: 300, ref: [9, 9, 202, 296], piv: { body: [0.4406, 0.5031], arm: [0.6587, 0.5951], body_blink: [0.4406, 0.5031], arm_wave: [0.6013, 0.5143] } },
  pest_officer: { W: 256, H: 256, ref: [22, 12, 233, 249], piv: { body: [0.5, 0.5] } },
  shopkeeper: { W: 256, H: 256, ref: [31, 12, 225, 249], piv: { body: [0.5, 0.5], arm: [0.6722, 0.6133], arm_wave: [0.6722, 0.6133] } },
  skills_tutor: { W: 256, H: 256, ref: [41, 12, 215, 249], piv: { body: [0.5, 0.5], arm: [0.6693, 0.6656], arm_wave: [0.6693, 0.6656] } },
  slayer_master: { W: 234, H: 300, ref: [9, 9, 225, 296], piv: { body: [0.47, 0.5193], body_blink: [0.47, 0.5193] } },
  villager: { W: 244, H: 300, ref: [30, 9, 236, 296], piv: { body: [0.5025, 0.5251], arm: [0.3458, 0.5075], body_blink: [0.5025, 0.5251], arm_wave: [0.39, 0.5022] } },
  aworthling: { W: 200, H: 300, ref: [9, 9, 192, 296], piv: { body: [0.4944, 0.5245], body_blink: [0.4944, 0.5245] } },
  banker: { W: 256, H: 256, ref: [30, 12, 226, 249], piv: { body: [0.5, 0.5], arm: [0.6848, 0.6109], arm_wave: [0.6848, 0.6109] } },
};
// --- end of measured data ---

function build(id, d) {
  const plan = PLANS[d.plan];
  const files = Object.keys(d.piv);
  const parts = {};
  const flap = FLAP[id];
  for (const n of d.order) {
    const p = plan[n] || {};
    const amp = d.amp?.[n] ?? 1;   // adapt a part's swing to its weight or orientation
    const motion = flap || (n === 'limb' ? d.strikeJoin : undefined);
    const sw = p.swing ? (motion ? (t, o) => p.swing(t, o, motion) : p.swing) : null;
    parts[n] = {
      piv: d.piv[n],
      swing: sw && amp !== 1 ? (t, o) => sw(t, o) * amp : sw,
      grow: p.grow || null,
      // An alternate picture (open mouth, folded wing, striking arm) shown while the test holds.
      alt: p.swap && files.includes(p.swap[0]) ? p.swap[0] : null,
      swap: p.swap ? (motion ? (o, t) => p.swap[1](o, t, motion) : p.swap[1]) : null,
    };
  }
  return { kind: d.kind, fit: d.fit, order: d.order, files, parts, body: BODY[d.plan] || null };
}
// The body plans that move the whole picture as well as its parts (for tests).
export const bodyPlans = () => Object.keys(BODY);
export const buildRig = build;
export const CREATURE_RIGS = Object.fromEntries(Object.entries(RIG_DATA).map(([id, d]) => [id, build(id, d)]));
// A boss rig measured elsewhere (the later parts sheets keep their tables in sprites.js), with the shared boss motions.
export const bossRig = (id, d) => build(id, { plan: 'boss', ...d });

// Townsfolk idle: a body that blinks, a near arm that hangs and now and then waves.
// `ref` is the assembled picture's box on the layer canvas, for sizing it like the still art.
export const TOWN_IDLE = TOWN_DATA;
