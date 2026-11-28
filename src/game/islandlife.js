import { LANDINGS, LOOMS, PATTERNS, PHOTO_ASSIGNMENTS, STAGES, TUNES, VOYAGES } from '../data/islandlife.js';
import { getItem } from '../data/items.js';
import { teleportPlayer, unlockFx } from './skillunlocks.js';

export const nearIslandSite = (p, site, range = 2) => Math.max(Math.abs(p.x - site.x), Math.abs(p.y - site.y)) <= range;
const ids = (raw, table) => table.filter((row) => Array.isArray(raw) && raw.includes(row.id)).map((row) => row.id);
const dailyKeys = new Set([
  ...VOYAGES.filter((v) => v.freight).map((v) => 'freight:' + v.id),
  ...PHOTO_ASSIGNMENTS.map((p) => 'photo:' + p.id),
  ...PATTERNS.map((p) => 'order:' + p.id),
  ...TUNES.map((t) => 'encore:' + t.id),
]);
const validDay = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);

export function restoreIslandLife(raw) {
  const book = {
    voyages: ids(raw?.voyages, VOYAGES),
    photos: ids(raw?.photos, PHOTO_ASSIGNMENTS),
    patterns: ids(raw?.patterns, PATTERNS),
    tunes: ids(raw?.tunes, TUNES),
    performed: ids(raw?.performed, TUNES),
    daily: validDay(raw?.daily?.day) ? {
      day: raw.daily.day,
      claims: [...dailyKeys].filter((key) => Array.isArray(raw.daily.claims) && raw.daily.claims.includes(key)),
    } : null,
    cove: ids(raw?.cove, COVE_FIND),
    scarf: null, display: null,
  };
  if (book.patterns.includes(raw?.scarf)) book.scarf = raw.scarf;
  if (book.photos.includes(raw?.display)) book.display = raw.display;
  return book;
}
export const islandBook = (game) => game.islandLife ??= restoreIslandLife();

export function islandClaimed(game, key) {
  const daily = islandBook(game).daily;
  return daily?.day === game.todayKey() && daily.claims.includes(key);
}

function claimIslandActivity(game, key) {
  const book = islandBook(game), day = game.todayKey();
  if (book.daily?.day !== day) book.daily = { day, claims: [] };
  book.daily.claims.push(key);
}

export const islandPayout = (game, skill, base) => Math.round(base * (1 + (unlockFx(game, skill).contractCoins || 0)));

function pay(game, coins) {
  const packed = game.inventory.add('coins', coins);
  if (packed < coins) game.bank.deposit('coins', coins - packed);
}

function finish(game, skill, xp, message) {
  game.skills.addXp(skill, xp * (1 + (unlockFx(game, skill).activityXp || 0)));
  game.saveSoon = true;
  game.msg(message, 'system');
}

export function islandReady(game) {
  return game.player.alive && !game.waves?.active && !game.inWilderness?.() && !game.teleports?.cast && !game.teleports?.blocked?.('voyage');
}

export function voyageAvailable(game, voyage) {
  return islandReady(game) && nearIslandSite(game.player, LANDINGS[voyage.from])
    && game.skills.level('sailing') >= voyage.level
    && (!voyage.requires || islandBook(game).voyages.includes(voyage.requires))
    && (voyage.to !== 'cove' || islandBook(game).voyages.includes('ubin'));
}

export function finishVoyage(game, id, choices, { freight = false } = {}) {
  const voyage = VOYAGES.find((row) => row.id === id);
  if (!voyage || !voyageAvailable(game, voyage) || choices.length !== voyage.course.length
    || !voyage.course.every((side, i) => side === choices[i])) return false;
  if (freight && (!voyage.freight || !islandBook(game).voyages.includes(id) || islandClaimed(game, 'freight:' + id))) return false;
  if (game.autoBattle) game.toggleAutoBattle(false);
  if (game.autoQuest) game.toggleAutoQuest(false, 'you set sail.');
  game._autoLife = null;
  game.autoGatherBest = null;
  const dest = LANDINGS[voyage.to];
  if (!teleportPlayer(game, dest.x, dest.y, `You tie up at ${dest.name}.`)) return false;
  const book = islandBook(game), first = !book.voyages.includes(id);
  if (first) book.voyages.push(id);
  if (freight) {
    claimIslandActivity(game, 'freight:' + id);
    const coins = islandPayout(game, 'sailing', voyage.freight);
    pay(game, coins);
    finish(game, 'sailing', voyage.xp, `Freight delivered. You earn ${coins} coins.`);
  } else finish(game, 'sailing', first ? voyage.xp : Math.max(3, Math.round(voyage.xp / 4)), first ? 'New route charted.' : 'Passage logged.');
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
  const candidates = PHOTO_ASSIGNMENTS.filter((row) => game.skills.level('photography') >= row.level
    && nearIslandSite(game.player, row, row.range) && (!row.dusk || (phase >= 17 / 24 && phase < 20 / 24)));
  const fresh = candidates.find((row) => !book.photos.includes(row.id));
  if (fresh) {
    book.photos.push(fresh.id);
    claimIslandActivity(game, 'photo:' + fresh.id);
    finish(game, 'photography', fresh.xp, `Album print earned: ${fresh.name}.`);
    return fresh;
  }
  const subject = candidates.find((row) => !islandClaimed(game, 'photo:' + row.id));
  if (!subject || !islandReady(game)) return null;
  const coins = islandPayout(game, 'photography', Math.round(subject.xp * 1.5));
  claimIslandActivity(game, 'photo:' + subject.id);
  pay(game, coins);
  finish(game, 'photography', Math.ceil(subject.xp / 2), `Postcard commission: ${subject.name}. You earn ${coins} coins.`);
  return { ...subject, commission: true, coins };
}

export function textileWorkshop(game) {
  return LOOMS.find((site) => nearIslandSite(game.player, site) && game.skills.level('textile_arts') >= site.level);
}

export function makeIslandPattern(game, id, { order = false } = {}) {
  const pattern = PATTERNS.find((row) => row.id === id);
  const workshop = textileWorkshop(game);
  if (!pattern || !islandReady(game) || !workshop || game.skills.level('textile_arts') < pattern.level) return false;
  const book = islandBook(game);
  const material = order ? 2 : 1, fee = 8 * material;
  if (order && (workshop.level < 8 || !book.patterns.includes(id) || islandClaimed(game, 'order:' + id))) return false;
  if (game.inventory.count(pattern.dye) < material || game.inventory.count('coins') < fee) return false;
  game.inventory.take(pattern.dye, material);
  game.inventory.take('coins', fee);
  if (order) {
    const payout = islandPayout(game, 'textile_arts', Math.round(pattern.xp * 1.5));
    claimIslandActivity(game, 'order:' + id);
    pay(game, payout);
    const reward = pattern.reward;
    if (reward) game.inventory.add(reward, 1);
    finish(game, 'textile_arts', pattern.xp * 2, `You fill the ${pattern.name} order for ${payout} coins${reward ? ` and a ${getItem(reward).name.toLowerCase()}` : ''}.`);
    return true;
  }
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
  const stage = musicStage(game);
  if (!tune || !islandReady(game) || !stage || (tune.stage && tune.stage !== stage.id)
    || game.skills.level('music') < tune.level || book.tunes.includes(id)) return false;
  book.tunes.push(id);
  game.saveSoon = true;
  return true;
}

export const encoreNotes = (tune) => [...tune.notes].reverse().concat(tune.notes[0], tune.notes[1]);

export function finishIslandTune(game, id, notes, elapsed, { encore = false } = {}) {
  const tune = TUNES.find((row) => row.id === id);
  const stage = musicStage(game), book = islandBook(game);
  const score = tune && (encore ? encoreNotes(tune) : tune.notes);
  if (!tune || !islandReady(game) || !stage || !book.tunes.includes(id)
    || elapsed < score.length * 180 || elapsed > score.length * 1800
    || notes.length !== score.length || !score.every((note, i) => note === notes[i])) return false;
  if (encore && (stage.level < 3 || !book.performed.includes(id) || islandClaimed(game, 'encore:' + id))) return false;
  if (!book.performed.includes(id)) book.performed.push(id);
  if (encore) claimIslandActivity(game, 'encore:' + id);
  const tip = islandPayout(game, 'music', tune.tip * (encore ? 3 : 1));
  pay(game, tip);
  finish(game, 'music', tune.xp * (encore ? 2 : 1), `The crowd tips you ${tip} coins for ${tune.name}${encore ? ' (encore)' : ''}.`);
  return true;
}
