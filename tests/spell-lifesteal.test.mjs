// A skill's lifesteal heals on a spell, as it always has on a blow or an arrow.
// _magicAttack used to skip the heal the other attacks apply (mods.heal), so a
// Sorcerer's Soul Siphon ("healing half of the damage") and Dark Pact's soul
// bolt healed nothing.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { clearSave } from '../src/game/save.js';
import { fakeStorage } from '../tools/balance/common.mjs';

function mk(cls) {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  g.msg = () => {};
  g.inventory.add('air_rune', 999); g.inventory.add('mind_rune', 999);
  const t = new NPC('goblin', g.player.x + 1, g.player.y, 0, {});
  t.hp = t.maxHp = 1e9; t.def = { ...t.def, aggressive: false, maxHit: 0 };
  g.npcs = [t];
  return { g, t };
}

/** One attack carrying a skill strike with this lifesteal, from 1 life: [dealt, healed]. */
function strike(cls, lifesteal) {
  const { g, t } = mk(cls);
  g.player.hp = 1;
  const hp0 = t.hp;
  g._strikeAb = { id: 'test', name: 'Test', kind: 'attack', dmgMul: 1, lifesteal };
  g.doPlayerAttack(t);
  return { dealt: hp0 - t.hp, healed: g.player.hp - 1, scale: t.def.hpScale || 1 };
}

test('a skill\'s lifesteal heals a share of a spell\'s hit, as it does a blow\'s', () => {
  for (const cls of ['sorcerer', 'wizard', 'paladin']) {
    const none = strike(cls, 0);
    assert.ok(none.dealt > 0, `${cls} hit`);
    assert.equal(none.healed, 0, `${cls}: no lifesteal, no heal`);
    const half = strike(cls, 0.5);
    assert.ok(half.dealt > 0, `${cls} hit`);
    assert.equal(half.healed, Math.round(half.dealt * 0.5 * half.scale), `${cls} healed half of ${half.dealt}`);
  }
});

test('Soul Siphon and Dark Pact\'s bolt heal a Sorcerer', () => {
  const s = mk('sorcerer');
  s.g.attackNpc(s.t); s.g.player.attackCooldown = 99;
  s.g.player.hp = 1;
  const hp0 = s.t.hp;
  s.g.activateAbility('soul_siphon');   // instant: drains the foe at once
  assert.ok(s.t.hp < hp0, 'Soul Siphon struck');
  assert.ok(s.g.player.hp > 1, `and healed (life ${s.g.player.hp})`);

  const d = mk('sorcerer');
  d.g.attackNpc(d.t); d.g.player.attackCooldown = 99;
  d.g.adrenaline = 100; d.g.player.hp = 1;
  d.g.activateAbility('dark_pact');   // its soul bolt lands at once
  assert.ok(d.t.hp < 1e9, 'the soul bolt struck');
  assert.ok(d.g.player.hp > 1, `and healed (life ${d.g.player.hp})`);
});
