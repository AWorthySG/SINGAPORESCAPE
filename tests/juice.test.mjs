// Juice (render/juice.js, render/elementfx.js and the pooled pieces in
// combatfx.js): the screen shake scales with the hit and is capped, the Screen
// shake setting and Reduce motion are respected (and saved), the hit-stop
// slows only the sprite struck, the effect pool stays pooled and bounded under
// a flood, the element table falls back for elements it doesn't know, loot
// rarity maps to the right glow, and damage numbers pop in and settle.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { saveGame, clearSave } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { RARITY } from '../src/game/loot.js';
import { CombatFx, FX_KIND, MAX_FX, MAX_FX_LOW, attackElement, juicePop } from '../src/render/combatfx.js';
import { ELEMENT_FX, elementFx, spawnElement } from '../src/render/elementfx.js';
import {
  shakeFor, SHAKE_CAP, shakeAllowed, hitStopFor, HIT_STOP_CAP, HIT_STOP_SLOW, spriteDt, squashFor,
  splatMotion, lootGlow, RARITY_GLOW, juiceHit, noteAbility,
} from '../src/render/juice.js';

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
const foe = (g, dx = 1) => g.spawnNpc('goblin', g.player.x + dx, g.player.y, { temporary: true, wander: 0 });
const liveKinds = (fx) => new Set(fx.slots.slice(0, fx.live).map((s) => s.k));

// ---------------- Screen shake ----------------
test('the screen shake grows with the hit, crits thump harder, and it is capped', () => {
  assert.equal(shakeFor(1, 1000), null, 'a scratch does not shake');
  assert.equal(shakeFor(0, 100), null);
  assert.equal(shakeFor(500, 1000, { aoe: true }), null, 'splash hits never shake');
  const mid = shakeFor(300, 1000), big = shakeFor(700, 1000);
  assert.ok(mid && big && big.mag > mid.mag && big.ms > mid.ms, 'a bigger share of its life, a bigger shake');
  const crit = shakeFor(300, 1000, { crit: true });
  assert.ok(crit.mag > mid.mag, 'a crit adds a thump');
  assert.ok(shakeFor(10, 1000, { crit: true }), 'even a small crit shakes');
  for (const d of [1e3, 1e6, 1e9]) {
    const s = shakeFor(d, 100, { crit: true, mega: true });
    assert.ok(s.mag <= SHAKE_CAP, `capped at ${SHAKE_CAP}`);
  }
  // In the game: a crit's shake is scaled from the hit and never above the cap.
  const g = freshGame(), n = foe(g);
  g.addHitsplat(n, n.maxHp * 50, { crit: true, critX: 4 });
  assert.ok(g.shakeT > 0 && g.shakeMag > 0 && g.shakeMag <= SHAKE_CAP);
});

test('the Screen shake setting and Reduce motion turn the shake off, and the setting is saved', () => {
  const g = freshGame(), n = foe(g);
  assert.equal(g.screenShake, true, 'on by default');
  assert.equal(shakeAllowed(g), true);
  g.screenShake = false;
  g.addHitsplat(n, n.maxHp, { crit: true, critX: 2, noMerge: true });
  assert.equal(g.shakeT, 0, 'Screen shake off: no shake');
  g.screenShake = true; g.reduceMotion = true;
  g.addHitsplat(n, n.maxHp, { crit: true, critX: 2, noMerge: true });
  assert.equal(g.shakeT, 0, 'Reduce motion: no shake');
  g.reduceMotion = false;
  g.addHitsplat(n, n.maxHp, { crit: true, critX: 2, noMerge: true });
  assert.ok(g.shakeT > 0, 'both allowed: it shakes');
  // Saved and loaded; a save from before the setting keeps it on.
  g.screenShake = false; saveGame(g);
  const again = new Game(); again.start();
  assert.equal(again.screenShake, false, 'kept off');
  const data = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete data.settings.screenShake;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const old = new Game(); old.start();
  assert.equal(old.screenShake, true, 'older saves: on');
});

// ---------------- Hit-stop and squash ----------------
test('a crit freezes only the sprite struck: the world, and the game, carry on', () => {
  const g = freshGame(), a = foe(g, 1), b = foe(g, -1);
  g.playMs = 10000;
  g.addHitsplat(a, Math.ceil(a.maxHp / 2), { crit: true, critX: 2 });
  assert.equal(g.hitStop, 0, 'no whole-world freeze');
  assert.ok(a.stopUntil > a.stopFrom && a.stopUntil - a.stopFrom <= HIT_STOP_CAP, 'the struck sprite stops, capped');
  assert.equal(b.stopUntil, undefined, 'its neighbour does not');
  const mid = (a.stopFrom + a.stopUntil) / 2;
  assert.equal(spriteDt(a, 16, mid), 16 * HIT_STOP_SLOW, 'slowed during its stop');
  assert.equal(spriteDt(a, 16, a.stopUntil + 1), 16, 'and back to speed after');
  assert.equal(spriteDt(b, 16, mid), 16);
  // Ticks run on through it.
  const t0 = g.tickCount;
  for (let i = 0; i < 80; i++) g.update(16);
  assert.ok(g.tickCount > t0, 'game ticks carry on');
  assert.equal(hitStopFor(0.05, false), 0, 'an ordinary small hit does not stop anything');
  assert.ok(hitStopFor(1, true) <= HIT_STOP_CAP);
  // Reduce motion: no stop at all.
  const c = foe(g, 2); g.reduceMotion = true;
  g.addHitsplat(c, c.maxHp, { crit: true, critX: 2 });
  assert.equal(c.stopUntil, undefined);
});

test('a struck monster squashes and wobbles as the blow lands, then settles', () => {
  const hit = squashFor(190, 1, 1), late = squashFor(5, 1, 1), none = squashFor(0, 1, 1);
  assert.ok(hit.sx > 1.1 && hit.sy < 0.9, 'squashed wide and short on impact');
  assert.ok(Math.abs(late.sx - 1) < 0.05 && Math.abs(late.rot) < 0.05, 'settled by the end of the flash');
  assert.deepEqual([none.sx, none.sy, none.rot], [1, 1, 0]);
  assert.ok(Math.abs(squashFor(150, 0.3, 1).sx - 1) < Math.abs(squashFor(150, 1, 1).sx - 1), 'a small hit squashes less');
  const g = freshGame(), n = foe(g);
  g.addHitsplat(n, n.maxHp, { crit: true, critX: 2 });
  assert.ok(n.squashK > 0 && n.squashK <= 1);
});

// ---------------- The pool ----------------
test('every juice effect comes from the fixed pool, which stays bounded under a flood', () => {
  const fx = new CombatFx();
  const slots = fx.slots, n0 = slots.length;
  for (let i = 0; i < 300; i++) {
    spawnElement(fx, ['fire', 'ice', 'lightning', 'earth', 'water', 'wind', 'poison', 'holy', 'shadow', 'banana'][i % 10], 100, 100, i % 3 === 0);
    fx.deathPoof(100, 100, 1.5);
    fx.levelPop(100, 100, 'Attack 42!', i % 2 === 0);
    fx.confetti(100, 100, 30);
    assert.ok(fx.live <= MAX_FX);
  }
  assert.equal(fx.slots, slots, 'the same slot array...');
  assert.equal(slots.length, n0, '...never grown');
  assert.equal(fx.live, MAX_FX, 'full, recycling the oldest');
  fx.low = true; fx.clear();
  for (let i = 0; i < 200; i++) fx.deathPoof(100, 100, 2);
  assert.ok(fx.live <= MAX_FX_LOW, 'a lower cap on low graphics (and when the governor trims)');
  for (let t = 0; t < 4000; t += 50) fx.update(50);
  assert.equal(fx.live, 0, 'all spent and freed');
  // The governor's trim counts as low graphics for new effects.
  const g = freshGame(); g.fxTrim = true; g.cfx.low = false;
  g.bus.emit('levelup', { skill: 'attack', level: 23 });
  assert.equal(g.cfx.low, true, 'the level-up hook trims while frames run slow');
});

// ---------------- Elements ----------------
test('the element table: every element has a look, and an unknown one falls back', () => {
  for (const el of ['fire', 'water', 'ice', 'lightning', 'earth', 'wind', 'nature', 'poison', 'holy', 'shadow']) {
    assert.ok(ELEMENT_FX[el], el);
    assert.notEqual(elementFx(el), ELEMENT_FX.arcane, `${el} has its own look`);
  }
  assert.equal(elementFx('banana'), ELEMENT_FX.arcane, 'an unknown element: the arcane fallback');
  assert.equal(elementFx(undefined), ELEMENT_FX.arcane);
  assert.equal(elementFx(null), ELEMENT_FX.arcane);
  assert.equal(elementFx('FIRE'), ELEMENT_FX.fire, 'any case');
  assert.equal(elementFx('frost'), ELEMENT_FX.ice, 'other names for the same element');
  assert.equal(elementFx('thunder'), ELEMENT_FX.lightning);
  // Each piece names a shape the pool can draw, and spawning one never throws.
  const names = new Set(['dot', 'chip', 'spark', 'cloud', 'twinkle', 'star', 'bolt', 'confetti', 'swirl', 'ray', 'arc']);
  for (const [el, e] of Object.entries(ELEMENT_FX)) {
    assert.match(e.col, /^#[0-9a-f]{6}$/i, el);
    for (const p of e.pieces) if (!p.ring) assert.ok(names.has(p.kind), `${el}: ${p.kind}`);
    const fx = new CombatFx(); spawnElement(fx, el, 50, 50);
    assert.ok(fx.live > 0, `${el} spawns pieces`);
  }
  const fx = new CombatFx(); spawnElement(fx, 'lightning', 0, 0);
  assert.ok(liveKinds(fx).has(FX_KIND.BOLT), 'lightning crackles');
  // The element comes from whatever combat passes, and falls back gracefully.
  const g = { _castElement: 'fire' };
  assert.equal(attackElement(g, '#000000', 'magic'), 'fire', 'the spell being cast');
  assert.equal(attackElement(g, '#000000', 'blade'), null, 'a plain sword has none');
  assert.equal(attackElement({ _hitElement: 'ice' }, '#000', 'blade'), 'ice', 'an element the game names for the hit');
  assert.equal(attackElement({}, '#123456', 'magic'), null);
});

// ---------------- Loot ----------------
test('loot rarity maps to the right glow: none for common, rising beams up to legendary', () => {
  assert.equal(lootGlow('common'), null);
  assert.equal(lootGlow(undefined), null);
  assert.equal(lootGlow('banana'), null, 'an unknown rarity counts as common');
  for (const r of ['rare', 'epic', 'legendary']) assert.equal(lootGlow(r).col, RARITY[r].color, `${r} glows in its rarity colour`);
  assert.ok(lootGlow('uncommon') && lootGlow('uncommon').beam === 0, 'uncommon: a glow, no beam');
  const order = ['uncommon', 'rare', 'epic', 'legendary'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(lootGlow(order[i]).beam > lootGlow(order[i - 1]).beam, `${order[i]} stands in a taller beam`);
    assert.ok(lootGlow(order[i]).glow >= lootGlow(order[i - 1]).glow);
  }
  assert.equal(lootGlow('legendary').sparkle, true);
  assert.ok(Object.values(RARITY_GLOW).filter((x) => x?.sparkle).length === 1, 'only legendary sparkles');
});

// ---------------- Damage numbers, abilities, level-ups ----------------
test('damage numbers spring in past full size, settle, hop sideways and fade', () => {
  const e = { dmg: 40, critX: 0, fan: 0.8, row: 0, life: 800 };
  const at = (age, life = 800) => splatMotion({ ...e, life }, age, {});
  assert.ok(at(0).scale < 0.5, 'starts small');
  assert.ok(at(85).scale > 1.15, 'overshoots');
  assert.equal(at(400).scale, 1, 'settles');
  assert.ok(at(400).dx > 0 && at(400).dy < at(0).dy, 'drifts to its side and rises');
  assert.ok(splatMotion({ ...e, fan: -0.8 }, 400, {}).dx < 0, 'its neighbour drifts the other way');
  assert.ok(at(700, 100).alpha < 0.5, 'fades out at the end');
  const crit = splatMotion({ ...e, critX: 2 }, 85, {});
  assert.ok(crit.scale > at(85).scale && crit.rot !== 0, 'crits pop bigger, with a tilt');
  assert.ok(juicePop(1000) === 1 && juicePop(-5) === 0);
});

test('an ability hit gets a swoosh, an ultimate a flourish with its name, once per blow', () => {
  const g = freshGame(), n = foe(g);
  noteAbility(g, { tier: 'ultimate', name: 'Blade Storm' });
  g.cfx.clear();
  juiceHit(g, n, 30, {});
  const labels = g.cfx.slots.slice(0, g.cfx.live).filter((s) => s.k === FX_KIND.LABEL);
  assert.equal(labels.length, 1);
  assert.equal(labels[0].txt, 'Blade Storm!');
  assert.ok(liveKinds(g.cfx).has(FX_KIND.RAY), 'rays of the flourish');
  const live = g.cfx.live;
  juiceHit(g, n, 30, {});
  assert.equal(g.cfx.live, live, 'only on the first hit of the blow');
  noteAbility(g, { tier: 'basic', name: 'Slash' }); g.cfx.clear();
  juiceHit(g, n, 30, {});
  assert.ok(liveKinds(g.cfx).has(FX_KIND.ARC) && !liveKinds(g.cfx).has(FX_KIND.LABEL), 'a plain ability: the swoosh, no name');
  noteAbility(g, null); g.cfx.clear();
  juiceHit(g, n, 30, {});
  assert.ok(!liveKinds(g.cfx).has(FX_KIND.ARC), 'a basic attack: none');
});

test('every level-up gets stars, confetti and a "<Skill> <level>!" sticker; a kill gets confetti', () => {
  const g = freshGame();
  g.cfx.clear();
  g.bus.emit('levelup', { skill: 'attack', level: 23 });
  const k = liveKinds(g.cfx);
  assert.ok(k.has(FX_KIND.STAR) && k.has(FX_KIND.CONFETTI) && k.has(FX_KIND.LABEL));
  assert.ok(g.cfx.slots.slice(0, g.cfx.live).some((s) => s.k === FX_KIND.LABEL && s.txt === 'Attack 23!'));
  g.cfx.clear();
  g.cfx.deathPoof(0, 0, 1);
  assert.ok(liveKinds(g.cfx).has(FX_KIND.CONFETTI) && liveKinds(g.cfx).has(FX_KIND.POOF), 'the POOF stays, with sticker confetti');
});
