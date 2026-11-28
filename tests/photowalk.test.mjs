import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { PHOTO_WALKS } from '../src/data/photowalks.js';
import { PHOTO_ASSIGNMENTS } from '../src/data/islandlife.js';
import { xpForLevel } from '../src/data/xp.js';
import { islandBook, islandClaimed, islandSiteTile, recordIslandPhoto, restoreIslandLife } from '../src/game/islandlife.js';
import { activePhotoWalk, cancelPhotoWalk, photographyBook, PHOTO_THUMB_LIMIT, photoThumbnail, recordPhotoStop, rememberPhotoThumbnail, startPhotoWalk, validPhotoThumbnail } from '../src/game/photowalk.js';
import { saveGame } from '../src/game/save.js';
import { compactPhoto } from '../src/render/photothumb.js';
import { islandAlbumHTML } from '../src/ui/islandlifeui.js';
import { photoWalkHint } from '../src/ui/photomode.js';

const PRINT = 'data:image/webp;base64,UklGRg==';
const OVERSIZED = 'data:image/webp;base64,' + 'A'.repeat(PHOTO_THUMB_LIMIT);

function openGame({ layout = 'singapore', reset = true } = {}) {
  if (reset) {
    const store = new Map();
    globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, data) => store.set(key, data), removeItem: (key) => store.delete(key) };
  }
  const game = new Game({ layout });
  game.start();
  if (reset) game.chooseClass('rogue');
  game.todayKey = () => '2026-11-28';
  return game;
}
function visit(game, site) {
  const { x, y } = islandSiteTile(game.world, site);
  Object.assign(game.player, { x, y, tx: x, ty: y });
  game.updateRegion();
}
function finish(game, walk, options) {
  let result;
  for (const stop of walk.stops) {
    visit(game, stop);
    result = recordPhotoStop(game, options);
  }
  return result;
}

test('photo walks have ordered local stops and a real, unrestricted repeat XP loop', () => {
  const game = openGame();
  const [starter, advanced] = PHOTO_WALKS;
  assert.deepEqual(PHOTO_WALKS.map((walk) => walk.level), [1, 25, 50, 75, 99]);
  assert.equal(startPhotoWalk(game, advanced.id), false);
  assert.equal(startPhotoWalk(game, starter.id), true);
  assert.equal(startPhotoWalk(game, starter.id), false, 'cannot reset active progress by starting again');
  visit(game, starter.stops[1]);
  assert.equal(recordPhotoStop(game), null, 'cannot skip an assigned stop');
  const coins = game.inventory.count('coins'), before = game.skills.xp.photography;
  game.dayPhase = () => .5;
  const initial = finish(game, starter);
  assert.equal(initial.complete, true);
  assert.equal(initial.first, true);
  assert.equal(game.skills.xp.photography - before, initial.xp);
  assert.equal(startPhotoWalk(game, starter.id), true);
  const repeat = finish(game, starter);
  assert.equal(repeat.first, false);
  assert.equal(repeat.xp, starter.xp * 31.25);
  assert.equal(game.inventory.count('coins'), coins, 'walks never create repeat coin payouts');
  assert.deepEqual(islandBook(game).photos, [], 'ordinary album prints remain separate');
  assert.equal(photographyBook(game).completed[starter.id], 2);
  assert.equal(activePhotoWalk(game), null);
});

test('dusk and framing improve a portfolio without blocking daytime captures', () => {
  const walk = PHOTO_WALKS.find((entry) => entry.level === 50);
  const earn = (dusk, framed) => {
    const game = openGame();
    game.skills.xp.photography = xpForLevel(walk.level);
    game.dayPhase = () => dusk ? .75 : .5;
    assert.equal(startPhotoWalk(game, walk.id), true);
    return finish(game, walk, { framed }).xp;
  };
  const daylight = earn(false, false);
  assert.ok(daylight > 0);
  assert.ok(earn(false, true) > daylight);
  assert.ok(earn(true, true) > earn(false, true));
});

test('walk progress and bounded actual-photo slots survive a geographic save', () => {
  const game = openGame();
  const [walk] = PHOTO_WALKS;
  assert.equal(startPhotoWalk(game, walk.id), true);
  visit(game, walk.stops[0]);
  assert.equal(recordPhotoStop(game, { framed: true }).step, 1);
  assert.equal(saveGame(game), true);
  const restored = openGame({ reset: false });
  assert.equal(activePhotoWalk(restored).stop.id, walk.stops[1].id);
  visit(restored, walk.stops[1]);
  assert.equal(recordPhotoStop(restored).complete, true);
  assert.equal(rememberPhotoThumbnail(restored, walk.id, OVERSIZED), false);
  assert.equal(rememberPhotoThumbnail(restored, 'constructor', PRINT), false);
  assert.equal(rememberPhotoThumbnail(restored, walk.id, PRINT), true);
  assert.equal(saveGame(restored), true);
  const next = openGame({ reset: false });
  assert.equal(photoThumbnail(next, walk.id), PRINT);
  assert.ok(islandAlbumHTML(next).includes(PRINT));
  assert.equal(startPhotoWalk(next, walk.id), true);
  assert.equal(cancelPhotoWalk(next), true);
  assert.equal(activePhotoWalk(next), null);
  const invalid = restoreIslandLife({ photos: ['market'], photography: {
    active: { id: walk.id, step: 200, quality: 0 }, completed: { [walk.id]: 3, bogus: 99 },
    thumbnails: { market: OVERSIZED, [walk.id]: PRINT, bogus: PRINT, temple: 'javascript:alert(1)' },
  } }).photography;
  assert.deepEqual(invalid, { active: null, completed: { [walk.id]: 3 }, thumbnails: { [walk.id]: PRINT } });
});

test('a submitted daily commission leaves the same subject available for a walk', () => {
  const game = openGame();
  const market = PHOTO_ASSIGNMENTS.find((photo) => photo.id === 'market');
  visit(game, market);
  assert.equal(recordIslandPhoto(game)?.id, market.id);
  assert.equal(rememberPhotoThumbnail(game, market.id, PRINT), true);
  assert.equal(islandClaimed(game, 'photo:market'), true);
  assert.equal(recordIslandPhoto(game), null);
  const [walk] = PHOTO_WALKS;
  assert.equal(startPhotoWalk(game, walk.id), true);
  assert.equal(recordPhotoStop(game)?.name, market.name);
  assert.equal(islandClaimed(game, 'photo:market'), true);
  assert.ok(islandAlbumHTML(game).includes(PRINT));
});

test('thumbnail creation is bounded and camera hints disclose when bonuses are optional', () => {
  const sizes = [];
  const produce = (w, h) => {
    sizes.push([w, h]);
    return { getContext: () => ({ drawImage() {} }), toDataURL: () => sizes.length === 1 ? OVERSIZED : PRINT };
  };
  assert.equal(compactPhoto({ width: 1800, height: 900 }, produce), PRINT);
  assert.deepEqual(sizes, [[160, 80], [112, 56]]);
  assert.equal(compactPhoto({ width: 100, height: 100 }, () => ({ getContext: () => null })), null);
  assert.equal(validPhotoThumbnail('data:image/svg+xml;base64,AAAA'), false);
  const walk = PHOTO_WALKS.find((entry) => entry.level === 50), stop = walk.stops.at(-1);
  const active = { walk, stop, progress: { step: 2 } };
  assert.match(photoWalkHint(active), /Walk to the stop/);
  assert.match(photoWalkHint(active, { near: true, framed: true }), /Dusk .* adds a light bonus/);
  assert.match(photoWalkHint(active, { near: true, framed: true, dusk: true }), /Framing bonus ready/);
});
