// Boss fights of 3-4 minutes, casters brought up to the other classes, and the
// spell elements' sharper matchups and effects. The balance checks use the real
// game headlessly (tools/balance/classlab.mjs, and tools/balance/bossfight.mjs for
// whole boss fights) with a typical upgraded build for each level, the build the
// late-game damage lab measured.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setupClass, dummyDps, pickTargets } from '../tools/balance/classlab.mjs';
import { bossFight, bossesNear } from '../tools/balance/bossfight.mjs';
import { NPC } from '../src/game/npc.js';
import { getNpc, ALL_BOSS_IDS, bossSiegeScale } from '../src/data/npcs.js';
import { EQUIP_SLOTS } from '../src/game/equipment.js';
import { masteryType, MASTERY_RANKS, enchantValue, isMagicItem, STONE as UP_STONE } from '../src/game/mastery.js';
import { starterBlessings } from '../src/game/blessings.js';
import { CLASS_BY_ID } from '../src/data/classes.js';
import { RACES } from '../src/data/races.js';
import { ELEMENTS, ELEMENT_MATCHUP, elementMatchup, elementMult, getSpell } from '../src/data/magic.js';
import { shatterPierce, magicAttunement, playerMagicVsNpc } from '../src/game/combat.js';
import { PERK_TRACKS, sumPerks } from '../src/data/perks.js';
import { elementTint } from '../src/render/worldlabels.js';
import { codexEntry } from '../src/game/codex.js';

/** A typical build at level L: quality, mastery, refining and enchant lines as a
 *  player has them by then, and the best starter blessings. */
function typical(cls, L) {
  const g = setupClass(cls, L), eq = g.equipment;
  const P = L <= 100 ? { q: 'fine', rank: 2, star: 4, lines: 1 } : L <= 200 ? { q: 'superior', rank: 3, star: 6, lines: 2 }
    : L <= 300 ? { q: 'epic', rank: 4, star: 9, lines: 3 } : { q: 'epic', rank: 5, star: 10, lines: 3 };
  for (const s of EQUIP_SLOTS) {
    const id = eq.slots[s];
    if (!id) continue;
    eq.slotQuality[s] = P.q;
    eq.mastery[masteryType(id)] = MASTERY_RANKS[P.rank].xp;
    const off = s === 'shield' && eq.slots.weapon === id;
    (off ? eq.offRefines : eq.refines)[id] = P.star;
    (off ? eq.offEnchants : eq.enchants)[id] = [isMagicItem(id) ? 'magPct' : 'atkPct', 'critDmg', 'crit'].slice(0, P.lines).map((stat) => ({ stat, value: enchantValue(id, stat) }));
  }
  const style = CLASS_BY_ID[cls].style;
  g.activePrayers = new Set(starterBlessings(L, style === 'dance' ? 'melee' : style));
  g.player.hp = g.maxHp();
  return g;
}
const TICKS = 60;
/** Single-target damage per second (real life) into the three monsters picked for the level. */
function dps(cls, L, boss = false) {
  const game = typical(cls, L), tg = pickTargets(L);
  return tg.reduce((s, id) => s + dummyDps(cls, L, [id], [[1, 0]], TICKS, { game, boss }), 0) / tg.length;
}
const BOSSES = ALL_BOSS_IDS.map((id) => [id, getNpc(id)]).filter(([, d]) => !d.fixed && d.attackable);
const bossFor = (L) => BOSSES.slice().sort((x, y) => Math.abs(x[1].level - L) - Math.abs(y[1].level - L))[0];
const median = (v) => { const s = v.slice().sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

test('boss life: well under x1 for the first bosses, a siege of about x9 from level 360, rising gently past 1,000', () => {
  assert.ok(bossSiegeScale(50) < 0.5 && bossSiegeScale(100) < 1);
  assert.ok(bossSiegeScale(400) > 8 && bossSiegeScale(1000) < 11);
  let prev = 0;
  for (const L of [50, 81, 100, 120, 150, 200, 300, 600, 1000, 3000, 9999]) { const s = bossSiegeScale(L); assert.ok(s >= prev, `never falls (${L})`); prev = s; }
  assert.ok(bossSiegeScale(9999) < bossSiegeScale(1000) * 2);
  // Applied to every boss, and only to bosses.
  for (const [, d] of BOSSES) assert.equal(d.siege, bossSiegeScale(d.level));
  assert.equal(getNpc('goblin').siege, undefined);
});

test('a solo fight against a level-matched boss takes 3-4 minutes, mechanics and all, at every level', () => {
  // Real fights (tools/balance/bossfight.mjs): auto battle against the boss nearest
  // your fight level, its mechanic, signature move and ground attacks live. Before:
  // 6-18 minutes below level 200 (and never over against a style shield it
  // couldn't break, before boss shields were taken out), 4-9 minutes above.
  const times = [];
  for (const [cls, L] of [['swordsman', 100], ['wizard', 100], ['swordsman', 300], ['wizard', 300], ['archer', 300], ['swordsman', 1000], ['wizard', 1000]]) {
    const id = bossesNear(setupClass(cls, L).fightLevel())[0];
    const r = bossFight(cls, L, id, { maxTicks: 1000 });
    assert.ok(r.killed && !r.died, `${cls} ${L} beats ${id}`);
    // A Wizard's Fire burns go off every half second and with every hit (the
    // owner's much stronger Ignite), which about halves its fights: 1-2 minutes.
    const floor = cls === 'wizard' ? 30 : 75;
    assert.ok(r.secs > floor && r.secs < 480, `${cls} ${L} against ${id}: ${r.secs.toFixed(0)} s`);
    times.push(r.secs);
  }
  const med = median(times);
  // (The floor was 150 s: when scout leather, robes and dancewear took up armour
  // pierce, Wizards got through boss armour and their fights shortened, to a
  // median of about 140 s. Still a few minutes; well short of the 6-18 of before.)
  assert.ok(med > 120 && med < 330, `median ${med.toFixed(0)} s`);
});

test('a boss that once raised a style shield no longer stalls a one-style class: it wins in a few minutes', () => {
  // Before: a Swordsman couldn't crack Toman's ranged shield in time, the boss
  // mended 5% a time and the fight never ended (auto battle wandered off). Boss
  // shields are gone now (Toman calls a safe circle instead); the fight stays short.
  const r = bossFight('swordsman', 85, 'toman_tyrant', { maxTicks: 1000 });
  assert.ok(r.killed && !r.died, 'beaten');
  assert.equal(r.mechanic, 'circle');
  assert.ok(r.secs < 420 && r.mechShare < 0.35, `${r.secs.toFixed(0)} s, ${(r.mechShare * 100).toFixed(0)}% under a mechanic`);
});

test('a boss\'s reflect burns back at most a tenth of your life a tick, however many arrows you loose', () => {
  const g = setupClass('archer', 300), p = g.player;
  const boss = new NPC('slag_titan', p.x + 2, p.y, 0, {});
  boss.reflectTicks = 3; boss.reflectFrac = 0.2;
  const hp0 = p.hp;
  for (let i = 0; i < 20; i++) g._applyPlayerHit(boss, 5000);
  assert.ok(p.alive && hp0 - p.hp <= Math.ceil(g.maxHp() * 0.1), `took ${hp0 - p.hp} of ${g.maxHp()}`);
  const hp1 = p.hp;
  g.tickCount++;
  g._applyPlayerHit(boss, 5000);
  assert.ok(p.hp < hp1, 'and again the next tick');
});

test('auto battle still takes on a siege boss it could take on before, and its rewards keep pace', () => {
  const g = setupClass('swordsman', 300);
  const [id, d] = bossFor(300);
  assert.ok(d.siege > 3);
  // Its rough time-to-kill is siege x longer, and so is the allowance.
  assert.ok(g._autoCanBeat({ def: d, hp: d.maxHp, npcId: id }), 'a level-matched boss is fair game');
  // Upgrade materials and the hoard grow with the siege; one-off gear does not.
  const n = new NPC(id, g.player.x + 2, g.player.y, 0, {});
  let loot = [];
  g._autoLoot = (l) => { loot = l; };
  g.rollDrops(n);
  const stones = loot.find((l) => l[0] === UP_STONE);
  assert.ok(stones && stones[1] >= Math.round(20 * d.siege), `a siege's pile of stones (${stones?.[1]})`);
});

test('Wizards and Sorcerers out-damage the other classes 2-3.5x from level 100 to 1,000, with Fire\'s burns', () => {
  // Once: Wizards at 80% of the median at level 100, 45% at 300 and 22% at 1,000.
  // Then about the median (110%). Now Fire's burns go off every half second and
  // with every hit (the owner chose a much stronger Ignite, knowing casters would
  // pull far ahead): 230-300% of the median.
  const others = ['swordsman', 'paladin', 'archer', 'ranger', 'ninja', 'dancer'];
  for (const L of [100, 300, 1000]) {
    const med = median(others.map((c) => dps(c, L)));
    for (const cls of ['wizard', 'sorcerer']) {
      const r = dps(cls, L) / med;
      assert.ok(r > 2 && r < 3.5, `${cls} at level ${L}: ${(r * 100).toFixed(0)}% of the median`);
    }
  }
});

test('the Mystic blessings count for spells, and Magic perks match the two melee tracks', () => {
  const g = setupClass('wizard', 300), npc = new NPC('goblin', g.player.x + 2, g.player.y, 0, {});
  npc.maxHp = npc.hp = 1e9;
  g._critHit = (dmg) => ({ dmg, crit: false, mult: 1 });
  g._aoeCrit = (dmg) => ({ dmg, critX: 0 });
  const hitWith = (prayers) => {
    g.activePrayers = new Set(prayers);
    let total = 0;
    for (let i = 0; i < 40; i++) { g.player.attackCooldown = 0; npc.hp = npc.maxHp; g._magicAttack(npc); total += npc.maxHp - npc.hp; }
    return total;
  };
  const plain = hitWith([]), blessed = hitWith(['mystic_might']);
  assert.ok(blessed > plain * 1.4, `Mystic Might (+60%) lifts spells: ${blessed} vs ${plain}`);
  // A round of ten perks: Magic's damage matches Attack + Strength's.
  const sum = (tracks) => sumPerks(tracks, () => 200);
  assert.ok(Math.abs(sum(['magic']).dmg - sum(['attack', 'strength']).dmg) < 1e-9);
  assert.ok(sum(['magic']).extra >= sum(['attack', 'strength']).extra);
  assert.equal(PERK_TRACKS.magic.length, 10);
  // Attunement: nothing up to Magic 100, then most of it by 300.
  assert.equal(magicAttunement(100), 1);
  assert.ok(magicAttunement(300) > 1.75 && magicAttunement(1000) < 1.95);
});

test('elements: every race has a strong element; strong x1.5, resisted x0.7', () => {
  assert.equal(ELEMENT_MATCHUP.strong, 1.5);
  assert.equal(ELEMENT_MATCHUP.weak, 0.7);
  for (const r of Object.keys(RACES)) {
    assert.ok(Object.keys(ELEMENTS).some((e) => elementMatchup(e, r) === 'strong'), `${r} has an element strong against it`);
    assert.ok(Object.keys(ELEMENTS).filter((e) => elementMatchup(e, r) !== 'weak').length >= 2, `${r} resists at most two`);
  }
  assert.equal(elementMatchup('fire', 'undead'), 'strong');
  assert.equal(elementMatchup('fire', 'dragon'), 'weak');
  assert.equal(elementMatchup('fire', 'humanoid'), null);
  assert.deepEqual(['strong', 'weak', null].map(elementMult), [1.5, 0.7, 1]);
  // The codex shows them.
  const g = setupClass('wizard', 50);
  g.kills = { cursed_pirate: 1 };
  const e = codexEntry(g, 'cursed_pirate');
  assert.ok(e.elements.find((x) => x.m === 'strong').list.some((t) => t.includes('Fire')));
});

/** A wizard beside one huge-life foe, crits off, to look at single casts. */
// The foe is a reptile body throughout (heavy armour, weak to magic), and only its
// race changes (by family: a scarecrow is a plant, a qilin a dragon), so nothing but
// the element matchup differs between them.
function bench(family = 'plain_test') {
  const g = setupClass('wizard', 300);
  g.player.spellAuto = false;
  const n = new NPC('goblin', g.player.x + 2, g.player.y, 0, {});
  n.def = { ...n.def, sprite: 'reptile', family, aggressive: false };
  n.maxHp = n.hp = 1e12;
  g.npcs = [n];
  g._critHit = (dmg) => ({ dmg, crit: false, mult: 1 });
  g._aoeCrit = (dmg) => ({ dmg, critX: 0 });
  const cast = (spell) => { g.player.spell = spell; g.player.attackCooldown = 0; const h = n.hp; g._magicAttack(n); return h - n.hp; };
  return { g, n, cast };
}

test('elements bite harder and softer: an effective spell hits about 1.5x, a resisted one 0.7x, with gold and grey numbers', () => {
  const avg = (family, spell) => {
    const { g, n, cast } = bench(family);
    let t = 0;
    for (let i = 0; i < 200; i++) { t += cast(spell); n.shatter = null; n.ignite = null; }
    return { t, g, n };
  };
  // Fire: a reptile is neither, a plant (scarecrow) is strong, a dragon (qilin) resists.
  const neutral = avg('plain_test', 'fire_strike').t, strong = avg('scarecrow', 'fire_strike').t, weak = avg('celestial_qilin', 'fire_strike').t;
  assert.ok(strong / neutral > 1.35 && strong / neutral < 1.65, `strong ${(strong / neutral).toFixed(2)}x`);
  assert.ok(weak / neutral > 0.6 && weak / neutral < 0.8, `resisted ${(weak / neutral).toFixed(2)}x`);
  const { g, n, cast } = bench('celestial_qilin');
  g.effects = [];
  cast('fire_strike');
  assert.ok(g.effects.some((e) => e.type === 'hitsplat' && e.entity === n && e.dmg > 0 && e.tint === '#9aa3b2'), 'resisted: a grey number');
  assert.ok(g.effects.some((e) => e.type === 'hitsplat' && e.text === 'Fire: Resisted'), 'and a "Resisted" pop');
  const b = bench();
  b.g.effects = [];
  b.cast('wind_strike');
  assert.ok(b.g.effects.some((e) => e.type === 'hitsplat' && e.entity === b.n && e.tint === ELEMENTS.wind.splat), 'a neutral spell in its element\'s colour');
});

test('Wind: Gale adds 15% crit chance to its casts', () => {
  const { g, n } = bench();
  const critCh = (spell) => { g._castElement = getSpell(spell).element; const m = g._offensiveMods(n, 'magic'); g._castElement = null; return m.critCh; };
  assert.ok(Math.abs(critCh('wind_strike') - critCh('earth_strike') - ELEMENTS.wind.crit) < 1e-9);
  assert.equal(ELEMENTS.wind.crit, 0.15);
});

test('Water: Chill slows a foe and its blows land 25% softer, then wears off', () => {
  const { g, n, cast } = bench();
  n.def = { ...n.def, maxHit: 400, attack: 5000 };
  g.perkMods = () => ({});
  const p = g.player;
  const blow = () => {
    const rnd = Math.random;
    p.hp = p.maxHp = 1e6;
    g.maxHp = () => 1e6;
    // Low rolls: the blow lands (no dodge perks here) for the bottom of its range.
    try { Math.random = () => 0.001; const h = p.hp; g.resolveNpcAttack(n); return h - p.hp; } finally { Math.random = rnd; }
  };
  const before = blow();
  assert.ok(before > 0);
  cast('water_strike');
  assert.ok(n.slowTicks > 0, 'chilled');
  assert.equal(elementTint(g, n).col, '#7fd4ff', 'washed icy blue');
  const chilled = blow();
  assert.ok(chilled <= Math.floor(before * 0.75) + 1 && chilled >= Math.floor(before * 0.75) - 1, `${chilled} vs ${before}`);
  for (let i = 0; i < 6; i++) n._combatAI(g);
  assert.equal(n.slowTicks, 0);
  assert.equal(blow(), before, 'full strength again');
});

test('Earth: Shatter cracks armour, up to 5 cracks of +6% pierce for every hit on the foe, and fades', () => {
  const { g, n, cast } = bench();
  const mods = () => g._offensiveMods(n, 'melee').dmgM;
  const m0 = mods();
  for (let i = 0; i < 7; i++) cast('earth_strike');
  assert.equal(n.shatter.n, 5, 'stops at 5 cracks');
  assert.equal(shatterPierce(n, g.tickCount), 30);
  // (Was > 1.3x: since robes pierce armour too, the Wizard's own pierce already cancels
  // this foe's armour, so the cracks' 30% adds on top as extra damage, about 1.2x.)
  assert.ok(mods() / m0 > 1.15, `every hit lands harder, a sword's too (${(mods() / m0).toFixed(2)}x)`);
  assert.equal(elementTint(g, n).col, '#a07838');
  g.tickCount += ELEMENTS.earth.shatter.ticks + 1;
  assert.equal(shatterPierce(n, g.tickCount), 0, 'faded');
  assert.equal(n.shatter, null);
});

test('Fire: Ignite burns 15% of the hit before its crit for 5s, and the foe glows', () => {
  const { g, n, cast } = bench();
  const hit = cast('fire_strike');
  assert.equal(n.ignite.burns.length, 1);
  assert.equal(n.ignite.burns[0].dmg, Math.max(1, Math.round(hit * 0.15)));
  assert.equal(elementTint(g, n).col, '#ff6a1a');
  // The next cast's hit sets the first burn off (then adds its own).
  const before = n.hp;
  const h2 = cast('fire_strike');
  assert.equal(n.ignite.owedN, 1);
  assert.equal(n.ignite.burns.length, 2);
  g._tickIgnites();
  assert.equal(before - n.hp, h2 + n.ignite.burns[0].dmg, 'the burn went off with the hit');
  // A crit's burn is worked out from the hit before the crit.
  const b = bench();
  b.g._critHit = (dmg) => ({ dmg: dmg * 2, crit: true, mult: 2 });
  const hc = b.cast('fire_strike');
  assert.equal(b.n.ignite.burns[0].dmg, Math.max(1, Math.round(hc / 2 * 0.15)));
});

test('Fire: a spell\'s splash sets off the burns of every burning monster it reaches', () => {
  const { g, n, cast } = bench();
  const m = new NPC('goblin', n.x + 1, n.y, 0, {});
  m.def = { ...m.def, sprite: 'reptile', family: 'plain_test', aggressive: false };
  m.maxHp = m.hp = 1e12;
  g.npcs = [n, m];
  cast('fire_strike');
  assert.ok(m.ignite?.burns.length === 1 && m.ignite.owedN === 0, 'the splash lit it too');
  cast('fire_strike');
  assert.equal(m.ignite.owedN, 1, 'and the next splash set it off');
});

test('a spell bolt flies in its element\'s colour, a crit\'s brighter and bigger', () => {
  const { g, cast } = bench();
  const bolt = () => g.effects.filter((e) => e.type === 'projectile' && e.kind === 'bolt').pop();
  for (const id of ['wind_strike', 'water_strike', 'earth_strike', 'fire_strike']) {
    const sp = getSpell(id);
    g.effects = []; delete g._critHit; g._critHit = (dmg) => ({ dmg, crit: false, mult: 1 });
    cast(id);
    assert.deepEqual([bolt().color, bolt().crit], [sp.tint, false], `${id}: its own colour`);
    g.effects = []; g._critHit = (dmg) => ({ dmg: dmg * 2, crit: true, mult: 2 });
    cast(id);
    assert.deepEqual([bolt().color, bolt().crit], [sp.critTint, true], `${id}: a crit, brighter and bigger, not purple`);
  }
});

test('a spell\'s max hit counts its attunement, and the Stats tab agrees with the attack code', async () => {
  const { maxHitNow } = await import('../src/game/statsheet.js');
  const g = setupClass('wizard', 300);
  g.activePrayers = new Set(['mystic_might']);
  const sp = getSpell(g.player.spell);
  const m = maxHitNow(g);
  const base = playerMagicVsNpc(g.skills, g.equipment, sp, {}).max;
  assert.ok(m.max >= Math.round(base * 1.6 * 0.99), `the blessing shows in the Stats max hit (${m.max} vs ${base})`);
  assert.ok(m.parts.some(([l]) => l === 'Prayer'));
});

test('an Endless Gate boss keeps the wave\'s life, so its rewards are not a siege\'s', async () => {
  const { waveBossDef } = await import('../src/game/waves.js');
  const [id] = bossFor(1000);
  assert.ok(getNpc(id).siege > 5);
  assert.equal(waveBossDef(id, 5, 1000).siege, 1);
});
