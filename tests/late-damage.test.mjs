// Late-game damage: past level 100 a player's damage used to outgrow monster
// life many times over (a level 300 fighter needed a third of the hits a level
// 100 one did, a level 5,000 one a thirtieth, and bosses fell in seconds).
// These pin the tempered curve: the same kit kills a level-appropriate monster
// in about the same time at every level from 100 up, levelling never lowers a
// max hit, and a strong late build still has to work at a boss.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass, dummyDps, pickTargets } from '../tools/balance/classlab.mjs';
import { getNpc, ALL_BOSS_IDS } from '../src/data/npcs.js';
import { EQUIP_SLOTS } from '../src/game/equipment.js';
import { masteryType, MASTERY_RANKS, enchantValue, isMagicItem, MAX_RANK } from '../src/game/mastery.js';
import { MAX_REFINE } from '../src/game/refine.js';
import { xpForLevel } from '../src/data/xp.js';
import { getSpell } from '../src/data/magic.js';
import {
  damageTaper, critChance, LEVEL_BONUS_CAP,
  playerAttackVsNpc, playerRangedVsNpc, playerMagicVsNpc, playerDanceVsNpc,
} from '../src/game/combat.js';

const realHp = (id) => getNpc(id).maxHp * (getNpc(id).hpScale || 1);
/** Seconds to kill a level-appropriate monster: its life over single-target DPS
 *  (auto battle's abilities and adrenaline included), averaged over the three
 *  monsters weak to each style. */
function ttk(cls, L) {
  const game = setupClass(cls, L), tg = pickTargets(L);
  return tg.reduce((s, id) => s + realHp(id) / dummyDps(cls, L, [id], [[1, 0]], 60, { game }), 0) / tg.length;
}

test('the taper leaves level 100 and below alone, then falls smoothly', () => {
  for (const L of [1, 50, 99, 100]) assert.equal(damageTaper(L), 1);
  let prev = 1;
  for (const L of [101, 150, 300, 1000, 5000, 99999]) {
    const t = damageTaper(L);
    assert.ok(t < prev && t > 0, `taper keeps falling at ${L}`);
    prev = t;
  }
});

test('a level-appropriate monster takes about as long to kill at every level from 100 up', () => {
  // Before the taper the level 300 kill took 0.34x the level 100 one, 1,000 0.16x and 3,000 0.05x.
  for (const cls of ['swordsman', 'archer']) {
    const base = ttk(cls, 100);
    for (const L of [300, 1000, 3000]) {
      const r = ttk(cls, L) / base;
      assert.ok(r > 0.5 && r < 2.5, `${cls} level ${L} kill time is ${r.toFixed(2)}x level 100's`);
    }
  }
});

test('levelling never lowers a max hit with the same gear', () => {
  for (const cls of ['swordsman', 'archer', 'wizard', 'dancer']) {
    const g = setupClass(cls, 300);
    let prev = 0;
    for (const L of [100, 130, 200, 250, 300, 500, 1000, 3000, 10000]) {
      const x = xpForLevel(L), sx = g.skills.xp;
      for (const k of ['attack', 'strength', 'ranged', 'magic']) if (k in sx) sx[k] = x;
      sx.agility = x / 2;
      const sk = g.skills, eq = g.equipment, mode = g.combatMode();
      const max = mode === 'magic' ? playerMagicVsNpc(sk, eq, getSpell(g.player.spell), null).max
        : mode === 'ranged' ? playerRangedVsNpc(sk, eq, 'balanced', null, 50).max
        : mode === 'dance' ? playerDanceVsNpc(sk, eq, 'balanced', null).max
        : playerAttackVsNpc(sk, eq, 'balanced', null).max;
      assert.ok(max >= prev, `${cls}: max hit ${max} at level ${L} is below ${prev}`);
      prev = max;
    }
  }
});

test('a fully upgraded late build still has to work at a boss of its level', () => {
  // Mythic, Ascended, refined to the top and three damage enchant lines on every piece.
  const L = 3000, cls = 'swordsman', g = setupClass(cls, L), eq = g.equipment;
  for (const s of EQUIP_SLOTS) {
    const id = eq.slots[s];
    if (!id) continue;
    eq.slotQuality[s] = 'mythic';
    eq.mastery[masteryType(id)] = MASTERY_RANKS[MAX_RANK].points;
    eq.refines[id] = MAX_REFINE;
    eq.enchants[id] = [isMagicItem(id) ? 'magPct' : 'atkPct', 'critDmg', 'crit'].map((stat) => ({ stat, value: enchantValue(id, stat) }));
  }
  const boss = ALL_BOSS_IDS.filter((id) => !getNpc(id).fixed).sort((a, b) => Math.abs(getNpc(a).level - L) - Math.abs(getNpc(b).level - L))[0];
  const tg = pickTargets(L);
  const dps = tg.reduce((s, id) => s + dummyDps(cls, L, [id], [[1, 0]], 60, { game: g, boss: true }), 0) / tg.length;
  // Measured ~11 s (it was under one second before the taper).
  assert.ok(realHp(boss) / dps > 4, `${boss} fell in ${(realHp(boss) / dps).toFixed(1)} s`);
});

test('crit chance from levels stops growing at the level bonus cap; gear still reaches 100%', () => {
  assert.equal(critChance(5000, 0), critChance(LEVEL_BONUS_CAP, 0));
  assert.ok(critChance(150, 0) < critChance(LEVEL_BONUS_CAP, 0));
  assert.equal(critChance(5000, 100), 1);
});

test('enchant lines still grow with item level, more gently past 100, and an old save\'s lines are brought down once', async () => {
  assert.ok(enchantValue('eternal_sword', 'critDmg') > enchantValue('orichalcum_sword', 'critDmg'));
  assert.ok(enchantValue('orichalcum_sword', 'critDmg') > enchantValue('rune_sword', 'critDmg'));
  assert.equal(enchantValue('eternal_sword', 'critDmg'), 14);   // was 26 (3 x (1 + 300/40))
  const { Equipment } = await import('../src/game/equipment.js');
  const e = new Equipment();
  // An old save's lines on a level 300 item come down in proportion (26 rolled then, 14 now), once;
  // lines on items up to level 100 are untouched.
  e.load({ weapon: 'eternal_sword', _mastery: {}, _enchants: { eternal_sword: [{ stat: 'critDmg', value: 26 }, { stat: 'crit', value: 9 }], rune_sword: [{ stat: 'crit', value: 6 }] } });
  assert.deepEqual(e.enchantLines('eternal_sword'), [{ stat: 'critDmg', value: 14 }, { stat: 'crit', value: 5 }]);
  assert.deepEqual(e.enchantLines('rune_sword'), [{ stat: 'crit', value: 6 }]);
  const again = new Equipment();
  again.load(e.serialize());
  assert.deepEqual(again.enchantLines('eternal_sword'), [{ stat: 'critDmg', value: 14 }, { stat: 'crit', value: 5 }], 'not brought down twice');
});
