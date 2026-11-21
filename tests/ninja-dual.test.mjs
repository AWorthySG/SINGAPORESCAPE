// Ninjas throw a shuriken from each hand: the off-hand one goes where a shield
// would (as a Pistoler's second gun does), and a Ninja holds no shield at all.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { freshGame } from '../tools/balance/common.mjs';
import { dummyDps, pickTargets } from '../tools/balance/classlab.mjs';
import { NPC } from '../src/game/npc.js';
import { Game } from '../src/game/game.js';
import { saveGame } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { canWear, NO_SHIELD_MSG } from '../src/data/classes.js';

const STAR = 'rune_shuriken';
const slotOf = (g, id) => g.inventory.slots.findIndex((s) => s?.id === id);
/** A level-80 character of `cls` with an empty pack, saying things into `said`. */
function hero(cls) {
  const g = freshGame(cls);
  for (const k of ['attack', 'strength', 'ranged', 'defence', 'hitpoints']) g.skills.xp[k] = xpForLevel(80);
  g.inventory.slots = g.inventory.slots.map(() => null);
  g.said = [];
  g.msg = (m) => g.said.push(m);
  return g;
}

test('a new Ninja starts with a shuriken in each hand and no shield', () => {
  const g = freshGame('ninja');
  const w = g.equipment.get('weapon');
  assert.match(w, /_shuriken$/);
  assert.equal(g.equipment.get('shield'), w);
  assert.ok(g.equipment.isDualWielding());
});

test('a Ninja cannot hold a shield, and is told why; other classes still can', () => {
  const g = hero('ninja');
  g.equipment.slots.shield = null;
  for (const id of ['wooden_shield', 'bronze_buckler']) {
    assert.equal(canWear('ninja', id), false);
    assert.equal(g._canEquipNow(id), false);
    assert.equal(g.unrelatedToClass(id), true, `${id} is sold off as gear for another class`);
    g.inventory.add(id, 1);
    g.equipItem(slotOf(g, id));
    assert.equal(g.equipment.get('shield'), null);
    assert.ok(slotOf(g, id) >= 0, 'the shield stays in the pack');
    assert.equal(g.said.at(-1), NO_SHIELD_MSG);
  }
  // Equip best never puts one on either.
  g.equipBest();
  assert.equal(g.equipment.get('shield'), null);
  for (const cls of ['swordsman', 'knight', 'pistoler']) {
    const k = hero(cls);
    k.equipment.slots.shield = null;
    if (cls === 'pistoler') k.equipment.slots.weapon = 'bronze_pistol';
    k.inventory.add('wooden_shield', 1);
    k.equipItem(slotOf(k, 'wooden_shield'));
    assert.equal(k.equipment.get('shield'), 'wooden_shield', `a ${cls} still holds a shield`);
  }
});

test('a shuriken goes in a Ninja\'s off-hand and throws its own shot every attack', () => {
  const g = hero('ninja');
  g.equipment.slots.weapon = STAR; g.equipment.slots.shield = null;
  g.inventory.add(STAR, 1);
  g.equipOffhand(slotOf(g, STAR));
  assert.equal(g.equipment.get('shield'), STAR);
  assert.ok(g.equipment.isDualWielding());
  assert.ok(g.dualMaxHits().off > 0);
  const p = g.player;
  const t = new NPC('goblin', p.x + 2, p.y, 0, { aggressive: false });
  t.maxHp = t.hp = 1e9; t.tick = () => {};
  g.npcs = [t];
  const hits = { main: 0, off: 0 };
  const apply = g._applyPlayerHit.bind(g);
  g._applyPlayerHit = (npc, dmg, opts = {}) => { if (npc === t && g._hand) hits[g._hand]++; return apply(npc, dmg, opts); };
  for (let i = 0; i < 20; i++) { p.attackCooldown = 0; g.doPlayerAttack(t); }
  assert.ok(hits.main >= 20, `main-hand throws: ${hits.main}`);
  assert.equal(hits.off, hits.main, 'one off-hand throw for each main-hand throw');
});

test('a saved Ninja holding a shield has it moved to the bank once; the off-hand is left empty', () => {
  const g = hero('ninja');
  g.equipment.slots.weapon = STAR;
  g.equipment.set('shield', 'wooden_shield');
  g.inventory.add(STAR, 1);   // a spare shuriken: not put on for them
  assert.ok(saveGame(g));
  const said = [];
  const g2 = new Game();
  g2.bus.on('chat', (m) => said.push(m.text));
  g2.start();
  assert.equal(g2.jobClass, 'ninja');
  assert.equal(g2.equipment.get('shield'), null);
  assert.equal(g2.bank.count('wooden_shield'), 1);
  assert.ok(slotOf(g2, STAR) >= 0, 'the spare shuriken stays in the pack');
  assert.equal(said.filter((m) => m.startsWith(NO_SHIELD_MSG)).length, 1);
  // Loading again changes nothing and says nothing more.
  assert.ok(saveGame(g2));
  const again = [];
  const g3 = new Game();
  g3.bus.on('chat', (m) => again.push(m.text));
  g3.start();
  assert.equal(g3.bank.count('wooden_shield'), 1);
  assert.equal(g3.equipment.get('shield'), null);
  assert.equal(again.filter((m) => m.startsWith(NO_SHIELD_MSG)).length, 0);
});

// Dual shurikens were balanced by bringing the shuriken's damage scale down
// (WEAPON_DMG_MULT, combat.js): the Ninja stays level with the Pistoler, the
// other dual-wielding ranged class (about 0.97 single target, 1.02 on bosses
// at level 100 before the change).
test('the dual-wielding Ninja stays level with the Pistoler on one target', () => {
  const L = 100, ticks = 100, ids = pickTargets(L);
  const dps = (cls, boss) => ids.reduce((s, id) => s + dummyDps(cls, L, [id], [[1, 0]], ticks, { boss }), 0) / ids.length;
  for (const boss of [false, true]) {
    const r = dps('ninja', boss) / dps('pistoler', boss);
    assert.ok(r >= 0.8 && r <= 1.25, `${boss ? 'boss' : 'single'}: Ninja at ${Math.round(r * 100)}% of the Pistoler`);
  }
});
