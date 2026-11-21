// Golden hours: each life skill earns +50% XP at its own time of day.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_HOURS, goldenMult, goldenSkills, inWindow, GOLDEN_HOUR_XP, GOLDEN_HOURS_LEN, windowLabel, GOLDEN } from '../src/data/skillhours.js';
import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { DAY_CYCLE_MS } from '../src/config.js';

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('every life skill has a twelve-hour window (doubled from six), and windows wrap past midnight', () => {
  GOLDEN.on = true;
  for (const s of ['fishing', 'woodcutting', 'mining', 'smithing', 'cooking', 'crafting', 'fletching', 'herblore', 'firemaking', 'hunter', 'farming', 'thieving', 'agility']) {
    const w = SKILL_HOURS[s];
    assert.ok(w, `${s} has golden hours`);
    assert.equal(GOLDEN_HOURS_LEN, 12);
    assert.equal(((w.to - w.from) + 24) % 24 || 24, GOLDEN_HOURS_LEN, `${s} lasts twelve hours`);
    assert.ok(windowLabel(s).includes('–'));
  }
  assert.ok(inWindow(23, SKILL_HOURS.mining) && inWindow(1, SKILL_HOURS.mining) && !inWindow(12, SKILL_HOURS.mining), 'mining 10 PM – 10 AM');
  assert.equal(goldenMult('fishing', 6), GOLDEN_HOUR_XP);
  assert.equal(goldenMult('fishing', 14), GOLDEN_HOUR_XP, 'fishing runs 4 AM – 4 PM now');
  assert.equal(goldenMult('fishing', 18), 1);
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
  const off = gain(18), on = gain(6);
  assert.ok(Math.abs(on / off - GOLDEN_HOUR_XP) < 1e-6, `fishing at dawn earns ${GOLDEN_HOUR_XP}x (${on} vs ${off})`);
  // The tick notices a window opening.
  at(3.9); g._checkGoldenHours(); at(4.1); g._checkGoldenHours();
  assert.ok(msgs.some((t) => /Golden hours: .*Fishing/.test(t)), 'dawn announces fishing');
});

test('golden hours only redraw the Skills tab when the set of skills changes, not every tick', () => {
  GOLDEN.on = true;
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  const at = (hour) => { g.playMs = Math.round((hour / 24) * DAY_CYCLE_MS); };
  let n = 0; g.bus.on('skills', () => n++);
  // Mid-morning: several windows are open and stay open. Redrawing every tick
  // here replaced the panel's buttons under phone taps.
  at(9); g._checkGoldenHours();
  n = 0;
  for (let h = 9.01; h < 9.5; h += 0.01) { at(h); g._checkGoldenHours(); }
  assert.equal(n, 0, 'no redraws while nothing opens or closes');
  // A window opening (woodcutting at 8) or closing (mining at 10) still redraws.
  at(10.05); g._checkGoldenHours();
  assert.ok(n >= 1, 'a window closing redraws');
});

test('golden hours opening a few ticks apart each get a short chat line but share one banner', () => {
  GOLDEN.on = true;
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseClass('swordsman');
  g.ui = new Proxy({}, { get: () => () => {} });
  const msgs = [], banners = [];
  const m0 = g.msg.bind(g); g.msg = (t, c) => { msgs.push(t); return m0(t, c); };
  g.banner = (h) => banners.push(h);
  // Two skills whose windows open at different hours, both open at the later one.
  const starts = [...new Set(Object.values(SKILL_HOURS).map((w) => w.from))].sort((a, b) => a - b);
  const [h1, h2] = [starts[0], starts.find((h) => h > starts[0] && h - starts[0] < 6)];
  assert.ok(h2 !== undefined, 'two openings close together');
  const at = (hour) => { g.playMs = Math.round((hour / 24) * DAY_CYCLE_MS); };
  g.tickCount = 1000; at(h1 - 0.05); g._checkGoldenHours(); at(h1 + 0.05); g._checkGoldenHours();
  g.tickCount = 1010; at(h2 - 0.05); g._checkGoldenHours(); at(h2 + 0.05); g._checkGoldenHours();
  const lines = msgs.filter((t) => t.startsWith('Golden hours:'));
  assert.equal(lines.length, 2, 'a line for each opening');
  assert.ok(lines.every((t) => /\+50% XP for half a day \(/.test(t) && !/twelve hours/.test(t)), 'the short wording');
  assert.equal(banners.length, 1, 'one banner for the burst');
});
