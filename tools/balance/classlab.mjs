// Class balance lab: one job class at one level, measured with the real game
// code headlessly. Shared by tools/balance/classes.mjs (the full table) and
// tests/balance.test.mjs (a quick guard).
//
// Set-up for a class at level L:
//  - its fighting skill at L (a Dancer's Agility and Ranged XP split evenly, so
//    its pooled dance level is L); Defence, Hitpoints and Prayer at L; every
//    class gets the same Agility (half of L's XP) for its attack-speed bonus;
//    stat points spent with spendAllStats();
//  - per slot, the best piece the class can wear at L by the game's own
//    Equip-best score (offenceFirstScore), weapon of the class's main type; boss
//    uniques and signature weapons left out; dual wielders hold two of the weapon;
//  - plenty of matching arrows and of every rune, and (Merchant) a billion coins;
//  - XP gain frozen, so a long fight doesn't level the character up mid-run.
// The fight is driven the way auto battle drives one (abilities, Merchant hires,
// spell choice) but pinned to the target, so auto battle can't wander off.
import { fakeStorage, seedRandom } from './common.mjs';
import { Game } from '../../src/game/game.js';
import { clearSave } from '../../src/game/save.js';
import { NPC } from '../../src/game/npc.js';
import { ITEMS, getItem } from '../../src/data/items.js';
import { getNpc, ALL_MONSTER_IDS } from '../../src/data/npcs.js';
import { CLASSES, CLASS_BY_ID } from '../../src/data/classes.js';
import { offenceFirstScore } from '../../src/game/gear.js';
import { EQUIP_SLOTS, canDualWield, isTwoHanded } from '../../src/game/equipment.js';
import { xpForLevel } from '../../src/data/xp.js';
import { SPELLS } from '../../src/data/magic.js';
import * as Mercs from '../../src/game/mercenary.js';

export const CLASS_IDS = CLASSES.map((c) => c.id);

// Boss uniques and signature weapons drop only from their own boss: left out.
const UNIQUES = new Set(['tiger_kris', 'merlion_blade', 'cursed_cutlass', 'seraph_blade', 'megalodon_jaw', 'granite_maul', 'void_blade', 'leviathan_trident', 'tiger_fang']);
const isUnique = (id) => UNIQUES.has(id) || !!ITEMS[id].signature;

const MONS = ALL_MONSTER_IDS.map((id) => ({ id, d: getNpc(id) })).filter((m) => m.d.attackable && !m.d.boss && !m.d.fixed);
/** Three monsters near the level: one weak to melee, one to ranged, one to magic. */
export function pickTargets(level) {
  const groups = [
    ['humanoid', 'beast', 'demon', 'spider', 'serpent', 'greenman'],
    ['bat', 'fowl', 'insect', 'mantis'],
    ['undead', 'ghost', 'reptile', 'drake'],
  ];
  return groups.map((sprites) => MONS.filter((m) => sprites.includes(m.d.sprite))
    .sort((a, b) => Math.abs(a.d.level - level) - Math.abs(b.d.level - level) || a.id.localeCompare(b.id))[0].id);
}

function arrowFor(level) {
  return level >= 300 ? 'eternal_arrow' : level >= 170 ? 'starmetal_arrow' : level >= 130 ? 'jade_arrow' : level >= 60 ? 'dragon_arrow'
    : level >= 40 ? 'rune_arrow' : level >= 30 ? 'adamant_arrow' : level >= 20 ? 'mithril_arrow' : level >= 5 ? 'steel_arrow' : 'iron_arrow';
}

// An open patch of wilderness (well away from town) to fight in.
let SPOT = null;
function wildSpot(g) {
  if (SPOT) return SPOT;
  for (let y = 150; y < 199; y++) for (let x = 90; x < 150; x++) {
    if (g.world.isBlocked(x, y) || g._worldBossTooNearTown(x, y)) continue;
    let open = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (g.world.inBounds(x + dx, y + dy) && !g.world.isBlocked(x + dx, y + dy)) open++;
    if (open >= 169) return (SPOT = { x, y });
  }
  throw new Error('no open spot');
}

/** A character of class `cls` kitted out at level L (see the notes above). */
export function setupClass(cls, L, seed = 20261112) {
  const C = CLASS_BY_ID[cls], style = C.style;
  seedRandom(seed);
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.msg = () => {};
  const x = xpForLevel(L), sx = g.skills.xp;
  for (const k of ['defence', 'hitpoints', 'prayer']) sx[k] = x;
  sx.agility = x / 2;
  if (style === 'melee') { sx.attack = x; if ('strength' in sx) sx.strength = x; }
  else if (style === 'ranged') sx.ranged = x;
  else if (style === 'magic') sx.magic = x;
  else if (style === 'dance') { sx.ranged = x / 2; sx.agility = x / 2; }
  const eq = g.equipment;
  for (const s of EQUIP_SLOTS) eq.slots[s] = null;
  const cands = {};
  for (const [id, it] of Object.entries(ITEMS)) {
    const e = it.equip;
    if (!e || it.tool || isUnique(id) || !g._canEquipNow(id)) continue;
    if (e.slot === 'weapon' && e.weaponType !== C.weapon) continue;
    (cands[e.slot] ||= []).push(id);
  }
  const best = (slot) => (cands[slot] || []).sort((a, b) => offenceFirstScore(b, eq, style) - offenceFirstScore(a, eq, style) || a.localeCompare(b))[0] || null;
  eq.slots.weapon = best('weapon');
  for (const s of EQUIP_SLOTS) if (s !== 'weapon' && s !== 'shield') eq.slots[s] = best(s);
  const w = eq.slots.weapon;
  if (canDualWield(w)) eq.slots.shield = w;
  else if (!isTwoHanded(w)) eq.slots.shield = best('shield');
  g.inventory.slots = g.inventory.slots.map(() => null);
  // Enough for a few minutes' fighting. (Not millions: slots hold 999 each, and
  // counting runes across thousands of slots every cast made casters crawl.)
  if (style === 'ranged' && !getItem(w).equip.noAmmo) g.inventory.add(arrowFor(L), 3e4);
  if (style === 'magic') {
    for (const r of new Set(SPELLS.flatMap((s) => Object.keys(s.runes || {})))) g.inventory.add(r, 3e4);
    g.player.spellAuto = true;
  }
  if (cls === 'merchant') g.inventory.add('coins', 1e9);
  g.spendAllStats?.();
  g.skills.addXp = () => 0;   // freeze progress
  g.player.hp = g.maxHp();
  g._perkCache?.clear();
  const spot = wildSpot(g);
  g.player.x = g.player.tx = spot.x; g.player.y = g.player.ty = spot.y; g.player.path = [];
  // Seed the dice again now the world is built, so the fights don't depend on how
  // many rolls building it took (one new townsperson used to reshuffle every fight).
  seedRandom(seed);
  return g;
}

/** Real (unscaled) life: big monsters show their life divided by hpScale. */
export const realHp = (n) => n.hp * (n.def.hpScale || 1);

function makeTarget(id, x, y, { boss = false, hp = 1e12 } = {}) {
  const t = new NPC(id, x, y, 0, { aggressive: false });
  t.def = { ...t.def, maxHp: hp, ...(boss ? { boss: true } : {}) };
  t.maxHp = t.hp = hp;
  t.tick = () => {};   // frozen: no wandering, no hitting back, no boss specials
  return t;
}

// One tick of what auto battle does mid-fight, pinned to `tgt`.
function fightTick(g, tgt) {
  const p = g.player;
  if (!p.action || p.action.type !== 'attack' || !p.action.npc?.alive) g.attackNpc(tgt);
  const a = p.action?.npc || tgt;
  if (g.jobClass === 'merchant' && g._autoHire) g._autoHire();
  else if (g.jobClass === 'merchant' && g.inventory.count('coins') >= Mercs.hireCost(g) * 3) g.hireMercenary();
  if (g.combatMode() === 'magic' && p.spellAuto) { const b = g._autoSpellFor(a); if (b) p.spell = b.id; }
  g._autoSkills(a);
  g.update(600);
}

/** Clear one fight's leftovers so the same character can start another: no
 *  allies, buffs, cooldowns or adrenaline carried over. (Quicker than building a
 *  new Game, which tests/balance.test.mjs relies on; the CLI builds fresh ones.) */
export function resetFight(g) {
  g.npcs = []; g.effects = []; g.hazards = [];
  g.buff = null; g.abilityCd = {}; g.adrenaline = 0; g.danceRhythm = 0; g.braceTicks = 0;
  g.killStreak = 0; g.armedAbility = null;
  // The lab measures the classes alone: forget earlier scenarios' kills, so codex
  // mastery (culling.js) earned in a kill-speed run doesn't add to the next
  // scenario's damage, and switch culling off so its extra loot rolls don't
  // shift the seeded dice between runs.
  g.kills = {}; g.culling = null;
  g.player.clearAction(); g.player.attackCooldown = 0;
  g.player.hp = g.maxHp();
  return g;
}

// A character for one scenario: `opts.game` (reset) if given, else a fresh one.
const charFor = (cls, L, opts) => (opts.game ? resetFight(opts.game) : setupClass(cls, L, opts.seed));

/** Damage per second (real HP) into frozen huge-life dummies laid out at `layout`
 *  offsets from the player, attacked in order. */
export function dummyDps(cls, L, ids, layout, ticks, opts = {}) {
  const g = charFor(cls, L, opts);
  const px = g.player.x, py = g.player.y;
  const targets = layout.map(([dx, dy], i) => makeTarget(ids[i % ids.length], px + dx, py + dy, opts));
  g.npcs = [...targets];
  const start = targets.reduce((s, t) => s + realHp(t), 0);
  for (let i = 0; i < ticks && g.player.alive; i++) {
    g.npcs = g.npcs.filter((n) => targets.includes(n) || n.ally);
    fightTick(g, targets.find((t) => t.alive && t.hp > 0));
  }
  return (start - targets.reduce((s, t) => s + realHp(t), 0)) / (ticks * 0.6);
}

/** Kill speed against a real monster: a fresh one is put in place the moment one
 *  dies. Returns real damage per second (capped by overkill, as real fights are). */
export function killDps(cls, L, id, ticks, opts = {}) {
  const g = charFor(cls, L, opts);
  const px = g.player.x, py = g.player.y;
  const mk = () => makeTarget(id, px + 1, py, { hp: getNpc(id).maxHp });
  let t = mk(); g.npcs = [t];
  let dmg = 0, kills = 0;
  for (let i = 0; i < ticks; i++) {
    g.npcs = g.npcs.filter((n) => n === t || n.ally);
    const before = realHp(t);
    fightTick(g, t);
    dmg += before - Math.max(0, realHp(t));
    if (!t.alive || t.hp <= 0) { kills++; t = mk(); g.npcs.push(t); }
  }
  return { dps: dmg / (ticks * 0.6), killsPerMin: kills / (ticks * 0.006) };
}

export const CROWD = [[1, 0], [2, 0], [1, 1], [1, -1], [2, 1]];

/** Every metric for one class at one level, each averaged over the three targets.
 *  opts: { ticks, targets (how many of the three), kill, single, boss, crowd, seed }. */
export function measureClass(cls, L, opts = {}) {
  const ticks = opts.ticks || 300, n = opts.targets || 3;
  const tg = pickTargets(L).slice(0, n);
  const avg = (f) => tg.reduce((s, id) => s + f(id), 0) / tg.length;
  const out = { cls, level: L, weapon: null };
  out.weapon = setupClass(cls, L, opts.seed).equipment.get('weapon');
  if (opts.kill !== false) out.kill = avg((id) => killDps(cls, L, id, ticks, opts).dps);
  if (opts.single !== false) out.single = avg((id) => dummyDps(cls, L, [id], [[1, 0]], ticks, opts));
  if (opts.boss !== false) out.boss = avg((id) => dummyDps(cls, L, [id], [[1, 0]], ticks, { ...opts, boss: true }));
  if (opts.crowd !== false) out.crowd = dummyDps(cls, L, tg, CROWD, Math.min(ticks, 200), opts);
  return out;
}
