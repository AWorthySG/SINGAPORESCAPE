// The class server (server/api/class.js), run against an in-memory stand-in for
// Upstash Redis's REST API, plus the pure rules in server/lib/classroom.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekKey, raidMax, validCode, newCode, cleanName, bossFor } from '../server/lib/classroom.js';

// A minimal Redis: just the commands the API uses.
function fakeRedis() {
  const kv = new Map();
  const get = (k, mk) => { if (!kv.has(k) && mk) kv.set(k, mk()); return kv.get(k); };
  const run = ([c, k, ...a]) => {
    switch (c) {
      case 'INCR': case 'INCRBY': { const v = (Number(kv.get(k)) || 0) + (c === 'INCR' ? 1 : Number(a[0])); kv.set(k, v); return v; }
      case 'EXPIRE': return 1;
      case 'GET': return kv.has(k) ? String(kv.get(k)) : null;
      case 'DEL': return kv.delete(k) ? 1 : 0;
      case 'HSETNX': { const h = get(k, () => new Map()); if (h.has(a[0])) return 0; h.set(a[0], String(a[1])); return 1; }
      case 'HSET': { const h = get(k, () => new Map()); for (let i = 0; i < a.length; i += 2) h.set(a[i], String(a[i + 1])); return 1; }
      case 'HGET': return kv.get(k)?.get(a[0]) ?? null;
      case 'HGETALL': return kv.has(k) ? [...kv.get(k)].flat() : [];
      case 'SADD': { const s = get(k, () => new Set()); const had = s.has(a[0]); s.add(a[0]); return had ? 0 : 1; }
      case 'SCARD': return kv.get(k)?.size || 0;
      case 'SISMEMBER': return kv.get(k)?.has(a[0]) ? 1 : 0;
      case 'ZINCRBY': { const z = get(k, () => new Map()); const v = (z.get(a[1]) || 0) + Number(a[0]); z.set(a[1], v); return String(v); }
      case 'ZSCORE': { const v = kv.get(k)?.get(a[0]); return v === undefined ? null : String(v); }
      case 'ZREVRANGE': {
        const z = [...(kv.get(k) || new Map())].sort((x, y) => y[1] - x[1]).slice(Number(a[0]), Number(a[1]) + 1);
        return z.flatMap(([m, s]) => [m, String(s)]);
      }
      case 'ZREVRANK': {
        const z = [...(kv.get(k) || new Map())].sort((x, y) => y[1] - x[1]);
        const i = z.findIndex(([m]) => m === a[0]); return i < 0 ? null : i;
      }
      default: throw new Error('unsupported ' + c);
    }
  };
  return async (url, opts) => ({ ok: true, json: async () => JSON.parse(opts.body).map((c) => ({ result: run(c) })) });
}

async function api() {
  process.env.KV_REST_API_URL = 'https://fake.upstash';
  process.env.KV_REST_API_TOKEN = 't';
  globalThis.fetch = fakeRedis();
  const { default: handler } = await import(`../server/api/class.js?${Math.random()}`);
  return async (body, ip = '1.2.3.4') => {
    let status = 0, out = null;
    const res = { setHeader() {}, status(s) { status = s; return this; }, json(o) { out = o; return this; }, end() { return this; } };
    await handler({ method: 'POST', body, headers: { 'x-forwarded-for': ip } }, res);
    return { status, ...out };
  };
}

test('classroom rules: codes, names, weeks and raid size', () => {
  for (let i = 0; i < 50; i++) assert.ok(validCode(newCode()));
  assert.ok(!validCode('ABC0O1'), 'no look-alike characters');
  assert.equal(cleanName('  Wei <b>Ling</b>!! '), 'Wei bLingb');
  assert.equal(weekKey(Date.UTC(2026, 9, 29, 12)), '2026-W44');
  assert.equal(weekKey(Date.UTC(2026, 0, 1, 12)), '2026-W01');
  assert.ok(raidMax(30) > raidMax(5));
  assert.equal(typeof bossFor('2026-W44'), 'string');
});

test('class API: create, join, sync answers into the raid and the board, teacher reset', async () => {
  const call = await api();
  const made = await call({ action: 'create', name: 'Econ 4A', pin: '2468' });
  assert.equal(made.status, 200);
  assert.ok(validCode(made.code));
  const code = made.code;

  assert.equal((await call({ action: 'join', code: 'ZZZZZZ', student: 'Ali' })).status, 404);
  assert.equal((await call({ action: 'progress', code, student: 'Ali', correct: 3, wisdom: 100 })).status, 403, 'must join first');

  await call({ action: 'join', code, student: 'Ali' });
  const j = await call({ action: 'join', code, student: 'Mei' });
  assert.equal(j.members, 2);
  assert.equal(j.raid.damage, 0);

  await call({ action: 'progress', code, student: 'Ali', correct: 5, wisdom: 300 });
  const p = await call({ action: 'progress', code, student: 'Mei', correct: 999, wisdom: 99999 });
  assert.equal(p.raid.damage, (5 + 30) * 10, 'a single sync is capped at 30 answers');
  assert.equal(p.board[0].name, 'Mei');
  assert.equal(p.board[0].wisdom, 2500, 'and 2500 Wisdom');
  assert.equal(p.me.rank, 1);

  // Rate limit: a flood of syncs from one student gets refused.
  let refused = false;
  for (let i = 0; i < 12; i++) if ((await call({ action: 'progress', code, student: 'Ali', correct: 1, wisdom: 1 })).status === 429) refused = true;
  assert.ok(refused);

  assert.equal((await call({ action: 'reset', code, pin: 'nope' })).status, 403);
  const r = await call({ action: 'reset', code, pin: '2468' });
  assert.equal(r.raid.damage, 0);
  assert.equal(r.board.length, 0);
  assert.equal(r.name, 'Econ 4A');
});

test('the game joins a class, batches answers into the raid and claims the reward once', async () => {
  const call = await api();
  const { code } = await call({ action: 'create', name: 'Maths 3B', pin: '1357' });
  // Point the game's fetch at the handler instead of the network.
  const redisFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (!String(url).includes('/api/class')) return redisFetch(url, opts);
    const out = await call(JSON.parse(opts.body));
    return { ok: out.status === 200, status: out.status, json: async () => out };
  };
  const { Game } = await import('../src/game/game.js');
  const { clearSave } = await import('../src/game/save.js');
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  clearSave();
  const game = new Game();
  game.start();
  game.ui = new Proxy({}, { get: () => () => {} });
  await game.classroom.join(code.toLowerCase(), 'Arjun');
  assert.equal(game.classroom.name, 'Maths 3B');

  const { QUESTIONS } = await import('../src/data/questions.js');
  for (let i = 0; i < 4; i++) game.studyAnswer(QUESTIONS[i], true);
  game.studyAnswer(QUESTIONS[5], false);
  assert.equal(game.classroom.pending.correct, 4, 'answers queue up until the next sync');
  const v = await game.classroom.flush();
  assert.equal(v.raid.damage, 40);
  assert.equal(v.me.rank, 1);
  assert.equal(game.classroom.pending.correct, 0);

  // Knock the boss down and collect, once.
  assert.equal(game.claimRaidReward(), false, 'nothing to claim while it stands');
  game.classroom.view = { ...v, raid: { ...v.raid, defeated: true } };
  const coins = game.inventory.count('coins');
  assert.equal(game.claimRaidReward(), true);
  assert.equal(game.inventory.count('coins'), coins + 500);
  assert.equal(game.claimRaidReward(), false, 'once a week');
  assert.equal(game.classroom.serialize().code, code);
});
