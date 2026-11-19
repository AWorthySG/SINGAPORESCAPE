// An easier interface: the one notification lane (src/ui/notices.js and
// noticelane.js), short numbers, the quick-use slot's choice, the foldable
// Objectives, the Interact caption and the phone sheet's half / full snap.
import './seed.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { shortNumber } from '../src/core/utils.js';
import { NoticeQueue, MAX_VISIBLE, MAX_QUEUED } from '../src/ui/notices.js';
import { NoticeLane } from '../src/ui/noticelane.js';
import { quickUseChoice, quickUse, healOf } from '../src/game/quickuse.js';
import { interactCaption, trackerHTML, loadTrackerFolded, saveTrackerFolded, TRACKER_KEY, sheetSnap } from '../src/ui/hudease.js';
import { UI } from '../src/ui/ui.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const game = new Game();
  game.start();
  game.ui = new Proxy({}, { get: () => () => {} });
  return game;
}
/** An empty pack (the starter kit cleared) with just these stacks. */
function packWith(game, stacks) {
  game.inventory.slots.fill(null);
  for (const [id, n] of stacks) game.inventory.add(id, n);
}

// ---------------- Short numbers ----------------
test('shortNumber: full digits under 10,000, then K / M / B, never rounding up', () => {
  assert.equal(shortNumber(0), '0');
  assert.equal(shortNumber(999), '999');
  assert.equal(shortNumber(9999), '9,999');
  assert.equal(shortNumber(10000), '10.0K');
  assert.equal(shortNumber(12345), '12.3K');
  assert.equal(shortNumber(14600), '14.6K', 'no floating-point slip to 14.5K');
  assert.equal(shortNumber(99999), '99.9K', 'rounds down: a coin count never looks bigger than it is');
  assert.equal(shortNumber(456789), '456K', 'no decimal from 100 of a unit up');
  assert.equal(shortNumber(999999), '999K');
  assert.equal(shortNumber(1200000), '1.2M');
  assert.equal(shortNumber(3456789), '3.4M');
  assert.equal(shortNumber(1e9), '1.0B');
  assert.equal(shortNumber(-25000), '-25.0K');
  assert.equal(shortNumber(NaN), '0');
  assert.equal(shortNumber('2500'), '2,500');
});

// ---------------- The notification queue ----------------
test('the lane shows two at a time, queues the rest and brings them in as cards expire', () => {
  const q = new NoticeQueue();
  for (let i = 1; i <= 4; i++) q.push({ html: `note ${i}`, ttl: 1000 }, 0);
  assert.equal(MAX_VISIBLE, 2);
  assert.deepEqual(q.visible().map((x) => x.html), ['note 1', 'note 2']);
  assert.equal(q.queued().length, 2);
  assert.equal(q.nextExpiry(), 1000);
  assert.equal(q.tick(999), false, 'nothing is due yet');
  assert.ok(q.tick(1000), 'the first two time out');
  assert.deepEqual(q.visible().map((x) => x.html), ['note 3', 'note 4']);
  assert.equal(q.visible()[0].shownAt, 1000, 'their clock starts when they show, not when they were queued');
  q.tick(2000);
  assert.equal(q.items.length, 0);
});

test('duplicates merge into one card with a count, and a repeat keeps it up longer', () => {
  const q = new NoticeQueue();
  q.push({ html: '<span class="big">Rare drop!</span>Dragon dagger', ttl: 1000 }, 0);
  const again = q.push({ html: '<span class="big">Rare drop!</span>Dragon dagger', ttl: 1000 }, 800);
  assert.equal(q.items.length, 1);
  assert.equal(again.count, 2);
  q.tick(1500);
  assert.equal(q.items.length, 1, 'the clock restarted at the repeat');
  // A waiting duplicate merges too, without jumping the queue.
  q.push({ html: 'a' }, 0); q.push({ html: 'b' }, 0); q.push({ html: 'b' }, 0);
  assert.equal(q.items.filter((x) => x.html === 'b').length, 1);
});

test('tap to dismiss, tags clear only their own cards, and priority and the backlog cap', () => {
  const q = new NoticeQueue();
  const a = q.push({ html: 'Wave 1', tag: 'waves' }, 0);
  q.push({ html: 'Level up!' }, 0);
  q.push({ html: 'Queued' }, 0);
  assert.ok(q.dismissTag('waves', 10));
  assert.ok(!q.items.includes(a));
  assert.deepEqual(q.visible().map((x) => x.html), ['Level up!', 'Queued'], 'the next one comes in at once');
  assert.equal(q.dismissTag(null), false, 'untagged cards are never cleared by tag');
  q.dismiss(q.visible()[0].id, 20);
  assert.equal(q.items.length, 1);
  // A more urgent card waiting goes first.
  const p = new NoticeQueue({ max: 1 });
  p.push({ html: 'first' }, 0); p.push({ html: 'later' }, 0); p.push({ html: 'urgent', priority: 2 }, 0);
  p.dismiss(p.visible()[0].id, 1);
  assert.equal(p.visible()[0].html, 'urgent');
  // A flood keeps at most MAX_QUEUED waiting, dropping the oldest low-priority ones.
  const f = new NoticeQueue();
  for (let i = 0; i < 20; i++) f.push({ html: `drop ${i}`, priority: i === 3 ? 1 : 0 }, 0);
  assert.equal(f.queued().length, MAX_QUEUED);
  assert.ok(f.queued().some((x) => x.html === 'drop 3'), 'the important one survives the trim');
  assert.ok(f.queued().some((x) => x.html === 'drop 19'), 'the newest are kept');
});

test('game banners and tips go through the lane (headless: queue only)', () => {
  const g = newGame();
  const ui = { game: g, el: {} };
  g.ui = new Proxy(ui, { get: (t, k) => (k in t ? t[k] : typeof UI.prototype[k] === 'function' ? UI.prototype[k].bind(t) : () => {}) });
  g.banner('<span class="big">Golden hours</span>Woodcutting XP +50%');
  g.banner('<span class="big">Night hunt</span>+50% combat XP');
  g.banner('<span class="big">Golden hours</span>Woodcutting XP +50%');
  assert.ok(ui.lane instanceof NoticeLane);
  assert.equal(ui.lane.queue.items.length, 2, 'the repeat merged');
  // A tip takes its place in the same lane; "Don't show tips" turns them off.
  g.tipsOn = true;
  UI.prototype.showTip.call(ui, 'move');
  assert.ok(ui.lane.has('tip'));
  assert.ok(g.tipsSeen.has('move'), 'seen as soon as it shows');
  UI.prototype.tipsOff.call(ui);
  assert.equal(g.tipsOn, false);
  assert.ok(!ui.lane.has('tip'), 'the tip card goes at once');
});

// ---------------- Quick-use slot ----------------
test('quick use picks the food or healing potion that best fits the wound', () => {
  const g = newGame();
  g.skills.addXp('hitpoints', 200000);
  const max = g.maxHp();
  assert.ok(max >= 60, 'enough life for the heals to differ');
  packWith(g, [['kaya_toast', 4], ['chicken_rice', 2], ['healing_potion', 3], ['attack_potion', 5]]);
  const toast = healOf(g, 'kaya_toast'), rice = healOf(g, 'chicken_rice'), pot = healOf(g, 'healing_potion');
  assert.ok(toast < rice && rice < pot, `heals rise: ${toast} < ${rice} < ${pot}`);
  assert.equal(healOf(g, 'attack_potion'), 0, 'buff potions are not quick-use');
  // Full life: the smallest heal (nothing big is wasted).
  g.player.hp = max;
  assert.equal(quickUseChoice(g).id, 'kaya_toast');
  assert.equal(quickUseChoice(g).count, 4);
  // A middling wound: the smallest that covers it.
  g.player.hp = max - (toast + 1);
  assert.equal(quickUseChoice(g).id, rice >= toast + 1 ? 'chicken_rice' : 'healing_potion');
  // A wound nothing covers: the biggest heal, the potion, which it drinks.
  g.player.hp = 1;
  const c = quickUseChoice(g);
  assert.equal(c.id, 'healing_potion');
  assert.ok(c.drink);
  quickUse(g);
  assert.equal(g.inventory.count('healing_potion'), 2);
  assert.ok(g.player.hp > 1);
  // Nothing that heals: no choice, and the slot hides.
  packWith(g, [['attack_potion', 5]]);
  assert.equal(quickUseChoice(g), null);
  assert.equal(quickUse(g), null);
});

// ---------------- Objectives fold ----------------
test('the objectives fold to one line, remembered per viewer', () => {
  globalThis.localStorage = fakeStorage();
  const rows = ['<div class="trk-row trk-xp">XP x1.5</div>', '<div class="trk-row">Wild Macaque 0/11</div>', '<div class="trk-row">Young Bandit 0/18</div>'];
  const open = trackerHTML(rows, false);
  assert.match(open, /class="trk-title trk-fold" aria-expanded="true"/);
  assert.ok(open.includes('Wild Macaque') && open.includes('Young Bandit'));
  const folded = trackerHTML(rows, true);
  assert.match(folded, /&#9733; 2 objectives/, 'counts objectives, not the XP row');
  assert.ok(!folded.includes('Wild Macaque'), 'one line only');
  assert.match(trackerHTML([rows[1]], true), /1 objective</);
  assert.equal(trackerHTML([], true), '');
  assert.equal(loadTrackerFolded(), false, 'open by default');
  saveTrackerFolded(true);
  assert.equal(localStorage.getItem(TRACKER_KEY), '1');
  assert.equal(loadTrackerFolded(), true);
  saveTrackerFolded(false);
  assert.equal(loadTrackerFolded(), false);
  // Storage that throws (a private window) never breaks the tracker.
  globalThis.localStorage = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  assert.equal(loadTrackerFolded(), false);
  assert.doesNotThrow(() => saveTrackerFolded(true));
  globalThis.localStorage = fakeStorage();
});

test('renderTracker draws the folded line and a tap on the header toggles it', () => {
  globalThis.localStorage = fakeStorage();
  const g = newGame();
  const cls = new Set();
  let onClick = null;
  const el = { innerHTML: '', classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) }, addEventListener: (t, fn) => { if (t === 'click') onClick = fn; } };
  const ui = { game: g, el: { tracker: el }, _trkPointer: () => '' };
  ui.renderTracker = () => UI.prototype.renderTracker.call(ui);
  ui.renderTracker();
  assert.ok(!cls.has('hidden'), 'the starter bounties show');
  assert.ok(!cls.has('folded'));
  onClick({ target: { closest: (s) => (s === '.trk-fold' ? {} : null) } });
  assert.ok(cls.has('folded'));
  assert.match(el.innerHTML, /objectives?</);
  assert.equal(localStorage.getItem(TRACKER_KEY), '1', 'remembered');
  onClick({ target: { closest: () => null } });
  assert.ok(cls.has('folded'), 'a tap elsewhere on it does nothing');
});

// ---------------- Interact caption ----------------
test('the Interact button always says what it will do, short enough to fit', () => {
  const obj = (label) => ({ kind: 'obj', ref: { def: { label } } });
  assert.deepEqual(interactCaption(['Chop down', 'Oak tree', 'woodcutting', false], obj('Oak')), ['Chop', 'Oak']);
  assert.deepEqual(interactCaption(['Mine', 'Copper rock', 'mining', false], obj('Copper')), ['Mine', 'Copper']);
  assert.deepEqual(interactCaption(['Talk to', 'Pest Control Officer Aziz'], { kind: 'npc' }), ['Talk to', 'Aziz']);
  assert.deepEqual(interactCaption(['Talk to', 'Auntie Mei'], { kind: 'npc' }), ['Talk to', 'Auntie Mei']);
  assert.deepEqual(interactCaption(['Take', 'Logs'], { kind: 'item' }), ['Take', 'Logs']);
  assert.deepEqual(interactCaption(['Mine', 'Iron rock (needs Mining 15)', 'mining', true], obj('Iron')), ['Needs', 'Mining 15']);
  assert.deepEqual(interactCaption(null), ['Interact', '']);
  // The real labels from the game read the same way.
  const g = newGame();
  g.skills.addXp('woodcutting', 1e6);
  const tree = g.world.objects.find((o) => o.def.type === 'tree' && o.def.label === 'Oak');
  assert.ok(tree, 'an oak in the world');
  assert.deepEqual(interactCaption(g._interactLabel({ kind: 'obj', ref: tree }), { kind: 'obj', ref: tree }), ['Chop', 'Oak']);
});

// ---------------- Phone sheet snap ----------------
test('the phone sheet snaps: up to full, down to half, further down folds', () => {
  assert.equal(sheetSnap({ full: false, dy: -60, h: 370 }), 'full');
  assert.equal(sheetSnap({ full: false, dy: -20, h: 370 }), null, 'a nudge stays put');
  assert.equal(sheetSnap({ full: false, dy: 90, h: 370 }), 'close');
  assert.equal(sheetSnap({ full: false, dy: 40, h: 370 }), null);
  assert.equal(sheetSnap({ full: true, dy: 90, h: 630 }), 'half');
  assert.equal(sheetSnap({ full: true, dy: 400, h: 630 }), 'close');
  assert.equal(sheetSnap({ full: true, dy: 10, h: 630 }), null);
});

test('dragging the panel handle up makes it full; folding it resets to half', async () => {
  const listeners = {};
  const classes = new Set();
  const mk = (name) => {
    const own = {};
    return {
      name, style: {}, classList: { contains: (c) => (name === 'handle' ? c === 'sheet-handle' : classes.has(c)), add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
      addEventListener: (t, fn) => { (own[t] ||= []).push(fn); listeners[name] = own; },
      fire: (t, e = {}) => (own[t] || []).forEach((fn) => fn({ target: { closest: () => null }, pointerId: 1, ...e })),
      setPointerCapture() {}, getBoundingClientRect: () => ({ height: 370 }), closest: () => null,
    };
  };
  const panel = mk('panel'), handle = mk('handle'), head = mk('head');
  panel.querySelector = (s) => (s === '.sheet-handle' ? handle : null);
  const prev = { document: globalThis.document, matchMedia: globalThis.matchMedia };
  globalThis.document = { getElementById: () => null };
  globalThis.matchMedia = (q) => ({ matches: !q.includes('max-height: 500px)') || q.includes('pointer') });
  let folded = 0;
  try {
    UI.prototype._initSheets.call({ el: { sidepanel: panel, panelHead: head, modalTitle: null }, _collapseApply: { panel: () => { folded++; } } });
    handle.fire('pointerdown', { clientX: 10, clientY: 400 });
    handle.fire('pointermove', { clientX: 10, clientY: 300 });
    assert.equal(panel.style.height, '470px', 'the sheet grows with the finger');
    handle.fire('pointerup');
    assert.ok(classes.has('sheet-full'), 'snapped full');
    assert.equal(panel.style.height, '', 'the stylesheet takes over again');
    handle.fire('pointerdown', { clientX: 10, clientY: 300 });
    handle.fire('pointermove', { clientX: 10, clientY: 380 });
    handle.fire('pointerup');
    assert.ok(!classes.has('sheet-full'), 'down a little: back to half');
    assert.equal(folded, 0);
    handle.fire('pointerdown', { clientX: 10, clientY: 300 });
    handle.fire('pointermove', { clientX: 10, clientY: 400 });
    handle.fire('pointerup');
    assert.equal(folded, 1, 'further down from half folds it');
  } finally { Object.assign(globalThis, prev); }
});
