// XP an hour in the skill guide (src/game/xprate.js): each gathering row shows
// about what an hour there pays at your level, beside the XP each catch pays.
// The figure is worked out from the rules, so these runs check it against the
// game itself: stand by a node, work it headlessly, and count the 'xp' events.
// (tests/seed.mjs switches off the extras the figure leaves out: golden hours,
// skill unlocks, streaks, schools, whole trees and seams, the level haul.)
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS, getItem } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { xpForLevel } from '../src/data/xp.js';
import { TOOL_TIERS, toolId } from '../src/data/tooltiers.js';
import { gatherSources } from '../src/game/skillguide.js';
import { xpRate, xpPerHour, TICKS_AN_HOUR } from '../src/game/xprate.js';
import { skillListHTML, itemPageHTML } from '../src/ui/skillguideui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let _game = null;
function game() {
  if (_game) return _game;
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];   // nothing to interrupt the work
  return (_game = g);
}
const noon = (g) => { g.playMs = 0.5 * 10 * 60 * 1000; };   // no night bonuses
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
// The best tool of a kind a level can use.
const best = (tag, lvl) => toolId(tag, TOOL_TIERS.reduce((b, t, i) => (t.level <= lvl ? i : b), 0));
const source = (objId) => gatherSources().find((s) => s.objIds?.[0] === objId);
const SKILL = { tree: 'woodcutting', rock: 'mining', fishing: 'fishing', hunt: 'hunter', stall: 'thieving', agility: 'agility' };
// An endless bag: everything but the tools goes after each tick.
const emptyBag = (g) => { for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s && !ITEMS[s.id]?.tool) g.inventory.removeAt(k, s.qty); } };

/** The player at `lvl` in the node's skill, carrying only `tools`, standing by a placed one. */
function setUp(g, objId, lvl, tools) {
  const o = g.world.objects.find((x) => x.objId === objId && !x.worldEvent);
  const skill = SKILL[o.def.type];
  g.skills.xp[skill] = xpForLevel(lvl);
  for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s) g.inventory.removeAt(k, s.qty); }
  for (const t of tools) g.inventory.add(t, 1);
  o.depleted = false; o.respawnTimer = 0; o.logsLeft = undefined; o.oresLeft = undefined;
  g.player.clearAction(); g.playerStun = 0;
  standBy(g, o); noon(g);
  return { o, skill };
}

/** XP an hour from `ticks` ticks of working one node, against the estimate.
 *  With `refill`, a node that runs dry is stocked again at once: only the time
 *  at the node counts, as the estimate counts it for trees, rocks and a ground's traps. */
function measure(objId, lvl, tools, ticks, { refill = false } = {}) {
  const g = game();
  const { o, skill } = setUp(g, objId, lvl, tools);
  const est = xpRate(g, source(objId));
  const base = g.skills.xp[skill];
  let xp = 0;
  const off = g.bus.on('xp', (e) => { if (e.skill === skill) xp += e.amount; });
  try {
    g.defaultObjectAction(o);
    for (let i = 0; i < ticks; i++) {
      g.update(600); noon(g); g.player.hp = 1e6;
      g.skills.xp[skill] = base;   // the level (and so the XP boost) stays put
      emptyBag(g);
      if (refill && o.depleted) { o.depleted = false; o.respawnTimer = 0; }
      if (!g.player.action && !g.playerStun) g.defaultObjectAction(o);   // caught at a stall, or a refilled node: go again
    }
  } finally { off(); g.player.clearAction(); }
  return { got: xp * TICKS_AN_HOUR / ticks, est };
}

test('the estimate matches a headless run: a spot for each fishing tool, an endgame spot, a tree, a rock, a trap', () => {
  const cases = [
    { id: 'sardine_spot', lvl: 20, tools: ['small_net'] },
    { id: 'rod_spot', lvl: 60, tools: [best('rod', 60)] },
    { id: 'swordfish_spot', lvl: 99, tools: [best('harpoon', 99)] },
    { id: 'fishing_cage', lvl: 45, tools: ['lobster_pot'] },
    // Level 819: every cast a big catch (two fish), the eternal rod's +100% speed.
    { id: 'arowana_pool', lvl: 819, tools: [best('rod', 819)] },
    { id: 'yew_tree', lvl: 70, tools: [best('axe', 70)], refill: true },
    // Nearly every swing a double that uses two ores: a visit is a few ticks,
    // so the rolls lost in the tick the rock runs dry in show.
    { id: 'eternal_lode', lvl: 819, tools: [best('pickaxe', 819)], refill: true },
    // A ground of four bird snares, worked in turn, empties faster than it
    // resets: the time at a set trap is all that counts (walking aside).
    { id: 'bird_snare', lvl: 10, tools: ['hunting_snare'], refill: true },
  ];
  for (const c of cases) {
    const { got, est } = measure(c.id, c.lvl, c.tools, c.refill ? 500 : 400, { refill: c.refill });
    assert.ok(est && est.perHour > 0, `${c.id}: an estimate`);
    // Trophy fish, gems, pearls and the like come on top, so a run comes out a
    // little above the figure, never far from it.
    const r = got / est.perHour;
    assert.ok(r > 0.9 && r < 1.1, `${c.id} at level ${c.lvl}: ran ${Math.round(got).toLocaleString()} xp/h against ${Math.round(est.perHour).toLocaleString()} estimated (${r.toFixed(3)}x)`);
  }
  assert.ok(!/waiting/.test(xpRate(game(), source('bird_snare')).why), 'the bird snares are worked without waiting for a reset');
});

test("a trap's reset: a lone trap is worked, then waited on, as auto gather does it", () => {
  // One catch to a reset makes the run exact: the trail resets in `respawn`
  // ticks, auto gather starts on it the tick after, and it springs the next.
  const g = game();
  const id = 'qilin_trail', def = OBJECTS[id], was = def.depleteChance;
  def.depleteChance = 1;
  try {
    const { o } = setUp(g, id, 200, [best('snare', 200)]);
    const est = xpRate(g, source(id));
    assert.match(est.why, /working this trap and waiting for it to reset/);
    const base = g.skills.xp.hunter, at = [];
    let xp = 0;
    const off = g.bus.on('xp', (e) => { if (e.skill === 'hunter') { xp += e.amount; at.push(g.tickCount); } });
    g.toggleAutoGather(true);
    try {
      g.defaultObjectAction(o);
      for (let i = 0; i < 300; i++) { g.update(600); noon(g); g.skills.xp.hunter = base; emptyBag(g); }
    } finally { off(); g.toggleAutoGather(false); g.player.clearAction(); }
    const gaps = new Set(at.slice(1).map((t, i) => t - at[i]));
    assert.deepEqual([...gaps], [def.respawn + 1], `a catch every ${def.respawn + 1} ticks (${[...gaps]})`);
    const got = (xp - xp / at.length) / (at[at.length - 1] - at[0]) * TICKS_AN_HOUR;   // whole cycles only
    assert.ok(Math.abs(got / est.perHour - 1) < 0.01, `${Math.round(got)} xp/h run, ${Math.round(est.perHour)} estimated`);
  } finally { def.depleteChance = was; }
});

test('a stall and a lone obstacle match a run; a course obstacle, farming and what is above you get no figure', () => {
  // The gem stall, sure-handed: it restocks after each theft, and now and then you're caught.
  const stall = measure('stall_gem', 65, [], 1000);
  assert.ok(Math.abs(stall.got / stall.est.perHour - 1) < 0.1, `gem stall: ${Math.round(stall.got)} run, ${Math.round(stall.est.perHour)} estimated`);
  // The town's lone obstacle is crossed every tick, at the XP Agility's level gives it.
  const lone = measure('agility_course', 50, [], 100);
  assert.ok(Math.abs(lone.got / lone.est.perHour - 1) < 0.01, `lone obstacle: ${Math.round(lone.got)} run, ${Math.round(lone.est.perHour)} estimated`);
  // Its row's XP each is what a crossing really pays (Agility scales its obstacles by level).
  const g = game();
  const row = skillListHTML(g, 'agility', { filter: 'all', search: 'agility course', shown: 30 }).html;
  assert.ok(row.includes(`+${Math.round(lone.got / TICKS_AN_HOUR).toLocaleString('en-US')} xp each`), `a crossing pays ${lone.got / TICKS_AN_HOUR}`);
  g.skills.xp.agility = xpForLevel(400);
  assert.equal(xpPerHour(g, source('agility_balance')), null, 'a course: its lap is mostly walking, which the guide cannot know');
  g.skills.xp.fishing = xpForLevel(10);
  assert.equal(xpPerHour(g, source('arowana_pool')), null, 'nothing for a spot above your level');
  assert.ok(!gatherSources().some((s) => s.skill === 'farming'), 'farming has no gathering rows (its crops grow on their own clock)');
});

/** The player at level 819 in Fishing with the best rod and harpoon, a net and a lobster pot. */
function topFisher() {
  const g = game();
  setUp(g, 'arowana_pool', 819, [best('rod', 819), best('harpoon', 819), 'small_net', 'lobster_pot']);
  return g;
}

test('the endgame Fishing ladder climbs an hour at level 819 with the best rod and harpoon', () => {
  // A rift eel pays more a fish than a dragon arowana, but the eternal rod
  // casts twice as often as a lobster pot: an hour, the arowana is ahead.
  const g = topFisher();
  const ladder = ['dorado_spot', 'bluefin_spot', 'sailfish_spot', 'moonfish_spot', 'rift_eel_spot', 'arowana_pool'];
  const rates = ladder.map((id) => xpPerHour(g, source(id)));
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(rates[i] > rates[i - 1], `${ladder[i]} (${Math.round(rates[i]).toLocaleString()} xp/h) beats ${ladder[i - 1]} (${Math.round(rates[i - 1]).toLocaleString()})`);
  }
});

// "≈ 12.7B xp/hr" and the like, back to a number.
const UNIT = { '': 1, K: 1e3, M: 1e6, B: 1e9 };
function hourIn(html, name) {
  const row = html.split('<div class="sg-row').find((r) => r.includes(`<b>${name}`));
  const m = row?.match(/≈ ([\d.,]+)([KMB]?) xp\/hr/);
  return m ? parseFloat(m[1].replace(/,/g, '')) * UNIT[m[2]] : null;
}

test('the Fishing guide shows XP an hour beside XP each, and says what it assumes', () => {
  const g = topFisher();
  const html = skillListHTML(g, 'fishing', { filter: 'all', search: '', shown: 999 }).html;
  assert.match(html, /xp\/hr/);
  const rows = (html.match(/class="sg-row sgx-row/g) || []).length;
  assert.equal((html.match(/class="sgx-xp sgx-xph"/g) || []).length, rows, 'every row a level-819 fisher can fish has one');
  assert.match(html, /title="With your eternal fishing rod \(\+100% speed\), at your level, while you fish: [^"]*come on top/);
  const arowana = hourIn(html, getItem('raw_dragon_arowana').name), eel = hourIn(html, getItem('raw_rift_eel').name);
  assert.ok(arowana > eel, `the dragon arowana row (${arowana}) shows more an hour than the rift eel row (${eel})`);
  // The badge is the estimate, rounded for show.
  assert.ok(Math.abs(arowana / xpPerHour(g, source('arowana_pool')) - 1) < 0.01);
  // An item's page shows it on the rows where it's gathered.
  assert.match(itemPageHTML(g, 'raw_dragon_arowana'), /≈ [\d.,]+[KMB]? xp\/hr/);
  // A new fisher: the spots above their level show no figure yet.
  g.skills.xp.fishing = xpForLevel(1);
  const low = skillListHTML(g, 'fishing', { filter: 'all', search: '', shown: 999 }).html;
  assert.equal((low.match(/class="sgx-xp sgx-xph"/g) || []).length, gatherSources().filter((s) => s.skill === 'fishing' && s.level <= 1).length);
});

test('the estimate is cheap: every gathering row at once in a few milliseconds', () => {
  const g = topFisher();
  for (const [skill, lvl] of [['woodcutting', 300], ['mining', 300], ['hunter', 300], ['thieving', 300], ['agility', 300]]) g.skills.xp[skill] = xpForLevel(lvl);
  const all = gatherSources();
  all.forEach((s) => xpRate(g, s));   // warm: the node and trap paces are worked out once a level
  const t0 = performance.now();
  for (const s of all) xpRate(g, s);
  const ms = performance.now() - t0;
  assert.ok(ms < 50, `${all.length} rows took ${ms.toFixed(1)}ms`);
});
