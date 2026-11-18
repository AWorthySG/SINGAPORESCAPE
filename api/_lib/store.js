// Where accounts and cloud saves are kept: a tiny key-value interface with two
// implementations. In production it is Upstash Redis, reached over its REST API
// with plain fetch (no npm packages); in tests it is an in-memory Map that
// behaves the same way, expiry and all.
//
// The interface (every method async):
//   get(key)                      -> string | null
//   set(key, value, { nx })       -> true, or false when nx and the key exists
//   incr(key, ttlSec)             -> the new count; the key expires ttlSec after
//                                    its first increment (a fixed rate-limit window)
//   ttl(key)                      -> seconds left on the key (or -1 / -2 like Redis)
//   saveCas(user, baseRev, meta, data)
//                                 -> { ok: true, rev } or { ok: false, rev, meta }
//      Writes a save only if the stored revision still equals baseRev, all in
//      one step, so two devices can never both "win" the same revision.

/** Keys for one user's records (usernames are stored lower-case). */
export const keys = {
  user: (u) => `awa:user:${u}`,
  rev: (u) => `awa:save:${u}:rev`,
  meta: (u) => `awa:save:${u}:meta`,
  data: (u) => `awa:save:${u}:data`,
  limit: (kind, who) => `awa:rl:${kind}:${who}`,
};

/** The Upstash settings from the environment (Vercel's Upstash integration sets
 *  the KV_* names; a database connected by hand has the UPSTASH_* ones). */
export function redisConfig(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

// Compare-and-set for a save, run inside Redis so it is atomic.
// KEYS: rev, meta, data. ARGV: baseRev, meta JSON, save JSON.
const CAS_SCRIPT = `
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
if cur ~= tonumber(ARGV[1]) then
  return {0, cur, redis.call('GET', KEYS[2]) or ''}
end
redis.call('SET', KEYS[1], cur + 1)
redis.call('SET', KEYS[2], ARGV[2])
redis.call('SET', KEYS[3], ARGV[3])
return {1, cur + 1, ''}`;

export function redisStore({ url, token }, fetchImpl = globalThis.fetch) {
  const post = (path, body) => fetchImpl(url + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  async function cmd(...args) {
    const res = await post('', args.map(String));
    const out = await res.json().catch(() => ({}));
    // The error text from Redis never holds a value we sent, only its reason.
    if (!res.ok || out.error) throw new Error(`Storage error (${res.status}): ${out.error || 'request failed'}`);
    return out.result;
  }
  async function pipeline(cmds) {
    const res = await post('/pipeline', cmds.map((c) => c.map(String)));
    const out = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(out)) throw new Error(`Storage error (${res.status})`);
    const bad = out.find((r) => r && r.error);
    if (bad) throw new Error(`Storage error: ${bad.error}`);
    return out.map((r) => r.result);
  }
  return {
    async get(key) { return (await cmd('GET', key)) ?? null; },
    async set(key, value, { nx = false } = {}) {
      const r = await cmd(...(nx ? ['SET', key, value, 'NX'] : ['SET', key, value]));
      return r === 'OK';
    },
    async incr(key, ttlSec) {
      // EXPIRE ... NX sets the window only on the first hit, so it never slides.
      const [n] = await pipeline([['INCR', key], ['EXPIRE', key, ttlSec, 'NX']]);
      return Number(n);
    },
    async ttl(key) { return Number(await cmd('TTL', key)); },
    async saveCas(user, baseRev, meta, data) {
      const [ok, rev, curMeta] = await cmd('EVAL', CAS_SCRIPT, 3, keys.rev(user), keys.meta(user), keys.data(user), baseRev, meta, data);
      return Number(ok) === 1 ? { ok: true, rev: Number(rev) } : { ok: false, rev: Number(rev), meta: curMeta || null };
    },
  };
}

/** The same interface over a Map, for tests (and nothing else). `now` is a
 *  clock in ms so tests can move time on past an expiry. */
export function memoryStore(now = () => Date.now()) {
  const m = new Map();   // key -> { v, exp }
  const live = (k) => {
    const e = m.get(k);
    if (e && e.exp && e.exp <= now()) { m.delete(k); return null; }
    return e || null;
  };
  return {
    map: m,
    async get(key) { return live(key)?.v ?? null; },
    async set(key, value, { nx = false } = {}) {
      if (nx && live(key)) return false;
      m.set(key, { v: String(value), exp: 0 });
      return true;
    },
    async incr(key, ttlSec) {
      const e = live(key);
      const n = (e ? Number(e.v) : 0) + 1;
      m.set(key, { v: String(n), exp: e?.exp || now() + ttlSec * 1000 });
      return n;
    },
    async ttl(key) {
      const e = live(key);
      if (!e) return -2;
      return e.exp ? Math.ceil((e.exp - now()) / 1000) : -1;
    },
    async saveCas(user, baseRev, meta, data) {
      const cur = Number(live(keys.rev(user))?.v || 0);
      if (cur !== Number(baseRev)) return { ok: false, rev: cur, meta: live(keys.meta(user))?.v ?? null };
      m.set(keys.rev(user), { v: String(cur + 1), exp: 0 });
      m.set(keys.meta(user), { v: meta, exp: 0 });
      m.set(keys.data(user), { v: data, exp: 0 });
      return { ok: true, rev: cur + 1 };
    },
  };
}

/** The store for this deployment, or null when no database is connected. */
export function storeFromEnv(env = process.env) {
  const cfg = redisConfig(env);
  return cfg ? redisStore(cfg) : null;
}
