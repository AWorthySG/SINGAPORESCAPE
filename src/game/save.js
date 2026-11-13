import { POTIONS, CROP_BY_ID } from '../data/trades.js';
import { SAVE_KEY } from '../config.js';
import { STATION_BY_ID } from '../data/transport.js';

const VERSION = 1;
// An unreadable save is copied here before a new game replaces it, so a bug or
// a bad version check never destroys someone's progress for good.
export const BACKUP_KEY = SAVE_KEY + '-backup';
// A second slot, so an old backup doesn't stop a newer unreadable save being kept.
const BACKUP_KEYS = [BACKUP_KEY, BACKUP_KEY + '-2'];

// Set once the player deletes their save (or a save half-loaded): the page is
// about to reload, and the leave-the-page save must not write the old game back.
let savesSuppressed = false;
export function suppressSaves(on = true) { savesSuppressed = on; }

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
  return {
    version: VERSION,
    savedAt: Date.now(),
    player: {
      x: dead ? rp.x : game.player.x,
      y: dead ? rp.y : game.player.y,
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
    bounties: game.bounties,
    karma: game.karma,
    attrs: game.attrs,
    clue: game.clue,
    specEnergy: game.specEnergy,
    settings: { running: game.running, autoCfg: game.autoCfg, autoGather: game.autoGather, knowledgeStrikes: game.knowledgeStrikes },
    jobClass: game.jobClass,
    potions: game.potions,
    farms: game.world.objects.filter((o) => o.def.type === 'farm' && o.crop).map((o) => ({ x: o.x, y: o.y, crop: o.crop, left: o.growLeft })),
  };
}

export function saveGame(game) {
  const s = storage();
  if (!s || savesSuppressed) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(snapshot(game)));
    return true;
  } catch (err) {
    // Storage full, or blocked (private browsing, site data turned off).
    console.warn('Save failed:', err);
    return false;
  }
}

/** Keep a copy of a save we could not use (or one an import is replacing), in the first empty backup slot.
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
  if (saveGame(game)) raw = s.getItem(SAVE_KEY);
  // Storage full or blocked: the game in memory can still be carried out.
  else if (!savesSuppressed) raw = JSON.stringify(snapshot(game));
  if (!raw) return null;
  const b64 = toBase64(raw);
  return CODE_PREFIX + b64 + ':' + checksum(b64);
}

/** Replace the stored save with the one in a save code. Returns { ok, error }
 *  and never throws: a bad code leaves the stored save exactly as it was.
 *  The current save is kept in a backup slot first, and on success further
 *  saves are stopped so the old game can't write itself back before the page
 *  reloads into the imported one. */
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
    const s = storage();
    if (!s) return { ok: false, error: 'This browser is not letting the game store anything, so the save cannot be imported.' };
    const raw = JSON.stringify(data);
    const current = s.getItem(SAVE_KEY);
    if (current && current !== raw && !backupBadSave(s, current)) {
      // Both slots taken: replace the newer one, so the oldest kept save (often
      // an unreadable one waiting to be rescued) survives.
      try { s.setItem(BACKUP_KEYS[BACKUP_KEYS.length - 1], current); } catch {
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

  const p = data.player || {};
  if (game.world.inBounds(p.x, p.y) && !game.world.isBlocked(p.x, p.y)) {
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
  if (p.name && p.name !== 'Adventurer') game.player.name = p.name; // migrate old default
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
  if (data.bounties && typeof data.bounties === 'object' && Array.isArray(data.bounties.list)) {
    const b = data.bounties;
    game.bounties = { day: typeof b.day === 'string' ? b.day : null, list: b.list.filter((t) => t && typeof t.id === 'string'),
      streak: Number(b.streak) || 0, lastFull: typeof b.lastFull === 'string' ? b.lastFull : null };
  }
  // Spent stat points (older saves have none).
  if (data.attrs && typeof data.attrs === 'object') {
    for (const k of ['str', 'int', 'dex']) game.attrs[k] = Math.max(0, Math.floor(Number(data.attrs[k]) || 0));
  }
  if (data.karma && typeof data.karma === 'object') {
    game.karma = { good: Number(data.karma.good) || 0, evil: Number(data.karma.evil) || 0 };
  }
  if (data.clue && typeof data.clue === 'object' && Array.isArray(data.clue.spots)) game.clue = data.clue;
  if (typeof data.specEnergy === 'number') game.specEnergy = Math.max(0, Math.min(100, data.specEnergy));
  game.running = data.settings?.running ?? game.running;
  // Job class: older saves pick one on their next visit.
  game.jobClass = typeof data.jobClass === 'string' ? data.jobClass : null;
  game.pendingClassChoice = !game.jobClass && !game.pendingStyleChoice;
  // Herblore boosts still running, and crops still growing in their patches.
  game.potions = {};
  if (data.potions && typeof data.potions === 'object') {
    for (const [id, ms] of Object.entries(data.potions)) if (POTIONS[id] && ms > 0) game.potions[id] = Math.min(ms, POTIONS[id].ms || 0);
  }
  if (Array.isArray(data.farms)) {
    for (const f of data.farms) {
      const o = game.world.objectAt(f.x, f.y);
      if (o && o.def.type === 'farm' && CROP_BY_ID[f.crop]) { o.crop = f.crop; o.growLeft = Math.max(0, Number(f.left) || 0); }
    }
  }
  if (data.settings?.autoGather === true) game.autoGather = true;
  if (data.learning) game.learning.load(data.learning);
  if (data.settings?.knowledgeStrikes === false) game.knowledgeStrikes = false;
  const ac = data.settings?.autoCfg;
  if (ac && typeof ac === 'object') {
    game.autoCfg = {
      eatAt: [0, 0.25, 0.4, 0.6].includes(ac.eatAt) ? ac.eatAt : 0.4,
      target: typeof ac.target === 'string' ? ac.target : null,
      abilities: ac.abilities !== false,
      bosses: ac.bosses !== false,
      champions: ac.champions !== false,
      priority: ac.priority !== false,
    };
  }
}
