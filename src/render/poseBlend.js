// Pose blending: hides the snap when an attack restarts before the last one
// has finished (a fast attacker, or a special move cutting a swing short).
// Poses are pure functions of swing progress, so jumping from 0.6 back to 0
// would teleport every limb in one frame. Instead the gap between the pose
// last drawn and the new target is kept as an offset that dies away over a
// few frames (inertial blending). Ordinary motion is never smoothed, so the
// quick strike keeps its snap; only true discontinuities are eased.
export const BLEND_MS = 55;   // time constant of the offset's decay
const STALE_MS = 250;         // not drawn for this long: start afresh

/** A blender with its own memory, one per kind of pose. `blend(key, pose,
 *  now, k, fields)` returns `pose` with the listed number fields eased; `key`
 *  is the character (a WeakMap key, so nothing leaks), `k` its swing
 *  progress (-1 when not attacking). Without a key the pose passes through. */
export function poseBlender() {
  const memory = new WeakMap();
  return (key, pose, now, k, fields) => {
    if (!key || typeof key !== 'object' || !pose) return pose;
    let st = memory.get(key);
    if (!st) { st = { t: now, k, off: {}, out: {} }; memory.set(key, st); }
    const dt = now - st.t;
    const fresh = dt < 0 || dt > STALE_MS;
    // A swing that starts again part-way through the last one is the jump to hide.
    const restart = !fresh && k >= 0 && st.k >= 0 && k < st.k - 0.02;
    const decay = fresh ? 0 : Math.exp(-dt / BLEND_MS);
    for (const f of fields) {
      const target = pose[f] || 0;
      let off = (st.off[f] || 0) * decay;
      if (restart && st.out[f] !== undefined) off = st.out[f] - target;
      if (Math.abs(off) < 1e-4) off = 0;
      st.off[f] = off;
      pose[f] = target + off;
      st.out[f] = pose[f];
    }
    st.t = now; st.k = k;
    return pose;
  };
}

// A painted rig often has two drawings of one arm (the weapon raised, and
// mid-strike). Fading one into the other across the whole swing left both
// half-visible for a long stretch (a ghost weapon); this swaps them over a
// narrow band instead, so the change lands while the arm is moving fast and
// reads as one smear rather than a double image. x is the 0..1 blend wanted;
// the result is the second drawing's opacity (the first gets 1 minus it).
const smoothstep = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export const swapOpacity = (x) => smoothstep((x - 0.38) / 0.24);
