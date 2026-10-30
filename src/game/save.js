import { POTIONS, CROP_BY_ID } from '../data/trades.js';
import { SAVE_KEY } from '../config.js';
import { STATION_BY_ID } from '../data/transport.js';

const VERSION = 1;

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
  return {
    version: VERSION,
    savedAt: Date.now(),
    player: {
      x: game.player.x,
      y: game.player.y,
      hp: game.player.hp,
      style: game.player.style,
      rangedStyle: game.player.rangedStyle,
      danceStyle: game.player.danceStyle,
      spell: game.player.spell,
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
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(snapshot(game)));
    return true;
  } catch (err) {
    console.warn('Save failed:', err);
    return false;
  }
}

export function loadGame(game) {
  const s = storage();
  if (!s) return false;
  const raw = s.getItem(SAVE_KEY);
  if (!raw) return false;
  let data;
  try { data = JSON.parse(raw); } catch { return false; }
  if (!data || data.version !== VERSION) return false;

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
  game.player.style = p.style || 'accurate';
  game.player.rangedStyle = p.rangedStyle || 'accurate';
  game.player.danceStyle = p.danceStyle || 'flourish';
  game.player.spell = p.spell || 'wind_strike';
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
      priority: ac.priority !== false,
    };
  }
  return true;
}
