import { ISLAND_LIFE, LANDINGS, LOOMS, PATTERNS, PHOTO_ASSIGNMENTS, STAGES, TUNES, VOYAGES } from '../data/islandlife.js';
import { TICK_MS } from '../config.js';
import { getItem } from '../data/items.js';
import { DIRECT_PASSAGE_CERTIFICATE, SAILING_PRACTICE } from '../data/sailing.js';
import { encoreNotes, musicBeatQuality, musicChartByKey, musicChartNotes } from '../data/islandmusic.js';
import { pianoScoreById } from '../data/piano.js';
import { TEXTILE_PROJECTS, TEXTILE_SWATCHES } from '../data/textiles.js';
import { OBJECTS } from '../data/objects.js';
import { teleportPlayer, unlockFx } from './skillunlocks.js';
import { restorePhotography } from './photowalk.js';
import { sailingPassage, steerPassage } from './sailing.js';

export const nearIslandSite = (p, site, range = 2) => Math.max(Math.abs(p.x - site.x), Math.abs(p.y - site.y)) <= range;
export const islandSiteTile = (world, site) => world?.authoredTile?.(site) ?? site;
export const atIslandSite = (game, site, range) => nearIslandSite(game.player, islandSiteTile(game.world, site), range);
const WAYFINDING = [
  [260, 52, 'Sailing landing →'], [276, 46, 'Sailing landing →'],
  [55, 93, 'Shell shallows ↙'], [49, 96, 'Shell shallows ←'],
];

// Share the exact sites with the skill panels, so Interact and Go lead to the same places.
export function placeIslandSites(world) {
  for (const site of LOOMS) {
    const { x, y } = islandSiteTile(world, site);
    world.addObject('batik_loom', x, y, { def: { ...OBJECTS.batik_loom, level: site.level } });
  }
  for (const site of STAGES) {
    const { x, y } = islandSiteTile(world, site);
    world.addObject('busker_stage', x, y, { def: { ...OBJECTS.busker_stage, level: site.level } });
  }
  for (const site of Object.values(LANDINGS)) {
    const { x, y } = islandSiteTile(world, site);
    world.addObject('sailing_landing', x, y, { def: { ...OBJECTS.sailing_landing, name: site.name } });
  }
  for (const [sx, sy, sign] of WAYFINDING) {
    const { x, y } = islandSiteTile(world, { x: sx, y: sy });
    if (!world.isBlocked(x, y) && !world.objectAt(x, y)) world.addObject('sign', x, y, { sign });
  }
}

const ids = (raw, table) => table.filter((row) => Array.isArray(raw) && raw.includes(row.id)).map((row) => row.id);
const dailyKeys = new Set([
  ...VOYAGES.filter((v) => v.freight).map((v) => 'freight:' + v.id),
  ...PHOTO_ASSIGNMENTS.map((p) => 'photo:' + p.id),
  ...PATTERNS.map((p) => 'order:' + p.id),
  ...TUNES.map((t) => 'encore:' + t.id),
]);
const validDay = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
const PRACTICE_LIMIT = 128;
const validPractice = (key) => typeof key === 'string' && /^[a-z0-9][a-z0-9:_-]{0,63}$/.test(key);

function restorePractice(raw) {
  return Object.fromEntries(ISLAND_LIFE.map(({ id }) => {
    const saved = Array.isArray(raw?.[id]) ? raw[id] : [];
    return [id, [...new Set(saved.filter(validPractice))].slice(0, PRACTICE_LIMIT)];
  }));
}

export function restoreIslandLife(raw) {
  const projects = ids(raw?.textiles?.projects, TEXTILE_PROJECTS);
  const book = {
    voyages: ids(raw?.voyages, VOYAGES),
    photos: ids(raw?.photos, PHOTO_ASSIGNMENTS),
    photography: restorePhotography(raw?.photography, raw?.photos),
    patterns: ids(raw?.patterns, PATTERNS),
    textiles: { projects, display: projects.includes(raw?.textiles?.display) ? raw.textiles.display : null },
    tunes: ids(raw?.tunes, TUNES),
    performed: ids(raw?.performed, TUNES),
    practice: restorePractice(raw?.practice),
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
  const earned = game.skills.addXp(skill, xp * (1 + (unlockFx(game, skill).activityXp || 0)));
  game.saveSoon = true;
  game.msg(message, 'system');
  return earned;
}

export function islandPractised(game, skill, key) {
  return islandBook(game).practice[skill]?.includes(key) === true;
}

/** A completed practice brief can always award XP, independent of that day's paid contract. */
export function earnIslandPractice(game, skill, key, baseXp, { quality = 0, message = 'Practice complete.' } = {}) {
  const practice = islandBook(game).practice;
  if (!Object.hasOwn(practice, skill) || !validPractice(key) || !Number.isFinite(baseXp) || baseXp <= 0) return { xp: 0, first: false };
  const results = practice[skill];
  const first = !results.includes(key) && results.length < PRACTICE_LIMIT;
  if (first) results.push(key);
  const optional = Number.isFinite(quality) ? 0.25 * Math.max(0, Math.min(1, quality)) : 0;
  const xp = finish(game, skill, baseXp * (1 + (first ? 0.5 : 0) + optional),
    first ? `${message} First clear bonus earned.` : message);
  return { xp, first };
}

/** The market brings the activities together. A player's existing work counts towards the keepsake. */
export function islandMarketDay(game) {
  const book = islandBook(game);
  const stops = [
    { skill: 'textile_arts', task: 'Print a Chilli flower scarf for the market.', done: book.patterns.includes('chilli') },
    { skill: 'music', task: 'Play Kopi Waltz at a hawker stage.', done: book.performed.includes('kopi') },
    { skill: 'photography', task: 'Take the Market colours postcard by the food stall.', done: book.photos.includes('market') },
    { skill: 'sailing', task: 'Chart the return passage from Pulau Ubin to Changi.', done: book.voyages.includes('changi') },
  ];
  return { stops, completed: stops.filter((stop) => stop.done).length, needed: 3 };
}

export function islandReady(game) {
  return game.player.alive && !game.waves?.active && !game.inWilderness?.() && !game.teleports?.cast && !game.teleports?.blocked?.('voyage');
}

export function voyageRequirementsMet(game, voyage) {
  return atIslandSite(game, LANDINGS[voyage.from])
    && game.skills.level('sailing') >= voyage.level
    && (!voyage.requires || islandBook(game).voyages.includes(voyage.requires))
    && (voyage.to !== 'cove' || islandBook(game).voyages.includes('ubin'));
}

export function voyageAvailable(game, voyage) {
  return islandReady(game) && voyageRequirementsMet(game, voyage);
}

function readyFreight(game, voyage) {
  return !!voyage.freight && islandBook(game).voyages.includes(voyage.id) && !islandClaimed(game, 'freight:' + voyage.id);
}

function boardBoat(game) {
  if (game.autoBattle) game.toggleAutoBattle(false);
  if (game.autoQuest) game.toggleAutoQuest(false, 'you set sail.');
  game._autoLife = null;
  game.autoGatherBest = null;
  game.player.stopNow?.();
  game.player.clearAction?.();
}

function landBoat(game, destination) {
  const dock = LANDINGS[destination], { x, y } = islandSiteTile(game.world, dock);
  return teleportPlayer(game, x, y, `You tie up at ${dock.name}.`, { sparkle: false });
}

export function finishVoyage(game, id, choices, { freight = false } = {}) {
  const voyage = VOYAGES.find((row) => row.id === id);
  if (!voyage || !voyageAvailable(game, voyage) || choices.length !== voyage.course.length
    || !voyage.course.every((side, i) => side === choices[i])) return false;
  if (freight && !readyFreight(game, voyage)) return false;
  boardBoat(game);
  if (!landBoat(game, voyage.to)) return false;
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

export function sailingPracticeRequirementsMet(game, practice) {
  return atIslandSite(game, LANDINGS[practice.from])
    && game.skills.level('sailing') >= practice.level
    && (!practice.requires || islandBook(game).voyages.includes(practice.requires));
}

export function directPassageUnlocked(game, voyage) {
  return islandPractised(game, 'sailing', DIRECT_PASSAGE_CERTIFICATE) && islandBook(game).voyages.includes(voyage.id);
}

export function takeChartedPassage(game, id) {
  const voyage = VOYAGES.find((row) => row.id === id);
  if (!voyage || !directPassageUnlocked(game, voyage) || !voyageAvailable(game, voyage)) return false;
  boardBoat(game);
  return landBoat(game, voyage.to);
}

const activePassages = new WeakMap();
const sailingEntry = (id, practice) => (practice ? SAILING_PRACTICE : VOYAGES).find((row) => row.id === id);
function passageAvailable(game, entry, { practice, freight }) {
  if (!entry) return false;
  if (practice) return !freight && islandReady(game) && sailingPracticeRequirementsMet(game, entry);
  return voyageAvailable(game, entry) && (!freight || readyFreight(game, entry));
}

export function beginSailingPassage(game, id, { practice = false, freight = false } = {}) {
  const entry = sailingEntry(id, practice);
  if (!passageAvailable(game, entry, { practice, freight })) return null;
  const serial = game._sailingSerial = (game._sailingSerial || 0) + 1;
  const passage = sailingPassage(entry, game.todayKey(), game.dayPhase(), serial, { practice, freight });
  boardBoat(game);
  activePassages.set(game, passage);
  return passage;
}

/** Re-check boarding restrictions on every leg, and award a successfully finished passage only once. */
export function navigateSailingPassage(game, passage, side) {
  if (!passage || activePassages.get(game) !== passage || passage.finished) return { outcome: 'closed' };
  const entry = sailingEntry(passage.id, passage.practice);
  if (!passageAvailable(game, entry, passage)) {
    activePassages.delete(game);
    return { outcome: 'closed' };
  }
  const outcome = steerPassage(passage, side);
  if (outcome !== 'arrived') return { outcome };
  passage.finished = true;
  activePassages.delete(game);
  if (passage.practice) {
    const quality = Math.max(0, 1 - passage.corrections * 2 / passage.legs.length);
    const { xp, first } = earnIslandPractice(game, 'sailing', entry.id, entry.xp, {
      quality, message: `Pilotage logged at ${LANDINGS[entry.from].name}.`,
    });
    return { outcome: 'trained', xp, first };
  }
  return { outcome: finishVoyage(game, entry.id, entry.course, { freight: passage.freight }) ? 'landed' : 'closed' };
}

export const COVE_FIND = [
  { id: 'line', name: 'Fish the shallows', skill: 'fishing', item: 'raw_anchovy' },
  { id: 'reef', name: 'Dive by the reef', skill: 'diving', item: 'seashell' },
  { id: 'survey', name: 'Survey the beach', skill: 'archaeology', item: 'pottery_shard' },
];

export function exploreCove(game, id) {
  const pick = COVE_FIND.find((row) => row.id === id);
  const book = islandBook(game);
  if (!pick || !islandReady(game) || !atIslandSite(game, LANDINGS.cove) || !book.voyages.includes('cove') || book.cove.includes(id)) return false;
  if (!game.inventory.add(pick.item, 1)) return false;
  book.cove.push(id);
  finish(game, pick.skill, 12, 'You record a new find from the cove.');
  return true;
}

export function recordIslandPhoto(game) {
  if (!game.player.alive || game.waves?.active) return null;
  const book = islandBook(game), phase = game.dayPhase();
  const candidates = PHOTO_ASSIGNMENTS.filter((row) => game.skills.level('photography') >= row.level
    && atIslandSite(game, row, row.range) && (!row.dusk || (phase >= 17 / 24 && phase < 20 / 24)));
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
  return LOOMS.find((site) => atIslandSite(game, site) && game.skills.level('textile_arts') >= site.level);
}

export function textileProjectAvailable(game, project) {
  const workshop = textileWorkshop(game);
  if (!project || !workshop || !islandReady(game) || game.skills.level('textile_arts') < project.level) return false;
  if (project.free) return workshop === LOOMS[0] && !islandBook(game).textiles.projects.includes(project.id);
  return workshop.level >= LOOMS[1].level && game.inventory.count('coins') >= project.coins
    && project.dyes.every(([dye, amount]) => game.inventory.count(dye) >= amount);
}

export function finishTextileProject(game, id, choices) {
  const project = TEXTILE_PROJECTS.find((row) => row.id === id);
  if (!textileProjectAvailable(game, project) || !Array.isArray(choices) || choices.length !== project.steps.length
    || !project.steps.every((step, index) => step.method === choices[index])) return false;
  const textiles = islandBook(game).textiles;
  for (const [dye, amount] of project.dyes) game.inventory.take(dye, amount);
  if (project.coins) game.inventory.take('coins', project.coins);
  if (!textiles.projects.includes(id)) textiles.projects.push(id);
  earnIslandPractice(game, 'textile_arts', 'project:' + id, project.xp, { message: `You finish the ${project.name.toLowerCase()}.` });
  return true;
}

export function displayHomeTextile(game, id) {
  const textiles = islandBook(game).textiles;
  if (!game.home?.owned || (id !== null && !textiles.projects.includes(id))) return false;
  textiles.display = id;
  game.saveSoon = true;
  return true;
}

export function makeIslandPattern(game, id, { order = false, technique } = {}) {
  const pattern = PATTERNS.find((row) => row.id === id);
  const workshop = textileWorkshop(game);
  if (!pattern || !islandReady(game) || !workshop || game.skills.level('textile_arts') < pattern.level) return false;
  if (technique !== undefined && technique !== TEXTILE_SWATCHES[id]?.method) return false;
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
  return STAGES.find((stage) => atIslandSite(game, stage) && game.skills.level('music') >= stage.level);
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

export { encoreNotes };

export function islandMusicAvailable(game, chart) {
  if (!chart || !islandReady(game) || game.skills.level('music') < chart.level) return false;
  const stage = musicStage(game), book = islandBook(game);
  if (!stage) return false;
  if (chart.tunes) return stage.id === chart.stage && chart.tunes.every((id) => book.performed.includes(id));
  const id = chart.tune.id;
  if (!book.tunes.includes(id)) return false;
  return chart.arrangement !== 'encore' || (stage.level >= 3 && book.performed.includes(id) && !islandClaimed(game, 'encore:' + id));
}

const matchesScore = (notes, score) => Array.isArray(notes) && notes.length === score.length && score.every((note, i) => note === notes[i]);

export function pianoLessonAvailable(game, scoreOrId) {
  const score = pianoScoreById(typeof scoreOrId === 'string' ? scoreOrId : scoreOrId?.id);
  return !!(score && islandReady(game) && musicStage(game) && game.skills.level('music') >= score.level);
}

/** A score can be practised at the player's pace, but only the complete melody earns XP. */
export function finishPianoLesson(game, id, notes) {
  const score = pianoScoreById(id);
  if (!pianoLessonAvailable(game, score) || !matchesScore(notes, score.notes.map(({ midi }) => midi))) return null;
  return earnIslandPractice(game, 'music', `piano:${score.id}`, score.xp, { message: `You play ${score.name} on the piano.` });
}

export function performIslandMusic(game, key, notes, { mode = 'guided', timings, elapsed } = {}) {
  const chart = musicChartByKey(key);
  if (!islandMusicAvailable(game, chart) || !['guided', 'beat', 'legacy'].includes(mode)) return null;
  const { tune, arrangement } = chart;
  const encore = arrangement === 'encore';
  const score = musicChartNotes(chart);
  // Earlier callers could submit the old encore score. The stage reprises the tune with an authored ending.
  const legacyEncore = mode === 'legacy' && encore && [...tune.notes].reverse().concat(tune.notes[0], tune.notes[1]);
  if (!matchesScore(notes, score) && (!legacyEncore || !matchesScore(notes, legacyEncore))) return null;
  if (mode === 'legacy' && (!Number.isFinite(elapsed) || elapsed < notes.length * 180 || elapsed > notes.length * 1800)) return null;
  const quality = mode === 'beat' ? musicBeatQuality(chart, timings) : 0;
  const book = islandBook(game), id = tune?.id;
  if (id && !book.performed.includes(id)) book.performed.push(id);
  if (encore) claimIslandActivity(game, 'encore:' + id);
  // The crowd pays at the old minimum performance pace. Guided XP is independent of tips and timings.
  const tick = game.tickCount ?? 0;
  const standardTip = arrangement === 'standard' && (mode === 'legacy' || tick >= (game._islandMusicTipReady ?? 0));
  const tip = encore || standardTip ? islandPayout(game, 'music', tune.tip * (encore ? 3 : 1)) : 0;
  if (standardTip) game._islandMusicTipReady = tick + Math.ceil(score.length * 180 / TICK_MS);
  if (tip) pay(game, tip);
  const message = tip ? `The crowd tips you ${tip} coins for ${chart.name}.` : `You finish ${chart.name}.`;
  const result = earnIslandPractice(game, 'music', key, chart.xp, { quality, message });
  return { ...result, quality, tip };
}

export function finishIslandTune(game, id, notes, elapsed, { encore = false } = {}) {
  return !!performIslandMusic(game, `tune:${id}:${encore ? 'encore' : 'standard'}`, notes, { mode: 'legacy', elapsed });
}
