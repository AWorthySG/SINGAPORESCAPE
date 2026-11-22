// Less work for the HUD in a busy late-game fight, the same on screen: bursts
// of events redraw the objectives, the quick bar, the chat peek and the Faith
// orb once per task; the tracker's pointers look only among the NPCs they could
// point at; the notice lane is measured after the browser's own layout; hidden
// panels catch up when shown (at once, even mid-tap); the region labels and the
// boss portrait's hit flash stop forcing work; and the "What next?" helpers give
// the very answers they gave before, sooner. All headless.
import './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Game } from '../src/game/game.js';
import { NPC } from '../src/game/npc.js';
import { UI } from '../src/ui/ui.js';
import { NoticeLane } from '../src/ui/noticelane.js';
import { QuickBar } from '../src/ui/quickbar.js';
import { CompactHud } from '../src/ui/compacthud.js';
import { watchGoals } from '../src/ui/whatnextui.js';
import { packUpgrades, packUpgrade, firstPackUpgrade, fightTarget } from '../src/game/whatnext.js';
import { ITEMS } from '../src/data/items.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function freshGame() {
  globalThis.localStorage = fakeStorage();
  const g = new Game();
  g.ui = new Proxy({}, { get: () => () => {} });
  g.start(); g.chooseStartingStyle('melee');
  return g;
}
const microtasks = () => new Promise((r) => setTimeout(r, 0));

// ---------------- Objectives tracker ----------------
test('a burst of tracker events redraws it once, at the end of the task; a tick redraw covers what came first', async () => {
  const g = freshGame();
  let drawn = 0;
  const ui = { game: g, el: { tracker: {} } };
  ui._coalesce = UI.prototype._coalesce;
  ui._trackerSoon = UI.prototype._trackerSoon;
  ui.renderTracker = () => { drawn++; ui._trkDirty = false; };
  ui._trackerSoon(); ui._trackerSoon(); ui._trackerSoon();
  assert.equal(drawn, 0, 'not drawn mid-task');
  await microtasks();
  assert.equal(drawn, 1, 'drawn once for the burst');
  // A kill's event, then the tick's own redraw in the same task: nothing more to do.
  ui._trackerSoon();
  ui.renderTracker();
  await microtasks();
  assert.equal(drawn, 2, 'the queued redraw found nothing left to draw');
  // A failing redraw is logged, never thrown at the page, and the next one still runs.
  const err = console.error;
  const said = [];
  console.error = (...a) => said.push(a.join(' '));
  try {
    ui._coalesce('boom', () => { throw new Error('bad'); });
    await microtasks();
  } finally { console.error = err; }
  assert.equal(said.length, 1);
  ui._trackerSoon();
  await microtasks();
  assert.equal(drawn, 3);
});

test('the tracker pointer looks only among the NPCs it could point at, and sees the world change', () => {
  const g = freshGame();
  const ui = { game: g };
  ui._trkCandidates = UI.prototype._trkCandidates;
  const ptr = (pred, key) => UI.prototype._trkPointer.call(ui, pred, key);
  const ids = [...new Set(g.npcs.filter((n) => n.attackable).map((n) => n.npcId))].slice(0, 25);
  const fams = [...new Set(g.npcs.filter((n) => n.attackable).map((n) => n.def.family))].slice(0, 10);
  for (const id of ids) assert.equal(ptr((n) => n.npcId === id, `id:${id}`), ptr((n) => n.npcId === id), id);
  for (const f of fams) assert.equal(ptr((n) => n.def.family === f, `fam:${f}`), ptr((n) => n.def.family === f), f);
  assert.equal(ptr(() => false, 'id:nobody'), '');
  // One that joins the world (right beside you) is pointed at straight away...
  const id = ids.find((x) => !/here/.test(ptr((n) => n.npcId === x, `id:${x}`)) && ptr((n) => n.npcId === x, `id:${x}`));
  assert.ok(id, 'a target some way off');
  const near = new NPC(id, Math.round(g.player.x) + 2, Math.round(g.player.y));
  g.npcs.push(near);
  assert.match(ptr((n) => n.npcId === id, `id:${id}`), /here/, 'a new arrival counts');
  // ...one that dies is passed over, and one that leaves the world is forgotten.
  near.alive = false;
  assert.equal(ptr((n) => n.npcId === id, `id:${id}`), ptr((n) => n.npcId === id));
  near.alive = true;
  g.npcs = g.npcs.filter((n) => n !== near);
  assert.equal(ptr((n) => n.npcId === id, `id:${id}`), ptr((n) => n.npcId === id));
  assert.doesNotMatch(ptr((n) => n.npcId === id, `id:${id}`), /here/);
});

// ---------------- Notice lane ----------------
test('the notice lane is measured once the browser has laid the page out (a ResizeObserver), once per frame', async () => {
  const saved = { RO: globalThis.ResizeObserver, doc: globalThis.document, raf: globalThis.requestAnimationFrame, st: globalThis.setTimeout };
  const observers = [];
  const frames = [];
  const timers = [];
  globalThis.setTimeout = (f, ms) => { timers.push({ f, ms }); return timers.length; };
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.watching = new Set(); observers.push(this); }
    observe(t) { this.watching.add(t); }
    disconnect() { this.watching.clear(); }
    fire() { if (this.watching.size) this.cb([...this.watching].map((target) => ({ target }))); }
  };
  globalThis.document = { documentElement: { id: 'root' } };
  globalThis.requestAnimationFrame = (f) => frames.push(f);
  try {
    const lane = new NoticeLane({});
    let placed = 0;
    lane.place = () => { placed++; };
    lane.placeSoon(); lane.placeSoon(); lane.placeSoon();
    assert.equal(observers.length, 1);
    const ro = observers[0];
    assert.equal(ro.watching.size, 1, 'watching the root for the next layout');
    assert.equal(frames.length, 0, 'no animation frame needed');
    assert.equal(placed, 0, 'not measured mid-tick');
    ro.fire();
    assert.equal(placed, 1, 'measured once, after layout');
    assert.equal(ro.watching.size, 0, 'and it stops watching');
    ro.fire();
    assert.equal(placed, 1, 'nothing more until asked again');
    // Asked again: a fresh observation (each is reported once, after the next layout).
    lane.placeSoon();
    assert.equal(ro.watching.size, 1);
    // A job that asks again while being run waits for the next frame, never
    // re-observing inside the observer's own callback.
    lane.place = () => { placed++; if (placed === 2) lane.placeSoon(); };
    ro.fire();
    assert.equal(placed, 2);
    assert.equal(ro.watching.size, 0, 'not re-observed inside the callback');
    assert.equal(frames.length, 1, 'armed on the next frame instead');
    frames.shift()();
    assert.equal(ro.watching.size, 1);
    ro.fire();
    assert.equal(placed, 3);
    // A browser that never answers: after a second the lane is placed anyway.
    timers.length = 0;
    lane.placeSoon();
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, 1000);
    timers[0].f();
    assert.equal(placed, 4, 'placed by the watchdog');
    assert.equal(ro.watching.size, 0);
    lane.placeSoon();
    ro.fire();
    assert.equal(placed, 5, 'and the next one goes the quick way again');
    timers.at(-1).f();
    assert.equal(placed, 5, 'a watchdog with nothing left to do does nothing');
  } finally {
    for (const [k, v] of [['ResizeObserver', saved.RO], ['document', saved.doc], ['requestAnimationFrame', saved.raf], ['setTimeout', saved.st]]) {
      if (v) globalThis[k] = v; else delete globalThis[k];
    }
  }
});

// ---------------- Hidden panels ----------------
test('hidden panels skip their redraws and catch up when they show', () => {
  const g = freshGame();
  const classes = (...on) => ({ contains: (c) => on.includes(c) });
  const view = (hidden) => ({ closest: () => ({ classList: classes(...(hidden ? ['hidden'] : [])) }) });
  const hidden = (folded, viewHidden) => UI.prototype._panelHidden.call({ el: { sidepanel: { classList: classes(...(folded ? ['collapsed'] : [])) } } }, view(viewHidden));
  assert.equal(hidden(false, false), false, 'open, on this view: showing');
  assert.equal(hidden(true, false), true, 'the panel folded');
  assert.equal(hidden(false, true), true, 'another view showing');
  // Out of sight, once drawn: noted, not drawn (and "What next?" is not worked out).
  for (const [fn, el, flag] of [['renderQuestPanel', { questPanel: {} }, '_questStale'], ['renderAchievementPanel', { achievementPanel: {} }, '_achStale'],
    ['renderEquipment', { equipLayout: {} }, '_equipStale'], ['renderAlignment', { alignment: {} }, '_alignStale']]) {
    const ui = { game: g, el, _questDrawn: true, _achDrawn: true, _equipDrawn: true, _alignDrawn: true, _panelHidden: () => true };
    assert.doesNotThrow(() => UI.prototype[fn].call(ui), fn);
    assert.equal(ui[flag], true, `${fn} notes it is out of date`);
  }
  const combat = { game: g, _styleRow: {}, _combatDrawn: true, _panelHidden: () => true };
  UI.prototype.renderCombatPanel.call(combat);
  assert.equal(combat._combatStale, true);
  // Catching up draws exactly the ones that missed a redraw.
  const drawn = [];
  const ui = { _equipStale: true, _combatStale: false, _questStale: true, _achStale: false, _alignStale: true };
  for (const fn of ['renderEquipment', 'renderCombatPanel', 'renderQuestPanel', 'renderAchievementPanel', 'renderAlignment']) ui[fn] = () => drawn.push(fn);
  UI.prototype._catchUpPanels.call(ui);
  assert.deepEqual(drawn, ['renderEquipment', 'renderQuestPanel', 'renderAlignment']);
});

test('a view coming into sight is drawn at once, even while its tab is still pressed', () => {
  // Redraws wait while a finger is down on the panel (_initPressHold): the
  // catch-up must not, or the view's first frame shows its old state.
  const saved = globalThis.document;
  const on = {};
  globalThis.document = { addEventListener: (ev, fn) => { (on[ev] ||= []).push(fn); } };
  try {
    const drawn = [];
    const ui = {};
    for (const fn of ['renderEquipment', 'renderCombatPanel', 'renderQuestPanel', 'renderAchievementPanel']) ui[fn] = () => drawn.push(fn);
    UI.prototype._initPressHold.call(ui);
    for (const f of on.pointerdown) f({ target: { closest: () => true } });   // a finger down on the side panel
    ui.renderQuestPanel();
    assert.deepEqual(drawn, [], 'an ordinary redraw waits for the press to end');
    ui._equipStale = true; ui._questStale = true;
    UI.prototype._catchUpPanels.call(ui);
    assert.deepEqual(drawn, ['renderEquipment', 'renderQuestPanel'], 'the views coming into sight are drawn now');
  } finally {
    if (saved) globalThis.document = saved; else delete globalThis.document;
  }
});

test('the journal goals are not worked out while the journal is out of sight', () => {
  const g = freshGame();
  let drawn = 0;
  const ui = { game: g, el: { questPanel: {} }, _wnGoals: [], renderQuestPanel() { drawn++; }, _soon: (k, fn) => fn(), _panelHidden: () => true };
  watchGoals(ui);
  g.inventory.add('iron_dagger', 1);
  assert.equal(drawn, 0, 'no redraw while hidden');
  assert.equal(ui._questStale, true, 'but it will catch up when shown');
  ui._panelHidden = () => false;
  ui._questStale = false;
  g.bus.emit('inventory');
  assert.equal(drawn, 1, 'showing: new goals redraw it as before');
});

// ---------------- Per-burst HUD redraws ----------------
test('the quick bar works its Eat slot out once per burst of bag changes', () => {
  const on = {};
  const game = new Game();
  game.bus = { on: (ev, fn) => { (on[ev] ||= []).push(fn); }, emit() {} };
  const queued = new Map();
  const ui = { game, _coalesce: (k, fn) => queued.set(k, fn) };
  const bar = new QuickBar(ui);
  let drawn = 0;
  bar.render = () => { drawn++; };
  for (let i = 0; i < 5; i++) on.inventory[0]();
  assert.equal(drawn, 0, 'not drawn per change');
  assert.deepEqual([...queued.keys()], ['quickbar']);
  queued.get('quickbar')();
  assert.equal(drawn, 1);
  on.autobattle[0]();
  assert.equal(drawn, 2, 'its own switches still redraw at once');
});

test('the chat peek shows the last news of a burst, checked once', () => {
  const on = {};
  const game = { bus: { on: (ev, fn) => { (on[ev] ||= []).push(fn); } } };
  const queued = [];
  const hud = new CompactHud({ game, _coalesce: (k, fn) => queued.push([k, fn]) });
  let ticks = 0;
  hud.tick = () => { ticks++; };
  on.chat[0]({ text: 'You loot: a Rune scimitar.', cls: 'level' });
  on.chat[0]({ text: 'You hit 12.', cls: 'combat' });
  on.chat[0]({ text: 'Kill streak 5!', cls: 'level' });
  on.chat[0]({ text: '', cls: 'game' });
  assert.equal(hud._peekText, 'Kill streak 5!', 'the last non-combat line (combat lines never wake it)');
  assert.ok(queued.every(([k]) => k === 'chatpeek'));
  queued.at(-1)[1]();
  assert.equal(ticks, 1);
});

test('the region labels are rewritten only when the place changes', () => {
  let writes = 0;
  const label = { classList: { toggle() {} } };
  Object.defineProperty(label, 'innerHTML', { set() { writes++; } });
  const ui = { el: { region: label, minimapRegion: { classList: { toggle() {} } } } };
  for (let i = 0; i < 5; i++) UI.prototype.setRegion.call(ui, 'Kampong Glam', 0);
  assert.equal(writes, 1, 'every tick asks; the first one writes');
  UI.prototype.setRegion.call(ui, 'Kampong Glam', 3);
  UI.prototype.setRegion.call(ui, 'Chinatown', 3);
  assert.equal(writes, 3);
  assert.equal(ui.el.minimapRegion.textContent, 'Chinatown (Lvl 3)');
});

test("the boss portrait's two hit flashes are the very same animation", () => {
  const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
  const frames = (name) => new RegExp(`@keyframes ${name} \\{(.*)\\}\\s*$`, 'm').exec(css)?.[1];
  assert.ok(frames('bpHit'));
  assert.equal(frames('bpHit2'), frames('bpHit'));
  const rule = (cls) => new RegExp(`#boss-bar-portrait\\.${cls} \\.bp-img \\{ animation: \\w+ ([^;]+);`).exec(css)?.[1];
  assert.equal(rule('hit2'), rule('hit'), 'same length and easing');
  assert.equal(rule('hit'), '.22s ease-out');
});

// ---------------- Same answers, sooner ----------------
test('the first pack upgrade is the first of the whole list, found without weighing the rest', () => {
  const g = freshGame();
  assert.equal(packUpgrade(g), packUpgrades(g)[0] || null, 'the starter kit');
  const gear = Object.keys(ITEMS).filter((id) => ITEMS[id].equip && !ITEMS[id].tool);
  let most = 0;
  for (let round = 0; round < 6; round++) {
    for (let k = 0; k < 25; k++) g.inventory.add(gear[Math.floor(Math.random() * gear.length)], 1);
    g.skills.addXp(['attack', 'defence', 'strength', 'ranged', 'magic'][round % 5], 20000 * (round + 1));
    const all = packUpgrades(g);
    most = Math.max(most, all.length);
    assert.equal(packUpgrade(g), all[0] || null, `round ${round}`);
    const told = new Set(all.slice(0, round).map((s) => `${s.id}:${s.q || ''}`));
    const want = (x) => !told.has(`${x.id}:${x.q || ''}`);
    assert.equal(firstPackUpgrade(g, want), all.find(want) || null, `the first not yet told, round ${round}`);
  }
  assert.ok(most >= 3, `packs with several upgrades in them were tried (${most})`);
});

test('the fight suggestion is the same with the level band tested first', () => {
  const g = freshGame();
  // The way it was worked out before.
  const before = (game) => {
    const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const cl = game.fightLevel(), p = game.playerTile(), lo = Math.max(1, cl - 8), hi = cl + 3;
    let best = null;
    for (const n of game.npcs) {
      if (!n.alive || !n.attackable || n.temporary || n.def.boss || n.def.fixed || n.champion) continue;
      const l = n.def.level || 1;
      if (l < lo || l > hi) continue;
      if (game.world.zoneAt(n.x, n.y)?.wilderness) continue;
      if (!best || l > best.l + 2 || (Math.abs(l - best.l) <= 2 && dist(n, p) < dist(best.n, p))) best = { n, l };
    }
    return best ? best.n : null;
  };
  let found = 0;
  for (const xp of [0, 3000, 40000, 400000, 4e6, 4e9]) {
    for (const s of ['attack', 'strength', 'defence', 'hitpoints']) g.skills.xp[s] = xp;
    const want = before(g);
    if (want) found++;
    assert.equal(fightTarget(g), want, `at ${xp} xp`);
  }
  assert.ok(found >= 3, 'monsters were found at several levels');
});
