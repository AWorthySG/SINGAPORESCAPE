// The compact boss bar (src/ui/bossbar.js) and the XP display's bookkeeping
// (src/game/xptrack.js): short numbers, the bar's text and mechanic badge,
// threat colours, the running XP counter, rolling XP/hour, milestone levels,
// and the saved XP display setting.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { saveGame, clearSave } from '../src/game/save.js';
import { SAVE_KEY } from '../src/config.js';
import { hudNumber, chebyshev } from '../src/core/utils.js';
import { startMechanic } from '../src/game/bossmech.js';
import { lifeText, bossBarModel, foeThreat, mechBadge } from '../src/ui/bossbar.js';
import {
  XpTracker, XP_IDLE_MS, XP_RATE_WINDOW_MS, XP_RATE_MIN_SPAN_MS, XP_RUN_SKILLS,
  crossesMilestone, xpDisplayMode, nextXpDisplay, XP_DISPLAY_MODES,
} from '../src/game/xptrack.js';

const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function freshGame() {
  globalThis.localStorage = fakeStorage(); clearSave();
  const g = new Game(); g.start(); g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  return g;
}
// A boss beside the player, fighting it, frozen so only its mechanic runs.
function bossBeside(g, id) {
  const p = g.player;
  g.npcs = g.npcs.filter((n) => chebyshev(n.x, n.y, p.x, p.y) > 20);
  const t = g._nearestFree(p.x + 2, p.y);
  const boss = g.spawnNpc(id, t.x, t.y, { wander: 0 });
  boss.hp = boss.maxHp = 10000;
  boss.target = p;
  boss._combatAI = () => {};
  return boss;
}

test('hudNumber: short HUD numbers with one decimal once shortened', () => {
  assert.equal(hudNumber(0), '0');
  assert.equal(hudNumber(999), '999');
  assert.equal(hudNumber(999.7), '999');
  assert.equal(hudNumber(1000), '1.0K');
  assert.equal(hudNumber(1234), '1.2K');
  assert.equal(hudNumber(12345), '12.3K');
  assert.equal(hudNumber(3_400_000), '3.4M');
  assert.equal(hudNumber(999_900_000), '999.9M');
  assert.equal(hudNumber(999_960), '1.0M', 'rounding rolls up to the next unit');
  assert.equal(hudNumber(1e9), '1.0B');
  assert.equal(hudNumber(-1500), '-1.5K');
  assert.equal(hudNumber('nope'), '0');
});

test('lifeText: short life and a percent that never rounds to 0 or 100 while it is wrong to', () => {
  assert.equal(lifeText(999_900_000, 1_000_000_000), '999.9M · 99.9%');
  assert.equal(lifeText(500, 500), '500 · 100%');
  assert.equal(lifeText(499, 500), '499 · 99.8%');
  assert.equal(lifeText(999_999, 1_000_000), '1.0M · 99.9%', 'hurt is never "100%"');
  assert.equal(lifeText(1, 1_000_000), '1 · 0.1%', 'alive is never "0.0%"');
  assert.equal(lifeText(0, 500), '0 · 0%');
  assert.equal(lifeText(-5, 500), '0 · 0%');
});

test('boss bar model: name, level, life and a threat; no mechanic badge in a plain fight', () => {
  const g = freshGame();
  const boss = bossBeside(g, 'chilli_crab');
  boss.hp = 7500;
  const m = bossBarModel(g, boss);
  assert.equal(m.kind, 'boss');
  assert.equal(m.name, boss.name);
  assert.equal(m.level, `Lv ${boss.def.level}`);
  assert.equal(m.life, '7.5K · 75.0%');
  assert.equal(m.pct, 75);
  assert.ok(['easy', 'even', 'danger'].includes(m.threat));
  assert.equal(m.mech, null);
});

test('boss bar badge: healers, the safe circle and a cast with its timing (no boss shields any more)', () => {
  const g = freshGame();
  const crab = bossBeside(g, 'chilli_crab');   // once a style shield, now a safe circle
  startMechanic(g, crab);
  const sc = mechBadge(g, crab);
  assert.equal(sc.kind, 'circle');
  assert.ok(sc.title.includes('green circle'), 'the full prompt stays as its tooltip');

  const g2 = freshGame();
  const chief = bossBeside(g2, 'goblin_warchief');
  startMechanic(g2, chief);
  const ad = mechBadge(g2, chief);
  assert.equal(ad.kind, 'adds');
  assert.match(ad.text, /^Healers ×\d+$/);

  const g3 = freshGame();
  const boar = bossBeside(g3, 'boar_king');
  startMechanic(g3, boar);
  assert.equal(mechBadge(g3, boar).kind, 'circle');

  const g4 = freshGame();
  const snake = bossBeside(g4, 'reservoir_serpent');
  startMechanic(g4, snake);
  const c = mechBadge(g4, snake);
  assert.equal(c.kind, 'cast');
  assert.ok(c.cast.dur > 0, 'the cast bar knows how long the cast takes');
  assert.match(c.text, /^Interrupt! \d+s$/);
  assert.equal(bossBarModel(g4, snake).mech.kind, 'cast');
});

test('threat: green well below you, gold near you, red for a boss you could not beat', () => {
  const g = freshGame();
  const cl = g.fightLevel();
  const foe = (level, extra = {}) => ({ def: { level, ...extra }, hp: 100, maxHp: 100, npcId: 'x' });
  assert.equal(foeThreat(g, foe(1)), cl > 6 ? 'easy' : 'even');
  assert.equal(foeThreat(g, foe(cl)), 'even');
  assert.equal(foeThreat(g, foe(cl + 200)), 'danger');
  const boss = bossBeside(g, 'chilli_crab');
  boss.def = { ...boss.def, level: cl + 500 };
  assert.equal(foeThreat(g, boss), 'danger', 'auto battle would not take it on');
});

test('XP counter: gains add up into one run; a pause of XP_IDLE_MS starts a new one', () => {
  const t = new XpTracker();
  t.add('mining', 40, 0);
  t.add('mining', 60, 1000);
  t.add('smithing', 25, 2500);
  assert.equal(t.total(2600), 125);
  assert.deepEqual(t.run.skills, ['mining', 'smithing']);
  assert.equal(t.last, 'smithing');
  t.add('mining', 10, 2700);
  assert.deepEqual(t.run.skills, ['smithing', 'mining'], 'the latest skill moves to the end');
  assert.ok(t.active(2700 + XP_IDLE_MS - 1));
  assert.ok(!t.active(2700 + XP_IDLE_MS), 'goes idle');
  assert.equal(t.total(2700 + XP_IDLE_MS), 0);
  t.add('woodcutting', 5, 2700 + XP_IDLE_MS + 10);
  assert.equal(t.run.total, 5, 'a fresh run');
  assert.deepEqual(t.run.skills, ['woodcutting']);
  t.add('mining', 0, 9000);
  t.add('mining', -3, 9000);
  assert.equal(t.run.total, 5, 'nothing for no gain');
  const many = new XpTracker();
  for (let i = 0; i < 9; i++) many.add(`s${i}`, 1, i);
  assert.equal(many.run.skills.length, XP_RUN_SKILLS, 'only the latest few icons');
});

test('XP/hour: a rolling rate over the window, at least a minute long', () => {
  const t = new XpTracker();
  assert.equal(t.ratePerHour('mining', 0), 0);
  t.add('mining', 100, 0);
  assert.equal(t.ratePerHour('mining', 1000), 6000, 'a first gain counts over a minute, not one second');
  // 100 XP every 6 seconds for 5 minutes: 60,000 XP/h.
  const r = new XpTracker();
  for (let ms = 0; ms <= 300000; ms += 6000) r.add('fishing', 100, ms);
  const rate = r.ratePerHour('fishing', 300000);
  assert.ok(Math.abs(rate - 61200) < 2000, `about 60K/h (${rate})`);
  assert.ok(r.buckets.get('fishing').length <= Math.ceil(300000 / 15000) + 1, 'kept in coarse buckets');
  // Stop training: the rate decays and, past the window, is gone.
  assert.ok(r.ratePerHour('fishing', 600000) < rate);
  assert.equal(r.ratePerHour('fishing', 300000 + XP_RATE_WINDOW_MS + 1), 0);
  assert.ok(XP_RATE_MIN_SPAN_MS >= 60000);
});

test('milestone levels: every tenth and 99 get the big celebration; the rest a toast', () => {
  assert.equal(crossesMilestone(8, 9), false);
  assert.equal(crossesMilestone(9, 10), true);
  assert.equal(crossesMilestone(41, 43), false);
  assert.equal(crossesMilestone(98, 99), true);
  assert.equal(crossesMilestone(99, 100), true);
  assert.equal(crossesMilestone(101, 105), false);
  assert.equal(crossesMilestone(101, 125), true, 'a big jump always holds one');
});

test('XP display setting: Combined by default, cycles, and is saved (older saves: Combined)', () => {
  const g = freshGame();
  assert.equal(xpDisplayMode(g), 'combined');
  assert.deepEqual(XP_DISPLAY_MODES, ['combined', 'skill', 'off']);
  assert.equal(nextXpDisplay('combined'), 'skill');
  assert.equal(nextXpDisplay('skill'), 'off');
  assert.equal(nextXpDisplay('off'), 'combined');
  g.xpDisplay = 'skill';
  saveGame(g);
  const again = new Game(); again.start();
  assert.equal(again.xpDisplay, 'skill');
  const data = JSON.parse(localStorage.getItem(SAVE_KEY));
  delete data.settings.xpDisplay;
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const old = new Game(); old.start();
  assert.equal(xpDisplayMode(old), 'combined');
  data.settings.xpDisplay = 'sideways';
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  const odd = new Game(); odd.start();
  assert.equal(odd.xpDisplay, 'combined', 'an unknown value falls back');
});

test('the boss bar markup and styles: inset portrait, life read-out, cast bar, threat frames', () => {
  for (const id of ['boss-bar-head', 'boss-bar-mech', 'boss-bar-life', 'boss-bar-cast', 'boss-bar-info']) {
    assert.ok(html.includes(`id="${id}"`), `index.html has #${id}`);
  }
  for (const t of ['easy', 'even', 'danger']) assert.ok(css.includes(`#boss-bar.threat-${t}`), `a ${t} frame`);
  assert.ok(css.includes('@keyframes bbCast'));
  assert.ok(css.includes('#xp-hud.idle'), 'the XP counter fades');
});
