// The Stats tab (src/game/statsheet.js): its numbers must be the ones combat
// really uses. Where the game has a function for a stat the sheet calls it;
// where the attack code works a number out inline (the max hit after every
// damage bonus, the crit chance), these tests make a real attack and catch the
// values it used, so the sheet can't quietly drift from the combat code.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { COMBAT_BEAT_MS } from '../src/config.js';
import { statSheet, maxHitNow, critNow, speedNow, currentSpell } from '../src/game/statsheet.js';
import { statsPanelHTML } from '../src/ui/statspanel.js';
import { UI } from '../src/ui/ui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function newGame(style, classId) {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  if (classId) g.chooseClass(classId); else g.chooseStartingStyle(style);
  return g;
}

/** A monster with life to spare, so one attack can't kill it. */
function dummy(g, pick = (n) => !n.def.boss && !n.champion) {
  const npc = g.npcs.find((n) => n.alive && n.attackable && !n.ally && pick(n));
  npc.hp = npc.maxHp = 1e9;
  return npc;
}

/** Make one real attack with every roll at its top (so each blow hits its max
 *  and nothing random like a crit, an extra strike or poison fires), catching
 *  each blow's damage before crits and the crit chance the attack used. */
function attackOnce(g, npc) {
  const pre = [], landed = [];
  const crit = g._critHit, apply = g._applyPlayerHit;
  g._critHit = function (dmg, critCh) { pre.push({ dmg, critCh }); return crit.call(this, dmg, critCh); };
  g._applyPlayerHit = function (n, dmg, opts) { if (n === npc) landed.push(dmg); return apply.call(this, n, dmg, opts); };
  const rnd = Math.random;
  Math.random = () => 0.9999999;
  try { g.doPlayerAttack(npc); } finally { Math.random = rnd; delete g._critHit; delete g._applyPlayerHit; }
  return { pre, landed };
}

/** Pile on bonuses from every kind of source, so the comparison isn't trivial. */
function buffUp(g) {
  for (const s of ['attack', 'ranged', 'magic', 'agility', 'prayer', 'hitpoints', 'crafting', 'mining', 'woodcutting', 'firemaking', 'hunter', 'cooking', 'smithing'])
    g.skills.addXp(s, 3_000_000);
  g.attrs.str = 4; g.attrs.dex = 3; g.attrs.int = 2;
  g.potions.super_strength = 60000;
  g.potions.super_attack = 60000;
  g.prayerPoints = g.maxPrayer();
  g.activePrayers.add('superhuman');
  g.activePrayers.add('reflexes');
  g.buff = { id: 'test', name: 'Test buff', dmg: 0.2, crit: 0.05, haste: 30, until: g.tickCount + 100 };
}

for (const style of ['melee', 'ranged', 'magic']) {
  test(`stat sheet max hit and crit chance match a real ${style} attack`, () => {
    const g = newGame(style);
    buffUp(g);
    for (const npc of [dummy(g), dummy(g, (n) => n.def.boss)].filter(Boolean)) {
      const want = maxHitNow(g, { npc });
      const { pre, landed } = attackOnce(g, npc);
      assert.ok(pre.length >= 1, 'the attack landed');
      // A dual wielder's off-hand rolls its own crit too: its blow comes last.
      const main = want.off ? pre.slice(0, -1) : pre;
      for (const p of main) assert.equal(p.dmg, want.max, `${style} max hit vs ${npc.def.name || npc.npcId}`);
      assert.equal(main.length, want.arrows, 'one blow per arrow of the spread');
      assert.ok(Math.abs(pre[0].critCh - critNow(g).total) < 1e-12, `${style} crit chance`);
      if (want.off) assert.equal(landed[landed.length - 1], want.off, 'the off-hand blow');
    }
  });
}

test('stat sheet: dual wielding shows the off-hand blow the attack makes', () => {
  const g = newGame('melee');
  assert.ok(g.equipment.isDualWielding(), 'the melee start kit is two scimitars');
  const npc = dummy(g);
  const want = maxHitNow(g, { npc });
  assert.ok(want.off > 0);
  const { landed } = attackOnce(g, npc);
  assert.deepEqual(landed, [want.max, want.off]);
  // The sheet's row is against no foe in particular, so it leaves out the foe's armour
  // and your pierce (scout leather pierces armour now, which the target above counts).
  assert.ok(statSheet(g).sections[0].rows.some((r) => r.id === 'offhand' && r.text === String(maxHitNow(g).off)));
});

test('stat sheet: a Monk\'s punch and palm strike, Chi included, match real blows', () => {
  const g = newGame(null, 'monk');
  assert.equal(g.equipment.get('shield'), 'bronze_monk_gloves', 'monk gloves in the off-hand');
  buffUp(g);
  const npc = dummy(g);
  g.chi = 6; g.chiAt = g.tickCount;   // some Chi built up
  const want = maxHitNow(g, { npc });
  assert.ok(want.parts.some(([label]) => /^Chi 6\/10/.test(label)), 'the sheet counts the Chi');
  const { landed } = attackOnce(g, npc);
  assert.deepEqual(landed, [want.max, want.off], 'the punch, then the palm strike');
  assert.ok(statSheet(g).sections[1].rows.some((r) => r.id === 'dodge'), 'a Monk sees its dodge chance');
});

test('stat sheet: a Zealot\'s Fervour and a Priest smiting the undead match real spells', async () => {
  const { raceOf } = await import('../src/data/races.js');
  const z = newGame(null, 'zealot');
  buffUp(z);
  z.player.hp = Math.round(z.maxHp() / 2);   // half its life gone: Fervour adds about 15%
  const zn = dummy(z);
  const zw = maxHitNow(z, { npc: zn });
  assert.ok(zw.parts.some(([label]) => /^Fervour/.test(label)), 'the sheet counts the Fervour');
  assert.equal(attackOnce(z, zn).pre[0].dmg, zw.max, 'the Zealot\'s spell');
  const p = newGame(null, 'priest');
  buffUp(p);
  const undead = dummy(p, (n) => !n.def.boss && !n.champion && raceOf(n.def, n.npcId) === 'undead');
  const pw = maxHitNow(p, { npc: undead });
  assert.ok(pw.parts.some(([label]) => /Smiting the unholy/.test(label)), 'the sheet counts the smiting');
  assert.equal(attackOnce(p, undead).pre[0].dmg, pw.max, 'the Priest\'s spell on the undead');
  assert.ok(statSheet(p).sections[0].rows.some((r) => r.id === 'lifesteal' && r.parts.some(([label]) => /Priest/.test(label))), 'its healing spells show as lifesteal');
});

test('stat sheet: Dancer whip max hit matches a real lash', () => {
  const g = newGame(null, 'dancer');
  assert.equal(g.combatMode(), 'dance');
  buffUp(g);
  const npc = dummy(g);
  const want = maxHitNow(g, { npc });
  const { pre } = attackOnce(g, npc);
  assert.equal(pre[0].dmg, want.max);
  assert.ok(Math.abs(pre[0].critCh - critNow(g).total) < 1e-12);
  assert.ok(statSheet(g).sections[1].rows.some((r) => r.id === 'dodge'), 'a Dancer sees their dodge chance');
});

test('stat sheet: attack interval and max life are the game\'s own', () => {
  for (const style of ['melee', 'ranged', 'magic']) {
    const g = newGame(style);
    buffUp(g);
    const sp = speedNow(g);
    assert.equal(sp.beats, g.attackInterval(style === 'magic' ? currentSpell(g) : null));
    assert.equal(sp.secs, sp.beats * COMBAT_BEAT_MS / 1000);
    const sheet = statSheet(g);
    const life = sheet.sections[1].rows.find((r) => r.id === 'maxhp');
    assert.equal(life.text.replace(/,/g, ''), String(g.maxHp()));
  }
});

test('stat sheet: potions, prayers and a class buff change the numbers and show as effects', () => {
  const g = newGame('melee');
  g.skills.addXp('prayer', 3_000_000);
  const before = { max: maxHitNow(g).max, crit: critNow(g).total, gap: speedNow(g).secs };
  g.potions.super_strength = 60000;
  g.potions.super_attack = 60000;
  assert.ok(maxHitNow(g).max > before.max, 'a strength potion raises the max hit');
  assert.ok(critNow(g).total > before.crit, 'an attack potion raises crit chance');
  g.prayerPoints = g.maxPrayer();
  g.togglePrayer('clarity');
  const withPotions = critNow(g).total;
  assert.ok(Math.abs(withPotions - (before.crit + 0.08 + 0.05)) < 1e-9, 'potion and prayer crit add up');
  g.buff = { id: 'test', name: 'Test buff', haste: 50, until: g.tickCount + 10 };
  assert.ok(speedNow(g).secs < before.gap, 'a haste buff shortens the time between attacks');
  const names = statSheet(g).effects.map((e) => e.name);
  for (const n of ['Super strength', 'Super attack', 'Clarity of Thought', 'Test buff']) assert.ok(names.includes(n), n);
  const fx = statSheet(g).effects.find((e) => e.name === 'Super strength');
  assert.equal(fx.left, 60000);
});

test('Stats tab renders headlessly without throwing', () => {
  for (const [style, cls] of [['melee'], ['ranged'], ['magic'], [null, 'dancer']]) {
    const g = newGame(style, cls);
    buffUp(g);
    g.assignSlayerTask();
    const html = statsPanelHTML(statSheet(g), new Set(['crit']));
    for (const s of ['Max hit', 'Crit chance %', 'Max life', 'Movement speed bonus %', 'Active effects', 'Super strength']) assert.ok(html.includes(s), s);
    assert.ok(/data-row="crit"[^>]*open/.test(html), 'an open breakdown stays open');
    assert.ok(!/NaN|undefined/.test(html), 'no broken numbers');
    // The UI's own render, with a stub panel element (no DOM in the tests).
    const el = { innerHTML: '', closest: () => ({ classList: { contains: () => false } }), querySelectorAll: () => [] };
    const ui = { game: g, el: { statsPanel: el } };
    UI.prototype.renderStatsPanel.call(ui);
    assert.ok(el.innerHTML.includes('Max hit'));
  }
});

test('Stats highlights canonical values before the detail sections and groups effects by source', () => {
  const g = newGame('melee');
  g.potions.super_strength = 60000;
  g.potions.super_magic = 60000;
  g.activePrayers.add('thick_skin');
  g.braceTicks = 5;
  g.assignSlayerTask();
  const sheet = statSheet(g);
  const html = statsPanelHTML(sheet);
  const visible = html.slice(0, html.indexOf('data-sec="offence"'));
  for (const id of ['maxhit', 'interval', 'maxhp', 'reduce']) {
    const row = sheet.sections.flatMap((section) => section.rows).find((entry) => entry.id === id);
    assert.ok(visible.includes(`data-stat="${id}"`));
    assert.ok(visible.includes(`<dd>${row.text}</dd>`));
  }
  for (const id of ['offence', 'defence', 'utility', 'effects']) {
    assert.ok(html.includes(`data-stats-disclosure="section:${id}">`), 'detail categories start collapsed');
  }
  const sourceGroups = Object.groupBy(sheet.effects, (effect) => effect.kind);
  assert.deepEqual(sourceGroups.consumable.map(({ name }) => name), ['Super strength', 'Super magic']);
  assert.ok(sourceGroups.blessing.some(({ name }) => name === 'Thick Skin'));
  assert.ok(sourceGroups.combat.some(({ name }) => name === 'Brace'));
  assert.ok(sourceGroups.slayer.some(({ name }) => name === 'Slayer task'));
  assert.match(html, /Food &amp; potions[\s\S]*Super strength[\s\S]*1m 00s[\s\S]*Super magic[\s\S]*Inactive · Magic only/);
});
