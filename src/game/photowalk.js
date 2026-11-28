import { PHOTO_ASSIGNMENTS } from '../data/islandlife.js';
import { PHOTO_WALKS, photoWalkById } from '../data/photowalks.js';
import { atIslandSite, earnIslandPractice, islandBook, islandReady } from './islandlife.js';

// Thirteen fixed album/portfolio slots at most. A photo never needs to bloat a save.
export const PHOTO_THUMB_LIMIT = 8192;
const THUMB_PREFIX = 'data:image/webp;base64,';
export function validPhotoThumbnail(value) {
  return typeof value === 'string' && value.length <= PHOTO_THUMB_LIMIT && value.startsWith(THUMB_PREFIX)
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.slice(THUMB_PREFIX.length))
    && value.length > THUMB_PREFIX.length;
}

export function restorePhotography(raw, photos = []) {
  const { active, completed, thumbnails } = raw || {};
  const walk = photoWalkById(active?.id);
  const step = active?.step;
  const quality = active?.quality;
  const progress = walk && Number.isInteger(step) && step >= 0 && step < walk.stops.length
    ? { id: walk.id, step, quality: Number.isFinite(quality) ? Math.max(0, Math.min(step, quality)) : 0 } : null;
  const counts = {};
  for (const entry of PHOTO_WALKS) {
    const count = completed?.[entry.id];
    if (Number.isInteger(count) && count > 0) counts[entry.id] = Math.min(count, 99999);
  }
  const pictures = {};
  const known = PHOTO_ASSIGNMENTS.filter((photo) => Array.isArray(photos) && photos.includes(photo.id)).map((photo) => photo.id);
  for (const id of [...known, ...Object.keys(counts)]) {
    const src = thumbnails?.[id];
    if (validPhotoThumbnail(src)) pictures[id] = src;
  }
  return { active: progress, completed: counts, thumbnails: pictures };
}

export function photographyBook(game) {
  const book = islandBook(game);
  return book.photography ??= restorePhotography(null, book.photos);
}

export function activePhotoWalk(game) {
  const active = photographyBook(game).active;
  const walk = photoWalkById(active?.id);
  return walk ? { walk, progress: active, stop: walk.stops[active.step] } : null;
}

export function startPhotoWalk(game, id) {
  const walk = photoWalkById(id), book = photographyBook(game);
  if (!walk || book.active || !islandReady(game) || game.skills.level('photography') < walk.level) return false;
  book.active = { id, step: 0, quality: 0 };
  game.saveSoon = true;
  return true;
}

export function cancelPhotoWalk(game) {
  const book = photographyBook(game);
  if (!book.active) return false;
  book.active = null;
  game.saveSoon = true;
  return true;
}

export const photoDusk = (game) => {
  const phase = game.dayPhase();
  return phase >= 17 / 24 && phase < 20 / 24;
};

export function rememberPhotoThumbnail(game, id, src) {
  const book = islandBook(game), photography = photographyBook(game);
  if ((!book.photos.includes(id) && !Object.hasOwn(photography.completed, id)) || !validPhotoThumbnail(src)) return false;
  photography.thumbnails[id] = src;
  game.saveSoon = true;
  return true;
}

export function photoThumbnail(game, id) {
  return game.islandLife?.photography?.thumbnails?.[id] || null;
}

/** A walk awards training XP on its last stop. The original album commissions
 *  remain separate, so retraining never repeats a commission's coin payout. */
export function recordPhotoStop(game, { framed = false } = {}) {
  const active = activePhotoWalk(game);
  if (!active || !islandReady(game) || game.skills.level('photography') < active.walk.level) return null;
  const { walk, stop, progress } = active;
  if (!atIslandSite(game, stop, stop.range)) return null;
  progress.quality += (framed ? (stop.dusk ? .7 : 1) : 0) + (stop.dusk && photoDusk(game) ? .3 : 0);
  progress.step += 1;
  game.saveSoon = true;
  const total = walk.stops.length;
  if (progress.step < total) return { walk, name: stop.name, step: progress.step, total, next: walk.stops[progress.step] };
  const book = photographyBook(game), count = book.completed[walk.id] || 0;
  const { xp, first } = earnIslandPractice(game, 'photography', walk.id, walk.xp, { quality: progress.quality / total, message: `${walk.name} complete.` });
  book.completed[walk.id] = Math.min(99999, count + 1);
  book.active = null;
  return { walk, name: stop.name, step: total, total, xp, first, complete: true };
}
