// The Endless Gate: a sealed dungeon arena where monsters come in endless,
// ever-stronger waves. You step through a gate in Kampong Glam, fight until you
// fall or choose to leave, and come out where you went in, keeping everything.
//
// The arena is not a separate map: rows are added below the 540x380 world
// (`addArena`), ringed by walls and open sea, so nothing can walk in or out.
// Appending rows keeps every existing tile index where it was, and the seeded
// world is built first and left untouched, so no tree, rock or monster moves.

import { NPC } from './npc.js';
import { getNpc, ALL_MONSTER_IDS, ALL_BOSS_IDS } from '../data/npcs.js';
import { TERRAIN } from '../data/world.js';
import { chebyshev } from '../core/utils.js';
import { TILE } from '../config.js';

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

// Pacing and limits.
export const NEXT_WAVE_TICKS = 6;   // ~3.6s between the last kill and the next wave
export const MAX_ALIVE = 8;         // at most this many wave monsters at once (phones)
export const CHAMPION_EVERY = 5;    // every 5th wave adds a champion
export const BOSS_EVERY = 10;       // every 10th wave is a boss wave
// A wave boss is a boss scaled to the wave the way _scaleBoss scales bosses to
// you (f x its hits and defence, f^2 x its life), but with a fifth of that life:
// a full boss is a siege for a party, and this one stands between you and the
// next wave. That still leaves it about as long a fight as a champion.
export const WAVE_BOSS_LIFE = 0.2;

/** How strong wave n is next to your fight level: 0.7x at wave 1, then gently
 *  (+3% a wave) and ever more steeply (the squared term): 1.17x at wave 10,
 *  2.2x at 20, 3.6x at 30, 7.2x at 50. Everyone falls in the end. */
export const waveCurve = (n) => 0.7 + 0.03 * (n - 1) + 0.0025 * (n - 1) ** 2;
/** The level of wave n's monsters for a fighter of level `base`. The (n - 1)
 *  keeps it climbing every wave even for a level 1 character. */
export const waveLevel = (n, base) => Math.max(1, Math.round(Math.max(1, base) * waveCurve(n))) + (n - 1);
/** How many monsters wave n sends (not counting a champion or boss): 3, then one
 *  more every second wave. Only MAX_ALIVE are out at once; the rest follow. */
export const waveCount = (n) => Math.min(30, 3 + Math.floor(n / 2));
/** On top of the level, later waves hit harder and last longer. */
export const waveMight = (n) => ({ hp: 1 + 0.04 * (n - 1) + 0.002 * (n - 1) ** 2, hit: 1 + 0.02 * (n - 1) + 0.001 * (n - 1) ** 2 });

/** The bonus for clearing wave n (monsters of `level`): coins growing with the
 *  wave, enhancement stones from wave 5, refine scrolls on even waves from 10,
 *  and a ward every 5th wave from 15. A boss wave adds its chest (see bossChest). */
export function waveBonus(n, level) {
  const out = [['coins', Math.round((50 + 5 * level) * n)]];
  if (n >= 5) out.push(['upgrade_stone', Math.floor(n / 5)]);
  if (n >= 10 && n % 2 === 0) out.push(['refine_scroll', 1 + Math.floor((n - 10) / 20)]);
  if (n >= 15 && n % 5 === 0) out.push(['upgrade_ward', 1]);
  return out;
}
/** A boss wave's guaranteed chest: a big purse, refine scrolls, stones and a ward. */
export function bossChest(n, level) {
  return [['coins', Math.round((50 + 5 * level) * n * 3)], ['refine_scroll', 2 + Math.floor(n / 20)],
    ['upgrade_stone', 5 + Math.floor(n / 2)], ['upgrade_ward', 1 + Math.floor(n / 30)]];
}

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
/** A boss rebuilt for wave n at level L: f = L / its level, f x attack, strength,
 *  defence and max hit, f^2 x life (as in _scaleBoss, but down as well as up),
 *  times WAVE_BOSS_LIFE and the wave's extra might. Signature moves and ground
 *  markers come with it: they're worked out from its max hit as usual. */
export function waveBossDef(id, n, L) {
  const base = getNpc(id), f = L / Math.max(1, base.level), m = waveMight(n);
  const s = (v, k) => Math.max(1, Math.round((v || 1) * k));
  return { ...base, level: L, maxHp: s(base.maxHp, f * f * WAVE_BOSS_LIFE * m.hp), attack: s(base.attack, f), strength: s(base.strength, f),
    defence: s(base.defence, f), maxHit: s(base.maxHit, f * m.hit), aggressive: true, aggroRange: 30, ignoreLevelGate: true, wave: true };
}

/** Everything wave n sends for a fighter of level `base`: a list of
 *  { id, def, champion? } (the boss first on a boss wave). */
export function wavePlan(n, base) {
  const L = waveLevel(n, base), out = [];
  let count = waveCount(n);
  if (n % BOSS_EVERY === 0) {
    const id = waveBoss(n, L);
    out.push({ id, def: waveBossDef(id, n, L) });
    count = 2;   // a boss brings a couple of escorts, not a full wave
  }
  const kinds = waveKinds(n, L);
  for (let i = 0; i < count; i++) out.push({ id: kinds[i % kinds.length], def: waveMobDef(kinds[i % kinds.length], n, L) });
  if (n % CHAMPION_EVERY === 0) out.push({ id: kinds[0], def: waveMobDef(kinds[0], n, L), champion: true });
  return out;
}

/** One run in the Endless Gate, and your best wave (saved). */
export class Waves {
  constructor(game) {
    this.game = game;
    this.best = 0;          // the deepest wave you have reached (saved)
    this._reset();
  }

  _reset() {
    this.active = false;
    this.wave = 0;          // the wave under way (0 before the first)
    this.level = 0;         // its monsters' level
    this.mobs = [];         // its monsters still standing
    this.queue = [];        // ...and those still to come (beyond MAX_ALIVE)
    this.nextAt = 0;        // tick the next wave starts (0: a wave is being fought)
    this.ret = null;        // where you came in from
  }

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
    this.nextAt = g.tickCount + NEXT_WAVE_TICKS;
    g.spawnSparkle(p, '#b58cff', 16);
    g.msg(`You step through ${GATE_NAME}. Monsters come in waves, each stronger than the last. Leave by the portal, or with Leave; if you fall you keep everything and wake outside.`, 'system');
    if (this.best) g.msg(`Your best: wave ${this.best}.`, 'system');
    g.bus.emit('sfx', 'travel');
    g.updateRegion();
    g.ui?.closeModal?.();
    g.bus.emit('waves');
    return true;
  }

  /** Leave by the portal or the Leave button: back to where you came in. */
  leave() {
    if (!this.active) return false;
    const ret = this.ret;
    this._end();
    const g = this.game, spot = (ret && g._nearestFree(ret.x, ret.y)) || g.world.respawnPoint;
    g._placePlayer(spot.x, spot.y);
    g.updateRegion();
    // Auto battle stops at the door, or it would march you straight off into town.
    if (g.autoBattle) g.toggleAutoBattle(false);
    g.msg(`You leave ${GATE_NAME}.`, 'system');
    g.bus.emit('sfx', 'travel');
    return true;
  }

  /** You fell inside: the run ends, nothing is lost, and you wake at the gate.
   *  Returns the tile to respawn on (null when not in a run). */
  onDeath() {
    if (!this.active) return null;
    const ret = this.ret;
    this._end();
    this.game.msg(`You fall in ${GATE_NAME} at wave ${this.wave || 1}. You keep everything you earned.`, 'system');
    return ret;
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

  /** Each world tick: send the next wave, top up the field, and pay out a cleared wave. */
  tick() {
    if (!this.active) return;
    const g = this.game, p = g.player;
    if (!p.alive) return;   // playerDeath ends the run
    // Carried off by other means (the MRT from the world map, say): the run is over.
    if (!inArena(p.x, p.y)) { this._end(); this.wave = 0; return; }
    this.mobs = this.mobs.filter((n) => n.alive && g.npcs.includes(n));
    // Reinforcements: one a tick, so they arrive in a stream rather than a heap.
    if (this.queue.length && this.mobs.length < MAX_ALIVE) this._spawn(this.queue.shift());
    if (this.wave > 0 && !this.nextAt && !this.mobs.length && !this.queue.length) this._cleared();
    if (this.nextAt && g.tickCount >= this.nextAt) { this.nextAt = 0; this._startWave(this.wave + 1); }
  }

  _startWave(n) {
    const g = this.game;
    const plan = wavePlan(n, g.fightLevel());
    const count = plan.length;   // counted now: spawning empties the queue (the plan itself)
    this.wave = n;
    this.level = plan[0].def.level;
    this.queue = plan;
    while (this.queue.length && this.mobs.length < MAX_ALIVE) this._spawn(this.queue.shift());
    if (n > this.best) { this.best = n; g.saveSoon = true; }
    const boss = n % BOSS_EVERY === 0 ? plan.find((e) => e.def.boss) : null;
    if (boss) {
      g.banner(`<span class="big">Wave ${n}: boss!</span>${boss.def.name} (level ${this.level})`, 'waves');
      g.addShake(4, 320);
    } else g.banner(`<span class="big">Wave ${n}</span>${count} monsters, level ${this.level}${n % CHAMPION_EVERY === 0 ? ', with a champion' : ''}`, 'waves');
    g.msg(`Wave ${n} begins: ${count} monsters of level ${this.level}.`, 'combat');
    g.bus.emit('sfx', 'spec');
    g.checkAchievements();
    g.bus.emit('waves');
  }

  /** A free floor tile for a new monster, away from you if there's room. */
  _spawnSpot() {
    const g = this.game, p = g.player, taken = new Set(g.npcs.filter((n) => n.alive).map((n) => n.x * 4096 + n.y));
    const free = (x, y) => !g.world.isBlocked(x, y) && !taken.has(x * 4096 + y) && (x !== p.x || y !== p.y);
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
    if (entry.champion) n.makeChampion();
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
    const sum = new Map();
    for (const [id, q] of got) if (q > 0) sum.set(id, (sum.get(id) || 0) + q);
    for (const [id, q] of sum) g.inventory.add(id, q);
    const names = { coins: 'coins', upgrade_stone: 'enhancement stones', refine_scroll: 'refine scrolls', upgrade_ward: 'upgrade wards' };
    const list = [...sum].map(([id, q]) => `${q.toLocaleString('en-GB')} ${names[id] || id}`).join(', ');
    g.msg(`Wave ${n} cleared! ${n % BOSS_EVERY === 0 ? 'Boss chest' : 'Bonus'}: ${list}.`, 'level');
    g.banner(`<span class="big">Wave ${n} cleared!</span>${n % BOSS_EVERY === 0 ? 'Boss chest opened. ' : ''}Next wave in ${Math.round(NEXT_WAVE_TICKS * 0.6)}s`, 'waves');
    g.bus.emit('sfx', n % BOSS_EVERY === 0 ? 'dropepic' : 'droprare');
    g.spawnConfetti?.(g.player.renderCenter().x, g.player.renderCenter().y - 18, n % BOSS_EVERY === 0 ? 46 : 22);
    this.nextAt = g.tickCount + NEXT_WAVE_TICKS;
    g.saveSoon = true;
    g.bus.emit('waves');
  }
}
