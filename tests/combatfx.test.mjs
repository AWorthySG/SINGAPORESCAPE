// Combat feel (render/combatfx.js, render/shadows.js): which impact each weapon
// makes, spell bursts by element, crit stars, the Epic+ light column, the
// effect pool's cap, milestone level-ups, the drop bounce, sun shadows and
// the Reduce motion setting. Pure parts are tested directly; the game hooks
// through a headless Game.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ALL_WEAPON_TYPES } from '../src/data/items.js';
import { SPELLS } from '../src/data/magic.js';
import { RARITY, QUALITY } from '../src/game/loot.js';
import {
  CombatFx, FX_KIND, IMPACT_KINDS, MAX_FX, MAX_FX_LOW, MAX_EFFECTS, impactKind, elementForTint, flightMs, hasLightColumn,
  isMilestoneLevel, dropArc, keepLive, hitImpact, hitsplatFx, DROP_ARC_MS,
} from '../src/render/combatfx.js';
import { sunShadow, footfall } from '../src/render/shadows.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const freshGame = (cls = 'swordsman') => {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
};
const liveSlots = (fx) => fx.slots.slice(0, fx.live);
const kinds = (fx) => new Set(liveSlots(fx).map((s) => s.k));

// A stand-in game holding just what the hit hooks read.
function fakeGame(weaponType, mode) {
  const at = (x, y) => ({ renderCenter: () => ({ x, y }), maxHp: 1000 });
  return { cfx: new CombatFx(), player: at(100, 100), weaponType: () => weaponType, combatMode: () => mode, maxHp: () => 100, lowFx: false, target: at(196, 100) };
}

// ---------------- Impact by weapon ----------------
test('every weapon type maps to an impact: blades slash, blunt thumps, bows puncture, guns trace, magic bursts, whips crack', () => {
  for (const t of ALL_WEAPON_TYPES) assert.ok(IMPACT_KINDS.includes(impactKind(t)), `${t} has an impact`);
  for (const t of ['dagger', 'sword', 'scimitar', 'katana', 'battleaxe', '2h_sword', 'claws', 'halberd']) assert.equal(impactKind(t), 'blade', t);
  for (const t of ['mace', 'warhammer']) assert.equal(impactKind(t), 'blunt', t);
  for (const t of ['shortbow', 'longbow', 'crossbow', 'shuriken']) assert.equal(impactKind(t), 'pierce', t);
  for (const t of ['pistol', 'rifle']) assert.equal(impactKind(t), 'bullet', t);
  for (const t of ['staff', 'wand', 'orb']) assert.equal(impactKind(t), 'magic', t);
  assert.equal(impactKind('whip'), 'whip');
  assert.equal(impactKind(null, 'melee'), 'blunt', 'bare fists thump');
  assert.equal(impactKind(null, 'magic'), 'magic');
  // Each spell's tint gives back its element.
  for (const s of SPELLS) assert.equal(elementForTint(s.tint), s.element);
  assert.equal(elementForTint('#123456'), null);
});

test('the hit hook spawns each weapon kind\'s own pieces', () => {
  const run = (wt, mode, color = '#fff2b0') => { const g = fakeGame(wt, mode); hitImpact(g, g.target, color); return g.cfx; };
  // Blades: a sticker slash arc.
  assert.ok(kinds(run('sword', 'melee')).has(FX_KIND.ARC));
  // Blunt: an impact ring, a flattened ring on the ground and dust clouds; no slash arc.
  const blunt = run('mace', 'melee');
  assert.ok(kinds(blunt).has(FX_KIND.CLOUD) && !kinds(blunt).has(FX_KIND.ARC));
  assert.ok(liveSlots(blunt).some((s) => s.k === FX_KIND.RING && s.sq < 1), 'a ground ring');
  // Arrows: puncture sparks that wait for the arrow's flight.
  const bow = run('longbow', 'ranged');
  assert.ok(kinds(bow).has(FX_KIND.SPARK));
  assert.ok(liveSlots(bow).every((s) => s.delay >= flightMs('pierce', 96) - 1), 'lands with the arrow');
  // Bullets: a tracer at once, and the pop when the shot arrives.
  const gun = run('pistol', 'ranged');
  const tracer = liveSlots(gun).find((s) => s.k === FX_KIND.TRACER);
  assert.ok(tracer && tracer.delay === 0 && tracer.ex === 196, 'tracer from muzzle to target');
  assert.ok(liveSlots(gun).some((s) => s.k === FX_KIND.RING && s.delay > 0), 'the pop waits for the bullet');
  // Whips: two rings, the second just after the first.
  const whip = run('whip', 'dance');
  const rings = liveSlots(whip).filter((s) => s.k === FX_KIND.RING);
  assert.equal(rings.length, 2);
  assert.ok(rings[1].delay > rings[0].delay);
  // Magic: a burst by element, with an enchanted glow.
  const tint = (el) => SPELLS.find((s) => s.element === el).tint;
  const fire = run('staff', 'magic', tint('fire'));
  assert.ok(kinds(fire).has(FX_KIND.GLOW));
  assert.ok(liveSlots(fire).some((s) => s.k === FX_KIND.DOT && s.g < 0), 'embers float up');
  assert.ok(liveSlots(run('staff', 'magic', tint('water'))).some((s) => s.k === FX_KIND.DOT && s.g > 0), 'droplets fall back');
  assert.ok(kinds(run('wand', 'magic', tint('earth'))).has(FX_KIND.CHIP), 'earth chips');
  assert.ok(kinds(run('wand', 'magic', tint('wind'))).has(FX_KIND.SWIRL), 'wind swirls');
});

test('a melee blow\'s impact is held for the hero\'s strike; the real game spawns it on a hit', () => {
  const g = fakeGame('sword', 'melee');
  hitImpact(g, g.target, '#fff2b0');
  assert.ok(liveSlots(g.cfx).every((s) => s.fresh));
  g.cfx.armFresh(150);
  assert.ok(liveSlots(g.cfx).every((s) => !s.fresh && s.delay >= 150));
  // Held pieces don't age until they show.
  const life = g.cfx.slots[0].life;
  g.cfx.update(100);
  assert.equal(g.cfx.slots[0].life, life);

  const game = freshGame('swordsman');
  const npc = game.spawnNpc('goblin', game.player.x + 1, game.player.y, { temporary: true, wander: 0 });
  game.spawnHitSparks(npc, '#fff2b0');
  assert.ok(kinds(game.cfx).has(FX_KIND.ARC), 'a swordsman\'s hit cuts a slash arc');
  const before = game.cfx.live;
  game.spawnHitSparks(game.player, '#ff5a5a');
  assert.equal(game.cfx.live, before, 'being hit yourself spawns no weapon impact');
});

test('crits burst into cartoon stars; big hits and hard knocks pulse the screen edge', () => {
  const g = fakeGame('sword', 'melee');
  hitsplatFx(g, g.target, 50, { crit: true });
  assert.ok(kinds(g.cfx).has(FX_KIND.STAR), 'crit stars');
  assert.equal(g.cfx.pulseT, 0, 'a modest crit doesn\'t pulse');
  hitsplatFx(g, g.target, 400, {});
  assert.ok(g.cfx.pulseT > 0 && g.cfx.pulseCol === 'big', 'a hit for a quarter of its life pulses gold');
  const h = fakeGame('sword', 'melee');
  hitsplatFx(h, h.player, 30, {});
  assert.ok(h.cfx.pulseT > 0 && h.cfx.pulseCol === 'hurt', 'taking 30% of your life pulses red');
  const n = fakeGame('sword', 'melee');
  hitsplatFx(n, n.target, 50, {});
  assert.equal(n.cfx.live, 0, 'a plain hit adds no stars');
});

// ---------------- Death, loot and level-ups ----------------
test('the light column stands only on Epic and Legendary drops', () => {
  assert.equal(hasLightColumn('common'), false);
  assert.equal(hasLightColumn('rare'), false);
  assert.equal(hasLightColumn('epic'), true);
  assert.equal(hasLightColumn('legendary'), true);
  assert.equal(hasLightColumn(undefined), false);
  for (const r of Object.keys(RARITY)) assert.equal(hasLightColumn(r), RARITY[r].rank >= RARITY.epic.rank, r);
  // Gear quality tiers: Fine drops are Rare (no column); Superior and up are Epic+.
  assert.equal(hasLightColumn(QUALITY.fine.rarity), false);
  for (const q of ['superior', 'epic', 'legendary', 'mythic']) assert.equal(hasLightColumn(QUALITY[q].rarity), true, q);
});

test('drops bounce out of the body in an arc and settle', () => {
  const a = dropArc(0);
  assert.equal(a.k, 0); assert.equal(a.h, 14, 'starts at the body\'s middle');
  const mid = dropArc(DROP_ARC_MS / 2);
  assert.ok(mid.h > 14 && mid.k > 0.5, 'arcs up and out');
  assert.ok(dropArc(DROP_ARC_MS).land > 0.9, 'squashes as it lands');
  assert.ok(dropArc(DROP_ARC_MS + 100).h > 0, 'one small bounce');
  const end = dropArc(5000);
  assert.equal(end.k, 1); assert.equal(end.h, 0); assert.equal(end.land, 0);
});

test('a monster\'s death pops a sticker poof; coins sparkle', () => {
  const game = freshGame('swordsman');
  const npc = game.spawnNpc('goblin', game.player.x + 1, game.player.y, { temporary: true, wander: 0 });
  game.cfx.clear();
  game._deathBurst(npc);
  assert.ok(kinds(game.cfx).has(FX_KIND.POOF) && kinds(game.cfx).has(FX_KIND.STAR));
  const fx = new CombatFx();
  fx.coinSparkle(10, 10, 100);
  assert.ok(kinds(fx).has(FX_KIND.TWINKLE));
});

test('milestone levels (10s, 50, 99, 100s) get a ring of light; normal levels stay modest', () => {
  for (const l of [10, 20, 50, 90, 99, 100, 120, 200]) assert.equal(isMilestoneLevel(l), true, `${l}`);
  for (const l of [1, 2, 9, 11, 49, 51, 98, 101]) assert.equal(isMilestoneLevel(l), false, `${l}`);
  const game = freshGame('swordsman');
  game.cfx.clear();
  game.tickCount += 5;
  game.bus.emit('levelup', { skill: 'attack', level: 51 });
  assert.ok(!kinds(game.cfx).has(FX_KIND.RAY), 'no rays for an ordinary level');
  game.tickCount += 5;
  game.bus.emit('levelup', { skill: 'attack', level: 50 });
  assert.ok(kinds(game.cfx).has(FX_KIND.RAY) && kinds(game.cfx).has(FX_KIND.RING), 'rays and a ring of light at 50');
});

// ---------------- Pool and cap ----------------
test('effects come from a fixed pool with a hard cap, and nothing new is made per frame', () => {
  const fx = new CombatFx();
  const objs = new Set(fx.slots);
  for (let i = 0; i < 1000; i++) fx.impact('blunt', i, i, { crit: true });
  assert.ok(fx.live <= MAX_FX, `live ${fx.live} <= ${MAX_FX}`);
  assert.equal(fx.slots.length, objs.size);
  assert.ok(fx.slots.every((s) => objs.has(s)), 'the same slot objects are reused');
  fx.low = true;
  fx.clear();
  for (let i = 0; i < 1000; i++) fx.impact('magic', i, i, { element: 'earth' });
  assert.ok(fx.live <= MAX_FX_LOW, 'low graphics has a lower cap');
  for (let i = 0; i < 20; i++) fx.update(100);
  assert.equal(fx.live, 0, 'spent effects free their slots');
  // The game's own effects list is tidied in place and capped too.
  const arr = [];
  for (let i = 0; i < 10; i++) arr.push({ life: i % 2 });
  const same = keepLive(arr);
  assert.equal(same, arr); assert.equal(arr.length, 5);
  const game = freshGame('swordsman');
  for (let i = 0; i < MAX_EFFECTS + 300; i++) game.effects.push({ type: 'ring', x: 0, y: 0, life: 5000, maxLife: 5000 });
  const list = game.effects;
  game.update(16);
  assert.equal(game.effects, list, 'kept in place');
  assert.ok(game.effects.length <= MAX_EFFECTS);
});

// ---------------- Shadows ----------------
test('shadows are long at dawn and dusk (leaning opposite ways), short at noon, faint at night', () => {
  const dawn = sunShadow(0.3), noon = sunShadow(0.5), dusk = sunShadow(0.7), night = sunShadow(0.02);
  assert.ok(Math.abs(noon.stretch - 1) < 0.01, 'short at noon');
  assert.ok(dawn.stretch > 1.8 && dusk.stretch > 1.8, 'long near the horizon');
  assert.ok(dawn.dx < -0.5 && dusk.dx > 0.5, 'cast west in the morning, east in the evening');
  assert.equal(night.day, 0);
  assert.ok(night.alpha < noon.alpha, 'fainter under the moon');
  assert.equal(footfall(3.5, false), 0);
  assert.ok(footfall(3, true) > 0.9 && footfall(3.5, true) < 0.05, 'squash as a foot lands');
});

// ---------------- Reduce motion ----------------
test('game.reduceMotion turns off shake, hit-stop and the screen-edge pulse', () => {
  const g = freshGame('swordsman');
  g.reduceMotion = true;
  g.addShake(5, 300);
  assert.equal(g.shakeT, 0, 'no shake');
  g.hitStop = 120; g.update(16);
  assert.equal(g.hitStop, 0, 'no hit-stop');
  const npc = g.spawnNpc('goblin', g.player.x + 1, g.player.y, { temporary: true, wander: 0 });
  hitsplatFx(g, npc, npc.maxHp, {});
  assert.equal(g.cfx.pulseT, 0, 'no edge pulse');
  // (The setting itself, and saving it, belong to Settings > Accessibility: see the UI polish work.)
});
