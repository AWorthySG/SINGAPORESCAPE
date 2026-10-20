// Daily bounties: three kill targets a day, picked from monsters near your
// combat level that actually live in the world, paid out in coins. Clearing
// all three on consecutive days builds a streak that boosts the payouts.

/** Local calendar day, e.g. "2026-10-20". */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function prevDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

// Small deterministic RNG so one day's board doesn't change on reload.
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

/** Pick three bounties. `monsters` = [{ id, name, level, zone }] that exist in the world. */
export function makeBounties(day, combatLevel, monsters) {
  const rnd = seeded(day + ':' + Math.floor(combatLevel / 5));
  let lo = Math.max(1, combatLevel - 8), hi = combatLevel + 6;
  let pool = [];
  while (pool.length < 3 && hi < 200) {
    pool = monsters.filter((m) => m.level >= lo && m.level <= hi);
    lo = Math.max(1, lo - 6); hi += 8;
  }
  if (!pool.length) pool = monsters.slice();
  const picks = [];
  const used = new Set();
  for (let i = 0; i < 3 && pool.length; i++) {
    let m = pool[Math.floor(rnd() * pool.length)];
    for (let k = 0; used.has(m.id) && k < 8; k++) m = pool[Math.floor(rnd() * pool.length)];
    used.add(m.id);
    const need = 8 + Math.floor(rnd() * 13);
    picks.push({ id: m.id, name: m.name, zone: m.zone || '', need, have: 0, reward: Math.round(m.level * need * 4 + 100), done: false });
  }
  return picks;
}

/** Streak bonus: +10% per consecutive full day, up to +100%. */
export function streakMult(streak) { return 1 + Math.min(10, Math.max(0, streak)) * 0.1; }
