// Boss armour types (the owner: "give each boss an armour profile, so different
// classes have different good and bad matchups"). Every boss is plated, warded,
// evasive or thick-hided (src/data/bossTypes.js), which combat.js applies to your
// hits; the Codex, the battle bar and the hover details say which, with a hint.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeStorage } from '../tools/balance/common.mjs';
import { bossFight } from '../tools/balance/bossfight.mjs';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ALL_BOSS_IDS, ALL_MONSTER_IDS, getNpc } from '../src/data/npcs.js';
import { BOSS_TYPES } from '../src/data/bossTypes.js';
import { armourOf, armourMult, bossTypeOf, bossTypeDmgMult, bossGrazeChance, bossGrazeMult, GRAZE_DMG, bossBreakMult, attackSlowness } from '../src/game/combat.js';
import { foeDetails } from '../src/render/worldlabels.js';
import { bossBarModel } from '../src/ui/bossbar.js';
import { codexEntry } from '../src/game/codex.js';
import { codexEntryHTML } from '../src/ui/codexui.js';
import { bossTypeRows } from '../src/data/compendium.js';

const freshGame = (cls = 'swordsman') => {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game(); g.start(); g.chooseClass(cls);
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
};
const ofType = (t) => ALL_BOSS_IDS.filter((id) => getNpc(id).armourType === t);

test('every boss has an armour type, every type has bosses, and ordinary monsters have none', () => {
  for (const id of ALL_BOSS_IDS) assert.ok(BOSS_TYPES[getNpc(id).armourType], `${id} has an armour type`);
  for (const t of Object.keys(BOSS_TYPES)) assert.ok(ofType(t).length >= 10, `${ofType(t).length} ${t} bosses`);
  for (const id of ALL_MONSTER_IDS.filter((x) => !getNpc(x).boss)) assert.equal(bossTypeOf(getNpc(id)), null, id);
  // By race and kind, with the overrides: golems are plated, ghosts warded, birds evasive, beasts thick-hided.
  assert.equal(getNpc('rune_golem').armourType, 'plated');
  assert.equal(getNpc('hungry_ghost_king').armourType, 'warded');
  assert.equal(getNpc('sea_eagle_sovereign').armourType, 'evasive');
  assert.equal(getNpc('shadow_panther').armourType, 'evasive');   // a great cat, not a thick-hided beast
  assert.equal(getNpc('kranji_buffalo_king').armourType, 'thick');
});

test('each armour type does what it says', () => {
  const as = (t, extra = {}) => ({ ...getNpc(ofType(t)[0]), level: 300, ...extra });
  const plain = (t) => ({ ...as(t), armourType: undefined });
  // Plated: more armour (past the usual 60% cap), and blunt weapons hit harder.
  assert.ok(armourOf(as('plated'), { fightLevel: 300 }) > armourOf(plain('plated'), { fightLevel: 300 }));
  assert.ok(armourOf({ ...as('plated'), level: 3000 }, { fightLevel: 300 }) > 0.6, 'a plated boss can wear more than 60%');
  assert.equal(bossTypeDmgMult(as('plated'), { mode: 'melee', weaponType: 'warhammer', interval: 1 }), BOSS_TYPES.plated.blunt);
  assert.equal(bossTypeDmgMult(as('plated'), { mode: 'melee', weaponType: 'sword', interval: 1 }), 1);
  // Warded: less armour, but spells are soaked.
  assert.ok(armourOf(as('warded'), { fightLevel: 300 }) < armourOf(plain('warded'), { fightLevel: 300 }));
  assert.equal(bossTypeDmgMult(as('warded'), { mode: 'magic', interval: 0.2 }), BOSS_TYPES.warded.magic);
  assert.equal(bossTypeDmgMult(as('warded'), { mode: 'ranged', interval: 0.2 }), 1);
  // Evasive: less armour, and slow swings graze it more often than quick attacks.
  assert.ok(armourOf(as('evasive'), { fightLevel: 300 }) < armourOf(plain('evasive'), { fightLevel: 300 }));
  assert.ok(bossGrazeChance(as('evasive'), 0.12) < bossGrazeChance(as('evasive'), 1.4));
  assert.ok(bossGrazeMult(as('evasive'), 1.4) < bossGrazeMult(as('evasive'), 0.12) && bossGrazeMult(as('evasive'), 0.12) < 1);
  assert.equal(bossGrazeChance(as('thick'), 1.4), 0, 'only evasive bosses are grazed');
  // Thick-hided: quick blows glance off, heavy ones land harder, armour breaks count more.
  assert.ok(bossTypeDmgMult(as('thick'), { mode: 'melee', interval: 0.15 }) < 1);
  assert.ok(bossTypeDmgMult(as('thick'), { mode: 'melee', interval: 1.4 }) > 1);
  assert.equal(bossBreakMult(as('thick')), BOSS_TYPES.thick.breaks);
  assert.equal(bossBreakMult(as('plated')), 1);
  assert.equal(attackSlowness(0.1), 0); assert.equal(attackSlowness(3), 1);
  // Armour pierce still cancels the armour: plated bosses are where it counts most.
  assert.ok(armourMult(armourOf(as('plated'), { fightLevel: 300 }), 80) < armourMult(armourOf(as('evasive'), { fightLevel: 300 }), 80));
});

test('an evasive boss is grazed by some of your blows in a real game, never missed; a plain monster never is', () => {
  const g = freshGame('gladiator');   // a two-handed great sword: slow swings
  const boss = g.spawnNpc(ofType('evasive')[0], g.player.x + 2, g.player.y, { wander: 0 });
  boss.maxHp = boss.hp = 1e9;
  const took = [];
  for (let i = 0; i < 200; i++) { const before = boss.hp; g._applyPlayerHit(boss, 100); took.push(before - boss.hp); }
  const grazed = took.filter((d) => d === Math.round(100 * GRAZE_DMG)).length;
  assert.ok(grazed >= 30 && grazed <= 140, `grazed ${grazed} of 200 slow swings`);
  assert.ok(took.every((d) => d === 100 || d === Math.round(100 * GRAZE_DMG)), 'every blow lands: in full or grazing');
  assert.ok(g.effects.some((e) => e.type === 'hitsplat' && e.entity === boss && e.text === 'Grazed'), 'a grazing blow is labelled');
  // Even a 1-damage blow still lands 1.
  const b0 = boss.hp; for (let i = 0; i < 40; i++) g._applyPlayerHit(boss, 1);
  assert.equal(b0 - boss.hp, 40);
  const mob = g.spawnNpc(g.npcs.find((n) => n.def.attackable && !n.def.boss).npcId, g.player.x + 1, g.player.y, { wander: 0 });
  mob.maxHp = mob.hp = 1e9;
  const m0 = mob.hp;
  for (let i = 0; i < 100; i++) g._applyPlayerHit(mob, 100);
  assert.equal(m0 - mob.hp, 100 * 100, 'no grazes on an ordinary monster');
});

test("auto battle's fight estimate counts the boss's armour type", () => {
  const g = freshGame('wizard');
  const base = getNpc(ofType('warded')[0]);
  const n = { def: base, hp: base.maxHp, npcId: ofType('warded')[0] };
  const warded = g._autoFightTimes(n).myTime;
  const unwarded = g._autoFightTimes({ ...n, def: { ...base, armourType: undefined } }).myTime;
  // Wards soak a fifth of every spell; the lower armour gives a little back.
  assert.ok(warded > unwarded * 1.05, `a caster expects a warded boss to take longer (${warded.toFixed(0)} s vs ${unwarded.toFixed(0)} s)`);
});

test('the Codex, the battle bar, the hover details and the compendium show the armour type', () => {
  const g = freshGame();
  const id = ofType('plated')[0], bt = BOSS_TYPES.plated;
  // The Codex shows it even before the first kill (like the boss's mechanic).
  assert.equal(codexEntry(g, id).armourType.name, bt.name);
  assert.ok(codexEntryHTML(g, id).includes(`Armour type: ${bt.icon} ${bt.name}`));
  assert.ok(codexEntryHTML(g, id).includes(bt.hint));
  assert.equal(codexEntry(g, 'goblin').armourType, undefined, 'ordinary monsters have no armour type');
  const boss = g.spawnNpc(id, g.player.x + 3, g.player.y, { wander: 0 });
  assert.ok(foeDetails(g, boss).includes(`${bt.icon} ${bt.name}`), 'battle bar line and hover details');
  assert.equal(bossBarModel(g, boss).armourType.hint, bt.hint);
  const rows = bossTypeRows();
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => Number(r[3]) >= 10));
});

// Real fights, sampled to keep the run short: five classes of different
// fighting styles and speeds, each against one boss of each type near level 300.
// Measured over every class (21) at levels 300 and 1000, two bosses a type, each
// class's average came to 0.80-1.26 of the median (the Merchant 1.5-1.7, on top)
// and no class fell below 0.6 against any type. These five came to 0.80-1.20 on
// average, 0.60-1.47 a type (the Swordsman's sword is resisted by the crab's shell;
// a Wizard's spells bite into it).
test('real boss fights: each class stays near the median overall, and no type shuts a class out', () => {
  const CLS = ['swordsman', 'gladiator', 'pistoler', 'wizard', 'ninja'];
  const BOSSES = { plated: 'chilli_crab', warded: 'hantu_tinggi', evasive: 'spider_queen', thick: 'kranji_buffalo_king' };
  const dps = {};
  for (const c of CLS) {
    dps[c] = {};
    for (const [t, b] of Object.entries(BOSSES)) {
      const r = bossFight(c, 300, b, { maxTicks: 1200 });
      assert.ok(r.killed && !r.died, `${c} beats ${b}`);
      dps[c][t] = 1 / r.secs;
    }
  }
  const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[(s.length - 1) / 2]; };
  const typeMed = Object.fromEntries(Object.keys(BOSSES).map((t) => [t, med(CLS.map((c) => dps[c][t]))]));
  for (const c of CLS) {
    const rel = Object.fromEntries(Object.keys(BOSSES).map((t) => [t, dps[c][t] / typeMed[t]]));
    const avg = Object.values(rel).reduce((a, b) => a + b) / 4;
    const txt = Object.entries(rel).map(([t, x]) => `${t} ${x.toFixed(2)}`).join(', ');
    assert.ok(avg >= 0.7 && avg <= 1.35, `${c}: ${avg.toFixed(2)} of the median on average (${txt})`);
    for (const [t, x] of Object.entries(rel)) assert.ok(x >= 0.5, `${c} against a ${t} boss: ${x.toFixed(2)} of the median (${txt})`);
  }
});
