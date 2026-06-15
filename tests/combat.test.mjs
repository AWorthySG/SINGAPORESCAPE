// Active-combat layer: adrenaline, abilities, the weakness triangle and
// telegraphed heavy monster attacks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { weaknessOf, rollGuaranteed } from '../src/game/combat.js';
import { clearSave } from '../src/game/save.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function boot() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  return g;
}

test('combat weakness maps archetypes to a style (with a stable fallback)', () => {
  assert.equal(weaknessOf({ sprite: 'undead' }), 'magic');
  assert.equal(weaknessOf({ sprite: 'fowl' }), 'ranged');
  assert.equal(weaknessOf({ sprite: 'beast' }), 'melee');
  assert.ok(['melee', 'ranged', 'magic'].includes(weaknessOf({ level: 7 })));
});

test('rollGuaranteed always lands a meaningful hit', () => {
  for (let i = 0; i < 100; i++) {
    const d = rollGuaranteed(12);
    assert.ok(d >= 1 && d <= 12);
  }
});

test('landing a hit builds adrenaline', () => {
  const g = boot();
  g.adrenaline = 0;
  const npc = g.npcs.find((n) => n.attackable);
  g._applyPlayerHit(npc, 5);
  assert.equal(g.adrenaline, 10, 'a landed hit grants adrenaline');
  g._applyPlayerHit(npc, 0);
  assert.equal(g.adrenaline, 10, 'a miss grants none');
});

test('Power Strike arms, then spends adrenaline + goes on cooldown when it fires', () => {
  const g = boot();
  g.adrenaline = 100;
  g.activateAbility('power_strike');
  assert.equal(g.armedAbility, 'power_strike', 'ability armed');
  const npc = g.npcs.find((n) => n.attackable);
  const mods = g._offensiveMods(npc, 'melee');
  assert.ok(mods.ability, 'armed ability consumed by the hit');
  assert.ok(mods.guaranteed, 'Power Strike never misses');
  assert.ok(mods.dmgM > 1, 'and hits harder');
  assert.equal(g.armedAbility, null, 'disarmed after firing');
  assert.equal(g.adrenaline, 75, 'adrenaline spent');
  assert.ok(g.abilityCd.power_strike > 0, 'on cooldown');
});

test('abilities are gated by adrenaline', () => {
  const g = boot();
  g.adrenaline = 0;
  g.activateAbility('power_strike');
  assert.equal(g.armedAbility, null, 'cannot arm without enough adrenaline');
});

test('Brace sets a damage-reduction window; Second Wind heals', () => {
  const g = boot();
  g.adrenaline = 100;
  g.activateAbility('brace');
  assert.ok(g.braceTicks > 0, 'braced');
  assert.ok(g.abilityCd.brace > 0, 'brace on cooldown');
  assert.equal(g.adrenaline, 80, 'brace spent adrenaline');

  g.adrenaline = 100;
  g.skills.addXp('hitpoints', 5000);
  g.player.hp = 5;
  g.activateAbility('second_wind');
  assert.ok(g.player.hp > 5, 'Second Wind restored life');
  assert.ok(g.adrenaline < 100, 'and spent adrenaline');
});

test('the weakness triangle boosts matching-style damage', () => {
  const g = boot();
  const npc = g.npcs.find((n) => n.attackable);
  npc.def = { ...npc.def, sprite: 'beast' }; // weak to melee
  g.adrenaline = 0; g.armedAbility = null; g.specArmed = false;
  const matched = g._offensiveMods(npc, 'melee');
  g.adrenaline = 0; g.armedAbility = null; g.specArmed = false;
  const mismatched = g._offensiveMods(npc, 'magic');
  assert.ok(matched.weak, 'melee matches a beast');
  assert.ok(!mismatched.weak, 'magic does not');
  assert.ok(matched.dmgM > mismatched.dmgM, 'matching the weakness hits harder');
});

test('ability cooldowns tick down and adrenaline decays out of combat', () => {
  const g = boot();
  g.adrenaline = 100;
  g.activateAbility('brace');
  const cd0 = g.abilityCd.brace;
  g.adrenaline = 60;
  g.player.clearAction();
  for (const n of g.npcs) n.target = null; // ensure out of combat
  for (let i = 0; i < 3; i++) g.update(600);
  assert.ok(g.abilityCd.brace < cd0, 'cooldown ticked down');
  assert.ok(g.adrenaline < 60, 'adrenaline ebbs away when not fighting');
});

test('a telegraphed heavy blow always connects', () => {
  const g = boot();
  g.skills.addXp('hitpoints', 10000);
  g.player.hp = g.skills.hitpoints;
  const npc = g.npcs.find((n) => n.attackable) || g.npcs[0];
  npc.def = { ...npc.def, attack: 220, maxHit: 12 };
  const before = g.player.hp;
  g.resolveNpcAttack(npc, { heavy: true });
  assert.ok(g.player.hp < before, 'the heavy blow dealt damage');
});

test('high-level monsters wind up telegraphed heavy attacks', () => {
  const g = boot();
  g.skills.addXp('hitpoints', 9000);
  g.player.hp = g.skills.hitpoints;
  const npc = new NPC('goblin', g.player.x + 1, g.player.y, 0);
  npc.def = { ...npc.def, level: 30, attackable: true };
  npc.heavyEvery = 2;
  npc.target = g.player;
  let telegraphed = false;
  for (let i = 0; i < 24 && !telegraphed; i++) {
    npc.tick(g);
    if (npc.telegraph > 0 || npc.windup > 0) telegraphed = true;
  }
  assert.ok(telegraphed, 'the monster eventually wound up a heavy attack');
});
