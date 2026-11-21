// Deterministic randomness for the test suite. The game rolls Math.random for
// hits, crits, loot and spawn spots, and a handful of tests used to fail now and
// then on an unlucky roll (blocking a deploy). Every test file imports this
// first: Math.random becomes a small seeded generator (mulberry32), reset to the
// same seed before every test, so each test sees the same rolls on every run
// whatever order or company it runs in. Set TEST_SEED to try other seeds.
import { beforeEach } from 'node:test';
import { GOLDEN } from '../src/data/skillhours.js';
import { UNLOCKS } from '../src/data/unlocks.js';
import { GATHER_FUN } from '../src/game/gathering.js';
import { FISH_SCHOOL } from '../src/game/fishschool.js';

export const SEED = Number(process.env.TEST_SEED) || 20261112;

export function seedRandom(seed = SEED) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

seedRandom();
// Golden hours off too: XP amounts in tests mustn't depend on the in-game clock
// (tests/skillhours.test.mjs switches them back on for itself).
// Skill unlocks off as well, so balance checks see the base rates (skillshome.test.mjs turns them on).
// Gathering streaks, lucky finds and contracts too (lifeskillfun.test.mjs turns them on),
// and schools of fish (fish-school.test.mjs).
beforeEach(() => { seedRandom(); GOLDEN.on = false; UNLOCKS.on = false; GATHER_FUN.on = false; FISH_SCHOOL.on = false; });
