import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function artworkCache() {
  const scope = 'https://game.invalid/SINGAPORESCAPE/';
  const previous = { ok: true };
  const revised = { ok: true, type: 'basic', clone: () => revised };
  const entries = new Map([['awa-v1', new Map()]]);
  const getCache = (name) => {
    if (!entries.has(name)) entries.set(name, new Map());
    return entries.get(name);
  };
  const requests = [];
  let offline = false;
  let handleFetch;
  runInNewContext(source, {
    URL,
    self: {
      location: { origin: new URL(scope).origin },
      registration: { scope },
      addEventListener: (type, callback) => { if (type === 'fetch') handleFetch = callback; },
    },
    caches: {
      match: async (req, opts) => {
        const caches = opts?.cacheName ? [getCache(opts.cacheName)] : [...entries.values()];
        if (!opts?.ignoreSearch) return caches.map((cache) => cache.get(req.url)).find(Boolean);
        const path = req.url.split('?')[0];
        return caches.flatMap((cache) => [...cache]).find(([url]) => url.split('?')[0] === path)?.[1];
      },
      open: async (name) => ({ put: (req, res) => getCache(name).set(req.url, res) }),
    },
    fetch: async (req, opts) => {
      requests.push([req.url, opts?.cache]);
      if (offline) throw new Error('offline');
      return revised;
    },
  });
  const request = (path) => new Promise((resolve) => {
    handleFetch({ request: { method: 'GET', url: scope + path }, respondWith: resolve });
  });
  return {
    previous, revised, request, requests,
    seed: (path) => getCache('awa-v1').set(scope + path, previous),
    setOffline: (isOffline) => { offline = isOffline; },
  };
}

test('revised monster art loads fresh online and uses older cached art offline', async () => {
  const { previous, revised, request, seed, setOffline } = artworkCache();
  const oldPath = 'assets/creatures/species/rig/rat_body.webp';
  const wyrmPath = 'assets/creatures/bosses/eternal_wyrm.webp';
  const townsfolkPath = 'assets/creatures/townsfolk/idle/guide_body.webp';
  seed(oldPath);
  seed(wyrmPath + '?v=3');
  seed(townsfolkPath);
  setOffline(true);
  assert.equal(await request(oldPath + '?v=3'), previous);
  assert.equal(await request(wyrmPath + '?v=4'), previous);
  assert.equal(await request(townsfolkPath + '?v=3'), undefined);
  setOffline(false);
  assert.equal(await request(oldPath + '?v=3'), revised);
  assert.equal(await request(wyrmPath + '?v=4'), revised);
  setOffline(true);
  assert.equal(await request(oldPath + '?v=3'), revised);
  assert.equal(await request(wyrmPath + '?v=5'), revised, 'prefer updated art even when the exact version is unavailable');
});

test('updated item artwork replaces the previous cache on the first online visit', async () => {
  const { previous, revised, request, requests, seed, setOffline } = artworkCache();
  const path = 'assets/icons/item-shortbow.webp';
  const unaffected = 'assets/maps/singapore-atlas.webp';
  seed(path);
  seed(unaffected);
  setOffline(true);
  assert.equal(await request(path), previous);
  setOffline(false);
  assert.equal(await request(unaffected), previous);
  assert.equal(await request(path), revised);
  assert.equal(requests.at(-1)[1], 'reload');
  setOffline(true);
  assert.equal(await request(path), revised);
  assert.equal(requests.at(-1)[1], undefined);
});
