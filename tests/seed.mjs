// Deterministic randomness for the test suite. The game rolls Math.random for
// hits, crits, loot and spawn spots, and a handful of tests used to fail now and
// then on an unlucky roll (blocking a deploy). Every test file imports this
// first: Math.random becomes a small seeded generator (mulberry32), reset to the
// same seed before every test, so each test sees the same rolls on every run
// whatever order or company it runs in. Set TEST_SEED to try other seeds.
import { beforeEach } from 'node:test';

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
beforeEach(() => seedRandom());
