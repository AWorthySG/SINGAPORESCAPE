// The classroom API: one POST endpoint with an `action`.
//   create   { name, pin }                      -> { code }            (teacher)
//   info     { code, student? }                 -> class, raid, board
//   join     { code, student }                  -> class, raid, board
//   progress { code, student, correct, wisdom } -> class, raid, board  (the game syncs answers)
//   reset    { code, pin }                      -> class, raid, board  (teacher: restart this week)
// There are no student accounts, so the API keeps things honest with caps and
// rate limits rather than proof: fine for motivation, not for marks.
import { createHash } from 'node:crypto';
import { pipeline, cmd, configured } from '../lib/store.js';
import {
  weekKey, bossFor, raidMax, newCode, validCode, cleanName, clampInt,
  DAMAGE_PER_CORRECT, MAX_CORRECT_PER_CALL, MAX_WISDOM_PER_CALL,
} from '../lib/classroom.js';

const hashPin = (code, pin) => createHash('sha256').update(`${code}:${pin}`).digest('hex');
const K = {
  cls: (c) => `class:${c}`,
  members: (c) => `class:${c}:members`,
  dmg: (c, w) => `class:${c}:raid:${w}`,
  board: (c, w) => `class:${c}:board:${w}`,
  rate: (k) => `rl:${k}`,
};

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

/** Allow `limit` calls per `secs` for a key; throws 429 past it. */
async function rateLimit(key, limit, secs) {
  const [n] = await pipeline([['INCR', K.rate(key)], ['EXPIRE', K.rate(key), secs, 'NX']]);
  if (n > limit) throw new HttpError(429, 'Too many requests: try again in a minute.');
}

async function classView(code, student) {
  const w = weekKey();
  const [cls, members, dmg, top] = await pipeline([
    ['HGETALL', K.cls(code)], ['SCARD', K.members(code)], ['GET', K.dmg(code, w)],
    ['ZREVRANGE', K.board(code, w), 0, 9, 'WITHSCORES'],
  ]);
  if (!cls || !cls.length) throw new HttpError(404, 'No class with that code.');
  const info = {};
  for (let i = 0; i < cls.length; i += 2) info[cls[i]] = cls[i + 1];
  const max = raidMax(members);
  const damage = Math.min(Number(dmg) || 0, max);
  const board = [];
  for (let i = 0; i < top.length; i += 2) board.push({ name: top[i], wisdom: Number(top[i + 1]) });
  let me = null;
  if (student) {
    const [rank, score] = await pipeline([['ZREVRANK', K.board(code, w), student], ['ZSCORE', K.board(code, w), student]]);
    me = { name: student, rank: rank === null ? null : rank + 1, wisdom: Number(score) || 0 };
  }
  return {
    code, name: info.name, members, week: w,
    raid: { boss: bossFor(w), damage, max, defeated: damage >= max },
    board, me,
  };
}

async function handle(body, ip) {
  const action = body.action;
  if (action === 'create') {
    await rateLimit(`create:${ip}`, 10, 3600);
    const name = cleanName(body.name, 40);
    const pin = String(body.pin || '');
    if (!name) throw new HttpError(400, 'Give the class a name.');
    if (pin.length < 4) throw new HttpError(400, 'The teacher PIN needs at least 4 characters.');
    for (let tries = 0; tries < 8; tries++) {
      const code = newCode();
      // HSETNX on the name claims the code only if it's free.
      if (await cmd('HSETNX', K.cls(code), 'name', name)) {
        await cmd('HSET', K.cls(code), 'pin', hashPin(code, pin), 'created', Date.now());
        return { code, name };
      }
    }
    throw new HttpError(500, 'Could not make a class code: try again.');
  }

  const code = String(body.code || '').toUpperCase();
  if (!validCode(code)) throw new HttpError(400, 'That class code doesn’t look right.');
  const student = cleanName(body.student);

  if (action === 'info') return classView(code, student || null);

  if (action === 'join') {
    if (!student) throw new HttpError(400, 'Your name is needed to join.');
    await rateLimit(`join:${ip}`, 30, 3600);
    await classView(code);                       // 404s for an unknown class
    await cmd('SADD', K.members(code), student);
    return classView(code, student);
  }

  if (action === 'progress') {
    if (!student) throw new HttpError(400, 'Your name is needed.');
    await rateLimit(`progress:${code}:${student}`, 8, 60);
    if (!(await cmd('SISMEMBER', K.members(code), student))) throw new HttpError(403, 'Join the class first.');
    const correct = clampInt(body.correct, 0, MAX_CORRECT_PER_CALL);
    const wisdom = clampInt(body.wisdom, 0, MAX_WISDOM_PER_CALL);
    const w = weekKey();
    const ttl = 60 * 60 * 24 * 21;               // keep three weeks of raids and boards
    await pipeline([
      ['INCRBY', K.dmg(code, w), correct * DAMAGE_PER_CORRECT], ['EXPIRE', K.dmg(code, w), ttl],
      ['ZINCRBY', K.board(code, w), wisdom, student], ['EXPIRE', K.board(code, w), ttl],
    ]);
    return classView(code, student);
  }

  if (action === 'reset') {
    await rateLimit(`reset:${ip}`, 10, 3600);
    const stored = await cmd('HGET', K.cls(code), 'pin');
    if (!stored || stored !== hashPin(code, String(body.pin || ''))) throw new HttpError(403, 'Wrong teacher PIN.');
    const w = weekKey();
    await pipeline([['DEL', K.dmg(code, w)], ['DEL', K.board(code, w)]]);
    return classView(code, student || null);
  }

  throw new HttpError(400, 'Unknown action.');
}

export default async function handler(req, res) {
  // The game is served from GitHub Pages, so allow cross-origin calls.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!configured()) return res.status(503).json({ error: 'The class server has no database yet.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    return res.status(200).json(await handle(body, ip));
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error.' });
  }
}
