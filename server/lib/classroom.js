// Pure classroom rules shared by the API (and tested from the game's test
// suite): class codes, names, the weekly raid and its health.

// Weekly raid bosses, one per ISO week, in rotation.
export const RAID_BOSSES = [
  'The Inflation Wyrm', 'The Calculus Golem', 'The Grammar Gorgon', 'The Externality Hydra',
  'The Probability Sphinx', 'The Tense Revenant', 'The Deficit Drake', 'The Trigonometry Titan',
];
export const DAMAGE_PER_CORRECT = 10;
export const MAX_CORRECT_PER_CALL = 30;     // a single sync can't claim more than this
export const MAX_WISDOM_PER_CALL = 2500;

/** The raid's health: bigger classes face a bigger boss. */
export function raidMax(members) {
  return 500 + 150 * Math.min(Math.max(members, 1), 60);
}

/** ISO week key in Singapore time, e.g. "2026-W44". */
export function weekKey(now = Date.now()) {
  const d = new Date(now + 8 * 3600 * 1000);           // UTC+8
  const day = (d.getUTCDay() + 6) % 7;                 // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday - yearStart) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function bossFor(week) {
  const n = Number(week.slice(-2)) || 0;
  return RAID_BOSSES[n % RAID_BOSSES.length];
}

/** Class codes: 6 characters with no look-alikes (no 0/O, 1/I/L). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}
export const validCode = (c) => typeof c === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(c);

/** A display name: letters, digits, spaces and a little punctuation, 1-24 chars. */
export function cleanName(s, max = 24) {
  if (typeof s !== 'string') return '';
  return s.replace(/[^\p{L}\p{N} '._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function clampInt(v, lo, hi) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
}
