// Player accounts and cloud saves, the browser side.
//
// Guest play is unchanged: the game always saves to this device (save.js). An
// account adds a copy in the cloud (api/save, see docs/accounts.md) so the same
// character can be carried to another phone or computer:
//  - On boot (before the game is built) and on logging in, the save on this
//    device is compared with the cloud's. When only one side has moved on since
//    they last matched, it is copied over quietly; when both have, the player
//    chooses which to keep (decideSync below).
//  - While signed in, a changed save is uploaded at most once a minute, from a
//    timer that only reads what the game already stored, so the frame loop
//    never waits on it. Leaving the page sends a last copy with fetch keepalive.
//  - Offline or failing uploads retry quietly, further apart each time.
//
// Nothing here runs unless main.js calls it, so headless tests never touch it,
// and every call answers "unavailable" when there is no API (npm start).
import { SAVE_KEY } from '../config.js';
import { Skills } from './skillset.js';
import { importSaveCode, saveCodeFromRaw, suppressSaves } from './save.js';

const ACCOUNT_KEY = 'singaporescape:account';     // { token, username, email }
const SYNC_KEY = 'singaporescape:cloud-sync';     // { user, rev, savedAt }: the last save both sides agreed on
export const UPLOAD_EVERY_MS = 60_000;            // at most one upload a minute
export const CHECK_EVERY_MS = 10_000;             // how often the timer looks for a newer save
export const KEEPALIVE_MAX = 60 * 1024;           // browsers cap a keepalive body at 64 KB
const BOOT_TIMEOUT_MS = 2500;                     // boot never waits longer than this for the cloud

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
function readJson(key) {
  try { return JSON.parse(storage()?.getItem(key) || 'null'); } catch { return null; }
}
function writeJson(key, v) {
  try { if (v == null) storage()?.removeItem(key); else storage()?.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ }
}

/** What a save holds, in the few numbers shown when choosing between two. */
export function saveSummary(data) {
  if (!data || typeof data !== 'object') return null;
  let totalLevel = 0, totalXp = 0;
  try {
    const sk = new Skills(null);
    sk.load(data.skills);
    totalLevel = sk.totalLevel(); totalXp = Math.floor(sk.totalXp());
  } catch { /* an odd save still gets a summary */ }
  const quests = data.quests && typeof data.quests === 'object' ? Object.values(data.quests).filter((q) => q?.state === 'done').length : 0;
  return {
    name: typeof data.player?.name === 'string' ? data.player.name.slice(0, 24) : null,
    jobClass: typeof data.jobClass === 'string' ? data.jobClass : null,
    totalLevel, totalXp, quests,
    playMs: typeof data.playMs === 'number' ? Math.floor(data.playMs) : 0,
    savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0,
  };
}

/** The save's own time stamp, read from the start of the stored text (snapshot
 *  writes it second) so the timer needn't parse the whole save to check it. */
export function rawSavedAt(raw) {
  const m = /"savedAt":(\d+)/.exec(String(raw || '').slice(0, 200));
  return m ? Number(m[1]) : 0;
}

/**
 * What to do with this device's save and the cloud's:
 *   local: { savedAt } or null (no save here)
 *   cloud: { rev, summary: { savedAt } } (rev 0: nothing in the cloud yet)
 *   last:  { rev, savedAt } the save both last agreed on, for this account, or null
 * Returns 'none' (in step), 'link' (the same save on both: just remember it),
 * 'upload', 'download', or 'choose' (both changed: ask the player).
 */
export function decideSync({ local, cloud, last }) {
  if (!cloud || !cloud.rev) return local ? 'upload' : 'none';
  if (!local) return 'download';
  if (cloud.summary?.savedAt && cloud.summary.savedAt === local.savedAt) return 'link';
  if (last) {
    if (cloud.rev === last.rev) return local.savedAt === last.savedAt ? 'none' : 'upload';
    if (local.savedAt === last.savedAt) return 'download';   // only the cloud moved on
  }
  return 'choose';
}

// ---------------- The API ----------------
/** Thin wrapper over fetch: never throws; says whether the server answered,
 *  the network failed (offline) or there is no accounts API here at all. */
export class CloudApi {
  constructor({ base = 'api/', fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 12000 } = {}) {
    this.base = base; this.fetch = fetchImpl; this.timeoutMs = timeoutMs;
  }
  /** -> { ok, status, data, offline, unavailable, error } */
  async call(path, { method = 'GET', body, token, keepalive = false, timeoutMs = this.timeoutMs } = {}) {
    if (!this.fetch) return { ok: false, unavailable: true, error: 'Accounts unavailable here.' };
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl && timeoutMs ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await this.fetch(this.base + path, {
        method, headers, keepalive, signal: ctl?.signal, cache: 'no-store', credentials: 'same-origin',
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
    } catch {
      return { ok: false, offline: true, error: 'Offline: could not reach the server.' };
    } finally { if (timer) clearTimeout(timer); }
    const type = res.headers?.get?.('content-type') || '';
    let data = null;
    if (type.includes('json')) { try { data = await res.json(); } catch { data = null; } }
    // No JSON (a 404 page from a plain static server): there is no API here.
    if (!data || res.status === 404) return { ok: false, status: res.status, unavailable: true, error: 'Accounts unavailable here.' };
    if (res.status === 503) return { ok: false, status: 503, unavailable: true, data, error: data.error || 'Accounts unavailable here.' };
    if (res.status >= 500) return { ok: false, status: res.status, offline: true, data, error: data.error || 'The server had a problem.' };
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : data.error || `Request failed (${res.status}).` };
  }
}

// ---------------- Sync ----------------
export const STATUS_TEXT = {
  guest: 'Playing as a guest: saved on this device only.',
  checking: 'Checking your cloud save…',
  pending: 'Saving to cloud…',
  synced: 'Saved to cloud ✓',
  offline: 'Offline: saved on this device',
  conflict: 'Your cloud save is different: choose which to keep.',
  signedOut: 'Signed out: please log in again.',
  unavailable: 'Accounts unavailable here.',
  error: 'Cloud save failed: your progress is still saved on this device.',
};

export class CloudSync {
  constructor({ api = new CloudApi(), now = () => Date.now(), reload = () => globalThis.location?.reload() } = {}) {
    this.api = api; this.now = now; this.reload = reload;
    this.account = readJson(ACCOUNT_KEY);
    if (!this.account?.token) this.account = null;
    this.status = this.account ? 'checking' : 'guest';
    this.detail = null;          // a message to show with the status
    this.choice = null;          // { local, cloud } while the player must choose
    this.available = null;       // null unknown, true / false once probed
    this.game = null;
    this._listeners = new Set();
    this._lastTry = -Infinity; this._fails = 0; this._busy = false; this._timer = null;
  }

  get signedIn() { return !!this.account; }
  /** The last save both sides agreed on, for the account signed in (any tab). */
  get last() { const l = readJson(SYNC_KEY); return l && l.user === this.account?.username ? l : null; }
  _remember(rev, savedAt) { writeJson(SYNC_KEY, { user: this.account.username, rev, savedAt }); }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _set(status, detail = null) {
    const changed = status !== this.status || detail !== this.detail;
    this.status = status; this.detail = detail;
    if (changed) for (const fn of this._listeners) { try { fn(this); } catch (e) { console.error(e); } }
  }
  statusText() { return this.detail && this.status !== 'synced' ? this.detail : STATUS_TEXT[this.status] || ''; }

  localSave() {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return null;
    try { const data = JSON.parse(raw); return { raw, data, summary: saveSummary(data) }; } catch { return null; }
  }

  // ---- Accounts ----
  /** Is there an accounts API here? (A plain static server has none.) */
  async probe() {
    const r = await this.api.call('auth', { method: 'POST', body: { action: 'me' }, token: this.account?.token });
    this.available = !r.unavailable && !r.offline ? true : r.unavailable ? false : this.available;
    if (r.unavailable) this.unavailableReason = r.error;
    return r;
  }

  async _auth(body) {
    const r = await this.api.call('auth', { method: 'POST', body });
    if (r.unavailable) { this.available = false; this.unavailableReason = r.error; }
    if (!r.ok) return { ok: false, error: r.error, code: r.data?.code };
    this.available = true;
    this.account = { token: r.data.token, username: r.data.username, email: r.data.email || null };
    writeJson(ACCOUNT_KEY, this.account);
    this._fails = 0;
    return { ok: true, data: r.data };
  }
  signup(username, password, email) { return this._withSync(this._auth({ action: 'signup', username, password, email: email || undefined })); }
  login(username, password) { return this._withSync(this._auth({ action: 'login', username, password })); }
  recover(username, recoveryCode, newPassword) { return this._withSync(this._auth({ action: 'recover', username, recoveryCode, newPassword })); }
  async _withSync(p) {
    const r = await p;
    if (r.ok) await this.sync();
    return r;
  }

  /** Sign out on this device. The save here stays, and guest play carries on. */
  logout() {
    this.account = null; this.choice = null;
    writeJson(ACCOUNT_KEY, null); writeJson(SYNC_KEY, null);
    this._set('guest');
  }
  _signedOut() {
    this.account = null; this.choice = null;
    writeJson(ACCOUNT_KEY, null); writeJson(SYNC_KEY, null);
    this._set('signedOut');
  }

  // ---- Comparing and copying ----
  /** Before the game is built: settle anything that needs no question asked, so
   *  a save pulled from the cloud loads straight away. Never throws, never waits
   *  longer than BOOT_TIMEOUT_MS. */
  async boot() {
    if (!this.account) return;
    try {
      await Promise.race([this.sync({ booting: true }), new Promise((r) => setTimeout(r, BOOT_TIMEOUT_MS))]);
    } catch (e) { console.warn('Cloud check failed:', e?.message); }
  }

  /** Compare the two saves and act on decideSync. */
  async sync({ booting = false } = {}) {
    if (!this.account) return 'guest';
    this._set('checking');
    const r = await this.api.call('save?meta=1', { token: this.account.token, timeoutMs: booting ? BOOT_TIMEOUT_MS : undefined });
    if (!r.ok) return this._failed(r);
    this.available = true;
    const local = this.localSave();
    const cloud = r.data;
    const what = decideSync({ local: local?.summary, cloud, last: this.last });
    if (what === 'none' || what === 'link') { this._remember(cloud.rev, cloud.summary?.savedAt || local?.summary.savedAt || 0); this._set('synced'); }
    else if (what === 'upload') await this.uploadNow();
    else if (what === 'download') await this.takeCloud({ booting });
    else { this.choice = { local: local.summary, cloud }; this._set('conflict'); }
    return what;
  }

  /** Replace this device's save with the cloud's (the one here is kept as the
   *  usual import backup). Reloads the page when a game is already running. */
  async takeCloud({ booting = false } = {}) {
    const r = await this.api.call('save', { token: this.account.token });
    if (!r.ok) return this._failed(r);
    const { save, rev } = r.data;
    if (!save) { this.choice = null; return this.uploadNow(); }
    const imp = importSaveCode(saveCodeFromRaw(JSON.stringify(save)));
    if (!imp.ok) { this._set('error', imp.error); return false; }
    this._remember(rev, typeof save.savedAt === 'number' ? save.savedAt : 0);
    this.choice = null;
    this._set('synced');
    // Before the game is built it simply loads the new save: saving carries on.
    if (booting && !this.game) suppressSaves(false);
    else this.reload();
    return true;
  }

  /** Keep this device's save: upload it over whatever the cloud holds. */
  async keepDevice() {
    const rev = this.choice?.cloud?.rev;
    this.choice = null;
    return this.uploadNow({ baseRev: rev });
  }

  /** Send this device's stored save now. -> true when the cloud has it. */
  async uploadNow({ baseRev, keepalive = false } = {}) {
    if (!this.account) return false;
    const local = this.localSave();
    if (!local) return false;
    const rev = baseRev ?? this.last?.rev ?? 0;
    // The stored text goes out as it is, wrapped, rather than re-serialised.
    const body = `{"baseRev":${rev},"summary":${JSON.stringify(local.summary)},"save":${local.raw}}`;
    if (keepalive && body.length > KEEPALIVE_MAX) return false;   // too big to send while leaving: the next visit catches up
    this._busy = true; this._lastTry = this.now();
    if (!keepalive) this._set('pending');
    const r = await this.api.call('save', { method: 'PUT', body, token: this.account.token, keepalive });
    this._busy = false;
    if (r.ok) {
      this._fails = 0;
      this._remember(r.data.rev, local.summary.savedAt);
      this._set('synced');
      return true;
    }
    if (r.status === 409) {
      this.choice = { local: local.summary, cloud: { rev: r.data.rev, savedAt: r.data.savedAt, summary: r.data.summary } };
      this._set('conflict');
      return false;
    }
    this._failed(r);
    return false;
  }

  _failed(r) {
    if (r.status === 401) { this._signedOut(); return false; }
    if (r.unavailable) { this.available = false; this.unavailableReason = r.error; this._set('unavailable', r.error); return false; }
    if (r.offline) { this._fails++; this._set('offline'); return false; }
    this._fails++;
    this._set('error', r.error);
    return false;
  }

  /** After an upload fails, wait longer before the next try: 15 s, 30 s, ... 5 min. */
  retryDelay() { return this._fails ? Math.min(300_000, 15_000 * 2 ** (this._fails - 1)) : UPLOAD_EVERY_MS; }

  /** The timer's check: upload when the stored save has moved on since the last
   *  one the cloud took, at most once a minute (sooner retries after a failure
   *  back off). Cheap: reads one string, no JSON parse unless uploading. */
  tick() {
    if (!this.account || this._busy || this.choice || this.status === 'unavailable' || this.status === 'checking') return false;
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return false;
    const last = this.last;
    if (last && rawSavedAt(raw) === last.savedAt) return false;
    const gap = this._fails ? this.retryDelay() : (last ? UPLOAD_EVERY_MS : 0);
    if (this.now() - this._lastTry < gap) return false;
    this.uploadNow();
    return true;
  }

  /** Start the background uploads once the game is running. */
  attach(game) {
    this.game = game;
    if (typeof setInterval !== 'function' || typeof window === 'undefined') return;
    if (!this._timer) this._timer = setInterval(() => this.tick(), CHECK_EVERY_MS);
    // Leaving (or hiding) the page: main.js has just saved, so send that copy.
    const leave = () => {
      if (!this.account || this.choice || this._busy) return;
      const raw = storage()?.getItem(SAVE_KEY);
      if (raw && rawSavedAt(raw) !== this.last?.savedAt) this.uploadNow({ keepalive: true });
    };
    window.addEventListener('pagehide', leave);
    document.addEventListener?.('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
  }
}

/** The one the game uses (main.js and the account screens share it). */
let shared = null;
export function cloud() { return (shared ??= new CloudSync()); }
