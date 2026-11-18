// Golden hours: each life skill earns +50% XP at its own time of day.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_HOURS, goldenMult, goldenSkills, inWindow, GOLDEN_HOUR_XP, windowLabel, GOLDEN } from '../src/data/skillhours.js';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { DAY_CYCLE_MS } from '../src/config.js';

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('every life skill has a six-hour window, and windows wrap past midnight', () => {
  GOLDEN.on = true;
  for (const s of ['fishing', 'woodcutting', 'mining', 'smithing', 'cooking', 'crafting', 'fletching', 'herblore', 'firemaking', 'hunter', 'farming', 'thieving', 'agility']) {
    const w = SKILL_HOURS[s];
    assert.ok(w, `${s} has golden hours`);
    assert.equal(((w.to - w.from) + 24) % 24 || 24, 6, `${s} lasts six hours`);
    assert.ok(windowLabel(s).includes('–'));
  }
  assert.ok(inWindow(23, SKILL_HOURS.mining) && inWindow(1, SKILL_HOURS.mining) && !inWindow(12, SKILL_HOURS.mining), 'mining 10 PM – 4 AM');
  assert.equal(goldenMult('fishing', 6), GOLDEN_HOUR_XP);
  assert.equal(goldenMult('fishing', 14), 1);
  assert.equal(goldenMult('attack', 6), 1, 'combat skills have the night hunt instead');
  assert.ok(goldenSkills(6).includes('fishing'));
});

test('life skill XP is worth +50% in its golden hours, and the change is announced', () => {
  GOLDEN.on = true;
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  const msgs = []; g.ui = new Proxy({}, { get: () => () => {} });
  const m0 = g.msg.bind(g); g.msg = (t, c) => { msgs.push(t); return m0(t, c); };
  const at = (hour) => { g.playMs = Math.round((hour / 24) * DAY_CYCLE_MS); };
  const gain = (hour) => { at(hour); const b = g.skills.xp.fishing; g.skills.addXp('fishing', 100); return g.skills.xp.fishing - b; };
  const off = gain(14), on = gain(6);
  assert.ok(Math.abs(on / off - GOLDEN_HOUR_XP) < 1e-6, `fishing at dawn earns ${GOLDEN_HOUR_XP}x (${on} vs ${off})`);
  // The tick notices a window opening.
  at(3.9); g._checkGoldenHours(); at(4.1); g._checkGoldenHours();
  assert.ok(msgs.some((t) => /Golden hours: .*Fishing/.test(t)), 'dawn announces fishing');
});
