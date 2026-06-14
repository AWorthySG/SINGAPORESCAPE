import { SAVE_KEY } from '../config.js';

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
      spell: game.player.spell,
      autoRetaliate: game.player.autoRetaliate,
      name: game.player.name,
    },
    skills: game.skills.serialize(),
    inventory: game.inventory.serialize(),
    equipment: game.equipment.serialize(),
    bank: game.bank.serialize(),
    quests: game.quests,
    settings: { running: game.running },
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
    ? Math.max(0, Math.min(p.hp, game.skills.hitpoints))
    : game.skills.hitpoints;
  if (game.player.hp <= 0) game.player.hp = game.skills.hitpoints;
  game.player.style = p.style || 'accurate';
  game.player.rangedStyle = p.rangedStyle || 'accurate';
  game.player.spell = p.spell || 'wind_strike';
  game.player.autoRetaliate = p.autoRetaliate !== false;
  if (p.name) game.player.name = p.name;
  if (data.quests && typeof data.quests === 'object') {
    for (const k of Object.keys(game.quests)) {
      const v = data.quests[k];
      if (v && typeof v === 'object') game.quests[k] = { ...game.quests[k], ...v };
    }
  }
  game.running = data.settings?.running ?? game.running;
  return true;
}
