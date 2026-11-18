// Password hashing, recovery codes and session tokens, all with node:crypto.
//
// - Passwords and recovery codes: scrypt with a random 16-byte salt per user,
//   compared in constant time. Only the hash and salt are stored.
// - Sessions: a signed token, base64url(payload) + "." + base64url(HMAC-SHA256),
//   keyed with ACCOUNT_SECRET. The payload names the user, when it expires (30
//   days) and the user's token version, which a password reset bumps so every
//   older token stops working at once.
import { scrypt as scryptCb, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

const KEYLEN = 32;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const TOKEN_DAYS = 30;

function scrypt(secret, salt) {
  return new Promise((resolve, reject) => scryptCb(secret, salt, KEYLEN, SCRYPT_OPTS, (err, key) => (err ? reject(err) : resolve(key))));
}

/** { salt, hash } (both base64) for a password or recovery code. */
export async function hashSecret(secret) {
  const salt = randomBytes(16);
  const key = await scrypt(String(secret).normalize('NFKC'), salt);
  return { salt: salt.toString('base64'), hash: key.toString('base64') };
}

/** Whether `secret` matches a stored { salt, hash }. Always does the full scrypt
 *  work (with a throwaway salt when there is no record), so a missing account
 *  answers no faster than a wrong password. */
export async function verifySecret(secret, stored) {
  const salt = stored?.salt ? Buffer.from(stored.salt, 'base64') : randomBytes(16);
  const key = await scrypt(String(secret ?? '').normalize('NFKC'), salt);
  if (!stored?.hash) return false;
  const want = Buffer.from(stored.hash, 'base64');
  return want.length === key.length && timingSafeEqual(want, key);
}

// Recovery codes: 20 characters from an alphabet with no look-alikes (no 0/O,
// 1/I/L), shown in groups of four. About 100 bits of randomness.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRecoveryCode() {
  const bytes = randomBytes(20);
  let s = '';
  for (let i = 0; i < 20; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s.match(/.{4}/g).join('-');
}
/** Dashes, spaces and case don't matter when a code is typed back in. */
export const normaliseRecoveryCode = (code) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** A session token for `user` (lower-case username) at token version `ver`. */
export function signToken(user, ver, secret, now = Date.now()) {
  const payload = b64url(JSON.stringify({ u: user, v: ver, exp: now + TOKEN_DAYS * 86400e3 }));
  const sig = b64url(createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

/** The token's payload { u, v, exp } when its signature is right and it has
 *  not expired; null otherwise. */
export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1), 'base64url');
  const want = createHmac('sha256', secret).update(payload).digest();
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!p || typeof p.u !== 'string' || typeof p.exp !== 'number' || p.exp <= now) return null;
  return p;
}
