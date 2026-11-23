// The Priest and the Zealot, the two casters added after the Monk. The Priest
// casts through orbs: its spells heal it a little and smite undead, spirits and
// demons, and its skills lift its blessings. The Zealot swings a censer: its
// spells leave holy fire burning (Magic XP), it hits harder the more hurt it is
// (Fervour) and two of its skills are paid for in life. Each is the other's
// second weapon; the Wizard and Sorcerer keep the orb as theirs.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game, WOUNDS } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave, saveGame, loadGame } from '../src/game/save.js';
import { ITEMS } from '../src/data/items.js';
import { CLASS_BY_ID, SECONDARY_WEAPON, ARMOUR_FAMILY, canWield, canWear } from '../src/data/classes.js';
import { LATE_SIGS, SIGNATURE_CLASS } from '../src/data/bossWeapons.js';
import { LIFE_COST_FLOOR } from '../src/data/abilities.js';
import { PRIEST, smite, spellLifesteal } from '../src/game/priest.js';
import { ZEALOT, HOLY_FIRE, fervour, orbShare } from '../src/game/zealot.js';
import { classPerks } from '../src/game/classperks.js';
import { codexEntry } from '../src/game/codex.js';
import { fakeStorage } from '../tools/balance/common.mjs';

function mk(cls, foe = 'goblin') {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.said = []; g.msg = (m) => g.said.push(m);
  const t = new NPC(foe, g.player.x + 1, g.player.y, 0, {});
  t.hp = t.maxHp = 1e9; t.def = { ...t.def, aggressive: false, maxHit: 0 };
  g.npcs = [t];
  return { g, t };
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
/** One attack on `t`: the damage of each blow that landed on it. */
function attack(g, t) {
  const landed = [], apply = g._applyPlayerHit;
  g._applyPlayerHit = function (n, dmg, opts) { if (n === t) landed.push(dmg); return apply.call(this, n, dmg, opts); };
  try { g.player.attackCooldown = 0; g.doPlayerAttack(t); } finally { delete g._applyPlayerHit; }
  return landed;
}

test('the Priest and the Zealot: casters in robes, orbs and censers each other\'s second weapon', () => {
  assert.deepEqual([CLASS_BY_ID.priest.weapon, CLASS_BY_ID.priest.style], ['orb', 'magic']);
  assert.deepEqual([CLASS_BY_ID.zealot.weapon, CLASS_BY_ID.zealot.style], ['censer', 'magic']);
  assert.equal(SECONDARY_WEAPON.priest, 'censer'); assert.equal(SECONDARY_WEAPON.zealot, 'orb');
  assert.equal(SECONDARY_WEAPON.wizard, 'orb'); assert.equal(SECONDARY_WEAPON.sorcerer, 'orb');   // unchanged
  assert.equal(ARMOUR_FAMILY.priest, 'robes'); assert.equal(ARMOUR_FAMILY.zealot, 'robes');
  assert.ok(!canWield('wizard', 'censer') && !canWield('priest', 'staff') && canWield('zealot', 'orb'));
  assert.equal(ITEMS.bronze_censer.name, 'Bronze censer');
  assert.equal(ITEMS.eternal_censer.equip.weaponType, 'censer');
  assert.equal(ITEMS.eternal_censer.equip.combatType, 'magic');
  // The starter kit: the class's own weapon, robes and runes, and room for a shield.
  for (const [cls, weapon] of [['priest', 'bronze_orb'], ['zealot', 'bronze_censer']]) {
    const { g } = mk(cls);
    assert.equal(g.equipment.get('weapon'), weapon);
    assert.equal(g.combatMode(), 'magic');
    assert.equal(g.equipment.get('body'), 'wizard_robe_top');
    assert.ok(g.inventory.count('air_rune') > 0 && g.inventory.count('mind_rune') > 0);
    assert.ok(canWear(cls, 'bronze_kiteshield'), `${cls}s can hold a shield`);
  }
});

test('a Priest\'s spells heal 8% of each hit; splashes and burns heal nothing; a Wizard\'s heal nothing', () => {
  const { g, t } = mk('priest');
  g.player.hp = 1;
  const [dmg] = attack(g, t);
  assert.ok(dmg > 0, 'the spell landed');
  assert.equal(g.player.hp, Math.min(g.maxHp(), 1 + Math.max(1, Math.round(dmg * PRIEST.heal))), `healed 8% of ${dmg}`);
  assert.equal(spellLifesteal(g), PRIEST.heal * 100);
  // A splash onto a second foe and a burn ticking heal nothing.
  const other = new NPC('goblin', t.x + 1, t.y, 0, {});
  other.hp = other.maxHp = 1e9; other.def = { ...other.def, aggressive: false, maxHit: 0 };
  other.target = g.player;   // already on you: an area hit never wakes new foes while you're hurt
  g.npcs.push(other);
  g.player.hp = 1;
  g._spellSplash(t, 50, { element: 'air', tint: '#fff' });
  assert.ok(other.hp < 1e9, 'the splash landed');
  t.ignite = { burns: [{ dmg: 40, left: 5000 }], sum: 40, owed: 0, owedN: 0, acc: 0, tickMs: 1000, critCh: 0 };
  const before = t.hp;
  g._tickIgnites(1000);
  assert.ok(t.hp < before, 'the burn went off');
  assert.equal(g.player.hp, 1, 'and neither healed');
  // A Wizard's spell heals nothing.
  const w = mk('wizard');
  w.g.player.hp = 1;
  assert.ok(attack(w.g, w.t)[0] > 0);
  assert.equal(w.g.player.hp, 1);
  assert.equal(spellLifesteal(w.g), 0);
});

test('Holy Light heals a quarter of its damage on top of the 8%', () => {
  const { g, t } = mk('priest');
  g.skills.xp.hitpoints = 5e6;   // plenty of room to heal into
  g.player.hp = 1;
  g.activateAbility('holy_light');
  const [dmg] = attack(g, t);
  assert.ok(dmg > 0);
  assert.equal(g.player.hp, 1 + Math.max(1, Math.round(dmg * PRIEST.heal)) + Math.round(dmg * 0.25), `healed from a ${dmg} bolt`);
});

test('a Priest smites undead, spirits and demons: x1.3 next to a Wizard in the same gear, x1 on a goblin', () => {
  for (const [foe, want] of [['skeleton', 1 + PRIEST.smite], ['wraith', 1 + PRIEST.smite], ['imp', 1 + PRIEST.smite], ['goblin', 1]]) {
    const { g, t } = mk('priest', foe);
    assert.ok(near(smite(g, t), want), `${foe}: x${smite(g, t)}`);
    const priest = g._offensiveMods(t, 'magic').dmgM;
    g.jobClass = 'wizard';   // the very same character, as a Wizard
    const wizard = g._offensiveMods(t, 'magic').dmgM;
    g.jobClass = 'priest';
    assert.ok(near(priest / wizard, want), `${foe}: the Priest hits x${priest / wizard} as hard`);
  }
  const s = mk('swordsman', 'skeleton');
  assert.equal(smite(s.g, s.t), 1, 'nobody else smites');
});

test('Uplift: every blessing counts half as much again, a quarter of the Faith bar at once, and +30% spell damage', () => {
  const { g } = mk('priest');
  g.activePrayers = new Set(['mystic_lore']);
  assert.ok(near(g.prayerMult().magic, 1.35));
  g.prayerPoints = 0; g.adrenaline = 100;
  g.activateAbility('uplift');
  assert.ok(near(g.prayerMult().magic, 1.525), `Mystic Lore lifted to ${g.prayerMult().magic}`);
  assert.ok(near(g.prayerPoints, g.maxPrayer() * 0.25), `Faith ${g.prayerPoints} of ${g.maxPrayer()}`);
  assert.equal(g.buffMod('dmg'), 0.3);
  assert.equal(g.adrenaline, 50);
});

test('Sanctuary: halves blows for 5 ticks, restores 12% of your life and burns back 20%', () => {
  const { g } = mk('priest');
  g.player.hp = Math.round(g.maxHp() / 2);
  const hp0 = g.player.hp;
  g.activateAbility('sanctuary');
  assert.equal(g.braceTicks, 5);
  assert.equal(g.braceCounter, 0.2);
  assert.equal(g.player.hp, Math.min(g.maxHp(), hp0 + Math.max(1, Math.round(g.maxHp() * 0.12))));
});

test('Fervour: x1 at full life, x1.15 at half, x1.3 with none left; the Zealot\'s alone', () => {
  const { g, t } = mk('zealot');
  g.skills.xp.hitpoints = 5e6;
  const max = g.maxHp();
  g.player.hp = max;
  assert.equal(fervour(g), 1);
  const full = g._offensiveMods(t, 'magic').dmgM;
  g.player.hp = max / 2;
  assert.ok(near(fervour(g), 1 + ZEALOT.fervour / 2));
  assert.ok(near(g._offensiveMods(t, 'magic').dmgM / full, 1.15), 'half life: +15% damage');
  g.player.hp = 0;
  assert.ok(near(fervour(g), 1.3));
  const w = mk('wizard');
  w.g.player.hp = 1;
  assert.equal(fervour(w.g), 1, 'a hurt Wizard gets none');
  // Only through a censer: with an orb, its second weapon, no Fervour and a lesser share.
  const z = mk('zealot');
  z.g.player.hp = 1; z.g.equipment.set('weapon', 'bronze_orb');
  assert.equal(fervour(z.g), 1, 'no Fervour through an orb');
  assert.equal(orbShare(z.g), ZEALOT.orb);
  assert.equal(orbShare(w.g), 1, 'a Wizard\'s orb is its own');
});

test('holy fire: a censer\'s every spell sets a burn that ticks once a second and pays Magic XP; a Priest with a censer burns too', () => {
  for (const cls of ['zealot', 'priest']) {
    const { g, t } = mk(cls);
    if (cls === 'priest') g.equipment.set('weapon', 'bronze_censer');
    const [dmg] = attack(g, t);
    const fire = t.wounds?.holyfire;
    assert.equal(fire?.length, 1, `${cls}: one holy fire`);
    // Exactly 3% of the hit a second (15% in all), not rounded up to 1: a new Zealot's
    // weak spells would otherwise burn for most of their hit.
    assert.deepEqual(fire[0], { perSec: dmg * HOLY_FIRE.share, left: HOLY_FIRE.secs });
    fire[0].perSec = 2.5;   // whole points a second, the fraction carried on
    const melee0 = g.skills.xp.attack + g.skills.xp.strength, magic0 = g.skills.xp.magic, hp0 = t.hp;
    g._tickWounds();   // 0.6s: not yet
    assert.equal(t.hp, hp0);
    g._tickWounds();   // 1.2s: one burn
    assert.equal(hp0 - t.hp, 2, 'burned once: 2 of the 2.5');
    g._tickWounds(); g._tickWounds();   // 2.4s: the second burn takes the half carried over
    assert.equal(hp0 - t.hp, 5, 'two burns: 5 in all');
    assert.ok(g.skills.xp.magic > magic0, 'Magic XP');
    assert.equal(g.skills.xp.attack + g.skills.xp.strength, melee0, 'no Melee XP');
    // The fires stack, a burn for every spell.
    attack(g, t); attack(g, t);
    assert.equal(t.wounds.holyfire.length, 3, `${cls}: the fires stack`);
  }
  // An orb or a staff sets none.
  for (const cls of ['priest', 'wizard']) { const { g, t } = mk(cls); attack(g, t); assert.ok(!t.wounds?.holyfire?.length, `${cls}'s ${g.equipment.get('weapon')} sets no fire`); }
  assert.equal(WOUNDS.holyfire.share, HOLY_FIRE.share);
});

test('Burning Oath: 15% of the life you have, never at or under 20%, and auto battle leaves it be there', () => {
  const { g, t } = mk('zealot');
  g.skills.xp.hitpoints = 5e6;
  g.player.hp = g.maxHp(); g.adrenaline = 100;
  const hp0 = g.player.hp;
  g.activateAbility('burning_oath');
  assert.equal(g.player.hp, hp0 - Math.floor(hp0 * 0.15), 'paid 15% of its life');
  assert.equal(g.buffMod('dmg'), 0.45);
  // At the floor: refused, with a word why.
  g.abilityCd = {}; g.buff = null; g.adrenaline = 100;
  g.player.hp = Math.floor(g.maxHp() * LIFE_COST_FLOOR);
  g.activateAbility('burning_oath');
  assert.match(g.said.at(-1), /too hurt/);
  assert.equal(g.adrenaline, 100, 'nothing paid');
  // Auto battle uses neither life-paid skill down there (its heals held back for the test).
  g.abilityUnlocked = () => true;
  g.abilityCd = { rekindle: 99, second_wind: 99 };
  g.attackNpc(t);
  const hp1 = g.player.hp;
  g._autoSkills(t);
  assert.ok(!g.abilityCd.burning_oath && !g.abilityCd.pillar_of_flame, 'neither was used');
  assert.equal(g.player.hp, hp1);
});

test('Pillar of Flame: a fifth of your life for a heavy blow that leaves holy fire, hitting around the target', () => {
  const { g, t } = mk('zealot');
  g.skills.xp.hitpoints = 5e6; g.skills.xp.magic = 5e6;   // big enough hits to tell the burns apart
  g.abilityUnlocked = () => true;
  const other = new NPC('goblin', t.x + 2, t.y, 0, {});
  other.hp = other.maxHp = 1e9; other.def = { ...other.def, aggressive: false, maxHit: 0 };
  other.target = g.player;   // already on you: an area hit never wakes new foes while you're hurt
  g.npcs.push(other);
  g.attackNpc(t); g.player.attackCooldown = 99;
  g.player.hp = g.maxHp(); g.adrenaline = 100;
  const hp0 = g.player.hp, fires = t.wounds?.holyfire?.length || 0, life = t.hp, by = other.hp;
  g.activateAbility('pillar_of_flame');   // instant: at the foe you're fighting
  assert.equal(g.player.hp, hp0 - Math.floor(hp0 * 0.2), 'paid a fifth of its life');
  assert.ok(t.hp < life && other.hp < by, 'the target and the foe beside it were struck');
  const fire = t.wounds.holyfire;
  assert.equal(fire.length, fires + 2, 'the censer\'s fire and the pillar\'s');
  assert.ok(fire.at(-1).perSec > fire.at(-2).perSec, 'the pillar\'s burns fiercer');
});

test('Rekindle: a fifth of your life back, 10 adrenaline, and the next spell sears', () => {
  const { g, t } = mk('zealot');
  g.skills.xp.hitpoints = 5e6;
  g.player.hp = Math.round(g.maxHp() / 2); g.adrenaline = 0;
  const hp0 = g.player.hp;
  g.activateAbility('rekindle');
  assert.equal(g.player.hp, hp0 + Math.max(1, Math.round(g.maxHp() * 0.2)));
  assert.equal(g.adrenaline, 10);
  attack(g, t);
  assert.equal(t.wounds.holyfire.length, 2, 'its sear and the censer\'s own fire');
});

test('a magic skill with no magic weapon names the class\'s own weapons', () => {
  const { g } = mk('priest');
  g.equipment.clearSlot('weapon');
  g.activateAbility('holy_light');
  assert.match(g.said.at(-1), /Holy Light needs a magic weapon equipped \(orbs or censers\)/);
});

test('the Priest and Zealot came after the signature deal: three extra weapons each, and no boss changed hands', () => {
  for (const [cls, type] of [['priest', 'orb'], ['zealot', 'censer']]) {
    const mine = LATE_SIGS.filter((a) => a.classId === cls);
    assert.equal(mine.length, 3);
    for (const a of mine) {
      assert.equal(ITEMS[a.id].equip.weaponType, type);
      assert.equal(ITEMS[a.id].signature.classId, cls);
    }
    assert.equal(mine.filter((a) => ITEMS[a.id].signature.ascended).length, 1, 'one is ascended, stronger than eternal');
    assert.ok(!Object.values(SIGNATURE_CLASS).includes(cls), `no boss's own weapon became the ${cls}'s`);
    const { g } = mk(cls);
    for (const a of mine) {
      g.kills = { ...(g.kills || {}), [a.boss]: 1 };
      assert.ok(codexEntry(g, a.boss).ascended?.some((x) => x.item === a.id && x.className === CLASS_BY_ID[cls].name), `the Codex shows ${a.id}`);
    }
  }
});

test('the class perks explain each class, and a Priest and a Zealot save and load', () => {
  assert.match(classPerks('priest')[0].text, /heals you 8% of its hit/);
  assert.match(classPerks('zealot')[0].text, /holy fire .*Fervour/);
  assert.ok(classPerks('priest').some((p) => p.label === 'Second weapon' && /censers/.test(p.text)));
  for (const [cls, weapon] of [['priest', 'bronze_orb'], ['zealot', 'bronze_censer']]) {
    const { g } = mk(cls);
    assert.ok(saveGame(g));
    const g2 = new Game(); g2.start();
    assert.ok(loadGame(g2));
    assert.equal(g2.jobClass, cls);
    assert.equal(g2.equipment.get('weapon'), weapon);
    assert.deepEqual(g2.currentAbilities().map((a) => a.cls || a.id), [cls, cls, cls, 'second_wind', cls]);
  }
});

test('a signature orb or censer is made for one class: the others who share its type can\'t wield it', async () => {
  const { pickGain } = await import('../src/game/bestpick.js');
  const { sigBarred } = await import('../src/data/classes.js');
  const { xpForLevel } = await import('../src/data/xp.js');
  for (const [cls, sig, mine] of [['sorcerer', 'sig_jade_moon_hare_priest', false], ['wizard', 'sig_jade_moon_hare_priest', false],
    ['zealot', 'sig_jade_moon_hare_priest', false], ['priest', 'sig_eternal_wyrm_zealot', false],
    ['priest', 'sig_jade_moon_hare_priest', true], ['zealot', 'sig_eternal_wyrm_zealot', true]]) {
    const { g } = mk(cls);
    for (const s of Object.keys(g.skills.xp)) g.skills.xp[s] = xpForLevel(400);
    const before = g.equipment.get('weapon');
    g.inventory.add(sig, 1);
    const i = g.inventory.slots.findIndex((s) => s?.id === sig);
    assert.equal(sigBarred(cls, sig), !mine);
    assert.equal(g._canEquipNow(sig), mine, `${cls}: ${sig}`);
    if (!mine) assert.equal(pickGain(g, g.inventory.slots[i]), null, `${cls}: Equip best leaves it`);
    g.equipItem(i);
    assert.equal(g.equipment.get('weapon'), mine ? sig : before, `${cls}: ${mine ? 'wields' : 'can\'t wield'} ${sig}`);
    if (!mine) assert.match(g.said.at(-1), /made for a (Priest|Zealot)'s hand/);
  }
});

test('holy fire adds about 15% of a weak spell, not more (no burn rounded up to 1 a second)', () => {
  const { g, t } = mk('zealot');
  let dealt = 0;
  for (let i = 0; i < 20; i++) dealt += attack(g, t).reduce((a, b) => a + b, 0);
  const hp0 = t.hp;
  for (let i = 0; i < 20; i++) g._tickWounds();   // 12 s: every fire has burnt out
  const burnt = hp0 - t.hp;
  assert.ok(dealt > 0 && dealt / 20 < 30, `a new Zealot's spells are weak (${dealt / 20} a cast)`);
  const share = burnt / dealt, want = HOLY_FIRE.share * HOLY_FIRE.secs;
  assert.ok(share <= want + 1e-9 && share >= want - 1 / dealt, `holy fire burnt ${Math.round(share * 100)}% of the hits`);
});
