// Small request/response helpers shared by the API routes. They only use the
// plain Node request and response (Vercel's helpers are optional), so the tests
// can drive the handlers with tiny fakes.

export class HttpError extends Error {
  constructor(status, message, code = 'error', extra = {}) {
    super(message);
    this.status = status; this.code = code; this.extra = extra;
  }
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Accounts and saves are private: never cached by the browser, a proxy or the service worker.
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

export function sendError(res, err) {
  if (err instanceof HttpError) {
    const headers = err.extra.retryAfter ? { 'Retry-After': String(err.extra.retryAfter) } : {};
    return send(res, err.status, { error: err.message, code: err.code, ...err.extra }, headers);
  }
  // Unexpected: log the reason only (never a request body, which may hold a password).
  console.error('API error:', err?.message || err);
  return send(res, 500, { error: 'Something went wrong on the server. Please try again.', code: 'server' });
}

const header = (req, name) => {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
};

/** The caller's IP address (Vercel puts the real one first in x-forwarded-for). */
export function clientIp(req) {
  const fwd = header(req, 'x-real-ip') || String(header(req, 'x-forwarded-for') || '').split(',')[0].trim();
  return fwd || req.socket?.remoteAddress || 'unknown';
}

/** Writes must come from the game's own pages: a request carrying another
 *  site's Origin header is turned away. (Requests with no Origin, such as curl,
 *  still need a valid token or password, so they gain nothing.) */
export function checkOrigin(req) {
  const origin = header(req, 'origin');
  if (!origin) return;
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  let oh = null;
  try { oh = new URL(origin).host; } catch { /* "null" or junk */ }
  if (!host || oh !== host) throw new HttpError(403, 'Requests from other websites are not allowed.', 'origin');
}

/** The Bearer token from the Authorization header, or null. */
export function bearer(req) {
  const m = /^Bearer\s+(.+)$/i.exec(header(req, 'authorization') || '');
  return m ? m[1].trim() : null;
}

/**
 * The request's JSON body, at most `limit` bytes. Vercel may already have
 * parsed it (req.body); otherwise the stream is read here. Anything that is not
 * a JSON object is a 400; anything too big a 413.
 */
export async function readJson(req, limit) {
  const len = Number(header(req, 'content-length'));
  if (len > limit) throw new HttpError(413, 'That is too big to store.', 'too_large');
  let body;
  try { body = req.body; } catch { throw new HttpError(400, 'The request was not valid JSON.', 'bad_json'); }
  let text = null;
  if (body === undefined || body === null) {
    if (typeof req.on !== 'function') throw new HttpError(400, 'The request had no body.', 'bad_json');
    text = await new Promise((resolve, reject) => {
      const parts = []; let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > limit) { reject(new HttpError(413, 'That is too big to store.', 'too_large')); req.destroy?.(); return; }
        parts.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(parts.map((p) => Buffer.from(p))).toString('utf8')));
      req.on('error', reject);
    });
  } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
    text = String(body);
  }
  if (text !== null) {
    if (Buffer.byteLength(text) > limit) throw new HttpError(413, 'That is too big to store.', 'too_large');
    try { body = JSON.parse(text); } catch { throw new HttpError(400, 'The request was not valid JSON.', 'bad_json'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'The request was not a JSON object.', 'bad_json');
  return body;
}
