// The Monster Codex: everything the game knows about each monster and boss,
// gathered in one place for the codex window (src/ui/codexui.js). Kept free of
// the DOM so the tests can check it headlessly.
//
// A creature is "discovered" once you've defeated one (game.kills, which the
// save already keeps), so the codex needs no saved state of its own. Until
// then it shows only the creature's level and where it lives, in the spirit of
// the old Bestiary, which hid drops until the first kill.
import { ALL_MONSTER_IDS, ALL_BOSS_IDS, getNpc } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { RACES, raceOf, weaponsFor, weaponTypeName } from '../data/races.js';
import { armourTierOf, ARMOUR_TIERS } from './combat.js';
import { SIGNATURE_CLASS, SIGNATURE_DROP_CHANCE, sigIdFor } from '../data/bossWeapons.js';
import { CLASS_BY_ID } from '../data/classes.js';
import { CHAMPION_HP_MULT } from './npc.js';
import { NORMAL_GEAR_SKIP } from './loot.js';
import { chebyshev } from '../core/utils.js';

/** Every attackable monster and boss, bosses first, each once. */
export const CODEX_IDS = [...new Set([...ALL_BOSS_IDS, ...ALL_MONSTER_IDS])].filter((id) => getNpc(id).attackable);
const CODEX_SET = new Set(CODEX_IDS);

// Plain-English names for the ground attacks a boss marks in red (the patterns
// listed at the top of bossAbilities.js).
export const HAZARD_TEXT = {
  blast: { name: 'Blast', desc: 'a 3x3 patch under your feet' },
  nova: { name: 'Nova', desc: 'a 5x5 burst all round the boss' },
  line: { name: 'Line', desc: 'a lane from the boss straight through you' },
  cross: { name: 'Cross', desc: 'a plus shape centred on you' },
  ring: { name: 'Ring', desc: 'a ring round the boss (safe right beside it)' },
  meteors: { name: 'Meteors', desc: 'scattered 3x3 impacts' },
  rain: { name: 'Rain', desc: 'many single tiles at once' },
  chase: { name: 'Chase', desc: 'three blasts that follow you' },
  twin: { name: 'Twin', desc: 'two strikes, either side of you' },
  quake: { name: 'Quake', desc: 'a slow 7x7 quake round the boss' },
};

export const TYPE_FILTERS = [
  { id: 'all', name: 'All types' },
  { id: 'normal', name: 'Normal' },
  { id: 'boss', name: 'Boss' },
  { id: 'champion', name: 'Champion-capable' },
];
export const SORTS = [
  { id: 'level', name: 'Level' },
  { id: 'name', name: 'Name' },
  { id: 'kills', name: 'Kills' },
];

export const killsOf = (game, id) => game?.kills?.[id] || 0;
export const isDiscovered = (game, id) => killsOf(game, id) > 0;

/** A normal monster of level 3 or more can turn up as a champion (npc.js
 *  maybeChampion); bosses never do. */
export const championCapable = (def) => !!def.attackable && !def.boss && (def.level || 1) >= 3;

/** Which regions each creature lives in, read from where the world actually
 *  placed them (the open-world regions borrow creatures from all over, so a
 *  def's own `zone` alone would miss most of them). Worked out once per game:
 *  the world's spawns never move. Summons and other temporary spawns are left out. */
export function codexHabitats(game) {
  if (game?._codexHabitat) return game._codexHabitat;
  const hab = new Map();
  for (const n of game?.npcs || []) {
    if (n.temporary || !CODEX_SET.has(n.npcId)) continue;
    const z = game.world?.zoneAt?.(n.spawnX ?? n.x, n.spawnY ?? n.y)?.name;
    if (!z) continue;
    if (!hab.has(n.npcId)) hab.set(n.npcId, new Set());
    hab.get(n.npcId).add(z);
  }
  const out = new Map();
  for (const id of CODEX_IDS) {
    const zs = hab.get(id);
    out.set(id, zs && zs.size ? [...zs].sort() : [getNpc(id).zone].filter(Boolean));
  }
  if (game) game._codexHabitat = out;
  return out;
}

/** Regions that hold at least one creature, in the world's own order. */
export function codexRegions(game) {
  const hab = codexHabitats(game);
  const used = new Set();
  for (const zs of hab.values()) for (const z of zs) used.add(z);
  const order = (game?.world?.zones || []).map((z) => z.name).filter((n) => used.has(n));
  for (const n of [...used].sort()) if (!order.includes(n)) order.push(n);
  return order;
}

/** Discovered / total, overall and for each region. */
export function codexProgress(game) {
  const hab = codexHabitats(game);
  const seen = CODEX_IDS.filter((id) => isDiscovered(game, id)).length;
  const regions = codexRegions(game).map((name) => {
    const ids = CODEX_IDS.filter((id) => hab.get(id).includes(name));
    return { name, total: ids.length, seen: ids.filter((id) => isDiscovered(game, id)).length };
  });
  return { seen, total: CODEX_IDS.length, regions };
}

/** The ids the list shows for the given search, filters and sort. */
export function codexList(game, f = {}) {
  const hab = codexHabitats(game);
  const term = (f.search || '').trim().toLowerCase();
  const lo = Number.isFinite(f.minLevel) ? f.minLevel : 0;
  const hi = Number.isFinite(f.maxLevel) ? f.maxLevel : Infinity;
  const ids = CODEX_IDS.filter((id) => {
    const d = getNpc(id), seen = isDiscovered(game, id);
    // An undiscovered creature's name is still searchable: the list shows it
    // as "???" but players often know what they are looking for.
    if (term && !d.name.toLowerCase().includes(term)) return false;
    if (f.region && f.region !== 'all' && !hab.get(id).includes(f.region)) return false;
    if (d.level < lo || d.level > hi) return false;
    if (f.race && f.race !== 'all' && raceOf(d, id) !== f.race) return false;
    if (f.type === 'boss' && !d.boss) return false;
    if (f.type === 'normal' && d.boss) return false;
    if (f.type === 'champion' && !championCapable(d)) return false;
    if (f.disc === 'seen' && !seen) return false;
    if (f.disc === 'unseen' && seen) return false;
    return true;
  });
  const by = f.sort || 'level';
  const name = (id) => getNpc(id).name;
  ids.sort((a, b) => {
    if (by === 'name') return name(a).localeCompare(name(b));
    if (by === 'kills') return killsOf(game, b) - killsOf(game, a) || getNpc(a).level - getNpc(b).level;
    return getNpc(a).level - getNpc(b).level || name(a).localeCompare(name(b));
  });
  return ids;
}

/** Rough drop chances: one table roll per kill for a monster, ten (never empty)
 *  for a boss, as game.js rolls them. A normal monster's weapons and armour
 *  are mostly rerolled into something else (NORMAL_GEAR_SKIP), so theirs are
 *  shown at the lower rate. Duplicate entries are merged; likeliest first. */
export function dropChances(def) {
  const table = def.dropTable || [];
  const boss = !!def.boss;
  const isGear = (id) => { const e = getItem(id).equip; return !!e && !e.style; };
  const pool = table.filter((e) => !(boss && e.nothing));
  const total = pool.reduce((s, e) => s + (e.weight || 0), 0) || 1;
  const merged = new Map();
  for (const e of pool) {
    if (e.nothing) continue;
    let p = (e.weight || 0) / total;
    if (!boss && isGear(e.id)) p *= 1 - NORMAL_GEAR_SKIP;
    const m = merged.get(e.id) || { id: e.id, p: 0, min: e.min || 1, max: e.max || 1 };
    m.p += p; m.min = Math.min(m.min, e.min || 1); m.max = Math.max(m.max, e.max || 1);
    merged.set(e.id, m);
  }
  const rolls = boss ? 10 : 1;
  const out = [...merged.values()].map((m) => ({ ...m, chance: 1 - Math.pow(1 - Math.min(1, m.p), rolls) }));
  for (const a of def.alwaysDrop || []) out.push({ id: a.id, chance: 1, min: a.min || 1, max: a.max || 1, always: true });
  return out.sort((a, b) => b.chance - a.chance || getItem(a.id).name.localeCompare(getItem(b.id).name));
}

/** "Always", "1 in 12" or "35%": short and easy to compare. */
export function chanceText(c) {
  if (c >= 0.999) return 'Always';
  if (c >= 0.2) return `${Math.round(c * 100)}%`;
  return `1 in ${Math.max(2, Math.round(1 / Math.max(c, 1e-6))).toLocaleString('en-GB')}`;
}

/** Everything the entry page shows about one creature. Drops, matchups and
 *  the boss's signature details are only filled in once it is discovered. */
export function codexEntry(game, id) {
  const d = getNpc(id);
  const kills = killsOf(game, id), seen = kills > 0;
  const rid = raceOf(d, id), race = RACES[rid];
  const tier = armourTierOf(d);
  const scale = d.hpScale || 1;
  const e = {
    id, name: d.name, level: d.level, boss: !!d.boss, kills, discovered: seen,
    zones: codexHabitats(game).get(id) || [],
    race: { id: rid, name: race.name, icon: race.icon, desc: race.desc },
    championCapable: championCapable(d),
  };
  if (!seen) return e;
  Object.assign(e, {
    examine: d.examine || '',
    strongWeapons: weaponsFor(rid).strong.map(weaponTypeName),
    armour: { tier, pct: Math.round(ARMOUR_TIERS[tier] * 100) + (d.boss ? 10 : 0) },
    // The same numbers the game puts on screen: life is already divided by
    // the creature's number scale (hpScaleFor in npcs.js), and so is every
    // hit you land on it; its own attack, Defence and hits on you are not.
    life: d.maxHp, championLife: championCapable(d) ? Math.round(d.maxHp * CHAMPION_HP_MULT) : 0,
    numberScale: scale > 1 ? Math.round(scale * 10) / 10 : 1,
    attack: d.attack, defence: d.defence, maxHit: d.maxHit,
    aggressive: !!d.aggressive,
    drops: dropChances(d),
  });
  const sigCls = SIGNATURE_CLASS[id] && CLASS_BY_ID[SIGNATURE_CLASS[id]];
  if (sigCls) e.signature = { item: sigIdFor(id), className: sigCls.name, classId: sigCls.id, chance: SIGNATURE_DROP_CHANCE };
  if (d.ability) {
    e.ability = { name: d.ability.name, desc: d.ability.desc,
      hazards: (d.ability.hazards || []).map((h) => ({ id: h, ...(HAZARD_TEXT[h] || { name: h, desc: '' }) })) };
  }
  return e;
}

/** The nearest place this creature lives (its nearest world spawn), for the
 *  codex's Go and Show on map buttons; null if it has none. */
export function nearestSpawn(game, id) {
  const p = game?.player;
  if (!p) return null;
  let best = null, bd = Infinity;
  for (const n of game.npcs || []) {
    if (n.npcId !== id || n.temporary) continue;
    const x = n.spawnX ?? n.x, y = n.spawnY ?? n.y;
    const dd = chebyshev(p.x, p.y, x, y);
    if (dd < bd) { bd = dd; best = { x, y, dist: dd }; }
  }
  return best;
}

/** How many codex creatures you've discovered (for the codex achievements). */
export function discoveredCount(game) {
  let n = 0;
  for (const id in game?.kills || {}) if (CODEX_SET.has(id) && game.kills[id] > 0) n++;
  return n;
}
