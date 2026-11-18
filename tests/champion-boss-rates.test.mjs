// Champion and boss rates: champions turn up about twice as often, bosses come
// back in a little over half the time, and their rare drops come more often
// (the owner's request once levelling was slowed). Every statistical check uses
// the suite's seeded Math.random (seed.mjs) or a seeded generator of its own,
// with enough samples that the bounds are many standard deviations wide.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game, CHAMPION_WARD_CHANCE } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { NPC, CHAMPION_CHANCE } from '../src/game/npc.js';
import { NPCS, ALL_BOSS_IDS, BOSS_RESPAWN_MULT } from '../src/data/npcs.js';
import { rollQuality } from '../src/game/loot.js';
import { SIGNATURE_DROP_CHANCE, SIGNATURE_CLASS, sigIdFor } from '../src/data/bossWeapons.js';
import { RARE_BOSS_BONES, RARE_BONE_CHANCE } from '../src/data/bones.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass('corsair');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.msg = () => {}; g.banner = () => {};
  return g;
}

test('champions: the spawn chance is doubled to 8%, and about 8% of respawns roll one', () => {
  assert.equal(CHAMPION_CHANCE, 0.08, 'was 0.04');
  const id = Object.keys(NPCS).find((k) => { const d = NPCS[k]; return d.attackable && !d.boss && d.level >= 10 && d.level < 60; });
  const n = new NPC(id, 0, 0);
  const N = 20000;
  let champs = 0;
  for (let i = 0; i < N; i++) {
    n.champion = false; n.def = NPCS[id];
    if (n.maybeChampion(false)) champs++;
  }
  // Expected 1600 (sd ~38): 6.5%..9.5% is about 8 sd either side.
  const share = champs / N;
  assert.ok(share > 0.065 && share < 0.095, `champion share ${share}`);
});

test('bosses: respawn in a little over half the old time, 20-33 seconds', () => {
  assert.equal(BOSS_RESPAWN_MULT, 0.55);
  for (const id of ALL_BOSS_IDS) {
    const r = NPCS[id].respawn;
    // Old timer: min(100, 60 + level/8) ticks (36-60s). The new one is 55% of it.
    assert.ok(r >= 33 && r <= 55, `${id} respawns in ${r} ticks (${(r * 0.6).toFixed(1)}s)`);
  }
});

test('champion gear quality: Mythic about twice as likely as before, the lower tiers barely move', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const N = 200000;
  let epic = 0, leg = 0, myth = 0;
  for (let i = 0; i < N; i++) {
    const q = rollQuality('champion', rnd);
    if (q === 'epic' || q === 'legendary' || q === 'mythic') epic++;
    if (q === 'legendary' || q === 'mythic') leg++;
    if (q === 'mythic') myth++;
  }
  // Exact odds: Epic+ 0.6 x 0.65^2 = 25.4%, Legendary+ 0.6 x 0.65^4 = 10.7%,
  // Mythic 0.6 x 0.65^9 = 1.24% (were 21.6%, 7.8% and 0.60%).
  assert.ok(Math.abs(epic / N - 0.2535) < 0.01, `Epic+ ${epic / N}`);
  assert.ok(Math.abs(leg / N - 0.1071) < 0.006, `Legendary+ ${leg / N}`);
  assert.ok(myth / N > 0.0105 && myth / N < 0.0145, `Mythic ${myth / N}`);
  // Boss odds are unchanged: still at least Superior, a lucky roll Mythic.
  assert.equal(rollQuality('boss', () => 0.99), 'superior');
  assert.equal(rollQuality('boss', () => 0.01), 'mythic');
});

test('champion kills: an upgrade ward one kill in 5 (was 1 in 10)', () => {
  assert.equal(CHAMPION_WARD_CHANCE, 0.2);
  const g = newGame();
  let got = [];
  g._autoLoot = (loot) => { got = loot; };
  g._announceQuality = () => {};
  const champ = g.npcs.find((n) => n.attackable && !n.def.boss && (n.def.level || 1) >= 10 && !n._spawnOpts && !n.temporary);
  if (!champ.champion) champ.makeChampion();
  const N = 1500;
  let wards = 0;
  for (let i = 0; i < N; i++) { got = []; g.rollDrops(champ); if (got.some((l) => l[0] === 'upgrade_ward')) wards++; }
  // Expected 300 (sd ~15.5): 15%..25% is about 5 sd either side.
  assert.ok(wards / N > 0.15 && wards / N < 0.25, `ward share ${wards / N}`);
});

test('boss kills: the signature weapon 1 in 5 and the rare bones 60% of the time, neither guaranteed', () => {
  assert.equal(SIGNATURE_DROP_CHANCE, 0.2, 'was 0.1');
  assert.equal(RARE_BONE_CHANCE, 0.6, 'was 0.35');
  assert.ok(SIGNATURE_DROP_CHANCE <= 0.25 && RARE_BONE_CHANCE <= 0.65, 'rare drops stay far from certain');
  const g = newGame();
  let got = [];
  g._autoLoot = (loot) => { got = loot; };
  g._announceQuality = () => {};
  const boss = g.npcs.find((n) => n.def.boss && SIGNATURE_CLASS[n.npcId] && RARE_BOSS_BONES[n.npcId]);
  assert.ok(boss, 'found a boss with both a signature weapon and a rare bone');
  const sid = sigIdFor(boss.npcId), bone = RARE_BOSS_BONES[boss.npcId];
  const N = 1000;
  let sigs = 0, bones = 0;
  for (let i = 0; i < N; i++) {
    got = []; g.clue = null; g.rollDrops(boss);
    if (got.some((l) => l[0] === sid)) sigs++;
    if (got.some((l) => l[0] === bone)) bones++;
  }
  // Signature: expected 200 (sd ~12.6). Bones: expected 600 (sd ~15.5).
  assert.ok(sigs / N > 0.15 && sigs / N < 0.25, `signature share ${sigs / N}`);
  assert.ok(bones / N > 0.53 && bones / N < 0.67, `rare bone share ${bones / N}`);
});
