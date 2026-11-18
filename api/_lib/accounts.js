// The account and cloud-save handlers. Each route file (api/auth.js,
// api/save.js) is a one-liner around these, built with what they need passed
// in, so the tests run them against an in-memory store and a fixed clock.
//
//   deps = { store, secret, now }
//     store:  see store.js (null when no database is connected: every call 503s)
//     secret: ACCOUNT_SECRET, the HMAC key for session tokens (missing: 503)
//     now:    () => ms, the clock
import { keys, storeFromEnv } from './store.js';
import { hashSecret, verifySecret, newRecoveryCode, normaliseRecoveryCode, signToken, verifyToken } from './security.js';
import { HttpError, send, sendError, clientIp, checkOrigin, bearer, readJson } from './http.js';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;
export const MAX_SAVE_BYTES = 1.5 * 1024 * 1024;   // a save is ~100 KB; this leaves years of room

// Rate limits: [max requests, window in seconds]. Counted before any password
// work, so a flood can't make the server hash for it.
export const LIMITS = {
  signupIp: [5, 3600],
  loginIp: [30, 900],
  loginUser: [10, 900],
  recoverIp: [10, 3600],
  recoverUser: [5, 3600],
  saveUser: [240, 3600],
};

/** The deployment's dependencies, read from the environment at call time. */
export function envDeps(env = process.env) {
  return { store: storeFromEnv(env), secret: env.ACCOUNT_SECRET || null, now: () => Date.now() };
}

function ready(deps) {
  if (!deps.store) throw new HttpError(503, 'Cloud saves are not set up on this server yet (no database is connected). You can keep playing: your progress is saved on this device.', 'no_storage');
  if (!deps.secret || deps.secret.length < 16) throw new HttpError(503, 'Accounts are not set up on this server yet (ACCOUNT_SECRET is missing). You can keep playing: your progress is saved on this device.', 'no_secret');
}

async function limit(deps, kind, who) {
  const [max, win] = LIMITS[kind];
  const key = keys.limit(kind, who);
  const n = await deps.store.incr(key, win);
  if (n > max) {
    const ttl = await deps.store.ttl(key);
    const retryAfter = ttl > 0 ? ttl : win;
    throw new HttpError(429, `Too many tries. Please wait ${Math.ceil(retryAfter / 60)} minute${retryAfter > 60 ? 's' : ''} and try again.`, 'rate_limited', { retryAfter });
  }
}

const cleanUsername = (u) => String(u ?? '').trim().toLowerCase();

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN) throw new HttpError(400, `Passwords need at least ${PASSWORD_MIN} characters.`, 'weak_password');
  if (pw.length > PASSWORD_MAX) throw new HttpError(400, 'That password is too long.', 'bad_password');
}

async function loadUser(deps, user) {
  const raw = await deps.store.get(keys.user(user));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const publicUser = (u) => ({ username: u.username, email: u.email || null, created: u.created });

/** The signed-in user (the record) from the Authorization header, or a 401. */
export async function requireUser(req, deps) {
  const p = verifyToken(bearer(req), deps.secret, deps.now());
  if (!p) throw new HttpError(401, 'Please log in again.', 'bad_token');
  const u = await loadUser(deps, p.u);
  // A password reset bumps ver, which signs every older session out.
  if (!u || u.ver !== p.v) throw new HttpError(401, 'Please log in again.', 'bad_token');
  return u;
}

// ---------------- POST /api/auth ----------------
export function makeAuthHandler(getDeps = envDeps) {
  return async function handler(req, res) {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST.', 'method');
      checkOrigin(req);
      const deps = getDeps();
      ready(deps);
      const body = await readJson(req, 16 * 1024);
      const ip = clientIp(req);
      switch (body.action) {
        case 'signup': return send(res, 200, await signup(deps, body, ip));
        case 'login': return send(res, 200, await login(deps, body, ip));
        case 'recover': return send(res, 200, await recover(deps, body, ip));
        case 'me': return send(res, 200, publicUser(await requireUser(req, deps)));
        default: throw new HttpError(400, 'Unknown action.', 'bad_action');
      }
    } catch (err) { sendError(res, err); }
  };
}

async function signup(deps, body, ip) {
  const user = cleanUsername(body.username);
  if (!USERNAME_RE.test(user)) throw new HttpError(400, 'Usernames are 3 to 20 letters, numbers or underscores.', 'bad_username');
  checkPassword(body.password);
  let email = null;
  if (body.email != null && String(body.email).trim()) {
    email = String(body.email).trim();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'That email address does not look right.', 'bad_email');
  }
  await limit(deps, 'signupIp', ip);
  if (await deps.store.get(keys.user(user))) throw new HttpError(409, 'That username is taken. Try another.', 'taken');
  const code = newRecoveryCode();
  const [pw, rc] = await Promise.all([hashSecret(body.password), hashSecret(normaliseRecoveryCode(code))]);
  const rec = { username: user, email, created: deps.now(), ver: 1, pw, rc };
  // NX: two sign-ups racing for one name can't both succeed.
  if (!(await deps.store.set(keys.user(user), JSON.stringify(rec), { nx: true }))) throw new HttpError(409, 'That username is taken. Try another.', 'taken');
  return { ...publicUser(rec), token: signToken(user, rec.ver, deps.secret, deps.now()), recoveryCode: code };
}

async function login(deps, body, ip) {
  const user = cleanUsername(body.username);
  await limit(deps, 'loginIp', ip);
  if (USERNAME_RE.test(user)) await limit(deps, 'loginUser', user);
  const rec = USERNAME_RE.test(user) ? await loadUser(deps, user) : null;
  const ok = await verifySecret(typeof body.password === 'string' ? body.password : '', rec?.pw);
  if (!rec || !ok) throw new HttpError(401, 'Wrong username or password.', 'bad_login');
  return { ...publicUser(rec), token: signToken(user, rec.ver, deps.secret, deps.now()) };
}

async function recover(deps, body, ip) {
  const user = cleanUsername(body.username);
  checkPassword(body.newPassword);
  await limit(deps, 'recoverIp', ip);
  if (USERNAME_RE.test(user)) await limit(deps, 'recoverUser', user);
  const rec = USERNAME_RE.test(user) ? await loadUser(deps, user) : null;
  const ok = await verifySecret(normaliseRecoveryCode(body.recoveryCode), rec?.rc);
  if (!rec || !ok) throw new HttpError(401, 'That username and recovery code do not match.', 'bad_recovery');
  // A recovery code works once: a new one replaces it, and the new password
  // signs out every other session.
  const code = newRecoveryCode();
  const [pw, rc] = await Promise.all([hashSecret(body.newPassword), hashSecret(normaliseRecoveryCode(code))]);
  const next = { ...rec, pw, rc, ver: (rec.ver || 1) + 1 };
  await deps.store.set(keys.user(user), JSON.stringify(next));
  return { ...publicUser(next), token: signToken(user, next.ver, deps.secret, deps.now()), recoveryCode: code };
}

// ---------------- GET / PUT /api/save ----------------
/** The few numbers shown when choosing between two saves, kept short and typed. */
export function cleanSummary(s) {
  if (!s || typeof s !== 'object') return null;
  const int = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(Math.min(v, 1e15)) : 0);
  const str = (v) => (typeof v === 'string' ? v.slice(0, 24) : null);
  return { name: str(s.name), jobClass: str(s.jobClass), totalLevel: int(s.totalLevel), totalXp: int(s.totalXp),
    playMs: int(s.playMs), quests: int(s.quests), savedAt: int(s.savedAt) };
}

export function makeSaveHandler(getDeps = envDeps) {
  return async function handler(req, res) {
    try {
      const deps = getDeps();
      if (req.method === 'GET') {
        ready(deps);
        const u = await requireUser(req, deps);
        const metaOnly = /[?&]meta=1(&|$)/.test(req.url || '');
        const [rev, meta] = await Promise.all([deps.store.get(keys.rev(u.username)), deps.store.get(keys.meta(u.username))]);
        const m = meta ? JSON.parse(meta) : null;
        const head = { rev: Number(rev) || 0, savedAt: m?.savedAt || null, summary: m?.summary || null, size: m?.size || 0 };
        if (metaOnly || !head.rev) return send(res, 200, { ...head, save: null });
        const data = await deps.store.get(keys.data(u.username));
        // The save goes out as stored, without parsing and re-writing a big string.
        return send(res, 200, JSON.stringify(head).slice(0, -1) + ',"save":' + (data || 'null') + '}');
      }
      if (req.method === 'PUT') {
        checkOrigin(req);
        ready(deps);
        const u = await requireUser(req, deps);
        await limit(deps, 'saveUser', u.username);
        const body = await readJson(req, MAX_SAVE_BYTES + 16 * 1024);
        const save = body.save;
        if (!save || typeof save !== 'object' || Array.isArray(save)) throw new HttpError(400, 'No save was sent.', 'bad_save');
        const data = JSON.stringify(save);
        if (Buffer.byteLength(data) > MAX_SAVE_BYTES) throw new HttpError(413, 'That save is too big to store.', 'too_large');
        const baseRev = Number(body.baseRev);
        if (!Number.isInteger(baseRev) || baseRev < 0) throw new HttpError(400, 'Missing baseRev.', 'bad_rev');
        const summary = cleanSummary({ ...body.summary, savedAt: save.savedAt });
        const savedAt = deps.now();
        const meta = JSON.stringify({ rev: baseRev + 1, savedAt, summary, size: Buffer.byteLength(data) });
        const r = await deps.store.saveCas(u.username, baseRev, meta, data);
        if (!r.ok) {
          // Another device saved since this one last synced: hand back what is
          // there, so the player can choose which to keep.
          const m = r.meta ? JSON.parse(r.meta) : null;
          throw new HttpError(409, 'Your cloud save was changed on another device.', 'conflict', { rev: r.rev, savedAt: m?.savedAt || null, summary: m?.summary || null });
        }
        return send(res, 200, { rev: r.rev, savedAt });
      }
      throw new HttpError(405, 'Use GET or PUT.', 'method');
    } catch (err) { sendError(res, err); }
  };
}
