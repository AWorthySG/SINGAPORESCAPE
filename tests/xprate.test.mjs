// XP an hour in the skill guide (src/game/xprate.js): each gathering row shows
// about what an hour there pays at your level, beside the XP each catch pays.
// The figure is worked out from the rules, so these runs check it against the
// game itself: work a node headlessly (trees, rocks and traps with auto gather,
// walking and waiting as it does) and count the 'xp' events.
// (tests/seed.mjs switches off the extras unless a test turns them on: golden
// hours, skill unlocks, streaks, schools, whole trees and seams, the level haul.)
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { ITEMS, getItem } from '../src/data/items.js';
import { OBJECTS } from '../src/data/objects.js';
import { xpForLevel } from '../src/data/xp.js';
import { TOOL_TIERS, toolId } from '../src/data/tooltiers.js';
import { UNLOCKS } from '../src/data/unlocks.js';
import { shortNumber } from '../src/core/utils.js';
import { gatherSources } from '../src/game/skillguide.js';
import { trainingFor } from '../src/game/foryou.js';
import { NODE_JACKPOT, setJackpotRand } from '../src/game/jackpot.js';
import { FISH_SCHOOL } from '../src/game/fishschool.js';
import { LEVEL_HAUL, setHaulRand } from '../src/game/levelhaul.js';
import { GATHER_FUN } from '../src/game/gathering.js';
import { mulberry32 } from '../src/game/pets.js';
import { FOCUS_MAX_MS } from '../src/game/playbalance.js';
import { xpRate, TICKS_AN_HOUR, xpRatePaces } from '../src/game/xprate.js';
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
const perHour = (g, s) => xpRate(g, s)?.perHour ?? null;
const noon = (g) => { g.playMs = 0.5 * 10 * 60 * 1000; };   // no night bonuses
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
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
// The placed node of a kind with the most of its kind within 15 tiles: where
// the estimate's ground lies (world events' nodes left out).
function densest(g, objId) {
  const all = g.world.objects.filter((o) => o.objId === objId && !o.worldEvent);
  let at = all[0], most = 0;
  for (const o of all) { const n = all.filter((p) => cheb(p, o) <= 15).length; if (n > most) { most = n; at = o; } }
  return at;
}

/** The player at `lvl` in the node's skill, carrying only `tools`, standing by its densest one. */
function setUp(g, objId, lvl, tools) {
  const o = densest(g, objId);
  const skill = SKILL[o.def.type];
  g.skills.xp[skill] = xpForLevel(lvl);
  for (let k = 0; k < g.inventory.size; k++) { const s = g.inventory.slotAt(k); if (s) g.inventory.removeAt(k, s.qty); }
  for (const t of tools) g.inventory.add(t, 1);
  for (const n of g.world.objects) if (n.objId === objId) { n.depleted = false; n.respawnTimer = 0; n.logsLeft = undefined; n.oresLeft = undefined; }
  g.player.clearAction(); g.player.stopNow?.(); g.playerStun = 0;
  // A full Focus bar and no rested pool: hours of auto gather across the runs
  // would otherwise tire you (70% XP), which the estimate leaves out.
  g.play.focus = FOCUS_MAX_MS; g.play.rested = 0;
  standBy(g, o); noon(g);
  return { o, skill };
}

/** XP an hour from `ticks` ticks of working one kind of node, against the
 *  estimate. With `auto`, auto gather works it with only that kind ticked (as
 *  the guide's tick boxes do), walking on and waiting for regrowth by itself;
 *  else you stand at the one node (a fishing spot, a stall, a lone obstacle)
 *  and start again whenever you stop. Auto gather walks in frames of 100ms, as
 *  a browser draws them (a walk set off in a tick starts on the next frame:
 *  one 600ms frame a tick would make every walk a tick longer). */
function measure(objId, lvl, tools, ticks, { auto = false } = {}) {
  const g = game();
  const { o, skill } = setUp(g, objId, lvl, tools);
  const est = xpRate(g, source(objId));
  const base = g.skills.xp[skill];
  let xp = 0;
  const off = g.bus.on('xp', (e) => { if (e.skill === skill) xp += e.amount; });
  try {
    if (auto) { g.toggleAutoGather(true); g.toggleGatherPick([objId]); }
    g.defaultObjectAction(o);
    const frames = auto ? 6 : 1;
    for (let i = 0; i < ticks; i++) {
      for (let f = 0; f < frames; f++) g.update(600 / frames);
      noon(g); g.player.hp = 1e6;
      g.skills.xp[skill] = base;   // the level (and so the XP boost) stays put
      emptyBag(g);
      if (!auto && !g.player.action && !g.playerStun) g.defaultObjectAction(o);   // caught at a stall: go again
    }
  } finally {
    off(); g.player.clearAction();
    if (auto) { g.clearGatherPicks(); g.toggleAutoGather(false); }
  }
  return { got: xp * TICKS_AN_HOUR / ticks, est };
}
const near = (r, lo, hi, what) => assert.ok(r > lo && r < hi, what);

test('the estimate matches a headless run: a spot for each fishing tool, an endgame spot, trees, rocks and traps worked by auto gather', () => {
  const cases = [
    { id: 'sardine_spot', lvl: 20, tools: ['small_net'] },
    { id: 'rod_spot', lvl: 60, tools: [best('rod', 60)] },
    { id: 'swordfish_spot', lvl: 99, tools: [best('harpoon', 99)] },
    { id: 'fishing_cage', lvl: 45, tools: ['lobster_pot'] },
    // Level 819: every cast a big catch (two fish), the eternal rod's +100% speed.
    { id: 'arowana_pool', lvl: 819, tools: [best('rod', 819)] },
    { id: 'yew_tree', lvl: 70, tools: [best('axe', 70)], auto: true },
    // A magic tree takes 90 ticks to regrow: a fast chopper walks the grove
    // from one ready tree to the next (about a tenth of the hour at level 819).
    { id: 'magic_tree', lvl: 819, tools: [best('axe', 819)], auto: true },
    // Nearly every swing a double that uses two ores: a visit is a few ticks,
    // so the rolls lost in the tick the rock runs dry in show.
    { id: 'eternal_lode', lvl: 819, tools: [best('pickaxe', 819)], auto: true },
    // Four gem rocks in two pairs a dozen tiles apart: a third of the hour is walking.
    { id: 'gem_rock', lvl: 300, tools: [best('pickaxe', 300)], auto: true },
    // A ground of four bird snares, worked in turn, walked between and waited on.
    { id: 'bird_snare', lvl: 10, tools: ['hunting_snare'], auto: true },
  ];
  for (const c of cases) {
    const { got, est } = measure(c.id, c.lvl, c.tools, c.auto ? 1500 : 400, { auto: c.auto });
    assert.ok(est && est.perHour > 0, `${c.id}: an estimate`);
    // Standing at a spot, only the odd pearl or purse comes on top: a run is
    // within a few percent. Walking between nodes is followed on average (the
    // ground's real paths bend round things), so those get a little more room.
    const room = c.auto ? 0.1 : 0.05;
    near(got / est.perHour, 1 - room, 1 + room, `${c.id} at level ${c.lvl}: ran ${Math.round(got).toLocaleString()} xp/h against ${Math.round(est.perHour).toLocaleString()} estimated (${(got / est.perHour).toFixed(3)}x)`);
  }
  const gems = xpRate(game(), source('gem_rock'));
  assert.ok(gems.pace.walk > 1, `walking between the gem rocks is counted (${gems.pace.walk.toFixed(2)} ticks a rock)`);
  assert.match(gems.why, /the walk between the 4 that lie closest together/);
});

test('with every extra and the skill unlocks on, as in the real game, the estimate still matches a run', () => {
  // Whole trees, seams, schools and flocks, passing schools, the level haul,
  // streaks and lucky finds come on top of the catches themselves: together they make
  // most of an hour (four to seven times the catches alone). Each rolls its
  // own dice: pinned, so every run is the same. The unlocks add quick swings
  // and nodes that hold for another go.
  const g = game();
  NODE_JACKPOT.on = FISH_SCHOOL.on = LEVEL_HAUL.on = GATHER_FUN.on = UNLOCKS.on = true;
  setJackpotRand(mulberry32(11)); setHaulRand(mulberry32(12));
  g.gathering.rand = mulberry32(13); g.fishSchools.rand = mulberry32(14);
  try {
    const cases = [
      { id: 'arowana_pool', lvl: 819, tools: [best('rod', 819)] },
      { id: 'keramat_tree', lvl: 819, tools: [best('axe', 819)] },
      { id: 'runite_rock', lvl: 99, tools: [best('pickaxe', 99)] },
      { id: 'lizard_snare', lvl: 99, tools: [best('snare', 99)] },
    ];
    for (const c of cases) {
      const { got, est } = measure(c.id, c.lvl, c.tools, 2400, { auto: true });
      const whole = { arowana_pool: 'schools', lizard_snare: 'flocks' }[c.id] || 'trees and seams';
      assert.ok(est.parts.whole > 0.5, `${c.id}: whole ${whole} are most of the hour (${est.parts.whole.toFixed(2)})`);
      // A trap's whole flock (10-140 catches, about 1 in 20) is counted and said.
      if (c.id === 'lizard_snare') assert.match(est.why, /Counted: whole flocks at once \(about \d+% of it\)/);
      near(got / est.perHour, 0.85, 1.15, `${c.id} at level ${c.lvl}, everything on: ran ${Math.round(got).toLocaleString()} xp/h against ${Math.round(est.perHour).toLocaleString()} estimated (${(got / est.perHour).toFixed(3)}x)`);
      if (c.id === 'arowana_pool') {
        // Passing schools come to the arowana pools (nothing else is near
        // them), and a whole school at any spot nets 10-140 fish: both count.
        assert.ok(est.parts.schools > 0.03, `passing schools are counted (${est.parts.schools.toFixed(3)} of the hour)`);
        assert.match(est.why, /Counted: whole schools at once \(about \d+% of it\), passing schools/);
      }
    }
  } finally {
    NODE_JACKPOT.on = FISH_SCHOOL.on = LEVEL_HAUL.on = GATHER_FUN.on = UNLOCKS.on = false;
  }
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
    assert.match(est.why, /waiting for it to reset/);
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
  assert.equal(perHour(g, source('agility_balance')), null, 'a course: its lap is mostly walking, which the guide cannot know');
  g.skills.xp.fishing = xpForLevel(10);
  assert.equal(perHour(g, source('arowana_pool')), null, 'nothing for a spot above your level');
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
  const rates = ladder.map((id) => perHour(g, source(id)));
  for (let i = 1; i < ladder.length; i++) {
    assert.ok(rates[i] > rates[i - 1], `${ladder[i]} (${Math.round(rates[i]).toLocaleString()} xp/h) beats ${ladder[i - 1]} (${Math.round(rates[i - 1]).toLocaleString()})`);
  }
  // For you picks its Fishing spot by the same hour, so it points to the arowana too.
  const [pick] = trainingFor(g, 'fishing', 1);
  assert.equal(pick.objIds[0], 'arowana_pool');
  assert.equal(pick.xph, Math.round(perHour(g, source('arowana_pool'))));
  assert.equal(pick.rough, false);
});

// "≈ 12.7B xp/hr" and the like, back to a number.
const UNIT = { '': 1, K: 1e3, M: 1e6, B: 1e9 };
function hourIn(html, name) {
  const row = html.split('<div class="sg-row').find((r) => r.includes(`<b>${name}`));
  const m = row?.match(/≈ ([\d.,]+)([KMB]?) xp\/hr/);
  return m ? parseFloat(m[1].replace(/,/g, '')) * UNIT[m[2]] : null;
}

test('the Fishing guide shows XP an hour beside XP each, and says what it counts where a phone can read it', () => {
  const g = topFisher();
  const html = skillListHTML(g, 'fishing', { filter: 'all', search: '', shown: 999 }).html;
  assert.match(html, /xp\/hr/);
  const rows = (html.match(/class="sg-row sgx-row/g) || []).length;
  assert.equal((html.match(/class="sgx-xp sgx-xph"/g) || []).length, rows, 'every row a level-819 fisher can fish has one');
  assert.match(html, /title="With your eternal fishing rod \(\+100% speed\), at your level: about [\d,]+ casts an hour, every one a big catch[^"]*come on top/);
  // What it counts is said once above the rows, not only on hover (phones have none).
  assert.match(html, /class="modal-hint sgx-xph-note"><b>≈ xp\/hr<\/b>: about what an hour there pays you now, with auto gather and the best tool you carry\. It counts [^<]*whole schools/);
  const arowana = hourIn(html, getItem('raw_dragon_arowana').name), eel = hourIn(html, getItem('raw_rift_eel').name);
  assert.ok(arowana > eel, `the dragon arowana row (${arowana}) shows more an hour than the rift eel row (${eel})`);
  // The badge is the estimate, shortened for show.
  assert.ok(html.includes(`≈ ${shortNumber(perHour(g, source('arowana_pool')))} xp/hr`));
  // An item's page shows it on the rows where it's gathered.
  assert.match(itemPageHTML(g, 'raw_dragon_arowana'), /≈ [\d.,]+[KMB]? xp\/hr/);
  // A new fisher: the spots above their level show no figure yet.
  g.skills.xp.fishing = xpForLevel(1);
  const low = skillListHTML(g, 'fishing', { filter: 'all', search: '', shown: 999 }).html;
  assert.equal((low.match(/class="sgx-xp sgx-xph"/g) || []).length, gatherSources().filter((s) => s.skill === 'fishing' && s.level <= 1).length);
  // Nothing to explain where no row has one.
  assert.doesNotMatch(skillListHTML(g, 'fishing', { filter: 'next', search: '', shown: 30 }).html, /sgx-xph-note/);
});

test('the estimate is cheap: the paces are worked out once, then every row reads them', () => {
  const g = topFisher();
  for (const [skill, lvl] of [['woodcutting', 300], ['mining', 300], ['hunter', 300], ['thieving', 300], ['agility', 300]]) g.skills.xp[skill] = xpForLevel(lvl);
  const all = gatherSources();
  all.forEach((s) => xpRate(g, s));   // warm: the node and trap paces and the grounds are worked out once a level
  const paces = xpRatePaces();
  const t0 = performance.now();
  for (const s of all) xpRate(g, s);
  const ms = performance.now() - t0;
  // A second pass works nothing out again (a clock alone can't tell, on a busy machine)...
  assert.equal(xpRatePaces(), paces, 'no new paces on the second pass');
  // ...and stays far from slow even then.
  assert.ok(ms < 2000, `${all.length} rows took ${ms.toFixed(1)}ms`);
});
