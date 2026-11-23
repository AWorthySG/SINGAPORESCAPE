// The Monk (the owner's ask: "fights with his bare knuckles and palms, make the
// weapon of choice monk knuckles and gloves"): monk knuckles in the main hand,
// monk gloves in the off-hand, no shields, Chi that builds with every blow (more
// damage, a heal when it overflows) and a little dodge.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { CLASS_BY_ID, noShieldMsg, NO_SHIELD_MSG, SECONDARY_WEAPON } from '../src/data/classes.js';
import { LATE_SIGS, SIGNATURE_CLASS } from '../src/data/bossWeapons.js';
import { canDualPair, dualType } from '../src/game/equipment.js';
import { CHI, MONK_DODGE, chiStacks } from '../src/game/monk.js';
import { classPerks } from '../src/game/classperks.js';
import { codexEntry } from '../src/game/codex.js';
import { saveGame, loadGame } from '../src/game/save.js';
import { damageMult, maxHitNow } from '../src/game/statsheet.js';
import { fakeStorage } from '../tools/balance/common.mjs';
import { xpForLevel } from '../src/data/xp.js';

function mk(cls = 'monk') {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.said = []; g.msg = (m) => g.said.push(m);
  const t = new NPC('goblin', g.player.x + 1, g.player.y, 0, {});
  t.hp = t.maxHp = 1e9; t.def = { ...t.def, aggressive: false, maxHit: 0 };
  g.npcs = [t];
  return { g, t };
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('the Monk: a melee class with monk knuckles, monk gloves as its second weapon, in scout leather', () => {
  const c = CLASS_BY_ID.monk;
  assert.equal(c.weapon, 'knuckles'); assert.equal(c.style, 'melee');
  assert.equal(SECONDARY_WEAPON.monk, 'monk_gloves');
  assert.equal(ITEMS.bronze_knuckles.name, 'Bronze monk knuckles');
  assert.equal(ITEMS.eternal_monk_gloves.name, 'Eternal monk gloves');
  // One dual-wield kind, either way round.
  assert.equal(dualType('rune_knuckles'), 'knuckles'); assert.equal(dualType('rune_monk_gloves'), 'knuckles');
  assert.ok(canDualPair('rune_knuckles', 'bronze_monk_gloves') && canDualPair('bronze_monk_gloves', 'rune_knuckles'));
  assert.ok(!canDualPair('rune_knuckles', 'rune_dagger'));
});

test('a new Monk starts with knuckles in the main hand and monk gloves in the off-hand, and holds no shield', () => {
  const { g } = mk();
  assert.equal(g.equipment.get('weapon'), 'bronze_knuckles');
  assert.equal(g.equipment.get('shield'), 'bronze_monk_gloves');
  assert.ok(g.equipment.isDualWielding());
  assert.equal(g.equipment.get('body'), 'leather_body');
  g.inventory.add('bronze_kiteshield', 1);
  g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'bronze_kiteshield'));
  assert.equal(g.equipment.get('shield'), 'bronze_monk_gloves', 'no shield goes on');
  assert.equal(g.said.at(-1), noShieldMsg('monk'));
  assert.match(noShieldMsg('monk'), /Monks fight with knuckles and gloves/);
  assert.equal(noShieldMsg('ninja'), NO_SHIELD_MSG, 'the Ninja keeps its own words');
});

test('new monk gloves go on the off-hand; better knuckles replace the main hand\'s', () => {
  const { g } = mk();
  for (const s of ['attack', 'strength', 'defence']) g.skills.xp[s] = xpForLevel(40);
  g.inventory.add('rune_monk_gloves', 1);
  g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'rune_monk_gloves'));
  assert.equal(g.equipment.get('shield'), 'rune_monk_gloves', 'gloves to the off-hand');
  assert.equal(g.equipment.get('weapon'), 'bronze_knuckles');
  g.inventory.add('rune_knuckles', 1);
  g.equipItem(g.inventory.slots.findIndex((s) => s?.id === 'rune_knuckles'));
  assert.equal(g.equipment.get('weapon'), 'rune_knuckles', 'knuckles to the main hand');
  assert.equal(g.equipment.get('shield'), 'rune_monk_gloves', 'the gloves stay on');
  assert.ok(g.inventory.has('bronze_knuckles') && g.inventory.has('bronze_monk_gloves'), 'the old pair back in the pack');
});

test('Equip best puts monk gloves, not a second pair of knuckles, in the off-hand', () => {
  const { g } = mk();
  for (const s of ['attack', 'strength', 'defence']) g.skills.xp[s] = xpForLevel(60);
  g.equipment.clearSlot('shield');
  for (const id of ['dragon_knuckles', 'dragon_knuckles', 'dragon_monk_gloves']) g.inventory.add(id, 1);
  g.equipBest();
  assert.equal(g.equipment.get('weapon'), 'dragon_knuckles');
  assert.equal(g.equipment.get('shield'), 'dragon_monk_gloves', 'the gloves strike on the knuckles\' beat and hit harder');
});

test('each hand strikes with its own weapon: the palm strike follows every punch', () => {
  const { g, t } = mk();
  const hands = [];
  const apply = g._applyPlayerHit.bind(g);
  g._applyPlayerHit = (npc, dmg, opts) => { if (npc === t) hands.push(g._hand); return apply(npc, dmg, opts); };
  g.player.attackCooldown = 0; g.doPlayerAttack(t);
  assert.deepEqual(hands, ['main', 'off'], 'a punch, then the palm');
  const want = maxHitNow(g, { npc: t });
  assert.ok(want.off > 0, 'the Stats tab shows the palm strike');
});

test('Chi: one a tick from landed blows, +3% damage each, overflowing at 10 into a heal, fading when idle', () => {
  const { g, t } = mk();
  const base = g._offensiveMods(t, 'melee').dmgM;
  g._applyPlayerHit(t, 5); g._applyPlayerHit(t, 5);
  assert.equal(chiStacks(g), 1, 'a flurry within one tick builds one');
  for (let i = 0; i < 3; i++) { g.playMs += CHI.everyMs; g._applyPlayerHit(t, 5); }
  assert.equal(chiStacks(g), 4);
  assert.ok(near(g._offensiveMods(t, 'melee').dmgM / base, 1 + 4 * CHI.per), 'x1.12 at 4 Chi');
  // The Stats tab agrees.
  assert.ok(damageMult(g, 'melee', { npc: t }).parts.some(([label]) => /^Chi 4\/10/.test(label)));
  // Overflow: a heal of 5% and back down to 5.
  g.player.hp = 10;
  for (let i = 0; i < 6; i++) { g.playMs += CHI.everyMs; g._applyPlayerHit(t, 5); }
  assert.equal(chiStacks(g), CHI.keep + 0, 'overflowed at 10, back to 5');
  assert.equal(g.player.hp, 10 + Math.max(1, Math.round(g.maxHp() * CHI.heal)), 'healed 5% of max life');
  // Left alone it fades, and the tick says so.
  let said = 0; g.bus.on('chi', () => said++);
  g.tickCount += CHI.fadeTicks + 1;
  assert.equal(chiStacks(g), 0);
  g.doTick();
  assert.equal(g.chi, 0); assert.ok(said > 0, 'the readout hears it fade');
  // Area hits build none, and nobody else has Chi.
  g._applyPlayerHit(t, 5, { aoe: true }); assert.equal(chiStacks(g), 0);
  const s = mk('swordsman'); s.g._applyPlayerHit(s.t, 5); assert.equal(chiStacks(s.g), 0);
});

test('a Monk dodges a share of blows (half as often against heavy ones)', () => {
  const { g, t } = mk();
  t.def = { ...t.def, maxHit: 50 };
  const rnd = Math.random;
  try {
    g.player.hp = g.maxHp();
    Math.random = () => MONK_DODGE - 0.01;   // just under the dodge chance: dodged
    g.resolveNpcAttack(t);
    assert.equal(g.player.hp, g.maxHp(), 'dodged');
    Math.random = () => MONK_DODGE / 2 + 0.01;   // a heavy blow is only dodged half as often
    g.resolveNpcAttack(t, { heavy: true });
    assert.ok(g.player.hp < g.maxHp(), 'the heavy blow lands');
  } finally { Math.random = rnd; }
  const s = mk('swordsman'); s.t.def = { ...s.t.def, maxHit: 50 };
  try { Math.random = () => MONK_DODGE - 0.01; s.g.player.hp = s.g.maxHp(); s.g.resolveNpcAttack(s.t, { heavy: true }); } finally { Math.random = rnd; }
  assert.ok(s.g.player.hp < s.g.maxHp(), 'a Swordsman has no such dodge');
});

test('Inner Focus makes Chi overflow at once; Hundred Fists strikes everything within 3 tiles', () => {
  const { g, t } = mk();
  g.attackNpc(t); g.player.attackCooldown = 99;
  g.adrenaline = 100; g.player.hp = 10;
  g.activateAbility('inner_focus');
  // Overflowed (back to 5), then its palm strike landed and built one more.
  assert.ok(chiStacks(g) >= CHI.keep && chiStacks(g) <= CHI.keep + 1, `Chi ${chiStacks(g)}`);
  assert.ok(g.player.hp > 10, 'and healed');
  assert.ok(t.hp < 1e9, 'its palm strike landed at once');
  // Hundred Fists: the ultimate, an area attack, and Chi overflows again.
  const u = mk();
  u.g.abilityUnlocked = () => true;
  const other = new NPC('goblin', u.t.x + 3, u.t.y, 0, {});   // 3 tiles from the target: past any cleave
  other.hp = other.maxHp = 1e9; other.def = { ...other.def, aggressive: false, maxHit: 0 };
  other.target = u.g.player;   // already on you: an area hit never wakes new foes while you're hurt
  u.g.npcs.push(other);
  u.g.attackNpc(u.t); u.g.player.attackCooldown = 0;
  u.g.doPlayerAttack(u.t);
  assert.equal(other.hp, 1e9, 'a plain punch leaves it alone');
  u.g.adrenaline = 100; u.g.player.hp = 10; u.g.playMs += CHI.everyMs;
  u.g.activateAbility('hundred_fists');
  u.g.player.attackCooldown = 0; u.g.doPlayerAttack(u.t);
  assert.ok(other.hp < 1e9, 'the foe 3 tiles from the target was struck too');
  assert.ok(u.g.player.hp > 10 && chiStacks(u.g) <= CHI.keep + 1, 'Chi overflowed (a heal, back down)');
});

test('the Monk\'s skills, passives and perks are all there', () => {
  const { g } = mk();
  assert.deepEqual(g.currentAbilities().map((a) => a.id), ['twin_fists', 'inner_focus', 'deflecting_palms', 'second_wind', 'hundred_fists']);
  const perks = classPerks('monk');
  assert.match(perks[0].text, /palm-strike/);
  assert.ok(perks.some((p) => p.label === 'Dual wield' && /monk gloves on the other hand/.test(p.text)));
  assert.ok(perks.some((p) => p.label === 'Critical' && /every pair of monk knuckles/.test(p.text)));
});

test('the Monk came after the signature deal: three extra weapons of its own, and no boss changed hands', () => {
  const mine = LATE_SIGS.filter((a) => a.classId === 'monk');
  assert.equal(mine.length, 3);
  for (const a of mine) {
    assert.equal(ITEMS[a.id].equip.weaponType, 'knuckles');
    assert.equal(ITEMS[a.id].signature.classId, 'monk');
  }
  assert.ok(mine.some((a) => ITEMS[a.id].signature.ascended), 'one is ascended, stronger than eternal');
  assert.ok(!Object.values(SIGNATURE_CLASS).includes('monk'), 'no boss\'s own weapon became a Monk\'s');
  // The Codex lists each with its boss, after the boss's own weapon.
  const { g } = mk();
  for (const a of mine) {
    g.kills = { ...(g.kills || {}), [a.boss]: 1 };
    const e = codexEntry(g, a.boss);
    assert.notEqual(e.signature.classId, 'monk', `${a.boss}'s own weapon is still another class's`);
    assert.ok(e.ascended?.some((x) => x.item === a.id && x.className === 'Monk'), `the Codex shows ${a.id}`);
  }
});

test('a Monk saves and loads: its class, knuckles and gloves come back; Chi starts afresh', () => {
  const { g, t } = mk();
  for (let i = 0; i < 3; i++) { g.playMs += CHI.everyMs; g._applyPlayerHit(t, 5); }
  assert.equal(chiStacks(g), 3);
  assert.ok(saveGame(g));
  const g2 = new Game(); g2.start();
  assert.ok(loadGame(g2));
  assert.equal(g2.jobClass, 'monk');
  assert.equal(g2.equipment.get('weapon'), 'bronze_knuckles');
  assert.equal(g2.equipment.get('shield'), 'bronze_monk_gloves');
  assert.ok(g2.equipment.isDualWielding());
  assert.equal(chiStacks(g2), 0, 'Chi is not saved (it fades in seconds anyway)');
});

test('the upgrade signal agrees with Equip best on monk gloves: weighed against the off-hand', async () => {
  const { wouldWear, pickGain } = await import('../src/game/bestpick.js');
  const { g } = mk();
  for (const s of ['attack', 'strength', 'defence']) g.skills.xp[s] = xpForLevel(60);
  g.inventory.add('rune_monk_gloves', 1); g.inventory.add('iron_monk_gloves', 1);
  const slot = (id) => g.inventory.slots.find((s) => s?.id === id);
  assert.equal(pickGain(g, slot('rune_monk_gloves')).slot, 'shield', 'gloves are judged as the off-hand\'s');
  assert.ok(wouldWear(g, slot('rune_monk_gloves')), 'better gloves show as an upgrade');
  g.equipBest();
  assert.equal(g.equipment.get('weapon'), 'bronze_knuckles');
  assert.equal(g.equipment.get('shield'), 'rune_monk_gloves', 'and Equip best wears them there');
  assert.ok(!wouldWear(g, slot('iron_monk_gloves')) && !wouldWear(g, slot('bronze_monk_gloves')), 'weaker gloves are no upgrade');
});
