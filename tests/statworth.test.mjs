// What one point of an offensive stat is worth to you (src/game/statworth.js):
// its numbers must match the damage the real combat code would deal, so the
// tooltips and the Stats tab's "What 1 point is worth" box can't mislead.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { armourMult, MEGA_CRIT_CHANCE } from '../src/game/combat.js';
import { critNow, damageMult, statSheet } from '../src/game/statsheet.js';
import { statWorth, worthTable, gainOf, worthState, gearWorthNotes, gearSwapWorth, AVG_CRIT_MULT } from '../src/game/statworth.js';
import { statsPanelHTML } from '../src/ui/statspanel.js';
import { UI } from '../src/ui/ui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame(classId = 'swordsman') {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseClass(classId);
  return g;
}

/** Add gear-style bonuses on top of everything (through the same hook life perks use). */
function withExtra(g, add) {
  const base = g.equipment.extra;
  g.equipment.extra = () => {
    const ex = { ...(base?.() || {}) };
    for (const [k, v] of Object.entries(add)) ex[k] = (ex[k] || 0) + v;
    return ex;
  };
  g._worthCache = null;
  return () => { g.equipment.extra = base; g._worthCache = null; };
}

/** Brute force: damage per second against a boss wearing `armour`, from the
 *  real pieces: the damage multiplier the Stats tab checks against real
 *  attacks, the real armourMult, the real _critHit (each of its outcomes
 *  forced in turn) and the real attack interval. */
function bruteDps(g, armour) {
  const mode = g.combatMode(), b = g.equipment.bonuses('main');
  const c = Math.min(1, critNow(g, mode).total);
  const D = 1e7, rnd = Math.random;
  const outcome = (rolls) => { let i = 0; Math.random = () => rolls[i++]; try { return g._critHit(D, c).dmg; } finally { Math.random = rnd; } };
  const plain = D, x2 = outcome([0, 0.9999999]), x4 = outcome([0, 0]);
  const hit = (1 - c) * plain + c * ((1 - MEGA_CRIT_CHANCE) * x2 + MEGA_CRIT_CHANCE * x4);
  return hit / D * damageMult(g, mode, { boss: true }).m * armourMult(armour, b.pierce + g.buffMod('pierce')) / g.attackInterval();
}

const BUILDS = [
  {},
  { critDmg: 40, atkPct: 25, haste: 30, crit: 20, pierce: 10, bossDmg: 15 },
  { crit: 60, critDmg: 120, pierce: 55, haste: 150 },
];

test('the worth of each stat matches brute-force damage from the real formulas', () => {
  for (const [cls, keys] of [['swordsman', ['atkPct', 'critDmg', 'crit', 'haste', 'pierce', 'bossDmg']], ['wizard', ['magPct', 'critDmg', 'crit', 'haste', 'pierce']]]) {
    const g = newGame(cls);
    assert.equal(g.combatMode(), cls === 'wizard' ? 'magic' : 'melee');
    for (const build of BUILDS) {
      const undo = withExtra(g, build);
      for (const armour of [0, 0.3, 0.5]) {
        const before = bruteDps(g, armour);
        for (const k of keys) {
          const undo2 = withExtra(g, { [k]: 1 });
          const brute = (bruteDps(g, armour) / before - 1) * 100;
          undo2();
          const mine = statWorth(g, k, { armour });
          assert.ok(Math.abs(mine - brute) < 1e-3 + Math.abs(brute) * 1e-3, `${cls} ${JSON.stringify(build)} armour ${armour} ${k}: ${mine} vs ${brute}`);
        }
      }
      // The style's other damage bonus does nothing for you.
      assert.equal(statWorth(g, cls === 'wizard' ? 'atkPct' : 'magPct'), 0);
      undo();
    }
  }
});

test('with 20% crit and no bonuses, Physical damage is about 6.5x crit damage', () => {
  const s = { dmgPct: 0, critBase: 0.2, crit: 0, critDmg: 0, haste: 0, pierce: 0, armour: 0, bossBase: 1, bossDmg: 0 };
  const phys = gainOf(s, 'dmgPct'), cd = gainOf(s, 'critDmg');
  assert.ok(Math.abs(phys - 0.01) < 1e-12, 'Physical: +1%');
  assert.ok(Math.abs(phys / cd - 6.5) < 1e-9, `ratio ${phys / cd}`);
  assert.equal(AVG_CRIT_MULT, 2.5);
  // And in a real game, the box says crit damage only counts on crits.
  const g = newGame();
  const w = worthTable(g);
  assert.match(w.why, /Crit damage only counts on crits \(you crit \d+% of the time\)/);
});

test('pierce is worth more than 1% until it reaches the armour, then less', () => {
  const s = { dmgPct: 0, critBase: 0, crit: 0, critDmg: 0, haste: 0, armour: 0.3, bossBase: 1, bossDmg: 0 };
  const at = (p) => gainOf({ ...s, pierce: p }, 'pierce') * 100;
  assert.ok(at(29) > 1 && at(20) > at(29) && at(0) > at(20), 'over 1% while armour is left to cancel (most of all with none yet)');
  assert.ok(at(31) < 1 && at(60) < at(31), 'past the armour each point adds less than 1%');
  // Versus Physical damage at the same point.
  const phys = gainOf({ ...s, pierce: 0 }, 'dmgPct') * 100;
  assert.ok(at(0) > phys && at(40) < phys);
});

test('item tooltips note what each offensive stat is worth to you, and the swap overall', () => {
  const g = newGame('swordsman');
  const ui = { game: g, _gearStats: UI.prototype._gearStats };
  const html = UI.prototype._gearTip.call(ui, 'bronze_dagger');
  assert.match(html, /Crit damage %\s*<span class="gt-worth">\(≈ \+[\d.]+% dmg\)<\/span>/, html);
  assert.match(html, /Attack speed %\s*<span class="gt-worth">\(≈ \+[\d.]+% dmg\)/);
  assert.ok(!/NaN|undefined/.test(html));
  const notes = gearWorthNotes(g, 'bronze_dagger');
  assert.ok(notes.critDmg && notes.haste && !notes.attack, 'only offensive stats get a note');
  // Overall vs the worn weapon: the expected-damage ratio with and without the swap.
  const sw = gearSwapWorth(g, 'bronze_dagger', 'weapon');
  if (sw != null && Math.abs(sw) >= 0.05) assert.match(html, /Overall: ≈ [+−][\d.]+% damage vs equipped/);
  // Something worn is judged by what it adds now (taken away and compared).
  const worn = g.equipment.get('weapon');
  const wn = gearWorthNotes(g, worn);
  for (const v of Object.values(wn)) assert.ok(/≈|not for your style/.test(v));
});

test('the Stats tab shows "What 1 point is worth" and picks out the best stat', () => {
  const g = newGame('swordsman');
  const undo = withExtra(g, { crit: 70, critDmg: 10 });   // a crit-heavy build: crit damage beats Physical damage
  const w = worthTable(g);
  const best = w.rows.reduce((a, r) => (r.worth > a.worth ? r : a));
  assert.equal(w.best, best.key);
  assert.deepEqual(w.rows.map((r) => r.label), ['Physical damage', 'Crit damage', 'Crit chance', 'Attack speed', 'Armour pierce']);
  const html = statsPanelHTML(statSheet(g), new Set(), w);
  assert.ok(html.includes('What 1 point is worth'));
  assert.match(html, new RegExp(`class="st-row st-w best" data-worth="${w.best}"`));
  assert.equal((html.match(/st-w best/g) || []).length, 1, 'one best');
  assert.ok(html.includes('st-best'));
  assert.ok(!/NaN|undefined/.test(html));
  assert.ok(html.indexOf('data-sec="worth"') > html.indexOf('data-sec="offence"'), 'under the Offence card');
  undo();
  // The UI's own render passes it in.
  const el = { innerHTML: '', closest: () => ({ classList: { contains: () => false } }), querySelectorAll: () => [] };
  UI.prototype.renderStatsPanel.call({ game: g, el: { statsPanel: el } });
  assert.ok(el.innerHTML.includes('What 1 point is worth'));
  // Cached per gear change and tick: asking twice in a tick reuses the state.
  assert.equal(worthState(g), worthState(g));
});
