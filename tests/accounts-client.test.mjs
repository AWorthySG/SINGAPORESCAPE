// Accounts and cloud saves, browser side (src/game/cloud.js): which save wins,
// the first upload, the throttled uploads, and staying quiet with no API. The
// client talks to the real route handlers (api/_lib) over a fake fetch, backed
// by the in-memory store, so both halves are checked together.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideSync, saveSummary, rawSavedAt, CloudApi, CloudSync, UPLOAD_EVERY_MS } from '../src/game/cloud.js';
import { makeAuthHandler, makeSaveHandler } from '../api/_lib/accounts.js';
import { memoryStore } from '../api/_lib/store.js';
import { Game } from '../src/game/game.js';
import { snapshot, saveGame, loadGame, suppressSaves } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}

/** A server (the real handlers) and a fetch that reaches it like a browser would. */
function server() {
  let t = 1_800_000_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const deps = { store: memoryStore(clock.now), secret: 'client-test-secret-0123456789', now: clock.now };
  const routes = { auth: makeAuthHandler(() => deps), save: makeSaveHandler(() => deps) };
  const net = { down: false, calls: [] };
  const fetchImpl = async (url, opts = {}) => {
    if (net.down) throw new TypeError('Failed to fetch');
    net.calls.push({ url, method: opts.method, keepalive: !!opts.keepalive });
    const route = /^api\/(\w+)/.exec(url)?.[1];
    const headers = { host: 'game.test', 'x-forwarded-for': '1.1.1.1' };
    for (const [k, v] of Object.entries(opts.headers || {})) headers[k.toLowerCase()] = v;
    const req = { method: opts.method || 'GET', url: '/' + url, headers, body: opts.body };
    const res = { statusCode: 200, h: {}, text: '', setHeader(k, v) { this.h[k.toLowerCase()] = v; }, end(x) { this.text = x; } };
    await routes[route](req, res);
    return { status: res.statusCode, ok: res.statusCode < 300, headers: { get: (k) => res.h[k.toLowerCase()] || null }, json: async () => JSON.parse(res.text) };
  };
  return { clock, deps, net, fetchImpl };
}

function device(srv, clockMs = { t: 0 }) {
  const storage = memStorage();
  globalThis.localStorage = storage;
  const reloads = [];
  const sync = new CloudSync({ api: new CloudApi({ fetchImpl: srv.fetchImpl }), now: () => clockMs.t, reload: () => reloads.push(1) });
  return { storage, sync, reloads, clockMs, use() { globalThis.localStorage = storage; } };
}

/** A real game's save, stored on the device in use, with a given time stamp. */
function storeSave(dev, savedAt, tweak = () => {}) {
  dev.use();
  const g = new Game();
  g.pendingStyleChoice = false;
  g.jobClass = 'rogue';
  tweak(g);
  const data = snapshot(g);
  data.savedAt = savedAt;
  dev.storage.setItem(SAVE_KEY, JSON.stringify(data));
  return data;
}

test('decideSync: which save wins', () => {
  const L = (savedAt) => ({ savedAt });
  const C = (rev, savedAt) => ({ rev, summary: { savedAt } });
  // Nothing in the cloud yet: the first login uploads this device's save.
  assert.equal(decideSync({ local: L(5), cloud: C(0), last: null }), 'upload');
  assert.equal(decideSync({ local: null, cloud: C(0), last: null }), 'none');
  // Nothing on this device (a new phone): take the cloud's.
  assert.equal(decideSync({ local: null, cloud: C(3, 9), last: null }), 'download');
  // The same save on both sides.
  assert.equal(decideSync({ local: L(9), cloud: C(3, 9), last: null }), 'link');
  // In step since the last sync; or only this device moved on.
  assert.equal(decideSync({ local: L(9), cloud: C(3, 9), last: { rev: 3, savedAt: 9 } }), 'link');
  assert.equal(decideSync({ local: L(12), cloud: C(3, 9), last: { rev: 3, savedAt: 9 } }), 'upload');
  // Only the cloud moved on (played on another device): take it quietly.
  assert.equal(decideSync({ local: L(9), cloud: C(4, 20), last: { rev: 3, savedAt: 9 } }), 'download');
  // Both moved on, or never synced here and they differ: the player chooses.
  assert.equal(decideSync({ local: L(12), cloud: C(4, 20), last: { rev: 3, savedAt: 9 } }), 'choose');
  assert.equal(decideSync({ local: L(12), cloud: C(4, 20), last: null }), 'choose');
});

test('saveSummary reads a real save: name, class, total level, quests, play time', () => {
  globalThis.localStorage = memStorage();
  const g = new Game();
  g.player.name = 'Mei Ling';
  g.jobClass = 'wizard';
  g.playMs = 3_600_000;
  g.skills.xp.woodcutting = 50_000;
  const firstQuest = Object.keys(g.quests)[0];
  g.quests[firstQuest].state = 'done';
  const data = snapshot(g);
  const s = saveSummary(data);
  assert.equal(s.name, 'Mei Ling');
  assert.equal(s.jobClass, 'wizard');
  assert.equal(s.totalLevel, g.skills.totalLevel());
  assert.equal(s.quests, 1);
  assert.equal(s.playMs, 3_600_000);
  assert.equal(s.savedAt, data.savedAt);
  assert.equal(rawSavedAt(JSON.stringify(data)), data.savedAt);
  // Play time survives a save and load (older saves load as 0).
  const g2 = new Game();
  globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  assert.ok(loadGame(g2));
  assert.equal(g2.playMs, 3_600_000);
  delete data.playMs;
  globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const g3 = new Game();
  loadGame(g3);
  assert.equal(g3.playMs, 0);
});

test('first sign-up uploads the device save; a new device logs in and takes it', async () => {
  const srv = server();
  const a = device(srv);
  const saved = storeSave(a, 1000);
  const r = await a.sync.signup('Kopi_Kid', 'teh-tarik-123');
  assert.ok(r.ok);
  assert.match(r.data.recoveryCode, /-/);
  assert.equal(a.sync.status, 'synced');
  assert.equal(a.sync.last.rev, 1);

  // Phone B: nothing saved there yet. Logging in brings the character over.
  const b = device(srv);
  assert.equal(b.storage.getItem(SAVE_KEY), null);
  const l = await b.sync.login('kopi_kid', 'teh-tarik-123');
  assert.ok(l.ok);
  const got = JSON.parse(b.storage.getItem(SAVE_KEY));
  assert.equal(got.savedAt, saved.savedAt);
  assert.equal(got.jobClass, 'rogue');
  assert.equal(b.reloads.length, 1, 'a running game reloads into the cloud save');
  assert.deepEqual([b.sync.last.rev, b.sync.status], [1, 'synced']);
  suppressSaves(false);   // the import paused saving until the (fake) reload
});

test('boot: a cloud save made elsewhere loads before the game is built, without a reload', async () => {
  const srv = server();
  const a = device(srv);
  storeSave(a, 1000);
  await a.sync.signup('boot_kid', 'password-123');
  // Phone B signed in once, synced at rev 1, and has not played since.
  const b = device(srv);
  storeSave(b, 1000);
  await b.sync.login('boot_kid', 'password-123');
  assert.equal(b.sync.last.rev, 1);
  // Meanwhile A plays on and uploads rev 2.
  a.use(); storeSave(a, 5000, (g) => { g.skills.xp.fishing = 90_000; });
  assert.ok(await a.sync.uploadNow());
  // B starts up again (a fresh page: a new CloudSync reading the stored account).
  b.use();
  const fresh = new CloudSync({ api: new CloudApi({ fetchImpl: srv.fetchImpl }), reload: () => assert.fail('no reload at boot') });
  assert.ok(fresh.signedIn);
  await fresh.boot();
  assert.equal(rawSavedAt(b.storage.getItem(SAVE_KEY)), 5000);
  assert.equal(fresh.last.rev, 2);
  // ...and saving was not left paused by the import.
  const g = new Game();
  assert.equal(saveGame(g), true);
});

test('both saves changed: the player chooses, and either choice settles it', async () => {
  const srv = server();
  const a = device(srv);
  storeSave(a, 1000);
  await a.sync.signup('two_phones', 'password-123');
  const b = device(srv);
  storeSave(b, 1000);
  await b.sync.login('two_phones', 'password-123');
  // Both play on separately; A uploads first.
  a.use(); storeSave(a, 3000); await a.sync.uploadNow();
  b.use(); storeSave(b, 4000, (g) => { g.skills.xp.cooking = 77_000; });
  // B's upload is refused with the cloud copy's details, so B can choose.
  assert.equal(await b.sync.uploadNow(), false);
  assert.equal(b.sync.status, 'conflict');
  assert.equal(b.sync.choice.cloud.rev, 2);
  assert.equal(b.sync.choice.cloud.summary.savedAt, 3000);
  assert.equal(b.sync.choice.local.savedAt, 4000);
  assert.ok(b.sync.choice.local.totalLevel > b.sync.choice.cloud.summary.totalLevel);
  assert.equal(b.sync.tick(), false, 'no uploads while the choice is open');
  // Keep this device's: it goes up over the cloud's.
  assert.ok(await b.sync.keepDevice());
  assert.deepEqual([b.sync.status, b.sync.last.rev, b.sync.choice], ['synced', 3, null]);
  // Now A logs in again and sees B's save in the cloud while its own moved on: it chooses the cloud.
  a.use(); storeSave(a, 6000);
  assert.equal(await a.sync.sync(), 'choose');
  assert.ok(await a.sync.takeCloud());
  assert.equal(rawSavedAt(a.storage.getItem(SAVE_KEY)), 4000);
  assert.ok(a.storage.getItem(SAVE_KEY + '-before-import'), 'the replaced save is kept as a backup');
  suppressSaves(false);
});

test('uploads are throttled to one a minute, and back off quietly while offline', async () => {
  const srv = server();
  const a = device(srv);
  storeSave(a, 1000);
  await a.sync.signup('throttle', 'password-123');
  const puts = () => srv.net.calls.filter((c) => c.method === 'PUT').length;
  const n0 = puts();
  // Nothing new: nothing sent.
  a.clockMs.t += UPLOAD_EVERY_MS * 2;
  assert.equal(a.sync.tick(), false);
  // A save lands; uploads straight away (a minute has passed since the last).
  storeSave(a, 2000);
  assert.equal(a.sync.tick(), true);
  await new Promise((r) => setImmediate(r));
  assert.equal(puts(), n0 + 1);
  // Another save 10 s later waits for the minute.
  storeSave(a, 3000);
  a.clockMs.t += 10_000;
  assert.equal(a.sync.tick(), false);
  a.clockMs.t += UPLOAD_EVERY_MS;
  // Offline: the try fails quietly, and the next waits a little.
  srv.net.down = true;
  assert.equal(a.sync.tick(), true);
  await new Promise((r) => setImmediate(r));
  assert.equal(a.sync.status, 'offline');
  assert.equal(a.sync.statusText(), 'Offline: saved on this device');
  assert.equal(a.sync.tick(), false, 'backs off');
  srv.net.down = false;
  a.clockMs.t += a.sync.retryDelay();
  assert.equal(a.sync.tick(), true);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(a.sync.status, 'synced');
  assert.equal(a.sync.statusText(), 'Saved to cloud ✓');
  assert.equal(a.sync.last.savedAt, 3000);
});

test('no API here (npm start), a 401, or no network: everything stays quiet and guest play carries on', async () => {
  globalThis.localStorage = memStorage();
  // A static server answers /api/... with a 404 page.
  const html404 = async () => ({ status: 404, ok: false, headers: { get: () => 'text/html' }, json: async () => { throw new Error('html'); } });
  const s = new CloudSync({ api: new CloudApi({ fetchImpl: html404 }) });
  assert.equal(s.status, 'guest');
  const r = await s.login('someone', 'password-123');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'Accounts unavailable here.');
  assert.equal(s.available, false);
  assert.equal(s.signedIn, false);
  // No fetch at all (very old browser, or tests).
  const none = await new CloudApi({ fetchImpl: null }).call('auth');
  assert.ok(none.unavailable);
  // Timeouts and network errors read as offline.
  const offline = await new CloudApi({ fetchImpl: async () => { throw new TypeError('x'); } }).call('save');
  assert.ok(offline.offline);
  // A session the server no longer accepts signs out, keeping the device save.
  const srv = server();
  const a = device(srv);
  const saved = storeSave(a, 1000);
  await a.sync.signup('expiring', 'password-123');
  srv.clock.advance(31 * 86400e3);
  await a.sync.sync();
  assert.equal(a.sync.status, 'signedOut');
  assert.equal(a.sync.signedIn, false);
  assert.equal(rawSavedAt(a.storage.getItem(SAVE_KEY)), saved.savedAt);
  // Logging out is local only, and the save stays too.
  const b = device(srv);
  storeSave(b, 1000);
  await b.sync.signup('leaver', 'password-123');
  b.sync.logout();
  assert.deepEqual([b.sync.status, b.sync.signedIn], ['guest', false]);
  assert.ok(b.storage.getItem(SAVE_KEY));
});

test('the game still boots and saves headlessly with the accounts code in place', async () => {
  globalThis.localStorage = memStorage();
  const { cloud } = await import('../src/game/cloud.js');
  const g = new Game();
  g.start?.();
  assert.equal(cloud().status, 'guest');
  cloud().attach(g);   // no window: no timer, no listeners
  assert.equal(cloud().tick(), false);
  assert.equal(saveGame(g), true);
  const data = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY));
  assert.equal(typeof data.playMs, 'number');
});
