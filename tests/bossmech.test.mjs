// Boss mechanics (src/game/bossmech.js, src/data/bossMechanics.js): every boss
// has one interactive mechanic, telegraphed, with a reward for getting it right,
// a blow (never a one-shot) for getting it wrong, and a clean-up when the boss
// dies or you walk away.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ALL_BOSS_IDS, NPCS } from '../src/data/npcs.js';
import { BOSS_MECHANICS, MECH_STYLES, mechanicHowTo } from '../src/data/bossMechanics.js';
import {
  startMechanic, clearMechanic, tickBossMechanics, mechAutoFight, mechLabel, inHazard,
  MECH_FIRST_TICKS, SHIELD_TICKS, SHIELD_POOL, SHIELD_BURST, SHIELD_MEND, CIRCLE_TICKS, HEAL_EVERY, HEAL_CAP, ADDS_TICKS, CAST_TICKS, CAST_HIT,
} from '../src/game/bossmech.js';
import { codexEntry } from '../src/game/codex.js';
import { codexEntryHTML } from '../src/ui/codexui.js';
import { chebyshev } from '../src/core/utils.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const step = (game, n) => { for (let i = 0; i < n; i++) game.update(600); };

// A fresh melee character beside a boss that is fighting it. The boss is
// frozen (no ordinary blows, specials or red markers) unless `live`, so each
// test sees only its mechanic.
function setup(id, { live = false, gap = 2 } = {}) {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.chooseStartingStyle('melee');
  const p = game.player;
  game.npcs = game.npcs.filter((n) => chebyshev(n.x, n.y, p.x, p.y) > 20);
  const t = game._nearestFree(p.x + gap, p.y);
  const boss = game.spawnNpc(id, t.x, t.y, { wander: 0 });
  boss.hp = boss.maxHp = 10000;
  boss.target = p;
  if (live) {
    boss.def = { ...boss.def, maxHit: 1 };
    boss.specialCooldown = boss.aoeCooldown = 9999;
  } else boss._combatAI = () => {};
  p.hp = game.maxHp();
  const chat = [];
  game.bus.on('chat', (c) => chat.push(c.text));
  return { game, p, boss, chat };
}

test('every boss has one mechanic, the four kinds are all used, and each is explained', () => {
  const kinds = new Set();
  for (const id of ALL_BOSS_IDS) {
    const m = BOSS_MECHANICS[id];
    assert.ok(m && m.name, `${id} has a mechanic`);
    kinds.add(m.type);
    if (m.type === 'adds') assert.ok(NPCS[m.id] && NPCS[m.id].attackable, `${id}'s healers are a real monster (${m.id})`);
    if (m.type === 'shield') assert.ok(m.styles.length && m.styles.every((s) => MECH_STYLES[s]), `${id}'s shield styles`);
    assert.ok(mechanicHowTo(m).length > 40, `${id} has a how-to`);
  }
  for (const id of Object.keys(BOSS_MECHANICS)) assert.ok(ALL_BOSS_IDS.includes(id), `${id} is a boss`);
  assert.deepEqual([...kinds].sort(), ['adds', 'cast', 'circle', 'shield']);
  for (const k of kinds) assert.ok(ALL_BOSS_IDS.filter((id) => BOSS_MECHANICS[id].type === k).length >= 10, `${k} is spread across many bosses`);
});

test('the Monster Codex explains each boss mechanic, even before the first kill', () => {
  const { game } = setup('chilli_crab');
  game.kills = {};
  const e = codexEntry(game, 'chilli_crab');
  assert.equal(e.discovered, false);
  assert.equal(e.mechanic.kind, 'Style shield');
  assert.equal(e.mechanic.styles[0].id, 'melee');
  const html = codexEntryHTML(game, 'chilli_crab', e);
  assert.ok(html.includes('Chilli Shell') && html.includes('Melee'), 'the locked page still teaches it');
  game.kills = { reservoir_serpent: 1 };
  const h2 = codexEntryHTML(game, 'reservoir_serpent', codexEntry(game, 'reservoir_serpent'));
  assert.ok(h2.includes('Interruptible cast') && h2.includes('interrupt'));
  assert.equal(codexEntry(game, 'goblin').mechanic, undefined, 'ordinary monsters have none');
});

test('a mechanic triggers on its own a few seconds into a boss fight, telegraphed', () => {
  const { game, boss, chat } = setup('reservoir_serpent', { live: true, gap: 1 });
  // Note every overhead text as it is shown: a 600ms step can age it out
  // before the check (only a whole-world hit-stop used to keep it alive).
  const said = [], add = game.addHitsplat.bind(game);
  game.addHitsplat = (e, d, o = {}) => { if (o.text) said.push(o.text); return add(e, d, o); };
  step(game, MECH_FIRST_TICKS - 2);
  assert.ok(!boss.mech, 'not straight away');
  for (let i = 0; i < 4 && !boss.mech; i++) step(game, 1);
  assert.equal(boss.mech?.type, 'cast');
  assert.ok(chat.some((t) => t.includes('Tidal Coil') && t.includes('interrupt')), 'a chat line says what to do');
  assert.ok(said.includes('Casting Tidal Coil!'), 'overhead text');
  assert.ok(mechLabel(game, boss).includes('interrupt'), 'and the boss bar prompts it');
});

test('style shield: the right style breaks it fast, others barely; broken leaves the boss exposed', () => {
  const { game, boss, chat } = setup('chilli_crab');
  const m = startMechanic(game, boss);
  assert.equal(m.type, 'shield'); assert.equal(m.style, 'melee');
  assert.equal(m.hp, 10000 * SHIELD_POOL);
  assert.ok(chat.some((t) => t.includes('melee shield')));
  assert.ok(mechLabel(game, boss).includes('Melee shield'));
  // Wrong style: the shield soaks the hit and barely cracks.
  game.combatMode = () => 'magic';
  for (let i = 0; i < 4; i++) game._applyPlayerHit(boss, 50);
  assert.equal(boss.hp, 10000, 'the boss takes nothing while shielded');
  assert.equal(m.hp, 400 - 4 * 50 * 0.25, 'a wrong-style hit does a quarter');
  // Right style: it breaks.
  game.combatMode = () => 'melee';
  let hits = 0;
  while (boss.mech && hits < 20) { game._applyPlayerHit(boss, 50); hits++; }
  assert.ok(!boss.mech && hits <= 7, `broken in ${hits} melee hits`);
  assert.ok(chat.some((t) => t.includes('shatter')));
  assert.ok(game.effects.some((e) => e.type === 'hitsplat' && e.text === 'Shield broken!'));
  game._applyPlayerHit(boss, 40);
  assert.equal(boss.hp, 10000 - 60, 'exposed: it takes half as much again');
});

test('style shield left standing bursts: hurts you and mends the boss, never a one-shot', () => {
  const { game, p, boss, chat } = setup('chilli_crab');
  boss.hp = 5000;
  startMechanic(game, boss);
  const hp0 = p.hp;
  step(game, SHIELD_TICKS);
  assert.ok(!boss.mech, 'gone');
  assert.equal(boss.hp, 5000 + 10000 * SHIELD_MEND, 'the boss mends');
  assert.ok(p.alive && hp0 - p.hp > 0 && hp0 - p.hp <= Math.ceil(game.maxHp() * SHIELD_BURST), 'hurts but no more than a quarter');
  assert.ok(chat.some((t) => t.includes('bursts')));
});

test('style shield cleans up when the boss dies or you leave', () => {
  const { game, p, boss } = setup('jade_dragon');
  startMechanic(game, boss);
  boss.alive = false;
  step(game, 1);
  assert.ok(!boss.mech && !game._mechActive.size);
  boss.alive = true; boss.hp = boss.maxHp;
  const m = startMechanic(game, boss);
  assert.equal(m.style, 'ranged', 'the Jade Dragon cycles its styles');
  game._placePlayer(p.x + 30, p.y);
  step(game, 1);
  assert.ok(!boss.mech, 'walking away calls it off');
});

test('safe circle: red all round with a green hole; standing in it is safe, anywhere else hurts', () => {
  const { game, p, boss, chat } = setup('merlion', { gap: 3 });
  const m = startMechanic(game, boss);
  const hz = m.hz, s = hz.safe;
  assert.ok(game.hazards.includes(hz));
  assert.ok(game.hazardAt(p.x, p.y), 'you are in the red');
  assert.ok(!game.hazardAt(s.cx, s.cy) && !inHazard(hz, s.cx + s.r, s.cy), 'the circle is safe');
  assert.ok(game.hazardAt(s.cx + s.r + 1, s.cy) || chebyshev(s.cx + s.r + 1, s.cy, hz.cx, hz.cy) > hz.r, 'right next to it is not');
  assert.ok(chebyshev(p.x, p.y, s.cx, s.cy) <= 4, 'close enough to reach');
  assert.ok(chat.some((t) => t.includes('green circle')));
  assert.equal(mechLabel(game, boss), '◎ Get into the green circle!');
  // Step into it: dodged.
  game._placePlayer(s.cx, s.cy);
  const hp0 = p.hp;
  step(game, CIRCLE_TICKS);
  assert.equal(p.hp, hp0, 'safe in the circle');
  assert.ok(!boss.mech && !game.hazards.length, 'cleaned up after landing');
  assert.ok(game.effects.some((e) => e.type === 'hitsplat' && e.text === 'Dodged!'));
  // Stay put: it hits, but never a one-shot.
  boss._mechCd = 1;
  startMechanic(game, boss);
  game._placePlayer(game.hazards[0].safe.cx + 3, game.hazards[0].safe.cy + 3);
  assert.ok(game.hazardAt(p.x, p.y));
  const hp1 = p.hp;
  step(game, CIRCLE_TICKS);
  assert.ok(p.alive && p.hp < hp1 && hp1 - p.hp <= Math.ceil(game.maxHp() * 0.45), 'outside the circle it hurts');
});

test('safe circle: auto battle with dodging on walks you into it; with dodging off it leaves it to you', () => {
  for (const dodge of [true, false]) {
    const { game, p, boss } = setup('sentosa_kraken', { gap: 3 });
    game.toggleAutoBattle(true);
    game.autoCfg.dodge = dodge;
    game._autoPickTarget = () => null; game._autoHeadToLevel = () => false; game._autoSeekBoss = () => false;
    const m = startMechanic(game, boss);
    const s = m.hz.safe;
    const hp0 = p.hp;
    step(game, CIRCLE_TICKS);
    const inside = Math.abs(p.x - s.cx) <= s.r && Math.abs(p.y - s.cy) <= s.r;
    if (dodge) assert.ok(inside && p.hp === hp0, 'auto-dodge stepped into the green');
    else assert.ok(!inside && p.hp < hp0, 'left to the player: stood still and got hit');
  }
});

test('healing adds: they mend the boss until killed; killing them ends it; auto battle turns on them', () => {
  const { game, p, boss, chat } = setup('spider_queen');
  boss.hp = 5000;
  const m = startMechanic(game, boss);
  assert.equal(m.adds.length, 2);
  for (const a of m.adds) {
    assert.ok(game.npcs.includes(a) && a.temporary && a.mechHealer === boss && a.alive);
    assert.ok(a.name.endsWith('healer'));
  }
  assert.ok(chat.some((t) => t.includes('Brood Nurses')));
  step(game, HEAL_EVERY + 1);
  assert.ok(boss.hp > 5000, 'they heal it');
  assert.ok(mechLabel(game, boss).includes('2 left'));
  // Auto battle, fighting the boss, switches to a healer.
  game.toggleAutoBattle(true);
  game.attackNpc(boss);
  const pick = mechAutoFight(game, boss, {});
  assert.ok(m.adds.includes(pick), 'auto battle picks a healer');
  step(game, 2);
  assert.ok(m.adds.includes(p.action?.npc), 'and goes after it in the fight');
  // Kill them both: done, no more healing.
  for (const a of m.adds) { a.hp = 0; a.alive = false; }
  game.toggleAutoBattle(false);
  p.clearAction();
  step(game, 1);
  assert.ok(!boss.mech);
  assert.ok(chat.some((t) => t.includes('cut down')));
  const hpAfter = boss.hp;
  step(game, HEAL_EVERY * 2);
  assert.equal(boss.hp, hpAfter);
});

test('healing adds left alone heal at most their cap, then drift away; they vanish if the boss dies or you leave', () => {
  const { game, p, boss } = setup('bone_colossus');
  boss.hp = 2000;
  const m = startMechanic(game, boss);
  step(game, ADDS_TICKS);
  assert.ok(!boss.mech, 'they drift away in time');
  assert.ok(boss.hp > 2000 && boss.hp <= 2000 + 10000 * HEAL_CAP, `healed ${boss.hp - 2000}, within the cap`);
  assert.ok(m.adds.every((a) => !game.npcs.includes(a)), 'and are gone from the world');
  // The boss dies: its healers go with it.
  const m2 = startMechanic(game, boss);
  boss.alive = false;
  step(game, 1);
  assert.ok(m2.adds.every((a) => !a.alive && !game.npcs.includes(a)));
  // You leave: called off.
  boss.alive = true; boss.hp = 9000;
  const m3 = startMechanic(game, boss);
  game._placePlayer(p.x + 40, p.y);
  step(game, 1);
  assert.ok(!boss.mech && m3.adds.every((a) => !game.npcs.includes(a)));
});

test('interruptible cast: any skill interrupts it; otherwise a heavy blow lands that is never a one-shot', () => {
  const { game, p, boss, chat } = setup('reservoir_serpent');
  startMechanic(game, boss);
  assert.ok(boss.attackCooldown >= CAST_TICKS, 'it stops to channel');
  const hp0 = p.hp;
  game.activateAbility('grog');   // any skill will do
  assert.ok(!boss.mech, 'interrupted');
  assert.ok(chat.some((t) => t.includes('You interrupt')));
  assert.ok(game.effects.some((e) => e.type === 'hitsplat' && e.text === 'Interrupted!'));
  step(game, CAST_TICKS + 1);
  assert.ok(p.hp >= hp0, 'no blow lands');
  // Left alone, it lands.
  p.hp = game.maxHp();
  startMechanic(game, boss);
  step(game, CAST_TICKS);
  const lost = game.maxHp() - p.hp;
  assert.ok(!boss.mech && p.alive, 'never a one-shot');
  assert.ok(lost > 0 && lost <= Math.ceil(game.maxHp() * CAST_HIT), `it hurts (${lost})`);
  // The boss dies mid-cast: nothing lands.
  p.hp = game.maxHp();
  startMechanic(game, boss);
  boss.alive = false;
  step(game, CAST_TICKS + 1);
  assert.equal(p.hp, game.maxHp());
  assert.ok(!game._mechActive.size);
});

test('interruptible cast: a special attack interrupts too, and auto battle interrupts with a ready skill', () => {
  const { game, boss } = setup('demon_lord', { gap: 1 });
  // A weapon special, taken as the hit lands.
  game.equipment.set('weapon', 'granite_maul');
  game.specEnergy = 100; game.specArmed = true;
  startMechanic(game, boss);
  assert.ok(game._takeSpec(), 'the special is spent');
  assert.ok(!boss.mech, 'and it interrupts the cast');
  // Auto battle mid-fight with the boss uses a ready skill to interrupt.
  game.equipment.set('weapon', 'bronze_scimitar');
  game.abilityCd = {};
  game.toggleAutoBattle(true);
  game.attackNpc(boss);
  startMechanic(game, boss);
  mechAutoFight(game, boss, {});
  assert.ok(!boss.mech, 'auto battle used a skill and interrupted it');
});

test('only one mechanic at a time per boss, none for ordinary monsters, and no stuns', () => {
  const { game, boss } = setup('merlion', { gap: 3 });
  assert.ok(startMechanic(game, boss));
  assert.equal(startMechanic(game, boss), null, 'one at a time');
  const t = game._nearestFree(game.player.x - 2, game.player.y);
  const gob = game.spawnNpc('goblin', t.x, t.y, { wander: 0 });
  gob.target = game.player;
  assert.equal(startMechanic(game, gob), null);
  step(game, CIRCLE_TICKS + 2);
  assert.equal(game.playerStun || 0, 0); assert.equal(game.playerRoot || 0, 0);
  tickBossMechanics(game);
});

test('the mechanic drawings run on a canvas without errors (shield, cast bar, healer beam, safe circle)', async () => {
  const { drawBossMech, drawSafeZone } = await import('../src/render/bossmechfx.js');
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  for (const id of ['jade_dragon', 'kusu_tortoise', 'durian_behemoth', 'demon_lord', 'tualang_treant', 'the_garuda']) {
    const { game, boss } = setup(id, { gap: 3 });
    for (let i = 0; i < 3; i++) {
      const m = startMechanic(game, boss);
      assert.doesNotThrow(() => drawBossMech(ctx, boss, 100, 100, 1.4, 1234, 0, 0), id);
      for (const a of m.adds || []) assert.doesNotThrow(() => drawBossMech(ctx, a, 80, 120, 1, 1234, 0, 0));
      if (m.hz) assert.doesNotThrow(() => drawSafeZone(ctx, m.hz, 0, 0, 1234, 32));
      boss._mechN = i + 1;
      clearMechanic(game, boss);
    }
  }
});
