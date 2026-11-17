// Shared set-up for the balance harness (tools/balance): boots the real Game
// headlessly, the same way tests/integration.test.mjs does. Not deployed (the
// site build copies only index.html, styles, src, assets, the manifest and sw.js).

// Seeded Math.random (the same mulberry32 as tests/seed.mjs, copied here so a
// plain `node tools/balance/...` run doesn't pull in node:test).
export function seedRandom(seed = 20261112) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// In-memory localStorage so save.js has somewhere to write.
export function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
if (!globalThis.localStorage) globalThis.localStorage = fakeStorage();

const { Game } = await import('../../src/game/game.js');
const { clearSave } = await import('../../src/game/save.js');

/** A brand-new character of the given class (starter kit), UI stubbed out, chat muted. */
export function freshGame(classId, seed = 20261112) {
  seedRandom(seed);
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass(classId);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.msg = () => {};
  return g;
}

/** Parse `--name value` / `--flag` command-line options. */
export function parseArgs(argv = process.argv.slice(2)) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2), v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) o[k] = true; else { o[k] = v; i++; }
  }
  return o;
}

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
};

/** Print rows as a fixed-width table. cols: [{ key, label, w, left, fmt }]. */
export function printTable(rows, cols) {
  const pad = (c, s) => (c.left ? s.padEnd(c.w) : s.padStart(c.w));
  console.log(cols.map((c) => pad(c, c.label)).join(' '));
  for (const r of rows) console.log(cols.map((c) => pad(c, c.fmt ? c.fmt(r[c.key], r) : String(r[c.key] ?? '-'))).join(' '));
}
