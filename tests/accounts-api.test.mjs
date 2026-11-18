// Accounts and cloud saves, server side (api/): the route handlers run against
// the in-memory store and a clock the tests move by hand.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeAuthHandler, makeSaveHandler, LIMITS, MAX_SAVE_BYTES } from '../api/_lib/accounts.js';
import { memoryStore, redisConfig, keys } from '../api/_lib/store.js';
import { signToken, verifyToken, TOKEN_DAYS } from '../api/_lib/security.js';

const SECRET = 'test-secret-that-is-long-enough';

function setup() {
  let t = 1_800_000_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const store = memoryStore(clock.now);
  const deps = { store, secret: SECRET, now: clock.now };
  return { clock, store, auth: makeAuthHandler(() => deps), save: makeSaveHandler(() => deps), deps };
}

async function call(handler, { method = 'POST', body, token, headers = {}, url = '/api/x', ip = '1.2.3.4' } = {}) {
  const req = { method, url, headers: { host: 'game.test', 'x-forwarded-for': ip, ...headers }, body };
  if (token) req.headers.authorization = `Bearer ${token}`;
  const res = {
    statusCode: 200, headers: {}, text: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(t) { this.text = t; },
  };
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.text), headers: res.headers };
}

const signup = (h, username = 'Ah_Boy', password = 'kopi-o-kosong', extra = {}) =>
  call(h.auth, { body: { action: 'signup', username, password, ...extra }, ...extra.opts });

test('sign up returns a token and a one-time recovery code; the name is case-insensitive and unique', async () => {
  const h = setup();
  const r = await signup(h, 'Ah_Boy', 'kopi-o-kosong', { email: 'ah@boy.sg' });
  assert.equal(r.status, 200);
  assert.equal(r.json.username, 'ah_boy');
  assert.equal(r.json.email, 'ah@boy.sg');
  assert.match(r.json.recoveryCode, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/);
  assert.ok(verifyToken(r.json.token, SECRET, h.clock.now()));
  assert.equal(r.headers['cache-control'], 'no-store');
  // Neither the password nor the code is stored as typed.
  const rec = await h.store.get(keys.user('ah_boy'));
  assert.ok(!rec.includes('kopi-o-kosong') && !rec.includes(r.json.recoveryCode.replace(/-/g, '')));

  const dup = await signup(h, 'AH_BOY', 'another-password', { opts: { ip: '9.9.9.9' } });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.code, 'taken');
});

test('sign up checks the username, password and email', async () => {
  const h = setup();
  for (const [u, p, e, code] of [
    ['ab', 'longenough', null, 'bad_username'],
    ['has space', 'longenough', null, 'bad_username'],
    ['x'.repeat(21), 'longenough', null, 'bad_username'],
    ['okname', 'short', null, 'weak_password'],
    ['okname', 'longenough', 'not-an-email', 'bad_email'],
  ]) {
    const r = await call(h.auth, { body: { action: 'signup', username: u, password: p, email: e }, ip: `10.0.0.${code.length}` });
    assert.equal(r.status, 400, `${u}/${code}`);
    assert.equal(r.json.code, code);
  }
});

test('log in with the right password; a wrong one or an unknown user is the same 401', async () => {
  const h = setup();
  await signup(h);
  const ok = await call(h.auth, { body: { action: 'login', username: 'AH_BOY', password: 'kopi-o-kosong' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.username, 'ah_boy');
  const me = await call(h.auth, { body: { action: 'me' }, token: ok.json.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.username, 'ah_boy');

  assert.deepEqual((await call(h.auth, { body: { action: 'ping' } })).json, { ok: true });
  assert.equal((await call(h.auth, { body: { action: 'me' } })).status, 401);
  const bad = await call(h.auth, { body: { action: 'login', username: 'ah_boy', password: 'wrong-password' } });
  const none = await call(h.auth, { body: { action: 'login', username: 'nobody_here', password: 'wrong-password' } });
  assert.equal(bad.status, 401);
  assert.equal(none.status, 401);
  assert.equal(bad.json.error, none.json.error, 'no hint which part was wrong');
});

test('logins are rate limited per username and per IP, and the window ends', async () => {
  const h = setup();
  await signup(h);
  const [max, win] = LIMITS.loginUser;
  for (let i = 0; i < max; i++) {
    const r = await call(h.auth, { body: { action: 'login', username: 'ah_boy', password: 'nope-nope-nope' }, ip: `5.5.5.${i}` });
    assert.equal(r.status, 401);
  }
  const blocked = await call(h.auth, { body: { action: 'login', username: 'ah_boy', password: 'kopi-o-kosong' }, ip: '7.7.7.7' });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers['retry-after']) > 0);
  h.clock.advance(win * 1000 + 1);
  const after = await call(h.auth, { body: { action: 'login', username: 'ah_boy', password: 'kopi-o-kosong' }, ip: '7.7.7.7' });
  assert.equal(after.status, 200);

  // Sign-ups from one address.
  const [smax] = LIMITS.signupIp;
  let last;
  for (let i = 0; i <= smax; i++) last = await call(h.auth, { body: { action: 'signup', username: `kid_${i}`, password: 'longenough' }, ip: '8.8.8.8' });
  assert.equal(last.status, 429);
});

test('tokens: an expired, tampered or wrongly-signed token is refused', async () => {
  const h = setup();
  const { json } = await signup(h);
  const ok = await call(h.save, { method: 'GET', token: json.token });
  assert.equal(ok.status, 200);

  const [payload, sig] = json.token.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'someone_else', v: 1, exp: h.clock.now() + 1e9 })).toString('base64url') + '.' + sig;
  assert.equal((await call(h.save, { method: 'GET', token: forged })).status, 401);
  assert.equal((await call(h.save, { method: 'GET', token: payload + '.AAAA' })).status, 401);
  assert.equal((await call(h.save, { method: 'GET', token: signToken('ah_boy', 1, 'some-other-secret-entirely', h.clock.now()) })).status, 401);
  assert.equal((await call(h.save, { method: 'GET' })).status, 401);

  h.clock.advance(TOKEN_DAYS * 86400e3 + 1000);
  const expired = await call(h.save, { method: 'GET', token: json.token });
  assert.equal(expired.status, 401);
  assert.equal(expired.json.code, 'bad_token');
});

test('recover: username + code sets a new password, issues a new code and signs old sessions out', async () => {
  const h = setup();
  const first = await signup(h);
  const wrong = await call(h.auth, { body: { action: 'recover', username: 'ah_boy', recoveryCode: 'AAAA-BBBB-CCCC-DDDD-EEEE', newPassword: 'brand-new-pass' } });
  assert.equal(wrong.status, 401);
  // Typed lower-case without dashes still matches.
  const code = first.json.recoveryCode.toLowerCase().replace(/-/g, ' ');
  const r = await call(h.auth, { body: { action: 'recover', username: 'Ah_Boy', recoveryCode: code, newPassword: 'brand-new-pass' } });
  assert.equal(r.status, 200);
  assert.notEqual(r.json.recoveryCode, first.json.recoveryCode);
  assert.equal((await call(h.save, { method: 'GET', token: first.json.token })).status, 401, 'the old session is gone');
  assert.equal((await call(h.save, { method: 'GET', token: r.json.token })).status, 200);
  assert.equal((await call(h.auth, { body: { action: 'login', username: 'ah_boy', password: 'kopi-o-kosong' } })).status, 401);
  assert.equal((await call(h.auth, { body: { action: 'login', username: 'ah_boy', password: 'brand-new-pass' } })).status, 200);
  // The old code worked once only.
  const again = await call(h.auth, { body: { action: 'recover', username: 'ah_boy', recoveryCode: first.json.recoveryCode, newPassword: 'third-password' } });
  assert.equal(again.status, 401);
});

test('saves: first upload, read back, and a stale baseRev is a 409 carrying the cloud copy\'s details', async () => {
  const h = setup();
  const { json: { token } } = await signup(h);
  const empty = await call(h.save, { method: 'GET', token });
  assert.deepEqual([empty.json.rev, empty.json.save], [0, null]);

  const save = { version: 1, savedAt: 111, player: { x: 1, y: 2 }, skills: {}, inventory: [] };
  const put = await call(h.save, { method: 'PUT', token, body: { baseRev: 0, save, summary: { name: 'Ah Boy', totalLevel: 40, playMs: 5000 } } });
  assert.equal(put.status, 200);
  assert.equal(put.json.rev, 1);

  const got = await call(h.save, { method: 'GET', token });
  assert.equal(got.json.rev, 1);
  assert.deepEqual(got.json.save, save);
  assert.equal(got.json.summary.totalLevel, 40);
  assert.equal(got.json.summary.savedAt, 111);
  const meta = await call(h.save, { method: 'GET', token, url: '/api/save?meta=1' });
  assert.equal(meta.json.save, null);
  assert.equal(meta.json.rev, 1);

  // A second device still on rev 0.
  const stale = await call(h.save, { method: 'PUT', token, body: { baseRev: 0, save: { ...save, savedAt: 222 } } });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.code, 'conflict');
  assert.equal(stale.json.rev, 1);
  assert.equal(stale.json.summary.name, 'Ah Boy');
  // Choosing to keep it: upload on top of the cloud's revision.
  const forced = await call(h.save, { method: 'PUT', token, body: { baseRev: 1, save: { ...save, savedAt: 222 } } });
  assert.equal(forced.json.rev, 2);
});

test('saves: size cap, non-JSON and other websites are refused', async () => {
  const h = setup();
  const { json: { token } } = await signup(h);
  const big = { version: 1, junk: 'x'.repeat(MAX_SAVE_BYTES) };
  const r = await call(h.save, { method: 'PUT', token, body: { baseRev: 0, save: big } });
  assert.equal(r.status, 413);
  const lied = await call(h.save, { method: 'PUT', token, body: { baseRev: 0, save: {} }, headers: { 'content-length': String(MAX_SAVE_BYTES * 2) } });
  assert.equal(lied.status, 413);
  assert.equal((await call(h.save, { method: 'PUT', token, body: '{not json' })).status, 400);
  assert.equal((await call(h.save, { method: 'PUT', token, body: { baseRev: 0, save: [1, 2] } })).status, 400);
  assert.equal((await call(h.save, { method: 'PUT', token, body: { save: { a: 1 } } })).status, 400, 'baseRev is required');
  const cross = await call(h.save, { method: 'PUT', token, body: { baseRev: 0, save: { a: 1 } }, headers: { origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  const same = await call(h.save, { method: 'PUT', token, body: { baseRev: 0, save: { a: 1 } }, headers: { origin: 'https://game.test' } });
  assert.equal(same.status, 200);
  assert.equal((await call(h.save, { method: 'DELETE', token })).status, 405);
});

test('a body streamed in (not pre-parsed) is read too', async () => {
  const h = setup();
  const { json: { token } } = await signup(h);
  const { Readable } = await import('node:stream');
  const req = Readable.from([Buffer.from(JSON.stringify({ baseRev: 0, save: { v: 1 } }))]);
  Object.assign(req, { method: 'PUT', url: '/api/save', headers: { host: 'game.test', authorization: `Bearer ${token}` } });
  const res = { statusCode: 0, text: '', setHeader() {}, end(t) { this.text = t; } };
  await h.save(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.text).rev, 1);
});

test('without a database or secret every call answers 503 with a clear message', async () => {
  const noDb = makeAuthHandler(() => ({ store: null, secret: SECRET, now: Date.now }));
  const r = await call(noDb, { body: { action: 'login', username: 'a', password: 'b' } });
  assert.equal(r.status, 503);
  assert.match(r.json.error, /not set up/);
  const noSecret = makeSaveHandler(() => ({ store: memoryStore(), secret: '', now: Date.now }));
  assert.equal((await call(noSecret, { method: 'GET' })).status, 503);
  assert.equal(redisConfig({}), null);
  assert.deepEqual(redisConfig({ UPSTASH_REDIS_REST_URL: 'https://x.upstash.io/', UPSTASH_REDIS_REST_TOKEN: 't' }), { url: 'https://x.upstash.io', token: 't' });
  assert.equal(redisConfig({ KV_REST_API_URL: 'https://kv', KV_REST_API_TOKEN: 'k' }).url, 'https://kv');
});

test('the Upstash store speaks the REST API: one command per call, a pipeline for counters', async () => {
  const { redisStore } = await import('../api/_lib/store.js');
  const sent = [];
  const fakeFetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    sent.push({ url, auth: opts.headers.Authorization, body });
    const reply = url.endsWith('/pipeline') ? [{ result: 3 }, { result: 1 }]
      : body[0] === 'EVAL' ? { result: [0, 4, '{"rev":4}'] } : { result: body[0] === 'GET' ? null : 'OK' };
    return { ok: true, status: 200, json: async () => reply };
  };
  const s = redisStore({ url: 'https://db.upstash.io', token: 'tok' }, fakeFetch);
  assert.equal(await s.get('k'), null);
  assert.equal(await s.set('k', 'v', { nx: true }), true);
  assert.equal(await s.incr('n', 60), 3);
  assert.deepEqual(await s.saveCas('u', 2, '{}', '{}'), { ok: false, rev: 4, meta: '{"rev":4}' });
  assert.deepEqual(sent[0], { url: 'https://db.upstash.io', auth: 'Bearer tok', body: ['GET', 'k'] });
  assert.deepEqual(sent[1].body, ['SET', 'k', 'v', 'NX']);
  assert.deepEqual(sent[2].body, [['INCR', 'n'], ['EXPIRE', 'n', '60', 'NX']]);
  assert.equal(sent[3].body[0], 'EVAL');
  assert.deepEqual(sent[3].body.slice(2, 6), ['3', keys.rev('u'), keys.meta('u'), keys.data('u')]);
});
