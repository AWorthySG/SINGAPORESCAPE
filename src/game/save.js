import { POTIONS, CROP_BY_ID } from '../data/trades.js';
import { SAVE_KEY } from '../config.js';
import { STATION_BY_ID } from '../data/transport.js';
import { inArena, GATE_MODS } from './waves.js';
import { assignLegacyQuality } from './quality.js';
import { loadCulling } from './culling.js';
import { serializePlay, loadPlay } from './playbalance.js';
import { ensureHunterSnare } from './onboarding.js';
import { serializeLiving, loadLiving } from './living.js';
import { serializeKeep, loadKeep } from './bankkeep.js';
import { trimBlessings, starterBlessings } from './blessings.js';

const VERSION = 1;
// An unreadable save is copied here before a new game replaces it, so a bug or
// a bad version check never destroys someone's progress for good.
export const BACKUP_KEY = SAVE_KEY + '-backup';
// A second slot, so an old backup doesn't stop a newer unreadable save being kept.
const BACKUP_KEYS = [BACKUP_KEY, BACKUP_KEY + '-2'];
// The save an import replaced, in a key of its own so imports never use up (or
// overwrite) the slots kept for unreadable saves. Each import replaces it.
export const IMPORT_BACKUP_KEY = SAVE_KEY + '-before-import';

// Set once the player deletes their save (or a save half-loaded): the page is
// about to reload, and the leave-the-page save must not write the old game back.
let savesSuppressed = false;
export function suppressSaves(on = true) { savesSuppressed = on; }
export function savesAreSuppressed() { return savesSuppressed; }

function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function hasSave() {
  return !!storage()?.getItem(SAVE_KEY);
}

export function clearSave() {
  storage()?.removeItem(SAVE_KEY);
}

export function snapshot(game) {
  // Saved while dead (closing the tab during the respawn wait): store the
  // respawn spot and full health, so reloading can't skip the trip back to town.
  const dead = !game.player.alive;
  const rp = game.world.respawnPoint;
  // Saved mid-run in the Endless Gate: the run isn't kept, so store the way back out.
  const at = game.waves?.active && game.waves.ret ? game.waves.ret : game.player;
  return {
    version: VERSION,
    savedAt: Date.now(),
    player: {
      x: dead ? rp.x : at.x,
      y: dead ? rp.y : at.y,
      hp: dead ? game.maxHp() : game.player.hp,
      style: game.player.style,
      rangedStyle: game.player.rangedStyle,
      danceStyle: game.player.danceStyle,
      spell: game.player.spell,
      spellAuto: !!game.player.spellAuto,
      autoRetaliate: game.player.autoRetaliate,
      name: game.player.name,
    },
    skills: game.skills.serialize(),
    inventory: game.inventory.serialize(),
    equipment: game.equipment.serialize(),
    bank: game.bank.serialize(),
    quests: game.quests,
    achievements: [...game.achievements],
    totalKills: game.totalKills,
    bossKills: game.bossKills,
    zonesVisited: [...game.zonesVisited],
    stationsFound: [...game.stationsFound],
    learning: game.learning.serialize(),
    kills: game.kills,
    slayer: game.slayer,
    shrine: game.shrine.serialize(),
    bounties: game.bounties,
    culling: game.culling,
    karma: game.karma,
    moral: game.moral,
    living: serializeLiving(game),   // region reputation and remembered deeds (living.js)
    attrs: game.attrs,
    clue: game.clue,
    specEnergy: game.specEnergy,
    blessings: [...game.activePrayers],   // the equipped Blessings (blessings.js)
    prayerPoints: Math.round(game.prayerPoints * 100) / 100,   // Faith
    bossRecord: game.bossRecord,
    waveBest: game.waves?.best || 0,
    play: serializePlay(game),   // Focus, rested pool and gravestone (playbalance.js)
    waveBestByClass: game.waves?.bestByClass || {},
    waveMods: [...(game.waves?.mods || [])],
    collection: game.collection?.serialize(),
    pets: game.pets?.serialize(),
    gathering: game.gathering?.serialize(),   // daily skilling contracts (gathering.js)
    worldEvents: game.worldEvents?.serialize(),
    story: game.story?.serialize(),   // story chapters, lore pages, lore guardians (story.js)
    discovery: game.discovery?.serialize(),   // encyclopedia discoveries (discovery.js)
    bowQuiverGiven: !!game.bowQuiverGiven,   // the one-off quiver for bows from before quivers (game._giveBowQuiver)
    gunRoundsGiven: !!game.gunRoundsGiven,   // the one-off rounds for guns from before the ammo slot (rounds.js)
    playMs: Math.floor(game.playMs || 0),   // time played, shown when choosing between a cloud and a device save
    settings: { running: game.running, autoCfg: game.autoCfg, autoGather: game.autoGather, gatherPicks: [...(game.gatherPicks || [])], knowledgeStrikes: game.knowledgeStrikes, minimalHud: !!game.minimalHud,
      worldLabels: game.worldLabels || 'smart', tips: game.tipsOn !== false, tipsSeen: [...(game.tipsSeen || [])],
      colourBlind: !!game.colourBlind, reduceMotion: !!game.reduceMotion, xpDisplay: game.xpDisplay || 'combined' },
    jobClass: game.jobClass,
    potions: game.potions,
    farms: game.world.objects.filter((o) => o.def.type === 'farm' && o.crop).map((o) => ({ x: o.x, y: o.y, crop: o.crop, left: o.growLeft })),
    home: game.home?.serialize(),   // the kampong home (home.js)
    snareGiven: !!game.snareGiven,  // the one-off Hunter snare for older saves (onboarding.js)
    bankKeep: serializeKeep(game),  // what the bank's Deposit loot leaves in the pack (bankkeep.js)
  };
}

/** true when saved, false when storage failed (full or blocked), and null when
 *  saving is paused on purpose (the page is about to reload), which is not a
 *  failure to warn the player about. */
export function saveGame(game) {
  if (savesSuppressed) return null;
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(snapshot(game)));
    return true;
  } catch (err) {
    // Storage full, or blocked (private browsing, site data turned off).
    console.warn('Save failed:', err);
    return false;
  }
}

/** Keep a copy of a save we could not use, in the first empty backup slot.
 *  A copy already kept is never overwritten with yet another unusable save. */
function backupBadSave(s, raw) {
  try {
    const key = BACKUP_KEYS.find((k) => !s.getItem(k));
    if (!key) return false;
    s.setItem(key, raw);
    return true;
  } catch { return false; }
}

// ---------------- Save transfer ----------------
// Saves live in localStorage, which belongs to one web address in one browser.
// To move a character (to the game's new address, another browser or another
// device) the player copies a save code out and pastes it in on the other side.
// The code is one line: a prefix that says what it is, the save JSON as UTF-8
// safe base64, and a checksum so a code cut short or edited while pasting is
// caught before it replaces anything.
const CODE_PREFIX = 'AWA1:';
const NAME_MAX = 24;   // longest player name a save (or a shared code) may set

/** FNV-1a: a tiny 32-bit hash, plenty to catch a truncated or mistyped paste. */
function checksum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// btoa/atob only take Latin-1, and a player's name can hold any character,
// so the JSON goes through UTF-8 bytes first.
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** The current game as a save code, or null if there is nothing to export yet
 *  (a brand-new player who has not picked a class). Saves first, so the code
 *  matches where the player is standing now. */
export function exportSaveCode(game) {
  // Before a class is picked nothing is saved (see the autosave in game.js).
  if (game.pendingStyleChoice) return null;
  const s = storage();
  let raw = null;
  const saved = saveGame(game);
  if (saved) raw = s.getItem(SAVE_KEY);
  // Saving paused (an import is waiting for the reload): the stored save is the
  // one to carry out, not a game in memory that may be about to be replaced.
  else if (saved === null) raw = s?.getItem(SAVE_KEY) ?? null;
  // Storage full or blocked: the game in memory can still be carried out.
  else raw = JSON.stringify(snapshot(game));
  if (!raw) return null;
  const b64 = toBase64(raw);
  return CODE_PREFIX + b64 + ':' + checksum(b64);
}

/** The save stored in this browser as a save code, without loading a game,
 *  or null if there is none. Used to carry a player's save to the game's new address. */
export function storedSaveCode() {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    return raw ? saveCodeFromRaw(raw) : null;
  } catch { return null; }
}

/** A save's JSON text as a save code (cloud.js hands a cloud save to importSaveCode this way). */
export function saveCodeFromRaw(raw) {
  const b64 = toBase64(raw);
  return CODE_PREFIX + b64 + ':' + checksum(b64);
}

/** Replace the stored save with the one in a save code. Returns { ok, error }
 *  and never throws: a bad code leaves the stored save exactly as it was.
 *  The current save is kept under IMPORT_BACKUP_KEY first, and on success
 *  further saves are stopped so the old game can't write itself back before
 *  the page reloads into the imported one. */
export function importSaveCode(code) {
  try {
    // Pasting can wrap a long line or add spaces: none belong in a code.
    const text = String(code ?? '').replace(/\s+/g, '');
    if (!text) return { ok: false, error: 'Paste a save code first.' };
    if (!text.startsWith(CODE_PREFIX)) return { ok: false, error: `That is not an A-Worthy Adventure save code. A save code starts with ${CODE_PREFIX}` };
    const body = text.slice(CODE_PREFIX.length);
    const cut = body.lastIndexOf(':');
    const b64 = cut > 0 ? body.slice(0, cut) : '';
    if (!b64 || checksum(b64) !== body.slice(cut + 1).toLowerCase()) {
      return { ok: false, error: 'This save code is incomplete or has been changed. Copy the whole code again and paste all of it.' };
    }
    let data;
    try { data = JSON.parse(fromBase64(b64)); } catch { data = null; }
    if (!data || typeof data !== 'object') return { ok: false, error: 'This save code could not be read.' };
    // Same rule as loadGame: a save from another version would be thrown away on load.
    if (data.version !== VERSION) return { ok: false, error: 'This save is from a different version of the game and cannot be loaded here.' };
    const p = data.player;
    if (!p || typeof p !== 'object' || typeof p.x !== 'number' || typeof p.y !== 'number' ||
        !data.skills || typeof data.skills !== 'object' || !data.inventory || typeof data.inventory !== 'object') {
      return { ok: false, error: 'This save code does not hold a complete save.' };
    }
    // Codes get shared between players, and the name ends up on screen: keep it
    // a short string (the UI escapes it too).
    if (p.name !== undefined) p.name = typeof p.name === 'string' ? p.name.slice(0, NAME_MAX) : undefined;
    const s = storage();
    if (!s) return { ok: false, error: 'This browser is not letting the game store anything, so the save cannot be imported.' };
    // Marks the save as freshly imported, so another open tab of the game can
    // tell (see watchForImports). Saving again drops it, as snapshot() leaves it out.
    data.importedAt = Date.now();
    const raw = JSON.stringify(data);
    const current = s.getItem(SAVE_KEY);
    // A save imported but never played since (importing twice, say) is only a
    // copy of a code: keep the backup of the character it replaced instead.
    if (current && !importedUnplayed(current)) {
      try { s.setItem(IMPORT_BACKUP_KEY, current); } catch {
        return { ok: false, error: 'Could not keep a backup of your current save, so nothing was changed.' };
      }
    }
    s.setItem(SAVE_KEY, raw);
    suppressSaves();
    return { ok: true };
  } catch (err) {
    console.warn('Import failed:', err);
    return { ok: false, error: 'Could not import: this browser\'s storage is full or blocked.' };
  }
}

function importedUnplayed(raw) {
  if (!raw.includes('"importedAt"')) return false;
  try { return !!JSON.parse(raw).importedAt; } catch { return false; }
}

/** Another tab of the game imported a save: call onImport so this tab stops
 *  saving (its old game would otherwise autosave over the import) and asks the
 *  player to reload. Ordinary saves from another tab are left alone. */
export function watchForImports(onImport) {
  if (typeof window === 'undefined' || !window.addEventListener) return;
  window.addEventListener('storage', (e) => {
    if (e.key !== SAVE_KEY || !e.newValue || !importedUnplayed(e.newValue)) return;
    suppressSaves();
    onImport();
  });
}

export function loadGame(game) {
  const s = storage();
  if (!s) return false;
  const raw = s.getItem(SAVE_KEY);
  if (!raw) return false;
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (!data || typeof data !== 'object' || data.version !== VERSION) {
    game.saveBackedUp = backupBadSave(s, raw);   // false: both slots full, the player is told
    return false;
  }
  try {
    loadFields(game, data);
  } catch (err) {
    // Right version but bad data: keep a copy, and stop the half-loaded game
    // saving over the original before the error reaches the player.
    backupBadSave(s, raw);
    suppressSaves();
    throw err;
  }
  return true;
}

function loadFields(game, data) {
  game.skills.load(data.skills);
  game.inventory.load(data.inventory);
  game.equipment.load(data.equipment);
  game.bank.load(data.bank);
  assignLegacyQuality(game);   // old saves' per-item quality tally goes onto the copies you own

  const p = data.player || {};
  // (Never into the Endless Gate's arena: a run isn't saved, and there's no walking out.)
  if (game.world.inBounds(p.x, p.y) && !game.world.isBlocked(p.x, p.y) && !inArena(p.x, p.y)) {
    game.player.x = game.player.tx = p.x;
    game.player.y = game.player.ty = p.y;
  }
  game.player.hp = typeof p.hp === 'number'
    ? Math.max(0, Math.min(p.hp, game.maxHp()))
    : game.maxHp();
  if (game.player.hp <= 0) game.player.hp = game.maxHp();
  // Combat stances were removed: saved style ids are ignored.
  game.player.style = 'balanced';
  game.player.rangedStyle = 'balanced';
  game.player.danceStyle = 'balanced';
  game.player.spell = p.spell || 'wind_strike';
  game.player.spellAuto = p.spellAuto === true;   // optional: older saves keep the chosen element
  game.player.autoRetaliate = p.autoRetaliate !== false;
  if (typeof p.name === 'string' && p.name && p.name !== 'Adventurer') game.player.name = p.name.slice(0, NAME_MAX); // migrate old default
  if (data.quests && typeof data.quests === 'object') {
    for (const k of Object.keys(game.quests)) {
      const v = data.quests[k];
      if (v && typeof v === 'object') game.quests[k] = { ...game.quests[k], ...v };
    }
  }
  if (Array.isArray(data.achievements)) game.achievements = new Set(data.achievements);
  if (typeof data.totalKills === 'number') game.totalKills = data.totalKills;
  if (typeof data.bossKills === 'number') game.bossKills = data.bossKills;
  if (Array.isArray(data.zonesVisited)) game.zonesVisited = new Set(data.zonesVisited);
  if (Array.isArray(data.stationsFound)) game.stationsFound = new Set(['kampong_glam', ...data.stationsFound.filter((id) => STATION_BY_ID[id])]);
  if (data.kills && typeof data.kills === 'object') game.kills = { ...data.kills };
  if (data.slayer && typeof data.slayer === 'object') {
    game.slayer = {
      task: data.slayer.task && typeof data.slayer.task === 'object' ? data.slayer.task : null,
      points: Number(data.slayer.points) || 0,
      completed: Number(data.slayer.completed) || 0,
    };
  }
  // Offering Shrine points and blessings (older saves have none).
  game.shrine.load(data.shrine);
  if (data.bounties && typeof data.bounties === 'object' && Array.isArray(data.bounties.list)) {
    const b = data.bounties;
    game.bounties = { day: typeof b.day === 'string' ? b.day : null, list: b.list.filter((t) => t && typeof t.id === 'string'),
      streak: Number(b.streak) || 0, lastFull: typeof b.lastFull === 'string' ? b.lastFull : null };
  }
  // Codex mastery extras, Pest Control contracts and Stewardship (older saves have none).
  game.culling = loadCulling(data.culling);
  // Spent stat points (older saves have none).
  if (data.attrs && typeof data.attrs === 'object') {
    for (const k of ['str', 'int', 'dex']) game.attrs[k] = Math.max(0, Math.floor(Number(data.attrs[k]) || 0));
  }
  if (data.karma && typeof data.karma === 'object') {
    game.karma = { good: Number(data.karma.good) || 0, evil: Number(data.karma.evil) || 0 };
  }
  // Moral choice encounters answered, aggressive kills towards the next good
  // point, and the Paragon's last gift day (older saves have none of these).
  { const m = data.moral && typeof data.moral === 'object' ? data.moral : {}, choices = {};
    if (m.choices && typeof m.choices === 'object') for (const [id, side] of Object.entries(m.choices)) if (side === 'good' || side === 'evil') choices[id] = side;
    game.moral = { choices, heroKills: Math.max(0, Math.floor(Number(m.heroKills) || 0)), giftDay: typeof m.giftDay === 'string' ? m.giftDay : null }; }
  loadLiving(game, data.living);   // region reputation and remembered deeds (older saves have none)
  if (data.clue && typeof data.clue === 'object' && Array.isArray(data.clue.spots)) game.clue = data.clue;
  if (typeof data.specEnergy === 'number') game.specEnergy = Math.max(0, Math.min(100, data.specEnergy));
  // Blessings and Faith (blessings.js). Older saves have neither: the old toggled
  // prayers were never saved (an `activePrayers` list is still taken if present),
  // so they start with nothing equipped and a full bar, as they used to reload.
  // The loadout is trimmed to the Prayer level's slots and conflict groups.
  { const list = Array.isArray(data.blessings) ? data.blessings : Array.isArray(data.activePrayers) ? data.activePrayers : [];
    game.activePrayers = new Set(trimBlessings(game.skills.prayer, list.filter((id) => typeof id === 'string')));
    // A save from before the rework has no loadout: start it with the best blessings
    // for its fighting style, so nobody loses their prayer bonuses in the change.
    if (!Array.isArray(data.blessings) && !game.activePrayers.size) game.activePrayers = new Set(starterBlessings(game.skills.prayer, game.combatMode?.() || 'melee'));
    game.prayerPoints = typeof data.prayerPoints === 'number' && data.prayerPoints >= 0 ? Math.min(data.prayerPoints, game.maxPrayer()) : game.maxPrayer(); }
  game.running = data.settings?.running ?? game.running;
  // Job class: older saves pick one on their next visit.
  game.jobClass = typeof data.jobClass === 'string' ? data.jobClass : null;
  game.pendingClassChoice = !game.jobClass && !game.pendingStyleChoice;
  // Herblore boosts still running, and crops still growing in their patches.
  game.potions = {};
  if (data.potions && typeof data.potions === 'object') {
    for (const [id, ms] of Object.entries(data.potions)) if (POTIONS[id] && ms > 0) game.potions[id] = Math.min(ms, POTIONS[id].ms || 0);
  }
  // The kampong home goes up before the crops are put back: some of them grow in its patches.
  game.home?.load(data.home);
  if (Array.isArray(data.farms)) {
    for (const f of data.farms) {
      const o = game.world.objectAt(f.x, f.y);
      if (o && o.def.type === 'farm' && CROP_BY_ID[f.crop]) { o.crop = f.crop; o.growLeft = Math.max(0, Number(f.left) || 0); }
    }
  }
  if (data.settings?.autoGather === true) game.autoGather = true;
  // What auto battle learned about bosses (beaten / lost to at a fight level); older saves have none.
  {
    const br = data.bossRecord, ok = (o) => o && typeof o === 'object' && !Array.isArray(o);
    game.bossRecord = { beat: {}, lost: {} };
    if (ok(br?.beat)) for (const [k, v] of Object.entries(br.beat)) if (v === true) game.bossRecord.beat[k] = true;
    if (ok(br?.lost)) for (const [k, v] of Object.entries(br.lost)) if (typeof v === 'number' && v > 0) game.bossRecord.lost[k] = Math.floor(v);
  }
  // Focus, Rested XP and the gravestone; older saves start with a full bar. Time since the save counts as time away.
  loadPlay(game, data.play, data.savedAt);
  // The Endless Gate: your best wave (older saves: none yet).
  // Time played (older saves: not counted yet).
  game.playMs = typeof data.playMs === 'number' && data.playMs > 0 ? data.playMs : 0;
  game.bowQuiverGiven = data.bowQuiverGiven === true;
  game.gunRoundsGiven = data.gunRoundsGiven === true;   // older saves: not yet (start() hands gun users some rounds)
  if (game.waves) game.waves.best = typeof data.waveBest === 'number' && data.waveBest > 0 ? Math.floor(data.waveBest) : 0;
  // ...and per class, and the modifiers last picked (older saves: none).
  if (game.waves) {
    game.waves.bestByClass = {};
    const bc = data.waveBestByClass;
    if (bc && typeof bc === 'object') for (const [k, v] of Object.entries(bc)) if (typeof v === 'number' && v > 0) game.waves.bestByClass[k] = Math.floor(v);
    game.waves.mods = new Set(Array.isArray(data.waveMods) ? data.waveMods.filter((id) => GATE_MODS[id]) : []);
  }
  // The Collection log and pets (older saves: empty).
  game.collection?.load(data.collection);
  game.pets?.load(data.pets);
  game.gathering?.load(data.gathering);   // skilling contracts (older saves: none yet)
  // World events' schedule and the weekly region challenge (older saves: none yet).
  game.worldEvents?.load(data.worldEvents);
  game.story?.load(data.story);   // the main story and lore pages (older saves: caught up from their quests)
  game.discovery?.load(data.discovery);   // encyclopedia discoveries (older saves: from the bag, bank and Collection log)
  if (Array.isArray(data.settings?.gatherPicks)) game.gatherPicks = new Set(data.settings.gatherPicks.filter((id) => typeof id === 'string'));
  if (data.learning) game.learning.load(data.learning);
  if (data.settings?.knowledgeStrikes === false) game.knowledgeStrikes = false;
  game.minimalHud = data.settings?.minimalHud === true;   // Settings > Minimal HUD (older saves: off)
  // Settings > World labels and Tips, and the tips this save has seen. Older
  // saves have none: labels go Smart, tips stay on, and the tips this device
  // already dismissed are carried over once by the UI (tipsFromDevice).
  game.worldLabels = ['smart', 'all', 'off'].includes(data.settings?.worldLabels) ? data.settings.worldLabels : 'smart';
  game.tipsOn = data.settings?.tips !== false;
  // Settings > Accessibility (older saves: normal text, standard colours, full motion).
  // (A saved textSize from the old Text size setting is ignored: the setting is gone.)
  game.colourBlind = data.settings?.colourBlind === true;
  game.reduceMotion = data.settings?.reduceMotion === true;
  // Settings > XP display (xpdisplay.js); older saves: Combined.
  game.xpDisplay = ['combined', 'skill', 'off'].includes(data.settings?.xpDisplay) ? data.settings.xpDisplay : 'combined';
  if (Array.isArray(data.settings?.tipsSeen)) {
    game.tipsSeen = new Set(data.settings.tipsSeen.filter((id) => typeof id === 'string'));
    game.tipsFromDevice = false;
  } else { game.tipsSeen = new Set(); game.tipsFromDevice = true; }
  const ac = data.settings?.autoCfg;
  if (ac && typeof ac === 'object') {
    game.autoCfg = {
      eatAt: [0, 0.25, 0.4, 0.6].includes(ac.eatAt) ? ac.eatAt : 0.4,
      target: typeof ac.target === 'string' ? ac.target : null,
      abilities: ac.abilities !== false,
      bosses: ac.bosses !== false,
      champions: ac.champions !== false,
      priority: ac.priority === 'only' ? 'only' : ac.priority !== false,   // true: champions & bosses first; 'only'; false: nearest
      dodge: ac.dodge !== false,   // older saves: auto dodge stays on
    };
  }
  // Hunter onboarding: a snare for characters that never got one, once per save.
  game.snareGiven = data.snareGiven === true;
  ensureHunterSnare(game);
  loadKeep(game, data.bankKeep);   // older saves: an empty keep list
}
