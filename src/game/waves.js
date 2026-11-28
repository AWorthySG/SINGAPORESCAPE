// The Endless Gate: a sealed dungeon arena where monsters come in endless,
// ever-stronger waves. You step through a gate in Kampong Glam and defend the
// A-Worthy Shrine at the hall's heart: the monsters come for it from the edges
// of the hall, and the run ends when it falls (or when you choose to leave).
// Falling yourself only costs you a few seconds: you rise again beside it.
// You come out where you went in, keeping everything.
//
// The arena is not a separate map: rows are added below the 540x380 world
// (`addArena`), ringed by walls and open sea, so nothing can walk in or out.
// Appending rows keeps every existing tile index where it was, and the seeded
// world is built first and left untouched, so no tree, rock or monster moves.

import { NPC, CHAMPION_HP_MULT } from './npc.js';
import { getNpc, ALL_MONSTER_IDS, ALL_BOSS_IDS } from '../data/npcs.js';
import { TERRAIN } from '../data/world.js';
import { chebyshev, weightedPick, randInt } from '../core/utils.js';
import { findPath } from '../engine/pathfinding.js';
import { TILE } from '../config.js';
import { getItem } from '../data/items.js';

export const GATE_NAME = 'The Endless Gate';
// Rows of open sea added below the map; the arena floats in them, far enough
// down (14+ tiles of water) that no camera on the mainland ever shows it.
export const ARENA_ROWS = 40;
// The arena floor (inclusive), a walled 25 x 17 hall: wide enough to dodge a
// boss's markers, small enough to fit a phone screen or two.
export const ARENA = { x0: 240, y0: 394, x1: 264, y1: 410 };
const MID = { x: (ARENA.x0 + ARENA.x1) / 2, y: (ARENA.y0 + ARENA.y1) / 2 };
// The gate stands in the north-east corner of Kampong Glam's plaza (a free
// stone tile, off the paths), and the way out is in the arena's north wall.
export const GATE = { x: 66, y: 48 };
export const EXIT = { x: 252, y: ARENA.y0 };
export const START = { x: 252, y: ARENA.y0 + 2 };
// The A-Worthy Shrine stands in the middle of the hall (addArena puts it there),
// and the monsters come in from the gaps along its west, south and east sides,
// away from the way in, so you have a moment to reach the shrine first.
export const SHRINE = { x: Math.round(MID.x), y: Math.round(MID.y) };
export const SPAWN_POINTS = [
  { x: ARENA.x0, y: ARENA.y0 + 3 }, { x: ARENA.x0, y: ARENA.y1 - 3 }, { x: Math.round(MID.x), y: ARENA.y1 },
  { x: ARENA.x1, y: ARENA.y1 - 3 }, { x: ARENA.x1, y: ARENA.y0 + 3 },
];

// Pacing and limits.
// The owner asked for no long waits: the first wave comes on the tick after you
// step in, and the next one about 2s after a wave falls (it was 3.6s each).
export const NEXT_WAVE_TICKS = 3;   // ~1.8s between the last kill and the next wave
export const FIRST_WAVE_TICKS = 1;  // ...and from stepping in to the first wave
// The owner asked for a champion or a boss in every wave: every wave is led by
// a champion, and every 5th by a boss instead.
export const CHAMPION_EVERY = 1;    // every wave brings a champion...
export const BOSS_EVERY = 5;        // ...and every 5th wave a boss instead
export const MILESTONE_EVERY = 10;  // every 10th wave's chest is a bigger one
// The owner asked for the gate to pay more: +50% combat XP inside a run, and
// wave bonuses and boss chests pay double coins and half as many stones and scrolls again.
export const GATE_XP = 1.5;
const more = (n) => Math.ceil(n * 1.5);
// A wave boss is a boss scaled to the wave the way _scaleBoss scales bosses to
// you (f x its hits and defence), but its life is set from the wave's own
// monsters: WAVE_BOSS_LIFE of them. Its own life (f^2 x a boss's) made a wave
// 10 boss a 20-minute siege for a level 30 Archer, and it would move with every
// change to boss life out in the world.
export const WAVE_BOSS_LIFE = 10;
// ...and it hits a little softer than the same boss outside: it comes every 5th
// wave now, with its mechanics and an escort, and at full strength it stopped
// every level 150 melee build at wave 5 (see tools/balance/gate.mjs).
export const WAVE_BOSS_HIT = 0.8;
// Gate monsters are tougher than the same monster at the same level outside:
// the owner wanted the gate to be a real test. Before this a level-matched
// fighter cleared every ordinary wave at full life (they barely hit it), and
// only the champion every 5th wave could kill it.
export const GATE_HP = 1.5;    // x life
export const GATE_HIT = 1.8;   // x max hit
export const GATE_ACC = 1.3;   // x attack (they land more of those hits)
// A champion is x30 life out in the world (npc.js); in the gate, where one leads
// every wave, it has GATE_CHAMPION_LIFE of that (x6 a wave monster), so a wave
// stays a minute or so rather than a long siege. Its harder hits, armour and loot are kept.
export const GATE_CHAMPION_LIFE = 0.2;
// From wave 20 a second champion comes along, and from wave 50 a third.
export const SECOND_CHAMPION_FROM = 20;
export const THIRD_CHAMPION_FROM = 50;
// The owner asked for dodging in the gate to pay real Agility XP: a gate boss's
// life is only WAVE_BOSS_LIFE monsters', so its dodges paid a trickle next to a
// course. Dodging a gate monster's blow or a gate boss's marker pays
// 1 + GATE_DODGE_PER_WAVE x the wave number times the usual dodge XP, up to
// GATE_DODGE_MAX (from wave 14). The cap stops it compounding past that: a deep
// wave's monsters hit far harder, and dodge XP already grows with their max hit.
// A wave 10 boss's markers then pay about what a course at your Agility level
// does while you dodge them (most kitted-out runs end near wave 10), a wave 5
// boss's about half that, and deeper bosses more.
export const GATE_DODGE_PER_WAVE = 0.8;
export const GATE_DODGE_MAX = 12;
/** The Agility XP multiplier for dodging in wave n. */
export const gateDodgeMult = (n) => Math.min(GATE_DODGE_MAX, 1 + GATE_DODGE_PER_WAVE * Math.max(0, n));
// The base dodge XP grows with the monster's life and max hit, which keep
// climbing with the wave, so with waves that never end it ran away (about 25
// million a dodge at wave 500 for a level 60 fighter). Past DODGE_CAP_WAVE a
// dodge pays at most what the same monster would at that wave (see dodgeRef).
export const DODGE_CAP_WAVE = 20;
// Waves are about twice the size they were (the owner asked for more monsters),
// so each ordinary monster in one has HORDE_LIFE of a gate monster's life: a
// wave takes about as long to clear as before. Champions and bosses keep theirs.
export const HORDE_LIFE = 0.6;
export const MAX_WAVE_COUNT = 60;   // ordinary monsters in one wave, at most
// At most this many wave monsters at once. The owner asked for every monster
// of a wave to come at once (it was 14, the rest trickling in as others fell),
// so it holds a whole wave: the most a wave sends, its leader and two more.
// The queue below stays as a safety net, should a wave ever outgrow it.
export const MAX_ALIVE = MAX_WAVE_COUNT + 3;

// ---------------- The A-Worthy Shrine ----------------
// The shrine has a fixed life (shown as a percentage); each blow on it chips off
// SHRINE_CHIP for the kind of monster striking, times shrineScale, which grows
// 3% a wave up to x4 (wave 101). Clearing a wave mends SHRINE_MEND of it.
export const SHRINE_LIFE = 1000;
export const SHRINE_CHIP = { mob: 4, champion: 12, boss: 30 };
export const SHRINE_MEND = 0.1;
export const shrineScale = (n) => Math.min(4, 1 + 0.03 * (Math.max(1, n) - 1));
export const shrineChip = (n, kind) => Math.max(1, Math.round((SHRINE_CHIP[kind] || SHRINE_CHIP.mob) * shrineScale(n)));
// A gate monster goes for the shrine, turning on you only when you hit it or
// come within GATE_AGGRO tiles; once you're GATE_FORGET tiles off and it hasn't
// been hit for a few seconds, it goes back to the shrine.
export const GATE_AGGRO = 3;
export const GATE_FORGET = 6;
// Fall in the gate and you rise beside the shrine after this many ticks (~5s),
// while the monsters keep at it.
export const GATE_RESPAWN_TICKS = 8;
// Rewards stop growing with the wave past this one (deep waves would otherwise
// pay hundreds of stones a wave), and a wave's coin purse is capped.
export const REWARD_WAVE_CAP = 100;
export const COIN_CAP = 50000000;
// The squared terms of the wave curves turn into straight lines from this wave
// on (the tangent), so waves 200 or 500 are very hard but never absurd.
export const CURVE_KNEE = 100;
const sq = (m) => (m <= CURVE_KNEE ? m * m : CURVE_KNEE * CURVE_KNEE + 2 * CURVE_KNEE * (m - CURVE_KNEE));

/** How strong wave n is next to your fight level: 0.7x at wave 1, then gently
 *  (+3% a wave) and ever more steeply (the squared term): 1.17x at wave 10,
 *  2.2x at 20, 3.6x at 30, 7.2x at 50. Everyone falls in the end. */
export const waveCurve = (n) => 0.7 + 0.03 * (n - 1) + 0.0025 * sq(n - 1);
/** The level of wave n's monsters for a fighter of level `base`. The (n - 1)
 *  keeps it climbing every wave even for a level 1 character. */
export const waveLevel = (n, base) => Math.max(1, Math.round(Math.max(1, base) * waveCurve(n))) + (n - 1);
/** How many monsters wave n sends (not counting a champion or boss): 6, then one
 *  more every wave (about twice what it was: 3, then one every second wave), up
 *  to MAX_WAVE_COUNT. Only MAX_ALIVE are out at once; the rest follow. */
export const waveCount = (n) => Math.min(MAX_WAVE_COUNT, 5 + Math.max(1, n));
/** On top of the level, later waves hit harder and last longer: +6% life and
 *  +3% hits a wave, steepening (was +4% and +2%). Wave 1 is x1, so world events
 *  that borrow waveMobDef(id, 1, L) are unchanged. */
export const waveMight = (n) => ({ hp: 1 + 0.06 * (n - 1) + 0.003 * sq(n - 1), hit: 1 + 0.03 * (n - 1) + 0.0015 * sq(n - 1) });

/** The bonus for clearing wave n (monsters of `level`): coins growing with the
 *  wave, enhancement stones from wave 5, refine scrolls on even waves from 10,
 *  and a ward every 5th wave from 15. A boss wave adds its chest (see bossChest). */
export function waveBonus(n, level) {
  n = Math.min(n, REWARD_WAVE_CAP);
  const out = [['coins', Math.min(COIN_CAP, Math.round((50 + 5 * level) * n * 2))]];
  if (n >= 5) out.push(['upgrade_stone', more(Math.floor(n / 5))]);
  if (n >= 10 && n % 2 === 0) out.push(['refine_scroll', more(1 + Math.floor((n - 10) / 20))]);
  if (n >= 15 && n % 5 === 0) out.push(['upgrade_ward', 1]);
  return out;
}
/** A boss wave's guaranteed chest: a big purse, refine scrolls, stones and a ward.
 *  Every MILESTONE_EVERY-th wave it is a milestone chest: half as much again,
 *  and another ward. (Bosses come twice as often as they did, every 5th wave
 *  rather than every 10th, so the plain chest pays as before and the milestone more.) */
export function bossChest(n, level) {
  const big = n % MILESTONE_EVERY === 0 ? 1.5 : 1;
  n = Math.min(n, REWARD_WAVE_CAP);
  return [['coins', Math.min(COIN_CAP, Math.round((50 + 5 * level) * n * 6 * big))], ['refine_scroll', Math.ceil(more(2 + Math.floor(n / 20)) * big)],
    ['upgrade_stone', Math.ceil(more(5 + Math.floor(n / 2)) * big)], ['upgrade_ward', 1 + Math.floor(n / 30) + (big > 1 ? 1 : 0)]];
}

// ---------------- Gate modifiers ----------------
// Picked at the gate before a run, they stack: each makes the run harder and
// pays for it. Speeds and multipliers multiply, extra reward rolls add up.
export const GATE_MODS = {
  swift: { name: 'Swift foes', risk: 'Monsters move 50% faster', reward: 'Wave bonuses x2', speed: 1.5, loot: 2 },
  fasting: { name: 'Fasting', risk: 'No healing food', reward: '+75% combat XP', noFood: true, xp: 1.75 },
  elite: { name: 'Elite waves', risk: 'Monsters have +50% life and hit 25% harder', reward: '+1 reward roll each wave', hp: 1.5, hit: 1.25, rolls: 1 },
};
export const GATE_MOD_IDS = Object.keys(GATE_MODS);
/** The combined effect of a set of modifier ids. */
export function modEffects(ids) {
  const fx = { speed: 1, loot: 1, xp: 1, hp: 1, hit: 1, rolls: 0, noFood: false };
  for (const id of ids || []) {
    const m = GATE_MODS[id];
    if (!m) continue;
    fx.speed *= m.speed || 1; fx.loot *= m.loot || 1; fx.xp *= m.xp || 1;
    fx.hp *= m.hp || 1; fx.hit *= m.hit || 1; fx.rolls += m.rolls || 0;
    if (m.noFood) fx.noFood = true;
  }
  return fx;
}
// A reward roll (Elite waves) draws one prize from the gate's cache.
export const GATE_CACHE = [
  { id: 'upgrade_stone', min: 3, max: 8, weight: 40 }, { id: 'refine_scroll', min: 1, max: 2, weight: 25 },
  { id: 'upgrade_ward', weight: 12 }, { id: 'diamond', weight: 12 }, { id: 'amulet_of_glory', weight: 10 },
  { id: 'merlion_amulet', weight: 1 },
];
/** Everything a run can pay out (bar coins), for the Collection log's gate page. */
export const GATE_LOOT = [...new Set([...waveBonus(30, 100), ...bossChest(30, 100)].map(([id]) => id)
  .concat(GATE_CACHE.map((e) => e.id)).filter((id) => id !== 'coins'))];

/** Grow the built world by ARENA_ROWS rows of sea and raise the walled arena in
 *  them, then put the gate in Kampong Glam. Called on buildWorld()'s result
 *  before the World is made from it; everything already placed stays put. */
export function addArena(data) {
  const W = data.width, H0 = data.height, H = H0 + ARENA_ROWS;
  const terrain = new Uint8Array(W * H).fill(TERRAIN.WATER);
  terrain.set(data.terrain);   // the old rows, at the same indices
  for (let y = ARENA.y0; y <= ARENA.y1; y++) for (let x = ARENA.x0; x <= ARENA.x1; x++) terrain[y * W + x] = TERRAIN.STONE;
  const objects = [...data.objects];
  // A wall all round the floor, on stone so the sea doesn't lap at its foot.
  for (let x = ARENA.x0 - 1; x <= ARENA.x1 + 1; x++) for (const y of [ARENA.y0 - 1, ARENA.y1 + 1]) {
    terrain[y * W + x] = TERRAIN.STONE; objects.push({ objId: 'wall', x, y });
  }
  for (let y = ARENA.y0; y <= ARENA.y1; y++) for (const x of [ARENA.x0 - 1, ARENA.x1 + 1]) {
    terrain[y * W + x] = TERRAIN.STONE; objects.push({ objId: 'wall', x, y });
  }
  objects.push({ objId: 'wave_exit', x: EXIT.x, y: EXIT.y });
  // Torches (lamp posts) in the four corners light the hall.
  for (const [x, y] of [[ARENA.x0, ARENA.y0], [ARENA.x1, ARENA.y0], [ARENA.x0, ARENA.y1], [ARENA.x1, ARENA.y1]]) objects.push({ objId: 'lamp', x, y });
  objects.push({ objId: 'wave_gate', x: GATE.x, y: GATE.y });
  // The A-Worthy Shrine in the middle of the hall, pushed last so every other
  // object keeps its place in the list.
  objects.push({ objId: 'gate_shrine', x: SHRINE.x, y: SHRINE.y });
  const zones = [...data.zones, { name: GATE_NAME, x0: ARENA.x0 - 1, y0: ARENA.y0 - 1, x1: ARENA.x1 + 1, y1: ARENA.y1 + 1, instance: true }];
  // mapHeight: the world map shows the country, not the sea the arena sits in.
  return { ...data, height: H, mapHeight: H0, terrain, objects, zones };
}

export const inArena = (x, y) => x >= ARENA.x0 - 1 && x <= ARENA.x1 + 1 && y >= ARENA.y0 - 1 && y <= ARENA.y1 + 1;

const fightable = (id) => { try { const d = getNpc(id); return d.attackable && d.level > 0; } catch { return false; } };
// Nearest first by level ratio, so level 10 and 20 are as far apart as 100 and 200.
const byNearness = (L) => (a, b) => Math.abs(Math.log(getNpc(a).level / L)) - Math.abs(Math.log(getNpc(b).level / L));

/** Up to three kinds of ordinary monster for wave n at level L: from the nine
 *  species nearest that level, a different trio each wave, so the mix varies.
 *  All existing monsters, so every one already has its painted art. */
export function waveKinds(n, L) {
  const pool = ALL_MONSTER_IDS.filter((id) => fightable(id) && !getNpc(id).boss).sort(byNearness(L)).slice(0, 9);
  const start = (n * 4) % pool.length;
  return [...new Set([0, 3, 6].map((k) => pool[(start + k) % pool.length]))];
}
/** The boss for boss wave n at level L: one of the three (non-story) bosses
 *  nearest that level, turn about. */
export function waveBoss(n, L) {
  const pool = ALL_BOSS_IDS.filter((id) => fightable(id) && getNpc(id).boss && !getNpc(id).fixed).sort(byNearness(L)).slice(0, 3);
  return pool[(Math.floor(n / BOSS_EVERY) - 1) % pool.length];
}

/** A monster's stats rebuilt for wave n at level L: its own stats times
 *  L / its level (as the stretched levels are), and the wave's extra might. */
export function waveMobDef(id, n, L) {
  const base = getNpc(id), r = L / Math.max(1, base.level), m = waveMight(n);
  const s = (v, k = 1) => Math.max(1, Math.round((v || 1) * r * k));
  return { ...base, level: L, maxHp: s(base.maxHp, m.hp), attack: s(base.attack), strength: s(base.strength), defence: s(base.defence),
    maxHit: s(base.maxHit, m.hit), aggressive: true, aggroRange: 30, ignoreLevelGate: true, wave: true };
}
/** A monster made a gate monster: GATE_HP x life, GATE_HIT x max hit and
 *  GATE_ACC x attack on top of waveMobDef (which world events borrow as is).
 *  It only turns on you close up (GATE_AGGRO): the shrine is what it is after. */
export function gateMobDef(id, n, L) {
  const d = waveMobDef(id, n, L);
  return { ...d, maxHp: Math.max(1, Math.round(d.maxHp * GATE_HP)), maxHit: Math.max(1, Math.round(d.maxHit * GATE_HIT)), attack: Math.max(1, Math.round(d.attack * GATE_ACC)),
    aggroRange: GATE_AGGRO };
}
/** Real life (see hpScale in npcs.js: big monsters show their life smaller). */
const realLife = (d) => d.maxHp * (d.hpScale || 1);

/** A boss rebuilt for wave n at level L: f = L / its level, f x attack, strength,
 *  defence and max hit (as in _scaleBoss, but down as well as up), times the
 *  wave's extra might (not GATE_HIT: bosses already hit 1.8x as hard, see
 *  BOSS_DAMAGE_MULT, and with both a wave 5 boss took a level 100 Swordsman
 *  from full life with 20 sharks in a minute); its life is WAVE_BOSS_LIFE
 *  times a gate monster's of the wave (`mob`, real life). Signature moves and
 *  ground markers come with it: they're worked out from its max hit as usual. */
export function waveBossDef(id, n, L, mob = gateMobDef(waveKinds(n, L)[0], n, L)) {
  const base = getNpc(id), f = L / Math.max(1, base.level), m = waveMight(n);
  const s = (v, k) => Math.max(1, Math.round((v || 1) * k));
  return { ...base, level: L, maxHp: s(realLife(mob) * WAVE_BOSS_LIFE / (base.hpScale || 1), 1), attack: s(base.attack, f), strength: s(base.strength, f),
    defence: s(base.defence, f), maxHit: s(base.maxHit, f * m.hit * WAVE_BOSS_HIT), aggressive: true, aggroRange: GATE_AGGRO, ignoreLevelGate: true, wave: true,
    siege: 1 };   // its life is the wave's, not a siege boss's (npcs.js bossSiegeScale), so neither are its rewards
}

/** Everything wave n sends for a fighter of level `base`: a list of
 *  { id, def, champion? }, its leader first: a boss on every BOSS_EVERY-th
 *  wave, otherwise a champion (two from SECOND_CHAMPION_FROM, three from
 *  THIRD_CHAMPION_FROM). Leading the list, the leader is always out at once,
 *  whatever MAX_ALIVE holds back. Ordinary monsters have HORDE_LIFE x life. */
export function wavePlan(n, base) {
  const L = waveLevel(n, base), out = [];
  const kinds = waveKinds(n, L);
  let count = waveCount(n);
  if (n % BOSS_EVERY === 0) {
    const id = waveBoss(n, L);
    out.push({ id, def: waveBossDef(id, n, L, gateMobDef(kinds[0], n, L)) });
    count = Math.min(12, 4 + Math.floor(n / 10));   // a boss brings an escort (was 2), not a full wave
  } else {
    const champs = n >= THIRD_CHAMPION_FROM ? 3 : n >= SECOND_CHAMPION_FROM ? 2 : 1;
    for (let i = 0; i < champs; i++) out.push({ id: kinds[i % kinds.length], def: gateMobDef(kinds[i % kinds.length], n, L), champion: true });
  }
  for (let i = 0; i < count; i++) {
    const d = gateMobDef(kinds[i % kinds.length], n, L);
    out.push({ id: kinds[i % kinds.length], def: { ...d, maxHp: Math.max(1, Math.round(d.maxHp * HORDE_LIFE)) } });
  }
  return out;
}
/** The name a wave's banner gives its leader (its boss, else its champion). */
export function waveLeader(plan) {
  const e = plan.find((x) => x.def.boss) || plan.find((x) => x.champion);
  return e ? (e.def.boss ? e.def.name : `Champion ${e.def.name}`) : '';
}

/** The A-Worthy Shrine for a fresh run. A plain object standing in for an
 *  entity, so hitsplats and the hit flash can be drawn on it. */
function newShrine() {
  return { x: SHRINE.x, y: SHRINE.y, hp: SHRINE_LIFE, maxHp: SHRINE_LIFE, hurt: 0, hitAt: -99, shrine: true,
    renderCenter: () => ({ x: SHRINE.x * TILE + TILE / 2, y: SHRINE.y * TILE + TILE / 2 - 14 }) };
}

/** One run in the Endless Gate, and your best wave (saved). */
export class Waves {
  constructor(game) {
    this.game = game;
    this.best = 0;          // the deepest wave you have reached (saved)
    this.bestByClass = {};  // ...and with each job class (saved)
    this.mods = new Set();  // modifiers picked for the next run (saved, so the choice sticks)
    this._reset();
  }

  /** Your best wave as a class (the one you are now, by default). */
  classBest(cls = this.game.jobClass) { return this.bestByClass[cls || 'none'] || 0; }
  /** Pick or drop a modifier for the next run (not once a run is under way). */
  toggleMod(id) {
    if (this.active || !GATE_MODS[id]) return false;
    if (this.mods.has(id)) this.mods.delete(id); else this.mods.add(id);
    this.game.saveSoon = true;
    this.game.bus.emit('waves');
    return true;
  }
  /** Combat XP multiplier from this run's modifiers (1 outside a run). */
  xpMult() { return this.active ? this.fx.xp * GATE_XP : 1; }
  /** Agility XP multiplier for dodging `npc`: gateDodgeMult of the wave for one
   *  of this run's monsters (world events' borrowed wave monsters are not), else 1. */
  dodgeXpMult(npc) { return this.active && npc?.wave ? gateDodgeMult(this.wave) : 1; }
  /** Past DODGE_CAP_WAVE: a monster of the same rank (ordinary, champion or
   *  boss) as wave DODGE_CAP_WAVE sends them to you now, so _dodgeXp pays no
   *  more for a dodge than one there would. Null when there is no cap (not a
   *  run monster, or an early wave). */
  dodgeRef(npc) {
    if (!this.active || !npc?.wave || this.wave <= DODGE_CAP_WAVE) return null;
    const F = this.game.fightLevel();
    if (this._dodgeRefs?.F !== F) {
      const at = wavePlan(DODGE_CAP_WAVE, F), before = wavePlan(DODGE_CAP_WAVE - 1, F);
      const mob = at.find((e) => !e.def.boss && !e.champion).def, boss = at.find((e) => e.def.boss) || at[0];
      // The champion as _spawn makes it: makeChampion's harder hits, GATE_CHAMPION_LIFE of its life.
      const c = before[0].def;
      const champ = { ...c, maxHp: Math.max(1, Math.round(c.maxHp * CHAMPION_HP_MULT * GATE_CHAMPION_LIFE)), maxHit: Math.max(2, Math.round(c.maxHit * 1.5)), attack: Math.round(c.attack * 1.25) };
      this._dodgeRefs = { F, mob: { def: mob, maxHp: mob.maxHp }, champion: { def: champ, maxHp: champ.maxHp }, boss: { def: boss.def, maxHp: boss.def.maxHp } };
    }
    return this._dodgeRefs[npc.def.boss ? 'boss' : npc.champion ? 'champion' : 'mob'];
  }  /** Does this run forbid healing food? */
  blocksFood() { return this.active && this.fx.noFood; }
  /** Say no to a meal (at most every few ticks: auto-eat asks every tick). */
  foodRefused() {
    const g = this.game;
    if ((g.tickCount || 0) - (this._foodMsgAt ?? -99) >= 5) { this._foodMsgAt = g.tickCount || 0; g.msg('Fasting: no food in the Endless Gate this run.', 'system'); }
  }

  _reset() {
    this.active = false;
    this.runMods = [];      // the modifiers this run was entered with
    this.fx = modEffects([]);
    this.wave = 0;          // the wave under way (0 before the first)
    this.level = 0;         // its monsters' level
    this.mobs = [];         // its monsters still standing
    this.queue = [];        // ...and those still to come (beyond MAX_ALIVE)
    this.nextAt = 0;        // tick the next wave starts (0: a wave is being fought)
    this.leader = '';       // the name of the wave's boss or (first) champion
    this.ret = null;        // where you came in from
    this.shrine = newShrine();   // the A-Worthy Shrine's life this run
    this.run = { kills: 0, deaths: 0, got: new Map() };   // for the summary when the shrine falls
  }

  /** The shrine's life left, as a whole percentage (rounded up: 0 only when fallen). */
  shrinePct() { const s = this.shrine; return s.hp <= 0 ? 0 : Math.max(1, Math.ceil((s.hp / s.maxHp) * 100)); }
  /** How far a monster is from the shrine (in tiles). */
  shrineDist(n) { return chebyshev(n.x, n.y, SHRINE.x, SHRINE.y); }
  /** Is this monster hitting the shrine (beside it and not after you)? */
  besieging(n) { return !!(this.active && n?.wave && n.alive && !n.target && chebyshev(n.x, n.y, SHRINE.x, SHRINE.y) <= 1); }

  /** Monsters of this wave still to beat, out or waiting. */
  left() { return this.mobs.filter((n) => n.alive).length + this.queue.length; }
  /** Seconds until the next wave (0 while one is being fought). */
  countdown() { return this.nextAt ? Math.max(0, Math.ceil((this.nextAt - this.game.tickCount) * 0.6)) : 0; }

  /** Step through the gate: remember where you were and start the countdown to wave 1. */
  enter() {
    const g = this.game, p = g.player;
    if (this.active || !p.alive) return false;
    const at = g.playerTile();
    this._reset();
    this.ret = { x: at.x, y: at.y };
    // Whatever was chasing you out there loses you at the gate.
    for (const n of g.npcs) if (n.target === p && !n.ally) n.target = null;
    p.target = null;
    p.clearAction();
    g._placePlayer(START.x, START.y);
    this.active = true;
    this.runMods = GATE_MOD_IDS.filter((id) => this.mods.has(id));
    this.fx = modEffects(this.runMods);
    this.nextAt = g.tickCount + FIRST_WAVE_TICKS;
    g.spawnSparkle(p, '#b58cff', 16);
    g.msg(`You step through ${GATE_NAME}. Monsters come in waves, each stronger than the last, and they want the A-Worthy Shrine broken. Guard it: the run ends when it falls. If you fall, you rise again beside it. Leave by the portal, or with Leave.`, 'system');
    if (this.runMods.length) g.msg(`Modifiers: ${this.runMods.map((id) => GATE_MODS[id].name).join(', ')}.`, 'system');
    if (this.best) g.msg(`Your best: wave ${this.best}${this.classBest() ? ` (as this class: wave ${this.classBest()})` : ''}.`, 'system');
    g.bus.emit('sfx', 'travel');
    g.updateRegion();
    g.ui?.closeModal?.();
    g.bus.emit('waves');
    return true;
  }

  /** Leave by the portal or the Leave button: back to where you came in. */
  leave(quiet = false) {
    if (!this.active) return false;
    const ret = this.ret;
    this._end();
    const g = this.game, spot = (ret && g._nearestFree(ret.x, ret.y)) || g.world.respawnPoint;
    // Down and waiting to rise: you wake outside instead of beside the shrine.
    if (!g.player.alive) g._respawnAt = spot;
    else g._placePlayer(spot.x, spot.y);
    g.updateRegion();
    // Auto battle stops at the door, or it would march you straight off into town.
    if (g.autoBattle) g.toggleAutoBattle(false);
    if (!quiet) g.msg(`You leave ${GATE_NAME}.`, 'system');
    g.bus.emit('sfx', 'travel');
    return true;
  }

  /** You fell inside: the run goes on without you for a few seconds (the
   *  monsters keep at the shrine), then you rise beside the shrine.
   *  Returns the tile to respawn on (null when not in a run). */
  onDeath() {
    if (!this.active) return null;
    const g = this.game;
    this.run.deaths++;
    g.player.respawnTimer = GATE_RESPAWN_TICKS;
    g.msg(`You fall in ${GATE_NAME}! You'll rise beside the shrine in ${Math.round(GATE_RESPAWN_TICKS * 0.6)}s: the monsters won't wait.`, 'system');
    return g._nearestFree(SHRINE.x, SHRINE.y + 1) || { x: START.x, y: START.y };
  }

  /** A monster with nobody to fight goes for the shrine (from NPC._combatAI):
   *  walks up to it and strikes it on its own attack timer. True when handled. */
  siegeStep(n) {
    if (!this.active || !n.wave || this.shrine.hp <= 0) return false;
    const g = this.game;
    if (chebyshev(n.x, n.y, SHRINE.x, SHRINE.y) <= 1) {
      n.stop();
      if (n.attackCooldown <= 0 && !n.isMoving) {
        this.hitShrine(n);
        const speed = Math.max(2, (n.def.attackSpeed || 4) - 2);
        n.attackCooldown = n.slowTicks > 0 ? Math.round(speed * 1.6) : speed;   // a Water spell slows it here too
      }
      return true;
    }
    // On its way: a fresh route when it stands still (a chase it gave up ends in place).
    if (!n.isMoving && n.repathCooldown <= 0) {
      const path = findPath(g.pathCfg(), n.stepTile(), SHRINE, { reachAdjacent: true, maxNodes: 2000 });
      if (path.length) n.setPath(path);
      n.repathCooldown = 2;
    }
    return true;
  }

  /** A blow on the shrine: chip its life by the striker's kind and the wave. */
  hitShrine(n) {
    const g = this.game, s = this.shrine;
    if (s.hp <= 0) return 0;
    const kind = n.def.boss ? 'boss' : n.champion ? 'champion' : 'mob';
    const dmg = Math.max(1, Math.round(shrineChip(this.wave, kind) * this.fx.hit));   // Elite waves hit it harder too
    const before = this.shrinePct();
    g._swingToward?.(n, SHRINE.x, SHRINE.y);
    s.hp = Math.max(0, s.hp - dmg);
    s.hitAt = g.tickCount;
    g.addHitsplat(s, dmg, { tint: '#c2185b' });   // raspberry, apart from the hits on you
    const now = this.shrinePct();
    for (const at of [50, 25, 10]) {
      if (before > at && now <= at && now > 0) {
        g.msg(`The A-Worthy Shrine is at ${now}%! Drive them off it!`, 'combat');
        g.bus.emit('sfx', 'hurt:hazard');
        break;
      }
    }
    if (s.hp <= 0) this._fall();
    else g.bus.emit('waves');
    return dmg;
  }

  /** The shrine is broken: the run is over. Sum it up, keep the record, and
   *  send you back out to where you came in. */
  _fall() {
    const g = this.game, n = this.wave || 1;
    const cls = g.jobClass || 'none';
    const summary = { wave: n, cleared: Math.max(0, n - 1), best: this.best, classBest: this.bestByClass[cls] || 0,
      record: n >= this.best, kills: this.run.kills, deaths: this.run.deaths, got: [...this.run.got] };
    this.lastRun = summary;
    g.msg(`The shrine has fallen at wave ${n}! You cleared ${summary.cleared} wave${summary.cleared === 1 ? '' : 's'} and keep everything you earned.`, 'level');
    g.addShake?.(5, 420);
    this.leave(true);
    g.banner(`<span class="big">The shrine has fallen at wave ${n}</span>${summary.record ? 'A new best!' : `Your best: wave ${this.best}`}`, 'gatefall');
    g.saveSoon = true;
    g.bus.emit('gateFallen', summary);
    return summary;
  }

  /** Close the run: clear its monsters, boss markers and leftovers. */
  _end() {
    const g = this.game, p = g.player;
    const reached = this.wave;
    // Its monsters, and anything a boss summoned, go with it (never mercenaries).
    g.npcs = g.npcs.filter((n) => !(n.wave || (n.temporary && !n.ally && inArena(n.x, n.y))));
    g.hazards = g.hazards.filter((h) => !inArena(h.cx, h.cy));
    if (g._ks && !g.npcs.includes(g._ks.npc)) { g.ui?.hideKnowledgeStrike?.(null, g._ks.q); g._ks = null; }
    // Any loot still on the floor comes with you.
    for (const gi of [...g.world.groundItems]) {
      if (!inArena(gi.x, gi.y)) continue;
      g.inventory.add(gi.id, gi.qty, gi.q);
      g.world.removeGroundItem(gi);
    }
    if (p.action?.type === 'attack') p.clearAction();
    p.target = null;
    g._dodging = false;
    // A wave's banner stays up a few seconds; it must not follow you out into town.
    g.ui?.hideBanner?.('waves');
    this._reset();
    this.wave = reached;   // kept for the summary messages
    g.saveSoon = true;
    g.bus.emit('waves');
  }

  /** Each world tick: send the next wave, top up the field, and pay out a cleared
   *  wave. It runs on while you're down: the monsters keep at the shrine. */
  tick() {
    if (!this.active) return;
    const g = this.game, p = g.player;
    // Carried off by other means (the MRT from the world map, say): the run is over.
    if (!inArena(p.x, p.y)) { this._end(); this.wave = 0; return; }
    const before = this.mobs.length;
    this.mobs = this.mobs.filter((n) => n.alive && g.npcs.includes(n));
    this.run.kills += before - this.mobs.length;
    // A monster you've walked away from (and stopped hitting) goes back to the shrine.
    for (const n of this.mobs) {
      if (n.target === p && n.combatLatch <= 0 && (!p.alive || chebyshev(n.x, n.y, p.x, p.y) > GATE_FORGET)) { n.target = null; n.stop(); }
    }
    // Reinforcements: one a tick, so they arrive in a stream rather than a heap.
    if (this.queue.length && this.mobs.length < MAX_ALIVE) this._spawn(this.queue.shift());
    if (this.wave > 0 && !this.nextAt && !this.mobs.length && !this.queue.length) this._cleared();
    if (this.nextAt && g.tickCount >= this.nextAt) { this.nextAt = 0; this._startWave(this.wave + 1); }
  }

  _startWave(n) {
    const g = this.game;
    const plan = wavePlan(n, g.fightLevel());
    const count = plan.length;   // counted now: spawning empties the queue (the plan itself)
    // Elite waves: tougher monsters (a fresh def each, so nothing shared is changed).
    if (this.fx.hp !== 1 || this.fx.hit !== 1) {
      for (const e of plan) e.def = { ...e.def, maxHp: Math.max(1, Math.round(e.def.maxHp * this.fx.hp)), maxHit: Math.max(1, Math.round(e.def.maxHit * this.fx.hit)) };
    }
    const cls = g.jobClass || 'none';
    if (n > (this.bestByClass[cls] || 0)) { this.bestByClass[cls] = n; g.saveSoon = true; }
    this.wave = n;
    this.level = plan[0].def.level;
    this.queue = plan;
    while (this.queue.length && this.mobs.length < MAX_ALIVE) this._spawn(this.queue.shift());
    if (n > this.best) { this.best = n; g.saveSoon = true; }
    const boss = n % BOSS_EVERY === 0 ? plan.find((e) => e.def.boss) : null;
    const champs = this.mobs.filter((m) => m.champion).length;
    const leader = boss ? boss.def.name : this.mobs.find((m) => m.champion)?.name || '';
    this.leader = leader;
    if (boss) {
      g.banner(`<span class="big">Wave ${n}: boss!</span>${boss.def.name} (level ${this.level})`, 'waves');
      g.addShake(4, 320);
    } else g.banner(`<span class="big">Wave ${n}</span>${count} monsters, level ${this.level}${leader ? `, led by ${leader}${champs > 1 ? ` and ${champs - 1} more` : ''}` : ''}`, 'waves');
    g.msg(`Wave ${n} begins: ${count} monsters of level ${this.level}${leader ? `, led by ${leader}` : ''}.`, 'combat');
    g.bus.emit('sfx', boss ? 'roar' : 'ability:windup');
    g.checkAchievements();
    g.bus.emit('waves');
  }

  /** A free floor tile for a new monster: by the next of the spawn points round
   *  the hall's edge (in turn, so they come from every side), else anywhere. */
  _spawnSpot() {
    const g = this.game, p = g.player, taken = new Set(g.npcs.filter((n) => n.alive).map((n) => n.x * 4096 + n.y));
    const free = (x, y) => !g.world.isBlocked(x, y) && !taken.has(x * 4096 + y) && (x !== p.x || y !== p.y)
      && x >= ARENA.x0 && x <= ARENA.x1 && y >= ARENA.y0 && y <= ARENA.y1;
    this._spawnN = ((this._spawnN || 0) + 1) % SPAWN_POINTS.length;
    const sp = SPAWN_POINTS[this._spawnN];
    for (let r = 0; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(sp.x + dx, sp.y + dy)) return { x: sp.x + dx, y: sp.y + dy };
    }
    for (let tries = 0; tries < 60; tries++) {
      const x = ARENA.x0 + Math.floor(Math.random() * (ARENA.x1 - ARENA.x0 + 1));
      const y = ARENA.y0 + Math.floor(Math.random() * (ARENA.y1 - ARENA.y0 + 1));
      if (free(x, y) && chebyshev(x, y, p.x, p.y) >= 6) return { x, y };
    }
    for (let y = ARENA.y1; y >= ARENA.y0; y--) for (let x = ARENA.x0; x <= ARENA.x1; x++) if (free(x, y)) return { x, y };
    return { x: Math.round(MID.x), y: Math.round(MID.y) };
  }

  _spawn(entry) {
    const g = this.game, spot = this._spawnSpot();
    // Spawn options make it a hand-placed spawn, so it never rolls its own champion.
    const n = new NPC(entry.id, spot.x, spot.y, 0, { aggressive: true, ignoreLevelGate: true });
    n.def = entry.def;
    n.maxHp = n.hp = n.def.maxHp;
    if (entry.champion) {
      n.makeChampion();
      // One leads every wave: a fifth of a world champion's life (GATE_CHAMPION_LIFE).
      n.def = { ...n.def, maxHp: Math.max(1, Math.round(n.def.maxHp * GATE_CHAMPION_LIFE)) };
      n.maxHp = n.hp = n.def.maxHp;
    }
    if (this.fx.speed !== 1) n.stepMul /= this.fx.speed;   // Swift foes
    // Home is the middle of the hall, with room to roam all of it, so it never
    // gives up the chase and walks "home" while you stand in a corner.
    n.spawnX = Math.round(MID.x); n.spawnY = Math.round(MID.y); n.wander = 14;
    n.temporary = true;   // gone when it dies; no respawn
    n.wave = true;
    n.spawnT = 350;       // fades in
    n.aoeCooldown = n.def.boss ? 5 : 0;
    n.specialCooldown = n.def.specialEvery || 9;
    g.npcs.push(n);
    g.hasTemps = true;
    this.mobs.push(n);
    g.spawnPoof(spot.x * TILE + TILE / 2, spot.y * TILE + TILE / 2, '#b58cff');
    return n;
  }

  _cleared() {
    const g = this.game, n = this.wave, L = this.level;
    // A boss's summons don't outlive the wave.
    g.npcs = g.npcs.filter((m) => !(m.temporary && !m.ally && m.alive && inArena(m.x, m.y)));
    const got = waveBonus(n, L);
    if (n % BOSS_EVERY === 0) got.push(...bossChest(n, L));
    // Modifiers: Swift foes doubles the bonus, each extra reward roll adds a cache prize.
    const fx = this.fx;
    if (fx.loot !== 1) for (const e of got) e[1] = Math.round(e[1] * fx.loot);
    for (let r = 0; r < fx.rolls; r++) { const pick = weightedPick(GATE_CACHE); got.push([pick.id, pick.min ? randInt(pick.min, pick.max) : 1]); }
    const sum = new Map();
    for (const [id, q] of got) if (q > 0) sum.set(id, (sum.get(id) || 0) + q);
    for (const [id, q] of sum) { g.inventory.add(id, q); g.collection?.record('gate', id, q); this.run.got.set(id, (this.run.got.get(id) || 0) + q); }
    // The shrine mends a little between waves.
    const s = this.shrine, mend = Math.min(s.maxHp - s.hp, Math.round(s.maxHp * SHRINE_MEND));
    if (mend > 0) { s.hp += mend; g.addHitsplat(s, 0, { text: `Shrine +${Math.round(mend / s.maxHp * 100)}%` }); }
    const names = { coins: 'coins', upgrade_stone: 'enhancement stones', refine_scroll: 'refine scrolls', upgrade_ward: 'upgrade wards' };
    const list = [...sum].map(([id, q]) => `${q.toLocaleString('en-GB')} ${names[id] || getItem(id).name}`).join(', ');
    const chest = n % BOSS_EVERY !== 0 ? '' : n % MILESTONE_EVERY === 0 ? 'Milestone chest' : 'Boss chest';
    g.msg(`Wave ${n} cleared! ${chest || 'Bonus'}: ${list}.`, 'level');
    g.banner(`<span class="big">Wave ${n} cleared!</span>${chest ? `${chest} opened. ` : ''}Next wave in ${Math.round(NEXT_WAVE_TICKS * 0.6)}s`, 'waves');
    g.bus.emit('sfx', n % BOSS_EVERY === 0 ? 'dropepic' : 'droprare');
    g.spawnConfetti?.(g.player.renderCenter().x, g.player.renderCenter().y - 18, n % BOSS_EVERY === 0 ? 46 : 22);
    this.nextAt = g.tickCount + NEXT_WAVE_TICKS;
    g.saveSoon = true;
    g.bus.emit('waves');
  }
}
