import { raceOf } from '../data/races.js';

const METAL_CONSTRUCTS = new Set(['rust_golem', 'rebar_golem', 'tuas_crane_colossus']);

/** The sound of the body the blow meets. Families share a sound across tiers. */
export function impactProfile(def, id) {
  if (!def) return null;
  if (def.sprite === 'crab' || def.sprite === 'turtle') return 'shell';
  if (def.sprite === 'slime') return 'slime';
  const race = raceOf(def, id);
  if (race === 'construct' && (METAL_CONSTRUCTS.has(def.family) || METAL_CONSTRUCTS.has(id))) return 'metal';
  return race;
}

/** Landed critical hits retain the same body underneath their accent. */
export function impactCue(def, id, critical = false) {
  const kind = critical ? 'crit' : 'hit';
  const profile = impactProfile(def, id);
  return profile ? `${kind}:${profile}` : kind;
}
