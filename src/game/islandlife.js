import { LANDINGS, LOOM, PATTERNS, PHOTO_ASSIGNMENTS, STAGES, TUNES, VOYAGES } from '../data/islandlife.js';
import { teleportPlayer } from './skillunlocks.js';

export const nearIslandSite = (p, site, range = 2) => Math.max(Math.abs(p.x - site.x), Math.abs(p.y - site.y)) <= range;
const ids = (raw, table) => table.filter((row) => Array.isArray(raw) && raw.includes(row.id)).map((row) => row.id);

export function restoreIslandLife(raw) {
  const book = {
    voyages: ids(raw?.voyages, VOYAGES),
    photos: ids(raw?.photos, PHOTO_ASSIGNMENTS),
    patterns: ids(raw?.patterns, PATTERNS),
    tunes: ids(raw?.tunes, TUNES),
    cove: ids(raw?.cove, COVE_FIND),
    scarf: null, display: null,
  };
  if (book.patterns.includes(raw?.scarf)) book.scarf = raw.scarf;
  if (book.photos.includes(raw?.display)) book.display = raw.display;
  return book;
}
export const islandBook = (game) => game.islandLife ??= restoreIslandLife();

function finish(game, skill, xp, message) {
  game.skills.addXp(skill, xp);
  game.saveSoon = true;
  game.msg(message, 'system');
}

export function islandReady(game) {
  return game.player.alive && !game.waves?.active && !game.inWilderness?.() && !game.teleports?.cast && !game.teleports?.blocked?.('voyage');
}

export function voyageAvailable(game, voyage) {
  return islandReady(game) && nearIslandSite(game.player, LANDINGS[voyage.from])
    && game.skills.level('sailing') >= voyage.level
    && (voyage.to !== 'cove' || islandBook(game).voyages.includes('ubin'));
}

export function finishVoyage(game, id, choices) {
  const voyage = VOYAGES.find((row) => row.id === id);
  if (!voyage || !voyageAvailable(game, voyage) || choices.length !== voyage.course.length
    || !voyage.course.every((side, i) => side === choices[i])) return false;
  if (game.autoBattle) game.toggleAutoBattle(false);
  if (game.autoQuest) game.toggleAutoQuest(false, 'you set sail.');
  game._autoLife = null;
  game.autoGatherBest = null;
  const dest = LANDINGS[voyage.to];
  if (!teleportPlayer(game, dest.x, dest.y, `You tie up at ${dest.name}.`)) return false;
  const book = islandBook(game), first = !book.voyages.includes(id);
  if (first) book.voyages.push(id);
  finish(game, 'sailing', first ? voyage.xp : 3, first ? 'New route charted.' : 'Passage logged.');
  return true;
}

export const COVE_FIND = [
  { id: 'line', name: 'Fish the shallows', skill: 'fishing', item: 'raw_anchovy' },
  { id: 'reef', name: 'Dive by the reef', skill: 'diving', item: 'seashell' },
  { id: 'survey', name: 'Survey the beach', skill: 'archaeology', item: 'pottery_shard' },
];

export function exploreCove(game, id) {
  const pick = COVE_FIND.find((row) => row.id === id);
  const book = islandBook(game);
  if (!pick || !islandReady(game) || !nearIslandSite(game.player, LANDINGS.cove) || !book.voyages.includes('cove') || book.cove.includes(id)) return false;
  if (!game.inventory.add(pick.item, 1)) return false;
  book.cove.push(id);
  finish(game, pick.skill, 12, 'You record a new find from the cove.');
  return true;
}

export function recordIslandPhoto(game) {
  if (!game.player.alive || game.waves?.active) return null;
  const book = islandBook(game), phase = game.dayPhase();
  const subject = PHOTO_ASSIGNMENTS.find((row) => !book.photos.includes(row.id) && game.skills.level('photography') >= row.level
    && nearIslandSite(game.player, row, row.range) && (!row.dusk || (phase >= 17 / 24 && phase < 20 / 24)));
  if (!subject) return null;
  book.photos.push(subject.id);
  finish(game, 'photography', subject.xp, `Album print earned: ${subject.name}.`);
  return subject;
}

export function makeIslandPattern(game, id) {
  const pattern = PATTERNS.find((row) => row.id === id);
  if (!pattern || !islandReady(game) || !nearIslandSite(game.player, LOOM) || game.skills.level('textile_arts') < pattern.level
    || game.inventory.count(pattern.dye) < 1 || game.inventory.count('coins') < 8) return false;
  game.inventory.take(pattern.dye, 1);
  game.inventory.take('coins', 8); // the weaver provides the cotton blank
  const book = islandBook(game);
  if (!book.patterns.includes(id)) book.patterns.push(id);
  book.scarf = id;
  finish(game, 'textile_arts', pattern.xp, `You print the ${pattern.name} pattern and wear it as a scarf.`);
  return true;
}

export function musicStage(game) {
  return STAGES.find((stage) => nearIslandSite(game.player, stage) && game.skills.level('music') >= stage.level);
}

export function learnIslandTune(game, id) {
  const tune = TUNES.find((row) => row.id === id), book = islandBook(game);
  if (!tune || !islandReady(game) || !musicStage(game) || game.skills.level('music') < tune.level || book.tunes.includes(id)) return false;
  book.tunes.push(id);
  game.saveSoon = true;
  return true;
}

export function finishIslandTune(game, id, notes, elapsed) {
  const tune = TUNES.find((row) => row.id === id);
  if (!tune || !islandReady(game) || !musicStage(game) || !islandBook(game).tunes.includes(id)
    || elapsed < tune.notes.length * 180 || elapsed > tune.notes.length * 1800
    || notes.length !== tune.notes.length || !tune.notes.every((note, i) => note === notes[i])) return false;
  const tip = game.inventory.add('coins', tune.tip);
  if (tip < tune.tip) game.bank.deposit('coins', tune.tip - tip);
  finish(game, 'music', tune.xp, `The hawker crowd tips you ${tune.tip} coins for ${tune.name}.`);
  return true;
}
