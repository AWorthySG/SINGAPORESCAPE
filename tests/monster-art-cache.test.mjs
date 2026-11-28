import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('revised monster art loads fresh online and uses older cached art offline', async () => {
  const scope = 'https://game.invalid/SINGAPORESCAPE/';
  const previous = { ok: true };
  const revised = { ok: true, type: 'basic', clone: () => revised };
  const cache = new Map();
  const oldPath = 'assets/creatures/species/rig/rat_body.webp';
  const wyrmPath = 'assets/creatures/bosses/eternal_wyrm.webp';
  const townsfolkPath = 'assets/creatures/townsfolk/idle/guide_body.webp';
  cache.set(scope + oldPath, previous);
  cache.set(scope + wyrmPath + '?v=3', previous);
  cache.set(scope + townsfolkPath, previous);
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
        if (!opts?.ignoreSearch) return cache.get(req.url);
        const path = req.url.split('?')[0];
        return [...cache].find(([url]) => url.split('?')[0] === path)?.[1];
      },
      open: async () => ({ put: (req, res) => cache.set(req.url, res) }),
    },
    fetch: async () => {
      if (offline) throw new Error('offline');
      return revised;
    },
  });
  const request = (path) => new Promise((resolve) => {
    handleFetch({ request: { method: 'GET', url: scope + path }, respondWith: resolve });
  });

  offline = true;
  assert.equal(await request(oldPath + '?v=3'), previous);
  assert.equal(await request(wyrmPath + '?v=4'), previous);
  assert.equal(await request(townsfolkPath + '?v=3'), undefined);
  assert.ok(!cache.has(scope + oldPath + '?v=3'), 'offline fallback keeps the revised URL available for fresh art');
  offline = false;
  assert.equal(await request(oldPath + '?v=3'), revised);
  assert.equal(await request(wyrmPath + '?v=4'), revised);
  offline = true;
  assert.equal(await request(oldPath + '?v=3'), revised);
});
