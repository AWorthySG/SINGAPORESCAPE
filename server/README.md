# SingaporeScape class server

A tiny Vercel API behind class raids and effort leaderboards. The game itself
stays on GitHub Pages and calls this API (`src/game/classroom.js`, `API_URL`).
No dependencies; data lives in Upstash Redis.

## One-time setup (Vercel dashboard)

1. **Add New → Project**, import `AWorthySG/SINGAPORESCAPE`.
2. Name it **`singaporescape-api`** (the game expects
   `https://singaporescape-api.vercel.app/api/class`).
3. Set **Root Directory** to `server`. Leave the framework as "Other" and the
   build settings empty. Deploy.
4. In the new project: **Storage → Create / Connect → Upstash (Redis)**, free
   plan, and connect it to the project. This adds `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` (or the `UPSTASH_REDIS_REST_*` pair; either works).
5. **Redeploy** so the function picks up the new variables.
6. Check: `curl -X POST https://singaporescape-api.vercel.app/api/class -H 'content-type: application/json' -d '{"action":"info","code":"AAAAAA"}'`
   should answer `{"error":"No class with that code."}` (404), not a 503.

If the project gets a different URL, change `API_URL` in
`src/game/classroom.js` to match.

## API

`POST /api/class` with JSON `{ action, ... }`:

| action | body | notes |
|---|---|---|
| `create` | `name`, `pin` | teacher; returns a 6-letter `code` |
| `join` | `code`, `student` | adds the student to the class |
| `info` | `code`, `student?` | class, this week's raid and top 10 |
| `progress` | `code`, `student`, `correct`, `wisdom` | the game syncs batches; capped at 30 answers / 2500 Wisdom per call, 8 calls a minute |
| `reset` | `code`, `pin` | teacher; restarts this week's raid and board |

Weeks run Monday to Sunday, Singapore time. Raids and boards expire after
three weeks. There are no student accounts: caps and rate limits keep it fair
enough for motivation, not for marks.
