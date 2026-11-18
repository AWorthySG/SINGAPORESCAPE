// Moving parts for monsters, bosses and townsfolk, cut from the A-Worthy
// animation-parts sheets. Each creature's layers share one canvas
// (assets/creatures/{species,bosses}/rig/<id>_<part>.webp, or
// assets/creatures/townsfolk/idle/<id>_<part>.webp), lined up against the
// sheet's assembled picture, so drawing them all unrotated rebuilds it.
// `piv` is each part's joint as a fraction of that canvas. The tables below
// are measured from the sheets; the motions are shared by body plan.

const ease = (x) => 1 - (1 - x) * (1 - x);
// Wind-up, strike and recovery of an attack swing (attackK runs 0..1).
const atkPhase = (ak) => (ak < 0 ? null : ak < 0.35 ? { wind: ease(ak / 0.35), hit: 0 } : ak < 0.6 ? { wind: 1 - (ak - 0.35) / 0.25, hit: Math.sin(((ak - 0.35) / 0.25) * Math.PI / 2) } : { wind: 0, hit: 1 - ease((ak - 0.6) / 0.4) });
const walking = (o) => o.move ?? (o.moving ? 1 : 0);
const cast = (o) => (o.castK > 0 ? Math.sin(o.castK * Math.PI) : 0);
// Snarling, roaring or angry faces show while a blow lands or a signature move plays.
const fierce = (o) => { const a = atkPhase(o.attackK ?? -1); return (a && (a.hit > 0.15 || a.wind > 0.6)) || o.castK > 0; };
// A limb swinging with the walk (opposite pairs on opposite beats), barely stirring at rest.
const stride = (pair, amp, spd = 0.022) => (t, o) => {
  const m = walking(o);
  return Math.sin(t * spd + (pair ? Math.PI : 0)) * amp * m + Math.sin(t * 0.003 + pair) * 0.03 * (1 - m);
};
const sway = (amp, spd, ph = 0) => (t, o) => Math.sin(t * spd * (walking(o) > 0.3 ? 1.8 : 1) + ph) * amp;
// The striking limb: drawn back on the wind-up, thrown forward on the blow.
const strike = (back, fwd, idle = 0.04, ph = 0) => (t, o) => {
  const a = atkPhase(o.attackK ?? -1);
  return a ? -back * a.wind + fwd * a.hit : Math.sin(t * 0.0032 + ph) * idle;
};

// Motions by body plan: part name -> { swing, swap (alternate picture), grow }.
const PLANS = {
  // Four-legged walkers: diagonal pairs step together; the head nods, then snaps forward to bite.
  quad: {
    back_far: { swing: stride(1, 0.38) }, front_far: { swing: stride(0, 0.38) },
    back_near: { swing: stride(0, 0.38) }, front_near: { swing: stride(1, 0.38) },
    tail: { swing: sway(0.14, 0.006) },
    head: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return a ? 0.1 * a.wind - 0.14 * a.hit : Math.sin(t * (o.moving ? 0.022 : 0.004)) * (o.moving ? 0.045 : 0.03); }, swap: ['head_open', fierce] },
  },
  // Spiders, scorpions and crabs: the leg rows scuttle, the near claw opens on the wind-up and snaps shut.
  crawl: {
    legs_far: { swing: stride(1, 0.1, 0.045) }, legs_near: { swing: stride(0, 0.1, 0.045) },
    claw_far: { swing: strike(0.12, 0.1, 0.05, 2) },
    claw: { swing: strike(0.35, 0.22, 0.05), swap: ['claw_open', (o) => { const a = atkPhase(o.attackK ?? -1); return !!a && a.hit < 0.4; }] },
    tail: { swing: strike(0.22, 0.32, 0.06, 1) },
  },
  // Upright fighters: legs march, arms swing against them, the weapon arm winds back and cuts.
  biped: {
    leg_far: { swing: stride(1, 0.32, 0.02) }, leg_near: { swing: stride(0, 0.32, 0.02) },
    arm_far: { swing: (t, o) => stride(0, 0.16, 0.02)(t, o) + cast(o) * -0.3 },
    arm_near: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return a ? -0.7 * a.wind + 0.55 * a.hit : stride(1, 0.18, 0.02)(t, o) - cast(o) * 0.4; } },
    head: { swing: (t, o) => Math.sin(t * 0.0035) * 0.04 - cast(o) * 0.06, swap: ['head_attack', fierce] },
    cape: { swing: sway(0.1, 0.005, 1) },
  },
  // Ghosts, jellyfish: trailing parts ripple, arms drift and reach out to strike, the face turns angry.
  float: {
    lower: { swing: sway(0.1, 0.0045) },
    arm_far: { swing: strike(0.15, 0.2, 0.12, 1.5) },
    arm_near: { swing: (t, o) => strike(0.45, 0.5, 0.14)(t, o) - cast(o) * 0.4 },
    face: { swap: ['face_attack', fierce] },
  },
  // Fliers: the wings beat about the shoulder (fast for insects and bats).
  flier: {
    wing_far: { swing: (t, o) => Math.sin(t * (o.flap || 0.02) + 0.4) * 0.38 },
    wing_near: { swing: (t, o) => Math.sin(t * (o.flap || 0.02)) * 0.45 },
    feet: { swing: sway(0.08, 0.004) },
  },
  // Bosses: idle sway, a lunge with the main limb, and a roar with the crown or gem flaring on a signature move.
  boss: {
    tail: { swing: sway(0.12, 0.0045) },
    limb2: { swing: (t, o) => Math.sin(t * 0.003 + 2) * 0.05 - cast(o) * 0.22 },
    limb: { swing: (t, o) => strike(0.32, 0.3, 0.05)(t, o) - cast(o) * 0.3, swap: ['limb_strike', (o) => { const a = atkPhase(o.attackK ?? -1); return !!a && a.hit > 0.3; }] },
    head: { swing: (t, o) => { const a = atkPhase(o.attackK ?? -1); return (a ? -0.06 * a.wind + 0.08 * a.hit : Math.sin(t * 0.0021) * 0.035) - cast(o) * 0.08; }, swap: ['head_roar', fierce] },
    gem: { grow: (t, o) => 1 + Math.sin(t * 0.004) * 0.04 + cast(o) * 0.3 },
  },
};
// How fast each flier's wings beat.
const FLAP = { mosquito: 0.06, fruit_bat: 0.024, forest_drake: 0.013 };

// --- measured from the sheets (tools: cut, fit against the assembled picture, bake) ---
const RIG_DATA = {
};
const TOWN_DATA = {
};
// --- end of measured data ---

function build(id, d) {
  const plan = PLANS[d.plan];
  const files = Object.keys(d.piv);
  const parts = {};
  for (const n of d.order) {
    const p = plan[n] || {};
    const flap = FLAP[id];
    parts[n] = {
      piv: d.piv[n],
      swing: p.swing ? (flap ? (t, o) => p.swing(t, { ...o, flap }) : p.swing) : null,
      grow: p.grow || null,
      // An alternate picture (open mouth, open claw, striking arm) shown while the test holds.
      alt: p.swap && files.includes(p.swap[0]) ? p.swap[0] : null,
      swap: p.swap ? p.swap[1] : null,
    };
  }
  return { kind: d.kind, fit: d.fit, order: d.order, files, parts };
}
export const CREATURE_RIGS = Object.fromEntries(Object.entries(RIG_DATA).map(([id, d]) => [id, build(id, d)]));

// Townsfolk idle: a body that blinks, a near arm that hangs and now and then waves.
// `ref` is the assembled picture's box on the layer canvas, for sizing it like the still art.
export const TOWN_IDLE = TOWN_DATA;
