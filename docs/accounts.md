# Player accounts and cloud saves

Guest play is unchanged: without an account the game saves to `localStorage`
on this device only. An account keeps a copy of the save in the cloud so a
player can carry on from another phone or computer.

- Server: Vercel Functions in `api/` (`api/auth.js`, `api/save.js`; the logic
  is in `api/_lib/`, which Vercel does not expose as routes). Plain ESM, no npm
  dependencies. `api/` is not copied into `_site`; Vercel deploys it as
  functions alongside the static build.
- Storage: Upstash Redis through its REST API (plain `fetch`).
- Client: `src/game/cloud.js` (API calls and sync), `src/ui/accountui.js`
  (the Account window), `styles/accounts.css`.

## Setup (Vercel dashboard)

1. **Storage → Connect Database → Upstash for Redis** (Marketplace), and
   connect it to the `singaporescape` project for Production (and Preview if
   wanted). This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`. A database
   connected by hand works too with `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.
2. **Settings → Environment Variables**: add `ACCOUNT_SECRET`, a long random
   string (at least 16 characters; e.g. `openssl rand -base64 48`). It signs
   session tokens: changing it signs everyone out (their saves are kept).
3. Redeploy.

Until both are set, every API call answers **503** with a clear message and
the game says accounts are unavailable; guest play carries on. Running
`npm start` locally has no functions at all, so the Account window shows
"Accounts unavailable here".

## API

All responses are JSON with `Cache-Control: no-store`. Errors are
`{ error, code }` with a suitable status. Writes carrying another site's
`Origin` header are refused (403). Sessions are sent as
`Authorization: Bearer <token>`.

### `POST /api/auth`

| `action` | Body | Returns |
|---|---|---|
| `signup` | `username` (3–20 of `a-z0-9_`, case-insensitive, unique), `password` (8+), optional `email` (display only) | `{ username, email, created, token, recoveryCode }` |
| `login` | `username`, `password` | `{ username, email, created, token }` |
| `recover` | `username`, `recoveryCode`, `newPassword` | `{ …, token, recoveryCode }` (a new code; old sessions are signed out) |
| `me` | (token) | `{ username, email, created }` |
| `ping` | | `{ ok: true }`, or 503 when not set up |

- Passwords and recovery codes are hashed with scrypt and a per-user salt and
  compared in constant time; a missing user costs the same time as a wrong
  password. The recovery code is shown once and works once.
- Tokens are `base64url(payload).base64url(HMAC-SHA256)` keyed with
  `ACCOUNT_SECRET`, valid 30 days, and carry the account's token version, which
  a password reset bumps.
- Rate limits (Redis counters with a fixed window, `LIMITS` in
  `api/_lib/accounts.js`): sign-up 5/hour per IP; login 30/15 min per IP and
  10/15 min per username; recover 10/hour per IP and 5/hour per username;
  save uploads 240/hour per user. Over the limit: 429 with `Retry-After`.

### `GET /api/save` (token)

`{ rev, savedAt, summary, size, save }`; `rev` is 0 and `save` null when
nothing is stored. `?meta=1` leaves out `save` (used to compare cheaply).

### `PUT /api/save` (token)

Body `{ baseRev, save, summary }`. `save` must be a JSON object of at most
1.5 MB. It is stored only if the cloud's revision still equals `baseRev`
(an atomic Lua compare-and-set), giving `{ rev, savedAt }`. Otherwise **409**
`{ code: 'conflict', rev, savedAt, summary }` so the client can let the player
choose; keeping the device's copy re-sends with `baseRev` = that `rev`.

`summary` (`name`, `jobClass`, `totalLevel`, `totalXp`, `quests`, `playMs`) is
what the "which save do you want to keep?" screen shows.

## Redis keys

`awa:user:<username>` (account record JSON), `awa:save:<username>:rev`,
`:meta`, `:data`, and `awa:rl:<kind>:<who>` (rate-limit counters).

## How the client syncs

`decideSync` in `src/game/cloud.js` compares the device save, the cloud's
and the last revision both agreed on (kept in `localStorage`):

- nothing in the cloud → upload; nothing on the device → download;
- the same save on both → just remember it;
- only one side moved on since they last matched → copy it over quietly;
- both moved on → the player chooses, seeing both summaries.

On boot (before the game is built, giving up after 2.5 s) a cloud save from
another device loads straight in. While signed in, a timer uploads a changed
save at most once a minute and retries with back-off when offline; hiding or
leaving the page sends a last copy with `fetch` keepalive (saves under 60 KB).
A save pulled from the cloud goes through `importSaveCode`, so the replaced one
is kept as the usual import backup. The save `VERSION` is unchanged; saves now
also hold an optional `playMs` (time played).
