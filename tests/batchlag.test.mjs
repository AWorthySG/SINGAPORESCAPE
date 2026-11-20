// Big "… all" batches must not freeze the game. A batch of thousands of items
// used to tell the bus about every one of them ('inventory' twice and 'xp' once
// per item), and each event redrew the bag, the quick-use slot and the XP drop:
// 5,000 raw fish froze a desktop for six seconds. Now a batch holds its news
// and tells it once at the end, and the results are exactly what they were.
import { seedRandom } from './seed.mjs';   // seeded Math.random: no test fails on an unlucky roll
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../src/game/game.js';
import { clearSave } from '../src/game/save.js';
import { xpForLevel } from '../src/data/xp.js';
import { UNLOCKS } from '../src/data/unlocks.js';
import { ITEMS } from '../src/data/items.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function newGame() {
  globalThis.localStorage = fakeStorage();
  clearSave();
  const g = new Game();
  g.start();
  g.chooseStartingStyle('melee');
  g.ui = new Proxy({}, { get: () => () => {} });
  g.npcs = [];   // nothing to interrupt the work
  return g;
}
const ADJ = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function standBy(g, obj) {
  for (const [dx, dy] of ADJ) {
    const x = obj.x + dx, y = obj.y + dy;
    if (!g.world.isBlocked(x, y) && !g.world.objectAt(x, y)) { g.player.x = g.player.tx = x; g.player.y = g.player.ty = y; return; }
  }
  throw new Error(`no room beside ${obj.objId}`);
}
/** Count every bus event (and keep the 'xp' payloads) from now on. */
function countEmits(g) {
  const n = {}, xp = [];
  const emit = g.bus.emit.bind(g.bus);
  g.bus.emit = (ev, p) => { n[ev] = (n[ev] || 0) + 1; if (ev === 'xp') xp.push(p); return emit(ev, p); };
  return { n, xp };
}
// "… all" at each kind of station, with what to put in the pack for `n` items.
const KINDS = {
  cook: { station: 'range', skill: 'cooking', fill: (g, n) => g.inventory.add('raw_sardine', n) },
  // Iron ore too: once the bronze has raised Smithing past 15, "Smelt all" goes on to iron bars.
  smelt: { station: 'furnace', skill: 'smithing', fill: (g, n) => { g.inventory.add('copper_ore', n); g.inventory.add('tin_ore', n); g.inventory.add('iron_ore', 200); } },
  craft: { station: 'craft', skill: 'crafting', fill: (g, n) => g.inventory.add('clay', n) },
  fletching: { station: 'fletch', skill: 'fletching', fill: (g, n) => { g.inventory.add('logs', n); if (!g.hasTool('knife')) g.inventory.add('knife', 1); } },
};
/** A long-played pack (a hundred kinds of item), level 1 in the making skills, beside the station. */
function setUp(g, kind, n) {
  const k = KINDS[kind];
  let i = 0;
  for (const id of Object.keys(ITEMS)) { if (i++ >= 100) break; if (!/ore|clay|logs|raw_|knife|hammer/.test(id)) g.inventory.add(id, 1); }
  for (const s of ['cooking', 'smithing', 'crafting', 'fletching']) g.skills.xp[s] = xpForLevel(1);
  const st = g.world.objects.find((o) => o.def?.type === k.station);
  standBy(g, st);
  k.fill(g, n);
  return st;
}

for (const kind of Object.keys(KINDS)) {
  test(`"${kind} all" with 5,000 items: done in one tick, quickly, and the bag and XP told once`, () => {
    const g = newGame();
    const st = setUp(g, kind, 5000);
    const { skill } = KINDS[kind];
    const xp0 = g.skills.xp[skill];
    assert.ok(g.startAll(kind, st));
    const { n, xp } = countEmits(g);
    const t0 = performance.now();
    g.update(600);
    const ms = performance.now() - t0;
    // About 50ms on a desktop; generous for a slow CI runner (it was over 6s in a browser).
    assert.ok(ms < 3000, `${kind} all took ${ms.toFixed(0)}ms`);
    assert.equal(g.player.action, null, 'the station is done');
    assert.equal(n.inventory, 1, `one 'inventory' event for the batch (${JSON.stringify(n)})`);
    const mine = xp.filter((p) => p.skill === skill);
    assert.equal(mine.length, 1, `one 'xp' event for ${skill}`);
    // The one event carries the whole batch: the summed XP and how many gains it was.
    assert.ok(Math.abs(mine[0].amount - (g.skills.xp[skill] - xp0)) < 1e-6, 'its amount is the batch\'s XP');
    assert.equal(mine[0].total, g.skills.xp[skill]);
    assert.ok(mine[0].count >= 5000, `count ${mine[0].count} gains`);
    assert.ok(n.levelup > 10, 'level-ups still come as each level is reached');
    if (kind === 'smelt') assert.equal(g.inventory.count('iron_ore'), 0, 'and on to the iron, in the same batch');
  });
}

/** Run "… all" from the same seed, batched (as the game does) or item by item
 *  as before (no held news, the whole bag counted around each make). */
function runSeeded(kind, n, { batched }) {
  seedRandom();
  UNLOCKS.on = true;   // unlocks on: kept materials exercise the change journal
  const g = newGame();
  const st = setUp(g, kind, n);
  if (!batched) {
    g.inventory.hold = () => false;
    g.skills.hold = () => false;
    g.inventory.journal = undefined;
  }
  let pets = null;
  const rel = g.pets.release.bind(g.pets);
  g.pets.release = () => { pets ||= { ...g.pets._held }; return rel(); };
  g.pets.rand = () => 1;   // no pet joins (its own dice): only the count of rolls is compared
  const said = [];
  const msg = g.msg.bind(g);
  g.msg = (m, c) => { said.push(m); return msg(m, c); };
  g.startAll(kind, st);
  g.update(600);
  UNLOCKS.on = false;
  return {
    slots: JSON.stringify(g.inventory.serialize()),
    xp: JSON.stringify(g.skills.xp),
    unlockSeed: g._unlockSeed,
    pets,
    summary: said.filter((m) => /^You (cook|smelt|craft|fletch)/.test(m)),
  };
}

for (const kind of Object.keys(KINDS)) {
  test(`"${kind} all": the batch gives exactly what making item by item gave (seeded)`, () => {
    const a = runSeeded(kind, 3000, { batched: true });
    const b = runSeeded(kind, 3000, { batched: false });
    assert.equal(a.slots, b.slots, 'the same pack, slot for slot');
    assert.equal(a.xp, b.xp, 'the same XP');
    assert.equal(a.unlockSeed, b.unlockSeed, 'the same unlock rolls');
    assert.deepEqual(a.pets, b.pets, 'the same number of pet rolls');
    assert.deepEqual(a.summary, b.summary, 'the same summary line');
  });
}

test('a batch that climbs many levels tells each skill\'s unlocks in one line and banner, and the last perk note', () => {
  UNLOCKS.on = true;
  try {
    const g = newGame();
    const banners = [];
    g.ui = new Proxy({}, { get: (t, k) => (k === 'showBanner' ? (h) => banners.push(h) : () => {}) });
    const said = [];
    const msg = g.msg.bind(g);
    g.msg = (m, c) => { said.push(m); return msg(m, c); };
    const st = setUp(g, 'fletching', 5000);
    g.startAll('fletching', st);
    g.update(600);
    assert.ok(g.skills.level('fletching') >= 50, `fletching ${g.skills.level('fletching')}`);
    const unlockLines = said.filter((m) => /^Fletching \d+.*unlock/.test(m));
    assert.equal(unlockLines.length, 1, `one unlock line (${unlockLines.join(' | ')})`);
    assert.match(unlockLines[0], /^Fletching \d+: \d+ unlocks opened\./);
    assert.equal(banners.filter((h) => /Fletching/.test(h)).length, 1, 'one unlock banner');
    const perkLines = said.filter((m) => /^Life skill perk: your Fletching/.test(m));
    assert.equal(perkLines.length, 1, `only the last life-skill perk note (${perkLines.join(' | ')})`);
  } finally { UNLOCKS.on = false; }
});

test('the quick-use slot works out your max life once, not once per kind of item carried', async () => {
  const { quickUseChoice } = await import('../src/game/quickuse.js');
  const g = newGame();
  setUp(g, 'cook', 1);
  g.inventory.add('kaya_toast', 3);
  let calls = 0;
  const maxHp = g.maxHp.bind(g);
  g.maxHp = () => { calls++; return maxHp(); };
  assert.ok(quickUseChoice(g), 'it finds something to eat');
  assert.equal(calls, 1);
});

test('notes pushed in one tick are drawn once, on the next frame', async () => {
  const { NoticeLane } = await import('../src/ui/noticelane.js');
  const frames = [], raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  try {
    const lane = new NoticeLane({});
    let drawn = 0;
    lane.render = () => { drawn++; };
    for (let i = 0; i < 5; i++) lane.push({ html: `Unlock ${i}`, kind: 'banner' });
    assert.equal(drawn, 0, 'not drawn mid-tick');
    assert.equal(frames.length, 1, 'one frame asked for');
    frames.shift()();
    assert.equal(drawn, 1);
    assert.equal(lane.queue.items.length, 5, 'every note is still queued');
  } finally {
    if (raf) globalThis.requestAnimationFrame = raf; else delete globalThis.requestAnimationFrame;
  }
});

test('many level-ups at once chime once', async () => {
  const { Sfx } = await import('../src/audio/sfx.js');
  const { EventBus } = await import('../src/core/events.js');
  const bus = new EventBus();
  const sfx = new Sfx(bus);
  sfx.ctx = { currentTime: 10 };
  const played = [];
  sfx.play = (n) => played.push(n);
  for (let i = 0; i < 40; i++) bus.emit('levelup', { skill: 'cooking', level: i + 2 });
  assert.deepEqual(played, ['level']);
  sfx.ctx.currentTime = 11;
  bus.emit('levelup', { skill: 'cooking', level: 50 });
  assert.equal(played.length, 2, 'a later level-up chimes again');
});
