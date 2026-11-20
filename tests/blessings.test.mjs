// Prayer as a Blessings loadout (game/blessings.js): slots by Prayer level,
// conflict groups, no drain, Faith from fighting and bones, the Prayer Burst
// (and auto battle firing it), the L hotkey, saves, and the panel without a DOM.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { saveGame, clearSave, snapshot } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { xpForLevel } from '../src/data/xp.js';
import {
  PRAYERS, PRAYER_BY_ID, BLESSING_SLOT_LADDER, FAITH_BASE, FAITH_GAIN,
  BURST_WARD_TICKS, BURST_ZEAL_TICKS, burstPower, blessingCost,
} from '../src/data/prayers.js';
import { blessingSlots, trimBlessings, slotsUsed, shouldAutoBurst, starterBlessings } from '../src/game/blessings.js';
import { ARTICLE_BY_ID, articleBlocks } from '../src/data/compendium.js';
import { blessingsPanelHTML, slotStripHTML, renderBlessingsPanel, renderFaithOrb, BURST_KEY, burstText } from '../src/ui/blessingsui.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function newGame(prayerLevel = 1) {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.skills.xp.prayer = xpForLevel(prayerLevel);
  return g;
}

test('blessing slots grow with Prayer level along the ladder', () => {
  assert.deepEqual(BLESSING_SLOT_LADDER.map((r) => [r.level, r.slots]), [[1, 1], [40, 2], [99, 3], [175, 4], [250, 5]]);
  for (const [lvl, n] of [[1, 1], [39, 1], [40, 2], [98, 2], [99, 3], [174, 3], [175, 4], [249, 4], [250, 5], [999, 5]]) {
    assert.equal(blessingSlots(lvl), n, `Prayer ${lvl}: ${n} slots`);
  }
  const g = newGame(99);
  assert.equal(g.blessingSlots(), 3);
});

test('equipping: level locks, slot limits, conflict groups swap, and Spirit takes two slots', () => {
  const g = newGame(1);
  assert.equal(g.toggleBlessing('burst_strength'), false, 'Burst of Strength needs Prayer 5');
  assert.ok(g.toggleBlessing('thick_skin'));
  g.skills.xp.prayer = xpForLevel(20);   // still one slot
  assert.equal(g.toggleBlessing('burst_strength'), false, 'no free slot');
  assert.deepEqual([...g.activePrayers], ['thick_skin']);
  g.skills.xp.prayer = xpForLevel(45);   // two slots
  assert.ok(g.toggleBlessing('burst_strength'));
  assert.ok(g.toggleBlessing('rock_skin'), 'a rival in the same group swaps in even with the slots full');
  assert.deepEqual([...g.activePrayers].sort(), ['burst_strength', 'rock_skin']);
  assert.equal(g.toggleBlessing('rock_skin'), false, 'tapping an equipped one takes it off');
  assert.ok(!g.activePrayers.has('rock_skin'));

  // Spirit of the Worthy: two slots, and it pushes out the melee blessings it covers.
  const h = newGame(300);
  assert.equal(blessingCost(PRAYER_BY_ID.worthy_spirit), 2);
  for (const id of ['clarity', 'superhuman', 'rock_skin', 'eagle_eye']) assert.ok(h.toggleBlessing(id), id);
  assert.equal(slotsUsed(h.activePrayers), 4);
  assert.ok(h.toggleBlessing('worthy_spirit'), 'its three rivals come off, so it fits');
  assert.deepEqual([...h.activePrayers].sort(), ['eagle_eye', 'worthy_spirit']);
  assert.ok(h.toggleBlessing('mystic_lore') && h.toggleBlessing('protect_melee'));
  assert.equal(slotsUsed(h.activePrayers), 5);
  assert.equal(h.toggleBlessing('deadeye'), true, 'Deadeye replaces Eagle Eye (same group)');
  assert.ok(!h.activePrayers.has('eagle_eye'));
});

test('equipped blessings apply their multipliers, never drain, and stay on', () => {
  const g = newGame(300);
  const npc = g.npcs.find((n) => n.def.attackable && !n.def.boss);
  const base = g._offensiveMods(npc, g.combatMode()).critCh;
  for (const id of ['ultimate_strength', 'steel_skin', 'incredible_reflexes', 'protect_melee']) assert.ok(g.toggleBlessing(id));
  const m = g.prayerMult();
  assert.ok(Math.abs(m.str - 1.5) < 1e-9 && Math.abs(m.def - 1.5) < 1e-9);
  assert.ok(Math.abs(g._offensiveMods(npc, g.combatMode()).critCh - base - 0.20) < 1e-9, '+20% crit');
  assert.equal(g.protectFactor(), 0.30, 'Protect from Melee is 30% always on');
  g.prayerPoints = 7;
  for (let i = 0; i < 50; i++) g.update(600);
  assert.equal(g.prayerPoints, 7, 'no Faith drained');
  assert.equal(g.activePrayers.size, 4, 'still equipped');
});

test('Faith: cap of 20 + Prayer level, filled by hits, blows taken, kills, bones and the Monument', () => {
  const g = newGame(99);
  assert.equal(FAITH_BASE, 20);
  assert.equal(g.maxPrayer(), 20 + 99);
  g.prayerPoints = 0;
  g._hitAdrenaline(false);
  assert.ok(Math.abs(g.prayerPoints - g.maxPrayer() * FAITH_GAIN.hit) < 1e-9, 'a landed hit');
  g.prayerPoints = 0;
  const npc = g.npcs.find((n) => n.def.attackable && !n.def.boss);
  npc.hp = npc.maxHp = 1e6;            // no thorns kill
  g.player.autoRetaliate = false;      // and no swing back
  g.player.hp = g.maxHp();
  g.resolveNpcAttack(npc, { heavy: true });   // a heavy blow always lands for at least 1
  assert.ok(Math.abs(g.prayerPoints - g.maxPrayer() * FAITH_GAIN.hurt) < 1e-9, `a blow taken (${g.prayerPoints})`);
  g.prayerPoints = 0;
  g.killNpc(npc);
  assert.ok(g.prayerPoints >= g.maxPrayer() * FAITH_GAIN.kill - 1e-9, 'a kill');
  // About 45s of fighting (19 hits landed, 15 taken, 3 kills) fills the bar, give or take.
  const fill = 19 * FAITH_GAIN.hit + 15 * FAITH_GAIN.hurt + 3 * FAITH_GAIN.kill;
  assert.ok(fill > 0.9 && fill < 1.2, `a fight fills it (${fill})`);
  // Never past the cap.
  g.prayerPoints = g.maxPrayer() - 0.5;
  g.gainFaith(0.5);
  assert.equal(g.prayerPoints, g.maxPrayer());
  // Bones and the Monument (the bury cap is tested with the bones).
  g.prayerPoints = 0;
  g.inventory.add('big_bones', 1);
  g.buryBones(g.inventory.slots.findIndex((x) => x && x.id === 'big_bones'));
  assert.equal(g.prayerPoints, 2, 'big bones restore 2');
});

test('the Prayer Burst needs full Faith, spends it, heals, wards, adds damage, then wears off', () => {
  const g = newGame(99);
  g.prayerPoints = g.maxPrayer() - 1;
  assert.equal(g.prayerBurst(), false, 'not full yet');
  assert.equal(g.burstWard, 0);
  g.prayerPoints = g.maxPrayer();
  g.player.hp = 10;
  const pow = burstPower(99);
  const mult0 = g.prayerMult().str;
  assert.ok(g.prayerBurst());
  assert.equal(g.prayerPoints, 0, 'Faith spent');
  assert.equal(g.player.hp, Math.min(g.maxHp(), 10 + Math.round(g.maxHp() * pow.heal)), 'healed');
  assert.equal(g.burstWard, BURST_WARD_TICKS);
  assert.ok(g.burstActive());
  assert.equal(g.protectFactor(), 1, 'the ward stops every blow');
  assert.ok(Math.abs(g.prayerMult().str - mult0 - pow.zeal) < 1e-9 && Math.abs(g.prayerMult().magic - 1 - pow.zeal) < 1e-9, 'zeal for every style');
  // A heavy blow during the ward does nothing.
  const npc = g.npcs.find((n) => n.def.attackable && !n.def.boss);
  const hp = g.player.hp;
  g.resolveNpcAttack(npc, { heavy: true });
  assert.equal(g.player.hp, hp, 'warded');
  for (let i = 0; i < BURST_WARD_TICKS; i++) g.update(600);
  assert.equal(g.burstWard, 0, 'the ward is over after 3s');
  assert.ok(g.protectFactor() < 1);
  assert.ok(g.burstZeal > 0, 'zeal still running');
  for (let i = 0; i < BURST_ZEAL_TICKS; i++) g.update(600);
  assert.equal(g.burstZeal, 0);
  assert.ok(!g.burstActive());
  assert.ok(Math.abs(g.prayerMult().str - mult0) < 1e-9, 'damage back to normal');
  // Stronger with Prayer level, capped.
  assert.ok(burstPower(1).heal < burstPower(99).heal && burstPower(99).heal < burstPower(300).heal);
  assert.equal(burstPower(5000).heal, 0.5); assert.equal(burstPower(5000).zeal, 0.45);
});

test('the Burst fires by itself in any fight once Faith is full, at any range', () => {
  const g = newGame(50);
  g.prayerPoints = g.maxPrayer();
  g.player.hp = g.maxHp();
  g.player.action = null;
  for (const n of g.nearbyNpcs()) if (n.target === g.player) n.target = null;
  assert.equal(shouldAutoBurst(g), false, 'out of a fight: keep it');
  // Shooting a plain monster far away (a longbow's reach), healthy, no auto battle.
  const far = g.npcs.find((n) => n.alive && !n.def.boss && !n.champion && Math.max(Math.abs(n.x - g.player.x), Math.abs(n.y - g.player.y)) >= 8);
  g.player.action = { type: 'attack', npc: far };
  assert.ok(shouldAutoBurst(g), 'any fight counts, near or far');
  g.doTick();
  assert.ok(g.burstWard > 0 || g.burstZeal > 0, 'fired on the tick');
  assert.ok(g.prayerPoints < g.maxPrayer(), 'Faith spent');
  // Never without full Faith; and it can be switched off.
  const h = newGame(50);
  h.player.action = { type: 'attack', npc: h.npcs.find((n) => n.alive && n.def.boss) };
  assert.equal(shouldAutoBurst(h), false, 'never without full Faith');
  h.prayerPoints = h.maxPrayer();
  h.autoCfg.burst = false;
  h.doTick();
  assert.equal(h.burstWard, 0, 'switched off: no Burst');
});

test('the Burst hotkey (L) is wired and listed in the Compendium', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /e\.key === 'l' \|\| e\.key === 'L'\) \{\s*game\.prayerBurst\(\)/);
  assert.equal(BURST_KEY, 'L');
  const keys = articleBlocks(ARTICLE_BY_ID['controls-keyboard']).find((b) => b.keys).keys.map(([k]) => k);
  assert.ok(keys.includes('L'));
  const page = ARTICLE_BY_ID.prayers;
  assert.match(page.title, /Blessings/);
  const text = articleBlocks(page).filter((b) => typeof b === 'string').join(' ');
  assert.match(text, /Prayer Burst/); assert.match(text, /Faith/);
});

test('saves keep the loadout and Faith; older saves load with a starter loadout and a full bar', () => {
  const g = newGame(120);
  g.toggleBlessing('superhuman'); g.toggleBlessing('rock_skin');
  g.prayerPoints = 33.3;
  saveGame(g);
  const g2 = new Game(); g2.start();
  assert.deepEqual([...g2.activePrayers], ['superhuman', 'rock_skin']);
  assert.ok(Math.abs(g2.prayerPoints - 33.3) < 1e-9);

  // An older save: no blessings, no Faith. (An `activePrayers` list, if one turns up, is trimmed to fit.)
  const old = snapshot(g);
  delete old.blessings; delete old.prayerPoints;
  localStorage.setItem(SAVE_KEY, JSON.stringify(old));
  const g3 = new Game(); g3.start();
  // ...given the best blessings for their style, so nobody loses their prayer bonuses.
  assert.deepEqual([...g3.activePrayers], ['superhuman', 'rock_skin', 'reflexes']);
  assert.equal(g3.prayerPoints, g3.maxPrayer(), 'a full bar, as old saves reloaded');
  old.activePrayers = ['superhuman', 'ultimate_strength', 'burst_strength', 'eagle_eye', 'mystic_lore', 'nonsense', 'thick_skin'];
  localStorage.setItem(SAVE_KEY, JSON.stringify(old));
  const g4 = new Game(); g4.start();
  assert.deepEqual([...g4.activePrayers], ['superhuman', 'eagle_eye', 'mystic_lore'], 'locked, rival, unknown and extra ones dropped');
  // A starter loadout follows the fighting style and the slots.
  assert.deepEqual(starterBlessings(1, 'melee'), ['thick_skin']);
  assert.deepEqual(starterBlessings(99, 'ranged'), ['eagle_eye', 'rock_skin', 'reflexes']);
  assert.deepEqual(starterBlessings(250, 'magic'), ['mystic_might', 'steel_skin', 'incredible_reflexes', 'protect_melee', ]);
  // trimBlessings on its own.
  assert.deepEqual(trimBlessings(1, ['thick_skin', 'clarity']), ['thick_skin']);
  assert.deepEqual(trimBlessings(300, ['worthy_spirit', 'clarity', 'steel_skin', 'deadeye', 'mystic_might', 'protect_melee', 'thick_skin']),
    ['worthy_spirit', 'deadeye', 'mystic_might', 'protect_melee']);
});

test('the Blessings panel and Faith orb render without a DOM', () => {
  const g = newGame(99);
  g.toggleBlessing('superhuman');
  g.prayerPoints = g.maxPrayer();
  const html = blessingsPanelHTML(g);
  for (const p of PRAYERS) assert.ok(html.includes(`data-prayer="${p.id}"`), p.id);
  assert.match(html, /<kbd>L<\/kbd>/);
  assert.match(html, /1 \/ 3<\/b> slots/);
  assert.ok(html.includes(burstText(99)));
  const strip = slotStripHTML(g);
  assert.equal((strip.match(/bl-slot filled/g) || []).length, 1);
  assert.equal((strip.match(/bl-slot empty/g) || []).length, 2);
  assert.equal((strip.match(/bl-slot locked/g) || []).length, 2);
  assert.match(strip, /Lvl 175/);
  // Rendering into stand-in elements.
  const el = () => ({ innerHTML: '', textContent: '', title: '', style: { setProperty() {} }, classList: { on: new Set(), toggle(c, v) { if (v) this.on.add(c); else this.on.delete(c); } }, querySelector: () => null });
  const ui = { game: g, el: { prayerPanel: el(), prayerOrb: el(), prayerOrbVal: el() } };
  renderBlessingsPanel(ui);
  assert.match(ui.el.prayerPanel.innerHTML, /prayer-grid/);
  renderFaithOrb(ui);
  assert.equal(ui.el.prayerOrbVal.textContent, 100);
  assert.ok(ui.el.prayerOrb.classList.on.has('ready'));
  // The real UI wires it too (headless: no document).
  const css = readFileSync(new URL('../styles/blessings.css', import.meta.url), 'utf8');
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, 'braces balanced');
  assert.match(css, /\.bl-slot \{[^}]*min-height: 44px/);
  assert.match(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /styles\/blessings\.css/);
});
