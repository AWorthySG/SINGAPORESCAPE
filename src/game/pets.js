// Pets: a very rare companion from every boss and every life skill. A boss
// kill rolls about 1 in 3,000 (a little better the more of that boss you've
// beaten); every life-skill action rolls 1 in SKILL_PET_RATE, so a player who
// sticks at one skill meets its pet after many hours. A new pet is announced
// with a banner and a chat line, lands in the Collection log, and follows you
// at once if nothing else is. One follower at a time; choose or dismiss it from
// the Pets section of the Collection log.
//
// A pet is not an item (it takes no bag space and needs no item art): it is
// drawn from its creature's existing painted art at about 45% size, with a
// small hop (render/petsprite.js). Its spot on the map is worked out here, on
// game ticks, so the follow is the same headless as on screen.

import { ALL_MONSTER_IDS, ALL_BOSS_IDS, getNpc } from '../data/npcs.js';
import { SKILLS } from '../data/skills.js';
import { chebyshev } from '../core/utils.js';

export const BOSS_PET_RATE = 3000;   // 1 in this many boss kills at first...
export const BOSS_PET_FLOOR = 1000;  // ...improving by one per kill of that boss, to 1 in this
export const SKILL_PET_RATE = 15000; // 1 in this many life-skill actions (~2,000 actions an hour: ~7 hours)
/** The chance a boss kill brings its pet, after `kc` kills of it. */
export const bossPetChance = (kc) => 1 / Math.max(BOSS_PET_FLOOR, BOSS_PET_RATE - Math.max(0, kc || 0));
export const skillPetChance = () => 1 / SKILL_PET_RATE;

/** A small seeded random generator (0 <= x < 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The test suite pins the pets' generator (tests/seed.mjs), as it pins
// Math.random: a pet turning up in one run of a long test and not in the next
// (its sparkles use Math.random) sent the two runs apart and failed a deploy.
// In play it is seeded from the clock.
export const PET_SEED = { value: null };

/** One roll of a 1-in-`1 / chance` drop (rand injectable for tests). */
export const rollPet = (chance, rand = Math.random) => rand() < chance;

const shortName = (n) => n.replace(/^The /, '');
/** Every boss's pet: its own art, shrunk. { id, name, npcId, source }. */
export const BOSS_PETS = {};
for (const id of ALL_BOSS_IDS) {
  const d = getNpc(id);
  if (!d.attackable || !d.boss) continue;
  BOSS_PETS[id] = { id: `pet_${id}`, name: `Little ${shortName(d.name)}`, npcId: id, source: d.name, boss: true };
}

// Each life skill's pet borrows a fitting creature's painted art (by species).
const SKILL_PET_LOOK = {
  mining: ['Pebble', 'stone_golem'], smithing: ['Rusty', 'rust_golem'], crafting: ['Semut', 'weaver_ant'],
  fishing: ['Ottie', 'smooth_otter'], cooking: ['Ayam', 'chicken'], firemaking: ['Kelip', 'kunang_kunang'],
  woodcutting: ['Kubung', 'colugo'], thieving: ['Cheeky', 'macaque'], agility: ['Zippy', 'slow_loris'],
  farming: ['Orang-orang', 'scarecrow'], hunter: ['Sang Kancil', 'kancil'], herblore: ['Periuk', 'pitcher_plant'],
  fletching: ['Myna', 'javan_myna'], diving: ['Penyu', 'hawksbill_turtle'], construction: ['Bata', 'concrete_golem'],
};
const FAMILY_NPC = new Map();
for (const id of ALL_MONSTER_IDS) { const f = getNpc(id).family; if (f && !FAMILY_NPC.has(f)) FAMILY_NPC.set(f, id); }
/** The life skills (every skill outside combat), each with a pet. */
export const LIFE_SKILL_IDS = SKILLS.filter((s) => s.group !== 'combat' && !s.combat && !s.hidden).map((s) => s.id);
export const SKILL_PETS = {};
for (const sk of LIFE_SKILL_IDS) {
  const [name, family] = SKILL_PET_LOOK[sk] || ['Buddy', 'chicken'];
  const npcId = FAMILY_NPC.get(family) || FAMILY_NPC.get('chicken') || ALL_MONSTER_IDS[0];
  SKILL_PETS[sk] = { id: `pet_${sk}`, name, npcId, source: SKILLS.find((s) => s.id === sk).name, skill: sk };
}
export const PET_BY_ID = Object.fromEntries([...Object.values(BOSS_PETS), ...Object.values(SKILL_PETS)].map((p) => [p.id, p]));
const LIFE = new Set(LIFE_SKILL_IDS);

export class Pets {
  constructor(game) {
    this.game = game;
    this.owned = {};        // { petId: times found } (saved)
    this.active = null;     // the pet following you (saved)
    this.follower = null;   // where it is: { id, x, y } in tiles (not saved)
    this._trail = [];       // your last few tiles, for it to walk in
    this._rolled = {};      // skill -> tick of its last roll (one roll a tick at most)
    // Pets roll on their own generator, so these extra rolls never shift the
    // run of Math.random the rest of the game (and its seeded tests) depends on.
    this.rand = mulberry32(((PET_SEED.value ?? Date.now()) ^ 0x9e3779b9) >>> 0);
    game.bus.on('tick', () => this.tick());
    // Every life-skill action pays XP, so the XP event is the roll: no hook in
    // each skill. Bonus XP from the same action (a pearl, say) doesn't roll again.
    game.bus.on('xp', (e) => {
      if (!e || !LIFE.has(e.skill) || !(e.amount > 0)) return;
      // An instant batch (hold/release) counts its makes and rolls for them all at the end.
      // A held 'xp' from Skills (skillset.js) stands for `count` gains, so `count` makes.
      const n = e.count > 1 ? e.count : 1;
      if (this._held) { this._held[e.skill] = (this._held[e.skill] || 0) + n; return; }
      const t = game.tickCount || 0;
      if (this._rolled[e.skill] === t) return;
      this._rolled[e.skill] = t;
      if (rollPet(skillPetChance(), this.rand)) this.grant(SKILL_PETS[e.skill].id);
    });
  }

  /** An instant batch (smelting and making: every item in one tick) would get
   *  only one roll a tick, so it holds the rolls while it runs: each make's XP
   *  counts as one action, and release() rolls once per skill at the chance of
   *  any of those N actions bringing the pet, 1 - (1 - p)^N, the same as N makes
   *  one at a time. Nested holds just keep counting. */
  hold() { if (!this._held) { this._held = {}; return true; } return false; }
  release() {
    const held = this._held;
    this._held = null;
    if (!held) return;
    const t = this.game.tickCount || 0;
    for (const [skill, n] of Object.entries(held)) {
      this._rolled[skill] = t;
      if (n > 0 && rollPet(1 - (1 - skillPetChance()) ** n, this.rand)) this.grant(SKILL_PETS[skill].id);
    }
  }

  /** A boss died to you (once per kill, from the kill code). */
  onKill(npc) {
    const p = npc?.def?.boss && BOSS_PETS[npc.npcId];
    if (!p) return false;
    if (!rollPet(bossPetChance(this.game.kills?.[npc.npcId] || 0), this.rand)) return false;
    this.grant(p.id);
    return true;
  }

  /** Give a pet: announce it, log it, and have it follow you if none is. */
  grant(id) {
    const P = PET_BY_ID[id], g = this.game;
    if (!P) return false;
    const again = !!this.owned[id];
    this.owned[id] = (this.owned[id] || 0) + 1;
    if (again) {
      g.msg?.(`You have a funny feeling you would have been followed... (${P.name} again: ${this.owned[id]} found)`, 'level');
    } else {
      g.msg?.(`You have a funny feeling you're being followed... ${P.name} has joined you! (from ${P.source})`, 'level');
      g.banner?.(`<span class="big">New pet!</span>${P.name} is following you`);
      g.bus?.emit('sfx', 'dropepic');
      if (g.player) g.spawnSparkle?.(g.player, '#ffd24a', 20);
      if (!this.active) this.summon(id);
    }
    for (const pg of ['pets', P.boss ? `boss:${P.npcId}` : null]) if (pg) g.collection?.check?.(pg);
    g.saveSoon = true;
    g.bus?.emit('collection');
    g.bus?.emit('pets');
    return true;
  }

  /** Have an owned pet follow you (it replaces any other). */
  summon(id) {
    if (!this.owned[id]) return false;
    this.active = id;
    this.follower = null;   // placed beside you on the next tick
    this.tick();
    this.game.bus?.emit('pets');
    this.game.saveSoon = true;
    return true;
  }
  dismiss() {
    this.active = null;
    this.follower = null;
    this.game.bus?.emit('pets');
    this.game.saveSoon = true;
  }

  /** Each tick: the pet steps into the tile you just left, so it trails a step
   *  behind; it hops straight to you after a teleport or if it gets left far behind. */
  tick() {
    const g = this.game, p = g.player;
    if (!this.active || !p) { this.follower = null; return; }
    const at = { x: p.x, y: p.y };
    const last = this._trail[this._trail.length - 1];
    if (!last || last.x !== at.x || last.y !== at.y) { this._trail.push(at); if (this._trail.length > 6) this._trail.shift(); }
    let f = this.follower;
    if (!f || f.id !== this.active || chebyshev(f.x, f.y, at.x, at.y) > 8) {
      const spot = this._beside(at);
      f = this.follower = { id: this.active, x: spot.x, y: spot.y, fx: 1 };
      this._trail = [at];
      return;
    }
    if (chebyshev(f.x, f.y, at.x, at.y) <= 1 && !(f.x === at.x && f.y === at.y)) return;   // close enough: sit
    // Walk to the tile you were on before this one (or beside you when you stand on it).
    const prev = this._trail.length >= 2 ? this._trail[this._trail.length - 2] : this._beside(at);
    if (prev.x !== f.x) f.fx = prev.x < f.x ? -1 : 1;
    f.x = prev.x; f.y = prev.y;
  }

  /** A free tile next to `at` (behind you if it can), else `at` itself. */
  _beside(at) {
    const w = this.game.world, face = this.game.player?.facing || { dx: 1, dy: 0 };
    const dirs = [[-Math.sign(face.dx) || -1, -Math.sign(face.dy)], [-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]];
    for (const [dx, dy] of dirs) {
      const x = at.x + dx, y = at.y + dy;
      if ((dx || dy) && w && !w.isBlocked?.(x, y)) return { x, y };
    }
    return { x: at.x, y: at.y };
  }

  serialize() { return { owned: this.owned, active: this.active }; }
  load(d) {
    this.owned = {}; this.active = null; this.follower = null;
    if (!d || typeof d !== 'object') return;
    if (d.owned && typeof d.owned === 'object') for (const [id, n] of Object.entries(d.owned)) if (PET_BY_ID[id] && typeof n === 'number' && n > 0) this.owned[id] = Math.floor(n);
    if (typeof d.active === 'string' && this.owned[d.active]) this.active = d.active;
  }
}
